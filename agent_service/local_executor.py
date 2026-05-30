"""
NUC-local executor: whitelisted file ops and commands inside LOCAL_WORKSPACE_ROOT.
Bind to 127.0.0.1 only; protect with LOCAL_EXECUTOR_SECRET (Authorization: Bearer).
"""

from __future__ import annotations

import logging
import os
import re
import shlex
import subprocess
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger("local_executor")

router = APIRouter(prefix="/executor", tags=["local-executor"])

OpName = Literal["read_file", "write_file", "list_dir", "run_command"]

ALLOWED_COMMAND_PREFIXES = (
	"npm ",
	"npx ",
	"node ",
	"python3 ",
	"pnpm ",
	"yarn ",
	"git status",
	"git diff",
	"git log",
	"git add",
	"git commit",
	"git push",
	"git pull",
	"git checkout",
	"git branch",
	"gh pr create",
	"gh --version",
	"which gh",
	"ls",
	"pwd",
	"cat ",
	"make ",
)

BLOCKED_SHELL_PATTERN = re.compile(r"[;&|`$(){}><\n\r]")


class ExecutorOp(BaseModel):
	op: OpName
	path: str | None = None
	content: str | None = None
	command: str | None = None
	cwd: str | None = None


def _workspace_root() -> Path:
	raw = os.getenv("LOCAL_WORKSPACE_ROOT", "/home/pietje/AI_HQ/projects").strip()
	return Path(raw).resolve()


def _require_secret(authorization: str | None = Header(default=None)) -> None:
	secret = os.getenv("LOCAL_EXECUTOR_SECRET", "").strip()
	if not secret:
		raise HTTPException(
			status_code=503,
			detail="LOCAL_EXECUTOR_SECRET is not set on the executor service",
		)
	if not authorization or not authorization.startswith("Bearer "):
		raise HTTPException(status_code=401, detail="Missing Bearer token")
	token = authorization[7:].strip()
	if token != secret:
		raise HTTPException(status_code=403, detail="Invalid executor token")


def _resolve_safe_path(rel: str) -> Path:
	root = _workspace_root()
	if not rel or not rel.strip():
		raise HTTPException(status_code=400, detail="path is required")
	clean = rel.strip().lstrip("/")
	candidate = (root / clean).resolve()
	try:
		candidate.relative_to(root)
	except ValueError:
		raise HTTPException(status_code=403, detail="path outside workspace") from None
	return candidate


def _validate_command(cmd: str) -> str:
	c = cmd.strip()
	if not c:
		raise HTTPException(status_code=400, detail="command is empty")
	if BLOCKED_SHELL_PATTERN.search(c):
		raise HTTPException(status_code=400, detail="command contains blocked shell characters")
	if not any(c == p.rstrip() or c.startswith(p) for p in ALLOWED_COMMAND_PREFIXES):
		raise HTTPException(
			status_code=400,
			detail=f"command not in allowlist (allowed prefixes: {', '.join(ALLOWED_COMMAND_PREFIXES)})",
		)
	return c


def _run_subprocess(command: str, cwd: Path) -> dict:
	timeout = float(os.getenv("LOCAL_EXECUTOR_TIMEOUT_SECONDS", "120"))
	max_bytes = int(os.getenv("LOCAL_EXECUTOR_MAX_OUTPUT_BYTES", "65536"))
	try:
		args = shlex.split(command)
	except ValueError as e:
		raise HTTPException(status_code=400, detail=f"invalid command: {e}") from e
	try:
		proc = subprocess.run(
			args,
			cwd=str(cwd),
			capture_output=True,
			text=True,
			timeout=timeout,
			env={
			**os.environ,
			"HOME": str(Path.home()),
			"PATH": f"{Path.home() / '.local' / 'bin'}:{os.environ.get('PATH', '')}",
		},
		)
	except FileNotFoundError as e:
		raise HTTPException(status_code=404, detail=f"command not found: {args[0]}") from e
	except subprocess.TimeoutExpired as e:
		raise HTTPException(status_code=504, detail="command timed out") from e
	stdout = (proc.stdout or "")[:max_bytes]
	stderr = (proc.stderr or "")[:max_bytes]
	return {
		"exit_code": proc.returncode,
		"stdout": stdout,
		"stderr": stderr,
		"truncated": len(proc.stdout or "") > max_bytes or len(proc.stderr or "") > max_bytes,
	}


@router.get("/health")
async def executor_health() -> dict:
	root = _workspace_root()
	return {
		"ok": True,
		"service": "local-executor",
		"workspace_root": str(root),
		"workspace_exists": root.is_dir(),
		"secret_configured": bool(os.getenv("LOCAL_EXECUTOR_SECRET", "").strip()),
	}


@router.post("/execute", dependencies=[Depends(_require_secret)])
async def execute(body: ExecutorOp) -> dict:
	root = _workspace_root()
	if not root.is_dir():
		raise HTTPException(status_code=503, detail=f"workspace root missing: {root}")

	if body.op == "read_file":
		if not body.path:
			raise HTTPException(status_code=400, detail="path required for read_file")
		p = _resolve_safe_path(body.path)
		if not p.is_file():
			raise HTTPException(status_code=404, detail="file not found")
		max_read = int(os.getenv("LOCAL_EXECUTOR_MAX_READ_BYTES", "524288"))
		data = p.read_text(encoding="utf-8", errors="replace")
		truncated = len(data.encode("utf-8")) > max_read
		if truncated:
			data = data[:max_read]
		return {"ok": True, "op": body.op, "path": str(p.relative_to(root)), "content": data, "truncated": truncated}

	if body.op == "write_file":
		if not body.path:
			raise HTTPException(status_code=400, detail="path required for write_file")
		if body.content is None:
			raise HTTPException(status_code=400, detail="content required for write_file")
		p = _resolve_safe_path(body.path)
		p.parent.mkdir(parents=True, exist_ok=True)
		p.write_text(body.content, encoding="utf-8")
		return {"ok": True, "op": body.op, "path": str(p.relative_to(root)), "bytes_written": len(body.content.encode("utf-8"))}

	if body.op == "list_dir":
		rel = body.path or "."
		p = _resolve_safe_path(rel)
		if not p.is_dir():
			raise HTTPException(status_code=404, detail="directory not found")
		entries = sorted(x.name + ("/" if x.is_dir() else "") for x in p.iterdir())[:500]
		return {"ok": True, "op": body.op, "path": str(p.relative_to(root)), "entries": entries}

	if body.op == "run_command":
		if not body.command:
			raise HTTPException(status_code=400, detail="command required for run_command")
		cmd = _validate_command(body.command)
		cwd = _resolve_safe_path(body.cwd or ".")
		if not cwd.is_dir():
			raise HTTPException(status_code=404, detail="cwd not found")
		result = _run_subprocess(cmd, cwd)
		return {"ok": result["exit_code"] == 0, "op": body.op, "cwd": str(cwd.relative_to(root)), **result}

	raise HTTPException(status_code=400, detail="unknown op")
