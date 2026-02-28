"""
LLM Router — route holding-taken via de multi-provider fallback chain.
Groq → Cerebras → OpenRouter → Gemini → Ollama.
Semaphore(1): max 1 concurrent LLM call (NUC RAM bescherming).
"""
from __future__ import annotations

import asyncio
import logging
import time

import omega_db

logger = logging.getLogger(__name__)

_semaphore = asyncio.Semaphore(1)


async def generate(agent: dict, prompt: str, tenant_id: str) -> str:
    """
    Genereer output via de multi-provider fallback chain.
    Gebruikt holding_llm.generate() met agent system_prompt als system instruction.
    """
    system_prompt = agent.get("system_prompt", "")
    agent_id = agent.get("id", "unknown")

    start = time.monotonic()

    async with _semaphore:
        from holding.src.holding_llm import generate as holding_generate
        result = await asyncio.to_thread(
            holding_generate, system_prompt, prompt,
            agent_id, tenant_id)

    elapsed_ms = int((time.monotonic() - start) * 1000)
    logger.info("LLM voor %s: %dms, %d chars", agent_id, elapsed_ms, len(result))

    return result
