# Supabase RLS 검증

`npm run verify:rls`는 실제 Supabase Auth 계정으로 다음 정책을 읽기 전용에 가깝게 점검한다.

- 기부자: 본인 약정만 조회
- 기부처 signer: 소속 기부처 membership과 약정 조회
- 익명 사용자: 약정 조회 차단
- 기부자: 본인 약정 외 데이터 접근 차단

검증 전 `.env.local`에 데모 계정과 Supabase 공개 키를 설정하고, `npm run demo:accounts`로 계정을 연결한다. 특정 약정을 확인하려면 `RLS_PLEDGE_ID`를 추가한다.

```bash
RLS_PLEDGE_ID=약정_UUID npm run verify:rls
```

스크립트는 비밀번호·토큰을 출력하지 않으며 기본 실행에서 데이터를 변경하지 않는다. 데모 기부자 약정이 없으면 `RLS_PLEDGE_ID`를 설정해야 한다. 상태 직접 변경 차단은 서버 Route 테스트와 별도 폐기용 fixture에서 검증한다.

## 추가 수동 매트릭스

스크립트 실행 후 Supabase SQL Editor에서 다음을 확인한다.

| 역할         | `pledges` 조회 | `signature_documents` 조회 | `demo_payments` 조회 | 상태 변경           |
| ------------ | -------------- | -------------------------- | -------------------- | ------------------- |
| 기부자       | 본인만         | 본인 약정만                | 본인 결제만          | 직접 변경 불가      |
| owner/signer | 소속 조직      | 소속 조직                  | 소속 조직            | 직접 변경 불가      |
| viewer       | 소속 조직 조회 | 소속 조직 조회             | 소속 조직 조회       | 서명·상태 변경 불가 |
| 다른 조직    | 차단           | 차단                       | 차단                 | 차단                |
| 익명         | 차단           | 차단                       | 차단                 | 차단                |

viewer와 다른 조직 사용자는 `RLS_VIEWER_EMAIL`, `RLS_VIEWER_PASSWORD`, `RLS_OTHER_ORGANIZATION_EMAIL`, `RLS_OTHER_ORGANIZATION_PASSWORD`를 설정하면 같은 명령에서 확인한다. 운영 계정이나 실제 개인정보는 사용하지 않는다.
