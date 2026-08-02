import { MODUSIGN_DONATION_TEMPLATE_ID } from './template-mapping';

const defaultModusignBaseUrl = 'https://api.modusign.co.kr';

export type ModusignConfig = {
  authKey: string;
  baseUrl: string;
  templateId: string;
};

export function getModusignConfig(): ModusignConfig {
  const authKey = process.env.MODUSIGN_AUTH_KEY?.trim();

  if (!authKey) {
    throw new Error('MODUSIGN_AUTH_KEY가 설정되지 않았습니다.');
  }

  return {
    authKey,
    baseUrl: process.env.MODUSIGN_API_BASE_URL || defaultModusignBaseUrl,
    templateId:
      process.env.MODUSIGN_TEMPLATE_ID || MODUSIGN_DONATION_TEMPLATE_ID,
  };
}
