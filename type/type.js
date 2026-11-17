/* type: letters fall like sand. Write across the top, watch the words collapse, sweep through the heap. */
(function () {
  var CS = window.innerWidth < 500 ? 20 : 22;
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  var WIN = 14, lo = 0, cols = 0, rows = 0, grid = [], fall = [], caret = 0, hasTyped = false, flush = 0;
  var pointer = { x: -999, y: -999, px: -999, py: -999 };

  var R = Room.mount({
    name: 'type', hint: 'type. sweep your hand through the pile', touchHint: 'type, then swipe through the pile',
    actions: [
      { id: 'clear', label: 'clear', fn: function () { grid = new Array(cols * rows); fall = []; } },
      { id: 'save', label: 'save', fn: function () { Room.savePNG(R.canvas, 'type'); } }
    ]
  });
  var ctx = R.ctx, S = R.stage;

  /* hidden field so phones raise a keyboard and IMEs (Malayalam, Japanese…) work */
  var ta = document.createElement('textarea');
  ta.setAttribute('aria-label', 'type here');
  ta.autocapitalize = 'off'; ta.autocomplete = 'off'; ta.spellcheck = false;
  ta.style.cssText = 'position:fixed;left:-200px;top:0;width:10px;height:10px;opacity:0;font-size:16px;';
  document.body.appendChild(ta);
  ta.focus();

  function resize() {
    /* when a phone keyboard opens, the visible area shrinks: keep the heap above it */
    var vv = window.visualViewport, vis = vv ? vv.height : S.h;
    var floor = Math.min(S.playH, vis - S.barH);
    var nc = Math.floor(S.w / CS), nr = Math.max(6, Math.floor(floor / CS));
    var ng = new Array(nc * nr);
    for (var y = 0; y < Math.min(rows, nr); y++) {
      for (var x = 0; x < Math.min(cols, nc); x++) ng[(nr - 1 - y) * nc + x] = grid[(rows - 1 - y) * cols + x];
    }
    cols = nc; rows = nr; grid = ng;
    fall = fall.filter(function (f) { return f.c < cols; });
    setWindow(lo || Math.floor(cols * 0.5 - WIN / 2));
  }
  function setWindow(c0) {
    lo = Math.max(0, Math.min(Math.max(0, cols - WIN), c0));
    caret = lo;
  }
  Room.onResize(resize);
  resize();
  if (window.visualViewport) visualViewport.addEventListener('resize', resize);

  function spawn(ch) {
    if (ch === '\n') { caret = lo; return; }
    if (ch === ' ') { caret = caret + 1 >= lo + WIN ? lo : caret + 1; return; }
    if (/\s/.test(ch)) return;
    hasTyped = true;
    fall.push({ ch: ch, c: caret, cx: caret, y: 0, vy: 0, vx: 0 });
    caret = caret + 1 >= lo + WIN ? lo : caret + 1;
  }

  ta.addEventListener('input', function () {
    Array.from(ta.value).forEach(spawn);
    ta.value = '';
  });
  ta.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { spawn('\n'); e.preventDefault(); }
    if (e.key === 'Escape') R.btns.clear.click();
  });
  window.addEventListener('keydown', function () { if (document.activeElement !== ta) ta.focus(); });

  R.canvas.addEventListener('click', function () { ta.focus(); });
  Room.pointer(R.canvas, {
    down: function (x) { setWindow(Math.floor(x / CS) - (WIN >> 1)); ta.focus(); },
    move: function (x, y) { pointer.x = x; pointer.y = y; },
    leave: function () { pointer.x = pointer.y = -999; }
  });

  function free(c, r) { return c >= 0 && c < cols && r >= 0 && r < rows && !grid[r * cols + c]; }

  function sweep() {
    /* anything near a moving pointer gets thrown */
    var speed = Math.hypot(pointer.x - pointer.px, pointer.y - pointer.py);
    if (speed > 1 && pointer.x > -900) {
      var R2 = 34;
      var c0 = Math.floor((pointer.x - R2) / CS), c1 = Math.floor((pointer.x + R2) / CS);
      var r0 = Math.floor((pointer.y - R2) / CS), r1 = Math.floor((pointer.y + R2) / CS);
      for (var r = Math.max(0, r0); r <= Math.min(rows - 1, r1); r++) {
        for (var c = Math.max(0, c0); c <= Math.min(cols - 1, c1); c++) {
          var ch = grid[r * cols + c];
          if (!ch) continue;
          var dx = (c + 0.5) * CS - pointer.x, dy = (r + 0.5) * CS - pointer.y, d = Math.hypot(dx, dy) || 1;
          if (d > R2) continue;
          grid[r * cols + c] = undefined;
          fall.push({ ch: ch, c: c, cx: c, y: r, vy: -0.25 - Math.random() * 0.25, vx: (dx / d) * 0.5 + (pointer.x - pointer.px) * 0.02 });
        }
      }
    }
    pointer.px = pointer.x; pointer.py = pointer.y;
  }

  function update() {
    for (var i = fall.length - 1; i >= 0; i--) {
      var f = fall[i];
      f.vy = Math.min(f.vy + 0.035, 0.55);
      f.vx *= 0.96;
      f.cx += f.vx;
      var nc = Math.round(f.cx);
      var row = Math.floor(f.y);
      if (nc !== f.c) {
        if (free(nc, row)) f.c = nc; else { f.cx = f.c; f.vx = 0; }
      }
      var ny = f.y + f.vy, nr = Math.floor(ny);
      var landed = false;
      if (f.vy >= 0) {
        for (var r = row + 1; r <= nr; r++) {
          if (!free(f.c, r)) { landed = true; nr = r - 1; break; }
        }
      }
      if (landed) {
        var d = Math.random() < 0.5 ? -1 : 1, slid = false;
        for (var t = 0; t < 2; t++, d = -d) {
          if (free(f.c + d, nr) && free(f.c + d, nr + 1)) { f.c += d; f.cx = f.c; f.y = nr + 0.2; f.vy = 0.1; slid = true; break; }
        }
        if (!slid) {
          if (nr < 1 && !free(f.c, nr)) { flush = 60; }
          grid[Math.max(0, nr) * cols + f.c] = f.ch;
          fall.splice(i, 1);
          if (nr <= 1) flush = flush || 60;
        }
      } else {
        f.y = ny;
        if (f.y > rows - 1) { grid[(rows - 1) * cols + f.c] = f.ch; fall.splice(i, 1); }
      }
    }
  }

  Room.loop(function () {
    sweep();
    update();
    if (flush > 0) {
      flush--;
      if (flush === 0) { grid = new Array(cols * rows); fall = []; }
    }

    var bg = Room.bgRGB(), ink = Room.inkRGB();
    ctx.fillStyle = Room.rgb(bg);
    ctx.fillRect(0, 0, S.w, S.h);
    ctx.font = '17px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    var alpha = flush ? flush / 60 : 1;
    ctx.fillStyle = Room.rgb(ink, (0.82 * alpha).toFixed(3));
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var ch = grid[r * cols + c];
        if (ch) ctx.fillText(ch, (c + 0.5) * CS, (r + 0.5) * CS + 1);
      }
    }
    ctx.fillStyle = Room.rgb(ink, (alpha).toFixed(3));
    for (var i = 0; i < fall.length; i++) ctx.fillText(fall[i].ch, (fall[i].cx + 0.5) * CS, (fall[i].y + 0.5) * CS + 1);

    /* caret */
    if (Math.floor(performance.now() / 500) % 2 === 0) {
      ctx.fillStyle = Room.rgb(ink, 0.5);
      ctx.fillRect(caret * CS + 3, 6, 1.5, CS - 8);
    }
    ctx.fillStyle = Room.rgb(ink, 0.12);
    ctx.fillRect(lo * CS, 0, WIN * CS, 1);
    if (!hasTyped) {
      ctx.fillStyle = Room.rgb(ink, 0.32);
      ctx.fillText(coarse ? 'tap, then write' : 'write something', S.w / 2, Math.min(S.playH, (window.visualViewport ? visualViewport.height : S.h) - S.barH) * 0.42);
    }
  });
})();
