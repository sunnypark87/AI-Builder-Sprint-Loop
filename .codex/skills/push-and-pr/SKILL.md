---
name: push-and-pr
description: Compare the current branch with its issue, read the repository PR template and Git convention, push the selected branch, and create a Korean pull request targeting main. Use when committed implementation work is ready to publish for review.
---

# Push and Pull Request

## Purpose

Publish the current committed branch and create a pull request to `main` using the repository's conventions and PR template.

## Repository inputs

Read these files before preparing the pull request:

- `AGENTS.md`
- `docs/git-conventions.md`, when it exists
- `docs/testing-strategy.md`
- `.github/pull_request_template.md`
- The related `docs/issue_plan/ISSUE-{number}-*.md`

Use Korean for the generated plan comparison and PR body unless the repository convention specifies another language.

## Workflow

1. Resolve the current repository, remote, current branch, and `main` base branch.
2. Stop if the current branch is `main` or if the remote repository is ambiguous.
3. Confirm that the working tree has no uncommitted changes and that the branch has at least one commit not present on `main`.
4. Resolve the related issue from the branch name, commit messages, plan document, or user input. Ask if the relationship is ambiguous.
5. Read the issue, its acceptance criteria, and its implementation plan.
6. Compare the actual diff and commit list with the issue scope. Report missing, out-of-scope, and unverified items before publishing.
7. Require a current `verify-change` `PASS` result in the Issue plan. Confirm that it maps acceptance criteria to tests, covers the commits being published, and has no blocking or critical AI safety finding. Re-run verification if code changed afterward.
8. Run the required validation command from `AGENTS.md`, normally `npm run check` for this repository.
9. Read `.github/pull_request_template.md` and fill every applicable section: issue link, change type, implementation, acceptance criteria, validation, AI quality evidence, environment, impact, references, and limitations.
10. Read `docs/git-conventions.md` and derive the PR title, source branch, and ready-for-review state. Require `main` as the base branch, use Korean for the PR title subject and body, and create a normal PR only after all required checks pass. Ask before proceeding if the convention is missing or ambiguous.
11. Show the exact repository, source branch, base branch, and PR title. Require confirmation before remote writes.
12. Push the current branch to its configured remote.
13. Create a normal pull request with `main` as the base branch. Prefer the GitHub app; use `gh` only for connector gaps.
14. Re-fetch the created PR and verify its source branch, base branch, title, body, linked issue, and Ready for review state.
15. Report the PR URL, checks status, and remaining follow-up work.

## Default behavior

- Create a normal Ready for review PR after all required checks pass.
- Never push or create a PR from a dirty working tree.
- Never publish without current verification evidence for the exact code being pushed.
- Do not force-push.
- Do not close the issue or merge the PR.
