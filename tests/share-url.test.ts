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

  it('rejects invalid usernames that could represent filesystem paths', () => {
    expect(() =>
      encodeShareableDungeonUrl(
        {
          username: '/home/user/workspace',
          seed: 'abc123',
        },
        'https://repodungeon.app/play',
      ),
    ).toThrow(/valid github username/i);

    expect(decodeShareableDungeonUrl('https://repodungeon.app/play?user=/home/user/workspace')).toBeNull();
  });

  it('drops room ids that resemble local filesystem paths', () => {
    const encoded = encodeShareableDungeonUrl(
      {
        username: 'octocat',
        seed: 'abc123',
        roomId: 'room/repo-a/src',
      },
      'https://repodungeon.app/play',
    );

    const decoded = decodeShareableDungeonUrl(encoded);
    expect(decoded).toEqual({
      username: 'octocat',
      seed: 'abc123',
    });
    expect(encoded).not.toContain('/home/');
  });

  it('ignores unknown dungeon payload keys that may contain local path tokens', () => {
    const payload = btoa(
      JSON.stringify({
        seed: 'abc123',
        rootPathToken: 'electron://root-token',
        absolutePath: '/home/user/workspace/repo-a',
      }),
    )
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/u, '');

    const decoded = decodeShareableDungeonUrl(`https://repodungeon.app/play?user=octocat&dungeon=${payload}`);

    expect(decoded).toEqual({
      username: 'octocat',
      seed: 'abc123',
    });
  });
});
