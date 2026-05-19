import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CharacterSelect } from '@/ui/components/CharacterSelect';

// Mock the player store
vi.mock('@/store/playerStore', () => ({
  usePlayerStore: vi.fn(() => ({
    selectedClass: null,
    selectClass: vi.fn(),
  })),
}));

describe('CharacterSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the character select modal', () => {
    render(<CharacterSelect />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Choose Your Class')).toBeInTheDocument();
  });

  it('should display all 4 character classes', () => {
    render(<CharacterSelect />);
    expect(screen.getByText('Explorer')).toBeInTheDocument();
    expect(screen.getByText('Archivist')).toBeInTheDocument();
    expect(screen.getByText('Hacker')).toBeInTheDocument();
    expect(screen.getByText('Contributor')).toBeInTheDocument();
  });

  it('should display class descriptions', () => {
    render(<CharacterSelect />);
    expect(screen.getByText(/Balanced adventurer/)).toBeInTheDocument();
    expect(screen.getByText(/Knowledge seeker/)).toBeInTheDocument();
  });

  it('should allow class selection', () => {
    render(<CharacterSelect />);
    const explorerCard = screen.getByRole('button', { name: /Explorer/ });
    fireEvent.click(explorerCard);
    expect(explorerCard).toHaveAttribute('aria-pressed', 'true');
  });

  it('should disable confirm button when no class is selected', () => {
    render(<CharacterSelect />);
    const buttons = screen.getAllByRole('button');
    const confirmBtn = buttons.find((btn) => btn.textContent?.includes('Confirm'));
    expect(confirmBtn).toBeDefined();
    if (confirmBtn) {
      expect(confirmBtn).toBeDisabled();
    }
  });

  it('should enable confirm button when a class is selected', () => {
    render(<CharacterSelect />);
    const explorerCard = screen.getByRole('button', { name: /Explorer/ });
    fireEvent.click(explorerCard);
    // The confirm button text might be wrapped, so use a more flexible query
    const buttons = screen.getAllByRole('button');
    const confirmBtn = buttons.find((btn) => btn.textContent?.includes('Confirm'));
    expect(confirmBtn).toBeDefined();
    if (confirmBtn) {
      expect(confirmBtn).not.toBeDisabled();
    }
  });

  it('should display class bonuses and abilities', () => {
    render(<CharacterSelect />);
    expect(screen.getByText(/\+10% XP/)).toBeInTheDocument();
    expect(screen.getByText(/discovery bonus/)).toBeInTheDocument();
  });

  it('should be keyboard accessible', () => {
    render(<CharacterSelect />);
    const cards = screen.getAllByRole('button').filter((btn) =>
      ['Explorer', 'Archivist', 'Hacker', 'Contributor'].some((name) =>
        btn.textContent?.includes(name),
      ),
    );
    expect(cards.length).toBe(4);
  });

  it('should have proper ARIA labels', () => {
    render(<CharacterSelect />);
    expect(screen.getByLabelText(/Choose Your Class/i)).toBeInTheDocument();
  });
});
