import { useEffect, useState } from 'react';
import { readAudioSettings, writeAudioSettings } from '@/game/audio/audioSettings';

export function AudioControls() {
  const [muted, setMuted] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.6);

  useEffect(() => {
    const settings = readAudioSettings();
    setMuted(settings.muted);
    setMasterVolume(settings.masterVolume);
  }, []);

  const updateAudioSettings = (nextMuted: boolean, nextVolume: number) => {
    setMuted(nextMuted);
    setMasterVolume(nextVolume);
    writeAudioSettings({
      muted: nextMuted,
      masterVolume: nextVolume,
    });
    window.dispatchEvent(new CustomEvent('repo-dungeon:audio-settings-changed'));
  };

  return (
    <section className="audio-controls" aria-label="Audio controls">
      <button
        type="button"
        className="audio-mute-toggle"
        onClick={() => updateAudioSettings(!muted, masterVolume)}
      >
        {muted ? 'Unmute' : 'Mute'}
      </button>
      <label className="audio-volume-label">
        Volume
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(masterVolume * 100)}
          onChange={(event) => updateAudioSettings(muted, Number(event.target.value) / 100)}
          aria-label="Master volume"
        />
      </label>
    </section>
  );
}
