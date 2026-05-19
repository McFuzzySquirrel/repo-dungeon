import { useCallback, useEffect, useRef } from 'react';
import { ProgressionTracker } from '@/game/systems/ProgressionTracker';
import { usePlayerStore } from '@/store/playerStore';
import { useProgressionStore } from '@/store/progressionStore';
import {
  useGameScene,
  useOnContributorInteracted,
  useOnRoomEntered,
  useOnRoomObjectInteracted,
} from '@/ui/context/GameContext';

const ROOM_XP: Record<'profile' | 'repo' | 'gateway', number> = {
  profile: 18,
  repo: 26,
  gateway: 12,
};

const ROOM_OBJECT_XP: Record<'readme-scroll' | 'file-tree-archive' | 'contributors-gallery', number> = {
  'readme-scroll': 18,
  'file-tree-archive': 14,
  'contributors-gallery': 16,
};

const CONTRIBUTOR_XP = 10;

export function ProgressionController() {
  const { currentRoom, getRoomDetails } = useGameScene();
  const selectedClass = usePlayerStore((state) => state.selectedClass);
  const level = useProgressionStore((state) => state.level);
  const totalXp = useProgressionStore((state) => state.totalXp);
  const setSelectedClass = useProgressionStore((state) => state.setSelectedClass);
  const updateProgression = useProgressionStore((state) => state.updateProgression);
  const incrementDiscoveryCount = useProgressionStore((state) => state.incrementDiscoveryCount);
  const incrementReadmeCount = useProgressionStore((state) => state.incrementReadmeCount);

  const trackerRef = useRef<ProgressionTracker | null>(null);
  const seenRoomIdsRef = useRef<Set<string>>(new Set());
  const seenObjectIdsRef = useRef<Set<string>>(new Set());
  const seenContributorIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const activeClass = selectedClass ?? 'explorer';
    const tracker = new ProgressionTracker(activeClass);
    tracker.restoreState({
      selectedClass: activeClass,
      currentLevel: level,
      totalXp,
      xpTowardNextLevel: 0,
    });
    trackerRef.current = tracker;
    setSelectedClass(activeClass);
    updateProgression(tracker.getState());
  }, [level, selectedClass, setSelectedClass, totalXp, updateProgression]);

  const awardXp = useCallback((baseAmount: number, roomId?: string) => {
    const tracker = trackerRef.current;
    if (!tracker) {
      return;
    }

    const roomData = roomId ? getRoomDetails(roomId) : undefined;
    tracker.addXp(baseAmount, roomData);
    updateProgression(tracker.getState());
  }, [getRoomDetails, updateProgression]);

  useOnRoomEntered(
    useCallback((event) => {
      if (seenRoomIdsRef.current.has(event.roomId)) {
        return;
      }

      seenRoomIdsRef.current.add(event.roomId);
      incrementDiscoveryCount();
      awardXp(ROOM_XP[event.roomType], event.roomId);
    }, [awardXp, incrementDiscoveryCount]),
  );

  useEffect(() => {
    if (!currentRoom || seenRoomIdsRef.current.has(currentRoom.id)) {
      return;
    }

    seenRoomIdsRef.current.add(currentRoom.id);
    incrementDiscoveryCount();
    awardXp(ROOM_XP[currentRoom.type], currentRoom.id);
  }, [awardXp, currentRoom, incrementDiscoveryCount]);

  useOnRoomObjectInteracted(
    useCallback((event) => {
      const key = `${event.roomId}:${event.objectType}`;
      if (seenObjectIdsRef.current.has(key)) {
        return;
      }

      seenObjectIdsRef.current.add(key);
      if (event.objectType === 'readme-scroll') {
        incrementReadmeCount();
      }
      awardXp(ROOM_OBJECT_XP[event.objectType], event.roomId);
    }, [awardXp, incrementReadmeCount]),
  );

  useOnContributorInteracted(
    useCallback((event) => {
      if (seenContributorIdsRef.current.has(event.contributor.id)) {
        return;
      }

      seenContributorIdsRef.current.add(event.contributor.id);
      awardXp(CONTRIBUTOR_XP, event.roomId);
    }, [awardXp]),
  );

  return null;
}