export type SensitiveInputKind =
  'identity_number' | 'card_number' | 'bank_account' | 'secret';

export type SensitiveInputMatch = {
  kind: SensitiveInputKind;
  start: number;
  end: number;
};

const PATTERNS: Array<[SensitiveInputKind, RegExp]> = [
  ['identity_number', /\b\d{6}[- ]?\d{7}\b/g],
  ['card_number', /\b(?:\d[ -]?){13,19}\b/g],
  ['bank_account', /\b(?!01[016789])\d{2,4}[- ]\d{2,4}[- ]\d{4,6}\b/g],
  ['secret', /\b(?:sk|pk|api[_ -]?key|token|password)\s*[:=]\s*\S+/gi],
];

const PRIORITY: Record<SensitiveInputKind, number> = {
  identity_number: 3,
  card_number: 2,
  bank_account: 3,
  secret: 1,
};

export function findSensitiveInput(value: string): SensitiveInputMatch[] {
  const candidates: SensitiveInputMatch[] = [];
  for (const [kind, pattern] of PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of value.matchAll(pattern)) {
      const start = match.index ?? 0;
      candidates.push({ kind, start, end: start + match[0].length });
    }
  }
  candidates.sort(
    (a, b) => a.start - b.start || PRIORITY[b.kind] - PRIORITY[a.kind],
  );
  const selected: SensitiveInputMatch[] = [];
  for (const candidate of candidates) {
    const overlap = selected.find(
      (item) => candidate.start < item.end && item.start < candidate.end,
    );
    if (!overlap) selected.push(candidate);
    else if (PRIORITY[candidate.kind] > PRIORITY[overlap.kind]) {
      selected[selected.indexOf(overlap)] = candidate;
    }
  }
  return selected.sort((a, b) => a.start - b.start);
}

export function containsSensitiveInput(value: string): boolean {
  return findSensitiveInput(value).length > 0;
}

export function maskSensitiveInput(value: string): string {
  let result = value;
  for (const match of [...findSensitiveInput(value)].sort(
    (a, b) => b.start - a.start,
  )) {
    result = `${result.slice(0, match.start)}[민감정보 마스킹]${result.slice(match.end)}`;
  }
  return result;
}
