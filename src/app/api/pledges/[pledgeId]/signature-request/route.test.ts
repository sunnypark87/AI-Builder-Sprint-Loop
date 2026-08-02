import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ModusignApiError } from '@/lib/modusign/client';

import { POST } from './route';

const {
  createAdminClient,
  createClient,
  createModusignClient,
  decryptIdentityNumber,
  getCurrentUser,
  getModusignConfig,
} = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  createModusignClient: vi.fn(),
  decryptIdentityNumber: vi.fn(),
  getCurrentUser: vi.fn(),
  getModusignConfig: vi.fn(),
}));

vi.mock('@/lib/modusign/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/modusign/client')>()),
  createModusignClient,
}));
vi.mock('@/lib/modusign/config', () => ({ getModusignConfig }));
vi.mock('@/lib/pledges/identity-number', () => ({ decryptIdentityNumber }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }));
vi.mock('@/lib/supabase/auth', () => ({ getCurrentUser }));
vi.mock('@/lib/supabase/server', () => ({ createClient }));

const context = { params: Promise.resolve({ pledgeId: 'pledge-1' }) };

function pledgeClient(pledge: Record<string, unknown> | null, error = null) {
  return {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: pledge, error }),
          }),
        }),
      }),
    })),
  };
}

const completePledge = {
  amount: 10000,
  donation_condition: null,
  donation_designation: 'education',
  donation_kind: 'general',
  donation_kind_other: null,
  donation_type: 'cash',
  donor_address: '서울시 테스트구',
  donor_contact: '010-0000-0000',
  donor_identity_number_auth_tag: 'tag',
  donor_identity_number_ciphertext: 'ciphertext',
  donor_identity_number_iv: 'iv',
  donor_name: '테스트 기부자',
  id: 'pledge-1',
  identity_info_consent: true,
  organization_id: 'org-1',
  payment_method: 'card',
  payment_method_other: null,
  payment_schedule: 'once',
  payment_schedule_other: null,
  personal_info_consent: true,
  pledge_date: '2026-08-02',
  purpose: '교육',
  receipt_recipient_address: null,
  receipt_recipient_name: null,
  receipt_requested: false,
  status: 'draft',
  third_party_info_consent: true,
};

function query(result: unknown) {
  const promise = Promise.resolve(result);
  const chain = {
    eq: () => chain,
    in: () => chain,
    insert: () => chain,
    is: () => chain,
    maybeSingle: () => promise,
    select: () => chain,
    update: () => chain,
    then: promise.then.bind(promise),
  };
  return chain;
}

function signingAdmin({
  existing = null,
  providerError = null,
}: {
  existing?: Record<string, string> | null;
  providerError?: unknown;
} = {}) {
  let documentSelectCount = 0;
  const update = vi.fn(() => query({ data: null, error: null }));
  return {
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({
          data: { user: { email: 'organization@example.com' } },
          error: null,
        }),
      },
    },
    from: vi.fn((table) => {
      if (table === 'signature_documents') {
        return {
          insert: () =>
            query({
              data: {
                id: 'signature-document-1',
                provider_document_id: null,
                sync_status: 'syncing',
              },
              error: null,
            }),
          select: () => {
            documentSelectCount += 1;
            return query({
              data: documentSelectCount === 1 ? existing : existing,
              error: null,
            });
          },
          update,
        };
      }
      if (table === 'organization_members') {
        return {
          select: () =>
            query({
              data: {
                role: 'signer',
                signer_email: 'organization@example.com',
                signer_name: '테스트 기부처',
                user_id: 'organization-user-1',
              },
              error: null,
            }),
        };
      }
      return { update };
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    update,
    providerError,
  };
}

describe('POST /api/pledges/[pledgeId]/signature-request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({
      id: 'donor-1',
      email: 'donor@example.com',
    });
    decryptIdentityNumber.mockReturnValue('900101-1234567');
    getModusignConfig.mockReturnValue({
      baseUrl: 'https://modusign.example',
      templateId: 'template-1',
    });
  });

  it('rejects anonymous requests before accessing pledge data', async () => {
    getCurrentUser.mockResolvedValue(null);

    const response = await POST(
      new Request('http://localhost/api/pledges/pledge-1/signature-request'),
      context,
    );

    expect(response.status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('does not reveal whether another donor pledge exists', async () => {
    createClient.mockResolvedValue(pledgeClient(null));

    const response = await POST(
      new Request('http://localhost/api/pledges/pledge-1/signature-request'),
      context,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: 'pledge_not_found',
    });
  });

  it('rejects incomplete pledges before creating an external document', async () => {
    createClient.mockResolvedValue(
      pledgeClient({
        amount: 10000,
        donation_type: 'cash',
        donor_address: '',
        donor_contact: '010-0000-0000',
        donor_identity_number_auth_tag: 'tag',
        donor_identity_number_ciphertext: 'ciphertext',
        donor_identity_number_iv: 'iv',
        donor_name: '테스트 기부자',
        donation_kind: 'general',
        donation_designation: 'education',
        id: 'pledge-1',
        organization_id: 'org-1',
        payment_method: 'card',
        payment_schedule: 'once',
        personal_info_consent: true,
        pledge_date: '2026-08-02',
        purpose: '교육',
        status: 'draft',
        third_party_info_consent: true,
      }),
    );

    const response = await POST(
      new Request('http://localhost/api/pledges/pledge-1/signature-request'),
      context,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'pledge_incomplete',
      fields: ['donor_address'],
    });
  });

  it('creates one sequential signing request for a complete pledge', async () => {
    createClient.mockResolvedValue(pledgeClient(completePledge));
    const admin = signingAdmin();
    createAdminClient.mockReturnValue(admin);
    const createDocumentWithTemplate = vi.fn().mockResolvedValue({
      id: 'provider-document-1',
      participants: [
        { id: 'donor-participant-1', signingOrder: 1, type: 'SIGNER' },
        { id: 'organization-participant-1', signingOrder: 2, type: 'SIGNER' },
      ],
      signings: [],
      status: 'ON_GOING',
      title: '기부 약정서',
    });
    createModusignClient.mockReturnValue({ createDocumentWithTemplate });

    const response = await POST(
      new Request('http://localhost/api/pledges/pledge-1/signature-request'),
      context,
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      documentId: 'provider-document-1',
      status: 'awaiting_donor_signature',
    });
    expect(createDocumentWithTemplate).toHaveBeenCalledOnce();
    expect(admin.rpc).toHaveBeenCalledWith(
      'finalize_modusign_signature_request',
      expect.objectContaining({
        p_donor_participant_id: 'donor-participant-1',
        p_organization_participant_id: 'organization-participant-1',
      }),
    );
  });

  it('reuses an idle provider document without creating another request', async () => {
    createClient.mockResolvedValue(pledgeClient(completePledge));
    createAdminClient.mockReturnValue(
      signingAdmin({
        existing: {
          id: 'signature-document-1',
          provider_document_id: 'provider-document-existing',
          sync_status: 'idle',
        },
      }),
    );
    createModusignClient.mockReturnValue({
      createDocumentWithTemplate: vi.fn(),
    });

    const response = await POST(
      new Request('http://localhost/api/pledges/pledge-1/signature-request'),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      documentId: 'provider-document-existing',
      status: 'existing',
    });
    expect(createModusignClient).not.toHaveBeenCalled();
  });

  it('refetches and finalizes a linked non-idle provider document', async () => {
    createClient.mockResolvedValue(pledgeClient(completePledge));
    const admin = signingAdmin({
      existing: {
        id: 'signature-document-1',
        provider_document_id: 'provider-document-linked',
        sync_status: 'failed',
      },
    });
    createAdminClient.mockReturnValue(admin);
    const createDocumentWithTemplate = vi.fn();
    const getDocument = vi.fn().mockResolvedValue({
      id: 'provider-document-linked',
      participants: [
        { id: 'donor-participant-1', signingOrder: 1, type: 'SIGNER' },
        {
          id: 'organization-participant-1',
          signingOrder: 2,
          type: 'SIGNER',
        },
      ],
      signings: [],
      status: 'ON_GOING',
      title: '기부 약정서',
    });
    createModusignClient.mockReturnValue({
      createDocumentWithTemplate,
      getDocument,
    });

    const response = await POST(
      new Request('http://localhost/api/pledges/pledge-1/signature-request'),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      documentId: 'provider-document-linked',
      status: 'existing',
    });
    expect(getDocument).toHaveBeenCalledWith('provider-document-linked');
    expect(createDocumentWithTemplate).not.toHaveBeenCalled();
    expect(admin.rpc).toHaveBeenCalledWith(
      'finalize_modusign_signature_request',
      expect.objectContaining({
        p_provider_document_id: 'provider-document-linked',
      }),
    );
  });

  it('keeps a linked document reconcilable when finalization fails again', async () => {
    createClient.mockResolvedValue(pledgeClient(completePledge));
    const admin = signingAdmin({
      existing: {
        id: 'signature-document-1',
        provider_document_id: 'provider-document-linked',
        sync_status: 'failed',
      },
    });
    admin.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'temporary' },
    });
    createAdminClient.mockReturnValue(admin);
    createModusignClient.mockReturnValue({
      getDocument: vi.fn().mockResolvedValue({
        id: 'provider-document-linked',
        participants: [
          { id: 'donor-participant-1', signingOrder: 1, type: 'SIGNER' },
          {
            id: 'organization-participant-1',
            signingOrder: 2,
            type: 'SIGNER',
          },
        ],
        signings: [],
        status: 'ON_GOING',
        title: '기부 약정서',
      }),
    });

    const response = await POST(
      new Request('http://localhost/api/pledges/pledge-1/signature-request'),
      context,
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      code: 'signature_reconciliation_failed',
    });
    expect(admin.update).toHaveBeenCalledWith({
      last_error_code: 'internal_signature_finalize_failed',
      sync_status: 'reconciliation_required',
    });
  });

  it('maps provider failures and marks the request failed', async () => {
    createClient.mockResolvedValue(pledgeClient(completePledge));
    const admin = signingAdmin();
    createAdminClient.mockReturnValue(admin);
    createModusignClient.mockReturnValue({
      createDocumentWithTemplate: vi
        .fn()
        .mockRejectedValue(new Error('provider response secret')),
    });

    const response = await POST(
      new Request('http://localhost/api/pledges/pledge-1/signature-request'),
      context,
    );

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toEqual({ code: 'signature_request_failed' });
    expect(JSON.stringify(body)).not.toContain('provider response secret');
    expect(admin.update).toHaveBeenCalled();
  });

  it('keeps timed-out requests in reconciliation instead of retrying immediately', async () => {
    createClient.mockResolvedValue(pledgeClient(completePledge));
    const admin = signingAdmin();
    createAdminClient.mockReturnValue(admin);
    createModusignClient.mockReturnValue({
      createDocumentWithTemplate: vi
        .fn()
        .mockRejectedValue(new ModusignApiError('timeout')),
    });

    const response = await POST(
      new Request('http://localhost/api/pledges/pledge-1/signature-request'),
      context,
    );

    expect(response.status).toBe(504);
    expect(admin.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        last_error_code: 'modusign_timeout',
        sync_status: 'reconciliation_required',
      }),
    );
  });

  it('recovers a timed-out request from provider metadata without creating a duplicate', async () => {
    createClient.mockResolvedValue(pledgeClient(completePledge));
    const admin = signingAdmin({
      existing: {
        id: 'signature-document-1',
        last_error_code: 'modusign_timeout',
        provider_document_id: '',
        sync_started_at: new Date().toISOString(),
        sync_status: 'reconciliation_required',
      },
    });
    createAdminClient.mockReturnValue(admin);
    const createDocumentWithTemplate = vi.fn();
    const findDocumentsByMetadata = vi.fn().mockResolvedValue([
      {
        id: 'provider-document-recovered',
        participants: [
          { id: 'donor-participant-1', signingOrder: 1, type: 'SIGNER' },
          {
            id: 'organization-participant-1',
            signingOrder: 2,
            type: 'SIGNER',
          },
        ],
        signings: [],
        status: 'ON_GOING',
        title: '기부 약정서',
      },
    ]);
    createModusignClient.mockReturnValue({
      createDocumentWithTemplate,
      findDocumentsByMetadata,
    });

    const response = await POST(
      new Request('http://localhost/api/pledges/pledge-1/signature-request'),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      documentId: 'provider-document-recovered',
      status: 'existing',
    });
    expect(findDocumentsByMetadata).toHaveBeenCalledWith({
      pledge_id: 'pledge-1',
    });
    expect(createDocumentWithTemplate).not.toHaveBeenCalled();
    expect(admin.rpc).toHaveBeenCalledWith(
      'finalize_modusign_signature_request',
      expect.objectContaining({
        p_provider_document_id: 'provider-document-recovered',
      }),
    );
  });
});
