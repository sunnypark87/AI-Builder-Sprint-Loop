import { timingSafeEqual } from 'node:crypto';

export const MODUSIGN_WEBHOOK_SECRET_HEADER = 'x-modusign-webhook-secret';

export function hasValidModusignWebhookSecret(
  providedSecret: string | null,
  expectedSecret = process.env.MODUSIGN_WEBHOOK_SECRET,
) {
  if (!providedSecret || !expectedSecret) {
    return false;
  }

  const provided = Buffer.from(providedSecret, 'utf8');
  const expected = Buffer.from(expectedSecret, 'utf8');

  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}
