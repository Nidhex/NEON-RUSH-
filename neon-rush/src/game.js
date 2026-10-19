/**
 * Game: Core engine handling the game loop, 3D perspective projection,
 * procedural cyberpunk city environment, state transitions, scoring, and rendering.
 */
import { Player, LANE_WIDTH, PLAYER_Z } from './player.js';
import { ObstacleManager } from './obstacles.js';
import { CollectibleManager, ITEM_TYPES } from './collectibles.js';
import { ParticleSystem } from './particles.js';

export const GAME_STATES = {
  MENU: 'MENU',
  READY: 'READY',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAMEOVER: 'GAMEOVER',
};

export class Game {
  constructor(canvas, audioManager, storageManager) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audio = audioManager;
    this.storage = storageManager;

    this.width = canvas.width || 800;
    this.height = canvas.height || 600;

    this.state = GAME_STATES.MENU;
    this.fixedStep = 1 / 60; // 60 FPS deterministic physics step

    // Subsystems
    this.player = new Player();
    this.obstacles = new ObstacleManager();
    this.collectibles = new CollectibleManager();
    this.particles = new ParticleSystem(350);

    // Gameplay stats
    this.score = 0;
    this.distance = 0; // In meters
    this.coins = 0;
    this.scoreMultiplier = 1;
    this.multiplierTimer = 0;
    this.highScore = this.storage.getHighScore();
    this.isNewHighScore = false;

    // Movement & Difficulty
    this.baseSpeed = 24.0;
    this.speed = this.baseSpeed;
    this.roadOffset = 0;
    this.gameTime = 0;

    // Camera & Screen Shake
    this.cameraShake = 0;
    this.shakeIntensity = 0;

    // City skyline procedural elements
    this.buildings = this.generateCitySkyline(this.width);

    // Callbacks for UI updates
    this.onStateChange = null;
    this.onStatsUpdate = null;

    // Projection function binding
    this.project = this.project.bind(this);
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.buildings = this.generateCitySkyline(w);
  }

  generateCitySkyline(w) {
    const list = [];
    const span = Math.max(1400, w * 1.5);
    const count = Math.ceil(span / 36);
    const startX = -span * 0.5;

    for (let i = 0; i < count; i++) {
      const bw = 28 + Math.random() * 42;
      const bh = 60 + Math.random() * 160;
      const bx = startX + i * 36 + (Math.random() - 0.5) * 12;
      const colorType = Math.random();
      let color = '#0d0924';
      let trimColor = '#00f3ff';
      if (colorType < 0.35) {
        color = '#120b2d';
        trimColor = '#ff007f';
      } else if (colorType < 0.7) {
        color = '#0a0a20';
        trimColor = '#9d00ff';
      }
      list.push({ x: bx, w: bw, h: bh, color, trimColor });
    }
    return list;
  }

  start() {
    this.player.reset();
    this.obstacles.reset();
    this.collectibles.reset();
    this.particles.reset();

    this.score = 0;
    this.distance = 0;
    this.coins = 0;
    this.scoreMultiplier = 1;
    this.multiplierTimer = 0;
    this.speed = this.baseSpeed;
    this.roadOffset = 0;
    this.gameTime = 0;
    this.isNewHighScore = false;
    this.highScore = this.storage.getHighScore();

    this.setState(GAME_STATES.PLAYING);
    this.audio.startMusic();
  }

  pause() {
    if (this.state === GAME_STATES.PLAYING) {
      this.setState(GAME_STATES.PAUSED);
      this.audio.stopMusic();
    }
  }

  resume() {
    if (this.state === GAME_STATES.PAUSED) {
      this.setState(GAME_STATES.PLAYING);
      this.audio.startMusic();
    }
  }

  togglePause() {
    if (this.state === GAME_STATES.PLAYING) {
      this.pause();
    } else if (this.state === GAME_STATES.PAUSED) {
      this.resume();
    }
  }

  setState(newState) {
    this.state = newState;
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }

  handleAction(action) {
    if (this.state === GAME_STATES.PLAYING) {
      switch (action) {
        case 'left':
          this.player.moveLeft();
          this.audio.playSlide();
          break;
        case 'right':
          this.player.moveRight();
          this.audio.playSlide();
          break;
        case 'jump':
          if (this.player.jump()) {
            this.audio.playJump();
          }
          break;
        case 'slide':
          if (this.player.slide()) {
            this.audio.playSlide();
          }
          break;
        case 'pause':
          this.togglePause();
          break;
      }
    } else if (this.state === GAME_STATES.PAUSED && action === 'pause') {
      this.resume();
    }
  }

  triggerScreenShake(amount = 14) {
    this.cameraShake = 0.45;
    this.shakeIntensity = amount;
  }

  /**
   * 3D to 2D Perspective Projection
   * Converts world (x, y, z) to canvas screen space (x, y, scale).
   */
  project(x, y, z) {
    const w = this.width;
    const h = this.height;
    const horizonY = h * 0.38;
    const cameraHeight = 2.4;
    const zOffset = 3.2; // Camera distance behind z=0
    const depth = z + zOffset;

    // Discard objects behind or too close to near plane
    if (depth <= 0.2) return null;

    // Focal length scales with viewport height for consistent perspective
    const focal = h * 1.35;
    const projScale = focal / depth;

    // Responsive road spread adapting cleanly between mobile portrait & wide desktop
    const roadSpread = Math.min(1.15, Math.max(0.75, w / 750));
    const screenX = w * 0.5 + (x * projScale * roadSpread * 0.82);
    const screenY = horizonY + (cameraHeight - y) * projScale;

    // Relative scale normalized so objects at player distance (PLAYER_Z = 7.0) have scale = 1.0
    const playerDepth = PLAYER_Z + zOffset;
    const relScale = playerDepth / depth;

    return { x: screenX, y: screenY, scale: relScale, depth };
  }

  update(dt) {
    if (this.state !== GAME_STATES.PLAYING) return;

    this.gameTime += dt;

    // Gradual speed progression
    const speedIncrease = Math.min(26, Math.sqrt(this.distance) * 0.72);
    this.speed = this.baseSpeed + speedIncrease;
    this.audio.setSpeed(1.0 + (this.speed - this.baseSpeed) * 0.015);

    // Update difficulty
    const diff = 1.0 + Math.min(1.5, this.distance / 600);
    this.obstacles.setDifficulty(diff);

    // Distance progression
    const distDelta = (this.speed * dt) * 0.9;
    this.distance += distDelta;
    this.roadOffset = (this.roadOffset + this.speed * dt) % 6;

    // Score calculation
    this.score += Math.floor(distDelta * 2 * this.scoreMultiplier);

    // Multiplier timer
    if (this.multiplierTimer > 0) {
      this.multiplierTimer -= dt;
      if (this.multiplierTimer <= 0) {
        this.scoreMultiplier = 1;
        this.multiplierTimer = 0;
      }
    }

    // Screen shake decay
    if (this.cameraShake > 0) {
      this.cameraShake -= dt;
      if (this.cameraShake < 0) this.cameraShake = 0;
    }

    // Subsystems update
    this.player.update(dt, this.particles);
    this.obstacles.update(dt, this.speed);

    const collectedItems = this.collectibles.update(dt, this.speed, this.player);
    for (const item of collectedItems) {
      if (item.type === ITEM_TYPES.COIN) {
        this.coins += 1;
        this.score += 50 * this.scoreMultiplier;
        this.audio.playCoin();
        this.particles.createCoinBurst(item.x, item.y, item.z);
      } else if (item.type === ITEM_TYPES.SHIELD) {
        this.player.activateShield(8);
        this.audio.playPowerup();
        this.particles.createCoinBurst(item.x, item.y, item.z);
      } else if (item.type === ITEM_TYPES.MAGNET) {
        this.player.activateMagnet(10);
        this.audio.playPowerup();
        this.particles.createCoinBurst(item.x, item.y, item.z);
      } else if (item.type === ITEM_TYPES.MULTIPLIER) {
        this.scoreMultiplier = 2;
        this.multiplierTimer = 10;
        this.audio.playPowerup();
        this.particles.createCoinBurst(item.x, item.y, item.z);
      }
    }

    this.particles.update(dt, this.speed);

    // Collision detection
    const hitObstacle = this.obstacles.checkCollision(this.player);
    if (hitObstacle) {
      if (this.player.hasShield) {
        // Shield absorbs the blow!
        this.player.hasShield = false;
        this.player.shieldTimer = 0;
        this.triggerScreenShake(8);
        this.audio.playHit();
        this.particles.createCrashExplosion(hitObstacle.x, 0.5, hitObstacle.z);
        // Remove collided obstacle so it doesn't immediately re-hit
        const idx = this.obstacles.obstacles.indexOf(hitObstacle);
        if (idx !== -1) this.obstacles.obstacles.splice(idx, 1);
      } else {
        // Lethal collision
        this.gameOver();
      }
    }

    // Live stats notification to UI
    if (this.onStatsUpdate) {
      this.onStatsUpdate({
        score: this.score,
        distance: Math.floor(this.distance),
        coins: this.coins,
        speed: Math.floor(this.speed * 3.6), // km/h arcade display
        multiplier: this.scoreMultiplier,
        shieldActive: this.player.hasShield,
        shieldTime: Math.ceil(this.player.shieldTimer),
        magnetActive: this.player.hasMagnet,
        magnetTime: Math.ceil(this.player.magnetTimer),
      });
    }
  }

  gameOver() {
    this.player.isDead = true;
    this.triggerScreenShake(18);
    this.audio.playHit();
    this.audio.stopMusic();
    this.particles.createCrashExplosion(this.player.x, this.player.y + 0.5, this.player.z);

    // Save records
    this.isNewHighScore = this.storage.saveHighScore(this.score);
    this.highScore = this.storage.getHighScore();
    this.storage.addCoins(this.coins);

    this.setState(GAME_STATES.GAMEOVER);
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.save();

    // Screen shake transform
    if (this.cameraShake > 0) {
      const intensity = this.shakeIntensity * (this.cameraShake / 0.45);
      const shakeX = (Math.random() - 0.5) * intensity;
      const shakeY = (Math.random() - 0.5) * intensity;
      ctx.translate(shakeX, shakeY);
    }

    // Clear background
    ctx.fillStyle = '#060312';
    ctx.fillRect(0, 0, w, h);

    // 1. Synthwave Sky & Horizon Sun
    this.renderSky(ctx, w, h);

    // 2. Cyberpunk Skyline spanning full viewport
    this.renderCitySkyline(ctx, w, h);

    // 3. Cyber Ground Grid outside road (eliminates empty black void)
    this.renderGround(ctx, w, h);

    // 4. Moving Highway & Roadside Lights
    this.renderRoad(ctx, w, h);

    // 5. Collectibles (Coins & Power-ups)
    this.collectibles.render(ctx, this.project);

    // 6. Obstacles
    this.obstacles.render(ctx, this.project);

    // 7. Player Character
    this.player.render(ctx, this.project);

    // 8. Dynamic Particle Layer
    this.particles.render(ctx, this.project);

    // 9. Speed Lines vignette when zooming fast
    if (this.speed > 30) {
      this.renderSpeedVignette(ctx, w, h);
    }

    ctx.restore();
  }

  renderSky(ctx, w, h) {
    const horizonY = h * 0.38;

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGrad.addColorStop(0, '#060314');
    skyGrad.addColorStop(0.5, '#12072b');
    skyGrad.addColorStop(0.85, '#2e0a45');
    skyGrad.addColorStop(1, '#ff007f');

    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, horizonY);

    // Glowing Synthwave Sun on horizon
    const sunRadius = Math.min(w * 0.16, 75);
    const sunX = w * 0.5;
    const sunY = horizonY - 10;

    const sunGrad = ctx.createLinearGradient(0, sunY - sunRadius, 0, sunY + sunRadius);
    sunGrad.addColorStop(0, '#ffe600');
    sunGrad.addColorStop(0.5, '#ff007f');
    sunGrad.addColorStop(1, '#9d00ff');

    ctx.save();
    ctx.fillStyle = sunGrad;
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 35;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fill();

    // Horizontal synthwave sun scanlines
    ctx.fillStyle = '#060314';
    for (let i = 0; i < 7; i++) {
      const lineH = 2 + i * 0.8;
      const lineY = sunY + sunRadius * 0.15 + i * (sunRadius * 0.12);
      if (lineY < horizonY) {
        ctx.fillRect(sunX - sunRadius, lineY, sunRadius * 2, lineH);
      }
    }
    ctx.restore();
  }

  renderCitySkyline(ctx, w, h) {
    const horizonY = h * 0.38;
    const centerX = w * 0.5;

    ctx.save();
    for (let i = 0; i < this.buildings.length; i++) {
      const b = this.buildings[i];
      const bx = centerX + b.x;
      const by = horizonY - b.h;

      // Discard buildings completely outside visible screen
      if (bx + b.w < 0 || bx > w) continue;

      // Dark futuristic skyscraper silhouette
      ctx.fillStyle = b.color;
      ctx.fillRect(bx, by, b.w, b.h);

      // Neon trim edge
      ctx.strokeStyle = b.trimColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(bx, horizonY);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + b.w, by);
      ctx.lineTo(bx + b.w, horizonY);
      ctx.stroke();

      // Lit cyberpunk window grids
      ctx.fillStyle = b.trimColor;
      const windowRows = Math.floor(b.h / 14);
      const windowCols = Math.floor(b.w / 12);
      for (let r = 1; r < windowRows - 1; r++) {
        for (let c = 1; c < windowCols; c++) {
          if ((i * 7 + r * 13 + c * 5) % 4 === 0) {
            ctx.fillRect(bx + c * 10, by + r * 12, 4, 6);
          }
        }
      }

      // Roof antenna with warning light
      if (i % 3 === 0) {
        const antennaX = bx + b.w * 0.5;
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(antennaX, by);
        ctx.lineTo(antennaX, by - 16);
        ctx.stroke();

        ctx.fillStyle = '#ff007f';
        ctx.beginPath();
        ctx.arc(antennaX, by - 16, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  renderGround(ctx, w, h) {
    const horizonY = h * 0.38;

    // Ground base gradient
    const groundGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    groundGrad.addColorStop(0, '#0a051d');
    groundGrad.addColorStop(0.6, '#080318');
    groundGrad.addColorStop(1, '#050210');

    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, horizonY, w, h - horizonY);

    // Glowing Cyber Grid Lines (synthwave ground grid outside road)
    ctx.save();
    ctx.strokeStyle = 'rgba(157, 0, 255, 0.16)';
    ctx.lineWidth = 1;

    // Perspective grid rays radiating outward from vanishing center
    const rays = 18;
    for (let i = -rays; i <= rays; i++) {
      if (Math.abs(i) < 4) continue; // Skip road area
      const angleOffset = i * (w / (rays * 1.5));
      ctx.beginPath();
      ctx.moveTo(w * 0.5 + angleOffset * 0.15, horizonY);
      ctx.lineTo(w * 0.5 + angleOffset * 2.2, h);
      ctx.stroke();
    }

    // Horizontal depth lines
    const depthSteps = 12;
    for (let d = 1; d <= depthSteps; d++) {
      const z = Math.pow(d / depthSteps, 2) * 90;
      const proj = this.project(0, 0, z);
      if (proj && proj.y > horizonY && proj.y < h) {
        ctx.beginPath();
        ctx.moveTo(0, proj.y);
        ctx.lineTo(w, proj.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  renderRoad(ctx, w, h) {
    const horizonY = h * 0.38;
    const maxZ = 120;
    const roadHalfWidth = 2.45; // World width

    // Road surface polygon (from horizon down past screen bottom)
    const pFarL = this.project(-roadHalfWidth, 0, maxZ);
    const pFarR = this.project(roadHalfWidth, 0, maxZ);
    const pNearL = this.project(-roadHalfWidth, 0, 1.2);
    const pNearR = this.project(roadHalfWidth, 0, 1.2);

    if (!pFarL || !pFarR || !pNearL || !pNearR) return;

    ctx.save();

    // Road asphalt fill
    const roadGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    roadGrad.addColorStop(0, '#0c071d');
    roadGrad.addColorStop(0.5, '#0e0926');
    roadGrad.addColorStop(1, '#160c38');

    ctx.fillStyle = roadGrad;
    ctx.beginPath();
    ctx.moveTo(pFarL.x, pFarL.y);
    ctx.lineTo(pFarR.x, pFarR.y);
    ctx.lineTo(pNearR.x, pNearR.y + 40);
    ctx.lineTo(pNearL.x, pNearL.y + 40);
    ctx.closePath();
    ctx.fill();

    // Road edge neon rails: Left Cyan, Right Magenta
    this.renderNeonRail(ctx, -roadHalfWidth, '#00f3ff');
    this.renderNeonRail(ctx, roadHalfWidth, '#ff007f');

    // Dashed Lane Dividers (between lane -1 & 0, and lane 0 & +1)
    const dividerOffsets = [-LANE_WIDTH * 0.5, LANE_WIDTH * 0.5];
    for (const divX of dividerOffsets) {
      this.renderLaneDivider(ctx, divX);
    }

    // Roadside light posts / beacons zooming past
    this.renderRoadsidePylons(ctx, roadHalfWidth * 1.25);

    ctx.restore();
  }

  renderNeonRail(ctx, railX, color) {
    const steps = 20;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 3;

    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const z = 1.2 + (i / steps) * 110;
      const proj = this.project(railX, 0.05, z);
      if (!proj) continue;
      if (i === 0) ctx.moveTo(proj.x, proj.y);
      else ctx.lineTo(proj.x, proj.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  renderLaneDivider(ctx, laneX) {
    const segmentLength = 6.0;
    const dashLength = 2.8;
    const maxZ = 110;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 243, 255, 0.75)';
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 6;

    for (let z = 1.2 - this.roadOffset; z < maxZ; z += segmentLength) {
      if (z + dashLength < 1.0) continue;

      const z1 = Math.max(1.2, z);
      const z2 = Math.min(maxZ, z + dashLength);
      const p1 = this.project(laneX, 0, z1);
      const p2 = this.project(laneX, 0, z2);

      if (p1 && p2 && p1.scale > 0 && p2.scale > 0) {
        const w1 = Math.max(1.5, 3.5 * p1.scale);
        const w2 = Math.max(1.5, 3.5 * p2.scale);

        ctx.beginPath();
        ctx.moveTo(p1.x - w1 * 0.5, p1.y);
        ctx.lineTo(p1.x + w1 * 0.5, p1.y);
        ctx.lineTo(p2.x + w2 * 0.5, p2.y);
        ctx.lineTo(p2.x - w2 * 0.5, p2.y);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  renderRoadsidePylons(ctx, pylonDist) {
    const spacing = 16.0;
    const maxZ = 100;

    for (let z = 2.0 + (spacing - (this.roadOffset * 2.5) % spacing); z < maxZ; z += spacing) {
      [-pylonDist, pylonDist].forEach((px, idx) => {
        const bottomProj = this.project(px, 0, z);
        const topProj = this.project(px, 2.2, z);

        if (bottomProj && topProj && bottomProj.scale > 0) {
          const s = bottomProj.scale;
          const color = idx === 0 ? '#00f3ff' : '#ff007f';

          // Vertical glowing light pole
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(1.5, 2.2 * s);
          ctx.beginPath();
          ctx.moveTo(bottomProj.x, bottomProj.y);
          ctx.lineTo(topProj.x, topProj.y);
          ctx.stroke();

          // Top beacon light
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = color;
          ctx.shadowBlur = 8 * s;
          ctx.beginPath();
          ctx.arc(topProj.x, topProj.y, Math.max(2, 3.5 * s), 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });
    }
  }

  renderSpeedVignette(ctx, w, h) {
    const intensity = Math.min(0.4, (this.speed - 30) * 0.02);
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.35, w * 0.5, h * 0.5, w * 0.7);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, `rgba(0, 243, 255, ${intensity})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}
