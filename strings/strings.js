/* strings: nine wave-equation strings. Drag across to pluck. Tuned by the Bangalore sky. */
(function () {
  var R = Room.mount({ name: 'strings', hint: 'click once to wake the sound', touchHint: 'touch once to wake the sound' });
  var ctx = R.ctx, S = R.stage;

  var N = 9, M = 140;
  var SCALES = { clear: [0, 2, 4, 7, 9], monsoon: [0, 2, 3, 7, 8] };
  var ROOTS = { clear: 57, monsoon: 52 };
  var strings = [];
  var i, k;

  for (i = 0; i < N; i++) {
    strings.push({ y: 0, x0: 0, x1: 0, u: new Float32Array(M), v: new Float32Array(M), hit: 0, hitX: 0, last: 0 });
  }

  function layout() {
    var top = Math.max(110, S.playH * 0.16), bot = S.playH - 30;
    var m = Math.max(18, S.w * 0.07);
    for (i = 0; i < N; i++) {
      var s = strings[i];
      s.y = top + (bot - top) * (i / (N - 1));
      s.x0 = m; s.x1 = S.w - m;
    }
  }
  Room.onResize(layout);
  layout();

  /* ---------- sound ---------- */
  var ac = null, master, send, voices = 0;
  function season() { return Sky.season() === 'monsoon' ? 'monsoon' : 'clear'; }
  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function freqFor(row) { /* row 0 = top string = highest note */
    var idx = N - 1 - row, sc = SCALES[season()];
    return midi(ROOTS[season()] + sc[idx % 5] + 12 * Math.floor(idx / 5));
  }

  function wake() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
    var d = ac.createDelay(1); d.delayTime.value = 0.34;
    var fb = ac.createGain(); fb.gain.value = 0.42;
    var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700;
    send = ac.createGain(); send.gain.value = 0.32;
    send.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(master);
    R.hint(Room.coarse ? 'drag across the strings' : 'move across the strings. or press a s d f g h j k l');
  }

  var noiseB = null;
  function pluckSound(row, level) {
    if (!ac || ac.state !== 'running' || voices > 26) return;
    var f = freqFor(row), t = ac.currentTime;
    var out = ac.createGain(); out.gain.value = 0.2 * level;
    out.connect(master); out.connect(send);
    var parts = [1, 2, 3, 4.01, 5.03], stop = t;
    parts.forEach(function (p, j) {
      var o = ac.createOscillator();
      o.type = j === 0 ? 'triangle' : 'sine';
      o.frequency.value = f * p;
      var g = ac.createGain();
      var dur = 3.2 / (1 + j * 0.9);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.6 / (j + 1), t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + dur + 0.05);
      if (t + dur > stop) stop = t + dur;
    });
    if (!noiseB) {
      noiseB = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.04), ac.sampleRate);
      var nd = noiseB.getChannelData(0);
      for (k = 0; k < nd.length; k++) nd[k] = (Math.random() * 2 - 1) * (1 - k / nd.length);
    }
    var ns = ac.createBufferSource(); ns.buffer = noiseB;
    var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(6000, f * 4); bp.Q.value = 1.2;
    var ng = ac.createGain(); ng.gain.value = 0.5;
    ns.connect(bp); bp.connect(ng); ng.connect(out); ns.start(t);
    voices++;
    setTimeout(function () { voices--; try { out.disconnect(); } catch (e) {} }, (stop - t + 0.2) * 1000);
  }

  /* ---------- plucking ---------- */
  function pluck(row, x, amp, level) {
    var s = strings[row];
    var p = Math.round((x - s.x0) / (s.x1 - s.x0) * (M - 1));
    p = Math.max(5, Math.min(M - 6, p));
    var w = 16;
    for (var j = Math.max(1, p - w); j < Math.min(M - 1, p + w); j++) {
      s.u[j] += amp * (1 - Math.abs(j - p) / w);
    }
    s.hit = 1; s.hitX = x;
    pluckSound(row, level);
  }

  var lastPt = {};
  Room.pointer(R.canvas, {
    down: function (x, y, e) { wake(); lastPt[e.pointerId] = { x: x, y: y }; },
    move: function (x, y, isDown, e) {
      var p = lastPt[e.pointerId];
      lastPt[e.pointerId] = { x: x, y: y };
      if (!p) return;
      var now = performance.now();
      for (i = 0; i < N; i++) {
        var s = strings[i];
        if ((p.y - s.y) * (y - s.y) < 0 && x > s.x0 - 6 && x < s.x1 + 6 && now - s.last > 70) {
          s.last = now;
          var speed = Math.min(1, Math.hypot(x - p.x, y - p.y) / 60);
          var dir = y > p.y ? 1 : -1;
          pluck(i, x, dir * (10 + speed * 30), 0.45 + speed * 0.55);
        }
      }
    },
    leave: function (e) { delete lastPt[e.pointerId]; }
  });

  var KEYS = 'asdfghjkl';
  window.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    var n = KEYS.indexOf((e.key || '').toLowerCase());
    if (n < 0) {
      var d = parseInt(e.key, 10);
      if (d >= 1 && d <= 9) n = d - 1; else return;
    }
    wake();
    var row = N - 1 - n;
    pluck(row, strings[row].x0 + (strings[row].x1 - strings[row].x0) * Room.rand(0.25, 0.75), (Math.random() < 0.5 ? -1 : 1) * 30, 0.9);
  });

  /* ---------- physics + draw ---------- */
  var C2 = 0.34, VISC = 0.03, DAMP = 0.0025;
  function step(s) {
    var u = s.u, v = s.v;
    for (var sub = 0; sub < 3; sub++) {
      for (var j = 1; j < M - 1; j++) {
        var a = C2 * (u[j - 1] - 2 * u[j] + u[j + 1])
              + VISC * (v[j - 1] - 2 * v[j] + v[j + 1])
              - DAMP * v[j];
        v[j] += a;
      }
      for (j = 1; j < M - 1; j++) u[j] += v[j];
    }
  }

  Room.loop(function (dt) {
    var bg = Room.bgRGB(), ink = Room.inkRGB();
    ctx.fillStyle = Room.rgb(bg);
    ctx.fillRect(0, 0, S.w, S.h);
    var inkS = ink.join(',');

    for (i = 0; i < N; i++) {
      var s = strings[i];
      step(s);
      var e = 0;
      for (k = 1; k < M - 1; k++) { var a = Math.abs(s.u[k]); if (a > e) e = a; }
      var live = Math.min(1, e / 22);

      /* resting line, so you can see where the strings are */
      ctx.strokeStyle = 'rgba(' + inkS + ',0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(s.x0, s.y + 0.5); ctx.lineTo(s.x1, s.y + 0.5); ctx.stroke();

      ctx.strokeStyle = 'rgba(' + inkS + ',' + (0.38 + live * 0.55).toFixed(3) + ')';
      ctx.lineWidth = 1.1 + live * 0.9;
      ctx.beginPath();
      var dx = (s.x1 - s.x0) / (M - 1);
      for (k = 0; k < M; k++) {
        var px = s.x0 + k * dx, py = s.y + s.u[k];
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();

      ctx.fillStyle = 'rgba(' + inkS + ',0.55)';
      ctx.beginPath(); ctx.arc(s.x0, s.y, 2.2, 0, 6.2832); ctx.arc(s.x1, s.y, 2.2, 0, 6.2832); ctx.fill();

      if (s.hit > 0.01) {
        var r = 4 + (1 - s.hit) * 34;
        ctx.strokeStyle = 'rgba(' + inkS + ',' + (s.hit * 0.35).toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(s.hitX, s.y, r, 0, 6.2832); ctx.stroke();
        s.hit *= 0.94;
      }
    }
  });
})();
