"""
Correction Engine — auditor review + auto-approve/reject/escalatie logica.
Leest regels uit config/correction_rules.yaml.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import yaml

import omega_db
from holding.src import llm_router

logger = logging.getLogger(__name__)
CONFIG_DIR = Path(__file__).resolve().parent.parent.parent / "config"

_rules: dict | None = None


def _load_rules() -> dict:
    global _rules
    if _rules is not None:
        return _rules
    path = CONFIG_DIR / "correction_rules.yaml"
    if path.exists():
        with open(path, encoding="utf-8") as f:
            _rules = yaml.safe_load(f) or {}
    else:
        _rules = {}
    return _rules


async def audit(auditor: dict, task: dict, output: str) -> dict:
    """
    Laat de auditor-agent de output beoordelen.
    Retourneert: {"confidence": float, "verdict": str, "feedback": str, "severity": str, "issues": list}
    """
    prompt = (
        f"Beoordeel de volgende output voor tenant '{task.get('tenant_id', '')}'.\n"
        f"Taak: {task.get('title', '')}\n"
        f"Type: {task.get('type', '')}\n\n"
        f"--- OUTPUT ---\n{output}\n--- EINDE OUTPUT ---\n\n"
        "Geef je beoordeling als JSON met deze velden:\n"
        '{"confidence": 0.0-1.0, "verdict": "pass|needs_revision|reject", '
        '"feedback": "specifieke feedback", "severity": "minor|major|critical", '
        '"issues": ["issue 1", ...]}\n'
        "Antwoord ALLEEN met geldige JSON."
    )

    raw = await llm_router.generate(auditor, prompt, task["tenant_id"])
    return _parse_review(raw)


def _parse_review(raw: str) -> dict:
    """Probeer JSON te parsen uit auditor-output."""
    defaults = {
        "confidence": 0.5, "verdict": "needs_revision",
        "feedback": raw[:500], "severity": "minor", "issues": [],
    }
    text = raw.strip()
    if "```" in text:
        start = text.find("```")
        end = text.rfind("```")
        inner = text[start:end] if end > start else text[start:]
        first_nl = inner.find("\n")
        text = inner[first_nl + 1:] if first_nl >= 0 else inner[3:]
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            for k, v in defaults.items():
                parsed.setdefault(k, v)
            return parsed
    except (json.JSONDecodeError, ValueError):
        pass
    return defaults


def apply_review(task_id: str, task: dict, auditor: dict, review: dict) -> dict:
    """Pas review-resultaat toe: auto-approve, send-back, of escalatie."""
    rules = _load_rules()
    confidence = review.get("confidence", 0.5)
    verdict = review.get("verdict", "needs_revision")
    task_type = task.get("type", "")
    revision_count = task.get("revision_count", 0)
    max_revisions = task.get("max_revisions", 3)

    auto_types = (rules.get("auto_approve") or {}).get("task_types", [])
    escalate_types = (rules.get("escalate_to_human") or {}).get("task_types", [])

    if task_type in escalate_types or confidence < 0.6 or revision_count >= max_revisions:
        omega_db.holding_task_update_status(task_id, "rejected", confidence_score=confidence)
        omega_db.correction_insert(
            task_id=task_id, reviewer_agent_id=auditor["id"],
            original_output=str((task.get("output_data") or {}).get("content", ""))[:1000],
            correction="", reason=review.get("feedback", ""),
            severity=review.get("severity", "critical"))
        omega_db.holding_audit_log("task_escalated", tenant_id=task["tenant_id"],
                                   agent_id=auditor["id"], details={"task_id": task_id, "review": review})
        return {"ok": True, "action": "escalated", "review": review}

    if confidence >= 0.9 and verdict == "pass":
        omega_db.holding_task_update_status(task_id, "approved", confidence_score=confidence)
        omega_db.holding_audit_log("task_auto_approved", tenant_id=task["tenant_id"],
                                   agent_id=auditor["id"], details={"task_id": task_id})
        return {"ok": True, "action": "approved", "review": review}

    if verdict == "pass" and task_type in auto_types:
        omega_db.holding_task_update_status(task_id, "approved", confidence_score=confidence)
        omega_db.holding_audit_log("task_auto_approved", tenant_id=task["tenant_id"],
                                   agent_id=auditor["id"], details={"task_id": task_id})
        return {"ok": True, "action": "approved", "review": review}

    omega_db.holding_task_increment_revision(
        task_id, review_notes=review.get("feedback", ""), reviewed_by=auditor["id"],
        confidence_score=confidence)
    omega_db.correction_insert(
        task_id=task_id, reviewer_agent_id=auditor["id"],
        original_output=str((task.get("output_data") or {}).get("content", ""))[:1000],
        correction="", reason=review.get("feedback", ""),
        severity=review.get("severity", "minor"))
    omega_db.holding_audit_log("task_sent_back", tenant_id=task["tenant_id"],
                               agent_id=auditor["id"],
                               details={"task_id": task_id, "revision": revision_count + 1})
    return {"ok": True, "action": "sent_back", "review": review}
