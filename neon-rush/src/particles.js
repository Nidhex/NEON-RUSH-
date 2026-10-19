/**
 * ParticleSystem: High-performance particle manager with object pooling.
 * Avoids garbage collection pauses during high-speed endless running gameplay.
 */
export class ParticleSystem {
  constructor(maxParticles = 350) {
    this.maxParticles = maxParticles;
    this.pool = [];
    for (let i = 0; i < maxParticles; i++) {
      this.pool.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        size: 2,
        color: '#00f3ff',
        alpha: 1,
        life: 0,
        maxLife: 1,
        type: 'spark', // 'spark' | 'ring' | 'glow' | 'shard'
      });
    }
  }

  spawn(options) {
    // Find first inactive particle
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.pool[i];
      if (!p.active) {
        p.active = true;
        p.x = options.x || 0;
        p.y = options.y || 0;
        p.z = options.z || 0;
        p.vx = options.vx || 0;
        p.vy = options.vy || 0;
        p.vz = options.vz || 0;
        p.size = options.size || 3;
        p.color = options.color || '#00f3ff';
        p.alpha = options.alpha !== undefined ? options.alpha : 1;
        p.life = 0;
        p.maxLife = options.maxLife || 0.5;
        p.type = options.type || 'spark';
        return p;
      }
    }
    return null;
  }

  createThrusterTrail(x, y, z, isSliding) {
    const count = isSliding ? 3 : 2;
    for (let i = 0; i < count; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 0.12,
        y: y + (isSliding ? 0.08 : 0.22) + (Math.random() - 0.5) * 0.05,
        z: z + 0.1,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.4 + (isSliding ? 0.3 : 0),
        vz: 2.5 + Math.random() * 2,
        size: isSliding ? 3.5 : 2.5,
        color: Math.random() > 0.4 ? '#00f3ff' : '#ff007f',
        maxLife: 0.25 + Math.random() * 0.15,
        type: 'spark',
      });
    }
  }

  createCoinBurst(x, y, z) {
    const count = 18;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 1.2 + Math.random() * 1.8;
      this.spawn({
        x: x,
        y: y,
        z: z,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 0.5,
        vz: (Math.random() - 0.5) * 1.5,
        size: 3 + Math.random() * 2,
        color: i % 2 === 0 ? '#ffe600' : '#00f3ff',
        maxLife: 0.45 + Math.random() * 0.2,
        type: 'spark',
      });
    }
    // Ring shockwave
    this.spawn({
      x: x,
      y: y,
      z: z,
      size: 1.5,
      color: '#ffe600',
      maxLife: 0.35,
      type: 'ring',
    });
  }

  createCrashExplosion(x, y, z) {
    const count = 45;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 4.5;
      const colors = ['#ff007f', '#00f3ff', '#ffffff', '#9d00ff', '#ffe600'];
      this.spawn({
        x: x,
        y: y + 0.5,
        z: z,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 2.0,
        vz: (Math.random() - 0.5) * 3,
        size: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        maxLife: 0.6 + Math.random() * 0.4,
        type: 'shard',
      });
    }
  }

  update(dt, worldSpeed = 0) {
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }

      // Physics integration
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += (p.vz + worldSpeed) * dt;

      // Gravity on shards/sparks
      if (p.type === 'shard' || p.type === 'spark') {
        p.vy -= 4.0 * dt;
      }

      // Ground bounce clamp
      if (p.y < 0) {
        p.y = 0;
        p.vy = -p.vy * 0.3;
      }

      // Fade out
      p.alpha = 1 - p.life / p.maxLife;
    }
  }

  render(ctx, projectFunc) {
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      const proj = projectFunc(p.x, p.y, p.z);
      if (!proj || proj.scale <= 0) continue;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));

      if (p.type === 'ring') {
        const ringRadius = (p.size * (1 + (p.life / p.maxLife) * 3.5)) * proj.scale;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, 2 * proj.scale);
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const rad = Math.max(1, p.size * proj.scale);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6 * proj.scale;

        if (p.type === 'shard') {
          ctx.beginPath();
          ctx.rect(proj.x - rad, proj.y - rad, rad * 2, rad * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, rad, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  reset() {
    for (let i = 0; i < this.maxParticles; i++) {
      this.pool[i].active = false;
    }
  }
}
