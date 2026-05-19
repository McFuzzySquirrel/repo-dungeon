import { useProgressionStore } from '@/store/progressionStore';
import { getXpForNextLevel } from '@/game/systems/ProgressionTracker';
import '@/ui/styles/xp-hud.css';

export function XpHud() {
  const level = useProgressionStore((s) => s.level);
  const xpTowardNextLevel = useProgressionStore((s) => s.xpTowardNextLevel);
  const totalXp = useProgressionStore((s) => s.totalXp);
  const badgeCount = useProgressionStore((s) => s.unlockedBadges.length);
  const xpRequired = getXpForNextLevel(level);

  const pct = Math.min(100, Math.round((xpTowardNextLevel / xpRequired) * 100));

  return (
    <div className="xp-hud" aria-label={`Level ${level}, ${xpTowardNextLevel} XP toward next level`}>
      <div className="xp-hud-level" title={`Total XP: ${totalXp}`}>
        <span className="xp-hud-level-label">LVL</span>
        <span className="xp-hud-level-value">{level}</span>
      </div>
      <div className="xp-hud-bar-col">
        <div className="xp-hud-bar-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="xp-hud-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="xp-hud-stats">
          <span>{xpTowardNextLevel} / {xpRequired} XP</span>
          {badgeCount > 0 && (
            <span className="xp-hud-badges" title="Badges unlocked">🏅 {badgeCount}</span>
          )}
        </div>
      </div>
    </div>
  );
}
