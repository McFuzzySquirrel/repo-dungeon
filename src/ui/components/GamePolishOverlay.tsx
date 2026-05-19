import { useCallback, useState } from 'react';
import {
  useOnContributorInteracted,
  useOnRoomObjectInteracted,
  useOnTutorialUpdated,
} from '@/ui/context/GameContext';
import { useProgressionStore } from '@/store/progressionStore';
import type { LootItem } from '@/game/systems/LootGenerator';

function createLootFromRoomObject(event: {
  roomId: string;
  roomName: string;
  objectType: 'readme-scroll' | 'file-tree-archive' | 'contributors-gallery';
  title: string;
  description: string;
}): LootItem {
  const rarityByObjectType: Record<typeof event.objectType, LootItem['rarity']> = {
    'readme-scroll': 'common',
    'file-tree-archive': 'uncommon',
    'contributors-gallery': 'uncommon',
  };

  return {
    id: `loot-${event.roomId}-${event.objectType}-${Date.now()}`,
    name: event.title,
    rarity: rarityByObjectType[event.objectType],
    repo: event.roomName,
    repoUrl: '',
    description: event.description,
    timestamp: Date.now(),
  };
}

export function GamePolishOverlay() {
  const [tutorialText, setTutorialText] = useState<string | null>(null);
  const [interactionText, setInteractionText] = useState<string | null>(null);
  const addLoot = useProgressionStore((state) => state.addLoot);

  useOnTutorialUpdated(
    useCallback((event) => {
      if (event.completed) {
        setTutorialText(null);
        return;
      }

      const tutorialByStep: Record<number, string> = {
        0: 'Tutorial: Move around with WASD/Arrow keys.',
        1: 'Tutorial: Look for glowing Loot markers and press E near them (or contributors).',
        2: 'Tutorial complete — press M for map and keep exploring!',
      };

      setTutorialText(tutorialByStep[event.step] ?? null);
    }, []),
  );

  useOnRoomObjectInteracted(
    useCallback((event) => {
      addLoot(createLootFromRoomObject(event));
      setInteractionText(`${event.title} activated.`);
      window.setTimeout(() => {
        setInteractionText(null);
      }, 1400);
    }, [addLoot]),
  );

  useOnContributorInteracted(
    useCallback((event) => {
      addLoot({
        id: `loot-${event.roomId}-contributor-${event.contributor.id}-${Date.now()}`,
        name: `${event.contributor.login} Cache`,
        rarity: event.contributor.contributions > 20 ? 'uncommon' : 'common',
        repo: event.contributor.login,
        repoUrl: '',
        description: `Contributor bundle with ${event.contributor.contributions} contributions`,
        timestamp: Date.now(),
      });
      setInteractionText(
        `Contributor ${event.contributor.login} — ${event.contributor.contributions} contributions`,
      );
      window.setTimeout(() => {
        setInteractionText(null);
      }, 1800);
    }, [addLoot]),
  );

  if (!tutorialText && !interactionText) {
    return null;
  }

  return (
    <section className="polish-overlay" aria-live="polite">
      {tutorialText ? <p className="polish-tutorial">{tutorialText}</p> : null}
      {interactionText ? <p className="polish-interaction">{interactionText}</p> : null}
    </section>
  );
}
