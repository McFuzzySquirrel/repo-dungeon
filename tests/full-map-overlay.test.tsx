import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Phaser from 'phaser';
import { FullMapOverlay } from '@/ui/components/FullMapOverlay';
import { GameContextProvider } from '@/ui/context/GameContext';
import type { DungeonMap, DungeonRoomNode, DungeonZone } from '@/game/systems/dungeonTypes';
import type { PlayerState } from '@/game/entities/Player';

/**
 * Helper to create a mock dungeon.
 */
function makeMockDungeon(): DungeonMap {
  const zone1: DungeonZone = {
    id: 'zone-1',
    key: 'language:typescript',
    label: 'TypeScript',
    source: 'language',
    biome: {
      id: 'neon-circuit-city',
      name: 'Neon Circuit City',
      visualTheme: 'Glowing cyan/purple grid floors',
    },
    bounds: { x: 0, y: 0, width: 500, height: 500 },
    roomIds: ['room-1', 'room-2'],
    gatewayRoomId: 'gateway-1',
  };

  const zone2: DungeonZone = {
    id: 'zone-2',
    key: 'language:python',
    label: 'Python',
    source: 'language',
    biome: {
      id: 'ancient-library',
      name: 'Ancient Library',
      visualTheme: 'Stone shelves, scrolls',
    },
    bounds: { x: 500, y: 0, width: 500, height: 500 },
    roomIds: ['room-3'],
    gatewayRoomId: 'gateway-2',
  };

  const room1: DungeonRoomNode = {
    id: 'room-1',
    type: 'repo',
    zoneId: 'zone-1',
    name: 'typescript/core-lib',
    position: { x: 150, y: 150 },
    size: { width: 80, height: 80 },
  };

  const room2: DungeonRoomNode = {
    id: 'room-2',
    type: 'repo',
    zoneId: 'zone-1',
    name: 'typescript/utils',
    position: { x: 300, y: 250 },
    size: { width: 80, height: 80 },
  };

  const room3: DungeonRoomNode = {
    id: 'room-3',
    type: 'repo',
    zoneId: 'zone-2',
    name: 'python/django',
    position: { x: 700, y: 150 },
    size: { width: 80, height: 80 },
  };

  return {
    width: 1000,
    height: 500,
    entranceRoomId: 'room-1',
    rooms: [room1, room2, room3],
    edges: [
      {
        id: 'edge-1',
        type: 'corridor',
        fromRoomId: 'room-1',
        toRoomId: 'room-2',
        path: [
          { x: 150, y: 150 },
          { x: 300, y: 250 },
        ],
      },
    ],
    zones: [zone1, zone2],
    metadata: {
      seed: '42',
      numericSeed: 42,
      repoCount: 3,
      zoneCount: 2,
      generationDurationMs: 100,
    },
  };
}

/**
 * Helper to create a mock Phaser game with DungeonScene.
 */
function makeMockGame(dungeon: DungeonMap, playerState: PlayerState): Phaser.Game {
  const game = {
    scene: {
      getScene: (name: string) => {
        if (name === 'DungeonScene') {
          return {
            getDungeon: () => dungeon,
            getPlayer: () => ({
              getState: () => playerState,
            }),
            getCurrentRoom: () => dungeon.rooms.find((r) => r.id === playerState.currentRoomId),
            events: {
              on: vi.fn(),
              off: vi.fn(),
            },
          };
        }
        return null;
      },
    },
  } as unknown as Phaser.Game;

  return game;
}

describe('FullMapOverlay Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is hidden by default', () => {
    const dungeon = makeMockDungeon();
    const playerState: PlayerState = {
      position: { x: 150, y: 150 },
      currentRoomId: 'room-1',
      facingDirection: 'down',
    };
    const game = makeMockGame(dungeon, playerState);

    const { container } = render(
      <GameContextProvider game={game}>
        <FullMapOverlay />
      </GameContextProvider>,
    );

    expect(container.querySelector('.fullmap-overlay')).not.toBeInTheDocument();
  });

  it('opens when M key is pressed', async () => {
    const dungeon = makeMockDungeon();
    const playerState: PlayerState = {
      position: { x: 150, y: 150 },
      currentRoomId: 'room-1',
      facingDirection: 'down',
    };
    const game = makeMockGame(dungeon, playerState);

    const { container } = render(
      <GameContextProvider game={game}>
        <FullMapOverlay />
      </GameContextProvider>,
    );

    fireEvent.keyDown(window, { key: 'm' });

    await waitFor(() => {
      expect(container.querySelector('.fullmap-overlay')).toBeInTheDocument();
    });
  });

  it('does not open when typing in an input field', async () => {
    const dungeon = makeMockDungeon();
    const playerState: PlayerState = {
      position: { x: 150, y: 150 },
      currentRoomId: 'room-1',
      facingDirection: 'down',
    };
    const game = makeMockGame(dungeon, playerState);

    const { container } = render(
      <GameContextProvider game={game}>
        <input aria-label="username-input" />
        <FullMapOverlay />
      </GameContextProvider>,
    );

    const input = screen.getByLabelText('username-input');
    fireEvent.keyDown(input, { key: 'm' });

    await waitFor(() => {
      expect(container.querySelector('.fullmap-overlay')).not.toBeInTheDocument();
    });
  });

  it('closes when Escape key is pressed', async () => {
    const dungeon = makeMockDungeon();
    const playerState: PlayerState = {
      position: { x: 150, y: 150 },
      currentRoomId: 'room-1',
      facingDirection: 'down',
    };
    const game = makeMockGame(dungeon, playerState);

    const { container } = render(
      <GameContextProvider game={game}>
        <FullMapOverlay />
      </GameContextProvider>,
    );

    // Open the overlay
    fireEvent.keyDown(window, { key: 'm' });

    await waitFor(() => {
      expect(container.querySelector('.fullmap-overlay')).toBeInTheDocument();
    });

    // Close the overlay
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(container.querySelector('.fullmap-overlay')).not.toBeInTheDocument();
    });
  });

  it('closes when close button is clicked', async () => {
    const dungeon = makeMockDungeon();
    const playerState: PlayerState = {
      position: { x: 150, y: 150 },
      currentRoomId: 'room-1',
      facingDirection: 'down',
    };
    const game = makeMockGame(dungeon, playerState);

    const { container } = render(
      <GameContextProvider game={game}>
        <FullMapOverlay />
      </GameContextProvider>,
    );

    // Open the overlay
    fireEvent.keyDown(window, { key: 'm' });

    await waitFor(() => {
      expect(container.querySelector('.fullmap-overlay')).toBeInTheDocument();
    });

    // Click close button
    const closeButton = screen.getByLabelText('Close map');
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(container.querySelector('.fullmap-overlay')).not.toBeInTheDocument();
    });
  });

  it('renders the map title', async () => {
    const dungeon = makeMockDungeon();
    const playerState: PlayerState = {
      position: { x: 150, y: 150 },
      currentRoomId: 'room-1',
      facingDirection: 'down',
    };
    const game = makeMockGame(dungeon, playerState);

    render(
      <GameContextProvider game={game}>
        <FullMapOverlay />
      </GameContextProvider>,
    );

    fireEvent.keyDown(window, { key: 'm' });

    await waitFor(() => {
      expect(screen.getByText('Dungeon Map')).toBeInTheDocument();
    });
  });

  it('displays zoom level', async () => {
    const dungeon = makeMockDungeon();
    const playerState: PlayerState = {
      position: { x: 150, y: 150 },
      currentRoomId: 'room-1',
      facingDirection: 'down',
    };
    const game = makeMockGame(dungeon, playerState);

    render(
      <GameContextProvider game={game}>
        <FullMapOverlay />
      </GameContextProvider>,
    );

    fireEvent.keyDown(window, { key: 'm' });

    await waitFor(() => {
      expect(screen.getByText(/100%/)).toBeInTheDocument();
    });
  });

  it('can zoom in', async () => {
    const dungeon = makeMockDungeon();
    const playerState: PlayerState = {
      position: { x: 150, y: 150 },
      currentRoomId: 'room-1',
      facingDirection: 'down',
    };
    const game = makeMockGame(dungeon, playerState);

    render(
      <GameContextProvider game={game}>
        <FullMapOverlay />
      </GameContextProvider>,
    );

    fireEvent.keyDown(window, { key: 'm' });

    await waitFor(() => {
      expect(screen.getByText(/100%/)).toBeInTheDocument();
    });

    const zoomInButton = screen.getByLabelText('Zoom in');
    fireEvent.click(zoomInButton);

    await waitFor(() => {
      expect(screen.getByText(/120%/)).toBeInTheDocument();
    });
  });

  it('can zoom out', async () => {
    const dungeon = makeMockDungeon();
    const playerState: PlayerState = {
      position: { x: 150, y: 150 },
      currentRoomId: 'room-1',
      facingDirection: 'down',
    };
    const game = makeMockGame(dungeon, playerState);

    render(
      <GameContextProvider game={game}>
        <FullMapOverlay />
      </GameContextProvider>,
    );

    fireEvent.keyDown(window, { key: 'm' });

    await waitFor(() => {
      expect(screen.getByText(/100%/)).toBeInTheDocument();
    });

    const zoomOutButton = screen.getByLabelText('Zoom out');
    fireEvent.click(zoomOutButton);

    await waitFor(() => {
      expect(screen.getByText(/80%/)).toBeInTheDocument();
    });
  });

  it('displays biome legend', async () => {
    const dungeon = makeMockDungeon();
    const playerState: PlayerState = {
      position: { x: 150, y: 150 },
      currentRoomId: 'room-1',
      facingDirection: 'down',
    };
    const game = makeMockGame(dungeon, playerState);

    render(
      <GameContextProvider game={game}>
        <FullMapOverlay />
      </GameContextProvider>,
    );

    fireEvent.keyDown(window, { key: 'm' });

    await waitFor(() => {
      expect(screen.getByText('Neon Circuit City')).toBeInTheDocument();
      expect(screen.getByText('Ancient Library')).toBeInTheDocument();
    });
  });

  it('renders canvas with correct dimensions', async () => {
    const dungeon = makeMockDungeon();
    const playerState: PlayerState = {
      position: { x: 150, y: 150 },
      currentRoomId: 'room-1',
      facingDirection: 'down',
    };
    const game = makeMockGame(dungeon, playerState);

    const { container } = render(
      <GameContextProvider game={game}>
        <FullMapOverlay />
      </GameContextProvider>,
    );

    fireEvent.keyDown(window, { key: 'm' });

    await waitFor(() => {
      const canvas = container.querySelector('.fullmap-canvas') as HTMLCanvasElement;
      expect(canvas).toBeInTheDocument();
      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(600);
    });
  });

  it('has proper accessibility attributes', async () => {
    const dungeon = makeMockDungeon();
    const playerState: PlayerState = {
      position: { x: 150, y: 150 },
      currentRoomId: 'room-1',
      facingDirection: 'down',
    };
    const game = makeMockGame(dungeon, playerState);

    const { container } = render(
      <GameContextProvider game={game}>
        <FullMapOverlay />
      </GameContextProvider>,
    );

    fireEvent.keyDown(window, { key: 'm' });

    await waitFor(() => {
      const overlay = container.querySelector('.fullmap-overlay');
      expect(overlay?.getAttribute('role')).toBe('dialog');
      expect(overlay?.getAttribute('aria-modal')).toBe('true');
    });
  });
});
