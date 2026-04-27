import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  inject,
  ChangeDetectorRef,
  HostListener
} from '@angular/core';
import { GameService } from '../../services/game.service';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [],
  template: `
    <div class="game-container">
      <canvas
        #gameCanvas
        width="1200"
        height="800"
        class="game-canvas"
      ></canvas>
      
      <div class="ui-overlay">
        <div class="health-bar">
          <div class="health-fill" [style.width.%]="getHealthPercent()"></div>
          <span class="health-text">{{ player().health }}/{{ player().maxHealth }}</span>
        </div>
        
        <div class="mana-bar">
          <div class="mana-fill" [style.width.%]="getManaPercent()"></div>
          <span class="mana-text">{{ player().mana }}/{{ player().maxMana }}</span>
        </div>
        
        <div class="stats">
          <div class="stat">Врагов: {{ enemies().length }}</div>
          <div class="stat">Позиция: {{ Math.round(player().position.x) }}, {{ Math.round(player().position.y) }}</div>
        </div>
      </div>
      
      <div class="controls-hint">
        <p>WASD - Перемещение</p>
      </div>
    </div>
  `,
  styles: [`
    .game-container {
      position: relative;
      width: 100%;
      height: 100vh;
      overflow: hidden;
      background: #0a0a1a;
    }

    .game-canvas {
      display: block;
      image-rendering: pixelated;
    }

    .ui-overlay {
      position: absolute;
      top: 20px;
      left: 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    }

    .health-bar,
    .mana-bar {
      position: relative;
      width: 300px;
      height: 25px;
      background: #1a1a2e;
      border: 2px solid #333;
      border-radius: 12px;
      overflow: hidden;
    }

    .health-fill {
      height: 100%;
      background: linear-gradient(90deg, #ff4444, #ff6666);
      transition: width 0.2s ease;
    }

    .mana-fill {
      height: 100%;
      background: linear-gradient(90deg, #4488ff, #66aaff);
      transition: width 0.2s ease;
    }

    .health-text,
    .mana-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-weight: bold;
      font-size: 14px;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
    }

    .stats {
      background: rgba(26, 26, 46, 0.8);
      padding: 10px 15px;
      border-radius: 8px;
      color: #fff;
      font-size: 14px;
      line-height: 1.6;
      border: 1px solid #444;
    }

    .controls-hint {
      position: absolute;
      bottom: 20px;
      left: 20px;
      background: rgba(26, 26, 46, 0.8);
      padding: 15px;
      border-radius: 8px;
      color: #aaa;
      font-size: 13px;
      border: 1px solid #444;
    }

    .controls-hint p {
      margin: 0;
    }
  `]
})
export class GameComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('gameCanvas') canvas!: ElementRef<HTMLCanvasElement>;

  private readonly gameService = inject(GameService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly player = this.gameService.player;
  readonly enemies = this.gameService.enemies;
  readonly projectiles = this.gameService.projectiles;
  readonly Math = Math;

  private ctx!: CanvasRenderingContext2D;
  private playerImg!: HTMLImageElement;
  private enemyMeleeImg!: HTMLImageElement;
  private enemyRangedImg!: HTMLImageElement;
  private enemyTankImg!: HTMLImageElement;
  private imagesLoaded = false;
  private gameLoopId: number | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyupHandler: ((e: KeyboardEvent) => void) | null = null;

  ngOnInit(): void {
    console.log('GameComponent ngOnInit');
    this.loadImages();
    this.setupInputHandlers();
  }

  setupInputHandlers(): void {
    console.log('Setting up input handlers...');
    
    this.keydownHandler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      console.log('KeyDown event:', key);
      if (['w', 'a', 's', 'd'].includes(key)) {
        event.preventDefault();
        console.log(`Key down: ${key}`);
        this.gameService.setKey(key as 'w' | 'a' | 's' | 'd', true);
      }
    };

    this.keyupHandler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(key)) {
        event.preventDefault();
        console.log(`Key up: ${key}`);
        this.gameService.setKey(key as 'w' | 'a' | 's' | 'd', false);
      }
    };

    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.keyupHandler);
    console.log('Input handlers registered');
  }

  ngAfterViewInit(): void {
    this.ctx = this.canvas.nativeElement.getContext('2d')!;
    
    this.waitForImages().then(() => {
      this.imagesLoaded = true;
      console.log('Images loaded');
      this.startGameLoop();
    });
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    console.log('HostListener KeyDown:', event.key);
  }

  @HostListener('document:keyup', ['$event'])
  handleKeyUp(event: KeyboardEvent): void {
    console.log('HostListener KeyUp:', event.key);
  }

  private loadImages(): void {
    console.log('Loading images...');
    this.playerImg = this.createSVGImage('player.svg');
    this.enemyMeleeImg = this.createSVGImage('enemy_melee.svg');
    this.enemyRangedImg = this.createSVGImage('enemy_ranged.svg');
    this.enemyTankImg = this.createSVGImage('enemy_tank.svg');
  }

  private createSVGImage(filename: string): HTMLImageElement {
    const img = new Image();
    img.src = `/images/${filename}`;
    return img;
  }

  private waitForImages(): Promise<void> {
    const images = [
      { img: this.playerImg, name: 'player' },
      { img: this.enemyMeleeImg, name: 'enemy_melee' },
      { img: this.enemyRangedImg, name: 'enemy_ranged' },
      { img: this.enemyTankImg, name: 'enemy_tank' }
    ];
    
    const promises = images.map(({ img, name }) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>(resolve => {
        img.onload = () => { console.log(`${name} loaded`); resolve(); };
        img.onerror = () => { console.error(`${name} failed`); resolve(); };
      });
    });
    return Promise.all(promises).then(() => {});
  }

  private startGameLoop(): void {
    const loop = () => {
      this.render();
      this.cdr.markForCheck();
      this.gameLoopId = requestAnimationFrame(loop);
    };
    this.gameLoopId = requestAnimationFrame(loop);
  }

  private render(): void {
    const state = this.gameService.getGameState();
    const { camera, viewSize } = state;

    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, viewSize.width, viewSize.height);

    this.drawGrid(state);
    this.drawProjectiles(state);

    for (const enemy of state.enemies) {
      this.drawEnemy(enemy);
    }

    this.drawPlayer(state.player);
    this.drawMapBorders(state);
  }

  private drawGrid(state: any): void {
    const { camera, mapSize, viewSize } = state;
    const gridSize = 100;

    this.ctx.strokeStyle = '#2a2a4e';
    this.ctx.lineWidth = 1;

    const startX = Math.floor(camera.x / gridSize) * gridSize;
    const startY = Math.floor(camera.y / gridSize) * gridSize;

    for (let x = startX; x < camera.x + viewSize.width; x += gridSize) {
      if (x >= 0 && x <= mapSize.width) {
        this.ctx.beginPath();
        this.ctx.moveTo(x - camera.x, 0);
        this.ctx.lineTo(x - camera.x, viewSize.height);
        this.ctx.stroke();
      }
    }

    for (let y = startY; y < camera.y + viewSize.height; y += gridSize) {
      if (y >= 0 && y <= mapSize.height) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, y - camera.y);
        this.ctx.lineTo(viewSize.width, y - camera.y);
        this.ctx.stroke();
      }
    }
  }

  private drawPlayer(player: any): void {
    const { position, size } = player;
    const x = position.x - this.gameService.getGameState().camera.x;
    const y = position.y - this.gameService.getGameState().camera.y;

    this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
    this.ctx.beginPath();
    this.ctx.ellipse(x + size.width/2, y + size.height - 5, size.width/2, 10, 0, 0, Math.PI * 2);
    this.ctx.fill();

    if (this.imagesLoaded && this.playerImg.complete) {
      this.ctx.drawImage(this.playerImg, x, y, size.width, size.height);
    } else {
      this.ctx.fillStyle = '#4a90d9';
      this.ctx.beginPath();
      this.ctx.ellipse(x + size.width/2, y + size.height/2, size.width/2, size.height/2, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = '#00ff88';
      this.ctx.beginPath();
      this.ctx.arc(x + 22, y + 25, 5, 0, Math.PI * 2);
      this.ctx.arc(x + 42, y + 25, 5, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawEnemy(enemy: any): void {
    const { position, size, type } = enemy;
    const state = this.gameService.getGameState();
    const x = position.x - state.camera.x;
    const y = position.y - state.camera.y;

    if (x < -size.width || x > state.viewSize.width || 
        y < -size.height || y > state.viewSize.height) {
      return;
    }

    this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
    this.ctx.beginPath();
    this.ctx.ellipse(x + size.width/2, y + size.height - 5, size.width/2, 10, 0, 0, Math.PI * 2);
    this.ctx.fill();

    let img: HTMLImageElement;
    let fallbackColor: string;
    switch (type) {
      case 'enemy_melee': 
        img = this.enemyMeleeImg; 
        fallbackColor = '#d94a4a';
        break;
      case 'enemy_ranged': 
        img = this.enemyRangedImg; 
        fallbackColor = '#9d4ad9';
        break;
      case 'enemy_tank': 
        img = this.enemyTankImg; 
        fallbackColor = '#4a9d4a';
        break;
      default: 
        img = this.enemyMeleeImg;
        fallbackColor = '#d94a4a';
    }

    if (this.imagesLoaded && img.complete) {
      this.ctx.drawImage(img, x, y, size.width, size.height);
    } else {
      this.ctx.fillStyle = fallbackColor;
      this.ctx.beginPath();
      this.ctx.ellipse(x + size.width/2, y + size.height/2, size.width/2, size.height/2, 0, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.drawEnemyHealthBar(x, y, enemy);
  }

  private drawEnemyHealthBar(x: number, y: number, enemy: any): void {
    const barWidth = 50;
    const barHeight = 6;
    const healthPercent = enemy.health / enemy.maxHealth;

    this.ctx.fillStyle = '#333';
    this.ctx.fillRect(x + (64 - barWidth)/2, y - 15, barWidth, barHeight);

    this.ctx.fillStyle = healthPercent > 0.5 ? '#4caf50' : healthPercent > 0.25 ? '#ff9800' : '#f44336';
    this.ctx.fillRect(x + (64 - barWidth)/2, y - 15, barWidth * healthPercent, barHeight);
  }

  private drawProjectiles(state: any): void {
    for (const proj of state.projectiles) {
      const x = proj.position.x - state.camera.x;
      const y = proj.position.y - state.camera.y;

      const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, 8);
      gradient.addColorStop(0, '#00ffff');
      gradient.addColorStop(0.5, '#ff00ff');
      gradient.addColorStop(1, 'transparent');

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 8, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(x, y, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawMapBorders(state: any): void {
    const { mapSize, camera, viewSize } = state;

    this.ctx.strokeStyle = '#ff0000';
    this.ctx.lineWidth = 3;

    const x = 0 - camera.x;
    const y = 0 - camera.y;

    this.ctx.strokeRect(x, y, Math.min(mapSize.width, viewSize.x + camera.x), Math.min(mapSize.height, viewSize.y + camera.y));
  }

  getHealthPercent(): number {
    return (this.player().health / this.player().maxHealth) * 100;
  }

  getManaPercent(): number {
    return (this.player().mana / this.player().maxMana) * 100;
  }

  ngOnDestroy(): void {
    this.gameService.ngOnDestroy();
    if (this.gameLoopId) {
      cancelAnimationFrame(this.gameLoopId);
    }
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
    }
    if (this.keyupHandler) {
      window.removeEventListener('keyup', this.keyupHandler);
    }
    console.log('GameComponent destroyed');
  }
}