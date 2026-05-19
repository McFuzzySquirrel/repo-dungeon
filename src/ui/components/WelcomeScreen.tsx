import '@/ui/styles/welcome-screen.css';

interface WelcomeScreenProps {
  onStart: () => void;
  onHelp: () => void;
}

export function WelcomeScreen({ onStart, onHelp }: WelcomeScreenProps) {
  return (
    <div className="welcome-overlay" role="main" aria-label="Welcome to Repo Dungeon">
      <div className="welcome-content">
        <div className="welcome-logo-area">
          <div className="welcome-icon" aria-hidden="true">⚔️</div>
          <h1 className="welcome-title">REPO DUNGEON</h1>
          <p className="welcome-tagline">
            Explore your GitHub universe as a procedurally generated dungeon
          </p>
        </div>

        <ul className="welcome-features" aria-label="Game features">
          <li>
            <span className="feature-icon" aria-hidden="true">🗺️</span>
            <span>Every repository becomes a room to discover</span>
          </li>
          <li>
            <span className="feature-icon" aria-hidden="true">⚡</span>
            <span>Earn XP, loot, and badges as you explore</span>
          </li>
          <li>
            <span className="feature-icon" aria-hidden="true">👥</span>
            <span>Meet contributor NPCs and interact with room objects</span>
          </li>
          <li>
            <span className="feature-icon" aria-hidden="true">🌍</span>
            <span>Biomes themed by language and topics</span>
          </li>
        </ul>

        <div className="welcome-actions">
          <button
            className="welcome-btn welcome-btn--primary"
            onClick={onStart}
            autoFocus
          >
            ⚔️ Start Adventure
          </button>
          <button
            className="welcome-btn welcome-btn--secondary"
            onClick={onHelp}
          >
            ? How to Play
          </button>
        </div>

        <p className="welcome-hint">
          Connect your GitHub account to generate a dungeon from your own repositories
        </p>
      </div>
    </div>
  );
}
