import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';

import { validatePlanDocument } from '@/lib/plans/file-validation';

function file(bytes: number[], name: string, type: string) {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('validatePlanDocument', () => {
  it('accepts a PNG whose signature matches its declared type', async () => {
    const result = await validatePlanDocument(
      file(
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00],
        'plan.png',
        'image/png',
      ),
    );

    expect(result).toMatchObject({
      type: 'image/png',
      pageCount: 1,
    });
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects a file whose content does not match the MIME type', async () => {
    const validation = validatePlanDocument(
      file([0xff, 0xd8, 0xff, 0x00], 'plan.png', 'image/png'),
    );

    await expect(validation).rejects.toMatchObject({
      code: 'invalid_signature',
    });
  });

  it('accepts JPEG and a valid single-page PDF', async () => {
    await expect(
      validatePlanDocument(
        file([0xff, 0xd8, 0xff, 0xe0], 'plan.jpg', 'image/jpeg'),
      ),
    ).resolves.toMatchObject({ type: 'image/jpeg', pageCount: 1 });

    const document = await PDFDocument.create();
    document.addPage();
    const body = Uint8Array.from(await document.save()).buffer;
    await expect(
      validatePlanDocument(
        new File([body], 'plan.pdf', { type: 'application/pdf' }),
      ),
    ).resolves.toMatchObject({ type: 'application/pdf', pageCount: 1 });
  });

  it('rejects empty, oversized, unsupported, and damaged files', async () => {
    await expect(
      validatePlanDocument(new File([], 'empty.png', { type: 'image/png' })),
    ).rejects.toMatchObject({ code: 'empty_file' });

    await expect(
      validatePlanDocument(
        new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png', {
          type: 'image/png',
        }),
      ),
    ).rejects.toMatchObject({ code: 'file_too_large' });

    await expect(
      validatePlanDocument(
        new File(['plain text'], 'plan.txt', { type: 'text/plain' }),
      ),
    ).rejects.toMatchObject({ code: 'unsupported_type' });

    await expect(
      validatePlanDocument(
        file(
          [0x25, 0x50, 0x44, 0x46, 0x2d, 0x62, 0x72, 0x6f, 0x6b, 0x65, 0x6e],
          'broken.pdf',
          'application/pdf',
        ),
      ),
    ).rejects.toMatchObject({ code: 'invalid_pdf' });
  });

  it('rejects a PDF over the page limit', async () => {
    const document = await PDFDocument.create();
    for (let index = 0; index < 31; index += 1) {
      document.addPage();
    }
    const body = await document.save();
    const pdf = Uint8Array.from(body).buffer;
    const validation = validatePlanDocument(
      new File([pdf], 'plan.pdf', { type: 'application/pdf' }),
    );

    await expect(validation).rejects.toMatchObject({
      code: 'pdf_page_limit',
    });
  });
});
