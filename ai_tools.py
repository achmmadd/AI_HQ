"""
Tools voor de AI: opdrachten uitvoeren (taak opslaan, notitie schrijven, Ollama-run).
Samenwerking met Omega: scripts uitvoeren, toestemming vragen voor handelingen.
Wordt door ai_chat gebruikt met Gemini function calling.
"""
import os
import json
import logging
import uuid
from contextvars import ContextVar
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
logger = logging.getLogger(__name__)

# Chat-id van de huidige Telegram-sessie (gezet door de bridge vóór get_ai_reply)
approval_chat_id: ContextVar[str | None] = ContextVar("approval_chat_id", default=None)


def save_task(description: str, prioriteit: str = "normaal") -> dict:
    """Sla een opdracht/taak op (omega_db). Gebruik als de gebruiker iets wil laten doen of onthouden."""
    import omega_db
    omega_db.init_schema()
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    task_id = f"task_{ts}"
    created = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    omega_db.task_insert(task_id, description, prioriteit, "open", created)
    logger.info("Taak opgeslagen: %s", task_id)
    return {"ok": True, "message": f"Taak opgeslagen: {description[:80]}...", "task_id": task_id}


def write_note(titel: str, inhoud: str) -> dict:
    """Schrijf een notitie (omega_db). Gebruik voor aantekeningen, ideeën, korte teksten."""
    import omega_db
    omega_db.init_schema()
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    safe = "".join(c if c.isalnum() or c in " -_" else "_" for c in titel)[:50]
    note_id = f"{ts}_{safe}.txt"
    created_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    omega_db.note_insert(note_id, titel, f"# {titel}\n\n{inhoud}", created_at)
    logger.info("Notitie opgeslagen: %s", note_id)
    return {"ok": True, "message": f"Notitie opgeslagen: {titel}", "path": note_id}


def run_ollama(opdracht: str) -> dict:
    """Voer een opdracht uit via Ollama (lokaal model). Gebruik voor rekenen, code, of taken die de AI zelf moet uitvoeren."""
    try:
        import requests
        url = os.environ.get("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
        model = os.environ.get("OLLAMA_MODEL", "llama3.2:3b")
        if ":" not in model:
            model = "llama3.2:3b"
        r = requests.post(
            f"{url}/api/chat",
            json={"model": model, "messages": [{"role": "user", "content": opdracht}], "stream": False},
            timeout=90,
        )
        r.raise_for_status()
        out = (r.json().get("message") or {}).get("content") or ""
        return {"ok": True, "result": out.strip()[:2000]}
    except Exception as e:
        logger.warning("Ollama run_ollama failed: %s", e)
        return {"ok": False, "error": str(e), "tip": "Start Ollama met: ollama run llama3.2:3b"}


# --- Taken beheren ---

def list_tasks(status: str = "open") -> dict:
    """Lijst taken (omega_db). status: 'open', 'done', of 'alle'. Gebruik als de gebruiker vraagt wat er te doen staat of taken wil zien."""
    import omega_db
    omega_db.init_schema()
    tasks = omega_db.task_list(status=status, limit=50)
    return {"ok": True, "tasks": tasks, "count": len(tasks), "message": f"{len(tasks)} taak/taken" if tasks else "Geen taken gevonden."}


def complete_task(task_id: str) -> dict:
    """Markeer een taak als afgerond. task_id is bijvoorbeeld task_20250211_123456. Gebruik als de gebruiker zegt dat iets klaar is."""
    import omega_db
    omega_db.init_schema()
    tasks = omega_db.task_list(status="alle", limit=1000)
    if not any(t.get("id") == task_id for t in tasks):
        return {"ok": False, "error": f"Taak niet gevonden: {task_id}"}
    completed = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    if omega_db.task_complete(task_id, completed):
        return {"ok": True, "message": f"Taak afgerond: {task_id}"}
    return {"ok": False, "error": "Kon taak niet afronden"}


# --- Notities doorzoeken ---

def list_notes(limit: int = 10) -> dict:
    """Lijst recente notities (omega_db). Gebruik als de gebruiker notities wil zien of zoeken."""
    import omega_db
    omega_db.init_schema()
    notes = omega_db.note_list(limit=limit)
    out = [{"filename": n["id"], "title": n["title"]} for n in notes]
    return {"ok": True, "notes": out, "message": f"{len(out)} notitie(s)" if out else "Geen notities."}


def read_note(filename: str) -> dict:
    """Lees de inhoud van één notitie. filename is het id uit list_notes (bijv. 20250211_123456_titel.txt) of een titelzoekterm."""
    import omega_db
    omega_db.init_schema()
    n = omega_db.note_get(filename)
    if not n:
        notes = omega_db.note_list(limit=50)
        q = filename.lower()
        q_norm = q.replace(" ", "_")
        for note in notes:
            nid = (note.get("id") or "").lower()
            ntitle = (note.get("title") or "").lower()
            if q in nid or q in ntitle or q_norm in nid or q_norm in ntitle:
                n = note
                break
    if not n:
        return {"ok": False, "error": "Notitie niet gevonden of ongeldig id."}
    return {"ok": True, "content": (n.get("content") or "")[:4000], "filename": n.get("id", filename)}


# --- Status en scripts (NUC / 24/7) ---

def system_status() -> dict:
    """Geef korte status van Omega-bridge, Zwartehand-bridge en Ollama (of ze draaien). Gebruik als de gebruiker vraagt of alles draait of wat de status is."""
    import subprocess
    result = {"omega_bridge": False, "zwartehand_bridge": False, "ollama": False}
    try:
        out = subprocess.run(["pgrep", "-f", "telegram_bridge.py"], capture_output=True, text=True, timeout=5)
        pids = [p for p in (out.stdout or "").strip().splitlines() if p]
        for pid in pids:
            try:
                with open(f"/proc/{pid}/cmdline") as f:
                    cmd = f.read().replace("\x00", " ").strip()
                if "--zwartehand" in cmd:
                    result["zwartehand_bridge"] = True
                else:
                    result["omega_bridge"] = True
            except (OSError, ValueError):
                result["omega_bridge"] = result["omega_bridge"] or bool(pids)
        if result["omega_bridge"] and result["zwartehand_bridge"] and len(pids) == 1:
            result["omega_bridge"] = False
        url = os.environ.get("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
        r = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", f"{url}/api/tags"],
            capture_output=True, text=True, timeout=5,
        )
        result["ollama"] = r.returncode == 0 and (r.stdout or "").strip() == "200"
    except Exception as e:
        result["error"] = str(e)
    result["ok"] = True
    return result


# Allowlist: alleen deze scripts mogen via de bot worden uitgevoerd (zonder path)
SAFE_SCRIPTS = frozenset({
    "check_zwartehand", "launch_zwartehand", "sync_naar_nuc", "grondige_test_sluit_alles",
    "grote_controle_alles", "debug_daemons", "telegram_webhook_uit", "check_telegram_token_env",
    "stop_bridge_and_restart",
})

# Scripts die de Omega-omgeving wijzigen: eerst toestemming vragen via request_user_approval
NEED_APPROVAL_SCRIPTS = frozenset({
    "launch_zwartehand", "sync_naar_nuc", "grondige_test_sluit_alles", "grote_controle_alles",
    "debug_daemons", "telegram_webhook_uit", "stop_bridge_and_restart",
})

def request_user_approval(
    description: str,
    script_name: str,
    *,
    agent_name: str | None = None,
    role: str | None = None,
    parent_node: str | None = None,
    container_name: str | None = None,
    subdomain: str | None = None,
    service_url: str | None = None,
) -> dict:
    """Vraag toestemming aan de gebruiker. script_name: een SAFE_SCRIPT of 'spawn_new_agent'. Bij spawn_new_agent moeten agent_name, role en parent_node worden meegegeven (als keyword-argumenten). De gebruiker moet 'ja' of 'goedkeuren' zeggen waarna de handeling wordt uitgevoerd."""
    import omega_db
    omega_db.init_schema()
    chat_id = approval_chat_id.get()
    if not chat_id:
        return {"ok": False, "error": "Geen chat-context; toestemming kan niet worden gevraagd."}
    base = (script_name or "").strip().lower().replace(".sh", "")
    created = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    approval_id = f"approval_{uuid.uuid4().hex[:12]}"

    if base == "spawn_new_agent":
        if not agent_name or not role or not parent_node:
            return {"ok": False, "error": "Bij spawn_new_agent zijn agent_name, role en parent_node verplicht (als keyword-argumenten)."}
        action = {"tool": "spawn_new_agent", "params": {"agent_name": str(agent_name).strip(), "role": str(role).strip(), "parent_node": str(parent_node).strip().lower().replace("-", "_")}}
        omega_db.approval_set(str(chat_id), approval_id, description, action, created)
        logger.info("Toestemming gevraagd (spawn) voor chat %s: %s", chat_id, description)
        return {"ok": True, "approval_id": approval_id, "message": f"Toestemming gevraagd. Zeg 'ja' of 'goedkeuren' om {description} uit te voeren."}

    if base == "container_restart":
        cn = (container_name or agent_name or "").strip()
        if not cn:
            return {"ok": False, "error": "Bij container_restart is container_name verplicht (keyword-argument)."}
        action = {"tool": "container_restart", "params": {"container_name": cn}}
        omega_db.approval_set(str(chat_id), approval_id, description, action, created)
        logger.info("Toestemming gevraagd (container_restart) voor chat %s: %s", chat_id, description)
        return {"ok": True, "approval_id": approval_id, "message": f"Toestemming gevraagd. Zeg 'ja' of 'goedkeuren' om {description} uit te voeren."}

    if base == "create_subdomain":
        sub = (subdomain or agent_name or "").strip()
        svc = (service_url or role or "").strip()
        if not sub or not svc:
            return {"ok": False, "error": "Bij create_subdomain zijn subdomain en service_url verplicht (keyword-argumenten)."}
        action = {"tool": "create_subdomain", "params": {"subdomain": sub, "service_url": svc}}
        omega_db.approval_set(str(chat_id), approval_id, description, action, created)
        logger.info("Toestemming gevraagd (create_subdomain) voor chat %s: %s", chat_id, description)
        return {"ok": True, "approval_id": approval_id, "message": f"Toestemming gevraagd. Zeg 'ja' of 'goedkeuren' om {description} uit te voeren."}

    if base not in SAFE_SCRIPTS:
        return {"ok": False, "error": f"Script niet toegestaan: {base}"}
    action = {"tool": "run_safe_script", "script_name": base}
    omega_db.approval_set(str(chat_id), approval_id, description, action, created)
    logger.info("Toestemming gevraagd voor chat %s: %s", chat_id, description)
    return {
        "ok": True,
        "approval_id": approval_id,
        "message": f"Toestemming gevraagd. Zeg 'ja' of 'goedkeuren' om {description} uit te voeren.",
    }


def get_and_execute_pending_approval(chat_id: int | str) -> str | None:
    """Als er een openstaande goedkeuring is voor deze chat: voer de actie uit en geef een resultaattekst terug. Anders None. Wordt door de Telegram-bridge aangeroepen wanneer de gebruiker 'ja' zegt."""
    import omega_db
    omega_db.init_schema()
    pending = omega_db.approval_get_by_chat(str(chat_id))
    if not pending:
        return None
    action = pending.get("action") or {}
    tool = action.get("tool")
    desc = pending.get("description", "")
    omega_db.approval_remove(str(chat_id))
    if tool == "run_safe_script":
        script_name = action.get("script_name", "")
        result = run_safe_script(script_name)
        if result.get("ok"):
            return f"✓ Gedaan: {desc}\n{result.get('message', '')}"
        return f"Fout bij {desc}: {result.get('error', 'onbekend')}"
    if tool == "spawn_new_agent":
        fn = globals().get("spawn_new_agent")
        if callable(fn):
            params = action.get("params") or {}
            result = fn(**params)
            if result.get("ok"):
                return f"✓ Gedaan: {desc}\n{result.get('message', '')}"
            return f"Fout bij {desc}: {result.get('error', 'onbekend')}"
        return "spawn_new_agent nog niet beschikbaar."
    if tool == "container_restart":
        params = action.get("params") or {}
        result = container_restart(params.get("container_name", ""))
        if result.get("ok"):
            return f"✓ Gedaan: {desc}\n{result.get('message', '')}"
        return f"Fout bij {desc}: {result.get('error', 'onbekend')}"
    if tool == "create_subdomain":
        params = action.get("params") or {}
        result = create_subdomain(params.get("subdomain", ""), params.get("service_url", ""))
        if result.get("ok"):
            return f"✓ Gedaan: {desc}\n{result.get('message', '')}"
        return f"Fout bij {desc}: {result.get('error', 'onbekend')}"
    return "Actie uitgevoerd (onbekend type)."


def audit_code(path: str) -> dict:
    """
    Voer Bandit (security) en Pylint (kwaliteit) uit op een pad (bestand of map).
    Gebruik vóór het uitvoeren van nieuwe of gewijzigde code. path: relatief aan projectroot of absoluut.
    """
    import subprocess
    p = Path(path)
    if not p.is_absolute():
        p = ROOT / path
    if not p.exists():
        return {"ok": False, "error": f"Pad niet gevonden: {path}"}
    p = p.resolve()
    if not str(p).startswith(str(ROOT.resolve())):
        return {"ok": False, "error": "Pad moet binnen de projectroot liggen."}
    path_str = str(p)
    out = {"bandit": None, "pylint": None, "summary": ""}
    # Bandit
    try:
        r = subprocess.run(
            ["bandit", "-r", path_str],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=str(ROOT),
        )
        out["bandit"] = {"stdout": (r.stdout or "")[:2000], "stderr": (r.stderr or "")[:500], "exitcode": r.returncode}
    except FileNotFoundError:
        out["bandit"] = {"error": "bandit niet geïnstalleerd (pip install bandit)"}
    except subprocess.TimeoutExpired:
        out["bandit"] = {"error": "bandit timeout (60s)"}
    # Pylint (alleen op .py)
    if path_str.endswith(".py") or (p.is_dir() and any(ROOT.rglob("*.py"))):
        try:
            r = subprocess.run(
                ["pylint", path_str],
                capture_output=True,
                text=True,
                timeout=90,
                cwd=str(ROOT),
            )
            out["pylint"] = {"stdout": (r.stdout or "")[:3000], "stderr": (r.stderr or "")[:500], "exitcode": r.returncode}
        except FileNotFoundError:
            out["pylint"] = {"error": "pylint niet geïnstalleerd (pip install pylint)"}
        except subprocess.TimeoutExpired:
            out["pylint"] = {"error": "pylint timeout (90s)"}
    # Samenvatting
    parts = []
    if out["bandit"] and out["bandit"].get("exitcode") not in (None, 0):
        parts.append("Bandit: bevindingen (zie bandit.stdout)")
    elif out["bandit"] and "error" in out["bandit"]:
        parts.append("Bandit: " + out["bandit"]["error"])
    if out["pylint"] and out["pylint"].get("exitcode") not in (None, 0):
        parts.append("Pylint: bevindingen (zie pylint.stdout)")
    elif out["pylint"] and "error" in out["pylint"]:
        parts.append("Pylint: " + out["pylint"]["error"])
    out["summary"] = "; ".join(parts) if parts else "Geen ernstige bevindingen of tools niet beschikbaar."
    out["ok"] = True
    return out


def run_in_sandbox(script_path: str, timeout_sec: int = 30) -> dict:
    """
    Voer een Python-script veilig uit in een tijdelijke Docker-container (256MB, geen netwerk).
    Gebruik voor het testen van nieuwe of gewijzigde scripts vóór productie. script_path: relatief aan projectroot.
    """
    import subprocess
    p = Path(script_path)
    if not p.is_absolute():
        p = ROOT / script_path
    if not p.exists() or not p.is_file():
        return {"ok": False, "error": f"Script niet gevonden: {script_path}"}
    p = p.resolve()
    if not str(p).startswith(str(ROOT.resolve())):
        return {"ok": False, "error": "Script moet binnen de projectroot liggen."}
    if p.suffix != ".py":
        return {"ok": False, "error": "Alleen .py scripts worden ondersteund."}
    timeout_sec = max(10, min(120, int(timeout_sec)))
    # Docker run: read-only mount van het script, geen netwerk, 256MB
    script_in_container = "/script/" + p.name
    try:
        r = subprocess.run(
            [
                "docker", "run", "--rm",
                "--memory=256m",
                "--network=none",
                "--read-only",
                "-v", f"{p}:{script_in_container}:ro",
                "python:3.12-slim",
                "python", script_in_container,
            ],
            capture_output=True,
            text=True,
            timeout=timeout_sec + 5,
            cwd=str(ROOT),
        )
        return {
            "ok": True,
            "exit_code": r.returncode,
            "stdout": (r.stdout or "").strip()[:2000],
            "stderr": (r.stderr or "").strip()[:500],
            "message": f"Sandbox afgerond met exitcode {r.returncode}",
        }
    except FileNotFoundError:
        return {"ok": False, "error": "Docker niet gevonden. Installeer Docker om run_in_sandbox te gebruiken."}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": f"Sandbox timeout ({timeout_sec}s)."}


def container_list() -> dict:
    """Lijst alle Docker-containers (via 1Panel API). Gebruik om te zien welke containers draaien."""
    try:
        from omega_1panel_bridge import container_list as _cl
        return _cl()
    except Exception as e:
        return {"ok": False, "error": str(e), "tip": "Zet ONEPANEL_BASE_URL en ONEPANEL_API_KEY (zie .env.1panel)."}


def container_logs(container_name: str, tail: int = 100) -> dict:
    """Haal recente logs van een container op. container_name: exacte naam; tail: aantal regels."""
    try:
        from omega_1panel_bridge import container_logs as _logs
        return _logs(container_name, tail=int(tail))
    except Exception as e:
        return {"ok": False, "error": str(e)}


def container_restart(container_name: str) -> dict:
    """Herstart een container via 1Panel. Voor kritieke containers (omega-telegram-bridge, mission-control) eerst toestemming vragen via request_user_approval(omschrijving, 'container_restart', container_name=...)."""
    try:
        from omega_1panel_bridge import container_restart as _restart
        return _restart(container_name)
    except Exception as e:
        return {"ok": False, "error": str(e)}


def create_subdomain(subdomain: str, service_url: str) -> dict:
    """Maak een Cloudflare-subdomein aan (DNS-record). Alleen aanroepen na request_user_approval(omschrijving, 'create_subdomain', subdomain=..., service_url=...). Vereist CLOUDFLARE_API_TOKEN en CLOUDFLARE_ZONE_ID in .env."""
    try:
        from cloudflare_bridge import create_subdomain as _create
        return _create(subdomain, service_url)
    except Exception as e:
        logger.warning("create_subdomain: %s", e)
        return {"ok": False, "error": str(e)}


def run_safe_script(script_name: str) -> dict:
    """Voer een goedgekeurd script uit (alleen naam, zonder .sh). Voor scripts die Omega/herstart/sync beïnvloeden moet je EERST request_user_approval(omschrijving, script_name) aanroepen; pas als de gebruiker 'ja' zegt wordt het script uitgevoerd. Direct uitvoeren mag alleen voor: check_zwartehand, check_telegram_token_env."""
    base = script_name.strip().lower().replace(".sh", "")
    if base not in SAFE_SCRIPTS:
        return {"ok": False, "error": f"Script niet toegestaan. Toegestaan: {', '.join(sorted(SAFE_SCRIPTS))}"}
    if base in NEED_APPROVAL_SCRIPTS:
        return {
            "ok": False,
            "need_approval": True,
            "script_name": base,
            "message": "Dit script wijzigt Omega of de omgeving. Roep eerst request_user_approval(omschrijving, script_name) aan; wacht op 'ja' van de gebruiker.",
        }
    script_path = ROOT / "scripts" / f"{base}.sh"
    if not script_path.is_file():
        return {"ok": False, "error": f"Bestand niet gevonden: {base}.sh"}
    try:
        import subprocess
        proc = subprocess.run(
            [str(script_path)],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=120,
        )
        out = (proc.stdout or "").strip() or "(geen output)"
        err = (proc.stderr or "").strip()
        return {
            "ok": True,
            "exit_code": proc.returncode,
            "stdout": out[:2000],
            "stderr": err[:500] if err else None,
            "message": f"Script {base}.sh afgerond met code {proc.returncode}",
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "Script timeout (120s)"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# --- Spawn new agent (department) ---

EVOMAP_VALID_PARENTS = frozenset({
    "omega", "trend_hunter", "copy_architect", "visual_strategist", "seo_analyst", "lead_gen",
})


def spawn_new_agent(agent_name: str, role: str, parent_node: str) -> dict:
    """
    Maak een nieuwe afdeling (agent) aan vanuit de template en registreer in Evomap.
    Alleen aanroepen na request_user_approval("Nieuwe afdeling: ...", "spawn_new_agent", agent_name=..., role=..., parent_node=...).
    agent_name: bijv. finance (wordt genormaliseerd naar lowercase met underscores).
    role: bijv. CFO. parent_node: bestaande Evomap-node, bijv. omega.
    """
    import shutil
    name_norm = (agent_name or "").strip().lower().replace(" ", "_").replace("-", "_")
    name_norm = "".join(c for c in name_norm if c.isalnum() or c == "_").strip("_") or "agent"
    parent_norm = (parent_node or "").strip().lower().replace("-", "_")
    if parent_norm not in EVOMAP_VALID_PARENTS:
        return {"ok": False, "error": f"parent_node moet een geldige Evomap-node zijn: {', '.join(sorted(EVOMAP_VALID_PARENTS))}"}

    dept_dir = ROOT / "holding" / "departments" / name_norm
    if dept_dir.exists() and list(dept_dir.iterdir()):
        return {"ok": False, "error": f"Afdeling {name_norm} bestaat al (map niet leeg)."}

    template_dir = ROOT / "templates" / "department_base"
    if not template_dir.is_dir():
        return {"ok": False, "error": "templates/department_base niet gevonden."}

    dept_dir.mkdir(parents=True, exist_ok=True)
    soul_tpl = template_dir / "SOUL.md.tpl"
    if soul_tpl.is_file():
        tpl = soul_tpl.read_text(encoding="utf-8")
        display_name = (agent_name or name_norm).strip().replace("_", " ").title()
        content = tpl.replace("{name}", display_name).replace("{role}", (role or "").strip()).replace("{expertise}", (role or "").strip())
        (dept_dir / "SOUL.md").write_text(content, encoding="utf-8")
    for f in template_dir.iterdir():
        if f.name.startswith(".") or f.name == "SOUL.md.tpl" or f.suffix == ".tpl":
            continue
        if f.is_file():
            shutil.copy2(f, dept_dir / f.name)

    profile_path = dept_dir / "profile.json"
    if not profile_path.exists():
        profile_path.write_text(
            json.dumps({"role": (role or "").strip(), "parent": parent_norm}, indent=2),
            encoding="utf-8",
        )

    _ensure_evomap_url()
    base_url = (os.environ.get("EVOMAP_API_URL") or "http://localhost:8000").rstrip("/")
    display_name = (agent_name or name_norm).strip().replace("_", " ").title()
    try:
        import urllib.request
        body = json.dumps({"id": name_norm, "name": display_name, "current_task": "", "status": "idle", "parent_id": parent_norm}).encode("utf-8")
        req = urllib.request.Request(f"{base_url}/api/agents", data=body, method="POST", headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status not in (200, 201):
                return {"ok": False, "error": f"Evomap POST /api/agents: {resp.status}"}
        edge_id = f"edge_{parent_norm}_{name_norm}"
        body = json.dumps({"id": edge_id, "source": parent_norm, "target": name_norm}).encode("utf-8")
        req = urllib.request.Request(f"{base_url}/api/edges", data=body, method="POST", headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status not in (200, 201):
                return {"ok": False, "error": f"Evomap POST /api/edges: {resp.status}"}
    except Exception as e:
        logger.warning("Evomap spawn_new_agent: %s", e)
        return {"ok": False, "error": str(e), "tip": "holding/departments/%s is aangemaakt; Evomap-registratie mislukt. Controleer EVOMAP_API_URL." % name_norm}

    return {"ok": True, "message": f"Afdeling {name_norm} aangemaakt en in Evomap geregistreerd (parent: {parent_norm}).", "agent_id": name_norm}


# --- Evomap (Marketing Swarm dashboard) ---

EVOMAP_AGENT_IDS = frozenset({
    "omega", "trend_hunter", "copy_architect", "visual_strategist", "seo_analyst", "lead_gen",
})


def _evomap_agent_id(agent_name_or_id: str) -> str:
    """Map weergavenaam naar agent_id indien nodig."""
    s = (agent_name_or_id or "").strip().lower().replace("-", "_").replace(" ", "_")
    if s in EVOMAP_AGENT_IDS:
        return s
    name_to_id = {
        "trend_hunter": "trend_hunter", "trend hunter": "trend_hunter",
        "copy_architect": "copy_architect", "copy architect": "copy_architect",
        "visual_strategist": "visual_strategist", "visual strategist": "visual_strategist",
        "seo_analyst": "seo_analyst", "seo analyst": "seo_analyst",
        "lead_gen": "lead_gen", "lead gen": "lead_gen", "leadgen": "lead_gen",
        "omega": "omega",
    }
    return name_to_id.get(s, s)


def _ensure_evomap_url():
    """Laad EVOMAP_API_URL uit .env als die nog niet gezet is (tunnel/NUC)."""
    if os.environ.get("EVOMAP_API_URL"):
        return
    env_file = ROOT / ".env"
    if not env_file.is_file():
        return
    try:
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                k, v = k.strip(), v.strip().strip("'\"")
                if k == "EVOMAP_API_URL" and v:
                    os.environ["EVOMAP_API_URL"] = v
                    return
    except (OSError, ValueError):
        pass


def update_evomap_state(agent_id: str, new_task: str, status: str) -> dict:
    """
    Update de live-status van een Evomap-node (Marketing Swarm dashboard).
    Roep aan wanneer een agent van taak of status verandert, zodat het React Flow-dashboard
    direct wordt bijgewerkt. agent_id: omega, trend_hunter, copy_architect, visual_strategist,
    seo_analyst, lead_gen. status: bijv. idle, busy, success, error.
    """
    _ensure_evomap_url()
    aid = _evomap_agent_id(agent_id)
    if aid not in EVOMAP_AGENT_IDS:
        return {"ok": False, "error": f"Onbekende agent_id: {agent_id}. Geldig: {', '.join(sorted(EVOMAP_AGENT_IDS))}"}
    base_url = (os.environ.get("EVOMAP_API_URL") or "http://localhost:8000").rstrip("/")
    url = f"{base_url}/api/agents/{aid}"
    try:
        import urllib.request
        body = json.dumps({"current_task": (new_task or "").strip(), "status": (status or "idle").strip()}).encode("utf-8")
        req = urllib.request.Request(url, data=body, method="PATCH", headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            if 200 <= resp.status < 300:
                return {"ok": True, "message": f"Evomap node {aid} geüpdatet: {new_task or '(leeg)'} / {status}"}
            return {"ok": False, "error": f"Evomap API returned {resp.status}"}
    except Exception as e:
        logger.warning("Evomap update_evomap_state failed: %s", e)
        return {"ok": False, "error": str(e), "tip": "Zorg dat Evomap-backend draait (EVOMAP_API_URL) of negeer."}


def git_commit(message: str) -> dict:
    """
    Voer git add -A en git commit uit in de projectroot. Roep dit vóór codewijzigingen aan.
    Geen force of push. Alleen uitvoeren als de werkdirectory een git-repo is.
    """
    import subprocess
    if not (ROOT / ".git").exists():
        return {"ok": False, "error": "Geen git-repository in projectroot."}
    msg = (message or "Omega update").strip()[:500]
    if not msg:
        msg = "Omega update"
    try:
        r = subprocess.run(
            ["git", "add", "-A"],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=120,
        )
        if r.returncode != 0:
            return {"ok": False, "error": (r.stderr or r.stdout or "git add faalde").strip()[:500]}
        r = subprocess.run(
            ["git", "commit", "-m", msg],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=60,
        )
        if r.returncode == 0:
            return {"ok": True, "message": f"Commit: {msg}"}
        if "nothing to commit" in (r.stdout or "").lower() or "nothing to commit" in (r.stderr or "").lower():
            return {"ok": True, "message": "Niets te committen (werkboom schoon)."}
        return {"ok": False, "error": (r.stderr or r.stdout or "git commit faalde").strip()[:500]}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "Git timeout."}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def query_memory(question: str, limit: int = 5) -> dict:
    """
    Doorzoek het lange-termijngeheugen (RAG) met een vraag. Gebruik voor feiten uit logs, SOULs of notities.
    Retourneert relevante passages. Bij geen resultaat: overweeg eerst te indexeren (zie rag.index_all).
    """
    from rag import query_memory as _query_memory
    return _query_memory(question, limit=limit)


def get_soul_context(agent_id: str) -> dict:
    """
    Lees de SOUL (systeem-prompt) van een specialist voor context.
    Zoekt in data/souls/<id>_SOUL.md en in holding/departments/<id>/SOUL.md.
    agent_id: trend_hunter, copy_architect, visual_strategist, seo_analyst, lead_gen, of een spawn-department.
    """
    raw = (agent_id or "").strip().lower().replace("-", "_").replace(" ", "_")
    safe_id = "".join(c for c in raw if c.isalnum() or c == "_")
    if not safe_id:
        return {"ok": False, "error": "Ongeldige agent_id."}
    # 1) data/souls (marketing swarm)
    souls_dir = ROOT / "data" / "souls"
    path = (souls_dir / f"{safe_id}_SOUL.md").resolve()
    if path.is_file() and str(path).startswith(str(souls_dir.resolve())):
        try:
            content = path.read_text(encoding="utf-8")
            return {"ok": True, "content": content[:8000], "agent_id": safe_id}
        except Exception as e:
            return {"ok": False, "error": str(e)}
    # 2) holding/departments/<id>/SOUL.md (spawned departments)
    dept_soul = (ROOT / "holding" / "departments" / safe_id / "SOUL.md").resolve()
    if dept_soul.is_file() and str(dept_soul).startswith(str((ROOT / "holding" / "departments").resolve())):
        try:
            content = dept_soul.read_text(encoding="utf-8")
            return {"ok": True, "content": content[:8000], "agent_id": safe_id}
        except Exception as e:
            return {"ok": False, "error": str(e)}
    return {"ok": False, "error": f"SOUL niet gevonden: {safe_id} (data/souls of holding/departments)"}
