export function parseImpactSections(value) {
  const sections = [];
  let current = null;
  let activeProgram = null;
  for (const line of value.split(/\r?\n/)) {
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      if (current) sections.push(current);
      if (/^3\.\d+/.test(heading[1])) {
        activeProgram = {
          key: slugify(heading[1]),
          name: heading[1].replace(/^3\.\d+\s+/, '').trim(),
        };
      } else if (/^4\./.test(heading[1])) {
        activeProgram = null;
      }
      current = {
        sectionKey: slugify(heading[1]),
        heading: heading[1],
        content: '',
        programKey: activeProgram?.key ?? null,
        programName: activeProgram?.name ?? null,
      };
    } else if (current) current.content += `${line}\n`;
  }
  if (current) sections.push(current);
  return sections.filter((section) => section.content.trim());
}

export function extractImpactFacts(sections, reportingPeriod) {
  return sections.flatMap((section) => {
    if (!section.programKey || !section.programName) return [];
    const programName = section.programName;
    return section.content.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^\s*[*-]\s*([^:：]+)[:：]\s*(.+)$/);
      if (!match) return [];
      const metricLabel = stripMarkdown(match[1]).trim();
      const evidenceText = line.trim();
      const rawValue = stripMarkdown(match[2]).trim();
      const parsed = parseKoreanMetric(rawValue);
      return [
        {
          programKey: section.programKey,
          programName,
          metricKey: slugify(metricLabel),
          metricLabel,
          numericValue: parsed.numericValue,
          textValue: parsed.textValue,
          unit: parsed.unit,
          reportingPeriod,
          evidenceText,
        },
      ];
    });
  });
}

export function parseKoreanMetric(value) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  const unitMatch = normalized.match(
    /(억|만|명|개소|대|회|%|가구|명)(?:\s*원)?$/,
  );
  const unit = /원$/.test(normalized)
    ? '원'
    : (unitMatch?.[1] ?? (/[억만]$/.test(normalized) ? '원' : null));
  const numberText = normalized.replace(/[^0-9억만천백십.,]/g, '');
  if (!/[0-9]/.test(numberText))
    return { numericValue: null, textValue: normalized, unit };
  if (hasAmbiguousMultipleNumbers(normalized))
    return { numericValue: null, textValue: normalized, unit };
  const numericValue = koreanNumber(numberText, unit);
  return { numericValue, textValue: null, unit };
}

function hasAmbiguousMultipleNumbers(value) {
  const matches = [...value.matchAll(/\d[\d,.]*/g)];
  if (matches.length < 2) return false;
  const compoundUnits = new Set(['억', '만', '천', '백', '십']);
  return matches.some((match) => {
    const next = value.slice((match.index ?? 0) + match[0].length).trimStart();
    return !compoundUnits.has(next[0]);
  });
}

function koreanNumber(value, unit) {
  const clean = value.replace(/,/g, '');
  if (unit === '억' || clean.includes('억')) {
    const [eok, remainder] = clean.split('억', 2);
    return (
      parseSmallKoreanNumber(eok) * 100_000_000 +
      (remainder ? koreanNumber(remainder, unit) : 0)
    );
  }
  if (unit === '만' || clean.includes('만')) {
    const [man, remainder] = clean.split('만', 2);
    return (
      parseSmallKoreanNumber(man) * 10_000 +
      (remainder ? parseSmallKoreanNumber(remainder) : 0)
    );
  }
  return parseSmallKoreanNumber(clean);
}

function parseSmallKoreanNumber(value) {
  const clean = value.replace(/,/g, '');
  if (!clean) return 0;
  let total = 0;
  let remainder = clean;
  for (const [unit, multiplier] of [
    ['천', 1_000],
    ['백', 100],
    ['십', 10],
  ]) {
    const index = remainder.indexOf(unit);
    if (index === -1) continue;
    const coefficient = remainder.slice(0, index);
    total += (coefficient ? Number(coefficient) : 1) * multiplier;
    remainder = remainder.slice(index + unit.length);
  }
  return total + (remainder ? Number(remainder) : 0);
}

function stripMarkdown(value) {
  return value.replaceAll('**', '').replaceAll('`', '');
}

function slugify(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'section'
  );
}
