import * as T from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {AGENTS} from './roster.js';
import {createLayout, OfficeSimulation, clamp, random, timePalette} from './model.js';
import {buildEnvironment, buildBrain, buildAvatar, poseAvatar, shape, disposeShared} from './geometry.js';
import {FACTS, validFacts} from './facts.js';

let views = 0;

export class NexusLivingView {
 constructor(container, {quality='balanced', onSelect=()=>{}, facts=FACTS}={}) {
  if (!(container instanceof HTMLElement)) throw new TypeError('A mounted viewport HTMLElement is required');
  this.container = container;
  this.quality = quality;
  this.onSelect = onSelect;
  this.disposed = false;
  this.active = true;
  this.contextLost = false;
  this.raf = 0;
  this.last = 0;
  this.time = 0;
  this.mode = 'auto';
  this.motion = true;
  this.ready = false;
  this.hoverId = null;
  this.selectedId = null;
  this.react = new Map();
  this.props = {particles: 70, ambient: 65, speed: 100, hover: true, follow: false};
  this.fps = 0;
  this.fpsAcc = 0;
  this.fpsFrames = 0;
  this.zoomBase = 0;
  this.tmpTarget = new T.Vector3();
  this.tmpCam = new T.Vector3();
  this.memoryBytes = null;
  this.bubbles = [];
  this.labels = [];
  this.pulses = [];
  this.seen = new Map();
  this.factIndex = 0;
  this.connection = 'Hermes terhubung';
  this.facts = validFacts(facts);
  this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
  this.onReduced = () => this.wake();
  this.reduced.addEventListener('change', this.onReduced);

  container.classList.add('nx3-viewport');

  // High performance WebGL renderer utilizing dedicated GPU (RTX 3050)
  this.renderer = new T.WebGLRenderer({
    antialias: quality !== 'low',
    alpha: false,
    powerPreference: 'high-performance'
  });
  views++;
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'low' ? 1 : 1.5));
  this.renderer.outputColorSpace = T.SRGBColorSpace;
  this.renderer.toneMapping = T.ACESFilmicToneMapping;
  this.renderer.toneMappingExposure = 1.22;
  // Soft shadows sell depth far better than extra polygons at this scale.
  this.renderer.shadowMap.enabled = quality !== 'low';
  this.renderer.shadowMap.type = T.PCFSoftShadowMap;
  container.append(this.renderer.domElement);
  this.renderer.domElement.tabIndex = 0;
  this.renderer.domElement.setAttribute('aria-label', 'Kantor 3D. Geser untuk orbit, gulir untuk zoom.');

  this.layer = document.createElement('div');
  this.layer.className = 'nx3-label-layer';
  container.append(this.layer);

  // V2-style Dynamic Sky Canvas & Fog
  this.scene = new T.Scene();
  this.scene.fog = new T.Fog('#b6909e', 115, 340);
  this.skyCanvas = document.createElement('canvas');
  this.skyCanvas.width = 4;
  this.skyCanvas.height = 256;
  this.skyTexture = new T.CanvasTexture(this.skyCanvas);
  this.skyTexture.colorSpace = T.SRGBColorSpace;
  this.skyColor = new T.Color('#b6909e');
  this.skyTick = 0;
  this.scene.background = this.skyTexture;

  // Orthographic camera & OrbitControls with smooth damping
  this.camera = new T.OrthographicCamera(-30, 30, 22, -22, 0.1, 350);
  this.camera.position.set(62, 36, 88); this.camera.zoom = 0.34;
  this.camera.lookAt(0, top ? 0 : 14, top ? 0 : -30);

  this.controls = new OrbitControls(this.camera, this.renderer.domElement);
  this.controls.target.set(0, 1, -6);
  this.controls.enableDamping = true;
  this.controls.dampingFactor = 0.08;
  this.controls.minZoom = 0.26;
  this.controls.maxZoom = 8;
  this.controls.minPolarAngle = 0.05;
  this.controls.maxPolarAngle = Math.PI / 2 - 0.12;
  // Wheel zoom stays anchored under the cursor instead of drifting toward the horizon.
  this.controls.zoomToCursor = true;

  // Lights
  this.hemi = new T.HemisphereLight('#d8edff', '#778477', 2.2);
  this.sun = new T.DirectionalLight('#ffd4a0', 2.4);
  this.sun.position.set(-15, 30, 12);
  this.sun.castShadow = this.renderer.shadowMap.enabled;
  this.sun.shadow.mapSize.set(1024, 1024);
  this.sun.shadow.camera.left = -26; this.sun.shadow.camera.right = 26;
  this.sun.shadow.camera.top = 26; this.sun.shadow.camera.bottom = -26;
  this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 95;
  this.sun.shadow.bias = -0.0009; this.sun.shadow.normalBias = 0.02;
  this.scene.add(this.hemi, this.sun);

  // V3 Main Office layout & objects (preserved 100%)
  this.layout = createLayout();
  this.officeCenter = [(this.layout.bounds.x0 + this.layout.bounds.x1) / 2, (this.layout.bounds.z0 + this.layout.bounds.z1) / 2];
  // Keep the camera target inside the office footprint: zooming at the rim can never drift into empty background.
  this.controls.addEventListener('change', () => {
    if (this.fitting) return;
    const b = this.layout.bounds, pad = 3.5, t = this.controls.target;
    const cx = Math.min(b.x1 + pad, Math.max(b.x0 - pad, t.x));
    const cz = Math.min(b.z1 + pad, Math.max(b.z0 - pad, t.z));
    if (cx !== t.x || cz !== t.z) {
      this.camera.position.x += cx - t.x; this.camera.position.z += cz - t.z;
      t.x = cx; t.z = cz;
    }
  });
  this.sim = new OfficeSimulation(this.layout);
  this.scene.add(buildEnvironment(this.layout));
  this.brain = buildBrain();
  this.scene.add(this.brain);
  // Practical lighting: warm pools over each team, mint spill from the grimoire.
  this.accentLights = this.layout.teams.map(t => {
    const l = new T.PointLight(t.color, 26, 17, 2);
    l.position.set(t.center[0], 3.6, t.center[1] - 0.5);
    this.scene.add(l); return l;
  });
  this.brainLight = new T.PointLight('#aeffe0', 55, 22, 2);
  this.brainLight.position.set(0, 4.9, 0);
  this.scene.add(this.brainLight);

  // 8 Active Agents
  this.avatars = new Map();
  this.agentLabels = new Map();
  this.labelVecs = new Map();
  this.sim.agents.forEach(a => {
    const rig = buildAvatar(a.skin, (this.layout.teams.find(t => t.id === a.team) || {}).color || '#3a4750');
    // Slightly larger than human scale so outfits stay readable at overview zoom.
    rig.root.scale.setScalar(1.3);
    this.avatars.set(a.id, rig);
    this.scene.add(rig.root);
    const v = new T.Vector3();
    this.labelVecs.set(a.id, v);
    const lbl = this.label(a.name, () => v.set(a.p[0], 2.8, a.p[1]), 'nx3-agent', a.id);
    const status = document.createElement('span');
    status.className = 'nx3-agent-status';
    status.textContent = 'siap';
    lbl.el.append(status);
    lbl.statusEl = status;
    this.agentLabels.set(a.id, lbl);
  });

  // 4 Team labels
  const teamLabelOffset = [[-3.2, 1.1, 7.4], [3.2, 2.6, 7.4], [-3.2, 4.1, 9.6], [3.2, 5.6, 9.6]];
  this.layout.teams.forEach((team, ti) => {
    const o = teamLabelOffset[ti % 4];
    const v = new T.Vector3(team.center[0] + o[0], o[1], team.center[1] + o[2]);
    const label = this.label(team.name, v, 'nx3-team', team.id);
    label.el.style.setProperty('--accent', team.color);
  });

  // Big Brain label
  this.brainLabel = this.label('BIG BRAIN · —', new T.Vector3(0, 3.2, 0), 'nx3-brain');
  this.sim.onChat = (a, b) => this.chat(a, b);

  // V2-Style Background City Skyline (lightweight, instanced, distant)
  this.buildCity();

  // Particle pool for knowledge transfers. Each particle owns its material so
  // per-particle opacity fades never leak into the shared material cache.
  this.particleGeo = new T.IcosahedronGeometry(.5, 1);
  this.particlePool = Array.from({length: 32}, () => {
    const mat = new T.MeshBasicMaterial({color: '#aeffe0', transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false});
    const m = new T.Mesh(this.particleGeo, mat);
    m.scale.setScalar(.22);
    m.visible = false;
    this.scene.add(m);
    return m;
  });

    // Knowledge beam lines (brain -> agent)
    this.beamPool = Array.from({length: 8}, () => {
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(6), 3));
      const mat = new T.LineBasicMaterial({color: '#aeffe0', transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false});
      const line = new T.Line(geo, mat);
      line.visible = false;
      this.scene.add(line);
      return line;
    });

    // Reusable projection vector for zero-allocation rendering
    this.projVec = new T.Vector3();
    this.brainPos = new T.Vector3(0, 3.2, 0);

  // Shadow pass: everything solid casts; floors and walls receive.
  if (this.renderer.shadowMap.enabled) {
    // Only the office cast shadows: the tower facade and skyline sit outside the
    // shadow frustum anyway, so casting from them is pure cost.
    const p = new T.Vector3();
    this.scene.traverse(o => {
      if (!(o.isMesh || o.isInstancedMesh)) return;
      o.getWorldPosition(p);
      o.castShadow = Math.abs(p.x) < 24 && Math.abs(p.z) < 20 && p.y > -8;
      o.receiveShadow = true;
    });
    // Shadow refresh every other frame is invisible at this scale and halves cost.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
  }

  // Lifecycle listeners
  this.visibility = () => this.wake();
  document.addEventListener('visibilitychange', this.visibility);

  this.resizeObserver = new ResizeObserver(() => {
    this.resize();
    this.wake();
  });
  this.resizeObserver.observe(container);

  this.intersectionObserver = new IntersectionObserver(entries => {
    this.intersecting = entries[0].isIntersecting;
    this.wake();
  });
  this.intersectionObserver.observe(container);
  this.intersecting = true;

  this.lost = e => {
    e.preventDefault();
    this.contextLost = true;
    this.connection = 'GPU context terputus';
    this.wake();
  };
  this.restored = () => {
    this.contextLost = false;
    this.connection = 'GPU pulih · menunggu state';
    this.resize();
    this.wake();
  };
  this.renderer.domElement.addEventListener('webglcontextlost', this.lost);
  this.renderer.domElement.addEventListener('webglcontextrestored', this.restored);

  this.down = e => { this.pointerStart = [e.clientX, e.clientY]; };
  this.move = e => {
    if (!this.props.hover) return;
    const rect = container.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
    const hits = this.labels.filter(l => l.id && l.screen && Math.hypot(l.screen[0] - x, l.screen[1] - y) < 40);
    const id = hits[0]?.id || null;
    if (id !== this.hoverId) {
      if (id) this.react.set(id, 0.12);
      this.hoverId = id;
      this.wake();
    }
  };
  this.up = e => {
    if (!this.pointerStart || Math.hypot(e.clientX - this.pointerStart[0], e.clientY - this.pointerStart[1]) > 5) return;
    const rect = container.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
    const hits = this.labels.filter(l => l.id && l.screen && Math.hypot(l.screen[0] - x, l.screen[1] - y) < 40);
    if (hits[0]) { onSelect(hits[0].id); this.select(hits[0].id); }
  };
  this.renderer.domElement.addEventListener('pointerdown', this.down);
  this.renderer.domElement.addEventListener('pointermove', this.move);
  this.renderer.domElement.addEventListener('pointerup', this.up);

  this.resize();
  this.wake();
 }

  buildCity() {
    // Desa Clover di kejauhan: berdiri di tanah, bukan skyline pencakar langit.
    this.cityOwned = [];
    this.windowMaterial = new T.MeshBasicMaterial({color: '#ffcf8f'});
    const rng = random(48);
    const bodies = [], roofs = [], wins = [], chimneys = [], blobs = [];
    const WALLS = ['#b7a58c', '#a8927a', '#c2ad8e', '#9d8b74'];
    const ROOFS = ['#7a4a3a', '#5a4a3e', '#4a5b6e', '#6b3f36'];
    const push = (x, z, w, d, h, rot) => {
      const q = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), rot);
      bodies.push(new T.Matrix4().compose(new T.Vector3(x, h / 2, z), q, new T.Vector3(w, h, d)));
      const rq = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), rot + Math.PI / 4);
      roofs.push(new T.Matrix4().compose(
        new T.Vector3(x, h + h * 0.26, z), rq, new T.Vector3(w * 1.42, h * 0.55, d * 1.42)));
      if (rng() > 0.45) {
        chimneys.push(new T.Matrix4().compose(
          new T.Vector3(x + w * 0.28, h + h * 0.5, z - d * 0.2),
          new T.Quaternion(), new T.Vector3(0.5, h * 0.55, 0.5)));
      }
      blobs.push(new T.Matrix4().compose(
        new T.Vector3(x, 0.03, z), new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2),
        new T.Vector3(w * 1.5, d * 1.5, 1)));
      const rows = h > 8 ? 3 : 2;
      for (let r = 0; r < rows; r++) {
        for (const s of [-0.28, 0.28]) {
          const wx = x + Math.cos(rot) * (s * w) + Math.sin(rot) * (d / 2 + 0.06);
          const wz = z - Math.sin(rot) * (s * w) + Math.cos(rot) * (d / 2 + 0.06);
          wins.push(new T.Matrix4().compose(
            new T.Vector3(wx, h * 0.25 + r * h * 0.22, wz),
            new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), rot),
            new T.Vector3(0.62, 0.72, 0.1)));
        }
      }
    };

    // deretan rumah belakang + sisi, semua di y=0
    for (let i = 0; i < 40; i++) {
      let x, z;
      if (i < 26) { x = (rng() - 0.5) * 150; z = -34 - rng() * 46; }
      else { x = (rng() < 0.5 ? -1 : 1) * (34 + rng() * 40); z = -20 + (rng() - 0.5) * 110; }
      push(x, z, 4.6 + rng() * 3.6, 5 + rng() * 4, 6.5 + rng() * 8, (rng() - 0.5) * 0.9);
    }

    const inst = (geoM, mat, list) => {
      const m = new T.InstancedMesh(geoM, mat, list.length);
      list.forEach((mx, i) => m.setMatrixAt(i, mx));
      m.instanceMatrix.needsUpdate = true;
      m.castShadow = false; m.receiveShadow = true; m.frustumCulled = false; // instance matrix tersebar: culling pakai boundingSphere origin akan membuang seluruh grup
      this.scene.add(m); this.cityOwned.push(geoM, mat);
      return m;
    };

    // kelompokkan badan rumah per warna agar tetap sedikit draw call
    const byWall = new Map();
    bodies.forEach((mx, i) => {
      const key = WALLS[i % WALLS.length];
      if (!byWall.has(key)) byWall.set(key, []);
      byWall.get(key).push(mx);
    });
    const boxGeo = new T.BoxGeometry(1, 1, 1);
    // blob bayangan kontak: rumah terasa menapak tanah
    inst(new T.CircleGeometry(0.5, 14), new T.MeshBasicMaterial({
      color: '#1e2a1c', transparent: true, opacity: 0.28, depthWrite: false
    }), blobs);
    for (const [color, list] of byWall) {
      inst(boxGeo, new T.MeshStandardMaterial({color, roughness: 0.92, metalness: 0.02}), list);
    }

    const byRoof = new Map();
    roofs.forEach((mx, i) => {
      const key = ROOFS[i % ROOFS.length];
      if (!byRoof.has(key)) byRoof.set(key, []);
      byRoof.get(key).push(mx);
    });
    const roofGeo = new T.ConeGeometry(0.72, 1, 4);
    for (const [color, list] of byRoof) {
      inst(roofGeo, new T.MeshStandardMaterial({color, roughness: 0.88, metalness: 0.03}), list);
    }

    inst(boxGeo, this.windowMaterial, wins);
    inst(boxGeo, new T.MeshStandardMaterial({color: '#6b6a62', roughness: 0.95}), chimneys.filter(Boolean));

    // kincir angin sebagai penanda desa
    const mill = new T.Group();
    mill.position.set(-34, 0, -26);
    const tower = new T.Mesh(new T.CylinderGeometry(2.4, 3.4, 12, 10), new T.MeshStandardMaterial({color: '#b7a58c', roughness: 0.9}));
    tower.position.y = 6; mill.add(tower);
    const cap = new T.Mesh(new T.ConeGeometry(3.2, 3, 10), new T.MeshStandardMaterial({color: '#6b3f36', roughness: 0.9}));
    cap.position.y = 13.2; mill.add(cap);
    for (let i = 0; i < 4; i++) {
      const blade = new T.Mesh(new T.BoxGeometry(0.28, 7, 1.5), new T.MeshStandardMaterial({color: '#d9cdb2', roughness: 0.85}));
      blade.position.set(0, 13, 0);
      blade.geometry.translate(0, 3.6, 0);
      blade.rotation.z = i * Math.PI / 2;
      blade.position.z = 3.6;
      mill.add(blade);
    }
    mill.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; o.geometry.isShared = false; } });
    this.scene.add(mill);
    this.cityOwned.push(mill);

    // ladang di luar desa
    const fields = [];
    for (let i = 0; i < 22; i++) {
      const x = (rng() - 0.5) * 200, z = -70 - rng() * 50;
      fields.push(new T.Matrix4().compose(new T.Vector3(x, 0.12, z),
        new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), (rng() - 0.5) * 0.6),
        new T.Vector3(9 + rng() * 8, 0.24, 6 + rng() * 6)));
    }
    inst(boxGeo, new T.MeshStandardMaterial({color: '#a89355', roughness: 1}), fields);
  }

 label(text, position, kind, id=null) {
  const el = document.createElement('div');
  el.className = `nx3-label ${kind}`;
  el.textContent = text;
  this.layer.append(el);
  const obj = {el, position, id};
  obj.w = el.offsetWidth || 90; obj.h = el.offsetHeight || 18; // ukur sekali, hindari reflow per frame
  this.labels.push(obj);
  return obj;
 }

 resize() {
  if (this.disposed) return;
  const w = this.container.clientWidth, h = this.container.clientHeight;
  if (w < 2 || h < 2) return;
  this.width = w;
  this.height = h;
  this.renderer.setSize(w, h, false);
  const aspect = w / h;
  const vertical = Math.max(32, 55 / aspect);
  this.camera.left = -vertical * aspect / 2;
  this.camera.right = vertical * aspect / 2;
  this.camera.top = vertical / 2;
  this.camera.bottom = -vertical / 2;
  this.camera.updateProjectionMatrix();
  if (!this.ready) {
    this.ready = true;
    this.home();
  }
 }

 home(top=false) {
  const [cx, cz] = this.officeCenter;
  this.controls.target.set(cx, top ? 0 : 1.2, cz);
  this.camera.position.set(top ? cx : cx + 58, top ? 150 : 38, cz + (top ? 0.01 : 84));
  this.camera.zoom = 0.4;
  this.camera.lookAt(this.controls.target);
  this.fitView(top ? 0.94 : 0.82);
 }

 // Fit the office footprint to the viewport, then re-centre it on screen. Works for any aspect/pitch.
 fitView(fill = 0.9) {
  const cam = this.camera, b = this.layout.bounds, m = 3, pts = [];
  for (const x of [b.x0 - m, b.x1 + m]) for (const z of [b.z0 - m, b.z1 + m]) for (const y of [0, 3.8]) pts.push(new T.Vector3(x, y, z));
  // Agents and their floating labels often stand outside the desk bounds; keep them inside the fit too.
  (this.sim && this.sim.agents ? this.sim.agents : []).forEach(a => { pts.push(new T.Vector3(a.p[0], 0, a.p[1])); pts.push(new T.Vector3(a.p[0], 3, a.p[1])); });
  const v = new T.Vector3(), right = new T.Vector3(), up = new T.Vector3();
  this.fitting = true;
  for (let pass = 0; pass < 3; pass++) {
    cam.lookAt(this.controls.target);
    cam.updateMatrixWorld();
    let mx = 0, my = 0, sx = 0, sy = 0;
    for (const p of pts) {
      v.copy(p).project(cam);
      sx += v.x; sy += v.y;
      mx = Math.max(mx, Math.abs(v.x)); my = Math.max(my, Math.abs(v.y));
    }
    const halfH = (cam.top - cam.bottom) / 2 / cam.zoom;
    const halfW = halfH * (cam.right - cam.left) / (cam.top - cam.bottom);
    right.setFromMatrixColumn(cam.matrixWorld, 0);
    up.setFromMatrixColumn(cam.matrixWorld, 1);
    const dx = (sx / pts.length) * halfW, dy = (sy / pts.length) * halfH;
    // Shift camera+target by the same world vector: keeps the view direction while centring the footprint.
    this.controls.target.addScaledVector(right, dx).addScaledVector(up, dy);
    cam.position.addScaledVector(right, dx).addScaledVector(up, dy);
    cam.lookAt(this.controls.target);
    cam.zoom = Math.min(this.controls.maxZoom, Math.max(this.controls.minZoom, cam.zoom * fill / Math.max(mx, my, 1e-3)));
    cam.updateProjectionMatrix();
  }
  this.fitting = false;
  this.controls.update();
 }

 setActive(active) {
  this.active = Boolean(active);
  this.wake();
 }

 setMotion(enabled) {
  this.motion = Boolean(enabled);
  this.wake();
 }

 setParticles(v) { this.props.particles = clamp(Number(v) || 0, 0, 100); this.wake(); }
 setAmbient(v) { this.props.ambient = clamp(Number(v) || 0, 0, 100); this.wake(); }
 setSpeed(v) { this.props.speed = clamp(Number(v) || 0, 0, 200); this.wake(); }
 setZoomLevel(v) {
  const z = clamp(Number(v) || 100, 20, 400) / 100;
  this.camera.zoom = z;
  this.camera.updateProjectionMatrix();
  this.wake();
 }
 setHover(on) { this.props.hover = Boolean(on); if (!on) this.hoverId = null; this.wake(); }
 setFollow(on) { this.props.follow = Boolean(on); this.wake(); }
 select(id) {
  if (!this.avatars.has(id)) return;
  this.selectedId = id;
  this.react.set(id, 0.0001);
  this.wake();
 }
 focusAgent(id) {
  if (!this.avatars.has(id)) return;
  this.selectedId = id;
  const a = this.sim.agents.find(x => x.id === id);
  if (a) {
    this.controls.target.set(a.p[0], 1.2, a.p[1]);
    this.camera.position.set(a.p[0] + 18, 16, a.p[1] + 26);
    this.camera.lookAt(this.controls.target);
  }
  this.react.set(id, 0.0001);
  this.wake();
 }
 stats() {
  return {
    fps: Math.round(this.fps),
    agents: this.sim.agents.length,
    draws: this.renderer.info.render.calls,
    triangles: this.renderer.info.render.triangles,
    selected: this.selectedId || ''
  };
 }

 setTime(mode) {
  if (!['auto', 'morning', 'evening', 'night'].includes(mode)) throw new Error('Unknown time mode');
  this.mode = mode;
 }

 setFacts(facts) {
  this.facts = validFacts(facts);
 }

 setConnection(text) {
  this.connection = String(text);
 }

 update(state) {
   for (const a of state.agents || []) {
     this.sim.setBusy(a.id, ['running', 'reviewing', 'recovering'].includes(a.status));
     const lbl = this.agentLabels.get(a.id);
     if (lbl) {
       const busy = a.status === 'running' || a.status === 'reviewing' || a.status === 'recovering';
       lbl.el.dataset.busy = busy ? '1' : '0';
       lbl.statusEl.textContent = busy ? (a.status === 'reviewing' ? 'review' : 'bekerja') : 'siap';
     }
   }
   this.memoryBytes = Number.isFinite(state.memory_bytes) ? state.memory_bytes : null;
   this.brainLabel.el.textContent = `BIG BRAIN · ${this.memoryBytes === null ? '—' : this.memoryBytes < 1024 ? this.memoryBytes + ' B' : (this.memoryBytes / 1024).toFixed(1) + ' KiB'}`;
   this.setConnection(state.connected ? 'Hermes terhubung' : 'Koneksi terputus · state terakhir');
   for (const event of state.events || []) {
     if (['brain.read', 'snapshot.applied', 'task.started'].includes(event.type)) this.pulse(event);
   }
 }

 pulse(event) {
  const key = String(event.id ?? '');
  if (!key || this.seen.has(key) || !this.avatars.has(event.agent_id)) return;
  this.seen.set(key, this.time);
  if (this.seen.size > 512) this.seen.delete(this.seen.keys().next().value);
  if (this.pulses.length >= 4 || !this.motion || this.reduced.matches) return;
  this.pulses.push({agent: event.agent_id, start: this.time});
  this.wake();
 }

 chat(a, b) {
  if (!this.motion || this.reduced.matches || this.bubbles.length >= 1 || !this.facts.length) return;
  const f = this.facts[this.factIndex++ % this.facts.length];
  for (const [agent, text, delay] of [[a, f.text, 0], [b, f.reply || 'Sumbernya bisa dibuka dari bubble ini.', 4]]) {
    const el = document.createElement('div');
    el.className = 'nx3-bubble';
    const content = document.createElement('span');
    content.textContent = `${agent.name}: ${text}`;
    el.append(content);
    const link = document.createElement('a');
    link.textContent = `${f.source} · diperiksa ${f.verified_at}`;
    link.href = f.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    el.append(link);
    this.layer.append(el);
    this.bubbles.push({el, agent: agent.id, start: this.time + delay, end: this.time + delay + 7});
  }
 }

 canRender() {
  return !this.disposed && this.active && this.intersecting && !this.contextLost && this.container.isConnected && this.container.clientWidth > 1 && this.container.clientHeight > 1;
 }

 wake() {
  if (this.disposed) return;
  if (!this.canRender()) {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.last = 0;
    this.controls.enabled = false;
    return;
  }
  this.controls.enabled = true;
  if (!this.raf) {
    this.last = 0;
    this.raf = requestAnimationFrame(t => this.frame(t));
  }
 }

 // Smooth dynamic environment lerping based on user laptop local clock
 environment(dt) {
  const now = new Date();
  const target = this.mode === 'auto'
    ? now.getHours() + now.getMinutes() / 60
    : (this.mode === 'morning' ? 9.5 : this.mode === 'evening' ? 17.5 : 22.0);

  const {a, b, t} = timePalette(target);
  const color = (key) => new T.Color(a[key]).lerp(new T.Color(b[key]), t);
  const smooth = 1 - Math.exp(-dt * 2.0);

  this.skyColor.lerp(color('sky'), smooth);
  if (this.scene.fog) this.scene.fog.color.copy(this.skyColor);

  this.skyTick += dt;
  if (this.skyTick > 0.08) {
    this.skyTick = 0;
    const ctx = this.skyCanvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    const top = this.skyColor.clone().lerp(new T.Color('#101d38'), 0.68);
    const bottom = this.skyColor.clone().lerp(new T.Color('#1b3042'), 0.28);
    gradient.addColorStop(0, '#' + top.getHexString());
    gradient.addColorStop(0.55, '#' + this.skyColor.getHexString());
    gradient.addColorStop(1, '#' + bottom.getHexString());
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 4, 256);
    this.skyTexture.needsUpdate = true;
  }

  this.sun.color.lerp(color('sun'), smooth);
  this.sun.intensity += (a.intensity + (b.intensity - a.intensity) * t - this.sun.intensity) * smooth;
  this.hemi.intensity += (a.ambient + (b.ambient - a.ambient) * t - this.hemi.intensity) * smooth;

  if (this.windowMaterial) {
    this.windowMaterial.opacity += (a.windows + (b.windows - a.windows) * t - this.windowMaterial.opacity) * smooth;
  }
  if (this.sunDisc) {
    this.sunDisc.visible = target > 5.5 && target < 18.5;
    this.sunDisc.position.y = 8 + Math.sin((target - 5) / 14 * Math.PI) * 20;
    this.sunDisc.position.x = -40 + (target - 6) * 4;
  }
 }

 frame(ms) {
  this.raf = 0;
  if (!this.canRender()) return;
  this.raf = requestAnimationFrame(t => this.frame(t));

  const dt = this.last ? Math.min((ms - this.last) / 1000, 0.1) : 0.016;
  this.last = ms;
  this.fpsAcc += dt; this.fpsFrames++;
  if (this.fpsAcc >= 0.5) { this.fps = this.fpsFrames / this.fpsAcc; this.fpsAcc = 0; this.fpsFrames = 0; }

  if (this.motion && !this.reduced.matches) {
    this.time += dt * (this.props.speed / 100);
    this.sim.tick(dt * (this.props.speed / 100));
  }

  for (const [id, v] of this.react) {
    const next = v - dt;
    if (next <= 0) this.react.delete(id); else this.react.set(id, next);
  }

  // Responsive environment brightness from the properties slider.
  const amb = clamp(this.props.ambient / 100, 0, 1);
  this.hemi.intensity = (this.hemi.intensity || 2.2) * 0.9 + (0.6 + amb * 2.4) * 0.1;

  // Smooth V2 time-of-day transitions
  this.environment(dt);

  // Character poses & brain rotation
  for (const a of this.sim.agents) {
    const rig = this.avatars.get(a.id);
    poseAvatar(rig, a, this.time, !this.motion || this.reduced.matches);
    if (rig && this.motion && !this.reduced.matches) {
      const react = this.react.get(a.id) || 0;
      const hover = this.props.hover && this.hoverId === a.id ? 1 : 0;
      const energy = Math.max(react > 0 ? react / 0.4 : 0, hover);
      if (energy > 0) {
        rig.root.scale.setScalar(1 + 0.06 * energy);
        rig.root.rotation.z = Math.sin(this.time * 16) * 0.05 * energy;
      } else {
        rig.root.scale.setScalar(1);
        rig.root.rotation.z = 0;
      }
    }
  }
  this.brain.rotation.y = this.motion && !this.reduced.matches ? Math.sin(this.time * 0.3) * 0.1 : 0;

  // Pulses - Knowledge transfer animation (brain -> agent)
    this.pulses = this.pulses.filter(p => this.time - p.start < 2.5);
    this.particlePool.forEach(m => m.visible = false);
    this.beamPool.forEach(b => b.visible = false);
    this.pulses.forEach((p, i) => {
      const a = this.sim.agents.find(a => a.id === p.agent);
      if (!a) return;
      const t = clamp((this.time - p.start) / 2.5, 0, 1);
    
      // Beam line from brain to agent
      const beam = this.beamPool[i % this.beamPool.length];
      if (beam) {
        beam.visible = true;
        const pos = beam.geometry.attributes.position.array;
        // Brain position (0, 3.2, 0) to agent position
        pos[0] = this.brainPos.x; pos[1] = this.brainPos.y; pos[2] = this.brainPos.z;
        pos[3] = a.p[0]; pos[4] = 2.3; pos[5] = a.p[1];
        beam.geometry.attributes.position.needsUpdate = true;
        beam.material.opacity = 0.6 * (1 - t);
      }
    
      // Particle burst along the beam path (density from properties slider)
      const burst = Math.round(1 + this.props.particles / 100 * 5);
      for (let j = 0; j < burst; j++) {
        const particleIndex = (i * 8 + j) % this.particlePool.length;
        const m = this.particlePool[particleIndex];
        if (m) {
          const pt = clamp(t - j * 0.08, 0, 1);
          const ease = pt * (2 - pt); // ease out
          m.visible = true;
          m.position.set(
            this.brainPos.x + (a.p[0] - this.brainPos.x) * ease,
            this.brainPos.y + (2.3 - this.brainPos.y) * ease + Math.sin(pt * Math.PI) * 1.5,
            this.brainPos.z + (a.p[1] - this.brainPos.z) * ease
          );
          m.scale.setScalar(0.22 + 0.15 * Math.sin(pt * Math.PI));
          m.material.opacity = 0.9 * (1 - pt);
        }
      }
    });

  // Controls damping & render
  if (this.props.follow && this.selectedId) {
    const a = this.sim.agents.find(x => x.id === this.selectedId);
    if (a) {
      const k = 1 - Math.exp(-dt * 3);
      this.controls.target.lerp(this.tmpTarget.set(a.p[0], 1.2, a.p[1]), k);
      this.camera.position.lerp(this.tmpCam.set(a.p[0] + 18, 16, a.p[1] + 26), k * 0.5);
    }
  }
  this.controls.update();
  if (this.renderer.shadowMap.enabled) {
    this.shadowTick = (this.shadowTick || 0) + 1;
    this.renderer.shadowMap.needsUpdate = this.shadowTick % 2 === 0;
  }
  this.renderer.render(this.scene, this.camera);

  // Optimized label screen projection
  for (const label of this.labels) {
    const p = typeof label.position === 'function' ? label.position() : label.position;
    this.projVec.copy(p).project(this.camera);
    const x = (this.projVec.x * 0.5 + 0.5) * this.width;
    const y = (-this.projVec.y * 0.5 + 0.5) * this.height;
    label.screen = [x, y];
    const off = this.projVec.z > 1 || this.projVec.z < -1;
    const agentAtWide = label.el.classList.contains('nx3-agent') && this.camera.zoom < 0.5;
    label.el.style.display = (off || agentAtWide) ? 'none' : '';
    label.el.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`;
  }

  // Declutter: label yang tampil tidak boleh bertumpuk (ukuran di-cache, bukan offsetWidth tiap frame)
  if (this.shadowTick % 30 === 0) for (const l of this.labels) { l.w = l.el.offsetWidth || l.w; l.h = l.el.offsetHeight || l.h; }
  const visLbl = this.labels.filter(l => l.screen && l.el.style.display !== 'none');
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < visLbl.length; i++) for (let j = i + 1; j < visLbl.length; j++) {
      const A = visLbl[i], B = visLbl[j];
      const aw = A.w, ah = A.h;
      const bw = B.w, bh = B.h;
      const ax = A.screen[0], ay = A.screen[1] - ah / 2;
      const bx = B.screen[0], by = B.screen[1] - bh / 2;
      const ox = (aw + bw) / 2 - Math.abs(ax - bx);
      const oy = (ah + bh) / 2 - Math.abs(ay - by);
      if (ox <= 0 || oy <= 0) continue;
      const push = oy / 2 + 2, dir = ay <= by ? -1 : 1;
      A.screen[1] += dir * push; B.screen[1] -= dir * push;
    }
  }
  for (const l of visLbl) l.el.style.transform = `translate(${l.screen[0]}px,${l.screen[1]}px) translate(-50%,-100%)`;

  // Bubble positioning
  this.bubbles = this.bubbles.filter(b => {
    const a = this.sim.agents.find(a => a.id === b.agent);
    if (this.time > b.end || a.busy || a.mode !== 'chat') {
      b.el.remove();
      return false;
    }
    b.el.hidden = this.time < b.start;
    this.projVec.set(a.p[0], 3, a.p[1]).project(this.camera);
    const x = clamp((this.projVec.x * 0.5 + 0.5) * this.width, 140, this.width - 140);
    const y = Math.max(100, (-this.projVec.y * 0.5 + 0.5) * this.height);
    b.el.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`;
    return true;
  });
 }

 diagnostics() {
  return {
    agents: this.sim.agents.length,
    rafActive: !!this.raf,
    drawCalls: this.renderer.info.render.calls,
    triangles: this.renderer.info.render.triangles,
    geometries: this.renderer.info.memory.geometries,
    textures: this.renderer.info.memory.textures,
    width: this.width,
    height: this.height,
    camera: this.camera.position.toArray(),
    target: this.controls.target.toArray(),
    zoom: this.camera.zoom
  };
 }

 dispose() {
  if (this.disposed) return;
  this.disposed = true;
  cancelAnimationFrame(this.raf);
  this.raf = 0;
  this.resizeObserver.disconnect();
  this.intersectionObserver.disconnect();
  document.removeEventListener('visibilitychange', this.visibility);
  this.reduced.removeEventListener('change', this.onReduced);
  this.renderer.domElement.removeEventListener('pointerdown', this.down);
  this.renderer.domElement.removeEventListener('pointerup', this.up);
  this.renderer.domElement.removeEventListener('webglcontextlost', this.lost);
  this.renderer.domElement.removeEventListener('webglcontextrestored', this.restored);
  this.controls.dispose();
  // Dispose only resources this view owns. Shared geometry/material caches in
  // geometry.js stay alive for other mounted views and are freed by disposeShared().
  for (const m of this.particlePool) { m.material.dispose(); }
  this.particleGeo.dispose();
  for (const b of this.beamPool) { b.geometry.dispose(); b.material.dispose(); }
  for (const r of this.cityOwned || []) { if (r) r.dispose(); }
  if (this.skyTexture) this.skyTexture.dispose();
  if (this.sunDisc) { this.sunDisc.geometry.dispose(); this.sunDisc.material.dispose(); }
  this.renderer.dispose();
  this.renderer.domElement.remove();
  this.layer.remove();
  if (--views === 0) disposeShared();
  this.container.classList.remove('nx3-viewport');
 }
}
