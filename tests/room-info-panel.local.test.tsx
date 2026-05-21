import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RoomInfoPanel } from '@/ui/components/RoomInfoPanel';
import { GameContextProvider } from '@/ui/context/GameContext';
import type { GitHubRoomData } from '@/github/types';

const mocks = vi.hoisted(() => ({
  loadRoomData: vi.fn(),
  loadReadme: vi.fn(),
  loadContributors: vi.fn(),
  openPath: vi.fn(),
  loadLocalReadme: vi.fn(),
  loadLocalSourceSelection: vi.fn(),
  loadLocalScanCache: vi.fn(),
}));

vi.mock('@/github/api', () => ({
  createGitHubApiClient: vi.fn(() => ({
    loadRoomData: mocks.loadRoomData,
    loadReadme: mocks.loadReadme,
    loadContributors: mocks.loadContributors,
  })),
  GitHubApiClient: vi.fn(),
  GitHubApiError: class GitHubApiError extends Error {
    details: { message: string; kind: string };

    constructor(details: { message: string; kind: string }) {
      super(details.message);
      this.details = details;
    }
  },
}));

vi.mock('@/github/cache', () => ({
  isRoomDetailFresh: vi.fn(() => false),
  loadCachedRoomDetail: vi.fn(() => null),
  saveCachedRoomDetail: vi.fn(),
  touchCachedRoomDetailFreshness: vi.fn(),
}));

vi.mock('@/ui/systems/VisitedStamps', () => ({
  getVisitedStampsSystem: vi.fn(() => ({
    addVisitedRoom: vi.fn(),
    getVisitedRooms: vi.fn(() => []),
  })),
}));

vi.mock('@/localRepos/cache', () => ({
  loadLocalSourceSelection: mocks.loadLocalSourceSelection,
  loadLocalScanCache: mocks.loadLocalScanCache,
}));

vi.mock('@/localRepos/electronAccess', () => ({
  electronLocalRepoAccess: {
    openPath: mocks.openPath,
    loadReadme: mocks.loadLocalReadme,
  },
  isElectronLocalRepoAccessAvailable: vi.fn(() => true),
}));

vi.mock('@/localRepos/browserAccess', () => ({
  getLocalRepoAccessState: vi.fn(() => ({
    isLocalRepoModeAvailable: true,
    environment: 'electron',
    reason: null,
  })),
  trustedLocalBrowserAccess: {
    openPath: vi.fn(),
  },
}));

class MockEmitter {
  private handlers = new Map<string, Array<(...args: unknown[]) => void>>();

  on(event: string, callback: (...args: unknown[]) => void) {
    const list = this.handlers.get(event) ?? [];
    list.push(callback);
    this.handlers.set(event, list);
  }

  off(event: string, callback: (...args: unknown[]) => void) {
    const list = this.handlers.get(event) ?? [];
    this.handlers.set(event, list.filter((entry) => entry !== callback));
  }

  emit(event: string, payload: unknown) {
    const list = this.handlers.get(event) ?? [];
    for (const callback of list) {
      callback(payload);
    }
  }
}

function makeMockGame(events: MockEmitter) {
  return {
    scene: {
      getScene: (name: string) => {
        if (name !== 'DungeonScene') {
          return null;
        }

        return {
          getDungeon: () => null,
          getPlayer: () => null,
          getCurrentRoom: () => null,
          events,
        };
      },
    },
  };
}

describe('RoomInfoPanel local integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mocks.openPath.mockResolvedValue({
      ok: true,
      mode: 'system-default',
      fallbackUsed: false,
      message: null,
    });
    mocks.loadLocalReadme.mockResolvedValue({
      readme: {
        fileName: 'README.md',
        plainText: 'Full local README content from on-demand load.\nSecond paragraph.',
        truncated: false,
      },
      unavailableReason: null,
    });

    mocks.loadLocalSourceSelection.mockReturnValue({
      rootPathToken: 'electron://root-token',
      rootLabel: 'workspace',
      rootId: 'root-1',
      pickedAt: '2026-05-21T00:00:00.000Z',
    });
    mocks.loadLocalScanCache.mockReturnValue({
      schemaVersion: 1,
      cachedAt: '2026-05-21T01:00:00.000Z',
      source: {
        rootPathToken: 'electron://root-token',
        rootLabel: 'workspace',
        rootId: 'root-1',
        pickedAt: '2026-05-21T00:00:00.000Z',
      },
      scan: {
        rootPathToken: 'electron://root-token',
        rootLabel: 'workspace',
        scannedAt: '2026-05-21T01:00:00.000Z',
        ignoredFolders: ['.git', 'node_modules', 'dist', 'build', '.next', 'coverage'],
        repositories: [
          {
            rootPathToken: 'electron://root-token',
            rootLabel: 'workspace',
            absolutePath: '/home/user/workspace/repo-a',
            relativePath: 'repo-a',
            relativeDirectoryPaths: ['src', 'src/components', 'node_modules/cache'],
            name: 'repo-a',
            discoveredAt: '2026-05-21T01:00:00.000Z',
            fileCount: 42,
            directoryCount: 11,
            topLevelTree: [
              { path: 'README.md', type: 'file' },
              { path: 'src', type: 'dir' },
            ],
            readmePreview: {
              fileName: 'README.md',
              plainText: 'Local repository readme preview.',
              truncated: false,
            },
            languageBreakdown: { TypeScript: 20, JavaScript: 5 },
            filesystem: {
              hasReadme: true,
              hasLicense: true,
              hasPackageJson: true,
              hasTsConfig: true,
              hasPyProject: false,
            },
            git: {
              available: true,
              branch: 'main',
              remotes: ['origin\thttps://github.com/org/repo-a.git (fetch)'],
              commitCount: 14,
              lastCommitAt: '2026-05-20T20:10:00.000Z',
              isDirty: false,
              contributorCount: 3,
              unavailableReason: null,
            },
          },
        ],
      },
    });
  });

  it('renders local room data, basement explorer, and opens local paths via access API', async () => {
    localStorage.setItem('repo-dungeon:v1:source:selected', 'local:root-1');

    const events = new MockEmitter();
    const game = makeMockGame(events);

    render(
      <GameContextProvider game={game as never}>
        <RoomInfoPanel />
      </GameContextProvider>,
    );

    act(() => {
      events.emit('roomEntered', {
        roomId: 'room:repo:1',
        roomType: 'repo',
        roomName: 'repo-a',
        repo: {
          id: 1,
          name: 'repo-a',
          fullName: 'workspace/repo-a',
          owner: 'workspace',
          ownerLogin: 'workspace',
          htmlUrl: 'file:///home/user/workspace/repo-a',
          topics: ['local'],
          defaultBranch: 'main',
        },
      });
    });

    expect(await screen.findByText('Open Repository')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Visit .* on GitHub/i })).not.toBeInTheDocument();
    expect(screen.getByText('Files 42')).toBeInTheDocument();
    expect(screen.getByText('Folders 11')).toBeInTheDocument();
    expect(screen.getByText('Commits 14')).toBeInTheDocument();
    expect(screen.getByText('Branch main')).toBeInTheDocument();
    expect(screen.getByText('Contributors: 3')).toBeInTheDocument();
    expect(screen.getByText('README: Present')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Readme' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Files' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Contributors' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Open Repository'));

    await waitFor(() => {
      expect(mocks.openPath).toHaveBeenCalledWith(
        expect.objectContaining({
          rootPathToken: 'electron://root-token',
          repositoryPathToken: 'repo-a',
          targetPathToken: '',
          mode: 'system-default',
        }),
      );
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Files' }));

    expect(await screen.findByText('README.md')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Explore src' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Explore cache' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Readme' }));

    expect(await screen.findByText('Local repository readme preview.')).toBeInTheDocument();
    mocks.loadLocalReadme.mockResolvedValueOnce({
      readme: {
        fileName: 'README.md',
        plainText: `${'a'.repeat(1100)} FULL_README_SENTINEL`,
        truncated: false,
      },
      unavailableReason: null,
    });
    fireEvent.click(screen.getByRole('button', { name: /Load Full README/i }));

    await waitFor(() => {
      expect(mocks.loadLocalReadme).toHaveBeenCalledWith({
        rootPathToken: 'electron://root-token',
        repositoryPathToken: 'repo-a',
      });
    });
    expect(await screen.findByText(/FULL_README_SENTINEL/i)).toBeInTheDocument();
  });

  it('shows generic local launch failure messaging without exposing backend error details', async () => {
    localStorage.setItem('repo-dungeon:v1:source:selected', 'local:root-1');
    mocks.openPath.mockResolvedValue({
      ok: false,
      mode: 'system-default',
      fallbackUsed: false,
      message: 'EACCES: /home/user/private/project/.env',
    });

    const events = new MockEmitter();
    const game = makeMockGame(events);

    render(
      <GameContextProvider game={game as never}>
        <RoomInfoPanel />
      </GameContextProvider>,
    );

    act(() => {
      events.emit('roomEntered', {
        roomId: 'room:repo:2',
        roomType: 'repo',
        roomName: 'repo-a',
        repo: {
          id: 2,
          name: 'repo-a',
          fullName: 'workspace/repo-a',
          owner: 'workspace',
          ownerLogin: 'workspace',
          htmlUrl: 'file:///home/user/workspace/repo-a',
          topics: ['local'],
          defaultBranch: 'main',
        },
      });
    });

    fireEvent.click(await screen.findByText('Open Repository'));

    expect(await screen.findByText('Unable to open the selected path.')).toBeInTheDocument();
    expect(screen.queryByText(/EACCES:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\/home\/user\/private/i)).not.toBeInTheDocument();
  });

  it('keeps GitHub room panel behavior for non-local rooms', async () => {
    const events = new MockEmitter();
    const game = makeMockGame(events);

    const githubData: GitHubRoomData = {
      repo: {
        id: 10,
        name: 'repo-b',
        fullName: 'octo/repo-b',
        ownerLogin: 'octo',
        description: 'GitHub room',
        htmlUrl: 'https://github.com/octo/repo-b',
        language: 'TypeScript',
        stargazersCount: 9,
        forksCount: 2,
        topics: ['game'],
        isPrivate: false,
        defaultBranch: 'main',
      },
      readme: { plainText: 'hello', truncated: false },
      languages: { TypeScript: 100 },
      topLevelTree: [{ path: 'src', type: 'dir' }],
      treeTruncated: false,
      contributors: [],
      unavailable: [],
    };

    mocks.loadRoomData.mockResolvedValue({
      data: githubData,
      etags: {},
      fullyRevalidated: false,
    });

    render(
      <GameContextProvider game={game as never}>
        <RoomInfoPanel />
      </GameContextProvider>,
    );

    act(() => {
      events.emit('roomEntered', {
        roomId: 'room:repo:10',
        roomType: 'repo',
        roomName: 'repo-b',
        repo: {
          id: 10,
          name: 'repo-b',
          fullName: 'octo/repo-b',
          owner: 'octo',
          ownerLogin: 'octo',
          defaultBranch: 'main',
          htmlUrl: 'https://github.com/octo/repo-b',
          stargazersCount: 9,
          forksCount: 2,
          topics: ['game'],
          isPrivate: false,
        },
      });
    });

    await waitFor(() => {
      expect(mocks.loadRoomData).toHaveBeenCalled();
    });

    expect(await screen.findByRole('link', { name: /Visit octo\/repo-b on GitHub/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Readme' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Files' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Contributors' })).toBeInTheDocument();
  });
});
