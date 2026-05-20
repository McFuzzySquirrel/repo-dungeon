import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppShell } from '@/ui/AppShell';
import { useDungeonStore } from '@/store/dungeonStore';
import { useSessionStore } from '@/store/sessionStore';

type CreateGame = typeof import('@/game/createGame').createGame;

const { mockCreateGame } = vi.hoisted(() => ({
  mockCreateGame: vi.fn(),
}));

vi.mock('@/game/createGame', () => ({
  createGame: (...args: Parameters<CreateGame>): ReturnType<CreateGame> =>
    mockCreateGame(...args) as ReturnType<CreateGame>,
}));

vi.mock('@/ui/context/GameContext', () => ({
  GameContextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/ui/components/Minimap', () => ({ Minimap: () => <div>Minimap</div> }));
vi.mock('@/ui/components/FullMapOverlay', () => ({ FullMapOverlay: () => <div>FullMapOverlay</div> }));
vi.mock('@/ui/components/RoomInfoPanel', () => ({ RoomInfoPanel: () => <div>RoomInfoPanel</div> }));
vi.mock('@/ui/components/CharacterSelect', () => ({ CharacterSelect: () => <div>CharacterSelect</div> }));
vi.mock('@/ui/components/InventoryPanel', () => ({ InventoryPanel: () => <div>InventoryPanel</div> }));
vi.mock('@/ui/components/BadgePanel', () => ({ BadgePanel: () => <div>BadgePanel</div> }));
vi.mock('@/ui/components/AudioControls', () => ({ AudioControls: () => <div>AudioControls</div> }));
vi.mock('@/ui/components/GamePolishOverlay', () => ({ GamePolishOverlay: () => <div>GamePolishOverlay</div> }));
vi.mock('@/ui/components/ProgressionController', () => ({ ProgressionController: () => <div>ProgressionController</div> }));
vi.mock('@/ui/components/XpHud', () => ({ XpHud: () => <div>XpHud</div> }));
vi.mock('@/ui/components/GameHudControls', () => ({
  GameHudControls: ({ onOpenHome }: { onOpenHome: () => void }) => (
    <button type="button" onClick={onOpenHome}>Home</button>
  ),
}));
vi.mock('@/ui/components/TouchControls', () => ({ TouchControls: () => <div>TouchControls</div> }));
vi.mock('@/ui/components/HelpOverlay', () => ({ HelpOverlay: () => <div>HelpOverlay</div> }));
vi.mock('@/ui/components/WelcomeScreen', () => ({
  WelcomeScreen: ({ onStart }: { onStart: () => void }) => (
    <div>
      <span>welcome</span>
      <button type="button" onClick={onStart}>Start game</button>
    </div>
  ),
}));
vi.mock('@/ui/systems/shareUrl', () => ({
  decodeShareableDungeonUrl: () => null,
}));

describe('AppShell', () => {
  beforeEach(() => {
    mockCreateGame.mockReturnValue({
      destroy: vi.fn(),
      scene: {
        getScene: vi.fn(() => null),
      },
    });
    useSessionStore.setState({ usernameInput: '' });
    useDungeonStore.setState({ seed: null });
  });

  it('shows the welcome screen initially and gameplay UI after starting', () => {
    render(<AppShell />);

    expect(screen.getByText('welcome')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));

    expect(screen.getByText('Minimap')).toBeInTheDocument();
    expect(screen.queryByLabelText('GitHub connection panel')).not.toBeInTheDocument();
  });
});
