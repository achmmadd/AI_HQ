#!/usr/bin/env python3
"""
Past ai_chat.py aan: retries voor Gemini en Ollama, betere foutmelding.
Draai: sudo python3 scripts/patch_ai_chat_retries.py
"""
from pathlib import Path

path = Path(__file__).resolve().parent.parent / "ai_chat.py"
text = path.read_text(encoding="utf-8")

# 1. Voeg time en retry-constants toe na logger
old1 = """import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)
"""
new1 = """import os
import logging
import time
from pathlib import Path

logger = logging.getLogger(__name__)
GEMINI_RETRIES = 2
GEMINI_RETRY_DELAY = 2.0
OLLAMA_RETRIES = 2
OLLAMA_RETRY_DELAY = 1.5
"""
if old1 not in text:
    print("Block 1 not found (already patched?)")
else:
    text = text.replace(old1, new1, 1)
    print("Added time + retry constants")

# 1b. Laad ook OLLAMA_* uit .env
old1b = 'want = ("GOOGLE_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY", "GEMINI_MODEL")'
new1b = 'want = ("GOOGLE_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY", "GEMINI_MODEL", "OLLAMA_HOST", "OLLAMA_MODEL")'
if old1b in text:
    text = text.replace(old1b, new1b, 1)
    print("Added OLLAMA_* to .env load list")

# 2. Gemini: wrap send_message in retry loop
old2 = """                chat = model.start_chat(enable_automatic_function_calling=True)
                r = chat.send_message(msg)
                if r and r.text:
"""
new2 = """                chat = model.start_chat(enable_automatic_function_calling=True)
                last_err = None
                for attempt in range(GEMINI_RETRIES):
                    try:
                        r = chat.send_message(msg)
                        if r and r.text:
                            break
                    except Exception as e:
                        last_err = e
                        if attempt < GEMINI_RETRIES - 1:
                            time.sleep(GEMINI_RETRY_DELAY)
                        else:
                            raise
                r = chat.send_message(msg) if attempt == 0 and not (r and r.text) else r
                if r and r.text:
"""
# Simpler: just retry the send_message
old2a = "                chat = model.start_chat(enable_automatic_function_calling=True)\n                r = chat.send_message(msg)\n                if r and r.text:"
new2a = """                chat = model.start_chat(enable_automatic_function_calling=True)
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
"""
if old2a in text:
    text = text.replace(old2a, new2a, 1)
    print("Added Gemini retry loop")
else:
    print("Gemini block not found or already patched")

# 3. Ollama: retry loop + betere foutmelding
old3 = """    # 3. Ollama (localhost, gratis)
    try:
        import requests
        url = os.environ.get("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
        model = os.environ.get("OLLAMA_MODEL", "llama3.2:3b")
        if ":" not in model:
            model = "llama3.2:3b"
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
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()
        content = (data.get("message") or {}).get("content") or ""
        out = content.strip()
        return out[:max_length] if len(out) > max_length else out
    except Exception as e:
        logger.warning("Ollama call failed: %s", e)
        return (
            "AI reageert nu niet. Controleer .env: GOOGLE_API_KEY (Gemini, gratis) of OPENAI_API_KEY; "
            "of start Ollama lokaal: ollama run llama3.2:3b. Bij tijdelijke fout: even later opnieuw proberen."
        )
"""
new3 = """    # 3. Ollama (fallback, met retry)
    import requests
    url = os.environ.get("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
    model = os.environ.get("OLLAMA_MODEL", "llama3.2:3b")
    if ":" not in model:
        model = "llama3.2:3b"
    last_ollama_err = None
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
                timeout=90,
            )
            resp.raise_for_status()
            data = resp.json()
            content = (data.get("message") or {}).get("content") or ""
            out = content.strip()
            return out[:max_length] if len(out) > max_length else out
        except Exception as e:
            last_ollama_err = e
            logger.warning("Ollama call failed: %s", e)
            time.sleep(OLLAMA_RETRY_DELAY)
    return (
        "AI reageert niet (Gemini en Ollama mislukt). Probeer over een minuut opnieuw. "
        "Controleer .env: GOOGLE_API_KEY; of Ollama: ollama run llama3:8b"
    )
"""
if old3 in text:
    text = text.replace(old3, new3, 1)
    print("Added Ollama retry + clearer message")
else:
    print("Ollama block not found or already patched")

try:
    path.write_text(text, encoding="utf-8")
    print("Done. Restart bridge: docker restart omega-telegram-bridge")
except PermissionError:
    print("Geen schrijfrechten op ai_chat.py. Voer uit: sudo python3 scripts/patch_ai_chat_retries.py")
