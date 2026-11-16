/* flow: ink that follows a wind you can't see. Hold to release it. Space re-rolls the wind. */
(function () {
  var plate = document.createElement('canvas'), pctx = plate.getContext('2d');
  var tint = document.createElement('canvas'), tctx = tint.getContext('2d');
  var parts = [], down = false, pos = { x: 0, y: 0 }, seed = Math.random() * 1000, t = 0;
  var touched = false;

  var R = Room.mount({
    name: 'flow', hint: 'hold to release ink · space new wind',
    actions: [
      { id: 'wind', label: 'new wind', fn: function () { seed = Math.random() * 1000; } },
      { id: 'clear', label: 'clear', fn: function () { pctx.clearRect(0, 0, plate.width, plate.height); parts = []; } },
      { id: 'save', label: 'save print', fn: function () { Room.savePNG(R.canvas, 'flow'); } }
    ]
  });
  var ctx = R.ctx, S = R.stage;

  function resize() {
    var old = null;
    if (plate.width) { old = document.createElement('canvas'); old.width = plate.width; old.height = plate.height; old.getContext('2d').drawImage(plate, 0, 0); }
    plate.width = tint.width = R.canvas.width;
    plate.height = tint.height = R.canvas.height;
    pctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    if (old) pctx.drawImage(old, 0, 0, S.w, S.h);
  }
  Room.onResize(resize);
  resize();

  /* small value noise */
  function hash(x, y) {
    var n = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453;
    return n - Math.floor(n);
  }
  function smooth(a) { return a * a * (3 - 2 * a); }
  function noise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
    var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  }
  function angle(x, y) {
    var s = 0.0028;
    var n = noise(x * s, y * s + t * 0.03) * 0.65 + noise(x * s * 2.3 + 40, y * s * 2.3 - t * 0.05) * 0.35;
    var a = n * 6.2832 * 1.6;
    if (Sky.season() === 'monsoon') { /* the wind leans downward when it rains */
      var k = Sky.storm() ? 0.55 : 0.32;
      a = Math.atan2(Math.sin(a) * (1 - k) + k, Math.cos(a) * (1 - k) + 0.08);
    }
    return a;
  }

  function emit(x, y, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.2832, r = Math.random() * 14;
      parts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, life: Room.rand(140, 340), w: Room.rand(0.5, 1.5), sp: Room.rand(0.8, 1.7) });
    }
    if (parts.length > 2600) parts.splice(0, parts.length - 2600);
  }

  Room.pointer(R.canvas, {
    down: function (x, y) { down = true; touched = true; pos = { x: x, y: y }; emit(x, y, 30); R.hint('hold to release ink · space new wind'); },
    move: function (x, y, isDown) { pos = { x: x, y: y }; },
    up: function () { down = false; }
  });
  window.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === ' ') { seed = Math.random() * 1000; e.preventDefault(); }
    if ((e.key || '').toLowerCase() === 'c') R.btns.clear.click();
  });

  /* a few seeds so the first screen isn't empty */
  setTimeout(function () { if (!touched) { emit(S.w * 0.3, S.h * 0.4, 18); emit(S.w * 0.7, S.h * 0.55, 18); } }, 400);

  Room.loop(function (dt) {
    t += dt * 60;
    if (down) emit(pos.x, pos.y, 10);
    var ink = Room.inkRGB();
    pctx.lineCap = 'round';
    var storm = Sky.storm() ? 1.6 : 1;
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      var a = angle(p.x, p.y);
      var nx = p.x + Math.cos(a) * p.sp * 2.2 * storm, ny = p.y + Math.sin(a) * p.sp * 2.2 * storm;
      var fade = Math.min(1, p.life / 60);
      pctx.strokeStyle = 'rgba(0,0,0,' + (0.16 * fade).toFixed(3) + ')';
      pctx.lineWidth = p.w;
      pctx.beginPath(); pctx.moveTo(p.x, p.y); pctx.lineTo(nx, ny); pctx.stroke();
      p.x = nx; p.y = ny; p.life--;
      if (p.life <= 0 || nx < -20 || ny < -20 || nx > S.w + 20 || ny > S.h + 20) parts.splice(i, 1);
    }

    /* tint the black plate with the current ink so theme changes recolour old prints too */
    tctx.globalCompositeOperation = 'source-over';
    tctx.clearRect(0, 0, tint.width, tint.height);
    tctx.drawImage(plate, 0, 0);
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = Room.rgb(ink);
    tctx.fillRect(0, 0, tint.width, tint.height);

    ctx.fillStyle = Room.rgb(Room.bgRGB());
    ctx.fillRect(0, 0, S.w, S.h);
    ctx.drawImage(tint, 0, 0, S.w, S.h);
  });
})();
