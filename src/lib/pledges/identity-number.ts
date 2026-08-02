import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const algorithm = 'aes-256-gcm';
const aad = Buffer.from('pledge:donor_identity_number:v1');

type EncryptedIdentityNumber = {
  authTag: string;
  ciphertext: string;
  iv: string;
};

export function isIdentityNumberCollectionEnabled() {
  return process.env.PLEDGE_IDENTITY_NUMBER_ENABLED === 'true';
}

export function normalizeIdentityNumber(value: string) {
  return value.replace(/\D/g, '');
}

export function isValidIdentityNumber(value: string) {
  const normalized = normalizeIdentityNumber(value);
  return /^\d{13}$/.test(normalized);
}

export function identityNumberLast4(value: string) {
  return normalizeIdentityNumber(value).slice(-4);
}

export function encryptIdentityNumber(value: string): EncryptedIdentityNumber {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, key, iv);
  cipher.setAAD(aad);
  const encrypted = Buffer.concat([
    cipher.update(normalizeIdentityNumber(value), 'utf8'),
    cipher.final(),
  ]);

  return {
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
  };
}

export function decryptIdentityNumber(input: EncryptedIdentityNumber) {
  const decipher = createDecipheriv(
    algorithm,
    getEncryptionKey(),
    Buffer.from(input.iv, 'base64'),
  );
  decipher.setAAD(aad);
  decipher.setAuthTag(Buffer.from(input.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function getEncryptionKey() {
  const encoded = process.env.PLEDGE_PII_ENCRYPTION_KEY?.trim();
  if (!encoded)
    throw new Error('PLEDGE_PII_ENCRYPTION_KEY가 설정되지 않았습니다.');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) {
    throw new Error(
      'PLEDGE_PII_ENCRYPTION_KEY는 32바이트 Base64 값이어야 합니다.',
    );
  }
  return key;
}
