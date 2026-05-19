import { useEffect, useRef } from 'react';
import { createGame } from '@/game/createGame';
import { GitHubAuthPanel } from '@/ui/components/GitHubAuthPanel';

export function AppShell() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const game = createGame(hostRef.current);
    return () => {
      game.destroy(true);
    };
  }, []);

  return (
    <main className="app-shell">
      <div className="game-root" ref={hostRef} />
      <GitHubAuthPanel />
      <p className="overlay">Repo Dungeon — Phase 1 Foundation</p>
    </main>
  );
}
