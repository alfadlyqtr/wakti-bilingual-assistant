import * as PIXI from 'pixi.js';
import { Ball, ShotBall, Point, GameCallbacks, GameConfig } from './ZumaTypes';

export class ZumaGameEngine {
  private app: PIXI.Application;
  private canvas: HTMLCanvasElement;
  private callbacks: GameCallbacks;
  private config: GameConfig;
  
  private balls: Ball[] = [];
  private shotBall: ShotBall | null = null;
  private shooter: PIXI.Graphics;
  private path: Point[] = [];
  private isRunning = false;
  private isPaused = false;
  
  private score = 0;
  private level = 1;
  private ballColors: string[] = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57'];
  private pathProgress = 0;
  private ballSpacing = 30;
  private gameSpeed = 1;

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    
    this.config = {
      ballRadius: 15,
      ballSpeed: 30,
      shotSpeed: 400,
      colors: this.ballColors,
      pathLength: 1000,
      matchCount: 3
    };

    this.initialize();
  }

  private async initialize() {
    await this.initPixi();
    this.createPath();
    this.createShooter();
    this.setupEventListeners();
  }

  private async initPixi() {
    this.app = new PIXI.Application();
    await this.app.init({
      canvas: this.canvas,
      width: this.canvas.offsetWidth,
      height: this.canvas.offsetHeight,
      backgroundColor: 0x1a1a2e,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    // Handle resize
    window.addEventListener('resize', this.handleResize.bind(this));
    this.handleResize();
  }

  private handleResize() {
    const parent = this.canvas.parentElement;
    if (parent) {
      const width = parent.offsetWidth;
      const height = parent.offsetHeight;
      
      this.app.renderer.resize(width, height);
      this.createPath(); // Recreate path for new dimensions
    }
  }

  private createPath() {
    this.path = [];
    const width = this.app.screen.width;
    const height = this.app.screen.height;
    
    // Create a spiral path from edge to center
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) * 0.4;
    
    const totalPoints = 200;
    for (let i = 0; i < totalPoints; i++) {
      const progress = i / totalPoints;
      const angle = progress * Math.PI * 6; // 3 full spirals
      const radius = maxRadius * (1 - progress * 0.8);
      
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      this.path.push({ x, y });
    }
  }

  private createShooter() {
    this.shooter = new PIXI.Graphics();
    this.shooter.circle(0, 0, 20);
    this.shooter.fill(0x888888);
    this.shooter.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
    this.app.stage.addChild(this.shooter);
  }

  private setupEventListeners() {
    this.canvas.addEventListener('click', this.handleClick.bind(this));
    this.canvas.addEventListener('touchstart', this.handleTouch.bind(this));
  }

  private handleClick(event: MouseEvent) {
    if (!this.isRunning || this.isPaused || this.shotBall) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    this.shoot(x, y);
  }

  private handleTouch(event: TouchEvent) {
    event.preventDefault();
    if (!this.isRunning || this.isPaused || this.shotBall) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const touch = event.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    this.shoot(x, y);
  }

  private shoot(targetX: number, targetY: number) {
    const shooterX = this.app.screen.width / 2;
    const shooterY = this.app.screen.height / 2;
    
    const dx = targetX - shooterX;
    const dy = targetY - shooterY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) return;
    
    const vx = (dx / distance) * this.config.shotSpeed;
    const vy = (dy / distance) * this.config.shotSpeed;
    
    this.shotBall = {
      x: shooterX,
      y: shooterY,
      vx,
      vy,
      color: this.getRandomColor(),
      radius: this.config.ballRadius
    };
  }

  private getRandomColor(): string {
    const availableColors = this.ballColors.slice(0, Math.min(3 + this.level, this.ballColors.length));
    return availableColors[Math.floor(Math.random() * availableColors.length)];
  }

  private initializeBalls() {
    this.balls = [];
    const startingBalls = Math.min(10 + this.level * 2, 30);
    
    for (let i = 0; i < startingBalls; i++) {
      this.balls.push({
        id: `ball_${i}`,
        x: 0,
        y: 0,
        color: this.getRandomColor(),
        radius: this.config.ballRadius,
        distance: i * this.ballSpacing
      });
    }
    
    this.updateBallPositions();
  }

  private updateBallPositions() {
    this.balls.forEach(ball => {
      const pathIndex = Math.min(Math.floor((ball.distance + this.pathProgress) / 5), this.path.length - 1);
      if (pathIndex >= 0 && pathIndex < this.path.length) {
        ball.x = this.path[pathIndex].x;
        ball.y = this.path[pathIndex].y;
      }
    });
  }

  private checkCollisions() {
    if (!this.shotBall) return;
    
    for (let i = 0; i < this.balls.length; i++) {
      const ball = this.balls[i];
      const dx = this.shotBall.x - ball.x;
      const dy = this.shotBall.y - ball.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < this.config.ballRadius * 2) {
        this.insertBall(i, this.shotBall);
        this.shotBall = null;
        break;
      }
    }
  }

  private insertBall(insertIndex: number, shotBall: ShotBall) {
    const newBall: Ball = {
      id: `ball_${Date.now()}`,
      x: shotBall.x,
      y: shotBall.y,
      color: shotBall.color,
      radius: this.config.ballRadius,
      distance: insertIndex > 0 ? this.balls[insertIndex - 1].distance + this.ballSpacing : 0
    };
    
    this.balls.splice(insertIndex, 0, newBall);
    
    // Adjust distances of following balls
    for (let i = insertIndex + 1; i < this.balls.length; i++) {
      this.balls[i].distance += this.ballSpacing;
    }
    
    this.checkMatches(insertIndex);
  }

  private checkMatches(startIndex: number) {
    const color = this.balls[startIndex].color;
    let matchStart = startIndex;
    let matchEnd = startIndex;
    
    // Find start of match
    while (matchStart > 0 && this.balls[matchStart - 1].color === color) {
      matchStart--;
    }
    
    // Find end of match
    while (matchEnd < this.balls.length - 1 && this.balls[matchEnd + 1].color === color) {
      matchEnd++;
    }
    
    const matchLength = matchEnd - matchStart + 1;
    
    if (matchLength >= this.config.matchCount) {
      // Remove matched balls
      const removedBalls = this.balls.splice(matchStart, matchLength);
      this.score += removedBalls.length * 10 * this.level;
      this.callbacks.onScoreUpdate(this.score);
      
      // Adjust distances of remaining balls
      for (let i = matchStart; i < this.balls.length; i++) {
        this.balls[i].distance -= matchLength * this.ballSpacing;
      }
      
      // Check for chain reactions
      if (matchStart < this.balls.length && matchStart > 0) {
        if (this.balls[matchStart - 1].color === this.balls[matchStart].color) {
          this.checkMatches(matchStart);
        }
      }
      
      // Check for level completion
      if (this.balls.length === 0) {
        this.levelComplete();
      }
    }
  }

  private levelComplete() {
    this.level++;
    this.gameSpeed += 0.2;
    this.callbacks.onLevelUpdate(this.level);
    
    // Add bonus score
    this.score += 100 * this.level;
    this.callbacks.onScoreUpdate(this.score);
    
    if (this.level > 10) {
      this.callbacks.onGameComplete(this.score);
      return;
    }
    
    // Start next level
    setTimeout(() => {
      this.pathProgress = 0;
      this.initializeBalls();
    }, 1000);
  }

  private update(deltaTime: number) {
    if (!this.isRunning || this.isPaused) return;
    
    // Move ball chain forward
    this.pathProgress += this.config.ballSpeed * this.gameSpeed * deltaTime / 1000;
    this.updateBallPositions();
    
    // Check if chain reached the end
    if (this.balls.length > 0) {
      const lastBall = this.balls[this.balls.length - 1];
      const pathIndex = Math.floor((lastBall.distance + this.pathProgress) / 5);
      if (pathIndex >= this.path.length - 1) {
        this.callbacks.onGameOver(this.score);
        return;
      }
    }
    
    // Update shot ball
    if (this.shotBall) {
      this.shotBall.x += this.shotBall.vx * deltaTime / 1000;
      this.shotBall.y += this.shotBall.vy * deltaTime / 1000;
      
      // Check bounds
      if (this.shotBall.x < 0 || this.shotBall.x > this.app.screen.width ||
          this.shotBall.y < 0 || this.shotBall.y > this.app.screen.height) {
        this.shotBall = null;
      } else {
        this.checkCollisions();
      }
    }
    
    this.render();
  }

  private render() {
    this.app.stage.removeChildren();
    
    // Re-add shooter
    this.app.stage.addChild(this.shooter);
    
    // Draw path (optional visual guide)
    const pathGraphics = new PIXI.Graphics();
    pathGraphics.moveTo(this.path[0].x, this.path[0].y);
    for (let i = 1; i < this.path.length; i++) {
      pathGraphics.lineTo(this.path[i].x, this.path[i].y);
    }
    pathGraphics.stroke({ width: 2, color: 0x333333 });
    this.app.stage.addChild(pathGraphics);
    
    // Draw balls
    this.balls.forEach(ball => {
      const ballGraphics = new PIXI.Graphics();
      ballGraphics.circle(ball.x, ball.y, ball.radius);
      ballGraphics.fill(ball.color);
      ballGraphics.stroke({ width: 2, color: 0xffffff });
      this.app.stage.addChild(ballGraphics);
    });
    
    // Draw shot ball
    if (this.shotBall) {
      const shotGraphics = new PIXI.Graphics();
      shotGraphics.circle(this.shotBall.x, this.shotBall.y, this.shotBall.radius);
      shotGraphics.fill(this.shotBall.color);
      shotGraphics.stroke({ width: 2, color: 0xffffff });
      this.app.stage.addChild(shotGraphics);
    }
  }

  public start() {
    this.isRunning = true;
    this.score = 0;
    this.level = 1;
    this.gameSpeed = 1;
    this.pathProgress = 0;
    this.initializeBalls();
    
    this.app.ticker.add(this.update.bind(this));
  }

  public pause() {
    this.isPaused = true;
  }

  public resume() {
    this.isPaused = false;
  }

  public restart() {
    this.pathProgress = 0;
    this.shotBall = null;
    this.initializeBalls();
  }

  public destroy() {
    this.isRunning = false;
    this.app.ticker.stop();
    this.app.destroy(true);
    window.removeEventListener('resize', this.handleResize.bind(this));
  }
}