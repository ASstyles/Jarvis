export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  scale: number;
}

export class CollisionEngine {
  public static shakeIntensity: number = 0;
  public static shakeDuration: number = 0;

  public static triggerShake(intensity: number = 8, duration: number = 0.3): void {
    CollisionEngine.shakeIntensity = intensity;
    CollisionEngine.shakeDuration = duration;
  }

  public static applyScreenShake(ctx: CanvasRenderingContext2D, dt: number): void {
    if (CollisionEngine.shakeDuration > 0) {
      CollisionEngine.shakeDuration -= dt;
      const offsetX = (Math.random() * 2 - 1) * CollisionEngine.shakeIntensity;
      const offsetY = (Math.random() * 2 - 1) * CollisionEngine.shakeIntensity;
      ctx.translate(offsetX, offsetY);
      if (CollisionEngine.shakeDuration <= 0) {
        CollisionEngine.shakeIntensity = 0;
      }
    }
  }

  // Red Damage Screen Vignette Overlay
  public static renderDamageVignette(ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number): void {
    if (intensity <= 0) return;
    ctx.save();
    const grad = ctx.createRadialGradient(width / 2, height / 2, width * 0.3, width / 2, height / 2, width * 0.7);
    grad.addColorStop(0, "rgba(239, 68, 68, 0)");
    grad.addColorStop(1, `rgba(239, 68, 68, ${Math.min(0.6, intensity)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // Circle to Circle collision
  public static checkCircleCollision(
    x1: number, y1: number, r1: number,
    x2: number, y2: number, r2: number
  ): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distSq = dx * dx + dy * dy;
    const radiusSum = r1 + r2;
    return distSq <= radiusSum * radiusSum;
  }

  // AABB Box to Box collision
  public static checkAABBCollision(
    x1: number, y1: number, w1: number, h1: number,
    x2: number, y2: number, w2: number, h2: number
  ): boolean {
    return (
      x1 < x2 + w2 &&
      x1 + w1 > x2 &&
      y1 < y2 + h2 &&
      y1 + h1 > y2
    );
  }

  // Distance between two points
  public static getDistance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Particle burst generator helper
  public static createParticleBurst(
    particles: Particle[],
    x: number,
    y: number,
    count: number = 15,
    colors: string[] = ["#00f0ff", "#ffffff", "#3b82f6"]
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 140 + 30;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const maxLife = Math.random() * 0.5 + 0.2;

      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 4 + 1.5,
        color,
        alpha: 1,
        life: maxLife,
        maxLife
      });
    }
  }

  // Floating text popup creator
  public static createFloatingText(
    floaters: FloatingText[],
    x: number,
    y: number,
    text: string,
    color: string = "#00f0ff"
  ): void {
    floaters.push({
      x,
      y,
      text,
      color,
      alpha: 1,
      life: 0.8,
      maxLife: 0.8,
      scale: 1.2
    });
  }

  // Update and render active particle array
  public static updateAndRenderParticles(
    ctx: CanvasRenderingContext2D,
    particles: Particle[],
    dt: number
  ): void {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.alpha = Math.max(p.life / p.maxLife, 0);

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Update and render active floating texts
  public static updateAndRenderFloatingText(
    ctx: CanvasRenderingContext2D,
    floaters: FloatingText[],
    dt: number
  ): void {
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.y -= 40 * dt; // Float upwards
      f.life -= dt;
      f.alpha = Math.max(f.life / f.maxLife, 0);

      if (f.life <= 0) {
        floaters.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = f.alpha;
      ctx.font = "bold 13px system-ui, monospace";
      ctx.fillStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 10;
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }
}
