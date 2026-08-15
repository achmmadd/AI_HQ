# syntax=docker/dockerfile:1
#
# Hermes sidecar image — Motor pilot, runtime-activatie spoor A.
# Build context is deze map (infra/pilot/hermes):
#   docker build -f infra/pilot/hermes/Dockerfile infra/pilot/hermes
#
# Base image pinned by exact tag AND manifest-list digest — dezelfde pin als
# de agentscope-sidecar (Docker Hub API v2, opgehaald 2026-08-14). Nooit
# `latest`.
FROM python:3.12.12-slim@sha256:f3fa41d74a768c2fce8016b98c191ae8c1bacd8f1152870a3f9f87d350920b7c

RUN groupadd --gid 10001 sidecar \
    && useradd --uid 10001 --gid sidecar --no-create-home sidecar

# De sidecar is bewust stdlib-only: er is geen extern te pinnen
# "Hermes"-package — sidecar.py IS de Motor-Hermes-runtime. Supply chain
# is daarmee exact één gepind base image; geen pip, geen PyPI, geen
# build-time netwerk buiten de base-pull.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY sidecar.py /app/sidecar.py

USER sidecar
EXPOSE 4410
CMD ["python", "sidecar.py"]
