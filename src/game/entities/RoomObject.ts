import Phaser from 'phaser';
import type { DungeonRoomNode } from '@/game/systems/dungeonTypes';
import { buildRoomObjectBlueprints, type RoomObjectBlueprint, type RoomObjectType } from '@/game/entities/roomContent';
import { getBiomePresentation } from '@/game/config/biomePresentation';

export interface RoomObjectInteractionPayload {
  roomId: string;
  roomName: string;
  objectType: RoomObjectType;
  title: string;
  description: string;
}

const ROOM_OBJECT_ICONS: Record<RoomObjectType, string> = {
  'readme-scroll': '📜',
  'file-tree-archive': '🗃',
  'contributors-gallery': '👥',
};

export class RoomObject extends Phaser.GameObjects.Container {
  private readonly interactionRadius: number;
  private readonly payload: RoomObjectInteractionPayload;

  constructor(
    scene: Phaser.Scene,
    blueprint: RoomObjectBlueprint,
    room: DungeonRoomNode,
    biomeId: string,
    reducedMotion: boolean,
  ) {
    super(scene, blueprint.x, blueprint.y);
    scene.add.existing(this);

    const presentation = getBiomePresentation(biomeId);
    const base = scene.add.rectangle(0, 0, 28, 20, presentation.palette.prop, 0.92);
    base.setStrokeStyle(2, presentation.palette.accent, 0.95);

    const icon = scene.add.text(0, -2, ROOM_OBJECT_ICONS[blueprint.objectType], {
      fontFamily: 'monospace',
      fontSize: '12px',
    });
    icon.setOrigin(0.5);

    this.add([base, icon]);
    this.interactionRadius = 28;
    this.payload = {
      roomId: room.id,
      roomName: room.name,
      objectType: blueprint.objectType,
      title: blueprint.label,
      description: blueprint.description,
    };

    if (!reducedMotion) {
      scene.tweens.add({
        targets: this,
        y: this.y - 4,
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  canInteractFrom(playerX: number, playerY: number): boolean {
    return Phaser.Math.Distance.Between(playerX, playerY, this.x, this.y) <= this.interactionRadius;
  }

  interact(): RoomObjectInteractionPayload {
    return this.payload;
  }

  static spawnForRoom(
    scene: Phaser.Scene,
    room: DungeonRoomNode,
    biomeId: string,
    reducedMotion: boolean,
  ): RoomObject[] {
    return buildRoomObjectBlueprints(room).map(
      (blueprint) => new RoomObject(scene, blueprint, room, biomeId, reducedMotion),
    );
  }
}
