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

  it('should display one class at a time', () => {
    render(<CharacterSelect />);
    expect(screen.getByText('Explorer')).toBeInTheDocument();
    expect(screen.queryByText('Archivist')).not.toBeInTheDocument();
    expect(screen.queryByText('Hacker')).not.toBeInTheDocument();
    expect(screen.queryByText('Contributor')).not.toBeInTheDocument();
  });

  it('should scroll to the next class', () => {
    render(<CharacterSelect />);
    fireEvent.click(screen.getByRole('button', { name: /show next class/i }));
    expect(screen.getByText('Archivist')).toBeInTheDocument();
    expect(screen.getByText(/Knowledge seeker/)).toBeInTheDocument();
  });

  it('should allow class selection', () => {
    render(<CharacterSelect />);
    const explorerCard = screen.getByRole('button', { name: /Choose Explorer class/i });
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
    const explorerCard = screen.getByRole('button', { name: /Choose Explorer class/i });
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
    expect(screen.getByRole('button', { name: /show previous class/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show next class/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Choose Explorer class/i })).toBeInTheDocument();
  });

  it('should have proper ARIA labels', () => {
    render(<CharacterSelect />);
    expect(screen.getByLabelText(/Choose Your Class/i)).toBeInTheDocument();
  });
});
