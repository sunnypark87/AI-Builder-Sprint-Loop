# AI Builder Sprint 2026

> 총 168시간, AI와 함께 만드는 도전

## 개발 시작하기

현재 프로젝트는 Next.js App Router와 TypeScript 기반 웹앱으로 구성되어 있습니다.

```bash
npm install
npm run dev
```

개발 서버는 `http://localhost:3000`에서 실행됩니다. 환경변수가 필요한 기능을 개발할 때는 예시 파일을 복사한 뒤 실제 값을 로컬에서만 설정합니다.

```bash
cp .env.example .env.local
```

집행 계획 OCR 등록에는 서버 전용 `UPSTAGE_API_KEY`와 Supabase 프로젝트 설정이 필요합니다. 필요한 변수와 용도는 [`.env.example`](.env.example)에 정리되어 있으며 실제 비밀 값은 저장소에 커밋하지 않습니다.

검증 명령은 `npm run check`로 한 번에 실행할 수 있습니다. 세부 명령은 `AGENTS.md`에 정리되어 있습니다.

집행 계획의 실제 Auth·RLS·Storage·RPC 흐름은 로컬 Supabase를 시작한 뒤 별도 통합 테스트로 확인합니다. 이 명령은 Upstage 호출만 로컬 목으로 대체하며 Supabase 로컬 키를 파일이나 로그에 남기지 않습니다.

```bash
npx supabase start
npx supabase db reset --local
npx supabase test db
npm run test:e2e:plans
npm run test:e2e:executions
```

실제 Upstage 정확도 평가는 비식별 합성 대표 문서에만 사용하며 `.env.local`의 `UPSTAGE_API_KEY`를 현재 프로세스에 설정한 환경에서 `npm run test:ai:ocr`로 실행합니다. 일반 `npm run check`와 E2E는 외부 API를 호출하지 않습니다.

영수증 집행 등록은 등록 완료된 집행 계획의 예산 항목에 영수증 1건을 연결합니다. Upstage OCR 추출 후 합계, 사업자등록번호 형식, 계획 기간, 예산 잔액과 중복 여부를 검사하고 담당자 확인 후 내부 등록합니다. 이 검사는 카드사·국세청 등 발행기관 조회나 법적 진위 보증이 아닙니다. 비식별 합성 영수증 8건의 실제 OCR 평가는 `npm run test:ai:receipt-ocr`로 별도 실행합니다.

## 대회 소개

**AI Builder Sprint 2026**은 부산대학교 **APPTIVE**가 주최하고, **Upstage**, 부산대학교 **Anchor 사업단** 및 부산대학교 **AI융합교육원**이 후원하는 해커톤입니다. 참가자들은 자유로운 기술 스택을 바탕으로 실제로 동작하는 서비스를 직접 코드로 구현합니다.

| 항목      | 내용                                                    |
| --------- | ------------------------------------------------------- |
| 주제      | AI를 통해 인간다움을 더욱 잘 드러낼 수 있는 서비스 개발 |
| 팀 구성   | 2~4인 1팀                                               |
| 개발 방식 | 코드 기반 앱 개발 필수 (노코드/로우코드 단독 사용 불가) |

### 진행 흐름

1. **팀 단위 참가 신청** — 팀원 정보, 프로젝트 아이디어, 활용 예정 AI 기술·API 제출
2. **참가팀 선발** (20~50팀) — 아이디어 참신성·실현 가능성·AI 활용 계획 기반 서류 심사
3. **예선 개발 기간** (7.27 ~ 8.3, 약 1주일) — API 크레딧 발급, 아이디어 구체화 및 개발
4. **결과물 제출 및 1차 심사** — 데모 영상/배포 링크, 코드 저장소, 발표 자료, AI 활용 증빙 제출
5. **본선 발표 및 질의응답** (8.7) — 팀당 7분 발표 + 5분 Q&A, 심사 후 수상팀 확정

### 기술 스택 및 규칙

- 사용 API·모델은 자유이며, **Upstage API**(Solar LLM, Document Parse, Information Extract) 활용 시 심사 가점
- Claude, GPT, Gemini 등 타사 모델 병행 사용 가능 (제약 없음)
- 프레임워크/언어 자유 (Python, JavaScript, React, Flutter 등)
- 결과물은 데모 가능한 동작하는 앱 (웹앱, 모바일앱, CLI 도구 등 형태 무관)
- 코딩 에이전트(Claude Code, Codex 등) 활용 시 `.claude/`, `AGENTS.md` 등 관련 설정·지침 파일을 저장소에 포함해야 심사에 반영됩니다

### 심사 기준

| 기준                  | 배점 |
| --------------------- | ---- |
| 창의성                | 20점 |
| AI 활용도             | 20점 |
| 완성도                | 20점 |
| 실용성                | 20점 |
| 발표력 (본선)         | 20점 |
| Upstage API 활용 가점 | +5점 |
| 지역사회 기여도 가점  | +5점 |

### 시상 내역

- 대상 1팀: 100만원 + 상품
- 최우수상 1팀: 50만원 + 상품
- 우수상 1팀: 상품
- 본선 참가 10팀: Upstage 굿즈 + 참가 인증서

## Git Fork 하는 방법

참가팀은 이 저장소를 팀 대표의 GitHub 계정으로 **Fork**한 뒤, 해당 Fork 저장소에서 프로젝트를 개발하고 최종 결과물을 제출합니다.

### 1. 저장소 Fork하기

1. [AI-Builder-Sprint 저장소](https://github.com/ApptiveDev/AI-Builder-Sprint)에 접속합니다.
2. 우측 상단의 **Fork** 버튼을 클릭합니다.
  <img width="1888" height="1131" alt="스크린샷 2026-07-27 오전 12 31 16" src="https://github.com/user-attachments/assets/2f0f7f80-6c92-4ba5-87c5-89ed6107eeab" />

3. 본인(또는 팀 대표) GitHub 계정으로 저장소가 복사됩니다. (`https://github.com/<내-계정>/AI-Builder-Sprint`)

### 2. Fork한 저장소 로컬로 클론하기

```bash
git clone https://github.com/<내-계정>/AI-Builder-Sprint.git
cd AI-Builder-Sprint
```

### 3. 개발 진행 및 커밋

```bash
git checkout main
git pull origin main
git checkout -b feature/<github-issue-number>-<short-description>
# 코드 작성 및 수정
git push origin feature/<github-issue-number>-<short-description>
```

작업 유형에 따라 `feature/*`, `fix/*`, `refactor/*` 브랜치를 사용합니다. 모든 Pull Request의 base branch는 `main`이며, PR 생성 전 `npm run check`를 통과해야 합니다. 자세한 규칙은 [`docs/git-conventions.md`](docs/git-conventions.md)를 참고하세요.

### 4. 결과물 제출

- **팀별로 Fork한 본인 저장소 URL을 제출 양식에 기재합니다.**
- 제출 마감 전까지 코드, 데모 영상/배포 링크, 발표 자료를 함께 준비해 제출해주세요.
- 코딩 에이전트를 활용한 경우 `.claude/`, `AGENTS.md` 등 설정 파일도 반드시 저장소에 포함해주세요.

## 문의

- 대회 관련 문의: 해커톤 문의 오픈채팅방
- 주최: 부산대학교 APPTIVE, 정보컴퓨터공학부 동아리연합회 / 후원: Upstage, 부산대 Anchor 사업단, 부산대 AI융합교육원
