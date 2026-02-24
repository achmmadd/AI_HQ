#!/usr/bin/env python3
"""
Eenmalig de Evomap-database vullen met Omega als centrale node en de 5
marketing-agenten als child-nodes. Niet toevoegen aan launch_factory.sh;
handmatig uitvoeren: python3 scripts/seed_evomap_nodes.py
"""
import os
import sys
import json
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Laad EVOMAP_API_URL uit .env (projectroot) als die daar staat (tunnel / NUC)
_env = os.path.join(ROOT, ".env")
if os.path.isfile(_env):
    with open(_env, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                k, v = k.strip(), v.strip().strip("'\"")
                if k == "EVOMAP_API_URL" and v and not os.environ.get("EVOMAP_API_URL"):
                    os.environ["EVOMAP_API_URL"] = v
                    break

BASE_URL = os.environ.get("EVOMAP_API_URL", "http://localhost:8000").rstrip("/")

# Omega = parent (Node 1); 5 marketing-agenten = children
AGENTS = [
    ("omega", "Omega", "Monitoring", "busy"),
    ("trend_hunter", "Trend-Hunter", "", "idle"),
    ("copy_architect", "Copy-Architect", "", "idle"),
    ("visual_strategist", "Visual Strategist", "", "idle"),
    ("seo_analyst", "SEO Analyst", "", "idle"),
    ("lead_gen", "Lead-Gen", "", "idle"),
]
# Edges: omega -> elk van de 5
CHILDREN = ["trend_hunter", "copy_architect", "visual_strategist", "seo_analyst", "lead_gen"]


def _post(path: str, data: dict) -> tuple[bool, str]:
    url = f"{BASE_URL}{path}"
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if 200 <= resp.status < 300:
                return True, resp.read().decode("utf-8", errors="ignore")
            return False, f"status {resp.status}"
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}: {e.read().decode('utf-8', errors='ignore')[:200]}"
    except Exception as e:
        return False, str(e)


def main():
    print("Evomap seed: Omega + 5 marketing-agenten")
    print(f"Backend: {BASE_URL}")
    for agent_id, name, current_task, status in AGENTS:
        ok, msg = _post("/api/agents", {"id": agent_id, "name": name, "current_task": current_task, "status": status})
        if ok:
            print(f"  Agent: {agent_id} OK")
        else:
            print(f"  Agent: {agent_id} FAIL — {msg}")
            print("  Tip: start Evomap lokaal met cd evomap && docker compose up -d, of zet EVOMAP_API_URL op je tunnel-URL (bijv. https://xxx.trycloudflare.com)")
            sys.exit(1)
    for child in CHILDREN:
        edge_id = f"omega-{child}"
        ok, msg = _post("/api/edges", {"id": edge_id, "source": "omega", "target": child})
        if ok:
            print(f"  Edge: omega -> {child} OK")
        else:
            print(f"  Edge: omega -> {child} FAIL — {msg}")
            print("  Tip: start Evomap eerst: cd evomap && docker compose up -d")
            sys.exit(1)
    print("Klaar. Open Evomap-dashboard om de topologie te zien.")


if __name__ == "__main__":
    main()
