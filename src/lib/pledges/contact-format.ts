export function formatIdentityNumberInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 13);
  return digits.length > 6
    ? `${digits.slice(0, 6)}-${digits.slice(6)}`
    : digits;
}

export function formatMobilePhoneInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function isValidIdentityNumberInput(value: string) {
  return /^(?:\d{13}|\d{6}-\d{7})$/.test(value.trim());
}

export function isValidMobilePhoneInput(value: string) {
  return /^(?:010\d{8}|010-\d{4}-\d{4})$/.test(value.trim());
}

export function isValidEmailInput(value: string) {
  const email = value.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
