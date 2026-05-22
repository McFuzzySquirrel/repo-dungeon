import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { LocalGitContributor, LocalGitMetadata } from '@/localRepos/types';

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
  const contributors = parseContributors(raw);
  return contributors.length;
}

function parseContributors(raw: string): LocalGitContributor[] {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const contributors: LocalGitContributor[] = [];
  for (const line of lines) {
    const match = line.match(/^(\d+)\s+(.+?)(?:\s+<([^>]+)>)?$/u);
    if (!match) {
      continue;
    }

    const commitCount = Number.parseInt(match[1] ?? '', 10);
    if (!Number.isFinite(commitCount)) {
      continue;
    }

    contributors.push({
      commitCount,
      name: match[2]?.trim() ?? 'Unknown',
      email: match[3]?.trim() ?? null,
    });
  }
  return contributors;
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
      contributors: [],
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
    contributors: [],
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

  const contributorsRaw = await settle(async () => {
    const { stdout } = await runner.run(['shortlog', '-s', '-n', '-e', '--all'], repositoryPath);
    return stdout;
  }, null as string | null);

  if (contributorsRaw !== null) {
    metadata.contributors = parseContributors(contributorsRaw);
    metadata.contributorCount = parseContributorCount(contributorsRaw);
  }

  return metadata;
}