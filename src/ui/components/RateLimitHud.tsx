import { useEffect, useState } from 'react';
import { rateLimitTracker, type RateLimitSnapshot } from '@/github/api';
import '@/ui/styles/rate-limit-hud.css';

/**
 * Displays the remaining GitHub REST budget for the current hour. Implements
 * optimization-research item #5 (rate-limit-aware degradation + HUD counter):
 * gives players visibility into their quota so they can self-regulate before
 * hitting the unauthenticated 60/hr cap. The "saved" pip lights up briefly
 * whenever the most recent request was a free `304 Not Modified` revalidation.
 */
export function RateLimitHud() {
  const [snapshot, setSnapshot] = useState<RateLimitSnapshot | null>(rateLimitTracker.get());
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    const unsubscribe = rateLimitTracker.subscribe((next) => {
      setSnapshot(next);
      if (next.lastWasConditional) {
        setSavedFlash(true);
        const timer = window.setTimeout(() => setSavedFlash(false), 1500);
        return () => window.clearTimeout(timer);
      }
    });
    return unsubscribe;
  }, []);

  if (!snapshot || snapshot.remaining === null) {
    return null;
  }

  const limit = snapshot.limit ?? 60;
  const remaining = snapshot.remaining;
  const severity: 'ok' | 'warn' | 'critical' =
    remaining <= 5 ? 'critical' : remaining <= 15 ? 'warn' : 'ok';

  const reset = snapshot.resetAt ? formatReset(snapshot.resetAt) : null;

  return (
    <div
      className={`rate-limit-hud rate-limit-hud--${severity}`}
      role="status"
      aria-live="polite"
      aria-label={`GitHub API budget: ${remaining} of ${limit} calls remaining this hour`}
    >
      <span className="rate-limit-hud__label">API</span>
      <span className="rate-limit-hud__count">
        {remaining}/{limit}
      </span>
      {reset && <span className="rate-limit-hud__reset">resets {reset}</span>}
      {savedFlash && (
        <span className="rate-limit-hud__saved" aria-hidden="true">
          ✓ cached
        </span>
      )}
    </div>
  );
}

function formatReset(resetAtIso: string): string {
  const resetAt = new Date(resetAtIso).getTime();
  const deltaMs = resetAt - Date.now();
  if (Number.isNaN(deltaMs) || deltaMs <= 0) return 'now';
  const totalMinutes = Math.ceil(deltaMs / 60_000);
  if (totalMinutes < 60) return `in ${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `in ${hours}h ${minutes}m` : `in ${hours}h`;
}
