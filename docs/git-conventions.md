# Git Convention Guide

> Git and GitHub rules for fast hackathon development and consistent change history

This repository uses a single-branch `main` strategy. All working branches are created from `main`, and pull requests are opened against `main` after validation is complete.

## 1. Branch Convention

### 1.1 Branch Structure

| Branch       | Purpose                                          | Branched From | Merged Into | Lifespan  |
| ------------ | ------------------------------------------------ | ------------- | ----------- | --------- |
| `main`       | Integration and deployable base                  | -             | -           | Permanent |
| `feature/*`  | New feature development                          | `main`        | `main`      | Temporary |
| `fix/*`      | General bug fixes                                | `main`        | `main`      | Temporary |
| `refactor/*` | Structural improvements without behavior changes | `main`        | `main`      | Temporary |

No branches other than those listed above should be used.

### 1.2 Branch Naming Rules

Base format:

```text
<type>/<github-issue-number>-<short-description>
```

Examples:

```text
feature/12-login-with-google
fix/24-invalid-token-error
refactor/45-auth-service
```

Rules:

- `<type>` must be one of `feature`, `fix`, or `refactor`.
- `<github-issue-number>` must be the GitHub Issue number.
- Write the description in lowercase English kebab-case.
- Do not use Korean characters, spaces, underscores, or special characters in the description.
- Keep the description concise; 30 characters or fewer is recommended.
- Create every working branch from `main`.

### 1.3 Workflow

```bash
git checkout main
git pull origin main
git checkout -b feature/12-login-with-google

# Implement and validate
git push origin feature/12-login-with-google
# → Create PR to main → Review → Merge → Delete branch
```

Rules:

- Do not push directly to `main`.
- Merge all changes into `main` through a pull request.
- Pass all required checks before creating a pull request.
- Delete the working branch after the pull request is merged.

## 2. Commit Convention

Follow the Conventional Commits format.

### 2.1 Message Structure

```text
<type>(<scope>): <subject>

<body>
```

- The header is required and must be a single line.
- The header must be no longer than 72 characters; 50 characters or fewer is recommended.
- The body is optional and must be separated from the header by one blank line.
- Do not include an Issue-closing footer in commit messages.
- Use `Closes #12`, `Fixes #45`, and `Resolves #78` only in pull request bodies.
- Use a footer only when a `BREAKING CHANGE` declaration is required.

### 2.2 Type Categories

| Type       | Purpose                                          |
| ---------- | ------------------------------------------------ |
| `feat`     | Add a new feature                                |
| `fix`      | Fix a bug                                        |
| `docs`     | Change documentation                             |
| `style`    | Change formatting without changing logic         |
| `refactor` | Improve structure without changing behavior      |
| `perf`     | Improve performance                              |
| `test`     | Add or modify tests                              |
| `build`    | Change the build system or external dependencies |
| `ci`       | Change CI configuration                          |
| `chore`    | Perform other maintenance work                   |
| `revert`   | Revert a previous commit                         |

### 2.3 Subject Rules

- Write `type` and `scope` in English.
- Write `subject` and the body in Korean.
- Use an imperative or noun form. Use `추가` instead of `추가함`.
- Describe what changes rather than repeating that the work was completed.
- Do not end the sentence with a period.
- Keep the header within 72 characters.

### 2.4 Good Examples

```text
feat(auth): Google OAuth 로그인 추가

Google 계정으로 로그인할 수 있도록 OAuth 2.0 플로우를 구현한다.
```

```text
fix(payment): 중복 결제 방지

재시도 요청이 중복 청구로 이어지지 않도록 idempotency key를 적용한다.
```

```text
refactor(user): 검증 로직을 별도 모듈로 분리
```

```text
docs: README 개발 환경 안내 갱신
```

## 3. Pull Request Convention

### 3.1 PR Target

- The base branch for every pull request is `main`.
- The source branch must be one of `feature/*`, `fix/*`, or `refactor/*`.
- Use the same format for the PR title as for the commit header.
- Write the PR title subject and body in Korean.
- Create a regular pull request (Ready for review) after all required checks pass.
- Do not create a pull request when required checks fail.

Example:

```text
feat(auth): Google OAuth 로그인 추가
```

### 3.2 PR Body

Use `.github/pull_request_template.md` as the source of truth for the PR body structure. The PR body must include:

- The related GitHub Issue and `Closes #<number>`
- The change type
- The Issue purpose and implementation details
- Whether the Issue acceptance criteria are satisfied
- Bug-fix or refactoring details, when applicable
- Validation commands and results
- The execution environment
- Environment variable, data, and deployment impact
- Screenshots, logs, or other references
- Remaining work and known limitations

## 4. Merge Strategy

- `feature/* → main`: Squash merge recommended
- `fix/* → main`: Squash merge recommended
- `refactor/* → main`: Squash merge recommended
- Required CI checks must pass before merging.
- Delete the working branch after merging.
