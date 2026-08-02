export type ConsultationMessageResponse = {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'pending' | 'completed' | 'failed';
  proposedPatch?: Record<string, unknown>;
  failure?: { code: string; retryable: boolean };
  createdAt?: string;
  updatedAt?: string;
  suggestedReplies?: SuggestedReplyResponse[];
};

export type SuggestedReplyResponse = {
  id: string;
  label: string;
  message: string;
};

export type ConsultationTurnResponse = {
  userMessage: ConsultationMessageResponse;
  assistantMessage: ConsultationMessageResponse | null;
  appliedPatch: Record<string, unknown>;
  missingFields: string[];
  nextQuestionField: string | null;
};

export type ConsultationHistoryResponse = {
  messages: ConsultationMessageResponse[];
};

export type ConsultationErrorResponse = {
  error: {
    code: string;
    retryable: boolean;
    reason?: string;
    kinds?: string[];
  };
};
