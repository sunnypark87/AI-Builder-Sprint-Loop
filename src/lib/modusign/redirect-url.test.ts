import { describe, expect, it } from 'vitest';

import { getModusignRedirectUrl } from './redirect-url';

describe('Modusign redirect URL', () => {
  it('uses an HTTPS deployment URL', () => {
    expect(
      getModusignRedirectUrl('/pledges/pledge-1/waiting', 'https://demo.test'),
    ).toBe('https://demo.test/pledges/pledge-1/waiting');
  });

  it('omits an HTTP localhost URL rejected by Modusign', () => {
    expect(
      getModusignRedirectUrl(
        '/pledges/pledge-1/waiting',
        'http://localhost:3000',
      ),
    ).toBeUndefined();
  });

  it('fails closed for a missing or invalid site URL', () => {
    expect(getModusignRedirectUrl('/pledges/pledge-1/waiting')).toBeUndefined();
    expect(
      getModusignRedirectUrl('/pledges/pledge-1/waiting', 'not a URL'),
    ).toBeUndefined();
  });
});
