/**
 * Player: Controls the player character, movement physics, lane transitions,
 * jump/slide states, hitboxes, and original cyberpunk canvas rendering.
 */
export const LANE_WIDTH = 1.35;
export const PLAYER_Z = 7.0; // Distance ahead of camera in world units
export const JUMP_VELOCITY = 7.5; // Initial upward velocity in world units/s
export const GRAVITY = -18.75; // World units/s^2 (Duration: exactly 0.80s, Peak: 1.50m)

export class Player {
  constructor() {
    this.lane = 0; // -1: Left, 0: Center, 1: Right
    this.targetX = 0;
    this.x = 0;
    this.y = 0; // Height above road plane (0 = ground contact)
    this.z = PLAYER_Z;

    // Movement physics
    this.laneSpeed = 16.0;
    this.jumpVelocity = JUMP_VELOCITY;
    this.gravity = GRAVITY;
    this.vy = 0;

    // States
    this.isJumping = false;
    this.isSliding = false;
    this.slideTimer = 0;
    this.slideDuration = 0.68; // seconds
    this.rollAngle = 0; // Tilt during lane shift

    // Running animation cycle
    this.animTimer = 0;
    this.isDead = false;

    // Power-up states
    this.hasShield = false;
    this.shieldTimer = 0;
    this.hasMagnet = false;
    this.magnetTimer = 0;
  }

  reset() {
    this.lane = 0;
    this.targetX = 0;
    this.x = 0;
    this.y = 0;
    this.z = PLAYER_Z;
    this.vy = 0;
    this.isJumping = false;
    this.isSliding = false;
    this.slideTimer = 0;
    this.rollAngle = 0;
    this.animTimer = 0;
    this.isDead = false;
    this.hasShield = false;
    this.shieldTimer = 0;
    this.hasMagnet = false;
    this.magnetTimer = 0;
  }

  moveLeft() {
    if (this.isDead) return;
    if (this.lane > -1) {
      this.lane -= 1;
      this.targetX = this.lane * LANE_WIDTH;
    }
  }

  moveRight() {
    if (this.isDead) return;
    if (this.lane < 1) {
      this.lane += 1;
      this.targetX = this.lane * LANE_WIDTH;
    }
  }

  jump() {
    if (this.isDead) return false;
    // Jump initiates immediately if player is grounded (or landing tolerance)
    if (!this.isJumping && this.y <= 0.05) {
      this.isJumping = true;
      this.vy = this.jumpVelocity;
      this.isSliding = false; // Cancel slide when jumping
      this.slideTimer = 0;
      return true;
    }
    return false;
  }

  slide() {
    if (this.isDead) return false;
    if (this.isJumping) {
      // Fast fall slam dive when airborne
      this.vy = -16.0;
      this.isSliding = true;
      this.slideTimer = this.slideDuration;
      return true;
    }
    if (!this.isSliding) {
      this.isSliding = true;
      this.slideTimer = this.slideDuration;
      return true;
    }
    return false;
  }

  update(dt, particleSystem) {
    if (this.isDead) return;

    this.animTimer += dt;

    // Power-up timers
    if (this.shieldTimer > 0) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.hasShield = false;
        this.shieldTimer = 0;
      }
    }
    if (this.magnetTimer > 0) {
      this.magnetTimer -= dt;
      if (this.magnetTimer <= 0) {
        this.hasMagnet = false;
        this.magnetTimer = 0;
      }
    }

    // Horizontal lane smoothing (lerp / exponential approach)
    const dx = this.targetX - this.x;
    const moveStep = this.laneSpeed * dt;
    if (Math.abs(dx) <= moveStep) {
      this.x = this.targetX;
    } else {
      this.x += Math.sign(dx) * moveStep;
    }

    // Dynamic roll/lean banking angle when shifting lanes
    const targetRoll = dx * -0.22;
    this.rollAngle += (targetRoll - this.rollAngle) * Math.min(1, dt * 18);

    // Jump physics integration (Midpoint integration for exact trajectory)
    if (this.isJumping || this.y > 0) {
      const avgVy = this.vy + 0.5 * this.gravity * dt;
      this.y += avgVy * dt;
      this.vy += this.gravity * dt;

      // Ground landing collision
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.isJumping = false;
      }
    }

    // Slide timer
    if (this.isSliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
        this.slideTimer = 0;
      }
    }

    // Thruster exhaust particles
    if (particleSystem) {
      particleSystem.createThrusterTrail(this.x, this.y, this.z, this.isSliding);
    }
  }

  activateShield(duration = 8) {
    this.hasShield = true;
    this.shieldTimer = duration;
  }

  activateMagnet(duration = 10) {
    this.hasMagnet = true;
    this.magnetTimer = duration;
  }

  /**
   * Get 3D world bounding box for obstacle and entity collisions.
   */
  getHitbox() {
    const halfWidth = 0.35;
    const depth = 0.40;
    let height = 1.15;
    let bottom = this.y;

    if (this.isSliding) {
      height = 0.38; // Crouch hitbox height
      bottom = this.y;
    }

    return {
      minX: this.x - halfWidth,
      maxX: this.x + halfWidth,
      minY: bottom,
      maxY: bottom + height,
      minZ: this.z - depth,
      maxZ: this.z + depth,
      isSliding: this.isSliding,
      isJumping: this.isJumping,
    };
  }

  /**
   * Evaluates if a collectible sphere in world space intersects the player.
   * Accounts for full body height, lane width, and jump altitude.
   */
  canCollectItem(itemX, itemY, itemZ, itemRadius, speed, dt) {
    // 1. Longitudinal (Z) Proximity Check with speed sweeping to prevent tunneling
    const dz = Math.abs(itemZ - this.z);
    // Swept margin accounts for movement per frame + item radius + player depth
    const zMargin = Math.max(0.65, (speed * dt * 0.7) + itemRadius + 0.35);
    if (dz > zMargin) {
      return false;
    }

    // 2. Lateral (X / Lane) Proximity Check
    const dx = Math.abs(itemX - this.x);
    if (dx > (0.42 + itemRadius)) {
      return false;
    }

    // 3. Vertical (Y / Height) Reach Check
    // Player's body extends from this.y (feet) to this.y + height (head).
    // Reach window includes hands/feet extension (+- 0.35m tolerance)
    const playerHeight = this.isSliding ? 0.45 : 1.20;
    const reachBottom = this.y - 0.25;
    const reachTop = this.y + playerHeight + 0.35;

    return itemY >= reachBottom && itemY <= reachTop;
  }

  render(ctx, projectFunc) {
    if (this.isDead) return;

    // Ground shadow projection (projected at road level y = 0)
    const groundProj = projectFunc(this.x, 0, this.z);
    if (groundProj && groundProj.scale > 0) {
      ctx.save();
      const shadowScale = Math.max(0.25, 1 - this.y * 0.45) * groundProj.scale;
      ctx.fillStyle = 'rgba(0, 5, 20, 0.75)';
      ctx.beginPath();
      ctx.ellipse(groundProj.x, groundProj.y, 34 * shadowScale, 9 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Soft neon ground reflection
      const glowGrad = ctx.createRadialGradient(
        groundProj.x, groundProj.y, 2 * shadowScale,
        groundProj.x, groundProj.y, 38 * shadowScale
      );
      glowGrad.addColorStop(0, 'rgba(0, 243, 255, 0.4)');
      glowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.ellipse(groundProj.x, groundProj.y, 40 * shadowScale, 12 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Player body projection
    const proj = projectFunc(this.x, this.y, this.z);
    if (!proj || proj.scale <= 0) return;

    ctx.save();
    ctx.translate(proj.x, proj.y);
    ctx.scale(proj.scale, proj.scale);
    ctx.rotate(this.rollAngle);

    // Running bobbing offset
    const bobY = this.isJumping || this.isSliding ? 0 : Math.sin(this.animTimer * 16) * 3;

    if (this.isSliding) {
      this.renderSlidingBody(ctx);
    } else {
      this.renderRunningBody(ctx, bobY);
    }

    // Holographic Shield Dome (if active)
    if (this.hasShield) {
      this.renderShieldDome(ctx);
    }

    // Magnet Aura (if active)
    if (this.hasMagnet) {
      this.renderMagnetAura(ctx);
    }

    ctx.restore();
  }

  renderRunningBody(ctx, bobY) {
    // Offset so feet touch the ground plane (proj.y)
    ctx.translate(0, -32 + bobY);

    // 1. Dual Jet Thrusters (Left & Right)
    const thrusterY = 16;
    [-18, 18].forEach(tx => {
      // Thruster casing
      ctx.fillStyle = '#0f0a26';
      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(tx - 6, thrusterY - 14, 12, 22, 3);
      ctx.fill();
      ctx.stroke();

      // Thruster flame cone
      const flameLength = 16 + Math.random() * 8;
      const flameGrad = ctx.createLinearGradient(tx, thrusterY + 8, tx, thrusterY + 8 + flameLength);
      flameGrad.addColorStop(0, '#ffffff');
      flameGrad.addColorStop(0.3, '#00f3ff');
      flameGrad.addColorStop(0.8, '#ff007f');
      flameGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(tx - 4, thrusterY + 8);
      ctx.lineTo(tx, thrusterY + 8 + flameLength);
      ctx.lineTo(tx + 4, thrusterY + 8);
      ctx.closePath();
      ctx.fill();
    });

    // 2. Cyber Core / Torso Chassis
    ctx.fillStyle = '#161138';
    ctx.strokeStyle = '#9d00ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-16, -24);
    ctx.lineTo(16, -24);
    ctx.lineTo(12, 14);
    ctx.lineTo(-12, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Central neon power conduit
    ctx.fillStyle = '#00f3ff';
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(4, -4);
    ctx.lineTo(0, 10);
    ctx.lineTo(-4, -4);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // 3. Cyber Helmet / Head
    ctx.fillStyle = '#0b0820';
    ctx.strokeStyle = '#ff007f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -38, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glowing Neon Visor
    const visorGrad = ctx.createLinearGradient(-10, -38, 10, -38);
    visorGrad.addColorStop(0, '#00f3ff');
    visorGrad.addColorStop(0.5, '#ffffff');
    visorGrad.addColorStop(1, '#00f3ff');

    ctx.fillStyle = visorGrad;
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.roundRect(-10, -41, 20, 6, 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Head antenna
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -51);
    ctx.lineTo(0, -56);
    ctx.stroke();

    // 4. Articulated Cyber Legs / Hover Skids
    const legPhase = Math.sin(this.animTimer * 16);
    const leftLegY = 14 + legPhase * 8;
    const rightLegY = 14 - legPhase * 8;

    [-9, 9].forEach((lx, idx) => {
      const ly = idx === 0 ? leftLegY : rightLegY;
      ctx.fillStyle = '#0a081c';
      ctx.strokeStyle = '#ff007f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(lx - 4, ly, 8, 20, 2);
      ctx.fill();
      ctx.stroke();

      // Neon shoe skid
      ctx.fillStyle = '#00f3ff';
      ctx.shadowColor = '#00f3ff';
      ctx.shadowBlur = 8;
      ctx.fillRect(lx - 5, ly + 18, 10, 4);
      ctx.shadowBlur = 0;
    });
  }

  renderSlidingBody(ctx) {
    // Low hover / ducking dash posture
    ctx.translate(0, -14);

    // Glowing slide friction blast
    const frictionGrad = ctx.createRadialGradient(0, 8, 2, 0, 8, 36);
    frictionGrad.addColorStop(0, 'rgba(255, 0, 127, 0.8)');
    frictionGrad.addColorStop(0.6, 'rgba(0, 243, 255, 0.4)');
    frictionGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = frictionGrad;
    ctx.beginPath();
    ctx.ellipse(0, 10, 42, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Streamlined low cyber chassis
    ctx.fillStyle = '#140e2c';
    ctx.strokeStyle = '#ff007f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-28, -6, 56, 16, 6);
    ctx.fill();
    ctx.stroke();

    // Streamlined low cyber visor
    ctx.fillStyle = '#00f3ff';
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.roundRect(-18, -3, 36, 6, 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Dual exhaust jet fire
    [-22, 22].forEach(tx => {
      ctx.fillStyle = '#00f3ff';
      ctx.beginPath();
      ctx.moveTo(tx - 3, -6);
      ctx.lineTo(tx, -18 - Math.random() * 8);
      ctx.lineTo(tx + 3, -6);
      ctx.closePath();
      ctx.fill();
    });
  }

  renderShieldDome(ctx) {
    const pulse = 1 + Math.sin(this.animTimer * 10) * 0.08;
    const shieldRadius = 48 * pulse;

    ctx.save();
    ctx.strokeStyle = '#00f3ff';
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 16;
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.arc(0, -28, shieldRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Hexagonal circuit nodes
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + this.animTimer * 1.5;
      const hx = Math.cos(angle) * shieldRadius;
      const hy = -28 + Math.sin(angle) * shieldRadius;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(hx, hy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  renderMagnetAura(ctx) {
    const radius = 38 + Math.sin(this.animTimer * 12) * 5;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 230, 0, 0.7)';
    ctx.shadowColor = '#ffe600';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -this.animTimer * 20;

    ctx.beginPath();
    ctx.arc(0, -26, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
