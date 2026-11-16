/* Lobby: the rooms are glyphs in a loose constellation. Weather falls behind them.
   Lines between rooms light up near your cursor; glyphs lean away from it. */
(function () {
  var canvas = document.getElementById('c');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var narrow = window.matchMedia('(max-width: 720px)');
  var W = 0, H = 0, DPR = 1;
  var drops = [];
  var nodes = [].slice.call(document.querySelectorAll('.node')).map(function (el, i) {
    return { el: el, fx: +el.style.getPropertyValue('--x') / 100, fy: +el.style.getPropertyValue('--y') / 100,
             ox: 0, oy: 0, vx: 0, vy: 0, ph: i * 1.7, x: 0, y: 0 };
  });
  var EDGES = [[0,1],[1,2],[2,5],[5,3],[3,4],[4,0],[0,3],[1,3],[3,2]];
  var ptr = { x: -999, y: -999 };
  var container = document.querySelector('.nodes');

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    seed();
  }

  function seed() {
    drops = [];
    var rainy = window.Sky && Sky.season() === 'monsoon';
    var n = reduce ? 0 : (rainy ? 90 : 14);
    for (var i = 0; i < n; i++) {
      drops.push({ x: Math.random() * W, y: Math.random() * H,
        v: rainy ? (2.4 + Math.random() * 3.2) : (0.12 + Math.random() * 0.25),
        l: rainy ? (8 + Math.random() * 14) : 1.4, a: rainy ? 0.16 : 0.12 });
    }
  }
  window.addEventListener('resize', resize);
  window.addEventListener('weatherchange', seed);
  window.addEventListener('pointermove', function (e) { ptr.x = e.clientX; ptr.y = e.clientY; });
  document.addEventListener('pointerleave', function () { ptr.x = ptr.y = -999; });
  resize();

  function distToSeg(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    var t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  var t0 = performance.now();
  function frame(now) {
    var t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    var ink = (window.Sky && Sky.ink()) || '28, 31, 38';
    var rainy = window.Sky && Sky.season() === 'monsoon';

    for (var i = 0; i < drops.length; i++) {
      var d = drops[i];
      ctx.strokeStyle = 'rgba(' + ink + ',' + d.a + ')';
      ctx.lineWidth = rainy ? 1 : 1.2;
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + (rainy ? 0.4 : 0), d.y + d.l); ctx.stroke();
      d.y += d.v;
      if (d.y > H + 20) { d.y = -20; d.x = Math.random() * W; }
    }

    var live = !narrow.matches;
    nodes.forEach(function (n) {
      if (!live) { n.el.style.transform = ''; return; }
      var cr = container.getBoundingClientRect();
      var bx = cr.left + n.el.offsetLeft + n.el.offsetWidth / 2, by = cr.top + n.el.offsetTop + 28;
      var dx = bx + n.ox - ptr.x, dy = by + n.oy - ptr.y, d = Math.hypot(dx, dy) || 1;
      var push = d < 170 ? (1 - d / 170) * 0.9 : 0;
      n.vx += (dx / d) * push - n.ox * 0.012;
      n.vy += (dy / d) * push - n.oy * 0.012;
      n.vx *= 0.9; n.vy *= 0.9;
      n.ox += n.vx; n.oy += n.vy;
      var bobx = reduce ? 0 : Math.sin(t * 0.5 + n.ph) * 7, boby = reduce ? 0 : Math.cos(t * 0.4 + n.ph * 1.3) * 7;
      n.x = bx + n.ox + bobx; n.y = by + n.oy + boby;
      n.el.style.transform = 'translate(' + (n.ox + bobx).toFixed(1) + 'px,' + (n.oy + boby).toFixed(1) + 'px)';
    });

    if (live) {
      EDGES.forEach(function (e) {
        var a = nodes[e[0]], b = nodes[e[1]];
        var near = ptr.x > -900 ? Math.max(0, 1 - distToSeg(ptr.x, ptr.y, a.x, a.y, b.x, b.y) / 150) : 0;
        var mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.08, my = (a.y + b.y) / 2 - (b.x - a.x) * 0.08;
        ctx.strokeStyle = 'rgba(' + ink + ',' + (0.07 + near * 0.35).toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y); ctx.stroke();
      });
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
