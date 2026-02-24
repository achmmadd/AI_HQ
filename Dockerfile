# Omega AI-Holding — basisimage voor alle containers (1Panel / Docker Compose)
FROM python:3.12-slim

WORKDIR /app

# Systeem-afhankelijkheden + Docker CLI (static binary voor /tunnel)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    git \
    procps \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-26.1.3.tgz | tar xzv -C /tmp \
    && mv /tmp/docker/docker /usr/local/bin/docker \
    && rm -rf /tmp/docker

# Python-dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App (bij build; bij run vaak volume mount .:/app)
COPY . .
RUN chmod +x scripts/omega_core_entrypoint.sh 2>/dev/null || true \
    && git config --global --add safe.directory /app

# Default: bridge (override in compose; Singularity: omega_core_entrypoint.sh)
CMD ["python3", "telegram_bridge.py"]
