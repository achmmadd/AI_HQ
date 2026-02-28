"""
Task Pipeline — aanmaken, toewijzen, uitvoeren, reviewen van holding-taken.
Hergebruikt approval flow via ai_tools.request_user_approval voor escalaties.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

import omega_db
from holding.src import agent_registry, correction_engine
from holding.src import llm_router

logger = logging.getLogger(__name__)


def create_task(tenant_id: str, task_type: str, title: str,
                description: str = "", priority: int = 5,
                created_by: str | None = None,
                input_data: dict | None = None) -> str:
    """Maak een holding-taak aan en wijs toe aan de beste agent."""
    omega_db.init_schema()
    task_id = f"ht_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"

    agent = agent_registry.get_agent_for_task(tenant_id, task_type)
    assigned_to = agent["id"] if agent else None

    omega_db.holding_task_insert(
        task_id=task_id, tenant_id=tenant_id, task_type=task_type,
        title=title, description=description, assigned_to=assigned_to,
        created_by=created_by, input_data=input_data, priority=priority,
    )
    omega_db.holding_audit_log("task_created", tenant_id=tenant_id, details={
        "task_id": task_id, "type": task_type, "assigned_to": assigned_to})

    logger.info("Holding task %s aangemaakt voor %s, assigned=%s",
                task_id, tenant_id, assigned_to)
    return task_id


async def execute_task(task_id: str) -> dict:
    """Voer een taak uit: agent + LLM, submit voor review."""
    task = omega_db.holding_task_get(task_id)
    if not task:
        return {"ok": False, "error": "Taak niet gevonden"}

    agent_id = task.get("assigned_to")
    if not agent_id:
        return {"ok": False, "error": "Geen agent toegewezen"}

    agent = omega_db.holding_agent_get(agent_id)
    if not agent:
        return {"ok": False, "error": f"Agent {agent_id} niet gevonden"}

    omega_db.holding_task_update_status(task_id, "in_progress")
    omega_db.holding_agent_set_status(agent_id, "busy")

    prompt = _build_prompt(task)
    try:
        output = await llm_router.generate(agent, prompt, task["tenant_id"])
    except Exception as e:
        omega_db.holding_agent_set_status(agent_id, "error")
        omega_db.holding_task_update_status(task_id, "pending")
        return {"ok": False, "error": str(e)}

    omega_db.holding_agent_set_status(agent_id, "idle")
    omega_db.holding_task_update_status(
        task_id, "review", output_data={"content": output})

    omega_db.holding_audit_log("task_executed", tenant_id=task["tenant_id"],
                               agent_id=agent_id, details={"task_id": task_id})

    return {"ok": True, "task_id": task_id, "output": output}


async def review_task(task_id: str) -> dict:
    """Laat de auditor van dezelfde tenant de taak reviewen."""
    task = omega_db.holding_task_get(task_id)
    if not task:
        return {"ok": False, "error": "Taak niet gevonden"}
    if task["status"] != "review":
        return {"ok": False, "error": f"Taak status is {task['status']}, niet 'review'"}

    auditor = agent_registry.get_auditor(task["tenant_id"])
    if not auditor:
        return {"ok": False, "error": "Geen auditor gevonden"}

    output = (task.get("output_data") or {}).get("content", "")
    review = await correction_engine.audit(auditor, task, output)

    return correction_engine.apply_review(task_id, task, auditor, review)


async def run_full_pipeline(tenant_id: str, task_type: str, title: str,
                            description: str = "", priority: int = 5,
                            input_data: dict | None = None) -> dict:
    """End-to-end: aanmaken → uitvoeren → reviewen."""
    task_id = create_task(tenant_id, task_type, title, description,
                          priority, input_data=input_data)
    exec_result = await execute_task(task_id)
    if not exec_result.get("ok"):
        return exec_result

    review_result = await review_task(task_id)
    return {**review_result, "task_id": task_id, "output": exec_result.get("output", "")}


def _build_prompt(task: dict) -> str:
    """Bouw een prompt op basis van taakgegevens + tenant context."""
    tenant = omega_db.tenant_get(task["tenant_id"])
    parts = []
    if tenant:
        parts.append(f"Brand: {tenant.get('name', '')}")
        if tenant.get("brand_voice"):
            parts.append(f"Brand voice: {tenant['brand_voice']}")
        if tenant.get("target_audience"):
            parts.append(f"Doelgroep: {tenant['target_audience']}")
    parts.append(f"Taak: {task['title']}")
    if task.get("description"):
        parts.append(f"Beschrijving: {task['description']}")
    if task.get("input_data"):
        inp = task["input_data"]
        if isinstance(inp, dict) and inp:
            parts.append(f"Input: {inp}")
    return "\n\n".join(parts)
