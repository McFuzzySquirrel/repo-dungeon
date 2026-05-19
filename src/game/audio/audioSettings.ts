export const AUDIO_STORAGE_KEYS = {
  muted: 'repo-dungeon:v1:audio:muted',
  masterVolume: 'repo-dungeon:v1:audio:master-volume',
} as const;

export interface AudioSettings {
  muted: boolean;
  masterVolume: number;
}

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  muted: false,
  masterVolume: 0.6,
};

export function readAudioSettings(): AudioSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_AUDIO_SETTINGS;
  }

  const mutedRaw = window.localStorage.getItem(AUDIO_STORAGE_KEYS.muted);
  const volumeRaw = window.localStorage.getItem(AUDIO_STORAGE_KEYS.masterVolume);
  const parsedVolume = Number.parseFloat(volumeRaw ?? '');

  return {
    muted: mutedRaw === 'true',
    masterVolume: Number.isFinite(parsedVolume)
      ? Math.max(0, Math.min(1, parsedVolume))
      : DEFAULT_AUDIO_SETTINGS.masterVolume,
  };
}

export function writeAudioSettings(settings: AudioSettings): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(AUDIO_STORAGE_KEYS.muted, settings.muted ? 'true' : 'false');
  window.localStorage.setItem(
    AUDIO_STORAGE_KEYS.masterVolume,
    Math.max(0, Math.min(1, settings.masterVolume)).toFixed(2),
  );
}

export function isReducedMotionPreferred(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
