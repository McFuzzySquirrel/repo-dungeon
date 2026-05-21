import type { DungeonRoomNode } from '@/game/systems/dungeonTypes';

export type RoomObjectType = 'readme-scroll' | 'file-tree-archive' | 'contributors-gallery';

export interface RoomObjectBlueprint {
  objectType: RoomObjectType;
  label: string;
  description: string;
  x: number;
  y: number;
}

export interface ContributorNPCData {
  id: string;
  login: string;
  contributions: number;
}

const ROOM_OBJECT_BLUEPRINTS: Omit<RoomObjectBlueprint, 'x' | 'y'>[] = [
  {
    objectType: 'readme-scroll',
    label: 'README Scroll',
    description: 'Opens the repository lore summary and notable snippets.',
  },
  {
    objectType: 'file-tree-archive',
    label: 'File Tree Archive',
    description: 'Inspects the top-level project structure.',
  },
  {
    objectType: 'contributors-gallery',
    label: "Contributors' Gallery",
    description: 'Highlights active collaborators and contribution counts.',
  },
];

function hashToPositiveInt(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function buildRoomObjectBlueprints(room: DungeonRoomNode): RoomObjectBlueprint[] {
  const centerX = room.position.x;
  const centerY = room.position.y;

  if (room.type !== 'repo') {
    return [
      {
        objectType: 'readme-scroll',
        label: 'Starter Cache',
        description: 'Starter collectible. Explore repo rooms for more loot markers.',
        x: centerX,
        y: centerY,
      },
    ];
  }

  const placements = createDeterministicRoomObjectPlacements(room);

  return ROOM_OBJECT_BLUEPRINTS.map((blueprint, index) => {
    const placement = placements[index] ?? { x: centerX, y: centerY };
    return {
      ...blueprint,
      x: placement.x,
      y: placement.y,
    };
  });
}

function createDeterministicRoomObjectPlacements(room: DungeonRoomNode): Array<{ x: number; y: number }> {
  const count = ROOM_OBJECT_BLUEPRINTS.length;
  const results: Array<{ x: number; y: number }> = [];

  const halfWidth = room.size.width / 2;
  const halfHeight = room.size.height / 2;
  const padding = 18;
  const minX = room.position.x - halfWidth + padding;
  const maxX = room.position.x + halfWidth - padding;
  const minY = room.position.y - halfHeight + padding;
  const maxY = room.position.y + halfHeight - padding;

  if (minX >= maxX || minY >= maxY) {
    return Array.from({ length: count }, () => ({ x: room.position.x, y: room.position.y }));
  }

  let randomSeed = (hashToPositiveInt(`${room.id}:loot`) % 2147483647) + 1;
  const nextRandom = (): number => {
    randomSeed = (randomSeed * 48271) % 2147483647;
    return randomSeed / 2147483647;
  };

  const minDistance = Math.max(20, Math.min(room.size.width, room.size.height) * 0.18);

  for (let index = 0; index < count; index += 1) {
    let placed = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const x = Math.round(minX + nextRandom() * (maxX - minX));
      const y = Math.round(minY + nextRandom() * (maxY - minY));

      const tooClose = results.some((other) => {
        const dx = other.x - x;
        const dy = other.y - y;
        return Math.hypot(dx, dy) < minDistance;
      });

      if (tooClose) {
        continue;
      }

      results.push({ x, y });
      placed = true;
      break;
    }

    if (!placed) {
      const angle = (Math.PI * 2 * index) / Math.max(1, count);
      const radiusX = Math.max(8, (maxX - minX) * 0.25);
      const radiusY = Math.max(8, (maxY - minY) * 0.25);
      results.push({
        x: Math.round(room.position.x + Math.cos(angle) * radiusX),
        y: Math.round(room.position.y + Math.sin(angle) * radiusY),
      });
    }
  }

  return results;
}

export function buildContributorNPCData(room: DungeonRoomNode): ContributorNPCData[] {
  if (room.type !== 'repo' || !room.repo) {
    return [];
  }

  const repo = room.repo;
  const ownerLogin = repo.ownerLogin;
  const hash = hashToPositiveInt(repo.fullName);
  const contributorCount = Math.max(1, Math.min(3, 1 + (hash % 3)));
  const baseContribution = Math.max(1, Math.floor((repo.stargazersCount + repo.forksCount) / 5));

  return Array.from({ length: contributorCount }, (_, index) => {
    const login = index === 0 ? ownerLogin : `${ownerLogin}-collab-${index}`;
    const contributionSeed = hashToPositiveInt(`${repo.fullName}:${index}`);

    return {
      id: `${room.id}:npc:${index}`,
      login,
      contributions: baseContribution + (contributionSeed % 25),
    };
  });
}

export function createDeterministicOffsets(seed: string, count: number, radius: number): Array<{ x: number; y: number }> {
  const offsets: Array<{ x: number; y: number }> = [];
  let randomSeed = (hashToPositiveInt(seed) % 2147483647) + 1;
  const nextRandom = (): number => {
    randomSeed = (randomSeed * 48271) % 2147483647;
    return randomSeed / 2147483647;
  };

  for (let i = 0; i < count; i += 1) {
    const angle = nextRandom() * Math.PI * 2;
    const distance = Math.max(8, radius * (0.5 + nextRandom() * 0.5));
    offsets.push({
      x: Math.round(Math.cos(angle) * distance),
      y: Math.round(Math.sin(angle) * distance),
    });
  }
  return offsets;
}
