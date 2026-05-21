import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { LocalGitMetadata } from '@/localRepos/types';

const execFileAsync = promisify(execFile);

export interface GitCommandRunner {
  run: (args: string[], cwd?: string) => Promise<{ stdout: string; stderr: string }>;
}

export function createGitCommandRunner(): GitCommandRunner {
  return {
    run: async (args, cwd) => execFileAsync('git', args, { cwd }),
  };
}

function parseRemotes(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseCommitCount(raw: string): number | null {
  const value = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(value) ? value : null;
}

function parseContributorCount(raw: string): number | null {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return 0;
  }
  return lines.length;
}

export async function isGitCliAvailable(runner: GitCommandRunner = createGitCommandRunner()): Promise<boolean> {
  try {
    await runner.run(['--version']);
    return true;
  } catch {
    return false;
  }
}

export async function readGitMetadata(
  repositoryPath: string,
  runner: GitCommandRunner = createGitCommandRunner(),
): Promise<LocalGitMetadata> {
  const available = await isGitCliAvailable(runner);
  if (!available) {
    return {
      available: false,
      branch: null,
      remotes: [],
      commitCount: null,
      lastCommitAt: null,
      isDirty: null,
      contributorCount: null,
      unavailableReason: 'git CLI is not available on this machine.',
    };
  }

  const metadata: LocalGitMetadata = {
    available: true,
    branch: null,
    remotes: [],
    commitCount: null,
    lastCommitAt: null,
    isDirty: null,
    contributorCount: null,
    unavailableReason: null,
  };

  const settle = async <T>(producer: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await producer();
    } catch {
      return fallback;
    }
  };

  metadata.branch = await settle(async () => {
    const { stdout } = await runner.run(['rev-parse', '--abbrev-ref', 'HEAD'], repositoryPath);
    const branch = stdout.trim();
    return branch || null;
  }, null as string | null);

  metadata.remotes = await settle(async () => {
    const { stdout } = await runner.run(['remote', '-v'], repositoryPath);
    return parseRemotes(stdout);
  }, [] as string[]);

  metadata.commitCount = await settle(async () => {
    const { stdout } = await runner.run(['rev-list', '--count', 'HEAD'], repositoryPath);
    return parseCommitCount(stdout);
  }, null as number | null);

  metadata.lastCommitAt = await settle(async () => {
    const { stdout } = await runner.run(['log', '-1', '--format=%cI'], repositoryPath);
    const value = stdout.trim();
    return value || null;
  }, null as string | null);

  metadata.isDirty = await settle(async () => {
    const { stdout } = await runner.run(['status', '--porcelain'], repositoryPath);
    return stdout.trim().length > 0;
  }, null as boolean | null);

  metadata.contributorCount = await settle(async () => {
    const { stdout } = await runner.run(['shortlog', '-s', '-n', '--all'], repositoryPath);
    return parseContributorCount(stdout);
  }, null as number | null);

  return metadata;
}