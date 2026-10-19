/**
 * StorageManager: Handles persistent local storage with graceful fallbacks
 * for environments where localStorage is blocked or throws security exceptions.
 */
export class StorageManager {
  constructor() {
    this.memoryFallback = new Map();
    this.isStorageAvailable = this.checkStorageAvailability();
  }

  checkStorageAvailability() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      const testKey = '__neon_rush_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  getItem(key, defaultValue = null) {
    try {
      if (this.isStorageAvailable) {
        const val = window.localStorage.getItem(key);
        return val !== null ? val : defaultValue;
      }
    } catch (e) {
      console.warn('Storage read warning:', e);
    }
    return this.memoryFallback.has(key) ? this.memoryFallback.get(key) : defaultValue;
  }

  setItem(key, value) {
    const stringVal = String(value);
    try {
      if (this.isStorageAvailable) {
        window.localStorage.setItem(key, stringVal);
      }
    } catch (e) {
      console.warn('Storage write warning:', e);
    }
    this.memoryFallback.set(key, stringVal);
  }

  getHighScore() {
    const val = parseInt(this.getItem('neon_rush_high_score', '0'), 10);
    return Number.isFinite(val) && val >= 0 ? val : 0;
  }

  saveHighScore(score) {
    const safeScore = Math.max(0, Math.floor(Number(score) || 0));
    const currentHigh = this.getHighScore();
    if (safeScore > currentHigh) {
      this.setItem('neon_rush_high_score', safeScore);
      return true; // New record
    }
    return false;
  }

  getTotalCoins() {
    const val = parseInt(this.getItem('neon_rush_total_coins', '0'), 10);
    return Number.isFinite(val) && val >= 0 ? val : 0;
  }

  addCoins(amount) {
    const add = Math.max(0, Math.floor(Number(amount) || 0));
    const current = this.getTotalCoins();
    const updated = current + add;
    this.setItem('neon_rush_total_coins', updated);
    return updated;
  }

  getSettings() {
    const defaultSettings = {
      muted: false,
      sfxVolume: 0.8,
      musicVolume: 0.5,
      reducedMotion: false,
      showTouchControls: false,
    };

    try {
      const raw = this.getItem('neon_rush_settings', null);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          muted: typeof parsed.muted === 'boolean' ? parsed.muted : defaultSettings.muted,
          sfxVolume: typeof parsed.sfxVolume === 'number' ? Math.max(0, Math.min(1, parsed.sfxVolume)) : defaultSettings.sfxVolume,
          musicVolume: typeof parsed.musicVolume === 'number' ? Math.max(0, Math.min(1, parsed.musicVolume)) : defaultSettings.musicVolume,
          reducedMotion: typeof parsed.reducedMotion === 'boolean' ? parsed.reducedMotion : defaultSettings.reducedMotion,
          showTouchControls: typeof parsed.showTouchControls === 'boolean' ? parsed.showTouchControls : defaultSettings.showTouchControls,
        };
      }
    } catch (e) {
      console.warn('Settings parse failed, using defaults:', e);
    }
    return defaultSettings;
  }

  saveSettings(settings) {
    try {
      const validated = { ...this.getSettings(), ...settings };
      this.setItem('neon_rush_settings', JSON.stringify(validated));
      return validated;
    } catch (e) {
      console.warn('Settings save failed:', e);
      return this.getSettings();
    }
  }

  resetAll() {
    try {
      if (this.isStorageAvailable) {
        window.localStorage.removeItem('neon_rush_high_score');
        window.localStorage.removeItem('neon_rush_total_coins');
        window.localStorage.removeItem('neon_rush_settings');
      }
    } catch {
      // ignore
    }
    this.memoryFallback.clear();
  }
}
