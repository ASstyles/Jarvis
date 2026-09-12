export type GameLoopCallback = (deltaTime: number, timestamp: number) => void;

export class GameLoop {
  private animationFrameId: number | null = null;
  private lastTime: number = 0;
  private isRunning: boolean = false;
  private callback: GameLoopCallback;

  public fps: number = 60;
  private frameCount: number = 0;
  private fpsLastCheck: number = 0;

  constructor(callback: GameLoopCallback) {
    this.callback = callback;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.fpsLastCheck = this.lastTime;
    this.frameCount = 0;

    const loop = (timestamp: number) => {
      if (!this.isRunning) return;

      // Calculate delta time in seconds, clamped between 1ms and 100ms to avoid delta spikes
      const rawDelta = (timestamp - this.lastTime) / 1000;
      const deltaTime = Math.min(Math.max(rawDelta, 0.001), 0.1);
      this.lastTime = timestamp;

      // FPS tracking
      this.frameCount++;
      if (timestamp - this.fpsLastCheck >= 1000) {
        this.fps = this.frameCount;
        this.frameCount = 0;
        this.fpsLastCheck = timestamp;
      }

      this.callback(deltaTime, timestamp);

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public isActive(): boolean {
    return this.isRunning;
  }
}
