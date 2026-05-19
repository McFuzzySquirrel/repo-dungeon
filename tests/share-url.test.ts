import { describe, expect, it } from 'vitest';
import { decodeShareableDungeonUrl, encodeShareableDungeonUrl } from '@/ui/systems/shareUrl';

describe('share URL helpers', () => {
  it('encodes username and optional dungeon payload', () => {
    const encoded = encodeShareableDungeonUrl(
      {
        username: 'octocat',
        seed: 'abc123',
        roomId: 'room:repo:4',
      },
      'https://repodungeon.app/play',
    );

    const decoded = decodeShareableDungeonUrl(encoded);
    expect(decoded).toEqual({
      username: 'octocat',
      seed: 'abc123',
      roomId: 'room:repo:4',
    });
  });

  it('decodes user-only links', () => {
    const decoded = decodeShareableDungeonUrl('https://repodungeon.app/play?user=octocat');
    expect(decoded).toEqual({
      username: 'octocat',
    });
  });

  it('returns null if user param is missing', () => {
    expect(decodeShareableDungeonUrl('https://repodungeon.app/play')).toBeNull();
  });
});
