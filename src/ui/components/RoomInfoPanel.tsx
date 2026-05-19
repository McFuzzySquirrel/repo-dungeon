import { useEffect, useState, useRef, useCallback } from 'react';
import { useGameScene, useOnRoomEntered, useOnRoomObjectInteracted } from '@/ui/context/GameContext';
import { GitHubApiClient, createGitHubApiClient, GitHubApiError } from '@/github/api';
import { getVisitedStampsSystem } from '@/ui/systems/VisitedStamps';
import type { RoomEnteredEvent } from '@/ui/context/GameContext';
import type { GitHubRoomData } from '@/github/types';
import '@/ui/styles/room-info.css';

type TabType = 'overview' | 'readme' | 'files' | 'contributors';

interface PanelState {
  isOpen: boolean;
  currentRoomId: string | null;
  currentRoomName: string;
  isLoading: boolean;
  error: string | null;
  data: GitHubRoomData | null;
  activeTab: TabType;
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
    activeTab: 'overview',
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
          activeTab: 'overview',
        }));

        // Fetch detailed data if not cached
        if (!cached && clientRef.current) {
          void fetchRoomData(event.roomId, event.repo as Record<string, string>);
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

  // Fetch room data from GitHub API
  const fetchRoomData = async (roomId: string, repo: Record<string, string>) => {
    if (!clientRef.current) return;

    try {
      const owner = repo.owner || '';
      const repoName = repo.name || '';

      if (!owner || !repoName) {
        setState((prev) => ({
          ...prev,
          error: 'Invalid repository information',
          isLoading: false,
        }));
        return;
      }

      const data = await clientRef.current.loadRoomData({
        roomId,
        owner,
        repo: repoName,
      });

      cacheRoomDetails(roomId, data);
      setState((prev) => ({
        ...prev,
        data,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      const errorMsg = error instanceof GitHubApiError ? error.message : 'Failed to load repository details';

      setState((prev) => ({
        ...prev,
        error: errorMsg,
        isLoading: false,
      }));
    }
  };

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
                  {data.readme.plainText ? (
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
                  {data.contributors.length > 0 ? (
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
