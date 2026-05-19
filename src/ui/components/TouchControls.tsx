import { useEffect, useMemo, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useGameScene } from '@/ui/context/GameContext';
import '@/ui/styles/touch-controls.css';

type DirectionKey = 'up' | 'down' | 'left' | 'right';

interface TouchControllableScene {
  setVirtualDirection: (direction: DirectionKey, isPressed: boolean) => void;
  clearVirtualDirections: () => void;
  requestInteraction: () => void;
}

const INITIAL_DIRECTION_STATE: Record<DirectionKey, boolean> = {
  up: false,
  down: false,
  left: false,
  right: false,
};

const DIRECTION_LABELS: Record<DirectionKey, string> = {
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
};

function isTouchUiPreferred(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const hasCoarsePointer = typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;
  const hasTouchPoints = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  return hasCoarsePointer || hasTouchPoints;
}

export function TouchControls() {
  const { game } = useGameScene();
  const [isTouchUiEnabled, setIsTouchUiEnabled] = useState(() => isTouchUiPreferred());
  const [pressedDirections, setPressedDirections] = useState(INITIAL_DIRECTION_STATE);

  const dungeonScene = useMemo(() => {
    if (!game) {
      return null;
    }

    return game.scene.getScene('DungeonScene') as unknown as TouchControllableScene | null;
  }, [game]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(pointer: coarse)');
    const updatePreference = () => {
      setIsTouchUiEnabled(mediaQuery.matches || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0));
    };

    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);
    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    return () => {
      dungeonScene?.clearVirtualDirections();
    };
  }, [dungeonScene]);

  if (!isTouchUiEnabled || !dungeonScene) {
    return null;
  }

  const setDirectionState = (direction: DirectionKey, isPressed: boolean) => {
    dungeonScene.setVirtualDirection(direction, isPressed);
    setPressedDirections((current) => ({
      ...current,
      [direction]: isPressed,
    }));
  };

  const handleDirectionPress = (direction: DirectionKey) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDirectionState(direction, true);
  };

  const handleDirectionRelease = (direction: DirectionKey) => () => {
    setDirectionState(direction, false);
  };

  return (
    <section className="touch-controls" aria-label="Touch controls">
      <div className="touch-controls__dpad" aria-label="Movement controls">
        {(['up', 'left', 'right', 'down'] as DirectionKey[]).map((direction) => (
          <button
            key={direction}
            type="button"
            className={`touch-controls__button touch-controls__button--${direction}${pressedDirections[direction] ? ' is-pressed' : ''}`}
            aria-label={`Move ${DIRECTION_LABELS[direction].toLowerCase()}`}
            onPointerDown={handleDirectionPress(direction)}
            onPointerUp={handleDirectionRelease(direction)}
            onPointerCancel={handleDirectionRelease(direction)}
            onPointerLeave={handleDirectionRelease(direction)}
          >
            <span aria-hidden="true">{DIRECTION_LABELS[direction]}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="touch-controls__interact"
        aria-label="Interact"
        onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
          event.preventDefault();
          dungeonScene.requestInteraction();
        }}
      >
        Interact
      </button>
    </section>
  );
}