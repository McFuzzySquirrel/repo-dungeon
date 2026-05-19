export interface ShareableDungeonState {
  username: string;
  seed?: string;
  roomId?: string;
  level?: number;
  badgeCount?: number;
}

interface EncodedSharePayload {
  seed?: string;
  roomId?: string;
  level?: number;
  badgeCount?: number;
}

function toBase64Url(value: string): string {
  const base64 = btoa(value);
  return base64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function fromBase64Url(value: string): string {
  const padded = value.padEnd(Math.ceil(value.length / 4) * 4, '=').replaceAll('-', '+').replaceAll('_', '/');
  return atob(padded);
}

export function encodeShareableDungeonUrl(state: ShareableDungeonState, baseUrl: string): string {
  const trimmedUser = state.username.trim();
  if (!trimmedUser) {
    throw new Error('Username is required to build a share URL.');
  }

  const url = new URL(baseUrl);
  url.searchParams.set('user', trimmedUser);

  const payload: EncodedSharePayload = {};
  if (state.seed) {
    payload.seed = state.seed;
  }
  if (state.roomId) {
    payload.roomId = state.roomId;
  }
  if (state.level && state.level > 1) {
    payload.level = state.level;
  }
  if (state.badgeCount && state.badgeCount > 0) {
    payload.badgeCount = state.badgeCount;
  }

  if (Object.keys(payload).length > 0) {
    url.searchParams.set('dungeon', toBase64Url(JSON.stringify(payload)));
  } else {
    url.searchParams.delete('dungeon');
  }

  return url.toString();
}

export function decodeShareableDungeonUrl(urlValue: string): ShareableDungeonState | null {
  const url = new URL(urlValue);
  const username = url.searchParams.get('user')?.trim();
  if (!username) {
    return null;
  }

  const encodedPayload = url.searchParams.get('dungeon');
  if (!encodedPayload) {
    return { username };
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as EncodedSharePayload;
    return {
      username,
      seed: payload.seed,
      roomId: payload.roomId,
      level: payload.level,
      badgeCount: payload.badgeCount,
    };
  } catch {
    return { username };
  }
}
