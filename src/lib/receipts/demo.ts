export type DemoReceiptSource = {
  amount: number;
  donorName: string;
  pledgeDate: string;
  pledgeId: string;
  recipientAddress: string;
  recipientName: string;
};

export type DemoReceipt = DemoReceiptSource & {
  disclaimer: string;
  issuedAt: string;
  receiptNumber: string;
};

export function buildDemoReceipt(
  source: DemoReceiptSource,
  issuedAt = new Date().toISOString(),
): DemoReceipt {
  return {
    ...source,
    disclaimer: '데모 발급본이며 실제 세무·기부금 영수증의 효력이 없습니다.',
    issuedAt,
    receiptNumber: `DEMO-${source.pledgeId}`,
  };
}
