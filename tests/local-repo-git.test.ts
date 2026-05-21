import { describe, expect, it } from 'vitest';
import { readGitMetadata, type GitCommandRunner } from '@/localRepos/git';

describe('readGitMetadata', () => {
  it('returns graceful fallback metadata when git CLI is unavailable', async () => {
    const unavailableRunner: GitCommandRunner = {
      run: () => Promise.reject(new Error('git missing')),
    };

    const metadata = await readGitMetadata('/tmp/repo', unavailableRunner);

    expect(metadata.available).toBe(false);
    expect(metadata.branch).toBeNull();
    expect(metadata.unavailableReason).toMatch(/git cli is not available/i);
  });

  it('extracts git metadata when git CLI commands succeed', async () => {
    const runner: GitCommandRunner = {
      run: (args) => {
        const command = args.join(' ');
        if (command === '--version') {
          return Promise.resolve({ stdout: 'git version 2.45.0', stderr: '' });
        }
        if (command === 'rev-parse --abbrev-ref HEAD') {
          return Promise.resolve({ stdout: 'main\n', stderr: '' });
        }
        if (command === 'remote -v') {
          return Promise.resolve({ stdout: 'origin\thttps://github.com/org/repo.git (fetch)\n', stderr: '' });
        }
        if (command === 'rev-list --count HEAD') {
          return Promise.resolve({ stdout: '42\n', stderr: '' });
        }
        if (command === 'log -1 --format=%cI') {
          return Promise.resolve({ stdout: '2026-05-21T12:30:00Z\n', stderr: '' });
        }
        if (command === 'status --porcelain') {
          return Promise.resolve({ stdout: ' M src/index.ts\n', stderr: '' });
        }
        if (command === 'shortlog -s -n --all') {
          return Promise.resolve({ stdout: '   10\tAlice\n    3\tBob\n', stderr: '' });
        }
        return Promise.reject(new Error(`Unexpected command: ${command}`));
      },
    };

    const metadata = await readGitMetadata('/tmp/repo', runner);

    expect(metadata.available).toBe(true);
    expect(metadata.branch).toBe('main');
    expect(metadata.remotes).toHaveLength(1);
    expect(metadata.commitCount).toBe(42);
    expect(metadata.lastCommitAt).toBe('2026-05-21T12:30:00Z');
    expect(metadata.isDirty).toBe(true);
    expect(metadata.contributorCount).toBe(2);
    expect(metadata.unavailableReason).toBeNull();
  });
});