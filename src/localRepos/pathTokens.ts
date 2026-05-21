import type { LocalPathToken } from '@/localRepos/types';

function normalizeSeparators(value: string): string {
  return value.replace(/\\+/gu, '/').trim();
}

export function sanitizeLocalPathToken(input: string): LocalPathToken | null {
  const normalized = normalizeSeparators(input);
  if (normalized.includes('\0')) {
    return null;
  }

  if (normalized === '' || normalized === '.') {
    return '';
  }

  if (normalized.startsWith('/')) {
    return null;
  }

  const segments = normalized.split('/');
  const cleanSegments: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === '.') {
      continue;
    }

    if (segment === '..') {
      return null;
    }

    cleanSegments.push(segment);
  }

  return cleanSegments.join('/');
}

export function splitLocalPathToken(pathToken: LocalPathToken): string[] {
  if (!pathToken) {
    return [];
  }
  return pathToken.split('/').filter((segment) => segment.length > 0);
}

export function getLocalPathTokenParent(pathToken: LocalPathToken): LocalPathToken | null {
  const segments = splitLocalPathToken(pathToken);
  if (segments.length === 0) {
    return null;
  }
  if (segments.length === 1) {
    return '';
  }
  return segments.slice(0, -1).join('/');
}
