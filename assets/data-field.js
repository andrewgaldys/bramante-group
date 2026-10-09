// Live background for the home page: a perspective "data terrain" of dots driven by
// layered waves, with a few tracked points whose readouts follow the surface height.
(function () {
  var canvas = document.getElementById('data-field');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var INK = '10,10,10';
  var BUCKETS = 10; // dots are batched by opacity so each frame needs only a few fills
  var w, h, cols, rows, depth, farP, farY, nearY, spreadX, ampY, nodes, topSafe, frame, lastLabelUpdate = 0;

  function surface(x, z, t) {
    return Math.sin(x * 0.16 + t * 0.55) * 0.55 +
      Math.sin(z * 0.21 - t * 0.42) * 0.45 +
      Math.sin((x + z) * 0.09 + t * 0.3) * 0.7 +
      Math.cos(Math.hypot(x - 10, z - 18) * 0.28 - t * 0.9) * 0.35;
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // The grid is wider than the screen so even the far edge spans the full width;
    // rows map from farY (top of the field) down past the bottom edge.
    var small = w < 640;
    rows = small ? 40 : 54;
    depth = 24;
    farP = depth / (rows - 1 + depth);
    var farSpacing = small ? 9 : 11;
    cols = Math.ceil((w * 1.15) / farSpacing / 2) * 2;
    spreadX = farSpacing / farP;
    farY = h * (w < 1024 ? 0.16 : 0.2);
    nearY = h * 1.04;
    ampY = h * (small ? 0.05 : 0.06);

    // Tracked points, placed by screen position (x fraction, depth fraction 0 = far)
    nodes = [[0.62, 0.12], [0.86, 0.3], [0.56, 0.55], [0.92, 0.06], [0.76, 0.82]].map(function (target) {
      var j = Math.round(target[1] * (rows - 1));
      var p = perspective(j);
      var i = Math.round((target[0] * w - w / 2) / (spreadX * p) + (cols - 1) / 2);
      return { i: i, j: j, label: '' };
    });
    lastLabelUpdate = 0;

    // Keep readouts out from under the header
    var header = document.querySelector('header');
    topSafe = header ? header.getBoundingClientRect().bottom + 6 : 0;
  }

  // j = 0 is the far edge, rows - 1 the nearest row
  function perspective(j) {
    return depth / (rows - 1 - j + depth);
  }

  function project(i, j, y) {
    var p = perspective(j);
    var rowY = nearY - (nearY - farY) * (1 - p) / (1 - farP);
    return { x: w / 2 + (i - (cols - 1) / 2) * spreadX * p, y: rowY - y * ampY * p, p: p };
  }

  function draw(t, now) {
    ctx.clearRect(0, 0, w, h);

    var buckets = [];
    for (var b = 0; b < BUCKETS; b++) buckets.push([]);
    var j, i, y, pt, alpha;

    // Faint contour lines every fourth row give the dots a surface-plot structure
    ctx.lineWidth = 1;
    for (j = 0; j < rows; j += 4) {
      ctx.beginPath();
      for (i = 0; i < cols; i++) {
        pt = project(i, j, surface(i, j, t));
        if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = 'rgba(' + INK + ',' + (0.035 + 0.07 * (pt.p - farP) / (1 - farP)).toFixed(3) + ')';
      ctx.stroke();
    }

    for (j = 0; j < rows; j++) {
      for (i = 0; i < cols; i++) {
        y = surface(i, j, t);
        pt = project(i, j, y);
        if (pt.x < -4 || pt.x > w + 4 || pt.y > h + 6) continue;
        alpha = (0.08 + 0.46 * Math.pow((pt.p - farP) / (1 - farP), 0.9)) * (0.65 + 0.35 * (y + 2) / 4);
        buckets[Math.min(BUCKETS - 1, Math.floor(alpha * BUCKETS / 0.54))].push(pt.x, pt.y, 0.55 + 1.5 * pt.p);
      }
    }

    for (b = 0; b < BUCKETS; b++) {
      var list = buckets[b];
      if (!list.length) continue;
      ctx.beginPath();
      for (var k = 0; k < list.length; k += 3) {
        ctx.moveTo(list[k] + list[k + 2], list[k + 1]);
        ctx.arc(list[k], list[k + 1], list[k + 2], 0, Math.PI * 2);
      }
      ctx.fillStyle = 'rgba(' + INK + ',' + ((b + 0.5) * 0.54 / BUCKETS).toFixed(3) + ')';
      ctx.fill();
    }

    // Tracked points: ring, leader line, and a readout of the local surface value
    var refreshLabels = now - lastLabelUpdate > 400;
    if (refreshLabels) lastLabelUpdate = now;
    ctx.font = '500 10px Inter, ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    nodes.forEach(function (n) {
      y = surface(n.i, n.j, t);
      pt = project(n.i, n.j, y);
      if (refreshLabels || !n.label) n.label = (50 + y * 12.5).toFixed(2);
      if (pt.y - 50 < topSafe) return;
      ctx.strokeStyle = 'rgba(' + INK + ',0.55)';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(' + INK + ',0.18)';
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y - 6);
      ctx.lineTo(pt.x, pt.y - 34);
      ctx.stroke();
      ctx.fillStyle = 'rgba(' + INK + ',0.55)';
      ctx.fillText(n.label, pt.x, pt.y - 40);
    });
  }

  function loop(now) {
    draw(now / 1000 * 0.6, now);
    frame = requestAnimationFrame(loop);
  }

  function start() {
    cancelAnimationFrame(frame);
    resize();
    if (reducedMotion.matches) draw(8, 0); // a single still frame
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
