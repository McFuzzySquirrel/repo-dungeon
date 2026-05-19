import Phaser from 'phaser';
import type { GitHubRepoSummary } from '@/github/types';

/**
 * BootScene initializes the game and transitions to DungeonScene.
 * For now, it generates a test dungeon with mock repos.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    // Load any global assets here
  }

  create(): void {
    // Generate test dungeon with some mock repos for development
    const mockRepos = this.generateMockRepos();

    this.scene.start('DungeonScene', {
      repos: mockRepos,
      username: 'test-user',
      seed: '42',
    });
  }

  /**
   * Generate mock repos for development/testing.
   */
  private generateMockRepos(): GitHubRepoSummary[] {
    const languages = ['TypeScript', 'Python', 'Rust', 'Go', 'JavaScript', 'C', 'Shell'];
    const repos: GitHubRepoSummary[] = [];

    for (let i = 0; i < 20; i += 1) {
      const language = languages[i % languages.length];
      repos.push({
        id: i,
        name: `repo-${i}`,
        fullName: `test-user/repo-${i}`,
        ownerLogin: 'test-user',
        description: `Test repository ${i}`,
        htmlUrl: `https://github.com/test-user/repo-${i}`,
        language,
        stargazersCount: Math.floor(Math.random() * 1000),
        forksCount: Math.floor(Math.random() * 100),
        topics: ['test', 'demo'],
        isPrivate: false,
        defaultBranch: 'main',
      });
    }

    return repos;
  }
}

