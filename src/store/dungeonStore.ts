import { create } from 'zustand';
import type { DungeonMap } from '@/game/systems/dungeonTypes';

export type DungeonLifecycleState = 'idle' | 'fetching' | 'generating' | 'ready' | 'error';

export interface DungeonProgressSnapshot {
  fetchedPages: number;
  fetchedRepos: number;
  expectedRepos: number | null;
  percentComplete: number | null;
  message: string;
}

export interface DungeonState {
  seed: string | null;
  dungeonMap: DungeonMap | null;
  lifecycleState: DungeonLifecycleState;
  progress: DungeonProgressSnapshot;
  errorMessage: string | null;
  visitedRoomIds: string[];
  setSeed: (seed: string) => void;
  setLifecycleState: (state: DungeonLifecycleState) => void;
  setProgress: (progress: Partial<DungeonProgressSnapshot>) => void;
  setDungeonMap: (map: DungeonMap | null) => void;
  setError: (errorMessage: string | null) => void;
  markVisited: (roomId: string) => void;
  reset: () => void;
}

const initialState = {
  seed: null as string | null,
  dungeonMap: null as DungeonMap | null,
  lifecycleState: 'idle' as DungeonLifecycleState,
  progress: {
    fetchedPages: 0,
    fetchedRepos: 0,
    expectedRepos: null,
    percentComplete: null,
    message: 'Waiting for username',
  } as DungeonProgressSnapshot,
  errorMessage: null as string | null,
  visitedRoomIds: [] as string[],
};

export const useDungeonStore = create<DungeonState>((set) => ({
  ...initialState,
  setSeed: (seed) => set({ seed }),
  setLifecycleState: (lifecycleState) => set({ lifecycleState }),
  setProgress: (progress) => set((state) => ({ progress: { ...state.progress, ...progress } })),
  setDungeonMap: (dungeonMap) => set({ dungeonMap }),
  setError: (errorMessage) => set({ errorMessage }),
  markVisited: (roomId) =>
    set((state) =>
      state.visitedRoomIds.includes(roomId)
        ? state
        : { visitedRoomIds: [...state.visitedRoomIds, roomId] },
    ),
  reset: () => set(initialState),
}));
