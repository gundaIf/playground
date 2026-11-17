/* Shared room chrome: site header, full-bleed stage canvas, bottom bar, helpers.
   Needs sky.js loaded first. Every room is: Room.mount({...}) then draw into the stage. */
(function (global) {
  var HOME = 'https://deeeen.xyz/';

  function h(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  function parseColor(s) {
    s = (s || '').trim();
    var m = /^#([0-9a-f]{6})$/i.exec(s);
    if (m) { var n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
    m = /^#([0-9a-f]{3})$/i.exec(s);
    if (m) return m[1].split('').map(function (c) { return parseInt(c + c, 16); });
    m = s.match(/\d+/g);
    return m ? m.slice(0, 3).map(Number) : [242, 239, 232];
  }

  var cbs = [];
  var stage = { canvas: null, ctx: null, w: 0, h: 0, dpr: 1, playH: 0 };

  function resize() {
    var c = stage.canvas;
    stage.dpr = Math.min(global.devicePixelRatio || 1, 2);
    stage.w = c.clientWidth;
    stage.h = c.clientHeight;
    var bh = stage.bar ? stage.bar.offsetHeight : 44;
    stage.barH = bh;
    stage.playH = Math.max(120, stage.h - bh);
    c.width = Math.round(stage.w * stage.dpr);
    c.height = Math.round(stage.h * stage.dpr);
    stage.ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
    cbs.forEach(function (fn) { fn(stage); });
  }

  var Room = {
    stage: stage,
    reduce: global.matchMedia('(prefers-reduced-motion: reduce)').matches,

    inkRGB: function () { return Sky.ink().split(',').map(function (n) { return parseFloat(n); }); },
    bgRGB: function () { return parseColor(Sky.bg()); },
    mix: function (a, b, t) {
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    },
    rgb: function (c, a) {
      return a == null
        ? 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'
        : 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
    },

    onResize: function (fn) { cbs.push(fn); },

    /* o: { name, hint, actions: [{ id, label, title, fn(btn) }] } */
    mount: function (o) {
      document.title = o.name + ' · playground';
      var coarse = global.matchMedia('(pointer: coarse)').matches;
      if (coarse && o.touchHint) o.hint = o.touchHint;
      Room.coarse = coarse;

      var header = h(
        '<header class="site-header">' +
        '<h1 class="site-title"><a href="' + HOME + '">Deen’s Digital Plot ✿</a></h1>' +
        '<div class="site-header-actions">' +
        '<a class="home-btn" href="' + HOME + '" aria-label="Home, deeeen.xyz" title="Home">' +
        '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.2 8.1 L8 2.8 L13.8 8.1"/><path d="M4 7.4 V13.2 H12 V7.4"/></svg></a>' +
        '<button type="button" id="theme-toggle" class="theme-toggle" aria-label="Toggle dark mode">' +
        '<span class="theme-toggle-track"><span class="theme-toggle-thumb"></span></span></button>' +
        '</div></header>');
      document.body.appendChild(header);
      header.querySelector('#theme-toggle').addEventListener('click', Sky.toggleTheme);

      var canvas = h('<canvas id="stage" class="touch"></canvas>');
      document.body.appendChild(canvas);
      stage.canvas = canvas;
      stage.ctx = canvas.getContext('2d');

      document.body.classList.add('room');
      var bar = h('<div class="bar"><a class="back" href="/" aria-label="playground, all rooms"><span class="back-glyph" aria-hidden="true">\u2039</span><span class="back-text">playground</span></a><span id="hint"></span><span class="spacer"></span></div>');
      document.body.appendChild(bar);
      stage.bar = bar;
      var hint = bar.querySelector('#hint');
      /* on phones the bar has no room for a sentence, so the hint floats above it and fades on first touch */
      var float = h('<div class="hint-float" aria-hidden="true"></div>');
      document.body.appendChild(float);
      function setHint(t) { hint.textContent = t || ''; float.textContent = t || ''; float.classList.remove('gone'); }
      setHint(o.hint);
      var fade = setTimeout(function () { float.classList.add('gone'); }, 7000);
      function hideHint() { clearTimeout(fade); float.classList.add('gone'); }
      document.addEventListener('pointerdown', hideHint, { once: true });
      document.addEventListener('keydown', hideHint, { once: true });

      var btns = {};
      (o.actions || []).forEach(function (a) {
        var b = document.createElement('button');
        b.type = 'button';
        b.id = a.id;
        b.textContent = a.label;
        if (a.title) b.title = a.title;
        b.addEventListener('click', function () { a.fn(b); });
        bar.appendChild(b);
        btns[a.id] = b;
      });

      global.addEventListener('resize', resize);
      resize();

      return {
        canvas: canvas, ctx: stage.ctx, stage: stage, btns: btns,
        hint: function (t) { setHint(t); clearTimeout(fade); fade = setTimeout(function () { float.classList.add('gone'); }, 5000); }
      };
    },

    /* unified pointer: down(x,y,e) move(x,y,isDown,e) up(x,y,e) */
    pointer: function (c, hd) {
      var downs = {};
      c.addEventListener('pointerdown', function (e) {
        try { c.setPointerCapture(e.pointerId); } catch (err) {}
        downs[e.pointerId] = true;
        if (hd.down) hd.down(e.clientX, e.clientY, e);
      });
      c.addEventListener('pointermove', function (e) {
        if (hd.move) hd.move(e.clientX, e.clientY, !!downs[e.pointerId], e);
      });
      function up(e) {
        if (!downs[e.pointerId]) return;
        delete downs[e.pointerId];
        if (hd.up) hd.up(e.clientX, e.clientY, e);
      }
      c.addEventListener('pointerup', up);
      c.addEventListener('pointercancel', up);
      c.addEventListener('pointerleave', function (e) { if (hd.leave) hd.leave(e); });
    },

    loop: function (fn) {
      var last = performance.now();
      (function tick(now) {
        var dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        fn(dt, now);
        requestAnimationFrame(tick);
      })(last);
    },

    savePNG: function (canvas, name) {
      canvas.toBlob(function (blob) {
        if (!blob) return;
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        var stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
        a.href = url;
        a.download = 'playground-' + name + '-' + stamp + '.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      });
    },

    rand: function (a, b) { return a + Math.random() * (b - a); }
  };

  global.Room = Room;
})(window);
