/**
 * VisitedStamps system manages visited room tracking and localStorage persistence.
 * Visited rooms are marked when a player dismisses the Room Info Panel.
 */

const STORAGE_KEY_PREFIX = 'repo-dungeon:visited-rooms:';

export class VisitedStampsSystem {
  private visitedRooms: Set<string>;
  private username: string | null;

  constructor(username?: string) {
    this.username = username || null;
    this.visitedRooms = new Set();
    if (this.username) {
      this.loadFromStorage();
    }
  }

  /**
   * Set the username and load visited rooms for that user from localStorage.
   */
  setUsername(username: string): void {
    this.username = username;
    this.visitedRooms.clear();
    this.loadFromStorage();
  }

  /**
   * Load visited rooms from localStorage for the current username.
   */
  private loadFromStorage(): void {
    if (!this.username) return;

    const storageKey = `${STORAGE_KEY_PREFIX}${this.username}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const roomIds = JSON.parse(stored) as string[];
        this.visitedRooms = new Set(roomIds);
      } else {
        this.visitedRooms.clear();
      }
    } catch (error) {
      console.warn(`Failed to load visited rooms from localStorage:`, error);
      this.visitedRooms.clear();
    }
  }

  /**
   * Save visited rooms to localStorage.
   */
  private saveToStorage(): void {
    if (!this.username) return;

    const storageKey = `${STORAGE_KEY_PREFIX}${this.username}`;
    try {
      const roomIds = Array.from(this.visitedRooms);
      localStorage.setItem(storageKey, JSON.stringify(roomIds));
    } catch (error) {
      console.warn(`Failed to save visited rooms to localStorage:`, error);
    }
  }

  /**
   * Mark a room as visited and persist to storage.
   */
  addVisitedRoom(roomId: string): void {
    if (!this.visitedRooms.has(roomId)) {
      this.visitedRooms.add(roomId);
      this.saveToStorage();
    }
  }

  /**
   * Check if a room has been visited.
   */
  isVisited(roomId: string): boolean {
    return this.visitedRooms.has(roomId);
  }

  /**
   * Get all visited room IDs.
   */
  getVisitedRooms(): string[] {
    return Array.from(this.visitedRooms);
  }

  /**
   * Get the count of visited rooms.
   */
  getVisitedCount(): number {
    return this.visitedRooms.size;
  }

  /**
   * Clear all visited rooms for the current username.
   */
  clearVisitedRooms(): void {
    this.visitedRooms.clear();
    this.saveToStorage();
  }

  /**
   * Get the current username.
   */
  getUsername(): string | null {
    return this.username;
  }
}

// Create a singleton instance
let instance: VisitedStampsSystem | null = null;

/**
 * Get or create the global VisitedStampsSystem instance.
 */
export function getVisitedStampsSystem(username?: string): VisitedStampsSystem {
  if (!instance) {
    instance = new VisitedStampsSystem(username);
  } else if (username && instance.getUsername() !== username) {
    instance.setUsername(username);
  }
  return instance;
}
