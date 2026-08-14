# syntax=docker/dockerfile:1
#
# AgentScope sidecar image — Motor pilot, lane C.
# Build context is ai-motor/ (see compose.agentscope.yaml):
#   docker build -f infra/pilot/agentscope/Dockerfile .
#
# Base image pinned by exact tag AND manifest-list digest
# (Docker Hub API v2, fetched 2026-08-14). Never `latest`.
FROM python:3.12.12-slim@sha256:f3fa41d74a768c2fce8016b98c191ae8c1bacd8f1152870a3f9f87d350920b7c

RUN groupadd --gid 10001 sidecar \
    && useradd --uid 10001 --gid sidecar --no-create-home sidecar

WORKDIR /app
COPY pilot/adapters/agentscope/requirements.txt /app/requirements.txt

# Supply chain: download the exact pinned wheel WITHOUT dependencies, verify
# its PyPI sha256 (see requirements.txt), only then install. Transitive deps
# are resolved by pip at build time; a full `pip-compile --generate-hashes`
# lock is required before any live use (lane-C residual risk, see LANE-C.md).
RUN pip download --no-cache-dir --no-deps --dest /tmp/wheels agentscope==2.0.6 \
    && echo "091e7f214eff7fd6f4934d98a7d7c4bb8707a5d4b33d335def7fc31255e7ccb8  /tmp/wheels/agentscope-2.0.6-py3-none-any.whl" \
       | sha256sum -c - \
    && pip install --no-cache-dir /tmp/wheels/agentscope-2.0.6-py3-none-any.whl \
    && rm -rf /tmp/wheels

COPY pilot/adapters/agentscope/sidecar.py /app/sidecar.py

USER sidecar
EXPOSE 4410
CMD ["python", "sidecar.py"]
