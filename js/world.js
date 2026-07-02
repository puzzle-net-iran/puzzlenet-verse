/* ════════════════════════════════════════════
   PuzzleNet Verse — world.js
   Three.js scene: camera orbit, rooms, interaction
   ════════════════════════════════════════════ */

(function() {
  'use strict';

  const R     = window.Renderer;
  const ROOMS = window.ROOMS;

  /* ── RENDERERS ───────────────────────────── */
  const canvas = document.getElementById('world');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const labelLayer = document.getElementById('labelLayer');
  const labelRenderer = new THREE.CSS2DRenderer();
  labelLayer.appendChild(labelRenderer.domElement);

  let W = 0, H = 0;
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H);
    labelRenderer.setSize(W, H);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }

  /* ── SCENE / CAMERA ──────────────────────── */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03080f);
  scene.fog = new THREE.Fog(0x03080f, 900, 2600);

  const camera = new THREE.PerspectiveCamera(45, 1, 1, 6000);

  const ambient = new THREE.HemisphereLight(0x335577, 0x03080f, 0.9);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xbfe6ff, 1.1);
  sun.position.set(600, 900, 300);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -1200; sun.shadow.camera.right = 1200;
  sun.shadow.camera.top = 1200; sun.shadow.camera.bottom = -1200;
  sun.shadow.camera.near = 100; sun.shadow.camera.far = 2500;
  sun.shadow.bias = -0.0015;
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(6000, 6000),
    new THREE.MeshStandardMaterial({ color: 0x050c18, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(4000, 80, 0x00d4ff, 0x00d4ff);
  grid.material.transparent = true;
  grid.material.opacity = 0.05;
  grid.position.y = -0.3;
  scene.add(grid);

  /* ── CAMERA ORBIT/PAN/ZOOM STATE ─────────── */
  const CAM = {
    target: { x: 0, z: 0 }, tTarget: { x: 0, z: 0 },
    azimuth: Math.PI * 0.25, tAzimuth: Math.PI * 0.25,
    polar: 1.0, tPolar: 1.0,          // radians from vertical (Y) axis
    dist: 950, tDist: 950,
  };
  const DIST_MIN = 260, DIST_MAX = 2400;
  const POLAR_MIN = 0.45, POLAR_MAX = 1.35;

  function worldBounds() {
    const xs = ROOMS.map(r => r._wx), zs = ROOMS.map(r => r._wz);
    return {
      cx: (Math.min(...xs) + Math.max(...xs)) / 2,
      cz: (Math.min(...zs) + Math.max(...zs)) / 2,
    };
  }

  function resetCamera() {
    const b = worldBounds();
    CAM.target.x = CAM.tTarget.x = b.cx;
    CAM.target.z = CAM.tTarget.z = b.cz;
    CAM.azimuth  = CAM.tAzimuth  = Math.PI * 0.25;
    CAM.polar    = CAM.tPolar    = 1.0;
    CAM.dist     = CAM.tDist     = 950;
  }

  function updateCameraPosition() {
    const sp = Math.sin(CAM.polar), cp = Math.cos(CAM.polar);
    const x = CAM.target.x + CAM.dist * sp * Math.sin(CAM.azimuth);
    const z = CAM.target.z + CAM.dist * sp * Math.cos(CAM.azimuth);
    const y = CAM.dist * cp;
    camera.position.set(x, Math.max(30, y), z);
    camera.lookAt(CAM.target.x, 55, CAM.target.z);
  }

  /* ── ROOM WORLD POSITIONS + BUILD MESHES ─── */
  const roomMeshes = [];
  const animatedChars = [];
  const animatedProps = [];

  ROOMS.forEach(room => {
    const p = R.gridToWorld(room.col, room.row);
    room._wx = p.x; room._wz = p.z;

    const mesh = R.buildRoomMesh(room);
    mesh.position.set(p.x, 0, p.z);
    scene.add(mesh);
    roomMeshes.push(mesh);
    room._mesh = mesh;

    // Label (icon + name), floating above tile
    const el = document.createElement('div');
    el.className = 'room-label' + (room.locked ? ' locked' : '');
    el.innerHTML = `<div class="rl-icon">${room.locked ? '🔒' : room.icon}</div><div class="rl-name">${room.name}</div>`;
    el.style.setProperty('--room-color', room.color);
    const label = new THREE.CSS2DObject(el);
    label.position.set(p.x, R.ROOM_H + 26, p.z);
    mesh.add(label);
    room._label = el;

    if (!room.locked) {
      // Characters standing on the tile
      const positions = room.chars.map((name, ci) => ({
        name,
        dx: (ci - room.chars.length / 2 + 0.5) * 26,
        dz: ci % 2 === 0 ? -8 : 8,
        anim: ['idle', 'walk', 'idle', 'walk'][ci % 4],
        idx: room.id * 10 + ci,
      }));
      positions.forEach(cp => {
        const group = R.createCharacter(room.color);
        group.position.set(cp.dx, R.ROOM_H, cp.dz);
        group.userData.baseY = R.ROOM_H;
        mesh.add(group);
        animatedChars.push({ group, anim: cp.anim, idx: cp.idx });
      });

      // Objects
      const objs = room.objects || [];
      const hasServer  = objs.some(o => o.includes('سرور') || o.toLowerCase().includes('hp') || o.includes('رک') || o.includes('NAS'));
      const hasMonitor = objs.some(o => o.includes('داشبورد') || o.includes('کنسول') || o.includes('پنل') || o.includes('نمایش'));
      if (hasServer) {
        const rack = R.createServerRack(room.color);
        rack.position.set(-45, R.ROOM_H, 15);
        mesh.add(rack);
        animatedProps.push({ type: 'rack', group: rack, x: room.id });
      }
      if (hasMonitor) {
        const mon = R.createMonitor(room.color);
        mon.position.set(45, R.ROOM_H, -10);
        mesh.add(mon);
        animatedProps.push({ type: 'monitor', group: mon });
      }
    }
  });

  /* ── CONNECTIONS (data packets between neighbors) ── */
  const connections = [];
  function getNeighbors(room) {
    return ROOMS.filter(r =>
      (r.col === room.col && Math.abs(r.row - room.row) === 1) ||
      (r.row === room.row && Math.abs(r.col - room.col) === 1)
    );
  }
  (function buildConnections() {
    const done = new Set();
    ROOMS.forEach(room => {
      getNeighbors(room).forEach(nb => {
        const key = [Math.min(room.id, nb.id), Math.max(room.id, nb.id)].join('-');
        if (done.has(key)) return;
        done.add(key);

        const y = R.ROOM_H + 20;
        const a = new THREE.Vector3(room._wx, y, room._wz);
        const b = new THREE.Vector3(nb._wx, y, nb._wz);

        const lineGeo = new THREE.BufferGeometry().setFromPoints([a, b]);
        const lineMat = new THREE.LineDashedMaterial({ color: room.color, transparent: true, opacity: 0.25, dashSize: 6, gapSize: 8 });
        const line = new THREE.Line(lineGeo, lineMat);
        line.computeLineDistances();
        scene.add(line);

        const packetMat = new THREE.MeshBasicMaterial({ color: room.color });
        const packet = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 8), packetMat);
        scene.add(packet);

        connections.push({ a, b, packet, roomId: room.id });
      });
    });
  })();

  /* ── PARTICLES ───────────────────────────── */
  const PALETTE = ['#00d4ff','#ff6b35','#00ff88','#8b5cf6','#ffd700','#ff69b4'];
  const PARTICLE_COUNT = 140;
  const particlePos = new Float32Array(PARTICLE_COUNT * 3);
  const particleCol = new Float32Array(PARTICLE_COUNT * 3);
  const particleVel = [];
  const tmpColor = new THREE.Color();
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particlePos[i*3+0] = (Math.random() - 0.5) * 2200;
    particlePos[i*3+1] = Math.random() * 380 + 20;
    particlePos[i*3+2] = (Math.random() - 0.5) * 1400;
    tmpColor.set(PALETTE[i % PALETTE.length]);
    particleCol[i*3+0] = tmpColor.r; particleCol[i*3+1] = tmpColor.g; particleCol[i*3+2] = tmpColor.b;
    particleVel.push({ x: (Math.random()-0.5)*0.6, y: (Math.random()-0.5)*0.15, z: (Math.random()-0.5)*0.4 });
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(particleCol, 3));
  const particleMat = new THREE.PointsMaterial({
    size: 6, map: R.createDotTexture(), transparent: true, depthWrite: false,
    vertexColors: true, blending: THREE.AdditiveBlending, opacity: 0.65,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  function updateParticles() {
    const pos = particleGeo.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pos[i*3+0] += particleVel[i].x;
      pos[i*3+1] += particleVel[i].y;
      pos[i*3+2] += particleVel[i].z;
      if (pos[i*3+0] > 1100) pos[i*3+0] = -1100;
      if (pos[i*3+0] < -1100) pos[i*3+0] = 1100;
      if (pos[i*3+1] > 420) pos[i*3+1] = 20;
      if (pos[i*3+1] < 10) pos[i*3+1] = 400;
      if (pos[i*3+2] > 700) pos[i*3+2] = -700;
      if (pos[i*3+2] < -700) pos[i*3+2] = 700;
    }
    particleGeo.attributes.position.needsUpdate = true;
  }

  /* ── HOVER / SELECT / RAYCAST ────────────── */
  let hoveredRoom = null;
  let selectedRoom = null;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2(-10, -10);

  function pickRoom() {
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(roomMeshes, false);
    return hits.length ? hits[0].object.userData.room : null;
  }

  function setHover(room) {
    if (room === hoveredRoom) return;
    if (hoveredRoom) hoveredRoom._label.classList.remove('hover');
    hoveredRoom = room;
    if (hoveredRoom) hoveredRoom._label.classList.add('hover');
    canvas.style.cursor = hoveredRoom ? 'pointer' : 'grab';
  }

  /* ── ANIMATION TIME ──────────────────────── */
  let t = 0;

  /* ══════════════════════════════════════════
     MAIN LOOP
  ══════════════════════════════════════════ */
  function frame() {
    t++;
    const ease = 0.1;
    CAM.target.x += (CAM.tTarget.x - CAM.target.x) * ease;
    CAM.target.z += (CAM.tTarget.z - CAM.target.z) * ease;
    CAM.azimuth  += (CAM.tAzimuth  - CAM.azimuth ) * ease;
    CAM.polar    += (CAM.tPolar    - CAM.polar   ) * ease;
    CAM.dist     += (CAM.tDist     - CAM.dist    ) * ease;
    updateCameraPosition();

    updateParticles();

    connections.forEach(c => {
      const prog = ((t * 0.008 + c.roomId * 0.13) % 1);
      c.packet.position.lerpVectors(c.a, c.b, prog);
    });

    animatedChars.forEach(c => R.updateCharacter(c.group, t, c.idx, c.anim));
    animatedProps.forEach(p => {
      if (p.type === 'monitor') R.updateMonitor(p.group, t);
      if (p.type === 'rack') R.updateServerRack(p.group, t, p.x);
    });

    // Hover highlight scale
    roomMeshes.forEach(m => {
      const room = m.userData.room;
      const isSel = room === selectedRoom, isHov = room === hoveredRoom;
      const targetY = (isSel || isHov) ? 8 : 0;
      m.position.y += (targetY - m.position.y) * 0.2;
    });

    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    drawMinimap();
    updateHUD();

    requestAnimationFrame(frame);
  }

  /* ══════════════════════════════════════════
     MINIMAP (top-down, X/Z already flat)
  ══════════════════════════════════════════ */
  const mmCanvas = document.getElementById('minimap');
  const mctx = mmCanvas.getContext('2d');

  function drawMinimap() {
    const mw = mmCanvas.width, mh = mmCanvas.height;
    mctx.fillStyle = '#03080f';
    mctx.fillRect(0, 0, mw, mh);

    const xs = ROOMS.map(r => r._wx), zs = ROOMS.map(r => r._wz);
    const minX = Math.min(...xs) - 140, maxX = Math.max(...xs) + 140;
    const minZ = Math.min(...zs) - 80,  maxZ = Math.max(...zs) + 80;
    const ww = maxX - minX, wh = maxZ - minZ;
    function toMM(wx, wz) { return { mx: ((wx - minX) / ww) * mw, my: ((wz - minZ) / wh) * mh }; }

    ROOMS.forEach(room => {
      const { mx, my } = toMM(room._wx, room._wz);
      mctx.fillStyle = room.color + (room === hoveredRoom ? 'ff' : '66');
      const ts = 6;
      mctx.beginPath();
      mctx.moveTo(mx, my - ts/2); mctx.lineTo(mx + ts/2, my);
      mctx.lineTo(mx, my + ts/2); mctx.lineTo(mx - ts/2, my);
      mctx.closePath(); mctx.fill();
    });

    // Camera target + facing wedge
    const { mx, my } = toMM(CAM.target.x, CAM.target.z);
    mctx.strokeStyle = '#ffffffaa'; mctx.lineWidth = 1.2;
    mctx.beginPath(); mctx.arc(mx, my, 5, 0, Math.PI*2); mctx.stroke();
    const dirX = mx + Math.sin(CAM.azimuth) * 12;
    const dirY = my + Math.cos(CAM.azimuth) * 12;
    mctx.beginPath(); mctx.moveTo(mx, my); mctx.lineTo(dirX, dirY); mctx.stroke();
  }

  /* ══════════════════════════════════════════
     HUD
  ══════════════════════════════════════════ */
  function updateHUD() {
    document.getElementById('coordsEl').textContent = `${Math.round(CAM.target.x)} , ${Math.round(CAM.target.z)}`;
    document.getElementById('zoomEl').textContent = `زوم: ${(950 / CAM.dist).toFixed(2)}×`;
  }

  /* ══════════════════════════════════════════
     INTERACTION
  ══════════════════════════════════════════ */
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  let dragging = false, dragButton = 0, lastMX = 0, lastMY = 0, didDrag = false;

  function panBy(dx, dy) {
    const panSpeed = CAM.dist * 0.0016;
    const fx = Math.sin(CAM.azimuth), fz = Math.cos(CAM.azimuth); // forward (ground)
    const rx = Math.cos(CAM.azimuth), rz = -Math.sin(CAM.azimuth); // right (ground)
    CAM.tTarget.x -= (rx * dx + fx * -dy) * panSpeed;
    CAM.tTarget.z -= (rz * dx + fz * -dy) * panSpeed;
  }
  function orbitBy(dx, dy) {
    CAM.tAzimuth -= dx * 0.006;
    CAM.tPolar = Math.max(POLAR_MIN, Math.min(POLAR_MAX, CAM.tPolar - dy * 0.005));
  }

  canvas.addEventListener('mousedown', e => {
    dragging = true; didDrag = false; dragButton = e.button;
    lastMX = e.clientX; lastMY = e.clientY;
  });
  window.addEventListener('mouseup', e => {
    if (!didDrag) {
      const hit = pickRoom();
      if (hit) openRoom(hit); else closePanel();
    }
    dragging = false;
  });
  window.addEventListener('mousemove', e => {
    ndc.x = (e.clientX / W) * 2 - 1;
    ndc.y = -(e.clientY / H) * 2 + 1;

    if (dragging) {
      const dx = e.clientX - lastMX, dy = e.clientY - lastMY;
      if (Math.abs(dx) + Math.abs(dy) > 3) didDrag = true;
      if (dragButton === 2) panBy(dx, dy); else orbitBy(dx, dy);
      lastMX = e.clientX; lastMY = e.clientY;
    }

    const hit = pickRoom();
    setHover(hit);

    const tip = document.getElementById('tooltip');
    if (hit && hit !== selectedRoom) {
      tip.style.display = 'block';
      tip.style.left = (e.clientX + 14) + 'px';
      tip.style.top  = e.clientY + 'px';
      tip.textContent = `${hit.icon} ${hit.name}`;
    } else {
      tip.style.display = 'none';
    }
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 0.9 : 1.1;
    CAM.tDist = Math.min(DIST_MAX, Math.max(DIST_MIN, CAM.tDist * factor));
  }, { passive: false });

  // Touch: one-finger orbit, two-finger pan/pinch-zoom
  let lastTouchDist = null, lastTouchMidX = 0, lastTouchMidY = 0, lastTouchX = 0, lastTouchY = 0;
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      dragging = true; didDrag = false;
      lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      dragging = false;
      lastTouchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      lastTouchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    }
  }, { passive: true });
  canvas.addEventListener('touchend', e => {
    if (!didDrag && e.changedTouches.length === 1) {
      const t2 = e.changedTouches[0];
      ndc.x = (t2.clientX / W) * 2 - 1;
      ndc.y = -(t2.clientY / H) * 2 + 1;
      const hit = pickRoom();
      if (hit) openRoom(hit); else closePanel();
    }
    dragging = false; lastTouchDist = null;
  }, { passive: true });
  canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 1 && dragging) {
      const dx = e.touches[0].clientX - lastTouchX, dy = e.touches[0].clientY - lastTouchY;
      if (Math.abs(dx) + Math.abs(dy) > 3) didDrag = true;
      orbitBy(dx, dy);
      lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastTouchDist) CAM.tDist = Math.min(DIST_MAX, Math.max(DIST_MIN, CAM.tDist * (lastTouchDist / d)));
      lastTouchDist = d;

      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      panBy(mx - lastTouchMidX, my - lastTouchMidY);
      lastTouchMidX = mx; lastTouchMidY = my;
    }
  }, { passive: true });

  window.addEventListener('keydown', e => {
    const spd = 40;
    if (e.key === 'ArrowLeft'  || e.key === 'a') CAM.tTarget.x -= spd;
    if (e.key === 'ArrowRight' || e.key === 'd') CAM.tTarget.x += spd;
    if (e.key === 'ArrowUp'    || e.key === 'w') CAM.tTarget.z -= spd;
    if (e.key === 'ArrowDown'  || e.key === 's') CAM.tTarget.z += spd;
    if (e.key === 'q' || e.key === 'Q') CAM.tAzimuth -= 0.12;
    if (e.key === 'e' || e.key === 'E') CAM.tAzimuth += 0.12;
    if (e.key === '+' || e.key === '=') CAM.tDist = Math.max(DIST_MIN, CAM.tDist * 0.87);
    if (e.key === '-')                  CAM.tDist = Math.min(DIST_MAX, CAM.tDist * 1.15);
    if (e.key === 'r' || e.key === 'R') resetCamera();
    if (e.key === 'Escape') closePanel();
  });

  /* ── ROOM PANEL ──────────────────────────── */
  function openRoom(room) {
    if (selectedRoom) selectedRoom._label.classList.remove('selected');
    selectedRoom = room;
    room._label.classList.add('selected');
    document.getElementById('ipIcon').textContent    = room.icon;
    document.getElementById('ipName').textContent    = room.name;
    document.getElementById('ipService').textContent = room.service;
    document.getElementById('ipDesc').textContent    = room.desc;
    document.getElementById('ipLink').href           = room.link;
    document.getElementById('infoPanel').classList.add('open');
    document.getElementById('roomLabel').textContent  = room.name;
    CAM.tTarget.x = room._wx;
    CAM.tTarget.z = room._wz;
    CAM.tDist = 620;
  }
  function closePanel() {
    if (selectedRoom) selectedRoom._label.classList.remove('selected');
    selectedRoom = null;
    document.getElementById('infoPanel').classList.remove('open');
    document.getElementById('roomLabel').textContent = 'خوش آمدید به پازل‌نت ورس';
  }
  document.getElementById('infoPanelClose').addEventListener('click', closePanel);

  /* ── BOOT SEQUENCE ───────────────────────── */
  const bootEl = document.getElementById('boot');
  const barEl  = document.getElementById('bootBar');
  const statEl = document.getElementById('bootStatus');
  const steps = [
    'اتصال به سرور پازل‌نت...',
    'بارگذاری نقشه دنیا...',
    'ساخت مدل‌های سه‌بعدی...',
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
  window.addEventListener('resize', resize);
  resize();
  resetCamera();
  updateCameraPosition();
  frame();

})();
