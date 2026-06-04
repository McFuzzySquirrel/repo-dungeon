import { describe, expect, it } from 'vitest';
import { getBadgeProgress, getRankProgress } from '@/game/systems/progressionEngine';

describe('progressionEngine', () => {
  it('computes archaeological milestone progress', () => {
    const progress = getBadgeProgress(
      'archaeologist',
      { discoveryCount: 5, readmeCount: 0, githubLinkClicks: 0, reviewPassCount: 0 },
      true,
    );

    expect(progress.completedMilestones).toBe(1);
    expect(progress.nextMilestone?.target).toBe(8);
    expect(progress.nextMilestoneProgress).toBeGreaterThan(0);
  });

  it('returns next rank progress for xp totals', () => {
    const rank = getRankProgress(1000);
    expect(rank.currentRank.name).toBe('Cartographer');
    expect(rank.nextRank?.name).toBe('Curator');
    expect(rank.percentToNextRank).toBeGreaterThan(0);
  });
});
