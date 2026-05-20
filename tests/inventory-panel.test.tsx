import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InventoryPanel } from '@/ui/components/InventoryPanel';
import type { LootItem } from '@/game/systems/LootGenerator';

// Mock the progression store
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
  {
    id: 'loot-3',
    name: 'Legendary Star Crystal',
    rarity: 'rare',
    repo: 'mega-repo',
    repoUrl: 'https://github.com/mega/repo',
    description: 'A radiant crystal',
    timestamp: Date.now() - 2000,
  },
];

vi.mock('@/store/progressionStore', () => ({
  useProgressionStore: vi.fn(() => ({
    inventory: mockInventory,
    unlockedBadges: ['first-steps'],
  })),
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

  it('should show item count on button', () => {
    render(<InventoryPanel />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should open inventory on button click', () => {
    render(<InventoryPanel />);
    const button = screen.getByRole('button', { name: /Open inventory/ });
    fireEvent.click(button);
    expect(screen.getByRole('dialog', { name: 'Inventory' })).toBeInTheDocument();
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

    expect(screen.queryByRole('dialog', { name: 'Inventory' })).not.toBeInTheDocument();
  });

  it('should allow sorting by rarity', () => {
    render(<InventoryPanel />);
    const openButton = screen.getByRole('button', { name: /Open inventory/ });
    fireEvent.click(openButton);

    const sortSelect = screen.getByDisplayValue('Date Acquired');
    fireEvent.change(sortSelect, { target: { value: 'rarity' } });

    expect(sortSelect).toHaveValue('rarity');
  });

  it('should allow sorting by language', () => {
    render(<InventoryPanel />);
    const openButton = screen.getByRole('button', { name: /Open inventory/ });
    fireEvent.click(openButton);

    const sortSelect = screen.getByDisplayValue('Date Acquired');
    fireEvent.change(sortSelect, { target: { value: 'language' } });

    expect(sortSelect).toHaveValue('language');
  });

  it('should display inventory items when open', () => {
    render(<InventoryPanel />);
    const button = screen.getByRole('button', { name: /Open inventory/ });
    fireEvent.click(button);

    expect(screen.queryByText('Golden Console')).toBeInTheDocument();
    expect(screen.queryByText('Star Fragment')).toBeInTheDocument();
  });

  it('should display unlocked badges when open', () => {
    render(<InventoryPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Open inventory/ }));

    expect(screen.getByText('Badges')).toBeInTheDocument();
    expect(screen.getByText('First Steps')).toBeInTheDocument();
  });

  it('should close on close button click', () => {
    render(<InventoryPanel />);
    const openButton = screen.getByRole('button', { name: /Open inventory/ });
    fireEvent.click(openButton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: /Close inventory/ });
    fireEvent.click(closeButton);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
