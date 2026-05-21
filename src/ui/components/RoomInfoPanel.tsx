import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useGameScene, useOnRoomEntered, useOnRoomObjectInteracted } from '@/ui/context/GameContext';
import { GitHubApiClient, createGitHubApiClient, GitHubApiError } from '@/github/api';
import {
  isRoomDetailFresh,
  loadCachedRoomDetail,
  saveCachedRoomDetail,
  touchCachedRoomDetailFreshness,
  type RoomDetailEtags,
} from '@/github/cache';
import { useProgressionStore } from '@/store/progressionStore';
import { STORAGE_KEYS } from '@/store/persistence';
import { parseSourceIdentityFromStorage } from '@/repository/source';
import { loadLocalScanCache, loadLocalSourceSelection } from '@/localRepos/cache';
import { buildLocalRoomPresentationData } from '@/localRepos/metadata';
import { electronLocalRepoAccess } from '@/localRepos/electronAccess';
import { getLocalRepoAccessState, trustedLocalBrowserAccess } from '@/localRepos/browserAccess';
import type {
  LocalPreferredEditorConfig,
  LocalRepoAccessApi,
  LocalRepoScanCandidate,
  LocalRoomLaunchMode,
  LocalRoomPresentationData,
} from '@/localRepos/types';
import { getVisitedStampsSystem } from '@/ui/systems/VisitedStamps';
import type { RoomEnteredEvent } from '@/ui/context/GameContext';
import type { GitHubReadmePayload, GitHubRepoSummary, GitHubRoomData } from '@/github/types';
import { BasementExplorer } from '@/ui/components/BasementExplorer';
import '@/ui/styles/room-info.css';

type TabType = 'overview' | 'readme' | 'files' | 'contributors';

interface LocalRoomPanelData {
  candidate: LocalRepoScanCandidate;
  presentation: LocalRoomPresentationData;
}

interface PanelState {
  isOpen: boolean;
  isLocalRoom: boolean;
  currentRoomId: string | null;
  currentRoomName: string;
  isLoading: boolean;
  error: string | null;
  data: GitHubRoomData | null;
  localRoom: LocalRoomPanelData | null;
  /** Per-endpoint ETags from the most recently loaded snapshot, used for lazy revalidation. */
  etags: RoomDetailEtags;
  /** Set of deferred endpoints currently being lazy-fetched. */
  loadingDeferred: Partial<Record<'readme' | 'contributors', boolean>>;
  activeTab: TabType;
  currentOwner: string | null;
  currentRepoName: string | null;
  isLaunchingLocalPath: boolean;
  localLaunchMessage: string | null;
  localLaunchMessageKind: 'info' | 'error';
  isLocalReadmeModalOpen: boolean;
  isLocalReadmeLoading: boolean;
  localReadmeLoadedFromSource: boolean;
  localReadmeError: string | null;
  localReadmeContent: {
    fileName: string;
    plainText: string;
    truncated: boolean;
  } | null;
}

/**
 * RoomInfoPanel component displays repository information when a player enters a room.
 * Features include tabs for overview, README, file tree, and contributors.
 */
export function RoomInfoPanel() {
  const { getRoomDetails, cacheRoomDetails } = useGameScene();
  const incrementGitHubLinkClicks = useProgressionStore((state) => state.incrementGitHubLinkClicks);
  const [state, setState] = useState<PanelState>({
    isOpen: false,
    isLocalRoom: false,
    currentRoomId: null,
    currentRoomName: '',
    isLoading: false,
    error: null,
    data: null,
    localRoom: null,
    etags: {},
    loadingDeferred: {},
    activeTab: 'overview',
    currentOwner: null,
    currentRepoName: null,
    isLaunchingLocalPath: false,
    localLaunchMessage: null,
    localLaunchMessageKind: 'info',
    isLocalReadmeModalOpen: false,
    isLocalReadmeLoading: false,
    localReadmeLoadedFromSource: false,
    localReadmeError: null,
    localReadmeContent: null,
  });

  const clientRef = useRef<GitHubApiClient | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const visitedStamps = getVisitedStampsSystem();
  const preferredEditor = useMemo(() => loadPreferredEditorConfig(), []);
  const localAccessState = useMemo(() => getLocalRepoAccessState(), []);

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

        if (isLocalRepoSummary(event.repo)) {
          const localRoom = resolveLocalRoomPanelData(event.repo);
          setState((prev) => ({
            ...prev,
            isOpen: true,
            isLocalRoom: true,
            currentRoomId: event.roomId,
            currentRoomName: event.roomName,
            isLoading: false,
            error: localRoom ? null : 'Local room metadata is unavailable. Re-scan the selected folder and try again.',
            data: null,
            localRoom,
            etags: {},
            loadingDeferred: {},
            activeTab: 'overview',
            currentOwner: null,
            currentRepoName: null,
            isLaunchingLocalPath: false,
            localLaunchMessage: null,
            localLaunchMessageKind: 'info',
            isLocalReadmeModalOpen: false,
            isLocalReadmeLoading: false,
            localReadmeLoadedFromSource: false,
            localReadmeError: null,
            localReadmeContent: localRoom?.candidate.readmePreview ?? null,
          }));
          return;
        }

        // Check if we have cached data
        const cached = getRoomDetails(event.roomId);

        setState((prev) => ({
          ...prev,
          isOpen: true,
          isLocalRoom: false,
          currentRoomId: event.roomId,
          currentRoomName: event.roomName,
          isLoading: !cached,
          error: null,
          data: cached || null,
          localRoom: null,
          etags: {},
          loadingDeferred: {},
          activeTab: 'overview',
          currentOwner: (event.repo?.owner as string | undefined) ?? (event.repo?.ownerLogin as string | undefined) ?? null,
          currentRepoName: (event.repo?.name as string | undefined) ?? null,
          isLaunchingLocalPath: false,
          localLaunchMessage: null,
          localLaunchMessageKind: 'info',
          isLocalReadmeModalOpen: false,
          isLocalReadmeLoading: false,
          localReadmeLoadedFromSource: false,
          localReadmeError: null,
          localReadmeContent: null,
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

        const nextTab = activeTabByObject[event.objectType];
        if (prev.isLocalRoom && nextTab === 'contributors') {
          return prev;
        }

        return {
          ...prev,
          activeTab: nextTab,
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

  const handleLocalPathOpen = useCallback(
    async (request: {
      rootPathToken: string;
      repositoryPathToken: string;
      targetPathToken?: string;
    }, mode: LocalRoomLaunchMode) => {
      const accessApi = resolveLocalRoomAccessApi();
      if (!accessApi) {
        setState((prev) => ({
          ...prev,
          localLaunchMessageKind: 'error',
          localLaunchMessage: 'Opening local paths is unavailable in this runtime.',
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        isLaunchingLocalPath: true,
        localLaunchMessage: null,
        localLaunchMessageKind: 'info',
      }));

      try {
        const result = await accessApi.openPath({
          ...request,
          mode,
          preferredEditor: mode === 'preferred-editor' ? preferredEditor : undefined,
        });

        const message = result.ok
          ? result.fallbackUsed
            ? 'Opened with the system default application after preferred editor fallback.'
            : 'Path opened successfully.'
          : 'Unable to open the selected path.';

        setState((prev) => ({
          ...prev,
          isLaunchingLocalPath: false,
          localLaunchMessageKind: result.ok ? 'info' : 'error',
          localLaunchMessage: message,
        }));
      } catch {
        setState((prev) => ({
          ...prev,
          isLaunchingLocalPath: false,
          localLaunchMessageKind: 'error',
          localLaunchMessage: 'Unable to open the selected path.',
        }));
      }
    },
    [preferredEditor],
  );

  const handleLoadLocalReadme = useCallback(async () => {
    const localRoom = state.localRoom;
    if (!state.isLocalRoom || !localRoom) {
      return;
    }

    const accessApi = resolveLocalRoomAccessApi();
    if (!accessApi) {
      setState((prev) => ({
        ...prev,
        localReadmeError: 'Local README loading is unavailable in this runtime.',
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      isLocalReadmeLoading: true,
      localReadmeError: null,
    }));

    try {
      const result = await accessApi.loadReadme({
        rootPathToken: localRoom.candidate.rootPathToken,
        repositoryPathToken: localRoom.presentation.repositoryPathToken,
      });

      setState((prev) => ({
        ...prev,
        isLocalReadmeLoading: false,
        localReadmeLoadedFromSource: Boolean(result.readme),
        localReadmeContent: result.readme ?? prev.localReadmeContent,
        localReadmeError: result.readme ? null : (result.unavailableReason ?? 'Unable to load README.'),
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        isLocalReadmeLoading: false,
        localReadmeError: 'Unable to load README.',
      }));
    }
  }, [state.isLocalRoom, state.localRoom]);

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
  }, [state.isLocalReadmeModalOpen, state.isOpen, handleClose]);

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

  const { data, error, isLoading, activeTab, currentRoomName, isLocalRoom, localRoom } = state;
  const availableTabs = isLocalRoom ? (['overview', 'readme', 'files'] as const) : (['overview', 'readme', 'files', 'contributors'] as const);
  const localOpenActionsAvailable = localAccessState.environment === 'electron';

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
            {data && !isLocalRoom && (
              <a
                href={data.repo.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="room-info-github-link"
                aria-label={`Visit ${data.repo.fullName} on GitHub`}
                onClick={() => incrementGitHubLinkClicks()}
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
        {data && !isLocalRoom && (
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

        {localRoom && isLocalRoom && (
          <div className="room-info-stats">
            <div className="room-info-stat">
              <span className="stat-label">Files {localRoom.candidate.fileCount}</span>
            </div>
            <div className="room-info-stat">
              <span className="stat-label">Folders {localRoom.candidate.directoryCount}</span>
            </div>
            <div className="room-info-stat">
              <span className="stat-label">
                Commits {localRoom.candidate.git.commitCount ?? 'N/A'}
              </span>
            </div>
            <div className="room-info-stat">
              <span className="stat-label">Branch {localRoom.candidate.git.branch ?? 'Unknown'}</span>
            </div>
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
        {((data && !isLocalRoom) || (isLocalRoom && localRoom)) && !isLoading && !error && (
          <>
            <div className="room-info-tabs" role="tablist">
              {availableTabs.map((tab) => (
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
              {isLocalRoom && localRoom && activeTab === 'overview' && (
                <div
                  className="room-info-tab-panel"
                  id="room-info-overview"
                  role="tabpanel"
                  aria-labelledby="room-info-tab-overview"
                >
                  <div className="room-info-section">
                    <h3>Local Source</h3>
                    <p>Source: {localRoom.candidate.rootLabel}</p>
                    <p>Repository path: {localRoom.candidate.relativePath || localRoom.candidate.name}</p>
                    <p>Discovered: {new Date(localRoom.candidate.discoveredAt).toLocaleString()}</p>
                  </div>

                  <div className="room-info-section">
                    <h3>Launch Actions</h3>
                    <div className="room-info-local-actions">
                      <button
                        type="button"
                        className="room-info-retry"
                        onClick={() => handleLocalPathOpen(localRoom.presentation.actions.openRepositoryInSystemDefault, 'system-default')}
                        disabled={state.isLaunchingLocalPath || !localOpenActionsAvailable}
                      >
                        Open Repository
                      </button>
                      <button
                        type="button"
                        className="room-info-retry"
                        onClick={() => handleLocalPathOpen(localRoom.presentation.actions.openRepositoryInPreferredEditor, 'preferred-editor')}
                        disabled={state.isLaunchingLocalPath || !localOpenActionsAvailable}
                      >
                        Open in Editor
                      </button>
                    </div>
                    {!localOpenActionsAvailable && (
                      <p className="room-info-empty">
                        Opening local filesystem paths is only available in the Electron desktop app.
                      </p>
                    )}
                    {state.localLaunchMessage && (
                      <p
                        className={`room-info-launch-feedback room-info-launch-feedback-${state.localLaunchMessageKind}`}
                        role="status"
                        aria-live="polite"
                      >
                        {state.localLaunchMessage}
                      </p>
                    )}
                  </div>

                  <div className="room-info-section">
                    <h3>Git Signals</h3>
                    {localRoom.candidate.git.available ? (
                      <>
                        <p>
                          Contributors:{' '}
                          {localRoom.candidate.git.contributorCount ?? 'Unavailable in browser mode'}
                        </p>
                        <p>Last commit: {localRoom.candidate.git.lastCommitAt ?? 'Unknown'}</p>
                        <p>Dirty working tree: {localRoom.candidate.git.isDirty ? 'Yes' : 'No'}</p>
                        <p>Remotes discovered: {localRoom.candidate.git.remotes.length}</p>
                      </>
                    ) : (
                      <p>{localRoom.candidate.git.unavailableReason || 'Git metadata is unavailable in this runtime.'}</p>
                    )}
                  </div>

                  <div className="room-info-section">
                    <h3>Contributor Notes</h3>
                    <p>
                      Local mode contributor NPCs in rooms are thematic placeholders unless full git contributor metadata is available.
                    </p>
                    <p>
                      For accurate contributor counts and launch actions, use the Electron desktop app.
                    </p>
                  </div>

                  {Object.keys(localRoom.candidate.languageBreakdown).length > 0 && (
                    <div className="room-info-section">
                      <h3>Languages</h3>
                      <LanguageBar languages={localRoom.candidate.languageBreakdown} />
                    </div>
                  )}

                  <div className="room-info-section">
                    <h3>Project Signals</h3>
                    <p>README: {localRoom.candidate.filesystem.hasReadme ? 'Present' : 'Not found'}</p>
                    <p>License: {localRoom.candidate.filesystem.hasLicense ? 'Present' : 'Not found'}</p>
                    <p>package.json: {localRoom.candidate.filesystem.hasPackageJson ? 'Present' : 'Not found'}</p>
                    <p>TypeScript config: {localRoom.candidate.filesystem.hasTsConfig ? 'Present' : 'Not found'}</p>
                    <p>Python project files: {localRoom.candidate.filesystem.hasPyProject ? 'Present' : 'Not found'}</p>
                  </div>

                </div>
              )}

              {isLocalRoom && localRoom && activeTab === 'readme' && (
                <div
                  className="room-info-tab-panel"
                  id="room-info-readme"
                  role="tabpanel"
                  aria-labelledby="room-info-tab-readme"
                >
                  {state.localReadmeContent ? (
                    <div className="room-info-readme">
                      <p>
                        {state.localReadmeLoadedFromSource
                          ? state.localReadmeContent.plainText
                          : state.localReadmeContent.plainText.substring(0, 1000)}
                      </p>
                      {state.localReadmeContent.truncated && !state.localReadmeLoadedFromSource && (
                        <p className="room-info-truncated">[Truncated during local scan preview capture]</p>
                      )}
                    </div>
                  ) : (
                    <p className="room-info-empty">README content preview is unavailable for this repository.</p>
                  )}

                  {state.localReadmeError && <p className="room-info-empty">{state.localReadmeError}</p>}

                  {localRoom.candidate.filesystem.hasReadme && !state.localReadmeLoadedFromSource && (
                    <div className="room-info-section">
                      <button
                        type="button"
                        className="room-info-retry"
                        onClick={() => {
                          void handleLoadLocalReadme();
                        }}
                        disabled={state.isLocalReadmeLoading}
                      >
                        {state.isLocalReadmeLoading ? 'Loading README…' : 'Load Full README'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isLocalRoom && localRoom && activeTab === 'files' && (
                <div
                  className="room-info-tab-panel"
                  id="room-info-files"
                  role="tabpanel"
                  aria-labelledby="room-info-tab-files"
                >
                  <div className="room-info-section">
                    <h3>Top-level Files</h3>
                    {localRoom.candidate.topLevelTree.length > 0 ? (
                      <div className="room-info-files">
                        {localRoom.candidate.topLevelTree.slice(0, 30).map((entry) => (
                          <div key={`${entry.type}:${entry.path}`} className={`room-info-file room-info-file-${entry.type}`}>
                            <span className="file-icon">{entry.type === 'dir' ? '📁' : '📄'}</span>
                            <span className="file-name">{entry.path}</span>
                          </div>
                        ))}
                        {localRoom.candidate.topLevelTree.length > 30 && (
                          <p className="room-info-truncated">+{localRoom.candidate.topLevelTree.length - 30} more entries</p>
                        )}
                      </div>
                    ) : (
                      <p className="room-info-empty">No top-level entries were captured for this repository.</p>
                    )}
                  </div>

                  <BasementExplorer
                    nodes={localRoom.presentation.basementNodes}
                    isLaunching={state.isLaunchingLocalPath}
                    onOpenPath={(node, mode) => {
                      void handleLocalPathOpen(
                        {
                          ...node.openInSystemDefault,
                        },
                        mode,
                      );
                    }}
                  />
                  {state.localLaunchMessage && (
                    <p
                      className={`room-info-launch-feedback room-info-launch-feedback-${state.localLaunchMessageKind}`}
                      role="status"
                      aria-live="polite"
                    >
                      {state.localLaunchMessage}
                    </p>
                  )}
                </div>
              )}

              {/* Overview Tab */}
              {!isLocalRoom && data && activeTab === 'overview' && (
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
              {!isLocalRoom && data && activeTab === 'readme' && (
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
              {!isLocalRoom && data && activeTab === 'files' && (
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
              {!isLocalRoom && data && activeTab === 'contributors' && (
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

function isLocalRepoSummary(repo: Record<string, unknown>): boolean {
  const topics = Array.isArray(repo.topics) ? repo.topics : [];
  if (topics.some((topic) => String(topic).toLowerCase() === 'local')) {
    return true;
  }

  const htmlUrl = typeof repo.htmlUrl === 'string' ? repo.htmlUrl : '';
  return htmlUrl.startsWith('file://');
}

function resolveLocalRoomPanelData(repo: Record<string, unknown>): LocalRoomPanelData | null {
  const fullName = typeof repo.fullName === 'string' ? repo.fullName : '';
  if (!fullName.includes('/')) {
    return null;
  }

  const selectedSourceRaw = localStorage.getItem(STORAGE_KEYS.selectedSource);
  if (!selectedSourceRaw) {
    return null;
  }

  const selectedSource = parseSourceIdentityFromStorage(selectedSourceRaw);
  if (!selectedSource || selectedSource.kind !== 'local') {
    return null;
  }

  const localSelection = loadLocalSourceSelection();
  if (!localSelection || localSelection.rootId !== selectedSource.rootId) {
    return null;
  }

  const cachedScan = loadLocalScanCache(localSelection.rootId);
  if (!cachedScan) {
    return null;
  }

  const [rootLabel, ...pathParts] = fullName.split('/');
  const relativePath = pathParts.join('/');
  const candidate = cachedScan.scan.repositories.find((entry) => {
    if (entry.rootLabel !== rootLabel) {
      return false;
    }

    const expectedPath = entry.relativePath || entry.name;
    return expectedPath === relativePath;
  });

  if (!candidate) {
    return null;
  }

  const presentation = buildLocalRoomPresentationData(
    {
      rootPathToken: candidate.rootPathToken,
      relativePath: candidate.relativePath,
    },
    candidate.relativeDirectoryPaths,
    cachedScan.scan.ignoredFolders,
  );

  if (!presentation) {
    return null;
  }

  return {
    candidate,
    presentation,
  };
}

function resolveLocalRoomAccessApi(): LocalRepoAccessApi | null {
  const localState = getLocalRepoAccessState();
  if (!localState.isLocalRepoModeAvailable) {
    return null;
  }

  if (localState.environment === 'electron') {
    return electronLocalRepoAccess;
  }

  if (localState.environment === 'trusted-local-web') {
    return trustedLocalBrowserAccess;
  }

  return null;
}

function loadPreferredEditorConfig(): LocalPreferredEditorConfig | null {
  try {
    const raw = localStorage.getItem('repo-dungeon:v1:preferred-editor');
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as LocalPreferredEditorConfig;
    if (!parsed || typeof parsed.command !== 'string' || parsed.command.trim().length === 0) {
      return null;
    }

    return {
      command: parsed.command.trim(),
      args: Array.isArray(parsed.args) ? parsed.args.filter((arg) => typeof arg === 'string') : undefined,
    };
  } catch {
    return null;
  }
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
