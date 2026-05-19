/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Phaser from 'phaser';
import { GameContextProvider, useGameScene, useOnRoomEntered, useOnPlayerMoved } from '@/ui/context/GameContext';
import type { DungeonMap, DungeonRoomNode, DungeonZone } from '@/game/systems/dungeonTypes';
import type { PlayerState } from '@/game/entities/Player';

interface EventEmitterMap {
  [key: string]: ((data: unknown) => void)[];
}

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

  return {
    width: 1000,
    height: 500,
    entranceRoomId: 'room-1',
    rooms: [room1, room2],
    edges: [],
    zones: [zone1],
    metadata: {
      seed: '42',
      numericSeed: 42,
      repoCount: 2,
      zoneCount: 1,
      generationDurationMs: 100,
    },
  };
}

/**
 * Helper to create a mock Phaser game with DungeonScene.
 */
function makeMockGame(dungeon: DungeonMap, playerState: PlayerState): Phaser.Game {
  const eventEmitter: {
    listeners: EventEmitterMap;
    on: (event: string, callback: (data: unknown) => void) => void;
    off: (event: string, callback: (data: unknown) => void) => void;
    emit: (event: string, data: unknown) => void;
  } = {
    listeners: {},
    on: function (event: string, callback: (data: unknown) => void) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event]!.push(callback);
    },
    off: function (event: string, callback: (data: unknown) => void) {
      if (this.listeners[event]) {
        const callbacks = this.listeners[event]!;
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    },
    emit: function (event: string, data: unknown) {
      if (this.listeners[event]) {
        this.listeners[event]!.forEach((cb) => cb(data));
      }
    },
  };

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
            events: eventEmitter,
          };
        }
        return null;
      },
    },
  } as unknown as Phaser.Game;

  return game;
}

describe('GameContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides dungeon data', async () => {
    const dungeon = makeMockDungeon();
    const playerState: PlayerState = {
      position: { x: 150, y: 150 },
      currentRoomId: 'room-1',
      facingDirection: 'down',
    };
    const game = makeMockGame(dungeon, playerState);

    function TestComponent() {
      const { dungeon: contextDungeon, isReady } = useGameScene();

      return (
        <div>
          {isReady && <div>Ready: {contextDungeon?.rooms.length}</div>}
        </div>
      );
    }

    render(
      <GameContextProvider game={game}>
        <TestComponent />
      </GameContextProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Ready: 2')).toBeInTheDocument();
    });
  });

  it('provides player state', async () => {
    const dungeon = makeMockDungeon();
    const playerState: PlayerState = {
      position: { x: 150, y: 150 },
      currentRoomId: 'room-1',
      facingDirection: 'down',
    };
    const game = makeMockGame(dungeon, playerState);

    function TestComponent() {
      const { playerState: contextPlayerState, isReady } = useGameScene();

      return (
        <div>
          {isReady && contextPlayerState && (
            <div>
              Position: {contextPlayerState.position.x}, {contextPlayerState.position.y}
            </div>
          )}
        </div>
      );
    }

    render(
      <GameContextProvider game={game}>
        <TestComponent />
      </GameContextProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Position: 150, 150')).toBeInTheDocument();
    });
  });

  it('provides current room', async () => {
    const dungeon = makeMockDungeon();
    const playerState: PlayerState = {
      position: { x: 150, y: 150 },
      currentRoomId: 'room-1',
      facingDirection: 'down',
    };
    const game = makeMockGame(dungeon, playerState);

    function TestComponent() {
      const { currentRoom, isReady } = useGameScene();

      return (
        <div>
          {isReady && currentRoom && <div>Room: {currentRoom.name}</div>}
        </div>
      );
    }

    render(
      <GameContextProvider game={game}>
        <TestComponent />
      </GameContextProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Room: typescript/core-lib')).toBeInTheDocument();
    });
  });

  it('throws error when used outside provider', () => {
    function TestComponent() {
      useGameScene();
      return <div>Test</div>;
    }

    // Suppress console.error for this test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useGameScene must be used within GameContextProvider');

    consoleError.mockRestore();
  });

  it('handles missing dungeon scene gracefully', () => {
    const game = {
      scene: {
        getScene: () => null,
      },
    } as any;

    function TestComponent() {
      const { isReady } = useGameScene();
      return <div>Ready: {isReady ? 'true' : 'false'}</div>;
    }

    render(
      <GameContextProvider game={game}>
        <TestComponent />
      </GameContextProvider>,
    );

    expect(screen.getByText('Ready: false')).toBeInTheDocument();
  });

  it('handles null game gracefully', () => {
    function TestComponent() {
      const { isReady } = useGameScene();
      return <div>Ready: {isReady ? 'true' : 'false'}</div>;
    }

    render(
      <GameContextProvider game={null}>
        <TestComponent />
      </GameContextProvider>,
    );

    expect(screen.getByText('Ready: false')).toBeInTheDocument();
  });
});

describe('useOnRoomEntered hook', () => {
  it('calls callback when room is entered', async () => {
    const dungeon = makeMockDungeon();
    const playerState: PlayerState = {
      position: { x: 150, y: 150 },
      currentRoomId: 'room-1',
      facingDirection: 'down',
    };
    const game = makeMockGame(dungeon, playerState);

    const callback = vi.fn();

    function TestComponent() {
      useOnRoomEntered(callback);
      return <div>Test</div>;
    }

    render(
      <GameContextProvider game={game}>
        <TestComponent />
      </GameContextProvider>,
    );

    // Emit a room entered event
    const dungeonScene = game.scene.getScene('DungeonScene') as any;
    dungeonScene.events.emit('roomEntered', {
      roomId: 'room-2',
      roomType: 'repo',
      roomName: 'typescript/utils',
      repo: null,
      zone: null,
    });

    await waitFor(() => {
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: 'room-2',
          roomName: 'typescript/utils',
        }),
      );
    });
  });
});

describe('useOnPlayerMoved hook', () => {
  it('calls callback when player moves', async () => {
    const dungeon = makeMockDungeon();
    const playerState: PlayerState = {
      position: { x: 150, y: 150 },
      currentRoomId: 'room-1',
      facingDirection: 'down',
    };
    const game = makeMockGame(dungeon, playerState);

    const callback = vi.fn();

    function TestComponent() {
      useOnPlayerMoved(callback);
      return <div>Test</div>;
    }

    render(
      <GameContextProvider game={game}>
        <TestComponent />
      </GameContextProvider>,
    );

    // Emit a player moved event
    const dungeonScene = game.scene.getScene('DungeonScene') as any;
    dungeonScene.events.emit('playerMoved', {
      position: { x: 200, y: 200 },
      currentRoomId: 'room-1',
      facingDirection: 'up',
    });

    await waitFor(() => {
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          position: { x: 200, y: 200 },
        }),
      );
    });
  });
});
