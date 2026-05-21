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

const GITHUB_USERNAME_PATTERN = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/iu;
const SHARE_ROOM_ID_PATTERN = /^[a-z\d:_-]+$/iu;

function isValidGitHubUsername(value: string): boolean {
  return GITHUB_USERNAME_PATTERN.test(value);
}

function isSafeShareRoomId(value: string): boolean {
  if (!SHARE_ROOM_ID_PATTERN.test(value)) {
    return false;
  }

  const lowered = value.toLowerCase();
  return !lowered.includes('file:') && !value.includes('..');
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
  if (!trimmedUser || !isValidGitHubUsername(trimmedUser)) {
    throw new Error('A valid GitHub username is required to build a share URL.');
  }

  const url = new URL(baseUrl);
  url.searchParams.set('user', trimmedUser);

  const payload: EncodedSharePayload = {};
  if (state.seed) {
    payload.seed = state.seed;
  }
  if (state.roomId && isSafeShareRoomId(state.roomId)) {
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
  if (!username || !isValidGitHubUsername(username)) {
    return null;
  }

  const encodedPayload = url.searchParams.get('dungeon');
  if (!encodedPayload) {
    return { username };
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as EncodedSharePayload;
    const decodedRoomId = payload.roomId;

    return {
      username,
      seed: payload.seed,
      roomId: decodedRoomId && isSafeShareRoomId(decodedRoomId) ? decodedRoomId : undefined,
      level: payload.level,
      badgeCount: payload.badgeCount,
    };
  } catch {
    return { username };
  }
}
