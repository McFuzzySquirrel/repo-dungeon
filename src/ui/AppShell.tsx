import { useCallback, useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { createGame } from '@/game/createGame';
import { GameContextProvider } from '@/ui/context/GameContext';
import { Minimap } from '@/ui/components/Minimap';
import { FullMapOverlay } from '@/ui/components/FullMapOverlay';
import { RoomInfoPanel } from '@/ui/components/RoomInfoPanel';
import { CharacterSelect } from '@/ui/components/CharacterSelect';
import { InventoryPanel } from '@/ui/components/InventoryPanel';
import { AudioControls } from '@/ui/components/AudioControls';
import { GamePolishOverlay } from '@/ui/components/GamePolishOverlay';
import { GameHudControls } from '@/ui/components/GameHudControls';
import { TouchControls } from '@/ui/components/TouchControls';
import { WelcomeScreen } from '@/ui/components/WelcomeScreen';
import { HelpOverlay } from '@/ui/components/HelpOverlay';
import { ProgressionController } from '@/ui/components/ProgressionController';
import { XpHud } from '@/ui/components/XpHud';
import { decodeShareableDungeonUrl } from '@/ui/systems/shareUrl';
import { useGitHubAuth } from '@/ui/hooks/useGitHubAuth';
import { useSessionStore } from '@/store/sessionStore';
import { useDungeonStore } from '@/store/dungeonStore';
import type { GitHubRepoSummary } from '@/github/types';
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
  const auth = useGitHubAuth();
  const setUsernameInput = useSessionStore((state) => state.setUsernameInput);
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
    setShowWelcome(false);
  }, [restartDungeonWithRepos]);

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
    const sharedState = decodeShareableDungeonUrl(window.location.href);
    if (!sharedState) {
      return;
    }

    setUsernameInput(sharedState.username);
    if (sharedState.seed) {
      setSeed(sharedState.seed);
    }
  }, [setSeed, setUsernameInput]);

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
            <InventoryPanel />
            <AudioControls />
            <GamePolishOverlay />
            <XpHud />
            <TouchControls />
            <GameHudControls onOpenHelp={openHelp} onOpenHome={() => setShowWelcome(true)} />
          </>
        )}
        {showWelcome && (
          <WelcomeScreen auth={auth} onStart={handleStart} onLoadAndStart={handleLoadAndStart} onHelp={openHelp} />
        )}
        {showHelp && <HelpOverlay onClose={closeHelp} />}
        <p className="overlay">Repo Dungeon</p>
      </main>
    </GameContextProvider>
  );
}
