/**
 * Main: Application entry point.
 * Initializes core modules, manages responsive high-DPI canvas resizing,
 * handles tab visibility auto-pause, and drives the single requestAnimationFrame loop.
 */
import { StorageManager } from './storage.js';
import { AudioManager } from './audio.js';
import { InputHandler } from './input.js';
import { Game, GAME_STATES } from './game.js';
import { UIManager } from './ui.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) {
    console.error('Game canvas element not found!');
    return;
  }

  // 1. Initialize Subsystems
  const storage = new StorageManager();
  const audio = new AudioManager();
  const game = new Game(canvas, audio, storage);
  const input = new InputHandler(canvas);
  const ui = new UIManager(game, audio, storage);

  // Link game state updates to UI
  game.onStateChange = (state) => ui.handleStateChange(state);
  game.onStatsUpdate = (stats) => ui.updateStats(stats);

  // Connect user input actions to game logic
  input.onAction((action) => {
    // Resume audio context on first user interaction
    audio.ensureContext();
    game.handleAction(action);
  });

  // 2. Responsive Canvas Sizing with High-DPI Support
  function resizeCanvas() {
    const container = document.getElementById('game-container') || document.body;
    const rect = container.getBoundingClientRect();
    const width = Math.floor(rect.width) || window.innerWidth;
    const height = Math.floor(rect.height) || window.innerHeight;

    // Limit devicePixelRatio to 2 for optimal mobile GPU performance
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Notify game engine of logical CSS dimensions
    game.resize(width, height);

    // Trigger an immediate frame render if in menu or paused
    if (game.state !== GAME_STATES.PLAYING) {
      game.render();
    }
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // 3. Tab Visibility Change (Auto-Pause on Backgrounding)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (game.state === GAME_STATES.PLAYING) {
        game.pause();
      }
    }
  });

  // 4. Initial Audio Unlock Listener (Click/Tap on document)
  const unlockAudio = () => {
    audio.ensureContext();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });

  // 5. Main Game Loop with Fixed Timestep Accumulator
  let lastFrameTime = performance.now();
  const fixedDelta = 1 / 60; // 60 FPS
  let accumulator = 0;

  function gameLoop(now) {
    const deltaMs = now - lastFrameTime;
    lastFrameTime = now;

    // Clamp maximum frame delta to prevent spiral of death on tab switch or lag spike
    const dt = Math.min(deltaMs / 1000, 0.1);

    if (game.state === GAME_STATES.PLAYING) {
      accumulator += dt;
      while (accumulator >= fixedDelta) {
        game.update(fixedDelta);
        accumulator -= fixedDelta;
      }
    } else {
      accumulator = 0;
    }

    game.render();
    requestAnimationFrame(gameLoop);
  }

  // Initial draw and loop kick-off
  game.render();
  requestAnimationFrame(gameLoop);

  // Expose game instance for automated browser test suite
  window.__NEON_RUSH_GAME__ = game;
  window.__NEON_RUSH_AUDIO__ = audio;
  window.__NEON_RUSH_STORAGE__ = storage;
});
