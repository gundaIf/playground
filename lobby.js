(function () {
  var canvas = document.getElementById('c');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 0, H = 0, DPR = 1;
  var drops = [];

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

  function seed() {
    drops = [];
    var rainy = window.Sky && Sky.season() === 'monsoon';
    var n = reduce ? 0 : (rainy ? 70 : 18);
    for (var i = 0; i < n; i++) {
      drops.push({
        x: Math.random() * W,
        y: Math.random() * H,
        v: rainy ? (2.4 + Math.random() * 3.2) : (0.12 + Math.random() * 0.25),
        l: rainy ? (8 + Math.random() * 14) : 1.4,
        a: rainy ? 0.18 : 0.12
      });
    }
  }
  seed();
  window.addEventListener('weatherchange', seed);

  function frame() {
    if (!W) { requestAnimationFrame(frame); return; }
    ctx.clearRect(0, 0, W, H);
    var ink = (window.Sky && Sky.ink()) || '28, 31, 38';
    var rainy = window.Sky && Sky.season() === 'monsoon';
    for (var i = 0; i < drops.length; i++) {
      var d = drops[i];
      ctx.strokeStyle = 'rgba(' + ink + ',' + d.a + ')';
      ctx.lineWidth = rainy ? 1 : 1.2;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + (rainy ? 0.4 : 0), d.y + d.l);
      ctx.stroke();
      d.y += d.v;
      if (d.y > H + 20) {
        d.y = -20;
        d.x = Math.random() * W;
      }
    }
    requestAnimationFrame(frame);
  }
  if (!reduce) requestAnimationFrame(frame);
})();
