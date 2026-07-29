---
name: verify-change
description: Audit an issue implementation against its acceptance criteria, verify meaningful tests and repository checks, evaluate AI accuracy and safety when applicable, and record Korean evidence. Use after implementation and before committing or opening a pull request.
---

# Verify Change

## Purpose

Act as the pre-commit quality gate. Prove that the current change satisfies the related Issue, has meaningful tests, passes repository validation, and does not introduce unresolved AI safety risks.

By default, audit and report only. Do not modify implementation or tests unless the user explicitly asks for fixes.

## Repository inputs

Read these sources before evaluating the change:

- `AGENTS.md`
- `docs/testing-strategy.md`
- The related GitHub Issue and its acceptance criteria
- The related `docs/issue_plan/ISSUE-{number}-*.md`
- `git status`, staged and unstaged diffs, untracked files, and the diff from `main`

If the Issue or plan cannot be identified reliably, stop and ask for it.

## Workflow

1. Resolve the current branch, related Issue, implementation plan, and complete change scope. Preserve unrelated user changes.
2. Map every Issue acceptance criterion to concrete implementation files and test or verification evidence. Treat an unmapped criterion as blocking.
3. Inspect tests for behavior rather than implementation details. Require the applicable normal, error, boundary, and regression cases described in `docs/testing-strategy.md`.
4. Confirm that external services are mocked in automated tests, fixtures contain no secrets or personal data, assertions are meaningful, and required tests are not skipped.
5. Determine whether the diff changes AI-facing behavior, including prompts, model calls, retrieval, extraction, recommendation, tool use, AI routes, or model-output handling.
6. For AI-facing changes, evaluate representative accuracy cases and relevant safety cases. Check structured-output validation, grounding or uncertainty handling, prompt injection, sensitive-data exposure, unsafe output, excessive agency, unauthorized actions, and external API failures as applicable.
7. Run focused tests for the changed behavior first. Then run the repository quality gate, normally `npm run check`, which must include formatting, linting, type checking, tests, and a production build.
8. Classify every finding as `blocking`, `non-blocking`, or `unverified`. A missing required test, failed required command, unmet acceptance criterion, secret exposure, or critical AI safety failure is blocking.
9. Write the verification report in Korean. Include the criterion-to-code-to-test mapping, command results, AI applicability and results, issues found or prevented by AI, limitations, and the final verdict.
10. Update the related Issue plan's execution-results section with only observed commands and evidence. Never invent a passing result.

## Verdict rules

Return `PASS` only when all of these are true:

- Every acceptance criterion is implemented and mapped to evidence.
- Required tests exist and pass.
- `npm run check` passes.
- No blocking security, privacy, or AI safety issue remains.
- Any unverified area is explicitly documented and is non-blocking.

Otherwise return `FAIL` and list the minimum work required to pass. Do not commit, push, open a pull request, or weaken checks.

## Korean report format

Use these headings:

1. `검증 판정`
2. `완료 조건 추적표`
3. `소프트웨어 품질 검증`
4. `AI 정확성 및 안전성 검증`
5. `AI가 발견하거나 예방한 품질 문제`
6. `차단 항목과 미검증 범위`
7. `실행한 명령과 결과`

Mark AI verification as `해당 없음` only after checking the actual diff.
