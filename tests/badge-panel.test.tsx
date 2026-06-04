import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BadgePanel } from '@/ui/components/BadgePanel';

vi.mock('@/store/progressionStore', () => ({
  useProgressionStore: vi.fn((selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      unlockedBadges: ['first-steps', 'guild-finder'],
      discoveryCount: 4,
      readmeCount: 1,
      githubLinkClicks: 0,
      reviewPassCount: 0,
    };
    return selector ? selector(state) : state;
  }),
}));

describe('BadgePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the badge button with the unlocked count', () => {
    render(<BadgePanel />);

    expect(screen.getByRole('button', { name: /Open badges/i })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('opens the badge dialog on click', () => {
    render(<BadgePanel />);

    fireEvent.click(screen.getByRole('button', { name: /Open badges/i }));

    expect(screen.getByRole('dialog', { name: /Badges/i })).toBeInTheDocument();
    expect(screen.getByText('First Steps')).toBeInTheDocument();
    expect(screen.getByText('Guild Finder')).toBeInTheDocument();
  });

  it('shows locked badges as well', () => {
    render(<BadgePanel />);

    fireEvent.click(screen.getByRole('button', { name: /Open badges/i }));

    expect(screen.getByText('Archaeologist')).toBeInTheDocument();
    expect(screen.getAllByText('Locked').length).toBeGreaterThan(0);
  });

  it('closes when clicking the close button', () => {
    render(<BadgePanel />);

    fireEvent.click(screen.getByRole('button', { name: /Open badges/i }));
    fireEvent.click(screen.getByRole('button', { name: /Close badges/i }));

    expect(screen.queryByRole('dialog', { name: /Badges/i })).not.toBeInTheDocument();
  });
});
