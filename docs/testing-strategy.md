# Testing and Verification Strategy

## Purpose

This document defines the standards for producing reproducible evidence that an Issue implementation satisfies its acceptance criteria, prevents regressions, and meaningfully improves the accuracy and safety of AI features.

## Core Principles

- Map every acceptance criterion to implementation files and test or verification evidence.
- Verify user-observable behavior rather than implementation details.
- Include a regression test that reproduces the original failure and passes after a bug fix.
- Mock external APIs in automated tests, and never include real secrets or personal data in fixtures.
- For verification that is difficult to automate, record the procedure, expected result, actual result, and limitations.
- Never treat an unverified item as passing.

## Minimum Verification by Change Type

| Change type                 | Minimum verification                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| Documentation only          | Format check and manual verification of links, commands, and content                                |
| Utility or domain logic     | Unit tests for normal, error, and boundary cases                                                    |
| Bug fix                     | Regression test that reproduces the original failure and confirms the fix                           |
| UI behavior                 | Reproducible verification of the primary user flow, input errors, and empty states                  |
| API Route or Server Action  | Tests for request validation, success, external failures, and prevention of sensitive-data exposure |
| Configuration or dependency | Type checking, tests, production build, and documented impact                                       |
| AI feature                  | All applicable checks above, plus accuracy evaluation and relevant safety evaluation                |

## Acceptance-Criteria Traceability

Record the following information for every Issue acceptance criterion.

| Acceptance criterion          | Implementation file | Test or verification file | Result    |
| ----------------------------- | ------------------- | ------------------------- | --------- |
| Example: Reject invalid input | `src/...`           | `src/...test.ts`          | Pass/Fail |

An acceptance criterion without linked implementation or verification evidence is a blocking issue.

## Test Quality Standards

- Make the behavior and condition under test clear from the test name alone.
- Do not use meaningless assertions that cannot affect the test outcome.
- Cover relevant errors, boundary values, and empty input in addition to the normal path.
- Do not replace required behavior checks with `skip`, `todo`, or excessive snapshots.
- Prefer deterministic tests that do not depend on time, network access, or execution order.
- Mock responses, timeouts, and errors explicitly instead of calling real external APIs.

## AI Accuracy Verification

Apply this section whenever the change affects prompts, model calls, retrieval, extraction, recommendations, tool use, AI API Routes, or model-output handling.

- Define representative valid inputs and expected outcomes.
- Include relevant edge cases such as ambiguous input, insufficient information, invalid formats, and long input.
- Verify schema validation and failure handling for structured output such as JSON.
- For responses that require supporting evidence, verify consistency with the provided context.
- When there is no single correct answer, define evaluation criteria and tolerances first, and include human review when needed.
- Do not determine a passing result solely through model self-evaluation.

## AI Safety Verification

Select checks that match the feature's permissions and data scope.

- Verify that prompt injection and instruction-bypass attempts cannot override system rules.
- Verify that API keys, system prompts, personal data, and other sensitive information are not exposed in outputs or logs.
- Validate and constrain model output before using it in rendering, commands, queries, or external calls.
- Verify that the feature cannot perform excessive or external actions without user approval.
- Verify safe refusal or restriction of harmful or disallowed requests.
- Verify safe handling of external AI API errors, timeouts, and malformed responses.

Severe information exposure, excessive permissions, and execution of unvalidated model output are always blocking issues.

## Verdict Criteria

- `PASS`: Every acceptance criterion and required test is linked, `npm run check` passes, and no blocking accuracy or safety issue remains.
- `FAIL`: At least one acceptance criterion is unmet, a required test is missing or failing, a verification command fails, a secret is exposed, or a critical AI safety issue remains.
- `UNVERIFIED`: An item could not be checked because of environmental or external constraints. Record the reason and risk; treat it as `FAIL` when it affects a core acceptance criterion.

## Standard Verification Command

Run tests closest to the changed behavior first, then run the integrated verification command.

```bash
npm run check
```

This command checks formatting, linting, TypeScript types, Vitest tests, and the Next.js production build in sequence.

## Verification Evidence

Record the following in Korean in the `verify-change` result and the Issue plan's execution-results section.

- Implementation and test traceability for each acceptance criterion
- Commands executed and their actual results
- Whether AI behavior changed and the accuracy and safety verification results
- Quality issues discovered or prevented by AI and the corresponding fixes
- Blocking issues, unverified areas, and known limitations
- Final `PASS` or `FAIL` verdict

## Definition of Done

- Every Issue acceptance criterion is implemented and linked to verification evidence.
- Tests required by the change are implemented and passing.
- `npm run check` passes.
- Relevant accuracy and safety evaluations pass for AI-related changes.
- Verification results and remaining limitations are recorded in the Issue plan and pull request.
- The `verify-change` verdict is `PASS`, with no blocking issues.
