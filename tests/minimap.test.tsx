import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Phaser from 'phaser';
import { Minimap } from '@/ui/components/Minimap';
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
    repo: {
      id: 1,
      name: 'core-lib',
      fullName: 'typescript/core-lib',
      ownerLogin: 'typescript',
      description: 'Core TypeScript library',
      htmlUrl: 'https://github.com/typescript/core-lib',
      language: 'TypeScript',
      stargazersCount: 100,
      forksCount: 10,
      topics: [],
      isPrivate: false,
      defaultBranch: 'main',
    },
  };

  const room2: DungeonRoomNode = {
    id: 'room-2',
    type: 'repo',
    zoneId: 'zone-1',
    name: 'typescript/utils',
    position: { x: 300, y: 250 },
    size: { width: 80, height: 80 },
    repo: {
      id: 2,
      name: 'utils',
      fullName: 'typescript/utils',
      ownerLogin: 'typescript',
      description: 'Utility functions',
      htmlUrl: 'https://github.com/typescript/utils',
      language: 'TypeScript',
      stargazersCount: 50,
      forksCount: 5,
      topics: [],
      isPrivate: false,
      defaultBranch: 'main',
    },
  };

  const room3: DungeonRoomNode = {
    id: 'room-3',
    type: 'repo',
    zoneId: 'zone-2',
    name: 'python/django',
    position: { x: 700, y: 150 },
    size: { width: 80, height: 80 },
    repo: {
      id: 3,
      name: 'django',
      fullName: 'python/django',
      ownerLogin: 'python',
      description: 'Django web framework',
      htmlUrl: 'https://github.com/python/django',
      language: 'Python',
      stargazersCount: 500,
      forksCount: 100,
      topics: [],
      isPrivate: false,
      defaultBranch: 'main',
    },
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

describe('Minimap Component', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  it('renders the minimap container', () => {
    const dungeon = makeMockDungeon();
    const playerState: PlayerState = {
      position: { x: 150, y: 150 },
      currentRoomId: 'room-1',
      facingDirection: 'down',
    };
    const game = makeMockGame(dungeon, playerState);

    render(
      <GameContextProvider game={game}>
        <Minimap />
      </GameContextProvider>,
    );

    const minimap = screen.getByRole('region', { name: /minimap/i });
    expect(minimap).toBeInTheDocument();
  });

  it('displays the current room name', () => {
    const dungeon = makeMockDungeon();
    const playerState: PlayerState = {
      position: { x: 150, y: 150 },
      currentRoomId: 'room-1',
      facingDirection: 'down',
    };
    const game = makeMockGame(dungeon, playerState);

    render(
      <GameContextProvider game={game}>
        <Minimap />
      </GameContextProvider>,
    );

    expect(screen.getByText('typescript/core-lib')).toBeInTheDocument();
  });

  it('displays the biome label', () => {
    const dungeon = makeMockDungeon();
    const playerState: PlayerState = {
      position: { x: 150, y: 150 },
      currentRoomId: 'room-1',
      facingDirection: 'down',
    };
    const game = makeMockGame(dungeon, playerState);

    render(
      <GameContextProvider game={game}>
        <Minimap />
      </GameContextProvider>,
    );

    expect(screen.getByText('TypeScript')).toBeInTheDocument();
  });

  it('displays player coordinates', () => {
    const dungeon = makeMockDungeon();
    const playerState: PlayerState = {
      position: { x: 150, y: 150 },
      currentRoomId: 'room-1',
      facingDirection: 'down',
    };
    const game = makeMockGame(dungeon, playerState);

    render(
      <GameContextProvider game={game}>
        <Minimap />
      </GameContextProvider>,
    );

    expect(screen.getByText(/150.*150/)).toBeInTheDocument();
  });

  it('renders canvas with correct dimensions', () => {
    const dungeon = makeMockDungeon();
    const playerState: PlayerState = {
      position: { x: 150, y: 150 },
      currentRoomId: 'room-1',
      facingDirection: 'down',
    };
    const game = makeMockGame(dungeon, playerState);

    const { container } = render(
      <GameContextProvider game={game}>
        <Minimap />
      </GameContextProvider>,
    );

    const canvas = container.querySelector('.minimap-canvas') as HTMLCanvasElement;
    expect(canvas).toBeInTheDocument();
    expect(canvas.width).toBe(180);
    expect(canvas.height).toBe(180);
  });

  it('returns null when currentRoom is not available', () => {
    const dungeon = makeMockDungeon();
    const playerState: PlayerState = {
      position: { x: 150, y: 150 },
      currentRoomId: 'unknown-room',
      facingDirection: 'down',
    };
    const game = makeMockGame(dungeon, playerState);

    const { container } = render(
      <GameContextProvider game={game}>
        <Minimap />
      </GameContextProvider>,
    );

    expect(container.firstChild).toBeNull();
  });

  it('has proper accessibility attributes', () => {
    const dungeon = makeMockDungeon();
    const playerState: PlayerState = {
      position: { x: 150, y: 150 },
      currentRoomId: 'room-1',
      facingDirection: 'down',
    };
    const game = makeMockGame(dungeon, playerState);

    const { container } = render(
      <GameContextProvider game={game}>
        <Minimap />
      </GameContextProvider>,
    );

    const canvas = container.querySelector('.minimap-canvas') as HTMLCanvasElement;
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
  });
});
