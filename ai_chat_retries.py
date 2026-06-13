"""
Eén gebruikerbericht naar de AI en antwoord terug.
Wordt o.a. door telegram_bridge gebruikt.
Volgorde: OpenRouter (DeepSeek) → Ollama → OpenAI → Gemini.
Retries bij tijdelijke fouten (rate limit, timeout).
"""
import os
import logging
import time
from pathlib import Path

logger = logging.getLogger(__name__)
GEMINI_RETRIES = 3
GEMINI_RETRY_DELAY = 3.0
OLLAMA_RETRIES = 3
OLLAMA_RETRY_DELAY = 2.0
OLLAMA_TIMEOUT = 120  # grote taken kunnen lang duren

# Laad .env voor AI-keys als ze nog ontbreken of leeg zijn (voorkomt "soms wel, soms niet")
def _ensure_env_loaded():
    root = Path(__file__).resolve().parent
    env_file = root / ".env"
    if not env_file.exists():
        return
    want = (
        "GOOGLE_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY",
        "GEMINI_MODEL", "OPENROUTER_MODEL", "OLLAMA_HOST", "OLLAMA_MODEL",
    )
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                k, v = k.strip(), v.strip()
                if k not in want:
                    continue
                if len(v) >= 2 and v[0] in "'\"" and v[0] == v[-1]:
                    v = v[1:-1]
                # Alleen invullen als key ontbreekt of leeg (zo blijft .env altijd de bron)
                cur = (os.environ.get(k) or "").strip()
                if not cur and v:
                    os.environ[k] = v

SYSTEM = (
    "Je bent een behulpzame assistent van de Omega AI-Holding en werkt samen met Omega (bridge, scripts, NUC). "
    "Antwoord bondig en helder in het Nederlands. "
    "Protocol: autonoom toegestaan — kleine optimalisaties, git_commit, audit_code, run_in_sandbox, query_memory, update_evomap_state, get_soul_context, list/write/read tasks en notes, system_status, container_list, container_logs. "
    "Toestemming verplicht — spawn_new_agent, create_subdomain, container_restart voor kritieke containers, run_safe_script voor NEED_APPROVAL_SCRIPTS, wijzigingen aan kernbestanden (mission_control, telegram_bridge, ai_tools): altijd eerst request_user_approval. "
    "Je kunt zelf handelingen uitvoeren (taken, notities, status, scripts). "
    "Vóór elke codewijziging of toevoeging van bestanden moet je eerst git_commit(omschrijving) aanroepen. Bij falen geen wijziging doorvoeren. "
    "Voor handelingen die Omega of de omgeving wijzigen (herstarten, sync, scripts die iets stoppen of starten) moet je EERST toestemming vragen: roep request_user_approval(omschrijving, script_name) aan en zeg tegen de gebruiker dat hij 'ja' of 'goedkeuren' moet zeggen; voer run_safe_script dan niet direct uit. Alleen check_zwartehand en check_telegram_token_env mag je direct met run_safe_script doen. "
    "Voor marketingvragen kun je get_soul_context(agent_id) aanroepen met trend_hunter, copy_architect, visual_strategist, seo_analyst of lead_gen om de specialist-context in te laden. "
    "Gebruik update_evomap_state(agent_id, new_task, status) om het Evomap-dashboard live bij te werken wanneer een agent van taak of status verandert (agent_id: omega, trend_hunter, copy_architect, visual_strategist, seo_analyst, lead_gen). "
    "Gebruik query_memory(vraag) voor het lange-termijngeheugen. "
    "Voor een nieuwe afdeling: eerst request_user_approval('Nieuwe afdeling: <naam>', 'spawn_new_agent', agent_name=..., role=..., parent_node='omega'); na 'ja' wordt spawn_new_agent uitgevoerd. "
    "Nieuwe of gewijzigde scripts eerst audit_code(pad) aanroepen; bij ernstige bevindingen run_in_sandbox(script_path, timeout_sec) voor een veilige test. Alleen na goedkeuring in productie draaien. "
    "Tools: git_commit, save_task, complete_task, list_tasks, write_note, list_notes, read_note, run_ollama, system_status, request_user_approval, run_safe_script, audit_code, run_in_sandbox, get_soul_context, update_evomap_state, query_memory, spawn_new_agent, container_list, container_logs, container_restart, create_subdomain."
)


def _openrouter_api_key() -> str:
    key = (os.environ.get("OPENROUTER_API_KEY") or "").strip()
    if key:
        return key
    models_json = Path.home() / ".openclaw/agents/main/agent/models.json"
    try:
        import json
        data = json.loads(models_json.read_text(encoding="utf-8"))
        return (data.get("providers", {}).get("openrouter", {}).get("apiKey") or "").strip()
    except Exception:
        return ""


def _openrouter_reply(msg: str, max_length: int) -> str | None:
    api_key = _openrouter_api_key()
    if not api_key:
        return None
    import requests
    model = os.environ.get("OPENROUTER_MODEL", "deepseek/deepseek-v4-pro")
    try:
        resp = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": SYSTEM},
                    {"role": "user", "content": msg},
                ],
                "max_tokens": 1024,
            },
            timeout=90,
        )
        resp.raise_for_status()
        data = resp.json()
        content = (((data.get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()
        if not content:
            return None
        try:
            from mission_control import record_spend
            record_spend(0.002)
        except Exception:
            pass
        return content[:max_length] if len(content) > max_length else content
    except Exception as e:
        logger.warning("OpenRouter call failed: %s", e)
        return None


def get_ai_reply(user_message: str, max_length: int = 3500, chat_id: int | None = None) -> str:
    """
    Stuur user_message naar de AI en geef het antwoord terug.
    chat_id: optioneel Telegram chat-id voor toestemmingsflow (Omega-handelingen).
    Volgorde: OpenRouter (DeepSeek) → Ollama → OpenAI → Gemini.
    """
    if not user_message or not user_message.strip():
        return "Stuur een bericht om een antwoord te krijgen."

    msg = user_message.strip()
    _ensure_env_loaded()

    # Circuit Breaker (Supremacy): daglimiet API-kosten
    try:
        from mission_control import circuit_breaker_ok, record_spend, get_daily_spend
        if not circuit_breaker_ok():
            spend, limit = get_daily_spend()
            return f"⛔ Circuit breaker: daglimiet bereikt (€{spend:.2f} / €{limit:.0f}). Stel mission_control state.spend_limit_eur hoger of wacht tot morgen."
    except ImportError:
        pass

    # 1. OpenRouter / DeepSeek (zelfde stack als OpenClaw Pietjebel_bot)
    openrouter_out = _openrouter_reply(msg, max_length)
    if openrouter_out:
        return openrouter_out

    # 2. Ollama (lokaal, geen API-key nodig)
    import requests
    url = os.environ.get("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
    model = os.environ.get("OLLAMA_MODEL", "llama3.2:3b")
    if ":" not in model:
        model = "llama3.2:3b"
    for _ in range(OLLAMA_RETRIES):
        try:
            resp = requests.post(
                f"{url}/api/chat",
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": SYSTEM},
                        {"role": "user", "content": msg},
                    ],
                    "stream": False,
                },
                timeout=OLLAMA_TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json()
            content = (data.get("message") or {}).get("content") or ""
            out = content.strip()
            if out:
                return out[:max_length] if len(out) > max_length else out
        except Exception as e:
            logger.warning("Ollama call failed: %s", e)
            time.sleep(OLLAMA_RETRY_DELAY)

    # 3. OpenAI (als OPENAI_API_KEY gezet is)
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if api_key and not api_key.startswith("sk-xxx"):
        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key)
            r = client.chat.completions.create(
                model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
                messages=[
                    {"role": "system", "content": SYSTEM},
                    {"role": "user", "content": msg},
                ],
                max_tokens=1024,
            )
            if r.choices and r.choices[0].message and r.choices[0].message.content:
                try:
                    record_spend(0.01)
                except Exception:
                    pass
                out = r.choices[0].message.content.strip()
                return out[:max_length] if len(out) > max_length else out
        except Exception as e:
            logger.warning("OpenAI call failed: %s", e)

    # 4. Gemini (fallback — tools voor Omega-handelingen)
    api_key = (os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY") or "").strip()
    if api_key:
        try:
            import google.generativeai as genai
            from ai_tools import (
                git_commit, save_task, write_note, run_ollama,
                list_tasks, complete_task, list_notes, read_note,
                system_status, run_safe_script, request_user_approval,
                audit_code, run_in_sandbox,
                get_soul_context, update_evomap_state, query_memory,
                spawn_new_agent,
                container_list, container_logs, container_restart,
                create_subdomain,
                approval_chat_id,
            )

            genai.configure(api_key=api_key)
            model_name = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
            # Context voor toestemming (Omega-handelingen)
            token = None
            if chat_id is not None:
                token = approval_chat_id.set(str(chat_id))
            try:
                decls = [
                    genai.types.FunctionDeclaration.from_function(git_commit),
                    genai.types.FunctionDeclaration.from_function(save_task),
                    genai.types.FunctionDeclaration.from_function(list_tasks),
                    genai.types.FunctionDeclaration.from_function(complete_task),
                    genai.types.FunctionDeclaration.from_function(write_note),
                    genai.types.FunctionDeclaration.from_function(list_notes),
                    genai.types.FunctionDeclaration.from_function(read_note),
                    genai.types.FunctionDeclaration.from_function(run_ollama),
                    genai.types.FunctionDeclaration.from_function(system_status),
                    genai.types.FunctionDeclaration.from_function(request_user_approval),
                    genai.types.FunctionDeclaration.from_function(run_safe_script),
                    genai.types.FunctionDeclaration.from_function(get_soul_context),
                    genai.types.FunctionDeclaration.from_function(update_evomap_state),
                    genai.types.FunctionDeclaration.from_function(query_memory),
                    genai.types.FunctionDeclaration.from_function(spawn_new_agent),
                    genai.types.FunctionDeclaration.from_function(audit_code),
                    genai.types.FunctionDeclaration.from_function(run_in_sandbox),
                    genai.types.FunctionDeclaration.from_function(container_list),
                    genai.types.FunctionDeclaration.from_function(container_logs),
                    genai.types.FunctionDeclaration.from_function(container_restart),
                    genai.types.FunctionDeclaration.from_function(create_subdomain),
                ]
                tool = genai.types.Tool(function_declarations=decls)
                model = genai.GenerativeModel(
                    model_name,
                    tools=[tool],
                    system_instruction=SYSTEM,
                    generation_config=genai.types.GenerationConfig(max_output_tokens=1024),
                )
                chat = model.start_chat(enable_automatic_function_calling=True)
                r = None
                for _ in range(GEMINI_RETRIES):
                    try:
                        r = chat.send_message(msg)
                        if r and r.text:
                            break
                    except Exception as e:
                        logger.warning("Gemini attempt failed: %s", e)
                        time.sleep(GEMINI_RETRY_DELAY)
                if r and r.text:
                    try:
                        record_spend(0.001)  # ~€0.001 per Gemini call (gratis tier)
                    except Exception:
                        pass
                    out = r.text.strip()
                    return out[:max_length] if len(out) > max_length else out
            finally:
                if token is not None:
                    approval_chat_id.reset(token)
        except ImportError:
            logger.warning("Gemini: pip install google-generativeai")
        except Exception as e:
            logger.warning("Gemini call failed: %s", e)

    return (
        "AI reageert niet na meerdere pogingen (OpenRouter, Ollama, OpenAI, Gemini). "
        "Probeer het over een minuut opnieuw, of stel een kortere vraag. "
        "Controleer .env: OPENROUTER_API_KEY of Ollama: ollama run llama3:8b"
    )
