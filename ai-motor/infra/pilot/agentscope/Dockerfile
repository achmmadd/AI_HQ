# syntax=docker/dockerfile:1
#
# AgentScope sidecar image — Motor pilot, lane C, activated in sprint P0.6
# (lane B). Build context is ai-motor/ (see compose.agentscope.yaml):
#   docker build -f infra/pilot/agentscope/Dockerfile .
#
# Base image pinned by exact tag AND manifest-list digest
# (Docker Hub API v2, fetched 2026-08-14). Never `latest`.
FROM python:3.12.12-slim@sha256:f3fa41d74a768c2fce8016b98c191ae8c1bacd8f1152870a3f9f87d350920b7c

RUN groupadd --gid 10001 sidecar \
    && useradd --uid 10001 --gid sidecar --no-create-home sidecar

WORKDIR /app
COPY pilot/adapters/agentscope/requirements.txt /app/requirements.txt
COPY pilot/adapters/agentscope/requirements-lock.txt /app/requirements-lock.txt

# Supply chain: EVERY artifact (direct + transitive) is installed exclusively
# from requirements-lock.txt with --require-hashes. The lock was generated
# with `pip-compile --generate-hashes` for linux/amd64 py3.12 inside this
# exact base image (see LANE-B-AGENTSCOPE.md). Belt-and-suspenders: assert
# that the lane-C audited AgentScope wheel sha256 is the one the lock pins,
# then assert the installed package is exactly 2.0.6.
RUN set -eu; \
    expected="091e7f214eff7fd6f4934d98a7d7c4bb8707a5d4b33d335def7fc31255e7ccb8"; \
    grep -qF "sha256:${expected}" /app/requirements-lock.txt; \
    pip install --no-cache-dir --require-hashes -r /app/requirements-lock.txt; \
    python -c "import agentscope; assert agentscope.__version__ == '2.0.6', agentscope.__version__"

COPY pilot/adapters/agentscope/sidecar.py /app/sidecar.py

USER sidecar
EXPOSE 4410
CMD ["python", "sidecar.py"]
