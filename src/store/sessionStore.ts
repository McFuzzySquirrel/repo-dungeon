import { create } from 'zustand';

export interface SessionState {
  usernameInput: string;
  setUsernameInput: (value: string) => void;
  reset: () => void;
}

const initialState = {
  usernameInput: '',
};

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,
  setUsernameInput: (value) => set({ usernameInput: value }),
  reset: () => set(initialState),
}));
