/* dusk: fireflies that drift together and slowly learn to blink in time. Thunder resets them. */
(function () {
  var N = window.innerWidth < 600 ? 90 : 150, flies = [], ptr = { x: -999, y: -999, down: false }, shock = 0;
  var sync = 0;

  var R = Room.mount({
    name: 'dusk', hint: 'move to call them · press to flash', touchHint: 'touch to call them · tap to flash',
    actions: [{ id: 'thunder', label: 'thunder', fn: function () { thunder(); } }]
  });
  var ctx = R.ctx, S = R.stage;
  var syncEl = document.createElement('span');
  syncEl.style.opacity = '0.8';
  R.btns.thunder.parentNode.insertBefore(syncEl, R.btns.thunder);

  /* one soft glow sprite, re-tinted when the ink colour changes, instead of a gradient per firefly */
  var glow = document.createElement('canvas'); glow.width = glow.height = 64;
  var glowInk = '';
  function makeGlow(ink) {
    var g = glow.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.clearRect(0, 0, 64, 64);
    r.addColorStop(0, 'rgba(' + ink + ',1)'); r.addColorStop(1, 'rgba(' + ink + ',0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    glowInk = ink;
  }

  var i, j;
  for (i = 0; i < N; i++) {
    var a = Math.random() * 6.2832;
    flies.push({
      x: Math.random() * (S.w || 800), y: Math.random() * (S.h || 600),
      vx: Math.cos(a), vy: Math.sin(a), ph: Math.random(), rate: 1 / Room.rand(480, 560)
    });
  }

  function thunder() { shock = 1; flies.forEach(function (f) { f.ph = Math.random() * 0.02; }); }

  Room.pointer(R.canvas, {
    down: function (x, y) {
      ptr.down = true; ptr.x = x; ptr.y = y;
      flies.forEach(function (f) { if (Math.hypot(f.x - x, f.y - y) < 190) f.ph = Math.random() * 0.03; });
    },
    move: function (x, y) { ptr.x = x; ptr.y = y; },
    up: function () { ptr.down = false; },
    leave: function () { ptr.x = ptr.y = -999; }
  });

  var strikeTimer = 0;
  Room.loop(function (dt) {
    var storm = Sky.storm(), wet = Sky.season() === 'monsoon';
    var maxV = wet ? 1.15 : 1.6;

    if (storm && ++strikeTimer > 600 && Math.random() < 0.01) { strikeTimer = 0; thunder(); }

    var fl = [];
    for (i = 0; i < N; i++) {
      var f = flies[i], ax = 0, ay = 0, cx = 0, cy = 0, avx = 0, avy = 0, n = 0, sx = 0, sy = 0;
      for (j = 0; j < N; j++) {
        if (i === j) continue;
        var o = flies[j], dx = o.x - f.x, dy = o.y - f.y, d2 = dx * dx + dy * dy;
        if (d2 < 6400) {
          n++; cx += o.x; cy += o.y; avx += o.vx; avy += o.vy;
          if (d2 < 400) { sx -= dx; sy -= dy; }
        }
      }
      if (n) {
        ax += (cx / n - f.x) * 0.0004 + (avx / n - f.vx) * 0.04 + sx * 0.004;
        ay += (cy / n - f.y) * 0.0004 + (avy / n - f.vy) * 0.04 + sy * 0.004;
      }
      /* wander, drift to the middle of the screen, drop in a storm */
      ax += Math.cos(f.ph * 40 + i) * 0.012; ay += Math.sin(f.ph * 31 + i) * 0.012;
      ax += (S.w / 2 - f.x) * 0.00002; ay += (S.h / 2 - f.y) * 0.00002;
      if (storm) ay += 0.03;
      if (ptr.x > -900) {
        var px = ptr.x - f.x, py = ptr.y - f.y, pd = Math.hypot(px, py) || 1;
        if (pd < 320) { var k = ptr.down ? 0.0016 : 0.0005; ax += px * k; ay += py * k; }
      }
      f.vx += ax; f.vy += ay;
      var sp = Math.hypot(f.vx, f.vy);
      if (sp > maxV) { f.vx = f.vx / sp * maxV; f.vy = f.vy / sp * maxV; }
      if (sp < 0.45) { f.vx *= 1.05; f.vy *= 1.05; }
      f.x += f.vx; f.y += f.vy;
      if (f.x < -10) f.x = S.w + 10; if (f.x > S.w + 10) f.x = -10;
      if (f.y < -10) f.y = S.h + 10; if (f.y > S.h + 10) f.y = -10;

      f.ph += f.rate * (storm ? 1.6 : 1);
      if (f.ph >= 1) { f.ph = 0; fl.push(f); }
    }
    /* pulse coupling: a neighbour's flash nudges you forward in your cycle */
    for (i = 0; i < fl.length; i++) {
      var s = fl[i];
      for (j = 0; j < N; j++) {
        var q = flies[j];
        if (q === s) continue;
        var ddx = q.x - s.x, ddy = q.y - s.y;
        if (ddx * ddx + ddy * ddy < 11000) q.ph = Math.min(0.999, q.ph + 0.045 * (0.4 + q.ph));
      }
    }

    /* how in-sync are they (Kuramoto order parameter) */
    var re = 0, im = 0;
    for (i = 0; i < N; i++) { re += Math.cos(flies[i].ph * 6.2832); im += Math.sin(flies[i].ph * 6.2832); }
    sync += (Math.hypot(re, im) / N - sync) * 0.05;
    syncEl.textContent = 'in sync ' + Math.round(sync * 100) + '%';

    /* draw: fade the previous frame for trails, then the glow */
    var bg = Room.bgRGB(), ink = Room.inkRGB();
    ctx.fillStyle = Room.rgb(bg, 0.22);
    ctx.fillRect(0, 0, S.w, S.h);
    var inkS = ink.join(',');
    if (inkS !== glowInk) makeGlow(inkS);
    for (i = 0; i < N; i++) {
      var g = flies[i];
      var b = Math.pow(1 - g.ph, 14);
      ctx.fillStyle = 'rgba(' + inkS + ',0.22)';
      ctx.beginPath(); ctx.arc(g.x, g.y, 1.1, 0, 6.2832); ctx.fill();
      if (b > 0.02) {
        var r = 2 + b * 9;
        ctx.globalAlpha = 0.8 * b;
        ctx.drawImage(glow, g.x - r, g.y - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      }
    }
    if (shock > 0.01) {
      ctx.fillStyle = 'rgba(' + inkS + ',' + (shock * 0.22).toFixed(3) + ')';
      ctx.fillRect(0, 0, S.w, S.h);
      shock *= 0.86;
    }
  });
})();
