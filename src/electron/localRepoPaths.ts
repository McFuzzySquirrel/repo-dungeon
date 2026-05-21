import path from 'node:path';

export interface LocalPreferredEditorConfigInput {
  command: string;
  args?: string[];
}

export function sanitizeRelativePathToken(input: string): string | null {
  const normalized = input.replace(/\\+/gu, '/').trim();
  if (normalized.includes('\0')) {
    return null;
  }

  if (normalized === '' || normalized === '.') {
    return '';
  }

  if (normalized.startsWith('/')) {
    return null;
  }

  const parts = normalized.split('/');
  const cleanParts: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') {
      continue;
    }
    if (part === '..') {
      return null;
    }
    cleanParts.push(part);
  }

  return cleanParts.join('/');
}

function isWithinBase(basePath: string, absolutePath: string): boolean {
  const relative = path.relative(basePath, absolutePath);
  if (!relative) {
    return true;
  }
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function resolvePathWithinBase(basePath: string, token: string): string | null {
  const sanitized = sanitizeRelativePathToken(token);
  if (sanitized === null) {
    return null;
  }

  const resolved = path.resolve(basePath, sanitized || '.');
  if (!isWithinBase(basePath, resolved)) {
    return null;
  }

  return resolved;
}

export function sanitizePreferredEditorConfig(
  config: LocalPreferredEditorConfigInput | null | undefined,
): LocalPreferredEditorConfigInput | null {
  if (!config) {
    return null;
  }

  const command = config.command.trim();
  if (!command || command.includes('\0')) {
    return null;
  }

  const args = (config.args ?? []).filter((arg) => typeof arg === 'string' && !arg.includes('\0'));
  return {
    command,
    args,
  };
}
