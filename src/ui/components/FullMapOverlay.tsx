import { useEffect, useRef, useState } from 'react';
import { useGameScene } from '@/ui/context/GameContext';
import { getVisitedStampsSystem } from '@/ui/systems/VisitedStamps';
import '@/ui/styles/map.css';

const BIOME_COLORS: Record<string, string> = {
  'neon-circuit-city': '#1e3a5f',
  'ancient-library': '#5c4033',
  'iron-forge': '#3a2f1f',
  'wind-temple': '#2d5f2f',
  'deep-dungeon': '#2a2a2a',
  'utility-vault': '#3d3d3d',
  'garden-ruins': '#4a5f3f',
  'lost-archive': '#6b5d4f',
};

const BIOME_NAMES: Record<string, string> = {
  'neon-circuit-city': 'Neon Circuit City',
  'ancient-library': 'Ancient Library',
  'iron-forge': 'Iron Forge',
  'wind-temple': 'Wind Temple',
  'deep-dungeon': 'Deep Dungeon',
  'utility-vault': 'Utility Vault',
  'garden-ruins': 'Garden Ruins',
  'lost-archive': 'Lost Archive',
};

/**
 * FullMapOverlay component showing the complete dungeon layout.
 * Toggled with the M key, closed with Escape.
 */
export function FullMapOverlay() {
  const { dungeon, playerState, currentRoom } = useGameScene();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [visitedRooms, setVisitedRooms] = useState<Set<string>>(new Set());

  // Get visited rooms
  useEffect(() => {
    const visited = getVisitedStampsSystem();
    setVisitedRooms(new Set(visited.getVisitedRooms()));
  }, []);

  // Handle M key to toggle
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'm') {
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Handle Escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Get biome color for a room
  const getBiomeColor = (zoneId: string | null): string => {
    if (!dungeon || !zoneId) return '#666666';
    const zone = dungeon.zones.find((z) => z.id === zoneId);
    if (!zone) return '#666666';
    return BIOME_COLORS[zone.biome.id] || '#666666';
  };

  // Draw full map to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dungeon || !playerState) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, width, height);

    // Calculate scale to fit all rooms
    const scale = zoom;
    const offsetX = width / 2 - (dungeon.width / 2) * scale;
    const offsetY = height / 2 - (dungeon.height / 2) * scale;

    // Helper to convert world coords to canvas coords
    const toCanvasX = (x: number) => x * scale + offsetX;
    const toCanvasY = (y: number) => y * scale + offsetY;

    // Draw zones as faint backgrounds
    for (const zone of dungeon.zones) {
      const color = BIOME_COLORS[zone.biome.id] || '#666666';
      const zoneMinX = toCanvasX(zone.bounds.x);
      const zoneMinY = toCanvasY(zone.bounds.y);
      const zoneWidth = zone.bounds.width * scale;
      const zoneHeight = zone.bounds.height * scale;

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.1;
      ctx.fillRect(zoneMinX, zoneMinY, zoneWidth, zoneHeight);
    }

    // Draw corridors
    for (const edge of dungeon.edges) {
      const lineColor = edge.type === 'corridor' ? '#7ba3d1' : '#9f8f6b';
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = Math.max(1, 2 * scale);
      ctx.globalAlpha = 0.5;

      if (edge.path.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(toCanvasX(edge.path[0].x), toCanvasY(edge.path[0].y));
        for (let i = 1; i < edge.path.length; i += 1) {
          ctx.lineTo(toCanvasX(edge.path[i].x), toCanvasY(edge.path[i].y));
        }
        ctx.stroke();
      }
    }

    // Draw rooms
    for (const room of dungeon.rooms) {
      const color = getBiomeColor(room.zoneId);
      const roomMinX = toCanvasX(room.position.x - room.size.width / 2);
      const roomMinY = toCanvasY(room.position.y - room.size.height / 2);
      const roomWidth = room.size.width * scale;
      const roomHeight = room.size.height * scale;

      // Check if room is visited
      const isVisited = visitedRooms.has(room.id);

      // Room background
      ctx.fillStyle = color;
      ctx.globalAlpha = isVisited ? 0.3 : 0.6;
      ctx.fillRect(roomMinX, roomMinY, roomWidth, roomHeight);

      // Room border
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, 1.5 * scale);
      ctx.strokeRect(roomMinX, roomMinY, roomWidth, roomHeight);

      // Visited stamp indicator
      if (isVisited) {
        ctx.fillStyle = 'rgba(74, 144, 226, 0.7)';
        ctx.globalAlpha = 0.8;
        const stampSize = Math.max(4, scale * 4);
        ctx.fillRect(roomMinX + roomWidth - stampSize - 1, roomMinY + 1, stampSize, stampSize);
        ctx.strokeStyle = '#4a90e2';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(roomMinX + roomWidth - stampSize - 1, roomMinY + 1, stampSize, stampSize);

        // Draw checkmark
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.max(2, scale * 3)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 1;
        ctx.fillText('✓', roomMinX + roomWidth - stampSize / 2 - 0.5, roomMinY + stampSize / 2 + 0.5);
      }

      // Highlight current room
      if (room.id === currentRoom?.id) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(2, 3 * scale);
        const pad = 3 * scale;
        ctx.strokeRect(roomMinX - pad, roomMinY - pad, roomWidth + 2 * pad, roomHeight + 2 * pad);
      }

      // Room label if zoomed in enough
      if (scale > 0.5 && roomWidth > 30 && roomHeight > 20) {
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.8;
        ctx.font = `${Math.max(8, scale * 10)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          room.name.split('/').pop() || room.name,
          roomMinX + roomWidth / 2,
          roomMinY + roomHeight / 2,
        );
      }
    }

    // Draw player position
    const playerX = toCanvasX(playerState.position.x);
    const playerY = toCanvasY(playerState.position.y);

    ctx.fillStyle = '#4a90e2';
    ctx.globalAlpha = 1;
    const playerRadius = Math.max(3, 4 * scale);
    ctx.beginPath();
    ctx.arc(playerX, playerY, playerRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw direction indicator
    ctx.fillStyle = '#ffffff';
    const arrowSize = Math.max(2, 3 * scale);
    const arrowDist = playerRadius + arrowSize + 2;
    let arrowX = playerX;
    let arrowY = playerY;

    switch (playerState.facingDirection) {
      case 'up':
        arrowY -= arrowDist;
        break;
      case 'down':
        arrowY += arrowDist;
        break;
      case 'left':
        arrowX -= arrowDist;
        break;
      case 'right':
        arrowX += arrowDist;
        break;
    }

    ctx.beginPath();
    ctx.arc(arrowX, arrowY, arrowSize, 0, Math.PI * 2);
    ctx.fill();
  }, [dungeon, playerState, currentRoom, zoom, visitedRooms]);

  // Get unique biomes for legend
  const biomesInDungeon = dungeon
    ? Array.from(new Set(dungeon.zones.map((z) => z.biome.id))).sort()
    : [];

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fullmap-overlay" role="dialog" aria-modal="true" aria-label="Full dungeon map">
      <div className="fullmap-modal">
        <div className="fullmap-header">
          <h2>Dungeon Map</h2>
          <button
            className="fullmap-close"
            onClick={() => setIsOpen(false)}
            type="button"
            aria-label="Close map"
          >
            ✕
          </button>
        </div>

        <div className="fullmap-canvas-container">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="fullmap-canvas"
            aria-hidden="true"
          />
        </div>

        <div className="fullmap-controls">
          <div className="fullmap-zoom">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
              aria-label="Zoom out"
            >
              −
            </button>
            <span className="fullmap-zoom-level">{(zoom * 100).toFixed(0)}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
              aria-label="Zoom in"
            >
              +
            </button>
          </div>
          <div className="fullmap-legend">
            {biomesInDungeon.map((biomeId) => (
              <div key={biomeId} className="fullmap-legend-item">
                <div
                  className="fullmap-legend-color"
                  style={{ backgroundColor: BIOME_COLORS[biomeId] }}
                  aria-hidden="true"
                />
                <span className="fullmap-legend-label">{BIOME_NAMES[biomeId]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="fullmap-footer">
          <p>Press <kbd>M</kbd> to toggle map | <kbd>Esc</kbd> to close</p>
        </div>
      </div>
    </div>
  );
}
