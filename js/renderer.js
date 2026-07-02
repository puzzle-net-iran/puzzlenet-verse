/* ════════════════════════════════════════════
   PuzzleNet Verse — renderer.js
   Three.js puzzle-piece tile & prop builders
   ════════════════════════════════════════════ */

(function(G) {
  'use strict';

  /* ── GRID CONSTANTS (orthogonal matrix layout) ── */
  const TILE_W  = 220;   // tile width  (X span) — square cells
  const TILE_H  = 220;   // tile depth  (Z span)
  const ROOM_H  = 90;    // 3D extrusion height (Y)
  const TAB_R   = 24;    // puzzle tab radius
  const TAB_OFF = 0.5;   // tab center position (0-1 along edge)
  const COLS    = 4;
  const ROWS    = 8;

  G.TILE_W  = TILE_W;
  G.TILE_H  = TILE_H;
  G.ROOM_H  = ROOM_H;
  G.COLS    = COLS;
  G.ROWS    = ROWS;

  /* ── GRID → WORLD (X/Z ground plane) ─────────
     Plain rows × columns matrix — no isometric
     diagonal stagger. Centered on the grid. ───── */
  G.gridToWorld = function(col, row) {
    const x = (col - (COLS - 1) / 2) * TILE_W;
    const z = (row - (ROWS - 1) / 2) * TILE_H;
    return { x, z };
  };

  /* ── COLOR UTILITY ───────────────────────── */
  G.shadeColor = function(hex, pct) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, ((n>>16)&0xff) + pct));
    const g = Math.max(0, Math.min(255, ((n>> 8)&0xff) + pct));
    const b = Math.max(0, Math.min(255,  (n     &0xff) + pct));
    return '#' + [r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
  };

  /* ─────────────────────────────────────────
     PUZZLE PIECE SHAPE (top-down, X/Z plane)
     Square jigsaw tile — straight N/E/S/W edges
     with tab bumps, tiling into a true matrix grid.
     tabs[0]=N(row-1) [1]=E(col+1) [2]=S(row+1) [3]=W(col-1)
     +1 = tab out, -1 = blank in, 0 = flat
     Shape-local axes: x → world X, y → world Z
  ───────────────────────────────────────── */
  G.buildPuzzleShape = function(room) {
    const hw = TILE_W / 2, hh = TILE_H / 2;
    const T  = room.tabs || [0,0,0,0];

    const TL = { x: -hw, y:  hh };
    const TR = { x:  hw, y:  hh };
    const BR = { x:  hw, y: -hh };
    const BL = { x: -hw, y: -hh };

    function lerp(a,b,t) { return { x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t }; }
    function outNorm(a,b) {
      const dx=b.x-a.x, dy=b.y-a.y, len=Math.hypot(dx,dy);
      return { x:-dy/len, y:dx/len };
    }

    const shape = new THREE.Shape();

    function edge(a, b, tab) {
      if (tab === 0) { shape.lineTo(b.x, b.y); return; }
      const m    = lerp(a, b, TAB_OFF);
      const norm = outNorm(a, b);
      const tip  = { x: m.x + norm.x * TAB_R * 2.2 * tab, y: m.y + norm.y * TAB_R * 2.2 * tab };
      const pre  = lerp(a, b, 0.32);
      const post = lerp(a, b, 0.68);
      shape.lineTo(pre.x, pre.y);
      shape.splineThru([ new THREE.Vector2(tip.x, tip.y), new THREE.Vector2(post.x, post.y) ]);
      shape.lineTo(b.x, b.y);
    }

    shape.moveTo(TL.x, TL.y);
    edge(TL, TR, T[0]); // top edge    → North tab
    edge(TR, BR, T[1]); // right edge  → East tab
    edge(BR, BL, T[2]); // bottom edge → South tab
    edge(BL, TL, T[3]); // left edge   → West tab

    return shape;
  };

  /* ─────────────────────────────────────────
     ROOM MESH — extruded puzzle tile
  ───────────────────────────────────────── */
  G.buildRoomMesh = function(room) {
    const shape = G.buildPuzzleShape(room);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: ROOM_H,
      bevelEnabled: true,
      bevelThickness: 3,
      bevelSize: 2,
      bevelSegments: 2,
      curveSegments: 8,
    });
    geo.rotateX(-Math.PI / 2);

    const locked = !!room.locked;
    const topColor  = locked ? '#111a28' : room.color;
    const sideColor = locked ? '#0b1220' : G.shadeColor(room.accent || room.color, -45);

    const topMat = new THREE.MeshStandardMaterial({
      color: topColor,
      roughness: 0.45,
      metalness: 0.15,
      emissive: locked ? '#000000' : new THREE.Color(room.color),
      emissiveIntensity: locked ? 0 : 0.12,
      transparent: locked,
      opacity: locked ? 0.55 : 1,
    });
    const sideMat = new THREE.MeshStandardMaterial({
      color: sideColor,
      roughness: 0.7,
      metalness: 0.05,
      transparent: locked,
      opacity: locked ? 0.5 : 1,
    });

    // ExtrudeGeometry groups: 0 = shape faces (top/bottom caps), 1 = extruded sides
    const mesh = new THREE.Mesh(geo, [topMat, sideMat]);
    mesh.castShadow = !locked;
    mesh.receiveShadow = true;
    mesh.userData.room = room;
    return mesh;
  };

  /* ─────────────────────────────────────────
     TAB/BLANK OUTLINE (edge glow helper line)
  ───────────────────────────────────────── */
  G.buildOutline = function(room, color) {
    const shape = G.buildPuzzleShape(room);
    const pts2d = shape.getPoints(48);
    const pts3d = pts2d.map(p => new THREE.Vector3(p.x, 0.6, p.y));
    const geo = new THREE.BufferGeometry().setFromPoints(pts3d);
    const mat = new THREE.LineBasicMaterial({ color: color || '#ffffff', transparent: true, opacity: 0.9 });
    return new THREE.LineLoop(geo, mat);
  };

  /* ─────────────────────────────────────────
     CHARACTER (simple stylized 3D figure)
  ───────────────────────────────────────── */
  G.createCharacter = function(color) {
    const group = new THREE.Group();
    const c = new THREE.Color(color);

    const bodyMat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 });
    const skinMat = new THREE.MeshStandardMaterial({ color: '#f4c591', roughness: 0.6 });
    const eyeMat  = new THREE.MeshStandardMaterial({ color: '#101010' });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 10, 8), bodyMat);
    body.position.y = 9;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(3.6, 12, 10), skinMat);
    head.position.y = 16.5;
    head.castShadow = true;
    group.add(head);

    const eyeGeo = new THREE.SphereGeometry(0.5, 6, 6);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-1.3, 16.7, 3.1);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set( 1.3, 16.7, 3.1);
    group.add(eyeL, eyeR);

    const legMat = new THREE.MeshStandardMaterial({ color: G.shadeColor(color, -40), roughness: 0.6 });
    const legGeo = new THREE.CylinderGeometry(0.9, 0.9, 8, 6);

    const legL = new THREE.Group();
    const legLMesh = new THREE.Mesh(legGeo, legMat); legLMesh.position.y = -4;
    legL.add(legLMesh); legL.position.set(-1.8, 4, 0);

    const legR = new THREE.Group();
    const legRMesh = new THREE.Mesh(legGeo, legMat); legRMesh.position.y = -4;
    legR.add(legRMesh); legR.position.set(1.8, 4, 0);

    group.add(legL, legR);
    group.userData.legL = legL;
    group.userData.legR = legR;
    group.userData.baseY = 0;

    return group;
  };

  G.updateCharacter = function(group, t, idx, anim) {
    const bob = Math.sin(t * 0.04 + idx * 1.2) * 1.4;
    group.position.y = group.userData.baseY + bob;
    const walking = anim === 'walk';
    const swing = walking ? Math.sin(t * 0.1 + idx) * 0.5 : Math.sin(t * 0.02 + idx) * 0.05;
    group.userData.legL.rotation.x = swing;
    group.userData.legR.rotation.x = -swing;
  };

  /* ─────────────────────────────────────────
     MONITOR PROP
  ───────────────────────────────────────── */
  G.createMonitor = function(color) {
    const group = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: '#0a1420', roughness: 0.4 });
    const screenMat = new THREE.MeshStandardMaterial({
      color: '#001428', emissive: new THREE.Color(color), emissiveIntensity: 0.6, roughness: 0.3,
    });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(14, 10, 1.5), frameMat);
    frame.position.y = 8;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 7.5), screenMat);
    screen.position.set(0, 8, 0.8);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.5, 5, 8), frameMat);
    stand.position.y = 2.5;
    group.add(frame, screen, stand);
    group.userData.screenMat = screenMat;
    group.castShadow = true;
    return group;
  };
  G.updateMonitor = function(group, t) {
    group.userData.screenMat.emissiveIntensity = 0.35 + Math.abs(Math.sin(t * 0.05)) * 0.5;
  };

  /* ─────────────────────────────────────────
     SERVER RACK PROP
  ───────────────────────────────────────── */
  G.createServerRack = function(color) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#0c1e38', roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 22, 8), bodyMat);
    body.position.y = 11;
    body.castShadow = true;
    group.add(body);

    const lights = [];
    for (let i = 0; i < 5; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: '#003311', emissive: '#00ff88', emissiveIntensity: 0.2 });
      const light = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.3), mat);
      light.position.set(-2.5, 19 - i * 3.5, 4.1);
      group.add(light);
      lights.push(mat);
    }
    group.userData.lights = lights;
    return group;
  };
  G.updateServerRack = function(group, t, x) {
    group.userData.lights.forEach((mat, i) => {
      const on = Math.sin(t * 0.07 + i * 2.1 + x) > 0.2;
      mat.emissiveIntensity = on ? 0.9 : 0.05;
    });
  };

  /* ─────────────────────────────────────────
     PARTICLE DOT TEXTURE
  ───────────────────────────────────────── */
  G.createDotTexture = function() {
    const size = 64;
    const cnv = document.createElement('canvas');
    cnv.width = cnv.height = size;
    const c = cnv.getContext('2d');
    const grad = c.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = grad;
    c.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(cnv);
    return tex;
  };

})(window.Renderer = window.Renderer || {});
