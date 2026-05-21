import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GitHubRepoSummary } from '@/github/types';
import type { LocalRepoAccessState } from '@/localRepos/browserAccess';
import { createLocalSourceSelectionFromPick, trustedLocalBrowserAccess } from '@/localRepos/browserAccess';
import {
  loadLocalScanCache,
  loadLocalSourceSelection,
  saveLocalScanCache,
  saveLocalSourceSelection,
} from '@/localRepos/cache';
import { electronLocalRepoAccess } from '@/localRepos/electronAccess';
import { toNormalizedLocalRooms } from '@/localRepos/metadata';
import type {
  LocalRepoAccessApi,
  LocalScanProgress,
  LocalRepoScanResult,
  LocalSourceSelection,
} from '@/localRepos/types';
import { DEFAULT_IGNORED_FOLDERS } from '@/localRepos/types';
import { buildLocalSourceRootId } from '@/repository/source';

export type RepositorySourceStatus = 'idle' | 'picking' | 'scanning' | 'ready' | 'error';

export interface UseRepositorySourceResult {
  status: RepositorySourceStatus;
  selection: LocalSourceSelection | null;
  scanResult: LocalRepoScanResult | null;
  scanProgress: LocalScanProgress | null;
  cachedAt: string | null;
  roomCount: number;
  errorMessage: string | null;
  hasCachedResults: boolean;
  pickAndScan: () => Promise<LocalSourceLoadResult | null>;
  scanCurrentSelection: () => Promise<LocalSourceLoadResult | null>;
  startFromCache: () => LocalSourceLoadResult | null;
}

export interface LocalSourceLoadResult {
  repos: GitHubRepoSummary[];
  selection: LocalSourceSelection;
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return 'Unable to scan local repositories. Try re-selecting a folder and scanning again.';
}

function toDungeonSummaries(scan: LocalRepoScanResult): GitHubRepoSummary[] {
  return toNormalizedLocalRooms(scan.repositories).map((room) => room.asDungeonRoom);
}

function toSelectionFromPick(
  pick: { rootPathToken: string; rootLabel: string },
  environment: LocalRepoAccessState['environment'],
): LocalSourceSelection {
  if (environment === 'trusted-local-web') {
    return createLocalSourceSelectionFromPick({
      rootPathToken: pick.rootPathToken,
      rootLabel: pick.rootLabel,
      canPersist: true,
    });
  }

  return {
    rootPathToken: pick.rootPathToken,
    rootLabel: pick.rootLabel,
    rootId: buildLocalSourceRootId(pick.rootPathToken),
    pickedAt: new Date().toISOString(),
  };
}

function resolveLocalAccessApi(localRepoAccess: LocalRepoAccessState): LocalRepoAccessApi | null {
  if (!localRepoAccess.isLocalRepoModeAvailable) {
    return null;
  }

  if (localRepoAccess.environment === 'electron') {
    return electronLocalRepoAccess;
  }

  if (localRepoAccess.environment === 'trusted-local-web') {
    return trustedLocalBrowserAccess;
  }

  return null;
}

interface UseRepositorySourceOptions {
  localRepoAccess: LocalRepoAccessState;
}

export function useRepositorySource({ localRepoAccess }: UseRepositorySourceOptions): UseRepositorySourceResult {
  const [status, setStatus] = useState<RepositorySourceStatus>('idle');
  const [selection, setSelection] = useState<LocalSourceSelection | null>(null);
  const [scanResult, setScanResult] = useState<LocalRepoScanResult | null>(null);
  const [scanProgress, setScanProgress] = useState<LocalScanProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [hasCachedResults, setHasCachedResults] = useState(false);

  const accessApi = useMemo(() => resolveLocalAccessApi(localRepoAccess), [localRepoAccess]);

  useEffect(() => {
    if (!localRepoAccess.isLocalRepoModeAvailable) {
      setSelection(null);
      setScanResult(null);
      setScanProgress(null);
      setCachedAt(null);
      setHasCachedResults(false);
      setErrorMessage(null);
      setStatus('idle');
      return;
    }

    const savedSelection = loadLocalSourceSelection();
    if (!savedSelection) {
      setHasCachedResults(false);
      return;
    }

    setSelection(savedSelection);
    const cachedSnapshot = loadLocalScanCache(savedSelection.rootId);
    if (!cachedSnapshot) {
      setHasCachedResults(false);
      return;
    }

    setScanResult(cachedSnapshot.scan);
    setCachedAt(cachedSnapshot.cachedAt);
    setHasCachedResults(true);
    setStatus('ready');
  }, [localRepoAccess.isLocalRepoModeAvailable]);

  const scanWithSelection = useCallback(
    async (nextSelection: LocalSourceSelection): Promise<LocalSourceLoadResult | null> => {
      if (!accessApi) {
        const unavailable = 'Local repository scanning is unavailable in this runtime.';
        setErrorMessage(unavailable);
        setStatus('error');
        setScanProgress({
          phase: 'error',
          scannedDirectories: 0,
          discoveredRepositories: 0,
          currentPath: null,
          message: unavailable,
        });
        return null;
      }

      setStatus('scanning');
      setErrorMessage(null);
      setScanProgress({
        phase: 'scanning',
        scannedDirectories: 0,
        discoveredRepositories: 0,
        currentPath: nextSelection.rootLabel,
        message: 'Scanning selected folder for git repositories...',
      });

      try {
        const scan = await accessApi.scanParentFolder(nextSelection.rootPathToken, {
          ignoredFolders: [...DEFAULT_IGNORED_FOLDERS],
          includeGitMetadata: true,
          onProgress: (progress) => setScanProgress(progress),
        });

        const roomSummaries = toDungeonSummaries(scan);
        saveLocalSourceSelection(nextSelection);
        saveLocalScanCache(nextSelection, scan);

        setSelection(nextSelection);
        setScanResult(scan);
        setCachedAt(new Date().toISOString());
        setHasCachedResults(true);
        setErrorMessage(null);
        setStatus('ready');

        return { repos: roomSummaries, selection: nextSelection };
      } catch (error) {
        const message = normalizeErrorMessage(error);
        setErrorMessage(message);
        setStatus('error');
        setScanProgress((previous: LocalScanProgress | null) => ({
          phase: 'error',
          scannedDirectories: previous?.scannedDirectories ?? 0,
          discoveredRepositories: previous?.discoveredRepositories ?? 0,
          currentPath: previous?.currentPath ?? null,
          message,
        }));
        return null;
      }
    },
    [accessApi],
  );

  const pickAndScan = useCallback(async (): Promise<LocalSourceLoadResult | null> => {
    if (!accessApi) {
      const unavailable = 'Local repository scanning is unavailable in this runtime.';
      setErrorMessage(unavailable);
      setStatus('error');
      return null;
    }

    setStatus('picking');
    setErrorMessage(null);

    try {
      const picked = await accessApi.pickParentFolder();
      if (!picked) {
        setStatus(scanResult ? 'ready' : 'idle');
        return null;
      }

      const nextSelection = toSelectionFromPick(
        {
          rootPathToken: picked.rootPathToken,
          rootLabel: picked.rootLabel,
        },
        localRepoAccess.environment,
      );

      setSelection(nextSelection);
      return scanWithSelection(nextSelection);
    } catch (error) {
      const message = normalizeErrorMessage(error);
      setErrorMessage(message);
      setStatus('error');
      return null;
    }
  }, [accessApi, localRepoAccess.environment, scanResult, scanWithSelection]);

  const scanCurrentSelection = useCallback(async (): Promise<LocalSourceLoadResult | null> => {
    if (!selection) {
      return pickAndScan();
    }

    return scanWithSelection(selection);
  }, [pickAndScan, scanWithSelection, selection]);

  const startFromCache = useCallback((): LocalSourceLoadResult | null => {
    if (!selection) {
      return null;
    }

    const snapshot = loadLocalScanCache(selection.rootId);
    if (!snapshot) {
      setHasCachedResults(false);
      return null;
    }

    setScanResult(snapshot.scan);
    setCachedAt(snapshot.cachedAt);
    setHasCachedResults(true);
    setStatus('ready');
    setErrorMessage(null);
    return {
      repos: toDungeonSummaries(snapshot.scan),
      selection,
    };
  }, [selection]);

  return {
    status,
    selection,
    scanResult,
    scanProgress,
    cachedAt,
    roomCount: scanResult?.repositories.length ?? 0,
    errorMessage,
    hasCachedResults,
    pickAndScan,
    scanCurrentSelection,
    startFromCache,
  };
}
