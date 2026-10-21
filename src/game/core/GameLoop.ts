import { GAME_CONFIG } from '../config';

export class FixedStepClock {
  private accumulator = 0;

  advance(delta: number, update: (step: number) => void): number {
    this.accumulator += Math.max(0, Math.min(delta, GAME_CONFIG.loop.maxFrameTime));
    while (this.accumulator + 1e-10 >= GAME_CONFIG.loop.step) {
      update(GAME_CONFIG.loop.step);
      this.accumulator = Math.max(0, this.accumulator - GAME_CONFIG.loop.step);
    }
    return this.accumulator / GAME_CONFIG.loop.step;
  }

  reset(): void { this.accumulator = 0; }
}

export class GameLoop {
  private frameId = 0;
  private lastTime: number | null = null;
  private running = false;
  private clock = new FixedStepClock();

  constructor(private update: (step: number) => void, private render: (alpha: number) => void) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = null;
    const frame = (time: number) => {
      if (!this.running) return;
      const delta = this.lastTime === null ? 0 : (time - this.lastTime) / 1000;
      this.lastTime = time;
      this.render(this.clock.advance(delta, this.update));
      this.frameId = requestAnimationFrame(frame);
    };
    this.frameId = requestAnimationFrame(frame);
  }

  resetClock(): void { this.clock.reset(); this.lastTime = null; }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
    this.resetClock();
  }
}
