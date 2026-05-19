import { useCallback, useState } from 'react';
import { useGitHubAuth } from '@/ui/hooks/useGitHubAuth';
import { useGitHubData } from '@/ui/hooks/useGitHubData';
import { useSessionStore } from '@/store/sessionStore';
import type { GitHubRepoSummary } from '@/github/types';
import '@/ui/styles/welcome-screen.css';

interface WelcomeScreenProps {
  onStart: () => void;
  onLoadAndStart: (repos: GitHubRepoSummary[], username: string) => void;
  onHelp: () => void;
}

export function WelcomeScreen({ onStart, onLoadAndStart, onHelp }: WelcomeScreenProps) {
  const usernameInput = useSessionStore((state) => state.usernameInput);
  const setUsernameInput = useSessionStore((state) => state.setUsernameInput);
  const auth = useGitHubAuth();
  const data = useGitHubData(auth.session?.accessToken);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handlePublicLoad = useCallback(async () => {
    setFetchError(null);
    try {
      const repos = await data.fetchReposForUsername(usernameInput.trim());
      onLoadAndStart(repos, usernameInput.trim());
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to load repositories.');
    }
  }, [data, usernameInput, onLoadAndStart]);

  const handleAuthLoad = useCallback(async () => {
    setFetchError(null);
    try {
      const repos = await data.fetchReposForAuthenticatedUser();
      onLoadAndStart(repos, auth.user?.login ?? usernameInput.trim());
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to load repositories.');
    }
  }, [data, auth.user, usernameInput, onLoadAndStart]);

  const isLoading = data.status === 'loading';

  return (
    <div className="welcome-overlay" role="main" aria-label="Welcome to Repo Dungeon">
      <div className="welcome-content">
        <div className="welcome-logo-area">
          <div className="welcome-icon" aria-hidden="true">⚔️</div>
          <h1 className="welcome-title">REPO DUNGEON</h1>
          <p className="welcome-tagline">
            Explore your GitHub universe as a procedurally generated dungeon
          </p>
        </div>

        <ul className="welcome-features" aria-label="Game features">
          <li><span className="feature-icon" aria-hidden="true">🗺️</span><span>Every repository becomes a room to discover</span></li>
          <li><span className="feature-icon" aria-hidden="true">⚡</span><span>Earn XP, loot, and badges as you explore</span></li>
          <li><span className="feature-icon" aria-hidden="true">👥</span><span>Meet contributor NPCs and interact with room objects</span></li>
          <li><span className="feature-icon" aria-hidden="true">🌍</span><span>Biomes themed by language and topics</span></li>
        </ul>

        {/* GitHub connection section */}
        <div className="welcome-github-section" aria-label="GitHub connection">
          <p className="welcome-github-label">Load your GitHub repositories</p>
          <div className="welcome-github-row">
            <input
              className="welcome-username-input"
              type="text"
              placeholder="GitHub username"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter' && usernameInput.trim() && !isLoading) void handlePublicLoad();
              }}
              aria-label="GitHub username"
              autoComplete="off"
              autoFocus
            />
            <button
              className="welcome-btn welcome-btn--load"
              onClick={() => void handlePublicLoad()}
              disabled={!usernameInput.trim() || isLoading}
            >
              {isLoading ? '⏳ Loading…' : '⚔️ Load & Start'}
            </button>
          </div>

          {isLoading && data.progress && (
            <p className="welcome-load-progress">
              Fetching page {data.progress.page} — {data.progress.loadedCount} repos…
            </p>
          )}

          {auth.status === 'authenticated' ? (
            <div className="welcome-auth-row">
              <span className="welcome-auth-badge">✓ {auth.user?.login}</span>
              <button
                className="welcome-btn welcome-btn--ghost"
                onClick={() => void handleAuthLoad()}
                disabled={isLoading}
              >
                Load My Repos
              </button>
              <button
                className="welcome-btn welcome-btn--ghost"
                onClick={() => void auth.logout()}
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              className="welcome-btn welcome-btn--ghost"
              onClick={() => void auth.beginLogin()}
              disabled={isLoading}
            >
              🔑 Login with GitHub (private repos + higher rate limits)
            </button>
          )}

          {fetchError && <p className="welcome-error" role="alert">{fetchError}</p>}
        </div>

        <div className="welcome-actions welcome-actions--footer">
          <button className="welcome-btn welcome-btn--skip" onClick={onStart}>
            Skip — explore sample dungeon
          </button>
          <button className="welcome-btn welcome-btn--secondary" onClick={onHelp}>
            ? How to Play
          </button>
        </div>
      </div>
    </div>
  );
}
