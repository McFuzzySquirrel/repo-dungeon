import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppShell } from '@/ui/AppShell';
import { useDungeonStore } from '@/store/dungeonStore';
import { useSessionStore } from '@/store/sessionStore';
import type { UseGitHubAuthResult } from '@/ui/hooks/useGitHubAuth';

const { mockCreateGame, mockUseGitHubAuth } = vi.hoisted(() => ({
  mockCreateGame: vi.fn(),
  mockUseGitHubAuth: vi.fn(),
}));

vi.mock('@/game/createGame', () => ({
  createGame: (...args: unknown[]) => mockCreateGame(...args),
}));

vi.mock('@/ui/hooks/useGitHubAuth', () => ({
  useGitHubAuth: () => mockUseGitHubAuth(),
}));

vi.mock('@/ui/context/GameContext', () => ({
  GameContextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/ui/components/Minimap', () => ({ Minimap: () => <div>Minimap</div> }));
vi.mock('@/ui/components/FullMapOverlay', () => ({ FullMapOverlay: () => <div>FullMapOverlay</div> }));
vi.mock('@/ui/components/RoomInfoPanel', () => ({ RoomInfoPanel: () => <div>RoomInfoPanel</div> }));
vi.mock('@/ui/components/CharacterSelect', () => ({ CharacterSelect: () => <div>CharacterSelect</div> }));
vi.mock('@/ui/components/InventoryPanel', () => ({ InventoryPanel: () => <div>InventoryPanel</div> }));
vi.mock('@/ui/components/AudioControls', () => ({ AudioControls: () => <div>AudioControls</div> }));
vi.mock('@/ui/components/GamePolishOverlay', () => ({ GamePolishOverlay: () => <div>GamePolishOverlay</div> }));
vi.mock('@/ui/components/ProgressionController', () => ({ ProgressionController: () => <div>ProgressionController</div> }));
vi.mock('@/ui/components/XpHud', () => ({ XpHud: () => <div>XpHud</div> }));
vi.mock('@/ui/components/GameHudControls', () => ({
  GameHudControls: ({ onOpenHome }: { onOpenHome: () => void }) => (
    <button type="button" onClick={onOpenHome}>Home</button>
  ),
}));
vi.mock('@/ui/components/HelpOverlay', () => ({ HelpOverlay: () => <div>HelpOverlay</div> }));
vi.mock('@/ui/components/WelcomeScreen', () => ({
  WelcomeScreen: ({ auth, onStart }: { auth: UseGitHubAuthResult; onStart: () => void }) => (
    <div>
      <span>{`welcome:${auth.status}`}</span>
      <button type="button" onClick={onStart}>Start game</button>
    </div>
  ),
}));
vi.mock('@/ui/systems/shareUrl', () => ({
  decodeShareableDungeonUrl: () => null,
}));

function makeAuth(status: UseGitHubAuthResult['status'] = 'authenticated'): UseGitHubAuthResult {
  return {
    status,
    session: null,
    user: status === 'authenticated'
      ? {
          id: 1,
          login: 'octocat',
          avatarUrl: 'https://example.com/octocat.png',
          bio: null,
          publicRepos: 8,
          followers: 10,
          following: 5,
        }
      : null,
    errorMessage: null,
    beginLogin: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
  };
}

describe('AppShell', () => {
  beforeEach(() => {
    mockCreateGame.mockReturnValue({
      destroy: vi.fn(),
      scene: {
        getScene: vi.fn(() => null),
      },
    });
    mockUseGitHubAuth.mockReturnValue(makeAuth());
    useSessionStore.setState({ usernameInput: '', isAuthenticated: false });
    useDungeonStore.setState({ seed: null });
  });

  it('passes restored auth state into welcome and does not render a gameplay GitHub panel after starting', () => {
    render(<AppShell />);

    expect(screen.getByText('welcome:authenticated')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));

    expect(screen.getByText('Minimap')).toBeInTheDocument();
    expect(screen.queryByLabelText('GitHub connection panel')).not.toBeInTheDocument();
  });
});