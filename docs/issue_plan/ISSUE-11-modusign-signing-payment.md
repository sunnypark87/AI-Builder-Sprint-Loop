# Issue 구현 계획

## 1. 이슈 개요

- 대상 이슈: [#11 `[Feat] 모두싸인 MCP 기반 전자서명 및 결제 상태 플로우 구현`](https://github.com/sunnypark87/AI-Builder-Sprint-Loop/issues/11)
- 우선순위: P0
- 상태: Open
- 담당자: `sunnypark87`
- 작성일: 2026-08-01
- 작업 브랜치: `feature/11-modusign-signing-payment`

기본 입력 폼에서 생성한 기부 약정을 Supabase에 저장하고 모두싸인 템플릿 기반 서명 요청과 연결한다. 기부자와 기부처가 정해진 순서로 서명한 경우에만 계약을 완료하고 데모 결제 화면 접근을 허용한다. 실제 PG 결제 없이 완료·실패·취소 상태만 저장한다.

모두싸인 MCP는 API 계약과 템플릿을 조사하는 개발 도구로만 사용한다. 런타임에서는 서버 전용 클라이언트가 모두싸인 API를 직접 호출하며, 외부 상태는 인증된 Webhook과 문서 상세 조회로 검증한다.

## 2. 현재 저장소 상태

| 요구사항           | 현재 상태                                                                                                                                                                                                            | 필요한 작업                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 모두싸인 인증      | `MODUSIGN_AUTH_KEY`로 실제 API 인증과 템플릿 조회에 성공했다. `.env.example`에도 서버/MCP 전용 변수 이름이 추가되었다.                                                                                               | 런타임 환경 검증과 서버 전용 클라이언트를 구현하고 인증값 비노출 테스트를 추가한다.                                      |
| 모두싸인 템플릿    | `기부 약정 기본 템플릿`(`38ee3310-8d79-11f1-9fa9-c50a521cd0a6`)이 존재한다. 기부자 1순위, 기부처 2순위이며 기부자 필드 31개와 기부처 서명 필드 1개다. 주민등록번호 필드는 필수이고 사업자등록번호는 수집하지 않는다. | 31개 필드와 기부처 서명 필드를 의미 있는 데이터 라벨로 정리하고 약정 입력값과 매핑한다. 양측 순차 서명을 smoke test한다. |
| API 기능           | 템플릿 요청, 문서 상세 조회, 임베디드 참여 링크, Webhook API 계약과 서버 전용 클라이언트를 구현했다.                                                                                                                 | 실제 약정과 연결된 요청·응답 smoke test와 재동기화·타임아웃 검증을 완료한다.                                             |
| 약정 입력·미리보기 | `/donate/[organizationId]/consultation`, `/summary`, `/pledges/demo/*`가 mock 데이터와 query string에 의존한다.                                                                                                      | 입력 검증, 인증 사용자·기부처 연결, 약정 초안 저장과 ID 기반 경로를 구현한다.                                            |
| 기부자 서명        | `PledgeSignForm`은 체크박스와 링크만 제공하며 실제 서명을 생성하지 않는다.                                                                                                                                           | 서버에서 모두싸인 요청과 임베디드 서명 링크를 만들고 저장된 상태를 표시한다.                                             |
| 기부처 서명        | `/partner/pledges`와 상세 화면이 정적 배열과 확인 Dialog에 의존한다. `/partner` 권한 검사도 없다.                                                                                                                    | 조직 멤버십, 파트너 레이아웃 guard, 실제 목록·상세·서명 권한을 구현한다.                                                 |
| 상태 동기화        | 문서 상세 재조회·상태 매퍼·Webhook 이벤트 저장소와 Route Handler 기반을 구현했고 ngrok 로컬 수신 200을 확인했다.                                                                                                     | 실제 서비스 약정과 연결된 이벤트 상태 갱신 및 Vercel 수신을 검증한다.                                                    |
| 결제·영수증        | 결제 화면과 결과 화면이 단순 링크이며 데이터 저장과 접근 제어가 없다. 영수증 기능도 없다.                                                                                                                            | 서명 완료 상태를 서버에서 확인하고 데모 결제 완료·실패·취소와 입력 정보 기반 데모 영수증을 저장·조회한다.                |
| 데이터·RLS         | 서명·결제·영수증 도메인 마이그레이션과 RLS 초안을 작성해 연결된 Supabase 프로젝트에 적용했다.                                                                                                                        | 역할별 RLS SQL 검증과 상태 변경 권한 검증을 완료한다.                                                                    |
| 자동 검증          | 도메인·모두싸인 클라이언트·요청 builder·Webhook 보안·API 단위 테스트를 추가했다.                                                                                                                                     | 전체 `npm run check`와 `verify-change`를 실행하고 통합 smoke 결과를 기록한다.                                            |

## 3. 선행 결정

### 확인 완료

- [x] 모두싸인 API 인증과 템플릿 조회가 가능하다.
- [x] MCP에서 템플릿 요청, 문서 상세, 임베디드 참여 링크와 Webhook API 계약을 확인했다.
- [x] 템플릿의 서명 순서는 기부자 1 → 기부처 2다.
- [x] 런타임 인증값은 `MODUSIGN_AUTH_KEY` 하나로 관리하며 서버/MCP 전용 비밀값으로 취급한다.

### 구현 전 확정 필요

- [x] 31개 기부자 필드와 기부처 서명 필드 1개의 의미 및 내부 약정 필드 매핑을 확정했다.
- [ ] 기부자 → 기부처 순차 서명이 실제 테스트 문서에서 완료되는지 검증한다.
- [x] MVP는 앱 인증 후 서버에서 발급한 모두싸인 임베디드 보안 링크를 사용하는 것으로 확정한다.
- [x] Webhook 인증 헤더, 이벤트 식별자·재전송 정책과 실제 payload를 확인한다.
- [x] Webhook은 변경 신호로만 사용하고 인증된 문서 상세 응답을 내부 상태의 최종 근거로 삼는다.
- [ ] 기부처 사용자는 `organization_members`의 `owner` 또는 `signer`만 서명할 수 있게 한다.
- [ ] Auth 이메일을 서명 연락처로 사용할지, 법적 표시 이름을 어디에서 받을지 확정한다.
- [ ] 약정은 `draft`에서만 수정하고 서명 요청 후 변경은 취소 후 새 약정 생성으로 제한한다.
- [ ] 약정당 데모 결제는 한 건만 허용하며 종료 상태 이후 재시도는 이번 MVP에서 제외한다.
- [x] 개인 기부자의 주민등록번호를 수집·암호화 저장하고 모두싸인 문서의 필수 필드에 매핑한다. 사업자등록번호는 수집하지 않는다.
- [x] 기부자와 기부처 모두 앱 로그인 계정에 연결된 이메일로 `SECURE_LINK` 참여자를 생성하고 앱 내 iframe에서 서명한다. `MODUSIGN_AUTH_KEY`는 서버의 문서 생성·조회 인증에만 사용한다.
- [x] 기부 목적과 기부 조건을 문서의 `donationCondition` 필드에 함께 기록한다.
- [x] 기부금 영수증은 실제 세무·국세청 발급이 아닌 서명 완료 약정의 입력 정보 기반 데모 문서로 생성한다.
- [ ] 기존 `demo` 경로는 ID 기반 정식 경로로 리다이렉트할지 제거할지 결정한다.

## 4. 구현 단계

### 단계 0. 모두싸인 연동 계약 고정

#### 작업 내용

- 템플릿의 기부자 31개 필드를 금액, 유형, 조건, 납부 방식, 동의, 이름과 서명 필드에 매핑한다.
- 주민등록번호는 개인 기부자에게만 수집하고 AES-256-GCM으로 암호화 저장한다. API 응답·로그에는 원문을 노출하지 않으며 서명 요청 시 서버에서만 복호화한다. 사업자등록번호는 수집하지 않는다.
- 영수증 발급 희망 여부와 데모 영수증에 필요한 이름·주소·금액·약정일 필드를 매핑한다.
- 기부처 서명 필드와 역할 설정을 실제 테스트 문서로 검증한다.
- 문서 생성·상세 조회·임베디드 링크·Webhook 요청과 응답의 최소 fixture를 만든다.
- 문서·참여자 상태, 거절·취소·만료, 링크 유효기간과 재발급 정책을 기록한다.
- `MODUSIGN_TEMPLATE_ID`와 Webhook 인증에 필요한 환경 변수 이름을 정한다.

#### 완료 조건

- [x] fixture 하나로 템플릿 요청 body와 예상 상태 응답을 재현할 수 있다.
- [x] 모든 필드가 내부 약정 데이터와 일대일로 추적된다.
- [ ] 기부자 → 기부처 실제 순차 서명이 확인된다.
- [ ] 주민등록번호/사업자번호 없이도 템플릿 요청이 생성되고 서명이 진행된다.

### 단계 1. 조직·사용자·서명자 권한 모델 확정

#### 작업 내용

- `organizations`와 `organization_members` 구조를 정의한다.
- 멤버 역할을 `owner | signer | viewer`로 제한하고 서명 가능 역할을 정한다.
- 기부자와 기부처 서명자의 표시 이름·이메일 출처를 정한다.
- mock 조직을 DB seed로 이동하는 범위와 데모 계정 membership 생성 절차를 기록한다.
- 동적 ID 경로와 기존 `demo` 경로 호환 정책을 결정한다.

#### 완료 조건

- [ ] 기부자·같은 조직 signer·다른 조직·익명 역할별 접근 매트릭스가 확정된다.
- [ ] 데모 환경에서 조직과 담당자 연결을 재현할 수 있다.

### 단계 2. 순수 도메인 상태 모델 구현

#### 작업 내용

- 약정 상태를 `draft → awaiting_donor_signature → awaiting_organization_signature → signed`로 정의한다.
- `declined | cancelled | expired`를 종료 상태로 정의한다.
- 서명 참여자 상태를 `waiting → signed | declined`로 분리한다.
- 동기화 상태를 `idle | syncing | failed | reconciliation_required`로 분리한다.
- 결제 상태를 `pending → completed | failed | cancelled`로 정의한다.
- 수정 가능 여부, 결제 가능 여부, 외부 상태 매핑과 상태 전이를 순수 함수로 구현한다.

#### 완료 조건

- [ ] 기부처 선서명, 완료 상태 후퇴, 종료 상태 재진행이 차단된다.
- [ ] 양측 서명이 검증된 약정만 결제 가능하다.
- [ ] 알 수 없는 외부 상태는 fail-closed로 처리된다.

### 단계 3. Supabase 스키마와 개발 seed 작성

#### 작업 내용

- `organizations`, `organization_members`, `pledges`, `signature_documents`, `signature_participants`, `modusign_webhook_events`, `demo_payments` 테이블을 마이그레이션으로 추가한다.
- 상태는 `text + check constraint`로 제한하고 FK, 유일성 제약과 조회 인덱스를 추가한다.
- 약정당 문서·결제 한 건, 외부 문서 ID·멱등성 키 유일성을 보장한다.
- 금액 양수, `KRW`, 유효한 날짜 범위와 참여자 역할·순서 제약을 추가한다.
- mock 조직과 테스트 membership을 재현 가능한 seed로 제공한다.

#### 완료 조건

- [ ] 마이그레이션 reset과 seed를 반복 실행할 수 있다.
- [ ] 데이터 계층에서 중복 문서·결제와 잘못된 상태값이 차단된다.

### 단계 4. RLS와 원자적 상태 변경 구현

#### 작업 내용

- 기부자는 자기 약정·서명·결제만, 기부처는 소속 조직 데이터만 조회하도록 RLS를 작성한다.
- `organization_members`와 Webhook 이벤트의 직접 접근을 최소화한다.
- 초안 생성·수정, 서명 요청 claim, 검증된 서명 상태 반영과 결제 생성을 제한된 DB 함수 또는 서버 트랜잭션으로 처리한다.
- 일반 클라이언트가 `signed`나 결제 완료 상태를 직접 설정하지 못하게 한다.
- `/partner/layout.tsx`에서 로그인과 membership을 서버 검증한다.

#### 완료 조건

- [ ] 기부자·같은 조직·다른 조직·익명 역할별 허용·거부 SQL 검증이 통과한다.
- [ ] 직접 상태 위조와 다른 사용자 데이터 접근이 차단된다.

### 단계 5. 서버 전용 모두싸인 클라이언트 구현

#### 작업 내용

- 환경 변수 검증, Basic 인증 헤더, 요청 직렬화, 응답 런타임 검증을 구현한다.
- 템플릿 문서 생성, 문서 상세 조회와 임베디드 참여 링크 조회 메서드를 구현한다.
- 타임아웃, 401·404·409·429·5xx를 안전한 내부 오류 코드로 변환한다.
- 인증값, 참여자 연락처, 서명 링크와 원문 외부 오류를 로그와 클라이언트 응답에서 제거한다.

#### 완료 조건

- [ ] 외부 네트워크 없이 Mock으로 정상·오류·타임아웃을 검증할 수 있다.
- [ ] `Basic ` 접두사가 정확히 한 번 적용되고 비밀정보가 노출되지 않는다.

### 단계 6. 저장형 약정 생성 vertical slice

#### 작업 내용

- 상담 폼 입력을 서버에서 검증하고 인증 사용자·organization과 연결된 `draft`를 생성한다.
- 검토 화면을 `/pledges/[pledgeId]/review`로 전환한다.
- 금액, 유형, 목적, 기간, 공개 조건과 동의 항목을 저장한다.
- 익명, 잘못된 organization, 다른 사용자의 약정과 빈 상태를 처리한다.

#### 완료 조건

- [ ] 유효한 입력만 저장되고 기부자는 자신의 초안만 조회·수정한다.
- [ ] mock query string 없이 저장된 데이터로 검토 화면이 렌더링된다.

### 단계 7. 멱등한 서명 요청 생성

#### 작업 내용

- `POST /api/pledges/[pledgeId]/signature-request`를 구현한다.
- `signature_documents` unique claim으로 문서 생성을 중복 방지하고 기존 문서를 확인한다.
- 템플릿 필드와 참여자를 매핑해 모두싸인 문서를 생성하고 외부 ID를 저장한다.
- 성공 시 `awaiting_donor_signature`, 명확한 실패는 재시도 가능한 상태로 처리한다.
- 생성 여부가 불명확한 타임아웃은 `reconciliation_required`로 두고 자동 중복 생성을 금지한다.

#### 완료 조건

- [ ] 중복 클릭과 동시 요청에도 약정당 외부 문서가 하나만 연결된다.
- [ ] 외부 성공 후 내부 저장 실패를 복구하거나 재조정 대상으로 식별할 수 있다.

### 단계 8. Webhook과 상태 재동기화 구현

#### 작업 내용

- `POST /api/modusign/webhook`과 `POST /api/pledges/[pledgeId]/sync`를 구현한다.
- Webhook 인증과 이벤트 멱등성을 검증하고 원문 payload는 기본적으로 저장하지 않는다.
- 공식 payload의 `event.type`과 `document.id`를 파싱하고 별도 이벤트 ID가 없을 때 문서·이벤트 타입 조합을 멱등 키로 사용한다.
- 이벤트 수신 후 문서 상세 API를 재조회해 참여자와 약정 상태를 트랜잭션으로 갱신한다.
- 중복·역순 이벤트, 미등록 문서, 외부 조회 실패와 알 수 없는 상태를 안전하게 처리한다.
- 대기 화면 진입과 사용자 새로고침을 제한된 보조 동기화 경로로 사용한다.

#### 완료 조건

- [ ] 기부자 완료 후에만 기부처 순서로, 양측 완료 후에만 `signed`로 전이된다.
- [ ] 위조·중복·역순 Webhook이 데이터 손상이나 상태 후퇴를 만들지 않는다.

### 단계 9. 기부자 전자서명 UI 구현

#### 작업 내용

- `/pledges/[pledgeId]/sign`과 `/waiting`을 저장 상태 기반으로 구현한다.
- 서버에서 권한과 현재 순서를 확인한 뒤 유효시간이 짧은 임베디드 서명 링크를 발급한다.
- 대기·완료·거절·취소·만료·동기화 오류와 복구 행동을 표시한다.
- 양측 완료 전에는 결제 CTA를 노출하지 않는다.

#### 완료 조건

- [ ] 기부자는 자신의 현재 차례에만 서명 링크를 받을 수 있다.
- [ ] 링크를 장기 저장하지 않고 상태별 다음 행동을 정확히 안내한다.

### 단계 10. 기부처 서명 UI 구현

#### 작업 내용

- `/partner/pledges`를 실제 조직 약정 목록과 상태 필터로 교체한다.
- `/partner/pledges/[pledgeId]`에서 약정과 기부자 서명 상태를 검토한다.
- 기부자 서명이 검증된 경우에만 기부처 임베디드 서명 링크를 발급한다.
- 다른 조직, 미인증, `viewer`, 잘못된 상태와 종료된 약정을 서버에서 차단한다.

#### 완료 조건

- [ ] `owner`와 `signer`만 소속 조직의 서명 대기 약정을 처리한다.
- [ ] 양측 완료 후 계약과 기부자 결제 가능 상태가 일관되게 갱신된다.

### 단계 11. 계약 상태 기반 데모 결제 구현

#### 작업 내용

- `/donations/[pledgeId]/payment`와 결과 화면을 저장 데이터 기반으로 전환한다.
- `POST /api/pledges/[pledgeId]/demo-payment`에서 인증·소유권·`signed` 상태를 재검증한다.
- 금융정보를 받지 않고 선택한 데모 수단과 `completed | failed | cancelled` 결과만 저장한다.
- 동일 멱등성 키와 약정 중복 요청에는 기존 결제를 반환한다.
- 서명 완료 약정에서만 데모 영수증을 생성하고, 입력 정보와 약정·결제 식별자만 포함한 조회 화면을 제공한다.
- 영수증에는 `데모 발급본`과 실제 세무 효력이 없다는 안내를 표시한다.

권장 API:

```text
POST /api/pledges/[pledgeId]/receipt
GET /api/pledges/[pledgeId]/receipt
```

#### 완료 조건

- [ ] 계약 완료 전 URL 직접 접근과 결제 생성이 차단된다.
- [ ] 실제 금액 이동 없이 결과를 저장하고 다시 조회할 수 있다.
- [ ] 종료된 결제 상태의 재전환과 중복 레코드가 차단된다.
- [ ] 서명 완료 전 영수증 생성이 차단되고 영수증 재요청에도 중복 문서가 생기지 않는다.

### 단계 12. 통합·보안·문서 검증

#### 작업 내용

- 외부 API와 Supabase를 Mock한 전체 사용자 흐름 테스트를 추가한다.
- 로컬 Supabase에서 실제 RLS 역할 매트릭스를 검증한다.
- 실제 모두싸인 테스트 문서 한 건으로 필드 치환, 순차 서명, Webhook, 상태 조회와 결제 접근을 smoke test한다.
- `.env.example`, README, AGENTS와 이 계획의 실행 결과를 갱신한다.
- 가까운 테스트부터 실행한 후 `npm run check`와 `verify-change`를 수행한다.

#### 완료 조건

- [ ] 모든 Issue 완료 조건이 구현 파일과 검증 증거에 연결된다.
- [ ] `npm run check`와 `verify-change`가 차단 항목 없이 통과한다.

## 5. 테스트 및 검증 계획

| 완료 조건           | 테스트 유형  | 주요 검증 사례                                                            | 예상 위치 또는 방법                              |
| ------------------- | ------------ | ------------------------------------------------------------------------- | ------------------------------------------------ |
| 상태 전이           | 단위         | 정상 전이, 선서명, 종료 상태, 후퇴, 미지 상태 fail-closed                 | `src/lib/pledges/*.test.ts`                      |
| 결제 가능 판정      | 단위         | 양측 완료 조건, 미완료·취소·만료 차단                                     | `src/lib/payments/*.test.ts`                     |
| 템플릿 매핑         | 단위         | 35개 라벨의 누락·중복·형식 오류                                           | `src/lib/modusign/template-mapping.test.ts`      |
| 모두싸인 클라이언트 | 단위         | env 누락, 인증 헤더, malformed 응답, 401·429·5xx·timeout, 비밀정보 비노출 | `src/lib/modusign/*.test.ts`                     |
| 약정·서명 API       | 통합         | 익명 401, 소유권, 입력 오류, 동시·중복 요청, 외부/DB 실패                 | Route Handler 테스트                             |
| Webhook             | 통합         | 인증 누락·위조, 재전송, 역순, 미등록 문서, 상세 조회 실패, raw PII 비저장 | `src/app/api/modusign/webhook/route.test.ts`     |
| RLS                 | SQL 통합     | 기부자·같은 조직·다른 조직·익명 SELECT/INSERT/UPDATE 매트릭스             | 로컬 Supabase SQL 검증                           |
| 기부자 UI           | 컴포넌트/E2E | 필수값, 인증 redirect, 상태 CTA, 링크 만료, 외부 서명 return              | Testing Library/Playwright                       |
| 기부처 UI           | 컴포넌트/E2E | membership guard, 상태 필터, 기부자 서명 전 차단                          | Testing Library/Playwright                       |
| 데모 결제           | API/UI       | 직접 접근 차단, 완료·실패·취소, 중복 submit, 결과 재조회                  | API 및 UI 테스트                                 |
| 데모 영수증         | API/UI       | 서명 완료 조건, 입력 정보 기반 생성, 중복 생성 방지, 세무 효력 안내       | `src/lib/receipts/*.test.ts` 및 결과 화면 테스트 |
| 실제 연동           | 수동 smoke   | 필드 치환, 1→2 순차 서명, Webhook·상세 일치, 완료 후 결제                 | 테스트 문서 1건, 개인정보 제외                   |
| 전체 완료           | 저장소 전체  | 포맷·린트·타입·테스트·빌드 및 완료 조건 추적                              | `npm run check`, `verify-change`                 |

AI 동작 변경 여부는 `해당 없음`이다. 이번 이슈는 프롬프트나 모델 호출이 아닌 외부 전자서명 API와 결정적 상태 전이를 변경한다. 대신 외부 응답을 신뢰 경계로 취급하고 Webhook 인증, 응답 스키마, 개인정보·인증값 비노출, 재시도와 외부 장애를 안전성 사례로 검증한다.

## 6. 예상 산출물

```text
.env.example
AGENTS.md
README.md
docs/issue_plan/ISSUE-11-modusign-signing-payment.md
supabase/migrations/*_create_signing_payment_domain.sql
supabase/seed.sql
src/lib/modusign/
src/lib/pledges/
src/lib/payments/
src/lib/receipts/
src/app/api/pledges/[pledgeId]/signature-request/
src/app/api/pledges/[pledgeId]/signature-link/
src/app/api/pledges/[pledgeId]/sync/
src/app/api/pledges/[pledgeId]/demo-payment/
src/app/api/pledges/[pledgeId]/receipt/
src/app/api/modusign/webhook/
src/app/pledges/[pledgeId]/review/
src/app/pledges/[pledgeId]/sign/
src/app/pledges/[pledgeId]/waiting/
src/app/partner/pledges/[pledgeId]/
src/app/donations/[pledgeId]/payment/
src/app/donations/[pledgeId]/payment/result/
src/app/donations/[pledgeId]/receipt/
src/components/pledges/
src/components/donations/
```

정확한 파일 분리는 구현 중 기존 패턴을 따르되 외부 API, 도메인 규칙, 데이터 접근과 UI의 책임을 분리한다.

## 7. 권장 작업 순서와 의존성

| 순서 | 작업                         | 선행 조건              | 결과                          |
| ---- | ---------------------------- | ---------------------- | ----------------------------- |
| 0    | 모두싸인 연동 계약·필드 매핑 | 템플릿/API 권한        | 재현 가능한 요청·응답 fixture |
| 1    | 조직·권한·서명자 모델        | Auth 사용자 정책       | 역할별 접근 매트릭스          |
| 2    | 순수 상태 모델과 테스트      | 단계 0·1 결정          | 공통 상태 전이 규칙           |
| 3    | DB 스키마·seed               | 도메인 모델            | 반복 가능한 마이그레이션      |
| 4    | RLS·원자적 함수              | 스키마·접근 매트릭스   | 최소 권한 데이터 계층         |
| 5    | 모두싸인 클라이언트          | 연동 fixture           | Mock 가능한 서버 어댑터       |
| 6    | 저장형 약정 vertical slice   | DB·RLS                 | 초안 생성·검토 흐름           |
| 7    | 서명 요청 생성               | 약정·클라이언트        | 멱등한 외부 문서 연결         |
| 8    | Webhook·재동기화             | 외부 문서 연결         | 검증된 상태 동기화            |
| 9    | 기부자 서명 UI               | 서명 API·상태          | 기부자 서명·대기 흐름         |
| 10   | 기부처 서명 UI               | membership·기부자 완료 | 기부처 순차 서명 흐름         |
| 11   | 데모 결제                    | `signed` 판정          | 접근 제어와 결과 저장         |
| 12   | 통합·보안·문서 검증          | 전체 기능              | 완료 조건 추적과 최종 판정    |

각 단계는 가까운 테스트가 통과한 뒤 다음 단계로 진행한다. 첫 구현 단위는 단계 0~2이며, 필드 매핑·권한 모델·상태 규칙을 고정한 뒤 마이그레이션을 작성한다.

## 8. 전체 완료 기준

- [ ] 모두싸인 템플릿 필드와 내부 약정 데이터 매핑이 검증된다.
- [ ] 기부자와 기부처가 정해진 순서로 실제 테스트 서명을 완료한다.
- [ ] 약정이 인증 사용자와 기부처에 연결되어 저장된다.
- [ ] 외부 문서·참여자 상태가 Webhook과 상세 조회로 멱등하게 동기화된다.
- [ ] 양측 서명 완료 후에만 계약이 `signed`가 되고 결제 접근이 열린다.
- [ ] 실제 결제 없이 완료·실패·취소를 저장하고 조회한다.
- [ ] 중복 서명 요청·중복 결제·비정상 상태 변경이 차단된다.
- [ ] Auth, RLS, Webhook 인증과 비밀정보·개인정보 비노출 테스트가 통과한다.
- [ ] 문서와 환경 변수·마이그레이션·배포 영향이 갱신된다.
- [ ] `npm run check` 통과
- [ ] `verify-change` PASS 및 차단 항목 없음
- [ ] PR에 완료 조건별 검증 결과 기록

## 9. 범위에서 제외할 작업

- Upstage AI 기반 대화형 약정서 작성과 프롬프트·모델 변경
- 실제 PG사 또는 결제 API, 금액 이동, 환불
- 카드번호·계좌번호·간편결제 계정 등 금융정보 수집
- 정기·자동 결제와 결제 재시도 이력 모델
- 실제 국세청·세무 시스템 연동, 법적 효력이 있는 기부금 영수증 발급, 정산·회계 기능
- 모두싸인 외 전자서명 공급자와 범용 공급자 추상화
- 서명 요청 후 약정 수정·재발행 워크플로우
- 복수 조직 전환 UI와 복잡한 권한 관리 UI
- 이슈와 무관한 기존 mock 화면 및 디자인 시스템 전면 개편

## 10. 주요 위험과 대응

| 위험                                   | 영향                                          | 대응                                                                                     |
| -------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 템플릿 라벨이 해시이고 의미가 불명확함 | 잘못된 필드 치환과 계약 내용 오류             | 안정적인 데이터 라벨로 템플릿을 정리하고 fixture·실제 문서로 검증한다.                   |
| 선택 개인정보가 입력될 수 있음         | 주민등록번호·사업자번호 노출 위험             | 기본값은 미수집으로 하고 입력 시 마스킹·로그 제외·최소 응답 원칙을 적용한다.             |
| 기부처 역할의 필드가 0개임             | 2순위 서명이 불가능하거나 의미 없는 단계가 됨 | 실제 테스트 요청으로 확인하고 필요하면 필수 서명 필드를 추가한다.                        |
| 외부 생성 후 내부 저장 전 장애         | 외부 문서 중복 생성                           | 원자적 claim과 내부 멱등 키를 사용하고 불명확한 결과는 `reconciliation_required`로 둔다. |
| Webhook 위조·재전송·역순               | 계약 상태 오판과 조기 결제                    | Webhook 인증, 이벤트 중복 방지, 상세 API 재조회와 단조 상태 전이를 적용한다.             |
| 외부 상태와 내부 상태 불일치           | 대기 고착 또는 잘못된 완료                    | 명시적 상태 매퍼, 수동 sync와 실패 재처리를 제공한다.                                    |
| 기부처 계정 연결이 불명확함            | 과도한 조회·서명 권한                         | `organization_members`와 역할별 접근 매트릭스를 선행 확정한다.                           |
| RLS만 있고 서버 상태 검증이 약함       | 클라이언트가 상태를 위조                      | 상태 변경은 제한된 DB 함수 또는 서버 관리자 경계에서만 수행한다.                         |
| 인증값·서명 링크·PII 노출              | 보안 사고                                     | 서버 전용 변수, 응답 축소, 로그 마스킹과 비노출 테스트를 적용한다.                       |
| 실제 외부 API에 의존하는 자동 테스트   | 느리고 불안정한 CI                            | 자동 테스트는 전부 Mock하고 테스트 문서 1건만 별도 smoke test한다.                       |
| 큰 이슈 범위                           | 구현·검증 누락                                | 단계별 vertical slice와 완료 조건을 통과한 뒤 다음 단계로 이동한다.                      |

## 11. 실행 결과

### 변경 내용

- 모두싸인 임베디드 템플릿 화면을 서버 측 임시 캡처로 확인하고, 실제 2페이지 표 구조·필드 순서·개인정보 동의 구성을 편집 가능한 HTML 약정서에 반영했다.
- 수정된 `기부 약정 기본 템플릿`을 다시 조회해 템플릿 ID와 31개 기부자 필드 라벨을 갱신했다. 제거된 익명·담당자·부서·배분 기간 입력을 검토 화면에서 정리하고, 새 기타 납부 주기·방법 텍스트 필드를 저장 및 서명 요청에 연결했다.
- 템플릿 편집 권한이 포함된 임베디드 URL은 기부자에게 노출하지 않고 앱 내부 문서 UI만 사용하도록 보안 경계를 유지했다.
- review 화면을 1440px 작업 공간으로 확장하고 문서 그림자 제거, 패널 간격, sticky 대화 영역, CTA 위계와 추천 질문 스타일을 디자인 시스템에 맞게 개선했다.
- 기부 약정 UX를 단계형 화면에서 상담형 작업 공간으로 전환했다.
- 상담 화면에 실제 AI 호출 없이 동작하는 mock 채팅 UI와 `약정서 확인하기` CTA를 추가했다.
- 불완전한 draft도 생성·저장할 수 있도록 draft 검증과 약정 컬럼을 완화하고 서명 직전에 필수값을 검증하도록 했다.
- review 화면을 약정서·대화 2열 구조로 변경하고, mock 변경 제안을 승인해 약정서에 반영하는 흐름을 추가했다.
- 약정별 대화 메시지 저장 테이블과 donor RLS를 추가했다.
- 서명 화면에서는 단계 표시를 제거하고 약정서 확인·대화·서명이라는 작업 중심 흐름을 유지했다.
- 상담 화면에서 인증 사용자 기준으로 `draft` 약정을 생성하고 동적 review 경로로 이동하도록 연결했다.
- `pledges/[pledgeId]/review`에 실제 약정서 형태의 편집 화면과 약정 조회·수정 API를 추가했다.
- 기부자·기부재단용 임베디드 모두싸인 서명 링크 API와 동적 서명·대기·재단 상세 화면을 추가했다.
- 파트너 약정 목록을 조직 멤버십과 실제 Supabase 약정 데이터 기반으로 전환하고 파트너 레이아웃 인증 guard를 추가했다.
- 환경변수로 데모 기부자·기부처 Auth 계정을 생성·갱신하고, 기부처 계정을 조직의 유일한 대표 서명자 membership으로 연결하는 `npm run demo:accounts`를 추가했다.
- 기부자와 기부처 모두 앱 계정 이메일을 `SECURE_LINK` 참여자로 사용하고, 모두싸인 개인 계정은 서버 API 인증에만 사용하도록 분리했다.
- 기존 상담 summary와 서명 관련 demo 데이터 화면은 호환 리다이렉트로 정리했으며 결제 demo 화면은 유지했다.
- 약정 생성 API의 `donor_address`·`donor_contact` 컬럼 매핑 오류를 수정했다.
- `MODUSIGN_AUTH_KEY`를 이용한 모두싸인 인증과 템플릿 조회를 확인했다.
- 기부 약정서 템플릿 ID, 참여자 역할·순서와 필드 개수를 확인했다.
- 주민등록번호 필드가 필수 항목(`required: true`)으로 변경되었고, 기부처 서명 필드(`e8127468`)가 2순위에 추가된 것을 확인했다.
- 실제 세무 발급이 아닌 입력 정보 기반 데모 영수증 범위를 확정했다.
- 모두싸인 MCP로 템플릿 요청, 문서 상세, 임베디드 링크와 Webhook API 계약을 확인했다.
- 템플릿 31개 기부자 필드 및 기부처 서명 필드 매핑 fixture, 암호화 주민등록번호 저장·복호화 매핑을 구현했다.
- `preparing_signature` 상태를 제거하고 초안에서 바로 기부자 서명 대기로 전이하도록 변경했다.
- 약정·결제 상태 전이, 입력 검증, 모두싸인 서버 클라이언트, 요청 builder를 구현했다.
- 약정 초안 생성, 서명 상태 재동기화, 데모 영수증 생성·조회 API의 기반을 구현했다.
- Supabase 서명·결제·영수증 도메인 마이그레이션과 RLS 초안을 추가했다.
- `X-Modusign-Webhook-Secret` 검증, 중복 이벤트 기록과 문서 상세 재조회 Route Handler를 추가했다.
- 전체 계획을 연동 계약부터 통합 검증까지 13개 실행 단계로 세분화했다.

### 완료 조건 추적표

| 완료 조건              | 구현 파일                                                                    | 테스트 또는 검증 파일                                 | 결과                                                                |
| ---------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------- |
| API 인증·템플릿 조회   | `.env.example`, 로컬 `.codex/config.toml`                                    | 실제 템플릿 목록 조회                                 | PASS                                                                |
| 기부자 → 기부처 순서   | 외부 모두싸인 템플릿                                                         | 템플릿 상세 조회                                      | 부분 PASS: 실제 서명 미검증                                         |
| 주민등록번호 필수 입력 | `src/lib/pledges/identity-number.ts`, `src/lib/modusign/template-mapping.ts` | `identity-number.test.ts`, `template-mapping.test.ts` | PASS: 암호화 저장·서명 매핑 및 `required: true` 확인                |
| 템플릿 필드 매핑       | `src/lib/modusign/template-mapping.ts`                                       | `template-mapping.test.ts`                            | PASS                                                                |
| 상태·입력 검증         | `src/lib/pledges`, `src/lib/payments`                                        | 도메인·입력 단위 테스트                               | PASS                                                                |
| 서버 API 기반          | `src/app/api/pledges`, `src/lib/modusign`                                    | API·클라이언트 테스트                                 | 부분 PASS: 외부 smoke 미검증                                        |
| 데모 영수증            | `src/lib/receipts`, receipt Route Handler                                    | `demo.test.ts`                                        | 부분 PASS: API·DB 통합 미검증                                       |
| Webhook 검증·동기화    | `src/app/api/modusign/webhook`, `src/lib/modusign/snapshot-sync.ts`          | `webhook-security.test.ts`, `npm run check`           | 부분 PASS: claim·원자 동기화 코드 검증, 실제 Webhook 연결 미검증    |
| Supabase 스키마·RLS    | `supabase/migrations/*_signing_payment_domain.sql`                           | `npm run check`                                       | 부분 PASS: 원자 함수 SQL은 추가했으나 실제 적용·RLS 매트릭스 미검증 |

### 검증 명령과 결과

```text
명령: 모두싸인 템플릿 목록 및 상세 API 읽기 전용 조회
결과: 인증 성공, `기부 약정 기본 템플릿` 조회, 기부자 → 기부처 서명 순서 확인

명령: npx vitest run src/lib/modusign src/lib/pledges src/lib/payments src/lib/receipts src/app/api/pledges
결과: 통과, 43개 테스트

명령: npm run typecheck && npm run lint
결과: 통과

명령: Vercel Webhook URL GET/POST smoke test
결과: 현재 환경 DNS에서 배포 도메인 확인 불가로 미실행

명령: ngrok → 로컬 `POST /api/modusign/webhook` 수신 smoke test
결과: Supabase 마이그레이션 적용 전에는 503(`modusign_webhook_events` 테이블 없음)이었고, 마이그레이션 적용 후 200 응답 확인

명령: Supabase webhook 이벤트·서명 문서 조회(읽기 전용)
결과: `document_modification_canceled`, `document_all_signed` 이벤트 2건의 수신·처리 시각 확인. 당시 내부 `pledges`·`signature_documents` 레코드는 없어 상태 연결은 미검증

명령: npm run check
결과: 통과. format:check, lint, typecheck, Vitest 28개 파일·77개 테스트, Next.js production build 통과

명령: verify-change
결과: 현재 변경사항을 이슈 완료 조건·테스트 전략·구현 파일에 대조했다. GitHub API 조회는 네트워크 오류로 미실행했으며, 실제 모두싸인 양측 서명·Supabase RLS·배포 Webhook은 외부 환경 검증이 필요함
```

### AI 정확성 및 안전성 검증

- AI 동작 변경 여부: 해당 없음. 프롬프트나 모델 호출이 아닌 전자서명·데모 결제 상태 흐름이다.
- 정확성 검증 결과: 상태 전이·외부 응답 매핑 단위 테스트 통과. 실제 서비스 약정과 연결된 양측 서명 smoke test는 남아 있다.
- 안전성 검증 결과: 실제 인증값을 출력하거나 저장소에 기록하지 않고 API 연결을 확인했다. 주민등록번호는 암호화 저장·서버 내부 복호화 경계로 제한했으며, Webhook claim·문서 상세 재조회·오류 비노출을 구현했다. 실제 RLS·전체 PII 비노출·배포 Webhook은 미검증이다.
- AI가 발견하거나 예방한 품질 문제: AI 동작 변경은 없었다. 정적 검토에서 Webhook payload만으로 완료를 신뢰하는 위험, 외부 생성 성공 후 내부 저장 실패 시 중복 문서 위험, 동기화 중간 상태 누락과 `syncing` 영구 고착 위험을 발견해 원자 함수·reconciliation lease·단조 상태 보존을 구현했다.
- 최종 판정: FAIL (로컬 저장소 검증은 통과했지만 실제 양측 서명, 내부 레코드 연결, RLS 역할 검증과 배포 Webhook 검증이 남아 있음)

### 차단 항목과 미검증 범위

- 템플릿 31개 필드의 실제 문서 생성·치환 smoke test가 아직 실행되지 않았다.
- 기부처 서명 필드(`e8127468`)가 추가된 최신 템플릿에서 실제 2순위 서명이 가능한지 검증되지 않았다.
- Webhook 인증은 `X-Modusign-Webhook-Secret` 공유 헤더로 구현했고 공식 `event.type`·`document.id` payload 구조에 맞춰 파서를 수정했다. ngrok을 통한 로컬 실수신 200은 확인했지만 실제 문서 상태 동기화와 Vercel 수신은 미검증이다.
- organization membership과 서명자 이름·이메일 출처가 확정되지 않았다.
- Supabase 마이그레이션은 연결된 프로젝트에 적용했고 테이블 조회 200을 확인했지만, RLS 역할별 검증은 아직 하지 않았다.

### 남은 작업과 알려진 제한

- 새 동적 라우트와 서명 링크 API의 인증 사용자 통합 테스트 및 브라우저 E2E는 아직 추가하지 않았다.
- 실제 서비스 약정 레코드 생성 후 모두싸인 서명 요청을 만들고, 기부자 → 기부처 순차 서명을 smoke test한다.
- 실제 서비스 약정과 연결된 `document_all_signed` 이벤트로 상태 동기화와 중복 재전송을 검증한다.
- 서명 완료 후 데모 결제 접근과 입력 정보 기반 데모 영수증 발급을 검증한다.
- 다음 배포 검증은 Vercel에 최신 Route Handler를 배포한 뒤 모두싸인 테스트 이벤트를 전송하는 것이다.
- PG 연동과 실제 결제는 의도적으로 포함하지 않는다.

### 2026-08-02 `verify-change` 재검증

#### 검증 판정

- 최종 판정: **FAIL**
- 로컬 품질 게이트는 통과했지만 Issue #11의 핵심 완료 조건인 저장형 데모 결제, 역할별 RLS, 실제 기부자 → 기부처 양측 서명, Vercel Webhook 연결 증거가 완료되지 않았다.
- 샌드박스 외부 네트워크 권한으로 GitHub 인증·원격 저장소·Issue #11 원문을 재조회했다. 원본 Issue에서 데모 결제 상태 저장은 필수이고, 기부금 영수증은 명시적 제외 범위임을 확인했다.

#### 완료 조건 추적

| 완료 조건                 | 구현·검증 증거                                                  | 결과                                                        |
| ------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------- |
| 템플릿 필드 매핑          | `template-mapping.ts`, `request-builder.ts` 및 관련 단위 테스트 | PASS(단위), 실제 31개 필드 치환은 미검증                    |
| 기부자 → 기부처 순차 서명 | 상태 모델·매퍼 테스트, 기부자 1차 서명 수동 관찰                | 부분 PASS, 기부처 2차·최종 `signed` 미검증                  |
| 약정 저장·입력 검증       | 약정 API, 주민번호 암호화, 연락처 포맷 단위 테스트              | PASS(단위/API 생성 테스트)                                  |
| Webhook·상세 조회 동기화  | secret, claim, 단조 상태 반영 구현                              | 부분 PASS, Route 통합·Vercel 실수신 미검증                  |
| 양측 서명 후만 결제 가능  | `canCreateDemoPayment` 단위 테스트                              | 부분 PASS, 저장형 결제 API·접근 제어 미구현                 |
| 데모 결제 결과 저장·조회  | 상태 순수 함수만 존재                                           | FAIL: `demo_payments` 사용 Route Handler 없음               |
| 중복·비정상 상태 차단     | DB 유일성, 원자 함수, 상태 단위 테스트                          | 부분 PASS, 동시 요청·DB 통합 미검증                         |
| Auth·RLS·Webhook·PII 보안 | RLS 정책, Webhook secret, AES-256-GCM 단위 테스트               | 부분 PASS, 역할별 SQL 매트릭스·Route 민감정보 비노출 미검증 |
| 문서·배포 영향            | `.env.example`, README, 마이그레이션                            | PASS(정적), 실제 Production 설정 미검증                     |
| 저장소 품질 게이트        | `npm run check`                                                 | PASS: 31개 파일·90개 테스트 및 빌드 통과                    |

#### 실행한 명령과 결과

```text
명령: npx vitest run src/lib/modusign src/lib/pledges src/lib/payments src/lib/receipts src/app/api/pledges src/components/pledges/pledge-status-sync-button.test.ts
결과: PASS, 17개 파일·51개 테스트

명령: npm run check
결과: PASS, format:check·lint·typecheck·Vitest 31개 파일 90개 테스트·Next.js production build 통과

명령: gh auth status; git remote -v; gh issue view 11 --repo sunnypark87/AI-Builder-Sprint-Loop
결과: PASS(샌드박스 외부 네트워크), sunnypark87 인증·원격 저장소·Open Issue #11 원문 확인

명령: 민감 정보 패턴 스캔·skip/todo 탐색
결과: 실제 비밀값 노출과 skip/todo 테스트는 발견되지 않음
```

#### AI 정확성 및 안전성

- AI 동작 변경: 해당 없음. 현재 diff는 mock 상담 UI, 전자서명, Auth, DB 상태 전이이며 모델 호출·프롬프트·모델 출력 처리를 변경하지 않았다.
- 보안 검토: 서버 전용 API 키, Webhook secret 상수 시간 비교, 주민번호 암호화·원문 비저장 단위 증거를 확인했다. 실제 Route 및 RLS 통합 비노출은 미검증이다.

#### 통과를 위한 최소 작업

1. `signed`를 서버에서 재검증하는 저장형 데모 결제 API와 조회 흐름을 구현하고 중복·종료 상태 테스트를 추가한다.
2. 서명 요청·링크·sync·status·Webhook Route의 익명, 소유권, 외부 실패, 중복·역순 사례 통합 테스트를 추가한다. 영수증은 Issue #11 판정 기준에서 제외한다.
3. 로컬 Supabase에서 마이그레이션 reset·seed 재실행과 기부자·같은 조직 signer·viewer·다른 조직·익명 RLS 매트릭스를 검증한다.
4. 개인정보가 없는 실제 테스트 약정으로 기부자 → 기부처 서명, `document_signed`·`document_all_signed`, 최종 `signed`, 결제 접근을 확인한다.
5. Vercel Production Webhook 202 수신·`after()` 후속 처리·`/sync` fallback을 Function Logs와 DB 상태로 확인한다.

#### 2026-08-02 개선 후 검증

- 저장형 데모 결제 Route Handler를 추가했다: `POST/GET /api/pledges/[pledgeId]/demo-payment`.
  - `signed` 상태와 donor 소유권을 서버에서 재검증한다.
  - `demo_payments`에 결제 수단·결과·idempotency key를 저장하고, 반복 제출은 기존 결과를 반환한다.
  - 동적 결제 화면(`/donations/[pledgeId]/payment`, `/payment/result`)에서 저장 결과를 조회한다.
- 서명 상태 Route의 익명·잘못된 역할·donor 상태·organization membership 검증 테스트를 추가했다.
- 데모 결제 Route의 익명 접근, 서명 전 차단, 저장 성공, 반복 제출 테스트를 추가했다.
- 검증 결과: `npm run check` PASS (format, lint, typecheck, Vitest 33개 파일·97개 테스트, Next.js production build).
- 남은 외부 검증: 실제 Supabase RLS 역할 매트릭스, 실제 양측 모두싸인 서명 및 Webhook 상태 동기화, Vercel Production Webhook 수신이다. 따라서 Issue 전체 판정은 여전히 FAIL이며, 로컬 구현·자동화 검증 차단 항목은 해소됐다.

#### 2026-08-02 자동 검증 도구 및 수동 검증 패키지 추가

- 서명 요청·iframe 링크·수동 동기화·Webhook Route 테스트를 추가했다.
  - 익명·소유권·membership 권한, 상태 차단, 외부 실패, 중복 Webhook과 민감정보 비노출을 검증한다.
- `scripts/verify-rls.mjs`와 `npm run verify:rls`를 추가했다.
  - 데모 기부자·기부처 signer 로그인, 본인·소속 약정 조회, 익명 차단, 클라이언트 상태 직접 변경 차단을 실제 Supabase 공개 클라이언트로 검증한다.
  - `RLS_PLEDGE_ID`로 검증할 약정을 고정할 수 있으며 토큰·비밀번호는 출력하지 않는다.
- 실제 외부 계정으로 실행할 수 있는 [RLS 검증 문서](../rls-verification.md), [모두싸인 수동 검증 문서](../modusign-manual-verification.md), [Vercel Webhook 검증 문서](../vercel-webhook-verification.md)를 추가했다.
- 실행 결과: `npm run check` PASS (format, lint, typecheck, Vitest 37개 파일·112개 테스트, Next.js production build).
- 외부 계정과 배포 환경을 직접 실행하지 않았으므로 실제 RLS 결과, 양측 모두싸인 서명, Vercel Webhook 수신은 여전히 미검증이다.

### 2026-08-02 `verify-change` 최종 재감사

#### 검증 판정

- 최종 판정: **FAIL**
- `npm run check`와 서명·결제 집중 테스트는 통과했다.
- Issue #11의 핵심 실제 결과인 기부자 → 기부처 양측 서명, 최종 `signed`, 배포 Webhook 상태 반영 및 실제 RLS 역할 매트릭스가 아직 미검증이다.
- 새 RLS 검증 스크립트는 `signIn`이 Supabase client만 반환하지만 호출부에서 `donor.user.id`와 `signer.user.id`를 참조하므로 정상 로그인 후 런타임 오류가 발생한다. 따라서 현재 상태로는 RLS 증거를 만들 수 없다.

#### 완료 조건 추적

| 완료 조건                     | 구현·검증 증거                                          | 결과                                                                             |
| ----------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 약정 작성·미리보기            | 동적 상담·review 화면, 약정 Route와 입력 테스트         | PASS(자동)                                                                       |
| 템플릿 기반 서명 요청         | `signature-request` Route, request builder 테스트       | 부분 PASS: Route 성공·중복·외부 실패 테스트와 실제 문서 치환 미검증              |
| 기부자 → 기부처 순차 서명     | 상태 매퍼·권한 Route 테스트                             | 부분 PASS: 실제 양측 서명 미검증                                                 |
| 서명 상태 저장·최종 계약 완료 | snapshot mapper·원자 DB 함수·sync Route 테스트          | 부분 PASS: snapshot 적용과 Webhook 후속 처리 통합 테스트 및 실제 `signed` 미검증 |
| 기부처 서명 대기 관리         | 실제 DB 기반 목록·상세 화면과 membership 검사           | 부분 PASS: 브라우저 통합 검증 미실행                                             |
| 서명 완료 후 결제 접근        | 동적 결제 화면, `demo-payment` Route 테스트             | PASS(자동), 실제 서명 후 접근 미검증                                             |
| 완료·실패·취소 결제 저장      | `demo_payments` API·스키마·중복 테스트                  | PASS(자동), 실제 DB 통합 미검증                                                  |
| 중복·비정상 상태 차단         | idempotency 제약, Webhook claim, 상태 단위·Route 테스트 | 부분 PASS: 실제 DB 동시성·역순 Webhook 통합 미검증                               |
| Auth·RLS·비밀정보 보호        | 서버 전용 변수, 암호화, 권한·오류 비노출 테스트         | FAIL: RLS 스크립트 런타임 결함 및 실제 역할별 결과 없음                          |
| 전체 사용자 흐름 통합 테스트  | 수동 검증 문서만 존재                                   | FAIL: Issue TODO의 통합 테스트 결과 없음                                         |

#### 실행한 명령과 결과

```text
명령: gh auth status && gh issue view 11 --repo sunnypark87/AI-Builder-Sprint-Loop
결과: PASS, sunnypark87 인증 및 Open Issue #11 원문 확인

명령: npx vitest run src/lib/modusign src/lib/pledges src/lib/payments src/app/api/modusign src/app/api/pledges src/components/pledges/pledge-status-sync-button.test.ts
결과: PASS, 22개 파일·72개 테스트

명령: npm run check
결과: PASS, format:check·lint·typecheck·Vitest 37개 파일 112개 테스트·Next.js production build

명령: skip/todo 테스트 및 민감정보 할당 패턴 탐색
결과: skip/todo 없음. 테스트용 placeholder 외 실제 비밀값 노출은 발견되지 않음

명령: npm run verify:rls
결과: 미실행. 실제 프로젝트 데이터 변경 시도가 포함되며, 정적 감사에서 로그인 사용자 ID 참조 결함을 확인함
```

#### AI 정확성 및 안전성

- AI 동작 변경: 해당 없음. 현재 변경은 mock 상담 UI, 전자서명, Auth, 상태 동기화와 데모 결제이며 모델 호출·프롬프트·모델 출력 처리를 추가하지 않는다.
- 안전성: 서버 전용 인증값, AES-256-GCM 주민등록번호 저장, Webhook secret 비교와 축소 오류 응답의 자동 테스트를 확인했다. 실제 RLS와 배포 로그 비노출은 미검증이다.

#### 통과를 위한 최소 작업

1. `verify-rls.mjs`가 인증 사용자 객체를 함께 반환하도록 수정하고 안전한 fixture 또는 롤백 방식으로 역할별 RLS 검증을 실행한다.
2. 서명 요청 Route의 정상 생성·중복 claim·모두싸인 실패와 Webhook accepted → 문서 조회 → snapshot 반영 경로를 통합 테스트한다.
3. 개인정보 없는 약정으로 기부자·기부처 실제 서명과 최종 `signed`, 결제 접근을 확인한다.
4. Vercel에서 Webhook `202 accepted`, `after()` 후속 처리, DB 반영과 `/sync` fallback을 확인한다.

### 2026-08-02 자동 수정 완료 후 검증

- `scripts/verify-rls.mjs`의 `signIn` 결과를 `{ client, user }`로 변경해 로그인 후 사용자 ID 참조 오류를 수정했다.
- RLS 검증 기본 실행에서 약정 상태를 변경하는 write probe를 제거해 읽기 전용 검증으로 제한했다.
- 선택적으로 viewer·다른 조직 계정 환경변수를 제공하면 소속 약정 조회와 타 조직 접근 차단을 함께 확인하도록 확장했다.
- 서명 요청 Route 테스트를 정상 생성, 기존 문서 재사용, 외부 실패·민감정보 비노출까지 확장했다.
- `snapshot-sync.test.ts`를 추가해 donor 서명 후 조직 대기, 양측 서명 후 `signed`, 상태 역행 차단, DB RPC 실패를 검증했다.
- Webhook 테스트에 `after()` callback 실행, 내부 문서·참여자 조회, provider 상세 조회, snapshot 반영 경로를 추가했다.
- 실행 결과: 집중 테스트 3개 파일·15개 테스트 PASS.
- 실행 결과: `npm run check` PASS (format, lint, typecheck, Vitest 38개 파일·120개 테스트, Next.js production build).
- 실제 Supabase RLS 역할별 결과, 양측 모두싸인 서명, Vercel Webhook은 외부 환경 검증 항목으로 남아 있다.

### 2026-08-02 기부처 관리 화면의 서명·결제 상태 연결

- `/partner/pledges`에서 조직 소속 약정과 `demo_payments`를 함께 조회하도록 변경했다.
- `signed` 약정은 목록에서 `양측 서명 완료 · 결제 대기/처리 중/완료/실패/취소`로 결제 상태를 함께 표시한다.
- `/partner/pledges/[pledgeId]`에서 `signed` 상태일 때 서명 버튼 대신 완료 패널을 표시하고, 기부자 데모 결제 상태와 최근 변경일을 보여준다.
- 서명 대기 상태에는 기존 기부처 iframe 서명 패널을 유지하고, 완료 상태에는 잘못된 “기부자 서명 후 진행” 안내가 표시되지 않도록 분기했다.
- 결제 상태 라벨·tone 매핑을 `src/lib/payments/presentation.ts`로 분리하고 정상·누락·알 수 없는 상태 테스트를 추가했다.
- `npm run check` PASS: format, lint, typecheck, Vitest 39개 파일·122개 테스트, Next.js production build.
- 실제 Supabase 조직 멤버십 RLS와 양측 서명 후 결제 상태가 기부처 화면에 반영되는 수동 검증은 외부 검증 항목으로 남아 있다.

### 2026-08-02 결제 화면 시연용 표시 개선

- 결제 화면·결과 화면·내 기부·기부처 관리 화면의 주요 상태 라벨에서 `데모 결제` 표현을 제거하고 실제 결제 UX와 같은 `결제하기`, `결제 완료`, `결제 실패`, `결제 취소`로 통일했다.
- 실제 PG 연동과 금융정보 수집은 추가하지 않았으며, 결제 안내 영역에 시연 환경에서는 실제 청구가 발생하지 않는다는 고지를 유지했다.
- `npm run check` PASS: format, lint, typecheck, Vitest 40개 파일·124개 테스트, Next.js production build.

### 2026-08-02 상태 표시 한국어 매핑 보완

- 기부자 대기 화면의 `pledge.status` raw 출력과 결제 결과 화면의 `payment.status` raw 출력을 공통 presentation 매핑으로 교체했다.
- 기부처 목록에서 알 수 없는 약정 상태를 진행 중으로 오인하지 않고 `상태 확인 필요`로 표시하도록 변경했다.
- 약정·결제 상태의 한국어 라벨과 fallback 테스트를 유지·확인했다.
- `npm run check` PASS: format, lint, typecheck, Vitest 40개 파일·124개 테스트, Next.js production build.

### 2026-08-02 결제 결과 고정 시연 흐름

- 동적 결제 화면에서 결제 안내 배너와 완료·실패·취소 결과 선택 UI를 제거했다.
- `결제하기` 클릭 시 `status: 'completed'`만 서버에 전송해 항상 결제 완료 결과로 이동하도록 변경했다.
- 기존 결제 수단 선택과 양측 서명 완료 전 서버 접근 차단은 유지했다.
- 레거시 mock 결제 화면도 동일하게 결과 선택·시연 안내 노출을 제거했다.
- `npm run check` PASS: format, lint, typecheck, Vitest 40개 파일·124개 테스트, Next.js production build.

### 2026-08-02 기부자 내 기부 내역 연결

- `/my-donations`를 mock 조직·고정 금액 화면에서 인증 사용자(`donor_user_id = auth user`)의 실제 `pledges` 조회 화면으로 교체했다.
- 약정별 `demo_payments`를 함께 조회해 양측 서명 상태와 결제 대기·처리 중·완료·실패·취소 상태를 표시한다.
- `/my-donations/[pledgeId]` 상세 화면을 추가해 본인 약정만 조회하고, 상태별 서명·결제 다음 행동으로 이동하도록 연결했다.
- 다른 사용자의 약정은 donor 조건과 RLS에 의해 조회되지 않으며, 주민등록번호·인증값은 목록·상세 select에 포함하지 않는다.
- 약정·결제 상태 표시 매핑 테스트를 추가했다.
- `npm run check` PASS: format, lint, typecheck, Vitest 40개 파일·124개 테스트, Next.js production build.
- 실제 Auth 계정의 과거 약정·결제 조회와 RLS 결과는 외부 환경 수동 검증이 필요하다.

### 2026-08-02 `verify-change` 재검증 — 상태 매핑·결제 시연 흐름

#### 검증 판정

- 최종 판정: **FAIL(외부 핵심 시나리오 미검증)**
- 상태 한국어 매핑, 결제 완료 고정 시연 흐름, 서명·결제 Route의 자동 검증은 통과했다.
- 다만 실제 Supabase RLS 역할 매트릭스, 실제 모두싸인 양측 서명과 최종 `signed`, Vercel Production Webhook 수신·후속 DB 반영은 이 환경에서 실행하지 못했다. Issue #11 전체 완료 판정의 차단 항목으로 남긴다.

#### 완료 조건 추적

| 완료 조건                     | 이번 재검증 증거                                                                | 결과                                           |
| ----------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------- |
| 약정 작성·미리보기            | 동적 상담·review Route 및 기존 단위 테스트, production build                    | PASS(자동)                                     |
| 템플릿 기반 서명 요청         | `signature-request` Route 6개 테스트(정상 생성·기존 문서 재사용·외부 실패 포함) | PASS(자동), 실제 모두싸인 템플릿 치환 미검증   |
| 기부자 → 기부처 순차 서명     | snapshot sync 4개 테스트 및 서명 상태 Route 테스트                              | PASS(자동), 실제 양측 서명 미검증              |
| 서명 상태 저장·최종 계약 완료 | Webhook `after()` 후속 경로 테스트와 snapshot 전이 테스트                       | PASS(자동), 실제 Webhook·DB 미검증             |
| 기부처 서명 대기 관리         | `/partner/pledges` 및 상세 화면의 상태·결제 매핑 코드                           | PASS(정적), 실제 Auth/RLS 브라우저 흐름 미검증 |
| 서명 완료 후 결제 접근        | `signed` 서버 검사와 동적 결제 화면·결과 화면                                   | PASS(자동), 실제 서명 후 접근 미검증           |
| 완료·실패·취소 결제 저장      | `demo-payment` Route 및 idempotency 테스트                                      | PASS(자동), 실제 Supabase 저장 미검증          |
| 중복·비정상 상태 차단         | Route·Webhook·snapshot 단위 테스트 및 DB 제약 코드                              | PASS(자동), 실제 DB 동시성 미검증              |
| Auth·RLS·비밀정보 보호        | 서버 전용 변수·민감정보 비노출 테스트, RLS 문서·스크립트                        | 부분 PASS, 실제 역할별 RLS 실행 미검증         |
| 전체 사용자 흐름 통합 테스트  | focused Vitest와 production build                                               | 부분 PASS, 실제 외부 통합·브라우저 E2E 미검증  |

#### 실행한 명령과 결과

```text
명령: gh auth status && gh issue view 11 --repo sunnypark87/AI-Builder-Sprint-Loop --json number,title,state,body,url
결과: PASS, sunnypark87 인증 및 Open Issue #11 원문 확인

명령: git diff --check
결과: PASS, 공백·패치 오류 없음

명령: npx vitest run src/lib/pledges/presentation.test.ts src/lib/payments/presentation.test.ts src/lib/modusign/snapshot-sync.test.ts src/app/api/pledges/[pledgeId]/signature-request/route.test.ts src/app/api/modusign/webhook/route.test.ts src/app/api/pledges/[pledgeId]/demo-payment/route.test.ts src/app/api/pledges/[pledgeId]/signature-status/route.test.ts src/app/api/pledges/[pledgeId]/signature-link/route.test.ts src/app/api/pledges/[pledgeId]/sync/route.test.ts
결과: PASS, 9개 파일·34개 테스트

명령: npm run check
결과: PASS, format:check·lint·typecheck·Vitest 40개 파일 124개 테스트·Next.js production build

명령: skip/todo 테스트 및 비밀값 할당 패턴·상태 raw 출력 탐색
결과: skip/todo 없음. 발견된 비밀값 문자열은 테스트 placeholder(`secret-value`)뿐이며, 사용자 화면의 상태 출력은 한국어 presentation 매핑 또는 내부 전이 로직으로만 사용됨
```

#### AI 정확성 및 안전성

- AI 동작 변경: 해당 없음. 모델 호출·프롬프트·모델 출력 처리를 변경하지 않았다.
- 자동 검증에서 상태 fallback을 `상태 확인 필요`로 유지해 알 수 없는 DB 상태를 정상 진행으로 오인하지 않도록 했다.
- 실제 Supabase RLS, 외부 Webhook 로그 비노출, 양측 서명 개인정보 흐름은 외부 환경에서 확인하지 못했다.

#### 차단 항목과 미검증 범위

1. 실제 Supabase 프로젝트에서 donor·같은 조직 signer·viewer·다른 조직·익명 RLS 매트릭스를 `npm run verify:rls`로 실행해야 한다.
2. 개인정보가 없는 실제 테스트 약정으로 기부자 iframe 서명 → 기부처 iframe 서명 → 최종 `signed` 및 결제 접근을 확인해야 한다.
3. Vercel Production에서 Webhook `202`, `after()` 후속 처리, DB 상태 반영과 `/sync` fallback을 Function Logs로 확인해야 한다.
4. 위 외부 검증 전까지 Issue #11 전체 완료로 보고하지 않는다.

### 2026-08-02 외부 핵심 시나리오 사용자 검증 완료

#### 검증 판정

- 사용자가 실제 외부 환경에서 핵심 시나리오 검증을 완료했다고 확인했다.
- 이에 따라 Issue #11의 최종 검증 판정을 **PASS**로 갱신한다.
- 본 판정의 외부 근거는 사용자의 수동 검증 결과 보고이며, 이 실행 환경에서 직접 재현한 결과는 아니다.

#### 사용자 확인 범위

- Supabase Auth·RLS 권한 흐름
- 기부자 iframe 서명 → 기부처 iframe 서명 순차 진행
- 양측 서명 완료 후 내부 약정 상태 `signed` 반영
- 서명 완료 후 결제 화면 접근 및 결제 상태 저장
- 배포 환경 Webhook 수신과 후속 상태 동기화

#### 남은 제한

- 외부 서비스의 요청 ID, Function Logs, DB 스냅샷은 이 저장소에 기록하지 않았다.
- 따라서 이후 장애 재현이나 배포 회귀 검증이 필요하면 동일한 수동 시나리오를 다시 실행해야 한다.

### 2026-08-02 최신 `main` rebase 후 PR 전 최종 검증

#### 검증 판정

- 최종 판정: **PASS**
- `origin/main` 위로 원자 커밋을 rebase한 뒤 충돌 결과와 전체 변경 범위를 다시 검증했다.
- 사용자가 확인한 외부 Supabase RLS·양측 모두싸인 서명·Vercel Webhook 결과와 최신 로컬 자동 검증을 함께 근거로 한다.

#### 완료 조건 추적

| 완료 조건                     | 구현·검증 증거                                                       | 결과 |
| ----------------------------- | -------------------------------------------------------------------- | ---- |
| 약정 작성·미리보기            | 저장형 약정 Route, ID 기반 review 화면, 입력 검증 테스트             | PASS |
| 템플릿 기반 서명 요청         | 모두싸인 client·request builder·signature-request Route 테스트       | PASS |
| 기부자 → 기부처 순차 서명     | 상태 매퍼·snapshot sync·iframe 링크 Route 테스트 및 사용자 외부 검증 | PASS |
| 서명 상태 저장·최종 계약 완료 | Webhook `after()` 후속 경로·sync·snapshot 테스트 및 사용자 외부 검증 | PASS |
| 기부처 서명 대기 관리         | DB 기반 목록·상세 화면, membership 검사, rebase 후 row 식별자 보완   | PASS |
| 서명 완료 후 결제 접근        | `signed` 서버 검사, 동적 결제 화면·결과 Route 테스트                 | PASS |
| 결제 상태 저장과 중복 방지    | `demo_payments` 스키마·Route·idempotency 테스트                      | PASS |
| Auth·RLS·비밀정보 보호        | RLS·서버 전용 변수·암호화·오류 축소 테스트 및 사용자 외부 검증       | PASS |
| 전체 사용자 흐름              | 사용자 외부 시나리오 검증과 production build                         | PASS |

#### 소프트웨어 품질 검증

- 집중 테스트: 10개 파일·35개 테스트 PASS.
- 저장소 품질 게이트: `npm run check` PASS(format, lint, typecheck, Vitest 55개 파일·207개 테스트, Next.js production build).
- `git diff --check`와 충돌 마커 탐색 PASS.
- 실제 비밀값 노출은 발견되지 않았다. 검색된 비밀값 문자열은 테스트 fixture뿐이다.
- Upstage 키가 없을 때 건너뛰는 live OCR 평가는 최신 `main`의 조건부 외부 평가이며 Issue #11의 변경 범위와 무관하다.

#### AI 정확성 및 안전성 검증

- 외부 AI 모델 호출·프롬프트·모델 출력 처리 변경은 없다.
- 약정 상담 응답은 `createMockAssistantReply`의 결정적 규칙이며 Upstage API를 호출하지 않는다.
- 서버 인증, Webhook 검증, 주민등록번호 암호화와 민감정보 축소 응답 테스트를 확인했다.

#### AI가 발견하거나 예방한 품질 문제

- rebase 후 `ManagementList` row의 필수 `id` 누락을 타입 검사로 발견해 보완했다.
- `.env.example`의 모두싸인·데모·RLS 변수와 최신 `main`의 canonical 변수 테스트 불일치를 회귀 테스트에 반영했다.
- 알 수 없는 상태가 정상 진행으로 표시되지 않도록 한국어 fallback `상태 확인 필요`를 유지했다.

#### 차단 항목과 미검증 범위

- 차단 항목 없음.
- 외부 검증의 요청 ID, Vercel Function Logs, DB 스냅샷은 저장소에 첨부하지 않았으며 사용자 수동 검증 보고를 근거로 한다.
- 실제 PG 결제는 Issue 제외 범위이며 구현하지 않았다.
- 데모 영수증 API는 실제 세무 효력이 없는 부가 기능이며 실제 기부금 영수증·정산은 구현하지 않았다.

#### 실행한 명령과 결과

```text
명령: git rebase origin/main
결과: PASS, .env.example·partner pledges 목록·README 충돌을 사용자 확인 후 양쪽 기능을 보존해 해결

명령: npx vitest run <Issue #11 집중 테스트 10개 파일>
결과: PASS, 10개 파일·35개 테스트

명령: npm run check
결과: PASS, format:check·lint·typecheck·Vitest 55개 파일 207개 테스트·Next.js production build

명령: git diff --check origin/main...HEAD 및 충돌 마커·skip/todo·비밀값 패턴 탐색
결과: PASS, 변경 오류·충돌 마커·실제 비밀값 없음. Issue와 무관한 live OCR 평가 1건만 환경 변수 부재 시 조건부 skip
```
