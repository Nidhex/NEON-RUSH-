/**
 * ObstacleManager: Spawns and manages 3D world obstacles with guaranteed solvability.
 * Types: LOW_BARRIER (jumpable), HIGH_BEAM (slidable), CYBER_WALL (lane dodge required).
 */
import { LANE_WIDTH, PLAYER_Z } from './player.js';

export const OBSTACLE_TYPES = {
  LOW_BARRIER: 'LOW_BARRIER', // Must jump or switch lane
  HIGH_BEAM: 'HIGH_BEAM',     // Must slide or switch lane
  CYBER_WALL: 'CYBER_WALL',   // Must switch lane
};

export class ObstacleManager {
  constructor() {
    this.obstacles = [];
    this.spawnDistance = 120; // World Z where obstacles spawn
    this.despawnDistance = -3; // Behind player camera
    this.nextSpawnZ = 85; // Initial runway to allow player to learn controls
    this.baseSpacing = 32; // World units between obstacle waves
    this.difficulty = 1.0;
    this.waveCount = 0;
  }

  reset() {
    this.obstacles = [];
    this.nextSpawnZ = 85;
    this.difficulty = 1.0;
    this.waveCount = 0;
  }

  setDifficulty(diff) {
    this.difficulty = Math.max(1.0, Math.min(2.5, diff));
  }

  update(dt, speed) {
    // Move obstacles towards camera
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.z -= speed * dt;
      obs.animTime += dt;

      // Despawn once well behind the camera
      if (obs.z < this.despawnDistance) {
        this.obstacles.splice(i, 1);
      }
    }

    // Check if new obstacle wave should spawn
    const farthestZ = this.getFarthestZ();
    if (farthestZ < this.spawnDistance) {
      this.spawnWave(Math.max(farthestZ + this.getSpacing(speed), this.nextSpawnZ));
    }
  }

  getSpacing(speed) {
    // Spacing scales dynamically with speed so reaction time remains fair
    const reactionTime = 1.5 / Math.sqrt(this.difficulty); // ~1.0s to 1.5s
    return Math.max(28, speed * reactionTime);
  }

  getFarthestZ() {
    if (this.obstacles.length === 0) return 0;
    let maxZ = 0;
    for (const obs of this.obstacles) {
      if (obs.z > maxZ) maxZ = obs.z;
    }
    return maxZ;
  }

  /**
   * Spawns an obstacle wave guaranteed to have at least one viable escape route.
   */
  spawnWave(z) {
    this.nextSpawnZ = z;
    this.waveCount++;
    const lanes = [-1, 0, 1];

    // Fair runway for initial wave:
    // First wave spawns on left or right lane, or is a jumpable hurdle
    if (this.waveCount <= 1) {
      const startLane = Math.random() < 0.5 ? -1 : 1;
      this.obstacles.push(this.createObstacle(OBSTACLE_TYPES.LOW_BARRIER, startLane, z));
      return;
    }

    // Pick count based on difficulty
    const roll = Math.random();
    let count = 1;
    if (this.difficulty > 1.25 && roll < 0.6) {
      count = 2;
    }

    // Pick distinct lanes randomly
    const shuffledLanes = [...lanes].sort(() => Math.random() - 0.5);
    const selectedLanes = shuffledLanes.slice(0, count);

    // Guaranteed solvability rule:
    // If 2 obstacles spawn, at most ONE of them can be a CYBER_WALL!
    // The other must be either LOW_BARRIER (jumpable) or HIGH_BEAM (slidable),
    // and the 3rd lane remains 100% open.
    let cyberWallUsed = false;

    for (const lane of selectedLanes) {
      let type;
      const typeRoll = Math.random();

      if (!cyberWallUsed && typeRoll < 0.35 && this.difficulty > 1.2) {
        type = OBSTACLE_TYPES.CYBER_WALL;
        cyberWallUsed = true;
      } else if (typeRoll < 0.70) {
        type = OBSTACLE_TYPES.LOW_BARRIER;
      } else {
        type = OBSTACLE_TYPES.HIGH_BEAM;
      }

      this.obstacles.push(this.createObstacle(type, lane, z));
    }
  }

  createObstacle(type, lane, z) {
    const x = lane * LANE_WIDTH;
    const obs = {
      type,
      lane,
      x,
      z,
      animTime: Math.random() * 5,
      passed: false,
    };

    switch (type) {
      case OBSTACLE_TYPES.LOW_BARRIER:
        obs.width = 1.1;
        obs.minY = 0;
        obs.maxY = 0.65; // Jumpable (height < 0.65)
        obs.depth = 0.45;
        obs.color = '#ff9900';
        break;

      case OBSTACLE_TYPES.HIGH_BEAM:
        obs.width = 1.15;
        obs.minY = 0.55; // Slidable clearance (ducking player is ~0.38)
        obs.maxY = 1.85;
        obs.depth = 0.45;
        obs.color = '#00f3ff';
        break;

      case OBSTACLE_TYPES.CYBER_WALL:
      default:
        obs.width = 1.18;
        obs.minY = 0;
        obs.maxY = 2.4; // Impassable by jump or slide; requires lane dodge
        obs.depth = 0.5;
        obs.color = '#ff007f';
        break;
    }

    return obs;
  }

  checkCollision(player) {
    if (!player || player.isDead) return null;
    const pBox = player.getHitbox();

    for (const obs of this.obstacles) {
      // 1. Z-axis overlap check
      const obsMinZ = obs.z - obs.depth;
      const obsMaxZ = obs.z + obs.depth;
      if (pBox.maxZ < obsMinZ || pBox.minZ > obsMaxZ) {
        continue;
      }

      // 2. X-axis overlap check
      const obsMinX = obs.x - obs.width * 0.44;
      const obsMaxX = obs.x + obs.width * 0.44;
      if (pBox.maxX < obsMinX || pBox.minX > obsMaxX) {
        continue;
      }

      // 3. Y-axis overlap check (Jump/Slide height check)
      if (pBox.maxY > obs.minY && pBox.minY < obs.maxY) {
        return obs; // Collision confirmed
      }
    }

    return null;
  }

  render(ctx, projectFunc) {
    // Sort back-to-front so closer obstacles render on top
    const sorted = [...this.obstacles].sort((a, b) => b.z - a.z);

    for (const obs of sorted) {
      switch (obs.type) {
        case OBSTACLE_TYPES.LOW_BARRIER:
          this.renderLowBarrier(ctx, obs, projectFunc);
          break;
        case OBSTACLE_TYPES.HIGH_BEAM:
          this.renderHighBeam(ctx, obs, projectFunc);
          break;
        case OBSTACLE_TYPES.CYBER_WALL:
          this.renderCyberWall(ctx, obs, projectFunc);
          break;
      }
    }
  }

  renderLowBarrier(ctx, obs, projectFunc) {
    const bottomProj = projectFunc(obs.x, 0, obs.z);
    const topProj = projectFunc(obs.x, obs.maxY, obs.z);
    if (!bottomProj || bottomProj.scale <= 0) return;

    const s = bottomProj.scale;
    const w = 50 * s;
    const h = Math.max(12 * s, bottomProj.y - topProj.y);

    ctx.save();
    // Warning glow ground base
    ctx.fillStyle = 'rgba(255, 153, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(bottomProj.x, bottomProj.y, w * 0.6, 7 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Side pylons
    [-w * 0.45, w * 0.45].forEach(px => {
      ctx.fillStyle = '#1b1208';
      ctx.strokeStyle = '#ff9900';
      ctx.lineWidth = Math.max(1.5, 2 * s);
      ctx.beginPath();
      ctx.roundRect(bottomProj.x + px - 4 * s, bottomProj.y - h - 6 * s, 8 * s, h + 6 * s, 2 * s);
      ctx.fill();
      ctx.stroke();

      // Flashing top LED
      const flash = Math.sin(obs.animTime * 12) > 0;
      ctx.fillStyle = flash ? '#ffea00' : '#885500';
      ctx.shadowColor = '#ffea00';
      ctx.shadowBlur = flash ? 8 * s : 0;
      ctx.beginPath();
      ctx.arc(bottomProj.x + px, bottomProj.y - h - 8 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Center laser barrier bar with caution diagonal stripes
    const barY = bottomProj.y - h * 0.6;
    const barH = Math.max(8 * s, h * 0.5);

    ctx.fillStyle = '#ffaa00';
    ctx.shadowColor = '#ff9900';
    ctx.shadowBlur = 10 * s;
    ctx.fillRect(bottomProj.x - w * 0.42, barY, w * 0.84, barH);
    ctx.shadowBlur = 0;

    // Laser cross-sparks
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, 1.5 * s);
    ctx.beginPath();
    ctx.moveTo(bottomProj.x - w * 0.4, barY + barH * 0.5);
    ctx.lineTo(bottomProj.x + w * 0.4, barY + barH * 0.5);
    ctx.stroke();

    ctx.restore();
  }

  renderHighBeam(ctx, obs, projectFunc) {
    const bottomProj = projectFunc(obs.x, obs.minY, obs.z);
    const topProj = projectFunc(obs.x, obs.maxY, obs.z);
    const groundProj = projectFunc(obs.x, 0, obs.z);
    if (!bottomProj || bottomProj.scale <= 0) return;

    const s = bottomProj.scale;
    const w = 56 * s;

    ctx.save();
    // Warning laser shadow on the ground
    if (groundProj) {
      ctx.fillStyle = 'rgba(0, 243, 255, 0.25)';
      ctx.beginPath();
      ctx.ellipse(groundProj.x, groundProj.y, w * 0.55, 6 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tall vertical archway columns
    const archH = groundProj ? (groundProj.y - topProj.y) : 54 * s;
    [-w * 0.46, w * 0.46].forEach(px => {
      ctx.fillStyle = '#0a1020';
      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = Math.max(1.5, 2 * s);
      ctx.beginPath();
      ctx.roundRect(bottomProj.x + px - 4 * s, topProj.y - 4 * s, 8 * s, archH, 2 * s);
      ctx.fill();
      ctx.stroke();
    });

    // Top horizontal housing
    ctx.fillStyle = '#101c36';
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = Math.max(1.5, 2 * s);
    ctx.fillRect(bottomProj.x - w * 0.46, topProj.y - 8 * s, w * 0.92, 10 * s);

    // Glowing intense overhead laser beam (slide under this!)
    const beamPulse = 0.85 + Math.sin(obs.animTime * 18) * 0.15;
    const beamY = (bottomProj.y + topProj.y) * 0.5;
    const beamH = Math.max(7 * s, (bottomProj.y - topProj.y) * 0.65);

    const laserGrad = ctx.createLinearGradient(0, beamY - beamH * 0.5, 0, beamY + beamH * 0.5);
    laserGrad.addColorStop(0, 'rgba(0, 243, 255, 0.8)');
    laserGrad.addColorStop(0.5, '#ffffff');
    laserGrad.addColorStop(1, 'rgba(0, 243, 255, 0.8)');

    ctx.fillStyle = laserGrad;
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 14 * s * beamPulse;
    ctx.fillRect(bottomProj.x - w * 0.44, beamY - beamH * 0.5, w * 0.88, beamH);
    ctx.shadowBlur = 0;

    // Centered "▼ SLIDE ▼" warning indicator (placed cleanly inside beam bounds)
    if (s > 0.35) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(9, Math.floor(10 * s))}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('▼ SLIDE ▼', bottomProj.x, topProj.y - 10 * s);
    }

    ctx.restore();
  }

  renderCyberWall(ctx, obs, projectFunc) {
    const bottomProj = projectFunc(obs.x, 0, obs.z);
    const topProj = projectFunc(obs.x, obs.maxY, obs.z);
    if (!bottomProj || bottomProj.scale <= 0) return;

    const s = bottomProj.scale;
    const w = 48 * s;
    const h = Math.max(20 * s, bottomProj.y - topProj.y);

    ctx.save();
    // Ground glow
    ctx.fillStyle = 'rgba(255, 0, 127, 0.35)';
    ctx.beginPath();
    ctx.ellipse(bottomProj.x, bottomProj.y, w * 0.6, 9 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Solid Holo Monolith Body
    const wallGrad = ctx.createLinearGradient(0, topProj.y, 0, bottomProj.y);
    wallGrad.addColorStop(0, '#3a0026');
    wallGrad.addColorStop(0.5, '#190014');
    wallGrad.addColorStop(1, '#09000a');

    ctx.fillStyle = wallGrad;
    ctx.strokeStyle = '#ff007f';
    ctx.lineWidth = Math.max(1.5, 2.5 * s);
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 12 * s;

    ctx.beginPath();
    ctx.roundRect(bottomProj.x - w * 0.5, topProj.y, w, h, 4 * s);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Futuristic holographic grid lines inside the block
    ctx.strokeStyle = 'rgba(255, 0, 127, 0.5)';
    ctx.lineWidth = Math.max(1, 1 * s);
    const gridRows = 5;
    for (let r = 1; r < gridRows; r++) {
      const lineY = topProj.y + (h / gridRows) * r;
      ctx.beginPath();
      ctx.moveTo(bottomProj.x - w * 0.46, lineY);
      ctx.lineTo(bottomProj.x + w * 0.46, lineY);
      ctx.stroke();
    }

    // Danger / pulse core
    const corePulse = 1 + Math.sin(obs.animTime * 8) * 0.15;
    ctx.fillStyle = '#ff007f';
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 8 * s;
    ctx.beginPath();
    ctx.arc(bottomProj.x, topProj.y + h * 0.45, 7 * s * corePulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bottomProj.x, topProj.y + h * 0.45, 3.5 * s * corePulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
  }
}
