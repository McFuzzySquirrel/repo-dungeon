import type { GitHubRepoSummary } from '@/github/types';
import type { GitHubSourceIdentity, LocalSourceIdentity, RepositorySourceIdentity } from '@/repository/source';

export interface RepositorySummaryBase {
  source: RepositorySourceIdentity;
  /** Source-stable identifier used for deterministic room/cache keys. */
  repositoryId: string;
  name: string;
  fullName: string;
  description: string | null;
  primaryLanguage: string | null;
  defaultBranch: string | null;
}

export interface GitHubRepositorySummary extends RepositorySummaryBase {
  source: GitHubSourceIdentity;
  github: GitHubRepoSummary;
}

export interface LocalRepositoryMetadata {
  /** Relative repository path from the selected local source root. */
  relativePath: string;
  /** Optional display label shown in source-aware UIs. */
  sourceLabel?: string;
  /** Optional remotes discovered locally (no network fetch required). */
  remotes?: string[];
}

export interface LocalRepositorySummary extends RepositorySummaryBase {
  source: LocalSourceIdentity;
  local: LocalRepositoryMetadata;
}

export type RepositorySummary = GitHubRepositorySummary | LocalRepositorySummary;

export function toRepositorySummaryFromGitHub(
  source: GitHubSourceIdentity,
  repo: GitHubRepoSummary,
): GitHubRepositorySummary {
  return {
    source,
    repositoryId: `${repo.ownerLogin.toLowerCase()}/${repo.name.toLowerCase()}`,
    name: repo.name,
    fullName: repo.fullName,
    description: repo.description,
    primaryLanguage: repo.language,
    defaultBranch: repo.defaultBranch,
    github: repo,
  };
}
