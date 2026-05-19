import { useEffect, useRef, useState } from 'react';
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
import { decodeShareableDungeonUrl } from '@/ui/systems/shareUrl';
import { useSessionStore } from '@/store/sessionStore';
import { useDungeonStore } from '@/store/dungeonStore';

export function AppShell() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [game, setGame] = useState<Phaser.Game | null>(null);
  const setUsernameInput = useSessionStore((state) => state.setUsernameInput);
  const setSeed = useDungeonStore((state) => state.setSeed);

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

  return (
    <GameContextProvider game={game}>
      <main className="app-shell">
        <div className="game-root" ref={hostRef} />
        <Minimap />
        <FullMapOverlay />
        <RoomInfoPanel />
        <GitHubAuthPanel />
        <CharacterSelect />
        <InventoryPanel />
        <AudioControls />
        <GamePolishOverlay />
        <p className="overlay">Repo Dungeon — Phase 5 Polish & Biomes</p>
      </main>
    </GameContextProvider>
  );
}
