import { describe, expect, it } from 'vitest';

import { GET, PATCH } from '@/app/api/partner/reports/[reportId]/route';
import { POST as publish } from '@/app/api/partner/reports/[reportId]/publish/route';
import { POST as retry } from '@/app/api/partner/reports/[reportId]/retry/route';

const validReportId = '18181818-0000-4000-8000-000000000031';

function context(reportId: string) {
  return { params: Promise.resolve({ reportId }) };
}

describe('partner report detail routes', () => {
  it('rejects an invalid report identifier before authentication', async () => {
    const [getResponse, patchResponse, publishResponse, retryResponse] =
      await Promise.all([
        GET(
          new Request('http://localhost/api/partner/reports/invalid'),
          context('invalid'),
        ),
        PATCH(
          new Request('http://localhost/api/partner/reports/invalid', {
            method: 'PATCH',
            body: '{}',
          }),
          context('invalid'),
        ),
        publish(
          new Request('http://localhost/api/partner/reports/invalid/publish', {
            method: 'POST',
            body: '{}',
          }),
          context('invalid'),
        ),
        retry(
          new Request('http://localhost/api/partner/reports/invalid/retry', {
            method: 'POST',
          }),
          context('invalid'),
        ),
      ]);

    for (const response of [
      getResponse,
      patchResponse,
      publishResponse,
      retryResponse,
    ]) {
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: 'invalid_identifier', retryable: false },
      });
    }
  });

  it('rejects malformed edit and publish bodies before authentication', async () => {
    const [patchResponse, publishResponse] = await Promise.all([
      PATCH(
        new Request(`http://localhost/api/partner/reports/${validReportId}`, {
          method: 'PATCH',
          body: 'not-json',
        }),
        context(validReportId),
      ),
      publish(
        new Request(
          `http://localhost/api/partner/reports/${validReportId}/publish`,
          { method: 'POST', body: 'not-json' },
        ),
        context(validReportId),
      ),
    ]);

    for (const response of [patchResponse, publishResponse]) {
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: 'invalid_json', retryable: false },
      });
    }
  });

  it('rejects structurally invalid content before authentication', async () => {
    const [patchResponse, publishResponse] = await Promise.all([
      PATCH(
        new Request(`http://localhost/api/partner/reports/${validReportId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: { title: '불완전' } }),
        }),
        context(validReportId),
      ),
      publish(
        new Request(
          `http://localhost/api/partner/reports/${validReportId}/publish`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: null }),
          },
        ),
        context(validReportId),
      ),
    ]);

    for (const response of [patchResponse, publishResponse]) {
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: 'invalid_content', retryable: false },
      });
    }
  });
});
