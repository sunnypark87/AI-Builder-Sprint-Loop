# Issue 구현 계획

## 1. 이슈 개요

- 대상 이슈: [#6 Vercel-Supabase 연동 및 Auth 환경 구성](https://github.com/sunnypark87/AI-Builder-Sprint-Loop/issues/6)
- 우선순위: P0
- 상태: Open
- 담당자: sunnypark87
- 작성일: 2026-07-31

Vercel 프로젝트와 Supabase 프로젝트를 연결하고, Next.js App Router에서 브라우저·서버용 Supabase 클라이언트와 쿠키 기반 인증 세션 갱신 기반을 구성한다. 실제 로그인·회원가입 UI 대신 로컬·Preview·Production에서 DB 연결, 사용자 조회, 로그인·로그아웃, 세션 유지 및 비밀정보 비노출을 검증할 수 있는 최소 인증 인프라와 문서를 마련한다.

## 2. 현재 저장소 상태

관련 코드, 문서, 설정, 테스트의 현재 상태를 조사해 기록한다.

| 요구사항                 | 현재 상태                                                                               | 필요한 작업                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Supabase/Vercel 연결     | Supabase 프로젝트 및 Vercel Integration 설정을 확인할 코드·문서가 없음                  | 외부 프로젝트 연결, 환경별 변수 동기화, Redirect URL과 Auth 설정 절차를 수행하고 증거 기록         |
| SDK 의존성               | `@supabase/supabase-js`, `@supabase/ssr` 미설치                                         | 두 패키지를 최소 의존성으로 추가하고 lockfile 갱신                                                 |
| 환경 변수 계약           | README에는 `.env.example` 복사 안내가 있으나 `.env.example`과 Supabase 변수 설명이 없음 | 공개 URL·publishable key와 서버 전용 secret key의 용도를 문서화하고 실제 값은 커밋하지 않도록 구성 |
| 브라우저/서버 클라이언트 | `src/lib`에 Supabase 모듈이 없음                                                        | 브라우저용 singleton/client factory와 서버용 cookie-aware client factory 작성                      |
| 세션 갱신                | `middleware.ts` 또는 `proxy.ts`가 없음                                                  | Next.js 16 규칙에 맞는 `proxy.ts`와 matcher를 구성하고 요청·응답 쿠키를 동기화                     |
| 현재 사용자·세션 조회    | 서버·클라이언트 인증 상태 조회 기능이 없음                                              | 서버에서 검증된 사용자 조회 helper와 클라이언트 인증 상태 구독/조회 기반 추가                      |
| DB 연결 확인             | `/api/health`는 애플리케이션 자체 상태만 반환                                           | 비밀을 노출하지 않는 Supabase 연결 확인 경로 또는 검증용 query 추가                                |
| 테스트                   | Supabase mock, 환경 변수 검증, 세션 쿠키 테스트가 없음                                  | 네트워크와 실제 키 없이 client/proxy/query 정상·오류·비로그인 케이스를 검증하는 테스트 추가        |
| 배포 검증                | Preview·Production 검증 절차와 결과가 없음                                              | 로컬, Preview, Production별 수동 검증 체크리스트와 실제 결과 기록                                  |

## 3. 선행 결정

- 외부 설정 변경 전 대상 Vercel 프로젝트와 Supabase 조직·프로젝트, Preview/Production 도메인을 확정한다.
- Vercel Supabase Integration이 제공하는 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 애플리케이션의 공개 변수 계약으로 사용하고, `SUPABASE_SECRET_KEY` 및 DB 접속 비밀은 서버 전용으로 유지한다.
- 현재 Next.js 버전이 16.2.12이므로 deprecated된 `middleware.ts` 대신 동일 역할의 `proxy.ts`를 사용한다.
- Proxy는 토큰 갱신과 쿠키 전달만 담당하고, 접근 권한 판단은 서버에서 검증한 claims 또는 최신 사용자가 필요한 경우 `getUser()` 결과를 기준으로 한다. 쿠키에서 읽은 `getSession()`의 user 객체만으로 권한을 판단하지 않는다.
- 이 이슈에는 인증 UI가 없으므로 테스트 계정의 로그인·로그아웃은 임시 검증 스크립트, Supabase 대시보드 또는 최소 Route Handler/Server Action 중 제품 범위를 가장 적게 늘리는 방법을 구현 전에 선택한다.
- 기본 DB query 대상은 별도 도메인 스키마를 만들지 않고도 검증 가능한 대상으로 제한한다. 공개 클라이언트의 임의 DB 접근을 허용하기 위한 느슨한 RLS 정책은 추가하지 않는다.
- 실제 Supabase/Vercel 생성·연결과 배포 검증에는 서비스 계정 권한 및 네트워크가 필요하므로 담당자가 접근 권한과 비용·리전을 확인한다.

## 4. 구현 단계

### 단계 1. 외부 프로젝트와 환경 변수 계약 확정

#### 작업 내용

- Supabase 프로젝트를 생성 또는 선택하고 Auth 기본 설정과 허용 Redirect URL을 구성한다.
- Vercel 프로젝트에 Supabase Integration을 연결하고 Development, Preview, Production 변수 적용 범위를 확인한다.
- Vercel이 주입한 변수명과 코드에서 사용할 변수명을 대조하고 `.env.example`과 README에 이름, 공개 여부, 필수 여부, 로컬 설정 절차를 기록한다.
- 실제 키, 테스트 계정 비밀번호, DB 비밀번호가 Git 기록·로그·스크린샷에 포함되지 않았는지 확인한다.

#### 완료 조건

- [ ] Supabase와 Vercel 대상 프로젝트 및 연결 상태가 확인됨
- [ ] 로컬·Preview·Production의 필수 환경 변수 등록 상태가 확인됨
- [ ] 공개 키와 서버 전용 키의 사용 경계가 문서화됨
- [ ] 실제 비밀값 없이 로컬 환경 설정을 재현할 수 있음

### 단계 2. Supabase 클라이언트와 환경 검증 구성

#### 작업 내용

- `@supabase/supabase-js`, `@supabase/ssr`를 설치한다.
- 환경 변수 누락 시 비밀값을 포함하지 않는 명확한 오류를 반환하는 설정 helper를 구성한다.
- Client Component용 브라우저 클라이언트와 Server Component·Server Action·Route Handler용 서버 클라이언트를 분리한다.
- 서버 클라이언트가 Next.js `cookies()`와 `@supabase/ssr`의 cookie adapter를 올바르게 연결하도록 구현한다.

#### 완료 조건

- [ ] 브라우저와 서버 환경에서 적합한 Supabase 클라이언트를 생성할 수 있음
- [ ] 서버 전용 키가 클라이언트 번들 또는 `NEXT_PUBLIC_*` 변수에 포함되지 않음
- [ ] 필수 환경 변수 누락 오류가 안전하고 테스트 가능함

### 단계 3. 쿠키 기반 세션 갱신과 사용자 조회 기반 구현

#### 작업 내용

- Next.js 16의 `proxy.ts`에서 Supabase 인증 토큰을 갱신하고 request/response cookie를 함께 갱신한다.
- 정적 자산, 이미지 최적화 경로, favicon 등 불필요한 요청을 matcher에서 제외한다.
- 서버에서 검증된 현재 사용자 또는 claims를 조회하는 helper와 클라이언트에서 초기 세션 및 인증 상태 변화를 조회하는 기반을 작성한다.
- 비로그인, 만료·무효 세션, 외부 Auth 오류를 정상적인 비로그인 또는 안전한 오류 상태로 처리하고 민감한 토큰을 로깅하지 않는다.

#### 완료 조건

- [ ] 로그인 세션이 새로고침과 라우트 이동 후에도 유지됨
- [ ] 토큰 갱신 결과가 서버 요청과 브라우저 응답 쿠키에 일관되게 반영됨
- [ ] 로그아웃 후 서버·클라이언트 사용자 및 세션 정보가 제거됨
- [ ] 비로그인·무효 세션이 권한 있는 사용자로 오인되지 않음

### 단계 4. DB 연결 및 인증 상태 검증 경로 구성

#### 작업 내용

- 별도 서비스 도메인 스키마나 느슨한 RLS 정책 없이 수행 가능한 최소 DB query 또는 health check를 정한다.
- 응답에는 연결 성공 여부와 안전한 오류 코드만 포함하고 URL, key, token, DB 접속 문자열은 포함하지 않는다.
- 비로그인과 로그인 상태에서 기대하는 query 범위를 구분하고 테스트 계정으로 현재 사용자 조회를 검증한다.

#### 완료 조건

- [ ] 로컬에서 Supabase 기본 query 성공과 외부 API 실패를 구분할 수 있음
- [ ] 비로그인·로그인 상태별 기대한 DB 접근 결과가 확인됨
- [ ] health/query 응답과 로그에서 민감정보가 노출되지 않음

### 단계 5. 자동 테스트, 배포 검증 및 문서화

#### 작업 내용

- 실제 Supabase 네트워크를 호출하지 않도록 SDK, cookie store, Auth 및 query 응답을 mock하여 단위·통합 테스트를 추가한다.
- 환경 변수 정상·누락, 쿠키 갱신, 비로그인, 로그인, 무효 세션, logout, DB 성공·실패 및 민감정보 비노출을 검증한다.
- `npm run check`와 `verify-change`를 실행한다.
- Vercel Preview와 Production에서 환경 변수, Redirect URL, DB query, 로그인·로그아웃, 세션 유지 절차를 실행하고 URL과 실제 결과를 실행 결과 절에 기록한다.

#### 완료 조건

- [ ] 자동 테스트와 `npm run check`가 통과함
- [ ] 로컬·Preview·Production 수동 검증 결과가 기록됨
- [ ] `verify-change`가 차단 항목 없이 PASS임
- [ ] 환경 변수·마이그레이션·배포 영향과 알려진 제한이 문서화됨

## 5. 테스트 및 검증 계획

| 완료 조건                  | 구현 대상                         | 테스트 유형        | 예상 테스트 파일 또는 검증 방법                                                                  |
| -------------------------- | --------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------ |
| 환경 변수 계약과 비밀 경계 | 환경 설정 helper, `.env.example`  | 단위·정적 검토     | `src/lib/supabase/config.test.ts`, 클라이언트 번들/로그에 secret 이름·값이 포함되지 않는지 확인  |
| 브라우저/서버 client 생성  | Supabase client factory           | 단위               | `src/lib/supabase/client.test.ts`, `src/lib/supabase/server.test.ts`에서 SDK와 cookie store mock |
| 쿠키 기반 세션 갱신        | `proxy.ts`, session update helper | 단위·통합          | `src/lib/supabase/proxy.test.ts`에서 request/response cookie, 만료·무효 세션, matcher 검증       |
| 서버 사용자 검증           | current-user helper               | 단위               | 비로그인, 로그인, Auth 오류 및 검증되지 않은 session user 비신뢰 테스트                          |
| 클라이언트 인증 상태       | auth 상태 helper/hook             | 컴포넌트·단위      | 초기 상태, SIGNED_IN, SIGNED_OUT, 구독 해제 검증                                                 |
| DB 연결 확인               | health/query 경로                 | Route Handler 통합 | 성공, 비로그인, 로그인, SDK 오류, 민감정보 비노출 응답 검증                                      |
| 로그인·로그아웃·세션 유지  | Supabase Auth + Proxy             | 수동 통합/E2E      | 테스트 계정으로 로그인 → 새로고침 → 라우트 이동 → 로그아웃 절차와 실제 결과 기록                 |
| 환경별 동작                | Vercel/Supabase 설정              | 배포 수동 검증     | Preview와 Production URL에서 환경 변수, Redirect URL, DB/Auth 흐름 확인                          |
| 전체 회귀 방지             | 전체 저장소                       | 정적·단위·빌드     | `npm run check`, `verify-change`                                                                 |

AI 모델 호출, 프롬프트, 검색·추출 또는 모델 출력 처리를 변경하지 않으므로 AI 정확성·프롬프트 인젝션 검증은 해당 없음이다. 다만 인증 토큰, Supabase secret, DB 접속 문자열 및 사용자 정보의 노출 방지는 보안 테스트와 수동 검토의 필수 차단 기준으로 적용한다.

## 6. 예상 산출물

```text
.env.example
README.md
AGENTS.md                                      # 주요 디렉터리/실행 책임이 바뀌는 경우
package.json
package-lock.json
proxy.ts
src/
├── app/api/...                               # 최소 DB/Auth health 검증 경로(구현 결정에 따라 경로 확정)
└── lib/supabase/
    ├── config.ts
    ├── client.ts
    ├── server.ts
    ├── proxy.ts
    ├── auth.ts
    └── *.test.ts
docs/issue_plan/ISSUE-6-SUPABASE-AUTH-SETUP.md
```

## 7. 권장 작업 순서와 의존성

| 순서 | 작업                               | 선행 조건                        | 결과                                  |
| ---- | ---------------------------------- | -------------------------------- | ------------------------------------- |
| 1    | Supabase/Vercel 대상과 변수명 확정 | 서비스 접근 권한, 리전·비용 결정 | 환경별 연결 및 변수 계약              |
| 2    | SDK와 환경 설정 helper 추가        | 변수 계약                        | 안전한 공통 설정 로딩                 |
| 3    | 브라우저·서버 client 구현          | SDK, 환경 설정                   | 실행 환경별 DB/Auth 접근 기반         |
| 4    | Proxy와 Auth 조회 helper 구현      | 서버 client, cookie 계약         | 세션 갱신 및 검증된 사용자 조회       |
| 5    | 최소 DB/Auth 검증 경로 구현        | client와 Auth helper             | 연결·인증 상태 관찰 가능성            |
| 6    | mock 기반 자동 테스트 실행         | 구현 경로 확정                   | 네트워크·실제 키 없는 회귀 검증       |
| 7    | Preview·Production 검증            | Vercel 배포와 Redirect URL       | 환경별 수동 검증 증거                 |
| 8    | 문서·실행 결과 갱신 및 최종 검증   | 모든 검증 결과                   | `npm run check`, `verify-change` 판정 |

## 8. 전체 완료 기준

- [ ] 요구사항 구현
- [ ] 테스트 및 검증 통과
- [ ] 문서 갱신
- [ ] PR에 검증 결과 기록
- [ ] `verify-change` PASS 및 차단 항목 없음
- [ ] 로컬·Preview·Production에서 DB 연결과 Auth 세션 흐름 검증
- [ ] 공개 키와 서버 전용 비밀의 경계 및 민감정보 비노출 검증

## 9. 범위에서 제외할 작업

- 로그인·회원가입·비밀번호 재설정·이메일 인증 화면 디자인 및 UI 구현
- Google, Kakao 등 외부 OAuth Provider 연동
- 사용자 프로필, 역할 및 권한 체계 구현
- 서비스 도메인 테이블과 전체 DB 스키마 및 세부 RLS 정책 설계
- Supabase Storage, Realtime 및 Edge Functions 연동
- 인증과 무관한 기존 공개·기부자·기관 관리 화면 변경

## 10. 주요 위험과 대응

| 위험                                                     | 영향                                      | 대응                                                                                                 |
| -------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Vercel/Supabase 외부 접근 권한 또는 프로젝트 대상 불명확 | 연결·배포 검증 차단, 잘못된 프로젝트 변경 | 구현 전 조직·프로젝트·환경·도메인을 명시하고 담당자 승인 범위에서 설정                               |
| Vercel Integration 변수명과 코드 계약 불일치             | 빌드 또는 런타임 연결 실패                | 실제 주입 변수 목록을 확인하고 config helper, `.env.example`, 환경별 체크리스트를 단일 계약으로 유지 |
| secret/service role/DB 비밀번호의 클라이언트 노출        | 치명적 보안 사고                          | `NEXT_PUBLIC_*`에는 URL과 publishable key만 허용하고 번들·응답·로그·Git diff를 검사                  |
| cookie adapter 또는 Proxy 갱신 누락                      | 새로고침 후 로그아웃, 사용자별 세션 혼선  | request/response cookie 동기화 테스트와 실제 브라우저 세션 유지 검증                                 |
| 캐시된 인증 응답이 사용자 간 공유                        | 다른 사용자 토큰·데이터 노출              | 인증 갱신 응답의 Supabase SSR cache header 전달을 보존하고 동적 인증 경로 캐싱을 검토                |
| `getSession()` user를 권한 근거로 사용                   | 위조·만료 세션을 신뢰                     | `getClaims()` 또는 최신 사용자 필요 시 `getUser()`로 서버 검증하고 테스트로 강제                     |
| RLS 미설계 상태에서 공개 query 허용                      | 데이터 과다 노출                          | 검증 대상을 최소화하고 공개 테이블/완화된 RLS를 만들지 않으며 도메인 RLS는 별도 이슈로 차단          |
| 실제 외부 서비스에 의존하는 자동 테스트                  | CI 비결정성, 키 필요                      | SDK와 네트워크를 mock하고 실제 환경 검증은 별도 수동 증거로 기록                                     |
| 테스트 계정 자격 증명 유출                               | 계정 탈취                                 | 전용 저권한 계정 사용, 자격 증명은 비밀 저장소에만 보관하고 결과 문서에는 값 미기록                  |

## 11. 실행 결과

### 변경 내용

- `@supabase/supabase-js`, `@supabase/ssr` 의존성 추가
- 브라우저·서버 Supabase client와 환경 변수 fallback helper 추가
- Next.js 16 `proxy.ts` 세션 갱신 및 쿠키 동기화 구현
- 서버 검증 사용자 조회와 브라우저 인증 상태 구독 helper 추가
- `/api/health/supabase` Auth 연결 상태 확인 Route Handler 추가
- Supabase 관련 mock 테스트와 `.env.example` 변수 계약 문서화

### 완료 조건 추적표

| 완료 조건                      | 구현 파일                                                     | 테스트 또는 검증 파일                       | 결과                     |
| ------------------------------ | ------------------------------------------------------------- | ------------------------------------------- | ------------------------ |
| 브라우저·서버 client 생성      | `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`    | `src/lib/supabase/config.test.ts`           | 통과                     |
| 세션 갱신 및 쿠키 동기화       | `proxy.ts`, `src/lib/supabase/proxy.ts`                       | `src/lib/supabase/proxy.test.ts`            | 통과                     |
| 서버·브라우저 인증 상태 조회   | `src/lib/supabase/auth.ts`, `src/lib/supabase/auth-client.ts` | `src/lib/supabase/auth*.test.ts`            | 통과                     |
| Auth 연결 health check         | `src/app/api/health/supabase/route.ts`                        | `src/app/api/health/supabase/route.test.ts` | 통과                     |
| 로컬 Supabase 연결             | `.env`, `/api/health/supabase`                                | 로컬 개발 서버 수동 호출                    | 통과(HTTP 200, 비로그인) |
| 테스트 계정 인증 흐름          | `/dev/auth-test`, `proxy.ts`                                  | 로그인·새로고침·로그아웃 수동 확인          | 통과(사용자 확인)        |
| Vercel Preview/Production 검증 | Vercel 환경 설정 및 배포                                      | Preview·Production 수동 확인                | 통과(사용자 확인)        |

### 검증 명령과 결과

```text
명령: `npm run typecheck`, `npm run test -- --run`, `npm run lint`
결과: 모두 통과(테스트 13개 파일, 29개 테스트)

명령: `npm run check`
결과: 통과(format:check, lint, typecheck, test, build 포함)

명령: `curl http://localhost:3010/api/health/supabase`
결과: 통과(`{"status":"ok","authenticated":false}`)

명령: `git diff --check`
결과: 통과
```

### AI 정확성 및 안전성 검증

- AI 동작 변경 여부: 없음
- 정확성 검증 결과: 해당 없음
- 안전성 검증 결과: secret·토큰·사용자 상세정보를 health 응답에 포함하지 않는 자동 테스트 통과
- AI가 발견하거나 예방한 품질 문제: Next.js 16의 `proxy.ts` 규칙과 검증되지 않은 session user 비신뢰 기준을 반영함
- 최종 판정: PASS

### 차단 항목과 미검증 범위

- 테스트 계정 로그인·세션 유지·로그아웃 수동 검증은 통과함
- Vercel Preview 및 Production 환경 변수·Redirect URL 검증은 사용자 확인으로 통과함
- 실제 DB query는 도메인 스키마 확정 후 별도 범위로 결정하며, 현재는 Auth health check로 연결성을 확인함

### 남은 작업과 알려진 제한

- 실제 Supabase/Vercel 외부 설정 변경, 테스트 계정 생성, 커밋, push 및 PR은 수행하지 않음
- 현재 브랜치에는 선택된 변경이 커밋 대상으로 staged 상태임
