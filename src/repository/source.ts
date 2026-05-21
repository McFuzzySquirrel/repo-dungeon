export type SourceKind = 'github' | 'local';

export interface GitHubSourceIdentity {
  kind: 'github';
  username: string;
}

/**
 * Opaque machine-local identifier for a selected local source root.
 * The value should be deterministic for the same selected root on the same machine.
 */
export interface LocalSourceIdentity {
  kind: 'local';
  rootId: string;
}

export type RepositorySourceIdentity = GitHubSourceIdentity | LocalSourceIdentity;

function normalizeToken(value: string): string {
  return encodeURIComponent(value.trim().toLowerCase());
}

export function buildLocalSourceRootId(input: string): string {
  return input.trim().toLowerCase();
}

export function serializeSourceIdentityForStorage(source: RepositorySourceIdentity): string {
  if (source.kind === 'github') {
    return `${source.kind}:${normalizeToken(source.username)}`;
  }
  return `${source.kind}:${normalizeToken(source.rootId)}`;
}

export function parseSourceIdentityFromStorage(
  serialized: string,
): RepositorySourceIdentity | null {
  const [kind, ...rest] = serialized.split(':');
  if (!kind || rest.length === 0) {
    return null;
  }

  let payload = '';
  try {
    payload = decodeURIComponent(rest.join(':'));
  } catch {
    return null;
  }
  if (!payload) {
    return null;
  }

  if (kind === 'github') {
    return { kind: 'github', username: payload };
  }
  if (kind === 'local') {
    return { kind: 'local', rootId: payload };
  }
  return null;
}
