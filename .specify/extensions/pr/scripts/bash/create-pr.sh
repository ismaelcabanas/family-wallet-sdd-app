#!/usr/bin/env bash
# Push the current feature branch and open a PR to main (after_implement hook).
# Idempotent and graceful: skips with a message when prerequisites are missing.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${REPO_ROOT}" ]]; then
  echo "[specify-pr] Warning: not a git repository; skipping PR creation"
  exit 0
fi
cd "${REPO_ROOT}"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "${BRANCH}" != feature/* ]]; then
  echo "[specify-pr] Branch '${BRANCH}' is not a feature branch; skipping PR creation"
  exit 0
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "[specify-pr] Warning: no 'origin' remote configured; skipping PR creation"
  exit 0
fi

GH_BIN="$(command -v gh || true)"
if [[ -z "${GH_BIN}" ]]; then
  for candidate in /opt/homebrew/bin/gh /usr/local/bin/gh; do
    if [[ -x "${candidate}" ]]; then
      GH_BIN="${candidate}"
      break
    fi
  done
fi
if [[ -z "${GH_BIN}" ]]; then
  echo "[specify-pr] Warning: gh CLI not found; skipping PR creation"
  exit 0
fi

if ! "${GH_BIN}" auth status >/dev/null 2>&1; then
  echo "[specify-pr] Warning: gh CLI not authenticated; skipping PR creation"
  exit 0
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "[specify-pr] Warning: uncommitted changes present; commit before PR creation"
  exit 1
fi

SPEC_NUMBER="${BRANCH#feature/}"
SPEC_NUMBER="${SPEC_NUMBER%%-*}"
SPEC_DIR="${REPO_ROOT}/specs/${SPEC_NUMBER}-*"
SPEC_FILE="$(ls ${SPEC_DIR}/spec.md 2>/dev/null | head -n 1 || true)"

TITLE="${SPEC_NUMBER}: feature ${SPEC_NUMBER}"
SUMMARY=""
LINKS=""
if [[ -n "${SPEC_FILE}" ]]; then
  SPEC_SLUG="$(basename "$(dirname "${SPEC_FILE}")")"
  SPEC_TITLE="$(awk '/^# Feature Specification:/{sub(/^# Feature Specification:[[:space:]]*/, ""); print; exit}' "${SPEC_FILE}")"
  if [[ -n "${SPEC_TITLE}" ]]; then
    TITLE="${SPEC_NUMBER}: ${SPEC_TITLE}"
  fi
  SUMMARY="$(awk '/^## Summary/{flag=1; next} /^## /{flag=0} flag' "${SPEC_FILE}" | sed '/^[[:space:]]*$/d')"
  if [[ -z "${SUMMARY}" ]]; then
    PLAN_FILE="${REPO_ROOT}/specs/${SPEC_SLUG}/plan.md"
    if [[ -f "${PLAN_FILE}" ]]; then
      SUMMARY="$(awk '/^## Summary/{flag=1; next} /^## /{flag=0} flag' "${PLAN_FILE}" | sed '/^[[:space:]]*$/d')"
    fi
  fi
  LINKS="- Especificación: \`specs/${SPEC_SLUG}/spec.md\`
- Plan: \`specs/${SPEC_SLUG}/plan.md\`
- Tareas: \`specs/${SPEC_SLUG}/tasks.md\`"
fi

BODY="## Resumen

${SUMMARY:-Implementación de la feature ${SPEC_NUMBER} según el flujo Spec Kit.}

## Artefactos

${LINKS}

Generado automáticamente por el hook \`after_implement\` (\`.specify/extensions/pr/\`)."

git push -u origin "${BRANCH}"

EXISTING_PR_URL="$("${GH_BIN}" pr view "${BRANCH}" --json url --jq '.url' 2>/dev/null || true)"
if [[ -n "${EXISTING_PR_URL}" ]]; then
  echo "[specify-pr] Pull request already exists: ${EXISTING_PR_URL}"
  exit 0
fi

"${GH_BIN}" pr create \
  --base main \
  --head "${BRANCH}" \
  --title "${TITLE}" \
  --body "${BODY}" \
  --assignee "@me"
