import { useCallback, useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { createGame } from '@/game/createGame';
import { GitHubAuthPanel } from '@/ui/components/GitHubAuthPanel';
import { GameContextProvider } from '@/ui/context/GameContext';
import { Minimap } from '@/ui/components/Minimap';
import { FullMapOverlay } from '@/ui/components/FullMapOverlay';
import { RoomInfoPanel } from '@/ui/components/RoomInfoPanel';
import { CharacterSelect } from '@/ui/components/CharacterSelect';
import { InventoryPanel } from '@/ui/components/InventoryPanel';
import { AudioControls } from '@/ui/components/AudioControls';
import { GamePolishOverlay } from '@/ui/components/GamePolishOverlay';
import { WelcomeScreen } from '@/ui/components/WelcomeScreen';
import { HelpOverlay } from '@/ui/components/HelpOverlay';
import { decodeShareableDungeonUrl } from '@/ui/systems/shareUrl';
import { useSessionStore } from '@/store/sessionStore';
import { useDungeonStore } from '@/store/dungeonStore';
import '@/ui/styles/help-overlay.css';

export function AppShell() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [game, setGame] = useState<Phaser.Game | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const setUsernameInput = useSessionStore((state) => state.setUsernameInput);
  const setSeed = useDungeonStore((state) => state.setSeed);

  const openHelp = useCallback(() => setShowHelp(true), []);
  const closeHelp = useCallback(() => setShowHelp(false), []);
  const handleStart = useCallback(() => setShowWelcome(false), []);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const newGame = createGame(hostRef.current);
    setGame(newGame);
    return () => {
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
            <Minimap />
            <FullMapOverlay />
            <RoomInfoPanel />
            <GitHubAuthPanel />
            <CharacterSelect />
            <InventoryPanel />
            <AudioControls />
            <GamePolishOverlay />
            <button
              className="help-hud-btn"
              onClick={openHelp}
              aria-label="How to play (H)"
              title="How to play (H)"
            >
              ?
            </button>
          </>
        )}
        {showWelcome && (
          <WelcomeScreen onStart={handleStart} onHelp={openHelp} />
        )}
        {showHelp && <HelpOverlay onClose={closeHelp} />}
        <p className="overlay">Repo Dungeon</p>
      </main>
    </GameContextProvider>
  );
}
