import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { getActiveOrganizationMembership } from './membership';

describe('getActiveOrganizationMembership', () => {
  it('selects one membership with a deterministic oldest-first order', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { organization_id: 'org-1' },
      error: null,
    });
    const limit = vi.fn(() => ({ maybeSingle }));
    const secondOrder = vi.fn(() => ({ limit }));
    const firstOrder = vi.fn(() => ({ order: secondOrder }));
    const eq = vi.fn(() => ({ order: firstOrder }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const client = { from } as unknown as SupabaseClient;

    const result = await getActiveOrganizationMembership(client, 'user-1');

    expect(result.data).toEqual({ organization_id: 'org-1' });
    expect(from).toHaveBeenCalledWith('organization_members');
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(firstOrder).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(secondOrder).toHaveBeenCalledWith('organization_id', {
      ascending: true,
    });
    expect(limit).toHaveBeenCalledWith(1);
  });
});
