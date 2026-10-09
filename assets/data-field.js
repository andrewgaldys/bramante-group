// Live background for the home page: a perspective "data terrain" of dots driven by layered waves.
// Built to be light on phones: wave terms are computed once per row/column, off-screen points are
// skipped entirely, dot buffers are reused between frames, and small screens draw at 30fps.
(function () {
  var canvas = document.getElementById('data-field');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var INK = '10,10,10';
  var TAU = Math.PI * 2;
  var BUCKETS = 10;      // dots are batched by opacity so each frame needs only a few fills
  var MAX_ALPHA = 0.54;
  var fills = [];
  for (var f = 0; f < BUCKETS; f++) fills.push('rgba(' + INK + ',' + ((f + 0.5) * MAX_ALPHA / BUCKETS).toFixed(3) + ')');

  var w, h, cols, rows, ampY, frameMs, frame, lastDraw = 0;
  var rowY, rowX0, rowStep, rowAmp, rowRadius, rowAlpha, rowStroke, rowLo, rowHi; // per-row geometry
  var cosD, sinD;                    // per-point basis for the radial ripple
  var colWave, rowWave, diagWave;    // per-frame wave terms
  var px, py, pr, pb, order;         // per-frame dot buffers
  var counts = new Int32Array(BUCKETS);

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var small = w < 640;
    frameMs = small ? 1000 / 30 : 0; // the waves are slow, so 30fps on phones looks the same and saves battery
    rows = small ? 40 : 54;
    var depth = 24;
    var farP = depth / (rows - 1 + depth);
    var farSpacing = small ? 9 : 11;
    cols = Math.ceil((w * 1.15) / farSpacing / 2) * 2; // wider than the screen so the far edge spans it
    var spreadX = farSpacing / farP;
    var header = document.querySelector('header');
    var farY = (header ? header.getBoundingClientRect().bottom : 0) + h * 0.025; // field starts just below the header
    var nearY = h * 1.04;
    ampY = h * (small ? 0.05 : 0.06);

    // Row j = 0 is the far edge, rows - 1 the nearest. Everything that depends only on the row is fixed here.
    rowY = new Float32Array(rows); rowX0 = new Float32Array(rows); rowStep = new Float32Array(rows);
    rowAmp = new Float32Array(rows); rowRadius = new Float32Array(rows); rowAlpha = new Float32Array(rows);
    rowLo = new Int32Array(rows); rowHi = new Int32Array(rows); rowStroke = [];
    for (var j = 0; j < rows; j++) {
      var p = depth / (rows - 1 - j + depth);
      var mix = (p - farP) / (1 - farP); // 0 far .. 1 near
      rowY[j] = nearY - (nearY - farY) * (1 - p) / (1 - farP);
      rowStep[j] = spreadX * p;
      rowX0[j] = w / 2 - (cols - 1) / 2 * rowStep[j];
      rowAmp[j] = ampY * p;
      rowRadius[j] = 0.55 + 1.5 * p;
      rowAlpha[j] = 0.08 + 0.46 * Math.pow(mix, 0.9);
      rowStroke.push('rgba(' + INK + ',' + (0.035 + 0.07 * mix).toFixed(3) + ')');
      // Only the columns that land on screen are ever computed
      rowLo[j] = Math.max(0, Math.ceil((-4 - rowX0[j]) / rowStep[j]));
      rowHi[j] = Math.min(cols - 1, Math.floor((w + 4 - rowX0[j]) / rowStep[j]));
    }

    var n = cols * rows;
    cosD = new Float32Array(n); sinD = new Float32Array(n);
    for (j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        var d = Math.hypot(i - 10, j - 18) * 0.28;
        cosD[j * cols + i] = Math.cos(d);
        sinD[j * cols + i] = Math.sin(d);
      }
    }
    colWave = new Float32Array(cols); rowWave = new Float32Array(rows); diagWave = new Float32Array(cols + rows);
    px = new Float32Array(n); py = new Float32Array(n); pr = new Float32Array(n);
    pb = new Uint8Array(n); order = new Int32Array(n);
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);

    // Surface height = column wave + row wave + diagonal wave + radial ripple.
    // cos(d - a) is expanded to cos(d)cos(a) + sin(d)sin(a) so the ripple needs no trig per point.
    var i, j, k, b;
    for (i = 0; i < cols; i++) colWave[i] = Math.sin(i * 0.16 + t * 0.55) * 0.55;
    for (j = 0; j < rows; j++) rowWave[j] = Math.sin(j * 0.21 - t * 0.42) * 0.45;
    for (k = 0; k < cols + rows; k++) diagWave[k] = Math.sin(k * 0.09 + t * 0.3) * 0.7;
    var rc = Math.cos(t * 0.9) * 0.35, rs = Math.sin(t * 0.9) * 0.35;

    var n = 0;
    counts.fill(0);
    ctx.lineWidth = 1;
    for (j = 0; j < rows; j++) {
      var lo = rowLo[j], hi = rowHi[j];
      if (lo > hi) continue;
      var contour = j % 4 === 0; // faint contour lines every fourth row give a surface-plot structure
      var from = contour ? Math.max(0, lo - 1) : lo, to = contour ? Math.min(cols - 1, hi + 1) : hi;
      var y0 = rowY[j], x0 = rowX0[j], step = rowStep[j], amp = rowAmp[j], rw = rowWave[j], alpha0 = rowAlpha[j];
      if (contour) ctx.beginPath();
      for (i = from; i <= to; i++) {
        k = j * cols + i;
        var y = colWave[i] + rw + diagWave[i + j] + cosD[k] * rc + sinD[k] * rs;
        var x = x0 + i * step, sy = y0 - y * amp;
        if (contour) { if (i === from) ctx.moveTo(x, sy); else ctx.lineTo(x, sy); }
        if (i < lo || i > hi || sy > h + 6) continue;
        b = Math.min(BUCKETS - 1, (alpha0 * (0.65 + 0.0875 * (y + 2)) * BUCKETS / MAX_ALPHA) | 0);
        px[n] = x; py[n] = sy; pr[n] = rowRadius[j]; pb[n] = b; counts[b]++; n++;
      }
      if (contour) { ctx.strokeStyle = rowStroke[j]; ctx.stroke(); }
    }

    // Group dots by opacity bucket (counting sort), then one path and one fill per bucket
    var start = 0, starts = [];
    for (b = 0; b < BUCKETS; b++) { starts.push(start); start += counts[b]; }
    for (k = 0; k < n; k++) order[starts[pb[k]]++] = k;
    start = 0;
    for (b = 0; b < BUCKETS; b++) {
      var end = start + counts[b];
      if (end === start) continue;
      ctx.beginPath();
      for (var s = start; s < end; s++) {
        k = order[s];
        ctx.moveTo(px[k] + pr[k], py[k]);
        ctx.arc(px[k], py[k], pr[k], 0, TAU);
      }
      ctx.fillStyle = fills[b];
      ctx.fill();
      start = end;
    }
  }

  function loop(now) {
    frame = requestAnimationFrame(loop);
    if (now - lastDraw < frameMs - 4) return;
    lastDraw = now;
    draw(now / 1000 * 0.6);
  }

  function start() {
    cancelAnimationFrame(frame);
    resize();
    if (reducedMotion.matches) draw(8); // a single still frame
    else frame = requestAnimationFrame(loop);
  }

  var resizeQueued = false;
  window.addEventListener('resize', function () {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(function () { resizeQueued = false; start(); });
  });
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', start);
  start();
})();
