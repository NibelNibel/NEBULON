// Punto de entrada del editor. FND-004: arranca Phaser y publica el estado en window.__nebulon.
import { bootPhaser } from './boot/phaserBoot.js';

const state = { status: 'loading', phaserLoaded: typeof window.Phaser !== 'undefined' };
window.__nebulon = state;

const app = document.getElementById('app');
const statusEl = document.getElementById('status');

try {
  app.textContent = '';
  bootPhaser(app, (info) => {
    Object.assign(state, { status: 'ready', ...info });
  });
} catch (e) {
  app.textContent = '';
  app.appendChild(statusEl);
  statusEl.textContent = 'NEBULON · ERROR: ' + e.message;
  Object.assign(state, { status: 'error', error: e.message });
}
