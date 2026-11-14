// Arranque mínimo de Phaser (FND-004). Phaser llega como global (UMD cargado en index.html).
// No contiene lógica del editor: solo demuestra que el motor inicializa y dibuja.

/**
 * @param {HTMLElement} parent contenedor del lienzo
 * @param {(info: {version: string, renderer: 'WebGL'|'Canvas', label: string}) => void} onReady
 * @returns {Phaser.Game}
 */
export function bootPhaser(parent, onReady) {
  const Phaser = window.Phaser;
  if (!Phaser) throw new Error('Phaser no está cargado (falta vendor/phaser/phaser.min.js)');

  class BootScene extends Phaser.Scene {
    constructor() { super('boot'); }
    create() {
      const renderer = this.sys.game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas';
      const label = `Phaser ${Phaser.VERSION} · ${renderer}`;
      const { width, height } = this.scale;
      this.add.text(width / 2, height / 2, label, { fontFamily: 'system-ui, sans-serif', fontSize: '24px', color: '#dfe3f0' })
        .setOrigin(0.5);
      onReady({ version: Phaser.VERSION, renderer, label });
    }
  }

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#0e1018',
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    scene: BootScene,
  });
}
