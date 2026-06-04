import { useProgressionStore } from '@/store/progressionStore';
import { getXpForNextLevel } from '@/game/systems/ProgressionTracker';
import { getBadgeProgress, getRankProgress } from '@/game/systems/progressionEngine';
import '@/ui/styles/xp-hud.css';

export function XpHud() {
  const level = useProgressionStore((s) => s.level);
  const xpTowardNextLevel = useProgressionStore((s) => s.xpTowardNextLevel);
  const totalXp = useProgressionStore((s) => s.totalXp);
  const unlockedBadges = useProgressionStore((s) => s.unlockedBadges);
  const discoveryCount = useProgressionStore((s) => s.discoveryCount);
  const readmeCount = useProgressionStore((s) => s.readmeCount);
  const githubLinkClicks = useProgressionStore((s) => s.githubLinkClicks);
  const reviewPassCount = useProgressionStore((s) => s.reviewPassCount);
  const roomsTowardNextPass = useProgressionStore((s) => s.roomsTowardNextPass);
  const badgeCount = unlockedBadges.length;
  const xpRequired = getXpForNextLevel(level);
  const xpRemaining = Math.max(xpRequired - xpTowardNextLevel, 0);
  const rank = getRankProgress(totalXp);
  const signals = { discoveryCount, readmeCount, githubLinkClicks, reviewPassCount };
  const archaeologyMilestone = getBadgeProgress('archaeologist', signals, unlockedBadges.includes('archaeologist')).nextMilestone;
  const reviewMilestone = getBadgeProgress('zone-cleared', signals, unlockedBadges.includes('zone-cleared')).nextMilestone;

  const pct = Math.min(100, Math.round((xpTowardNextLevel / xpRequired) * 100));

  return (
    <div className="xp-hud" aria-label={`Level ${level}, ${xpTowardNextLevel} XP toward next level`}>
      <div className="xp-hud-header">
        <div className="xp-hud-level" title={`Total XP: ${totalXp}`}>
          <span className="xp-hud-level-label">LVL</span>
          <span className="xp-hud-level-value">{level}</span>
        </div>
        <div className="xp-hud-summary">
          <span className="xp-hud-title">Explorer Progress</span>
          <span className="xp-hud-total">{totalXp} XP · {rank.currentRank.name}</span>
        </div>
      </div>
      <div className="xp-hud-bar-col">
        <div className="xp-hud-bar-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="xp-hud-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="xp-hud-stats">
          <span>{xpTowardNextLevel} / {xpRequired} XP</span>
          <span>{xpRemaining} to next level</span>
        </div>
        <div className="xp-hud-footer">
          <span className="xp-hud-badges" title="Badges unlocked">🏅 {badgeCount} badges</span>
          <span className="xp-hud-percent">{pct}%</span>
        </div>
        <div className="xp-hud-footer">
          <span className="xp-hud-badges">🧭 Pass {reviewPassCount} · {roomsTowardNextPass} checkpoints</span>
          {rank.nextRank ? <span className="xp-hud-percent">{rank.percentToNextRank}% to {rank.nextRank.name}</span> : <span className="xp-hud-percent">Max rank</span>}
        </div>
        <div className="xp-hud-stats">
          <span>
            Next: {archaeologyMilestone ? `${archaeologyMilestone.label} (${discoveryCount}/${archaeologyMilestone.target})` : 'Archaeologist complete'}
          </span>
          <span>
            Review: {reviewMilestone ? `${reviewMilestone.label} (${reviewPassCount}/${reviewMilestone.target})` : 'Review ladder complete'}
          </span>
        </div>
      </div>
    </div>
  );
}
