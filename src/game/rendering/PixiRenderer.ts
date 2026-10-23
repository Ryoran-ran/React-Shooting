import { Application, Container, Graphics } from 'pixi.js';
import { GAME_CONFIG } from '../config';
import type { GameState } from '../core/GameState';
import { interpolate } from '../core/coordinates';
import type { ShotMode } from '../entities/Bullet';
import { CombatRenderer } from './CombatRenderer';
import { getPlayerPose } from './playerPose';

interface TargetVisual { root: Container; tentacles: Graphics }

/** Only this layer knows PixiJS. All positions it reads are world positions. */
export class PixiRenderer {
  private app = new Application();
  private world = new Container();
  private dolphin = new Container();
  private dolphinBody = new Container();
  private tail = new Graphics();
  private leftFin = new Graphics();
  private rightFin = new Graphics();
  private hitPoint = new Graphics();
  private muzzle = new Graphics();
  private ripples = new Graphics();
  private shield = new Graphics();
  private combat!: CombatRenderer;
  private bubbles: { graphic: Graphics; x: number; y: number; speed: number; phase: number }[] = [];
  private bullets = new Map<string, Container>();
  private targets = new Map<string, TargetVisual>();
  private initialized = false;
  private disposed = false;

  async init(host: HTMLElement): Promise<boolean> {
    try {
      await this.app.init({
        width: GAME_CONFIG.layout.fieldWidth, height: GAME_CONFIG.layout.fieldHeight,
        backgroundAlpha: 0, antialias: true, autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        preference: 'webgl', autoStart: false, sharedTicker: false,
      });
    } catch (error) {
      // Initialization failures can leave a partially allocated GPU context.
      if (this.app.renderer) this.app.destroy(true, { children: true });
      throw error;
    }
    this.initialized = true;
    if (this.disposed) { this.destroyApplication(); return false; }
    host.appendChild(this.app.canvas);
    this.app.canvas.setAttribute('aria-label', 'イルカの操作フィールド');
    this.app.canvas.setAttribute('role', 'img');
    this.app.stage.eventMode = 'none';
    this.createOcean();
    this.app.stage.addChild(this.world);
    const mask = new Graphics().rect(0, 0, 720, 720).fill(0xffffff);
    this.app.stage.addChild(mask);
    this.world.mask = mask;
    this.combat = new CombatRenderer(this.world);
    this.createDolphin();
    return true;
  }

  private createOcean(): void {
    const sea = new Graphics();
    // A restrained vertical gradient, drawn once rather than rebuilt every frame.
    for (let i = 0; i < 60; i++) {
      const t = i / 59;
      const r = Math.round(10 - t * 5);
      const g = Math.round(59 - t * 27);
      const b = Math.round(75 - t * 26);
      sea.rect(0, i * 12, 720, 13).fill((r << 16) | (g << 8) | b);
    }
    sea.circle(360, -80, 400).fill({ color: 0x3cc1c6, alpha: 0.035 });
    sea.poly([70, 0, 145, 0, 470, 720, 280, 720]).fill({ color: 0xb8f5db, alpha: 0.025 });
    sea.poly([300, 0, 322, 0, 610, 720, 530, 720]).fill({ color: 0xb8f5db, alpha: 0.025 });
    sea.poly([480, 0, 535, 0, 680, 720, 560, 720]).fill({ color: 0xb8f5db, alpha: 0.018 });
    for (let x = 0; x <= 720; x += 60) sea.moveTo(x, 0).lineTo(x, 720).stroke({ color: 0xa4d9df, width: 1, alpha: 0.025 });
    for (let y = 0; y <= 720; y += 60) sea.moveTo(0, y).lineTo(720, y).stroke({ color: 0xa4d9df, width: 1, alpha: 0.025 });
    sea.circle(360, 360, 245).stroke({ color: 0x8bbbc6, width: 1, alpha: 0.045 });
    sea.circle(360, 360, 290).stroke({ color: 0x8bbbc6, width: 1, alpha: 0.025 });
    this.app.stage.addChild(sea);

    for (let i = 0; i < 34; i++) {
      // Deterministic decoration makes resets and screenshots reproducible.
      const x = (i * 137 + 53) % 720;
      const y = (i * 97 + 61) % 720;
      const radius = i % 6 === 0 ? 4.5 : i % 3 === 0 ? 2 : 1;
      const graphic = new Graphics().circle(0, 0, radius).stroke({ color: 0x9cdddd, alpha: i % 6 === 0 ? 0.22 : 0.16, width: 1 });
      if (radius > 2) graphic.circle(-1, -1.4, 0.8).fill({ color: 0xe0fffa, alpha: 0.24 });
      this.app.stage.addChild(graphic);
      this.bubbles.push({ graphic, x, y, speed: 9 + i % 7 * 2, phase: i * 1.7 });
    }
  }

  private createDolphin(): void {
    this.ripples.ellipse(0, 4, 30, 16).fill({ color: 0x6ce4db, alpha: 0.035 });
    this.ripples.ellipse(0, 4, 23, 11).stroke({ color: 0x6ce4db, alpha: 0.12, width: 1 });
    this.world.addChild(this.ripples);
    // Dorsal view, facing up: paired pectoral fins, a dorsal fin and horizontal flukes.
    // The white belly stays underneath; the visible surface is the dolphin's back.
    this.tail
      .moveTo(0, 1).bezierCurveTo(-4, -1, -9, 0, -13, 6)
      .quadraticCurveTo(-13, 9, -8, 8).quadraticCurveTo(-2, 8, 0, 4)
      .quadraticCurveTo(2, 8, 8, 8).quadraticCurveTo(13, 9, 13, 6)
      .bezierCurveTo(9, 0, 4, -1, 0, 1).fill(0x51b8d2)
      .moveTo(-10, 5).quadraticCurveTo(-4, 3, 0, 3).quadraticCurveTo(4, 3, 10, 5)
      .stroke({ color: 0x9be0e9, width: 0.7, alpha: 0.5 });
    this.tail.position.set(0, 13);
    this.dolphinBody.addChild(this.tail);
    this.leftFin.moveTo(0, 0).quadraticCurveTo(-8, 3, -12, 10)
      .quadraticCurveTo(-12, 13, -6, 10).lineTo(1, 7).fill(0x48abc8)
      .moveTo(-3, 4).quadraticCurveTo(-8, 8, -10, 10)
      .stroke({ color: 0x9fe5e8, width: 0.8, alpha: 0.55 });
    this.leftFin.position.set(-6, -3);
    this.rightFin.moveTo(0, 0).quadraticCurveTo(-8, 3, -12, 10)
      .quadraticCurveTo(-12, 13, -6, 10).lineTo(1, 7).fill(0x48abc8)
      .moveTo(-3, 4).quadraticCurveTo(-8, 8, -10, 10)
      .stroke({ color: 0x9fe5e8, width: 0.8, alpha: 0.55 });
    this.rightFin.position.set(6, -3);
    this.rightFin.scale.x = -1;
    this.dolphinBody.addChild(this.leftFin, this.rightFin);
    const outline = new Graphics()
      .moveTo(0, -18).bezierCurveTo(-10, -18, -12, -7, -8, 3)
      .quadraticCurveTo(-5, 11, -3, 16).lineTo(3, 16)
      .quadraticCurveTo(5, 11, 8, 3).bezierCurveTo(12, -7, 10, -18, 0, -18).fill(0x7bd5e8)
      .moveTo(-3.2, -16).lineTo(-2.6, -20)
      .quadraticCurveTo(0, -23, 2.6, -20).lineTo(3.2, -16).fill(0x8bdeec)
      .moveTo(-4, -13).bezierCurveTo(-8, -8, -7, 0, -4, 5)
      .stroke({ color: 0xc1f0ed, width: 1.4, alpha: 0.55 })
      .ellipse(0, -11, 1.4, 0.8).fill(0x3b8fa8)
      .moveTo(0, -5).quadraticCurveTo(7, -1, 2, 7)
      .quadraticCurveTo(-2, 5, -1, -3).closePath().fill(0x389bb9)
      .moveTo(0, -3).quadraticCurveTo(3, 0, 2, 4)
      .stroke({ color: 0x9ee5e9, width: 0.7, alpha: 0.7 })
      .ellipse(-7, -11.5, 1, 1.5).fill(0x123e50)
      .ellipse(7, -11.5, 1, 1.5).fill(0x123e50)
      .circle(-7.2, -12, 0.4).fill(0xe9fffa)
      .circle(7.2, -12, 0.4).fill(0xe9fffa);
    this.dolphinBody.addChild(outline);
    this.dolphin.addChild(this.dolphinBody);
    this.world.addChild(this.dolphin);
    this.hitPoint.circle(0, 0, GAME_CONFIG.player.hitRadius + 2).fill(0x083d4e)
      .circle(0, 0, GAME_CONFIG.player.hitRadius).fill(0xf5f0cc)
      .circle(0, 0, 1.5).fill(0xffffff);
    this.world.addChild(this.hitPoint);
    this.shield.circle(0, 0, 26).stroke({ color: 0xb7ede4, width: 1, alpha: 0.55 });
    this.world.addChild(this.shield);
    this.world.addChild(this.muzzle);
  }

  private createTarget(): TargetVisual {
    const root = new Container();
    const halo = new Graphics().circle(0, 0, 31).fill({ color: 0xe9b0bb, alpha: 0.025 });
    const tentacles = new Graphics();
    const cap = new Graphics()
      .moveTo(-18, 2).bezierCurveTo(-20, -25, 20, -25, 18, 2)
      .quadraticCurveTo(12, 6, 6, 2).quadraticCurveTo(0, 7, -6, 2).quadraticCurveTo(-12, 6, -18, 2)
      .fill({ color: 0xc79eb7, alpha: 0.77 })
      .ellipse(-5, -9, 6, 3).fill({ color: 0xf9dfdb, alpha: 0.3 })
      .circle(-6, -1, 1.6).fill(0x443e5a).circle(6, -1, 1.6).fill(0x443e5a)
      .moveTo(-2, 3).quadraticCurveTo(0, 5, 2, 3).stroke({ color: 0x685271, width: 1 });
    root.addChild(halo, tentacles, cap);
    this.world.addChild(root);
    return { root, tentacles };
  }

  private createBullet(mode: ShotMode): Container {
    const root = new Container();
    const graphic = new Graphics();
    if (mode === 'homing') {
      graphic.ellipse(-7, 0, 14, 7).fill({ color: 0xf4c987, alpha: 0.08 })
        .moveTo(-15, -3).quadraticCurveTo(-6, -5, -1, -1).stroke({ color: 0xffd99b, width: 1.2, alpha: 0.6 })
        .moveTo(-15, 3).quadraticCurveTo(-6, 5, -1, 1).stroke({ color: 0xffd99b, width: 1.2, alpha: 0.6 })
        .circle(0, 0, 4).fill(0xeec788).circle(1, -1, 2).fill(0xfffae1);
    } else {
      graphic.ellipse(-8, 0, 20, 6).fill({ color: 0x8deedc, alpha: 0.06 })
        .moveTo(-22, 0).lineTo(-2, 0).stroke({ color: 0x8deedc, width: 3, alpha: 0.3 })
        .ellipse(-3, 0, 10, 2.6).fill({ color: 0x9cf6de, alpha: 0.7 })
        .ellipse(1, 0, 5.5, 2).fill(0xc5ffea)
        .circle(3, 0, 1.5).fill(0xffffff);
    }
    root.addChild(graphic);
    this.world.addChild(root);
    return root;
  }

  render(state: GameState, alpha: number): void {
    if (!this.initialized || this.disposed) return;
    const t = state.elapsed;
    this.world.position.set(state.view.offset.x, state.view.offset.y);
    this.world.scale.set(state.view.scale.x, state.view.scale.y);
    this.world.rotation = state.view.rotation;
    for (const bubble of this.bubbles) {
      bubble.graphic.position.set(bubble.x + Math.sin(t * 0.3 + bubble.phase) * 8, (bubble.y - t * bubble.speed % 750 + 750) % 750 - 15);
    }
    const player = state.player;
    this.combat.render(state, alpha);
    const pose = getPlayerPose(state, alpha);
    const position = pose.position;
    this.dolphin.position.set(position.x, position.y);
    this.dolphin.rotation = pose.rotation;
    this.dolphin.alpha = pose.opacity;
    this.shield.position.set(position.x, position.y);
    this.shield.visible = !state.gameOver && player.invulnerableFor > 0;
    const swim = t * (player.slow ? 4.5 : 9);
    const motion = Math.min(1, Math.hypot(player.velocity.x, player.velocity.y) / GAME_CONFIG.player.speed);
    this.dolphinBody.position.y = Math.sin(swim) * (0.5 + motion * 0.65);
    this.dolphinBody.scale.y = 1 + Math.sin(swim) * 0.025;
    this.tail.rotation = Math.sin(swim) * (player.slow ? 0.055 : 0.11);
    this.tail.scale.y = 0.82 + Math.sin(swim) * (player.slow ? 0.13 : 0.2);
    this.leftFin.rotation = Math.sin(swim - 0.7) * (player.slow ? 0.055 : 0.11);
    this.rightFin.rotation = -this.leftFin.rotation;
    this.ripples.position.set(position.x, position.y);
    this.ripples.visible = !state.gameOver;
    this.ripples.scale.set(1 + Math.sin(t * 3) * 0.08);
    this.hitPoint.position.set(position.x, position.y);
    this.hitPoint.visible = !state.gameOver;
    this.muzzle.position.set(position.x, position.y - GAME_CONFIG.shot.muzzleOffset);
    this.muzzle.alpha = Math.min(1, player.muzzleFlash / 0.075);
    this.muzzle.scale.set(0.7 + player.muzzleFlash * 6);
    this.muzzle.clear();
    if (player.muzzleFlash > 0) {
      const homing = player.slow;
      const color = homing ? 0xf8dfaa : 0xb4ffe4;
      this.muzzle.circle(0, 0, homing ? 12 : 9).stroke({ color, width: 1.5, alpha: 0.8 })
        .star(0, 0, homing ? 5 : 4, homing ? 9 : 13, 2).fill({ color, alpha: 0.85 })
        .circle(0, 0, 3).fill(0xffffff);
    }

    const targetIds = new Set(state.targets.map((target) => target.id));
    for (const [id, visual] of this.targets) {
      if (!targetIds.has(id)) { visual.root.destroy({ children: true }); this.targets.delete(id); }
    }
    for (const target of state.targets) {
      let visual = this.targets.get(target.id);
      if (!visual) { visual = this.createTarget(); this.targets.set(target.id, visual); }
      const point = interpolate(target.previousPosition, target.position, alpha);
      visual.root.position.set(point.x, point.y);
      visual.root.rotation = Math.sin(t * 1.5 + target.phase) * 0.06;
      visual.tentacles.clear();
      for (let i = 0; i < 4; i++) {
        const x = -11 + i * 7;
        const sway = Math.sin(t * 2.2 + target.phase + i) * 5;
        visual.tentacles.moveTo(x, 1).bezierCurveTo(x - sway, 12, x + sway, 19, x + sway * 0.6, 25 + i % 2 * 4)
          .stroke({ color: 0xd8b3c9, alpha: 0.6, width: 2 });
      }
    }
    const bulletIds = new Set(state.bullets.map((bullet) => bullet.id));
    for (const [id, visual] of this.bullets) {
      if (!bulletIds.has(id)) { visual.destroy({ children: true }); this.bullets.delete(id); }
    }
    for (const bullet of state.bullets) {
      let visual = this.bullets.get(bullet.id);
      if (!visual) { visual = this.createBullet(bullet.mode); this.bullets.set(bullet.id, visual); }
      const point = interpolate(bullet.previousPosition, bullet.position, alpha);
      visual.position.set(point.x, point.y);
      visual.rotation = Math.atan2(bullet.velocity.y, bullet.velocity.x);
      visual.alpha = Math.min(1, (GAME_CONFIG.shot.lifetime - bullet.age) * 3);
    }
    this.app.render();
  }

  private destroyApplication(): void {
    this.app.destroy(true, { children: true });
    this.initialized = false;
  }

  destroy(): void {
    this.disposed = true;
    this.bullets.clear();
    this.targets.clear();
    if (this.initialized) this.destroyApplication();
  }
}
