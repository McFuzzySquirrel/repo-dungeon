import { create } from 'zustand';

export interface DungeonRoomSnapshot {
  id: string;
  label: string;
}

export interface DungeonState {
  seed: string | null;
  rooms: DungeonRoomSnapshot[];
  visitedRoomIds: string[];
  setSeed: (seed: string) => void;
  setRooms: (rooms: DungeonRoomSnapshot[]) => void;
  markVisited: (roomId: string) => void;
  reset: () => void;
}

const initialState = {
  seed: null as string | null,
  rooms: [] as DungeonRoomSnapshot[],
  visitedRoomIds: [] as string[],
};

export const useDungeonStore = create<DungeonState>((set) => ({
  ...initialState,
  setSeed: (seed) => set({ seed }),
  setRooms: (rooms) => set({ rooms }),
  markVisited: (roomId) =>
    set((state) =>
      state.visitedRoomIds.includes(roomId)
        ? state
        : { visitedRoomIds: [...state.visitedRoomIds, roomId] },
    ),
  reset: () => set(initialState),
}));
