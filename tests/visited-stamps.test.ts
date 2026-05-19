import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VisitedStampsSystem, getVisitedStampsSystem } from '@/ui/systems/VisitedStamps';

describe('VisitedStampsSystem', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create an instance with no username', () => {
    const system = new VisitedStampsSystem();
    expect(system.getUsername()).toBeNull();
    expect(system.getVisitedCount()).toBe(0);
  });

  it('should create an instance with a username', () => {
    const system = new VisitedStampsSystem('testuser');
    expect(system.getUsername()).toBe('testuser');
  });

  it('should add and track visited rooms', () => {
    const system = new VisitedStampsSystem('testuser');
    system.addVisitedRoom('room-1');
    system.addVisitedRoom('room-2');

    expect(system.isVisited('room-1')).toBe(true);
    expect(system.isVisited('room-2')).toBe(true);
    expect(system.isVisited('room-3')).toBe(false);
    expect(system.getVisitedCount()).toBe(2);
  });

  it('should persist visited rooms to localStorage', () => {
    const system1 = new VisitedStampsSystem('testuser');
    system1.addVisitedRoom('room-1');
    system1.addVisitedRoom('room-2');

    // Create a new instance to verify persistence
    const system2 = new VisitedStampsSystem('testuser');
    expect(system2.isVisited('room-1')).toBe(true);
    expect(system2.isVisited('room-2')).toBe(true);
    expect(system2.getVisitedCount()).toBe(2);
  });

  it('should load visited rooms from storage', () => {
    const storageKey = 'repo-dungeon:visited-rooms:testuser';
    const roomIds = ['room-1', 'room-2', 'room-3'];
    localStorage.setItem(storageKey, JSON.stringify(roomIds));

    const system = new VisitedStampsSystem('testuser');
    expect(system.getVisitedCount()).toBe(3);
    expect(system.isVisited('room-1')).toBe(true);
  });

  it('should switch users and load their visited rooms', () => {
    // Setup user1 data
    const user1Key = 'repo-dungeon:visited-rooms:user1';
    localStorage.setItem(user1Key, JSON.stringify(['user1-room-1']));

    // Setup user2 data
    const user2Key = 'repo-dungeon:visited-rooms:user2';
    localStorage.setItem(user2Key, JSON.stringify(['user2-room-1', 'user2-room-2']));

    const system = new VisitedStampsSystem('user1');
    expect(system.getVisitedCount()).toBe(1);
    expect(system.isVisited('user1-room-1')).toBe(true);

    system.setUsername('user2');
    expect(system.getVisitedCount()).toBe(2);
    expect(system.isVisited('user2-room-1')).toBe(true);
    expect(system.isVisited('user2-room-2')).toBe(true);
    expect(system.isVisited('user1-room-1')).toBe(false);
  });

  it('should clear all visited rooms', () => {
    const system = new VisitedStampsSystem('testuser');
    system.addVisitedRoom('room-1');
    system.addVisitedRoom('room-2');
    expect(system.getVisitedCount()).toBe(2);

    system.clearVisitedRooms();
    expect(system.getVisitedCount()).toBe(0);
    expect(system.isVisited('room-1')).toBe(false);
  });

  it('should return all visited room IDs', () => {
    const system = new VisitedStampsSystem('testuser');
    system.addVisitedRoom('room-1');
    system.addVisitedRoom('room-2');
    system.addVisitedRoom('room-3');

    const visited = system.getVisitedRooms();
    expect(visited).toHaveLength(3);
    expect(visited).toContain('room-1');
    expect(visited).toContain('room-2');
    expect(visited).toContain('room-3');
  });

  it('should not add duplicate visited rooms', () => {
    const system = new VisitedStampsSystem('testuser');
    system.addVisitedRoom('room-1');
    system.addVisitedRoom('room-1');
    system.addVisitedRoom('room-1');

    expect(system.getVisitedCount()).toBe(1);
  });

  it('should handle localStorage errors gracefully', () => {
    const system = new VisitedStampsSystem('testuser');

    // Mock localStorage to throw error
    const mockGetItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage error');
    });

    system.setUsername('testuser');
    expect(system.getVisitedCount()).toBe(0);

    // Restore original
    mockGetItem.mockRestore();
  });

  it('should work with singleton pattern', () => {
    const instance1 = getVisitedStampsSystem('testuser');
    const instance2 = getVisitedStampsSystem('testuser');

    expect(instance1).toBe(instance2);

    instance1.addVisitedRoom('room-1');
    expect(instance2.isVisited('room-1')).toBe(true);
  });

  it('should switch singleton user when requested', () => {
    const storage1 = 'repo-dungeon:visited-rooms:user1';
    localStorage.setItem(storage1, JSON.stringify(['room-1']));

    const instance = getVisitedStampsSystem('user1');
    expect(instance.getVisitedCount()).toBe(1);

    getVisitedStampsSystem('user2');
    expect(instance.getVisitedCount()).toBe(0);
  });
});
