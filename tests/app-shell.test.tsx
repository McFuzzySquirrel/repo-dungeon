import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppShell } from '@/ui/AppShell';
import { useDungeonStore } from '@/store/dungeonStore';
import { useSessionStore } from '@/store/sessionStore';
import { STORAGE_KEYS } from '@/store/persistence';

type CreateGame = typeof import('@/game/createGame').createGame;
type DecodeShareableDungeonUrl = typeof import('@/ui/systems/shareUrl').decodeShareableDungeonUrl;
type GetLocalRepoAccessState = typeof import('@/localRepos/browserAccess').getLocalRepoAccessState;

const { mockCreateGame } = vi.hoisted(() => ({
  mockCreateGame: vi.fn(),
}));

const { mockGetLocalRepoAccessState } = vi.hoisted(() => ({
  mockGetLocalRepoAccessState: vi.fn(),
}));

const { mockDecodeShareableDungeonUrl } = vi.hoisted(() => ({
  mockDecodeShareableDungeonUrl: vi.fn(),
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
vi.mock('@/ui/components/SelectedCharacterCard', () => ({ SelectedCharacterCard: () => <div>SelectedCharacterCard</div> }));
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
  decodeShareableDungeonUrl: (...args: Parameters<DecodeShareableDungeonUrl>): ReturnType<DecodeShareableDungeonUrl> =>
    mockDecodeShareableDungeonUrl(...args) as ReturnType<DecodeShareableDungeonUrl>,
}));

vi.mock('@/localRepos/browserAccess', () => ({
  getLocalRepoAccessState: (): ReturnType<GetLocalRepoAccessState> =>
    mockGetLocalRepoAccessState() as ReturnType<GetLocalRepoAccessState>,
}));

describe('AppShell', () => {
  beforeEach(() => {
    localStorage.clear();
    mockDecodeShareableDungeonUrl.mockReturnValue(null);
    mockGetLocalRepoAccessState.mockReturnValue({
      isLocalRepoModeAvailable: true,
      environment: 'trusted-local-web',
      reason: null,
    });
    mockCreateGame.mockReturnValue({
      destroy: vi.fn(),
      scene: {
        getScene: vi.fn(() => null),
      },
    });
    useSessionStore.setState({ usernameInput: '', selectedSourceKind: 'github' });
    useDungeonStore.setState({ seed: null });
  });

  it('shows the welcome screen initially and gameplay UI after starting', () => {
    render(<AppShell />);

    expect(screen.getByText('welcome')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));

    expect(screen.getByText('Minimap')).toBeInTheDocument();
    expect(screen.queryByLabelText('GitHub connection panel')).not.toBeInTheDocument();
  });

  it('restores github source selection and username from persisted source identity', () => {
    localStorage.setItem(STORAGE_KEYS.selectedSource, 'github:octocat');

    render(<AppShell />);

    expect(useSessionStore.getState().selectedSourceKind).toBe('github');
    expect(useSessionStore.getState().usernameInput).toBe('octocat');
  });

  it('restores local source selection when local mode is available', () => {
    localStorage.setItem(STORAGE_KEYS.selectedSource, 'local:workspace%2Frepos');

    render(<AppShell />);

    expect(useSessionStore.getState().selectedSourceKind).toBe('local');
  });

  it('falls back to github source when persisted local source is unavailable in runtime', () => {
    mockGetLocalRepoAccessState.mockReturnValue({
      isLocalRepoModeAvailable: false,
      environment: 'hosted-web',
      reason: 'Local repository mode is disabled on hosted builds.',
    });
    localStorage.setItem(STORAGE_KEYS.selectedSource, 'local:workspace%2Frepos');

    render(<AppShell />);

    expect(useSessionStore.getState().selectedSourceKind).toBe('github');
  });

  it('preserves persisted local source identity without writing placeholder values', () => {
    localStorage.setItem(STORAGE_KEYS.selectedSource, 'local:workspace%2Frepos');
    useSessionStore.setState({ selectedSourceKind: 'local' });

    render(<AppShell />);

    expect(localStorage.getItem(STORAGE_KEYS.selectedSource)).toBe('local:workspace%2Frepos');
  });

  it('restores shared links as github source even when a local source was persisted', () => {
    localStorage.setItem(STORAGE_KEYS.selectedSource, 'local:workspace%2Frepos');
    useSessionStore.setState({ selectedSourceKind: 'local' });
    mockDecodeShareableDungeonUrl.mockReturnValue({
      username: 'octocat',
      seed: 'shared-seed',
    });

    render(<AppShell />);

    expect(useSessionStore.getState().selectedSourceKind).toBe('github');
    expect(useSessionStore.getState().usernameInput).toBe('octocat');
    expect(useDungeonStore.getState().seed).toBe('shared-seed');
  });
});
