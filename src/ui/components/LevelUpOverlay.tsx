/**
 * LevelUpOverlay - Full-screen animation when player levels up
 */

import { useEffect, useState } from 'react';
import '@/ui/styles/level-up-overlay.css';

interface LevelUpOverlayProps {
  level: number;
  onDismiss?: () => void;
}

export function LevelUpOverlay({ level, onDismiss }: LevelUpOverlayProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Auto-dismiss after 2.5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, 2500);

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

  if (!isVisible) {
    return null;
  }

  return (
    <div className="level-up-overlay" role="status" aria-live="polite" aria-label={`Level Up! You are now level ${level}`}>
      <div className="level-up-content">
        <div className="confetti" />
        <div className="level-up-text">
          <span className="level-up-label">LEVEL UP!</span>
          <span className="level-up-number">{level}</span>
        </div>
        <p className="level-up-subtitle">Press any key or wait to continue</p>
      </div>
    </div>
  );
}
