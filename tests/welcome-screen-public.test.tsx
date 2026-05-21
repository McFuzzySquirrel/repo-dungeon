import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WelcomeScreen } from '@/ui/components/WelcomeScreen';
import { useSessionStore } from '@/store/sessionStore';
import type { LocalRepoAccessState } from '@/localRepos/browserAccess';
import type { LocalSourceLoadResult, UseRepositorySourceResult } from '@/ui/hooks/useRepositorySource';
import type { UseGitHubDataResult } from '@/ui/hooks/useGitHubData';

type UseGitHubData = typeof import('@/ui/hooks/useGitHubData').useGitHubData;
type UseRepositorySource = typeof import('@/ui/hooks/useRepositorySource').useRepositorySource;

const { mockUseGitHubData } = vi.hoisted(() => ({
  mockUseGitHubData: vi.fn(),
}));

const { mockUseRepositorySource } = vi.hoisted(() => ({
  mockUseRepositorySource: vi.fn(),
}));

vi.mock('@/ui/hooks/useGitHubData', () => ({
  useGitHubData: (...args: Parameters<UseGitHubData>): ReturnType<UseGitHubData> =>
    mockUseGitHubData(...args) as ReturnType<UseGitHubData>,
}));

vi.mock('@/ui/hooks/useRepositorySource', () => ({
  useRepositorySource: (...args: Parameters<UseRepositorySource>): ReturnType<UseRepositorySource> =>
    mockUseRepositorySource(...args) as ReturnType<UseRepositorySource>,
}));

function makeData(overrides: Partial<UseGitHubDataResult> = {}): UseGitHubDataResult {
  return {
    status: 'idle',
    repos: [],
    errorMessage: null,
    progress: null,
    cacheAge: null,
    fetchRepos: vi.fn(() => Promise.resolve([])),
    ...overrides,
  };
}

function makeLocalAccess(overrides: Partial<LocalRepoAccessState> = {}): LocalRepoAccessState {
  return {
    isLocalRepoModeAvailable: true,
    environment: 'trusted-local-web',
    reason: null,
    ...overrides,
  };
}

function makeLocalLoadResult(): LocalSourceLoadResult {
  return {
    repos: [{
      id: 777,
      name: 'local-repo',
      fullName: 'workspace/local-repo',
      ownerLogin: 'workspace',
      description: 'Local repository',
      htmlUrl: 'file:///workspace/local-repo',
      language: 'TypeScript',
      stargazersCount: 0,
      forksCount: 0,
      topics: ['local'],
      isPrivate: true,
      defaultBranch: 'main',
    }],
    selection: {
      rootPathToken: 'electron://workspace',
      rootLabel: 'workspace',
      rootId: 'electron://workspace',
      pickedAt: new Date().toISOString(),
    },
  };
}

function makeRepositorySource(overrides: Partial<UseRepositorySourceResult> = {}): UseRepositorySourceResult {
  return {
    status: 'idle',
    selection: null,
    scanResult: null,
    scanProgress: null,
    cachedAt: null,
    roomCount: 0,
    errorMessage: null,
    hasCachedResults: false,
    pickAndScan: vi.fn(() => Promise.resolve(null)),
    scanCurrentSelection: vi.fn(() => Promise.resolve(null)),
    startFromCache: vi.fn(() => null),
    ...overrides,
  };
}

describe('WelcomeScreen public-only UX', () => {
  beforeEach(() => {
    useSessionStore.setState({ usernameInput: 'octocat', selectedSourceKind: 'github' });
    mockUseGitHubData.mockReturnValue(makeData());
    mockUseRepositorySource.mockReturnValue(makeRepositorySource());
  });

  it('renders the username input and load button', () => {
    render(
      <WelcomeScreen
        onStart={vi.fn()}
        onLoadAndStart={vi.fn()}
        onHelp={vi.fn()}
        localRepoAccess={makeLocalAccess()}
      />,
    );

    expect(screen.getByLabelText('GitHub username')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Load & Start/i })).toBeInTheDocument();
  });

  it('does not show a GitHub login button', () => {
    render(
      <WelcomeScreen
        onStart={vi.fn()}
        onLoadAndStart={vi.fn()}
        onHelp={vi.fn()}
        localRepoAccess={makeLocalAccess()}
      />,
    );

    expect(screen.queryByRole('button', { name: /Login with GitHub/i })).not.toBeInTheDocument();
  });

  it('shows loading state while fetching', () => {
    mockUseGitHubData.mockReturnValue(
      makeData({
        status: 'loading',
        progress: { page: 1, loadedCount: 50 },
      }),
    );

    render(
      <WelcomeScreen
        onStart={vi.fn()}
        onLoadAndStart={vi.fn()}
        onHelp={vi.fn()}
        localRepoAccess={makeLocalAccess()}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(/Fetching page 1 — 50 repos/i);
  });

  it('shows a cache hint when data was served from cache', () => {
    mockUseGitHubData.mockReturnValue(
      makeData({
        status: 'cache-hit',
        repos: [{ id: 1, name: 'test-repo', fullName: 'octocat/test-repo', ownerLogin: 'octocat', description: null, htmlUrl: '', language: null, stargazersCount: 0, forksCount: 0, topics: [], isPrivate: false, defaultBranch: 'main' }],
        cacheAge: new Date(Date.now() - 5 * 60_000).toISOString(), // 5 minutes ago
      }),
    );

    render(
      <WelcomeScreen
        onStart={vi.fn()}
        onLoadAndStart={vi.fn()}
        onHelp={vi.fn()}
        localRepoAccess={makeLocalAccess()}
      />,
    );

    expect(screen.getByText(/Cached/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument();
  });

  it('does not show a cache hint when there is no cached data', () => {
    mockUseGitHubData.mockReturnValue(makeData({ status: 'idle', cacheAge: null }));

    render(
      <WelcomeScreen
        onStart={vi.fn()}
        onLoadAndStart={vi.fn()}
        onHelp={vi.fn()}
        localRepoAccess={makeLocalAccess()}
      />,
    );

    expect(screen.queryByText(/Cached/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Refresh/i })).not.toBeInTheDocument();
  });

  it('shows error message on fetch failure', () => {
    mockUseGitHubData.mockReturnValue(
      makeData({
        status: 'error',
        errorMessage: 'GitHub API rate limit reached.',
      }),
    );

    render(
      <WelcomeScreen
        onStart={vi.fn()}
        onLoadAndStart={vi.fn()}
        onHelp={vi.fn()}
        localRepoAccess={makeLocalAccess()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('GitHub API rate limit reached.');
  });

  it('calls fetchRepos with forceRefresh when Refresh button is clicked', () => {
    const fetchRepos = vi.fn(() => Promise.resolve([]));
    mockUseGitHubData.mockReturnValue(
      makeData({
        status: 'cache-hit',
        repos: [],
        cacheAge: new Date(Date.now() - 60_000).toISOString(),
        fetchRepos,
      }),
    );

    render(
      <WelcomeScreen
        onStart={vi.fn()}
        onLoadAndStart={vi.fn()}
        onHelp={vi.fn()}
        localRepoAccess={makeLocalAccess()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));
    expect(fetchRepos).toHaveBeenCalledWith('octocat', { forceRefresh: true });
  });

  it('disables local repository source on hosted builds with explanation', () => {
    render(
      <WelcomeScreen
        onStart={vi.fn()}
        onLoadAndStart={vi.fn()}
        onHelp={vi.fn()}
        localRepoAccess={makeLocalAccess({
          isLocalRepoModeAvailable: false,
          environment: 'hosted-web',
          reason: 'Local repository mode is disabled on hosted builds.',
        })}
      />,
    );

    const localOption = screen.getByRole('radio', { name: /Local repositories/i });
    expect(localOption).toBeDisabled();
    expect(screen.getByText(/disabled on hosted builds/i)).toBeInTheDocument();
  });

  it('shows local mode panel when local source is selected and available', () => {
    useSessionStore.setState({ selectedSourceKind: 'local' });

    render(
      <WelcomeScreen
        onStart={vi.fn()}
        onLoadAndStart={vi.fn()}
        onHelp={vi.fn()}
        localRepoAccess={makeLocalAccess()}
      />,
    );

    expect(screen.getByLabelText('Local repository mode')).toBeInTheDocument();
    expect(screen.getByText(/view and copy files/i)).toBeInTheDocument();
    expect(screen.getByText(/does not copy or upload your repository files/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('GitHub username')).not.toBeInTheDocument();
  });

  it('starts local dungeon from cached scan results', () => {
    useSessionStore.setState({ selectedSourceKind: 'local' });
    const loadResult = makeLocalLoadResult();
    const onLoadLocalAndStart = vi.fn();
    mockUseRepositorySource.mockReturnValue(
      makeRepositorySource({
        status: 'ready',
        selection: loadResult.selection,
        hasCachedResults: true,
        roomCount: 1,
        startFromCache: vi.fn(() => loadResult),
      }),
    );

    render(
      <WelcomeScreen
        onStart={vi.fn()}
        onLoadAndStart={vi.fn()}
        onLoadLocalAndStart={onLoadLocalAndStart}
        onHelp={vi.fn()}
        localRepoAccess={makeLocalAccess()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Start from Cached Scan/i }));

    expect(onLoadLocalAndStart).toHaveBeenCalledWith(loadResult.repos, loadResult.selection);
  });

  it('starts local dungeon after choosing parent folder and scanning', async () => {
    useSessionStore.setState({ selectedSourceKind: 'local' });
    const loadResult = makeLocalLoadResult();
    const onLoadLocalAndStart = vi.fn();
    const pickAndScan = vi.fn(() => Promise.resolve(loadResult));
    mockUseRepositorySource.mockReturnValue(
      makeRepositorySource({
        status: 'idle',
        pickAndScan,
      }),
    );

    render(
      <WelcomeScreen
        onStart={vi.fn()}
        onLoadAndStart={vi.fn()}
        onLoadLocalAndStart={onLoadLocalAndStart}
        onHelp={vi.fn()}
        localRepoAccess={makeLocalAccess()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Choose Folder & Start/i }));

    expect(pickAndScan).toHaveBeenCalledTimes(1);
    await screen.findByLabelText('Local repository mode');
    expect(onLoadLocalAndStart).toHaveBeenCalledWith(loadResult.repos, loadResult.selection);
  });

  it('shows local scan progress while scanning a parent folder', () => {
    useSessionStore.setState({ selectedSourceKind: 'local' });
    mockUseRepositorySource.mockReturnValue(
      makeRepositorySource({
        status: 'scanning',
        scanProgress: {
          phase: 'scanning',
          scannedDirectories: 7,
          discoveredRepositories: 2,
          currentPath: 'workspace/packages/ui',
        },
      }),
    );

    render(
      <WelcomeScreen
        onStart={vi.fn()}
        onLoadAndStart={vi.fn()}
        onHelp={vi.fn()}
        localRepoAccess={makeLocalAccess()}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      /Scanned 7 folders • Found 2 repos • workspace\/packages\/ui/i,
    );
  });

  it('switches to local source when available without removing github option', () => {
    render(
      <WelcomeScreen
        onStart={vi.fn()}
        onLoadAndStart={vi.fn()}
        onHelp={vi.fn()}
        localRepoAccess={makeLocalAccess({ isLocalRepoModeAvailable: true })}
      />, 
    );

    fireEvent.click(screen.getByRole('radio', { name: /Local repositories/i }));

    expect(useSessionStore.getState().selectedSourceKind).toBe('local');
    expect(screen.getByRole('radio', { name: /GitHub \(existing flow\)/i })).toBeInTheDocument();
    expect(screen.queryByLabelText('GitHub username')).not.toBeInTheDocument();
  });

  it('does not switch to local source when disabled', () => {
    render(
      <WelcomeScreen
        onStart={vi.fn()}
        onLoadAndStart={vi.fn()}
        onHelp={vi.fn()}
        localRepoAccess={makeLocalAccess({
          isLocalRepoModeAvailable: false,
          environment: 'hosted-web',
          reason: 'Local repository mode is disabled on hosted builds.',
        })}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: /Local repositories/i }));

    expect(useSessionStore.getState().selectedSourceKind).toBe('github');
    expect(screen.getByLabelText('GitHub username')).toBeInTheDocument();
  });
});
