export type ImpactSummaryResponse = {
  organization: { id: string; name: string };
  summary: {
    overview: string;
    reportingPeriod: string | null;
    limitations: string[];
  } | null;
  programs: ImpactSummaryProgram[];
};

export type ImpactSummaryProgram = {
  id: string;
  programKey: string;
  name: string;
  description: string;
  suggestedConditions: string[];
  facts: Array<{
    id: string;
    metricType: string;
    label: string;
    value: number | string;
    unit: string | null;
    reportingPeriod: string | null;
  }>;
};

export function parseImpactSummaryJson(
  value: unknown,
  fallbackPeriod: string | null,
) {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return null;
  const record = value as Record<string, unknown>;
  const overview = typeof record.overview === 'string' ? record.overview : null;
  const reportingPeriod =
    typeof record.reportingPeriod === 'string'
      ? record.reportingPeriod
      : fallbackPeriod;
  const limitations = Array.isArray(record.limitations)
    ? record.limitations.filter(
        (item): item is string => typeof item === 'string',
      )
    : [];
  if (!overview) return null;
  return { overview, reportingPeriod, limitations };
}
