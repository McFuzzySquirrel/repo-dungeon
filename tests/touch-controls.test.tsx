import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TouchControls } from '@/ui/components/TouchControls';
import type { useGameScene as useGameSceneHook } from '@/ui/context/GameContext';

type UseGameScene = typeof useGameSceneHook;

const mockUseGameScene = vi.fn<ReturnType<UseGameScene>, Parameters<UseGameScene>>();

vi.mock('@/ui/context/GameContext', () => ({
  useGameScene: (): ReturnType<UseGameScene> => mockUseGameScene(),
}));

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
    mockUseGameScene.mockReturnValue({
      game: {
        scene: {
          getScene: vi.fn(() => ({
            setVirtualDirection: vi.fn(),
            clearVirtualDirections: vi.fn(),
            requestInteraction: vi.fn(),
          })),
        },
      },
      isReady: true,
    });

    render(<TouchControls />);

    expect(screen.queryByLabelText('Touch controls')).not.toBeInTheDocument();
  });

  it('sends direction and interact input to the active dungeon scene for coarse-pointer devices', () => {
    setTouchEnvironment({ coarsePointer: true, maxTouchPoints: 0 });
    const setVirtualDirection = vi.fn();
    const clearVirtualDirections = vi.fn();
    const requestInteraction = vi.fn();
    const getScene = vi.fn(() => ({
      setVirtualDirection,
      clearVirtualDirections,
      requestInteraction,
    }));

    mockUseGameScene.mockReturnValue({
      game: { scene: { getScene } },
      isReady: true,
    });

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