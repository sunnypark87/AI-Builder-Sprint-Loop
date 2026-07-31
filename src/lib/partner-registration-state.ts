export const partnerRegistrationStorageKey = 'modugive:partner-registration';

export type PartnerRegistrationValues = {
  organizationName: string;
  organizationType: string;
  registrationNumber: string;
  representativeName: string;
  address: string;
  website: string;
  category: string;
  description: string;
  managerName: string;
  managerRole: string;
  managerEmail: string;
  managerPhone: string;
};

export const defaultPartnerRegistrationValues: PartnerRegistrationValues = {
  organizationName: '해봄재단',
  organizationType: 'foundation',
  registrationNumber: '123-45-67890',
  representativeName: '김해봄',
  address: '서울특별시 종로구 모두길 12',
  website: 'https://example.org',
  category: 'children',
  description: '돌봄 공백 아동의 방과 후 배움과 식사를 지원합니다.',
  managerName: '박모두',
  managerRole: '기부사업팀 팀장',
  managerEmail: 'manager@example.org',
  managerPhone: '02-1234-5678',
};

export function getStoredPartnerRegistration(): Partial<PartnerRegistrationValues> {
  return parsePartnerRegistrationSnapshot(getPartnerRegistrationSnapshot());
}

export function parsePartnerRegistrationSnapshot(
  snapshot: string,
): Partial<PartnerRegistrationValues> {
  if (!snapshot) return {};
  try {
    const parsed = JSON.parse(snapshot) as Partial<PartnerRegistrationValues>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getPartnerRegistrationSnapshot() {
  if (typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(partnerRegistrationStorageKey) ?? '';
  } catch {
    return '';
  }
}

export function savePartnerRegistration(values: PartnerRegistrationValues) {
  window.sessionStorage.setItem(
    partnerRegistrationStorageKey,
    JSON.stringify(values),
  );
}
