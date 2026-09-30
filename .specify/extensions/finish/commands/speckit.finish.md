---
description: "Merge the feature PR (rebase), clean up branches, and deactivate the feature"
---

# Finish Feature

Closes the Spec Kit feature cycle: merges the feature's pull request, cleans up
the branches and deactivates the feature pointer. Invoked manually as
`/speckit.finish` once the owner has reviewed the PR created by the `pr`
extension (`after_implement` hook).

## Behavior

1. Runs `.specify/extensions/finish/scripts/bash/finish.sh`
2. The script aborts with a clear error when any guard fails:
   - Not on a `feature/*` branch, or not in a git repository
   - Uncommitted changes in the working tree
   - `gh` CLI unavailable or not authenticated; no `origin` remote
   - No `specs/NNN-*` directory matching the branch number
   - Branch has no upstream or has unpushed commits
   - Roadmap row for the feature (`specs/001-family-wallet/spec.md`) not marked
     `| Completada |` — fix it in the feature branch before merging
   - No open pull request for the branch (create it first with the `pr`
     extension)
   - CI checks failed or pending for the PR (`gh pr checks`; a PR with no
     checks at all proceeds with a warning)
3. On success it:
   - Merges the PR with **rebase** (`gh pr merge --rebase --delete-branch`)
   - Switches to the PR base branch, pulls, and deletes the local and remote
     feature branches (idempotent if GitHub already deleted the remote)
   - Clears `.specify/feature.json` to `{}` when it pointed at the finished
     feature (so the next `/speckit.specify` starts clean) and commits the
     change to the base branch as `chore(NNN): desactivar la feature tras el
     merge`
   - Prints a summary with the merged PR URL

## Graceful Degradation

- If Git is not available or the current directory is not a repository: aborts with a warning
- If `gh` is missing, not authenticated, or there is no `origin` remote: aborts with a warning
- If `.specify/feature.json` points at a different feature: leaves it untouched and warns
- Local/remote branch deletion failures after a successful merge are reported as warnings, not errors
