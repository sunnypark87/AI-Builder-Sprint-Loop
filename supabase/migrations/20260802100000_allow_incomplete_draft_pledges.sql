-- 상담 단계에서는 필수 약정값이 아직 없으므로 draft 행만 불완전한 값을 허용한다.
-- 검토·서명 경로의 기존 서버 검증은 draft가 아닌 상태로 전환되기 전에 계속 적용된다.
alter table public.pledges
  alter column amount drop not null,
  alter column donation_type drop not null,
  alter column purpose drop not null,
  alter column pledge_date drop not null,
  alter column donor_name drop not null,
  alter column donor_address drop not null,
  alter column donor_contact drop not null;
