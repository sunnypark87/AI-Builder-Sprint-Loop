# Loop

> 기부의 약속부터 집행과 보고까지, 신뢰의 흐름을 연결하는 AI 기부 플랫폼

Loop는 기부자가 기부처와 기부 목적을 이해하고 약정할 수 있도록 돕고, 기부처는 약정·집행·증빙·보고 과정을 관리할 수 있도록 지원하는 서비스입니다.

현재 프로젝트는 AI Builder Sprint 2026을 위해 개발 중인 데모 서비스입니다.

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

### AI 활용

- Upstage Document OCR을 통한 지출 계획서·영수증 정보 추출
- AI 기부 상담
- 집행 보고서 초안 생성
- AI 결과를 담당자가 검토한 뒤 저장하는 검토 기반 흐름

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

## 기술 스택

- Next.js App Router
- TypeScript, React
- Tailwind CSS
- Supabase Auth / Database / Storage / Row Level Security
- Upstage Document OCR / Solar Chat
- 모두싸인 Modusign API 및 Webhook
- Vitest / Playwright

## 로컬 실행

### 요구 사항

- Node.js 20.19 이상
- npm 11 이상
- Supabase 통합 흐름을 실행하려면 Supabase CLI가 필요합니다.

### 설치 및 실행

```bash
npm install
cp .env.example .env.local
npm run dev
```

개발 서버는 `http://localhost:3000`에서 실행됩니다.

## 환경변수

`.env.example`을 기준으로 `.env.local`을 작성합니다. 실제 비밀 값은 저장소에 커밋하지 않습니다.

기본 실행에 필요한 변수:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

AI 기능:

- `UPSTAGE_API_KEY`
- `UPSTAGE_OCR_MODEL`
- `UPSTAGE_CHAT_MODEL`
- `UPSTAGE_SOLAR_MODEL`

전자서명 및 배포:

- `MODUSIGN_AUTH_KEY`
- `MODUSIGN_TEMPLATE_ID`
- `MODUSIGN_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SITE_URL`

서버 전용 변수를 브라우저 코드에 노출하지 않습니다. 전체 변수 목록과 용도는 [`.env.example`](.env.example)에서 확인할 수 있습니다.

## 데모 계정과 전자서명

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

## 프로젝트 구조

```text
src/app/          App Router 페이지와 API Route Handler
src/components/   기부자·기부처 화면 및 공통 UI
src/lib/          AI, 전자서명, Supabase, 약정·계획·집행·보고 도메인 로직
supabase/         마이그레이션, RLS, Storage, RPC, 테스트 데이터
tests/e2e/        Playwright 브라우저 및 통합 테스트
docs/             디자인 시스템, 테스트 전략, 운영 검증 문서
```

## 현재 구현 범위와 제한사항

- 기부처 데이터 일부는 데모 목 데이터이며 `Loop 재단`도 데모 기부처입니다.
- 결제 화면은 데모 결제 흐름이며 실제 결제 승인을 처리하지 않습니다.
- OCR 결과는 담당자 검토 후 저장됩니다.
- OCR은 카드사·국세청 등 외부 발행기관의 법적 진위 확인을 제공하지 않습니다.
- 모두싸인 Webhook은 배포 환경에서 별도 설정이 필요합니다.
- 주민등록번호 등 민감정보 기능은 기본적으로 비활성화되어 있습니다.
- 실제 환경에서는 Supabase RLS와 서버 전용 키 설정을 함께 검증해야 합니다.

## 대회 소개

**AI Builder Sprint 2026**은 부산대학교 **APPTIVE**가 주최하고, **Upstage**, 부산대학교 **Anchor 사업단** 및 부산대학교 **AI융합교육원**이 후원하는 해커톤입니다.

프로젝트 저장소는 대회 제출과 개발 과정을 위해 운영되며, 브랜치·커밋·PR 규칙은 [`docs/git-conventions.md`](docs/git-conventions.md)를 따릅니다. 구현 계획과 검증 결과는 [`docs/issue_plan/`](docs/issue_plan/)에 기록합니다.

## 참고 문서

- [`AGENTS.md`](AGENTS.md): 개발 및 검증 작업 지침
- [`docs/design-system.md`](docs/design-system.md): 화면·접근성·UI 기준
- [`docs/testing-strategy.md`](docs/testing-strategy.md): 테스트 및 AI 검증 기준
- [`docs/modusign-manual-verification.md`](docs/modusign-manual-verification.md): 전자서명 수동 검증
- [`docs/vercel-webhook-verification.md`](docs/vercel-webhook-verification.md): 배포 Webhook 검증

## 문의

- 대회 관련 문의: 해커톤 문의 오픈채팅방
- 주최: 부산대학교 APPTIVE
- 후원: Upstage, 부산대학교 Anchor 사업단, 부산대학교 AI융합교육원
