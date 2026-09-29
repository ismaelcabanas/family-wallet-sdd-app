---
description: "Push feature branch and create pull request to main"
---

# Create Pull Request

Pushes the current feature branch to `origin` and opens a GitHub pull request against `main`. Invoked as an `after_implement` hook, after the git auto-commit hook has committed the implementation.

## Behavior

1. Runs `.specify/extensions/pr/scripts/bash/create-pr.sh`
2. The script is idempotent and degrades gracefully:
   - Not on a `feature/*` branch → skip with a message
   - No `origin` remote or `gh` CLI unavailable → skip with a warning
   - `gh` not authenticated → skip with a warning
   - PR already exists for the branch → print the existing PR URL, do not duplicate
3. On success: prints the new PR URL.

## Pull request content

- **Base**: `main`
- **Title**: `{NNN}: {spec title}` — number from the branch name (`feature/NNN-slug`), title from the `# Feature Specification:` heading of `specs/NNN-slug/spec.md`
- **Body**: the spec's `## Summary` section (if present), plus links to the feature's spec, plan and tasks.
