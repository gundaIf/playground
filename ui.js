'use strict';

/* =====================================================================
   qwerty as an instrument
   three rows of keys, low to high, left to right is dark to bright
   ===================================================================== */

var KEYROWS = [
  'zxcvbnm,./',
  "asdfghjkl;",
  'qwertyuiop'
];
var keyMap = Object.create(null);
KEYROWS.forEach(function (rowStr, ri) {
  for (var i = 0; i < rowStr.length; i++) {
    keyMap[rowStr[i]] = { step: ri * 6 + i, col: i / (rowStr.length - 1) };
  }
});
var held = Object.create(null);

function playKey(k) {
  var spot = keyMap[k];
  if (!spot) return false;
  wakeAudio();
  touched = true;
  lastTouch = performance.now();
  var step = Math.min(spot.step, N - 1);
  /* start a few rows up from the bottom so low notes stay reachable */
  var idx = Math.min(N - 1, step + Math.floor(N * 0.12));
  var ny = 1 - (idx + 0.5) / N;
  var nx = 0.12 + 0.76 * spot.col;
  strike(nx, ny, 0.92);
  capture(nx, ny, 0.92);
  return true;
}

/* =====================================================================
   controls
   ===================================================================== */

var recBtn = document.getElementById('rec');
var recLabel = document.getElementById('reclabel');
var playBtn = document.getElementById('play');
var snapBtn = document.getElementById('snap');
var undoBtn = document.getElementById('undo');
var saveBtn = document.getElementById('save');
var clearBtn = document.getElementById('clear');
var themeBtn = document.getElementById('theme');
var bpmVal = document.getElementById('bpmval');
var layersEl = document.getElementById('layers');
var instsEl = document.getElementById('insts');
var rendering = false;

function refresh() {
  var has = layers.length > 0;
  recBtn.classList.toggle('armed', recState === 'armed');
  recBtn.classList.toggle('on', recState === 'recording');
  recLabel.textContent =
    recState === 'recording' ? 'recording' :
    recState === 'armed' ? 'armed' : 'record';
  playBtn.textContent = playing ? 'stop' : 'play';
  playBtn.disabled = !has && recState === 'off';
  undoBtn.disabled = !has;
  saveBtn.disabled = !has || rendering;
  clearBtn.disabled = !has;
  bpmVal.textContent = bpm;
  snapBtn.setAttribute('aria-pressed', snapOn ? 'true' : 'false');
}

function renderLayers() {
  layersEl.innerHTML = '';
  layers.forEach(function (L, i) {
    var b = document.createElement('button');
    b.className = 'chip' + (L.muted ? ' muted' : '');
    b.textContent = (i + 1) + ' ' + L.label;
    b.setAttribute('aria-pressed', L.muted ? 'false' : 'true');
    b.title = 'mute or unmute this layer';
    b.addEventListener('click', function () {
      L.muted = !L.muted;
      renderLayers(); wake();
    });
    layersEl.appendChild(b);
  });
  refresh();
}

recBtn.addEventListener('click', function () {
  wakeAudio();
  if (recState !== 'off') {
    if (recState === 'recording') commitLayer(); else recState = 'off';
    refresh(); wake();
    return;
  }
  if (layers.length >= MAX_LAYERS) return;
  if (!playing) {
    recState = 'recording';
    recNotes = [];
    startTransport(true);
  } else {
    recState = 'armed';   /* drops in at the top of the next cycle */
  }
  refresh(); wake();
});

playBtn.addEventListener('click', function () {
  if (playing) stopTransport(); else startTransport(false);
  wake();
});

snapBtn.addEventListener('click', function () {
  snapOn = !snapOn;
  refresh(); wake();
});

document.getElementById('bpmdown').addEventListener('click', function () {
  bpm = Math.max(60, bpm - 5); refresh(); wake();
});
document.getElementById('bpmup').addEventListener('click', function () {
  bpm = Math.min(180, bpm + 5); refresh(); wake();
});

undoBtn.addEventListener('click', function () {
  layers.pop();
  if (!layers.length && playing) stopTransport();
  renderLayers(); wake();
});

clearBtn.addEventListener('click', function () {
  stopTransport();
  layers = [];
  renderLayers(); wake();
});

/* =====================================================================
   export
   ===================================================================== */

function encodeWAV(buffer) {
  var ch = buffer.numberOfChannels, len = buffer.length, sr = buffer.sampleRate;
  var data = new DataView(new ArrayBuffer(44 + len * ch * 2));
  function str(off, s) {
    for (var i = 0; i < s.length; i++) data.setUint8(off + i, s.charCodeAt(i));
  }
  str(0, 'RIFF'); data.setUint32(4, 36 + len * ch * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); data.setUint32(16, 16, true);
  data.setUint16(20, 1, true); data.setUint16(22, ch, true);
  data.setUint32(24, sr, true); data.setUint32(28, sr * ch * 2, true);
  data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
  str(36, 'data'); data.setUint32(40, len * ch * 2, true);
  var chans = [];
  for (var c = 0; c < ch; c++) chans.push(buffer.getChannelData(c));
  var off = 44;
  for (var i = 0; i < len; i++) {
    for (var c2 = 0; c2 < ch; c2++) {
      var s = Math.max(-1, Math.min(1, chans[c2][i]));
      data.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([data], { type: 'audio/wav' });
}

var REPEATS = 4;

saveBtn.addEventListener('click', function () {
  if (!layers.length || rendering) return;
  var OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OC) return;
  rendering = true;
  saveBtn.textContent = 'rendering';
  refresh();

  var cd = cycleDur();
  var seconds = cd * REPEATS + 6;
  var oc = new OC(2, Math.ceil(44100 * seconds), 44100);
  var g = buildGraph(oc, 4.2);
  var offSends = Object.create(null);

  function offSend(I) {
    if (!offSends[I.id]) {
      var s = oc.createGain();
      s.gain.value = I.wet;
      s.connect(g.wet);
      offSends[I.id] = s;
    }
    return offSends[I.id];
  }

  for (var rep = 0; rep < REPEATS; rep++) {
    for (var li = 0; li < layers.length; li++) {
      var L = layers[li];
      if (L.muted) continue;
      for (var ni = 0; ni < L.notes.length; ni++) {
        var nt = L.notes[ni];
        var I = INSTRUMENTS[nt.inst];
        var rows = rowsFor(I);
        var n = I.kit ? KIT.length : rows.length;
        var idx = Math.floor((1 - nt.ny) * n);
        if (idx < 0) idx = 0;
        if (idx > n - 1) idx = n - 1;
        I.voice(oc, g.dry, offSend(I),
          I.kit ? 100 : mtof(rows[idx]),
          n > 1 ? idx / (n - 1) : 0,
          Math.max(0, Math.min(1, nt.nx)),
          nt.level,
          0.1 + rep * cd + nt.beat * beatDur(),
          idx);
      }
    }
  }

  oc.startRendering().then(function (buf) {
    var url = URL.createObjectURL(encodeWAV(buf));
    var a = document.createElement('a');
    var stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    a.href = url;
    a.download = 'playground-' + bpm + 'bpm-' + stamp + '.wav';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  })['catch'](function () {})
    .then(function () {
      rendering = false;
      saveBtn.textContent = 'save';
      refresh(); wake();
    });
});

/* =====================================================================
   instrument picker + theme
   ===================================================================== */

INSTRUMENTS.forEach(function (I, idx) {
  var b = document.createElement('button');
  b.textContent = I.name;
  b.setAttribute('aria-pressed', idx === 0 ? 'true' : 'false');
  b.addEventListener('click', function () { pick(idx, true); });
  instsEl.appendChild(b);
});

function pick(idx, audition) {
  inst = INSTRUMENTS[idx];
  loadRows();
  wakeAudio();
  Array.prototype.forEach.call(instsEl.children, function (el, i) {
    el.setAttribute('aria-pressed', i === idx ? 'true' : 'false');
  });
  touched = true;
  wake();
  if (audition) strike(0.5, inst.kit ? 0.95 : 0.42, 0.55);
}

function applyTheme() {
  var mode = chosen || (lightQuery.matches ? 'light' : 'dark');
  light = mode === 'light';
  document.documentElement.setAttribute('data-theme', mode);
  themeBtn.textContent = light ? 'dark' : 'light';
  themeBtn.setAttribute('aria-label', 'switch to ' + themeBtn.textContent + ' mode');
  if (W && H) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgb(' + bgColor() + ')';
    ctx.fillRect(0, 0, W, H);
  }
}
themeBtn.addEventListener('click', function () {
  chosen = light ? 'dark' : 'light';
  try { localStorage.setItem(THEME_KEY, chosen); } catch (err) {}
  applyTheme(); wake();
});
if (lightQuery.addEventListener) {
  lightQuery.addEventListener('change', function () { if (!chosen) applyTheme(); });
}

/* =====================================================================
   keyboard
   letters play notes; transport lives on the non-letter keys
   ===================================================================== */

window.addEventListener('keydown', function (e) {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  var tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  var k = (e.key || '').toLowerCase();

  if (k >= '0' && k <= '9') {
    var n = k === '0' ? 10 : parseInt(k, 10);
    if (n <= INSTRUMENTS.length) { pick(n - 1, true); e.preventDefault(); }
    return;
  }
  if (k === ' ') { playBtn.click(); e.preventDefault(); return; }
  if (k === 'enter') { recBtn.click(); e.preventDefault(); return; }
  if (k === 'backspace') { if (!undoBtn.disabled) undoBtn.click(); e.preventDefault(); return; }
  if (k === '\\') { themeBtn.click(); e.preventDefault(); return; }
  if (k === "'") { snapBtn.click(); e.preventDefault(); return; }
  if (k === '-') { document.getElementById('bpmdown').click(); return; }
  if (k === '=' || k === '+') { document.getElementById('bpmup').click(); return; }

  if (keyMap[k] && !held[k]) {
    held[k] = true;
    if (playKey(k)) e.preventDefault();
  }
});
window.addEventListener('keyup', function (e) {
  delete held[(e.key || '').toLowerCase()];
});

/* =====================================================================
   go
   ===================================================================== */

resize();
applyTheme();
renderLayers();
wake();
requestAnimationFrame(frame);
