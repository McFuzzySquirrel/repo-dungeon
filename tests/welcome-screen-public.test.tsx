import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WelcomeScreen } from '@/ui/components/WelcomeScreen';
import { useSessionStore } from '@/store/sessionStore';
import type { UseGitHubDataResult } from '@/ui/hooks/useGitHubData';

type UseGitHubData = typeof import('@/ui/hooks/useGitHubData').useGitHubData;

const { mockUseGitHubData } = vi.hoisted(() => ({
  mockUseGitHubData: vi.fn(),
}));

vi.mock('@/ui/hooks/useGitHubData', () => ({
  useGitHubData: (...args: Parameters<UseGitHubData>): ReturnType<UseGitHubData> =>
    mockUseGitHubData(...args) as ReturnType<UseGitHubData>,
}));

function makeData(overrides: Partial<UseGitHubDataResult> = {}): UseGitHubDataResult {
  return {
    status: 'idle',
    repos: [],
    errorMessage: null,
    progress: null,
    cacheAge: null,
    fetchRepos: vi.fn(async () => []),
    ...overrides,
  };
}

describe('WelcomeScreen public-only UX', () => {
  beforeEach(() => {
    useSessionStore.setState({ usernameInput: 'octocat' });
    mockUseGitHubData.mockReturnValue(makeData());
  });

  it('renders the username input and load button', () => {
    render(
      <WelcomeScreen onStart={vi.fn()} onLoadAndStart={vi.fn()} onHelp={vi.fn()} />,
    );

    expect(screen.getByLabelText('GitHub username')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Load & Start/i })).toBeInTheDocument();
  });

  it('does not show a GitHub login button', () => {
    render(
      <WelcomeScreen onStart={vi.fn()} onLoadAndStart={vi.fn()} onHelp={vi.fn()} />,
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
      <WelcomeScreen onStart={vi.fn()} onLoadAndStart={vi.fn()} onHelp={vi.fn()} />,
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
      <WelcomeScreen onStart={vi.fn()} onLoadAndStart={vi.fn()} onHelp={vi.fn()} />,
    );

    expect(screen.getByText(/Cached/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument();
  });

  it('does not show a cache hint when there is no cached data', () => {
    mockUseGitHubData.mockReturnValue(makeData({ status: 'idle', cacheAge: null }));

    render(
      <WelcomeScreen onStart={vi.fn()} onLoadAndStart={vi.fn()} onHelp={vi.fn()} />,
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
      <WelcomeScreen onStart={vi.fn()} onLoadAndStart={vi.fn()} onHelp={vi.fn()} />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('GitHub API rate limit reached.');
  });

  it('calls fetchRepos with forceRefresh when Refresh button is clicked', () => {
    const fetchRepos = vi.fn(async () => []);
    mockUseGitHubData.mockReturnValue(
      makeData({
        status: 'cache-hit',
        repos: [],
        cacheAge: new Date(Date.now() - 60_000).toISOString(),
        fetchRepos,
      }),
    );

    render(
      <WelcomeScreen onStart={vi.fn()} onLoadAndStart={vi.fn()} onHelp={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));
    expect(fetchRepos).toHaveBeenCalledWith('octocat', { forceRefresh: true });
  });
});
