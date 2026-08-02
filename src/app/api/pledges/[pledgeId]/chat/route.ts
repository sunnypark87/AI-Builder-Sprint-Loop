import { NextResponse } from 'next/server';

import {
  createMockAssistantReply,
  type PledgeChatMessage,
} from '@/lib/pledges/chat';
import { getCurrentUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ pledgeId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ code: 'unauthorized' }, { status: 401 });
  const { pledgeId } = await context.params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pledge_chat_messages')
    .select('id, role, content, proposed_patch, created_at')
    .eq('pledge_id', pledgeId)
    .order('created_at', { ascending: true });
  if (error)
    return NextResponse.json({ code: 'chat_lookup_failed' }, { status: 503 });
  return NextResponse.json({ messages: (data ?? []).map(toMessage) });
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ code: 'unauthorized' }, { status: 401 });
  const { pledgeId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: 'invalid_json' }, { status: 400 });
  }
  if (
    !isRecord(body) ||
    typeof body.message !== 'string' ||
    !body.message.trim()
  ) {
    return NextResponse.json({ code: 'invalid_message' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: pledge } = await supabase
    .from('pledges')
    .select('id')
    .eq('id', pledgeId)
    .eq('donor_user_id', user.id)
    .maybeSingle();
  if (!pledge)
    return NextResponse.json({ code: 'pledge_not_found' }, { status: 404 });

  const reply = createMockAssistantReply(body.message);
  const messages = [
    {
      content: body.message.trim(),
      pledge_id: pledgeId,
      proposed_patch: null,
      role: 'user',
    },
    {
      content: reply.content,
      pledge_id: pledgeId,
      proposed_patch: reply.proposedPatch ?? null,
      role: 'assistant',
    },
  ];
  const { data, error } = await supabase
    .from('pledge_chat_messages')
    .insert(messages)
    .select('id, role, content, proposed_patch, created_at');
  if (error)
    return NextResponse.json({ code: 'chat_save_failed' }, { status: 503 });
  return NextResponse.json(
    { messages: (data ?? []).map(toMessage) },
    { status: 201 },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toMessage(value: Record<string, unknown>): PledgeChatMessage {
  return {
    id: typeof value.id === 'string' ? value.id : undefined,
    role: value.role === 'user' ? 'user' : 'assistant',
    content: typeof value.content === 'string' ? value.content : '',
    proposedPatch: isRecord(value.proposed_patch)
      ? value.proposed_patch
      : undefined,
    createdAt:
      typeof value.created_at === 'string' ? value.created_at : undefined,
  };
}
