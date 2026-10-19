/**
 * CollectibleManager: Spawns and manages neon cyber-coins and game-changing power-ups.
 * Includes linear coin runs, jump arcs, and coin magnet suction physics.
 */
import { LANE_WIDTH } from './player.js';

export const ITEM_TYPES = {
  COIN: 'COIN',
  SHIELD: 'SHIELD',
  MAGNET: 'MAGNET',
  MULTIPLIER: 'MULTIPLIER',
};

export class CollectibleManager {
  constructor() {
    this.items = [];
    this.spawnDistance = 110;
    this.despawnDistance = -3;
    this.nextSpawnZ = 22; // Immediate coins right at run start
    this.powerupCooldownZ = 90;
    this.autoSpawn = true;
    this.currentPatternIndex = 0;
  }

  reset() {
    this.items = [];
    this.nextSpawnZ = 22;
    this.powerupCooldownZ = 90;
    this.autoSpawn = true;
    this.currentPatternIndex = 0;
  }

  update(dt, speed, player) {
    const collected = [];

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.z -= speed * dt;
      item.animTime += dt;

      // Magnet attraction physics
      if (player && player.hasMagnet && item.type === ITEM_TYPES.COIN && item.z > 0 && item.z < 30) {
        const dx = player.x - item.x;
        const dy = (player.y + 0.6) - item.y;
        const dz = player.z - item.z;
        const dist = Math.hypot(dx, dy, dz);

        if (dist > 0.05) {
          const magnetSpeed = 28.0;
          item.x += (dx / dist) * magnetSpeed * dt;
          item.y += (dy / dist) * magnetSpeed * dt;
          item.z += (dz / dist) * magnetSpeed * dt;
        }
      }

      // Check collision with player
      if (player && !player.isDead && this.checkItemCollision(item, player, speed, dt)) {
        collected.push(item);
        this.items.splice(i, 1);
        continue;
      }

      // Despawn behind camera
      if (item.z < this.despawnDistance) {
        this.items.splice(i, 1);
      }
    }

    // Spawn new items if needed
    if (this.autoSpawn) {
      const farthestZ = this.getFarthestZ();
      if (farthestZ < this.spawnDistance) {
        this.spawnPattern(Math.max(farthestZ + 12, this.nextSpawnZ));
      }
    }

    return collected;
  }

  getFarthestZ() {
    if (this.items.length === 0) return 0;
    let maxZ = 0;
    for (const item of this.items) {
      if (item.z > maxZ) maxZ = item.z;
    }
    return maxZ;
  }

  spawnPattern(startZ) {
    const lane = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
    const x = lane * LANE_WIDTH;
    this.currentPatternIndex++;

    // Occasional Power-up spawn
    if (startZ > this.powerupCooldownZ && Math.random() < 0.22) {
      const pTypes = [ITEM_TYPES.SHIELD, ITEM_TYPES.MAGNET, ITEM_TYPES.MULTIPLIER];
      const pType = pTypes[Math.floor(Math.random() * pTypes.length)];
      this.items.push({
        type: pType,
        lane,
        x,
        y: 0.60,
        z: startZ + 5,
        radius: 0.50,
        animTime: Math.random() * 5,
      });
      this.powerupCooldownZ = startZ + 160; // Space between power-ups
      this.nextSpawnZ = startZ + 18;
      return;
    }

    // Alternate between ground runs and elevated jump arcs
    const isJumpArc = this.currentPatternIndex % 2 === 0;

    if (!isJumpArc) {
      // 1. Straight line of 5 ground coins (collectible by normal running)
      const count = 5;
      for (let i = 0; i < count; i++) {
        this.items.push({
          type: ITEM_TYPES.COIN,
          lane,
          x,
          y: 0.30,
          z: startZ + i * 3.2,
          radius: 0.38,
          animTime: i * 0.2,
        });
      }
      this.nextSpawnZ = startZ + count * 3.2 + 8;
    } else {
      // 2. Parabolic Jump Arc of 5 coins (requires player jump)
      // Heights: 0.30m -> 1.05m -> 1.70m (apex) -> 1.05m -> 0.30m
      const count = 5;
      const coinSpacing = 3.8; // Total arc length = 4 * 3.8 = 15.2m (matches 0.8s jump at ~24-26 m/s)
      for (let i = 0; i < count; i++) {
        const progress = i / (count - 1);
        // Sine curve for smooth jump arc
        const arcY = 0.30 + 1.40 * Math.sin(progress * Math.PI);

        this.items.push({
          type: ITEM_TYPES.COIN,
          lane,
          x,
          y: arcY,
          z: startZ + i * coinSpacing,
          radius: 0.38,
          animTime: i * 0.2,
        });
      }
      this.nextSpawnZ = startZ + count * coinSpacing + 10;
    }
  }

  checkItemCollision(item, player, speed = 24, dt = 0.016) {
    if (typeof player.canCollectItem === 'function') {
      return player.canCollectItem(item.x, item.y, item.z, item.radius, speed, dt);
    }

    // Fallback standard 3D AABB overlap
    const pBox = player.getHitbox();
    const itemZ = item.z;
    const itemX = item.x;
    const itemY = item.y;
    const r = item.radius;

    const zOverlap = pBox.maxZ >= itemZ - r && pBox.minZ <= itemZ + r;
    const xOverlap = pBox.maxX >= itemX - r && pBox.minX <= itemX + r;
    const yOverlap = pBox.maxY >= itemY - r && pBox.minY <= itemY + r;

    return zOverlap && xOverlap && yOverlap;
  }

  render(ctx, projectFunc) {
    // Sort back to front
    const sorted = [...this.items].sort((a, b) => b.z - a.z);

    for (const item of sorted) {
      if (item.type === ITEM_TYPES.COIN) {
        this.renderCoin(ctx, item, projectFunc);
      } else {
        this.renderPowerup(ctx, item, projectFunc);
      }
    }
  }

  renderCoin(ctx, coin, projectFunc) {
    const proj = projectFunc(coin.x, coin.y, coin.z);
    if (!proj || proj.scale <= 0) return;

    const s = proj.scale;
    const rad = 14 * s;
    const rot = coin.animTime * 4.5;
    const scaleX = Math.cos(rot); // 3D spin effect

    ctx.save();
    ctx.translate(proj.x, proj.y);

    // Glowing halo
    const glowGrad = ctx.createRadialGradient(0, 0, rad * 0.4, 0, 0, rad * 2.2);
    glowGrad.addColorStop(0, 'rgba(255, 230, 0, 0.55)');
    glowGrad.addColorStop(0.6, 'rgba(255, 170, 0, 0.2)');
    glowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(0, 0, rad * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Rotating 3D Cyber Coin body
    ctx.scale(scaleX, 1);

    const coinGrad = ctx.createLinearGradient(-rad, -rad, rad, rad);
    coinGrad.addColorStop(0, '#fff688');
    coinGrad.addColorStop(0.5, '#ffe600');
    coinGrad.addColorStop(1, '#ff9900');

    ctx.fillStyle = coinGrad;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, 2 * s);
    ctx.shadowColor = '#ffe600';
    ctx.shadowBlur = 8 * s;

    // Hexagonal / Diamond Token
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const hx = Math.cos(angle) * rad;
      const hy = Math.sin(angle) * rad;
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner embossed core
    ctx.fillStyle = '#100a20';
    ctx.beginPath();
    ctx.arc(0, 0, rad * 0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#00f3ff';
    ctx.beginPath();
    ctx.arc(0, 0, rad * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  renderPowerup(ctx, item, projectFunc) {
    const proj = projectFunc(item.x, item.y, item.z);
    if (!proj || proj.scale <= 0) return;

    const s = proj.scale;
    const rad = 20 * s;
    const floatY = Math.sin(item.animTime * 5) * 4 * s;

    ctx.save();
    ctx.translate(proj.x, proj.y + floatY);

    let color = '#00f3ff';
    let icon = '⚡';
    if (item.type === ITEM_TYPES.SHIELD) {
      color = '#00f3ff';
      icon = '🛡️';
    } else if (item.type === ITEM_TYPES.MAGNET) {
      color = '#ffea00';
      icon = '🧲';
    } else if (item.type === ITEM_TYPES.MULTIPLIER) {
      color = '#ff007f';
      icon = '2X';
    }

    // Outer spinning beacon ring
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 * s;
    ctx.lineWidth = Math.max(1.5, 2.5 * s);
    ctx.setLineDash([8 * s, 6 * s]);
    ctx.lineDashOffset = item.animTime * 20;

    ctx.beginPath();
    ctx.arc(0, 0, rad * 1.25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Orb background
    ctx.fillStyle = '#120b29';
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fill();

    // Powerup Icon / Text
    ctx.font = `bold ${Math.floor(rad * 0.95)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(icon, 0, 1 * s);

    ctx.restore();
  }
}
