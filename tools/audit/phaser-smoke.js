const { chromium } = require('playwright');
const path = process.argv[2];
(async () => {
  const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const out = {};
  for (const f of ['phaser.min.js','phaser-arcade-physics.min.js','phaser.js']) {
    const p = await b.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.setContent('<html><body><div id="g"></div></body></html>');
    await p.addScriptTag({ path: path + '/dist/' + f });
    const r = await p.evaluate(() => new Promise(res => {
      try {
        const keys = ['Physics','Tilemaps','Loader','Scene','GameObjects'].filter(k => !!Phaser[k]);
        const arcade = !!(Phaser.Physics && Phaser.Physics.Arcade);
        const matter = !!(Phaser.Physics && Phaser.Physics.Matter);
        const game = new Phaser.Game({ type: Phaser.WEBGL, parent: 'g', width: 320, height: 200,
          scene: { create() { res({ v: Phaser.VERSION, renderer: this.sys.game.renderer.type, keys, arcade, matter, gl: !!this.sys.game.renderer.gl }); } } });
        setTimeout(() => res({ timeout: true, v: Phaser.VERSION }), 8000);
      } catch (e) { res({ error: String(e) }); }
    }));
    out[f] = { r, errs };
    await p.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
