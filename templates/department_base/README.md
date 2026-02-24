# Department base template

Deze map is de blueprint voor nieuwe afdelingen (agents) die Omega via `spawn_new_agent` aanmaakt.

- **SOUL.md.tpl** — Template voor SOUL.md met placeholders: `{name}`, `{role}`, `{expertise}`.
- Bij spawn wordt deze map gekopieerd naar `holding/departments/<agent_name>/` en de placeholders worden vervangen.

Optioneel: voeg `profile.json.tpl` toe met `{name}`, `{role}`, `parent` voor extra configuratie.
