import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import Phaser from 'phaser';
import type { DungeonMap, DungeonRoomNode, DungeonZone } from '@/game/systems/dungeonTypes';
import type { PlayerState } from '@/game/entities/Player';

/**
 * Event types emitted by DungeonScene
 */
export interface RoomEnteredEvent {
  roomId: string;
  roomType: 'profile' | 'repo' | 'gateway';
  roomName: string;
  repo: Record<string, unknown> | null;
  zone: DungeonZone | null;
}

interface DungeonSceneType {
  getDungeon(): DungeonMap | null;
  getPlayer(): { getState(): PlayerState } | null;
  getCurrentRoom(): DungeonRoomNode | null;
  events: Phaser.Events.EventEmitter;
}

export interface GameContextType {
  game: Phaser.Game | null;
  dungeon: DungeonMap | null;
  playerState: PlayerState | null;
  currentRoom: DungeonRoomNode | null;
  isReady: boolean;
}

const GameContext = createContext<GameContextType | null>(null);

interface GameContextProviderProps {
  game: Phaser.Game | null;
  children: ReactNode;
}

/**
 * GameContextProvider exposes the Phaser game instance and dungeon data to React components.
 * This bridge allows React UIs to listen to game events and access dungeon structure.
 */
export function GameContextProvider({ game, children }: GameContextProviderProps) {
  const [dungeon, setDungeon] = useState<DungeonMap | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [currentRoom, setCurrentRoom] = useState<DungeonRoomNode | null>(null);
  const [isReady, setIsReady] = useState(false);
  const gameRef = useRef(game);

  // Keep game reference up to date
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  // Set up event listeners and initial state
  useEffect(() => {
    if (!game) {
      setIsReady(false);
      return;
    }

    const dungeonScene = game.scene.getScene('DungeonScene') as unknown as DungeonSceneType | null;
    if (!dungeonScene) {
      setIsReady(false);
      return;
    }

    // Get initial dungeon data
    const initialDungeon = dungeonScene.getDungeon();
    if (initialDungeon) {
      setDungeon(initialDungeon);

      // Get initial player state
      const player = dungeonScene.getPlayer();
      if (player) {
        const initialState = player.getState();
        setPlayerState(initialState);
      }

      // Get initial current room
      const currentRoomNode = dungeonScene.getCurrentRoom();
      if (currentRoomNode) {
        setCurrentRoom(currentRoomNode);
      }

      setIsReady(true);
    }

    // Listen for playerMoved events
    const handlePlayerMoved = (state: PlayerState) => {
      setPlayerState(state);
    };

    // Listen for roomEntered events
    const handleRoomEntered = (event: RoomEnteredEvent) => {
      if (!initialDungeon) return;
      const room = initialDungeon.rooms.find((r) => r.id === event.roomId);
      if (room) {
        setCurrentRoom(room);
      }
    };

    dungeonScene.events.on('playerMoved', handlePlayerMoved);
    dungeonScene.events.on('roomEntered', handleRoomEntered);

    return () => {
      dungeonScene.events.off('playerMoved', handlePlayerMoved);
      dungeonScene.events.off('roomEntered', handleRoomEntered);
    };
  }, [game]);

  const value: GameContextType = {
    game: gameRef.current,
    dungeon,
    playerState,
    currentRoom,
    isReady,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

/**
 * useGameScene hook provides access to the Phaser game instance and dungeon data.
 */
export function useGameScene(): GameContextType {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGameScene must be used within GameContextProvider');
  }
  return context;
}

/**
 * useOnRoomEntered hook subscribes to room entry events.
 */
export function useOnRoomEntered(callback: (event: RoomEnteredEvent) => void): void {
  const { game } = useGameScene();

  useEffect(() => {
    if (!game) return;

    const dungeonScene = game.scene.getScene('DungeonScene') as unknown as DungeonSceneType | null;
    if (!dungeonScene) return;

    dungeonScene.events.on('roomEntered', callback);

    return () => {
      dungeonScene.events.off('roomEntered', callback);
    };
  }, [game, callback]);
}

/**
 * useOnPlayerMoved hook subscribes to player movement events.
 */
export function useOnPlayerMoved(callback: (state: PlayerState) => void): void {
  const { game } = useGameScene();

  useEffect(() => {
    if (!game) return;

    const dungeonScene = game.scene.getScene('DungeonScene') as unknown as DungeonSceneType | null;
    if (!dungeonScene) return;

    dungeonScene.events.on('playerMoved', callback);

    return () => {
      dungeonScene.events.off('playerMoved', callback);
    };
  }, [game, callback]);
}
