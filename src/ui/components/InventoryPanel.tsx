/**
 * InventoryPanel - React overlay for viewing collected loot and progression collections
 */

import { useState, useEffect, useMemo } from 'react';
import { BADGES } from '@/game/systems/BadgeTracker';
import { getBadgeProgress, type BadgeId } from '@/game/systems/progressionEngine';
import { useProgressionStore } from '@/store/progressionStore';
import { isTypingInEditableTarget } from '@/ui/systems/keyboard';
import '@/ui/styles/inventory-panel.css';

type SortBy = 'date' | 'rarity' | 'language';
type CollectionsTab = 'loot' | 'badges' | 'archaeology';

const ALL_BADGE_IDS = Object.keys(BADGES) as BadgeId[];

export function InventoryPanel() {
  const inventory = useProgressionStore((state) => state.inventory);
  const unlockedBadges = useProgressionStore((state) => state.unlockedBadges);
  const discoveryCount = useProgressionStore((state) => state.discoveryCount);
  const readmeCount = useProgressionStore((state) => state.readmeCount);
  const githubLinkClicks = useProgressionStore((state) => state.githubLinkClicks);
  const reviewPassCount = useProgressionStore((state) => state.reviewPassCount);
  const archaeologyReviewCount = useProgressionStore((state) => state.archaeologyReviewCount);
  const roomsTowardNextPass = useProgressionStore((state) => state.roomsTowardNextPass);
  const archaeologyLog = useProgressionStore((state) => state.archaeologyLog);

  const [isOpen, setIsOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [activeTab, setActiveTab] = useState<CollectionsTab>('loot');
  const [selectedLootId, setSelectedLootId] = useState<string | null>(null);
  const [selectedBadgeId, setSelectedBadgeId] = useState<BadgeId | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingInEditableTarget(e.target)) {
        return;
      }

      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const sortedInventory = useMemo(() => [...inventory].sort((a, b) => {
    if (sortBy === 'rarity') {
      const rarityOrder = { rare: 0, uncommon: 1, common: 2 };
      return rarityOrder[a.rarity] - rarityOrder[b.rarity];
    }
    if (sortBy === 'language') {
      return (a.language || '').localeCompare(b.language || '');
    }
    return (b.timestamp || 0) - (a.timestamp || 0);
  }), [inventory, sortBy]);

  const signals = { discoveryCount, readmeCount, githubLinkClicks, reviewPassCount };
  const selectedLoot = sortedInventory.find((item) => item.id === selectedLootId) ?? sortedInventory[0] ?? null;
  const selectedBadge = selectedBadgeId ? BADGES[selectedBadgeId] : null;
  const selectedBadgeProgress = selectedBadgeId
    ? getBadgeProgress(selectedBadgeId, signals, unlockedBadges.includes(selectedBadgeId))
    : null;

  if (!isOpen) {
    return (
      <button
        className="inventory-button"
        onClick={() => setIsOpen(true)}
        title="Press I to open collections"
        aria-label="Open inventory (press I)"
      >
        <span className="inventory-icon">🎒</span>
        {inventory.length > 0 && <span className="inventory-count">{inventory.length}</span>}
      </button>
    );
  }

  return (
    <div className="inventory-overlay" role="presentation" onClick={() => setIsOpen(false)}>
      <div className="inventory-panel" role="dialog" aria-labelledby="inventory-title" onClick={(e) => e.stopPropagation()}>
        <div className="inventory-header">
          <h2 id="inventory-title" className="inventory-title">
            Collections
          </h2>
          <button
            className="inventory-close-btn"
            onClick={() => setIsOpen(false)}
            aria-label="Close inventory"
          >
            ✕
          </button>
        </div>

        <div className="inventory-collection-tabs" role="tablist" aria-label="Collections tabs">
          <button type="button" className={`inventory-collection-tab ${activeTab === 'loot' ? 'active' : ''}`} onClick={() => setActiveTab('loot')} role="tab" aria-selected={activeTab === 'loot'}>Loot</button>
          <button type="button" className={`inventory-collection-tab ${activeTab === 'badges' ? 'active' : ''}`} onClick={() => setActiveTab('badges')} role="tab" aria-selected={activeTab === 'badges'}>Badges</button>
          <button type="button" className={`inventory-collection-tab ${activeTab === 'archaeology' ? 'active' : ''}`} onClick={() => setActiveTab('archaeology')} role="tab" aria-selected={activeTab === 'archaeology'}>Archaeology</button>
        </div>

        {activeTab === 'loot' && (
          <>
            <div className="inventory-controls">
              <label htmlFor="sort-select" className="inventory-sort-label">
                Sort by:
              </label>
              <select
                id="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="inventory-sort-select"
              >
                <option value="date">Date Acquired</option>
                <option value="rarity">Rarity</option>
                <option value="language">Language</option>
              </select>
            </div>

            {inventory.length === 0 ? (
              <div className="inventory-empty">
                <p>No loot collected yet. Enter rooms to find treasure!</p>
              </div>
            ) : (
              <div className="inventory-collections-layout">
                <div className="inventory-grid">
                  {sortedInventory.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={`inventory-item inventory-item-${item.rarity} ${selectedLoot?.id === item.id ? 'selected' : ''}`}
                      onClick={() => setSelectedLootId(item.id)}
                    >
                      <div className="inventory-item-icon">
                        {item.rarity === 'rare' && '💎'}
                        {item.rarity === 'uncommon' && '⭐'}
                        {item.rarity === 'common' && '📦'}
                      </div>
                      <div className="inventory-item-name">{item.name}</div>
                      <div className="inventory-item-repo">{item.repo}</div>
                    </button>
                  ))}
                </div>

                {selectedLoot && (
                  <aside className="inventory-detail" aria-label="Selected loot details">
                    <h3>{selectedLoot.name}</h3>
                    <p><strong>Rarity:</strong> {selectedLoot.rarity}</p>
                    <p><strong>Source room:</strong> {selectedLoot.repo}</p>
                    {selectedLoot.language ? <p><strong>Language:</strong> {selectedLoot.language}</p> : null}
                    <p>{selectedLoot.description}</p>
                  </aside>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'badges' && (
          <div className="inventory-collections-layout">
            <div className="inventory-badges-grid">
              {ALL_BADGE_IDS.map((badgeId) => {
                const badge = BADGES[badgeId];
                const unlocked = unlockedBadges.includes(badgeId);
                const progress = getBadgeProgress(badgeId, signals, unlocked);
                return (
                  <button
                    type="button"
                    key={badgeId}
                    className={`inventory-badge inventory-badge-card ${unlocked ? 'unlocked' : 'locked'} ${selectedBadgeId === badgeId ? 'selected' : ''}`}
                    onClick={() => setSelectedBadgeId(badgeId)}
                  >
                    <span className="inventory-badge-icon" aria-hidden="true">{badge.emoji}</span>
                    <span className="inventory-badge-name">{badge.name}</span>
                    <span className="inventory-badge-name">{progress.nextMilestone ? `${progress.current}/${progress.nextMilestone.target}` : 'Complete'}</span>
                  </button>
                );
              })}
            </div>

            {selectedBadge && selectedBadgeProgress && (
              <aside className="inventory-detail" aria-label="Selected badge details">
                <h3>{selectedBadge.emoji} {selectedBadge.name}</h3>
                <p>{selectedBadge.description}</p>
                <p>{selectedBadge.unlockDetail}</p>
                <p><strong>Status:</strong> {unlockedBadges.includes(selectedBadge.id) ? 'Unlocked' : 'Locked'}</p>
                {selectedBadgeProgress.nextMilestone ? (
                  <p>
                    <strong>Next milestone:</strong> {selectedBadgeProgress.nextMilestone.label} ({selectedBadgeProgress.current}/{selectedBadgeProgress.nextMilestone.target})
                  </p>
                ) : (
                  <p><strong>Milestones:</strong> Complete</p>
                )}
              </aside>
            )}
          </div>
        )}

        {activeTab === 'archaeology' && (
          <div className="inventory-archaeology-log">
            <p><strong>Review checkpoints:</strong> {archaeologyReviewCount}</p>
            <p><strong>Completed review passes:</strong> {reviewPassCount}</p>
            <p><strong>Rooms toward next pass:</strong> {roomsTowardNextPass}</p>
            <h3 className="inventory-badges-title">Recent field log</h3>
            {archaeologyLog.length === 0 ? (
              <p className="inventory-no-badges">No archaeology events yet. Revisit rooms to begin a review pass.</p>
            ) : (
              <div className="inventory-archaeology-list">
                {[...archaeologyLog].reverse().slice(0, 10).map((entry) => (
                  <article key={entry.id} className="inventory-archaeology-entry">
                    <strong>{entry.action === 'review-pass' ? 'Review pass complete' : 'Review checkpoint'}</strong>
                    <span>{entry.roomName}</span>
                    <time dateTime={new Date(entry.timestamp).toISOString()}>{new Date(entry.timestamp).toLocaleString()}</time>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="inventory-hint">Press ESC or click outside to close (or press I)</p>
      </div>
    </div>
  );
}
