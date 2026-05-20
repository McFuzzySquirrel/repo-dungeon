import { GitHubApiError, GitHubApiClient } from '@/github/api';
import type { GitHubRoomData, RoomRepositoryRef } from '@/github/types';

export type RoomLoadState = 'idle' | 'loading' | 'ready' | 'error';

export interface RoomLoadResult {
  state: RoomLoadState;
  room: RoomRepositoryRef;
  data: GitHubRoomData | null;
  errorMessage?: string;
}

export class RoomLoader {
  private readonly roomCache = new Map<string, GitHubRoomData>();

  constructor(private readonly apiClient: GitHubApiClient) {}

  async load(room: RoomRepositoryRef): Promise<RoomLoadResult> {
    const key = `${room.owner}/${room.repo}`;
    const cached = this.roomCache.get(key);
    if (cached) {
      return {
        state: 'ready',
        room,
        data: cached,
      };
    }

    try {
      const data = await this.apiClient.loadRoomData(room);
      this.roomCache.set(key, data);
      return {
        state: 'ready',
        room,
        data,
      };
    } catch (error) {
      if (error instanceof GitHubApiError) {
        return {
          state: 'error',
          room,
          data: null,
          errorMessage: error.details.message,
        };
      }

      return {
        state: 'error',
        room,
        data: null,
        errorMessage: 'Repository details are currently unavailable.',
      };
    }
  }

  clear(): void {
    this.roomCache.clear();
  }
}
