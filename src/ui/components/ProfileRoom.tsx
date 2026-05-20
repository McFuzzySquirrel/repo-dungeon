/**
 * ProfileRoom - Special hub room displaying character stats and progress
 */

import { useState } from 'react';
import { useProgressionStore } from '@/store/progressionStore';
import { CLASSES } from '@/game/config/classes';
import { BADGES } from '@/game/systems/BadgeTracker';
import { getXpForNextLevel } from '@/game/systems/ProgressionTracker';
import { PLAYER_AVATAR_FALLBACK_SRC, PLAYER_AVATAR_PRIMARY_SRC } from '@/ui/constants/playerAvatar';
import '@/ui/styles/profile-room.css';

interface ProfileRoomProps {
  totalRooms: number;
  visitedRooms: number;
}

export function ProfileRoom({ totalRooms, visitedRooms }: ProfileRoomProps) {
  const { selectedClass, level, xpTowardNextLevel, inventory, unlockedBadges } = useProgressionStore();
  const [avatarSrc, setAvatarSrc] = useState(PLAYER_AVATAR_PRIMARY_SRC);

  if (!selectedClass) {
    return null;
  }

  const classConfig = CLASSES[selectedClass];

  // Get top 5 loot items by rarity and uniqueness
  const itemsByRarity = {
    rare: inventory.filter((i) => i.rarity === 'rare').slice(0, 2),
    uncommon: inventory.filter((i) => i.rarity === 'uncommon').slice(0, 2),
    common: inventory.filter((i) => i.rarity === 'common').slice(0, 1),
  };

  const topLoot = [
    ...itemsByRarity.rare,
    ...itemsByRarity.uncommon,
    ...itemsByRarity.common,
  ];

  // Calculate progress (assuming 300 XP to next level on average)
  const maxXpPerLevel = getXpForNextLevel(level);
  const progressPercent = Math.min((xpTowardNextLevel / maxXpPerLevel) * 100, 100);
  const handleAvatarError = () => {
    if (avatarSrc !== PLAYER_AVATAR_FALLBACK_SRC) {
      setAvatarSrc(PLAYER_AVATAR_FALLBACK_SRC);
    }
  };

  return (
    <div className="profile-room" role="complementary" aria-label="Player profile">
      <div className="profile-room-content">
          {/* Class and Level Section */}
          <div className="profile-section profile-class-section">
            <div className="profile-class-header">
              <img
                className="profile-class-avatar"
                src={avatarSrc}
                alt=""
                aria-hidden="true"
                onError={handleAvatarError}
              />
              <div className="profile-class-info">
              <h2 className="profile-class-name">{classConfig.name}</h2>
              <p className="profile-class-desc">{classConfig.description}</p>
            </div>
          </div>

          <div className="profile-level-info">
            <div className="profile-level-display">
              <span className="profile-level-number">{level}</span>
              <span className="profile-level-label">Level</span>
            </div>
          </div>
        </div>

        {/* XP Progress Bar */}
        <div className="profile-section profile-xp-section">
          <h3 className="profile-section-title">Progress to Next Level</h3>
          <div className="profile-xp-bar-container">
            <div className="profile-xp-bar">
              <div
                className="profile-xp-fill"
                style={{ width: `${progressPercent}%` }}
                role="progressbar"
                aria-valuenow={Math.round(progressPercent)}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <p className="profile-xp-text">{xpTowardNextLevel} / {maxXpPerLevel} XP</p>
          </div>
        </div>

        {/* Rooms Visited */}
        <div className="profile-section profile-rooms-section">
          <h3 className="profile-section-title">Exploration</h3>
          <p className="profile-rooms-count">
            <strong>{visitedRooms}</strong> / {totalRooms} Rooms Visited
          </p>
          <div className="profile-rooms-bar">
            <div
              className="profile-rooms-fill"
              style={{ width: `${(visitedRooms / totalRooms) * 100}%` }}
            />
          </div>
        </div>

        {/* Badges */}
        <div className="profile-section profile-badges-section">
          <h3 className="profile-section-title">Badges ({unlockedBadges.length})</h3>
          <div className="profile-badges-grid">
            {unlockedBadges.length > 0 ? (
              unlockedBadges.map((badgeId) => {
                const badge = BADGES[badgeId];
                return (
                  <div key={badgeId} className="profile-badge" title={badge.name}>
                    <span className="profile-badge-icon">{badge.emoji}</span>
                    <span className="profile-badge-name">{badge.name}</span>
                  </div>
                );
              })
            ) : (
              <p className="profile-no-badges">No badges earned yet. Explore to earn achievements!</p>
            )}
          </div>
        </div>

        {/* Top Loot */}
        {topLoot.length > 0 && (
          <div className="profile-section profile-loot-section">
            <h3 className="profile-section-title">Notable Loot</h3>
            <div className="profile-loot-list">
              {topLoot.map((item) => (
                <div key={item.id} className={`profile-loot-item profile-loot-${item.rarity}`}>
                  <span className="profile-loot-icon">
                    {item.rarity === 'rare' && '💎'}
                    {item.rarity === 'uncommon' && '⭐'}
                    {item.rarity === 'common' && '📦'}
                  </span>
                  <div className="profile-loot-details">
                    <strong>{item.name}</strong>
                    <small>{item.repo}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Summary */}
        <div className="profile-section profile-stats-section">
          <h3 className="profile-section-title">Stats</h3>
          <div className="profile-stats-grid">
            <div className="profile-stat">
              <span className="profile-stat-label">Total Loot</span>
              <span className="profile-stat-value">{inventory.length}</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-label">Rare Items</span>
              <span className="profile-stat-value">{inventory.filter((i) => i.rarity === 'rare').length}</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-label">Exploration</span>
              <span className="profile-stat-value">
                {Math.round((visitedRooms / totalRooms) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
