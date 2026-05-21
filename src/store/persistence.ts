import {
  type RepositorySourceIdentity,
  serializeSourceIdentityForStorage,
} from '@/repository/source';

const STORAGE_PREFIX = 'repo-dungeon:v1';

function normalizeRepoToken(value: string): string {
  return encodeURIComponent(value.trim().toLowerCase());
}

function sourceKey(source: RepositorySourceIdentity): string {
  return serializeSourceIdentityForStorage(source);
}

function sourceScopedKey(namespace: string, source: RepositorySourceIdentity): string {
  return `${STORAGE_PREFIX}:${namespace}:${sourceKey(source)}`;
}

export const STORAGE_KEYS = {
  session: `${STORAGE_PREFIX}:session`,
  player: `${STORAGE_PREFIX}:player`,
  progression: `${STORAGE_PREFIX}:progression`,
  selectedSource: `${STORAGE_PREFIX}:source:selected`,
  dungeonForUser: (username: string): string => `${STORAGE_PREFIX}:dungeon:${username.toLowerCase()}`,
  dungeonForSource: (source: RepositorySourceIdentity): string => sourceScopedKey('dungeon', source),
  roomDetailForRepo: (owner: string, repo: string): string =>
    `${STORAGE_PREFIX}:room:${owner.toLowerCase()}:${repo.toLowerCase()}`,
  roomDetailForSourceRepo: (
    source: RepositorySourceIdentity,
    ownerOrNamespace: string,
    repo: string,
  ): string =>
    `${sourceScopedKey('room', source)}:${normalizeRepoToken(ownerOrNamespace)}:${normalizeRepoToken(repo)}`,
} as const;

export function getDungeonRestoreKeys(source: RepositorySourceIdentity): string[] {
  const keys = [STORAGE_KEYS.dungeonForSource(source)];
  if (source.kind === 'github') {
    keys.push(STORAGE_KEYS.dungeonForUser(source.username));
  }
  return keys;
}

export function getRoomDetailRestoreKeys(
  source: RepositorySourceIdentity,
  owner: string,
  repo: string,
): string[] {
  const keys = [STORAGE_KEYS.roomDetailForSourceRepo(source, owner, repo)];
  if (source.kind === 'github') {
    keys.push(STORAGE_KEYS.roomDetailForRepo(owner, repo));
  }
  return keys;
}
