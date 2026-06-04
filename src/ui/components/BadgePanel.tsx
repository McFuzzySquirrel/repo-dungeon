import { useEffect, useState } from 'react';
import { BADGES, type BadgeId } from '@/game/systems/BadgeTracker';
import { getBadgeProgress } from '@/game/systems/progressionEngine';
import { useProgressionStore } from '@/store/progressionStore';
import { isTypingInEditableTarget } from '@/ui/systems/keyboard';
import '@/ui/styles/badge-panel.css';

const ALL_BADGE_IDS = Object.keys(BADGES) as BadgeId[];

export function BadgePanel() {
  const unlockedBadges = useProgressionStore((state) => state.unlockedBadges);
  const discoveryCount = useProgressionStore((state) => state.discoveryCount);
  const readmeCount = useProgressionStore((state) => state.readmeCount);
  const githubLinkClicks = useProgressionStore((state) => state.githubLinkClicks);
  const reviewPassCount = useProgressionStore((state) => state.reviewPassCount);
  const [isOpen, setIsOpen] = useState(false);
  const signals = {
    discoveryCount,
    readmeCount,
    githubLinkClicks,
    reviewPassCount,
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingInEditableTarget(event.target)) {
        return;
      }

      if (event.key === 'b' || event.key === 'B') {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button
        type="button"
        className="badge-button"
        onClick={() => setIsOpen(true)}
        title="Press B to open badges"
        aria-label="Open badges (press B)"
      >
        <span className="badge-button-icon" aria-hidden="true">🏅</span>
        {unlockedBadges.length > 0 ? <span className="badge-button-count">{unlockedBadges.length}</span> : null}
      </button>
    );
  }

  return (
    <div className="badge-overlay" role="presentation" onClick={() => setIsOpen(false)}>
      <div
        className="badge-panel"
        role="dialog"
        aria-labelledby="badge-panel-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="badge-panel-header">
          <div>
            <h2 id="badge-panel-title" className="badge-panel-title">Badges</h2>
            <p className="badge-panel-subtitle">Unlocked {unlockedBadges.length} of {ALL_BADGE_IDS.length}</p>
          </div>
          <button
            type="button"
            className="badge-panel-close"
            onClick={() => setIsOpen(false)}
            aria-label="Close badges"
          >
            ✕
          </button>
        </div>

        <div className="badge-panel-grid">
          {ALL_BADGE_IDS.map((badgeId) => {
            const badge = BADGES[badgeId];
            const isUnlocked = unlockedBadges.includes(badgeId);
            const progress = getBadgeProgress(badgeId, signals, isUnlocked);
            return (
              <article
                key={badgeId}
                className={`badge-card ${isUnlocked ? 'unlocked' : 'locked'}`}
                aria-label={`${badge.name} ${isUnlocked ? 'unlocked' : 'locked'}`}
              >
                <div className="badge-card-icon" aria-hidden="true">{badge.emoji}</div>
                <div className="badge-card-body">
                  <h3 className="badge-card-name">{badge.name}</h3>
                  <p className="badge-card-description">{badge.description}</p>
                  <p className="badge-card-description">{badge.unlockDetail}</p>
                  {progress.nextMilestone ? (
                    <div className="badge-card-progress" aria-label={`${badge.name} milestone progress`}>
                      <div className="badge-card-progress-track">
                        <div className="badge-card-progress-fill" style={{ width: `${progress.nextMilestoneProgress}%` }} />
                      </div>
                      <span className="badge-card-progress-text">
                        Next: {progress.nextMilestone.label} ({progress.current}/{progress.nextMilestone.target})
                      </span>
                    </div>
                  ) : (
                    <span className="badge-card-progress-text">Milestones complete</span>
                  )}
                  <span className="badge-card-state">{isUnlocked ? 'Unlocked' : 'Locked'}</span>
                </div>
              </article>
            );
          })}
        </div>

        <p className="badge-panel-hint">Press ESC, click outside, or press B to close.</p>
      </div>
    </div>
  );
}
