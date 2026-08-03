import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import {
  parseImpactSummaryJson,
  type ImpactSummaryResponse,
} from '@/lib/organizations/impact-summary';

type RouteContext = { params: Promise<{ organizationId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ code: 'unauthorized' }, { status: 401 });
  const { organizationId } = await context.params;
  const supabase = await createClient();
  const { data: organization, error: organizationError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('slug', organizationId)
    .eq('is_public', true)
    .maybeSingle();
  if (organizationError)
    return NextResponse.json(
      { code: 'organization_lookup_failed' },
      { status: 503 },
    );
  if (!organization)
    return NextResponse.json(
      { code: 'organization_not_found' },
      { status: 404 },
    );

  const { data: summary, error: summaryError } = await supabase
    .from('organization_ai_summaries')
    .select('id, document_id, source_revision, summary_json, created_at')
    .eq('organization_id', organization.id)
    .eq('summary_type', 'impact')
    .eq('processing_status', 'ready')
    .eq('review_status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (summaryError)
    return NextResponse.json(
      { code: 'impact_summary_lookup_failed' },
      { status: 503 },
    );
  if (!summary)
    return NextResponse.json({ organization, summary: null, programs: [] });

  const summaryJson = parseImpactSummaryJson(summary.summary_json, null);
  if (!summaryJson)
    return NextResponse.json({ organization, summary: null, programs: [] });

  const { data: programs, error: programsError } = await supabase
    .from('organization_programs')
    .select(
      'id, program_key, name, description, accepting_designated_donations',
    )
    .eq('organization_id', organization.id)
    .eq('review_status', 'approved')
    .eq('accepting_designated_donations', true);
  if (programsError)
    return NextResponse.json(
      { code: 'impact_program_lookup_failed' },
      { status: 503 },
    );

  const programIdsForConditions = (programs ?? []).map((program) => program.id);
  const { data: conditions, error: conditionsError } =
    programIdsForConditions.length
      ? await supabase
          .from('organization_program_conditions')
          .select('program_id, condition_text')
          .in('program_id', programIdsForConditions)
          .eq('condition_type', 'allowed')
          .eq('review_status', 'approved')
      : { data: [], error: null };
  if (conditionsError)
    return NextResponse.json(
      { code: 'impact_condition_lookup_failed' },
      { status: 503 },
    );

  const { data: facts, error: factsError } = await supabase
    .from('organization_impact_facts')
    .select(
      'id, program_id, program_key, program_name, metric_type, metric_label, numeric_value, text_value, unit, reporting_period, evidence_text',
    )
    .eq('organization_id', organization.id)
    .eq('document_id', summary.document_id)
    .eq('review_status', 'approved');
  if (factsError)
    return NextResponse.json(
      { code: 'impact_fact_lookup_failed' },
      { status: 503 },
    );
  const conditionsByProgram = new Map<string, string[]>();
  for (const condition of conditions ?? []) {
    const values = conditionsByProgram.get(condition.program_id) ?? [];
    values.push(condition.condition_text);
    conditionsByProgram.set(condition.program_id, values);
  }
  const programsWithFacts = (programs ?? []).map((program) => ({
    id: program.id,
    programKey: program.program_key,
    name: program.name,
    description: program.description,
    suggestedConditions: conditionsByProgram.get(program.id) ?? [],
    facts: (facts ?? [])
      .filter((fact) => fact.program_id === program.id)
      .map((fact) => ({
        id: fact.id,
        metricType: fact.metric_type,
        label: fact.metric_label,
        value: fact.numeric_value ?? fact.text_value ?? '',
        unit: fact.unit,
        reportingPeriod: fact.reporting_period,
      })),
  }));
  const response: ImpactSummaryResponse = {
    organization,
    summary: summaryJson,
    programs: programsWithFacts,
  };
  return NextResponse.json(response);
}
