import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { getOrganizationIds, getOrganizationMemberships } from './membership';

describe('organization memberships', () => {
  it('returns every membership for the user', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        { organization_id: 'org-1', role: 'owner' },
        { organization_id: 'org-2', role: 'manager' },
      ],
      error: null,
    });
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const client = { from } as unknown as SupabaseClient;

    const result = await getOrganizationMemberships(client, 'user-1');

    expect(result.data).toHaveLength(2);
    expect(from).toHaveBeenCalledWith('organization_members');
    expect(select).toHaveBeenCalledWith('organization_id, role');
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(order).toHaveBeenCalledWith('organization_id', {
      ascending: true,
    });
  });

  it('maps memberships to organization ids', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ organization_id: 'org-1', role: 'owner' }],
      error: null,
    });
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ order })),
        })),
      })),
    } as unknown as SupabaseClient;
    const result = await getOrganizationIds(client, 'user-1');
    expect(result.data).toEqual(['org-1']);
  });
});
