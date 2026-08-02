# Vercel Webhook 배포 검증

실제 모두싸인 테스트 문서로 서명 이벤트를 발생시킨 뒤, Vercel Route Handler와 Supabase 상태 반영을 확인한다.

## 배포 전 확인

Vercel의 Preview 또는 Production 환경에 다음 서버 변수를 설정한다.

- `MODUSIGN_AUTH_KEY`
- `MODUSIGN_TEMPLATE_ID`
- `MODUSIGN_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL` 또는 `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` 또는 `SUPABASE_SERVICE_ROLE_KEY`
- `PLEDGE_IDENTITY_NUMBER_ENABLED`
- `PLEDGE_PII_ENCRYPTION_KEY`

공개 브라우저 키는 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 또는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 사용한다. 개인 모두싸인 이메일과 비밀키는 `NEXT_PUBLIC_` 변수로 등록하지 않는다.

## Webhook 등록

모두싸인 Webhook URL을 다음처럼 등록한다.

```text
https://배포도메인/api/modusign/webhook
```

공유 secret은 앱의 `MODUSIGN_WEBHOOK_SECRET`과 동일하게 설정하고, 이벤트에는 문서 상태 변경 및 전체 서명 완료 이벤트를 포함한다.

## 검증 순서

1. Vercel에 배포한다.
2. 배포 URL에서 로그인과 동적 약정 화면이 정상적으로 열리는지 확인한다.
3. 기부자·기부처 양측 서명을 완료한다.
4. 모두싸인이 Webhook을 전송했는지 확인한다.
5. Vercel Function Logs에서 401·500 오류가 없는지 확인한다.
6. Supabase에서 `modusign_webhook_events`에 이벤트가 기록되고 처리 시각이 채워지는지 확인한다.
7. `signature_documents.last_synced_at`과 `pledges.status`가 갱신되는지 확인한다.
8. Webhook 처리가 늦으면 `/api/pledges/{pledgeId}/sync`를 호출해 fallback 동기화를 확인한다.

## 기대 결과

| 확인 항목        | 기대 결과                                          |
| ---------------- | -------------------------------------------------- |
| Webhook 인증     | 잘못된 secret은 `401 webhook_unauthorized`         |
| 정상 Webhook     | `202 accepted`                                     |
| 중복 이벤트      | `200 duplicate`                                    |
| 이벤트 저장      | 동일 `provider_event_id` 중복 행 없음              |
| 전체 서명 이벤트 | 약정 상태 `signed`                                 |
| 동기화 실패      | 내부 상태 `failed`, 민감한 외부 응답은 로그에 없음 |

로그와 캡처에는 이메일, 주민등록번호, 인증키, 임베디드 서명 URL, 원문 Webhook payload를 포함하지 않는다.
