export interface GitHubRepoSummary {
  id: number;
  name: string;
  fullName: string;
  ownerLogin: string;
  description: string | null;
  htmlUrl: string;
  language: string | null;
  stargazersCount: number;
  forksCount: number;
  topics: string[];
  isPrivate: boolean;
  defaultBranch: string;
}

export interface GitHubUserSummary {
  id: number;
  login: string;
  avatarUrl: string;
  bio: string | null;
  publicRepos: number;
  followers: number;
  following: number;
}

export interface RoomRepositoryRef {
  roomId: string;
  owner: string;
  repo: string;
}

export interface GitHubContributorSummary {
  id: number;
  login: string;
  avatarUrl: string;
  profileUrl: string;
  contributions: number;
}

export interface GitHubRepoTreeEntry {
  path: string;
  type: string;
}

export interface GitHubRateLimitInfo {
  limit: number | null;
  remaining: number | null;
  resetAt: string | null;
  retryAfterSeconds: number | null;
}

export interface GitHubApiErrorShape {
  kind: 'rate_limit' | 'not_found' | 'forbidden' | 'network' | 'unknown';
  message: string;
  isAuthenticated: boolean;
  shouldPromptLogin: boolean;
  status?: number;
  rateLimit?: GitHubRateLimitInfo;
}

export interface GitHubReadmePayload {
  plainText: string | null;
  truncated: boolean;
  unavailableReason?: string;
}

export interface GitHubRoomData {
  repo: GitHubRepoSummary;
  readme: GitHubReadmePayload;
  languages: Record<string, number>;
  topLevelTree: GitHubRepoTreeEntry[];
  treeTruncated: boolean;
  contributors: GitHubContributorSummary[];
  unavailable: Array<'readme' | 'languages' | 'tree' | 'contributors'>;
}

export interface RepoPageProgress {
  page: number;
  pageSize: number;
  accumulatedCount: number;
}
