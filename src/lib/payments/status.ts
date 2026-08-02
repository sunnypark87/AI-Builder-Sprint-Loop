export const paymentStatuses = [
  'pending',
  'completed',
  'failed',
  'cancelled',
] as const;

export type PaymentStatus = (typeof paymentStatuses)[number];

const allowedPaymentTransitions: Record<
  PaymentStatus,
  readonly PaymentStatus[]
> = {
  pending: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus) {
  return from === to || allowedPaymentTransitions[from].includes(to);
}
