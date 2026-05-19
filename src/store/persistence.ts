const STORAGE_PREFIX = 'repo-dungeon:v1';

export const STORAGE_KEYS = {
  session: `${STORAGE_PREFIX}:session`,
  player: `${STORAGE_PREFIX}:player`,
  progression: `${STORAGE_PREFIX}:progression`,
  dungeonForUser: (username: string): string => `${STORAGE_PREFIX}:dungeon:${username.toLowerCase()}`,
} as const;
