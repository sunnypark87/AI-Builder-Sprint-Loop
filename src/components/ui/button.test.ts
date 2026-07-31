import { describe, expect, it } from 'vitest';

import { buttonClassName } from './button';

describe('buttonClassName', () => {
  it('uses accessible brand button colors by default', () => {
    const className = buttonClassName();

    expect(className).toContain('bg-accent');
    expect(className).toContain('text-copy');
    expect(className).toContain('hover:text-white');
    expect(className).toContain('h-10');
  });

  it('applies the requested variant and size', () => {
    const className = buttonClassName({ variant: 'danger', size: 'large' });

    expect(className).toContain('bg-danger');
    expect(className).toContain('h-12');
  });
});
