import { describe, expect, it } from 'vitest';
import {
  getLocalPathTokenParent,
  sanitizeLocalPathToken,
  splitLocalPathToken,
} from '@/localRepos/pathTokens';

describe('local repo path token helpers', () => {
  it('sanitizes repository-relative tokens and rejects traversal attempts', () => {
    expect(sanitizeLocalPathToken('src/components')).toBe('src/components');
    expect(sanitizeLocalPathToken('src\\components')).toBe('src/components');
    expect(sanitizeLocalPathToken('./src//components')).toBe('src/components');

    expect(sanitizeLocalPathToken('../secrets')).toBeNull();
    expect(sanitizeLocalPathToken('/etc/passwd')).toBeNull();
    expect(sanitizeLocalPathToken('..\\secrets')).toBeNull();
  });

  it('returns stable segments and parent tokens', () => {
    expect(splitLocalPathToken('src/components')).toEqual(['src', 'components']);
    expect(getLocalPathTokenParent('src/components')).toBe('src');
    expect(getLocalPathTokenParent('src')).toBe('');
    expect(getLocalPathTokenParent('')).toBeNull();
  });
});
