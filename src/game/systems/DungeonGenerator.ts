import { classifyRepoZone } from '@/game/config/biomes';
import type { DungeonEdge, DungeonMap, DungeonRect, DungeonRoomNode, DungeonZone } from '@/game/systems/dungeonTypes';
import type { GitHubRepoSummary, GitHubUserSummary } from '@/github/types';

const ZONE_MARGIN = 28;
const ROOM_MARGIN = 16;
const PROFILE_ROOM_ID = 'room:profile-hub';
const MAX_ROOM_SIZE = 120;
const MIN_PARTITION_SIZE = 96;

interface DungeonGenerationOptions {
  seed?: string;
  username?: string;
  profile?: Pick<GitHubUserSummary, 'login' | 'avatarUrl' | 'bio' | 'publicRepos' | 'followers'>;
}

interface RepoZoneBucket {
  key: string;
  label: string;
  source: DungeonZone['source'];
  biome: DungeonZone['biome'];
  repos: GitHubRepoSummary[];
}

interface SeededRandom {
  next: () => number;
}

export class DungeonGenerator {
  generate(repos: GitHubRepoSummary[], options: DungeonGenerationOptions = {}): DungeonMap {
    const startedAt = Date.now();
    const baseSeed = options.seed ?? options.username ?? repos.map((repo) => repo.fullName).join('|');
    const normalizedSeed = baseSeed.trim() === '' ? 'repo-dungeon-default' : baseSeed;
    const numericSeed = hashStringToUInt32(normalizedSeed);
    const random = createRandom(numericSeed);

    const sortedRepos = [...repos].sort((left, right) =>
      left.fullName.localeCompare(right.fullName) || left.id - right.id,
    );

    const zoneBuckets = groupReposByZone(sortedRepos);
    const orderedZoneBuckets = zoneBuckets.sort((left, right) => left.label.localeCompare(right.label));

    const zoneCount = orderedZoneBuckets.length;
    const mapWidth = Math.max(1200, 720 + zoneCount * 240);
    const mapHeight = Math.max(900, 520 + zoneCount * 180);

    const profileRoom: DungeonRoomNode = {
      id: PROFILE_ROOM_ID,
      type: 'profile',
      zoneId: null,
      name: 'Profile Room',
      position: { x: 120, y: Math.round(mapHeight / 2) },
      size: { width: 140, height: 140 },
      profile: options.profile,
    };

    const rooms: DungeonRoomNode[] = [profileRoom];
    const edges: DungeonEdge[] = [];
    const zones: DungeonZone[] = [];

    if (zoneCount === 0) {
      return {
        width: mapWidth,
        height: mapHeight,
        entranceRoomId: profileRoom.id,
        rooms,
        edges,
        zones,
        metadata: {
          seed: normalizedSeed,
          numericSeed,
          repoCount: repos.length,
          zoneCount,
          generationDurationMs: Date.now() - startedAt,
        },
      };
    }

    const zoneRects = splitRectanglesBsp(
      {
        x: 220,
        y: 60,
        width: mapWidth - 280,
        height: mapHeight - 120,
      },
      zoneCount,
      random,
    );

    orderedZoneBuckets.forEach((bucket, index) => {
      const zoneRect = zoneRects[index] ?? zoneRects[zoneRects.length - 1];
      const zoneId = `zone:${index}-${sanitizeId(bucket.label)}`;
      const gatewayRoom: DungeonRoomNode = {
        id: `room:gateway:${zoneId}`,
        type: 'gateway',
        zoneId,
        name: `${bucket.label} Gateway`,
        position: {
          x: Math.round(zoneRect.x + zoneRect.width / 2),
          y: Math.round(zoneRect.y + 26),
        },
        size: { width: 72, height: 72 },
      };
      rooms.push(gatewayRoom);

      const roomRects = splitRectanglesBsp(insetRect(zoneRect, ZONE_MARGIN), bucket.repos.length, random);
      const zoneRepoRooms: DungeonRoomNode[] = bucket.repos.map((repo, roomIndex) => {
        const roomRect = insetRect(roomRects[roomIndex], ROOM_MARGIN);
        const roomWidth = Math.max(48, Math.min(MAX_ROOM_SIZE, roomRect.width));
        const roomHeight = Math.max(48, Math.min(MAX_ROOM_SIZE, roomRect.height));
        return {
          id: `room:repo:${repo.id}`,
          type: 'repo',
          zoneId,
          name: repo.name,
          position: {
            x: Math.round(roomRect.x + roomRect.width / 2),
            y: Math.round(roomRect.y + roomRect.height / 2),
          },
          size: {
            width: roomWidth,
            height: roomHeight,
          },
          repo,
        };
      });
      rooms.push(...zoneRepoRooms);

      const sortedZoneRooms = [...zoneRepoRooms].sort(
        (left, right) => left.position.x - right.position.x || left.position.y - right.position.y,
      );
      sortedZoneRooms.forEach((room, edgeIndex) => {
        if (edgeIndex === 0) {
          edges.push(createEdge('corridor', gatewayRoom.id, room.id));
          return;
        }
        edges.push(createEdge('corridor', sortedZoneRooms[edgeIndex - 1].id, room.id));
      });

      zones.push({
        id: zoneId,
        key: bucket.key,
        label: bucket.label,
        source: bucket.source,
        biome: bucket.biome,
        bounds: zoneRect,
        roomIds: zoneRepoRooms.map((room) => room.id),
        gatewayRoomId: gatewayRoom.id,
      });
    });

    const sortedZones = [...zones].sort((left, right) => left.bounds.x - right.bounds.x || left.bounds.y - right.bounds.y);
    sortedZones.forEach((zone, zoneIndex) => {
      if (zoneIndex === 0) {
        edges.push(createEdge('gateway', profileRoom.id, zone.gatewayRoomId));
        return;
      }
      edges.push(createEdge('gateway', sortedZones[zoneIndex - 1].gatewayRoomId, zone.gatewayRoomId));
    });

    const roomById = new Map(rooms.map((room) => [room.id, room]));
    const hydratedEdges = edges.map((edge) => withPath(edge, roomById));

    return {
      width: mapWidth,
      height: mapHeight,
      entranceRoomId: profileRoom.id,
      rooms,
      edges: hydratedEdges,
      zones,
      metadata: {
        seed: normalizedSeed,
        numericSeed,
        repoCount: repos.length,
        zoneCount,
        generationDurationMs: Date.now() - startedAt,
      },
    };
  }
}

function groupReposByZone(repos: GitHubRepoSummary[]): RepoZoneBucket[] {
  const grouped = new Map<string, RepoZoneBucket>();

  repos.forEach((repo) => {
    const classification = classifyRepoZone(repo);
    const existing = grouped.get(classification.zoneKey);
    if (existing) {
      existing.repos.push(repo);
      return;
    }

    grouped.set(classification.zoneKey, {
      key: classification.zoneKey,
      label: classification.zoneLabel,
      source: classification.source,
      biome: classification.biome,
      repos: [repo],
    });
  });

  return [...grouped.values()];
}

function splitRectanglesBsp(root: DungeonRect, desiredCount: number, random: SeededRandom): DungeonRect[] {
  if (desiredCount <= 0) {
    return [];
  }
  if (desiredCount === 1) {
    return [root];
  }

  const partitions: DungeonRect[] = [root];

  while (partitions.length < desiredCount) {
    const splitIndex = indexOfLargestRect(partitions);
    const partition = partitions.splice(splitIndex, 1)[0];
    const split = splitRect(partition, random);

    if (!split) {
      partitions.push(partition);
      break;
    }

    partitions.push(split[0], split[1]);
  }

  partitions.sort((left, right) => left.x - right.x || left.y - right.y);
  return partitions.slice(0, desiredCount);
}

function splitRect(rect: DungeonRect, random: SeededRandom): [DungeonRect, DungeonRect] | null {
  const canSplitVertically = rect.width >= MIN_PARTITION_SIZE * 2;
  const canSplitHorizontally = rect.height >= MIN_PARTITION_SIZE * 2;

  if (!canSplitVertically && !canSplitHorizontally) {
    return null;
  }

  const preferVertical = rect.width >= rect.height;
  const splitVertical =
    canSplitVertically && (!canSplitHorizontally || (preferVertical ? random.next() > 0.2 : random.next() > 0.6));

  const ratio = 0.35 + random.next() * 0.3;

  if (splitVertical) {
    let leftWidth = Math.floor(rect.width * ratio);
    leftWidth = clamp(leftWidth, MIN_PARTITION_SIZE, rect.width - MIN_PARTITION_SIZE);
    const rightWidth = rect.width - leftWidth;
    return [
      { x: rect.x, y: rect.y, width: leftWidth, height: rect.height },
      { x: rect.x + leftWidth, y: rect.y, width: rightWidth, height: rect.height },
    ];
  }

  let topHeight = Math.floor(rect.height * ratio);
  topHeight = clamp(topHeight, MIN_PARTITION_SIZE, rect.height - MIN_PARTITION_SIZE);
  const bottomHeight = rect.height - topHeight;

  return [
    { x: rect.x, y: rect.y, width: rect.width, height: topHeight },
    { x: rect.x, y: rect.y + topHeight, width: rect.width, height: bottomHeight },
  ];
}

function createEdge(type: DungeonEdge['type'], fromRoomId: string, toRoomId: string): DungeonEdge {
  return {
    id: `edge:${type}:${fromRoomId}->${toRoomId}`,
    type,
    fromRoomId,
    toRoomId,
    path: [],
  };
}

function withPath(edge: DungeonEdge, roomById: Map<string, DungeonRoomNode>): DungeonEdge {
  const fromRoom = roomById.get(edge.fromRoomId);
  const toRoom = roomById.get(edge.toRoomId);
  if (!fromRoom || !toRoom) {
    return edge;
  }

  const from = fromRoom.position;
  const to = toRoom.position;
  const mid = {
    x: to.x,
    y: from.y,
  };

  const path = [from];
  if (mid.x !== from.x || mid.y !== from.y) {
    path.push(mid);
  }
  if (to.x !== mid.x || to.y !== mid.y) {
    path.push(to);
  }

  return {
    ...edge,
    path,
  };
}

function createRandom(seed: number): SeededRandom {
  let state = seed || 1;
  return {
    next: () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 4_294_967_296;
    },
  };
}

function hashStringToUInt32(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function indexOfLargestRect(rects: DungeonRect[]): number {
  let largestIndex = 0;
  let largestArea = -1;
  rects.forEach((rect, index) => {
    const area = rect.width * rect.height;
    if (area > largestArea) {
      largestArea = area;
      largestIndex = index;
    }
  });
  return largestIndex;
}

function insetRect(rect: DungeonRect, margin: number): DungeonRect {
  const width = Math.max(32, rect.width - margin * 2);
  const height = Math.max(32, rect.height - margin * 2);
  return {
    x: rect.x + margin,
    y: rect.y + margin,
    width,
    height,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function sanitizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, '-');
}
