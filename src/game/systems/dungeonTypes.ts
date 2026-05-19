import type { GitHubRepoSummary, GitHubUserSummary } from '@/github/types';
import type { BiomeTheme, ZoneSource } from '@/game/config/biomes';

export interface DungeonPoint {
  x: number;
  y: number;
}

export interface DungeonRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type DungeonRoomType = 'profile' | 'repo' | 'gateway';

export interface DungeonRoomNode {
  id: string;
  type: DungeonRoomType;
  zoneId: string | null;
  name: string;
  position: DungeonPoint;
  size: {
    width: number;
    height: number;
  };
  repo?: GitHubRepoSummary;
  profile?: Pick<GitHubUserSummary, 'login' | 'avatarUrl' | 'bio' | 'publicRepos' | 'followers'>;
}

export type DungeonEdgeType = 'corridor' | 'gateway';

export interface DungeonEdge {
  id: string;
  type: DungeonEdgeType;
  fromRoomId: string;
  toRoomId: string;
  path: DungeonPoint[];
}

export interface DungeonZone {
  id: string;
  key: string;
  label: string;
  source: ZoneSource;
  biome: BiomeTheme;
  bounds: DungeonRect;
  roomIds: string[];
  gatewayRoomId: string;
}

export interface DungeonGenerationMetadata {
  seed: string;
  numericSeed: number;
  repoCount: number;
  zoneCount: number;
  generationDurationMs: number;
}

export interface DungeonMap {
  width: number;
  height: number;
  entranceRoomId: string;
  rooms: DungeonRoomNode[];
  edges: DungeonEdge[];
  zones: DungeonZone[];
  metadata: DungeonGenerationMetadata;
}

