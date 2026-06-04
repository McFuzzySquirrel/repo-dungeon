import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InventoryPanel } from '@/ui/components/InventoryPanel';
import type { LootItem } from '@/game/systems/LootGenerator';

const mockInventory: LootItem[] = [
  {
    id: 'loot-1',
    name: 'Golden Console',
    rarity: 'common',
    repo: 'test-repo',
    repoUrl: 'https://github.com/test/repo',
    language: 'JavaScript',
    description: 'A shimmering console',
    timestamp: Date.now(),
  },
  {
    id: 'loot-2',
    name: 'Star Fragment',
    rarity: 'uncommon',
    repo: 'popular-repo',
    repoUrl: 'https://github.com/popular/repo',
    language: 'TypeScript',
    description: 'A fragment of light',
    timestamp: Date.now() - 1000,
  },
];

vi.mock('@/store/progressionStore', () => ({
  useProgressionStore: vi.fn((selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      inventory: mockInventory,
      unlockedBadges: ['first-steps'],
      discoveryCount: 5,
      readmeCount: 2,
      githubLinkClicks: 1,
      reviewPassCount: 1,
      archaeologyReviewCount: 3,
      roomsTowardNextPass: 2,
      archaeologyLog: [],
    };
    return selector ? selector(state) : state;
  }),
}));

describe('InventoryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render inventory button', () => {
    render(<InventoryPanel />);
    const button = screen.getByRole('button', { name: /Open inventory/ });
    expect(button).toBeInTheDocument();
  });

  it('opens collections dialog on click', () => {
    render(<InventoryPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Open inventory/ }));
    expect(screen.getByRole('dialog', { name: 'Collections' })).toBeInTheDocument();
  });

  it('supports switching to badges and archaeology tabs', () => {
    render(<InventoryPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Open inventory/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Badges' }));
    expect(screen.getByText('First Steps')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Archaeology' }));
    expect(screen.getByText(/Review checkpoints/i)).toBeInTheDocument();
  });

  it('should not toggle inventory while typing in an input', () => {
    render(
      <>
        <input aria-label="username-input" />
        <InventoryPanel />
      </>,
    );

    const input = screen.getByLabelText('username-input');
    fireEvent.keyDown(input, { key: 'i' });

    expect(screen.queryByRole('dialog', { name: 'Collections' })).not.toBeInTheDocument();
  });
});
