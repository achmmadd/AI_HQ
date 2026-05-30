# Motor School — slimmer worden + gecontroleerde “vrije wil”

Doel: je AI’s **leren** zoals op school (vaste lessen, examens, logboek), en **zelf verbeteren** binnen grenzen die jij bewaakt — geen onbeperkte autonomie.

## Wat “vrije wil” hier wél en níet is

| Wél (bounded autonomy) | Niet (gevaarlijk / nep) |
|------------------------|-------------------------|
| Dagelijks een **les** krijgen (T01–T05) | Zelf boekingen/mails/posts doen zonder OK |
| **Experiments** (A/B prompts) met winnaar → learned suffix | Mock doctor / random “alles OK” |
| **Dromen** op Home: geplande taken met `approval_required` | “Ik heb het gefixt” zonder CLI-output |
| Jij keurt **system-improvements** goed → `chat_learned_suffix` | Onbeperkte shell op productie |

Echte vrije wil in software bestaat niet; wat je bouwt is **initiatief binnen regels** (Anthropic-achtige “dreams” + jouw goedkeuring).

---

## Drie lagen (vanaf nu in de stack)

### 1. Discipline (altijd aan)

`lib/motor-discipline.ts` wordt bij **elke** chat meegestuurd (Factory/n8n én OpenClaw):

- geen gesimuleerde diagnose;
- echte command output of “geen shell”;
- externe acties alleen met jouw OK;
- verwijzing naar test-playbook.

### 2. School (gepland leren)

| Component | Functie |
|-----------|---------|
| [motor-test-playbook.md](./motor-test-playbook.md) | Examens T01–T05, pass/fail |
| `lib/motor-school.ts` | Les per weekdag (ma–zo) |
| `POST /api/cron/motor-school?mode=lesson\|exam` | Telegram met opdracht |
| **`/school`** | Les van vandaag, logboek, learned suffix preview |
| Home → **Dromen** | Taken `motor_school_lesson_daily`, `motor_school_exam_weekly` (Cowork → Taken) |

**Cron (n8n of systeem-timer):**

```bash
curl -s -X POST "https://motorsai.app/api/cron/motor-school?mode=lesson" \
  -H "x-cron-secret: $FEEDBACK_CRON_SECRET"
```

Zondag examen: `?mode=exam`.

### 3. Geheugen (wat blijft hangen)

| Mechanisme | Waar |
|------------|------|
| `chat_learned_suffix` | Goedgekeurde fixes uit feedback/review |
| `experiments` | Winnaar-variant → learned chunk |
| `system_improvements` | Cluster issues → jij keurt goed |
| Qdrant / kennisbank | Bedrijfscontext per klant |

Na een **geslaagde** T01: max **één** korte regel toevoegen aan learned, bijv.  
*“Bij OpenClaw: altijd doctor + gateway status + curl 18789; geen HTML doctor.”*

---

## Curriculum (weekrooster)

| Dag | Les | Niveau |
|-----|-----|--------|
| Zo | T01 OpenClaw verify | 1 |
| Ma | T02 Externe site / grenzen | 2 |
| Di | T03 Routing OpenClaw | 1 |
| Wo | T04 Plan-modus | 1 |
| Do | T05 /dev terminal | 2 |
| Vr | Weekreview | 3 |
| Za | Rust / learned suffix opruimen | 1 |

Uitvoering: jij of Motor in chat; resultaat in logboek (playbook).

---

## Niveaus

1. **Basis** — eerlijkheid, geen mock UI, T01/T03/T04  
2. **Middel** — T02/T05, Turbo alleen met reden, captcha/headless benoemen  
3. **Gevorderd** — weekreview, voorstellen learned fix, experiments laten lopen  

---

## Meerdere AI’s “naar school”

| Agent | School-focus |
|-------|----------------|
| **Motor** (chat) | Discipline + T01–T05 + learned suffix |
| **Turbo** | T02 web; alleen na Motor-diagnose |
| **OpenClaw agents** (NUC) | Zelfde discipline via OpenClaw system; geen aparte mock tools |
| **Automation “dromen”** | Alleen `task_key` met handler + `approval_required=1` |

OpenClaw-agents ontwikkelen zich **niet** magisch; ze volgen config + prompts. School = **jij + cron + goedkeuringen**.

---

## Roadmap (optioneel, later)

- [ ] Automation-handler in `lib/automation.ts` voor school-taken (bestand is nu root-owned; tot die tijd alleen cron-route)
- [x] UI `/school`: logboek, vandaag les, learned suffix preview
- [x] Pass in `/api/school` → append naar `chat_learned_suffix` (via `lib/motor-school.ts`)
- [x] Sidebar OK → `/cowork?tab=approvals`; `/approvals` redirect (Telegram ?approve/?reject blijft)
- [ ] Auto-fail: chat markeert “mock doctor” → `system_improvements` zonder handmatig copy-paste
- [ ] Xvfb + Playwright-pad voor T02 (zie [computer-use-n8n.md](./computer-use-n8n.md))

**Handmatige stap (eenmalig, als automation-cron taken moet uitvoeren):** voeg in `lib/automation.ts` toe:

```ts
case "motor_school_lesson_daily":
  return runMotorSchoolLessonDaily();
case "motor_school_exam_weekly":
  return runMotorSchoolExamWeekly();
```

(import uit `@/lib/automation/run-motor-school`).

---

## Jouw dagelijkse routine (5 min)

1. Telegram les openen (of Home → Dromen).  
2. Les in chat doen; output plakken.  
3. Pass/fail in playbook-logboek.  
4. Bij pass: eventueel 1 regel learned goedkeuren via system-improvements.  
5. Geen externe acties zonder expliciete “voer uit”.

---

## Gerelateerd

- [motor-test-playbook.md](./motor-test-playbook.md)  
- [approval-runbook.md](./approval-runbook.md)  
- [motor-build-guide.md](./motor-build-guide.md) — QR-menu, artifact vs project vs Codex
