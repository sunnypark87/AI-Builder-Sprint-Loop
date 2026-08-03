type DonationLabelInput = {
  amount: number | string;
  createdAt: string;
  donorName?: string | null;
  id: string;
  pledgeDate?: string | null;
  purpose?: string | null;
};

export function formatEligibleDonationLabel(input: DonationLabelInput) {
  const amount = `${Number(input.amount).toLocaleString('ko-KR')}원`;

  if (input.donorName && input.purpose) {
    const date = input.pledgeDate ? formatDateOnly(input.pledgeDate) : null;
    return [input.donorName + ' 님', input.purpose, amount, date]
      .filter(Boolean)
      .join(' · ');
  }

  const createdAt = new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeZone: 'Asia/Seoul',
  }).format(new Date(input.createdAt));
  return `기존 기부 · ${amount} · ${createdAt} (${input.id.slice(0, 8)})`;
}

function formatDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return `${year}. ${month}. ${day}.`;
}
