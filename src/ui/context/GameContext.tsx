import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react';
import Phaser from 'phaser';
import type { DungeonMap, DungeonRoomNode, DungeonZone } from '@/game/systems/dungeonTypes';
import type { PlayerState } from '@/game/entities/Player';
import type { GitHubRoomData } from '@/github/types';

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

export interface RoomObjectInteractedEvent {
  roomId: string;
  roomName: string;
  objectType: 'readme-scroll' | 'file-tree-archive' | 'contributors-gallery';
  title: string;
  description: string;
}

export interface ContributorInteractedEvent {
  roomId: string;
  contributor: {
    id: string;
    login: string;
    contributions: number;
  };
}

export interface TutorialUpdatedEvent {
  step: number;
  completed: boolean;
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
  roomDetailsCache: Map<string, GitHubRoomData>;
  cacheRoomDetails: (roomId: string, data: GitHubRoomData) => void;
  getRoomDetails: (roomId: string) => GitHubRoomData | undefined;
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
  const roomDetailsCacheRef = useRef<Map<string, GitHubRoomData>>(new Map());

  // Cache room details with LRU eviction (max 50 entries)
  const cacheRoomDetails = useCallback((roomId: string, data: GitHubRoomData) => {
    const cache = roomDetailsCacheRef.current;
    if (cache.size >= 50) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
    cache.set(roomId, data);
  }, []);

  const getRoomDetails = useCallback((roomId: string) => {
    return roomDetailsCacheRef.current.get(roomId);
  }, []);

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
      const latestDungeon = dungeonScene.getDungeon();
      if (latestDungeon) {
        setDungeon(latestDungeon);
      }
      const room = latestDungeon?.rooms.find((r) => r.id === event.roomId);
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
    roomDetailsCache: roomDetailsCacheRef.current,
    cacheRoomDetails,
    getRoomDetails,
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

export function useOnRoomObjectInteracted(callback: (event: RoomObjectInteractedEvent) => void): void {
  const { game } = useGameScene();

  useEffect(() => {
    if (!game) return;
    const dungeonScene = game.scene.getScene('DungeonScene') as unknown as DungeonSceneType | null;
    if (!dungeonScene) return;

    dungeonScene.events.on('roomObjectInteracted', callback);
    return () => {
      dungeonScene.events.off('roomObjectInteracted', callback);
    };
  }, [game, callback]);
}

export function useOnContributorInteracted(callback: (event: ContributorInteractedEvent) => void): void {
  const { game } = useGameScene();

  useEffect(() => {
    if (!game) return;
    const dungeonScene = game.scene.getScene('DungeonScene') as unknown as DungeonSceneType | null;
    if (!dungeonScene) return;

    dungeonScene.events.on('contributorInteracted', callback);
    return () => {
      dungeonScene.events.off('contributorInteracted', callback);
    };
  }, [game, callback]);
}

export function useOnTutorialUpdated(callback: (event: TutorialUpdatedEvent) => void): void {
  const { game } = useGameScene();

  useEffect(() => {
    if (!game) return;
    const dungeonScene = game.scene.getScene('DungeonScene') as unknown as DungeonSceneType | null;
    if (!dungeonScene) return;

    dungeonScene.events.on('tutorialUpdated', callback);
    return () => {
      dungeonScene.events.off('tutorialUpdated', callback);
    };
  }, [game, callback]);
}
