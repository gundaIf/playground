'use strict';

/* =====================================================================
   striking a note
   ===================================================================== */

function strike(nx, ny, level, instrument, when) {
  var I = instrument || inst;
  var rows = (I === inst) ? ROWS : rowsFor(I);
  var n = I.kit ? KIT.length : rows.length;
  var i = Math.floor((1 - ny) * n);
  if (i < 0) i = 0;
  if (i > n - 1) i = n - 1;
  var nz = n > 1 ? i / (n - 1) : 0;
  var f = I.kit ? 100 : mtof(rows[i]);
  var tx = Math.max(0, Math.min(1, nx));

  if (ac) {
    var at = (when === undefined)
      ? ac.currentTime + 0.02
      : Math.max(when, ac.currentTime + 0.005);
    var immediate = (at - ac.currentTime) < 0.15;
    if (!immediate || voices < 24) {
      var d = I.voice(ac, dry, sendFor(I), f, nz, tx, level, at, i);
      if (immediate) {
        voices++;
        setTimeout(function () { voices--; }, (d + 0.4) * 1000);
      }
    }
  }

  var delay = (when === undefined || !ac) ? 0 : Math.max(0, (when - ac.currentTime) * 1000);
  if (delay < 16) addMark(I, nx, ny, nz, level, i, n);
  else setTimeout(function () { addMark(I, nx, ny, nz, level, i, n); }, delay);
}

/* =====================================================================
   marks
   ===================================================================== */

var marks = [];

function addMark(I, nx, ny, nz, level, rowIndex, rowCount) {
  var base = Math.min(W, PLAY_H);
  marks.push({
    kind: I.mark,
    x: nx * W,
    y: ny * PLAY_H,
    rowY: PLAY_H - (rowIndex + 0.5) * (PLAY_H / rowCount),
    max: base * (0.62 - 0.42 * nz),
    born: performance.now(),
    life: reduceMotion ? 900 : I.decay * 640,
    level: level,
    nz: nz,
    row: rowIndex,
    seed: Math.random() * Math.PI * 2
  });
  if (marks.length > 160) marks.splice(0, marks.length - 160);
}

function easeOut(p) { return 1 - Math.pow(1 - p, 3); }

function drawMark(m, now, ink) {
  var q = (now - m.born) / m.life;
  if (q >= 1) return false;
  var e = easeOut(q);
  var fade = Math.pow(1 - q, 1.7) * m.level;
  var r = m.max * e;
  var i;

  if (q < 0.5 && m.kind !== 'hits') {
    ctx.strokeStyle = 'rgba(' + ink + ',' + ((1 - q / 0.5) * 0.07 * m.level).toFixed(4) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, m.rowY + 0.5); ctx.lineTo(W, m.rowY + 0.5); ctx.stroke();
  }

  if (m.kind === 'rings') {
    ctx.strokeStyle = 'rgba(' + ink + ',' + (fade * 0.16).toFixed(4) + ')';
    ctx.lineWidth = 7 * (1 - e) + 1;
    ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, 6.2832); ctx.stroke();
    ctx.strokeStyle = 'rgba(' + ink + ',' + (fade * 0.46).toFixed(4) + ')';
    ctx.lineWidth = Math.max(0.5, 2.2 * (1 - e));
    ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, 6.2832); ctx.stroke();
    ctx.strokeStyle = 'rgba(' + ink + ',' + (fade * 0.18).toFixed(4) + ')';
    ctx.beginPath(); ctx.arc(m.x, m.y, r * 0.62, 0, 6.2832); ctx.stroke();

  } else if (m.kind === 'spokes') {
    var rot = m.seed + e * 0.5;
    ctx.strokeStyle = 'rgba(' + ink + ',' + (fade * 0.55).toFixed(4) + ')';
    ctx.lineWidth = Math.max(0.6, 2.4 * (1 - e));
    for (i = 0; i < 7; i++) {
      var a = rot + i * (6.2832 / 7);
      var r0 = r * 0.42, r1 = r * (0.72 + 0.28 * ((i % 3) / 2));
      ctx.beginPath();
      ctx.moveTo(m.x + Math.cos(a) * r0, m.y + Math.sin(a) * r0);
      ctx.lineTo(m.x + Math.cos(a) * r1, m.y + Math.sin(a) * r1);
      ctx.stroke();
    }

  } else if (m.kind === 'string') {
    var amp = (1 - q) * (1 - q) * (26 + 40 * (1 - m.nz)) * m.level;
    var wavelen = 90 + 420 * m.nz;
    var phase = (now - m.born) / 42 + m.seed;
    ctx.strokeStyle = 'rgba(' + ink + ',' + (fade * 0.62).toFixed(4) + ')';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (var px = 0; px <= W; px += 4) {
      var falloff = Math.exp(-Math.pow((px - m.x) / (W * 0.45), 2));
      var yy = m.rowY + Math.sin(px / wavelen * 6.2832 + phase) * amp * falloff;
      if (px === 0) ctx.moveTo(px, yy); else ctx.lineTo(px, yy);
    }
    ctx.stroke();

  } else if (m.kind === 'bloom') {
    var grad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, Math.max(r, 1));
    grad.addColorStop(0, 'rgba(' + ink + ',' + (fade * 0.30).toFixed(4) + ')');
    grad.addColorStop(0.45, 'rgba(' + ink + ',' + (fade * 0.10).toFixed(4) + ')');
    grad.addColorStop(1, 'rgba(' + ink + ',0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, 6.2832); ctx.fill();

  } else if (m.kind === 'star') {
    var rot2 = m.seed + e * 0.9;
    ctx.strokeStyle = 'rgba(' + ink + ',' + (fade * 0.42).toFixed(4) + ')';
    ctx.lineWidth = Math.max(0.5, 1.6 * (1 - e));
    for (var ring = 0; ring < 2; ring++) {
      var rr = r * (ring ? 0.55 : 1);
      ctx.beginPath();
      for (i = 0; i <= 6; i++) {
        var ang = rot2 + i * (6.2832 / 6) + ring * 0.5;
        var xx = m.x + Math.cos(ang) * rr, yy2 = m.y + Math.sin(ang) * rr;
        if (i === 0) ctx.moveTo(xx, yy2); else ctx.lineTo(xx, yy2);
      }
      ctx.stroke();
    }

  } else if (m.kind === 'band') {
    var h = (14 + 54 * (1 - m.nz)) * (1 - q * 0.6) * m.level;
    var wob = (1 - q) * 10;
    ctx.strokeStyle = 'rgba(' + ink + ',' + (fade * 0.34).toFixed(4) + ')';
    ctx.lineWidth = 1;
    for (var s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      for (var qx = 0; qx <= W; qx += 6) {
        var yv = m.rowY + s * h / 2 + Math.sin(qx / 60 + m.seed + q * 6) * wob;
        if (qx === 0) ctx.moveTo(qx, yv); else ctx.lineTo(qx, yv);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(' + ink + ',' + (fade * 0.05).toFixed(4) + ')';
    ctx.fillRect(0, m.rowY - h / 2, W, h);

  } else if (m.kind === 'veil') {
    var vh = PLAY_H * (0.16 + 0.20 * (1 - m.nz)) * (0.5 + 0.5 * e);
    var vg = ctx.createLinearGradient(0, m.rowY - vh / 2, 0, m.rowY + vh / 2);
    vg.addColorStop(0, 'rgba(' + ink + ',0)');
    vg.addColorStop(0.5, 'rgba(' + ink + ',' + (fade * 0.09).toFixed(4) + ')');
    vg.addColorStop(1, 'rgba(' + ink + ',0)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, m.rowY - vh / 2, W, vh);
    ctx.strokeStyle = 'rgba(' + ink + ',' + (fade * 0.13).toFixed(4) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, m.rowY); ctx.lineTo(W, m.rowY); ctx.stroke();

  } else if (m.kind === 'zag') {
    var steps = 9;
    var span = r * 1.5;
    ctx.strokeStyle = 'rgba(' + ink + ',' + (fade * 0.7).toFixed(4) + ')';
    ctx.lineWidth = Math.max(0.8, 2 * (1 - e));
    ctx.beginPath();
    for (i = 0; i <= steps; i++) {
      var t2 = i / steps;
      var zx = m.x - span / 2 + span * t2;
      var zy = m.y + Math.sin(t2 * 9 + m.seed) * (r * 0.34) * (1 - t2 * 0.5);
      if (i === 0) ctx.moveTo(zx, zy); else ctx.lineTo(zx, zy);
    }
    ctx.stroke();

  } else if (m.kind === 'grid') {
    var cells = 5;
    var sz = Math.max(2, r * 0.09);
    ctx.fillStyle = 'rgba(' + ink + ',' + (fade * 0.55).toFixed(4) + ')';
    for (i = 0; i < cells; i++) {
      var d2 = r * (0.25 + i * 0.19);
      var ang2 = m.seed + i * 1.1;
      ctx.fillRect(m.x + Math.cos(ang2) * d2 - sz / 2,
                   m.y + Math.sin(ang2) * d2 - sz / 2, sz, sz);
      ctx.fillRect(m.x - Math.cos(ang2) * d2 - sz / 2,
                   m.y - Math.sin(ang2) * d2 - sz / 2, sz, sz);
    }

  } else if (m.kind === 'hits') {
    var weight = 1 - m.nz;
    var rr2 = (6 + 40 * weight) * (0.4 + e) * m.level;
    ctx.fillStyle = 'rgba(' + ink + ',' + (fade * 0.35).toFixed(4) + ')';
    ctx.beginPath(); ctx.arc(m.x, m.y, rr2, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(' + ink + ',' + (fade * 0.6).toFixed(4) + ')';
    ctx.lineWidth = 1;
    var ticks = 4 + m.row;
    for (i = 0; i < ticks; i++) {
      var ta = m.seed + i * (6.2832 / ticks);
      ctx.beginPath();
      ctx.moveTo(m.x + Math.cos(ta) * rr2 * 1.2, m.y + Math.sin(ta) * rr2 * 1.2);
      ctx.lineTo(m.x + Math.cos(ta) * rr2 * (1.6 + e), m.y + Math.sin(ta) * rr2 * (1.6 + e));
      ctx.stroke();
    }
  }

  if (q < 0.35 && ['string', 'band', 'veil', 'hits'].indexOf(m.kind) === -1) {
    ctx.fillStyle = 'rgba(' + ink + ',' + ((1 - q / 0.35) * 0.55 * m.level).toFixed(4) + ')';
    ctx.beginPath(); ctx.arc(m.x, m.y, 2.2, 0, 6.2832); ctx.fill();
  }
  return true;
}

/* =====================================================================
   transport, layers, quantize
   ===================================================================== */

var bpm = 100;
var BEATS = 16;
var snapOn = true;
var layers = [];
var MAX_LAYERS = 8;

var playing = false;
var cycleStart = 0;
var cycleTimer = null;

var recState = 'off';
var recNotes = [];

function beatDur() { return 60 / bpm; }
function cycleDur() { return BEATS * beatDur(); }

function scheduleCycle(start) {
  for (var i = 0; i < layers.length; i++) {
    var L = layers[i];
    if (L.muted) continue;
    for (var j = 0; j < L.notes.length; j++) {
      var nt = L.notes[j];
      strike(nt.nx, nt.ny, nt.level, INSTRUMENTS[nt.inst], start + nt.beat * beatDur());
    }
  }
}

function tick() {
  if (!playing) return;
  var next = cycleStart + cycleDur();
  var lead = (next - ac.currentTime - 0.18) * 1000;
  cycleTimer = setTimeout(function () {
    if (!playing) return;
    if (recState === 'recording') commitLayer();
    cycleStart = next;
    if (recState === 'armed') { recState = 'recording'; recNotes = []; }
    scheduleCycle(next);
    refresh();
    tick();
  }, Math.max(0, lead));
}

function startTransport(fromNow) {
  wakeAudio();
  if (!ac) return;
  playing = true;
  cycleStart = ac.currentTime + (fromNow ? 0.06 : 0.12);
  scheduleCycle(cycleStart);
  tick();
  refresh();
}

function stopTransport() {
  playing = false;
  clearTimeout(cycleTimer);
  if (recState === 'recording') commitLayer();
  recState = 'off';
  refresh();
}

function commitLayer() {
  if (recNotes.length && layers.length < MAX_LAYERS) {
    layers.push({ notes: recNotes.slice(), muted: false, label: labelFor(recNotes) });
  }
  recNotes = [];
  recState = 'off';
  renderLayers();
}

function labelFor(notes) {
  var counts = {};
  notes.forEach(function (n) { counts[n.inst] = (counts[n.inst] || 0) + 1; });
  var best = notes[0].inst, bestN = 0;
  Object.keys(counts).forEach(function (k) {
    if (counts[k] > bestN) { bestN = counts[k]; best = +k; }
  });
  return INSTRUMENTS[best].name;
}

function capture(nx, ny, level) {
  if (recState !== 'recording' || !ac) return;
  var beat = (ac.currentTime - cycleStart) / beatDur();
  if (snapOn) beat = Math.round(beat * 4) / 4;
  beat = beat % BEATS;
  if (beat < 0) beat += BEATS;
  if (recNotes.length > 160) return;
  recNotes.push({
    beat: beat, nx: nx, ny: ny, level: level,
    inst: INSTRUMENTS.indexOf(inst)
  });
}

/* =====================================================================
   canvas loop
   ===================================================================== */

var touched = false;

function frame() {
  var now = performance.now();
  var ink = inkColor();

  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(' + bgColor() + ',' + (reduceMotion ? 1 : 0.16) + ')';
  ctx.fillRect(0, 0, W, H);

  if (!light && !reduceMotion) ctx.globalCompositeOperation = 'lighter';
  for (var i = marks.length - 1; i >= 0; i--) {
    if (!drawMark(marks[i], now, ink)) marks.splice(i, 1);
  }
  ctx.globalCompositeOperation = 'source-over';

  if (!touched) {
    var b = (Math.sin(now / 1400) + 1) / 2;
    ctx.strokeStyle = 'rgba(' + ink + ',' + (0.05 + 0.06 * b).toFixed(4) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(W / 2, PLAY_H / 2, 16 + 10 * b, 0, 6.2832);
    ctx.stroke();
  }

  if (playing && ac) {
    var p = (ac.currentTime - cycleStart) / cycleDur();
    if (p < 0) p = 0; if (p > 1) p = 1;
    ctx.strokeStyle = 'rgba(' + ink + ',0.14)';
    ctx.lineWidth = 1;
    for (var bar = 1; bar < 4; bar++) {
      var bx = Math.round(W * (bar / 4)) + 0.5;
      ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx, 7); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(' + ink + ',' + (recState === 'recording' ? 0.55 : 0.3) + ')';
    ctx.lineWidth = recState === 'recording' ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(0, 1); ctx.lineTo(W * p, 1); ctx.stroke();
  }

  requestAnimationFrame(frame);
}

/* =====================================================================
   pointer input
   ===================================================================== */

var active = Object.create(null);
var lastTouch = performance.now();
var dimTimer = null;

function wake() {
  uiEl.classList.remove('dim');
  clearTimeout(dimTimer);
  dimTimer = setTimeout(function () { uiEl.classList.add('dim'); }, 4200);
}

canvas.addEventListener('pointerdown', function (e) {
  if (e.clientY > PLAY_H) return;
  wakeAudio();
  touched = true;
  lastTouch = performance.now();
  uiEl.classList.add('dim');
  clearTimeout(dimTimer);
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  var nx = e.clientX / W, ny = e.clientY / PLAY_H;
  active[e.pointerId] = { row: rowAt(e.clientY), t: performance.now() };
  strike(nx, ny, 1);
  capture(nx, ny, 1);
});

canvas.addEventListener('pointermove', function (e) {
  var a = active[e.pointerId];
  if (!a || e.clientY > PLAY_H) return;
  var r = rowAt(e.clientY);
  var now = performance.now();
  if (r !== a.row && now - a.t > 55) {
    a.row = r; a.t = now;
    lastTouch = now;
    var nx = e.clientX / W, ny = e.clientY / PLAY_H;
    strike(nx, ny, 0.62);
    capture(nx, ny, 0.62);
  }
});

function release(e) {
  if (active[e.pointerId]) {
    delete active[e.pointerId];
    lastTouch = performance.now();
    wake();
  }
}
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('pointerleave', release);
window.addEventListener('pointermove', function (e) {
  if (e.clientY > PLAY_H - 40) wake();
});

document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
document.addEventListener('visibilitychange', function () {
  if (!ac) return;
  if (document.hidden) {
    if (playing) stopTransport();
    ac.suspend();
  } else {
    ac.resume();
  }
});

function breathe() {
  setTimeout(function () {
    if (touched && !document.hidden && !playing &&
        performance.now() - lastTouch > 14000) {
      strike(0.15 + Math.random() * 0.7, 0.2 + Math.random() * 0.65, 0.4);
    }
    breathe();
  }, 3200 + Math.random() * 4200);
}
breathe();
