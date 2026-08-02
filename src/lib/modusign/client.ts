import { getModusignConfig } from './config';

type ModusignParticipant = {
  id: string;
  name: string;
  signingOrder: number;
  status?: string;
  type: 'SIGNER' | 'VIEWER';
};

export type ModusignDocument = {
  abortType?: 'REJECTION' | 'REQUEST_CANCELLATION' | 'SIGNING_CANCELLATION';
  currentSigningOrder?: number;
  id: string;
  participants: ModusignParticipant[];
  signings: Array<{ participantId: string; signedAt: string }>;
  status: string;
  title: string;
};

export type ModusignTemplateRequest = {
  document: Record<string, unknown>;
  templateId?: string;
};

export class ModusignApiError extends Error {
  constructor(
    public readonly code: 'invalid_response' | 'request_failed' | 'timeout',
    public readonly status?: number,
  ) {
    super('모두싸인 요청을 처리하지 못했습니다.');
    this.name = 'ModusignApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseDocument(value: unknown): ModusignDocument {
  if (!isRecord(value)) {
    throw new ModusignApiError('invalid_response');
  }

  const participants = value.participants;
  const signings = value.signings;

  if (
    typeof value.id !== 'string' ||
    typeof value.status !== 'string' ||
    typeof value.title !== 'string' ||
    !Array.isArray(participants)
  ) {
    throw new ModusignApiError('invalid_response');
  }

  return {
    abortType:
      isRecord(value.abort) &&
      (value.abort.type === 'REJECTION' ||
        value.abort.type === 'REQUEST_CANCELLATION' ||
        value.abort.type === 'SIGNING_CANCELLATION')
        ? value.abort.type
        : undefined,
    currentSigningOrder:
      typeof value.currentSigningOrder === 'number'
        ? value.currentSigningOrder
        : undefined,
    id: value.id,
    participants: participants.filter(isRecord).map((participant) => ({
      id: typeof participant.id === 'string' ? participant.id : '',
      name: typeof participant.name === 'string' ? participant.name : '',
      signingOrder:
        typeof participant.signingOrder === 'number'
          ? participant.signingOrder
          : 0,
      status:
        typeof participant.status === 'string' ? participant.status : undefined,
      type: participant.type === 'VIEWER' ? 'VIEWER' : 'SIGNER',
    })),
    signings: (Array.isArray(signings) ? signings : [])
      .filter(isRecord)
      .filter(
        (signing) =>
          typeof signing.participantId === 'string' &&
          typeof signing.signedAt === 'string',
      )
      .map((signing) => ({
        participantId: signing.participantId as string,
        signedAt: signing.signedAt as string,
      })),
    status: value.status,
    title: value.title,
  };
}

function parseDocumentIds(value: unknown): string[] {
  const candidates = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.documents)
      ? value.documents
      : isRecord(value) && Array.isArray(value.items)
        ? value.items
        : isRecord(value) && Array.isArray(value.data)
          ? value.data
          : null;

  if (!candidates) {
    throw new ModusignApiError('invalid_response');
  }

  return candidates
    .filter(isRecord)
    .map((document) => document.id)
    .filter((id): id is string => typeof id === 'string' && Boolean(id));
}

async function requestModusign<T>(
  path: string,
  init: RequestInit,
  parse: (value: unknown) => T,
): Promise<T> {
  const config = getModusignConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${config.authKey}`,
        ...init.headers,
      },
    });

    if (!response.ok) {
      throw new ModusignApiError('request_failed', response.status);
    }

    return parse(await response.json());
  } catch (error) {
    if (error instanceof ModusignApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ModusignApiError('timeout');
    }

    throw new ModusignApiError('request_failed');
  } finally {
    clearTimeout(timeout);
  }
}

export function createModusignClient() {
  const client = {
    createDocumentWithTemplate(input: ModusignTemplateRequest) {
      const config = getModusignConfig();

      return requestModusign(
        '/documents/request-with-template',
        {
          body: JSON.stringify({
            document: input.document,
            templateId: input.templateId || config.templateId,
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        },
        parseDocument,
      );
    },

    getDocument(documentId: string) {
      return requestModusign(
        `/documents/${encodeURIComponent(documentId)}`,
        { method: 'GET' },
        parseDocument,
      );
    },

    async findDocumentsByMetadata(metadata: Record<string, string>) {
      const params = new URLSearchParams({
        limit: '10',
        metadatas: JSON.stringify(metadata),
      });
      const documentIds = await requestModusign(
        `/documents?${params.toString()}`,
        { method: 'GET' },
        parseDocumentIds,
      );

      return Promise.all(documentIds.map((id) => client.getDocument(id)));
    },

    async getEmbeddedParticipantView(
      documentId: string,
      participantId: string,
      redirectUrl?: string,
    ) {
      const params = new URLSearchParams();

      if (redirectUrl) {
        params.set('redirectUrl', redirectUrl);
      }

      const query = params.toString();
      const result = await requestModusign(
        `/documents/${encodeURIComponent(documentId)}/participants/${encodeURIComponent(participantId)}/embedded-view${query ? `?${query}` : ''}`,
        { method: 'GET' },
        (value) => {
          if (!isRecord(value) || typeof value.embeddedUrl !== 'string') {
            throw new ModusignApiError('invalid_response');
          }

          return { embeddedUrl: value.embeddedUrl };
        },
      );

      return result;
    },
  };

  return client;
}
