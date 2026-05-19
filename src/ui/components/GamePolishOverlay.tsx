import { useCallback, useState } from 'react';
import {
  useOnContributorInteracted,
  useOnRoomObjectInteracted,
  useOnTutorialUpdated,
} from '@/ui/context/GameContext';

export function GamePolishOverlay() {
  const [tutorialText, setTutorialText] = useState<string | null>(null);
  const [interactionText, setInteractionText] = useState<string | null>(null);

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
      setInteractionText(`${event.title} activated.`);
      window.setTimeout(() => {
        setInteractionText(null);
      }, 1400);
    }, []),
  );

  useOnContributorInteracted(
    useCallback((event) => {
      setInteractionText(
        `Contributor ${event.contributor.login} — ${event.contributor.contributions} contributions`,
      );
      window.setTimeout(() => {
        setInteractionText(null);
      }, 1800);
    }, []),
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
