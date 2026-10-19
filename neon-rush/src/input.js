/**
 * InputHandler: Cross-platform input manager for Desktop (Keyboard) and Mobile (Touch gestures & On-screen controls).
 * Guarantees zero unintentional page scrolling and prevents duplicate gesture firing.
 */
export class InputHandler {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.actionListeners = new Set();
    this.isEnabled = true;

    // Touch tracking
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchStartTime = 0;
    this.touchIdentified = false;
    this.minSwipeDistance = 24; // px
    this.maxSwipeTime = 500; // ms

    // Key states to prevent repeat on held keys (except pause toggle debounce)
    this.keysHeld = new Set();
    this.lastPauseTime = 0;

    // Bind event handlers
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleTouchCancel = this.handleTouchCancel.bind(this);

    this.attach();
  }

  attach() {
    window.addEventListener('keydown', this.handleKeyDown, { passive: false });
    window.addEventListener('keyup', this.handleKeyUp, { passive: true });

    // Attach touch listeners to window so swipes register across the entire viewport
    window.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    window.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    window.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    window.addEventListener('touchcancel', this.handleTouchCancel, { passive: false });
  }

  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('touchstart', this.handleTouchStart);
    window.removeEventListener('touchmove', this.handleTouchMove);
    window.removeEventListener('touchend', this.handleTouchEnd);
    window.removeEventListener('touchcancel', this.handleTouchCancel);
    this.actionListeners.clear();
  }

  onAction(callback) {
    this.actionListeners.add(callback);
    return () => this.actionListeners.delete(callback);
  }

  emit(action) {
    if (!this.isEnabled) return;
    for (const listener of this.actionListeners) {
      try {
        listener(action);
      } catch (err) {
        console.error('Error in input action listener:', err);
      }
    }
  }

  setEnabled(enabled) {
    this.isEnabled = !!enabled;
  }

  handleKeyDown(e) {
    const code = e.code;
    const key = e.key.toLowerCase();

    // Prevent default scroll actions on game keys
    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code) ||
      [' ', 'w', 'a', 's', 'd'].includes(key)
    ) {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
      }
    }

    // Pause handling (Esc or P) with debounce
    if (code === 'Escape' || key === 'p') {
      const now = performance.now();
      if (now - this.lastPauseTime > 250) {
        this.lastPauseTime = now;
        this.emit('pause');
      }
      return;
    }

    // Ignore repeating events from held keys
    if (e.repeat || this.keysHeld.has(code)) {
      return;
    }
    this.keysHeld.add(code);

    if (code === 'ArrowLeft' || key === 'a') {
      this.emit('left');
    } else if (code === 'ArrowRight' || key === 'd') {
      this.emit('right');
    } else if (code === 'ArrowUp' || key === 'w' || code === 'Space') {
      this.emit('jump');
    } else if (code === 'ArrowDown' || key === 's') {
      this.emit('slide');
    }
  }

  handleKeyUp(e) {
    this.keysHeld.delete(e.code);
  }

  handleTouchStart(e) {
    // Ignore touches on interactive buttons/inputs
    if (e.target.closest('button, input, a, .modal-box')) {
      return;
    }

    if (e.touches.length > 0) {
      const touch = e.touches[0];
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
      this.touchStartTime = performance.now();
      this.touchIdentified = false;
    }
  }

  handleTouchMove(e) {
    // Prevent scrolling and pinch zooming while playing
    if (e.cancelable && !e.target.closest('.modal-box')) {
      e.preventDefault();
    }

    if (this.touchIdentified || e.touches.length === 0) return;

    const touch = e.touches[0];
    const dx = touch.clientX - this.touchStartX;
    const dy = touch.clientY - this.touchStartY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    // Fast-trigger swipe if distance exceeded
    if (absX >= this.minSwipeDistance || absY >= this.minSwipeDistance) {
      this.touchIdentified = true;
      if (absX > absY) {
        if (dx > 0) {
          this.emit('right');
        } else {
          this.emit('left');
        }
      } else {
        if (dy > 0) {
          this.emit('slide');
        } else {
          this.emit('jump');
        }
      }
    }
  }

  handleTouchEnd(e) {
    if (this.touchIdentified) return;

    if (e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      const dx = touch.clientX - this.touchStartX;
      const dy = touch.clientY - this.touchStartY;
      const dt = performance.now() - this.touchStartTime;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (dt <= this.maxSwipeTime && (absX >= this.minSwipeDistance || absY >= this.minSwipeDistance)) {
        this.touchIdentified = true;
        if (absX > absY) {
          this.emit(dx > 0 ? 'right' : 'left');
        } else {
          this.emit(dy > 0 ? 'slide' : 'jump');
        }
      }
    }
  }

  handleTouchCancel() {
    this.touchIdentified = true;
  }
}
