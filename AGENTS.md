# AI Builder Sprint 작업 지침

## 프로젝트 개요

이 저장소는 AI Builder Sprint 2026 해커톤 프로젝트의 시작점이다. 목표는 AI를 활용해 인간다움을 더 잘 드러내는, 실제로 실행 가능한 서비스를 만드는 것이다.

현재 저장소는 Next.js 기반 웹앱의 시작점이다. 기능 개발과 함께 이 문서의 구조와 명령을 최신 상태로 유지한다.

## 현재 구조

```text
.
├── AGENTS.md
├── docs/
│   ├── issue_plan/
│   │   └── ISSUE-1-IMPLEMENTATION-PLAN.md
│   └── testing-strategy.md
├── README.md
├── package.json
├── public/
└── src/
    ├── app/          # App Router 페이지, 레이아웃, API route
    └── lib/          # 기능과 무관한 공통 유틸리티
```

애플리케이션 코드가 추가되면 주요 디렉터리의 책임과 실행 방법을 이 문서에 함께 기록한다.

## 기술 스택

- 앱 형태: 웹앱
- 언어 및 프레임워크: Next.js App Router + TypeScript
- 스타일: Tailwind CSS
- 런타임: Node.js 20.19 이상
- 패키지 관리자: npm
- 기본 개발 서버 포트: 3000
- AI API: Upstage API를 서버 측 코드에서 호출

## 설치 및 실행

의존성을 설치한 뒤 개발 서버를 실행한다.

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 연다.

## 검증 명령

포맷터, 린터, 타입 검사, 테스트 러너, 빌드는 `package.json` 스크립트로 실행한다.

```bash
npm run format        # Prettier로 포맷 적용
npm run format:check  # 포맷 검사
npm run lint          # ESLint
npm run typecheck     # TypeScript 타입 검사
npm run test          # Vitest 단위 테스트
npm run build         # Next.js 프로덕션 빌드
npm run check         # format:check, lint, typecheck, test, build 통합
```

`check`는 포맷 검사, 린트, 타입 검사, 테스트, 빌드를 반복 실행할 수 있는 단일 진입점이어야 한다. 외부 API 키 없이도 정적 검증과 단위 테스트를 실행할 수 있도록 외부 연동은 mock 처리한다.

## 코딩 규칙

- 기능을 시작하기 전에 관련 GitHub Issue와 완료 조건을 확인한다.
- 변경 범위를 Issue의 목적에 필요한 최소 범위로 유지한다.
- 기존 사용자 변경사항을 확인하고 덮어쓰지 않는다.
- 비밀정보, API 키, 토큰, 개인정보를 소스·로그·테스트 fixture에 포함하지 않는다.
- 환경변수 이름만 `.env.example`에 기록하고 실제 값은 로컬 환경에만 둔다.
- 새로운 의존성은 추가 이유와 대안을 검토한 뒤 최소한으로 추가한다.
- 브라우저에서 직접 호출할 필요가 없는 AI API와 비밀정보는 Server Component 또는 Route Handler에서만 사용한다.
- 동작 변경에는 적절한 테스트 또는 재현 가능한 검증 절차를 함께 추가한다.
- 문서에 적은 실행 명령은 실제로 실행 가능한 상태로 유지한다.

## 검증 및 Definition of Done

- 구현 후 커밋 전에 `verify-change`로 Issue 완료 조건, 구현, 테스트의 추적성을 확인한다.
- 테스트 기준과 AI 정확성·안전성 검증 범위는 [`docs/testing-strategy.md`](docs/testing-strategy.md)를 따른다.
- AI 동작을 변경한 경우 대표 정확성 사례와 관련 안전성 사례를 검증하고 결과를 Issue 계획 문서에 기록한다.
- 완료 조건 누락, 필수 테스트 실패, 비밀정보 노출, 심각한 AI 안전성 문제는 차단 항목이다.
- `npm run check`와 `verify-change`가 모두 통과하고 차단 항목이 없어야 완료로 판단한다.

## Git 및 PR 작업 흐름

1. 작업할 Issue, 범위, 완료 조건을 확인한다.
2. `main`을 최신 상태로 만든 뒤 Issue 유형에 맞는 작업 브랜치를 만든다.
   - 기능: `feature/{github-issue-number}-{short-description}`
   - 버그: `fix/{github-issue-number}-{short-description}`
   - 리팩터링: `refactor/{github-issue-number}-{short-description}`
3. 관련 파일과 기존 변경사항을 먼저 확인한다.
4. 구현 후 변경 동작에 필요한 테스트를 작성하고 `verify-change`로 정확성·안전성을 검증한다.
5. `format`, `lint`, `typecheck`, `test`, `build` 또는 통합 `check`를 실행한다.
6. 검증 결과를 Issue 계획 문서에 기록한 뒤 변경 파일을 선택하고 원자적 커밋을 만든다.
7. 커밋 메시지는 `docs/git-conventions.md`의 Conventional Commits 규칙을 따른다. Issue 종료 footer는 커밋에 넣지 않는다.
8. 모든 검증을 통과한 뒤 현재 브랜치를 Push하고 `main`을 base로 일반 PR을 생성한다.
9. PR에는 관련 Issue, 변경 내용, 실행한 검증 명령, AI 품질 증거와 남은 제한을 기록한다.
10. 검증이 끝나기 전에는 완료로 보고하지 않는다.

권장 브랜치 이름 예시:

```text
feature/<github-issue-number>-<short-description>
fix/<github-issue-number>-<short-description>
refactor/<github-issue-number>-<short-description>
```

브랜치, 커밋, PR 상세 규칙은 [`docs/git-conventions.md`](docs/git-conventions.md)를 기준으로 한다.

## GitHub 및 Codex 사용

현재 작업 환경에서 사용할 수 있는 GitHub 관련 기능은 다음과 같다.

- `github:github`: 저장소·Issue·PR 조회와 요약
- `github:gh-address-comments`: PR 리뷰 피드백 확인 및 반영
- `github:gh-fix-ci`: GitHub Actions 실패 분석 및 수정
- `github:yeet`: 변경사항 커밋, Push, PR 생성

GitHub 쓰기 작업 전에는 저장소, 대상 브랜치, Issue 또는 PR 번호를 다시 확인한다. 스킬이 제공되지 않는 환경에서는 동등한 GitHub CLI 또는 웹 작업 절차를 사용하되, 인증 토큰을 소스나 로그에 남기지 않는다.

GitHub 연동은 다음 절차로 점검한다.

1. `gh auth status`로 인증 상태를 확인하고 `git remote -v`로 대상 저장소가 `sunnypark87/AI-Builder-Sprint-Loop`인지 확인한다.
2. Issue와 PR 조회는 `gh issue view <번호>`, `gh pr view <번호>`를 사용한다.
3. 리뷰 대응은 `gh pr view <번호> --comments`와 unresolved review thread를 확인한 뒤, 선택한 피드백만 수정하고 재검증한다.
4. CI 실패는 `gh pr checks <번호>`로 실패 check를 찾고 `gh run view <run-id> --log-failed`로 원인을 확인한다.
5. Push 전 `npm run check`와 `verify-change`가 통과했는지 확인한다.
6. `feature/*`, `fix/*`, `refactor/*` 브랜치를 Push하고 `main`을 base로 Ready for review 상태의 일반 PR을 생성한다.

리뷰 댓글이나 CI 실패가 없는 경우에는 위 조회 명령으로 대상이 없음을 확인하고, 실제 PR에서 발생했을 때 같은 절차를 재현한다. GitHub 인증이나 네트워크 연결이 없으면 로컬 구현과 검증까지만 진행하고 원격 쓰기 작업은 미검증으로 보고한다.

## 환경변수 및 비밀정보

- 실제 환경변수 파일은 커밋하지 않는다. `.env.example`만 커밋한다.
- `.env.example`에는 변수 이름, 필수 여부, 용도만 기록한다.
- API 키가 로그·에러 메시지·스크린샷에 노출되지 않도록 한다.
- 키가 노출되면 즉시 폐기하고 재발급한다.
- 테스트는 가능한 한 mock을 사용해 실제 비밀정보 없이 실행한다.

## 작업 완료 보고

작업을 마칠 때 다음 내용을 PR 또는 작업 보고에 남긴다.

- 변경한 파일과 핵심 변경 내용
- 실행한 검증 명령과 결과
- 실행하지 못한 검증과 그 이유
- 환경변수, 마이그레이션, 배포에 미치는 영향
- 남은 작업과 알려진 제한
