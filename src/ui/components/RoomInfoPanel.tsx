import { useEffect, useState, useRef, useCallback } from 'react';
import { useGameScene, useOnRoomEntered, useOnRoomObjectInteracted } from '@/ui/context/GameContext';
import { GitHubApiClient, createGitHubApiClient, GitHubApiError } from '@/github/api';
import {
  isRoomDetailFresh,
  loadCachedRoomDetail,
  saveCachedRoomDetail,
  touchCachedRoomDetailFreshness,
  type RoomDetailEtags,
} from '@/github/cache';
import { getVisitedStampsSystem } from '@/ui/systems/VisitedStamps';
import type { RoomEnteredEvent } from '@/ui/context/GameContext';
import type { GitHubReadmePayload, GitHubRepoSummary, GitHubRoomData } from '@/github/types';
import '@/ui/styles/room-info.css';

type TabType = 'overview' | 'readme' | 'files' | 'contributors';

interface PanelState {
  isOpen: boolean;
  currentRoomId: string | null;
  currentRoomName: string;
  isLoading: boolean;
  error: string | null;
  data: GitHubRoomData | null;
  /** Per-endpoint ETags from the most recently loaded snapshot, used for lazy revalidation. */
  etags: RoomDetailEtags;
  /** Set of deferred endpoints currently being lazy-fetched. */
  loadingDeferred: Partial<Record<'readme' | 'contributors', boolean>>;
  activeTab: TabType;
  currentOwner: string | null;
  currentRepoName: string | null;
}

/**
 * RoomInfoPanel component displays repository information when a player enters a room.
 * Features include tabs for overview, README, file tree, and contributors.
 */
export function RoomInfoPanel() {
  const { getRoomDetails, cacheRoomDetails } = useGameScene();
  const [state, setState] = useState<PanelState>({
    isOpen: false,
    currentRoomId: null,
    currentRoomName: '',
    isLoading: false,
    error: null,
    data: null,
    etags: {},
    loadingDeferred: {},
    activeTab: 'overview',
    currentOwner: null,
    currentRepoName: null,
  });

  const clientRef = useRef<GitHubApiClient | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const visitedStamps = getVisitedStampsSystem();

  // Initialize GitHub API client
  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = createGitHubApiClient();
    }
  }, []);

  // Handle room entry
  useOnRoomEntered(
    useCallback(
      (event: RoomEnteredEvent) => {
        // Mark previous room as visited if panel was open
        if (state.isOpen && state.currentRoomId) {
          visitedStamps.addVisitedRoom(state.currentRoomId);
        }

        // Skip profile and gateway rooms, only show info for repos
        if (event.roomType !== 'repo' || !event.repo) {
          setState((prev) => ({ ...prev, isOpen: false }));
          return;
        }

        // Check if we have cached data
        const cached = getRoomDetails(event.roomId);

        setState((prev) => ({
          ...prev,
          isOpen: true,
          currentRoomId: event.roomId,
          currentRoomName: event.roomName,
          isLoading: !cached,
          error: null,
          data: cached || null,
          etags: {},
          loadingDeferred: {},
          activeTab: 'overview',
          currentOwner: (event.repo?.owner as string | undefined) ?? (event.repo?.ownerLogin as string | undefined) ?? null,
          currentRepoName: (event.repo?.name as string | undefined) ?? null,
        }));

        // Fetch detailed data if not cached
        if (!cached && clientRef.current) {
          void fetchRoomData(event.roomId, event.repo);
        }
      },
      [state.isOpen, state.currentRoomId, getRoomDetails, visitedStamps],
    ),
  );

  useOnRoomObjectInteracted(
    useCallback((event) => {
      setState((prev) => {
        if (!prev.isOpen || prev.currentRoomId !== event.roomId) {
          return prev;
        }

        const activeTabByObject: Record<typeof event.objectType, TabType> = {
          'readme-scroll': 'readme',
          'file-tree-archive': 'files',
          'contributors-gallery': 'contributors',
        };

        return {
          ...prev,
          activeTab: activeTabByObject[event.objectType],
        };
      });
    }, []),
  );

  // Fetch room data from GitHub API, using persistent cache first
  const fetchRoomData = async (roomId: string, repo: Record<string, unknown>) => {
    if (!clientRef.current) return;

    try {
      const owner = (repo.owner as string | undefined) || (repo.ownerLogin as string | undefined) || '';
      const repoName = (repo.name as string | undefined) || '';

      if (!owner || !repoName) {
        setState((prev) => ({
          ...prev,
          error: 'Invalid repository information',
          isLoading: false,
        }));
        return;
      }

      // Fresh persistent cache hit → no network at all.
      const cachedSnapshot = loadCachedRoomDetail(owner, repoName);
      if (cachedSnapshot && isRoomDetailFresh(cachedSnapshot)) {
        const data = cachedSnapshot.data;
        cacheRoomDetails(roomId, data);
        setState((prev) => ({
          ...prev,
          data,
          etags: cachedSnapshot.etags ?? {},
          isLoading: false,
          error: null,
        }));
        return;
      }

      // Item #2: reuse the repo summary delivered in the dungeon event, so
      // GET /repos/{owner}/{repo} can be skipped entirely.
      // Item #3/#4: defer README and contributors to lazy on-tab-open loads.
      // Item #1: pass the (possibly stale) persisted snapshot so each
      // sub-request can issue If-None-Match and short-circuit on 304.
      const summary = buildSummaryFromEvent(repo);
      const result = await clientRef.current.loadRoomData(
        { roomId, owner, repo: repoName },
        {
          summary,
          persisted: cachedSnapshot ?? undefined,
          skipReadme: true,
          skipContributors: true,
        },
      );

      if (result.fullyRevalidated && cachedSnapshot) {
        touchCachedRoomDetailFreshness(owner, repoName);
      } else {
        saveCachedRoomDetail(owner, repoName, result.data, result.etags);
      }
      cacheRoomDetails(roomId, result.data);
      setState((prev) => ({
        ...prev,
        data: result.data,
        etags: result.etags,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      const errorMsg = error instanceof GitHubApiError ? error.message : 'Failed to load repository details';

      // Item #5: rate-limit-aware graceful degradation. If a stale persisted
      // snapshot exists, surface it rather than failing outright.
      if (error instanceof GitHubApiError && error.details.kind === 'rate_limit') {
        const owner = (repo.owner as string | undefined) || (repo.ownerLogin as string | undefined) || '';
        const repoName = (repo.name as string | undefined) || '';
        const stale = owner && repoName ? loadCachedRoomDetail(owner, repoName) : null;
        if (stale) {
          cacheRoomDetails(roomId, stale.data);
          setState((prev) => ({
            ...prev,
            data: stale.data,
            etags: stale.etags ?? {},
            isLoading: false,
            error: null,
          }));
          return;
        }
      }

      setState((prev) => ({
        ...prev,
        error: errorMsg,
        isLoading: false,
      }));
    }
  };

  // Lazy-load README (item #4) the first time the README tab/scroll is opened.
  const ensureReadmeLoaded = useCallback(() => {
    setState((prev) => {
      const owner = prev.currentOwner;
      const repoName = prev.currentRepoName;
      if (!owner || !repoName || !prev.data || !clientRef.current) return prev;
      if (!prev.data.deferred?.includes('readme')) return prev;
      if (prev.loadingDeferred.readme) return prev;

      const client = clientRef.current;
      void (async () => {
        try {
          const { readme, etag } = await client.loadReadme(
            { roomId: prev.currentRoomId ?? '', owner, repo: repoName },
            { etag: prev.etags.readme },
          );
          setState((p) => mergeLazyResult(p, owner, repoName, { readme }, { readme: etag }));
        } catch {
          setState((p) => mergeLazyResult(p, owner, repoName, {}, {}, 'readme'));
        }
      })();

      return {
        ...prev,
        loadingDeferred: { ...prev.loadingDeferred, readme: true },
      };
    });
  }, []);

  // Lazy-load contributors (item #3) the first time the Contributors tab/gallery is opened.
  const ensureContributorsLoaded = useCallback(() => {
    setState((prev) => {
      const owner = prev.currentOwner;
      const repoName = prev.currentRepoName;
      if (!owner || !repoName || !prev.data || !clientRef.current) return prev;
      if (!prev.data.deferred?.includes('contributors')) return prev;
      if (prev.loadingDeferred.contributors) return prev;

      const client = clientRef.current;
      void (async () => {
        try {
          const { contributors, etag } = await client.loadContributors(
            { roomId: prev.currentRoomId ?? '', owner, repo: repoName },
            { etag: prev.etags.contributors },
          );
          setState((p) => mergeLazyResult(p, owner, repoName, { contributors }, { contributors: etag }));
        } catch {
          setState((p) => mergeLazyResult(p, owner, repoName, {}, {}, 'contributors'));
        }
      })();

      return {
        ...prev,
        loadingDeferred: { ...prev.loadingDeferred, contributors: true },
      };
    });
  }, []);

  // Trigger lazy loads when the active tab demands them.
  useEffect(() => {
    if (state.activeTab === 'readme') ensureReadmeLoaded();
    if (state.activeTab === 'contributors') ensureContributorsLoaded();
  }, [state.activeTab, state.data, ensureReadmeLoaded, ensureContributorsLoaded]);

  // Handle panel close
  const handleClose = useCallback(() => {
    if (state.currentRoomId) {
      visitedStamps.addVisitedRoom(state.currentRoomId);
    }
    setState((prev) => ({ ...prev, isOpen: false }));
  }, [state.currentRoomId, visitedStamps]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.isOpen) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.isOpen, handleClose]);

  // Handle focus management when panel opens/closes
  useEffect(() => {
    if (state.isOpen && panelRef.current) {
      // Focus the close button for keyboard navigation
      const closeButton = panelRef.current.querySelector('[aria-label="Close room info panel"]') as HTMLButtonElement;
      if (closeButton) {
        closeButton.focus();
      }
    }
  }, [state.isOpen]);

  if (!state.isOpen) {
    return null;
  }

  const { data, error, isLoading, activeTab, currentRoomName } = state;

  return (
    <div
      className="room-info-panel-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      role="presentation"
    >
      <div
        className="room-info-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-info-title"
        aria-describedby="room-info-description"
      >
        {/* Header */}
        <div className="room-info-header">
          <div className="room-info-title-section">
            <h2 id="room-info-title" className="room-info-title">
              {currentRoomName}
            </h2>
            {data && (
              <a
                href={data.repo.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="room-info-github-link"
                aria-label={`Visit ${data.repo.fullName} on GitHub`}
              >
                Visit on GitHub →
              </a>
            )}
          </div>
          <button
            className="room-info-close"
            onClick={handleClose}
            type="button"
            aria-label="Close room info panel"
          >
            ✕
          </button>
        </div>

        {/* Stats section (always visible) */}
        {data && (
          <div className="room-info-stats">
            <div className="room-info-stat">
              <span className="stat-icon">⭐</span>
              <span className="stat-value">{data.repo.stargazersCount}</span>
            </div>
            <div className="room-info-stat">
              <span className="stat-icon">🍴</span>
              <span className="stat-value">{data.repo.forksCount}</span>
            </div>
            {data.repo.language && (
              <div className="room-info-stat">
                <span className="stat-label">{data.repo.language}</span>
              </div>
            )}
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="room-info-loading" id="room-info-description">
            <div className="spinner" aria-hidden="true" />
            <p>Loading repository details...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="room-info-error" id="room-info-description" role="alert">
            <p className="error-message">{error}</p>
            <button type="button" onClick={handleClose} className="room-info-retry">
              Dismiss
            </button>
          </div>
        )}

        {/* Content tabs */}
        {data && !isLoading && !error && (
          <>
            <div className="room-info-tabs" role="tablist">
              {(['overview', 'readme', 'files', 'contributors'] as const).map((tab) => (
                <button
                  key={tab}
                  className={`room-info-tab ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setState((prev) => ({ ...prev, activeTab: tab }))}
                  role="tab"
                  aria-selected={activeTab === tab}
                  aria-controls={`room-info-${tab}`}
                  id={`room-info-tab-${tab}`}
                  type="button"
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="room-info-content">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div
                  className="room-info-tab-panel"
                  id="room-info-overview"
                  role="tabpanel"
                  aria-labelledby="room-info-tab-overview"
                >
                  {data.repo.description && (
                    <div className="room-info-section">
                      <h3>Description</h3>
                      <p>{data.repo.description}</p>
                    </div>
                  )}

                  {Object.keys(data.languages).length > 0 && (
                    <div className="room-info-section">
                      <h3>Languages</h3>
                      <LanguageBar languages={data.languages} />
                    </div>
                  )}

                  {data.repo.topics.length > 0 && (
                    <div className="room-info-section">
                      <h3>Topics</h3>
                      <div className="room-info-topics">
                        {data.repo.topics.slice(0, 5).map((topic) => (
                          <span key={topic} className="room-info-topic">
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* README Tab */}
              {activeTab === 'readme' && (
                <div
                  className="room-info-tab-panel"
                  id="room-info-readme"
                  role="tabpanel"
                  aria-labelledby="room-info-tab-readme"
                >
                  {state.loadingDeferred.readme || data.deferred?.includes('readme') ? (
                    <div className="room-info-loading">
                      <div className="spinner" aria-hidden="true" />
                      <p>Loading README…</p>
                    </div>
                  ) : data.readme.plainText ? (
                    <div className="room-info-readme">
                      <p>{data.readme.plainText.substring(0, 1000)}</p>
                      {data.readme.truncated && <p className="room-info-truncated">[Truncated]</p>}
                    </div>
                  ) : (
                    <p className="room-info-empty">{data.readme.unavailableReason || 'No README available'}</p>
                  )}
                </div>
              )}

              {/* Files Tab */}
              {activeTab === 'files' && (
                <div
                  className="room-info-tab-panel"
                  id="room-info-files"
                  role="tabpanel"
                  aria-labelledby="room-info-tab-files"
                >
                  {data.topLevelTree.length > 0 ? (
                    <div className="room-info-files">
                      {data.topLevelTree.slice(0, 20).map((entry) => (
                        <div key={entry.path} className={`room-info-file room-info-file-${entry.type}`}>
                          <span className="file-icon">{entry.type === 'dir' ? '📁' : '📄'}</span>
                          <span className="file-name">{entry.path}</span>
                        </div>
                      ))}
                      {data.topLevelTree.length > 20 && (
                        <p className="room-info-truncated">+{data.topLevelTree.length - 20} more files</p>
                      )}
                    </div>
                  ) : (
                    <p className="room-info-empty">No files available</p>
                  )}
                </div>
              )}

              {/* Contributors Tab */}
              {activeTab === 'contributors' && (
                <div
                  className="room-info-tab-panel"
                  id="room-info-contributors"
                  role="tabpanel"
                  aria-labelledby="room-info-tab-contributors"
                >
                  {state.loadingDeferred.contributors || data.deferred?.includes('contributors') ? (
                    <div className="room-info-loading">
                      <div className="spinner" aria-hidden="true" />
                      <p>Loading contributors…</p>
                    </div>
                  ) : data.contributors.length > 0 ? (
                    <div className="room-info-contributors">
                      {data.contributors.slice(0, 5).map((contributor) => (
                        <div key={contributor.id} className="room-info-contributor">
                          <img
                            src={contributor.avatarUrl}
                            alt={contributor.login}
                            className="contributor-avatar"
                            width={32}
                            height={32}
                          />
                          <div className="contributor-info">
                            <a
                              href={contributor.profileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="contributor-name"
                            >
                              {contributor.login}
                            </a>
                            <span className="contributor-count">{contributor.contributions} commits</span>
                          </div>
                        </div>
                      ))}
                      {data.contributors.length > 5 && (
                        <a
                          href={`${data.repo.htmlUrl}/graphs/contributors`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="room-info-link"
                        >
                          View all contributors on GitHub →
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="room-info-empty">No contributors information available</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * LanguageBar component displays language composition as a horizontal bar.
 */
function LanguageBar({ languages }: { languages: Record<string, number> }) {
  const total = Object.values(languages).reduce((a, b) => a + b, 0);
  const entries = Object.entries(languages).sort(([, a], [, b]) => b - a);

  // GitHub language colors (subset for common languages)
  const languageColors: Record<string, string> = {
    JavaScript: '#f1e05a',
    TypeScript: '#3178c6',
    Python: '#3572A5',
    Rust: '#ce422b',
    Go: '#00ADD8',
    Java: '#b07219',
    'C++': '#f34b7d',
    C: '#555555',
    Shell: '#89e051',
    HTML: '#e34c26',
    CSS: '#563d7c',
    Ruby: '#cc342d',
  };

  return (
    <div className="language-bar-container">
      <div className="language-bar" role="img" aria-label={`Language composition: ${entries.map(([lang, count]) => `${lang} ${((count / total) * 100).toFixed(1)}%`).join(', ')}`}>
        {entries.map(([lang, count]) => {
          const percentage = (count / total) * 100;
          const color = languageColors[lang] || '#cccccc';

          return (
            <div
              key={lang}
              className="language-bar-segment"
              style={{
                flex: percentage,
                backgroundColor: color,
              }}
              title={`${lang}: ${percentage.toFixed(1)}%`}
              aria-hidden="true"
            />
          );
        })}
      </div>
      <div className="language-legend">
        {entries.slice(0, 5).map(([lang, count]) => {
          const percentage = (count / total) * 100;
          const color = languageColors[lang] || '#cccccc';

          return (
            <div key={lang} className="language-legend-item">
              <span className="legend-color" style={{ backgroundColor: color }} aria-hidden="true" />
              <span className="legend-label">
                {lang} {percentage.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Reconstruct a `GitHubRepoSummary` from the room-entered event payload. The
 * DungeonScene already spreads the full summary fields into the event (and
 * adds an `owner` alias), so this is a zero-cost equivalent of fetching
 * `GET /repos/{owner}/{repo}` again (optimization-research item #2).
 */
function buildSummaryFromEvent(repo: Record<string, unknown>): GitHubRepoSummary | undefined {
  const id = repo.id;
  const name = repo.name;
  const ownerLogin = (repo.ownerLogin as string | undefined) ?? (repo.owner as string | undefined);
  const fullName = repo.fullName;
  const defaultBranch = repo.defaultBranch;
  if (
    typeof id !== 'number' ||
    typeof name !== 'string' ||
    typeof ownerLogin !== 'string' ||
    typeof fullName !== 'string' ||
    typeof defaultBranch !== 'string'
  ) {
    return undefined;
  }
  return {
    id,
    name,
    ownerLogin,
    fullName,
    description: (repo.description as string | null | undefined) ?? null,
    htmlUrl: (repo.htmlUrl as string | undefined) ?? '',
    language: (repo.language as string | null | undefined) ?? null,
    stargazersCount: typeof repo.stargazersCount === 'number' ? repo.stargazersCount : 0,
    forksCount: typeof repo.forksCount === 'number' ? repo.forksCount : 0,
    topics: Array.isArray(repo.topics) ? (repo.topics as string[]) : [],
    isPrivate: Boolean(repo.isPrivate),
    defaultBranch,
  };
}

/**
 * Apply a lazy-loaded slice (readme or contributors) to panel state and
 * persist it to localStorage so subsequent visits get the full snapshot.
 */
function mergeLazyResult(
  prev: PanelState,
  owner: string,
  repoName: string,
  patch: { readme?: GitHubReadmePayload; contributors?: GitHubRoomData['contributors'] },
  etagPatch: { readme?: string; contributors?: string },
  failureKey?: 'readme' | 'contributors',
): PanelState {
  if (!prev.data) return prev;
  if (prev.currentOwner !== owner || prev.currentRepoName !== repoName) {
    return { ...prev, loadingDeferred: { ...prev.loadingDeferred, ...(failureKey ? { [failureKey]: false } : {}) } };
  }

  const deferred = (prev.data.deferred ?? []).filter((key) => !(key in patch));
  const unavailable = failureKey ? [...prev.data.unavailable, failureKey] : prev.data.unavailable;

  const nextData: GitHubRoomData = {
    ...prev.data,
    ...(patch.readme ? { readme: patch.readme } : {}),
    ...(patch.contributors ? { contributors: patch.contributors } : {}),
    deferred: deferred.length > 0 ? deferred : undefined,
    unavailable,
  };

  const nextEtags: RoomDetailEtags = {
    ...prev.etags,
    ...(etagPatch.readme ? { readme: etagPatch.readme } : {}),
    ...(etagPatch.contributors ? { contributors: etagPatch.contributors } : {}),
  };

  // Persist the merged snapshot so subsequent sessions see the upgraded data.
  saveCachedRoomDetail(owner, repoName, nextData, nextEtags);

  return {
    ...prev,
    data: nextData,
    etags: nextEtags,
    loadingDeferred: {
      ...prev.loadingDeferred,
      ...(patch.readme || failureKey === 'readme' ? { readme: false } : {}),
      ...(patch.contributors || failureKey === 'contributors' ? { contributors: false } : {}),
    },
  };
}
