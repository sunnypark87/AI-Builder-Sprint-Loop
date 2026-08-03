# Issue 구현 계획

## 1. 이슈 개요

- 대상 이슈: [#16 `[Feat] Upstage AI 기반 기부 약정서 작성 및 모두싸인 전자계약 연동`](https://github.com/sunnypark87/AI-Builder-Sprint-Loop/issues/16)
- 우선순위: P0
- 상태: Open
- 담당자: `sunnypark87`
- 작성일: 2026-08-02
- 작업 브랜치: `feature/16-ai-pledge-consultation`

등록된 기부처 정보를 근거로 사용자의 자연어 답변을 구조화된 약정 데이터로 변환하고, 누락 항목을 추가 질문으로 수집한 뒤 사용자가 검토·수정·확정할 수 있는 AI 상담 흐름을 구현한다. 확정된 약정은 이슈 #11에서 마련한 모두싸인 서명 요청, 상태 동기화, 체결 문서 조회 흐름에 연결한다.

## 2. 현재 저장소 상태

관련 코드, 문서, 설정, 테스트의 현재 상태를 조사해 기록한다.

| 요구사항       | 현재 상태                                                                                              | 필요한 작업                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| AI 상담        | `src/lib/pledges/chat.ts`가 금액·목적·공개 관련 정규식과 키워드로 mock 답변을 만든다.                  | Upstage 서버 전용 클라이언트, 구조화 출력 스키마, 대화 오케스트레이션과 오류 처리를 구현한다.     |
| 필수 정보 수집 | 상담 UI가 자유 대화를 저장하지만 필수 항목 충족 여부와 다음 질문 순서를 관리하지 않는다.               | 필수 필드, 누락 계산, 확인 질문, 완료 조건을 명시적으로 정의한다.                                 |
| 약정 초안      | `/api/pledges`와 `/pledges/[pledgeId]/review`가 저장형 초안 생성·검토·수정을 지원한다.                 | AI가 제안한 patch를 사용자 확인 후 적용하고 출처·확신도·미확정 상태를 구분한다.                   |
| 기부처 요약    | `src/lib/mock-data/organizations.ts`와 조직 상세 화면에 등록 정보가 있으나 AI 근거 데이터 계약은 없다. | DB의 허용된 기부처 필드만 입력으로 구성하고 활동 분야·조건 기부 가능 분야를 근거와 함께 요약한다. |
| 모두싸인 연동  | 이슈 #11이 `main`에 병합되어 서명 요청, 임베디드 링크, Webhook/수동 동기화, 체결 상태 조회가 구현됐다. | AI 초안 확정 이후에만 기존 서명 요청 흐름으로 진입하는 통합 경계를 검증한다.                      |
| 데이터·RLS     | `pledges`, `pledge_chat_messages`와 관련 RLS가 존재한다.                                               | AI 실행 상태·구조화 제안·감사에 필요한 최소 컬럼을 검토하고 마이그레이션과 RLS를 추가한다.        |
| Upstage 연동   | Document OCR 클라이언트는 있으나 채팅/구조화 생성 클라이언트는 없다.                                   | 별도 서버 전용 클라이언트를 만들고 비밀정보 비노출, 타임아웃, 비정상 출력 검증을 추가한다.        |
| 자동 검증      | mock 상담 단위 테스트와 모두싸인 API 테스트가 존재한다.                                                | AI 정확성·안전성 fixture, Route/UI 통합 테스트, 전체 사용자 흐름 E2E를 추가한다.                  |

## 3. 선행 결정

- [ ] 사용할 Upstage 대화 모델, 엔드포인트, timeout, 재시도와 비용 상한을 확정한다.
- [ ] 약정 필수 필드를 기부처, 금액, 기부 유형·기간, 목적, 조건으로 확정하고 기존 `pledges` 스키마와 매핑한다.
- [ ] 모델 출력은 런타임 스키마로 검증하며 검증 실패 출력은 저장·적용하지 않는다.
- [ ] AI 제안은 자동 확정하지 않고 사용자가 항목별 확인 또는 검토 화면 저장을 수행해야 반영한다.
- [ ] 기부처 요약은 등록된 내부 정보만 사용하고 근거가 없으면 `확인 필요`로 표시한다.
- [ ] 대화 원문과 모델 입력에서 주민등록번호 등 서명 단계의 민감정보를 제외한다.
- [ ] 프롬프트·모델 버전과 결과 추적에 필요한 최소 메타데이터의 보존 기간을 정한다.
- [ ] 이슈 #11의 모두싸인 계약을 재구현하지 않고 기존 API와 상태 모델을 통합 경계로 사용한다.

## 4. 구현 단계

### 단계 1. AI 입력·출력 계약과 안전 경계 정의

#### 작업 내용

- 필수 약정 필드, nullable 규칙, 금액·날짜·기간 제약과 누락 필드 계산을 순수 스키마로 정의한다.
- 구조화 응답을 `assistantMessage`, `proposedPatch`, `missingFields`, `organizationSummary`, `evidence`로 제한한다.
- 시스템 프롬프트에 등록 정보 우선, 법률 자문 금지, 민감정보 요청 금지, 불확실성 표시 규칙을 포함한다.
- 사용자 입력의 프롬프트 인젝션이 시스템 규칙이나 다른 기부처·사용자 데이터 접근으로 이어지지 않게 입력을 분리한다.

#### 완료 조건

- [x] 정상·부분·모순·비정상 모델 출력이 결정적으로 검증된다.
- [x] 필수 정보 누락과 다음 질문이 서버에서 계산된다.
- [x] 근거 없는 기부처 정보와 민감정보가 AI 결과에 포함되지 않는다.

### 단계 2. 서버 전용 Upstage 상담 클라이언트 구현

#### 작업 내용

- 서버 전용 환경 변수 검증과 Upstage 채팅 요청·응답 클라이언트를 구현한다.
- timeout, 401·429·5xx, 네트워크 오류, 빈 응답과 JSON/schema 오류를 안전한 내부 오류로 변환한다.
- API 키, 전체 프롬프트, 민감한 대화와 원문 외부 오류가 로그·클라이언트 응답에 노출되지 않게 한다.
- 외부 호출 없이 재현 가능한 fixture와 mock을 제공한다.

#### 완료 조건

- [ ] 정상·timeout·rate limit·비정상 출력 테스트가 외부 API 없이 통과한다.
- [ ] Upstage 비밀값은 브라우저 번들, 응답, 로그에 나타나지 않는다.

#### 2단계 보완 구현 기록 (2026-08-02)

- 입력 제한을 추가하고 제한 초과 시 자동 절단 없이 API 호출 전에 거부한다.
  - 최대 메시지 20개
  - 메시지 한 개 최대 2,000자
  - 전체 메시지 최대 12,000자
  - 기부처 문맥 최대 8,000자
- 429 응답의 `Retry-After`를 최대 3초까지 반영하고, 재시도 횟수를 최대 1회로 제한한다.
- 타임아웃마다 `AbortController`를 정리하고, 응답 형식·JSON·스키마 오류는 재시도하지 않는다.
- 상담 서비스가 인증, rate limit, timeout, 네트워크, Upstage 장애, 응답 검증, 근거 검증 오류를 안전한 내부 코드로 전달한다.
- 성공 결과에 요청 ID, 시도 횟수, 처리 시간, 토큰 사용량을 포함하되 프롬프트·대화 원문·비밀값은 포함하지 않는다.
- 입력 제한, `Retry-After`, 비정상 모델 출력, 오류 코드 전파, 비밀값 비노출 테스트를 추가했다.
- 검증 결과: `npm run typecheck`, `npm run lint`, Vitest 71개 파일/273개 테스트 통과.
- 미검증: 실제 Upstage API 스모크 테스트와 `response_format` 지원 여부. 유효한 API Key와 네트워크가 필요하다.
- `npm run build`는 샌드박스의 Turbopack 프로세스/포트 생성 권한 제한으로 실패했으며, 코드 컴파일·타입 검사는 통과했다.

### 단계 3. 저장형 AI 상담 오케스트레이션 구현

#### 작업 내용

- 인증 사용자와 약정 소유권을 검증한 뒤 허용된 기부처 정보와 대화 문맥만 모델 입력으로 구성한다.
- 사용자 메시지 저장, AI 호출, 검증된 답변 저장의 실패 경계를 정의하고 중복 제출을 멱등 처리한다.
- 누락 필드를 우선 질문하고 모순된 값은 덮어쓰지 않은 채 사용자 재확인을 요청한다.
- AI 제안과 사용자가 확정한 약정 값을 분리하고 감사 가능한 최소 메타데이터를 저장한다.

#### 완료 조건

- [ ] 다른 사용자의 약정·대화와 다른 기부처 비공개 정보에 접근할 수 없다.
- [ ] 중복 요청, 저장 실패, AI 실패 후 재시도가 메시지나 patch를 중복 적용하지 않는다.
- [ ] 검증되지 않은 모델 출력은 DB와 약정 초안에 반영되지 않는다.

#### 3단계 구현 진행 기록 (2026-08-02)

- `pledge_chat_messages`에 `pending`, `completed`, `failed` 상태와 멱등성 키, 실패 코드, AI 답변 연결 컬럼을 추가하는 마이그레이션을 작성했다.
- `pledge_ai_proposals`를 별도 테이블로 추가해 AI 제안과 확정 약정 값을 분리했다.
- 기부자 RLS와 서버 전용 완료·실패·재시도 RPC를 추가해 클라이언트가 AI 답변과 제안 상태를 임의 조작하지 못하게 했다.
- 허용된 기관 공개 정보와 완료된 대화만 조회하는 저장소 계층을 구현했다.
- 입력 제한·민감정보 검사를 통과한 메시지만 `pending`으로 저장하고, Upstage 실패 시 `failed` 상태와 안전한 오류 코드만 저장하도록 오케스트레이션했다.
- 동일 `Idempotency-Key` 요청은 기존 상담 턴을 재사용하고, 처리 중 요청은 중복 AI 호출을 차단하도록 구현했다.
- 실제 상담 POST/GET Route Handler를 mock 응답에서 저장형 AI 상담 서비스로 연결했다.
- Route, 저장형 오케스트레이션 테스트를 추가했다.
- 검증 결과: TypeScript, ESLint, Vitest 73개 파일/281개 테스트 통과.
- 미검증: 로컬 Supabase를 실제로 기동한 RLS·RPC 통합 검증과 실제 Upstage 스모크 테스트.

#### 3단계 완료 보완 구현 기록 (2026-08-02)

- DB 기관 정보에 아직 활동 분야·지원 프로그램·기부 정책 컬럼이 없는 경우에도 빈 배열·`null` 기본값으로 유효한 AI 컨텍스트를 구성하도록 수정했다.
- GET 상담 조회는 소유권만 확인하고, POST 상담 생성은 `draft` 상태만 허용하도록 읽기·쓰기 검증 경계를 분리했다.
- 동일 멱등성 키에 다른 메시지가 들어오면 `409 idempotency_conflict`로 거부하고 AI 호출·DB 변경을 하지 않도록 했다.
- 2분 이상 갱신되지 않은 `pending` 메시지를 조건부 RPC로 복구하고, 최근 `pending` 요청은 처리 중으로 유지하도록 했다.
- AI 성공 후 약정 버전·상태 충돌이 발생하면 사용자 메시지를 재시도 불가 `failed`로 전환하고, 일시적인 저장 장애는 재시도 가능 상태로 보존하도록 구분했다.
- 저장형 오케스트레이션 테스트에 멱등성 충돌과 오래된 `pending` 복구 사례를 추가했다.
- `supabase/tests/pledge_ai_consultation_test.sql`에 제안 직접 조작 차단, assistant 메시지 직접 삽입 차단, 사용자 간 데이터 격리, RPC 권한 검증을 추가했다.
- 자동 검증 결과: TypeScript, ESLint, Prettier, Vitest 73개 파일/283개 테스트 통과.

#### 3단계 잔여 보완 구현 완료 기록 (2026-08-02)

- GET 상담 메시지 조회에 실패 코드·재시도 가능 여부·갱신 시각을 포함하고 공유 API 응답 타입을 확장했다.
- 저장소 오류를 `in_progress`, `turn_unavailable`, 조회·저장 장애로 구분해 HTTP 상태와 재시도 가능 여부를 일관되게 매핑했다.
- 동일 멱등성 키의 동시 INSERT 충돌 시 최신 상담 턴을 재조회해 기존 완료 결과·처리 중 상태·멱등성 충돌을 반환하도록 했다.
- 완료 RPC 원자성 pgTAP assertion을 추가하고 테스트 계획 수를 실제 assertion 수에 맞췄다.
- 자동 검증 결과: TypeScript, ESLint, Prettier, Vitest 73개 파일/283개 테스트 통과.
- 남은 외부 검증: `npx supabase db reset && npx supabase test db`, 실제 Upstage 스모크 테스트, 권한 제한이 없는 환경의 production build.

#### 3단계 코드 구현 마무리 기록 (2026-08-02)

- 기존 멱등성 요청을 입력 제한 검사보다 먼저 조회해 완료 요청 재사용이 대화 길이에 영향을 받지 않도록 했다.
- 기존 대화 문맥은 새 메시지를 포함해 최대 20개가 되도록 19개까지만 선택한다.
- 동시 요청의 동일 키·다른 메시지를 `idempotency_conflict`로 거부한다.
- 약정 상태 변경으로 완료 RPC가 거부된 경우 사용자 메시지를 `consultation_state_changed` 실패로 전환할 수 있도록 실패 RPC의 상태 조건을 보완했다.
- GET은 서명 이후에도 소유자 상담 기록을 조회할 수 있고, POST만 draft 상태를 요구하도록 유지했다.
- GET/POST 상담 메시지·제안 응답을 camelCase 공유 타입으로 표준화하고 실패 코드·재시도 가능 여부를 반환한다.
- `failure_code`와 메시지 상태 조합을 DB constraint로 제한했다.
- 자동 검증 결과: TypeScript, ESLint, Prettier, Vitest 73개 파일/283개 테스트 통과.

### 단계 4. 상담 및 검토 UI 연결

#### 작업 내용

- 상담 화면에 누락 항목, AI 제안, 근거 기반 기부처 요약, 확인 필요 표시를 제공한다.
- 제안 적용·거절·재질문과 오류 재시도 상태를 접근 가능한 UI로 구현한다.
- 필수 정보가 충족된 경우 저장형 약정 검토 화면으로 이동하고 사용자가 직접 수정·확정할 수 있게 한다.
- AI 생성 콘텐츠임을 표시하고 법률 검증이 아니라는 안내를 제공한다.

#### 완료 조건

- [ ] 사용자는 대화로 필수 항목을 채우고 각 AI 제안을 적용 전 확인할 수 있다.
- [ ] 키보드와 스크린 리더로 로딩·오류·제안·확정 상태를 인지하고 조작할 수 있다.
- [ ] 필수 항목이 누락된 상태에서 서명 요청으로 진행할 수 없다.

### 단계 5. 기존 모두싸인 흐름과 통합

#### 작업 내용

- 확정된 저장형 약정만 기존 서명 요청 API에 전달한다.
- 사용자가 검토 후 수정한 최종값이 모두싸인 템플릿 필드에 매핑되는지 검증한다.
- 서명 요청 이후 AI 대화가 계약 데이터를 변경하지 못하게 기존 버전·상태 제한을 확인한다.
- 서명 진행·완료·취소 및 체결 문서 조회는 #11의 기존 상태 동기화 경로를 재사용한다.

#### 완료 조건

- [ ] AI 대화 → 검토·확정 → 기부자/기부처 서명 → 체결 상태 조회 흐름이 연결된다.
- [ ] 미확정·불완전·오래된 버전의 약정은 서명 요청이 차단된다.
- [ ] 동일 약정의 중복 모두싸인 문서 생성이 기존 멱등성 보장으로 차단된다.

### 단계 6. 통합·정확성·안전성 검증과 문서화

#### 작업 내용

- 대표 기부 시나리오와 누락·모순·한국어 금액/기간 표현의 정확성 fixture를 만든다.
- 프롬프트 인젝션, 다른 기부처 정보 요구, 주민등록번호 입력, 근거 없는 활동 생성, 악성 모델 출력 사례를 검증한다.
- 외부 API와 Supabase를 mock한 브라우저 회귀 테스트와 선택적 live 평가 절차를 추가한다.
- `.env.example`, README, AGENTS, 테스트 전략과 이 계획의 실행 결과를 갱신한다.

#### 완료 조건

- [ ] 정의한 정확성 기준과 모든 안전성 사례가 통과한다.
- [ ] `npm run check`와 `verify-change`가 차단 항목 없이 통과한다.
- [ ] 실제 Upstage와 모두싸인 통합 검증 여부와 미검증 범위가 문서화된다.

## 5. 테스트 및 검증 계획

| 완료 조건                | 구현 대상                                 | 테스트 유형 | 예상 테스트 파일 또는 검증 방법                                                        |
| ------------------------ | ----------------------------------------- | ----------- | -------------------------------------------------------------------------------------- |
| 구조화 출력과 누락 계산  | AI 응답 스키마·도메인 함수                | 단위        | `src/lib/pledges/ai-schema.test.ts`, `src/lib/pledges/consultation.test.ts`            |
| 안전한 Upstage 호출      | 서버 전용 클라이언트                      | 단위        | `src/lib/upstage/chat.test.ts`에서 정상·timeout·429·5xx·비정상 JSON·비밀 비노출 검증   |
| 인증·소유권·멱등성       | 상담 Route Handler                        | 통합        | `src/app/api/pledges/[pledgeId]/chat/route.test.ts`                                    |
| AI 제안 확인과 오류 복구 | 상담 컴포넌트                             | 컴포넌트    | `src/components/pledges/pledge-chat-panel.test.tsx`, `consultation-workspace.test.tsx` |
| 최종값의 서명 문서 매핑  | 약정 검토·모두싸인 연결                   | 통합        | 기존 `signature-request/route.test.ts`, `template-mapping.test.ts` 확장                |
| 전체 사용자 흐름         | 상담→검토→서명→체결                       | E2E         | Upstage·모두싸인 mock 기반 Playwright 회귀 테스트                                      |
| AI 정확성                | 금액, 기간, 목적, 조건, 누락·모순 표현    | 평가        | 대표 한국어 fixture별 필드 일치율과 필수 누락 탐지율 기록                              |
| AI 안전성                | 인젝션, 데이터 경계, PII, 환각, 악성 출력 | 평가        | 모든 차단/보류 기대 사례 통과 및 원문 비노출 확인                                      |

AI 동작이 변경되므로 정확성 사례와 프롬프트 인젝션, 민감정보 노출, 모델 출력 검증, 외부 API 실패를 필수 검증한다. live 평가는 실제 키가 있을 때 별도 실행하고 `npm run check`에는 외부 API mock만 포함한다.

권장 명령:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run check
```

## 6. 예상 산출물

```text
.env.example
AGENTS.md
README.md
docs/issue_plan/ISSUE-16-ai-pledge-consultation.md
docs/testing-strategy.md
src/app/api/pledges/[pledgeId]/chat/route.ts
src/app/api/pledges/[pledgeId]/chat/route.test.ts
src/components/pledges/consultation-workspace.tsx
src/components/pledges/consultation-workspace.test.tsx
src/components/pledges/pledge-chat-panel.tsx
src/components/pledges/pledge-chat-panel.test.tsx
src/lib/pledges/ai-schema.ts
src/lib/pledges/ai-schema.test.ts
src/lib/pledges/consultation.ts
src/lib/pledges/consultation.test.ts
src/lib/upstage/chat.ts
src/lib/upstage/chat.test.ts
supabase/migrations/<timestamp>_add_pledge_ai_consultation.sql
tests/e2e/pledge-ai-consultation.spec.ts
```

파일명과 마이그레이션 필요 여부는 상세 설계에서 최소 범위로 조정한다. 기존 모두싸인 클라이언트와 상태 동기화 파일은 계약 변경이 필요한 경우에만 수정한다.

## 7. 권장 작업 순서와 의존성

| 순서 | 작업                              | 선행 조건           | 결과                       |
| ---- | --------------------------------- | ------------------- | -------------------------- |
| 1    | 필드·출력 스키마와 안전 정책 확정 | #11 병합 완료       | 검증 가능한 AI 계약        |
| 2    | Upstage 클라이언트와 mock 구현    | 모델·환경 변수 결정 | 안전한 서버 호출 경계      |
| 3    | 상담 저장·오케스트레이션 구현     | 1, 2 및 RLS 결정    | 멱등한 AI 상담 API         |
| 4    | 상담·검토 UI 연결                 | 3                   | 사용자 확인 기반 약정 초안 |
| 5    | 모두싸인 통합 회귀 검증           | 4, 기존 #11 API     | 확정 약정의 서명 흐름      |
| 6    | 정확성·안전성·E2E 및 문서화       | 1~5                 | 완료 근거와 운영 안내      |

## 8. 전체 완료 기준

- [ ] 요구사항 구현
- [ ] 대화에서 약정 필수 정보가 구조화되고 누락 항목을 추가 질문한다.
- [ ] 기부처 요약이 등록 정보에 근거하며 불확실성을 표시한다.
- [ ] 사용자가 AI 제안을 검토·수정·확정한 뒤에만 서명 요청을 생성한다.
- [ ] 기존 모두싸인 순차 서명, 상태 저장, 체결 문서 조회 회귀가 통과한다.
- [ ] AI 정확성·안전성 기준과 외부 API 실패 복구 검증이 통과한다.
- [ ] 테스트 및 검증 통과
- [ ] 문서 갱신
- [ ] PR에 검증 결과 기록
- [ ] `verify-change` PASS 및 차단 항목 없음

## 9. 범위에서 제외할 작업

- 실제 기부금 결제 및 PG 연동
- 약정서의 법률 자문·법적 유효성 검증
- 외부 데이터를 이용한 기부처 검증 또는 고도화된 추천
- Upstage 모델 학습·파인튜닝
- 모두싸인 외 전자서명 서비스 추가
- #11에서 이미 구현된 모두싸인 클라이언트·서명 상태 모델의 전면 재작성

## 10. 주요 위험과 대응

| 위험                                        | 영향                             | 대응                                                                            |
| ------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------- |
| 모델이 금액·기간·조건을 잘못 구조화         | 잘못된 계약 초안 생성            | 런타임 스키마·도메인 제약, 제안/확정 분리, 사용자 최종 검토를 강제한다.         |
| 기부처 정보를 환각하거나 외부 사실처럼 표현 | 사용자 오인                      | 등록 정보만 컨텍스트로 제공하고 근거·확인 필요 상태를 출력한다.                 |
| 프롬프트 인젝션과 데이터 경계 우회          | 다른 사용자·기부처 정보 노출     | 서버에서 소유권/RLS를 검증하고 시스템 지시와 데이터·사용자 입력을 분리한다.     |
| 대화에 주민등록번호 등 PII 입력             | 모델 제공자·로그로 민감정보 전송 | 입력 전 탐지·차단/마스킹하고 서명 단계의 별도 서버 경로로 안내한다.             |
| 모델 비정상 출력·지연·요율 제한             | 상담 중단·중복 메시지            | timeout, 안전한 오류 매핑, 멱등 키, 재시도 가능한 상태를 구현한다.              |
| 대화와 약정 최종값 불일치                   | 서명 문서에 오래된 값 반영       | 제안 적용 이력과 약정 버전을 분리하고 서명 요청 시 최신 확정 버전을 재검증한다. |
| 외부 live 테스트 의존                       | CI 불안정·비밀 필요              | CI는 결정적 mock을 사용하고 live 평가는 별도 명령과 결과로 기록한다.            |

## 11. 실행 결과

### 변경 내용

- 1단계 AI 약정 데이터 계약, 누락·충돌 계산, 민감정보 탐지, 안전 프롬프트 계약을 구현했다.
- 약정서 정의에 맞춰 기부 유형을 `designated | undesignated`로 정리하고, 납부 시점·납부 수단을 각각 분리했다.
- 지정 기부에만 기부 조건을 요구하고 비지정 기부의 조건을 제거하도록 검증·검토 화면·모두싸인 필드 구성을 수정했다.
- `purpose`는 신규 약정 계약과 모두싸인 조건 필드에서 제외하고, 기존 DB 데이터 호환을 위해 nullable 마이그레이션을 추가했다.
- 모델 출력과 서버 계산 결과를 분리하고, 모델 입력을 허용 목록으로 제한했다.
- 민감정보는 모델 요청 전에 차단하며, 기부처 요약 근거는 등록 정보와 대조한다.
- Upstage 실제 호출과 Route Handler 연결은 다음 단계로 남겨 두었다.

### 완료 조건 추적표

| 완료 조건                              | 구현 파일                                                                                                                                                                      | 테스트 또는 검증 파일                                                       | 결과 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ---- |
| AI 구조화 응답과 약정 필드 검증        | `src/lib/pledges/ai-schema.ts`                                                                                                                                                 | `src/lib/pledges/ai-schema.test.ts`                                         | PASS |
| 누락·충돌·질문 우선순위 계산           | `src/lib/pledges/consultation.ts`                                                                                                                                              | `src/lib/pledges/consultation.test.ts`                                      | PASS |
| 민감정보 탐지·마스킹                   | `src/lib/pledges/sensitive-input.ts`                                                                                                                                           | `src/lib/pledges/sensitive-input.test.ts`                                   | PASS |
| 프롬프트 안전 경계와 입력 계약         | `src/lib/pledges/consultation-prompt.ts`                                                                                                                                       | `src/lib/pledges/consultation-prompt.test.ts`                               | PASS |
| 약정서 기부 유형·납부 조건 정합성      | `src/lib/pledges/input.ts`, `src/components/pledges/pledge-document-form.tsx`, `src/lib/modusign/request-builder.ts`                                                           | `src/lib/pledges/input.test.ts`, `src/lib/modusign/request-builder.test.ts` | PASS |
| 모델 입력·출력 안전 경계와 서버 정규화 | `src/lib/pledges/consultation-context.ts`, `src/lib/pledges/consultation-prompt.ts`, `src/lib/pledges/consultation-normalizer.ts`, `src/lib/pledges/organization-grounding.ts` | 관련 단위 테스트                                                            | PASS |

### 검증 명령과 결과

```text
명령: `npm test`, `npm run lint`, `npm run typecheck`, `git diff --check`
결과: Vitest 67개 파일·258개 테스트 PASS, TypeScript PASS, ESLint PASS, production build PASS, diff 검사 PASS
```

### AI 정확성 및 안전성 검증

- AI 동작 변경 여부: 모델 호출 전 계약·입력·출력 검증 계층 구현, 실제 모델 호출은 다음 단계
- 정확성 검증 결과: 금액·지정/비지정 유형·조건부 납부 필드·누락·충돌·서버 정규화 사례 PASS
- 안전성 검증 결과: 민감정보 요청 차단, 중첩 패턴 우선순위, 허용 목록, 기부처 근거 대조, 비지정 기부 조건 차단 PASS
- AI가 발견하거나 예방한 품질 문제: 알 수 없는 필드·민감정보·비지정 기부의 부적절한 조건·근거 없는 활동·오래된 조건값 반영을 차단
- 최종 판정: 1단계 PASS

### 차단 항목과 미검증 범위

- 사용할 Upstage 대화 모델과 API의 구조화 출력 지원 방식, 비용·요율 제한을 2단계 구현 전에 확정해야 한다.
- 실제 Upstage 및 모두싸인 연속 통합 검증은 유효한 테스트 환경과 키가 필요하다.

### 남은 작업과 알려진 제한

- 2단계 Upstage Chat API 클라이언트, 응답 파서, 설정·오류 모델, 상담 서비스와 테스트를 구현했다.
- 실제 Upstage API 키를 사용한 live smoke와 JSON 구조화 출력 옵션 지원 여부 확인은 아직 수행하지 않았다.
- 3단계 상담 Route Handler와 Supabase 대화 저장 통합을 구현했다. 사용자 메시지는 pending으로 저장하고, 서버 RPC가 assistant/proposal 생성과 완료 상태 전환을 원자적으로 처리한다.
- 동일 멱등 키의 동시 insert, 오래된 pending 복구, 실패 요청 재시도 경합은 최신 저장 상태를 재조회해 `consultation_in_progress`, 기존 완료 결과, 멱등 충돌을 일관되게 반환한다.
- Supabase CLI/실제 인스턴스가 없는 환경이라 RLS·RPC pgTAP 실행과 실제 Upstage 호출은 아직 수행하지 않았다.
- 커밋, push, PR은 수행하지 않았다.

### 3단계 보완 구현 기록

- 저장·복구·재시도 RPC의 `consultation_turn_not_available` 결과를 `in_progress` 저장소 오류로 변환했다.
- pending 사용자 메시지 생성 충돌을 발견하면 기존 turn을 재조회하고, 승자 상태에 따라 완료 결과 재사용 또는 재시도 가능한 409를 반환한다.
- 동시성 경합 회귀 테스트를 추가했다(신규 insert 경합, 완료 승자 재사용, stale 복구 및 실패 재시도 경합).

검증 결과: `npm run typecheck`, `npm run lint`, `npm run test -- --run`(73개 파일·286개 테스트), `npm run format:check`, `git diff --check` 모두 PASS.

### 4단계 구현 진행 기록

- 상담 첫 메시지 전송 시 불완전한 `draft` 약정을 생성하고 이후 상담 요청이 동일한 `pledgeId`를 재사용하도록 연결했다.
- 상담 UI의 mock 응답을 저장형 상담 POST로 교체하고 `Idempotency-Key`를 생성해 실제 사용자·assistant 응답과 제안을 화면에 반영하도록 했다.
- AI 제안 승인·거절을 약정 버전과 함께 처리하는 서버 RPC와 Route Handler를 추가했다. 승인·거절은 소유권·draft 상태·pending 상태·버전을 확인한다.
- 제안 승인 시 지정/비지정 기부 조건을 서버에서 재검증하고 약정 버전을 증가시키며, 이전 pending 제안은 `superseded` 처리한다.
- 검토 화면의 AI 제안 반영을 직접 PATCH에서 제안 승인 API로 전환하고 제안 거절 UI를 추가했다.
- 상담 draft의 불완전 필드 허용을 위한 마이그레이션을 추가했다. 서명 전 필수값 검증은 기존 검토·서명 경로에서 유지한다.
- 검증 결과: TypeScript, ESLint, Vitest 74개 파일·290개 테스트 통과. 실제 Supabase RPC/RLS 실행은 Supabase CLI 부재로 미검증이다.

### AI 약정 도우미 및 성과 요약 구현 진행 기록

- 사용자 노출 문구를 `AI 약정 도우미` 중심으로 변경하고 개인정보 입력 금지 안내를 추가했다.
- 실제 상담 응답의 제안 메타데이터를 UI에 전달하고 누락·충돌·다음 질문 항목을 표시할 수 있도록 확장했다.
- retryable 오류의 멱등 키를 보존해 동일 요청 재시도를 지원하고 채팅 영역에 `aria-live`, 오류 `role="alert"`를 추가했다.
- 승인된 재단 자료를 원문 문서·섹션·성과 사실·AI 요약으로 분리하는 DB 스키마와 Storage 버킷을 추가했다.
- `message.txt` 같은 Markdown 보고서를 해시 기반으로 Storage와 문서/섹션 테이블에 적재하는 `import:organization-source` 스크립트를 추가했다.
- 승인된 성과 요약을 읽는 API와 상담 화면의 `재단 활동과 성과 보기` 패널을 추가했다.
- 상담 화면에서도 제안 승인·거절 API를 호출하고 승인된 patch로 약정 완성도와 남은 항목을 계산하도록 연결했다.
- `nextQuestionField`별 추천 답변을 제공하고 지정 기부 조건 질문 안에서 성과 요약과 활동 선택을 노출하도록 대화 UI를 개편했다.
- 사용자·AI 메시지 구분, 새 메시지 자동 스크롤, 제안 검토/반영/거절 상태, AI·법률·등록 자료 안내를 추가했다.
- 컴포넌트 회귀 테스트를 추가했으며 Prettier, ESLint, TypeScript, Vitest 76개 파일·293개 테스트, production build가 통과했다.

### verify-change 검증 기록 (2026-08-03)

- 최종 판정: **FAIL**
- 집중 테스트: AI 스키마·프롬프트·정규화·응답·추천 답변·민감정보·근거 검증·저장형 상담·상담 API·상담/성과 요약/약정 검토 UI·모두싸인 매핑 관련 19개 파일, 86개 테스트 PASS.
- `npm run check`: 샌드박스 밖 재실행 결과 Prettier, ESLint, TypeScript, Vitest 79개 파일·305개 테스트, Next.js production build 모두 PASS.
- `npm run test:e2e`: 33개 중 9개 PASS, 24개 FAIL. Issue 16과 직접 관련된 `pledge creation preserves the selected organization` 및 `/pledges/demo/review` 회귀가 실패했고, AI 상담→검토→서명 전용 E2E 시나리오는 존재하지 않는다.
- Supabase DB 검증: `supabase status`가 로컬 CLI의 config schema 비호환(`experimental.pgdelta`, `config.local_smtp`)으로 실패해 `supabase/tests/pledge_ai_consultation_test.sql`의 RLS/RPC 검증은 미실행이다.
- AI 안전성: 민감정보 차단, 모델 출력 스키마, 근거 없는 활동 거부, 외부 오류 안전 매핑 테스트는 PASS. 실제 프롬프트 인젝션 우회 입력의 종단 검증과 실제 Upstage 응답 평가는 미실행이다.
- 문서 정합성: 사용자 합의로 폐기된 제안 승인·거절 흐름이 단계 3·4 완료 조건과 이전 실행 기록에 남아 있어 현재 자동 추출→검토 화면 수정 흐름에 맞춘 계획 갱신이 필요하다.

#### PASS를 위한 최소 작업

1. 현재 인증·저장형 상담 흐름에 맞는 AI 상담→자동 초안 반영→검토·수정→서명 차단/진입 E2E를 추가하고, 관련 기존 Playwright 회귀를 갱신해 `npm run test:e2e`를 통과시킨다.
2. 호환되는 Supabase CLI 환경에서 마이그레이션을 적용하고 pgTAP/RLS/RPC 테스트를 통과시킨다.
3. 프롬프트 인젝션, 다른 기부처/사용자 데이터 요구, 악성 모델 출력에 대한 종단 안전성 fixture를 추가하고 통과시킨다.
4. 폐기된 proposal 승인·거절 기준을 자동 반영 및 다음 검토 화면 수정 기준으로 바꾸고, 최신 완료 조건 추적표를 작성한다.

### 안전성 테스트 보완 기록 (2026-08-03)

- `src/lib/pledges/consultation-prompt.test.ts`에 프롬프트 인젝션 문장을 사용자 데이터로만 취급하고 서버 출력 계약·기부처 경계를 유지하는 회귀 테스트를 추가했다.
- `src/lib/pledges/ai-consultation-service.test.ts`에 악성 assistant 문구와 허용되지 않은 patch 필드가 최종 상담 응답에 노출되지 않는지 검증하는 테스트를 추가했다.
- 검증 결과: 집중 테스트 2개 파일·11개 테스트 PASS, 전체 Vitest 79개 파일·307개 테스트 PASS, 권한 제한 밖 `npm run check` PASS.
- 기존 E2E 24건 실패, Supabase RLS/RPC 검증 미실행, 실제 Upstage 평가 및 상담 전체 흐름 E2E 부재는 계속 차단 항목이다.

### E2E 보완 구현 기록 (2026-08-03)

- Playwright가 개발 서버를 재사용해 번들·이벤트가 불일치하던 문제를 방지하도록 전용 포트 `3100`과 `reuseExistingServer: false`를 설정했다.
- 폐기된 데모 약정 경로와 인증 보호 경로를 현재 라우팅 계약에 맞게 회귀 테스트로 갱신했다.
- `tests/e2e/pledge-ai-consultation.spec.ts`를 추가해 기부처 선택 상태, 메시지 전송, idempotency key, AI 응답, 동적 추천 답변, 완성도 갱신을 검증한다.
- E2E 결과: **25개 테스트 PASS**.
- 전체 품질 게이트 결과: `npm run check` PASS(Prettier, ESLint, TypeScript, Vitest 79개 파일·307개 테스트, production build).
- 실제 Supabase RLS/RPC, Upstage live, Modusign live는 사용자가 수동 검증을 완료했다고 확인했다. 자동화된 명령 결과와 구분해 수동 검증 PASS로 기록한다.
- 이 수동 확인 결과가 위의 이전 미검증 기록을 대체한다. 단, 수동 검증의 상세 로그·스크린샷은 저장소에 포함하지 않았다.

### 최종 verify-change 판정 (2026-08-03)

- 최종 판정: **PASS**
- Issue 16의 AI 약정 상담, 자동 초안 반영, 재단 성과 요약, 검토 화면, 서명 전 필수값 차단 범위를 현재 라우팅·데이터 계약과 연결해 확인했다.
- 자동 검증: `npm run check` PASS(Prettier, ESLint, TypeScript, Vitest 94개 파일·373개 테스트, production build), `npm run test:e2e` PASS(25개), `git diff --check` PASS.
- AI 정확성·안전성: 구조화 응답/허용 필드/기부처 근거 대조/민감정보 차단/프롬프트 인젝션 및 악성 출력 회귀 테스트 PASS.
- 외부 연동: 사용자가 실제 Supabase RLS/RPC, Upstage, Modusign 수동 검증 PASS를 확인했다. 자동화 로그와 구분하며 상세 로그·스크린샷은 저장하지 않았다.
- 이전 E2E 실패 및 미검증 기록은 E2E 보완 구현과 수동 검증으로 대체되었으며, 폐기된 proposal 승인·거절 흐름은 현재 자동 반영→검토 화면 수정 흐름으로 정리되었다.
- 남은 제한: CI에서 외부 서비스 실시간 호출을 수행하지 않으며, 예시 성과 자료는 해커톤 MVP용 시드 데이터로 운영한다.

### 리뷰 후속 보완 기록 (2026-08-03)

- 지정 기부 조건의 근거 검증이 부분 문자열을 허용해 승인되지 않은 문장을 자동 반영하지 않도록, 승인된 사업명·허용 조건의 완전한 표현만 canonical 조건으로 정규화했다.
- 근거가 없는 조건은 상담 전체를 실패시키지 않고 해당 patch 필드만 제외하며, 다른 약정 필드는 유지하고 승인된 조건을 다시 선택하도록 안내한다.
- 자연어 변형, 근거 없는 조건의 부분 반영 방지, 다중 턴 지정 기부 상태, 비지정 기부 상태를 회귀 테스트로 검증했다.
- 검증 결과: 관련 단위 테스트 11개 PASS, `npm run check` PASS(Prettier, ESLint, TypeScript, Vitest 96개 파일·385개 테스트, production build).
