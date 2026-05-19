import { useProgressionStore } from '@/store/progressionStore';
import { useState } from 'react';
import { useGitHubAuth } from '@/ui/hooks/useGitHubAuth';
import { useGitHubData } from '@/ui/hooks/useGitHubData';
import { useSessionStore } from '@/store/sessionStore';
import { useGameScene } from '@/ui/context/GameContext';
import { encodeShareableDungeonUrl } from '@/ui/systems/shareUrl';
import { copyTextToClipboard } from '@/ui/systems/clipboard';
import type { GitHubRepoSummary } from '@/github/types';

interface RestartableDungeonScene {
  scene: {
    restart: (data: { repos: GitHubRepoSummary[]; username?: string; seed?: string }) => void;
  };
}

export function GitHubAuthPanel() {
  const usernameInput = useSessionStore((state) => state.usernameInput);
  const setUsernameInput = useSessionStore((state) => state.setUsernameInput);
  const auth = useGitHubAuth();
  const data = useGitHubData(auth.session?.accessToken);
  const [lastFetchError, setLastFetchError] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const level = useProgressionStore((s) => s.level);
  const badgeCount = useProgressionStore((s) => s.unlockedBadges.length);
  const { game, dungeon, currentRoom } = useGameScene();

  function focusGameCanvas(): void {
    if (typeof document !== 'undefined') {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) {
        activeElement.blur();
      }
    }

    const canvas = game?.canvas;
    if (!canvas) {
      return;
    }

    if (!canvas.hasAttribute('tabindex')) {
      canvas.setAttribute('tabindex', '0');
    }

    canvas.focus();
  }

  function restartDungeonWithRepos(repos: GitHubRepoSummary[], username: string): void {
    if (!game) {
      return;
    }

    const dungeonScene = game.scene.getScene('DungeonScene') as unknown as RestartableDungeonScene | null;
    if (!dungeonScene) {
      return;
    }

    dungeonScene.scene.restart({
      repos,
      username,
      seed: dungeon?.metadata.seed,
    });
  }

  async function handlePublicFetch(): Promise<void> {
    setLastFetchError(null);
    try {
      const repos = await data.fetchReposForUsername(usernameInput);
      restartDungeonWithRepos(repos, usernameInput.trim());
      focusGameCanvas();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load repositories.';
      setLastFetchError(message);
    }
  }

  async function handleAuthenticatedFetch(): Promise<void> {
    setLastFetchError(null);
    try {
      const repos = await data.fetchReposForAuthenticatedUser();
      restartDungeonWithRepos(repos, auth.user?.login ?? usernameInput.trim());
      focusGameCanvas();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load repositories.';
      setLastFetchError(message);
    }
  }

  async function handleCopyShareUrl(): Promise<void> {
    if (!usernameInput.trim()) {
      setShareMessage('Enter a username before sharing.');
      return;
    }

    const shareUrl = encodeShareableDungeonUrl(
      {
        username: usernameInput,
        seed: dungeon?.metadata.seed,
        roomId: currentRoom?.id,
        level,
        badgeCount,
      },
      window.location.href,
    );

    try {
      await copyTextToClipboard(shareUrl);
      setShareMessage('Share URL copied to clipboard.');
    } catch {
      setShareMessage(`Share URL: ${shareUrl}`);
    }
  }

  return (
    <section className="auth-panel" aria-label="GitHub connection panel">
      <label htmlFor="github-username">GitHub Username</label>
      <input
        id="github-username"
        value={usernameInput}
        onChange={(event) => {
          setUsernameInput(event.target.value);
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
        }}
        placeholder="octocat"
        autoComplete="off"
      />
      <div className="auth-actions">
        <button type="button" onClick={() => void handlePublicFetch()} disabled={!usernameInput || data.status === 'loading'}>
          Load Public Repos
        </button>
        <button type="button" onClick={() => void handleCopyShareUrl()} disabled={!usernameInput}>
          Copy Share URL
        </button>
        {auth.status === 'authenticated' ? (
          <>
            <button type="button" onClick={() => void handleAuthenticatedFetch()} disabled={data.status === 'loading'}>
              Load My Repos
            </button>
            <button type="button" onClick={() => void auth.logout()}>
              Logout
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              focusGameCanvas();
              void auth.beginLogin();
            }}
          >
            Login with GitHub
          </button>
        )}
      </div>

      <p className="auth-meta">
        Auth: {auth.status}
        {auth.user ? ` (${auth.user.login})` : ''}
      </p>
      {data.progress && data.status === 'loading' ? (
        <p className="auth-meta">Loading page {data.progress.page} — {data.progress.loadedCount} repos</p>
      ) : null}
      <p className="auth-meta">Loaded repos: {data.repos.length}</p>

      {auth.errorMessage ? <p className="auth-error">{auth.errorMessage}</p> : null}
      {data.errorMessage ? <p className="auth-error">{data.errorMessage}</p> : null}
      {lastFetchError ? <p className="auth-error">{lastFetchError}</p> : null}
      {shareMessage ? (
        <p className="auth-meta" role="status" aria-live="polite">
          {shareMessage}
        </p>
      ) : null}
      {data.shouldPromptLogin ? <p className="auth-error">Rate limit reached. Authenticate to continue.</p> : null}
    </section>
  );
}
