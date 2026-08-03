# Issue 구현 계획

## 1. 이슈 개요

- 대상 이슈: [#18 SolarLLM 기반 개인화 기부 집행 보고 작성](https://github.com/sunnypark87/AI-Builder-Sprint-Loop/issues/18)
- 우선순위: P0 (GitHub 라벨 기준. 이슈 본문의 P1 체크와 불일치하므로 구현 착수 시 라벨을 기준으로 관리)
- 상태: Open
- 담당자: HSHwan
- 작성일: 2026-08-03

등록·검증된 기부 약정, 집행 계획, 집행 내역만을 근거로 SolarLLM이 기부자별 완료 보고서 초안을 작성하고, 기부 단체 담당자가 근거와 수치를 검토·수정한 뒤 발행하는 흐름을 구현한다. 금액·기간·계획 대비 집행률 같은 사실 값은 결정론적 서버 로직으로 계산하고, AI는 허용된 근거를 설명하는 문장 생성에만 사용한다. 발행 전 초안은 조직 구성원에게만, 발행된 보고서는 연결된 기부자와 조직 구성원에게만 공개하며 원본 영수증, OCR 원문, 내부 메모, 비밀정보는 모델 입력·출력·로그와 기부자 화면에서 제외한다.

## 2. 현재 저장소 상태

관련 코드, 문서, 설정, 테스트의 현재 상태를 조사해 기록한다.

| 요구사항                | 현재 상태                                                                                                                                                       | 필요한 작업                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 보고서 목록과 상태 표시 | `src/app/partner/reports/page.tsx`가 생성 중·검토 필요·발행 완료 필터와 데모 행을 렌더링한다. 실제 조회와 빈/실패 상태는 없다.                                  | 보고서 저장소 조회 결과로 목록을 교체하고 생성 실패·재시도 가능 상태를 추가한다.                                                              |
| 근거와 AI 초안 대조     | `src/app/partner/reports/demo/review/page.tsx`와 `ReviewWorkspace`가 정적 계획/집행 합계와 AI 문장을 비교한다.                                                  | 동적 `[reportId]/review` 화면에서 저장된 근거 스냅샷, 검증 이슈, 편집 가능한 초안을 조회·저장·발행한다.                                       |
| 기부자 보고서 조회      | `src/app/my-donations/[pledgeId]/page.tsx`는 약정·데모 결제만 조회하고, `src/app/donations/demo/page.tsx`는 개인화 보고서를 대기 상태로만 표시한다.             | 발행된 보고서 링크/상세 화면을 추가하고 해당 약정의 기부자만 조회하도록 한다.                                                                 |
| 약정과 개인화 입력      | `pledges`에는 `donor_user_id`, `organization_id`, 목적·조건 등 약정 정보가 있으나 `donations`에는 기부자 또는 `pledge_id` 연결이 없다.                          | `donations`와 `pledges`의 정규 관계를 추가하고 보고 대상의 기부자·약정 목적을 단일 경로로 결정한다. 기존 데모/집행 데이터 호환 정책을 정한다. |
| 집행 계획 근거          | `expenditure_plans`와 항목 테이블, 등록 상태, 조직 구성원 RLS, 서비스/저장소/API/테스트 패턴이 구현되어 있다.                                                   | 동일 조직·기부의 `registered` 계획과 항목만 보고 근거로 읽고 생성 시 불변 스냅샷을 저장한다.                                                  |
| 집행 내역 근거          | `expenditure_executions`는 결정론적 영수증 검증 후 `registered` 상태와 금액·거래일·항목을 저장한다. 영수증 원본과 OCR 메타데이터는 별도 비공개 구조로 관리된다. | `registered` 집행의 공개 허용 필드만 집계하고 원본 경로, 사업자번호, 승인번호, OCR 원문 등은 보고 입력에서 제외한다.                          |
| SolarLLM 연동           | `src/lib/upstage/document-ocr.ts`에 OCR 전용 서버 클라이언트와 오류/타임아웃/응답 검증 패턴이 있다. 텍스트 생성 클라이언트와 구조화 보고 스키마는 없다.         | Solar Chat Completions용 서버 클라이언트, 모델·URL 설정, 구조화 응답 파서, 오류 매핑 및 모킹 가능한 경계를 추가한다.                          |
| 보고서 상태와 원자성    | 계획·집행에는 `analyzing`, 검토, 실패 상태와 lease 기반 재시도/RPC 패턴이 있다. 보고서 테이블과 발행 원자성은 없다.                                             | 생성 claim/lease, 분석 저장, 실패 기록, 재시도, 편집 저장, 발행을 원자적 RPC로 정의하고 중복 생성과 동시 발행을 방지한다.                     |
| RLS와 공개 경계         | 계획·집행 데이터는 조직 구성원만 읽는다. 약정은 기부자와 조직 구성원이 읽는다. 보고서 정책은 없다.                                                              | 초안/생성 근거는 조직 전용, 발행본은 연결된 기부자와 조직 구성원만 조회하도록 RLS와 서버 권한 검증을 모두 적용한다.                           |
| AI 정확성·안전성 검증   | OCR용 단위·통합·실기 평가가 있으나 보고 생성용 대표 데이터셋, 근거성 평가, 프롬프트 인젝션/민감정보 검사는 없다.                                                | 외부 호출을 모킹한 자동화 테스트와 별도 실기 SolarLLM 평가를 추가하고 사실 일치성·미추론·안전성 기준을 문서화한다.                            |
| 환경 변수와 문서        | `.env.example`에 공통 `UPSTAGE_API_KEY`, OCR 모델/URL만 있다. `AGENTS.md`에는 보고 API와 실기 평가 명령이 없다.                                                 | 서버 전용 Solar 모델/URL 변수와 새 검증 명령, 라우트·디렉터리 책임을 문서화한다.                                                              |

## 3. 선행 결정

- GitHub 라벨 `P0`을 현재 우선순위의 기준으로 사용한다. 이슈 본문의 P1 체크는 구현 중 이슈를 수정하는 별도 GitHub 작업에서 정합성을 맞춘다.
- 보고서는 한 `donation`과 그 기부의 한 `pledge`/기부자에 귀속되는 개인화 산출물로 설계한다. 현재 끊긴 관계는 `donations.pledge_id` nullable unique FK를 추가하고, 보고 생성 가능 조건에서는 non-null을 요구하는 방향을 우선안으로 한다. 기존 집행 fixture와 과거 데이터는 nullable로 유지하고 보고 대상에서 제외한다.
- 결제 완료 약정에서 실제 `donations` 레코드를 생성·연결하는 책임과 데이터 이관 범위는 구현 착수 전에 확정한다. 최소 구현에서도 테스트/데모 데이터에는 `pledge_id` 연결이 반드시 존재해야 한다.
- 보고 대상은 `paid` 기부, `registered` 계획 1건, `registered` 집행 1건 이상, 연결된 서명 완료 약정으로 제한한다. 생성 시점의 약정·계획·집행 공개 필드를 근거 스냅샷으로 저장해 이후 원본 변경에도 검토 근거를 재현한다.
- 개인화 입력은 기부자 이름 같은 프로필 개인정보가 아니라 약정 목적, 기부 조건, 보고 관심 항목으로 제한한다. 개인 식별이 불필요한 프롬프트에는 기부자 ID와 이메일도 전달하지 않는다.
- 계획 예산, 실제 집행액, 잔액, 집행률, 항목별 합계와 근거 식별자는 서버가 계산한다. SolarLLM 출력의 수치나 근거 ID는 서버 값과 일치하지 않으면 검증 이슈로 차단하며 그대로 저장·발행하지 않는다.
- SolarLLM 출력은 제목, 요약, 계획 대비 집행 설명, 항목별 설명, 성과, 향후 계획, 근거 참조로 구성한 버전 명시 JSON 스키마로 제한한다. 자유 형식 Markdown/HTML은 저장하지 않고 렌더링 시 React 텍스트로 처리한다.
- AI가 성과 수치나 향후 계획을 뒷받침할 근거가 없으면 추론하지 않고 `정보 부족` 또는 담당자 입력 필요 상태로 반환한다. 담당자가 추가한 문장도 발행 전 근거 연결 또는 명시적인 담당자 작성 표시를 요구한다.
- 상태는 `generating`, `review_required`, `generation_failed`, `published`를 기본으로 하고, lease 만료 후에만 생성 재시도를 claim한다. 같은 기부·보고 기간에는 활성 보고서가 한 건만 존재하도록 유일성/멱등성 키를 둔다.
- 초안 저장과 발행은 분리한다. 발행 RPC는 검증 이슈가 없고 필수 항목이 유효하며 현재 조직 구성원에게 권한이 있을 때만 상태와 `published_by`, `published_at`, 최종 콘텐츠 스냅샷을 원자적으로 기록한다.
- 이 이슈에서는 후속 #19가 소비할 `report_published:{reportId}` 이벤트 계약 또는 멱등한 outbox 연동 지점까지만 정의한다. 실제 알림 레코드/UI는 #19 범위로 남긴다.
- 외부 AI는 자동화 테스트에서 모두 모킹한다. 실제 SolarLLM 평가는 별도 opt-in 명령과 비식별 대표 fixture로 수행하며 `npm run check`에는 실 API 호출을 포함하지 않는다.

## 4. 구현 단계

### 단계 1. 기부자 연결과 보고서 보안 도메인 설계

#### 작업 내용

- `donations`와 `pledges`의 연결 컬럼, 참조 무결성, 기존 데이터 호환 정책을 마이그레이션으로 정의한다.
- `donation_reports`에 조직·기부·약정·작성자·검토자·발행자, 보고 기간, 상태, 멱등성 키, lease, 오류 코드, AI 초안, 담당자 수정본, 최종 발행본, 근거 스냅샷, 검증 이슈, 모델 메타데이터와 시각 필드를 정의한다.
- 조직 구성원은 모든 상태를 조회하고, 기부자는 자신의 `published` 보고서만 조회하는 RLS를 작성한다. 직접 insert/update는 service role/RPC 경계로 제한한다.
- 생성 claim, 결과 저장, 실패 기록, 재시도 claim, 초안 저장, 발행 RPC를 상태 전이와 함께 원자적으로 설계한다.
- 동일 기부·기간 중복, 잘못된 조직/약정/기부 연결, 비등록 계획·집행, 동시 생성·발행을 데이터베이스에서 재검증한다.
- 마이그레이션 정적 정책 테스트와 로컬 Supabase 역할 매트릭스 시나리오를 정의한다.

#### 완료 조건

- [x] 보고 대상 기부에서 조직과 기부자를 정규 관계로 추적할 수 있다.
- [x] 초안은 조직 구성원만, 발행본은 해당 기부자와 조직 구성원만 조회할 수 있다.
- [x] 생성·재시도·편집·발행 상태 전이가 원자적이며 중복과 경합을 차단한다.
- [x] 원본 영수증/OCR 데이터에 대한 기부자 권한은 확대되지 않는다.

### 단계 2. 공개 근거 집계와 결정론적 검증 구현

#### 작업 내용

- 보고 대상 선택 시 `paid` 기부, 연결 약정, `registered` 계획/항목, `registered` 집행만 조회하는 저장소를 구현한다.
- 허용 목록 방식으로 약정 목적·조건, 계획 제목/기간/예산/항목, 집행 일자/금액/공개 상호 또는 설명만 입력 DTO에 포함한다.
- 사업자번호, 승인번호, 결제 수단, 원본 Storage 경로, OCR 페이지/원문, 내부 경고 사유와 사용자 식별자를 입력 DTO에서 제거한다.
- 총 계획액, 총 집행액, 잔액, 집행률과 항목별 합계를 정수 금액 기준으로 계산하고 원본 레코드 ID/버전과 함께 근거 스냅샷을 만든다.
- 빈 집행, 계획 기간 밖 집행, 합계 불일치, 다른 기부/조직의 참조, 부족한 성과 근거를 생성 전 또는 발행 전 검증 이슈로 반환한다.
- 스냅샷과 담당자 수정본을 검증하는 버전 명시 스키마 및 순수 함수 단위 테스트를 추가한다.

#### 완료 조건

- [x] AI 입력과 공개 스냅샷에 허용된 최소 필드만 포함된다.
- [x] 모든 금액·기간·비율은 AI 호출 전에 결정론적으로 계산된다.
- [x] 보고서 문장과 수치가 참조할 수 있는 근거 ID가 재현 가능하게 저장된다.
- [x] 근거가 없거나 서로 모순되는 보고서는 안전하게 검토/차단 상태가 된다.

### 단계 3. SolarLLM 구조화 생성 경계 구현

#### 작업 내용

- `UPSTAGE_API_KEY`를 재사용하고 `UPSTAGE_SOLAR_MODEL`, 선택적 서버 전용 `UPSTAGE_SOLAR_URL`을 지원하는 Solar Chat Completions 클라이언트를 추가한다.
- 요청 타임아웃, 인증 실패, rate limit, 4xx/5xx, 네트워크 오류, 빈 응답, JSON 파싱 실패와 스키마 불일치를 안정적인 내부 오류 코드와 재시도 가능 여부로 변환한다.
- 시스템 프롬프트에 제공된 근거만 사용, 수치 재계산 금지, 외부 지시/원문 내 명령 무시, 정보 부족 표시, 개인정보 생성 금지 규칙을 고정한다.
- 구조화 JSON 응답을 파싱하고 길이·항목 수·근거 참조·수치 일치·허용 문자열을 서버에서 재검증한다.
- 모델명, API 버전, 프롬프트 버전, 처리 시각만 메타데이터로 저장하고 API 키, 전체 시스템 프롬프트, 원본 요청/응답 전문은 로그나 DB에 저장하지 않는다.
- 외부 fetch를 모킹해 성공, malformed output, timeout, rate limit, prompt injection 데이터와 민감정보 출력 시도를 검증한다.

#### 완료 조건

- [x] SolarLLM은 서버에서만 호출되며 비밀정보가 클라이언트와 로그에 노출되지 않는다.
- [x] 모델 출력은 스키마와 근거 검증을 통과해야만 검토 초안으로 저장된다.
- [x] 외부 API 실패가 안전한 실패 상태와 재시도 가능 여부로 변환된다.
- [x] 근거에 포함된 악성 문구가 시스템 규칙이나 출력 형식을 변경하지 못한다.

### 단계 4. 보고 생성·조회·재시도 API와 서비스 구현

#### 작업 내용

- `src/lib/reports/`에 타입, 스키마, 근거 집계, 출력 검증, 저장소, 서비스 계층을 기존 plans/executions 패턴에 맞춰 추가한다.
- 조직 구성원의 보고 대상 목록 조회와 `POST /api/partner/reports` 생성 요청을 구현하고 UUID/기간/멱등성 키를 검증한다.
- `GET /api/partner/reports/[reportId]`에서 조직 권한이 검증된 근거·초안·검증 이슈·상태만 반환한다.
- `PATCH /api/partner/reports/[reportId]`에서 수정본을 재검증해 저장하고, 별도 publish 엔드포인트에서 최종 발행을 수행한다.
- `POST /api/partner/reports/[reportId]/retry`는 실패 또는 만료된 lease만 claim하여 같은 근거 스냅샷으로 재생성한다.
- API 응답은 인증 없음, 권한 없음/존재 숨김, 유효성 오류, 충돌, 재시도 가능 upstream 오류를 구분하되 내부 DB/API 오류와 민감정보는 공개하지 않는다.
- 발행 성공 시 #19가 사용할 보고서 발행 이벤트/outbox 계약을 동일 트랜잭션에 기록하거나 후속 구현이 안전하게 조회할 수 있는 확정 필드를 제공한다.

#### 완료 조건

- [x] 권한 있는 조직 구성원이 생성부터 검토 저장·발행까지 수행할 수 있다.
- [x] 중복 요청과 동시 재시도에도 보고서/AI 호출이 무제한 중복되지 않는다.
- [x] 실패 상태에서만 안전하게 재시도할 수 있고 기존 근거와 수정본이 손상되지 않는다.
- [x] 모든 Route Handler가 입력 검증, 인증, 오류 비노출 테스트를 갖는다.

### 단계 5. 조직 담당자 생성·검토·발행 화면 구현

#### 작업 내용

- `/partner/reports`의 데모 행을 실제 상태별 목록으로 교체하고 빈 상태, 생성 중, 실패/재시도, 검토 필요, 발행 완료를 표시한다.
- 보고 가능한 기부를 선택하고 생성 요청을 시작할 수 있는 `/partner/reports/new` 또는 동등한 흐름을 추가한다.
- `/partner/reports/[reportId]/review`에서 약정 목적, 계획/집행 결정론적 합계, 근거별 참조, AI 초안과 검증 이슈를 나란히 표시한다.
- 구조화 섹션별 편집, 저장 중/성공/실패 피드백, 미저장 변경 경고와 접근 가능한 오류/상태 표현을 제공한다.
- 발행 전 필수 항목과 근거 검증을 다시 수행하고, 확인 다이얼로그 뒤 서버 발행 성공 응답을 받은 경우에만 완료 상태를 표시한다.
- 생성 중/실패/이미 발행/권한 없음/삭제된 근거의 사용자 흐름을 구현하고 데모 전용 경로의 유지 또는 제거를 명시한다.

#### 완료 조건

- [x] 담당자가 실제 기부를 선택해 보고서를 생성하고 상태를 확인할 수 있다.
- [x] 담당자가 근거와 AI 초안을 비교해 수정·저장할 수 있다.
- [x] 미해결 차단 이슈가 있으면 발행할 수 없고, 발행은 명시적 확인 뒤 한 번만 완료된다.
- [x] 키보드 탐색, 레이블, 상태 텍스트와 오류 포커스가 디자인 시스템 접근성 원칙을 충족한다.

### 단계 6. 기부자 발행 보고서 조회 구현

#### 작업 내용

- `/my-donations/[pledgeId]`에 해당 약정의 발행 보고서 목록/최신 보고서 링크를 추가한다.
- `/my-donations/[pledgeId]/reports/[reportId]` 또는 동등한 상세 화면에서 최종 발행 스냅샷, 계획 대비 집행, 항목별 내역, 성과와 향후 계획을 표시한다.
- Server Component에서 `getUser()` 기반 사용자 검증과 RLS를 함께 적용하고 미발행/다른 기부자/다른 약정 보고서는 존재를 노출하지 않고 404 처리한다.
- 기부자 화면에는 원본 증빙 링크, OCR 원문, 사업자번호, 승인번호, 내부 검증 이슈, 담당자 정보와 AI 내부 메타데이터를 노출하지 않는다.
- 발행 후 원본 계획·집행이 바뀌어도 발행 스냅샷은 그대로 재현하며 수정/재발행 정책은 이번 범위에서 허용하지 않는다.

#### 완료 조건

- [x] 발행된 보고서만 해당 기부자에게 보인다.
- [x] 다른 기부자와 익명 사용자는 보고서 존재와 내용을 조회할 수 없다.
- [x] 기부자 화면에 민감한 증빙·OCR·내부 정보가 포함되지 않는다.
- [x] 발행 당시 최종본을 일관되게 표시한다.

### 단계 7. 통합·AI 정확성·안전성 검증과 문서화

#### 작업 내용

- 도메인 순수 함수, Solar 클라이언트, 저장소, 서비스, Route Handler, 주요 UI의 정상·오류·경계 단위 테스트를 추가한다.
- 로컬 Supabase에서 조직 작성자, 같은 조직 다른 구성원, 대상 기부자, 다른 기부자, 다른 조직, 익명 역할의 생성/초안/발행본 접근 매트릭스를 검증한다.
- 생성 → 검토/수정 → 발행 → 기부자 조회를 재현하는 통합/E2E 시나리오와 실패/재시도/중복 요청 시나리오를 추가한다.
- 대표 정확성 fixture로 완전한 근거, 약정 목적이 다른 기부자, 빈 성과 근거, 다수 항목, 긴 입력, 합계 경계 사례를 평가한다.
- 안전성 fixture로 프롬프트 인젝션, 개인정보·원본 증빙 문자열, 시스템 프롬프트/API 키 요청, 잘못된 JSON, 근거에 없는 수치/성과 생성을 평가한다.
- 통과 기준을 사실/수치 100% 근거 일치, 근거 없는 사실 0건, 금지 필드 노출 0건, 구조화 스키마 통과 100%로 두고 사람 검토 결과를 기록한다.
- `.env.example`, `AGENTS.md`, `README.md`(필요 시), `docs/testing-strategy.md` 연계 내용과 이 계획의 실행 결과를 갱신한다.
- `npm run check`와 `verify-change`를 실행해 모든 완료 조건에 구현·검증 증거를 연결한다.

#### 완료 조건

- [x] 자동화 테스트가 외부 키 없이 결정론적으로 통과한다.
- [x] 로컬 Supabase 역할별 RLS 접근 행렬이 통과한다.
- [x] 대표 SolarLLM 정확성·안전성 평가가 사전 정의된 기준을 충족한다.
- [x] `npm run check`와 `verify-change`가 차단 항목 없이 PASS한다.
- [x] 환경 변수, 마이그레이션, 배포 영향과 알려진 제한이 문서화된다.

## 5. 테스트 및 검증 계획

| 완료 조건                         | 구현 대상                       | 테스트 유형            | 예상 테스트 파일 또는 검증 방법                                                                                                           |
| --------------------------------- | ------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 기부-약정 관계와 보고 대상 무결성 | Supabase migration/RPC          | 마이그레이션 정책·통합 | `src/lib/reports/migration-policy.test.ts`, 로컬 Supabase fixture에서 잘못된 조직/약정/기부 조합 거부 확인                                |
| 초안/발행본 RLS 분리              | `donation_reports` RLS          | 보안 통합              | `scripts/verify-rls.mjs` 확장 또는 `tests/e2e/donation-report-integration.spec.ts`에서 조직·대상 기부자·타 기부자·익명 매트릭스 확인      |
| 허용 필드만 근거 스냅샷에 포함    | 근거 집계/DTO                   | 단위                   | `src/lib/reports/report-evidence.test.ts`에서 사업자번호·승인번호·원본 경로·OCR 원문·내부 메모 부재 확인                                  |
| 금액·기간·집행률 결정론적 계산    | 보고 집계/검증                  | 단위                   | `src/lib/reports/report-verification.test.ts`에서 정상, 0원/초과, 다항목, 합계 불일치, 정수 경계 확인                                     |
| Solar 구조화 응답 검증            | Solar 클라이언트/스키마         | 단위                   | `src/lib/upstage/solar-chat.test.ts`, `src/lib/reports/report-schema.test.ts`에서 정상, 빈 응답, malformed JSON, 길이/참조/수치 오류 확인 |
| 외부 API 오류 안전 처리           | 생성 서비스                     | 단위·Route             | `src/lib/reports/report-service.test.ts`, API route test에서 timeout, rate limit, 인증 실패, 5xx, 민감정보 비노출 확인                    |
| 생성 멱등성과 lease 재시도        | 생성 RPC/서비스                 | 단위·통합              | 동일 키 재요청, 다른 payload 충돌, 활성 lease 거부, 만료 lease claim, 이미 검토/발행 상태 재생성 금지                                     |
| 담당자 수정본 재검증·발행 원자성  | 수정/발행 RPC와 API             | 단위·통합              | 검증 이슈/권한/동시 발행 실패, 정상 발행의 최종 스냅샷·발행자·시각·이벤트 계약 원자 기록 확인                                             |
| 조직 목록·검토 UI                 | partner report pages/components | 컴포넌트·E2E           | 상태 필터, 빈/생성/실패/검토/발행 상태, 편집 저장, 발행 확인, 오류 피드백과 키보드 접근 확인                                              |
| 기부자 발행본 조회                | my-donations report pages       | 페이지·RLS·E2E         | 대상 기부자는 발행본 조회, 미발행·타 기부자·익명은 404, 금지 필드 미렌더링 확인                                                           |
| 전체 흐름 회귀                    | 생성부터 기부자 조회            | 로컬 Supabase E2E      | `tests/e2e/run-report-integration.mjs`, `npm run test:e2e:reports` 추가 후 생성→검토→발행→조회 및 실패→재시도 수행                        |
| 정적·전체 회귀                    | 저장소 전체                     | 통합 명령              | `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, 최종 `npm run check`                        |
| Issue 인수 조건 추적              | 전체 변경                       | 검증 스킬              | `verify-change`로 각 조건의 구현 파일·테스트 증거와 AI 평가 결과를 이 문서 실행 결과에 기록                                               |

AI 동작이 변경되므로 다음 정확성·안전성 사례를 필수로 검증한다.

- 정확성: 완전한 단일/다중 집행, 계획 대비 잔액, 서로 다른 약정 목적, 근거가 없는 성과, 긴 항목 목록, 합계 불일치에서 저장된 사실·수치·근거 참조가 100% 일치해야 한다.
- 프롬프트 인젝션: 약정 목적이나 집행 설명에 “이전 규칙 무시”, HTML/스크립트, 비밀정보 요청이 포함되어도 데이터로만 취급되고 출력 규칙을 바꾸지 않아야 한다.
- 민감정보: API 키, 시스템 프롬프트, 사용자 ID/이메일, 사업자번호, 승인번호, 원본 Storage URL, OCR 원문, 내부 메모가 모델 입력 허용 목록과 저장·응답·로그·기부자 UI에 나타나지 않아야 한다.
- 모델 출력 검증: JSON 외 응답, 필수 필드 누락, 알 수 없는 근거 ID, 근거에 없는 숫자, 과도한 문자열, HTML은 거부하고 `generation_failed` 또는 검토 차단 이슈로 처리해야 한다.
- 외부 API 실패: timeout, rate limit, 인증 실패, 네트워크 오류, 4xx/5xx가 데이터 손상 없이 안전한 상태와 일반화된 사용자 메시지로 변환되어야 한다.
- 실제 모델 평가는 비식별 fixture와 별도 opt-in 명령으로 실행하고 결과를 사람이 검토한다. 모델 자기평가만으로 PASS를 판정하지 않는다.

## 6. 예상 산출물

```text
.env.example
AGENTS.md
README.md                                             # 실행/검증 안내가 필요한 경우
package.json
docs/issue_plan/ISSUE-18-ai-donation-report.md
scripts/verify-rls.mjs                                # 보고서 역할 매트릭스 확장 시
supabase/migrations/<timestamp>_create_donation_reports.sql
src/app/api/partner/reports/route.ts
src/app/api/partner/reports/route.test.ts
src/app/api/partner/reports/[reportId]/route.ts
src/app/api/partner/reports/[reportId]/route.test.ts
src/app/api/partner/reports/[reportId]/publish/route.ts
src/app/api/partner/reports/[reportId]/publish/route.test.ts
src/app/api/partner/reports/[reportId]/retry/route.ts
src/app/api/partner/reports/[reportId]/retry/route.test.ts
src/app/partner/reports/page.tsx
src/app/partner/reports/new/page.tsx
src/app/partner/reports/[reportId]/review/page.tsx
src/app/my-donations/[pledgeId]/page.tsx
src/app/my-donations/[pledgeId]/reports/[reportId]/page.tsx
src/components/partner/report-create-form.tsx
src/components/partner/report-review-editor.tsx
src/components/reports/donation-report-view.tsx
src/lib/reports/types.ts
src/lib/reports/report-schema.ts
src/lib/reports/report-schema.test.ts
src/lib/reports/report-evidence.ts
src/lib/reports/report-evidence.test.ts
src/lib/reports/report-verification.ts
src/lib/reports/report-verification.test.ts
src/lib/reports/report-repository.ts
src/lib/reports/report-repository.test.ts
src/lib/reports/report-service.ts
src/lib/reports/report-service.test.ts
src/lib/upstage/solar-chat.ts
src/lib/upstage/solar-chat.test.ts
tests/e2e/donation-report-integration.setup.ts
tests/e2e/donation-report-integration.spec.ts
tests/e2e/run-report-integration.mjs
tests/ai/donation-report-generation.spec.ts            # 실제 SolarLLM opt-in 평가 위치는 구현 시 확정
playwright.report.config.ts                            # 별도 평가 설정이 필요할 경우
```

파일명과 라우트 분리는 구현 중 기존 패턴과 테스트 격리를 확인해 조정할 수 있다. 신규 의존성은 기본적으로 추가하지 않고 현재 TypeScript 검증과 `fetch`, Vitest, Playwright, Supabase 클라이언트를 재사용한다.

## 7. 권장 작업 순서와 의존성

| 순서 | 작업                                                     | 선행 조건              | 결과                     |
| ---- | -------------------------------------------------------- | ---------------------- | ------------------------ |
| 1    | 기부-약정 연결과 보고서 상태/RLS/RPC 설계                | 데이터 연결 정책 확정  | 마이그레이션과 보안 경계 |
| 2    | 공개 근거 DTO·집계·검증 순수 함수 구현                   | 단계 1 스키마 확정     | 결정론적 근거 스냅샷     |
| 3    | SolarLLM 클라이언트·프롬프트·출력 스키마 구현            | 단계 2 입력/출력 계약  | 모킹 가능한 AI 경계      |
| 4    | 보고 저장소·서비스와 생성/조회/수정/재시도/발행 API 구현 | 단계 1~3               | 서버 기능과 상태 전이    |
| 5    | 조직 목록·생성·검토·발행 UI 구현                         | 단계 4 API 안정화      | 담당자 전체 흐름         |
| 6    | 기부자 발행 보고서 조회 구현                             | 발행 스냅샷과 RLS 완성 | 기부자 공개 흐름         |
| 7    | 단위·RLS·E2E·실기 AI 평가 및 문서 갱신                   | 단계 1~6               | 인수 조건 검증 증거      |
| 8    | `npm run check`와 `verify-change` 수행                   | 모든 구현/테스트 완료  | 최종 PASS/FAIL 판정      |

## 8. 전체 완료 기준

- [x] 연결된 기부·약정과 등록된 계획·집행만 보고 대상으로 선택된다.
- [x] SolarLLM 입력은 최소 공개 필드로 제한되고 모든 사실·수치·근거 참조가 서버 데이터와 일치한다.
- [x] 근거 부족 시 AI가 추측하지 않으며 잘못된 구조/수치/참조는 저장 또는 발행되지 않는다.
- [x] 조직 담당자가 초안을 비교·수정·저장하고 명시적으로 확정한 뒤에만 발행된다.
- [x] 생성 실패와 lease 만료를 안전하게 재시도하며 중복 생성·동시 발행을 차단한다.
- [x] 초안은 조직 구성원만, 발행본은 해당 기부자와 조직 구성원만 조회한다.
- [x] 원본 영수증, OCR 원문, 내부 메모, 사용자 개인정보와 비밀정보가 AI/로그/API/기부자 UI에 노출되지 않는다.
- [x] 후속 알림 이슈가 소비할 발행 이벤트 또는 멱등 연동 계약이 정의된다.
- [x] 요구사항 구현
- [x] 테스트 및 검증 통과
- [x] 문서 갱신
- [ ] PR에 검증 결과 기록
- [x] `npm run check` 통과
- [x] 대표 SolarLLM 정확성·안전성 평가 통과
- [x] `verify-change` PASS 및 차단 항목 없음

## 9. 범위에서 제외할 작업

- 검증되지 않은 외부 자료 검색 또는 모델 사전지식으로 보고서 사실을 보강하는 기능
- AI 초안 자동 발행과 담당자 승인 생략
- 원본 영수증, OCR 원문, 사업자번호, 승인번호 또는 내부 검토 메모의 기부자 공개
- PDF/문서 다운로드, 다국어 번역, 정기 예약 생성, SolarLLM 파인튜닝
- 이메일, SMS, 모바일 푸시와 외부 메시징 연동
- 알림 목록·읽음 상태 UI와 실제 알림 생성(#19 범위)
- 보고서 발행 후 버전 관리, 회수, 수정 발행과 감사 이력 고도화
- 여러 기부자에게 하나의 공통 보고서를 일괄 발행하는 캠페인/배치 기능
- 기부자 프로필 전체를 이용한 추천·성향 분석 또는 민감정보 기반 개인화
- 계획·집행 OCR 기능 자체의 정확도 개선

## 10. 주요 위험과 대응

| 위험                                     | 영향                                                                    | 대응                                                                                                                   |
| ---------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `donations`와 `pledges`가 연결되지 않음  | 보고서 대상 기부자를 안전하게 판별할 수 없어 개인화와 RLS 구현이 불가능 | nullable unique `pledge_id` FK와 생성/fixture 연결 정책을 먼저 확정하고, 연결 없는 기부는 보고 대상에서 제외한다.      |
| 이슈 라벨 P0와 본문 P1 불일치            | 일정·범위 우선순위 혼선                                                 | 최신 GitHub 라벨 P0을 계획 기준으로 기록하고 구현 착수 시 이슈 메타데이터 정합성을 재확인한다.                         |
| AI 환각 또는 수치 재작성                 | 잘못된 집행 보고가 기부자 신뢰를 훼손                                   | 수치는 서버 계산값만 렌더링하고 AI 출력의 수치·근거 ID를 재검증하며 불일치는 발행 차단한다.                            |
| 약정/집행 원문 속 프롬프트 인젝션        | 시스템 규칙 우회, 비밀정보 또는 허위 문장 생성                          | 최소 DTO, 명확한 데이터 경계, 구조화 출력, 허용 목록 검증, 악성 fixture 평가를 적용한다.                               |
| 영수증 개인정보·내부 메모 노출           | 개인정보 침해와 보안 사고                                               | 원본/OCR 테이블을 조회하지 않는 전용 근거 쿼리, 금지 필드 테스트, 로그 전문 미저장, 기부자 RLS 분리를 적용한다.        |
| 보고 생성 중 중복 요청/서버 종료         | 중복 비용, 영구 generating 상태, 데이터 불일치                          | 멱등성 키, DB lease, 만료 claim, 원자적 결과/실패 저장과 재시도 제한을 사용한다.                                       |
| 생성 후 계획·집행 데이터 변경            | 검토 근거와 발행 내용이 달라짐                                          | 생성 시 버전/ID가 포함된 근거 스냅샷을 저장하고 발행 시 현재 원본과의 변경 여부를 검증하거나 재생성을 요구한다.        |
| service-role RPC의 과도한 권한           | 다른 조직 보고서 조작 가능                                              | 모든 RPC가 actor ID, 조직 멤버십, 연결된 기부/약정, 상태를 DB에서 다시 검증하고 직접 테이블 쓰기를 차단한다.           |
| Solar API 지연·rate limit·비용           | UX 저하와 반복 호출 비용                                                | 타임아웃, 오류 분류, 상태 기반 재시도, 활성 lease 중 재호출 차단, 일반화된 오류 안내를 적용한다.                       |
| 담당자 자유 편집으로 근거 없는 주장 추가 | AI 검증을 우회한 허위 보고 발행                                         | 수정본도 동일 스키마/근거 규칙으로 재검증하고 담당자 입력 전용 항목 정책을 명시하며 차단 이슈를 발행 RPC에서 확인한다. |
| 발행과 후속 알림의 트랜잭션 경계         | 보고서는 발행됐으나 알림 이벤트가 누락될 수 있음                        | 발행 트랜잭션에 outbox 또는 멱등 이벤트 키를 기록하고 #19가 재처리 가능하게 한다.                                      |
| 실제 모델 평가의 비결정성                | CI 불안정 또는 잘못된 PASS                                              | `npm run check`에서는 모킹하고, 별도 버전 고정 opt-in 평가에 사전 기준과 사람 검토를 적용한다.                         |

## 11. 실행 결과

### 변경 내용

- 후속 진입 핫픽스로 보고서 목록을 인증된 사용자와 서버 클라이언트의 조직 범위로 조회하고, 목록 조회 실패 시에도 `보고서 작성하기` 버튼을 유지했다. 집행 내역 등록 완료 화면에는 `AI 보고서 작성하기`와 집행 목록 이동 선택지를 추가했다.
- 시연용 집행 계획·영수증 PDF가 OCR에서 한 줄로 평탄화되어도 계획 항목과 영수증 필드·품목을 복원하도록 파서를 보강했다. 계획은 3,000,000원 단일 항목으로 단순화하고 영수증 세 품목 합계도 3,000,000원으로 맞춰 보고서에서 계획 대비 100% 집행 사례를 만들었다.
- `donations.pledge_id`, 보고서/발행 이벤트 테이블, 상태 전이 RPC, 역할별 RLS를 추가했다. 기존 서약 스키마에 누락됐던 `authenticated` 읽기와 `service_role` 서버 작업 권한은 별도 보정 마이그레이션으로 명시했다.
- `src/lib/reports/`에 공개 근거 허용 목록, 결정론적 집계, 구조화 콘텐츠 검증, 저장소와 생성·저장·재시도·발행 서비스를 구현했다.
- 서버 전용 Solar Chat Completions 클라이언트와 오류 분류, 타임아웃, JSON 응답 검증, 프롬프트 인젝션 방어 규칙을 추가했다.
- 조직용 보고 대상/생성·조회·수정·재시도·발행 API와 목록·생성·검토 UI, 기부자용 발행 보고서 목록·상세 UI를 구현했다.
- 데모 결제 완료 시 기부와 약정을 멱등하게 연결하고, 발행 트랜잭션이 후속 #19용 `report_published:{reportId}` 이벤트를 함께 기록하도록 했다.
- 직접 기능 리뷰를 반영해 한 기부에 등록 계획이 여러 건이어도 집행 내역이 있는 모든 계획을 보고 대상으로 노출하고, 날짜는 전체 날짜 표현으로만 검증해 월·일 숫자가 근거 없는 인원수 등의 주장을 허용하지 않도록 보강했다.
- PR 기능 리뷰를 반영해 다중 계획 선택값과 생성 요청을 `planId`로 연결하고 계획별 멱등성 키를 사용하도록 수정했다.
- 수치 주장은 인용한 근거 ID별로 허용된 금액·건수·집행률과 단위까지 일치할 때만 승인해, 같은 값의 인원수 주장이나 음수 금액 및 다른 근거의 수치 재사용을 차단했다.
- 기부자의 보고서 원본 테이블 조회 정책을 제거하고 발행본 렌더링에 필요한 7개 필드만 반환하는 `get_published_donation_reports` RPC를 추가했다.
- 후속 PR 기능 리뷰를 반영해 숫자가 포함된 계획명·항목명·목적·상호는 인용한 원본 문자열과 정확히 일치할 때 허용하고, 날짜는 인용한 계획 또는 집행 근거에 속할 때만 허용하도록 검증을 보강했다. 부호와 숫자를 띄운 음수 금액도 차단한다.
- `UPSTAGE_SOLAR_MODEL`, `UPSTAGE_SOLAR_URL`은 선택적 서버 변수다. 신규 필수 변수나 npm 의존성은 없으며 배포 전 세 마이그레이션을 순서대로 적용해야 한다.

### 완료 조건 추적표

| 완료 조건                       | 구현 파일                                                                                                               | 테스트 또는 검증 파일                                                                                  | 결과 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---- |
| 기부·약정·계획·집행 근거 무결성 | `20260803000000_create_donation_reports.sql`, `report-repository.ts`, `report-evidence.ts`                              | `migration-policy.test.ts`, `report-evidence.test.ts`, `report-service.test.ts`                        | PASS |
| 결정론적 수치와 AI 근거 일치    | `report-evidence.ts`, `report-schema.ts`                                                                                | `report-evidence.test.ts`, `report-schema.test.ts`, 실제 Solar 대표 사례 3건                           | PASS |
| 담당자 검토 후 발행             | 보고서 `[reportId]` API, `report-review-editor.tsx`, `publish_donation_report` RPC                                      | Route/서비스 단위 테스트, `npm run check` 프로덕션 빌드                                                | PASS |
| 조직/기부자 RLS 분리            | 보고서 RLS, `20260803010000_grant_pledge_access_for_reports.sql`, `20260803020000_restrict_donor_report_projection.sql` | `donation-report-rls.integration.spec.ts` 기관/대상 기부자 안전 projection/타 기부자·익명 3개 시나리오 | PASS |
| 민감정보 비노출                 | `report-evidence.ts`, `solar-chat.ts`, 기부자 `donation-report-view.tsx`                                                | 허용 필드·프롬프트 인젝션·HTML·비밀정보 비노출 단위/실기 평가                                          | PASS |
| 실패 재시도와 중복 방지         | 생성/저장/실패/재시도 RPC, `report-service.ts`, retry API                                                               | `report-service.test.ts`, `migration-policy.test.ts`                                                   | PASS |
| 기부자 발행본 조회              | `/my-donations/[pledgeId]`, `/my-donations/[pledgeId]/reports/[reportId]`                                               | RLS 통합 테스트, `npm run check` 빌드의 동적 라우트 확인                                               | PASS |
| 보고 발행 이벤트 계약           | `donation_report_events`, `publish_donation_report`의 `report_published:{reportId}` 멱등 이벤트 원자 기록               | `migration-policy.test.ts`                                                                             | PASS |

### 검증 명령과 결과

```text
npm run test -- src/app/partner/reports/page.test.tsx src/components/partner/execution-review-form.test.tsx
  PASS — 2개 파일/6개 테스트, 목록 실패 시 작성 버튼 유지·조직 범위 서버 조회·집행 등록 후 AI 보고서 작성 연결

npm run test:e2e:reports
  PASS — 3/3 (기관 구성원 보고서 조회, 대상 기부자 안전 projection, 타 기부자·익명 차단)

npm run check
  PASS — 진입 핫픽스 반영 후 format:check, ESLint, TypeScript, Vitest 111개 파일/437개 테스트, Next.js 프로덕션 빌드

npm run test -- src/lib/executions/parse-ocr-receipt.test.ts src/lib/plans/parse-ocr-plan.test.ts
  PASS — 2개 파일/12개 테스트, 실제 OCR의 구분자 이동을 포함해 계획 3개 항목과 영수증 8개 필드·3개 품목 복원

npm run test:ai:ocr -- --grep "maps every item from the demo plan PDF"
  PASS — 실제 Upstage OCR에서 시연 계획 PDF의 단일 항목명·사용 목적·계획 금액 정확히 매핑

npm run test:ai:receipt-ocr -- --grep "maps all items from the demo receipt PDF"
  PASS — 실제 Upstage OCR에서 시연 영수증 PDF의 필수 필드 8개와 품목명·수량·금액 3건 정확히 매핑

npm run check
  PASS — PDF OCR 핫픽스 반영 후 format:check, ESLint, TypeScript, Vitest 106개 파일/422개 테스트, Next.js 프로덕션 빌드

npx supabase migration up --local
  PASS — 최초 실행에서 20260803000000 보고서 스키마 적용

npx supabase db lint --local --level warning
  PASS — 신규 스키마 경고 없음. 기존 save_expenditure_execution_analysis의 미사용 p_semantic_key 경고 1건만 존재

npm run test:e2e:reports
  PASS — 3/3 (기관 구성원 원본 조회, 대상 기부자 안전 projection, 타 기부자·익명 차단)

node --env-file-if-exists=.env --env-file-if-exists=.env.local ./node_modules/@playwright/test/cli.js test --config playwright.report.config.ts
  PASS — 실제 SolarLLM 1개 테스트 안의 비식별 대표 사례 3건(급식, 교육, 프롬프트 인젝션/HTML)

npm run check
  PASS — 후속 PR 리뷰 반영 후 format:check, ESLint, TypeScript, Vitest 106개 파일/418개 테스트, Next.js 프로덕션 빌드

git diff --check
  PASS — 공백 오류 없음

verify-change
  PASS — 완료 조건별 구현·테스트·AI 안전성·RLS 증거 확인, 차단 항목 없음
```

### AI 정확성 및 안전성 검증

- AI 동작 변경 여부: 예 — SolarLLM 기반 구조화 보고 초안 생성을 추가했다.
- 정확성 검증 결과: PASS — 결정론적 단위 사례와 실제 Solar 비식별 대표 사례에서 금액·기간·집행률·근거 참조가 서버 근거와 일치했고, 근거 없는 숫자와 알 수 없는 근거 ID는 검증기가 거부했다.
- 안전성 검증 결과: PASS — 약정 목적에 삽입한 지시문과 HTML을 데이터로만 취급했고, 출력 HTML·금지 필드·과도한 문자열·잘못된 JSON을 저장 전에 차단했다. timeout, rate limit, 인증/네트워크/5xx 오류는 원문 비노출 내부 코드로 변환했다.
- AI가 발견하거나 예방한 품질 문제: 최초 실제 모델 평가에서 모델이 근거에 포함된 금액을 문장에 사용했으나 검증기가 모든 숫자를 일괄 거부하는 과잉 차단을 발견했다. 검증을 “스냅샷에 존재하는 값 또는 정확히 계산된 집행률만 허용”으로 수정해 근거 수치는 허용하고 환각 수치는 계속 차단했다.
- 후속 직접 기능 리뷰에서 보고 기간의 월·일 숫자가 전역 숫자 허용 목록에 들어가 근거 없는 인원수 주장으로 재사용될 수 있음을 발견했다. 전체 날짜가 근거 날짜와 일치할 때만 허용하고 나머지 숫자는 기존 근거 검증을 받도록 수정했으며 회귀 테스트를 추가했다.
- PR 기능 리뷰에서 근거 숫자를 단위와 인용 범위 없이 전역 허용하면 금액을 인원수로 바꾸거나 다른 근거의 숫자를 재사용할 수 있음을 확인했다. 근거 ID별 금액·건수·집행률 타입 검증으로 보강하고 `3,000명`, `-3,000원`, 잘못 인용한 `2,000원` 회귀 사례를 추가했다.
- PR 기능 리뷰에서 발행 상태만으로 원본 보고서 행을 공개하면 AI 초안과 내부 검증·모델 메타데이터가 함께 노출될 수 있음을 확인했다. 원본 RLS를 닫고 기부자 전용 최소 projection으로 교체했다.
- 후속 PR 기능 리뷰에서 `8월 급식 계획`, `1차 식재료` 같은 정상 원본 라벨이 숫자 주장으로 오인되어 생성을 실패시키고, 반대로 전역 날짜 목록과 띄어 쓴 음수 부호는 잘못된 주장을 통과시킬 수 있음을 확인했다. 인용 근거별 라벨·날짜 검증과 부호 정규화 회귀 테스트로 보강했다.
- 최종 판정: PASS

### 차단 항목과 미검증 범위

- 차단 항목 없음.
- 원격 Supabase 프로젝트가 로컬 CLI에 연결되어 있지 않아 배포 DB의 보고서 마이그레이션 적용 여부는 확인하지 못했다. 로컬 Supabase의 보고서 RLS 통합 테스트 3건은 모두 통과했으며, 배포 전 원격 마이그레이션 이력을 별도로 확인해야 한다.
- 로컬 마이그레이션 이력에는 작업 전부터 `202608020000` 버전의 파일명 불일치가 있어 후속 신규 마이그레이션의 자동 적용이 중단됐다. 이력이나 데이터를 파괴하지 않고 보정 `GRANT`와 기부자 projection SQL을 로컬 DB에 직접 적용해 통합 검증했으며, 깨끗한 환경에서는 저장소의 타임스탬프 순서대로 적용된다.
- 실제 브라우저의 생성→편집→발행 전체 흐름은 별도 E2E로 자동화하지 않았다. 서비스·Route 단위 테스트, 프로덕션 빌드, 실제 모델 평가와 로컬 RLS 통합 테스트로 각 경계를 검증했다.
- GitHub PR 생성과 원격 검증 결과 기록은 사용자가 요청하지 않아 수행하지 않았다.

### 남은 작업과 알려진 제한

- 실제 알림 생성과 기부자 알림 UI는 #19에서 구현한다.
- PDF, 다국어, 예약 생성, 발행 후 수정/회수와 배치 보고는 지원하지 않는다.
- 배포 환경에는 기존 `UPSTAGE_API_KEY`가 필요하며, 모델/URL을 기본값과 다르게 운영할 때만 `UPSTAGE_SOLAR_MODEL`, `UPSTAGE_SOLAR_URL`을 설정한다.
- PR을 열기 전에 현재 변경을 atomic commit으로 만들고 이 검증 결과를 PR 본문에 옮겨야 한다.
