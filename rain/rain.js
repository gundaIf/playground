(function () {
  var canvas = document.getElementById('field');
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 0, H = 0, DPR = 1;
  var drops = [];
  var hand = { x: -999, y: -999, r: 90 };

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    seed();
  }
  window.addEventListener('resize', resize);

  function count() {
    if (reduce) return 40;
    if (Sky.storm()) return 220;
    if (Sky.season() === 'monsoon') return 130;
    return 28;
  }

  function seed() {
    var n = count();
    drops = [];
    for (var i = 0; i < n; i++) {
      drops.push(fresh(Math.random() * H));
    }
  }

  function fresh(y) {
    var rainy = Sky.season() === 'monsoon';
    return {
      x: Math.random() * W,
      y: y == null ? -20 : y,
      v: rainy ? (2.8 + Math.random() * 4.4) : (0.15 + Math.random() * 0.35),
      l: rainy ? (10 + Math.random() * 16) : 1.6,
      w: rainy ? 1 : 1.4,
      a: rainy ? (Sky.storm() ? 0.28 : 0.2) : 0.16
    };
  }

  canvas.addEventListener('pointermove', function (e) {
    hand.x = e.clientX;
    hand.y = e.clientY;
  });
  canvas.addEventListener('pointerleave', function () {
    hand.x = -999; hand.y = -999;
  });

  function frame() {
    ctx.clearRect(0, 0, W, H);
    var ink = Sky.ink();
    var rainy = Sky.season() === 'monsoon';
    for (var i = 0; i < drops.length; i++) {
      var d = drops[i];
      var dx = d.x - hand.x;
      var dy = d.y - hand.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < hand.r) {
        var push = (1 - dist / hand.r) * 1.8;
        d.x += (dx / (dist || 1)) * push;
      }
      ctx.strokeStyle = 'rgba(' + ink + ',' + d.a + ')';
      ctx.lineWidth = d.w;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + (rainy ? 0.5 : 0), d.y + d.l);
      ctx.stroke();
      d.y += d.v;
      if (d.y > H + 24) drops[i] = fresh(-24);
    }
    requestAnimationFrame(frame);
  }

  document.getElementById('theme').addEventListener('click', Sky.toggleTheme);
  document.getElementById('pin').addEventListener('click', function () {
    var pinned = false;
    try { pinned = localStorage.getItem('season-pin') === 'monsoon'; } catch (e) {}
    if (pinned) {
      try { localStorage.removeItem('season-pin'); } catch (e) {}
      this.textContent = 'pin monsoon';
      window.location.reload();
    } else {
      try { localStorage.setItem('season-pin', 'monsoon'); } catch (e) {}
      document.documentElement.setAttribute('data-season', 'monsoon');
      window.dispatchEvent(new CustomEvent('weatherchange'));
      this.textContent = 'unpin';
      seed();
    }
  });
  try {
    if (localStorage.getItem('season-pin') === 'monsoon') {
      document.getElementById('pin').textContent = 'unpin';
    }
  } catch (e) {}

  window.addEventListener('weatherchange', seed);
  resize();
  requestAnimationFrame(frame);
})();
