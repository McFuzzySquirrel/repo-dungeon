/**
 * InventoryPanel - React overlay for viewing collected loot
 */

import { useState, useEffect } from 'react';
import { BADGES } from '@/game/systems/BadgeTracker';
import { useProgressionStore } from '@/store/progressionStore';
import type { LootItem } from '@/game/systems/LootGenerator';
import type { BadgeId } from '@/game/systems/BadgeTracker';
import { isTypingInEditableTarget } from '@/ui/systems/keyboard';
import '@/ui/styles/inventory-panel.css';

type SortBy = 'date' | 'rarity' | 'language';

export function InventoryPanel() {
  const { inventory, unlockedBadges = [] } = useProgressionStore() as {
    inventory: LootItem[];
    unlockedBadges?: BadgeId[];
  };
  const [isOpen, setIsOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('date');

  // Toggle inventory with I key
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

  const sortedInventory = [...inventory].sort((a, b) => {
    if (sortBy === 'rarity') {
      const rarityOrder = { rare: 0, uncommon: 1, common: 2 };
      return rarityOrder[a.rarity] - rarityOrder[b.rarity];
    }
    if (sortBy === 'language') {
      return (a.language || '').localeCompare(b.language || '');
    }
    // date (default)
    return (b.timestamp || 0) - (a.timestamp || 0);
  });

  // Count items by name
  const itemCounts = new Map<string, number>();
  sortedInventory.forEach((item) => {
    itemCounts.set(item.name, (itemCounts.get(item.name) || 0) + 1);
  });

  // Get unique items
  const uniqueItems: LootItem[] = [];
  const seen = new Set<string>();
  sortedInventory.forEach((item) => {
    if (!seen.has(item.name)) {
      seen.add(item.name);
      uniqueItems.push(item);
    }
  });

  if (!isOpen) {
    return (
      <button
        className="inventory-button"
        onClick={() => setIsOpen(true)}
        title="Press I to open inventory"
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
            Inventory
          </h2>
          <button
            className="inventory-close-btn"
            onClick={() => setIsOpen(false)}
            aria-label="Close inventory"
          >
            ✕
          </button>
        </div>

        {inventory.length === 0 ? (
          <div className="inventory-empty">
            <p>No loot collected yet. Enter rooms to find treasure!</p>
          </div>
        ) : (
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

            <div className="inventory-grid">
              {uniqueItems.map((item) => {
                const count = itemCounts.get(item.name) || 1;
                return (
                  <div
                    key={item.id}
                    className={`inventory-item inventory-item-${item.rarity}`}
                    title={`${item.name} × ${count}\nFrom: ${item.repo}\nRarity: ${item.rarity}`}
                  >
                    <div className="inventory-item-icon">
                      {item.rarity === 'rare' && '💎'}
                      {item.rarity === 'uncommon' && '⭐'}
                      {item.rarity === 'common' && '📦'}
                    </div>
                    <div className="inventory-item-name">{item.name}</div>
                    {count > 1 && <div className="inventory-item-count">× {count}</div>}
                    <div className="inventory-item-repo">{item.repo}</div>
                    <div className="inventory-item-rarity">{item.rarity}</div>
                  </div>
                );
              })}
            </div>

            <div className="inventory-stats">
              <p>
                <strong>Total Items:</strong> {inventory.length}
              </p>
              <p>
                <strong>Unique Items:</strong> {uniqueItems.length}
              </p>
              <p>
                <strong>Rare:</strong> {inventory.filter((i) => i.rarity === 'rare').length} |{' '}
                <strong>Uncommon:</strong> {inventory.filter((i) => i.rarity === 'uncommon').length} |{' '}
                <strong>Common:</strong> {inventory.filter((i) => i.rarity === 'common').length}
              </p>
            </div>
          </>
        )}

        <div className="inventory-badges-section">
          <h3 className="inventory-badges-title">Badges</h3>
          {unlockedBadges.length > 0 ? (
            <div className="inventory-badges-grid">
              {unlockedBadges.map((badgeId) => {
                const badge = BADGES[badgeId];
                return (
                  <div key={badgeId} className="inventory-badge" title={badge.description}>
                    <span className="inventory-badge-icon" aria-hidden="true">{badge.emoji}</span>
                    <span className="inventory-badge-name">{badge.name}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="inventory-no-badges">No badges unlocked yet.</p>
          )}
        </div>

        <p className="inventory-hint">Press ESC or click outside to close (or press I)</p>
      </div>
    </div>
  );
}
