/* sand: falling sand, water and stone. When Kochi's sky is grey, it rains in here too. */
(function () {
  var MATS = [
    { id: 'sand', n: 1, key: '1' },
    { id: 'water', n: 2, key: '2' },
    { id: 'stone', n: 3, key: '3' },
    { id: 'erase', n: 0, key: '4' }
  ];
  var CS = 4;
  var gw = 0, gh = 0, grid = new Uint8Array(0);
  var off = document.createElement('canvas'), octx = off.getContext('2d');
  var img = null, px32 = null;
  var cur = MATS[0], rain = Sky.season() === 'monsoon';
  var down = false, pos = { x: -1, y: -1 }, prev = null;
  var tick = 0;

  var R = Room.mount({
    name: 'sand', hint: '1 sand · 2 water · 3 stone · 4 erase',
    actions: MATS.map(function (m) {
      return { id: 'm-' + m.id, label: m.id, fn: function () { setMat(m); } };
    }).concat([
      { id: 'rain', label: 'rain', fn: function () { rain = !rain; sync(); } },
      { id: 'clear', label: 'clear', fn: function () { grid.fill(0); } },
      { id: 'save', label: 'save', fn: function () { Room.savePNG(R.canvas, 'sand'); } }
    ])
  });
  var ctx = R.ctx, S = R.stage;

  function sync() {
    MATS.forEach(function (m) {
      R.btns['m-' + m.id].setAttribute('aria-pressed', m === cur ? 'true' : 'false');
    });
    R.btns.rain.setAttribute('aria-pressed', rain ? 'true' : 'false');
  }
  function setMat(m) { cur = m; sync(); }

  function resize() {
    var nw = Math.ceil(S.w / CS), nh = Math.floor(S.playH / CS);
    var ng = new Uint8Array(nw * nh);
    var cw = Math.min(nw, gw), ch = Math.min(nh, gh);
    /* keep the pile anchored to the floor when the window changes */
    for (var y = 0; y < ch; y++) {
      for (var x = 0; x < cw; x++) ng[(nh - 1 - y) * nw + x] = grid[(gh - 1 - y) * gw + x];
    }
    gw = nw; gh = nh; grid = ng;
    off.width = gw; off.height = gh;
    img = octx.createImageData(gw, gh);
    px32 = new Uint32Array(img.data.buffer);
  }
  Room.onResize(resize);
  resize();
  sync();

  function paint(cx, cy) {
    var r = cur.n === 3 ? 2 : 3;
    for (var dy = -r; dy <= r; dy++) {
      for (var dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + 1) continue;
        var x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
        var i = y * gw + x;
        if (cur.n === 0) grid[i] = 0;
        else if (grid[i] === 0 && (cur.n === 3 || Math.random() < 0.65)) grid[i] = cur.n;
      }
    }
  }
  function paintLine(a, b) {
    var n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
    for (var t = 0; t <= n; t++) paint(Math.round(a.x + (b.x - a.x) * t / n), Math.round(a.y + (b.y - a.y) * t / n));
  }
  function cell(x, y) { return { x: Math.floor(x / CS), y: Math.floor(y / CS) }; }

  Room.pointer(R.canvas, {
    down: function (x, y) { down = true; pos = cell(x, y); prev = pos; paint(pos.x, pos.y); },
    move: function (x, y, isDown) { pos = cell(x, y); if (isDown && prev) { paintLine(prev, pos); prev = pos; } },
    up: function () { down = false; prev = null; }
  });
  window.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = (e.key || '').toLowerCase();
    MATS.forEach(function (m) { if (m.key === k) setMat(m); });
    if (k === 'r') { rain = !rain; sync(); }
    if (k === 'c') grid.fill(0);
  });

  function step() {
    tick++;
    var leftFirst = (tick & 1) === 0;
    for (var y = gh - 2; y >= 0; y--) {
      var ltr = leftFirst ? (y & 1) === 0 : (y & 1) === 1;
      for (var n = 0; n < gw; n++) {
        var x = ltr ? n : gw - 1 - n;
        var i = y * gw + x, m = grid[i];
        if (m === 0 || m === 3) continue;
        var b = i + gw, below = grid[b];
        if (below === 0) { grid[b] = m; grid[i] = 0; continue; }
        if (m === 1 && below === 2) { grid[b] = 1; grid[i] = 2; continue; }
        var d = Math.random() < 0.5 ? -1 : 1;
        for (var t = 0; t < 2; t++, d = -d) {
          var nx = x + d;
          if (nx < 0 || nx >= gw) continue;
          if (grid[b + d] === 0 && grid[i + d] === 0) { grid[b + d] = m; grid[i] = 0; break; }
          if (m === 1 && grid[b + d] === 2 && grid[i + d] !== 3) { grid[b + d] = 1; grid[i] = 2; break; }
        }
        if (m === 2 && grid[i] === 2) {
          /* water spreads sideways */
          d = Math.random() < 0.5 ? -1 : 1;
          for (var reach = 0; reach < 3; reach++) {
            var sx = x + d * (reach + 1);
            if (sx < 0 || sx >= gw || grid[y * gw + sx] !== 0) break;
            if (reach === 2 || grid[y * gw + sx + d] !== 0) { grid[y * gw + sx] = 2; grid[i] = 0; break; }
          }
        }
      }
    }
  }

  Room.loop(function () {
    if (down && pos.x >= 0) paint(pos.x, pos.y);
    if (rain) {
      var n = Sky.storm() ? 7 : (Sky.season() === 'monsoon' ? 3 : 1);
      for (var r = 0; r < n; r++) {
        var rx = (Math.random() * gw) | 0;
        if (grid[rx] === 0) grid[rx] = 2;
      }
    }
    step();

    var bg = Room.bgRGB(), ink = Room.inkRGB();
    function pack(c) { return (255 << 24) | ((c[2] | 0) << 16) | ((c[1] | 0) << 8) | (c[0] | 0); }
    var cBg = pack(bg), cStone = pack(Room.mix(bg, ink, 0.92));
    var sand = [], water = [];
    for (var v = 0; v < 8; v++) {
      sand.push(pack(Room.mix(bg, ink, 0.5 + v * 0.025)));
      water.push(pack(Room.mix(bg, ink, 0.16 + v * 0.012)));
    }
    for (var y = 0; y < gh; y++) {
      for (var x = 0; x < gw; x++) {
        var i = y * gw + x, m = grid[i];
        if (m === 0) px32[i] = cBg;
        else if (m === 1) px32[i] = sand[((x * 73856093) ^ (y * 19349663)) & 7];
        else if (m === 2) px32[i] = water[(y + (tick >> 3)) & 7];
        else px32[i] = cStone;
      }
    }
    octx.putImageData(img, 0, 0);
    ctx.fillStyle = Room.rgb(bg);
    ctx.fillRect(0, 0, S.w, S.h);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, gw * CS, gh * CS);
  });
})();
