import { create } from 'zustand';

export interface SessionState {
  usernameInput: string;
  isAuthenticated: boolean;
  setUsernameInput: (value: string) => void;
  setAuthenticated: (value: boolean) => void;
  reset: () => void;
}

const initialState = {
  usernameInput: '',
  isAuthenticated: false,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,
  setUsernameInput: (value) => set({ usernameInput: value }),
  setAuthenticated: (value) => set({ isAuthenticated: value }),
  reset: () => set(initialState),
}));
