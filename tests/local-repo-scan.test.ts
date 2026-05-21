import { describe, expect, it } from 'vitest';
import { scanDirectoryHandleForGitRepos } from '@/localRepos/scan';

type FakeEntry = FakeDirectoryHandle | FakeFileHandle;

class FakeFileHandle {
  readonly kind = 'file' as const;

  constructor(
    public readonly name: string,
    private readonly content = '',
  ) {}

  getFile(): Promise<{ text: () => Promise<string> }> {
    const text = this.content;
    return Promise.resolve({
      text: () => Promise.resolve(text),
    });
  }
}

class FakeDirectoryHandle {
  readonly kind = 'directory' as const;

  constructor(
    public readonly name: string,
    private readonly children: Record<string, FakeEntry>,
  ) {}

  async *entries(): AsyncGenerator<[string, FakeEntry], void, void> {
    await Promise.resolve();
    for (const [name, child] of Object.entries(this.children)) {
      yield [name, child];
    }
  }
}

function file(name: string, content = ''): FakeFileHandle {
  return new FakeFileHandle(name, content);
}

function dir(name: string, children: Record<string, FakeEntry>): FakeDirectoryHandle {
  return new FakeDirectoryHandle(name, children);
}

describe('scanDirectoryHandleForGitRepos', () => {
  it('recursively discovers git repositories and ignores noisy folders', async () => {
    const root = dir('workspace', {
      'repo-a': dir('repo-a', {
        '.git': dir('.git', {
          HEAD: file('HEAD', 'ref: refs/heads/main\n'),
          config: file('config', '[remote "origin"]\n\turl = https://github.com/org/repo-a.git\n'),
        }),
        'README.md': file('README.md', '# repo-a\nHello local repo\n'),
        'package.json': file('package.json'),
        src: dir('src', {
          'index.ts': file('index.ts'),
        }),
        nested: dir('nested', {
          '.git': dir('.git', {}),
        }),
      }),
      plain: dir('plain', {
        'nested-repo': dir('nested-repo', {
          '.git': dir('.git', {
            HEAD: file('HEAD', 'ref: refs/heads/main\n'),
            config: file('config', '[remote "origin"]\n\turl = https://github.com/org/nested-repo.git\n'),
          }),
          'main.py': file('main.py'),
        }),
      }),
      node_modules: dir('node_modules', {
        package: dir('package', {
          '.git': dir('.git', {}),
        }),
      }),
    });

    const progressSnapshots: Array<{ phase: string; repos: number }> = [];
    const result = await scanDirectoryHandleForGitRepos({
      rootPathToken: 'fsa://workspace/token',
      rootLabel: 'workspace',
      rootHandle: root as unknown as FileSystemDirectoryHandle,
      onProgress: (progress) => {
        progressSnapshots.push({
          phase: progress.phase,
          repos: progress.discoveredRepositories,
        });
      },
    });

    expect(result.repositories.map((repo) => repo.relativePath).sort()).toEqual([
      'plain/nested-repo',
      'repo-a',
    ]);

    const repoA = result.repositories.find((repo) => repo.relativePath === 'repo-a');
    const nestedRepo = result.repositories.find((repo) => repo.relativePath === 'plain/nested-repo');
    expect(repoA?.relativeDirectoryPaths).toEqual(['src']);
    expect(repoA?.topLevelTree.some((entry) => entry.path === 'README.md' && entry.type === 'file')).toBe(true);
    expect(repoA?.readmePreview?.fileName).toBe('README.md');
    expect(nestedRepo?.relativeDirectoryPaths).toEqual([]);

    expect(result.repositories.some((repo) => repo.relativePath.includes('node_modules'))).toBe(false);
    expect(result.repositories).toHaveLength(2);
    expect(progressSnapshots.some((snapshot) => snapshot.phase === 'scanning')).toBe(true);
    expect(progressSnapshots.at(-1)).toEqual({ phase: 'completed', repos: 2 });
  });

  it('still discovers child repositories when the selected root is also a git repository', async () => {
    const root = dir('Projects', {
      '.git': dir('.git', {
        HEAD: file('HEAD', 'ref: refs/heads/main\n'),
        config: file('config', '[remote "origin"]\n\turl = https://github.com/org/Projects.git\n'),
      }),
      'README.md': file('README.md', '# Projects\n'),
      alpha: dir('alpha', {
        '.git': dir('.git', {
          HEAD: file('HEAD', 'ref: refs/heads/main\n'),
          config: file('config', '[remote "origin"]\n\turl = https://github.com/org/alpha.git\n'),
        }),
        'main.ts': file('main.ts'),
      }),
      beta: dir('beta', {
        '.git': dir('.git', {
          HEAD: file('HEAD', 'ref: refs/heads/main\n'),
          config: file('config', '[remote "origin"]\n\turl = https://github.com/org/beta.git\n'),
        }),
        'main.py': file('main.py'),
      }),
    });

    const result = await scanDirectoryHandleForGitRepos({
      rootPathToken: 'fsa://Projects/token',
      rootLabel: 'Projects',
      rootHandle: root as unknown as FileSystemDirectoryHandle,
    });

    expect(result.repositories.map((repo) => repo.relativePath || '.').sort()).toEqual([
      '.',
      'alpha',
      'beta',
    ]);
    const rootRepo = result.repositories.find((repo) => repo.relativePath === '');
    expect(rootRepo?.git.available).toBe(false);
  });
});