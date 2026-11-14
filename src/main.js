// Punto de entrada del editor. FND-003: solo comprueba que la página, el módulo propio
// y el bundle de Phaser se cargan. El arranque real de Phaser es la tarea FND-004.
const phaserLoaded = typeof window.Phaser !== 'undefined';
window.__nebulon = { status: 'loaded', phaserLoaded };
document.getElementById('status').textContent =
  phaserLoaded ? 'NEBULON · módulos cargados' : 'NEBULON · ERROR: Phaser no se cargó';
