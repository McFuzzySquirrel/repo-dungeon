import { useCallback } from 'react';
import { useGitHubData } from '@/ui/hooks/useGitHubData';
import { useSessionStore } from '@/store/sessionStore';
import type { GitHubRepoSummary } from '@/github/types';
import '@/ui/styles/welcome-screen.css';

interface WelcomeScreenProps {
  onStart: () => void;
  onLoadAndStart: (repos: GitHubRepoSummary[], username: string) => void;
  onHelp: () => void;
}

function formatCacheAge(fetchedAt: string): string {
  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) {
    return minutes <= 1 ? 'just now' : `${minutes} minutes ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

export function WelcomeScreen({ onStart, onLoadAndStart, onHelp }: WelcomeScreenProps) {
  const usernameInput = useSessionStore((state) => state.usernameInput);
  const setUsernameInput = useSessionStore((state) => state.setUsernameInput);
  const data = useGitHubData();

  const handleLoad = useCallback(async () => {
    try {
      const repos = await data.fetchRepos(usernameInput.trim());
      onLoadAndStart(repos, usernameInput.trim());
    } catch {
      // error is surfaced via data.errorMessage
    }
  }, [data, usernameInput, onLoadAndStart]);

  const handleRefresh = useCallback(async () => {
    try {
      const repos = await data.fetchRepos(usernameInput.trim(), { forceRefresh: true });
      onLoadAndStart(repos, usernameInput.trim());
    } catch {
      // error is surfaced via data.errorMessage
    }
  }, [data, usernameInput, onLoadAndStart]);

  const isLoading = data.status === 'loading';
  const hasCachedData = data.status === 'cache-hit' || (data.cacheAge !== null && data.repos.length > 0);

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
                if (e.key === 'Enter' && usernameInput.trim() && !isLoading) void handleLoad();
              }}
              aria-label="GitHub username"
              autoComplete="off"
              autoFocus
            />
            <button
              className="welcome-btn welcome-btn--load"
              onClick={() => void handleLoad()}
              disabled={!usernameInput.trim() || isLoading}
            >
              {isLoading ? '⏳ Loading…' : '⚔️ Load & Start'}
            </button>
          </div>

          {isLoading && data.progress && (
            <p className="welcome-load-progress" role="status" aria-live="polite">
              Fetching page {data.progress.page} — {data.progress.loadedCount} repos…
            </p>
          )}

          {hasCachedData && data.cacheAge && !isLoading && (
            <div className="welcome-cache-hint">
              <span className="welcome-cache-age">
                📦 Cached {formatCacheAge(data.cacheAge)} ({data.repos.length} repos)
              </span>
              <button
                className="welcome-btn welcome-btn--ghost welcome-btn--refresh"
                onClick={() => void handleRefresh()}
                disabled={!usernameInput.trim() || isLoading}
                title="Re-fetch repositories from GitHub"
              >
                🔄 Refresh
              </button>
            </div>
          )}

          {data.errorMessage && (
            <p className="welcome-error" role="alert">{data.errorMessage}</p>
          )}
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
