const DEFAULT_BASE_URL = 'https://api.upstage.ai/v1';
const DEFAULT_MODEL = 'solar-pro3';
const DEFAULT_TIMEOUT_MS = 15_000;

export type UpstageChatConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
};

export class UpstageChatConfigError extends Error {
  constructor(message = 'AI 상담 서비스가 구성되지 않았습니다.') {
    super(message);
    this.name = 'UpstageChatConfigError';
  }
}

export function getUpstageChatConfig(
  env: Record<string, string | undefined> = process.env,
): UpstageChatConfig {
  const apiKey = env.UPSTAGE_API_KEY?.trim();
  if (!apiKey) throw new UpstageChatConfigError();
  const timeoutMs = parseTimeout(env.UPSTAGE_CHAT_TIMEOUT_MS);
  return {
    apiKey,
    baseUrl: DEFAULT_BASE_URL,
    model: env.UPSTAGE_CHAT_MODEL?.trim() || DEFAULT_MODEL,
    timeoutMs,
  };
}

function parseTimeout(value: string | undefined) {
  if (value === undefined || value.trim() === '') return DEFAULT_TIMEOUT_MS;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1_000 || parsed > 60_000) {
    throw new UpstageChatConfigError(
      'AI 상담 timeout 설정이 올바르지 않습니다.',
    );
  }
  return parsed;
}
