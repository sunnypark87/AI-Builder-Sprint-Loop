import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import {
  ReceiptDocumentValidationError,
  validateReceiptDocument,
} from '@/lib/executions/receipt-file-validation';

describe('validateReceiptDocument', () => {
  it('accepts a real supported PDF and returns a fingerprint', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const bytes = await pdf.save();
    const buffer = Uint8Array.from(bytes).buffer;
    const result = await validateReceiptDocument(
      new File([buffer], 'receipt.pdf', { type: 'application/pdf' }),
    );
    expect(result.type).toBe('application/pdf');
    expect(result.pageCount).toBe(1);
    expect(result.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects an empty receipt with a receipt-specific safe message', async () => {
    await expect(
      validateReceiptDocument(
        new File([], 'receipt.png', { type: 'image/png' }),
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ReceiptDocumentValidationError>>({
        code: 'empty_file',
      }),
    );
  });
});
