import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WelcomeScreen } from '@/ui/components/WelcomeScreen';
import { useSessionStore } from '@/store/sessionStore';
import type { UseGitHubAuthResult } from '@/ui/hooks/useGitHubAuth';

const { mockUseGitHubData } = vi.hoisted(() => ({
  mockUseGitHubData: vi.fn(),
}));

vi.mock('@/ui/hooks/useGitHubData', () => ({
  useGitHubData: (...args: unknown[]) => mockUseGitHubData(...args),
}));

function makeAuth(overrides: Partial<UseGitHubAuthResult> = {}): UseGitHubAuthResult {
  return {
    status: 'unauthenticated',
    session: null,
    user: null,
    errorMessage: null,
    beginLogin: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('WelcomeScreen auth UX', () => {
  beforeEach(() => {
    useSessionStore.setState({ usernameInput: 'octocat', isAuthenticated: false });
    mockUseGitHubData.mockReturnValue({
      status: 'idle',
      repos: [],
      errorMessage: null,
      shouldPromptLogin: false,
      progress: null,
      fetchReposForUsername: vi.fn(),
      fetchReposForAuthenticatedUser: vi.fn(),
    });
  });

  it('shows the signed-in state on welcome when a stored session is already authenticated', () => {
    render(
      <WelcomeScreen
        auth={makeAuth({
          status: 'authenticated',
          session: {
            accessToken: 'token',
            tokenType: 'bearer',
            scope: 'repo',
            createdAt: new Date().toISOString(),
          },
          user: {
            id: 1,
            login: 'octocat',
            avatarUrl: 'https://example.com/octocat.png',
            bio: null,
            publicRepos: 8,
            followers: 10,
            following: 5,
          },
        })}
        onStart={vi.fn()}
        onLoadAndStart={vi.fn()}
        onHelp={vi.fn()}
      />,
    );

    expect(screen.getByText('✓ octocat')).toBeInTheDocument();
    expect(screen.getByText('Continue with your GitHub account')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue as octocat' })).toBeInTheDocument();
    expect(screen.getByText('Or load public repositories for a different account below.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Login with GitHub/i })).not.toBeInTheDocument();
  });

  it('shows the login CTA on welcome when no stored session is available', () => {
    render(
      <WelcomeScreen
        auth={makeAuth()}
        onStart={vi.fn()}
        onLoadAndStart={vi.fn()}
        onHelp={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Login with GitHub/i })).toBeInTheDocument();
    expect(screen.queryByText(/✓/)).not.toBeInTheDocument();
  });

  it('shows a transient session check state before auth hydration finishes', () => {
    render(
      <WelcomeScreen
        auth={makeAuth({ status: 'loading' })}
        onStart={vi.fn()}
        onLoadAndStart={vi.fn()}
        onHelp={vi.fn()}
      />,
    );

    expect(screen.getByText('Checking GitHub session…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Login with GitHub/i })).not.toBeInTheDocument();
  });
});