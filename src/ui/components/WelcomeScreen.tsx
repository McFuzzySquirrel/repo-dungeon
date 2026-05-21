import { useCallback, useEffect, useState } from 'react';
import { useGitHubData } from '@/ui/hooks/useGitHubData';
import { useRepositorySource } from '@/ui/hooks/useRepositorySource';
import { useSessionStore } from '@/store/sessionStore';
import { usePlayerStore } from '@/store/playerStore';
import type { LocalRepoAccessState } from '@/localRepos/browserAccess';
import { getLocalRepoAccessState } from '@/localRepos/browserAccess';
import type { GitHubRepoSummary } from '@/github/types';
import type { LocalSourceSelection } from '@/localRepos/types';
import { PLAYER_AVATAR_FALLBACK_SRC, getPlayerAvatarSrc } from '@/ui/constants/playerAvatar';
import '@/ui/styles/welcome-screen.css';

interface WelcomeScreenProps {
  onStart: () => void;
  onLoadAndStart: (repos: GitHubRepoSummary[], username: string) => void;
  onLoadLocalAndStart?: (repos: GitHubRepoSummary[], source: LocalSourceSelection) => void;
  onHelp: () => void;
  localRepoAccess?: LocalRepoAccessState;
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

export function WelcomeScreen({ onStart, onLoadAndStart, onLoadLocalAndStart, onHelp, localRepoAccess }: WelcomeScreenProps) {
  const usernameInput = useSessionStore((state) => state.usernameInput);
  const selectedSourceKind = useSessionStore((state) => state.selectedSourceKind);
  const setUsernameInput = useSessionStore((state) => state.setUsernameInput);
  const setSelectedSourceKind = useSessionStore((state) => state.setSelectedSourceKind);
  const selectedClass = usePlayerStore((state) => state.selectedClass);
  const data = useGitHubData();
  const resolvedLocalRepoAccess = localRepoAccess ?? getLocalRepoAccessState();
  const localSource = useRepositorySource({ localRepoAccess: resolvedLocalRepoAccess });
  const primaryAvatarSrc = getPlayerAvatarSrc(selectedClass);
  const [avatarSrc, setAvatarSrc] = useState(primaryAvatarSrc);

  useEffect(() => {
    setAvatarSrc(primaryAvatarSrc);
  }, [primaryAvatarSrc]);

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

  const handleLocalStart = useCallback(async () => {
    let localLoad = null;

    if (localSource.hasCachedResults) {
      localLoad = localSource.startFromCache();
    }

    if (!localLoad || localLoad.repos.length === 0) {
      localLoad = await localSource.scanCurrentSelection();
    }

    if (!localLoad || !onLoadLocalAndStart) {
      return;
    }

    onLoadLocalAndStart(localLoad.repos, localLoad.selection);
  }, [localSource, onLoadLocalAndStart]);

  const handlePickAndScan = useCallback(async () => {
    const localLoad = await localSource.pickAndScan();
    if (!localLoad || !onLoadLocalAndStart) {
      return;
    }

    onLoadLocalAndStart(localLoad.repos, localLoad.selection);
  }, [localSource, onLoadLocalAndStart]);

  const isLoading = data.status === 'loading';
  const isLocalBusy = localSource.status === 'picking' || localSource.status === 'scanning';
  const hasCachedData = data.status === 'cache-hit' || (data.cacheAge !== null && data.repos.length > 0);
  const handleAvatarError = () => {
    if (avatarSrc !== PLAYER_AVATAR_FALLBACK_SRC) {
      setAvatarSrc(PLAYER_AVATAR_FALLBACK_SRC);
    }
  };

  return (
    <div className="welcome-overlay" role="main" aria-label="Welcome to Repo Dungeon">
      <div className="welcome-content">
        <div className="welcome-logo-area">
          <img
            className="welcome-icon"
            src={avatarSrc}
            alt=""
            aria-hidden="true"
            onError={handleAvatarError}
          />
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

        <fieldset className="welcome-source-picker" aria-label="Repository source">
          <legend className="welcome-source-legend">Repository source</legend>
          <div className="welcome-source-options" role="radiogroup" aria-label="Repository source options">
            <button
              type="button"
              role="radio"
              aria-checked={selectedSourceKind === 'github'}
              className={`welcome-source-option ${selectedSourceKind === 'github' ? 'is-active' : ''}`}
              onClick={() => setSelectedSourceKind('github')}
            >
              GitHub (existing flow)
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={selectedSourceKind === 'local'}
              className={`welcome-source-option ${selectedSourceKind === 'local' ? 'is-active' : ''}`}
              onClick={() => {
                if (resolvedLocalRepoAccess.isLocalRepoModeAvailable) {
                  setSelectedSourceKind('local');
                }
              }}
              disabled={!resolvedLocalRepoAccess.isLocalRepoModeAvailable}
              aria-describedby={!resolvedLocalRepoAccess.isLocalRepoModeAvailable ? 'local-source-disabled-reason' : undefined}
            >
              Local repositories
            </button>
          </div>
          {!resolvedLocalRepoAccess.isLocalRepoModeAvailable && resolvedLocalRepoAccess.reason && (
            <p className="welcome-source-note" id="local-source-disabled-reason" role="note">
              {resolvedLocalRepoAccess.reason}
            </p>
          )}
        </fieldset>

        {selectedSourceKind === 'github' && (
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
        )}

        {selectedSourceKind === 'local' && resolvedLocalRepoAccess.isLocalRepoModeAvailable && (
          <div className="welcome-github-section" aria-label="Local repository mode">
            <p className="welcome-github-label">Scan local repositories from a parent folder</p>
            <p className="welcome-source-note" role="note">
              Your browser may show a permission prompt like "Allow this site to view and copy files." In Repo Dungeon's local scan flow,
              the app reads folder/repository metadata to discover rooms, but does not copy or upload your repository files.
            </p>
            <p className="welcome-source-note" role="note">
              If you choose <strong>Don&apos;t Allow</strong>, local mode stays unavailable and you can continue with GitHub source mode.
            </p>

            <div className="welcome-local-actions">
              <button
                className="welcome-btn welcome-btn--load"
                onClick={() => void handlePickAndScan()}
                disabled={isLocalBusy}
              >
                {localSource.status === 'picking'
                  ? 'Choosing folder…'
                  : localSource.status === 'scanning'
                    ? 'Scanning…'
                    : '📁 Choose Folder & Start'}
              </button>
              {localSource.selection && (
                <button
                  className="welcome-btn welcome-btn--ghost"
                  onClick={() => void handleLocalStart()}
                  disabled={isLocalBusy}
                >
                  {localSource.hasCachedResults ? '⚔️ Start from Cached Scan' : '🔍 Scan Current Folder'}
                </button>
              )}
            </div>

            {localSource.selection && (
              <p className="welcome-source-note" role="note">
                Selected folder: <strong>{localSource.selection.rootLabel}</strong>
              </p>
            )}

            {localSource.scanProgress && (
              <p className="welcome-load-progress" role="status" aria-live="polite">
                {localSource.scanProgress.phase === 'scanning'
                  ? `Scanned ${localSource.scanProgress.scannedDirectories} folders • Found ${localSource.scanProgress.discoveredRepositories} repos${localSource.scanProgress.currentPath ? ` • ${localSource.scanProgress.currentPath}` : ''}`
                  : localSource.scanProgress.phase === 'completed'
                    ? `Scan complete • Found ${localSource.roomCount} repositories`
                    : localSource.scanProgress.message ?? ''}
              </p>
            )}

            {localSource.cachedAt && localSource.hasCachedResults && (
              <p className="welcome-source-note" role="note">
                Cached scan available from {formatCacheAge(localSource.cachedAt)}.
              </p>
            )}

            {localSource.errorMessage && (
              <p className="welcome-error" role="alert">{localSource.errorMessage}</p>
            )}

            {localSource.status === 'ready' && localSource.roomCount === 0 && (
              <p className="welcome-source-note" role="note">
                No git repositories were found under the selected folder.
              </p>
            )}
          </div>
        )}

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
