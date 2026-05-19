import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TouchControls } from '@/ui/components/TouchControls';
import type { GameContextType } from '@/ui/context/GameContext';
import type Phaser from 'phaser';

const mockUseGameScene = vi.fn<() => GameContextType>();

vi.mock('@/ui/context/GameContext', () => ({
  useGameScene: () => mockUseGameScene(),
}));

function makeGameContext(overrides: Partial<GameContextType>): GameContextType {
  return {
    game: null,
    dungeon: null,
    playerState: null,
    currentRoom: null,
    isReady: false,
    roomDetailsCache: new Map(),
    cacheRoomDetails: vi.fn(),
    getRoomDetails: vi.fn(),
    ...overrides,
  };
}

function makeMockGame(scene: {
  setVirtualDirection: ReturnType<typeof vi.fn>;
  clearVirtualDirections: ReturnType<typeof vi.fn>;
  requestInteraction: ReturnType<typeof vi.fn>;
}): Phaser.Game {
  return {
    scene: {
      getScene: vi.fn(() => scene) as unknown as Phaser.Scenes.SceneManager['getScene'],
    },
  } as unknown as Phaser.Game;
}

function setTouchEnvironment({ coarsePointer, maxTouchPoints }: { coarsePointer: boolean; maxTouchPoints: number }) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: coarsePointer,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });

  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    configurable: true,
    value: maxTouchPoints,
  });
}

describe('TouchControls', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders nothing when touch UI is not preferred', () => {
    setTouchEnvironment({ coarsePointer: false, maxTouchPoints: 0 });
    mockUseGameScene.mockReturnValue(makeGameContext({
      game: makeMockGame({
        setVirtualDirection: vi.fn(),
        clearVirtualDirections: vi.fn(),
        requestInteraction: vi.fn(),
      }),
      isReady: true,
    }));

    render(<TouchControls />);

    expect(screen.queryByLabelText('Touch controls')).not.toBeInTheDocument();
  });

  it('renders for touch devices even before the broader game context reports ready', () => {
    setTouchEnvironment({ coarsePointer: true, maxTouchPoints: 1 });
    mockUseGameScene.mockReturnValue(makeGameContext({
      game: makeMockGame({
        setVirtualDirection: vi.fn(),
        clearVirtualDirections: vi.fn(),
        requestInteraction: vi.fn(),
      }),
      isReady: false,
    }));

    render(<TouchControls />);

    expect(screen.getByLabelText('Touch controls')).toBeInTheDocument();
  });

  it('sends direction and interact input to the active dungeon scene for coarse-pointer devices', () => {
    setTouchEnvironment({ coarsePointer: true, maxTouchPoints: 0 });
    const setVirtualDirection = vi.fn();
    const clearVirtualDirections = vi.fn();
    const requestInteraction = vi.fn();
    const scene = {
      setVirtualDirection,
      clearVirtualDirections,
      requestInteraction,
    };

    mockUseGameScene.mockReturnValue(makeGameContext({
      game: makeMockGame(scene),
      isReady: true,
    }));

    const { unmount } = render(<TouchControls />);

    const moveUp = screen.getByRole('button', { name: 'Move up' });
    fireEvent.pointerDown(moveUp, { pointerId: 1 });
    fireEvent.pointerUp(moveUp, { pointerId: 1 });

    expect(setVirtualDirection).toHaveBeenNthCalledWith(1, 'up', true);
    expect(setVirtualDirection).toHaveBeenNthCalledWith(2, 'up', false);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Interact' }), { pointerId: 2 });

    expect(requestInteraction).toHaveBeenCalledTimes(1);

    unmount();

    expect(clearVirtualDirections).toHaveBeenCalledTimes(1);
  });
});