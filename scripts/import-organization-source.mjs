import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';

import { createClient } from '@supabase/supabase-js';

import {
  extractImpactFacts,
  parseImpactSections,
} from './impact-source-parser.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args.organization || !args.file || !args.period) {
  throw new Error(
    '사용법: npm run import:organization-source -- --organization <slug> --file <path> --period <year>',
  );
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !secretKey)
  throw new Error('Supabase 서버 환경 변수가 필요합니다.');

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false },
});
const content = await readFile(args.file, 'utf8');
const contentHash = createHash('sha256').update(content).digest('hex');
const { data: organization, error: organizationError } = await supabase
  .from('organizations')
  .select('id')
  .eq('slug', args.organization)
  .single();
if (organizationError || !organization)
  throw new Error('기부처를 찾을 수 없습니다.');

const storagePath = `${organization.id}/${contentHash}.txt`;
const { data: existingDocument, error: existingDocumentError } = await supabase
  .from('organization_source_documents')
  .select('id, processing_status, review_status')
  .eq('organization_id', organization.id)
  .eq('content_hash', contentHash)
  .maybeSingle();
if (existingDocumentError) throw existingDocumentError;
if (existingDocument) {
  console.log(
    JSON.stringify(
      {
        documentId: existingDocument.id,
        contentHash,
        skipped: true,
        processingStatus: existingDocument.processing_status,
        reviewStatus: existingDocument.review_status,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
const { error: uploadError } = await supabase.storage
  .from('organization-source-documents')
  .upload(storagePath, Buffer.from(content), {
    contentType: 'text/plain; charset=utf-8',
    upsert: true,
  });
if (uploadError) throw uploadError;

const { data: document, error: documentError } = await supabase
  .from('organization_source_documents')
  .upsert(
    {
      organization_id: organization.id,
      title: args.file.split('/').pop() ?? '연차 보고서',
      document_type: 'annual_report',
      reporting_period: args.period,
      storage_path: storagePath,
      mime_type: 'text/plain',
      content_hash: contentHash,
      visibility: 'private',
      processing_status: 'ready',
    },
    { onConflict: 'organization_id,content_hash' },
  )
  .select('id')
  .single();
if (documentError || !document)
  throw documentError ?? new Error('문서 저장에 실패했습니다.');

const parsedSections = parseImpactSections(content);
const sections = parsedSections.map((section) => ({
  section_key: section.sectionKey,
  heading: section.heading,
  content: section.content,
}));
await supabase
  .from('organization_source_sections')
  .delete()
  .eq('document_id', document.id);
const { data: insertedSections, error: sectionsError } = await supabase
  .from('organization_source_sections')
  .insert(
    sections.map((section, position) => ({
      ...section,
      document_id: document.id,
      position,
    })),
  )
  .select('id');
if (sectionsError) throw sectionsError;

const facts = extractImpactFacts(parsedSections, args.period);
const programs = parsedSections
  .filter((section) => /^3\.\d+\s/.test(section.heading))
  .map((section) => ({
    program_key: section.programKey,
    name: section.programName,
    description: firstParagraph(section.content),
    accepting_designated_donations: false,
  }))
  .filter(
    (program, index, all) =>
      program.program_key &&
      all.findIndex((item) => item.program_key === program.program_key) ===
        index,
  );
const { error: programsError } = programs.length
  ? await supabase
      .from('organization_programs')
      .upsert(
        programs.map((program) => ({
          ...program,
          organization_id: organization.id,
        })),
        { onConflict: 'organization_id,program_key', ignoreDuplicates: true },
      )
      .select('id, program_key')
  : { data: [], error: null };
if (programsError) throw programsError;
const { data: currentPrograms, error: currentProgramsError } = await supabase
  .from('organization_programs')
  .select('id, program_key')
  .eq('organization_id', organization.id);
if (currentProgramsError) throw currentProgramsError;
const programIds = new Map(
  (currentPrograms ?? []).map((program) => [program.program_key, program.id]),
);
await supabase
  .from('organization_impact_facts')
  .delete()
  .eq('document_id', document.id);
if (facts.length) {
  const { error: factsError } = await supabase
    .from('organization_impact_facts')
    .insert(
      facts.map((fact) => ({
        organization_id: organization.id,
        document_id: document.id,
        program_id: programIds.get(fact.programKey) ?? null,
        program_key: fact.programKey,
        program_name: fact.programName,
        metric_key: fact.metricKey,
        metric_label: fact.metricLabel,
        numeric_value: fact.numericValue,
        text_value: fact.textValue,
        unit: fact.unit,
        reporting_period: fact.reportingPeriod,
        evidence_text: fact.evidenceText,
        review_status: 'pending',
      })),
    );
  if (factsError) throw factsError;
}
const summaryJson = {
  title: `${args.period}년 활동 요약 초안`,
  overview:
    '원문에서 구조화한 활동 지표를 바탕으로 검토자가 확인할 수 있는 요약 초안입니다.',
  highlights: facts.slice(0, 8).map((fact) => ({
    programKey: fact.programKey,
    programName: fact.programName,
    metricLabel: fact.metricLabel,
    value: fact.numericValue ?? fact.textValue,
    unit: fact.unit,
    reportingPeriod: fact.reportingPeriod,
  })),
  guidance: [],
};
await supabase
  .from('organization_ai_summaries')
  .delete()
  .eq('document_id', document.id)
  .eq('summary_type', 'impact');
const { error: summaryError } = await supabase
  .from('organization_ai_summaries')
  .insert({
    organization_id: organization.id,
    document_id: document.id,
    summary_type: 'impact',
    source_revision: contentHash,
    summary_json: summaryJson,
    model: null,
    prompt_version: null,
    processing_status: 'pending',
    review_status: 'pending',
    processing_error: null,
    reviewed_by: null,
    reviewed_at: null,
  });
if (summaryError) throw summaryError;
console.log(
  JSON.stringify(
    {
      documentId: document.id,
      contentHash,
      sections: insertedSections?.length ?? 0,
      programs: programs.length,
      facts: facts.length,
    },
    null,
    2,
  ),
);

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1)
    if (values[index].startsWith('--'))
      result[values[index].slice(2)] = values[index + 1];
  return result;
}

function firstParagraph(content) {
  return (
    content
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.replace(/[*_`]/g, '').trim())
      .find((paragraph) => paragraph && !paragraph.startsWith('#')) ?? ''
  );
}
