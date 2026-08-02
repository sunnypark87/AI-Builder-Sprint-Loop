import { describe, expect, it } from 'vitest';

import { mapModusignDocumentStatus } from './status-mapper';

const participants = [
  { role: 'donor' as const, status: 'waiting' as const },
  { role: 'organization' as const, status: 'waiting' as const },
];

describe('Modusign status mapping', () => {
  it('opens organization signing only after donor signing', () => {
    expect(
      mapModusignDocumentStatus(
        {
          currentSigningOrder: 2,
          participants: [
            { role: 'donor', status: 'signed' },
            { role: 'organization', status: 'waiting' },
          ],
          status: 'ON_GOING',
        },
        'awaiting_donor_signature',
      ),
    ).toBe('awaiting_organization_signature');
  });

  it('marks a completed document signed only when both participants signed', () => {
    expect(
      mapModusignDocumentStatus(
        {
          participants: [
            { role: 'donor', status: 'signed' },
            { role: 'organization', status: 'signed' },
          ],
          status: 'COMPLETED',
        },
        'awaiting_organization_signature',
      ),
    ).toBe('signed');
  });

  it('fails closed for incomplete or unknown statuses', () => {
    expect(
      mapModusignDocumentStatus(
        { participants, status: 'COMPLETED' },
        'awaiting_donor_signature',
      ),
    ).toBe('awaiting_donor_signature');
    expect(
      mapModusignDocumentStatus(
        { participants, status: 'UNKNOWN_STATUS' },
        'awaiting_donor_signature',
      ),
    ).toBe('awaiting_donor_signature');
  });

  it('maps rejection and cancellation separately', () => {
    expect(
      mapModusignDocumentStatus(
        { abortType: 'REJECTION', participants, status: 'ABORTED' },
        'awaiting_donor_signature',
      ),
    ).toBe('declined');
    expect(
      mapModusignDocumentStatus(
        {
          abortType: 'REQUEST_CANCELLATION',
          participants,
          status: 'ABORTED',
        },
        'awaiting_donor_signature',
      ),
    ).toBe('cancelled');
  });
});
