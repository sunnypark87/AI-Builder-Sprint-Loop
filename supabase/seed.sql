insert into public.organizations (id, slug, name, description)
values
  ('00000000-0000-4000-8000-000000000001', 'haebom', '해봄재단', '돌봄 공백 아동의 방과 후 배움과 식사를 지원합니다.'),
  ('00000000-0000-4000-8000-000000000002', 'green-tomorrow', '푸른내일', '지역 주민과 함께 하천 생태계를 회복하고 기록합니다.'),
  ('00000000-0000-4000-8000-000000000003', 'warm-table', '따뜻한식탁', '취약계층 어르신에게 지역 식재료로 만든 식사를 전합니다.')
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    updated_at = now();
