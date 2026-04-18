#!/usr/bin/env python3
"""
Merge Factory OS-relevant config into ~/.openclaw/openclaw.json:
- models.providers from agents/main/agent/models.json (indien aanwezig)
- agents.defaults.model.primary (Gemini flash)
- channels.telegram from TELEGRAM_* (eerst ~/AI_HQ/.env, dan .env.zwartehand, .env.bak.webui)
- plugins.telegram enabled

Schrijft geen secrets naar stdout.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

HOME = Path.home()
OPENCLAW = HOME / ".openclaw"
AI_HQ = HOME / "AI_HQ"
MAIN = OPENCLAW / "openclaw.json"
MODELS_JSON = OPENCLAW / "agents/main/agent/models.json"
ENV_CANDIDATES = [
    AI_HQ / ".env",
    AI_HQ / ".env.zwartehand",
    AI_HQ / ".env.bak.webui",
]


def parse_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", line)
        if not m:
            continue
        k, v = m.group(1), m.group(2).strip().strip('"').strip("'")
        out[k] = v
    return out


def load_merged_env() -> dict[str, str]:
    merged: dict[str, str] = {}
    for p in ENV_CANDIDATES:
        for k, v in parse_env_file(p).items():
            if k not in merged or merged[k] == "":
                merged[k] = v
    return merged


def main() -> None:
    cfg = json.loads(MAIN.read_text(encoding="utf-8"))
    env = load_merged_env()
    token = (env.get("TELEGRAM_BOT_TOKEN") or "").strip()
    chat = (env.get("TELEGRAM_CHAT_ID") or "").strip()

    if MODELS_JSON.is_file():
        mj = json.loads(MODELS_JSON.read_text(encoding="utf-8"))
        prov = mj.get("providers") or {}
        if prov:
            cfg["models"] = {"mode": "merge", "providers": prov}

    agents = cfg.setdefault("agents", {})
    defaults = agents.setdefault("defaults", {})
    defaults.setdefault("maxConcurrent", 4)
    defaults.setdefault("subagents", {"maxConcurrent": 8})
    model = defaults.setdefault("model", {})
    model.setdefault("primary", "google/gemini-1.5-flash")

    if token:
        allow = ["*"] if not chat else [chat]
        cfg["channels"] = {
            "telegram": {
                "enabled": True,
                "dmPolicy": "open",
                "botToken": token,
                "allowFrom": allow,
                "groupPolicy": "allowlist",
                "streamMode": "partial",
            }
        }
        plugins = cfg.setdefault("plugins", {})
        entries = plugins.setdefault("entries", {})
        entries["telegram"] = {"enabled": True}

    MAIN.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
    os.chmod(MAIN, 0o600)

    # Vul ~/AI_HQ/.env aan als Telegram daar leeg is maar wel in fallback-env staat
    main_env = AI_HQ / ".env"
    if main_env.is_file() and token:
        raw = main_env.read_text(encoding="utf-8", errors="replace")
        if re.search(r"^TELEGRAM_BOT_TOKEN=\s*$", raw, re.M) or (
            "TELEGRAM_BOT_TOKEN=" not in raw
        ):
            block = (
                "\n# Telegram (overgenomen door openclaw_merge_restore.py — check chat_id)\n"
                f"TELEGRAM_BOT_TOKEN={token}\n"
            )
            if chat:
                block += f"TELEGRAM_CHAT_ID={chat}\n"
            main_env.open("a", encoding="utf-8").write(block)
            print("✅ .env aangevuld met TELEGRAM_BOT_TOKEN (+ CHAT_ID indien bekend)")

    print("✅ openclaw.json bijgewerkt (models + agents; telegram:", "ja" if token else "nee", ")")


if __name__ == "__main__":
    main()
