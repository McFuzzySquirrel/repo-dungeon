import { useCallback, useEffect, useRef, useState } from 'react';
import { BadgeTracker, type BadgeId } from '@/game/systems/BadgeTracker';
import { ProgressionTracker } from '@/game/systems/ProgressionTracker';
import { usePlayerStore } from '@/store/playerStore';
import { useProgressionStore } from '@/store/progressionStore';
import { BadgeUnlockOverlay } from '@/ui/components/BadgeUnlockOverlay';
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
  const discoveryCount = useProgressionStore((state) => state.discoveryCount);
  const readmeCount = useProgressionStore((state) => state.readmeCount);
  const githubLinkClicks = useProgressionStore((state) => state.githubLinkClicks);
  const unlockedBadges = useProgressionStore((state) => state.unlockedBadges);
  const setSelectedClass = useProgressionStore((state) => state.setSelectedClass);
  const updateProgression = useProgressionStore((state) => state.updateProgression);
  const setBadges = useProgressionStore((state) => state.setBadges);
  const incrementDiscoveryCount = useProgressionStore((state) => state.incrementDiscoveryCount);
  const incrementReadmeCount = useProgressionStore((state) => state.incrementReadmeCount);
  const [recentBadgeId, setRecentBadgeId] = useState<BadgeId | null>(null);

  const trackerRef = useRef<ProgressionTracker | null>(null);
  const badgeTrackerRef = useRef<BadgeTracker | null>(null);
  const seenRoomIdsRef = useRef<Set<string>>(new Set());
  const seenObjectIdsRef = useRef<Set<string>>(new Set());
  const seenContributorIdsRef = useRef<Set<string>>(new Set());
  const previousGitHubClicksRef = useRef(githubLinkClicks);

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

    const badgeTracker = new BadgeTracker();
    const unlockedTimestamps = unlockedBadges.reduce<Record<BadgeId, number>>((accumulator, badgeId) => {
      accumulator[badgeId] = Date.now();
      return accumulator;
    }, {} as Record<BadgeId, number>);
    badgeTracker.restoreState({
      unlockedBadges,
      unlockedTimestamps,
      discoveryCount,
      readmeCount,
      githubLinkClicks,
      zonesClearedCount: 0,
    });
    badgeTracker.on('badgeUnlocked', (event: { badgeId: BadgeId }) => {
      setBadges(badgeTracker.getAllBadges());
      setRecentBadgeId(event.badgeId);
    });
    badgeTrackerRef.current = badgeTracker;
    previousGitHubClicksRef.current = githubLinkClicks;

    setSelectedClass(activeClass);
    updateProgression(tracker.getState());
  }, [discoveryCount, githubLinkClicks, level, readmeCount, selectedClass, setBadges, setSelectedClass, totalXp, unlockedBadges, updateProgression]);

  const syncBadges = useCallback(() => {
    const badgeTracker = badgeTrackerRef.current;
    if (!badgeTracker) {
      return;
    }

    setBadges(badgeTracker.getAllBadges());
  }, [setBadges]);

  const evaluateRoomBadges = useCallback((roomId?: string) => {
    const badgeTracker = badgeTrackerRef.current;
    if (!badgeTracker || !roomId) {
      return;
    }

    const roomData = getRoomDetails(roomId);
    if (!roomData) {
      return;
    }

    if (badgeTracker.getDiscoveryCount() === 1) {
      badgeTracker.unlockBadge('first-steps');
    }
    if (roomData.repo.stargazersCount >= 1000) {
      badgeTracker.unlockBadge('star-gazer');
    }
    if (roomData.contributors.length >= 10) {
      badgeTracker.unlockBadge('guild-finder');
    }
  }, [getRoomDetails]);

  const awardXp = useCallback((baseAmount: number, roomId?: string) => {
    const tracker = trackerRef.current;
    if (!tracker) {
      return;
    }

    const roomData = roomId ? getRoomDetails(roomId) : undefined;
    tracker.addXp(baseAmount, roomData);
    updateProgression(tracker.getState());
  }, [getRoomDetails, updateProgression]);

  useEffect(() => {
    const badgeTracker = badgeTrackerRef.current;
    if (!badgeTracker || githubLinkClicks <= previousGitHubClicksRef.current) {
      return;
    }

    const delta = githubLinkClicks - previousGitHubClicksRef.current;
    for (let index = 0; index < delta; index += 1) {
      badgeTracker.trackGitHubLinkClick();
    }
    previousGitHubClicksRef.current = githubLinkClicks;
    syncBadges();
  }, [githubLinkClicks, syncBadges]);

  useOnRoomEntered(
    useCallback((event) => {
      const badgeTracker = badgeTrackerRef.current;
      if (seenRoomIdsRef.current.has(event.roomId)) {
        return;
      }

      seenRoomIdsRef.current.add(event.roomId);
      incrementDiscoveryCount();
      badgeTracker?.trackDiscovery();
      evaluateRoomBadges(event.roomId);
      syncBadges();
      awardXp(ROOM_XP[event.roomType], event.roomId);
    }, [awardXp, evaluateRoomBadges, incrementDiscoveryCount, syncBadges]),
  );

  useEffect(() => {
    const badgeTracker = badgeTrackerRef.current;
    if (!currentRoom || seenRoomIdsRef.current.has(currentRoom.id)) {
      return;
    }

    seenRoomIdsRef.current.add(currentRoom.id);
    incrementDiscoveryCount();
    badgeTracker?.trackDiscovery();
    evaluateRoomBadges(currentRoom.id);
    syncBadges();
    awardXp(ROOM_XP[currentRoom.type], currentRoom.id);
  }, [awardXp, currentRoom, evaluateRoomBadges, incrementDiscoveryCount, syncBadges]);

  useOnRoomObjectInteracted(
    useCallback((event) => {
      const badgeTracker = badgeTrackerRef.current;
      const key = `${event.roomId}:${event.objectType}`;
      if (seenObjectIdsRef.current.has(key)) {
        return;
      }

      seenObjectIdsRef.current.add(key);
      if (event.objectType === 'readme-scroll') {
        incrementReadmeCount();
        badgeTracker?.trackReadmeRead();
      }
      syncBadges();
      awardXp(ROOM_OBJECT_XP[event.objectType], event.roomId);
    }, [awardXp, incrementReadmeCount, syncBadges]),
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

  return recentBadgeId ? <BadgeUnlockOverlay badgeId={recentBadgeId} onDismiss={() => setRecentBadgeId(null)} /> : null;
}