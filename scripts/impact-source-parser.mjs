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

function parseKoreanMetric(value) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  const unitMatch = normalized.match(
    /(억|만|명|개소|대|회|%|가구|명)(?:\s*원)?$/,
  );
  const unit = /원$/.test(normalized)
    ? '원'
    : (unitMatch?.[1] ?? (/[억만]$/.test(normalized) ? '원' : null));
  const numberText = normalized.replace(/[^0-9억만.,]/g, '');
  if (!/[0-9]/.test(numberText))
    return { numericValue: null, textValue: normalized, unit };
  const numericValue = koreanNumber(numberText, unit);
  return { numericValue, textValue: null, unit };
}

function koreanNumber(value, unit) {
  const clean = value.replace(/,/g, '');
  if (unit === '억' || clean.includes('억')) {
    const [eok, remainder] = clean.split('억');
    return (
      Number(eok) * 100_000_000 +
      (remainder ? Number(remainder.replace('만', '')) * 10_000 : 0)
    );
  }
  if (unit === '만' || clean.includes('만'))
    return Number(clean.replace('만', '')) * 10_000;
  return Number(clean);
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
