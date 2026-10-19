/**
 * UIManager: Manages DOM overlays, HUD stats, menus, modals, accessibility,
 * and button sound interactions.
 */
import { GAME_STATES } from './game.js';

export class UIManager {
  constructor(game, audioManager, storageManager) {
    this.game = game;
    this.audio = audioManager;
    this.storage = storageManager;

    // Cache DOM Elements
    this.elMenu = document.getElementById('screen-menu');
    this.elHud = document.getElementById('screen-hud');
    this.elPause = document.getElementById('screen-pause');
    this.elGameOver = document.getElementById('screen-gameover');
    this.elSettingsModal = document.getElementById('modal-settings');
    this.elTestsModal = document.getElementById('modal-tests');

    // HUD Elements
    this.hudScore = document.getElementById('hud-score');
    this.hudDistance = document.getElementById('hud-distance');
    this.hudCoins = document.getElementById('hud-coins');
    this.hudSpeed = document.getElementById('hud-speed');
    this.hudMultiplier = document.getElementById('hud-multiplier');
    this.hudPowerups = document.getElementById('hud-powerups');
    this.btnHudPause = document.getElementById('btn-hud-pause');
    this.btnHudMute = document.getElementById('btn-hud-mute');

    // Menu Elements
    this.menuBestScore = document.getElementById('menu-best-score');
    this.menuTotalCoins = document.getElementById('menu-total-coins');
    this.btnPlay = document.getElementById('btn-play');
    this.btnSettings = document.getElementById('btn-settings');
    this.btnOpenTests = document.getElementById('btn-open-tests');

    // Pause Elements
    this.btnResume = document.getElementById('btn-resume');
    this.btnRestartPause = document.getElementById('btn-restart-pause');
    this.btnMutePause = document.getElementById('btn-mute-pause');

    // Game Over Elements
    this.goScore = document.getElementById('go-score');
    this.goBest = document.getElementById('go-best');
    this.goDistance = document.getElementById('go-distance');
    this.goCoins = document.getElementById('go-coins');
    this.goNewRecord = document.getElementById('go-new-record');
    this.btnPlayAgain = document.getElementById('btn-play-again');
    this.btnGoMenu = document.getElementById('btn-go-menu');

    // Mobile Virtual Controls
    this.virtualControls = document.getElementById('virtual-controls');
    this.btnTouchLeft = document.getElementById('btn-touch-left');
    this.btnTouchRight = document.getElementById('btn-touch-right');
    this.btnTouchJump = document.getElementById('btn-touch-jump');
    this.btnTouchSlide = document.getElementById('btn-touch-slide');

    // Settings Controls
    this.toggleMute = document.getElementById('setting-mute');
    this.rangeSfx = document.getElementById('setting-sfx');
    this.rangeMusic = document.getElementById('setting-music');
    this.toggleReducedMotion = document.getElementById('setting-reduced-motion');
    this.toggleTouchControls = document.getElementById('setting-touch-controls');
    this.btnCloseSettings = document.getElementById('btn-close-settings');

    // Bind UI events
    this.bindEvents();
    this.loadSettingsToUI();
    this.updateRecordDisplays();
  }

  bindEvents() {
    // Menu Buttons
    this.btnPlay.addEventListener('click', () => {
      this.audio.playClick();
      this.game.start();
    });

    this.btnSettings.addEventListener('click', () => {
      this.audio.playClick();
      this.openSettings();
    });

    if (this.btnOpenTests) {
      this.btnOpenTests.addEventListener('click', () => {
        this.audio.playClick();
        this.openTestsModal();
      });
    }

    // HUD Buttons
    this.btnHudPause.addEventListener('click', () => {
      this.audio.playClick();
      this.game.pause();
    });

    this.btnHudMute.addEventListener('click', () => {
      this.toggleMuteAudio();
    });

    // Pause Screen Buttons
    this.btnResume.addEventListener('click', () => {
      this.audio.playClick();
      this.game.resume();
    });

    this.btnRestartPause.addEventListener('click', () => {
      this.audio.playClick();
      this.game.start();
    });

    this.btnMutePause.addEventListener('click', () => {
      this.toggleMuteAudio();
    });

    // Game Over Buttons
    this.btnPlayAgain.addEventListener('click', () => {
      this.audio.playClick();
      this.game.start();
    });

    this.btnGoMenu.addEventListener('click', () => {
      this.audio.playClick();
      this.updateRecordDisplays();
      this.game.setState(GAME_STATES.MENU);
    });

    // Mobile Touch Virtual Buttons (support both touch and mouse clicks via pointerdown)
    const attachVirtualBtn = (btn, action) => {
      if (!btn) return;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.game.handleAction(action);
      });
    };

    attachVirtualBtn(this.btnTouchLeft, 'left');
    attachVirtualBtn(this.btnTouchRight, 'right');
    attachVirtualBtn(this.btnTouchJump, 'jump');
    attachVirtualBtn(this.btnTouchSlide, 'slide');

    // Settings Modal
    this.btnCloseSettings.addEventListener('click', () => {
      this.audio.playClick();
      this.closeSettings();
    });

    this.toggleMute.addEventListener('change', (e) => {
      const isMuted = e.target.checked;
      this.audio.setMuted(isMuted);
      this.saveCurrentSettings();
      this.updateMuteButtonsUI(isMuted);
    });

    this.rangeSfx.addEventListener('input', (e) => {
      const vol = parseFloat(e.target.value);
      this.audio.setVolumes(vol, this.audio.musicVolume);
      this.saveCurrentSettings();
    });

    this.rangeMusic.addEventListener('input', (e) => {
      const vol = parseFloat(e.target.value);
      this.audio.setVolumes(this.audio.sfxVolume, vol);
      this.saveCurrentSettings();
    });

    this.toggleReducedMotion.addEventListener('change', (e) => {
      document.body.classList.toggle('reduced-motion', e.target.checked);
      this.saveCurrentSettings();
    });

    this.toggleTouchControls.addEventListener('change', (e) => {
      const show = e.target.checked;
      if (this.virtualControls) {
        this.virtualControls.classList.toggle('active', show);
      }
      this.saveCurrentSettings();
    });

    // Auto-detect touch device
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      if (this.virtualControls) {
        this.virtualControls.classList.add('active');
      }
    }
  }

  toggleMuteAudio() {
    const isMuted = this.audio.toggleMute();
    this.saveCurrentSettings();
    this.updateMuteButtonsUI(isMuted);
    this.toggleMute.checked = isMuted;
  }

  updateMuteButtonsUI(isMuted) {
    const label = isMuted ? '🔇' : '🔊';
    this.btnHudMute.textContent = label;
    this.btnHudMute.setAttribute('aria-label', isMuted ? 'Unmute Sound' : 'Mute Sound');
    if (this.btnMutePause) {
      this.btnMutePause.textContent = isMuted ? 'Unmute Audio 🔇' : 'Mute Audio 🔊';
    }
  }

  updateRecordDisplays() {
    const high = this.storage.getHighScore();
    const totalCoins = this.storage.getTotalCoins();
    if (this.menuBestScore) this.menuBestScore.textContent = high.toLocaleString();
    if (this.menuTotalCoins) this.menuTotalCoins.textContent = totalCoins.toLocaleString();
  }

  updateStats(stats) {
    if (this.hudScore) this.hudScore.textContent = stats.score.toLocaleString();
    if (this.hudDistance) this.hudDistance.textContent = `${stats.distance}m`;
    if (this.hudCoins) this.hudCoins.textContent = stats.coins.toLocaleString();
    if (this.hudSpeed) this.hudSpeed.textContent = `${stats.speed} km/h`;

    if (this.hudMultiplier) {
      if (stats.multiplier > 1) {
        this.hudMultiplier.style.display = 'inline-flex';
        this.hudMultiplier.textContent = `${stats.multiplier}X`;
      } else {
        this.hudMultiplier.style.display = 'none';
      }
    }

    // Power-up status indicators
    if (this.hudPowerups) {
      let html = '';
      if (stats.shieldActive) {
        html += `<div class="powerup-badge shield">🛡️ SHIELD ${stats.shieldTime}s</div>`;
      }
      if (stats.magnetActive) {
        html += `<div class="powerup-badge magnet">🧲 MAGNET ${stats.magnetTime}s</div>`;
      }
      this.hudPowerups.innerHTML = html;
    }
  }

  handleStateChange(state) {
    this.elMenu.classList.remove('active');
    this.elHud.classList.remove('active');
    this.elPause.classList.remove('active');
    this.elGameOver.classList.remove('active');

    switch (state) {
      case GAME_STATES.MENU:
        this.updateRecordDisplays();
        this.elMenu.classList.add('active');
        break;

      case GAME_STATES.PLAYING:
        this.elHud.classList.add('active');
        break;

      case GAME_STATES.PAUSED:
        this.elHud.classList.add('active');
        this.elPause.classList.add('active');
        break;

      case GAME_STATES.GAMEOVER:
        this.elGameOver.classList.add('active');
        this.goScore.textContent = this.game.score.toLocaleString();
        this.goBest.textContent = this.game.highScore.toLocaleString();
        this.goDistance.textContent = `${Math.floor(this.game.distance)}m`;
        this.goCoins.textContent = this.game.coins.toLocaleString();

        if (this.game.isNewHighScore) {
          this.goNewRecord.style.display = 'block';
        } else {
          this.goNewRecord.style.display = 'none';
        }
        break;
    }
  }

  openSettings() {
    this.loadSettingsToUI();
    this.elSettingsModal.classList.add('active');
  }

  closeSettings() {
    this.elSettingsModal.classList.remove('active');
  }

  openTestsModal() {
    if (this.elTestsModal) {
      this.elTestsModal.classList.add('active');
      const runBtn = document.getElementById('btn-run-tests');
      if (runBtn) runBtn.focus();
    }
  }

  loadSettingsToUI() {
    const s = this.storage.getSettings();
    this.toggleMute.checked = s.muted;
    this.rangeSfx.value = s.sfxVolume;
    this.rangeMusic.value = s.musicVolume;
    this.toggleReducedMotion.checked = s.reducedMotion;
    this.toggleTouchControls.checked = s.showTouchControls;

    this.audio.setMuted(s.muted);
    this.audio.setVolumes(s.sfxVolume, s.musicVolume);
    this.updateMuteButtonsUI(s.muted);

    if (s.reducedMotion) {
      document.body.classList.add('reduced-motion');
    }
    if (s.showTouchControls && this.virtualControls) {
      this.virtualControls.classList.add('active');
    }
  }

  saveCurrentSettings() {
    const s = {
      muted: this.toggleMute.checked,
      sfxVolume: parseFloat(this.rangeSfx.value),
      musicVolume: parseFloat(this.rangeMusic.value),
      reducedMotion: this.toggleReducedMotion.checked,
      showTouchControls: this.toggleTouchControls.checked,
    };
    this.storage.saveSettings(s);
  }
}
