# Issue #2 구현 계획: Codex 개발 하네스 샘플 흐름 검증

## 1. 이슈 개요

- 대상 이슈: [#2 `[Feat] Codex 개발 하네스 샘플 흐름 검증`](https://github.com/sunnypark87/AI-Builder-Sprint-Loop/issues/2)
- 우선순위: `P0`
- 상태: Open
- 담당자: `sunnypark87`
- 작성일: 2026-07-30

Issue #1에서 준비한 개발 하네스와 `/api/health` 샘플 변경을 사용해 Issue 확인부터 Ready for review 상태의 일반 PR 생성까지 전체 흐름을 검증한다.

## 2. 현재 저장소 상태

| 요구사항               | 현재 상태                                                      | 필요한 작업                      |
| ---------------------- | -------------------------------------------------------------- | -------------------------------- |
| Issue 기반 작업 브랜치 | `origin/main` 기반 `feature/2-verify-development-harness` 생성 | 브랜치에서 변경 완료             |
| 헬스 체크 샘플         | 구현과 단위 테스트 준비                                        | 집중 테스트 및 빌드 검증         |
| 공통 개발 하네스       | 규칙, 검증 명령, 템플릿 준비                                   | 누락 조건 보완 및 전체 검증      |
| 일반 PR 흐름           | 미실행                                                         | 검증 후 커밋, Push, 일반 PR 생성 |

## 3. 선행 결정

- PR 기준은 Draft가 아닌 Ready for review 상태의 일반 PR로 통일한다.
- PR base는 `main`, source는 `feature/2-verify-development-harness`를 사용한다.
- 실제 Upstage API 연동과 배포 자동화는 이번 샘플 범위에서 제외한다.

## 4. 구현 단계

### 단계 1. 개발 하네스와 샘플 동작 완성

#### 작업 내용

- 저장소 규칙, GitHub 작업 절차, 비밀정보 예시, 공통 검증 명령과 템플릿을 구성한다.
- `/api/health`와 도메인 함수 단위 테스트를 준비한다.

#### 완료 조건

- [x] Issue 템플릿과 PR 템플릿에 검증 결과 기록 영역이 있다.
- [x] `/api/health`의 응답 동작을 단위 테스트로 확인할 수 있다.

### 단계 2. 검증과 일반 PR 생성

#### 작업 내용

- 집중 테스트와 `npm run check`, `verify-change`를 실행한다.
- 선택한 변경을 원자적으로 커밋하고 Push한 뒤 일반 PR을 생성한다.

#### 완료 조건

- [x] 검증 결과가 계획 문서에 기록되고 PR 본문에 옮길 근거가 준비된다.
- [ ] 게시 후 Issue #1과 #2, 작업 브랜치, 커밋, 일반 PR의 연결을 사후 확인한다.

## 5. 테스트 및 검증 계획

| 완료 조건             | 구현 대상                          | 테스트 유형 | 예상 테스트 파일 또는 검증 방법 |
| --------------------- | ---------------------------------- | ----------- | ------------------------------- |
| 브랜치 규칙 준수      | Git 브랜치                         | 수동 확인   | `git status --short --branch`   |
| 헬스 체크 정상 응답   | `src/lib/health.ts`, Route Handler | 단위 테스트 | `src/lib/health.test.ts`        |
| 공통 품질 게이트 통과 | 전체 변경                          | 통합 검증   | `npm run check`                 |
| 일반 PR과 Issue 연결  | GitHub PR                          | 원격 확인   | `gh pr view <번호>`             |

실제 diff에는 AI 프롬프트, 모델 호출, 검색, 추천, 도구 실행 또는 모델 출력 처리가 없으므로 AI 정확성 및 안전성 평가는 해당 없음이다. 환경변수 예시와 로그에 실제 비밀값이 없는지는 별도로 확인한다.

## 6. 예상 산출물

```text
AGENTS.md
.env.example
.github/
docs/
package.json
src/app/api/health/route.ts
src/lib/health.ts
src/lib/health.test.ts
기타 Next.js 초기 구성 파일
```

## 7. 권장 작업 순서와 의존성

| 순서 | 작업                       | 선행 조건            | 결과                |
| ---- | -------------------------- | -------------------- | ------------------- |
| 1    | 일반 PR 기준과 템플릿 보완 | Issue #1 결정        | 문서 기준 통일      |
| 2    | 집중 테스트와 통합 검증    | 구현 완료            | 품질 증거 확보      |
| 3    | 원자적 커밋                | `verify-change` PASS | 게시 가능한 커밋    |
| 4    | Push와 일반 PR 생성        | 깨끗한 작업 트리     | 샘플 전체 흐름 완료 |

## 8. 전체 완료 기준

- [x] 요구사항 구현
- [x] 테스트 및 검증 통과
- [x] 문서 갱신
- [ ] PR에 검증 결과 기록
- [x] `verify-change` PASS 및 차단 항목 없음

## 9. 범위에서 제외할 작업

- 실제 Upstage API 호출
- 배포와 복잡한 브랜치 보호 자동화
- 리뷰 댓글 또는 CI 실패의 인위적 생성

## 10. 주요 위험과 대응

| 위험                                           | 영향                         | 대응                                                                |
| ---------------------------------------------- | ---------------------------- | ------------------------------------------------------------------- |
| PR 생성 전에는 전체 흐름을 최종 확인할 수 없음 | 게시 단계 증거가 늦게 확보됨 | 로컬 검증 후 PR을 만들고 원격 상태를 재조회해 계획 문서와 PR에 기록 |
| GitHub 인증 또는 네트워크 실패                 | 원격 흐름 중단               | 로컬 검증 결과를 보존하고 실패 단계와 재현 명령 기록                |
| 비밀정보 포함                                  | 보안 사고                    | 커밋 전 환경파일과 의심 패턴 검사                                   |

## 11. 실행 결과

### 변경 내용

- GitHub 작업 절차, 환경변수와 비밀정보 규칙, 공통 검증 명령, Issue·PR 템플릿을 포함한 개발 하네스를 구성했다.
- `/api/health` Route Handler와 도메인 함수를 구현하고 두 동작을 각각 검증하는 단위 테스트를 추가했다.
- Issue 템플릿 3종에 범위, 완료 조건, 검증 계획과 결과, 관련 자료·의존성, 우선순위 항목을 추가했다.
- Vitest가 애플리케이션의 `@/*` 경로 별칭을 해석하도록 설정을 보완했다.

### 완료 조건 추적표

| 완료 조건           | 구현 파일                                          | 테스트 또는 검증 파일                                        | 결과                                         |
| ------------------- | -------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------- |
| Issue 기반 브랜치   | Git 브랜치                                         | `git status --short --branch`                                | PASS: `feature/2-verify-development-harness` |
| 헬스 체크 정상 응답 | `src/lib/health.ts`, `src/app/api/health/route.ts` | `src/lib/health.test.ts`, `src/app/api/health/route.test.ts` | PASS: 테스트 2개 통과                        |
| 공통 품질 게이트    | 전체 변경                                          | `npm run check`                                              | PASS                                         |
| 일반 PR 연결        | GitHub PR                                          | `gh pr view`                                                 | 미실행                                       |

### 검증 명령과 결과

```text
명령: npm run test -- src/lib/health.test.ts src/app/api/health/route.test.ts
결과: PASS. 테스트 파일 2개, 테스트 2개 통과.

명령: npm run check
결과: PASS. format:check, lint, typecheck, 테스트 2개, Next.js 프로덕션 빌드 통과.

명령: 비밀정보 의심 패턴 검색
결과: PASS. 실제 API 키, GitHub 토큰, 비밀번호, 개인 키 패턴이 발견되지 않음.
```

### AI 정확성 및 안전성 검증

- AI 동작 변경 여부: 아니요
- 정확성 검증 결과: 해당 없음. AI 동작 변경이 없다.
- 안전성 검증 결과: 실제 AI 동작은 없으며 환경변수 예시에는 이름만 있다. 비밀정보 의심 패턴 검색에서 실제 값이 발견되지 않았다.
- AI가 발견하거나 예방한 품질 문제: Route Handler 자체를 검증하는 테스트가 없음을 발견해 추가했고, 이 테스트가 드러낸 Vitest 경로 별칭 누락을 수정했다. Draft PR과 일반 PR 기준의 불일치도 일반 PR로 통일했다.
- 최종 판정: PASS

### 차단 항목과 미검증 범위

- 차단 항목 없음.
- 커밋, Push, 일반 PR 생성과 원격 CI 결과는 게시 단계에서 사후 확인한다.

### 남은 작업과 알려진 제한

- 리뷰 댓글 또는 CI 실패 대응은 실제 대상이 발생할 때 문서화된 절차로 수행한다.

### 2026-07-30 PR #3 리뷰 및 CI 대응

- GitHub Actions run `30470053157`은 리뷰가 언급한 포맷 단계가 아니라 `npm ci`에서 실패했다. 로그에서 `package-lock.json`의 optional WASI 의존성 누락과 `@emnapi/wasi-threads` 버전 불일치를 확인했다.
- `npm install --package-lock-only`: 통과. `package.json` 변경 없이 optional WASI 의존성의 버전과 중첩 위치를 재정리했다.
- `npm ci --dry-run`: 통과.
- `npm ci`: 통과. 393개 패키지를 설치했다. peer dependency 경고와 high severity audit 경고 12건은 남아 있으며 이번 lockfile 정합성 수정 범위에서는 자동 수정하지 않았다.
- `npm run check`: 통과. 포맷, 린트, 타입 검사, 테스트 2개와 Next.js 프로덕션 빌드가 모두 성공했다.
- 리뷰가 지목한 `next.config.ts`, `README.md`, `.codex/skills/address-pr-review/SKILL.md`는 `npm run format:check`에서 모두 통과했으므로 변경하지 않았다.
- 두 번째 GitHub Actions run `30470678732`에서 runner의 npm `10.9.8`이 npm `11.6.2`로 생성한 lockfile의 optional WASI peer dependency를 불일치로 판정하는 것을 확인했다.
- `package.json`에 `packageManager: npm@11.6.2`를 명시하고 CI가 `npm ci` 전에 같은 npm 버전을 설치하도록 변경했다.
- npm `11.6.2` 기준 `npm install --package-lock-only`, 실제 `npm ci`, `npm run check`가 모두 통과했다. 새 GitHub Actions 결과는 Push 후 확인한다.

### 2026-07-30 추가 리뷰 대응

- 최신 GitHub Actions run `30471277599`의 `check`가 성공했다.
- `atomic-commit` 스킬이 기존 staged 변경을 선택 커밋에서 제외하도록 `git commit --only -- <selected-paths>` 절차와 커밋 후 경로 검증을 추가했다.
- Vite `8.1.5`의 Node.js engine 요구사항에 맞춰 `AGENTS.md`의 최소 버전을 Node.js `20.19`로 높이고 `package.json`에 `engines.node: >=20.19.0`을 추가했다.
- npm `11.6.2` 기준 `npm install --package-lock-only`, 실제 `npm ci`, `npm run check`가 모두 통과했다. peer dependency 경고와 high severity audit 경고 12건은 기존과 동일하게 남아 있다.

### 2026-07-30 TSX 테스트 수집 리뷰 대응

- Vitest include glob을 `src/**/*.test.{ts,tsx}`로 확장했다.
- 임시 `src/lib/tsx-collection.test.tsx`를 추가해 `npx vitest list`가 기존 TypeScript 테스트 2개와 TSX 테스트 1개를 모두 수집하는 것을 확인했다.
- 임시 TSX 테스트를 직접 실행해 테스트 파일 1개와 테스트 1개가 통과함을 확인한 뒤 검증용 파일을 제거했다.
- `npm run check`: 통과. 포맷, 린트, 타입 검사, 기존 테스트 2개와 Next.js 프로덕션 빌드가 모두 성공했다.

### 2026-07-30 Node.js 지원 범위 리뷰 대응

- Vite `8.1.5`, Vitest `4.1.10`, ESLint 하위 도구의 Node.js engine 교집합을 확인했다.
- `package.json`과 `AGENTS.md`의 지원 범위를 `^20.19.0 || ^22.13.0 || >=24.0.0`으로 제한해 지원되지 않는 Node.js 21, 22.0~22.12, 23이 허용되지 않도록 했다.
- npm `11.6.2` 기준 `npm install --package-lock-only`, 실제 `npm ci`, `npm run check`가 모두 통과했다. peer dependency 경고와 high severity audit 경고 12건은 기존과 동일하게 남아 있다.
