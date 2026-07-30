# AI Builder Sprint Working Guidelines

## Project Overview

This repository is the starting point for an AI Builder Sprint 2026 hackathon project. The goal is to build a practical service that uses AI to bring out more of what makes us human.

The repository currently contains a starter Next.js web application. Keep this document's structure and commands up to date as features are developed.

## Current Structure

```text
.
├── AGENTS.md
├── docs/
│   ├── design-system.md
│   ├── git-conventions.md
│   ├── issue_plan/
│   └── testing-strategy.md
├── README.md
├── package.json
├── public/
└── src/
    ├── app/          # App Router pages, public/donor/partner layouts, and API routes
    ├── components/
    │   ├── layout/   # Public/donor headers and the partner management app shell
    │   └── ui/       # Shared UI for buttons, inputs, cards, dialogs, steps, statuses, and notices
    └── lib/          # Shared utilities and navigation configuration
```

When application code is added, document the responsibilities of major directories and their run instructions here as well.

## Documentation Guide

Use the documents in `docs/` according to the guide below. Update this list whenever a document is added or an existing document's responsibility changes.

| Document                                               | When to reference it                                                                                                                |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| [`docs/design-system.md`](docs/design-system.md)       | When designing or implementing screens or deciding on shared components, color/type/spacing tokens, accessibility, or AI output UI. |
| [`docs/git-conventions.md`](docs/git-conventions.md)   | When creating branches, writing commit messages, or performing push, PR, and merge workflows.                                       |
| [`docs/testing-strategy.md`](docs/testing-strategy.md) | When defining test scope, writing unit/integration/E2E tests, or validating AI accuracy, safety, and acceptance criteria.           |
| `docs/issue_plan/`                                     | When writing a new Issue implementation plan or reviewing an Issue's scope, acceptance criteria, and verification results.          |

## Routing Structure

The routes below reflect the App Router structure in `src/app`. `[organizationId]` is a dynamic segment that receives an organization identifier, and `demo` routes currently use mock data to present detailed flows.

### Public and Donor Screens

| Route                                   | Page responsibility                                                      |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `/`                                     | Home page introducing the service and featured organizations             |
| `/organizations`                        | Organization directory browsable by type and criteria                    |
| `/organizations/[organizationId]`       | Organization details and analysis results                                |
| `/donate/[organizationId]/consultation` | AI consultation for donation purpose, amount, and terms                  |
| `/donate/[organizationId]/summary`      | Review of pledge terms generated from the consultation                   |
| `/pledges/demo/review`                  | Review of the generated donation pledge                                  |
| `/pledges/demo/sign`                    | Pledge consent and donor signature                                       |
| `/pledges/demo/waiting`                 | Organization-signature waiting status                                    |
| `/donations/demo/payment`               | Donation amount and payment method confirmation                          |
| `/donations/demo/payment/result`        | Payment completion result and next-step guidance                         |
| `/donations/demo`                       | Donation fulfillment details, including plans, expenditures, and reports |
| `/my-donations`                         | Donor's donation list and progress                                       |
| `/notifications`                        | Notifications related to pledges, payments, and expenditures             |
| `/account`                              | Demo account page for entering donor or organization experiences         |

### Organization Registration Screens

| Route                               | Page responsibility                                                  |
| ----------------------------------- | -------------------------------------------------------------------- |
| `/partner/register`                 | Registration step 1: enter organization and verification information |
| `/partner/register/pledge-template` | Registration step 2: create an organization-specific pledge template |

### Organization Management Screens

| Route                               | Page responsibility                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| `/partner`                          | Dashboard summarizing work from pledges through reporting                               |
| `/partner/profile`                  | Manage the public organization profile and verification materials                       |
| `/partner/pledges`                  | Manage pledge lists and signature tasks by status                                       |
| `/partner/pledges/demo`             | Review donor-signed pledge terms and add the organization signature                     |
| `/partner/donations`                | Manage donation agreements and fulfillment statuses                                     |
| `/partner/donations/demo`           | Review an individual donation's pledge, payment, plan, expenditure, and report progress |
| `/partner/plans`                    | Manage expenditure plans and AI review statuses                                         |
| `/partner/plans/demo/review`        | Compare and review the source plan against AI extraction before publishing              |
| `/partner/executions`               | Manage expenditure evidence and analysis/redaction statuses                             |
| `/partner/executions/demo/review`   | Review source evidence, AI extraction, and personal-data redaction before publishing    |
| `/partner/reports`                  | Manage completion reports and AI draft review statuses                                  |
| `/partner/reports/demo/review`      | Compare and review expenditure evidence against an AI report draft before publishing    |
| `/partner/settings/pledge-template` | Configure organization-specific terms in the standard pledge                            |
| `/partner/settings/members`         | Manage members and task-specific permissions                                            |
| `/partner/settings/notifications`   | Configure notifications for pledges, AI analysis, and reports                           |

### API

| Route             | Responsibility           |
| ----------------- | ------------------------ |
| `GET /api/health` | Check application health |

## Technology Stack

- Application type: web application
- Language and framework: Next.js App Router + TypeScript
- Styling: Tailwind CSS
- Shared components: shadcn/ui source components + Radix UI primitives
- Runtime: Node.js 20.19+ in the 20 line, 22.13+ in the 22 line, or 24.0+
- Package manager: npm
- Default development server port: 3000
- AI API: call the Upstage API from server-side code

## Installation and Development

Install dependencies, then start the development server.

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in a browser.

## Verification Commands

Run the formatter, linter, type checker, test runner, and build through `package.json` scripts.

```bash
npm run format        # Apply Prettier formatting
npm run format:check  # Check formatting
npm run lint          # ESLint
npm run typecheck     # TypeScript type checking
npm run test          # Vitest unit tests
npm run build         # Next.js production build
npm run check         # Run format:check, lint, typecheck, test, and build
```

`check` must remain a single repeatable entry point for formatting checks, linting, type checking, tests, and builds. Mock external integrations so static verification and unit tests can run without external API keys.

## Coding Rules

- Keep changes within the minimum scope required by the Issue.
- Review and preserve existing user changes.
- Add as few new dependencies as possible, after considering the reason and alternatives.
- AI APIs and secrets that do not require direct browser access must be used only in Server Components or Route Handlers.
- Add appropriate tests or reproducible verification steps for behavior changes.
- Keep commands documented here executable.

## Verification and Definition of Done

- Before committing, use `verify-change` to trace the implementation and tests to the Issue acceptance criteria.
- Follow [`docs/testing-strategy.md`](docs/testing-strategy.md) for test standards and AI accuracy and safety coverage.
- When AI behavior changes, verify representative accuracy cases and relevant safety cases, then record the results in the Issue plan.
- Missing acceptance criteria, required test failures, secret exposure, and severe AI safety problems are blockers.
- Work is complete only when both `npm run check` and `verify-change` pass with no blockers.

## Git and PR Workflow

1. Confirm the Issue, scope, and acceptance criteria.
2. Update `main` and create a branch appropriate to the Issue type, following [`docs/git-conventions.md`](docs/git-conventions.md).
3. Review relevant files and existing changes first.
4. Implement the change and add tests for the changed behavior.
5. Run `verify-change` and `npm run check` according to the `Verification and Definition of Done` section above.
6. Record verification results in the Issue plan, select the changed files, and create an atomic commit.
7. Follow the Conventional Commits rules in `docs/git-conventions.md`. Do not add an Issue-closing footer to the commit.
8. After all verification passes, push the current branch and open a regular PR targeting `main`.
9. Document the PR and work results according to the `Completion Report` section below.
10. Do not report the work as complete before verification finishes.

Use [`docs/git-conventions.md`](docs/git-conventions.md) as the source of truth for branch, commit, and PR details.

## GitHub and Codex Usage

The following GitHub capabilities are available in the current environment.

- `github:github`: repository, Issue, and PR lookup and summaries
- `github:gh-address-comments`: inspect and address PR review feedback
- `github:gh-fix-ci`: analyze and fix GitHub Actions failures
- `github:yeet`: commit changes, push, and create a PR

Before any GitHub write operation, reconfirm the repository, target branch, and Issue or PR number. If these skills are unavailable, use equivalent GitHub CLI or web procedures without exposing authentication tokens in source code or logs.

Check the GitHub integration as follows.

1. Run `gh auth status` to check authentication, and use `git remote -v` to confirm the target repository is `sunnypark87/AI-Builder-Sprint-Loop`.
2. Use `gh issue view <number>` and `gh pr view <number>` to inspect Issues and PRs.
3. For review work, inspect `gh pr view <number> --comments` and unresolved review threads, then modify only the selected feedback and reverify.
4. For CI failures, identify the failed check with `gh pr checks <number>` and inspect the cause with `gh run view <run-id> --log-failed`.

If there are no review comments or CI failures, confirm that no target exists with the commands above and reproduce the same process when one appears on an actual PR. Follow the `Git and PR Workflow` above for pushes and PR creation. If GitHub authentication or network access is unavailable, complete only local implementation and verification and report remote write operations as unverified.

## Environment Variables and Secrets

- Do not commit real environment files. Commit only `.env.example`.
- In `.env.example`, document only variable names, whether they are required, and their purpose.
- Prevent API keys from appearing in logs, error messages, or screenshots.
- If a key is exposed, revoke and reissue it immediately.
- Use mocks in tests wherever possible so they run without real secrets.

## Completion Report

When work is finished, include the following in the PR or work report.

- Changed files and key changes
- Verification commands run and their results
- Verification not run and the reason
- Impact on environment variables, migrations, and deployment
- Remaining work and known limitations
