/**
 * CharacterSelect - Character class selection screen
 * Appears on first load and allows player to select their class before entering dungeon
 */

import { useState } from 'react';
import { CLASSES, type PlayerClass } from '@/game/config/classes';
import { usePlayerStore } from '@/store/playerStore';
import { PLAYER_AVATAR_FALLBACK_SRC, getPlayerAvatarSrc } from '@/ui/constants/playerAvatar';
import '@/ui/styles/character-select.css';

interface CharacterSelectProps {
  onClassSelected?: (classId: PlayerClass) => void;
}

export function CharacterSelect({ onClassSelected }: CharacterSelectProps) {
  const { selectedClass, selectClass } = usePlayerStore();
  const classIds = Object.keys(CLASSES) as PlayerClass[];
  const initialClass = selectedClass ?? classIds[0];
  const [chosen, setChosen] = useState<PlayerClass | null>(selectedClass);
  const [isConfirmed, setIsConfirmed] = useState(!!selectedClass);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, classIds.indexOf(initialClass)));

  // If already selected, don't show modal
  if (isConfirmed && selectedClass) {
    return null;
  }

  const handleSelectClass = (classId: PlayerClass) => {
    setChosen(classId);
    setActiveIndex(classIds.indexOf(classId));
  };

  const handleStep = (offset: number) => {
    const nextIndex = (activeIndex + offset + classIds.length) % classIds.length;
    const nextClass = classIds[nextIndex];
    setActiveIndex(nextIndex);
    setChosen(nextClass);
  };

  const handleConfirm = () => {
    if (!chosen) return;
    selectClass(chosen);
    setIsConfirmed(true);
    onClassSelected?.(chosen);
  };

  const activeClass = CLASSES[classIds[activeIndex]];

  return (
    <div className="character-select-overlay" role="presentation">
      <div className="character-select-modal" role="dialog" aria-labelledby="char-select-title">
        <h1 id="char-select-title" className="char-select-title">
          Choose Your Class
        </h1>
        <p className="char-select-subtitle">
          Select a class to customize your dungeon exploration experience
        </p>

        <div className="char-select-carousel" aria-label="Class carousel">
          <button
            type="button"
            className="char-select-nav"
            onClick={() => handleStep(-1)}
            aria-label="Show previous class"
          >
            ‹
          </button>

          <div className="char-select-stage">
            <p className="char-select-position" aria-live="polite">
              {activeIndex + 1} / {classIds.length}
            </p>
            <button
              key={activeClass.id}
              className={`char-select-card ${chosen === activeClass.id ? 'selected' : ''}`}
              onClick={() => handleSelectClass(activeClass.id)}
              style={{
                '--class-color': activeClass.color,
              } as React.CSSProperties}
              aria-label={`Choose ${activeClass.name} class`}
              aria-pressed={chosen === activeClass.id}
            >
              <img
                className="char-select-avatar"
                src={getPlayerAvatarSrc(activeClass.id)}
                alt=""
                aria-hidden="true"
                onError={(event) => {
                  if (event.currentTarget.src !== PLAYER_AVATAR_FALLBACK_SRC) {
                    event.currentTarget.src = PLAYER_AVATAR_FALLBACK_SRC;
                  }
                }}
              />
              <div className="char-select-name">{activeClass.name}</div>
              <div className="char-select-description">{activeClass.description}</div>

              <div className="char-select-details">
                <div className="char-select-bonus">
                  <strong>Bonus:</strong> {activeClass.startingBonus}
                </div>
                <div className="char-select-ability">
                  <strong>Ability:</strong> {activeClass.specialAbility}
                </div>
              </div>
            </button>
          </div>

          <button
            type="button"
            className="char-select-nav"
            onClick={() => handleStep(1)}
            aria-label="Show next class"
          >
            ›
          </button>
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
