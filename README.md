# Loop

> 기부의 약속부터 집행과 보고까지, 신뢰의 흐름을 연결하는 AI 기부 플랫폼

Loop는 기부자가 기부처와 기부 목적을 이해하고 약정할 수 있도록 돕고, 기부처는 약정·집행·증빙·보고 과정을 관리할 수 있도록 지원하는 서비스입니다.

현재 프로젝트는 기부 약정부터 집행 보고까지의 전체 흐름을 검증하기 위한 데모 서비스입니다.

---

## 한눈에 보기

| 목적                                               | 먼저 확인할 내용                                                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 배포된 서비스를 바로 체험하고 싶다면               | [ai-builder-sprint-loop.vercel.app](https://ai-builder-sprint-loop.vercel.app) · [테스트 계정 확인](#데모-계정과-전자서명) |
| Loop가 해결하는 문제와 기능을 알고 싶다면          | [주요 기능](#주요-기능) · [핵심 흐름](#핵심-흐름)                                                                          |
| AI가 서비스와 개발에 어떻게 활용됐는지 알고 싶다면 | [AI 활용](#ai-활용)                                                                                                        |
| 로컬에서 프로젝트를 실행하고 싶다면                | [로컬 실행](#로컬-실행) · [환경변수](#환경변수)                                                                            |
| 구현 구조와 주요 화면을 찾고 싶다면                | [프로젝트 구조](#프로젝트-구조) · [주요 경로](#주요-경로)                                                                  |
| 검증 및 협업 방법을 확인하고 싶다면                | [검증 명령](#검증-명령) · [개발 및 협업 규칙](#개발-및-협업-규칙)                                                          |

---

## 목차

1. [주요 기능](#주요-기능)
2. [AI 활용](#ai-활용)
3. [핵심 흐름](#핵심-흐름)
4. [기술 스택](#기술-스택)
5. [로컬 실행](#로컬-실행)
6. [환경변수](#환경변수)
7. [데모 계정과 전자서명](#데모-계정과-전자서명)
8. [Supabase 로컬 설정](#supabase-로컬-설정)
9. [주요 경로](#주요-경로)
10. [검증 명령](#검증-명령)
11. [프로젝트 구조](#프로젝트-구조)
12. [현재 구현 범위와 제한사항](#현재-구현-범위와-제한사항)
13. [개발 및 협업 규칙](#개발-및-협업-규칙)
14. [참고 문서](#참고-문서)

---

## 주요 기능

### 기부자

- 기부처 목록 및 분야별 탐색
- AI 상담을 통한 기부 목적·금액·조건 정리
- 약정서 작성 및 검토
- 모두싸인 전자서명
- 서명 완료 후 데모 결제
- 기부 내역과 집행 보고 확인

### 기부처

- 조직 및 약정 템플릿 관리
- 기부 약정 확인 및 대표자 전자서명
- 지출 계획 직접 등록 또는 문서 OCR 분석
- 영수증 업로드 및 OCR 추출
- 금액·기간·예산 잔액·중복 증빙 검증
- 집행 보고서 AI 초안 생성 및 검토

---

## AI 활용

### 서비스 기능에서의 AI 활용

| 적용 영역   | 활용 내용                                                |
| ----------- | -------------------------------------------------------- |
| 문서 인식   | Upstage Document OCR로 지출 계획서와 영수증 정보를 추출  |
| 기부 상담   | 대화를 통해 기부 목적·금액·조건을 구조화                 |
| 집행 보고   | 등록된 계획과 집행 근거를 바탕으로 보고서 초안을 생성    |
| 담당자 검토 | AI 결과를 원본·DB 정보와 비교하고 검토한 뒤 저장 및 공개 |

### AI Agent 기반 개발 프로세스

이 프로젝트는 AI Agent가 단순히 코드를 생성하는 데 그치지 않고, GitHub Issue 분석부터 구현 계획 수립, 개발, 검증, 커밋, PR 작성과 코드 리뷰 반영까지 일관된 절차로 참여하도록 구성했습니다. 개발자는 각 단계에 맞는 저장소 스킬을 활용해 AI Agent에게 작업을 지시하고 결과를 확인합니다. 이를 통해 작업 범위가 불필요하게 확장되거나 검증되지 않은 변경이 반영되는 것을 방지합니다.

```text
GitHub Issue 분석·계획 → AI Agent 구현 → 변경 검증
→ 원자적 커밋 → 푸시·PR 생성 → Codex Code Review
→ 리뷰 반영·재검증
```

<details>
<summary><strong>단계별 개발 절차 자세히 보기</strong></summary>

<br />

1. **GitHub Issue 분석 및 구현 계획 수립 — `issue-to-plan`**

   개발자는 `issue-to-plan` 스킬을 활용해 AI Agent에게 담당자로 할당된 GitHub Issue를 읽고 작업 계획을 수립하도록 지시합니다. AI Agent는 Issue의 목적, 구현 범위, 완료 조건과 위험 요소를 분석하고 저장소 구조와 기존 구현을 조사합니다. 이를 바탕으로 구체적인 작업 단계와 테스트 계획을 작성해 `docs/issue_plan/ISSUE-{번호}-*.md`에 기록하며, 이후 개발은 이 계획을 기준으로 진행합니다.

2. **구현 계획 기반 개발 — AI Agent**

   개발자는 수립된 구현 계획에 따라 AI Agent에게 개발을 지시합니다. AI Agent는 구현 계획과 `AGENTS.md`, 디자인 시스템, 테스트 전략을 기준으로 관련 코드를 조사하고 기능을 구현합니다. 서버 전용 비밀정보, Supabase RLS, 외부 AI API 경계와 담당자 검토 흐름을 지키며 필요한 단위·통합·회귀 테스트도 함께 작성합니다. 구현 도중 발견한 제약이나 계획과 다른 사항은 근거와 함께 계획 문서에 반영합니다.

3. **변경사항 검증 — `verify-change`**

   개발자는 `verify-change` 스킬을 활용해 AI Agent에게 변경사항 검증을 지시합니다. AI Agent는 실제 변경사항을 Issue의 완료 조건과 하나씩 대조하고, 구현 파일과 테스트 근거가 연결되어 있는지, 정상·오류·경계·회귀 사례가 적절히 검증됐는지, `npm run check`가 통과했는지를 확인합니다. AI 기능이 변경된 경우에는 정확성, 근거 일치, 프롬프트 인젝션, 개인정보·비밀정보 노출과 외부 API 실패 처리까지 점검하고 결과를 구현 계획에 기록합니다. 차단 항목이 있으면 커밋이나 PR 생성을 진행하지 않습니다.

4. **변경 범위 선택 및 원자적 커밋 — `atomic-commit`**

   개발자는 `atomic-commit` 스킬을 활용해 AI Agent에게 커밋 준비를 지시합니다. AI Agent는 작업 트리의 변경 파일을 논리적인 단위로 분류해 제시하고, 개발자는 커밋할 파일 또는 그룹을 직접 선택합니다. AI Agent는 선택된 변경만 스테이징한 뒤 비밀정보, 생성 산출물, 관련 없는 수정과 staged diff를 다시 확인합니다. 검증을 통과한 하나의 목적만 Conventional Commits 규칙에 맞춰 커밋하므로 변경 이력과 리뷰 범위를 명확하게 유지할 수 있습니다.

5. **브랜치 푸시 및 Pull Request 생성 — `push-and-pr`**

   개발자는 `push-and-pr` 스킬을 활용해 AI Agent에게 브랜치 푸시와 PR 생성을 지시합니다. AI Agent는 커밋과 Issue 구현 계획을 비교하고 검증 결과가 최신 변경을 모두 포함하는지 확인합니다. 저장소 PR 템플릿에 관련 Issue, 주요 변경사항, 완료 조건, 테스트 결과, AI 품질 검증, 환경변수·마이그레이션 영향과 알려진 제한을 작성합니다. 개발자가 저장소, source·base 브랜치와 PR 제목을 확인하면 AI Agent가 브랜치를 푸시하고 `main`을 대상으로 Ready for review PR을 생성합니다.

6. **Codex Code Review 및 피드백 반영 — `address-pr-review`**

   생성된 PR에는 Codex Code Review가 자동으로 실행되어 코드 품질, 기능 오류, 보안, 테스트 누락 등에 관한 코멘트를 남깁니다. 개발자는 `address-pr-review` 스킬을 활용해 AI Agent에게 리뷰 분석과 개선을 지시합니다. AI Agent는 미해결 코멘트와 코드 문맥을 읽고 실제 기능이나 시연에 영향을 주는 항목을 분류합니다. 개발자가 선택한 코멘트만 수정하고 관련 테스트와 전체 검증을 다시 수행한 뒤 커밋·푸시하며, 각 리뷰 스레드에 변경 내용과 검증 근거를 답변합니다. 이 과정을 모든 필수 리뷰가 해결될 때까지 반복합니다.

</details>

이 흐름에서 AI Agent는 분석과 구현을 빠르게 수행하고, 개발자는 작업 범위·커밋 대상·원격 반영 여부를 명시적으로 확인합니다. 이를 통해 개발 속도와 함께 변경 추적성, 테스트 신뢰성, AI 활용의 안전성을 확보합니다.

---

## 핵심 흐름

### 기부자 흐름

```text
기부처 선택 → AI 상담 → 약정서 작성 → 기부자 서명
→ 기부처 서명 → 데모 결제 → 집행·보고 확인
```

### 기부처 흐름

```text
약정 확인 → 대표자 서명 → 지출 계획 등록
→ 영수증 업로드 및 분석 → 담당자 검토
→ 집행 등록 → 보고서 작성 및 공개
```

---

## 기술 스택

| 구분            | 기술                                                 | 용도                                   |
| --------------- | ---------------------------------------------------- | -------------------------------------- |
| 웹 애플리케이션 | Next.js App Router, React, TypeScript                | 화면, 서버 컴포넌트, API 구현          |
| 스타일링        | Tailwind CSS                                         | 반응형 UI와 디자인 시스템 적용         |
| 백엔드          | Supabase Auth, Database, Storage, Row Level Security | 인증, 데이터, 비공개 문서, 접근 제어   |
| AI              | Upstage Document OCR, Solar Chat                     | 문서 정보 추출, 기부 상담, 보고서 생성 |
| 전자서명        | 모두싸인 Modusign API, Webhook                       | 기부자·기부처 약정서 서명              |
| 테스트          | Vitest, Playwright                                   | 단위·통합·브라우저 회귀 검증           |

---

## 로컬 실행

### 요구 사항

| 도구         | 요구 버전 및 용도                               |
| ------------ | ----------------------------------------------- |
| Node.js      | 20.19 이상                                      |
| npm          | 11 이상                                         |
| Supabase CLI | Auth·RLS·Storage·RPC 통합 흐름을 실행할 때 필요 |

### 설치 및 실행

저장소 루트에서 사용하는 운영체제와 셸에 맞는 명령을 실행합니다.

#### Windows (PowerShell)

```powershell
npm install
Copy-Item .env.example .env.local
```

#### macOS / Linux

```bash
npm install
cp .env.example .env.local
```

#### Windows Subsystem for Linux (WSL)

WSL에서는 macOS/Linux 명령을 사용합니다. 저장소를 WSL 파일 시스템에서 실행하면 파일 감시와 의존성 설치 성능이 더 안정적입니다. Node.js와 npm도 Windows가 아닌 WSL 내부에 설치되어 있어야 합니다.

### 개발 서버 시작

생성된 `.env.local`에 필요한 [환경변수](#환경변수)를 설정한 뒤 모든 운영체제에서 다음 명령을 실행합니다.

```bash
npm run dev
```

개발 서버가 준비되면 브라우저에서 [http://localhost:3000](http://localhost:3000)에 접속합니다. 서버는 터미널에서 `Ctrl+C`를 눌러 종료할 수 있습니다.

---

## 환경변수

`.env.example`을 기준으로 `.env.local`을 작성합니다. 실제 비밀 값은 저장소에 커밋하지 않습니다.

| 구분      | 환경변수                               | 용도                        |
| --------- | -------------------------------------- | --------------------------- |
| 기본 실행 | `NEXT_PUBLIC_SUPABASE_URL`             | Supabase 프로젝트 URL       |
| 기본 실행 | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 브라우저용 Supabase 공개 키 |
| AI        | `UPSTAGE_API_KEY`                      | 서버에서 Upstage API 인증   |
| AI        | `UPSTAGE_OCR_MODEL`                    | 계획서·영수증 OCR 모델      |
| AI        | `UPSTAGE_CHAT_MODEL`                   | AI 기부 상담 모델           |
| AI        | `UPSTAGE_SOLAR_MODEL`                  | 집행 보고서 생성 모델       |
| 전자서명  | `MODUSIGN_AUTH_KEY`                    | 모두싸인 API 인증           |
| 전자서명  | `MODUSIGN_TEMPLATE_ID`                 | 약정서 전자서명 템플릿      |
| 전자서명  | `MODUSIGN_WEBHOOK_SECRET`              | Webhook 요청 검증           |
| 배포      | `NEXT_PUBLIC_SITE_URL`                 | 공개 서비스 기준 URL        |

서버 전용 변수를 브라우저 코드에 노출하지 않습니다. 전체 변수 목록과 용도는 [`.env.example`](.env.example)에서 확인할 수 있습니다.

---

## 데모 계정과 전자서명

| 역할   | 이메일                  | 비밀번호 |
| ------ | ----------------------- | -------- |
| 기부처 | `partner1@modugive.com` | `123456` |
| 기부자 | `donor1@modugive.com`   | `123456` |

위 계정은 시연을 위한 공개 공용 계정입니다. 실제 개인정보, 결제정보 또는 민감한 문서를 입력하지 마세요. 계정 데이터는 시연 과정에서 변경되거나 초기화될 수 있습니다.

데모 계정은 환경변수를 설정한 뒤 다음 명령으로 생성하거나 갱신할 수 있습니다.

```bash
npm run demo:accounts
```

기본 데모 조직은 `DEMO_ORGANIZATION_SLUG`으로 지정하며, 현재 목 데이터에는 `haebom`, `green-tomorrow`, `warm-table`, `loop-foundation` 기부처가 포함되어 있습니다.

기부자는 약정서를 작성하고 모두싸인 전자서명을 진행합니다. 이후 기부처 대표자가 같은 약정서에 서명하면 약정이 완료됩니다. 배포 환경에서는 모두싸인 Webhook을 다음 주소로 등록합니다.

```text
https://<배포 도메인>/api/modusign/webhook
```

Webhook에는 `X-Modusign-Webhook-Secret` 헤더를 사용하고, 그 값은 `MODUSIGN_WEBHOOK_SECRET`과 일치해야 합니다.

---

## Supabase 로컬 설정

Auth·RLS·Storage·RPC가 포함된 통합 흐름은 로컬 Supabase에서 확인합니다.

```bash
npx supabase start
npx supabase db reset --local
npx supabase test db
npm run test:e2e:plans
npm run test:e2e:executions
npm run test:e2e:reports
```

---

## 주요 경로

| 경로                                    | 설명                       |
| --------------------------------------- | -------------------------- |
| `/`                                     | 서비스 소개 및 주요 기부처 |
| `/organizations`                        | 기부처 목록                |
| `/donate/[organizationId]/consultation` | AI 기부 상담               |
| `/pledges/[pledgeId]/sign`              | 기부자 전자서명            |
| `/donations/[pledgeId]/payment`         | 서명 완료 약정의 데모 결제 |
| `/my-donations`                         | 기부자 기부 내역           |
| `/partner`                              | 기부처 관리자 대시보드     |
| `/partner/plans`                        | 지출 계획 관리             |
| `/partner/executions`                   | 집행 증빙 관리             |
| `/partner/reports`                      | 집행 보고서 관리           |

---

## 검증 명령

개별 검증:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

전체 검증:

```bash
npm run check
```

Upstage API를 사용하는 대표 문서 정확도 평가는 별도로 실행합니다.

```bash
npm run test:ai:ocr
npm run test:ai:receipt-ocr
npm run test:ai:reports
```

일반 테스트와 `npm run check`는 외부 AI API를 호출하지 않도록 구성되어 있습니다.

---

## 프로젝트 구조

| 경로              | 역할                                                    |
| ----------------- | ------------------------------------------------------- |
| `src/app/`        | App Router 페이지와 API Route Handler                   |
| `src/components/` | 기부자·기부처 화면 및 공통 UI                           |
| `src/lib/`        | AI, 전자서명, Supabase, 약정·계획·집행·보고 도메인 로직 |
| `supabase/`       | 마이그레이션, RLS, Storage, RPC, 테스트 데이터          |
| `tests/e2e/`      | Playwright 브라우저 및 통합 테스트                      |
| `docs/`           | 디자인 시스템, 테스트 전략, 운영 검증 문서              |

---

## 현재 구현 범위와 제한사항

- 기부처 데이터 일부는 데모 목 데이터이며 `Loop 재단`도 데모 기부처입니다.
- 결제 화면은 데모 결제 흐름이며 실제 결제 승인을 처리하지 않습니다.
- OCR 결과는 담당자 검토 후 저장됩니다.
- OCR은 카드사·국세청 등 외부 발행기관의 법적 진위 확인을 제공하지 않습니다.
- 모두싸인 Webhook은 배포 환경에서 별도 설정이 필요합니다.
- 주민등록번호 등 민감정보 기능은 기본적으로 비활성화되어 있습니다.
- 실제 환경에서는 Supabase RLS와 서버 전용 키 설정을 함께 검증해야 합니다.

---

## 개발 및 협업 규칙

- 브랜치는 `main`에서 생성하고 `feature/*`, `fix/*`, `refactor/*` 형식과 GitHub Issue 번호를 사용합니다.
- 커밋은 Conventional Commits 형식을 따르며 하나의 논리적 변경만 포함합니다.
- 모든 변경은 검증을 통과한 뒤 `main` 대상 Pull Request로 병합합니다.
- 브랜치명, 커밋 메시지, PR 작성과 병합 규칙의 상세 기준은 [`docs/git-conventions.md`](docs/git-conventions.md)를 따릅니다.
- Issue별 구현 계획, 완료 조건 추적과 실제 검증 결과는 [`docs/issue_plan/`](docs/issue_plan/)에 기록합니다.
- 테스트 범위와 AI 정확성·안전성 검증 기준은 [`docs/testing-strategy.md`](docs/testing-strategy.md)를 따릅니다.

---

## 참고 문서

| 문서                                                                           | 내용                          |
| ------------------------------------------------------------------------------ | ----------------------------- |
| [`AGENTS.md`](AGENTS.md)                                                       | 개발 및 검증 작업 지침        |
| [`docs/git-conventions.md`](docs/git-conventions.md)                           | 브랜치·커밋·PR 및 병합 규칙   |
| [`docs/design-system.md`](docs/design-system.md)                               | 화면·접근성·UI 기준           |
| [`docs/issue_plan/`](docs/issue_plan/)                                         | Issue별 구현 계획과 검증 기록 |
| [`docs/testing-strategy.md`](docs/testing-strategy.md)                         | 테스트 및 AI 검증 기준        |
| [`docs/modusign-manual-verification.md`](docs/modusign-manual-verification.md) | 전자서명 수동 검증            |
| [`docs/vercel-webhook-verification.md`](docs/vercel-webhook-verification.md)   | 배포 Webhook 검증             |
