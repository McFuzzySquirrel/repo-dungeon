import '@/ui/styles/game-hud-controls.css';

interface GameHudControlsProps {
  onOpenHelp: () => void;
  onOpenHome: () => void;
}

export function GameHudControls({ onOpenHelp, onOpenHome }: GameHudControlsProps) {
  return (
    <section className="game-hud-controls" aria-label="Game controls">
      <button type="button" className="game-hud-btn" onClick={onOpenHome}>
        Home
      </button>
      <button type="button" className="game-hud-btn" onClick={onOpenHelp}>
        Help
      </button>
    </section>
  );
}
