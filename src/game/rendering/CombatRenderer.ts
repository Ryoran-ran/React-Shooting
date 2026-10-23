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
  private laserLayer = new Container();
  private enemyLayer = new Container();
  private bulletLayer = new Container();
  private itemLayer = new Container();
  private effectLayer = new Container();

  constructor(world: Container) { world.addChild(this.laserLayer, this.enemyLayer, this.bulletLayer, this.itemLayer, this.effectLayer); }

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
    removeMissing(this.enemies, new Set(state.enemies.map((enemy) => enemy.id)), (v) => v.root.destroy({ children: true }));
    for (const enemy of state.enemies) {
      let v = this.enemies.get(enemy.id);
      if (!v) { v = this.createEnemy(enemy); this.enemies.set(enemy.id, v); }
      const p = interpolate(enemy.previousPosition, enemy.position, alpha);
      v.root.position.set(p.x, p.y);
      v.body.rotation = enemy.kind === 'rusher' ? Math.atan2(enemy.velocity.y, enemy.velocity.x) + Math.PI / 2
        : Math.sin(state.elapsed * 2 + enemy.origin.x) * 0.045;
      if (enemy.kind === 'small') v.body.scale.y = 1 + Math.sin(state.elapsed * 3 + enemy.origin.x) * 0.07;
      v.flash.alpha = enemy.hitFlash > 0 ? 0.7 : 0;
      v.health.clear();
      if (enemy.hp < enemy.maxHp) {
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
          .moveTo(0, 0).lineTo(dx, dy).stroke({ color: 0xfff6dd, width: laser.width * 0.35 });
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
    removeMissing(this.effects, new Set(state.effects.map((effect) => effect.id)), (v) => v.destroy());
    for (const effect of state.effects) {
      let v = this.effects.get(effect.id);
      if (!v) { v = new Graphics(); this.effectLayer.addChild(v); this.effects.set(effect.id, v); }
      const progress = effect.age / effect.lifetime;
      const explosion = effect.kind === 'explosion';
      const color = explosion ? 0xffc580 : effect.kind === 'hit' ? 0xffd5c1 : effect.kind === 'heal' ? 0xb8f4b6 : 0xe4c5e2;
      v.position.set(effect.position.x, effect.position.y); v.alpha = 1 - progress;
      v.clear().circle(0, 0, 8 + progress * (explosion ? GAME_CONFIG.effects.explosionRadius : 32)).stroke({ color, width: explosion ? 2.5 : 1.6 });
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
