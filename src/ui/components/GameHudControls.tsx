import { useEffect, useState } from 'react';
import { useGameScene } from '@/ui/context/GameContext';
import '@/ui/styles/game-hud-controls.css';

interface GameHudControlsProps {
  onOpenHelp: () => void;
  onOpenHome: () => void;
}

interface ZoomableScene {
  setPreferredZoom: (zoom: number) => void;
}

const MIN_ZOOM = 0.85;
const MAX_ZOOM = 2.4;
const STEP = 0.15;

export function GameHudControls({ onOpenHelp, onOpenHome }: GameHudControlsProps) {
  const { game, isReady } = useGameScene();
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!game || !isReady) {
      return;
    }

    const dungeonScene = game.scene.getScene('DungeonScene') as unknown as ZoomableScene | null;
    dungeonScene?.setPreferredZoom(zoom);
  }, [game, isReady, zoom]);

  return (
    <section className="game-hud-controls" aria-label="Game controls">
      <button type="button" className="game-hud-btn" onClick={onOpenHome}>
        Home
      </button>
      <div className="game-hud-zoom" aria-label="Zoom controls">
        <button
          type="button"
          className="game-hud-btn"
          onClick={() => setZoom((value) => Math.max(MIN_ZOOM, Number((value - STEP).toFixed(2))))}
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          className="game-hud-zoom-readout"
          onClick={() => setZoom(1)}
          aria-label="Reset zoom"
          title="Reset zoom"
        >
          {(zoom * 100).toFixed(0)}%
        </button>
        <button
          type="button"
          className="game-hud-btn"
          onClick={() => setZoom((value) => Math.min(MAX_ZOOM, Number((value + STEP).toFixed(2))))}
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
      <button type="button" className="game-hud-btn" onClick={onOpenHelp}>
        Help
      </button>
    </section>
  );
}
