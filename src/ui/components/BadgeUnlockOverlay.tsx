/**
 * BadgeUnlockOverlay - Center-screen notification when a badge is unlocked
 */

import { useEffect, useState } from 'react';
import { BADGES, type BadgeId } from '@/game/systems/BadgeTracker';
import '@/ui/styles/badge-unlock-overlay.css';

interface BadgeUnlockOverlayProps {
  badgeId: BadgeId;
  onDismiss?: () => void;
}

export function BadgeUnlockOverlay({ badgeId, onDismiss }: BadgeUnlockOverlayProps) {
  const [isVisible, setIsVisible] = useState(true);
  const badge = BADGES[badgeId];

  useEffect(() => {
    // Auto-dismiss after 3 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, 3000);

    // Dismiss on any key press
    const handleKeyPress = () => {
      setIsVisible(false);
      onDismiss?.();
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [onDismiss]);

  if (!isVisible || !badge) {
    return null;
  }

  return (
    <div className="badge-unlock-overlay" role="status" aria-live="polite" aria-label={`Badge unlocked: ${badge.name}`}>
      <div className="badge-unlock-content">
        <div className="badge-unlock-background" />

        <div className="badge-unlock-icon-container">
          <span className="badge-unlock-icon">{badge.emoji}</span>
        </div>

        <h2 className="badge-unlock-title">Badge Unlocked!</h2>
        <h3 className="badge-unlock-name">{badge.name}</h3>
        <p className="badge-unlock-description">{badge.description}</p>

        <p className="badge-unlock-hint">Press any key or wait to continue</p>
      </div>
    </div>
  );
}
