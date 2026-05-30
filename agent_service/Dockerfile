# Python ≥3.11 vereist door browser-use. Playwright chromium + systeem-deps.
FROM python:3.12-slim-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
 && python -m playwright install-deps chromium \
 && python -m playwright install chromium

COPY main.py .

ENV PYTHONUNBUFFERED=1
ENV OLLAMA_MODEL=qwen3:4b
ENV AGENT_USE_VISION=false

EXPOSE 8787

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8787"]
