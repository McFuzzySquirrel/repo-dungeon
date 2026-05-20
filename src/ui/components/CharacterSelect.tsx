/**
 * CharacterSelect - Character class selection screen
 * Appears on first load and allows player to select their class before entering dungeon
 */

import { useState } from 'react';
import { CLASSES, type PlayerClass } from '@/game/config/classes';
import { usePlayerStore } from '@/store/playerStore';
import { PLAYER_AVATAR_FALLBACK_SRC, PLAYER_AVATAR_PRIMARY_SRC } from '@/ui/constants/playerAvatar';
import '@/ui/styles/character-select.css';

interface CharacterSelectProps {
  onClassSelected?: (classId: PlayerClass) => void;
}

export function CharacterSelect({ onClassSelected }: CharacterSelectProps) {
  const { selectedClass, selectClass } = usePlayerStore();
  const [chosen, setChosen] = useState<PlayerClass | null>(selectedClass);
  const [isConfirmed, setIsConfirmed] = useState(!!selectedClass);
  const [avatarSrc, setAvatarSrc] = useState(PLAYER_AVATAR_PRIMARY_SRC);

  // If already selected, don't show modal
  if (isConfirmed && selectedClass) {
    return null;
  }

  const handleSelectClass = (classId: PlayerClass) => {
    setChosen(classId);
  };

  const handleConfirm = () => {
    if (!chosen) return;
    selectClass(chosen);
    setIsConfirmed(true);
    onClassSelected?.(chosen);
  };
  const handleAvatarError = () => {
    if (avatarSrc !== PLAYER_AVATAR_FALLBACK_SRC) {
      setAvatarSrc(PLAYER_AVATAR_FALLBACK_SRC);
    }
  };

  return (
    <div className="character-select-overlay" role="presentation">
      <div className="character-select-modal" role="dialog" aria-labelledby="char-select-title">
        <h1 id="char-select-title" className="char-select-title">
          Choose Your Class
        </h1>
        <p className="char-select-subtitle">
          Select a class to customize your dungeon exploration experience
        </p>

        <div className="char-select-grid">
          {Object.values(CLASSES).map((classConfig) => (
            <button
              key={classConfig.id}
              className={`char-select-card ${chosen === classConfig.id ? 'selected' : ''}`}
              onClick={() => handleSelectClass(classConfig.id)}
              style={{
                '--class-color': classConfig.color,
              } as React.CSSProperties}
              aria-pressed={chosen === classConfig.id}
            >
              <img
                className="char-select-avatar"
                src={avatarSrc}
                alt=""
                aria-hidden="true"
                onError={handleAvatarError}
              />
              <div className="char-select-name">{classConfig.name}</div>
              <div className="char-select-description">{classConfig.description}</div>

              <div className="char-select-details">
                <div className="char-select-bonus">
                  <strong>Bonus:</strong> {classConfig.startingBonus}
                </div>
                <div className="char-select-ability">
                  <strong>Ability:</strong> {classConfig.specialAbility}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="char-select-actions">
          <button
            className="char-select-confirm-btn"
            onClick={handleConfirm}
            disabled={!chosen}
            aria-label={chosen ? `Confirm ${CLASSES[chosen].name} selection` : 'Select a class first'}
          >
            Confirm & Enter Dungeon
          </button>
        </div>
      </div>
    </div>
  );
}
