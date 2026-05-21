import { create } from 'zustand';
import type { SourceKind } from '@/repository/source';

export interface SessionState {
  usernameInput: string;
  selectedSourceKind: SourceKind;
  setUsernameInput: (value: string) => void;
  setSelectedSourceKind: (value: SourceKind) => void;
  reset: () => void;
}

const initialState = {
  usernameInput: '',
  selectedSourceKind: 'github' as SourceKind,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,
  setUsernameInput: (value) => set({ usernameInput: value }),
  setSelectedSourceKind: (value) => set({ selectedSourceKind: value }),
  reset: () => set(initialState),
}));
