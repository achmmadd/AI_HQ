"""
Holding LLM — multi-provider fallback chain voor holding agents.

Provider volgorde:
  1. Cerebras   (primair)
  2. OpenRouter (secundair, breed)
  3. Gemini     (backup)
  4. Ollama     (lokaal, laatste redmiddel)
  5. Groq       (klaargezet, pas actief als key in .env staat)

Lege API key → provider wordt automatisch overgeslagen.
Bij 429/5xx/timeout → automatisch volgende provider.
Alleen agent system_prompt als system instruction — geen Omega prompt.
"""
from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import requests

logger = logging.getLogger(__name__)

CALL_TIMEOUT = 15
COOLDOWN_SECONDS = 300
COOLDOWN_FAILURES = 3
MAX_OUTPUT_TOKENS = 1024


@dataclass
class Provider:
    name: str
    base_url: str
    model: str
    env_key: str
    needs_key: bool = True


PROVIDERS = [
    Provider(name="cerebras", base_url="https://api.cerebras.ai/v1",
             model="llama3.1-8b", env_key="CEREBRAS_API_KEY"),
    Provider(name="openrouter", base_url="https://openrouter.ai/api/v1",
             model="openrouter/auto", env_key="OPENROUTER_API_KEY"),
    Provider(name="gemini", base_url="", model="", env_key="GOOGLE_API_KEY"),
    Provider(name="ollama", base_url="http://localhost:11434/v1",
             model="qwen3:4b", env_key="", needs_key=False),
    # Groq: klaargezet, niet actief. Vul GROQ_API_KEY in .env om te activeren.
    Provider(name="groq", base_url="https://api.groq.com/openai/v1",
             model="llama-3.3-70b-versatile", env_key="GROQ_API_KEY"),
]

_health: dict[str, dict] = {}


def _ensure_env():
    env_file = Path(__file__).resolve().parent.parent.parent / ".env"
    if not env_file.exists():
        return
    want = {p.env_key for p in PROVIDERS if p.env_key}
    want.update(("GEMINI_API_KEY", "GEMINI_MODEL", "OLLAMA_HOST", "OLLAMA_MODEL"))
    with open(env_file, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            k, v = k.strip(), v.strip()
            if k not in want:
                continue
            if len(v) >= 2 and v[0] in "'\"" and v[0] == v[-1]:
                v = v[1:-1]
            if not (os.environ.get(k) or "").strip() and v:
                os.environ[k] = v


def _is_cooled_down(provider_name: str) -> bool:
    state = _health.get(provider_name)
    if not state:
        return False
    if state.get("failures", 0) < COOLDOWN_FAILURES:
        return False
    cooldown_until = state.get("cooldown_until", 0)
    if time.time() >= cooldown_until:
        _health[provider_name] = {"failures": 0, "cooldown_until": 0}
        return False
    return True


def _record_failure(provider_name: str) -> None:
    state = _health.setdefault(provider_name, {"failures": 0, "cooldown_until": 0})
    state["failures"] = state.get("failures", 0) + 1
    if state["failures"] >= COOLDOWN_FAILURES:
        state["cooldown_until"] = time.time() + COOLDOWN_SECONDS
        logger.warning("Provider %s in cooldown voor %ds na %d failures",
                       provider_name, COOLDOWN_SECONDS, state["failures"])


def _record_success(provider_name: str) -> None:
    _health[provider_name] = {"failures": 0, "cooldown_until": 0}


def _openai_call(provider: Provider, system_prompt: str,
                 user_prompt: str) -> dict:
    """
    OpenAI-compatible API call. Retourneert:
    {"ok": True, "content": str, "tokens_in": int, "tokens_out": int}
    of {"ok": False, "error": str, "retriable": bool}
    """
    api_key = (os.environ.get(provider.env_key) or "").strip() if provider.needs_key else "ollama"
    if provider.needs_key and not api_key:
        return {"ok": False, "error": f"Geen {provider.env_key}", "retriable": False}

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if provider.name == "openrouter":
        headers["HTTP-Referer"] = "https://omega-holding.local"
        headers["X-Title"] = "Omega Holding"

    body = {
        "model": provider.model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": MAX_OUTPUT_TOKENS,
        "temperature": 0.7,
    }

    try:
        r = requests.post(
            f"{provider.base_url}/chat/completions",
            headers=headers, json=body, timeout=CALL_TIMEOUT)

        if r.status_code == 429:
            return {"ok": False, "error": "Rate limited (429)", "retriable": True}
        if r.status_code >= 500:
            return {"ok": False, "error": f"Server error ({r.status_code})", "retriable": True}
        r.raise_for_status()

        data = r.json()
        choices = data.get("choices") or []
        content = ""
        if choices:
            msg = choices[0].get("message") or {}
            content = (msg.get("content") or "").strip()

        usage = data.get("usage") or {}
        return {
            "ok": True,
            "content": content,
            "tokens_in": usage.get("prompt_tokens", len(user_prompt) // 4),
            "tokens_out": usage.get("completion_tokens", len(content) // 4),
        }

    except requests.exceptions.Timeout:
        return {"ok": False, "error": f"Timeout ({CALL_TIMEOUT}s)", "retriable": True}
    except requests.exceptions.ConnectionError as e:
        return {"ok": False, "error": f"Connection error: {e}", "retriable": True}
    except Exception as e:
        return {"ok": False, "error": str(e), "retriable": False}


def _gemini_call(system_prompt: str, user_prompt: str) -> dict:
    """Gemini via google-generativeai (niet OpenAI-compatible)."""
    api_key = (os.environ.get("GOOGLE_API_KEY")
               or os.environ.get("GEMINI_API_KEY") or "").strip()
    if not api_key:
        return {"ok": False, "error": "Geen GOOGLE_API_KEY", "retriable": False}

    try:
        import google.generativeai as genai
    except ImportError:
        return {"ok": False, "error": "google-generativeai niet geïnstalleerd", "retriable": False}

    genai.configure(api_key=api_key)
    model_name = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")

    model = genai.GenerativeModel(
        model_name,
        system_instruction=system_prompt,
        generation_config=genai.types.GenerationConfig(
            max_output_tokens=MAX_OUTPUT_TOKENS),
    )

    try:
        r = model.generate_content(user_prompt)
        if r and r.text:
            content = r.text.strip()
            return {
                "ok": True,
                "content": content,
                "tokens_in": len(user_prompt) // 4,
                "tokens_out": len(content) // 4,
            }
        return {"ok": False, "error": "Gemini: leeg antwoord", "retriable": True}
    except Exception as e:
        err = str(e)
        retriable = "429" in err or "Resource exhausted" in err or "500" in err
        return {"ok": False, "error": err, "retriable": retriable}


def generate(system_prompt: str, user_prompt: str,
             agent_id: str = "unknown", tenant_id: str = "unknown",
             max_length: int = 3500) -> str:
    """
    Multi-provider fallback: Groq → Cerebras → OpenRouter → Gemini → Ollama.
    Logt naar cost_log en holding_audit. Retourneert gegenereerde tekst.
    """
    _ensure_env()
    import omega_db

    errors = []

    for idx, provider in enumerate(PROVIDERS):
        if _is_cooled_down(provider.name):
            logger.debug("Skip %s (cooldown)", provider.name)
            continue

        if provider.needs_key:
            key = (os.environ.get(provider.env_key) or "").strip()
            if not key:
                continue

        label = f"{provider.name} ({'primary' if idx == 0 else f'fallback {idx}'})"
        start = time.monotonic()

        if provider.name == "gemini":
            result = _gemini_call(system_prompt, user_prompt)
        else:
            result = _openai_call(provider, system_prompt, user_prompt)

        elapsed_ms = int((time.monotonic() - start) * 1000)

        content_raw = (result.get("content") or "").strip() if result["ok"] else ""
        if result["ok"] and content_raw:
            _record_success(provider.name)
            content = content_raw
            if len(content) > max_length:
                content = content[:max_length]

            model_tag = f"{provider.name}/{provider.model}" if provider.name != "gemini" else f"gemini/{os.environ.get('GEMINI_MODEL', 'gemini-2.0-flash')}"

            try:
                omega_db.cost_log_insert(
                    tenant_id=tenant_id, agent_id=agent_id,
                    model_used=model_tag,
                    tokens_in=result.get("tokens_in", 0),
                    tokens_out=result.get("tokens_out", 0),
                    cost_usd=0.0)
            except Exception:
                pass

            try:
                omega_db.holding_audit_log(
                    "llm_call", tenant_id=tenant_id, agent_id=agent_id,
                    details={
                        "provider": label,
                        "model": model_tag,
                        "response_time_ms": elapsed_ms,
                        "tokens_in": result.get("tokens_in", 0),
                        "tokens_out": result.get("tokens_out", 0),
                    })
            except Exception:
                pass

            logger.info("LLM %s OK: %dms, %d chars", label, elapsed_ms, len(content))
            return content

        _record_failure(provider.name)
        if result["ok"] and not content_raw:
            err_msg = "empty response"
        else:
            err_msg = result.get("error", "unknown")
        errors.append(f"{label}: {err_msg} ({elapsed_ms}ms)")
        logger.warning("LLM %s FAILED: %s (%dms)", label, err_msg, elapsed_ms)

    all_errors = "; ".join(errors)
    logger.error("Alle LLM providers gefaald: %s", all_errors)

    try:
        omega_db.holding_audit_log(
            "llm_all_failed", tenant_id=tenant_id, agent_id=agent_id,
            details={"errors": errors})
    except Exception:
        pass

    return f"[LLM ERROR] Alle providers gefaald: {all_errors}"
