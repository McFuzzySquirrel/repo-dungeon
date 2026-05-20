import { getPlayerClassSprite } from '@/game/config/characterSprites';
import { useProgression } from '@/ui/hooks/useProgression';
import '@/ui/styles/selected-character-card.css';

export function SelectedCharacterCard() {
  const { selectedClass, classConfig, level, totalXp } = useProgression();
  const sprite = getPlayerClassSprite(selectedClass);

  return (
    <section className="selected-character-card" aria-label="Selected character">
      <div className="selected-character-card__header">
        <span className="selected-character-card__eyebrow">Active Class</span>
        <span className="selected-character-card__level">Lvl {level}</span>
      </div>
      <div className="selected-character-card__portrait-frame">
        <img
          className="selected-character-card__portrait"
          src={sprite.assetPath}
          alt={classConfig ? `${classConfig.name} character portrait` : 'Selected character portrait'}
        />
      </div>
      <div className="selected-character-card__body">
        <h2 className="selected-character-card__name">{classConfig?.name ?? 'Explorer'}</h2>
        <p className="selected-character-card__description">
          {classConfig?.description ?? 'Balanced adventurer focused on discovering new repositories'}
        </p>
        <p className="selected-character-card__bonus">{classConfig?.startingBonus ?? '+10% XP (discovery bonus)'}</p>
        <p className="selected-character-card__xp">{totalXp} XP banked</p>
      </div>
    </section>
  );
}