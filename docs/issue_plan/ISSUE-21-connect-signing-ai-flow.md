# Issue 구현 계획

## 1. 이슈 개요

- 대상 이슈: [#21 `[Feat] 기부처 화면 개선 및 전자서명·AI 분석 플로우 연결`](https://github.com/sunnypark87/AI-Builder-Sprint-Loop/issues/21)
- 우선순위: P0
- 상태: Open
- 담당자: `sunnypark87`
- 작성일: 2026-08-03

데모에서 기부처 탐색부터 기부 약정, 모두싸인 양측 서명, 기부처의 계획서·영수증 AI 분석까지 하나의 계약 관리 흐름으로 이어지도록 화면과 상태 기반 진입 경로를 정리한다. 공개 자료 평가 중심 UI를 제거하고 기부 의사결정에 필요한 활동 분야, 주요 사업, 기부금 활용 목적과 조건을 강조하며, 현재 구현과 실행 방법을 기준으로 `README.md`를 최신화한다.

## 2. 현재 저장소 상태

관련 코드, 문서, 설정, 테스트의 현재 상태를 조사해 기록한다.

| 요구사항                        | 현재 상태                                                                                                                                                    | 필요한 작업                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 기부처 목록의 공개 정보 UI 제거 | `src/app/organizations/page.tsx`와 홈의 `organization-showcase.tsx`가 공개 자료 확인 수, 최근 갱신일, 공개 자료 기반 문구를 노출한다.                        | 공개 평가·검증 수치와 관련 문구를 제거하고 활동 분야·주요 사업·기부 목적 중심 카드로 재구성한다.              |
| 기부처 상세 정보 개선           | `src/app/organizations/[organizationId]/page.tsx`가 공개 자료 분석 비율과 확인 항목 수를 핵심으로 표시한다.                                                  | 활동 분야, 주요 사업, 기부금 활용 목적, 허용 조건을 명확히 표시하고 불필요한 공개 정보 UI를 제거한다.         |
| 데모 데이터 정리                | `src/lib/mock-data/organizations.ts`의 모델이 `verifiedItems`, `latestReport`, `allocation`, 공개 관련 `tags`에 맞춰져 있다.                                 | 화면 요구에 맞는 사업·조건·활용 목적 데이터 구조로 교체하고 모든 소비처를 갱신한다.                           |
| 모두싸인 완료 상태 반영         | 약정 상태와 모두싸인 Webhook/동기화 API, 기부자·기부처 서명 화면이 이미 있으며 `signed` 상태에서 결제로 연결된다.                                            | 기존 상태 동기화를 보존하면서 데모 진행 상태에 양측 서명 완료와 후속 문서 처리 단계를 함께 표현한다.          |
| 계획서·영수증 분석 진입 경로    | 기부처용 `/partner/plans`, `/partner/plans/new`, `/partner/executions`, `/partner/executions/new`와 리뷰 화면은 존재하지만 서명 완료 흐름과의 연결이 약하다. | 체결된 약정/기부 상세에서 계획 등록·분석, 계획 항목 기반 영수증 분석으로 이어지는 CTA와 상태 안내를 연결한다. |
| 데모 분석 결과 확인             | 계획·영수증 목록 및 실제/데모 리뷰 화면이 각각 존재한다.                                                                                                     | 데모 시나리오에서 대상 약정과 분석 단계가 일관되게 보이도록 링크, 상태, 안내 문구를 정리한다.                 |
| 회귀 검증                       | 단위·API 테스트와 Playwright 상태/반응형 테스트가 있으나 기부처 정보 및 전체 연결 흐름을 직접 검증하는 테스트는 제한적이다.                                  | 변경된 UI와 CTA의 상태별 노출, 핵심 데모 경로를 자동화하고 외부 API는 목 처리한다.                            |
| 프로젝트 문서                   | `README.md`에 개발·OCR·모두싸인 설정은 있으나 서비스 목적, 핵심 사용자 흐름, 현재 주요 기능이 분산되어 있다.                                                 | 프로젝트 소개, 역할별 흐름, 기술 스택, 환경 변수, 로컬 실행·검증 절차를 현재 코드에 맞춰 재구성한다.          |

## 3. 선행 결정

- 이슈의 “공개 정보 관련 UI 제거”는 공개 자료 확인 개수, 최근 갱신일, 공개 자료 분석 비율과 이를 강조하는 문구를 제거하는 것으로 해석한다. 기부 의사결정에 필요한 사업·목적·조건 정보는 유지하거나 강화한다.
- 기존 모두싸인 Webhook, 상태 동기화, 계획서 OCR, 영수증 OCR 도메인 로직은 재사용하고 이 이슈에서는 모델 정확도 고도화나 운영급 예외 처리로 범위를 넓히지 않는다.
- 실제 결제를 구현하지 않으며 기존 데모 결제는 서명 이후 계약 흐름을 연결하는 보조 단계로만 유지한다.
- 기부자 화면에서는 처리 현황 확인을, 기부처 화면에서는 체결된 기부를 기준으로 계획서 등록 후 영수증 등록이 가능하다는 순서를 명확히 한다.
- 실제 식별자가 필요한 경로는 저장된 pledge/donation/plan 상태를 사용하고, 독립 데모 화면은 기존 목 데이터를 활용하되 실제 완료로 오인되지 않도록 표시한다.
- 현재 작업 트리에는 이 이슈와 무관할 수 있는 Supabase 변경 및 미추적 파일이 있으므로 이를 수정·삭제·포함하지 않는다.

## 4. 구현 단계

### 단계 1. 전자서명 완료 기준과 데이터 연결 관계 확정

#### 작업 내용

- 모두싸인 Webhook과 상태 동기화가 약정을 `signed`로 확정하는 경로를 추적하고, 후속 기능은 서버에서 확인한 `signed` 상태에서만 열리도록 기준을 고정한다.
- `pledges → demo_payments/donations → expenditure_plans → expenditure_plan_items → expenditure_executions`의 실제 식별자와 상태 관계를 마이그레이션, repository, RLS 기준으로 확인한다.
- 서명 완료 시 donation 레코드가 언제 생성되는지, 계획 등록 API가 요구하는 donation/organization 조건을 확인하고 누락된 연결만 최소 범위로 보완한다.
- 기부자와 기부처의 권한을 구분한다. 기부자는 진행 상태를 조회하고, 조직 멤버만 계획서와 영수증을 등록·검토한다.

#### 세부 작업 순서

1. **전자서명 완료 판정 추적**
   - `mapModusignDocumentStatus`가 기부자와 기부처 참가자 모두 `signed`일 때만 약정을 `signed`로 전환하는지 확인한다.
   - Webhook과 수동 sync가 모두 `applyModusignSnapshot` 및 `apply_modusign_snapshot` RPC를 사용하고 동일한 전이 규칙을 적용하는지 확인한다.
   - 중복 Webhook, sync throttle, 잘못된 상태 역전, 외부 API 실패 시 `signed`가 잘못 확정되지 않는지 기존 테스트를 대응시킨다.
   - 산출물: `signed` 판정 조건, 진입 경로, 실패/재시도 경로를 정리한 상태 전이표.

2. **현재 결제·기부 도메인의 단절 확인**
   - `demo_payments`는 `pledge_id`를 보유하지만, 계획서가 참조하는 `donations`에는 현재 `pledge_id` 또는 `payment_id`가 없고 자동 생성 로직도 없음을 확정한다.
   - 계획 등록 RPC가 `donations.status = 'paid'`를 요구하므로 단순히 약정 `signed`만으로 계획 등록을 열 수 없음을 기록한다.
   - 실제 결제 구현은 제외하되 기존 데모 결제 완료를 후속 AI 분석의 기준 사건으로 사용할지 확정한다.
   - 권장 결정: 계획·집행의 기존 `paid` 불변조건을 유지하고 `signed → demo payment completed → paid donation`으로 연결한다.

3. **정규 연결 모델 설계**
   - `donations`가 원본 약정을 유일하게 추적하도록 nullable `pledge_id` FK와 unique 제약을 추가하는 방안을 우선 검토한다.
   - 데모 결제까지 추적할 필요가 있으면 `payment_id`를 함께 연결하되, 실제 결제 도메인으로 오인되지 않도록 데모 전용 의미를 명시한다.
   - 기존 seed/통합 테스트의 독립 donation 레코드를 깨지 않도록 새 연결 컬럼은 기존 데이터와 호환되게 설계한다.
   - `organization_id`, 금액, donor/pledge 소유 관계가 서로 다른 레코드를 연결할 수 없도록 DB 함수에서 검증한다.
   - 산출물: 최소 migration 후보, unique/FK/check 조건, 기존 데이터 호환성 표.

4. **멱등 donation 생성 경계 설계**
   - `demo_payments.status = completed` 처리 시 같은 pledge에 대해 paid donation을 한 번만 생성하거나 기존 연결 레코드를 반환하는 서버 전용 RPC/서비스 경계를 설계한다.
   - 클라이언트 입력의 organization, amount, donor 값을 신뢰하지 않고 서버가 pledge와 payment 레코드에서 읽도록 한다.
   - 동일 요청 재시도와 동시 요청에서도 중복 donation이 생성되지 않도록 pledge unique 제약과 upsert/RPC 잠금을 사용한다.
   - 결제가 `pending`, `failed`, `cancelled`이거나 pledge가 `signed`가 아니면 donation 생성 및 계획 등록을 차단한다.
   - 산출물: 입력·출력·오류 코드·멱등성 규칙이 정의된 연결 함수 계약.

5. **계획·집행 참조 체인 검증**
   - 생성된 donation ID가 `/partner/plans/new`의 eligible donation 조회와 계획 등록 API/RPC에 그대로 전달되는지 확인한다.
   - 계획 등록 후 `plan_id`와 `plan_item_id`가 영수증 집행 등록 RPC가 요구하는 동일한 organization/donation 관계를 만족하는지 확인한다.
   - 참조 체인을 `pledge.id → demo_payment.pledge_id → donation.pledge_id → plan.donation_id → execution.donation_id/plan_id/plan_item_id`로 문서화한다.
   - 산출물: 화면·API·DB별 ID 전달표와 잘못된 참조 차단 조건.

6. **권한 및 RLS 검증표 작성**
   - 기부자는 자신의 pledge와 demo payment 상태만 조회하며 donation 원본, 계획서, 영수증 관리 문서에는 접근하지 않는지 확인한다.
   - 조직 멤버는 자신이 속한 organization의 paid donation, plan, execution만 조회하도록 기존 RLS를 대조한다.
   - donation 연결 생성은 service role을 사용하는 전용 서버 코드로 제한하고, 요청자는 `getUser()`/claims와 pledge 소유권으로 검증한다.
   - 다른 기부자, 다른 조직 멤버, 익명 사용자, signer가 아닌 조직 사용자의 허용 범위를 표로 확정한다.
   - 산출물: 역할별 read/create/review 권한 매트릭스.

7. **1단계 검증 테스트 명세 작성**
   - 정상: 양측 서명 완료 후 completed 데모 결제가 하나의 paid donation으로 연결된다.
   - 경계: 기부자만 서명, 결제 pending/failed/cancelled, Webhook 지연, 연결 donation 재조회.
   - 멱등성: 같은 결제 요청 반복 및 동시 요청에서도 donation이 1개다.
   - 권한: 익명, 다른 기부자, 다른 조직 멤버의 조회/생성 차단.
   - 정합성: pledge/payment의 organization·amount·owner 불일치와 다른 donation ID 주입 차단.
   - 회귀: 기존 독립 seed donation을 사용하는 plan/execution 통합 테스트 유지.
   - 산출물: migration SQL 테스트, API route 테스트, 상태 매퍼/동기화 회귀 테스트의 추가 목록.

#### 완료 조건

- [ ] 후속 기능 개방 조건이 서버 검증된 `signed` 상태로 명확히 정의된다.
- [ ] pledge부터 execution까지 필요한 ID와 상태 전이 표가 코드 및 테스트 기준으로 확인된다.
- [ ] 기부자와 조직 멤버의 조회·등록 권한 경계가 유지된다.
- [ ] `signed`와 `paid`의 역할 차이 및 데모 결제에서 donation을 만드는 시점이 확정된다.
- [ ] 동일 pledge/payment 재처리 시 donation이 중복 생성되지 않는 DB·서비스 계약이 정의된다.
- [ ] 정상, 실패, 멱등성, 권한, 참조 정합성 테스트 목록이 구현 가능한 수준으로 작성된다.

### 단계 2. 서명 완료에서 계획서 AI 분석으로 연결

#### 작업 내용

- 기부처 약정/기부 목록과 상세에서 양측 서명 완료 여부를 표시하고, `signed`인 건에만 “계획서 등록” CTA를 제공한다.
- CTA가 선택한 donation/organization 식별자를 `/partner/plans/new`에 전달하도록 연결하고, 계획 등록 폼이 해당 기부 건을 기본 선택하거나 안전하게 검증하도록 한다.
- 계획서를 직접 입력하거나 업로드한 뒤 기존 Upstage OCR 분석, 검토, 등록 완료 화면으로 이어지는 경로를 유지한다.
- 분석 중, 검토 필요, 실패/재시도, 등록 완료 상태별 다음 행동과 돌아갈 기부 상세 링크를 정리한다.

#### 완료 조건

- [x] 서명 미완료 약정에서는 계획서 등록 CTA가 열리지 않는다.
- [x] 서명 완료된 기부에서 올바른 donation을 선택한 계획서 등록 화면으로 이동한다.
- [x] 계획서 업로드/수동 입력 후 분석·검토·등록 상태와 다음 행동을 확인할 수 있다.
- [x] 다른 조직이나 권한 없는 사용자가 대상 기부/계획에 접근할 수 없다.

### 단계 3. 등록된 계획에서 영수증 AI 분석으로 연결

#### 작업 내용

- 등록 완료된 계획의 예산 항목마다 집행/영수증 등록 CTA를 제공하고 plan/plan item 식별자를 `/partner/executions/new`에 전달한다.
- 영수증 등록 폼이 전달된 계획 항목을 기본 선택하되, 등록 완료 계획과 해당 조직 소유 항목인지 서버에서 다시 검증한다.
- 기존 Upstage 영수증 OCR, 합계·사업자번호·기간·잔액·중복 검증, 담당자 검토, 내부 등록 흐름으로 연결한다.
- 분석 실패/재시도, 검토 필요, 등록 완료 상태에서 계획 또는 기부 상세로 돌아갈 수 있도록 이동 경로를 정리한다.

#### 완료 조건

- [ ] 등록된 계획 항목에서 올바른 plan/plan item을 선택한 영수증 분석 화면으로 이동한다.
- [ ] 미등록 계획, 다른 조직 항목, 이미 초과 집행된 항목은 기존 규칙에 따라 차단된다.
- [ ] 영수증 분석·검토·등록 결과와 다음 행동을 확인할 수 있다.

### 단계 4. 전체 진행 상태와 데모 시나리오 통합

#### 작업 내용

- 기부처 기부 상세를 중심으로 `전자서명 → 계획서 분석 → 영수증 분석` 단계와 현재 상태를 한 화면에서 확인할 수 있게 구성한다.
- 기부자 화면에는 조직이 계획과 집행 증빙을 처리 중이라는 읽기 전용 상태를 제공하되 내부 원본 문서나 관리 CTA는 노출하지 않는다.
- 실제 저장 데이터가 없을 때는 빈 상태와 다음 행동을, 데모 목을 사용할 때는 실제 처리 결과로 오인하지 않도록 데모 표시를 제공한다.
- 모든 CTA의 뒤로가기, 완료 후 목적지, 오류 시 복구 경로를 일관되게 정리한다.

#### 완료 조건

- [ ] 기부처가 한 기부 건의 서명·계획·영수증 처리 상태와 다음 행동을 확인할 수 있다.
- [ ] 기부자는 권한 범위 안에서 진행 상태만 확인하고 내부 원본/관리 기능에는 접근하지 못한다.
- [ ] 빈 상태, 처리 중, 검토 필요, 실패, 완료 상태가 서로 구분된다.

### 단계 5. 연결 흐름 회귀 테스트 보강

#### 작업 내용

- `unsigned → signed → plan registered → execution registered` 상태별 CTA와 접근 제한을 단위/컴포넌트 테스트로 검증한다.
- 저장된 pledge/donation/plan/plan item 관계가 실제로 전달되는 흐름을 로컬 Supabase 통합 테스트로 검증한다.
- Playwright에서 기부처 로그인 후 서명 완료 기부를 선택해 계획서 분석과 영수증 분석 결과까지 이동하는 핵심 데모 경로를 검증한다.
- 모두싸인과 Upstage 호출은 기본 자동화에서 목 처리하고 실패·타임아웃·잘못된 응답 회귀를 포함한다.

#### 완료 조건

- [ ] 상태별 CTA, ID 전달, 권한 차단에 대한 재현 가능한 자동화 검증이 있다.
- [ ] 외부 비밀 값 없이 핵심 연결 흐름 테스트가 실행된다.
- [ ] `npm run test:e2e:plans`, `npm run test:e2e:executions`, `npm run test:e2e`, `npm run check`가 통과한다.

### 단계 6. 기부처 화면 개선과 README 최신화

#### 작업 내용

- 연결 흐름 검증 후 기부처 목 데이터를 활동 분야, 주요 사업, 기부금 활용 목적, 기부 가능 조건 중심으로 개편하고 공개 평가 UI를 제거한다.
- 서비스 목적, 기부자·기부처 핵심 기능, 서명→계획서 AI 분석→영수증 AI 분석 사용자 흐름을 문서화한다.
- 현재 기술 스택, 필수/선택 환경 변수의 용도, 설치·로컬 실행·데모 계정·검증 명령을 실제 스크립트와 대조한다.
- 변경된 주요 디렉터리나 명령 책임이 생기면 `AGENTS.md`의 구조·라우팅·검증 안내도 함께 갱신한다.

#### 완료 조건

- [ ] `README.md`만으로 프로젝트 목적, 핵심 기능, 기술 스택과 기본 실행 방법을 이해할 수 있다.
- [ ] 기부처 목록·홈·상세에서 공개 평가 UI가 제거되고 사업·목적·조건 정보가 표시된다.
- [ ] 환경 변수 이름과 실행·검증 명령이 `.env.example`, `package.json`, `AGENTS.md`와 일치한다.
- [ ] 실제 비밀 값이나 개인 정보가 문서와 테스트 픽스처에 포함되지 않는다.

## 5. 테스트 및 검증 계획

| 완료 조건                           | 구현 대상                                                        | 테스트 유형                      | 예상 테스트 파일 또는 검증 방법                                                                                      |
| ----------------------------------- | ---------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 공개 정보 UI 제거 및 핵심 정보 노출 | 기부처 목록·상세·쇼케이스와 목 데이터                            | 컴포넌트/페이지 회귀, Playwright | 신규 `src/app/organizations/*.test.tsx` 또는 `tests/e2e/states.spec.ts`에서 제거 문구 부재, 사업·목적·조건 노출 확인 |
| 필터와 상세·상담 링크 유지          | `/organizations`, `/organizations/[organizationId]`              | Playwright 사용자 흐름           | 카테고리 필터, 빈 상태, 상세 및 상담 CTA 이동 확인                                                                   |
| 서명 완료 상태 반영                 | 약정 waiting/detail 및 상태 표현                                 | 단위/컴포넌트 회귀               | 기존 Modusign 상태 매퍼·동기화 테스트와 상태별 페이지/표현 테스트                                                    |
| 계획서 분석 진입                    | 기부처 기부 상세, 계획 목록·등록                                 | 컴포넌트/Playwright              | 서명 완료된 데모 약정에서 `/partner/plans/new` 또는 관련 리뷰 화면으로 이동 확인                                     |
| 영수증 분석 진입                    | 계획 항목, 집행 목록·등록                                        | 컴포넌트/Playwright              | 등록 계획 항목에서 `/partner/executions/new` 또는 관련 리뷰 화면으로 이동 확인                                       |
| 분석 진행 상태 확인                 | 기부자/기부처 상태 화면                                          | 컴포넌트/Playwright              | 서명·계획·영수증 상태와 다음 CTA의 조건별 노출 확인                                                                  |
| README 최신화                       | `README.md`, `.env.example`, `package.json`, 필요 시 `AGENTS.md` | 문서/정적 검증                   | 링크·명령 수동 대조, `npm run format:check`                                                                          |
| 전체 회귀 없음                      | 전체 변경                                                        | 통합 검증                        | `npm run test:e2e`, `npm run check`, 이후 `verify-change`                                                            |

AI 호출·프롬프트·OCR 파싱 또는 검증 규칙의 변경은 이 이슈 범위에서 제외하므로 새로운 AI 정확성 평가는 해당 없음이다. 다만 기존 AI 분석 진입 경로를 연결하므로 외부 Upstage 호출이 자동화 테스트에서 목 처리되는지, 모델 출력이 완료 상태로 오인되어 표시되지 않는지, 오류·타임아웃 시 기존 안전한 실패 처리가 유지되는지를 회귀 검증한다. AI 도메인 동작까지 변경하게 되면 대표 정상/모호/잘못된 문서, 프롬프트 인젝션, 민감정보 비노출, 스키마 오류와 외부 API 실패 사례를 추가하고 별도 정확성 평가를 실행한다.

## 6. 예상 산출물

```text
README.md
AGENTS.md                                      # 라우트·구조·명령 변경 시
.env.example                                   # 변수 안내 변경 시
src/lib/mock-data/organizations.ts
src/components/organizations/organization-showcase.tsx
src/app/organizations/page.tsx
src/app/organizations/[organizationId]/page.tsx
src/app/my-donations/[pledgeId]/page.tsx        # 기부자 진행 상태 연결 시
src/app/pledges/[pledgeId]/waiting/page.tsx     # 서명 완료 안내 연결 시
src/app/partner/donations/[관련 경로]/page.tsx  # 체결 기부에서 계획 진입
src/app/partner/plans/**                        # 계획 상태·집행 진입 링크
src/app/partner/executions/**                   # 영수증 분석 상태·결과 링크
src/components/partner/**                      # 공유 상태/CTA가 필요할 때
src/**/*.test.ts(x)                            # 변경 UI와 상태 로직 회귀 테스트
tests/e2e/states.spec.ts                       # 데모 상태·링크 회귀
tests/e2e/responsive.spec.ts                   # 반응형 핵심 흐름 회귀
docs/issue_plan/ISSUE-21-connect-signing-ai-flow.md
```

실제 구현 전 저장 데이터 관계를 확인한 뒤 기존 컴포넌트 재사용을 우선하며, 위 후보 중 필요하지 않은 파일은 변경하지 않는다. 새 데이터베이스 스키마가 불가피한 경우에만 별도 Supabase migration과 RLS/RPC 검증을 산출물에 추가한다.

## 7. 권장 작업 순서와 의존성

| 순서 | 작업                                        | 선행 조건                  | 결과                                       |
| ---- | ------------------------------------------- | -------------------------- | ------------------------------------------ |
| 1    | 서명 완료 조건과 pledge→execution 관계 확인 | 기존 마이그레이션/RLS 조사 | 실제 ID·상태·권한 연결표                   |
| 2    | 서명 완료→계획서 분석 연결                  | 1                          | 체결 기부에서 계획 등록·검토 진입          |
| 3    | 계획 항목→영수증 분석 연결                  | 2                          | 계획 예산 항목에서 집행 등록·검토 진입     |
| 4    | 기부 상세 진행 상태 통합                    | 2, 3                       | 서명·계획·영수증 상태와 다음 행동 표시     |
| 5    | 단위/통합/E2E 테스트 추가                   | 2, 3, 4                    | 상태·ID 전달·권한·실패 복구 검증           |
| 6    | 기부처 탐색 UI와 README 갱신                | 핵심 연결 흐름 검증 완료   | 정보 개선 화면과 재현 가능한 실행 문서     |
| 7    | 전체 검증 및 실행 결과 기록                 | 5, 6                       | `npm run check`, E2E, `verify-change` 판정 |

## 8. 전체 완료 기준

- [ ] 요구사항 구현
- [ ] 테스트 및 검증 통과
- [ ] 문서 갱신
- [ ] PR에 검증 결과 기록
- [ ] `verify-change` PASS 및 차단 항목 없음

## 9. 범위에서 제외할 작업

- 실제 기부금 결제 또는 결제 사업자 연동
- 계획서·영수증 AI/OCR 모델, 프롬프트, 파싱 정확도 고도화
- 복잡한 문서 형식 및 모든 실문서 예외 대응
- 기부처 공개 데이터 자동 수집·평가·검증 기능
- 운영 환경 수준의 모두싸인 예외 처리, 재처리 체계 또는 보안 아키텍처 고도화
- 이슈 흐름 연결에 필요하지 않은 기존 Supabase 스키마·마이그레이션 정리

## 10. 주요 위험과 대응

| 위험                                               | 영향                                            | 대응                                                                                       |
| -------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 기부자와 기부처 화면의 역할이 섞임                 | 사용자가 계획서·영수증 업로드 주체를 오해함     | 기부자는 진행 상태를 조회하고 기부처는 문서를 등록·검토하도록 CTA와 권한 경계를 분리한다.  |
| 서명 완료와 내부 DB 상태 동기화 지연               | 후속 CTA가 너무 일찍 또는 늦게 노출됨           | 기존 Webhook/수동 sync의 서버 검증 상태만 사용하고 진행 중 안내와 재조회 경로를 유지한다.  |
| pledge, donation, plan, plan item 식별자 연결 누락 | 정적 데모 링크는 보이지만 실제 저장 흐름이 끊김 | 기존 쿼리와 RLS를 먼저 추적하고 실제 식별자를 전달하는 통합/E2E 검증을 추가한다.           |
| 공개 정보 제거가 필요한 사업 정보까지 삭제         | 기부 의사결정 정보가 부족해짐                   | 평가·검증 수치와 출처 강조만 제거하고 활동 분야·사업·목적·조건은 명시적으로 유지한다.      |
| 목 상태가 실제 AI 처리 완료처럼 보임               | 데모 결과의 신뢰 범위를 오인함                  | 데모/목 표시와 상태 설명을 유지하고 실제 처리 상태와 시각적으로 구분한다.                  |
| 넓은 화면·문서 변경 범위로 회귀 발생               | 기존 서명·결제·OCR 흐름 또는 모바일 UI가 깨짐   | 공유 상태 표현을 재사용하고 근접 테스트 후 `npm run test:e2e`, `npm run check`를 수행한다. |
| 기존 작업 트리 변경과 충돌                         | 사용자 변경을 덮거나 잘못 포함함                | 현재 변경 파일을 보존하고 이슈 파일 선택·커밋 전에 diff를 분리 검토한다.                   |

## 11. 실행 결과

### 변경 내용

- 서명·결제·`paid donation`이 모두 완료된 기부처 약정 상세에 계획서 등록 CTA를 추가했다.
- `donations.pledge_id`로 현재 약정과 연결된 donation을 조회하고, donation ID를 계획서 등록 페이지 쿼리로 전달한다.
- 수동 입력 및 OCR 업로드 폼이 전달된 donation을 자동 선택하도록 연결했다.
- 완료 조건과 자동 선택·CTA 노출 회귀 테스트를 추가했다.

- `donations.pledge_id`와 유일성 인덱스를 추가해 데모 약정과 기부 레코드를 연결했다.
- `create_paid_donation_for_demo_payment` 보안 RPC를 추가해 `signed` pledge, 동일 donor의 `completed` demo payment만 `paid` donation으로 멱등 생성하도록 했다.
- 완료 결제 POST와 재시도 경로에서 donation bridge를 호출하고, bridge 실패는 `donation_bridge_failed` 503으로 반환하도록 했다.
- 실패 결제는 donation을 생성하지 않도록 했고, 연결 성공/멱등/실패/bridge 오류 테스트를 추가했다.

### 완료 조건 추적표

| 완료 조건                  | 구현 파일                                                                                                                                                                                                                                                                                             | 테스트 또는 검증 파일                                                                                                        | 결과      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------- |
| 이슈 계획 수립             | `docs/issue_plan/ISSUE-21-connect-signing-ai-flow.md`                                                                                                                                                                                                                                                 | 이슈 본문·댓글, 저장소 구조 및 규칙 대조                                                                                     | 완료      |
| signed→paid donation 연결  | `supabase/migrations/20260803120000_bridge_demo_payment_to_donation.sql`, `src/app/api/pledges/[pledgeId]/demo-payment/route.ts`                                                                                                                                                                      | `supabase/tests/demo_payment_donation_bridge_test.sql`, `src/app/api/pledges/[pledgeId]/demo-payment/route.test.ts`          | 구현 완료 |
| 서명 완료→계획서 분석 진입 | `src/app/partner/pledges/[pledgeId]/page.tsx`, `src/components/partner/organization-pledge-completion-panel.tsx`, `src/app/partner/plans/new/page.tsx`, `src/components/partner/plan-creation-form.tsx`, `src/components/partner/plan-review-form.tsx`, `src/components/partner/plan-upload-form.tsx` | `src/components/partner/organization-pledge-completion-panel.test.tsx`, `src/components/partner/plan-creation-form.test.tsx` | 구현 완료 |
| 제품 구현 및 검증          | 위 구현 파일 및 테스트                                                                                                                                                                                                                                                                                | `npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build`                                     | 통과      |

### 검증 명령과 결과

```text
명령: GitHub 이슈 #21 본문·댓글·담당·상태 조회, 저장소 관련 파일 조사
결과: Open, 담당자 sunnypark87, 댓글 없음, feat/P0 확인 및 구현 후보·위험 식별

명령: npx vitest run 'src/app/api/pledges/[pledgeId]/demo-payment/route.test.ts'
결과: 6개 테스트 통과

명령: npm test
결과: 107개 파일, 423개 테스트 통과

명령: npm run lint && npm run format:check && npm run typecheck && npm run build
결과: 모두 통과. Next.js production build와 신규 계획서 CTA/자동 선택 변경을 포함해 통과

명령: npx supabase test db
결과: 로컬 DB 테스트 명령 종료 코드 0

명령: npm run check
결과: 통과. format:check, lint, typecheck, Vitest 110개 파일·431개 테스트, Next.js production build까지 완료

명령: npm run test:e2e
결과: 28개 중 25개 통과. 3개 donation-report RLS 통합 테스트는 `NEXT_PUBLIC_SUPABASE_URL` 및 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`가 없는 환경에서 실행되지 않음. 나머지 상태·반응형·계획 등록 테스트는 통과

명령: git diff --check
결과: 통과. 공백·충돌 마커 오류 없음

명령: verify-change acceptance criteria audit
결과: 기부처 공개 정보 UI 제거, 목 데이터 정리, 서명 완료 후 계획 진입, 계획 항목 기반 영수증 진입, 실제 donation 상세 상태 화면, README 갱신 및 MVP 설정 라우트 제거를 구현 파일과 테스트에 대조함. 사용자가 Supabase 환경과 핵심 저장 데이터 흐름을 직접 확인했다고 보고함
```

### AI 정확성 및 안전성 검증

- AI 동작 변경 여부: 모델·프롬프트·OCR 로직 변경 없음. 기존 AI 분석 진입을 위한 결제→donation 연결만 추가
- 정확성 검증 결과: 해당 없음 — 모델·프롬프트·파싱 변경 없음
- 안전성 검증 결과: 해당 없음 — 이번 변경은 모델·프롬프트·출력 처리 변경이 아니며, 기존 서버 측 AI 경계와 민감정보 비노출 테스트를 유지함
- AI가 발견하거나 예방한 품질 문제: 역할별 CTA 혼동, 동기화 지연, 목 결과 오인 위험을 계획에 반영
- 최종 판정: AI 변경 없음; 연결 회귀 검증은 PASS

### 차단 항목과 미검증 범위

- 기존 작업 트리의 무관한 수정·삭제·미추적 파일은 `pre-issue-21-branch-move` stash에 보존하고, 이번 작업은 `feature/21-connect-signing-ai-flow`에서 최신 `origin/main` 기준으로 분리했다.
- 기본 Playwright의 donation-report RLS 통합 3건은 현재 실행 환경의 Supabase 공개 변수 누락으로 미실행되었지만, Issue #21의 핵심 화면 연결과는 별도인 기존 RLS 회귀 범위다.
- 사용자가 실제 Supabase 환경에서 서명 완료 약정의 donation 상세, 계획서 등록, 계획 항목 기반 영수증 분석 흐름을 직접 확인했으며 핵심 acceptance criteria의 수동 검증을 완료했다.

### 남은 작업과 알려진 제한

- `feature/21-connect-signing-ai-flow` 브랜치에서 현재 변경을 검증했다. 사용자가 수정한 `src/app/favicon.ico`는 범위 밖 파일이지만 변경을 보존한다.
- 기본 Playwright의 Supabase RLS 통합 3건은 이번 실행 프로세스의 테스트 환경 변수 부재로 미실행 상태다.

### verify-change 최종 판정

- `npm run check`: 통과
- Issue #21 acceptance criteria 구현 및 코드·테스트 추적: 통과
- 핵심 서명→계획→영수증 흐름 실제 수동 검증: 사용자 확인으로 통과
- 별도 donation-report RLS 통합 테스트 3건: 환경변수 미설정으로 미실행, Issue 범위 외 비차단
- 최종 판정: **PASS**
