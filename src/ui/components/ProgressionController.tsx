import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BadgeTracker, type BadgeId } from '@/game/systems/BadgeTracker';
import { ProgressionTracker } from '@/game/systems/ProgressionTracker';
import {
  REVIEW_PASS_ROOM_TARGET_MAX,
  REVIEW_PASS_ROOM_TARGET_MIN,
} from '@/game/systems/progressionEngine';
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
const REVIEW_CHECKPOINT_XP = 8;
const REVIEW_PASS_COMPLETION_XP = 28;

function resolveReviewPassTarget(totalRepoRooms: number): number {
  if (totalRepoRooms <= 0) {
    return REVIEW_PASS_ROOM_TARGET_MIN;
  }
  const dynamicTarget = Math.ceil(totalRepoRooms * 0.4);
  return Math.max(REVIEW_PASS_ROOM_TARGET_MIN, Math.min(REVIEW_PASS_ROOM_TARGET_MAX, dynamicTarget));
}

export function ProgressionController() {
  const { currentRoom, dungeon, getRoomDetails } = useGameScene();
  const selectedClass = usePlayerStore((state) => state.selectedClass);
  const level = useProgressionStore((state) => state.level);
  const totalXp = useProgressionStore((state) => state.totalXp);
  const discoveryCount = useProgressionStore((state) => state.discoveryCount);
  const readmeCount = useProgressionStore((state) => state.readmeCount);
  const githubLinkClicks = useProgressionStore((state) => state.githubLinkClicks);
  const reviewPassCount = useProgressionStore((state) => state.reviewPassCount);
  const roomsTowardNextPass = useProgressionStore((state) => state.roomsTowardNextPass);
  const unlockedBadges = useProgressionStore((state) => state.unlockedBadges);
  const setSelectedClass = useProgressionStore((state) => state.setSelectedClass);
  const updateProgression = useProgressionStore((state) => state.updateProgression);
  const setBadges = useProgressionStore((state) => state.setBadges);
  const incrementDiscoveryCount = useProgressionStore((state) => state.incrementDiscoveryCount);
  const incrementReadmeCount = useProgressionStore((state) => state.incrementReadmeCount);
  const incrementArchaeologyReviewCount = useProgressionStore((state) => state.incrementArchaeologyReviewCount);
  const incrementReviewPassCount = useProgressionStore((state) => state.incrementReviewPassCount);
  const setRoomsTowardNextPass = useProgressionStore((state) => state.setRoomsTowardNextPass);
  const addArchaeologyLogEntry = useProgressionStore((state) => state.addArchaeologyLogEntry);
  const [recentBadgeId, setRecentBadgeId] = useState<BadgeId | null>(null);

  const trackerRef = useRef<ProgressionTracker | null>(null);
  const badgeTrackerRef = useRef<BadgeTracker | null>(null);
  const seenRoomIdsRef = useRef<Set<string>>(new Set());
  const seenObjectIdsRef = useRef<Set<string>>(new Set());
  const seenContributorIdsRef = useRef<Set<string>>(new Set());
  const reviewPassRoomIdsRef = useRef<Set<string>>(new Set());
  const reviewPassRoomsCountRef = useRef<number>(roomsTowardNextPass);
  const previousGitHubClicksRef = useRef(githubLinkClicks);
  const totalRepoRooms = useMemo(
    () => dungeon?.rooms.filter((room) => room.type === 'repo').length ?? 0,
    [dungeon],
  );
  const reviewPassTarget = useMemo(() => resolveReviewPassTarget(totalRepoRooms), [totalRepoRooms]);

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
      reviewPassCount,
      zonesClearedCount: 0,
    });
    badgeTracker.on('badgeUnlocked', (event: { badgeId: BadgeId }) => {
      setBadges(badgeTracker.getAllBadges());
      setRecentBadgeId(event.badgeId);
    });
    badgeTrackerRef.current = badgeTracker;
    previousGitHubClicksRef.current = githubLinkClicks;
    reviewPassRoomsCountRef.current = Math.max(0, Math.min(roomsTowardNextPass, reviewPassTarget - 1));

    setSelectedClass(activeClass);
    updateProgression(tracker.getState());
  }, [
    discoveryCount,
    githubLinkClicks,
    level,
    readmeCount,
    reviewPassCount,
    reviewPassTarget,
    roomsTowardNextPass,
    selectedClass,
    setBadges,
    setSelectedClass,
    totalXp,
    unlockedBadges,
    updateProgression,
  ]);

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

  const awardReviewCheckpoint = useCallback(
    (roomId: string, roomName: string) => {
      const badgeTracker = badgeTrackerRef.current;
      if (!badgeTracker || reviewPassRoomIdsRef.current.has(roomId)) {
        return;
      }

      reviewPassRoomIdsRef.current.add(roomId);
      reviewPassRoomsCountRef.current += 1;
      incrementArchaeologyReviewCount();
      addArchaeologyLogEntry({
        roomId,
        roomName,
        action: 'review-checkpoint',
      });
      setRoomsTowardNextPass(reviewPassRoomsCountRef.current);
      awardXp(REVIEW_CHECKPOINT_XP, roomId);

      if (reviewPassRoomsCountRef.current < reviewPassTarget) {
        return;
      }

      reviewPassRoomsCountRef.current = 0;
      reviewPassRoomIdsRef.current.clear();
      incrementReviewPassCount();
      setRoomsTowardNextPass(0);
      addArchaeologyLogEntry({
        roomId,
        roomName,
        action: 'review-pass',
      });
      badgeTracker.trackReviewPass();
      syncBadges();
      awardXp(REVIEW_PASS_COMPLETION_XP, roomId);
    },
    [
      addArchaeologyLogEntry,
      awardXp,
      incrementArchaeologyReviewCount,
      incrementReviewPassCount,
      reviewPassTarget,
      setRoomsTowardNextPass,
      syncBadges,
    ],
  );

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
      if (!seenRoomIdsRef.current.has(event.roomId)) {
        seenRoomIdsRef.current.add(event.roomId);
        incrementDiscoveryCount();
        badgeTracker?.trackDiscovery();
        evaluateRoomBadges(event.roomId);
        syncBadges();
        awardXp(ROOM_XP[event.roomType], event.roomId);
        return;
      }

      if (event.roomType === 'repo') {
        awardReviewCheckpoint(event.roomId, event.roomName);
      }
    }, [awardReviewCheckpoint, awardXp, evaluateRoomBadges, incrementDiscoveryCount, syncBadges]),
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
