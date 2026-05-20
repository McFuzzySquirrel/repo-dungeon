import { useEffect } from 'react';
import '@/ui/styles/help-overlay.css';

interface HelpOverlayProps {
  onClose: () => void;
}

export function HelpOverlay({ onClose }: HelpOverlayProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'h' || e.key === 'H') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="help-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="help-panel">
        <div className="help-header">
          <h2 id="help-title" className="help-title">? How to Play</h2>
          <button
            className="help-close-btn"
            onClick={onClose}
            aria-label="Close help"
          >
            ✕
          </button>
        </div>

        <div className="help-body">
          <section className="help-section">
            <h3 className="help-section-title">🎮 Controls</h3>
            <table className="help-keybinds" aria-label="Key bindings">
              <tbody>
                <tr>
                  <td><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or <kbd>↑</kbd> <kbd>←</kbd> <kbd>↓</kbd> <kbd>→</kbd></td>
                  <td>Move</td>
                </tr>
                <tr>
                  <td><kbd>Shift</kbd> + move</td>
                  <td>Sprint</td>
                </tr>
                <tr>
                  <td><kbd>E</kbd></td>
                  <td>Interact with NPC / object</td>
                </tr>
                <tr>
                  <td><kbd>I</kbd></td>
                  <td>Open Inventory</td>
                </tr>
                <tr>
                  <td><kbd>M</kbd></td>
                  <td>Toggle full map</td>
                </tr>
                <tr>
                  <td>HUD buttons</td>
                  <td>Home, zoom, and help controls</td>
                </tr>
                <tr>
                  <td><kbd>H</kbd></td>
                  <td>Toggle this help screen</td>
                </tr>
                <tr>
                  <td><kbd>Esc</kbd></td>
                  <td>Close any open panel</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="help-section">
            <h3 className="help-section-title">🗺️ Exploration</h3>
            <ul className="help-list">
              <li>Walk into a room to discover it — each room is a GitHub repository.</li>
              <li>Use the top-right zoom controls if labels feel cramped or you need a wider view.</li>
              <li>Open the <strong>Room Info Panel</strong> to read the README, browse files, and see contributors.</li>
              <li>Rooms are grouped into <strong>biome zones</strong> themed by language and topics.</li>
              <li>Visited rooms are marked on the minimap with a ✓.</li>
            </ul>
          </section>

          <section className="help-section">
            <h3 className="help-section-title">⚡ Progression</h3>
            <ul className="help-list">
              <li>Earn <strong>XP</strong> by entering rooms, reading READMEs, and interacting with objects.</li>
              <li>Your XP and level appear in the top-left HUD so they stay clear of inventory controls.</li>
              <li>Collect <strong>loot</strong> from room objects and contributor NPCs.</li>
              <li>Unlock <strong>badges</strong> for milestones — check them in your Inventory.</li>
            </ul>
          </section>

          <section className="help-section">
            <h3 className="help-section-title">🔗 GitHub Connection</h3>
            <ul className="help-list">
              <li>Enter a GitHub username to load their public repositories as dungeon rooms.</li>
              <li>Repository data is cached locally — revisiting the same username loads instantly.</li>
              <li>Use the <strong>🔄 Refresh</strong> button on the welcome screen to re-fetch the latest repos.</li>
              <li>Share your dungeon with the <strong>Copy Share URL</strong> button.</li>
            </ul>
          </section>
        </div>

        <div className="help-footer">
          <button className="help-dismiss-btn" onClick={onClose}>
            Close  <kbd>Esc</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
