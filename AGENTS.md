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
├── supabase/
│   └── migrations/ # Database, RLS, RPC, and private Storage schema changes
└── src/
    ├── app/          # App Router pages, public/donor/partner layouts, and API routes
    │   ├── api/health/supabase/ # Supabase Auth connectivity health check
    │   └── dev/auth-test/       # Development-only Auth smoke-test page
    ├── components/
    │   ├── layout/   # Public/donor headers and the partner management app shell
    │   ├── auth/     # Email login/signup forms and authentication feedback
    │   └── ui/       # Shared UI for buttons, inputs, cards, dialogs, steps, statuses, and notices
    └── lib/
        ├── executions/ # Receipt parsing, deterministic verification, persistence, and registration flow
        ├── supabase/ # Browser/server clients, session refresh, and Auth helpers
        └── ...       # Shared utilities and navigation configuration
```

When application code is added, document the responsibilities of major directories and their run instructions here as well.

## Documentation Guide

Use the documents in `docs/` according to the guide below. Update this list whenever a document is added or an existing document's responsibility changes.

| Document                                                                       | When to reference it                                                                                                                |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| [`docs/design-system.md`](docs/design-system.md)                               | When designing or implementing screens or deciding on shared components, color/type/spacing tokens, accessibility, or AI output UI. |
| [`docs/git-conventions.md`](docs/git-conventions.md)                           | When creating branches, writing commit messages, or performing push, PR, and merge workflows.                                       |
| [`docs/testing-strategy.md`](docs/testing-strategy.md)                         | When defining test scope, writing unit/integration/E2E tests, or validating AI accuracy, safety, and acceptance criteria.           |
| [`docs/rls-verification.md`](docs/rls-verification.md)                         | When running the Supabase Auth/RLS verification script and role matrix.                                                             |
| [`docs/modusign-manual-verification.md`](docs/modusign-manual-verification.md) | When manually verifying donor-to-organization Modusign signing.                                                                     |
| [`docs/vercel-webhook-verification.md`](docs/vercel-webhook-verification.md)   | When verifying the deployed Modusign Webhook and fallback sync.                                                                     |
| `docs/issue_plan/`                                                             | When writing a new Issue implementation plan or reviewing an Issue's scope, acceptance criteria, and verification results.          |

## Routing Structure

The routes below reflect the App Router structure in `src/app`. `[organizationId]` is a dynamic segment that receives an organization identifier, and `demo` routes currently use mock data to present detailed flows.

### Public and Donor Screens

| Route                                   | Page responsibility                                                      |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `/`                                     | Home page introducing the service and featured organizations             |
| `/organizations`                        | Organization directory browsable by type and criteria                    |
| `/organizations/[organizationId]`       | Organization details and analysis results                                |
| `/donate/[organizationId]/consultation` | AI consultation for donation purpose, amount, and terms                  |
| `/donate/[organizationId]/summary`      | Legacy redirect to consultation; no separate summary screen              |
| `/pledges/[pledgeId]/review`            | Review and edit the saved pledge document before signing                 |
| `/pledges/[pledgeId]/sign`              | Donor's embedded Modusign signing screen                                 |
| `/pledges/[pledgeId]/waiting`           | Organization-signature waiting and signed-state guidance                 |
| `/donations/demo/payment`               | Donation amount and payment method confirmation                          |
| `/donations/demo/payment/result`        | Payment completion result and next-step guidance                         |
| `/donations/[pledgeId]/payment`         | Stored demo payment selection for a signed pledge                        |
| `/donations/[pledgeId]/payment/result`  | Persisted demo payment result and next-step guidance                     |
| `/donations/demo`                       | Donation fulfillment details, including plans, expenditures, and reports |
| `/my-donations`                         | Donor's donation list and progress                                       |
| `/my-donations/[pledgeId]`              | Donor's saved pledge, signing, and demo payment detail                   |
| `/notifications`                        | Notifications related to pledges, payments, and expenditures             |
| `/account`                              | Demo account page for entering donor or organization experiences         |
| `/login`                                | Email login and protected-route return flow                              |
| `/signup`                               | Email account registration and email-confirmation guidance               |

### Organization Registration Screens

| Route                               | Page responsibility                                                  |
| ----------------------------------- | -------------------------------------------------------------------- |
| `/partner/register`                 | Registration step 1: enter organization and verification information |
| `/partner/register/pledge-template` | Registration step 2: create an organization-specific pledge template |

### Organization Management Screens

| Route                                      | Page responsibility                                                                     |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `/partner`                                 | Dashboard summarizing work from pledges through reporting                               |
| `/partner/profile`                         | Manage the public organization profile and verification materials                       |
| `/partner/pledges`                         | Manage pledge lists and signature tasks by status                                       |
| `/partner/pledges/[pledgeId]`              | Review donor-signed pledge terms and add the organization signature                     |
| `/partner/pledges/demo`                    | Demo pledge review and organization-signature flow                                      |
| `/partner/donations`                       | Manage donation agreements and fulfillment statuses                                     |
| `/partner/donations/demo`                  | Review an individual donation's pledge, payment, plan, expenditure, and report progress |
| `/partner/plans`                           | Manage expenditure plans and AI review statuses                                         |
| `/partner/plans/new`                       | Select a donation and enter a plan directly or optionally upload it for OCR analysis    |
| `/partner/plans/[planId]/review`           | Compare OCR extraction with the private source and register reviewed plan data          |
| `/partner/plans/demo/review`               | Compare and review the source plan against AI extraction before publishing              |
| `/partner/executions`                      | Manage expenditure evidence and analysis/redaction statuses                             |
| `/partner/executions/new`                  | Select a registered plan item and upload a private receipt for OCR                      |
| `/partner/executions/[executionId]/review` | Review receipt OCR fields and verification evidence before internal registration        |
| `/partner/executions/demo/review`          | Review source evidence, AI extraction, and personal-data redaction before publishing    |
| `/partner/reports`                         | Manage completion reports and AI draft review statuses                                  |
| `/partner/reports/demo/review`             | Compare and review expenditure evidence against an AI report draft before publishing    |
| `/partner/settings/pledge-template`        | Configure organization-specific terms in the standard pledge                            |
| `/partner/settings/members`                | Manage members and task-specific permissions                                            |
| `/partner/settings/notifications`          | Configure notifications for pledges, AI analysis, and reports                           |

### API

| Route                                                     | Responsibility                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| `GET /api/health`                                         | Check application health                                           |
| `POST /api/partner/plans/upload-url`                      | Authorize and prepare a signed direct upload to private Storage    |
| `DELETE /api/partner/plans/upload-url`                    | Remove the user's abandoned pending source upload                  |
| `POST /api/partner/plans`                                 | Register a validated manual plan or analyze an optional source     |
| `GET /api/partner/plans/[planId]`                         | Read an authorized review draft and short-lived source URL         |
| `PATCH /api/partner/plans/[planId]`                       | Validate and transactionally register a reviewed expenditure plan  |
| `POST /api/partner/plans/[planId]`                        | Retry OCR for a failed plan from its privately stored source       |
| `POST /api/partner/executions/upload-url`                 | Authorize a signed direct upload to private receipt Storage        |
| `DELETE /api/partner/executions/upload-url`               | Remove an abandoned pending receipt upload                         |
| `POST /api/partner/executions`                            | Validate a receipt, run Upstage OCR and save verification evidence |
| `GET /api/partner/executions/[executionId]`               | Read an authorized receipt review draft and short-lived source URL |
| `PATCH /api/partner/executions/[executionId]`             | Revalidate and transactionally register an expenditure record      |
| `POST /api/partner/executions/[executionId]`              | Retry OCR for a failed receipt analysis                            |
| `GET /api/pledges/[pledgeId]/chat`                        | Read the donor's stored AI consultation history                    |
| `POST /api/pledges/[pledgeId]/chat`                       | Store an idempotent donor message and run AI consultation          |
| `GET /api/organizations/[organizationId]/impact-summary`  | Read source-grounded organization impact summaries                 |
| `POST /api/organizations/[organizationId]/impact-summary` | Not supported; summaries use seeded approved data                  |
| `GET /api/partner/executions/[executionId]`               | Read an authorized receipt review draft and short-lived source URL |
| `PATCH /api/partner/executions/[executionId]`             | Revalidate and transactionally register an expenditure record      |
| `POST /api/partner/executions/[executionId]`              | Retry OCR for a failed receipt analysis                            |
| `POST /api/partner/executions/upload-url`                 | Authorize a signed direct upload to private receipt Storage        |
| `DELETE /api/partner/executions/upload-url`               | Remove an abandoned pending receipt upload                         |
| `POST /api/partner/executions`                            | Validate a receipt, run Upstage OCR and save verification data     |
| `POST /api/partner/plans/upload-url`                      | Authorize and prepare a signed direct upload to private Storage    |
| `DELETE /api/partner/plans/upload-url`                    | Remove the user's abandoned pending source upload                  |
| `POST /api/partner/plans`                                 | Register a validated plan or analyze an optional source            |
| `GET /api/partner/plans/[planId]`                         | Read an authorized review draft and short-lived source URL         |
| `PATCH /api/partner/plans/[planId]`                       | Validate and transactionally register a reviewed expenditure plan  |
| `POST /api/partner/plans/[planId]`                        | Retry OCR for a failed plan from its privately stored source       |

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
npm run test:e2e      # Mocked browser regression tests
npm run test:e2e:plans # Local Supabase plan flow; requires `npx supabase start`
npm run test:e2e:executions # Local Supabase receipt execution flow
npm run test:ai:ocr   # Live representative OCR evaluation; requires Upstage key
npm run test:ai:receipt-ocr # Live receipt OCR evaluation; requires Upstage key
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

## Supabase, Auth, and Database Rules

### Environment Variables

- Browser-exposed variables are `NEXT_PUBLIC_SUPABASE_URL` and either
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or the legacy
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Use the `NEXT_PUBLIC_*` names documented in `.env.example` for local setup.
  Server-only Vercel aliases remain compatibility fallbacks and should not be
  declared alongside the canonical variables.
- Never expose `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, database
  passwords, or other server secrets to the browser, logs, or Git.
- Store real values only in `.env` or `.env.local`; document names only in
  `.env.example`. Restart the development server after changing variables.

### Supabase Clients and Auth

- Client Components use `src/lib/supabase/client.ts`.
- Server Components, Route Handlers, and Server Actions use
  `src/lib/supabase/server.ts`.
- Next.js 16 session refresh and cookie synchronization belong in the root
  `proxy.ts` and `src/lib/supabase/proxy.ts`.
- Do not authorize users from the user object returned by `getSession()`.
  Use server-validated `getUser()` or claims for authorization decisions.
- Never return or log tokens, passwords, raw sessions, or internal Auth errors.

### Database Usage

- Access Supabase data through the shared Supabase clients and handle query
  errors explicitly.
- Design Row Level Security (RLS) with every new table; user-owned data must be
  restricted using `auth.uid()`.
- Use service-role keys only in dedicated server-side administrative code.
- Manage schema changes through migrations, not manual production edits.
- Do not add public tables or weakened RLS policies before the domain schema and
  access rules are explicitly defined.

### Testing and Deployment

- Mock Supabase SDK calls and network requests in automated tests.
- Cover missing environment variables, anonymous and authenticated states,
  expired sessions, cookie refresh, logout, upstream failures, and sensitive
  information non-disclosure.
- Run `npm run check` after Supabase/Auth changes.
- Verify environment variables, Auth Redirect URLs, login, session persistence,
  and logout separately in local, Preview, and Production environments.

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
