import { Container, Graphics } from 'pixi.js';
import { ENEMY_DEFINITIONS } from '../../data/enemies';
import { GAME_CONFIG } from '../config';
import { interpolate } from '../core/coordinates';
import type { GameState } from '../core/GameState';
import type { Enemy, EnemyAppearance } from '../entities/Enemy';

interface EnemyVisual { root: Container; body: Container; health: Graphics; flash: Graphics }

function removeMissing<T>(visuals: Map<string, T>, ids: Set<string>, destroy: (visual: T) => void): void {
  for (const [id, visual] of visuals) if (!ids.has(id)) { destroy(visual); visuals.delete(id); }
}

function drawCreature(appearance: EnemyAppearance): Graphics {
  const g = new Graphics();
  switch (appearance) {
    case 'turtle':
      g.ellipse(0, 7, 91, 64).fill({ color: 0x80e0c2, alpha: 0.035 });
      for (const side of [-1, 1]) {
        g.moveTo(side * 28, -26).quadraticCurveTo(side * 65, -53, side * 87, -24)
          .quadraticCurveTo(side * 61, -10, side * 32, 2).fill(0x6caead)
          .moveTo(side * 26, 27).quadraticCurveTo(side * 61, 40, side * 57, 62)
          .quadraticCurveTo(side * 35, 59, side * 18, 42).fill(0x599898);
      }
      g.ellipse(0, 52, 21, 25).fill(0x9dcec0)
        .ellipse(0, 0, 43, 53).fill(0x4e8c89).ellipse(0, -3, 36, 45).fill(0x79b8a1)
        .poly([0, -35, 22, -20, 22, 9, 0, 25, -22, 9, -22, -20]).fill(0x9acbb1)
        .poly([0, -35, 22, -20, 22, 9, 0, 25, -22, 9, -22, -20, 0, -35]).stroke({ color: 0x4f9186, width: 2 });
      for (const side of [-1, 1]) {
        g.moveTo(side * 22, -20).lineTo(side * 34, -28).moveTo(side * 22, 9).lineTo(side * 37, 15)
          .moveTo(0, 25).lineTo(side * 21, 36).stroke({ color: 0x4f9186, width: 2 });
        g.circle(side * 10, 56, 3).fill(0x234750).circle(side * 10 + 0.8, 55, 0.9).fill(0xf0ffe6);
      }
      g.moveTo(-5, 67).quadraticCurveTo(0, 70, 5, 67).stroke({ color: 0x568d84, width: 1.4 });
      return g;
    case 'jelly':
      for (let i = 0; i < 4; i++) {
        const x = -10 + i * 7;
        g.moveTo(x, 2).bezierCurveTo(x - 4, 10, x + 4, 17, x, 25).stroke({ color: 0xdfadc6, width: 2, alpha: 0.8 });
      }
      g.moveTo(-18, 2).bezierCurveTo(-20, -25, 20, -25, 18, 2)
        .quadraticCurveTo(9, 7, 0, 2).quadraticCurveTo(-9, 7, -18, 2).fill(0xc79eb7)
        .ellipse(-5, -9, 6, 3).fill({ color: 0xf9dfdb, alpha: 0.35 });
      break;
    case 'puffer':
      for (let i = 0; i < 10; i++) {
        const angle = i / 10 * Math.PI * 2;
        const c = Math.cos(angle), s = Math.sin(angle);
        g.poly([c * 17 - s * 3, s * 17 + c * 3, c * 26, s * 26, c * 17 + s * 3, s * 17 - c * 3]).fill(0xc59c68);
      }
      g.circle(0, 0, 20).fill(0xdfbd80).ellipse(0, 7, 14, 10).fill(0xf1dfb3)
        .ellipse(-7, -9, 6, 3).fill({ color: 0xffe8af, alpha: 0.5 });
      for (let i = 0; i < 5; i++) g.circle(-12 + i * 6, -3 - i % 2 * 5, 1.5).fill(0xb58b57);
      break;
    case 'anemone':
      g.ellipse(0, 15, 23, 9).fill(0x467f83);
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * Math.PI * 2;
        g.moveTo(Math.cos(a) * 10, Math.sin(a) * 10)
          .quadraticCurveTo(Math.cos(a + 0.25) * 29, Math.sin(a + 0.25) * 29, Math.cos(a) * 25, Math.sin(a) * 25)
          .stroke({ color: i % 2 ? 0xdb9ea6 : 0xac859e, width: 5 });
      }
      g.circle(0, 0, 15).fill(0xc68fa9).circle(0, 0, 8).fill(0xf2c7bd);
      break;
    case 'squid':
      g.poly([0, -25, -15, 2, 15, 2]).fill(0x9b93d1)
        .roundRect(-9, -13, 18, 29, 8).fill(0xc7b4e8)
        .ellipse(-3, -8, 3, 6).fill({ color: 0xf6e6fc, alpha: 0.35 });
      for (let i = 0; i < 4; i++) {
        const x = -7 + i * 4.5;
        g.moveTo(x, 10).quadraticCurveTo(x - 3, 20, x + 1, 25).stroke({ color: 0xb2a0d6, width: 2 });
      }
      break;
    case 'ray':
      g.moveTo(0, -17).bezierCurveTo(-14, -17, -23, -4, -43, -12)
        .quadraticCurveTo(-35, 18, -10, 13).quadraticCurveTo(0, 28, 10, 13)
        .quadraticCurveTo(35, 18, 43, -12).bezierCurveTo(23, -4, 14, -17, 0, -17).fill(0x8dadd4)
        .ellipse(0, -1, 12, 20).fill(0xb4c8e2)
        .moveTo(0, 14).quadraticCurveTo(-4, 35, 4, 43).stroke({ color: 0x8dadd4, width: 3 })
        .moveTo(-31, -4).quadraticCurveTo(-19, 3, -14, 7).stroke({ color: 0xc3d1e8, width: 1, alpha: 0.6 })
        .moveTo(31, -4).quadraticCurveTo(19, 3, 14, 7).stroke({ color: 0xc3d1e8, width: 1, alpha: 0.6 });
      break;
  }
  const eyeY = appearance === 'squid' ? 5 : -1;
  g.circle(-6, eyeY, 1.8).fill(0x31394f).circle(6, eyeY, 1.8).fill(0x31394f)
    .circle(-5.6, eyeY - 0.5, 0.5).fill(0xffffff).circle(6.4, eyeY - 0.5, 0.5).fill(0xffffff);
  return g;
}

export class CombatRenderer {
  private enemies = new Map<string, EnemyVisual>();
  private bullets = new Map<string, Graphics>();
  private items = new Map<string, Container>();
  private lasers = new Map<string, Graphics>();
  private effects = new Map<string, Graphics>();
  private scoreItems = new Map<string, Graphics>();
  private arrival = new Graphics();
  private defeat = new Graphics();
  private laserLayer = new Container();
  private enemyLayer = new Container();
  private bulletLayer = new Container();
  private itemLayer = new Container();
  private effectLayer = new Container();

  constructor(world: Container) {
    world.addChild(this.arrival, this.laserLayer, this.enemyLayer, this.bulletLayer, this.itemLayer, this.effectLayer);
    this.effectLayer.addChild(this.defeat);
  }

  private createEnemy(enemy: Enemy): EnemyVisual {
    const definition = ENEMY_DEFINITIONS[enemy.kind];
    const root = new Container();
    const body = new Container();
    const halo = new Graphics().circle(0, 0, definition.visualRadius + 10).fill({ color: 0xdcaabf, alpha: 0.035 });
    const flash = new Graphics().circle(0, 0, definition.hitRadius).fill({ color: 0xfff5dd, alpha: 0.45 });
    const health = new Graphics();
    body.addChild(halo, drawCreature(definition.appearance), flash);
    root.addChild(body, health);
    this.enemyLayer.addChild(root);
    return { root, body, health, flash };
  }

  render(state: GameState, alpha: number): void {
    this.arrival.clear();
    this.defeat.clear();
    if (state.stagePhase === 'boss-intro') {
      const p = Math.min(1, state.bossIntroElapsed / GAME_CONFIG.boss.introDuration);
      for (let i = 0; i < 3; i++) {
        const radius = 45 + ((p + i / 3) % 1) * 320;
        this.arrival.ellipse(360, 155, radius, radius * 0.55)
          .stroke({ color: 0x9edfcf, width: 2, alpha: (1 - radius / 400) * 0.2 });
      }
      this.arrival.circle(360, 100, 110 + p * 120).fill({ color: 0x78cfc7, alpha: Math.sin(p * Math.PI) * 0.06 });
    }
    if (state.result && state.boss && state.clearElapsed < GAME_CONFIG.boss.vanishDuration) {
      const boss = state.enemies.find((enemy) => enemy.id === state.boss?.entityId);
      if (boss) {
        const t = state.clearElapsed;
        const fade = 1 - t / GAME_CONFIG.boss.vanishDuration;
        const center = boss.position;
        this.arrival.circle(center.x, center.y, 70 + t * 85)
          .fill({ color: 0xb7f2df, alpha: 0.11 * fade });
        for (let i = 0; i < 3; i++) {
          if (t < i * 0.28) continue;
          const progress = Math.max(0, (t - i * 0.28) / 1.35);
          if (progress >= 1) continue;
          this.defeat.circle(center.x, center.y, 42 + progress * 160)
            .stroke({ color: i === 0 ? 0xffebbb : 0xaee8df, width: 3 - progress * 2, alpha: (1 - progress) * 0.65 });
        }
        for (let i = 0; i < 22; i++) {
          const angle = i * 2.39996;
          const distance = 18 + (i % 5) * 8 + t * (45 + i % 4 * 15);
          const x = center.x + Math.cos(angle) * distance;
          const y = center.y + Math.sin(angle) * distance * 0.7 - t * (12 + i % 3 * 8);
          const radius = (i % 4 === 0 ? 4 : 2) * fade;
          this.defeat.circle(x, y, radius).fill({ color: i % 3 === 0 ? 0xffe8af : 0xc8f4e3, alpha: fade * 0.9 });
        }
      }
    }
    removeMissing(this.enemies, new Set(state.enemies.map((enemy) => enemy.id)), (v) => v.root.destroy({ children: true }));
    for (const enemy of state.enemies) {
      let v = this.enemies.get(enemy.id);
      if (!v) { v = this.createEnemy(enemy); this.enemies.set(enemy.id, v); }
      const p = interpolate(enemy.previousPosition, enemy.position, alpha);
      v.root.position.set(p.x, p.y);
      v.body.rotation = enemy.kind === 'rusher' ? Math.atan2(enemy.velocity.y, enemy.velocity.x) + Math.PI / 2
        : Math.sin(state.elapsed * 2 + enemy.origin.x) * 0.045;
      if (enemy.kind === 'small') v.body.scale.y = 1 + Math.sin(state.elapsed * 3 + enemy.origin.x) * 0.07;
      if (enemy.kind === 'boss') {
        const entering = state.stagePhase === 'boss-intro';
        const p = Math.min(1, state.bossIntroElapsed / GAME_CONFIG.boss.introDuration);
        v.body.scale.set((entering ? 0.75 + p * 0.25 : 1) * (1 + Math.sin(state.elapsed * 2) * 0.025), entering ? 0.75 + p * 0.25 : 1);
        v.body.alpha = entering ? 0.2 + p * 0.8 : enemy.invulnerable ? 0.6 + Math.sin(state.elapsed * 9) * 0.12 : 1;
        if (state.lasers.some((laser) => laser.emitterId === enemy.id)) v.body.rotation = 0;
        if (state.result && state.boss?.entityId === enemy.id) {
          const t = state.clearElapsed;
          const p = Math.min(1, t / GAME_CONFIG.boss.vanishDuration);
          v.root.position.set(enemy.position.x + Math.sin(t * 35) * 5 * (1 - p), enemy.position.y + p * p * 55);
          v.root.alpha = Math.max(0, Math.min(1, (GAME_CONFIG.boss.vanishDuration - t) / 1.35));
          v.body.alpha = 1;
          v.body.rotation = Math.sin(t * 22) * 0.12 + p * 0.24;
          v.body.scale.set(1 - p * 0.55, 1 - p * 0.7);
        } else v.root.alpha = 1;
      }
      v.flash.alpha = enemy.hitFlash > 0 ? 0.7 : 0;
      v.health.clear();
      if (enemy.hp < enemy.maxHp && !(state.result && state.boss?.entityId === enemy.id)) {
        const radius = ENEMY_DEFINITIONS[enemy.kind].visualRadius;
        v.health.roundRect(-18, -radius - 9, 36, 3, 1).fill({ color: 0x142e40, alpha: 0.85 })
          .roundRect(-18, -radius - 9, 36 * enemy.hp / enemy.maxHp, 3, 1).fill(0xe3b7c2);
      }
    }
    removeMissing(this.bullets, new Set(state.enemyBullets.map((b) => b.id)), (v) => v.destroy());
    for (const bullet of state.enemyBullets) {
      let v = this.bullets.get(bullet.id);
      if (!v) {
        const r = GAME_CONFIG.combat.enemyBulletVisualRadius;
        v = new Graphics().circle(0, 0, r + 3).fill({ color: 0xffb8ad, alpha: 0.1 })
          .circle(0, 0, r).fill(0xe79498).circle(0, 0, r - 1.7).fill(0xffe5d8)
          .circle(-1, -1, 1.5).fill(0xffffff);
        this.bulletLayer.addChild(v); this.bullets.set(bullet.id, v);
      }
      const p = interpolate(bullet.previousPosition, bullet.position, alpha);
      v.position.set(p.x, p.y);
    }
    removeMissing(this.lasers, new Set(state.lasers.map((l) => l.id)), (v) => v.destroy());
    for (const laser of state.lasers) {
      let v = this.lasers.get(laser.id);
      if (!v) { v = new Graphics(); this.laserLayer.addChild(v); this.lasers.set(laser.id, v); }
      const active = laser.age >= laser.warning;
      const dx = laser.end.x - laser.origin.x, dy = laser.end.y - laser.origin.y;
      v.position.set(laser.origin.x, laser.origin.y);
      v.clear();
      if (active) {
        v.moveTo(0, 0).lineTo(dx, dy).stroke({ color: 0xec918b, width: laser.width + 10, alpha: 0.15 })
          .moveTo(0, 0).lineTo(dx, dy).stroke({ color: 0xf3b4a2, width: laser.width, alpha: 0.85 })
          .moveTo(0, 0).lineTo(dx, dy).stroke({ color: 0xfff6dd, width: laser.width * 0.35 })
          .circle(0, 0, laser.width).fill({ color: 0xffedc5, alpha: 0.8 });
      } else {
        v.moveTo(0, 0).lineTo(dx, dy).stroke({ color: 0xf7c58d, width: 1, alpha: 0.45 + Math.sin(laser.age * 18) * 0.2 })
          .circle(0, 0, 8 + laser.age / laser.warning * 6).stroke({ color: 0xf4be91, width: 1, alpha: 0.7 });
      }
    }
    removeMissing(this.items, new Set(state.items.map((item) => item.id)), (v) => v.destroy({ children: true }));
    for (const item of state.items) {
      let v = this.items.get(item.id);
      if (!v) {
        v = new Container();
        v.addChild(new Graphics().circle(0, 0, 17).fill({ color: 0xa0efbe, alpha: 0.07 })
          .circle(0, 0, 10).fill(0x234f4b).circle(0, 0, 10).stroke({ color: 0xa6e2b8, width: 1 })
          .roundRect(-5, -1.5, 10, 3, 1).fill(0xc9f0c6).roundRect(-1.5, -5, 3, 10, 1).fill(0xc9f0c6));
        this.itemLayer.addChild(v); this.items.set(item.id, v);
      }
      const p = interpolate(item.previousPosition, item.position, alpha);
      v.position.set(p.x, p.y); v.scale.set(1 + Math.sin(item.age * 4) * 0.06);
    }
    removeMissing(this.scoreItems, new Set(state.scoreItems.map((item) => item.id)), (v) => v.destroy());
    for (const item of state.scoreItems) {
      let v = this.scoreItems.get(item.id);
      if (!v) {
        v = new Graphics().circle(0, 0, 12).fill({ color: 0xffdfa1, alpha: 0.12 })
          .poly([0, -6, 5, 0, 0, 6, -5, 0]).fill(0xeacb83)
          .poly([0, -3, 2, 0, 0, 3, -2, 0]).fill(0xfff6cf);
        this.itemLayer.addChild(v); this.scoreItems.set(item.id, v);
      }
      const p = interpolate(item.previousPosition, item.position, alpha);
      v.position.set(p.x, p.y); v.rotation = Math.sin(item.age * 7) * 0.1;
      v.scale.set(item.value >= 100 ? 1.5 : 1);
    }
    removeMissing(this.effects, new Set(state.effects.map((effect) => effect.id)), (v) => v.destroy());
    for (const effect of state.effects) {
      let v = this.effects.get(effect.id);
      if (!v) { v = new Graphics(); this.effectLayer.addChild(v); this.effects.set(effect.id, v); }
      const progress = effect.age / effect.lifetime;
      v.position.set(effect.position.x, effect.position.y);
      v.alpha = 1 - progress;
      v.clear();
      if (effect.kind === 'shot') {
        const color = effect.variant === 'homing' ? 0xffdfa4 : 0xa6f7dc;
        v.circle(0, 0, 3 + progress * 13).stroke({ color, width: 2 * (1 - progress) + 0.5 })
          .circle(0, 0, 4 * (1 - progress)).fill({ color: 0xffffff, alpha: 0.75 });
        for (let i = 0; i < 4; i++) {
          const angle = i * Math.PI / 2;
          const inner = 5 + progress * 7, outer = inner + 8 * (1 - progress);
          v.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
            .lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer)
            .stroke({ color, width: 1.6 });
        }
        continue;
      }
      if (effect.kind === 'hit') {
        v.circle(0, 0, 12 + progress * 37).stroke({ color: 0xc8f7ef, width: 3 - progress * 2, alpha: 0.9 })
          .circle(0, 0, 14 * (1 - progress)).fill({ color: 0xffeed6, alpha: 0.3 });
        for (let i = 0; i < 12; i++) {
          const angle = i / 12 * Math.PI * 2;
          const distance = 10 + progress * (32 + i % 3 * 9);
          const x = Math.cos(angle) * distance, y = Math.sin(angle) * distance * 0.72;
          v.circle(x, y, (i % 3 === 0 ? 4 : 2.5) * (1 - progress))
            .fill(i % 3 === 0 ? 0xffe7d4 : 0xb6f2eb);
        }
        continue;
      }
      if (effect.kind === 'burst') {
        const color = effect.variant === 'small' ? 0xe9bfdc : effect.variant === 'medium' ? 0xf1d29b
          : effect.variant === 'turret' ? 0xe5b2bf : effect.variant === 'rusher' ? 0xcac0f2 : 0xb2d5f1;
        const size = effect.variant === 'large' ? 68 : effect.variant === 'medium' || effect.variant === 'turret' ? 45 : 35;
        v.circle(0, 0, 7 + progress * size).stroke({ color, width: 2.5 - progress * 1.5 })
          .circle(0, 0, 16 * (1 - progress)).fill({ color, alpha: 0.22 });
        for (let i = 0; i < 10; i++) {
          const angle = i / 10 * Math.PI * 2 + i * 0.2;
          const distance = 7 + progress * (size * (0.7 + i % 3 * 0.15));
          const x = Math.cos(angle) * distance, y = Math.sin(angle) * distance;
          const shard = (i % 3 === 0 ? 6 : 4) * (1 - progress);
          v.poly([x, y - shard, x + shard * 0.55, y + shard * 0.5, x - shard * 0.55, y + shard * 0.5]).fill(color);
        }
        continue;
      }
      const explosion = effect.kind === 'explosion';
      const phase = effect.kind === 'phase';
      const color = phase ? 0xffe6a4 : explosion ? 0xffc580 : 0xb8f4b6;
      v.circle(0, 0, 8 + progress * (phase ? 160 : explosion ? GAME_CONFIG.effects.explosionRadius : 32)).stroke({ color, width: phase || explosion ? 2.5 : 1.6 });
      if (explosion) v.circle(0, 0, 14 * (1 - progress)).fill({ color: 0xfff0ce, alpha: 0.8 });
      const particles = explosion ? 10 : 7;
      for (let i = 0; i < particles; i++) {
        const a = i / particles * Math.PI * 2;
        const r = 7 + progress * (explosion ? GAME_CONFIG.effects.explosionRadius : 38);
        v.circle(Math.cos(a) * r, Math.sin(a) * r, 2.5 * (1 - progress)).fill(color);
        if (explosion) v.moveTo(Math.cos(a) * r, Math.sin(a) * r)
          .lineTo(Math.cos(a) * (r + 8 * (1 - progress)), Math.sin(a) * (r + 8 * (1 - progress)))
          .stroke({ color, width: 1.5 });
      }
    }
  }
}
