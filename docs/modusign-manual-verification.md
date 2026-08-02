# 모두싸인 양측 서명 수동 검증

실제 모두싸인 계정과 개인정보가 없는 데모 약정으로 진행한다. 기부자와 기부처는 서로 다른 Supabase 데모 계정으로 로그인해야 하며, 모두싸인 개인 인증 이메일은 화면에 입력하거나 공유하지 않는다.

## 사전 조건

1. Supabase 마이그레이션을 적용한다.
2. `.env.local`에 `DEMO_DONOR_*`, `DEMO_ORGANIZATION_*`, `MODUSIGN_*`, `NEXT_PUBLIC_SITE_URL`을 설정한다.
3. `npm run demo:accounts`를 실행한다.
4. 앱을 실행하고 기부자 계정으로 로그인한다.

## 검증 순서

1. 기부처 상세 화면에서 약정 상담을 시작한다.
2. 주민등록번호·휴대폰·이메일을 테스트 값으로 입력하고 약정을 저장한다.
3. `/pledges/{pledgeId}/review`에서 약정 내용을 확인한 뒤 서명 화면으로 이동한다.
4. `/pledges/{pledgeId}/sign`에서 iframe이 표시되는지 확인한다.
5. 기부자 서명을 완료한다.
6. 기부자 화면이 `/pledges/{pledgeId}/waiting`으로 이동하거나, 상태 확인 후 `awaiting_organization_signature`로 바뀌는지 확인한다.
7. 기부처 계정으로 로그인해 `/partner/pledges/{pledgeId}`를 연다.
8. `모두싸인에서 재단 서명하기` 버튼이 활성화된 것을 확인한다.
9. 기부처 iframe에서 서명을 완료한다.
10. 잠시 후 상태를 새로고침하거나 `동기화`를 실행해 `signed`가 되는지 확인한다.
11. `/donations/{pledgeId}/payment`에서 데모 결제를 저장한다.

## 확인할 데이터

| 단계             | 기대 상태                                   |
| ---------------- | ------------------------------------------- |
| 약정 저장        | `draft`                                     |
| 기부자 서명 요청 | `awaiting_donor_signature`                  |
| 기부자 서명 완료 | `awaiting_organization_signature`           |
| 기부처 서명 완료 | `signed`                                    |
| 데모 결제 저장   | `demo_payments.status`가 선택한 결과와 일치 |

Supabase에서 `signature_documents.provider_document_id`, 두 `signature_participants`의 `signing_order`와 `status`, `pledges.status`, `demo_payments` 행을 확인한다. 처리 지연 중에는 `awaiting_donor_signature`가 잠시 유지될 수 있으므로 즉시 실패로 판단하지 않는다.

## 실패 시 기록할 정보

- 약정 UUID
- 실패한 화면 경로와 단계
- 화면에 표시된 오류 코드 또는 문구
- Supabase의 약정·서명 문서·참여자 상태
- 모두싸인 문서 상태와 이벤트 유형

이메일, 주민등록번호, 모두싸인 인증키와 원문 Webhook payload는 캡처하거나 공유하지 않는다.
