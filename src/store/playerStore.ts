import { create } from 'zustand';

export type PlayerClass = 'explorer' | 'archivist' | 'hacker' | 'contributor';

export interface PlayerState {
  selectedClass: PlayerClass | null;
  level: number;
  xp: number;
  selectClass: (value: PlayerClass) => void;
  addXp: (amount: number) => void;
  reset: () => void;
}

const initialState = {
  selectedClass: null as PlayerClass | null,
  level: 1,
  xp: 0,
};

export const usePlayerStore = create<PlayerState>((set) => ({
  ...initialState,
  selectClass: (value) => set({ selectedClass: value }),
  addXp: (amount) =>
    set((state) => ({
      xp: state.xp + Math.max(0, Math.floor(amount)),
    })),
  reset: () => set(initialState),
}));
