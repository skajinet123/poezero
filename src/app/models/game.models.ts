/**
 * Модели для ARPG-игры
 */

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export type EntityType = 'player' | 'enemy_melee' | 'enemy_ranged' | 'enemy_tank';

export interface Entity {
  id: string;
  type: EntityType;
  position: Position;
  size: Size;
  speed: number;
  health: number;
  maxHealth: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  lastAttackTime: number;
}

export interface Player extends Entity {
  type: 'player';
  mana: number;
  maxMana: number;
}

export interface Enemy extends Entity {
  type: 'enemy_melee' | 'enemy_ranged' | 'enemy_tank';
  aggroRange: number;
  attackRange: number;
}

export interface Projectile {
  id: string;
  position: Position;
  target: Position;
  speed: number;
  damage: number;
  ownerId: string;
}

export interface GameState {
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  camera: Position;
  mapSize: Size;
  viewSize: Size;
}

export interface InputState {
  keys: {
    w: boolean;
    a: boolean;
    s: boolean;
    d: boolean;
  };
}

export enum EnemyType {
  MELEE = 'enemy_melee',
  RANGED = 'enemy_ranged',
  TANK = 'enemy_tank'
}

export interface EnemyConfig {
  type: EnemyType;
  health: number;
  damage: number;
  speed: number;
  aggroRange: number;
  attackRange: number;
  attackCooldown: number;
  color: string;
}
