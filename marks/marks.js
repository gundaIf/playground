(function () {
  var canvas = document.getElementById('field');
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 0, H = 0, DPR = 1;
  var marks = [];
  var KEY = 'playground-marks';
  var LIFE = reduce ? 4000 : 14000;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (Array.isArray(saved)) {
      var now = Date.now();
      saved.forEach(function (m) {
        if (now - m.t < LIFE) {
          marks.push({ x: m.x * W, y: m.y * H, born: performance.now() - (now - m.t), r: m.r || 18, seed: m.seed || 0 });
        }
      });
    }
  } catch (e) {}

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(marks.slice(-40).map(function (m) {
        return { x: m.x / W, y: m.y / H, t: Date.now() - (performance.now() - m.born), r: m.r, seed: m.seed };
      })));
    } catch (e) {}
  }

  function add(x, y) {
    marks.push({
      x: x, y: y,
      born: performance.now(),
      r: 12 + Math.random() * 22,
      seed: Math.random() * Math.PI * 2
    });
    if (marks.length > 80) marks.shift();
    persist();
  }

  var down = false;
  var last = 0;
  canvas.addEventListener('pointerdown', function (e) {
    down = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    add(e.clientX, e.clientY);
    last = performance.now();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!down) return;
    var t = performance.now();
    if (t - last < 40) return;
    last = t;
    add(e.clientX, e.clientY);
  });
  function up() { down = false; persist(); }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  document.getElementById('clear').addEventListener('click', function () {
    marks = [];
    persist();
  });
  document.getElementById('theme').addEventListener('click', Sky.toggleTheme);

  function frame() {
    ctx.clearRect(0, 0, W, H);
    var ink = Sky.ink();
    var now = performance.now();
    for (var i = marks.length - 1; i >= 0; i--) {
      var m = marks[i];
      var q = (now - m.born) / LIFE;
      if (q >= 1) { marks.splice(i, 1); continue; }
      var fade = Math.pow(1 - q, 1.4);
      var r = m.r * (0.35 + q * 1.4);
      ctx.strokeStyle = 'rgba(' + ink + ',' + (0.45 * fade).toFixed(3) + ')';
      ctx.lineWidth = Math.max(0.6, 2.2 * (1 - q));
      ctx.beginPath();
      ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(m.x, m.y, r * 0.45, m.seed, m.seed + 1.8);
      ctx.stroke();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
