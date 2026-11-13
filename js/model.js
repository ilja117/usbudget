/* PowerBox 1300 — 3D-модель компоновки DIY-зарядної станції.
 * Одиниці: міліметри (група масштабується 0.01).
 * Осі: X — ширина (420), Y — висота, Z — глибина (250), +Z — передня панель.
 */
(function () {
  'use strict';

  const W = 420, H = 270, D = 250, T = 3, Y0 = 12; // корпус і висота ніжок

  const container = document.getElementById('viewer');
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 1.45, 0);
  controls.minDistance = 4;
  controls.maxDistance = 20;

  // ---------- світло ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404858, 0.75));
  const key = new THREE.DirectionalLight(0xffffff, 0.95);
  key.position.set(6, 10, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 });
  key.shadow.bias = -0.0005;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbcd2ff, 0.45);
  rim.position.set(-7, 5, -6);
  scene.add(rim);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.22 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- матеріали ----------
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.55, metalness: 0.15 }, o));
  const M = {
    shell: mat(0x2c3138, { roughness: 0.6, metalness: 0.35 }),
    shellDark: mat(0x1c1f24, { roughness: 0.7 }),
    panel: mat(0x22262c, { roughness: 0.75 }),
    accent: mat(0xf08a24, { roughness: 0.5 }),
    rubber: mat(0x141516, { roughness: 0.95 }),
    cell: mat(0x2b6ad0, { roughness: 0.45 }),
    alu: mat(0xbfc5cc, { roughness: 0.35, metalness: 0.8 }),
    aluDark: mat(0x7c848d, { roughness: 0.4, metalness: 0.7 }),
    copper: mat(0xc9783a, { roughness: 0.3, metalness: 0.85 }),
    black: mat(0x1b1b1d, { roughness: 0.6 }),
    pcb: mat(0x1f5f3a, { roughness: 0.6 }),
    red: mat(0xd02a2a, { roughness: 0.45 }),
    blk: mat(0x101010, { roughness: 0.5 }),
    acL: mat(0x8a5a2b, { roughness: 0.5 }),
    acN: mat(0x2f62c9, { roughness: 0.5 }),
    white: mat(0xe8eaed, { roughness: 0.6 }),
    socket: mat(0x30343a, { roughness: 0.8 }),
    hole: mat(0x050505, { roughness: 1 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0a0d10, roughness: 0.15, metalness: 0.5 }),
  };
  const shellMaterials = [M.shell, M.shellDark, M.panel, M.accent, M.rubber];
  shellMaterials.forEach(m => { m.side = THREE.DoubleSide; });

  // ---------- хелпери ----------
  function shade(o) { o.castShadow = true; o.receiveShadow = true; return o; }
  function box(p, w, h, d, m, x, y, z) {
    const o = shade(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m));
    o.position.set(x, y, z); p.add(o); return o;
  }
  function cyl(p, r, len, m, x, y, z, axis = 'y', seg = 36, r2) {
    const o = shade(new THREE.Mesh(new THREE.CylinderGeometry(r2 == null ? r : r2, r, len, seg), m));
    if (axis === 'x') o.rotation.z = Math.PI / 2;
    if (axis === 'z') o.rotation.x = Math.PI / 2;
    o.position.set(x, y, z); p.add(o); return o;
  }
  function tube(p, pts, r, m) {
    const curve = new THREE.CatmullRomCurve3(pts.map(a => new THREE.Vector3(a[0], a[1], a[2])), false, 'centripetal');
    const o = shade(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, pts.length * 16), r, 10, false), m));
    p.add(o); return o;
  }
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
    return t;
  }
  function label(p, w, h, tex, x, y, z, ry = 0, emissive = false) {
    const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6 });
    if (emissive) { m.emissive = new THREE.Color(0xffffff); m.emissiveMap = tex; m.emissiveIntensity = 0.9; }
    const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    o.position.set(x, y, z); o.rotation.y = ry; p.add(o); return o;
  }
  function textTex(lines, opt = {}) {
    const w = opt.w || 512, h = opt.h || 128;
    return canvasTex(w, h, (g) => {
      if (opt.bg) { g.fillStyle = opt.bg; g.fillRect(0, 0, w, h); }
      g.textAlign = opt.align || 'center'; g.textBaseline = 'middle';
      lines.forEach((l, i) => {
        g.fillStyle = l.color || '#e9edf2';
        g.font = `${l.weight || 600} ${l.size || 48}px Inter, "DejaVu Sans", sans-serif`;
        g.fillText(l.text, l.x != null ? l.x : w / 2, l.y != null ? l.y : h / (lines.length + 1) * (i + 1));
      });
    });
  }

  // ---------- групи ----------
  const root = new THREE.Group(); root.scale.setScalar(0.01); scene.add(root);
  const G = {
    shellTop: new THREE.Group(), shellFront: new THREE.Group(), shellRight: new THREE.Group(),
    shellRest: new THREE.Group(), inside: new THREE.Group(),
  };
  Object.values(G).forEach(g => root.add(g));

  const xL = -W / 2, xR = W / 2, zB = -D / 2, zF = D / 2, yB = Y0, yT = Y0 + H;

  // ---------- корпус ----------
  box(G.shellRest, W, T, D, M.shell, 0, yB + T / 2, 0);                 // дно
  box(G.shellTop, W, T, D, M.shell, 0, yT - T / 2, 0);                  // кришка
  box(G.shellRest, T, H, D, M.shell, xL + T / 2, yB + H / 2, 0);        // ліва бокова
  box(G.shellRight, T, H, D, M.shell, xR - T / 2, yB + H / 2, 0);       // права бокова
  box(G.shellRest, W, H, T, M.shell, 0, yB + H / 2, zB + T / 2);        // задня
  box(G.shellFront, W - 8, H - 8, T, M.panel, 0, yB + H / 2, zF - T / 2); // передня

  // кутові бампери (помаранчеві) та верхня/нижня окантовка
  [[xL, zF, G.shellFront], [xR, zF, G.shellFront], [xL, zB, G.shellRest], [xR, zB, G.shellRest]].forEach(([x, z, g]) => {
    const sx = Math.sign(x), sz = Math.sign(z);
    cyl(g, 9, H + 2, M.accent, x - sx * 5, yB + H / 2, z - sz * 5, 'y', 24);
  });
  box(G.shellTop, W + 2, 6, 6, M.accent, 0, yT, zF - 3);
  box(G.shellTop, W + 2, 6, 6, M.accent, 0, yT, zB + 3);

  // ніжки
  [[-170, 95], [170, 95], [-170, -95], [170, -95]].forEach(([x, z]) => cyl(G.shellRest, 14, Y0, M.rubber, x, Y0 / 2, z, 'y', 24, 12));

  // ручка
  [-150, 150].forEach(x => {
    box(G.shellTop, 22, 36, 44, M.shellDark, x, yT + 18, 0);
    box(G.shellTop, 26, 6, 48, M.accent, x, yT + 3, 0);
  });
  box(G.shellTop, 320, 16, 32, M.shellDark, 0, yT + 40, 0);
  box(G.shellTop, 220, 18, 34, M.rubber, 0, yT + 40, 0);

  // бокові вентиляційні жалюзі
  [G.shellRest, G.shellRight].forEach((g, i) => {
    const x = i === 0 ? xL - 0.6 : xR + 0.6;
    for (let r = 0; r < 7; r++) {
      box(g, 1.6, 6, 150, M.hole, x, yB + 60 + r * 14, -20);
      box(g, 1.6, 6, 150, M.hole, x, yB + 190 + (r % 4) * 14, -20).visible = r < 4;
    }
  });

  // ---------- передня панель ----------
  const fz = zF + 0.5;
  // дисплей
  box(G.shellFront, 108, 72, 6, M.black, -140, yB + 212, zF + 1);
  const disp = canvasTex(640, 400, (g, w, h) => {
    g.fillStyle = '#05080b'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2bd17e'; g.lineWidth = 8; g.strokeRect(36, 52, 300, 120); g.fillStyle = '#2bd17e';
    g.fillRect(48, 64, 300 * 0.87 - 24, 96); g.fillRect(336, 92, 14, 40);
    g.font = '700 108px Inter, "DejaVu Sans", sans-serif'; g.textBaseline = 'middle'; g.fillText('87%', 380, 116);
    g.font = '600 46px Inter, "DejaVu Sans", sans-serif'; g.fillStyle = '#e9edf2';
    g.fillText('OUT  1250 W', 36, 236); g.fillStyle = '#9aa4b0'; g.fillText('IN     0 W', 36, 296);
    g.fillStyle = '#f0a14a'; g.fillText('≈ 52 хв', 380, 236);
    g.font = '600 34px Inter, "DejaVu Sans", sans-serif'; g.fillStyle = '#6fb8ff'; g.fillText('BT  Wi‑Fi  UPS', 380, 296);
    g.fillStyle = '#9aa4b0'; g.font = '500 30px Inter, "DejaVu Sans", sans-serif'; g.fillText('13.2 V   94.7 A   31 °C', 36, 360);
  });
  label(G.shellFront, 96, 60, disp, -140, yB + 212, zF + 4.2, 0, true);

  // головна кнопка живлення
  cyl(G.shellFront, 13, 4, M.accent, -58, yB + 222, fz + 2, 'z');
  cyl(G.shellFront, 10, 6, M.black, -58, yB + 222, fz + 3, 'z');

  // логотип
  label(G.shellFront, 170, 34, textTex([{ text: 'POWERBOX 1300', size: 66, weight: 800 }], { w: 640, h: 128 }), 95, yB + 232, fz + 0.2);
  label(G.shellFront, 170, 16, textTex([{ text: 'LiFePO4 · 1344 Wh · 2000 W', size: 46, color: '#f0a14a' }], { w: 640, h: 64 }), 95, yB + 207, fz + 0.2);

  // DC-блок (зліва внизу)
  box(G.shellFront, 176, 112, 3, M.shellDark, -110, yB + 95, zF + 0.5);
  label(G.shellFront, 160, 12, textTex([{ text: 'USB-C PD 100W   ·   USB-A QC   ·   12V 10A', size: 34, color: '#aab3be' }], { w: 640, h: 48 }), -110, yB + 141, fz + 1.6);
  [-180, -156].forEach(x => { // USB-C
    box(G.shellFront, 13, 5, 2, M.alu, x, yB + 118, fz + 2); box(G.shellFront, 10, 3, 2.2, M.hole, x, yB + 118, fz + 2.2);
  });
  [-130, -104].forEach(x => { // USB-A
    box(G.shellFront, 16, 8, 2, M.alu, x, yB + 118, fz + 2); box(G.shellFront, 13, 5, 2.2, M.hole, x, yB + 118, fz + 2.2);
  });
  box(G.shellFront, 8, 8, 2, M.accent, -70, yB + 118, fz + 2); // USB кнопка
  cyl(G.shellFront, 16, 4, M.black, -160, yB + 72, fz + 2, 'z');        // прикурювач
  cyl(G.shellFront, 11, 4.4, M.hole, -160, yB + 72, fz + 2.2, 'z');
  [-118, -96].forEach(x => { cyl(G.shellFront, 6, 4, M.black, x, yB + 72, fz + 2, 'z'); cyl(G.shellFront, 3, 4.4, M.hole, x, yB + 72, fz + 2.2, 'z'); });
  box(G.shellFront, 8, 8, 2, M.accent, -70, yB + 72, fz + 2);           // 12V кнопка

  // AC-блок (справа)
  [60, 140].forEach(x => {
    box(G.shellFront, 68, 68, 4, M.socket, x, yB + 100, fz + 1.5);
    cyl(G.shellFront, 25, 3, M.black, x, yB + 100, fz + 3.6, 'z');
    cyl(G.shellFront, 22, 4, M.hole, x, yB + 100, fz + 3.0, 'z');
    [-9.5, 9.5].forEach(dx => cyl(G.shellFront, 2.4, 5, M.shellDark, x + dx, yB + 100, fz + 3.2, 'z', 12));
    box(G.shellFront, 6, 2, 3, M.alu, x, yB + 122, fz + 3); box(G.shellFront, 6, 2, 3, M.alu, x, yB + 78, fz + 3);
  });
  label(G.shellFront, 150, 12, textTex([{ text: 'AC 230V ~ 50Hz  ·  2000 W  ·  UPS', size: 34, color: '#aab3be' }], { w: 640, h: 48 }), 100, yB + 145, fz + 1.6);
  box(G.shellFront, 8, 8, 2, M.accent, 185, yB + 158, fz + 2); // AC кнопка
  // нижня вентиляційна смуга
  for (let i = 0; i < 18; i++) box(G.shellFront, 3, 22, 2, M.hole, 18 + i * 10, yB + 30, fz + 0.6);

  // ---------- задня панель ----------
  const bz = zB - 0.6;
  function fanGrill(g, x, y) {
    cyl(g, 42, 3, M.shellDark, x, y, bz - 1, 'z');
    for (let r = 10; r <= 36; r += 8) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 1.4, 6, 48), M.aluDark); ring.position.set(x, y, bz - 3); g.add(ring);
    }
    box(g, 80, 2.4, 2, M.aluDark, x, y, bz - 3); box(g, 2.4, 80, 2, M.aluDark, x, y, bz - 3);
  }
  fanGrill(G.shellRest, -100, yB + 90);
  fanGrill(G.shellRest, 100, yB + 222);
  box(G.shellRest, 52, 34, 6, M.black, 160, yB + 60, bz - 2);   // IEC C14 + вимикач
  box(G.shellRest, 26, 18, 3, M.hole, 150, yB + 60, bz - 5);
  box(G.shellRest, 12, 18, 4, M.red, 177, yB + 60, bz - 5);
  cyl(G.shellRest, 9, 10, M.black, 160, yB + 108, bz - 4, 'z');     // термоавтомат
  cyl(G.shellRest, 5, 14, M.white, 160, yB + 108, bz - 6, 'z');
  cyl(G.shellRest, 22, 6, M.shellDark, 40, yB + 130, bz - 3, 'z');   // вимикач АКБ
  box(G.shellRest, 10, 34, 12, M.red, 40, yB + 130, bz - 10);
  label(G.shellRest, 100, 14, textTex([{ text: 'AC IN 230V 10A · BAT OFF', size: 34, color: '#aab3be' }], { w: 640, h: 48 }), 100, yB + 160, bz - 0.4, Math.PI);

  // матеріали панелей — окремі копії, щоб прозорість «рентгену» не зачіпала нутрощі
  const shellExtra = [];
  [G.shellFront, G.shellRest, G.shellTop, G.shellRight].forEach(g => g.traverse(o => {
    if (o.isMesh && !shellMaterials.includes(o.material)) { o.material = o.material.clone(); shellExtra.push(o.material); }
  }));

  // ---------- нутрощі ----------
  const I = G.inside;
  const callouts = [];
  const C = (n, name, x, y, z) => callouts.push({ n, name, p: new THREE.Vector3(x, y, z).multiplyScalar(0.01) });

  // внутрішня рама
  box(I, W - 10, 4, D - 10, M.aluDark, 0, yB + 178, 0);                    // полиця
  [-150, 150].forEach(x => box(I, 20, 4, D - 10, M.aluDark, x, yB + 6, 0)); // рейки дна

  // батарея 4S: EVE LF105 (200×130×36.7), лежать пласко, клеми → +X
  const pack = new THREE.Group(); I.add(pack);
  const pz = -30, cellL = 200, cellD = 130, cellT = 36.7, px0 = -195, px1 = px0 + cellL;
  const yc = i => yB + 14 + i * 37.7 + cellT / 2;
  box(pack, 214, 6, 146, M.alu, px0 + 100, yB + 11, pz);
  box(pack, 214, 6, 146, M.alu, px0 + 100, yB + 168, pz);
  [px0 + 4, px1 - 10].forEach(x => [-1, 1].forEach(s => cyl(pack, 3, 164, M.alu, x, yB + 90, pz + s * 72, 'y', 12)));
  const cellLabel = textTex([{ text: 'EVE  LF105', size: 54, weight: 800, color: '#ffffff' }, { text: 'LiFePO4  3.2V  105Ah', size: 38, color: '#dfe8ff' }], { w: 512, h: 128 });
  for (let i = 0; i < 4; i++) {
    box(pack, cellL, cellT, cellD, M.cell, px0 + cellL / 2, yc(i), pz);
    label(pack, 120, 30, cellLabel, px0 + 90, yc(i), pz + cellD / 2 + 0.3);
    if (i < 3) box(pack, cellL, 1, cellD, M.white, px0 + cellL / 2, yc(i) + cellT / 2 + 0.5, pz);
    [-35, 35].forEach(dz => cyl(pack, 8, 7, M.alu, px1 + 3.5, yc(i), pz + dz, 'x', 20));
  }
  // шини: c1-c2 та c3-c4 на z+35, c2-c3 на z-35
  box(pack, 3, 56, 22, M.copper, px1 + 8.5, (yc(0) + yc(1)) / 2, pz + 35);
  box(pack, 3, 56, 22, M.copper, px1 + 8.5, (yc(2) + yc(3)) / 2, pz + 35);
  box(pack, 3, 56, 22, M.copper, px1 + 8.5, (yc(1) + yc(2)) / 2, pz - 35);
  box(pack, 3, 18, 22, M.red, px1 + 8.5, yc(3), pz - 35);   // P+
  box(pack, 3, 18, 22, M.blk, px1 + 8.5, yc(0), pz - 35);   // B-
  C(1, 'Батарея 4S EVE LF105 · 12.8 В 105 А·год · 1344 Вт·год', px0 + 60, yB + 120, pz + 66);

  // BMS (JK 200A) — на дні праворуч
  box(I, 160, 22, 75, M.black, 110, yB + 20, -78);
  for (let i = 0; i < 14; i++) box(I, 2, 6, 75, M.aluDark, 36 + i * 11, yB + 34, -78);
  label(I, 60, 14, textTex([{ text: 'JK BMS 200A', size: 40, weight: 700 }], { w: 256, h: 64 }), 110, yB + 20, -40.2);
  C(2, 'Smart BMS 4S 200 А · Bluetooth · активний баланс 2 А', 150, yB + 22, -40);

  // зарядний 40 А (на кронштейнах над BMS)
  box(I, 180, 60, 110, M.shellDark, 112, yB + 70, -62);
  for (let i = 0; i < 9; i++) box(I, 180, 2, 4, M.aluDark, 112, yB + 101, -110 + i * 12);
  cyl(I, 26, 6, M.hole, 205, yB + 70, -62, 'x');
  label(I, 90, 14, textTex([{ text: 'LiFePO4 14.6V 40A', size: 40, weight: 700 }], { w: 384, h: 64 }), 112, yB + 70, -6.7);
  C(3, 'Зарядний пристрій LiFePO4 14.6 В 40 А', 70, yB + 82, -6);

  // вимикач АКБ та запобіжник
  box(I, 60, 40, 38, M.red, 40, yB + 130, -102);
  box(I, 70, 22, 30, M.black, 125, yB + 128, -40);
  box(I, 30, 14, 24, M.white, 125, yB + 141, -40);
  C(4, 'Запобіжник MRBF/ANL 200 А', 125, yB + 146, -40);
  C(5, 'Вимикач АКБ 300 А (задня панель)', 40, yB + 152, -100);

  // інвертор 2000 Вт (верхня палуба)
  const inv = new THREE.Group(); I.add(inv);
  const ix0 = -190, ix1 = 110, iz = -10, iy = yB + 221;
  box(inv, 300, 60, 170, M.alu, (ix0 + ix1) / 2, iy - 8, iz);
  for (let i = 0; i < 14; i++) box(inv, 280, 14, 3, M.alu, (ix0 + ix1) / 2, iy + 28, iz - 78 + i * 12);
  box(inv, 8, 76, 174, M.black, ix0 - 4, iy, iz); box(inv, 8, 76, 174, M.black, ix1 + 4, iy, iz);
  cyl(inv, 28, 4, M.hole, ix0 - 9, iy, iz + 30, 'x');
  cyl(inv, 10, 18, M.red, ix1 + 16, iy - 10, iz - 40, 'x', 16);
  cyl(inv, 10, 18, M.blk, ix1 + 16, iy - 10, iz + 20, 'x', 16);
  label(inv, 130, 22, textTex([{ text: 'INVERTER 12V → 230V  2000W', size: 40, weight: 800, color: '#22262c' }], { w: 640, h: 96 }), -40, iy - 8, iz + 85.3);
  C(6, 'Інвертор 12→230 В, чиста синусоїда 2000 Вт (пік 4000 Вт)', -40, iy + 30, iz + 60);

  // DIN-рейка: АВР-реле + автомати
  box(I, 66, 8, 100, M.alu, 168, yB + 200, -10);
  box(I, 36, 50, 60, M.white, 155, yB + 228, -10);
  box(I, 18, 50, 50, M.white, 186, yB + 228, -30);
  box(I, 18, 50, 50, M.white, 186, yB + 228, 25);
  box(I, 8, 12, 8, M.accent, 186, yB + 248, -30); box(I, 8, 12, 8, M.accent, 186, yB + 248, 25);
  C(7, 'АВР-реле 16 А (UPS ~10–15 мс) + автомати 10 А', 160, yB + 255, -10);

  // ESP32 + дисплей (за передньою панеллю)
  box(I, 70, 50, 3, M.pcb, -140, yB + 212, 108);
  box(I, 26, 18, 4, M.alu, -150, yB + 220, 105);
  C(8, 'ESP32 + TFT 3.5″ · Wi‑Fi (ESPHome) · дані з BMS', -140, yB + 238, 108);

  // модулі USB/12V за DC-панеллю
  box(I, 70, 40, 24, M.pcb, -160, yB + 118, 105);
  box(I, 40, 28, 18, M.pcb, -100, yB + 118, 108);
  cyl(I, 15, 45, M.black, -160, yB + 72, 98, 'z');
  [-118, -96].forEach(x => cyl(I, 6, 22, M.black, x, yB + 72, 110, 'z', 16));
  C(9, 'USB‑C PD 100 Вт ×2, USB‑A QC ×2, 12 В / DC5521', -130, yB + 140, 110);

  // корпуси розеток
  [60, 140].forEach(x => box(I, 54, 54, 36, M.white, x, yB + 100, 100));
  C(10, 'Розетки Schuko 230 В ×2', 100, yB + 128, 100);

  // вентилятори
  function fan(x, y, z) {
    box(I, 80, 80, 25, M.black, x, y, z);
    cyl(I, 14, 26, M.shellDark, x, y, z, 'z');
    for (let i = 0; i < 7; i++) {
      const b = box(I, 30, 10, 2, M.shellDark, x, y, z + 1);
      b.geometry.translate(18, 0, 0); b.rotation.z = i * Math.PI * 2 / 7; b.rotation.x = 0.35;
    }
  }
  fan(-100, yB + 90, -109.5);
  fan(100, yB + 222, -109.5);
  C(11, 'Вентилятори 80 мм ×2 (PWM за температурою)', -100, yB + 135, -110);

  // IEC ввід зсередини
  box(I, 48, 30, 30, M.black, 160, yB + 60, -105);

  // ---------- кабелі ----------
  const P = (x, y, z) => [x, y, z];
  const bt = px1 + 12;
  // + силовий: P+ → вимикач → запобіжник → інвертор (+) і зарядний (+)
  tube(I, [P(bt, yc(3), pz - 35), P(bt + 14, yc(3) + 6, -80), P(40, yB + 150, -96)], 5, M.red);
  tube(I, [P(40, yB + 110, -96), P(80, yB + 116, -60), P(92, yB + 128, -40)], 5, M.red);
  tube(I, [P(158, yB + 128, -40), P(190, yB + 150, -45), P(198, yB + 176, -46), P(160, yB + 200, -60), P(ix1 + 24, iy - 10, iz - 40)], 5, M.red);
  tube(I, [P(158, yB + 124, -30), P(202, yB + 110, -40), P(205, yB + 85, -70)], 3, M.red);
  // − силовий: B- → BMS → інвертор (−) і зарядний (−)
  tube(I, [P(bt, yc(0), pz - 35), P(bt + 8, yB + 34, -60), P(30, yB + 26, -78)], 5, M.blk);
  tube(I, [P(190, yB + 22, -60), P(204, yB + 60, -20), P(204, yB + 150, 0), P(180, yB + 185, 10), P(ix1 + 24, iy - 10, iz + 20)], 5, M.blk);
  tube(I, [P(190, yB + 26, -100), P(204, yB + 40, -110), P(205, yB + 60, -90)], 3, M.blk);
  // 12 В розподіл на передні модулі
  tube(I, [P(140, yB + 135, -28), P(60, yB + 160, 40), P(-60, yB + 150, 80), P(-150, yB + 140, 100)], 2.2, M.red);
  tube(I, [P(100, yB + 30, -40), P(30, yB + 40, 50), P(-80, yB + 60, 80), P(-150, yB + 95, 100)], 2.2, M.blk);
  // AC: ввід → АВР, зарядний; інвертор → АВР; АВР → розетки
  tube(I, [P(160, yB + 75, -100), P(170, yB + 160, -80), P(155, yB + 203, -40)], 2.5, M.acL);
  tube(I, [P(150, yB + 70, -100), P(160, yB + 90, -110), P(195, yB + 96, -100)], 2.2, M.acN);
  tube(I, [P(ix1 + 8, iy + 20, iz + 60), P(140, yB + 255, 40), P(160, yB + 235, 20)], 2.5, M.acL);
  tube(I, [P(186, yB + 205, 25), P(150, yB + 170, 70), P(60, yB + 130, 82)], 2.5, M.acL);
  tube(I, [P(186, yB + 205, 35), P(180, yB + 160, 80), P(140, yB + 130, 82)], 2.5, M.acN);
  // балансувальні дроти
  const bal = [0xffd23f, 0x3fa7ff, 0xffffff, 0xff6b6b, 0x7ee787].map(c => mat(c));
  [[yc(0), -35], [yc(0) + 18, 35], [yc(1) + 18, -35], [yc(2) + 18, 35], [yc(3), -35]].forEach(([y, dz], i) => {
    tube(I, [P(bt - 1, y, pz + dz), P(bt + 6, y - 10, pz + dz - 10), P(40, yB + 34, -50 - i * 4)], 1.1, bal[i]);
  });
  // дисплей ↔ BMS (UART)
  tube(I, [P(-140, yB + 190, 105), P(-100, yB + 172, 60), P(20, yB + 140, 0), P(150, yB + 32, -42)], 1.3, mat(0x9b6bff));

  // ---------- режими ----------
  let mode = 'exterior';
  function setShellOpacity(op) {
    shellMaterials.forEach(m => {
      m.transparent = op < 1; m.opacity = op; m.depthWrite = op >= 1; m.needsUpdate = true;
    });
  }
  // мітки на передній/задній панелі, що мають свої матеріали
  function shellLabelOpacity(op) {
    shellExtra.forEach(m => {
      m.transparent = true; m.opacity = op < 1 ? Math.max(op, 0.1) : 1; m.depthWrite = op >= 1;
    });
  }
  function setMode(m) {
    mode = m;
    const cut = m === 'cutaway', xray = m === 'xray';
    G.shellTop.visible = !cut; G.shellFront.visible = !cut; G.shellRight.visible = !cut;
    setShellOpacity(xray ? 0.14 : 1);
    shellLabelOpacity(xray ? 0.14 : 1);
    G.inside.visible = m !== 'exterior';
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
    labelsLayer.style.display = m === 'exterior' ? 'none' : '';
  }

  const VIEWS = {
    front: [5.6, 3.6, 8.6], rear: [-6.4, 3.4, -8.0], side: [10.6, 2.2, 0.01], top: [0.01, 11.5, 2.2], front2: [-6.6, 4.4, 8.0], iso: [6.2, 7.4, 6.8],
  };
  let anim = null;
  function setView(v, instant) {
    const to = new THREE.Vector3().fromArray(VIEWS[v] || VIEWS.front);
    if (instant) { camera.position.copy(to); controls.update(); return; }
    anim = { from: camera.position.clone(), to, t: 0 };
  }

  // ---------- виноски ----------
  const labelsLayer = document.createElement('div');
  labelsLayer.className = 'callouts';
  container.appendChild(labelsLayer);
  callouts.forEach(c => {
    const el = document.createElement('div'); el.className = 'callout'; el.textContent = c.n; el.title = c.name;
    labelsLayer.appendChild(el); c.el = el;
  });
  const legend = document.getElementById('legend');
  if (legend) legend.innerHTML = callouts.map(c => `<li><b>${c.n}</b>${c.name}</li>`).join('');

  const v = new THREE.Vector3();
  function updateCallouts() {
    const w = container.clientWidth, h = container.clientHeight;
    callouts.forEach(c => {
      v.copy(c.p).project(camera);
      c.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w - 12}px, ${(-v.y * 0.5 + 0.5) * h - 12}px)`;
      c.el.style.visibility = v.z < 1 ? 'visible' : 'hidden';
    });
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  function loop() {
    if (anim) {
      anim.t = Math.min(1, anim.t + 0.045);
      const e = 1 - Math.pow(1 - anim.t, 3);
      camera.position.lerpVectors(anim.from, anim.to, e);
      if (anim.t >= 1) anim = null;
    }
    controls.update();
    renderer.render(scene, camera);
    updateCallouts();
    requestAnimationFrame(loop);
  }

  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

  resize();
  setView('front', true);
  setMode('exterior');
  loop();
  window.PB = { setMode, setView, renderer, ready: true };
})();
