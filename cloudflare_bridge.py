"""
Omega — Cloudflare API-bridge voor DNS en (optioneel) Tunnels.
Gebruik CLOUDFLARE_API_TOKEN en CLOUDFLARE_ZONE_ID in .env.
Alleen aanroepen na request_user_approval (create_subdomain).
"""
import json
import logging
import os
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
logger = logging.getLogger(__name__)


def _load_env() -> None:
    if os.environ.get("CLOUDFLARE_API_TOKEN"):
        return
    for env_file in (ROOT / ".env", ROOT / ".env.cloudflare"):
        if not env_file.exists():
            continue
        with open(env_file, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    k, v = k.strip(), v.strip().strip("'\"")
                    if k in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ZONE_ID") and v:
                        os.environ.setdefault(k, v)


def _request(method: str, path: str, data: dict | None = None) -> dict:
    """Cloudflare API v4. path is relatief, bijv. zones/<zone_id>/dns_records."""
    import urllib.error
    import urllib.request
    _load_env()
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    if not token:
        raise RuntimeError("CLOUDFLARE_API_TOKEN niet gezet.")
    base = "https://api.cloudflare.com/client/v4"
    url = f"{base}/{path.lstrip('/')}"
    req = urllib.request.Request(url, method=method.upper())
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    if data is not None:
        req.data = json.dumps(data).encode("utf-8")
    with urllib.request.urlopen(req, timeout=30) as resp:
        out = json.loads(resp.read().decode("utf-8"))
    if not out.get("success"):
        errors = out.get("errors", [])
        raise RuntimeError("; ".join(e.get("message", str(e)) for e in errors) or "Cloudflare API error")
    return out


def get_zone_id(zone_name: str) -> str | None:
    """Haal zone_id op voor een domein (bijv. example.com)."""
    try:
        out = _request("GET", "zones?name=" + zone_name)
        results = out.get("result") or []
        for z in results:
            if (z.get("name") or "").lower() == zone_name.lower():
                return z.get("id")
        return None
    except Exception as e:
        logger.warning("get_zone_id: %s", e)
        return None


def create_dns_record(zone_id: str, record_type: str, name: str, content: str, ttl: int = 1) -> dict:
    """Maak een DNS-record aan. name: FQDN (bijv. finance.example.com). content: target IP of CNAME. ttl: 1 = auto."""
    data = {"type": record_type, "name": name, "content": content, "ttl": ttl}
    out = _request("POST", f"zones/{zone_id}/dns_records", data)
    return {"ok": True, "result": out.get("result"), "message": f"Record {name} aangemaakt."}


def create_subdomain(subdomain: str, service_url: str) -> dict:
    """
    Koppel een subdomein aan een service (CNAME of A-record).
    subdomain: bijv. finance (wordt finance.<zone>)
    service_url: doel-URL of hostname (bijv. internal.service.local) of IP.
    Vereist CLOUDFLARE_ZONE_ID (of zone name in CLOUDFLARE_ZONE) en CLOUDFLARE_API_TOKEN.
    """
    _load_env()
    zone_id = os.environ.get("CLOUDFLARE_ZONE_ID", "").strip()
    zone_name = os.environ.get("CLOUDFLARE_ZONE", "").strip()
    if zone_name and not zone_id:
        zone_id = get_zone_id(zone_name)
    if not zone_id:
        return {"ok": False, "error": "CLOUDFLARE_ZONE_ID of CLOUDFLARE_ZONE (domeinnaam) verplicht in .env."}
    if not zone_name:
        zone_name = os.environ.get("CLOUDFLARE_ZONE", "").strip() or "example.com"
    name_clean = (subdomain or "").strip().lower().replace(" ", "-")
    if not name_clean:
        return {"ok": False, "error": "Subdomein mag niet leeg zijn."}
    fqdn = f"{name_clean}.{zone_name}" if not name_clean.endswith(zone_name) else name_clean
    content = (service_url or "").strip()
    if not content:
        return {"ok": False, "error": "service_url (doel-hostname of IP) verplicht."}
    record_type = "A" if content.replace(".", "").isdigit() else "CNAME"
    try:
        create_dns_record(zone_id, record_type, fqdn, content)
        return {"ok": True, "message": f"Subdomein {fqdn} aangemaakt → {content}", "fqdn": fqdn}
    except Exception as e:
        logger.warning("create_subdomain: %s", e)
        return {"ok": False, "error": str(e)}
