import { useCallback, useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { createGame } from '@/game/createGame';
import { GameContextProvider } from '@/ui/context/GameContext';
import { Minimap } from '@/ui/components/Minimap';
import { FullMapOverlay } from '@/ui/components/FullMapOverlay';
import { RoomInfoPanel } from '@/ui/components/RoomInfoPanel';
import { CharacterSelect } from '@/ui/components/CharacterSelect';
import { InventoryPanel } from '@/ui/components/InventoryPanel';
import { BadgePanel } from '@/ui/components/BadgePanel';
import { AudioControls } from '@/ui/components/AudioControls';
import { GamePolishOverlay } from '@/ui/components/GamePolishOverlay';
import { GameHudControls } from '@/ui/components/GameHudControls';
import { SelectedCharacterCard } from '@/ui/components/SelectedCharacterCard';
import { TouchControls } from '@/ui/components/TouchControls';
import { WelcomeScreen } from '@/ui/components/WelcomeScreen';
import { HelpOverlay } from '@/ui/components/HelpOverlay';
import { ProgressionController } from '@/ui/components/ProgressionController';
import { XpHud } from '@/ui/components/XpHud';
import { RateLimitHud } from '@/ui/components/RateLimitHud';
import { decodeShareableDungeonUrl } from '@/ui/systems/shareUrl';
import { getLocalRepoAccessState } from '@/localRepos/browserAccess';
import { parseSourceIdentityFromStorage, serializeSourceIdentityForStorage } from '@/repository/source';
import { STORAGE_KEYS } from '@/store/persistence';
import { useSessionStore } from '@/store/sessionStore';
import { useDungeonStore } from '@/store/dungeonStore';
import { useProgressionStore } from '@/store/progressionStore';
import type { GitHubRepoSummary } from '@/github/types';
import type { LocalSourceSelection } from '@/localRepos/types';
import '@/ui/styles/help-overlay.css';

interface RestartableScene {
  scene: { restart: (data: { repos: GitHubRepoSummary[]; username?: string; seed?: string }) => void };
}

export function AppShell() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [game, setGame] = useState<Phaser.Game | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [localRepoAccess] = useState(getLocalRepoAccessState);
  const usernameInput = useSessionStore((state) => state.usernameInput);
  const setSelectedSourceKind = useSessionStore((state) => state.setSelectedSourceKind);
  const selectedSourceKind = useSessionStore((state) => state.selectedSourceKind);
  const setUsernameInput = useSessionStore((state) => state.setUsernameInput);
  const rehydrateProgressionFromSource = useProgressionStore((state) => state.rehydrateFromActiveSource);
  const dungeonSeed = useDungeonStore((state) => state.seed);
  const setSeed = useDungeonStore((state) => state.setSeed);

  const openHelp = useCallback(() => setShowHelp(true), []);
  const closeHelp = useCallback(() => setShowHelp(false), []);
  const handleStart = useCallback(() => setShowWelcome(false), []);

  const restartDungeonWithRepos = useCallback((repos: GitHubRepoSummary[], username: string) => {
    const g = gameRef.current;
    if (!g) return;
    const scene = g.scene.getScene('DungeonScene') as unknown as RestartableScene | null;
    scene?.scene.restart({ repos, username, seed: dungeonSeed ?? undefined });
  }, [dungeonSeed]);

  const handleLoadAndStart = useCallback((repos: GitHubRepoSummary[], username: string) => {
    restartDungeonWithRepos(repos, username);
    setSelectedSourceKind('github');
    localStorage.setItem(
      STORAGE_KEYS.selectedSource,
      serializeSourceIdentityForStorage({ kind: 'github', username }),
    );
    rehydrateProgressionFromSource();
    setShowWelcome(false);
  }, [rehydrateProgressionFromSource, restartDungeonWithRepos, setSelectedSourceKind]);

  const handleLoadLocalAndStart = useCallback((repos: GitHubRepoSummary[], source: LocalSourceSelection) => {
    restartDungeonWithRepos(repos, source.rootLabel);
    setSelectedSourceKind('local');
    localStorage.setItem(
      STORAGE_KEYS.selectedSource,
      serializeSourceIdentityForStorage({ kind: 'local', rootId: source.rootId }),
    );
    rehydrateProgressionFromSource();
    setShowWelcome(false);
  }, [rehydrateProgressionFromSource, restartDungeonWithRepos, setSelectedSourceKind]);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const newGame = createGame(hostRef.current);
    gameRef.current = newGame;
    setGame(newGame);
    return () => {
      gameRef.current = null;
      newGame.destroy(true);
    };
  }, []);

  useEffect(() => {
    try {
      const rawSelectedSource = localStorage.getItem(STORAGE_KEYS.selectedSource);
      if (!rawSelectedSource) {
        setSelectedSourceKind('github');
        rehydrateProgressionFromSource();
        return;
      }

      const parsedSource = parseSourceIdentityFromStorage(rawSelectedSource);
      if (!parsedSource) {
        setSelectedSourceKind('github');
        rehydrateProgressionFromSource();
        return;
      }

      if (parsedSource.kind === 'github') {
        setSelectedSourceKind('github');
        setUsernameInput(parsedSource.username);
        rehydrateProgressionFromSource();
        return;
      }

      if (parsedSource.kind === 'local' && localRepoAccess.isLocalRepoModeAvailable) {
        setSelectedSourceKind('local');
        rehydrateProgressionFromSource();
        return;
      }

      setSelectedSourceKind('github');
      rehydrateProgressionFromSource();
    } catch {
      setSelectedSourceKind('github');
      rehydrateProgressionFromSource();
    }
  }, [localRepoAccess.isLocalRepoModeAvailable, rehydrateProgressionFromSource, setSelectedSourceKind, setUsernameInput]);

  useEffect(() => {
    try {
      if (selectedSourceKind === 'local') {
        if (!localRepoAccess.isLocalRepoModeAvailable) {
          setSelectedSourceKind('github');
          return;
        }
        return;
      }

      const trimmedUsername = usernameInput.trim();
      if (!trimmedUsername) {
        return;
      }

      localStorage.setItem(
        STORAGE_KEYS.selectedSource,
        serializeSourceIdentityForStorage({ kind: 'github', username: trimmedUsername }),
      );
    } catch {
      // ignore localStorage write failures
    }
  }, [localRepoAccess.isLocalRepoModeAvailable, selectedSourceKind, setSelectedSourceKind, usernameInput]);

  useEffect(() => {
    const sharedState = decodeShareableDungeonUrl(window.location.href);
    if (!sharedState) {
      return;
    }

    setSelectedSourceKind('github');
    setUsernameInput(sharedState.username);
    if (sharedState.seed) {
      setSeed(sharedState.seed);
    }
  }, [setSeed, setSelectedSourceKind, setUsernameInput]);

  // H key toggles help from anywhere (but not when typing in an input)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'h' || e.key === 'H') {
        setShowHelp((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <GameContextProvider game={game}>
      <main className="app-shell">
        <div className="game-root" ref={hostRef} />
        {!showWelcome && (
          <>
            <ProgressionController />
            <Minimap />
            <FullMapOverlay />
            <RoomInfoPanel />
            <CharacterSelect />
            <AudioControls />
            <TouchControls />
            <RateLimitHud />
            <aside className="game-hud-dock" aria-label="Player HUD">
              <XpHud />
              <SelectedCharacterCard />
              <div className="game-hud-toolbar">
                <div className="game-hud-actions">
                  <InventoryPanel />
                  <BadgePanel />
                </div>
                <GameHudControls onOpenHelp={openHelp} onOpenHome={() => setShowWelcome(true)} />
              </div>
              <GamePolishOverlay />
            </aside>
          </>
        )}
        {showWelcome && (
          <WelcomeScreen
            onStart={handleStart}
            onLoadAndStart={handleLoadAndStart}
            onLoadLocalAndStart={handleLoadLocalAndStart}
            onHelp={openHelp}
            localRepoAccess={localRepoAccess}
          />
        )}
        {showHelp && <HelpOverlay onClose={closeHelp} />}
        <p className="overlay">Repo Dungeon</p>
      </main>
    </GameContextProvider>
  );
}
