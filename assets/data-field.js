// Live background for the home page: a perspective "data terrain" of dots driven by layered waves.
// Links marked [data-node] are pinned to points on the surface and ride the waves with it.
(function () {
  var root = document.documentElement;
  var canvas = document.getElementById('data-field');
  if (!canvas || !canvas.getContext) { root.classList.remove('js'); return; }
  var ctx = canvas.getContext('2d');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var links = [].slice.call(document.querySelectorAll('[data-node]'));

  var INK = '10,10,10';
  var BUCKETS = 10; // dots are batched by opacity so each frame needs only a few fills
  var w, h, small, cols, rows, depth, farP, farY, nearY, spreadX, ampY, anchors = [], frame;

  function surface(x, z, t) {
    return Math.sin(x * 0.16 + t * 0.55) * 0.55 +
      Math.sin(z * 0.21 - t * 0.42) * 0.45 +
      Math.sin((x + z) * 0.09 + t * 0.3) * 0.7 +
      Math.cos(Math.hypot(x - 10, z - 18) * 0.28 - t * 0.9) * 0.35;
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

  // The row whose resting screen position is closest to y
  function rowAt(y) {
    var p = 1 - (nearY - y) * (1 - farP) / (nearY - farY);
    return Math.max(0, Math.min(rows - 1, Math.round(rows - 1 - depth / p + depth)));
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // The grid is wider than the screen so even the far edge spans the full width;
    // rows map from farY (just below the header) down past the bottom edge.
    small = w < 640;
    rows = small ? 40 : 54;
    depth = 24;
    farP = depth / (rows - 1 + depth);
    var farSpacing = small ? 9 : 11;
    cols = Math.ceil((w * 1.15) / farSpacing / 2) * 2;
    spreadX = farSpacing / farP;
    var header = document.querySelector('header');
    farY = (header ? header.getBoundingClientRect().bottom : 0) + h * 0.025;
    nearY = h * 1.04;
    ampY = h * (small ? 0.05 : 0.06);

    // Pin each link to the grid point nearest its target screen position ("x,y" as fractions)
    anchors = links.map(function (el, k) {
      var at = ((small && el.getAttribute('data-node-sm')) || el.getAttribute('data-node')).split(',').map(Number);
      var j = rowAt(at[1] * h);
      var p = perspective(j);
      var depthMix = (p - farP) / (1 - farP); // 0 far .. 1 near
      return {
        el: el,
        i: Math.round((at[0] * w - w / 2) / (spreadX * p) + (cols - 1) / 2),
        j: j,
        scale: 0.82 + 0.36 * depthMix,
        lead: (small ? 30 : 46) * (0.75 + 0.5 * depthMix),
        phase: k * 0.55
      };
    });
    root.classList.add('nodes-ready');
  }

  function draw(t, animate) {
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

    // Pinned links: pulse, ring, leader line, and the label riding above
    anchors.forEach(function (a) {
      pt = project(a.i, a.j, surface(a.i, a.j, t));
      var active = a.el.matches(':hover, :focus-visible');
      var r = active ? 6.5 : 4.5;

      if (animate) {
        var ph = ((t + a.phase) % 1.6) / 1.6;
        ctx.strokeStyle = 'rgba(' + INK + ',' + (0.3 * (1 - ph)).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r + ph * 18, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(' + INK + ',' + (active ? 0.95 : 0.7) + ')';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(' + INK + ',0.9)';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(' + INK + ',' + (active ? 0.7 : 0.3) + ')';
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y - r - 3);
      ctx.lineTo(pt.x, pt.y - a.lead);
      ctx.stroke();

      a.el.style.transform = 'translate3d(' + pt.x.toFixed(1) + 'px,' + (pt.y - a.lead - 4).toFixed(1) + 'px,0) translate(-50%,-100%) scale(' + a.scale.toFixed(3) + ')';
    });
  }

  function loop(now) {
    draw(now / 1000 * 0.6, true);
    frame = requestAnimationFrame(loop);
  }

  function start() {
    cancelAnimationFrame(frame);
    resize();
    if (reducedMotion.matches) draw(8, false); // a single still frame
    else frame = requestAnimationFrame(loop);
  }

  var resizeQueued = false;
  window.addEventListener('resize', function () {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(function () { resizeQueued = false; start(); });
  });
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', start);
  // In the still version, redraw on hover/focus so the pinned point still responds
  links.forEach(function (el) {
    ['mouseenter', 'mouseleave', 'focus', 'blur'].forEach(function (type) {
      el.addEventListener(type, function () { if (reducedMotion.matches) setTimeout(function () { draw(8, false); }, 0); });
    });
  });
  start();
})();
