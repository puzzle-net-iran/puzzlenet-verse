/* ════════════════════════════════════════════
   PuzzleNet Verse — world.js
   Main engine: camera, draw loop, interaction
   ════════════════════════════════════════════ */

(function() {
  'use strict';

  const R   = window.Renderer;
  const ROOMS = window.ROOMS;

  /* ── CANVAS SETUP ────────────────────────── */
  const canvas  = document.getElementById('world');
  const ctx     = canvas.getContext('2d');
  const mmCanvas = document.getElementById('minimap');
  const mctx    = mmCanvas.getContext('2d');

  let W = 0, H = 0;
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  /* ── CAMERA ──────────────────────────────── */
  const CAM = { x: 0, y: 0, scale: 1, targetX: 0, targetY: 0, targetScale: 1 };

  // Center camera on world initially
  function centerCamera() {
    const worldSpan = R.isoProject(R.COLS - 1, R.ROWS - 1);
    CAM.x = CAM.targetX = -W/2 + worldSpan.x/2;
    CAM.y = CAM.targetY = -H/2 + worldSpan.y/2 + 80;
    CAM.scale = CAM.targetScale = 0.9;
  }

  /* ── ROOM WORLD POSITIONS ────────────────── */
  ROOMS.forEach(room => {
    const iso = R.isoProject(room.col, room.row);
    room._wx  = iso.x;   // world center x
    room._wy  = iso.y;   // world center y
  });

  /* ── COORDINATE HELPERS ──────────────────── */
  function worldToScreen(wx, wy) {
    return {
      sx: (wx - CAM.x) * CAM.scale + W/2,
      sy: (wy - CAM.y) * CAM.scale + H/2,
    };
  }
  function screenToWorld(sx, sy) {
    return {
      wx: (sx - W/2) / CAM.scale + CAM.x,
      wy: (sy - H/2) / CAM.scale + CAM.y,
    };
  }

  /* ── PARTICLES ───────────────────────────── */
  const PALETTE = ['#00d4ff','#ff6b35','#00ff88','#8b5cf6','#ffd700','#ff69b4'];
  const particles = Array.from({ length: 60 }, (_, i) => ({
    wx: (Math.random() - 0.5) * 1800,
    wy: (Math.random() - 0.2) * 900,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.3,
    size: Math.random() * 3 + 1,
    color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
    alpha: Math.random() * 0.5 + 0.15,
    phase: Math.random() * Math.PI * 2,
    sx: 0, sy: 0,
  }));

  /* ── ANIMATED CHARS PER ROOM ─────────────── */
  // Assign each room a few character positions relative to room center
  ROOMS.forEach((room, ri) => {
    room._charPositions = room.chars.map((name, ci) => ({
      name,
      dx: (ci - room.chars.length/2 + 0.5) * 30,
      dy: ci % 2 === 0 ? -10 : 5,
      anim: ['idle','walk','type','idle'][ci % 4],
      idx: ri * 10 + ci,
    }));
  });

  /* ── ANIMATION TIME ──────────────────────── */
  let t = 0;
  let hoveredRoom = null;
  let selectedRoom = null;

  /* ══════════════════════════════════════════
     DRAW BACKGROUND
  ══════════════════════════════════════════ */
  function drawBackground() {
    const grad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)*0.8);
    grad.addColorStop(0, '#060d1a');
    grad.addColorStop(1, '#03080f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    const gs = 60 * CAM.scale;
    const ox = (W/2 - CAM.x * CAM.scale) % gs;
    const oy = (H/2 - CAM.y * CAM.scale) % gs;
    ctx.strokeStyle = 'rgba(0,212,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let x = ox; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = oy; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  }

  /* ══════════════════════════════════════════
     DRAW ONE ROOM (isometric puzzle piece)
  ══════════════════════════════════════════ */
  function drawRoom(room) {
    const { sx, sy } = worldToScreen(room._wx, room._wy);
    const sc   = CAM.scale;
    const hw   = R.TILE_W / 2 * sc;
    const hh   = R.TILE_H / 2 * sc;
    const exH  = R.ROOM_H * sc;

    // Culling
    if (sx + hw < -50 || sx - hw > W + 50 || sy + hh + exH < -50 || sy - hh > H + 50) return;

    const isHov = room === hoveredRoom;
    const isSel = room === selectedRoom;
    const locked = room.locked;
    const hoverY = (isHov || isSel) ? -6 * sc : 0;

    ctx.save();
    ctx.translate(sx, sy + hoverY);

    const s = sc; // local scale

    /* ── 3D EXTRUSION sides (draw before top) ── */
    // Shift down for side faces
    ctx.save();
    ctx.translate(0, exH * 0.5);

    // Left face (darker)
    const leftColor = shadeColor(room.accent || room.color, -40);
    R.drawExtrusionLeft(ctx, 0, 0, leftColor, locked ? 0.3 : 0.85);

    // Right face (medium)
    const rightColor = shadeColor(room.accent || room.color, -20);
    R.drawExtrusionRight(ctx, 0, 0, rightColor, locked ? 0.3 : 0.7);

    ctx.restore();

    /* ── TOP FACE (puzzle piece) ── */
    // Build path at local origin
    const fakeRoom = Object.assign({}, room, {
      tabs: room.tabs,
    });

    // Build puzzle path scaled
    ctx.save();
    ctx.scale(s, s);
    R.buildPuzzlePath(ctx, 0, 0, fakeRoom);
    ctx.restore();

    // Fill gradient
    if (!locked) {
      const grad = ctx.createRadialGradient(0, -hh*0.3, 0, 0, 0, hw * 1.2);
      grad.addColorStop(0, room.color + '55');
      grad.addColorStop(0.5, room.color + '22');
      grad.addColorStop(1, room.accent + '11');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = '#111a28';
    }
    ctx.fill();

    // Border glow
    ctx.strokeStyle = isHov || isSel ? room.color : room.color + '55';
    ctx.lineWidth   = isHov || isSel ? 2 / s : 1 / s;
    if (locked) ctx.setLineDash([4/s, 4/s]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Top accent line (N edge highlight)
    ctx.strokeStyle = room.color + (locked ? '33' : '99');
    ctx.lineWidth = 1.5 / s;
    ctx.beginPath();
    ctx.moveTo(-R.TILE_W/2, 0);
    ctx.lineTo(0, -R.TILE_H/2);
    ctx.lineTo(R.TILE_W/2, 0);
    ctx.stroke();

    // Inner glow on hover
    if (isHov || isSel) {
      ctx.save();
      ctx.scale(s, s);
      R.buildPuzzlePath(ctx, 0, 0, fakeRoom);
      ctx.restore();
      ctx.shadowColor = room.color;
      ctx.shadowBlur  = 20 * s;
      ctx.strokeStyle = room.color + 'aa';
      ctx.lineWidth   = 1.5 / s;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // ── ROOM CONTENT (icon + label) ──
    if (sc > 0.35) {
      // Icon
      const iconSize = Math.max(14, 26 * sc);
      ctx.font = `${iconSize}px serif`;
      ctx.textAlign = 'center';
      ctx.globalAlpha = locked ? 0.3 : 0.95;
      ctx.fillText(room.icon, 0, -8 * sc);

      // Name label
      if (sc > 0.45) {
        ctx.font = `bold ${Math.max(8, 11 * sc)}px 'Vazirmatn', sans-serif`;
        ctx.fillStyle = room.color;
        ctx.globalAlpha = locked ? 0.3 : 0.8;
        ctx.fillText(room.name, 0, 14 * sc);
      }

      if (locked) {
        ctx.font = `${Math.max(10, 14 * sc)}px serif`;
        ctx.fillStyle = '#ffffff44';
        ctx.globalAlpha = 0.6;
        ctx.fillText('🔒', 0, -22 * sc);
      }
      ctx.globalAlpha = 1;
    }

    /* ── CHARACTERS ── */
    if (sc > 0.6 && !locked) {
      room._charPositions.forEach((cp, ci) => {
        const cx = cp.dx * sc;
        const cy = cp.dy * sc - 18 * sc;
        R.drawCharacter(ctx, cx, cy, room.color, cp.anim, t, cp.idx);
      });
    }

    /* ── OBJECTS ── */
    if (sc > 0.7 && !locked) {
      const hasServer = room.objects.some(o => o.toLowerCase().includes('سرور') || o.toLowerCase().includes('hp'));
      const hasMonitor = room.objects.some(o => o.toLowerCase().includes('داشبورد') || o.toLowerCase().includes('کنسول') || o.toLowerCase().includes('پنل'));
      if (hasServer) R.drawServerRack(ctx, -30*sc, 10*sc, room.color, t);
      if (hasMonitor) R.drawMonitor(ctx, 30*sc, 0, room.color, t);
    }

    /* ── ROOM ID (debug, only at high zoom) ── */
    // (removed for production)

    ctx.restore();

    /* ── FLOATING LABEL ABOVE ROOM ── */
    if ((isHov || isSel) && sc > 0.4) {
      const lx = sx, ly = sy + hoverY - hh - 16 * sc;
      ctx.save();
      ctx.font = `bold ${Math.max(10, 13*sc)}px 'Vazirmatn', sans-serif`;
      ctx.textAlign = 'center';
      const label = room.name;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(3,8,15,0.88)';
      ctx.beginPath();
      ctx.roundRect(lx - tw/2 - 8, ly - 16*sc, tw + 16, 20*sc, 6);
      ctx.fill();
      ctx.strokeStyle = room.color + '66';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = room.color;
      ctx.fillText(label, lx, ly - 1*sc);
      ctx.restore();
    }
  }

  /* ══════════════════════════════════════════
     DRAW CONNECTION LINES BETWEEN ROOMS
  ══════════════════════════════════════════ */
  function drawConnections() {
    if (CAM.scale < 0.4) return;
    const pairsDone = new Set();
    ROOMS.forEach(room => {
      const neighbors = getNeighbors(room);
      neighbors.forEach(nb => {
        const key = [Math.min(room.id, nb.id), Math.max(room.id, nb.id)].join('-');
        if (pairsDone.has(key)) return;
        pairsDone.add(key);

        const a = worldToScreen(room._wx, room._wy);
        const b = worldToScreen(nb._wx,  nb._wy);

        // Data packet animation along this edge
        const prog = ((t * 0.008 + (room.id * 0.13)) % 1);
        const px = a.sx + (b.sx - a.sx) * prog;
        const py = a.sy + (b.sy - a.sy) * prog;

        ctx.strokeStyle = room.color + '18';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 8]);
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
        ctx.setLineDash([]);

        ctx.globalAlpha = 0.6;
        ctx.fillStyle = room.color;
        ctx.beginPath(); ctx.arc(px, py, 2.5 * CAM.scale, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
      });
    });
  }

  function getNeighbors(room) {
    return ROOMS.filter(r =>
      (r.col === room.col && Math.abs(r.row - room.row) === 1) ||
      (r.row === room.row && Math.abs(r.col - room.col) === 1)
    );
  }

  /* ══════════════════════════════════════════
     DRAW PARTICLES
  ══════════════════════════════════════════ */
  function updateAndDrawParticles() {
    particles.forEach(p => {
      p.wx += p.vx;
      p.wy += p.vy;
      // Wrap
      if (p.wx > 1200) p.wx = -1200;
      if (p.wx < -1200) p.wx = 1200;
      if (p.wy > 800) p.wy = -400;
      if (p.wy < -400) p.wy = 800;
      const { sx, sy } = worldToScreen(p.wx, p.wy);
      p.sx = sx; p.sy = sy;
      if (sx > -10 && sx < W+10 && sy > -10 && sy < H+10) {
        R.drawParticle(ctx, p, t);
      }
    });
  }

  /* ══════════════════════════════════════════
     MINIMAP
  ══════════════════════════════════════════ */
  function drawMinimap() {
    const mw = mmCanvas.width, mh = mmCanvas.height;
    mctx.fillStyle = '#03080f';
    mctx.fillRect(0, 0, mw, mh);

    // World bounds
    const allX = ROOMS.map(r => r._wx);
    const allY = ROOMS.map(r => r._wy);
    const minX = Math.min(...allX) - 140;
    const maxX = Math.max(...allX) + 140;
    const minY = Math.min(...allY) - 80;
    const maxY = Math.max(...allY) + 80;
    const ww = maxX - minX, wh = maxY - minY;

    function toMM(wx, wy) {
      return {
        mx: ((wx - minX) / ww) * mw,
        my: ((wy - minY) / wh) * mh,
      };
    }

    ROOMS.forEach(room => {
      const { mx, my } = toMM(room._wx, room._wy);
      mctx.fillStyle = room.color + (room === hoveredRoom ? 'ff' : '66');
      const ts = 6;
      mctx.beginPath();
      mctx.moveTo(mx, my - ts/2);
      mctx.lineTo(mx + ts/2, my);
      mctx.lineTo(mx, my + ts/2);
      mctx.lineTo(mx - ts/2, my);
      mctx.closePath();
      mctx.fill();
    });

    // Viewport rect
    const tl = screenToWorld(0, 0);
    const br = screenToWorld(W, H);
    const { mx: tlx, my: tly } = toMM(tl.wx, tl.wy);
    const { mx: brx, my: bry } = toMM(br.wx, br.wy);
    mctx.strokeStyle = '#ffffff55';
    mctx.lineWidth = 1;
    mctx.strokeRect(tlx, tly, brx - tlx, bry - tly);
  }

  /* ══════════════════════════════════════════
     HIT TEST — which room is under cursor?
  ══════════════════════════════════════════ */
  function hitTestRooms(sx, sy) {
    // Sort by draw order (back to front) and test in reverse
    const sorted = [...ROOMS].sort((a,b) => (a.col + a.row) - (b.col + b.row));
    for (let i = sorted.length - 1; i >= 0; i--) {
      const room = sorted[i];
      const s = worldToScreen(room._wx, room._wy);
      const lx = (sx - s.sx) / CAM.scale;
      const ly = (sy - s.sy) / CAM.scale;
      // Point-in-diamond test
      const hw = R.TILE_W / 2, hh = R.TILE_H / 2;
      if (Math.abs(lx/hw) + Math.abs(ly/hh) < 1.05) return room;
    }
    return null;
  }

  /* ══════════════════════════════════════════
     MAIN LOOP
  ══════════════════════════════════════════ */
  function frame() {
    t++;

    // Smooth camera
    const ease = 0.1;
    CAM.x     += (CAM.targetX     - CAM.x)     * ease;
    CAM.y     += (CAM.targetY     - CAM.y)     * ease;
    CAM.scale += (CAM.targetScale - CAM.scale) * ease;

    ctx.clearRect(0, 0, W, H);
    drawBackground();

    // Sort rooms by isometric depth (painter's algorithm)
    const sorted = [...ROOMS].sort((a,b) => (a.col + a.row) - (b.col + b.row));

    drawConnections();
    updateAndDrawParticles();
    sorted.forEach(drawRoom);

    drawMinimap();
    requestAnimationFrame(frame);
  }

  /* ══════════════════════════════════════════
     INTERACTION
  ══════════════════════════════════════════ */

  // Drag
  let dragging = false, lastMX = 0, lastMY = 0, didDrag = false;

  canvas.addEventListener('mousedown', e => {
    dragging = true; didDrag = false;
    lastMX = e.clientX; lastMY = e.clientY;
  });
  window.addEventListener('mouseup', e => {
    if (!didDrag) {
      // Click
      const hit = hitTestRooms(e.clientX, e.clientY);
      if (hit) openRoom(hit);
      else closePanel();
    }
    dragging = false;
  });
  window.addEventListener('mousemove', e => {
    if (dragging) {
      const dx = e.clientX - lastMX, dy = e.clientY - lastMY;
      if (Math.abs(dx) + Math.abs(dy) > 3) didDrag = true;
      CAM.targetX -= dx / CAM.scale;
      CAM.targetY -= dy / CAM.scale;
      lastMX = e.clientX; lastMY = e.clientY;
    }
    // Hover
    const hit = hitTestRooms(e.clientX, e.clientY);
    if (hit !== hoveredRoom) {
      hoveredRoom = hit;
      canvas.style.cursor = hit ? 'pointer' : 'grab';
    }
    // Tooltip
    const tip = document.getElementById('tooltip');
    if (hit && hit !== selectedRoom) {
      tip.style.display = 'block';
      tip.style.left = (e.clientX + 14) + 'px';
      tip.style.top  = e.clientY + 'px';
      tip.textContent = `${hit.icon} ${hit.name}`;
    } else {
      tip.style.display = 'none';
    }
    // HUD
    const { wx, wy } = screenToWorld(e.clientX, e.clientY);
    document.getElementById('coordsEl').textContent = `${Math.round(wx)} , ${Math.round(wy)}`;
    document.getElementById('zoomEl').textContent   = `زوم: ${CAM.scale.toFixed(2)}×`;
  });

  // Scroll to zoom
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const { wx, wy } = screenToWorld(e.clientX, e.clientY);
    CAM.targetScale = Math.min(2.5, Math.max(0.25, CAM.targetScale * factor));
    CAM.targetX = wx - (e.clientX - W/2) / CAM.targetScale;
    CAM.targetY = wy - (e.clientY - H/2) / CAM.targetScale;
  }, { passive: false });

  // Touch
  let lastTouchDist = null, lastTouchX = 0, lastTouchY = 0;
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      dragging = true; didDrag = false;
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
    }
  }, { passive: true });
  canvas.addEventListener('touchend', e => {
    if (!didDrag && e.changedTouches.length === 1) {
      const t2 = e.changedTouches[0];
      const hit = hitTestRooms(t2.clientX, t2.clientY);
      if (hit) openRoom(hit); else closePanel();
    }
    dragging = false; lastTouchDist = null;
  }, { passive: true });
  canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 1 && dragging) {
      const dx = e.touches[0].clientX - lastTouchX;
      const dy = e.touches[0].clientY - lastTouchY;
      if (Math.abs(dx)+Math.abs(dy) > 3) didDrag = true;
      CAM.targetX -= dx / CAM.scale;
      CAM.targetY -= dy / CAM.scale;
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastTouchDist) {
        CAM.targetScale = Math.min(2.5, Math.max(0.25, CAM.targetScale * (d / lastTouchDist)));
      }
      lastTouchDist = d;
    }
  }, { passive: true });

  // Keyboard
  window.addEventListener('keydown', e => {
    const spd = 40 / CAM.scale;
    if (e.key === 'ArrowLeft'  || e.key === 'a') CAM.targetX -= spd;
    if (e.key === 'ArrowRight' || e.key === 'd') CAM.targetX += spd;
    if (e.key === 'ArrowUp'    || e.key === 'w') CAM.targetY -= spd;
    if (e.key === 'ArrowDown'  || e.key === 's') CAM.targetY += spd;
    if (e.key === '+' || e.key === '=') CAM.targetScale = Math.min(2.5, CAM.targetScale * 1.15);
    if (e.key === '-')                  CAM.targetScale = Math.max(0.25, CAM.targetScale * 0.87);
    if (e.key === 'r' || e.key === 'R') { centerCamera(); }
    if (e.key === 'Escape') closePanel();
  });

  /* ── ROOM PANEL ──────────────────────────── */
  function openRoom(room) {
    selectedRoom = room;
    document.getElementById('ipIcon').textContent    = room.icon;
    document.getElementById('ipName').textContent    = room.name;
    document.getElementById('ipService').textContent = room.service;
    document.getElementById('ipDesc').textContent    = room.desc;
    document.getElementById('ipLink').href           = room.link;
    document.getElementById('infoPanel').classList.add('open');
    document.getElementById('roomLabel').textContent  = room.name;
    // Fly to room
    CAM.targetX = room._wx;
    CAM.targetY = room._wy - 60;
  }
  function closePanel() {
    selectedRoom = null;
    document.getElementById('infoPanel').classList.remove('open');
    document.getElementById('roomLabel').textContent = 'خوش آمدید به پازل‌نت ورس';
  }
  document.getElementById('infoPanelClose').addEventListener('click', closePanel);

  /* ── BOOT SEQUENCE ───────────────────────── */
  const bootEl  = document.getElementById('boot');
  const barEl   = document.getElementById('bootBar');
  const statEl  = document.getElementById('bootStatus');
  const steps = [
    'اتصال به سرور پازل‌نت...',
    'بارگذاری نقشه دنیا...',
    'رسم قطعات پازل...',
    'فعال‌سازی شخصیت‌ها...',
    'آماده است!',
  ];
  let step = 0;
  const bootInterval = setInterval(() => {
    step++;
    const pct = (step / steps.length) * 100;
    barEl.style.width = pct + '%';
    statEl.textContent = steps[Math.min(step, steps.length-1)];
    if (step >= steps.length) {
      clearInterval(bootInterval);
      setTimeout(() => {
        bootEl.classList.add('hidden');
        setTimeout(() => bootEl.remove(), 900);
      }, 400);
    }
  }, 380);

  /* ── KICK OFF ────────────────────────────── */
  centerCamera();
  frame();

  /* ── UTILITY ─────────────────────────────── */
  window.shadeColor = function(hex, pct) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, ((n>>16)&0xff) + pct));
    const g = Math.max(0, Math.min(255, ((n>> 8)&0xff) + pct));
    const b = Math.max(0, Math.min(255,  (n     &0xff) + pct));
    return '#' + [r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
  };

})();
