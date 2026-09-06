'use strict';

/* =====================================================================
   surface
   ===================================================================== */

var canvas = document.getElementById('c');
var ctx = canvas.getContext('2d');
var uiEl = document.getElementById('ui');
var W = 0, H = 0, PLAY_H = 0, DPR = 1;

var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var lightQuery = window.matchMedia('(prefers-color-scheme: light)');

var THEME_KEY = 'playground-theme';
var chosen = null;
try { chosen = localStorage.getItem(THEME_KEY); } catch (err) {}
if (chosen !== 'light' && chosen !== 'dark') chosen = null;
var light = chosen ? chosen === 'light' : lightQuery.matches;

function bgColor() { return light ? '242,239,232' : '11,14,19'; }
function inkColor() { return light ? '28,31,38' : '232,226,214'; }

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  var uh = uiEl.getBoundingClientRect().height || 86;
  PLAY_H = Math.max(140, H - uh);
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = 'rgb(' + bgColor() + ')';
  ctx.fillRect(0, 0, W, H);
}
window.addEventListener('resize', resize);

/* =====================================================================
   helpers
   ===================================================================== */

function mtof(n) { return 440 * Math.pow(2, (n - 69) / 12); }

function buildRows(root, degrees, lo, hi) {
  var rows = [];
  for (var m = lo; m <= hi; m++) {
    if (degrees.indexOf(((m - root) % 12 + 12) % 12) !== -1) rows.push(m);
  }
  return rows;
}

function env(c, node, when, peak, attack, dur) {
  var g = node.gain;
  g.setValueAtTime(0.0001, when);
  g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + attack);
  g.exponentialRampToValueAtTime(0.0001, when + dur);
}

var noiseCache = Object.create(null);
function noiseBuf(c) {
  var k = 'n' + c.sampleRate;
  if (noiseCache[k]) return noiseCache[k];
  var len = Math.floor(c.sampleRate * 2);
  var b = c.createBuffer(1, len, c.sampleRate);
  var d = b.getChannelData(0);
  for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  noiseCache[k] = b;
  return b;
}
function noise(c, when, dur) {
  var s = c.createBufferSource();
  s.buffer = noiseBuf(c);
  s.loop = true;
  s.start(when);
  s.stop(when + dur + 0.05);
  return s;
}

var shaperCache = Object.create(null);
function shaper(c, amount) {
  var k = 's' + c.sampleRate + ':' + amount;
  var curve = shaperCache[k];
  if (!curve) {
    var n = 1024;
    curve = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    shaperCache[k] = curve;
  }
  var ws = c.createWaveShaper();
  ws.curve = curve;
  ws.oversample = '2x';
  return ws;
}

var ksCache = Object.create(null);
function ksBuffer(c, freq, bright) {
  var key = c.sampleRate + ':' + freq.toFixed(2) + ':' + bright.toFixed(1);
  if (ksCache[key]) return ksCache[key];
  var sr = c.sampleRate;
  var dur = Math.min(3.4, 1.6 + 900 / freq);
  var n = Math.max(2, Math.round(sr / freq));
  var len = Math.floor(sr * dur);
  var buf = c.createBuffer(1, len, sr);
  var out = buf.getChannelData(0);
  var line = new Float32Array(n);
  for (var i = 0; i < n; i++) line[i] = Math.random() * 2 - 1;
  var damp = 0.494 + 0.0055 * bright, loss = 0.9985;
  var idx = 0, prev = 0;
  for (var j = 0; j < len; j++) {
    var cur = line[idx];
    out[j] = cur;
    line[idx] = (cur + prev) * damp * loss;
    prev = cur;
    idx = (idx + 1) % n;
  }
  var fade = Math.floor(sr * 0.02);
  for (var k = 0; k < fade; k++) out[len - 1 - k] *= k / fade;
  ksCache[key] = buf;
  return buf;
}

/* =====================================================================
   instruments
   ===================================================================== */

var KIT = ['kick', 'tom', 'snare', 'rim', 'clap', 'hat', 'open'];

var INSTRUMENTS = [
  {
    id: 'glass', name: 'glass',
    root: 45, degrees: [0, 3, 5, 7, 10], lo: 45, hi: 93,
    wet: 0.46, decay: 2.6, mark: 'rings',
    voice: function (c, dry, wet, f, nz, tx, level, when) {
      var dur = 4.4 - 2.8 * nz;
      var g = c.createGain();
      env(c, g, when, (0.26 - 0.13 * nz) * level, 0.012, dur);
      var lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(500 + 5200 * tx * tx, when);
      lp.frequency.exponentialRampToValueAtTime(300 + 900 * tx, when + dur * 0.7);
      var o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
      var o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f;
      o2.detune.value = 4 + 9 * tx;
      var g2 = c.createGain(); g2.gain.value = 0.10 + 0.45 * tx;
      o1.connect(lp); o2.connect(g2); g2.connect(lp);
      lp.connect(g); g.connect(dry); g.connect(wet);
      o1.start(when); o2.start(when);
      o1.stop(when + dur + 0.1); o2.stop(when + dur + 0.1);
      return dur;
    }
  },
  {
    id: 'kalimba', name: 'kalimba',
    root: 48, degrees: [0, 2, 4, 7, 9], lo: 52, hi: 96,
    wet: 0.26, decay: 1.1, mark: 'spokes',
    voice: function (c, dry, wet, f, nz, tx, level, when) {
      var dur = 1.5 - 0.75 * nz;
      var g = c.createGain();
      env(c, g, when, (0.30 - 0.12 * nz) * level, 0.004, dur);
      var car = c.createOscillator(); car.type = 'sine'; car.frequency.value = f;
      var mod = c.createOscillator(); mod.type = 'sine'; mod.frequency.value = f * 3.01;
      var mg = c.createGain();
      mg.gain.setValueAtTime(f * (1.6 + 2.2 * tx), when);
      mg.gain.exponentialRampToValueAtTime(f * 0.02, when + 0.10);
      mod.connect(mg); mg.connect(car.frequency);
      var hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 140;
      car.connect(hp); hp.connect(g); g.connect(dry); g.connect(wet);
      car.start(when); mod.start(when);
      car.stop(when + dur + 0.1); mod.stop(when + dur + 0.1);
      return dur;
    }
  },
  {
    id: 'koto', name: 'koto',
    root: 45, degrees: [0, 1, 5, 7, 8], lo: 45, hi: 89,
    wet: 0.34, decay: 2.4, mark: 'string',
    voice: function (c, dry, wet, f, nz, tx, level, when) {
      var src = c.createBufferSource();
      src.buffer = ksBuffer(c, f, tx);
      var dur = src.buffer.duration;
      var g = c.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime((0.52 - 0.18 * nz) * level, when + 0.004);
      var lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 900 + 6500 * tx;
      src.connect(lp); lp.connect(g); g.connect(dry); g.connect(wet);
      src.start(when);
      return dur;
    }
  },
  {
    id: 'rhodes', name: 'rhodes',
    root: 50, degrees: [0, 2, 3, 5, 7, 9, 10], lo: 38, hi: 86,
    wet: 0.30, decay: 2.6, mark: 'bloom',
    voice: function (c, dry, wet, f, nz, tx, level, when) {
      var dur = 3.2 - 1.6 * nz;
      var g = c.createGain();
      env(c, g, when, (0.24 - 0.09 * nz) * level, 0.008, dur);
      var car = c.createOscillator(); car.type = 'sine'; car.frequency.value = f;
      var mod = c.createOscillator(); mod.type = 'sine'; mod.frequency.value = f * 2.0;
      var mg = c.createGain();
      mg.gain.setValueAtTime(f * (1.0 + 2.4 * tx), when);
      mg.gain.exponentialRampToValueAtTime(f * 0.06, when + 0.45);
      mod.connect(mg); mg.connect(car.frequency);
      var trem = c.createOscillator(); trem.type = 'sine'; trem.frequency.value = 4.6;
      var tg = c.createGain(); tg.gain.value = 0.10 * level;
      trem.connect(tg); tg.connect(g.gain);
      car.connect(g); g.connect(dry); g.connect(wet);
      car.start(when); mod.start(when); trem.start(when);
      car.stop(when + dur + 0.1); mod.stop(when + dur + 0.1); trem.stop(when + dur + 0.1);
      return dur;
    }
  },
  {
    id: 'bells', name: 'bells',
    root: 45, degrees: [0, 2, 4, 6, 8, 10], lo: 45, hi: 85,
    wet: 0.62, decay: 5.0, mark: 'star',
    voice: function (c, dry, wet, f, nz, tx, level, when) {
      var partials = [1, 2.00, 2.76, 5.40, 8.93];
      var amps = [1, 0.52, 0.36, 0.20, 0.11];
      var dur = 6.2 - 2.6 * nz;
      var out = c.createGain(); out.gain.value = (0.13 - 0.05 * nz) * level;
      for (var i = 0; i < partials.length; i++) {
        if (i > 2 && tx < 0.35) continue;
        var o = c.createOscillator();
        o.type = 'sine'; o.frequency.value = f * partials[i];
        var g = c.createGain();
        var pd = dur * (1 - i * 0.13);
        env(c, g, when, amps[i] * (0.4 + 0.6 * tx), 0.006, pd);
        o.connect(g); g.connect(out);
        o.start(when); o.stop(when + pd + 0.1);
      }
      out.connect(dry); out.connect(wet);
      return dur;
    }
  },
  {
    id: 'analog', name: 'analog',
    root: 45, degrees: [0, 3, 5, 7, 10], lo: 33, hi: 77,
    wet: 0.34, decay: 2.6, mark: 'band',
    voice: function (c, dry, wet, f, nz, tx, level, when) {
      var dur = 3.0 - 1.2 * nz;
      var g = c.createGain();
      env(c, g, when, (0.16 - 0.05 * nz) * level, 0.024, dur);
      var lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.Q.value = 6 + 6 * tx;
      lp.frequency.setValueAtTime(Math.min(f * (4 + 14 * tx), 12000), when);
      lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.2, 60), when + dur * 0.75);
      var dets = [-8, 0, 7];
      for (var i = 0; i < 3; i++) {
        var o = c.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dets[i];
        var og = c.createGain(); og.gain.value = 0.33;
        o.connect(og); og.connect(lp);
        o.start(when); o.stop(when + dur + 0.1);
      }
      lp.connect(g); g.connect(dry); g.connect(wet);
      return dur;
    }
  },

  /* ---- electronic ---- */

  {
    id: 'pad', name: 'pad',
    root: 45, degrees: [0, 3, 5, 7, 10], lo: 45, hi: 81,
    wet: 0.58, decay: 4.5, mark: 'veil',
    voice: function (c, dry, wet, f, nz, tx, level, when) {
      var dur = 6.0 - 1.8 * nz;
      var g = c.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(0.10 * level, when + 0.55);
      g.gain.setValueAtTime(0.10 * level, when + dur * 0.45);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      var lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.Q.value = 1.2;
      lp.frequency.setValueAtTime(Math.max(f * 1.4, 180), when);
      lp.frequency.linearRampToValueAtTime(Math.min(f * (5 + 9 * tx), 9000), when + dur * 0.5);
      var lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.22;
      var lg = c.createGain(); lg.gain.value = 7;
      lfo.connect(lg);
      var dets = [-14, -5, 4, 12];
      for (var i = 0; i < 4; i++) {
        var o = c.createOscillator();
        o.type = i % 2 ? 'sawtooth' : 'triangle';
        o.frequency.value = f * (i === 3 ? 2 : 1);
        o.detune.value = dets[i];
        lg.connect(o.detune);
        var og = c.createGain(); og.gain.value = i === 3 ? 0.12 : 0.28;
        o.connect(og); og.connect(lp);
        o.start(when); o.stop(when + dur + 0.1);
      }
      lfo.start(when); lfo.stop(when + dur + 0.1);
      lp.connect(g); g.connect(dry); g.connect(wet);
      return dur;
    }
  },
  {
    id: 'acid', name: 'acid',
    root: 45, degrees: [0, 3, 5, 6, 7, 10], lo: 33, hi: 69,
    wet: 0.18, decay: 1.0, mark: 'zag',
    voice: function (c, dry, wet, f, nz, tx, level, when) {
      var dur = 0.62 - 0.18 * nz;
      var g = c.createGain();
      env(c, g, when, 0.20 * level, 0.006, dur);
      var lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 11 + 9 * tx;
      var top = Math.min(f * (5 + 22 * tx), 11000);
      lp.frequency.setValueAtTime(top, when);
      lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.1, 70), when + dur * 0.85);
      var o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 0.985, when);
      o.frequency.exponentialRampToValueAtTime(f, when + 0.045);
      var ws = shaper(c, 2.4 + 2 * tx);
      o.connect(lp); lp.connect(ws); ws.connect(g);
      g.connect(dry); g.connect(wet);
      o.start(when); o.stop(when + dur + 0.1);
      return dur;
    }
  },
  {
    id: 'pulse', name: 'pulse',
    root: 48, degrees: [0, 2, 4, 7, 9], lo: 48, hi: 96,
    wet: 0.28, decay: 0.9, mark: 'grid',
    voice: function (c, dry, wet, f, nz, tx, level, when) {
      var dur = 0.55 - 0.2 * nz;
      var g = c.createGain();
      env(c, g, when, (0.16 - 0.05 * nz) * level, 0.003, dur);
      var lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1400 + 9000 * tx; lp.Q.value = 1;
      for (var i = 0; i < 2; i++) {
        var o = c.createOscillator();
        o.type = 'square';
        o.frequency.value = f;
        o.detune.value = i ? 11 : -11;
        var og = c.createGain(); og.gain.value = 0.4;
        o.connect(og); og.connect(lp);
        o.start(when); o.stop(when + dur + 0.05);
      }
      var sub = c.createOscillator();
      sub.type = 'square'; sub.frequency.value = f / 2;
      var sg = c.createGain(); sg.gain.value = 0.12 + 0.16 * (1 - tx);
      sub.connect(sg); sg.connect(lp);
      sub.start(when); sub.stop(when + dur + 0.05);
      lp.connect(g); g.connect(dry); g.connect(wet);
      return dur;
    }
  },
  {
    id: 'beats', name: 'beats',
    kit: true, wet: 0.16, decay: 0.8, mark: 'hits',
    voice: function (c, dry, wet, f, nz, tx, level, when, row) {
      var kind = KIT[row] || 'kick';
      var g = c.createGain();
      g.gain.value = level;
      g.connect(dry); g.connect(wet);
      var dur = 0.4, o, n, bp, hp, i;

      if (kind === 'kick' || kind === 'tom') {
        var top = kind === 'kick' ? 118 : 260;
        var bot = kind === 'kick' ? 44 : 116;
        dur = kind === 'kick' ? 0.42 : 0.38;
        o = c.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(top, when);
        o.frequency.exponentialRampToValueAtTime(bot, when + 0.09);
        var kg = c.createGain();
        env(c, kg, when, 0.72, 0.003, dur);
        o.connect(kg); kg.connect(g);
        o.start(when); o.stop(when + dur + 0.05);
        var cl = noise(c, when, 0.02);
        var cg = c.createGain();
        env(c, cg, when, 0.10, 0.001, 0.02);
        var chp = c.createBiquadFilter(); chp.type = 'highpass'; chp.frequency.value = 1200;
        cl.connect(chp); chp.connect(cg); cg.connect(g);

      } else if (kind === 'snare' || kind === 'rim') {
        dur = kind === 'snare' ? 0.22 : 0.06;
        n = noise(c, when, dur);
        bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = kind === 'snare' ? 1900 : 2600;
        bp.Q.value = kind === 'snare' ? 0.9 : 6;
        var ng = c.createGain();
        env(c, ng, when, kind === 'snare' ? 0.34 : 0.30, 0.002, dur);
        n.connect(bp); bp.connect(ng); ng.connect(g);
        if (kind === 'snare') {
          var body = c.createOscillator();
          body.type = 'triangle'; body.frequency.value = 184;
          var bg = c.createGain();
          env(c, bg, when, 0.16, 0.002, 0.10);
          body.connect(bg); bg.connect(g);
          body.start(when); body.stop(when + 0.15);
        }

      } else if (kind === 'clap') {
        dur = 0.26;
        for (i = 0; i < 3; i++) {
          var t = when + i * 0.013;
          var cn = noise(c, t, 0.05);
          var cbp = c.createBiquadFilter();
          cbp.type = 'bandpass'; cbp.frequency.value = 1250; cbp.Q.value = 1.4;
          var cgn = c.createGain();
          env(c, cgn, t, 0.24, 0.001, i === 2 ? 0.2 : 0.035);
          cn.connect(cbp); cbp.connect(cgn); cgn.connect(g);
        }

      } else {
        dur = kind === 'open' ? 0.42 : 0.055;
        n = noise(c, when, dur);
        hp = c.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 7600;
        var hg = c.createGain();
        env(c, hg, when, kind === 'open' ? 0.14 : 0.20, 0.001, dur);
        n.connect(hp); hp.connect(hg); hg.connect(g);
      }
      return dur;
    }
  }
];

var inst = INSTRUMENTS[0];
var ROWS = [], N = 0;

function rowsFor(I) {
  if (I.kit) return null;
  return buildRows(I.root, I.degrees, I.lo, I.hi);
}
function rowCountFor(I) { return I.kit ? KIT.length : rowsFor(I).length; }

function loadRows() {
  ROWS = rowsFor(inst);
  N = inst.kit ? KIT.length : ROWS.length;
}
loadRows();

function rowAt(y) {
  var i = Math.floor((1 - y / PLAY_H) * N);
  return i < 0 ? 0 : (i > N - 1 ? N - 1 : i);
}

/* =====================================================================
   audio graph
   ===================================================================== */

var AC = window.AudioContext || window.webkitAudioContext;
var ac = null, dry = null, wetGain = null, voices = 0;

function impulse(c, seconds, decay) {
  var len = Math.floor(c.sampleRate * seconds);
  var buf = c.createBuffer(2, len, c.sampleRate);
  for (var ch = 0; ch < 2; ch++) {
    var d = buf.getChannelData(ch);
    for (var i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

function buildGraph(c, tail) {
  var master = c.createGain();
  master.gain.value = 0.8;
  var comp = c.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 20;
  comp.ratio.value = 5;
  comp.attack.value = 0.004;
  comp.release.value = 0.22;
  master.connect(comp); comp.connect(c.destination);
  var d = c.createGain(); d.gain.value = 1; d.connect(master);
  var conv = c.createConvolver();
  conv.buffer = impulse(c, tail, 2.6);
  var w = c.createGain(); w.gain.value = 0.4;
  w.connect(conv); conv.connect(master);
  return { dry: d, wet: w };
}

function initAudio() {
  if (ac || !AC) return;
  ac = new AC();
  var g = buildGraph(ac, 4.2);
  dry = g.dry; wetGain = g.wet;
}
function wakeAudio() {
  initAudio();
  if (ac && ac.state === 'suspended') ac.resume();
}

/* per-instrument reverb send, so layers of different instruments
   keep their own room instead of fighting over one global knob */
var sends = Object.create(null);
function sendFor(I) {
  if (!ac) return null;
  if (!sends[I.id]) {
    var s = ac.createGain();
    s.gain.value = I.wet;
    s.connect(wetGain);
    sends[I.id] = s;
  }
  return sends[I.id];
}
