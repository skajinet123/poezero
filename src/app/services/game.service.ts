import { Injectable, signal, computed, effect } from '@angular/core';
import {
  Player,
  Enemy,
  EnemyConfig,
  EnemyType,
  Projectile,
  GameState,
  Position,
  Size,
  InputState
} from '../models/game.models';

/**
 * Основной игровой сервис
 * SRP: управляет всей игровой логикой
 * DIP: зависит от абстракций моделей
 */
@Injectable({
  providedIn: 'root'
})
export class GameService {
  // Конфигурация врагов
  private readonly ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
    [EnemyType.MELEE]: {
      type: EnemyType.MELEE,
      health: 100,
      damage: 15,
      speed: 80,
      aggroRange: 200,
      attackRange: 60,
      attackCooldown: 1000,
      color: '#d94a4a'
    },
    [EnemyType.RANGED]: {
      type: EnemyType.RANGED,
      health: 60,
      damage: 10,
      speed: 60,
      aggroRange: 300,
      attackRange: 250,
      attackCooldown: 1500,
      color: '#9d4ad9'
    },
    [EnemyType.TANK]: {
      type: EnemyType.TANK,
      health: 250,
      damage: 25,
      speed: 40,
      aggroRange: 150,
      attackRange: 80,
      attackCooldown: 2000,
      color: '#4a9d4a'
    }
  };

  // Размер карты
  private readonly MAP_SIZE: Size = { width: 2000, height: 2000 };
  private readonly VIEW_SIZE: Size = { width: 1200, height: 800 };

  // Состояние игры
  private readonly initialState: GameState = {
    player: {
      id: 'player',
      type: 'player',
      position: { x: 1000, y: 1000 },
      size: { width: 64, height: 64 },
      speed: 200,
      health: 100,
      maxHealth: 100,
      damage: 25,
      attackRange: 80,
      attackCooldown: 500,
      lastAttackTime: 0,
      mana: 100,
      maxMana: 100
    },
    enemies: [],
    projectiles: [],
    camera: { x: 0, y: 0 },
    mapSize: this.MAP_SIZE,
    viewSize: this.VIEW_SIZE
  };

  // Сигналы состояния
  private readonly gameState = signal<GameState>({ ...this.initialState });
  private readonly inputState = signal<InputState>({
    keys: { w: false, a: false, s: false, d: false }
  });

  // Публичные computed сигналы
  readonly player = computed(() => this.gameState().player);
  readonly enemies = computed(() => this.gameState().enemies);
  readonly projectiles = computed(() => this.gameState().projectiles);
  readonly camera = computed(() => this.gameState().camera);
  readonly input = this.inputState;

  // Таймер для игрового цикла
  private lastTime = 0;
  private animationFrameId: number | null = null;

  constructor() {
    this.generateEnemies(15);
    this.startGameLoop();
  }

  /**
   * Генерация врагов на карте
   */
  private generateEnemies(count: number): void {
    const enemies: Enemy[] = [];
    const types: EnemyType[] = [EnemyType.MELEE, EnemyType.RANGED, EnemyType.TANK];
    const typeWeights = [0.5, 0.35, 0.15]; // Распределение типов

    for (let i = 0; i < count; i++) {
      const typeIndex = this.getWeightedRandom(typeWeights);
      const type = types[typeIndex];
      const config = this.ENEMY_CONFIGS[type];

      // Случайная позиция (не слишком близко к игроку)
      let position: Position;
      do {
        position = {
          x: Math.random() * this.MAP_SIZE.width,
          y: Math.random() * this.MAP_SIZE.height
        };
      } while (this.getDistance(position, this.initialState.player.position) < 400);

      enemies.push({
        id: `enemy_${i}`,
        type,
        position,
        size: { width: 64, height: 64 },
        speed: config.speed,
        health: config.health,
        maxHealth: config.health,
        damage: config.damage,
        attackRange: config.attackRange,
        attackCooldown: config.attackCooldown,
        lastAttackTime: 0,
        aggroRange: config.aggroRange
      });
    }

    this.gameState.update(state => ({ ...state, enemies }));
  }

  /**
   * Выбор типа врага с весами
   */
  private getWeightedRandom(weights: number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * total;
    
    for (let i = 0; i < weights.length; i++) {
      random -= weights[i];
      if (random <= 0) return i;
    }
    return weights.length - 1;
  }

  /**
   * Расстояние между двумя точками
   */
  private getDistance(p1: Position, p2: Position): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Обработка ввода
   */
  setKey(key: 'w' | 'a' | 's' | 'd', pressed: boolean): void {
    this.inputState.update(state => ({
      ...state,
      keys: { ...state.keys, [key]: pressed }
    }));
  }

  /**
   * Игровой цикл
   */
  private startGameLoop(): void {
    const loop = (timestamp: number) => {
      if (this.lastTime === 0) {
        this.lastTime = timestamp;
      }

      const deltaTime = (timestamp - this.lastTime) / 1000;
      this.lastTime = timestamp;

      this.update(deltaTime);
      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * Обновление состояния игры
   */
  private update(deltaTime: number): void {
    this.updatePlayer(deltaTime);
    this.updateEnemies(deltaTime);
    this.updateProjectiles(deltaTime);
    this.updateCamera();
  }

  /**
   * Обновление игрока
   */
  private updatePlayer(deltaTime: number): void {
    const state = this.gameState();
    const input = this.inputState().keys;
    const player = { ...state.player };
    const speed = player.speed * deltaTime;

    let dx = 0;
    let dy = 0;

    if (input.w) dy -= speed;
    if (input.s) dy += speed;
    if (input.a) dx -= speed;
    if (input.d) dx += speed;

    // Отладка движения
    if (dx !== 0 || dy !== 0) {
      console.log('Moving:', { dx, dy, speed, deltaTime, input });
    }

    // Нормализация диагонального движения
    if (dx !== 0 && dy !== 0) {
      const factor = 1 / Math.sqrt(2);
      dx *= factor;
      dy *= factor;
    }

    // Обновление позиции с границами карты
    player.position.x = Math.max(32, Math.min(this.MAP_SIZE.width - 32, player.position.x + dx));
    player.position.y = Math.max(32, Math.min(this.MAP_SIZE.height - 32, player.position.y + dy));

    this.gameState.update(s => ({ ...s, player }));
  }

  /**
   * Обновление врагов
   */
  private updateEnemies(deltaTime: number): void {
    const state = this.gameState();
    const player = state.player;
    const now = Date.now();

    const updatedEnemies = state.enemies.map(enemy => {
      const enemyCopy = { ...enemy };
      const distance = this.getDistance(enemy.position, player.position);

      // Проверка аггро-диапазона
      if (distance <= enemy.aggroRange) {
        const moveSpeed = enemy.speed * deltaTime;
        const attackRange = enemy.attackRange;

        if (distance > attackRange) {
          // Движение к игроку
          const dx = (player.position.x - enemy.position.x) / distance;
          const dy = (player.position.y - enemy.position.y) / distance;
          enemyCopy.position.x += dx * moveSpeed;
          enemyCopy.position.y += dy * moveSpeed;
        } else if (now - enemyCopy.lastAttackTime > enemyCopy.attackCooldown) {
          // Атака игрока
          this.attackPlayer(player, enemy);
          enemyCopy.lastAttackTime = now;
        }
      }

      return enemyCopy;
    });

    this.gameState.update(s => ({ ...s, enemies: updatedEnemies }));
  }

  /**
   * Атака игрока врагом
   */
  private attackPlayer(player: Player, enemy: Enemy): void {
    const damage = enemy.damage;
    const newHealth = Math.max(0, player.health - damage);

    this.gameState.update(s => ({
      ...s,
      player: { ...s.player, health: newHealth }
    }));

    // Если игрок мертв - пересоздаем его
    if (newHealth <= 0) {
      setTimeout(() => {
        this.gameState.update(s => ({
          ...s,
          player: {
            ...s.player,
            position: { x: 1000, y: 1000 },
            health: s.player.maxHealth,
            mana: s.player.maxMana
          }
        }));
      }, 2000);
    }
  }

  /**
   * Обновление снарядов
   */
  private updateProjectiles(deltaTime: number): void {
    const state = this.gameState();
    const now = Date.now();

    const updatedProjectiles: Projectile[] = [];

    for (const enemy of state.enemies) {
      if (enemy.type === EnemyType.RANGED) {
        const distance = this.getDistance(enemy.position, state.player.position);
        
        if (distance <= enemy.aggroRange && distance > enemy.attackRange) {
          // Рандомная проверка для стрельбы
          if (Math.random() < 0.01 && now - enemy.lastAttackTime > enemy.attackCooldown) {
            const projectile: Projectile = {
              id: `proj_${enemy.id}_${now}`,
              position: { ...enemy.position },
              target: { ...state.player.position },
              speed: 300,
              damage: enemy.damage,
              ownerId: enemy.id
            };
            updatedProjectiles.push(projectile);
            enemy.lastAttackTime = now;
          }
        }
      }
    }

    // Движение снарядов
    const activeProjectiles: Projectile[] = [];
    for (const proj of state.projectiles) {
      const dx = proj.target.x - proj.position.x;
      const dy = proj.target.y - proj.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < proj.speed * deltaTime) {
        // Попадание
        this.gameState.update(s => ({
          ...s,
          player: { ...s.player, health: Math.max(0, s.player.health - proj.damage) }
        }));
      } else {
        // Продолжаем движение
        const moveDist = proj.speed * deltaTime;
        activeProjectiles.push({
          ...proj,
          position: {
            x: proj.position.x + (dx / distance) * moveDist,
            y: proj.position.y + (dy / distance) * moveDist
          }
        });
      }
    }

    this.gameState.update(s => ({
      ...s,
      projectiles: [...activeProjectiles, ...updatedProjectiles]
    }));
  }

  /**
   * Обновление камеры (следит за игроком)
   */
  private updateCamera(): void {
    const state = this.gameState();
    const player = state.player;
    const viewHalfW = state.viewSize.width / 2;
    const viewHalfH = state.viewSize.height / 2;

    const camera = {
      x: Math.max(0, Math.min(
        state.mapSize.width - state.viewSize.width,
        player.position.x - viewHalfW
      )),
      y: Math.max(0, Math.min(
        state.mapSize.height - state.viewSize.height,
        player.position.y - viewHalfH
      ))
    };

    this.gameState.update(s => ({ ...s, camera }));
  }

  /**
   * Получить состояние игры
   */
  getGameState(): GameState {
    return this.gameState();
  }

  /**
   * Очистка при уничтожении
   */
  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}
