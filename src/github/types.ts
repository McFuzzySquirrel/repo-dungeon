export interface GitHubRepoSummary {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  language: string | null;
  stargazersCount: number;
  forksCount: number;
  topics: string[];
  isPrivate: boolean;
}

export interface GitHubUserSummary {
  id: number;
  login: string;
  avatarUrl: string;
  bio: string | null;
  publicRepos: number;
  followers: number;
}

export interface RoomRepositoryRef {
  roomId: string;
  owner: string;
  repo: string;
}
