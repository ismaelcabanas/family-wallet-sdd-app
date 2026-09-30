#!/usr/bin/env bash
# Finish a Spec Kit feature: merge its PR (rebase), delete local and remote
# branches, and deactivate the active feature pointer.
set -euo pipefail

MERGE_FLAG="--rebase"
ROADMAP_SPEC="specs/001-family-wallet/spec.md"

log()  { printf '[specify-finish] %s\n' "$*"; }
warn() { printf '[specify-finish] Warning: %s\n' "$*" >&2; }
die()  { printf '[specify-finish] Error: %s\n' "$*" >&2; exit 1; }

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "${REPO_ROOT}" ]] || die "not a git repository; nothing to finish"
cd "${REPO_ROOT}"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[[ "${BRANCH}" == feature/* ]] || die "branch '${BRANCH}' is not a feature branch; run /speckit.finish from feature/NNN-<slug>"

[[ -z "$(git status --porcelain)" ]] || die "uncommitted changes present; commit or stash before finishing"

git remote get-url origin >/dev/null 2>&1 || die "no 'origin' remote configured"

GH_BIN="$(command -v gh || true)"
if [[ -z "${GH_BIN}" ]]; then
  for candidate in /opt/homebrew/bin/gh /usr/local/bin/gh; do
    if [[ -x "${candidate}" ]]; then
      GH_BIN="${candidate}"
      break
    fi
  done
fi
[[ -n "${GH_BIN}" ]] || die "gh CLI not found"
"${GH_BIN}" auth status >/dev/null 2>&1 || die "gh CLI not authenticated"

SPEC_NUMBER="${BRANCH#feature/}"
SPEC_NUMBER="${SPEC_NUMBER%%-*}"
SPEC_DIR="$(ls -d specs/${SPEC_NUMBER}-* 2>/dev/null | head -n 1 || true)"
[[ -n "${SPEC_DIR}" ]] || die "no specs/${SPEC_NUMBER}-* directory found for branch '${BRANCH}'"
SPEC_NAME="$(basename "${SPEC_DIR}")"

UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name @{upstream} 2>/dev/null || true)"
[[ -n "${UPSTREAM}" ]] || die "branch '${BRANCH}' has no upstream; push it first (git push -u origin ${BRANCH})"
AHEAD="$(git rev-list --count "${UPSTREAM}..HEAD")"
[[ "${AHEAD}" -eq 0 ]] || die "branch '${BRANCH}' has ${AHEAD} unpushed commit(s); push before finishing"

if [[ -f "${ROADMAP_SPEC}" ]]; then
  ROADMAP_ROW="$(grep -E "^\|[[:space:]]*\`?${SPEC_NAME}" "${ROADMAP_SPEC}" | head -n 1 || true)"
  if [[ -n "${ROADMAP_ROW}" ]]; then
    echo "${ROADMAP_ROW}" | grep -q '| Completada |' \
      || die "roadmap row for ${SPEC_NAME} is not marked 'Completada' in ${ROADMAP_SPEC}; update it in the feature branch before merging"
  else
    warn "no roadmap row for ${SPEC_NAME} in ${ROADMAP_SPEC}; skipping roadmap check"
  fi
else
  warn "roadmap spec ${ROADMAP_SPEC} not found; skipping roadmap check"
fi

PR_STATE="$("${GH_BIN}" pr view "${BRANCH}" --json state --jq '.state' 2>/dev/null || true)"
[[ -n "${PR_STATE}" ]] || die "no pull request found for branch '${BRANCH}'; run /speckit.implement first (or create the PR with the pr extension)"
[[ "${PR_STATE}" == "OPEN" ]] || die "pull request for '${BRANCH}' is ${PR_STATE}; nothing to finish"
PR_URL="$("${GH_BIN}" pr view "${BRANCH}" --json url --jq '.url')"
BASE_BRANCH="$("${GH_BIN}" pr view "${BRANCH}" --json baseRefName --jq '.baseRefName')"

log "checking CI for ${PR_URL}"
if CHECKS_OUTPUT="$("${GH_BIN}" pr checks "${BRANCH}" 2>&1)"; then
  CHECKS_STATUS=0
else
  CHECKS_STATUS=$?
fi
if [[ "${CHECKS_STATUS}" -ne 0 ]]; then
  if echo "${CHECKS_OUTPUT}" | grep -qi 'no checks'; then
    warn "no CI checks reported for this PR; proceeding anyway"
  else
    printf '%s\n' "${CHECKS_OUTPUT}" >&2
    die "CI checks are not green for ${PR_URL}; fix them (or wait for pending checks) before finishing"
  fi
fi

log "merging ${PR_URL} (rebase) and deleting branches"
"${GH_BIN}" pr merge "${BRANCH}" ${MERGE_FLAG} --delete-branch

git switch "${BASE_BRANCH}" 2>/dev/null || true
git pull --ff-only --quiet
git branch -d "${BRANCH}" 2>/dev/null || warn "local branch '${BRANCH}' could not be deleted"
git push origin --delete "${BRANCH}" >/dev/null 2>&1 || true
git fetch --prune --quiet

FEATURE_JSON="${REPO_ROOT}/.specify/feature.json"
if [[ -f "${FEATURE_JSON}" ]]; then
  ACTIVE_FEATURE="$(grep -E '"feature_directory"[[:space:]]*:' "${FEATURE_JSON}" 2>/dev/null | head -n 1 | sed -E 's/^[^:]*:[[:space:]]*"([^"]*)".*$/\1/' || true)"
  ACTIVE_NAME="$(basename "${ACTIVE_FEATURE:-${SPEC_NAME}}")"
  if [[ "${ACTIVE_NAME}" == "${SPEC_NAME}" ]]; then
    printf '{}\n' > "${FEATURE_JSON}"
    if ! git diff --quiet -- .specify/feature.json; then
      git add .specify/feature.json
      git commit --quiet -m "chore(${SPEC_NUMBER}): desactivar la feature tras el merge"
      git push origin "${BASE_BRANCH}" --quiet
      log ".specify/feature.json cleared and pushed to ${BASE_BRANCH}"
    fi
  else
    warn "active feature is '${ACTIVE_FEATURE:-none}', not '${SPEC_NAME}'; leaving .specify/feature.json untouched"
  fi
fi

log "feature ${SPEC_NAME} finished:"
log "  merged ${PR_URL} (rebase)"
log "  branch '${BRANCH}' deleted (local and remote)"
log "  active feature pointer cleared"
