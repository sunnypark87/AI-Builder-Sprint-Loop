---
name: atomic-commit
description: Review local changes, let the user select exact files or logical groups, validate the selected staged diff, and create convention-compliant atomic commits. Use when implementation is complete and the user asks to commit selected changes.
---

# Atomic Commit

## Purpose

Create one or more focused commits from the current working tree while preserving unselected changes. File selection is explicit and user-controlled.

## Repository inputs

Read these files before creating a commit:

- `AGENTS.md`
- `docs/git-conventions.md`, when it exists
- `docs/testing-strategy.md`
- The current issue plan under `docs/issue_plan/`

Use the repository's documented validation command, normally `npm run check` for this project.

## Workflow

1. Resolve the current repository and branch.
2. Run `git status --short`, `git diff`, and `git diff --cached`.
3. Separate pre-existing staged changes from unstaged changes. Never unstage or overwrite them automatically.
4. Group changed files by logical purpose and show the user every candidate path, status, and suggested group.
5. Ask the user to select exact paths or groups. Accept explicit path lists, group names, or `all`; never infer `all` from silence.
6. Check selected paths for secrets, generated artifacts, unrelated work, and files outside the intended issue scope.
7. Stage only the selected paths with path-limited commands such as `git add -- <selected-paths>`. Never use `git add .` or `git add -A`.
8. Show the staged name-status and diff summary. If pre-existing staged entries exist, keep them staged but exclude them from the selected commit by using `git commit --only -- <selected-paths>` after the selected paths are validated. Ask for confirmation before committing.
9. Read `docs/git-conventions.md` and generate the commit message from its rules. Validate the type, optional scope, Korean subject/body, subject punctuation, and header length. Do not add `Closes`, `Fixes`, or `Resolves` Issue footers to commits; those belong in the PR body. If the convention file is missing or ambiguous, ask before committing.
10. Run `verify-change` against the final selected change, or verify that its latest evidence covers the unchanged selected diff. Require a `PASS` result and no blocking findings.
11. Run the required repository validation against the selected change. Stop on a failed check, missing required test, secret exposure, or safety blocker; do not bypass these failures on request.
12. Create the commit with the selected paths only. Use a normal `git commit` only when the index contains no pre-existing staged entries; otherwise use `git commit --only -- <selected-paths>` and verify that the resulting commit contains no unselected path.
13. Verify the commit with `git show --stat --oneline HEAD` and report remaining unstaged or untracked changes.

## Atomicity rules

- One commit must represent one logical intent.
- Keep feature code, tests, documentation, templates, and dependency changes separate when they serve distinct purposes.
- If a selected group contains unrelated changes, propose multiple commits instead of silently combining them.
- Include tests with the implementation when they are inseparable from the same behavior.
- Keep unrelated user changes untouched and clearly report them.

## Safety rules

- Never stage `.env`, credentials, tokens, private keys, or likely secrets.
- Never amend, reset, rebase, or rewrite existing commits unless explicitly requested.
- Never commit without showing the final staged scope.
- Never rely on path-limited `git add` alone to isolate a commit when the index already contains unselected staged entries.
- Never commit changes that differ materially from the latest `verify-change` evidence without re-verifying them.
- Do not push or open a pull request; those are handled by `push-and-pr`.
