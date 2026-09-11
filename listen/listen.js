/* listen: quiet seasonal pad. Follows data-season from sky.js. */
(function () {
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  var KEY = 'sky-score';
  var ac = null, beds = {}, current = null, wanted = false;
  var SCALES = { clear: [0, 2, 4, 7, 9], monsoon: [0, 2, 3, 7, 8] };
  var ROOTS = { clear: 62, monsoon: 55 };
  var btn = document.getElementById('sky-score');
  var label = document.getElementById('score-label');
  var blurb = document.getElementById('blurb');

  function season() {
    return document.documentElement.getAttribute('data-season') === 'monsoon' ? 'monsoon' : 'clear';
  }
  function storm() {
    return document.documentElement.getAttribute('data-storm') === 'true';
  }
  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function store(on) { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) {} }

  function noiseBuf() {
    var n = Math.floor(ac.sampleRate * 2);
    var b = ac.createBuffer(1, n, ac.sampleRate);
    var d = b.getChannelData(0), p = 0;
    for (var i = 0; i < n; i++) { p = p * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = p; }
    return b;
  }

  function makeBed(kind) {
    var out = ac.createGain(); out.gain.value = 0;
    var lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = kind === 'clear' ? 1400 : 780;
    var pad = ac.createGain(); pad.gain.value = kind === 'clear' ? 0.06 : 0.045;
    lp.connect(pad); pad.connect(out);
    var base = midi(ROOTS[kind] - 12);
    [-12, 0, 7].forEach(function (det, i) {
      var o = ac.createOscillator();
      o.type = i === 1 ? 'triangle' : 'sawtooth';
      o.frequency.value = i === 2 ? base * 2 : base;
      o.detune.value = det;
      var g = ac.createGain(); g.gain.value = i === 2 ? 0.16 : 0.32;
      o.connect(g); g.connect(lp); o.start();
    });
    var rain = ac.createGain(); rain.gain.value = 0;
    var src = ac.createBufferSource(); src.buffer = noiseBuf(); src.loop = true;
    var hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    src.connect(hp); hp.connect(rain); rain.connect(out); src.start();
    var notes = ac.createGain(); notes.connect(out);
    return { kind: kind, out: out, rain: rain, notes: notes, timer: null };
  }

  function note(bed) {
    if (!ac || !wanted) return;
    var sc = SCALES[bed.kind];
    var deg = sc[(Math.random() * sc.length) | 0];
    var oct = Math.random() < 0.3 ? 12 : 0;
    var f = midi(ROOTS[bed.kind] + deg + oct);
    var t = ac.currentTime, dur = 4 + Math.random() * 2.5;
    var o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bed.notes);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function schedule(bed) {
    if (bed.timer) clearTimeout(bed.timer);
    (function tick() {
      if (!wanted || current !== bed.kind) return;
      note(bed);
      bed.timer = setTimeout(tick, (bed.kind === 'clear' ? 2200 : 3000) + Math.random() * 2800);
    })();
  }

  function ensure() {
    if (ac) return;
    ac = new AC();
    beds.clear = makeBed('clear');
    beds.monsoon = makeBed('monsoon');
    beds.clear.out.connect(ac.destination);
    beds.monsoon.out.connect(ac.destination);
  }

  function fadeTo(kind) {
    if (!ac) return;
    var now = ac.currentTime;
    Object.keys(beds).forEach(function (k) {
      beds[k].out.gain.cancelScheduledValues(now);
      beds[k].out.gain.setValueAtTime(beds[k].out.gain.value, now);
      beds[k].out.gain.linearRampToValueAtTime(k === kind ? 0.9 : 0, now + 2.4);
      beds[k].rain.gain.linearRampToValueAtTime(
        k === kind && kind === 'monsoon' ? (storm() ? 0.04 : 0.02) : 0,
        now + 1.4
      );
    });
    current = kind;
    schedule(beds[kind]);
  }

  function sync() {
    if (btn) btn.setAttribute('aria-pressed', wanted ? 'true' : 'false');
    if (label) label.textContent = wanted ? 'playing' : 'sound';
    if (blurb) {
      blurb.textContent = wanted
        ? (season() === 'monsoon' ? 'Grey pad. Soft rain.' : 'Open pad. Sparse bells.')
        : 'The sky score. Off until you ask.';
    }
  }

  function start() {
    ensure();
    if (ac.state === 'suspended') ac.resume();
    wanted = true; store(true); fadeTo(season()); sync();
  }
  function stop() {
    wanted = false; store(false);
    if (ac) {
      var now = ac.currentTime;
      Object.keys(beds).forEach(function (k) {
        beds[k].out.gain.linearRampToValueAtTime(0, now + 0.6);
        if (beds[k].timer) clearTimeout(beds[k].timer);
      });
    }
    current = null; sync();
  }

  if (btn) btn.addEventListener('click', function () { wanted ? stop() : start(); });
  var theme = document.getElementById('theme');
  if (theme && window.Sky) theme.addEventListener('click', Sky.toggleTheme);
  window.addEventListener('weatherchange', function () { if (wanted) fadeTo(season()); sync(); });
  sync();

  try {
    if (localStorage.getItem(KEY) === 'on') {
      wanted = true; sync();
      var arm = function () {
        document.removeEventListener('pointerdown', arm);
        start();
      };
      document.addEventListener('pointerdown', arm, { once: true });
    }
  } catch (e) {}
})();
