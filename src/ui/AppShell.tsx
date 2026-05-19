import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { createGame } from '@/game/createGame';
import { GitHubAuthPanel } from '@/ui/components/GitHubAuthPanel';
import { GameContextProvider } from '@/ui/context/GameContext';
import { Minimap } from '@/ui/components/Minimap';
import { FullMapOverlay } from '@/ui/components/FullMapOverlay';

export function AppShell() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [game, setGame] = useState<Phaser.Game | null>(null);

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

  return (
    <GameContextProvider game={game}>
      <main className="app-shell">
        <div className="game-root" ref={hostRef} />
        <Minimap />
        <FullMapOverlay />
        <GitHubAuthPanel />
        <p className="overlay">Repo Dungeon — Phase 2 Map Systems</p>
      </main>
    </GameContextProvider>
  );
}
