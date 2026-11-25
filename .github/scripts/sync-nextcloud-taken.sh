#!/usr/bin/env bash
# Sync GitHub branch / PR / CI / deploy metadata to Nextcloud Tables "Taken".
# Fail-soft by default: API and lookup errors warn and exit 0 so PRs are never blocked.
set -euo pipefail
set +x

COL_BRANCH="${COL_BRANCH:-21}"
COL_PR="${COL_PR:-22}"
COL_CI="${COL_CI:-23}"
COL_DEPLOY="${COL_DEPLOY:-24}"
COL_UPDATED="${COL_UPDATED:-27}"
NEXTCLOUD_URL="${NEXTCLOUD_URL:-https://cloud.motorsai.app}"
NEXTCLOUD_TAKEN_TABLE_ID="${NEXTCLOUD_TAKEN_TABLE_ID:-3}"

extract_task_id_from_body() {
  local body="${1:-}"
  [[ -n "$body" ]] || return 1
  # First matching line: "Taak: 123", "## Taak: #123", "Row: 7", "Row-id: 7", "Nextcloud-row: 7"
  local line
  line="$(
    printf '%s\n' "$body" \
      | grep -iE -m1 '^[[:space:]]*(#+[[:space:]]*)?(taak|row(-id)?|nextcloud[-[:space:]]row)[[:space:]]*:[[:space:]]*#?[[:space:]]*[0-9]+[[:space:]]*$' \
      || true
  )"
  [[ -n "$line" ]] || return 1
  if [[ "$line" =~ ([0-9]+) ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return 0
  fi
  return 1
}

extract_task_id_from_branch() {
  local branch="${1:-}"
  [[ -n "$branch" ]] || return 1
  if [[ "$branch" =~ (^|[-_/])[tT]aak[-_/]([0-9]+)([-_/]|$) ]]; then
    printf '%s\n' "${BASH_REMATCH[2]}"
    return 0
  fi
  if [[ "$branch" =~ (^|[-_/])[tT]-([0-9]+)([-_/]|$) ]]; then
    printf '%s\n' "${BASH_REMATCH[2]}"
    return 0
  fi
  if [[ "$branch" =~ (^|[-_/])[rR]ow[-_/]([0-9]+)([-_/]|$) ]]; then
    printf '%s\n' "${BASH_REMATCH[2]}"
    return 0
  fi
  return 1
}

extract_task_id() {
  local branch="${1:-}"
  local body="${2:-}"
  local explicit="${3:-}"
  local found=""
  if [[ -n "$explicit" && "$explicit" =~ ^[0-9]+$ ]]; then
    printf '%s\n' "$explicit"
    return 0
  fi
  found="$(extract_task_id_from_body "$body" || true)"
  if [[ -n "$found" ]]; then
    printf '%s\n' "$found"
    return 0
  fi
  found="$(extract_task_id_from_branch "$branch" || true)"
  if [[ -n "$found" ]]; then
    printf '%s\n' "$found"
    return 0
  fi
  return 1
}

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$expected" != "$actual" ]]; then
    echo "self-test FAIL: ${label}: expected '${expected}', got '${actual}'" >&2
    return 1
  fi
  echo "self-test OK: ${label}"
}

run_self_test() {
  local got=""
  got="$(extract_task_id "cursor/taak-12-foo" "" "")"
  assert_eq "branch taak-12" "12" "$got"
  got="$(extract_task_id "feature/T-99-login" "" "")"
  assert_eq "branch T-99" "99" "$got"
  got="$(extract_task_id "t-7" "" "")"
  assert_eq "branch t-7" "7" "$got"
  got="$(extract_task_id "cursor/row-4-sync" "" "")"
  assert_eq "branch row-4" "4" "$got"
  got="$(extract_task_id "cursor/nextcloud-taken-sync-5da0" "" "" || true)"
  assert_eq "cursor branch has no id" "" "$got"
  got="$(extract_task_id "feat-123-login" "" "" || true)"
  assert_eq "feat-123 is not a task id" "" "$got"
  got="$(extract_task_id "nope" $'Hello\nTaak: 42\nBye' "")"
  assert_eq "body Taak: 42" "42" "$got"
  got="$(extract_task_id "nope" $'## Taak: #7' "")"
  assert_eq "heading Taak: #7" "7" "$got"
  got="$(extract_task_id "nope" $'Row-id: 3' "")"
  assert_eq "body Row-id" "3" "$got"
  got="$(extract_task_id "nope" $'See PR 99 and issue 12' "" || true)"
  assert_eq "unrelated numbers" "" "$got"
  got="$(extract_task_id "taak-1" $'Taak: 99' "")"
  assert_eq "body wins over branch" "99" "$got"
  got="$(extract_task_id "taak-1" "" "55")"
  assert_eq "explicit row id wins" "55" "$got"
  echo "self-test: all passed"
}

if [[ "${1:-}" == "--self-test" ]]; then
  run_self_test
  exit $?
fi

fail_soft() {
  echo "::warning::Nextcloud Taken-sync: ${1:-onbekende fout}. Board-update overgeslagen; job eindigt 0."
  exit 0
}

trap 'fail_soft "onverwachte fout op regel ${LINENO}"' ERR

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail_soft "commando ontbreekt: $1"
}

require_cmd curl
require_cmd jq

NEXTCLOUD_URL="${NEXTCLOUD_URL%/}"

EVENT_NAME="${EVENT_NAME:-}"
WRITE_BRANCH=""
WRITE_PR=""
WRITE_CI=""
WRITE_DEPLOY=""
WRITE_UPDATED="$(date -u +'%Y-%m-%d %H:%M')"
TASK_BRANCH="${TASK_BRANCH:-}"
TASK_BODY="${TASK_BODY:-}"
TASK_ROW_ID="${TASK_ROW_ID:-}"
DRY_RUN="${DRY_RUN:-false}"

github_api() {
  local path="$1"
  local url="${GITHUB_API_URL:-https://api.github.com}${path}"
  local tmp http_code
  tmp="$(mktemp)"
  http_code="$(
    curl --silent --show-error --location \
      --header "Authorization: Bearer ${GITHUB_TOKEN:?}" \
      --header "Accept: application/vnd.github+json" \
      --header "X-GitHub-Api-Version: 2022-11-28" \
      --output "$tmp" \
      --write-out "%{http_code}" \
      "$url"
  )" || true
  if [[ "$http_code" != 2* ]]; then
    echo "GitHub API ${path} gaf HTTP ${http_code}" >&2
    rm -f "$tmp"
    return 1
  fi
  cat "$tmp"
  rm -f "$tmp"
}

lookup_pr_for_sha() {
  local sha="$1"
  [[ -n "$sha" && -n "${GITHUB_REPOSITORY:-}" ]] || return 1
  github_api "/repos/${GITHUB_REPOSITORY}/commits/${sha}/pulls" \
    | jq -c '
        (map(select(.state == "open")) | .[0]) // .[0] // empty
        | select(. != null)
        | {number, html_url, body, head_ref: .head.ref, merged: (.merged // false), state}
      '
}

hydrate_from_pr_json() {
  local json="$1"
  [[ -n "$json" ]] || return 1
  TASK_BRANCH="$(jq -r '.head_ref // empty' <<<"$json")"
  WRITE_BRANCH="$TASK_BRANCH"
  WRITE_PR="$(jq -r '.html_url // empty' <<<"$json")"
  TASK_BODY="$(jq -r '.body // empty' <<<"$json")"
}

case "$EVENT_NAME" in
  pull_request)
    TASK_BRANCH="${PR_HEAD_REF:-}"
    TASK_BODY="${PR_BODY:-}"
    WRITE_BRANCH="$TASK_BRANCH"
    WRITE_PR="${PR_HTML_URL:-}"
    case "${PR_ACTION:-}" in
      opened|synchronize|reopened)
        WRITE_CI="pending"
        ;;
      closed)
        if [[ "${PR_MERGED:-false}" == "true" ]]; then
          WRITE_CI="merged"
        else
          WRITE_CI="closed"
        fi
        ;;
      edited)
        # Body/title edit: refresh branch + PR URL, leave CI/Deploy as-is.
        ;;
    esac
    ;;
  workflow_run)
    TASK_BRANCH="${WR_HEAD_BRANCH:-}"
    WRITE_BRANCH="$TASK_BRANCH"
    local_pr_number="${WR_PR_NUMBER:-}"
    if [[ -n "$local_pr_number" ]]; then
      WRITE_PR="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY}/pull/${local_pr_number}"
      if pr_json="$(github_api "/repos/${GITHUB_REPOSITORY}/pulls/${local_pr_number}" || true)"; then
        if [[ -n "$pr_json" ]]; then
          TASK_BODY="$(jq -r '.body // empty' <<<"$pr_json")"
          TASK_BRANCH="$(jq -r '.head.ref // empty' <<<"$pr_json")"
          WRITE_BRANCH="$TASK_BRANCH"
          WRITE_PR="$(jq -r '.html_url // empty' <<<"$pr_json")"
        fi
      fi
    elif [[ -n "${WR_HEAD_SHA:-}" ]]; then
      if pr_json="$(lookup_pr_for_sha "$WR_HEAD_SHA" || true)"; then
        if [[ -n "$pr_json" ]]; then
          hydrate_from_pr_json "$pr_json"
        fi
      fi
    fi
    conclusion="${WR_CONCLUSION:-}"
    wr_name="${WR_NAME:-}"
    case "$wr_name" in
      "Holding Checks")
        case "$conclusion" in
          success) WRITE_CI="success" ;;
          failure|timed_out) WRITE_CI="failure" ;;
          cancelled) WRITE_CI="cancelled" ;;
          skipped) WRITE_CI="skipped" ;;
          *) WRITE_CI="${conclusion:-pending}" ;;
        esac
        ;;
      "Deploy to NUC")
        case "$conclusion" in
          success) WRITE_DEPLOY="success" ;;
          failure|timed_out) WRITE_DEPLOY="failure" ;;
          cancelled) WRITE_DEPLOY="cancelled" ;;
          skipped) WRITE_DEPLOY="skipped" ;;
          *) WRITE_DEPLOY="${conclusion:-pending}" ;;
        esac
        ;;
      *)
        echo "Onbekende workflow_run-bron: ${wr_name}; alleen timestamp/PR bijwerken als een taak-id bestaat."
        ;;
    esac
    ;;
  deployment_status)
    TASK_BRANCH="${DS_REF:-}"
    TASK_BRANCH="${TASK_BRANCH#refs/heads/}"
    WRITE_BRANCH="$TASK_BRANCH"
    case "${DS_STATE:-}" in
      success) WRITE_DEPLOY="success" ;;
      failure|error) WRITE_DEPLOY="failure" ;;
      pending) WRITE_DEPLOY="pending" ;;
      inactive) WRITE_DEPLOY="inactive" ;;
      *) WRITE_DEPLOY="${DS_STATE:-}" ;;
    esac
    if [[ -n "${DS_SHA:-}" ]]; then
      if pr_json="$(lookup_pr_for_sha "$DS_SHA" || true)"; then
        if [[ -n "$pr_json" ]]; then
          hydrate_from_pr_json "$pr_json"
        fi
      fi
    fi
    ;;
  workflow_dispatch)
    TASK_ROW_ID="${INPUT_ROW_ID:-}"
    WRITE_BRANCH="${INPUT_BRANCH:-${GITHUB_REF_NAME:-}}"
    WRITE_PR="${INPUT_PR_URL:-}"
    WRITE_CI="${INPUT_CI_STATUS:-}"
    WRITE_DEPLOY="${INPUT_DEPLOY:-}"
    DRY_RUN="${INPUT_DRY_RUN:-false}"
    TASK_BRANCH="$WRITE_BRANCH"
    ;;
  *)
    fail_soft "niet-ondersteund event: ${EVENT_NAME}"
    ;;
esac

ROW_ID="$(extract_task_id "$TASK_BRANCH" "$TASK_BODY" "$TASK_ROW_ID" || true)"
if [[ -z "$ROW_ID" ]]; then
  echo "Geen taak-id gevonden (branch='${TASK_BRANCH}', expliciet='${TASK_ROW_ID}'). Skip; exit 0."
  exit 0
fi
echo "Taak-/rij-id: ${ROW_ID} (tabel ${NEXTCLOUD_TAKEN_TABLE_ID})"

nc_request() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local tmp http_code
  tmp="$(mktemp)"
  local args=(
    --silent --show-error --location
    --user "${NEXTCLOUD_USER}:${NEXTCLOUD_APP_PASSWORD}"
    --header "Accept: application/json"
    --header "OCS-APIRequest: true"
    --header "Content-Type: application/json"
    --request "$method"
    --output "$tmp"
    --write-out "%{http_code}"
  )
  if [[ -n "$data" ]]; then
    args+=(--data-binary "$data")
  fi
  http_code="$(curl "${args[@]}" "$url")" || true
  printf '%s\t%s\n' "$http_code" "$tmp"
}

read_http_and_file() {
  local packed="$1"
  HTTP_CODE="${packed%%$'\t'*}"
  BODY_FILE="${packed#*$'\t'}"
}

payload="$(
  jq -n \
    --arg c21 "$COL_BRANCH" --arg v21 "$WRITE_BRANCH" \
    --arg c22 "$COL_PR" --arg v22 "$WRITE_PR" \
    --arg c23 "$COL_CI" --arg v23 "$WRITE_CI" \
    --arg c24 "$COL_DEPLOY" --arg v24 "$WRITE_DEPLOY" \
    --arg c27 "$COL_UPDATED" --arg v27 "$WRITE_UPDATED" \
    '{data: {}}
     | if $v21 != "" then .data[$c21] = $v21 else . end
     | if $v22 != "" then .data[$c22] = $v22 else . end
     | if $v23 != "" then .data[$c23] = $v23 else . end
     | if $v24 != "" then .data[$c24] = $v24 else . end
     | .data[$c27] = $v27'
)"

echo "Payload (geen secrets): $(jq -c . <<<"$payload")"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "dry-run: geen Nextcloud-schrijfactie."
  exit 0
fi

if [[ -z "${NEXTCLOUD_USER:-}" || -z "${NEXTCLOUD_APP_PASSWORD:-}" ]]; then
  fail_soft "secrets NEXTCLOUD_USER / NEXTCLOUD_APP_PASSWORD ontbreken"
fi

get_url="${NEXTCLOUD_URL}/index.php/apps/tables/api/1/rows/${ROW_ID}"
packed="$(nc_request GET "$get_url")"
read_http_and_file "$packed"
if [[ "$HTTP_CODE" != "200" ]]; then
  snippet="$(head -c 300 "$BODY_FILE" | tr '\n' ' ')"
  rm -f "$BODY_FILE"
  fail_soft "GET rij ${ROW_ID} gaf HTTP ${HTTP_CODE}: ${snippet}"
fi

table_id_got="$(jq -r '.tableId // empty' "$BODY_FILE")"
row_id_got="$(jq -r '.id // empty' "$BODY_FILE")"
rm -f "$BODY_FILE"
if [[ "$row_id_got" != "$ROW_ID" ]]; then
  fail_soft "GET rij ${ROW_ID} gaf onverwacht id '${row_id_got}'"
fi
if [[ -n "$table_id_got" && "$table_id_got" != "$NEXTCLOUD_TAKEN_TABLE_ID" ]]; then
  fail_soft "rij ${ROW_ID} hoort bij tabel ${table_id_got}, niet ${NEXTCLOUD_TAKEN_TABLE_ID}"
fi

put_url="${NEXTCLOUD_URL}/ocs/v2.php/apps/tables/api/2/tables/${NEXTCLOUD_TAKEN_TABLE_ID}/rows/${ROW_ID}"
packed="$(nc_request PUT "$put_url" "$payload")"
read_http_and_file "$packed"
if [[ "$HTTP_CODE" != "200" ]]; then
  snippet="$(head -c 300 "$BODY_FILE" | tr '\n' ' ')"
  rm -f "$BODY_FILE"
  fail_soft "PUT rij ${ROW_ID} gaf HTTP ${HTTP_CODE}: ${snippet}"
fi

statuscode="$(jq -r '.ocs.meta.statuscode // empty' "$BODY_FILE")"
rm -f "$BODY_FILE"
if [[ -n "$statuscode" && "$statuscode" != "200" && "$statuscode" != "100" ]]; then
  fail_soft "PUT rij ${ROW_ID} OCS statuscode ${statuscode}"
fi

echo "Nextcloud Taken rij ${ROW_ID} bijgewerkt."
exit 0
