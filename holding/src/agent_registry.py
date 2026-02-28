"""
Agent Registry — beheer van holding agents (DB + config).
Seed 6 agents (3 per tenant) bij eerste run.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import omega_db
from holding.src.tenant_context import load_tenant_configs

logger = logging.getLogger(__name__)
PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"

SEED_AGENTS = [
    # ── Lunchroom ──
    dict(id="lr_manager", tenant_id="lunchroom", name="Lunchroom Marketing Director",
         role="manager", specialization="strategy",
         skills=["strategy", "delegation", "brand_oversight"], model="gemini",
         parent_agent_id=None, confidence_threshold=0.8),
    dict(id="lr_luna", tenant_id="lunchroom", name="Luna",
         role="werker", specialization="social_media",
         skills=["instagram", "captions", "hashtags", "stories", "food_content"],
         model="gemini", parent_agent_id="lr_manager", confidence_threshold=0.8),
    dict(id="lr_rico", tenant_id="lunchroom", name="Rico",
         role="werker", specialization="local_seo",
         skills=["local_seo", "google_reviews", "google_business", "review_response"],
         model="gemini", parent_agent_id="lr_manager", confidence_threshold=0.8),
    dict(id="lr_chef", tenant_id="lunchroom", name="Chef",
         role="auditor", specialization="quality",
         skills=["brand_voice", "spelling", "fact_check", "allergen_check"],
         model="gemini", parent_agent_id="lr_manager", confidence_threshold=0.9),
    # ── Webshop ──
    dict(id="ws_manager", tenant_id="webshop", name="Webshop Growth Director",
         role="manager", specialization="ecommerce_strategy",
         skills=["strategy", "ecommerce", "delegation", "conversion"], model="gemini",
         parent_agent_id=None, confidence_threshold=0.8),
    dict(id="ws_nova", tenant_id="webshop", name="Nova",
         role="werker", specialization="product_copy",
         skills=["product_descriptions", "meta_tags", "bullet_points", "usp_writing"],
         model="gemini", parent_agent_id="ws_manager", confidence_threshold=0.8),
    dict(id="ws_scout", tenant_id="webshop", name="Scout",
         role="werker", specialization="seo_research",
         skills=["keyword_research", "search_intent", "competitor_analysis", "content_gaps"],
         model="gemini", parent_agent_id="ws_manager", confidence_threshold=0.8),
    dict(id="ws_judge", tenant_id="webshop", name="Judge",
         role="auditor", specialization="quality",
         skills=["seo_quality", "brand_consistency", "accuracy", "legal_check"],
         model="gemini", parent_agent_id="ws_manager", confidence_threshold=0.9),
]


def _load_prompt(agent_id: str) -> str:
    """Lees system prompt uit prompts/<tenant>/<agent>.md."""
    mapping = {
        "lr_manager": "lunchroom/manager.md",
        "lr_luna": "lunchroom/luna.md",
        "lr_rico": "lunchroom/rico.md",
        "lr_chef": "lunchroom/chef.md",
        "ws_manager": "webshop/manager.md",
        "ws_nova": "webshop/nova.md",
        "ws_scout": "webshop/scout.md",
        "ws_judge": "webshop/judge.md",
    }
    path = PROMPTS_DIR / mapping.get(agent_id, "")
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    return ""


def seed_tenants_and_agents() -> dict:
    """Seed tenants + agents als ze nog niet bestaan. Idempotent."""
    omega_db.init_schema()
    tenants_cfg = load_tenant_configs()

    seeded_tenants = 0
    for tid, cfg in tenants_cfg.items():
        if not omega_db.tenant_get(tid):
            omega_db.tenant_insert(
                tenant_id=cfg["id"], name=cfg["name"], tenant_type=cfg["type"],
                brand_voice=cfg.get("brand_voice", ""),
                target_audience=cfg.get("target_audience", ""),
                industry=cfg.get("industry", ""),
            )
            seeded_tenants += 1

    seeded_agents = 0
    for agent_def in SEED_AGENTS:
        if not omega_db.holding_agent_get(agent_def["id"]):
            prompt = _load_prompt(agent_def["id"])
            omega_db.holding_agent_insert(
                agent_id=agent_def["id"],
                tenant_id=agent_def["tenant_id"],
                name=agent_def["name"],
                role=agent_def["role"],
                specialization=agent_def.get("specialization", ""),
                skills=agent_def.get("skills"),
                model=agent_def.get("model", "gemini"),
                parent_agent_id=agent_def.get("parent_agent_id"),
                confidence_threshold=agent_def.get("confidence_threshold", 0.8),
                system_prompt=prompt,
            )
            seeded_agents += 1

    omega_db.holding_audit_log("seed", details={
        "tenants_created": seeded_tenants, "agents_created": seeded_agents})
    return {"tenants": seeded_tenants, "agents": seeded_agents}


def refresh_prompts() -> int:
    """Herlees alle prompts van schijf en update in DB. Voor prompt-tuning."""
    omega_db.init_schema()
    updated = 0
    for agent_def in SEED_AGENTS:
        prompt = _load_prompt(agent_def["id"])
        if not prompt:
            continue
        existing = omega_db.holding_agent_get(agent_def["id"])
        if existing and existing.get("system_prompt") != prompt:
            with omega_db.get_connection() as conn:
                conn.execute(
                    "UPDATE holding_agents SET system_prompt = ? WHERE id = ?",
                    (prompt, agent_def["id"]))
            updated += 1
    return updated


def get_agent_for_task(tenant_id: str, task_type: str) -> Optional[dict]:
    """Vind de beste beschikbare werker-agent voor een taaktype."""
    agents = omega_db.holding_agent_list(tenant_id)
    for agent in agents:
        if agent["role"] not in ("werker",):
            continue
        if agent["status"] == "offline":
            continue
        skills = agent.get("skills") or []
        if task_type in skills or any(task_type in s for s in skills):
            return agent
    workers = [a for a in agents if a["role"] == "werker" and a["status"] != "offline"]
    return workers[0] if workers else None


def get_auditor(tenant_id: str) -> Optional[dict]:
    """Vind de auditor voor een tenant."""
    agents = omega_db.holding_agent_list(tenant_id)
    for agent in agents:
        if agent["role"] == "auditor":
            return agent
    return None
