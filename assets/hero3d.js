// Hero 3D: a small palletizer cell. A roller conveyor feeds cartons to a robot
// arm that stacks them 2x2x3 on a pallet; a full pallet slides out and an empty
// one comes back. The camera leans toward the pointer.
// The photo underneath stays as the fallback: no WebGL, or the script fails,
// and the tile simply shows the picture. Reduced motion renders one still frame.
import * as THREE from './vendor/three.module.min.js';

const tile = document.querySelector('[data-hero3d]');
if (tile) start(tile);

function start(tile) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    return; // no WebGL: keep the photo
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, fine ? 2 : 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.className = 'hero3d';
  canvas.setAttribute('aria-hidden', 'true');
  tile.appendChild(canvas);

  // ---------- scene ----------
  const BG = 0xf2f2f2;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 14, 26);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  const target = new THREE.Vector3(-0.9, 0.8, -0.1);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xbdbdbd, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(4, 9, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(fine ? 2048 : 1024, fine ? 2048 : 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 25 });
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.08, ...extra });
  const RED = M(0xc1000e, { roughness: 0.42, metalness: 0.15 });
  const DARK = M(0x1c1c1c, { roughness: 0.5 });
  const STEEL = M(0x9a9a9a, { roughness: 0.35, metalness: 0.6 });
  const FRAME = M(0x2d2d2d);
  const CARTON = M(0xc4c4c4, { roughness: 0.85 });
  const TAPE = M(0x7a7a7a, { roughness: 0.6 });
  const WOOD = M(0x8f8f8f, { roughness: 0.9 });
  const CAB = M(0xdadada, { roughness: 0.5 });

  function box(w, h, d, mat, x = 0, y = 0, z = 0, parent = scene) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function cyl(r, h, mat, parent = scene, seg = 28) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // floor + safety lines
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), M(0xe6e6e6, { roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xc1000e });
  const lines = [[0, -3.3, 9.2, 0.06], [0, 3.6, 9.2, 0.06], [-4.6, 0.15, 0.06, 6.9], [4.6, 0.15, 0.06, 6.9]];
  for (const [x, z, w, d] of lines) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lineMat);
    l.rotation.x = -Math.PI / 2;
    l.position.set(x, 0.002, z);
    scene.add(l);
  }

  // ---------- roller conveyor along +X at z = CZ ----------
  const CZ = 2.0, TOP = 0.9, X0 = -7.5, X1 = 0.55;
  const len = X1 - X0, mid = (X0 + X1) / 2;
  box(len, 0.16, 0.08, FRAME, mid, TOP - 0.12, CZ - 0.46);
  box(len, 0.16, 0.08, FRAME, mid, TOP - 0.12, CZ + 0.46);
  for (let x = X0 + 0.4; x < X1; x += 1.6) {
    box(0.07, TOP - 0.12, 0.07, FRAME, x, (TOP - 0.12) / 2, CZ - 0.46);
    box(0.07, TOP - 0.12, 0.07, FRAME, x, (TOP - 0.12) / 2, CZ + 0.46);
  }
  const rollers = [];
  for (let x = X0 + 0.12; x < X1; x += 0.24) {
    const r = cyl(0.05, 0.86, STEEL, scene, 14);
    r.rotation.x = Math.PI / 2;
    r.position.set(x, TOP - 0.05, CZ);
    rollers.push(r);
  }
  // end stop + photo-eye
  box(0.06, 0.32, 0.92, DARK, X1 + 0.02, TOP + 0.1, CZ);
  const eye = box(0.08, 0.08, 0.08, RED, 0.28, TOP + 0.22, CZ - 0.5);
  eye.material = new THREE.MeshStandardMaterial({ color: 0xc1000e, emissive: 0xff1a1a, emissiveIntensity: 0.0 });

  // ---------- cartons ----------
  const CW = 0.56, CH = 0.4, CD = 0.5;
  const cartonGeo = new THREE.BoxGeometry(CW, CH, CD);
  const tapeGeo = new THREE.BoxGeometry(CW + 0.004, 0.012, 0.1);
  function makeCarton() {
    const g = new THREE.Group();
    const b = new THREE.Mesh(cartonGeo, CARTON);
    b.castShadow = b.receiveShadow = true;
    g.add(b);
    const t = new THREE.Mesh(tapeGeo, TAPE);
    t.position.y = CH / 2 + 0.004;
    g.add(t);
    return g;
  }
  const PICK_X = 0.2;
  const belt = []; // cartons on the conveyor, leading first
  let spawnIn = 0.2;

  // ---------- pallet ----------
  const PALLET = new THREE.Vector3(1.75, 0, -1.5);
  const palletGroup = new THREE.Group();
  palletGroup.position.copy(PALLET);
  scene.add(palletGroup);
  for (const dz of [-0.5, 0, 0.5]) box(1.3, 0.1, 0.14, WOOD, 0, 0.05, dz, palletGroup);
  for (const dx of [-0.55, -0.18, 0.18, 0.55]) box(0.2, 0.04, 1.3, WOOD, dx, 0.12, 0, palletGroup);
  const PTOP = 0.14;
  const slots = [];
  for (let layer = 0; layer < 3; layer++) {
    for (const [sx, sz] of [[-0.3, -0.27], [0.3, -0.27], [-0.3, 0.27], [0.3, 0.27]]) {
      slots.push(new THREE.Vector3(sx, PTOP + CH / 2 + layer * CH, sz));
    }
  }
  let placed = 0;
  let palletSwap = null; // {t, phase}

  // ---------- PLC cabinet + andon ----------
  const cab = new THREE.Group();
  cab.position.set(-5.3, 0, -0.9);
  cab.rotation.y = 0.75;
  scene.add(cab);
  box(1.3, 2.0, 0.6, CAB, 0, 1.0, 0, cab);
  box(1.18, 1.86, 0.02, M(0xcfcfcf), 0, 1.0, 0.31, cab);
  box(0.9, 0.34, 0.03, DARK, 0, 1.45, 0.33, cab); // rack
  const leds = [];
  for (let i = 0; i < 12; i++) {
    const on = new THREE.MeshStandardMaterial({ color: 0x0f3d18, emissive: 0x22ff55, emissiveIntensity: 0 });
    const led = box(0.035, 0.035, 0.02, on, -0.36 + i * 0.065, 1.55, 0.35, cab);
    led.castShadow = false;
    leds.push({ mat: on, t: Math.random() * 3 });
  }
  box(0.5, 0.3, 0.03, DARK, -0.2, 0.95, 0.33, cab); // HMI
  const hmi = box(0.44, 0.24, 0.01, new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x3a3a3a, emissiveIntensity: 0.6 }), -0.2, 0.95, 0.35, cab);
  hmi.castShadow = false;
  const andon = new THREE.Group();
  andon.position.set(0.45, 2.0, 0);
  cab.add(andon);
  cyl(0.03, 0.3, STEEL, andon).position.y = 0.15;
  const stack = [
    [0x1f8f3a, 0x33ff66, 0.36],
    [0x9a7a10, 0xffc21a, 0.5],
    [0x8a0009, 0xff1a1a, 0.64],
  ].map(([c, e, y]) => {
    const mat = new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: 0, transparent: true, opacity: 0.95 });
    const m = cyl(0.075, 0.13, mat, andon, 20);
    m.position.y = y;
    return mat;
  });
  stack[0].emissiveIntensity = 1.6; // green: running

  // ---------- robot ----------
  const robot = new THREE.Group();
  scene.add(robot);
  const base = cyl(0.5, 0.45, DARK, robot);
  base.position.y = 0.225;
  const turret = new THREE.Group();
  turret.position.y = 0.45;
  robot.add(turret);
  cyl(0.38, 0.4, RED, turret).position.y = 0.2;
  const SH = 0.72; // shoulder height above turret
  const shoulder = new THREE.Group();
  shoulder.position.y = SH;
  turret.add(shoulder);
  const sj = cyl(0.2, 0.5, DARK, shoulder, 24);
  sj.rotation.x = Math.PI / 2;
  const L1 = 1.6, L2 = 1.45, TOOL = 0.42;
  box(L1, 0.26, 0.3, RED, L1 / 2, 0, 0, shoulder);
  const elbow = new THREE.Group();
  elbow.position.x = L1;
  shoulder.add(elbow);
  const ej = cyl(0.16, 0.42, DARK, elbow, 24);
  ej.rotation.x = Math.PI / 2;
  box(L2, 0.2, 0.24, RED, L2 / 2, 0, 0, elbow);
  const wrist = new THREE.Group();
  wrist.position.x = L2;
  elbow.add(wrist);
  const wj = cyl(0.11, 0.3, DARK, wrist, 20);
  wj.rotation.x = Math.PI / 2;
  const tool = new THREE.Group();
  wrist.add(tool);
  cyl(0.05, TOOL - 0.06, STEEL, tool).position.y = -(TOOL - 0.06) / 2;
  const pad = box(0.42, 0.05, 0.36, DARK, 0, -TOOL + 0.025, 0, tool);
  const grip = new THREE.Group(); // carried carton hangs here
  grip.position.y = -TOOL - CH / 2;
  tool.add(grip);

  const Y0 = 0.45 + SH; // shoulder height in world
  // pose: yaw around Y, r horizontal reach, y = height of the pad face (carton top)
  const pose = { yaw: 0, r: 1.6, y: 1.9 };
  function solve() {
    turret.rotation.y = pose.yaw;
    const wy = pose.y + TOOL - Y0; // wrist relative to shoulder
    let d = Math.hypot(pose.r, wy);
    d = Math.min(d, L1 + L2 - 0.001);
    const c2 = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2);
    const q2 = -Math.acos(Math.max(-1, Math.min(1, c2))); // elbow up
    const a = Math.atan2(wy, pose.r) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
    shoulder.rotation.z = a;
    elbow.rotation.z = q2;
    wrist.rotation.z = -(a + q2); // tool stays vertical
  }
  const toPose = (p) => ({ yaw: Math.atan2(-p.z, p.x), r: Math.hypot(p.x, p.z) });
  const PICK = toPose(new THREE.Vector3(PICK_X, 0, CZ));
  const HOME = { yaw: (PICK.yaw + toPose(PALLET).yaw) / 2, r: 1.7, y: 2.2 };
  Object.assign(pose, HOME);
  solve();

  // motion queue: each step eases pose to a target, then runs its callback
  const queue = [];
  let step = null;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const shortAngle = (from, to) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from));
  function go(to, dur, done) { queue.push({ to, dur, done }); }
  function busy() { return step || queue.length; }

  function cyclePick(carton) {
    const slot = slots[placed];
    const world = slot.clone().add(palletGroup.position);
    const P = toPose(world);
    const pickTop = TOP + CH;
    go({ yaw: PICK.yaw, r: PICK.r, y: pickTop + 0.7 }, 1.0);
    go({ y: pickTop }, 0.45, () => {
      belt.shift();
      grip.attach(carton);
      carton.position.set(0, 0, 0);
      carton.rotation.set(0, 0, 0);
    });
    go({ y: pickTop + 0.9 }, 0.45);
    go({ yaw: P.yaw, r: P.r, y: Math.max(world.y + CH / 2 + 0.6, 2.0) }, 1.1);
    go({ y: world.y + CH / 2 }, 0.5, () => {
      palletGroup.attach(carton);
      carton.position.copy(slot);
      carton.rotation.set(0, 0, 0);
      placed++;
    });
    go({ y: world.y + CH / 2 + 0.7 }, 0.4, () => {
      if (placed === slots.length) {
        palletSwap = { t: 0 };
        tile.dispatchEvent(new CustomEvent('cellstate', { bubbles: true, detail: 'hold' }));
      }
    });
    go(HOME, 0.8);
  }

  // ---------- camera + pointer ----------
  const look = { x: 0, y: 0 }, lookTo = { x: 0, y: 0 };
  if (fine && !reduce) {
    tile.addEventListener('pointermove', (e) => {
      const r = tile.getBoundingClientRect();
      lookTo.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      lookTo.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });
    tile.addEventListener('pointerleave', () => { lookTo.x = 0; lookTo.y = 0; });
  }
  function placeCamera(t) {
    const az = 0.72 + look.x * 0.28 + Math.sin(t * 0.13) * 0.05;
    const el = 0.42 - look.y * 0.08;
    const dist = 12.8;
    camera.position.set(
      target.x + dist * Math.cos(el) * Math.sin(az),
      target.y + dist * Math.sin(el),
      target.z + dist * Math.cos(el) * Math.cos(az)
    );
    camera.lookAt(target);
  }

  function resize() {
    const w = tile.clientWidth, h = tile.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the cell framed in tall and wide tiles alike
    camera.fov = w / h < 0.9 ? 44 : w / h > 1.6 ? 28 : 34;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(() => { resize(); if (reduce) render(0); }).observe(tile);
  resize();

  // ---------- simulation ----------
  const SPEED = 1.15, GAP = CW + 0.14;
  function update(dt, t) {
    // spawn
    spawnIn -= dt;
    const tail = belt[belt.length - 1];
    if (spawnIn <= 0 && (!tail || tail.position.x > X0 + GAP + 0.2)) {
      const c = makeCarton();
      c.position.set(X0 + 0.1, TOP + CH / 2, CZ);
      c.rotation.y = (Math.random() - 0.5) * 0.04;
      scene.add(c);
      belt.push(c);
      spawnIn = 2.4 + Math.random() * 0.8;
    }
    // advance with queueing
    let moving = false;
    belt.forEach((c, i) => {
      const limit = i === 0 ? PICK_X : belt[i - 1].position.x - GAP;
      if (c.parent !== scene) return;
      if (c.position.x < limit) {
        c.position.x = Math.min(limit, c.position.x + SPEED * dt);
        moving = true;
      }
    });
    for (const r of rollers) r.rotation.y -= moving ? dt * SPEED / 0.05 : 0;
    const lead = belt[0];
    const atPick = lead && lead.parent === scene && Math.abs(lead.position.x - PICK_X) < 1e-3;
    eye.material.emissiveIntensity = atPick ? 2.2 : 0.0;

    // robot
    if (!busy() && atPick && !palletSwap && placed < slots.length) cyclePick(lead);
    if (!step && queue.length) {
      const s = queue.shift();
      const from = { ...pose };
      const to = { ...pose, ...s.to };
      to.yaw = shortAngle(from.yaw, to.yaw);
      step = { from, to, t: 0, dur: s.dur, done: s.done };
    }
    if (step) {
      step.t = Math.min(1, step.t + dt / step.dur);
      const k = ease(step.t);
      pose.yaw = step.from.yaw + (step.to.yaw - step.from.yaw) * k;
      pose.r = step.from.r + (step.to.r - step.from.r) * k;
      pose.y = step.from.y + (step.to.y - step.from.y) * k;
      if (step.t >= 1) {
        const done = step.done;
        step = null;
        if (done) done();
      }
    }
    solve();

    // full pallet out, empty pallet in
    if (palletSwap && !busy()) {
      palletSwap.t += dt;
      const s = palletSwap.t;
      stack[1].emissiveIntensity = Math.sin(s * 10) > 0 ? 1.6 : 0.1; // amber blinks while it swaps
      if (s < 1.6) palletGroup.position.x = PALLET.x + ease(s / 1.6) * 7;
      else if (s < 1.7) {
        for (const c of [...palletGroup.children]) if (c.type === 'Group') palletGroup.remove(c);
        placed = 0;
      } else if (s < 3.3) palletGroup.position.x = PALLET.x + 7 - ease((s - 1.7) / 1.6) * 7;
      else {
        palletGroup.position.x = PALLET.x;
        stack[1].emissiveIntensity = 0;
        palletSwap = null;
        tile.dispatchEvent(new CustomEvent('cellstate', { bubbles: true, detail: 'run' }));
        tile.dataset.pallets = String(+(tile.dataset.pallets || 0) + 1); // read by the tests
      }
    }

    // I/O LEDs flicker, HMI breathes
    for (const l of leds) {
      l.t -= dt;
      if (l.t <= 0) {
        l.mat.emissiveIntensity = Math.random() > 0.45 ? 1.8 : 0;
        l.t = 0.15 + Math.random() * 1.2;
      }
    }
    hmi.material.emissiveIntensity = 0.5 + Math.sin(t * 1.3) * 0.15;
  }

  function render(t) {
    placeCamera(t);
    renderer.render(scene, camera);
  }

  if (reduce) {
    // one still frame with a carton on the pallet and one on the belt
    const c = makeCarton();
    c.position.set(PICK_X, TOP + CH / 2, CZ);
    scene.add(c);
    for (let i = 0; i < 5; i++) {
      const p = makeCarton();
      p.position.copy(slots[i]);
      palletGroup.add(p);
    }
    render(0);
    tile.classList.add('has-3d');
    return;
  }

  // warm the cell up so the first frame already has cartons moving
  for (let i = 0; i < 360; i++) update(1 / 60, i / 60);

  let visible = true, last = performance.now(), clock = 0;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(tile);
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || document.hidden) return;
    clock += dt;
    look.x += (lookTo.x - look.x) * Math.min(1, dt * 3);
    look.y += (lookTo.y - look.y) * Math.min(1, dt * 3);
    update(dt, clock);
    render(clock);
  }
  render(0);
  tile.classList.add('has-3d');
  requestAnimationFrame(frame);
}
