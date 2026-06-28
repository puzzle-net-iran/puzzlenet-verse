/* ════════════════════════════════════════════
   PuzzleNet Verse — renderer.js
   Isometric puzzle-piece tile renderer
   ════════════════════════════════════════════ */

(function(G) {
  'use strict';

  /* ── ISO CONSTANTS ───────────────────────── */
  const TILE_W  = 240;   // isometric tile width
  const TILE_H  = 140;   // isometric tile height (= TILE_W/2 * sin60)
  const ROOM_H  = 90;    // 3D extrusion height
  const TAB_R   = 22;    // puzzle tab radius
  const TAB_OFF = 0.5;   // tab center position (0-1 along edge)
  const COLS    = 4;
  const ROWS    = 8;

  G.TILE_W  = TILE_W;
  G.TILE_H  = TILE_H;
  G.ROOM_H  = ROOM_H;
  G.COLS    = COLS;
  G.ROWS    = ROWS;

  /* ── ISO PROJECTION ──────────────────────── */
  G.isoProject = function(col, row) {
    // Diamond layout: stagger columns
    const x = (col - row) * (TILE_W / 2);
    const y = (col + row) * (TILE_H / 2);
    return { x, y };
  };

  /* ─────────────────────────────────────────
     PUZZLE PIECE PATH
     Draws a top-face puzzle piece with
     tabs/blanks on each side based on room.tabs
     tabs[0]=N, [1]=E, [2]=S, [3]=W
     +1 = tab out, -1 = blank in, 0 = flat
  ───────────────────────────────────────── */
  G.buildPuzzlePath = function(ctx, cx, cy, room) {
    const hw = TILE_W / 2;   // half-width in iso x
    const hh = TILE_H / 2;   // half-height in iso y
    const T  = room.tabs || [0,0,0,0];

    // Four corners of the iso tile (flat top diamond)
    // N=top, E=right, S=bottom, W=left
    const N = { x: cx,      y: cy - hh };
    const E = { x: cx + hw, y: cy      };
    const S = { x: cx,      y: cy + hh };
    const W = { x: cx - hw, y: cy      };

    ctx.beginPath();

    // Helper: midpoint of two iso corners
    function mid(a, b) { return { x:(a.x+b.x)/2, y:(a.y+b.y)/2 }; }
    // Helper: lerp
    function lerp(a,b,t) { return { x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t }; }
    // Helper: normal vector of edge (pointing outward)
    function outNorm(a,b) {
      const dx=b.x-a.x, dy=b.y-a.y, len=Math.hypot(dx,dy);
      return { x:-dy/len, y:dx/len };
    }

    // Draw one edge N→E with tab/blank
    function drawEdge(ctx, a, b, tab) {
      if (tab === 0) {
        ctx.lineTo(b.x, b.y);
        return;
      }
      const m    = lerp(a, b, TAB_OFF);
      const norm = outNorm(a, b);
      const sign = tab; // +1 out, -1 in
      const tx   = m.x + norm.x * TAB_R * sign * 2.2;
      const ty   = m.y + norm.y * TAB_R * sign * 2.2;
      const pre  = lerp(a, b, TAB_OFF - 0.18);
      const post = lerp(a, b, TAB_OFF + 0.18);
      ctx.lineTo(pre.x, pre.y);
      ctx.arcTo(tx, ty, post.x, post.y, TAB_R);
      ctx.lineTo(b.x, b.y);
    }

    // Start at N, trace clockwise: N→E, E→S, S→W, W→N
    ctx.moveTo(N.x, N.y);
    drawEdge(ctx, N, E, T[1]);   // NE edge → East tab
    drawEdge(ctx, E, S, T[2]);   // ES edge → South tab
    drawEdge(ctx, S, W, T[3]);   // SW edge → West tab
    drawEdge(ctx, W, N, T[0]);   // WN edge → North tab
    ctx.closePath();
  };

  /* ─────────────────────────────────────────
     EXTRUSION (3D sides)
  ───────────────────────────────────────── */
  G.drawExtrusionLeft = function(ctx, cx, cy, color, alpha) {
    // Left face: W corner going down
    const hw = TILE_W / 2, hh = TILE_H / 2;
    const W  = { x: cx - hw, y: cy       };
    const S  = { x: cx,      y: cy + hh  };
    ctx.beginPath();
    ctx.moveTo(W.x, W.y);
    ctx.lineTo(S.x, S.y);
    ctx.lineTo(S.x, S.y + ROOM_H);
    ctx.lineTo(W.x, W.y + ROOM_H);
    ctx.closePath();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  G.drawExtrusionRight = function(ctx, cx, cy, color, alpha) {
    const hw = TILE_W / 2, hh = TILE_H / 2;
    const E  = { x: cx + hw, y: cy       };
    const S  = { x: cx,      y: cy + hh  };
    ctx.beginPath();
    ctx.moveTo(E.x, E.y);
    ctx.lineTo(S.x, S.y);
    ctx.lineTo(S.x, S.y + ROOM_H);
    ctx.lineTo(E.x, E.y + ROOM_H);
    ctx.closePath();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  /* ─────────────────────────────────────────
     CHARACTER RENDERER (pixel-style)
  ───────────────────────────────────────── */
  G.drawCharacter = function(ctx, x, y, color, anim, t, idx) {
    const bob  = Math.sin(t * 0.04 + idx * 1.2) * 2;
    const wy   = y + bob;
    const s    = 0.7;

    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 7*s, 3*s, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // Body
    ctx.fillStyle = color + '44';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(x - 5*s, wy - 20*s, 10*s, 15*s, 2);
    ctx.fill(); ctx.stroke();

    // Head
    ctx.fillStyle = '#f4c591';
    ctx.beginPath();
    ctx.arc(x, wy - 26*s, 6*s, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = color + '88';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Eyes
    const blink = Math.sin(t * 0.03 + idx * 4) > 0.94;
    ctx.fillStyle = '#222';
    if (!blink) {
      ctx.beginPath(); ctx.arc(x - 2*s, wy - 27*s, 1.2*s, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 2*s, wy - 27*s, 1.2*s, 0, Math.PI*2); ctx.fill();
    } else {
      ctx.fillRect(x - 3.5*s, wy - 27.5*s, 2.5*s, 0.8*s);
      ctx.fillRect(x + 1*s,   wy - 27.5*s, 2.5*s, 0.8*s);
    }

    // Legs
    const walk = anim === 'walk' ? Math.sin(t * 0.1 + idx) * 3*s : 0;
    ctx.strokeStyle = color + '88';
    ctx.lineWidth = 2*s;
    ctx.beginPath(); ctx.moveTo(x-3*s, wy-5*s); ctx.lineTo(x-3*s+walk,  wy+1*s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+3*s, wy-5*s); ctx.lineTo(x+3*s-walk,  wy+1*s); ctx.stroke();
  };

  /* ─────────────────────────────────────────
     SCREEN / MONITOR OBJECT
  ───────────────────────────────────────── */
  G.drawMonitor = function(ctx, x, y, color, t) {
    const w = 24, h = 16;
    ctx.fillStyle = '#001428';
    ctx.fillRect(x - w/2, y - h, w, h);
    ctx.strokeStyle = color + '88';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - w/2, y - h, w, h);
    // Scanlines
    for (let i = 0; i < 3; i++) {
      const a = Math.sin(t * 0.06 + i) > 0 ? 0.6 : 0.15;
      ctx.globalAlpha = a;
      ctx.fillStyle = color;
      ctx.fillRect(x - w/2 + 2, y - h + 3 + i*4, w - 4 - Math.random()*8, 2);
    }
    ctx.globalAlpha = 1;
    // Stand
    ctx.strokeStyle = color + '44';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y+4); ctx.stroke();
    ctx.fillRect(x - 6, y + 4, 12, 2);
  };

  /* ─────────────────────────────────────────
     SERVER RACK OBJECT
  ───────────────────────────────────────── */
  G.drawServerRack = function(ctx, x, y, color, t) {
    const w = 18, h = 30;
    ctx.fillStyle = '#0c1e38';
    ctx.fillRect(x - w/2, y - h, w, h);
    ctx.strokeStyle = color + '66';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - w/2, y - h, w, h);
    for (let i = 0; i < 5; i++) {
      const on = Math.sin(t * 0.07 + i * 2.1 + x) > 0.2;
      ctx.fillStyle = on ? '#00ff88' : '#002211';
      ctx.fillRect(x - w/2 + 3, y - h + 4 + i*5, 4, 2);
      ctx.fillStyle = Math.sin(t*0.2+i) > 0.5 ? '#ff6b35' : '#220800';
      ctx.fillRect(x - w/2 + 10, y - h + 4 + i*5, 4, 2);
    }
  };

  /* ─────────────────────────────────────────
     FLOATING PARTICLE
  ───────────────────────────────────────── */
  G.drawParticle = function(ctx, p, t) {
    const a = p.alpha * (0.5 + 0.5 * Math.sin(t * 0.05 + p.phase));
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    const size = p.size * (0.8 + 0.2 * Math.sin(t * 0.03 + p.phase));
    ctx.fillRect(p.sx - size/2, p.sy - size/2, size, size*0.5);
    ctx.globalAlpha = 1;
  };

})(window.Renderer = window.Renderer || {});
