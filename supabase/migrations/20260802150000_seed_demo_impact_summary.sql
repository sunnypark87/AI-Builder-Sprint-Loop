create unique index if not exists organization_impact_facts_demo_identity_idx
  on public.organization_impact_facts (organization_id, program_id, metric_key, reporting_period);

do $$
declare
  v_organization_id uuid;
  v_document_id uuid;
begin
  select id into v_organization_id
  from public.organizations
  where slug = 'haebom';

  if v_organization_id is null then
    raise exception 'demo organization haebom is required';
  end if;

  insert into public.organization_source_documents (
    organization_id, title, document_type, reporting_period, storage_path,
    mime_type, content_hash, visibility, processing_status, review_status,
    published_at
  ) values (
    v_organization_id, '2025 해봄재단 활동성과 요약', 'annual_report', '2025',
    'demo/haebom-2025-impact.txt', 'text/plain', 'mvp-haebom-2025-impact',
    'public', 'ready', 'approved', now()
  ) on conflict (organization_id, content_hash)
  do update set visibility = 'public', processing_status = 'ready',
    review_status = 'approved', published_at = coalesce(
      public.organization_source_documents.published_at, now()
    ), updated_at = now()
  returning id into v_document_id;

  insert into public.organization_programs (
    organization_id, program_key, name, description, target_groups,
    activity_categories, accepting_designated_donations, review_status
  ) values
    (v_organization_id, 'education-gap', '교육격차 해소사업',
      '교육취약 아동에게 학습비, 디지털 학습환경과 멘토링을 지원합니다.',
      array['교육취약 아동', '청소년'], array['교육', '진로'], true, 'approved'),
    (v_organization_id, 'child-health', '아동 건강·의료지원사업',
      '경제적 이유로 검사와 치료가 어려운 아동에게 의료비와 심리정서 서비스를 지원합니다.',
      array['의료지원이 필요한 아동'], array['건강', '의료', '심리상담'], true, 'approved'),
    (v_organization_id, 'youth-independence', '보호종료청년 자립지원사업',
      '보호종료청년의 주거, 취업, 금융과 심리적 자립을 지원합니다.',
      array['보호종료청년'], array['주거', '취업', '자립'], true, 'approved')
  on conflict (organization_id, program_key)
  do update set name = excluded.name, description = excluded.description,
    target_groups = excluded.target_groups,
    activity_categories = excluded.activity_categories,
    accepting_designated_donations = true, review_status = 'approved',
    updated_at = now();

  insert into public.organization_program_conditions (program_id, condition_text, condition_type, review_status)
  select id, condition_text, 'allowed', 'approved'
  from public.organization_programs
  cross join (values
    ('education-gap', '교육취약 아동의 학습비 및 디지털 학습환경 지원'),
    ('education-gap', '교육취약 아동의 학습 멘토링과 진로체험 지원'),
    ('child-health', '취약계층 아동의 검사·치료비 지원'),
    ('child-health', '아동·청소년 심리상담 및 재활치료 지원'),
    ('youth-independence', '보호종료청년의 주거 안정과 취업교육 지원'),
    ('youth-independence', '보호종료청년의 금융교육과 심리상담 지원')
  ) as condition(program_key, condition_text)
  where organization_id = v_organization_id
    and organization_programs.program_key = condition.program_key
  on conflict (program_id, condition_text, condition_type)
  do update set review_status = 'approved';

  insert into public.organization_impact_facts (
    organization_id, document_id, program_id, program_key, program_name,
    metric_key, metric_label, metric_type, numeric_value, unit,
    reporting_period, evidence_text, review_status
  )
  select v_organization_id, v_document_id, program.id, values.program_key,
    program.name, values.metric_key, values.metric_label, values.metric_type,
    values.numeric_value, values.unit, '2025', values.evidence_text, 'approved'
  from (values
    ('education-gap', 'beneficiaries', '지원 아동', 'output', 1460::numeric, '명', '2025년 교육취약 아동 1,460명 지원'),
    ('education-gap', 'devices', '디지털 학습기기 지원', 'output', 730::numeric, '대', '2025년 디지털 학습기기 730대 지원'),
    ('education-gap', 'mentoring', '학습 멘토링 운영', 'output', 8420::numeric, '회', '2025년 학습 멘토링 8,420회 운영'),
    ('child-health', 'beneficiaries', '의료비 지원 아동', 'output', 620::numeric, '명', '2025년 의료비 지원 아동 620명'),
    ('child-health', 'treatment-completion', '계획된 치료 완료율', 'outcome', 94.5::numeric, '%', '의료비 지원 아동 중 94.5%가 계획된 치료를 완료'),
    ('youth-independence', 'beneficiaries', '지원 청년', 'output', 310::numeric, '명', '2025년 보호종료청년 310명 지원'),
    ('youth-independence', 'housing', '주거지원 청년', 'output', 184::numeric, '명', '2025년 주거지원 184명')
  ) as values(program_key, metric_key, metric_label, metric_type, numeric_value, unit, evidence_text)
  join public.organization_programs program
    on program.organization_id = v_organization_id
    and program.program_key = values.program_key
  on conflict (organization_id, program_id, metric_key, reporting_period)
  do update set numeric_value = excluded.numeric_value, unit = excluded.unit,
    metric_label = excluded.metric_label, metric_type = excluded.metric_type,
    evidence_text = excluded.evidence_text, review_status = 'approved';

  delete from public.organization_ai_summaries
  where organization_id = v_organization_id and document_id = v_document_id
    and summary_type = 'impact';

  insert into public.organization_ai_summaries (
    organization_id, document_id, summary_type, source_revision,
    schema_version, summary_json, model, prompt_version,
    processing_status, review_status
  )
  select v_organization_id, v_document_id, 'impact', 'mvp-haebom-2025-impact',
    'impact-summary-v1', jsonb_build_object(
      'schemaVersion', 'impact-summary-v1',
      'overview', '해봄재단은 교육취약 아동과 청소년의 교육·건강, 보호종료청년의 자립을 지원합니다.',
      'reportingPeriod', '2025',
      'programs', jsonb_agg(jsonb_build_object(
        'programKey', program.program_key,
        'name', program.name,
        'description', program.description,
        'suggestedConditions', array(
          select condition_text from public.organization_program_conditions condition
          where condition.program_id = program.id and condition.review_status = 'approved'
          order by condition.created_at
        ),
        'evidenceFactIds', array(
          select fact.id from public.organization_impact_facts fact
          where fact.program_id = program.id and fact.document_id = v_document_id
            and fact.review_status = 'approved'
        )
      )),
      'limitations', array['표시된 성과는 2025년 재단 자료 기준이며 향후 사업 결과를 보장하지 않습니다.']
    ),
    'demo-seed', 'impact-summary-v1', 'ready', 'approved'
  from public.organization_programs program
  where program.organization_id = v_organization_id
    and program.review_status = 'approved'
    and program.accepting_designated_donations = true;
end $$;
