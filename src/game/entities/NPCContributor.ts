import Phaser from 'phaser';
import type { DungeonRoomNode } from '@/game/systems/dungeonTypes';
import {
  buildContributorNPCData,
  createDeterministicOffsets,
  type ContributorNPCData,
} from '@/game/entities/roomContent';
import { getBiomePresentation } from '@/game/config/biomePresentation';

export interface ContributorInteractionPayload {
  roomId: string;
  contributor: ContributorNPCData;
}

interface WanderState {
  targetX: number;
  targetY: number;
  idleMs: number;
}

export class NPCContributor extends Phaser.Physics.Arcade.Sprite {
  private readonly room: DungeonRoomNode;
  private readonly dataModel: ContributorNPCData;
  private readonly wanderRadius: number;
  private readonly movementSpeed: number;
  private readonly offsetCycle: Array<{ x: number; y: number }>;
  private cycleIndex = 0;
  private wanderState: WanderState;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    room: DungeonRoomNode,
    contributor: ContributorNPCData,
    biomeId: string,
    reducedMotion: boolean,
  ) {
    super(scene, x, y, 'npc-contributor');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.room = room;
    this.dataModel = contributor;
    this.wanderRadius = Math.max(20, Math.floor(Math.min(room.size.width, room.size.height) * 0.2));
    this.movementSpeed = reducedMotion ? 28 : 52;
    this.offsetCycle = createDeterministicOffsets(contributor.id, 6, this.wanderRadius);
    this.wanderState = {
      targetX: x,
      targetY: y,
      idleMs: reducedMotion ? 2200 : 1200,
    };

    const palette = getBiomePresentation(biomeId).palette;
    this.setDisplaySize(14, 14);
    this.setTint(palette.accent);
    this.setAlpha(0.9);
    this.pickNextTarget();
  }

  getInteractionPayload(): ContributorInteractionPayload {
    return {
      roomId: this.room.id,
      contributor: this.dataModel,
    };
  }

  canInteractFrom(playerX: number, playerY: number): boolean {
    return Phaser.Math.Distance.Between(playerX, playerY, this.x, this.y) <= 28;
  }

  updateBehavior(deltaMs: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.wanderState.idleMs > 0) {
      this.wanderState.idleMs -= deltaMs;
      body.setVelocity(0, 0);
      return;
    }

    const dx = this.wanderState.targetX - this.x;
    const dy = this.wanderState.targetY - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 4) {
      body.setVelocity(0, 0);
      this.pickNextTarget();
      return;
    }

    const vx = (dx / Math.max(distance, 1)) * this.movementSpeed;
    const vy = (dy / Math.max(distance, 1)) * this.movementSpeed;
    body.setVelocity(vx, vy);
  }

  private pickNextTarget(): void {
    const nextOffset = this.offsetCycle[this.cycleIndex % this.offsetCycle.length];
    this.cycleIndex += 1;
    this.wanderState = {
      targetX: this.room.position.x + nextOffset.x,
      targetY: this.room.position.y + nextOffset.y,
      idleMs: 900,
    };
  }

  static spawnForRoom(
    scene: Phaser.Scene,
    room: DungeonRoomNode,
    biomeId: string,
    reducedMotion: boolean,
  ): NPCContributor[] {
    const data = buildContributorNPCData(room);
    const offsets = createDeterministicOffsets(room.id, data.length, 18);

    return data.map((contributor, index) => {
      const offset = offsets[index] ?? { x: 0, y: 0 };
      return new NPCContributor(
        scene,
        room.position.x + offset.x,
        room.position.y + offset.y,
        room,
        contributor,
        biomeId,
        reducedMotion,
      );
    });
  }
}
