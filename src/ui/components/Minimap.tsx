import { useEffect, useRef, useMemo, useState } from 'react';
import { useGameScene } from '@/ui/context/GameContext';
import { getVisitedStampsSystem } from '@/ui/systems/VisitedStamps';
import type { DungeonRoomNode, DungeonZone } from '@/game/systems/dungeonTypes';
import { PLAYER_AVATAR_FALLBACK_SRC, PLAYER_AVATAR_PRIMARY_SRC } from '@/ui/constants/playerAvatar';
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

interface RoomWithZone {
  room: DungeonRoomNode;
  zone: DungeonZone | null;
}

interface MinimapBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Minimap HUD component showing a scaled-down view of the dungeon.
 * Displays the current room, nearby rooms, and player position.
 * Fixed to top-right corner of the screen.
 */
export function Minimap() {
  const { dungeon, playerState, currentRoom } = useGameScene();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visitedRooms, setVisitedRooms] = useState<Set<string>>(new Set());
  const [markerSrc, setMarkerSrc] = useState(PLAYER_AVATAR_PRIMARY_SRC);
  const [markerImage, setMarkerImage] = useState<HTMLImageElement | null>(null);

  // Get visited rooms
  useEffect(() => {
    const visited = getVisitedStampsSystem();
    setVisitedRooms(new Set(visited.getVisitedRooms()));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) {
        setMarkerImage(image);
      }
    };
    image.onerror = () => {
      if (cancelled) {
        return;
      }
      if (markerSrc !== PLAYER_AVATAR_FALLBACK_SRC) {
        setMarkerSrc(PLAYER_AVATAR_FALLBACK_SRC);
        return;
      }
      setMarkerImage(null);
    };
    image.src = markerSrc;

    return () => {
      cancelled = true;
    };
  }, [markerSrc]);

  // Get biome color for a room
  const getBiomeColor = (room: DungeonRoomNode): string => {
    if (!dungeon) return '#666666';
    const zone = dungeon.zones.find((z) => z.id === room.zoneId);
    if (!zone) return '#666666';
    return BIOME_COLORS[zone.biome.id] || '#666666';
  };

  // Get rooms within 1-2 hops of the player's current room
  const visibleRooms = useMemo((): RoomWithZone[] => {
    if (!dungeon || !currentRoom) return [];

    const visibleSet = new Set<string>();
    visibleSet.add(currentRoom.id);

    // Add adjacent rooms (rooms connected by corridors)
    for (const edge of dungeon.edges) {
      if (visibleSet.has(edge.fromRoomId)) {
        visibleSet.add(edge.toRoomId);
      }
      if (visibleSet.has(edge.toRoomId)) {
        visibleSet.add(edge.fromRoomId);
      }
    }

    // Add second-level adjacent rooms
    for (const edge of dungeon.edges) {
      if (visibleSet.has(edge.fromRoomId) && !visibleSet.has(edge.toRoomId)) {
        visibleSet.add(edge.toRoomId);
      }
      if (visibleSet.has(edge.toRoomId) && !visibleSet.has(edge.fromRoomId)) {
        visibleSet.add(edge.fromRoomId);
      }
    }

    return dungeon.rooms
      .filter((r) => visibleSet.has(r.id))
      .map((room) => ({
        room,
        zone: dungeon.zones.find((z) => z.id === room.zoneId) || null,
      }));
  }, [dungeon, currentRoom]);

  // Calculate bounds for visible rooms
  const bounds = useMemo((): MinimapBounds => {
    if (visibleRooms.length === 0) {
      return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const { room } of visibleRooms) {
      const roomMinX = room.position.x - room.size.width / 2;
      const roomMaxX = room.position.x + room.size.width / 2;
      const roomMinY = room.position.y - room.size.height / 2;
      const roomMaxY = room.position.y + room.size.height / 2;

      minX = Math.min(minX, roomMinX);
      maxX = Math.max(maxX, roomMaxX);
      minY = Math.min(minY, roomMinY);
      maxY = Math.max(maxY, roomMaxY);
    }

    // Add padding
    const padding = Math.max(maxX - minX, maxY - minY) * 0.1;
    return {
      minX: minX - padding,
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding,
    };
  }, [visibleRooms]);

  // Draw minimap to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || visibleRooms.length === 0 || !playerState) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, width, height);

    // Calculate scale
    const boundsWidth = bounds.maxX - bounds.minX;
    const boundsHeight = bounds.maxY - bounds.minY;
    const scaleX = (width * 0.9) / boundsWidth;
    const scaleY = (height * 0.9) / boundsHeight;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (width - boundsWidth * scale) / 2;
    const offsetY = (height - boundsHeight * scale) / 2;

    // Helper to convert world coords to canvas coords
    const toCanvasX = (x: number) => (x - bounds.minX) * scale + offsetX;
    const toCanvasY = (y: number) => (y - bounds.minY) * scale + offsetY;

    // Draw rooms
    for (const { room } of visibleRooms) {
      const color = getBiomeColor(room);
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
      ctx.lineWidth = 1;
      ctx.strokeRect(roomMinX, roomMinY, roomWidth, roomHeight);

      // Visited stamp indicator
      if (isVisited) {
        ctx.fillStyle = 'rgba(74, 144, 226, 0.7)';
        ctx.globalAlpha = 0.8;
        const stampSize = Math.max(4, scale * 3);
        ctx.fillRect(roomMinX + roomWidth - stampSize - 1, roomMinY + 1, stampSize, stampSize);
        ctx.strokeStyle = '#4a90e2';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(roomMinX + roomWidth - stampSize - 1, roomMinY + 1, stampSize, stampSize);

        // Draw checkmark
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.max(2, scale * 2)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✓', roomMinX + roomWidth - stampSize / 2 - 0.5, roomMinY + stampSize / 2 + 0.5);
      }

      // Highlight current room
      if (room.id === currentRoom?.id) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(roomMinX - 2, roomMinY - 2, roomWidth + 4, roomHeight + 4);
      }
    }

    // Draw player position
    const playerX = toCanvasX(playerState.position.x);
    const playerY = toCanvasY(playerState.position.y);

    if (markerImage) {
      const markerSize = 14;
      ctx.globalAlpha = 0.95;
      ctx.drawImage(markerImage, playerX - markerSize / 2, playerY - markerSize / 2, markerSize, markerSize);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.9;
      ctx.fillRect(playerX - 3, playerY - 3, 6, 6);
    }

    // Draw direction indicator (arrow)
    ctx.fillStyle = '#ffffff';
    const arrowSize = 4;
    const arrowDist = 8;
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
  }, [visibleRooms, playerState, bounds, currentRoom, getBiomeColor, visitedRooms, markerImage]);

  if (!currentRoom) {
    return null;
  }

  return (
    <div className="minimap-hud" role="region" aria-label="Dungeon minimap">
      <div className="minimap-container">
        <canvas
          ref={canvasRef}
          width={180}
          height={180}
          className="minimap-canvas"
          aria-hidden="true"
        />
      </div>
      <div className="minimap-info">
        <div className="minimap-room-name">{currentRoom.name}</div>
        {currentRoom.zoneId && dungeon?.zones.find((z) => z.id === currentRoom.zoneId) ? (
          <div className="minimap-biome">
            {dungeon.zones.find((z) => z.id === currentRoom.zoneId)?.label}
          </div>
        ) : null}
        <div className="minimap-coords">
          {playerState?.position.x.toFixed(0)}, {playerState?.position.y.toFixed(0)}
        </div>
      </div>
    </div>
  );
}
