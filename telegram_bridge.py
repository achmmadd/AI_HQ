#!/usr/bin/env python3
"""
Omega AI-Holding — Telegram Bridge.
Polling bot: /start, /help, en tekst. Start met: ./launch_factory.sh
"""
import asyncio
import json
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Projectroot op path voor holding.*
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Tweede bot (Zwartehand): python3 telegram_bridge.py --zwartehand
if "--zwartehand" in sys.argv:
    os.environ.setdefault("TELEGRAM_ENV", str(ROOT / ".env.zwartehand"))

# .env laden (of ander bestand via TELEGRAM_ENV voor tweede bot, bijv. Zwartehand)
_env_path = os.environ.get("TELEGRAM_ENV")
_env = Path(_env_path) if _env_path else (ROOT / ".env")
_env = _env if _env.is_absolute() else (ROOT / _env)
if _env.exists():
    with open(_env) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                k, v = k.strip(), v.strip()
                if len(v) >= 2 and v[0] in "'\"" and v[0] == v[-1]:
                    v = v[1:-1]
                os.environ.setdefault(k, v)

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(message)s",
    level=logging.INFO,
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

try:
    from ai_chat_retries import get_ai_reply
except ImportError:
    try:
        from ai_chat import get_ai_reply
    except ImportError:
        get_ai_reply = None  # fallback: alleen echo

try:
    from mission_control import add_mission as mc_add_mission, set_tunnel_url as mc_set_tunnel_url
except ImportError:
    mc_add_mission = None
    mc_set_tunnel_url = None

PLACEHOLDER = "123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"


async def cmd_start(update, context):
    """Handler voor /start — welkom + menu."""
    if update.message is None:
        return
    try:
        # Optioneel: holding.config gebruiken als aanwezig
        import holding.config  # noqa: F401
    except Exception:
        pass
    text = (
        "Omega AI-Holding — welkom.\n\n"
        "Ik kan je helpen met:\n\n"
        "• Informatie opzoeken en samenvatten\n"
        "• Tekst genereren (e-mails, verhalen, code, brieven, enz.)\n"
        "• Vragen beantwoorden\n"
        "• Teksten vertalen\n"
        "• Creatieve taken (brainstormen, ideeën, suggesties)\n"
        "• Omega AI-Holding gerelateerde vragen\n\n"
        "Commando's: /panel (1Panel), /restart <container>, /secure (WAF), /tunnel (Quick Tunnel-URL), /lockdown.\n\n"
        "Supremacy: /task <omschrijving> of «taak: …» of spraak — Jarvis delegeert (geen zelf uitvoeren). /tunnel = Mission Control.\n\n"
        "Stuur gewoon een bericht met je vraag of opdracht."
    )
    await update.message.reply_text(text)


async def cmd_help(update, context):
    """Handler voor /help."""
    if update.message is None:
        return
    await update.message.reply_text(
        "Help: /start (menu), /task <omschrijving> (delegatie), /panel (1Panel), /restart <naam>, /secure (WAF), /tunnel (Quick Tunnel-link), /lockdown. Of typ een opdracht."
    )


DELEGATION_REPLY = (
    "Missie geaccepteerd. Ik heb Shuri en Vision geactiveerd. Volg de voortgang op het dashboard. "
    "Rapport staat klaar in de output-map."
)


async def cmd_task(update, context):
    """
    Jarvis als Orchestrator: ALLEEN een entry in mission_control.json.
    Voert NOOIT zelf de taak uit. Gebruik: /task onderzoek X of /task maak een hook voor Y
    """
    if update.message is None:
        return
    # Payload: alles na /task (ook als er geen args zijn maar er staat tekst in het bericht)
    args = (context.args or [])
    text_from_args = " ".join(args).strip() if args else ""
    # Als de bot /task in een "message" krijgt, staat de rest soms in message.text
    full_text = (update.message.text or "").strip()
    if full_text.upper().startswith("/TASK"):
        rest = full_text[4:].strip()
    else:
        rest = text_from_args
    if not rest:
        await update.message.reply_text(
            "Gebruik: /task <omschrijving>\nBijv. /task onderzoek concurrentie of /task schrijf een TikTok-hook voor product X.\n"
            "Jarvis wijst de taak toe aan Shuri of Vision; ik voer zelf geen research of content uit."
        )
        return
    if not mc_add_mission:
        await update.message.reply_text("Mission control niet beschikbaar. Controleer holding/data/mission_control.json.")
        return
    try:
        specialist = _jarvis_assign_specialist(rest)
        mc_add_mission(rest[:500], source="telegram", assigned_specialist=specialist)
        append_thought_trace(f"[Jarvis] /task gedelegeerd naar {specialist}: {rest[:60]}")
        await update.message.reply_text(DELEGATION_REPLY)
    except Exception as e:
        logger.warning("cmd_task: %s", e)
        await update.message.reply_text(f"Fout bij aanmaken missie: {e}")


async def cmd_panel(update, context):
    """1Panel overzicht: Uptime, Load, Disk (via 1Panel API)."""
    if update.message is None:
        return
    try:
        from omega_1panel_bridge import get_host_stats
        out = await asyncio.to_thread(get_host_stats)
        if not out.get("ok"):
            await update.message.reply_text(f"1Panel: {out.get('error', 'Onbekende fout')}")
            return
        data = out.get("data") or {}
        # 1Panel: { code, message, data: { os, platform, diskSize, ... } } of direct { os, platform, ... }
        inner = data.get("data") if isinstance(data.get("data"), dict) else data
        if not isinstance(inner, dict):
            inner = {}
        lines = ["📊 1Panel — Server"]
        for k, v in inner.items():
            if k == "diskSize" and isinstance(v, (int, float)):
                lines.append(f"• Schijf: {v / (1024**3):.1f} GB")
            elif k in ("os", "platform", "platformFamily", "kernelArch", "kernelVersion"):
                lines.append(f"• {k}: {v}")
        await update.message.reply_text("\n".join(lines) if len(lines) > 1 else str(data))
    except ImportError:
        await update.message.reply_text("1Panel-bridge niet beschikbaar. Run install_1panel_bridge.sh.")
    except Exception as e:
        logger.exception("cmd_panel: %s", e)
        await update.message.reply_text(f"Fout: {e}")


async def cmd_restart(update, context):
    """Herstart een container via 1Panel: /restart omega_core of /restart bu_marketing."""
    if update.message is None:
        return
    name = (context.args or [""])[0].strip() or ""
    if not name:
        await update.message.reply_text("Gebruik: /restart <container_naam>   bv. /restart omega_core of /restart bu_marketing")
        return
    try:
        from omega_1panel_bridge import container_restart
        out = await asyncio.to_thread(container_restart, name)
        if out.get("ok"):
            await update.message.reply_text(out.get("message", "Herstart aangevraagd."))
        else:
            await update.message.reply_text(f"Fout: {out.get('error', 'Onbekend')}")
    except ImportError:
        await update.message.reply_text("1Panel-bridge niet beschikbaar. Run install_1panel_bridge.sh.")
    except Exception as e:
        logger.exception("cmd_restart: %s", e)
        await update.message.reply_text(f"Fout: {e}")


async def cmd_secure(update, context):
    """Activeer WAF / Vesting-modus (1Panel)."""
    if update.message is None:
        return
    try:
        from omega_1panel_bridge import firewall_secure
        out = await asyncio.to_thread(firewall_secure)
        if out.get("ok"):
            await update.message.reply_text(out.get("message", "Beveiliging aangescherpt."))
        else:
            await update.message.reply_text(
                out.get("error", "Onbekend") + "\nStel WAF handmatig in 1Panel in (Firewall / Security)."
            )
    except ImportError:
        await update.message.reply_text("1Panel-bridge niet beschikbaar. Stel in 1Panel handmatig in: Firewall → alleen noodzakelijke poorten.")
    except Exception as e:
        logger.exception("cmd_secure: %s", e)
        await update.message.reply_text(f"Fout: {e}")


LOCKDOWN_FLAG = Path(__file__).resolve().parent / "data" / "lockdown.flag"


# ——— LinkScraper: Quick Tunnel-URL uit cloudflared-logs ———
# Werkt als de bridge 'docker' of 'podman' kan aanroepen (host of Docker-socket gemount).
CLOUDFLARED_CONTAINER = "omega-cloudflared"
TRYCLOUDFLARE_RE = __import__("re").compile(r"https://[a-zA-Z0-9.-]+\.trycloudflare\.com")


def link_scraper_quick_tunnel() -> tuple[str | None, str]:
    """Scan docker/podman logs van de cloudflared container. Returns (url or None, debug_hint)."""
    import subprocess
    last_error = ""
    for cmd, args in (
        ("docker", ["logs", CLOUDFLARED_CONTAINER, "--tail", "300"]),
        ("podman", ["logs", CLOUDFLARED_CONTAINER, "--tail", "300"]),
    ):
        try:
            r = subprocess.run(
                [cmd] + args,
                capture_output=True,
                text=True,
                timeout=8,
                cwd=str(ROOT),
            )
            out = (r.stdout or "") + (r.stderr or "")
            m = TRYCLOUDFLARE_RE.search(out)
            if m:
                logger.info("tunnel: URL gevonden via %s", cmd)
                return m.group(0), ""
            if r.returncode != 0:
                last_error = f"{cmd} exit {r.returncode}"
                logger.debug("tunnel: %s", last_error)
        except FileNotFoundError:
            last_error = f"{cmd} niet gevonden"
            logger.info("tunnel: %s", last_error)
        except subprocess.TimeoutExpired:
            last_error = f"{cmd} timeout"
            logger.warning("tunnel: %s", last_error)
        except Exception as e:
            last_error = str(e)
            logger.warning("tunnel: %s → %s", cmd, e)
    return None, last_error


async def cmd_tunnel(update, context):
    """Stuur de Quick Tunnel-URL (Jarvis scant cloudflared-logs)."""
    chat = update.effective_chat
    if chat is None:
        logger.warning("cmd_tunnel: geen effective_chat")
        return

    async def _reply(text: str) -> None:
        try:
            await chat.send_message(text)
        except Exception as e:
            logger.exception("cmd_tunnel reply: %s", e)

    try:
        logger.info("cmd_tunnel: aanvraag van chat_id=%s", chat.id)
        await _reply("Even de tunnel-URL ophalen…")
    except Exception as e:
        logger.exception("cmd_tunnel: kon geen 'even ophalen' sturen: %s", e)

    try:
        url, hint = await asyncio.to_thread(link_scraper_quick_tunnel)
        if url:
            if mc_set_tunnel_url:
                try:
                    mc_set_tunnel_url(url)
                except Exception:
                    pass
            await _reply(f"🌐 Omega Quick Tunnel (Mission Control):\n{url}")
        else:
            msg = (
                "Nog geen Quick Tunnel-URL in de logs. Zorg dat cloudflared draait "
                "(docker compose --profile with-tunnel up -d) en wacht een paar seconden."
            )
            if hint and ("niet gevonden" in hint or "timeout" in hint):
                msg += f"\n(Tip: {hint} — draait de bridge in Docker? Mount dan /var/run/docker.sock.)"
            await _reply(msg)
    except Exception as e:
        logger.exception("cmd_tunnel: %s", e)
        await _reply(f"Fout bij ophalen tunnel-URL: {e}")


async def cmd_lockdown(update, context):
    """Emergency Lockdown: zet lockdown-flag (tunnels uit). Toggle: nogmaals /lockdown om op te heffen."""
    if update.message is None:
        return
    try:
        LOCKDOWN_FLAG.parent.mkdir(parents=True, exist_ok=True)
        if LOCKDOWN_FLAG.exists():
            LOCKDOWN_FLAG.unlink()
            await update.message.reply_text("🔓 Lockdown opgeheven. Tunnels kunnen weer actief zijn.")
        else:
            LOCKDOWN_FLAG.write_text(datetime.now(timezone.utc).isoformat())
            await update.message.reply_text("🔒 Lockdown actief. Stop cloudflared (docker stop omega-cloudflared) of trek de tunnel uit. Opheffen: /lockdown nogmaals of via dashboard.")
    except Exception as e:
        logger.exception("cmd_lockdown: %s", e)
        await update.message.reply_text(f"Fout: {e}")


# Berichten die gelden als "ja, voer de openstaande goedkeuring uit"
APPROVAL_PHRASES = frozenset({
    "ja", "ok", "goedkeuren", "ja graag", "doe maar", "akkoord", "ga door",
    "yes", "oké", "oke", "goed", "prima", "uitvoeren",
})


def _jarvis_assign_specialist(text: str) -> str:
    """Simple intent → specialist (Jarvis protocol)."""
    t = (text or "").lower()
    if any(w in t for w in ("research", "zoek", "vind", "scrape", "rag", "kennis")):
        return "shuri"
    if any(w in t for w in ("marketing", "viral", "tiktok", "hook", "script", "seo", "content")):
        return "vision"
    if any(w in t for w in ("docker", "container", "herstart", "nuc", "repair", "log")):
        return "friday"
    return "shuri"  # default


def add_voice_mission(title: str, source: str = "telegram_voice") -> bool:
    """Voeg missie toe aan OpenClaw mission_control (Jarvis protocol)."""
    if mc_add_mission:
        try:
            specialist = _jarvis_assign_specialist(title)
            mc_add_mission(title, source=source, assigned_specialist=specialist)
            return True
        except Exception as e:
            logger.warning("add_voice_mission: %s", e)
    # Fallback: legacy data/missions.json
    path = ROOT / "data" / "missions.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"queue": [], "in_progress": [], "completed": []}
        data.setdefault("queue", [])
        data["queue"].append({
            "id": str(uuid.uuid4())[:8],
            "title": title,
            "source": source,
            "created": datetime.now(timezone.utc).isoformat(),
        })
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        return True
    except Exception as e:
        logger.warning("add_voice_mission fallback: %s", e)
        return False


def append_thought_trace(line: str) -> None:
    """Append één regel naar data/thought_trace.log (Hacker Terminal)."""
    path = ROOT / "data" / "thought_trace.log"
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(path, "a", encoding="utf-8") as f:
            f.write(line.strip() + "\n")
    except Exception:
        pass


async def _transcribe_whisper(voice_file_path: Path) -> str | None:
    """Transcribe voice file via OpenAI Whisper API. Returns text or None."""
    try:
        key = os.environ.get("OPENAI_API_KEY", "").strip()
        if not key:
            return None
        from openai import OpenAI
        client = OpenAI()
        with open(voice_file_path, "rb") as f:
            r = client.audio.transcriptions.create(model="whisper-1", file=f)
        return (getattr(r, "text", None) or str(r)).strip()
    except ImportError:
        return None
    except Exception as e:
        logger.warning("Whisper: %s", e)
        return None


async def handle_voice(update, context):
    """Voice-to-Task: spraak → Whisper (opt.) → Mission Queue (Jarvis protocol)."""
    if update.message is None or update.message.voice is None:
        return
    title = "🎤 Nieuwe Missie (spraakbericht)"
    try:
        voice = update.message.voice
        file = await context.bot.get_file(voice.file_id)
        tmp = ROOT / "data" / "tmp_voice.ogg"
        tmp.parent.mkdir(parents=True, exist_ok=True)
        await file.download_to_drive(str(tmp))
        transcript = await _transcribe_whisper(tmp)
        if transcript:
            title = transcript[:400]
        tmp.unlink(missing_ok=True)
    except Exception as e:
        logger.debug("Voice download/whisper: %s", e)
    add_voice_mission(title, source="telegram_voice")
    append_thought_trace(f"[{datetime.now(timezone.utc).isoformat()}] VOICE → Mission Queue: {title[:80]}")
    await update.message.reply_text(DELEGATION_REPLY)


async def handle_text(update, context):
    """Stuur bericht naar de AI en reply met het antwoord. 'Ja'/'goedkeuren' voert openstaande Omega-toestemming uit."""
    if update.message is None or update.message.text is None:
        return
    msg = update.message.text.strip()
    if not msg:
        return

    # Fallback: /tunnel of "tunnel" als gewone tekst (als CommandHandler het niet ving)
    if msg.lower() in ("/tunnel", "tunnel"):
        await cmd_tunnel(update, context)
        return

    # Jarvis als Orchestrator: "taak: ..." / "opdracht: ..." → ALLEEN mission_control, NOOIT AI/ Ollama
    if msg.lower().startswith("taak:") or msg.lower().startswith("opdracht:"):
        raw = msg.split(":", 1)[-1].strip()
        if raw and mc_add_mission:
            try:
                specialist = _jarvis_assign_specialist(raw)
                mc_add_mission(raw[:500], source="telegram", assigned_specialist=specialist)
                append_thought_trace(f"[Jarvis] Gedelegeerd naar {specialist}: {raw[:60]}")
                await update.message.reply_text(DELEGATION_REPLY)
                return
            except Exception as e:
                logger.warning("Jarvis delegate: %s", e)
        if raw:
            add_voice_mission(raw, source="telegram")
            await update.message.reply_text(DELEGATION_REPLY)
            return

    chat_id = update.effective_chat.id if update.effective_chat else None

    # Openstaande toestemming uitvoeren als gebruiker "ja" / "goedkeuren" zegt
    if chat_id is not None and msg.lower().strip() in APPROVAL_PHRASES:
        try:
            from ai_tools import get_and_execute_pending_approval
            result = get_and_execute_pending_approval(chat_id)
            if result:
                await update.message.reply_text(result)
                return
        except Exception as e:
            logger.warning("get_and_execute_pending_approval: %s", e)

    try:
        await update.message.chat.send_action("typing")

        async def send_busy_after(sec: float):
            await asyncio.sleep(sec)
            try:
                await update.message.reply_text("⏳ Dit kan even duren bij grote opdrachten…")
            except Exception:
                pass

        if get_ai_reply:
            busy_task = asyncio.create_task(send_busy_after(12))
            try:
                reply = await asyncio.to_thread(get_ai_reply, msg, 3500, chat_id)
                await update.message.reply_text(reply or "Geen antwoord van de AI.")
            finally:
                busy_task.cancel()
        else:
            await update.message.reply_text(f"Ontvangen: {msg[:200]}")
    except Exception as e:
        logger.exception("handle_text: %s", e)
        await update.message.reply_text(f"Fout: {e}")


async def cmd_holding(update, context):
    """Handler voor /holding — multi-tenant holding management."""
    if update.message is None:
        return
    args = context.args or []
    sub = args[0].lower() if args else "status"
    rest = " ".join(args[1:]).strip() if len(args) > 1 else ""

    try:
        import omega_db
        omega_db.init_schema()

        if sub == "status":
            tenants = omega_db.tenant_list()
            agents = omega_db.holding_agent_list()
            tasks = omega_db.holding_task_list(limit=100)
            active = [t for t in tasks if t["status"] in ("pending", "in_progress", "review")]
            lines = ["Holding Status:"]
            for t in tenants:
                t_agents = [a for a in agents if a["tenant_id"] == t["id"]]
                t_tasks = [tk for tk in active if tk["tenant_id"] == t["id"]]
                lines.append(f"\n{t['name']} ({t['id']}): {len(t_agents)} agents, {len(t_tasks)} actieve taken")
                for a in t_agents:
                    lines.append(f"  {a['role']:10s} {a['name']} [{a['status']}]")
            await update.message.reply_text("\n".join(lines) or "Geen tenants gevonden. Run seed eerst.")

        elif sub == "tasks":
            tenant_filter = rest if rest in ("lunchroom", "webshop") else None
            tasks = omega_db.holding_task_list(tenant_id=tenant_filter, limit=20)
            if not tasks:
                await update.message.reply_text("Geen holding taken gevonden.")
                return
            lines = [f"Holding taken ({len(tasks)}):"]
            for t in tasks:
                lines.append(f"  [{t['status']:12s}] {t['id']}: {t['title'][:60]}")
            await update.message.reply_text("\n".join(lines))

        elif sub == "review":
            task_id = rest
            if not task_id:
                tasks = omega_db.holding_task_list(status="review", limit=5)
                if not tasks:
                    await update.message.reply_text("Geen taken in review.")
                    return
                lines = ["Taken in review:"]
                for t in tasks:
                    out = (t.get("output_data") or {}).get("content", "")[:100]
                    lines.append(f"  {t['id']}: {t['title'][:50]}\n    {out}...")
                await update.message.reply_text("\n".join(lines))
            else:
                t = omega_db.holding_task_get(task_id)
                if not t:
                    await update.message.reply_text(f"Taak {task_id} niet gevonden.")
                    return
                out = (t.get("output_data") or {}).get("content", "")[:800]
                await update.message.reply_text(
                    f"Taak: {t['title']}\nStatus: {t['status']}\n"
                    f"Agent: {t.get('assigned_to', '-')}\nRevisies: {t.get('revision_count', 0)}\n\n{out}")

        elif sub == "approve":
            task_id = rest
            if not task_id:
                await update.message.reply_text("Gebruik: /holding approve <task_id>")
                return
            ok = omega_db.holding_task_update_status(task_id, "approved")
            omega_db.holding_audit_log("human_approved", details={"task_id": task_id})
            await update.message.reply_text(f"Taak {task_id} goedgekeurd." if ok else f"Taak {task_id} niet gevonden.")

        elif sub == "reject":
            parts = rest.split(" ", 1)
            task_id = parts[0] if parts else ""
            feedback = parts[1] if len(parts) > 1 else "Afgekeurd door eigenaar"
            if not task_id:
                await update.message.reply_text("Gebruik: /holding reject <task_id> <feedback>")
                return
            omega_db.holding_task_update_status(task_id, "rejected")
            omega_db.holding_audit_log("human_rejected", details={"task_id": task_id, "feedback": feedback})
            await update.message.reply_text(f"Taak {task_id} afgekeurd: {feedback}")

        elif sub == "costs":
            from holding.src.cost_tracker import summary, total_cost
            rows = summary()
            if not rows:
                await update.message.reply_text("Nog geen kosten gelogd.")
                return
            lines = ["Kosten overzicht:"]
            for r in rows:
                lines.append(f"  {r['tenant_id']:10s} | {r['agent_id']:12s} | {r.get('call_count', 0)} calls | ${r.get('total_cost', 0):.4f}")
            lines.append(f"\nTotaal: ${total_cost():.4f}")
            await update.message.reply_text("\n".join(lines))

        elif sub == "health":
            import psutil
            mem = psutil.virtual_memory()
            disk = psutil.disk_usage("/")
            cpu = psutil.cpu_percent(interval=1)
            await update.message.reply_text(
                f"NUC Health:\n"
                f"  CPU: {cpu}%\n"
                f"  RAM: {mem.used // (1024**2)}MB / {mem.total // (1024**2)}MB ({mem.percent}%)\n"
                f"  Disk: {disk.used // (1024**3)}GB / {disk.total // (1024**3)}GB ({disk.percent}%)\n"
                f"  RAM beschikbaar: {mem.available // (1024**2)}MB")

        elif sub == "seed":
            from holding.src.agent_registry import seed_tenants_and_agents
            result = seed_tenants_and_agents()
            await update.message.reply_text(f"Seed voltooid: {result['tenants']} tenants, {result['agents']} agents aangemaakt.")

        else:
            await update.message.reply_text(
                "Holding commands:\n"
                "/holding status — overzicht tenants + agents\n"
                "/holding tasks [lunchroom|webshop] — taken\n"
                "/holding review [task_id] — review bekijken\n"
                "/holding approve <task_id> — goedkeuren\n"
                "/holding reject <task_id> <feedback> — afkeuren\n"
                "/holding costs — kosten per tenant\n"
                "/holding health — NUC CPU/RAM/disk\n"
                "/holding seed — tenants + agents seeden")

    except Exception as e:
        logger.exception("cmd_holding: %s", e)
        await update.message.reply_text(f"Holding fout: {e}")


def main():
    import re
    raw = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    # Alleen het echte token (cijfers:AA...) — rest negeren (bijv. "token van @BotFather...")
    m = re.search(r"\d+:[A-Za-z0-9_-]{35,}", raw)
    token = m.group(0) if m else raw
    if not token or token == PLACEHOLDER or "xxx" in token:
        logger.error(
            "TELEGRAM_BOT_TOKEN is nog de placeholder. "
            "Bewerk AI_HQ/.env met de echte Omega-bot token van @BotFather."
        )
        return 1

    from telegram import Update
    from telegram.ext import Application, CommandHandler, MessageHandler, filters

    app = (
        Application.builder()
        .token(token)
        .build()
    )
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("panel", cmd_panel))
    app.add_handler(CommandHandler("restart", cmd_restart))
    app.add_handler(CommandHandler("secure", cmd_secure))
    app.add_handler(CommandHandler("lockdown", cmd_lockdown))
    app.add_handler(CommandHandler("tunnel", cmd_tunnel))
    app.add_handler(CommandHandler("task", cmd_task))
    app.add_handler(CommandHandler("holding", cmd_holding))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_handler(MessageHandler(filters.VOICE, handle_voice))

    logger.info("Telegram bridge polling started.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
