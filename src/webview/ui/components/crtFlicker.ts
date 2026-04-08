/**
 * CRT flicker effect via JS — randomly pulses an overlay
 * to simulate an old monitor's brightness wobble.
 */

let overlayEl: HTMLElement | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let enabled = true;

export function initCrtFlicker(): void {
  const frame = document.querySelector('.frame');
  if (!frame) return;

  overlayEl = document.createElement('div');
  overlayEl.className = 'crt-flicker-overlay';
  frame.appendChild(overlayEl);

  startFlicker();
}

export function setCrtFlickerEnabled(on: boolean): void {
  enabled = on;
  if (on) {
    startFlicker();
  } else {
    stopFlicker();
  }
}

function startFlicker(): void {
  if (intervalId) return;
  if (!enabled) return;

  intervalId = setInterval(() => {
    if (!overlayEl) return;

    // Random chance of a flicker pulse
    if (Math.random() < 0.3) {
      const intensity = 0.04 + Math.random() * 0.10;
      overlayEl.style.opacity = String(intensity);

      // Brief pulse then fade
      setTimeout(() => {
        if (overlayEl) overlayEl.style.opacity = '0';
      }, 40 + Math.random() * 60);
    }
  }, 150);
}

function stopFlicker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (overlayEl) {
    overlayEl.style.opacity = '0';
  }
}
