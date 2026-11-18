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
  this.renderer.toneMappingExposure = 1.1;
  container.append(this.renderer.domElement);
  this.renderer.domElement.tabIndex = 0;
  this.renderer.domElement.setAttribute('aria-label', 'Kantor 3D. Geser untuk orbit, gulir untuk zoom.');

  this.layer = document.createElement('div');
  this.layer.className = 'nx3-label-layer';
  container.append(this.layer);

  // V2-style Dynamic Sky Canvas & Fog
  this.scene = new T.Scene();
  this.scene.fog = new T.Fog('#b6909e', 70, 165);
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
  this.camera.position.set(40, 34, 46);
  this.camera.lookAt(0, 0, 0);

  this.controls = new OrbitControls(this.camera, this.renderer.domElement);
  this.controls.target.set(0, 0, 0);
  this.controls.enableDamping = true;
  this.controls.dampingFactor = 0.08;
  this.controls.minZoom = 0.6;
  this.controls.maxZoom = 4.5;
  this.controls.minPolarAngle = 0.05;
  this.controls.maxPolarAngle = Math.PI / 2 - 0.12;

  // Lights
  this.hemi = new T.HemisphereLight('#d8edff', '#778477', 2.2);
  this.sun = new T.DirectionalLight('#ffd4a0', 2.4);
  this.sun.position.set(-15, 30, 12);
  this.scene.add(this.hemi, this.sun);

  // V3 Main Office layout & objects (preserved 100%)
  this.layout = createLayout();
  this.sim = new OfficeSimulation(this.layout);
  this.scene.add(buildEnvironment(this.layout));
  this.brain = buildBrain();
  this.scene.add(this.brain);

  // 8 Active Agents
  this.avatars = new Map();
  this.sim.agents.forEach(a => {
    const rig = buildAvatar(a.skin);
    this.avatars.set(a.id, rig);
    this.scene.add(rig.root);
    this.label(a.name, () => new T.Vector3(a.p[0], 2.3, a.p[1]), 'nx3-agent', a.id);
  });

  // 4 Team labels
  this.layout.teams.forEach(team => {
    const label = this.label(team.name, () => new T.Vector3(team.center[0], 0.9, team.center[1] + 5.5), 'nx3-team', team.id);
    label.el.style.setProperty('--accent', team.color);
  });

  // Big Brain label
  this.brainLabel = this.label('BIG BRAIN · —', () => new T.Vector3(0, 3.2, 0), 'nx3-brain');
  this.sim.onChat = (a, b) => this.chat(a, b);

  // V2-Style Background City Skyline (lightweight, instanced, distant)
  this.buildCity();

  // Optimized Particle pool for knowledge transfers
    this.particlePool = Array.from({length: 32}, () => {
      const m = shape(this.scene, 'ball', '#aeffe0', [0, 0, 0], [0.22, 0.22, 0.22], true);
      m.material.transparent = true;
      m.material.opacity = 0.9;
      m.material.blending = T.AdditiveBlending;
      m.material.depthWrite = false;
      m.visible = false;
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
  this.up = e => {
    if (!this.pointerStart || Math.hypot(e.clientX - this.pointerStart[0], e.clientY - this.pointerStart[1]) > 5) return;
    const rect = container.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
    const hits = this.labels.filter(l => l.id && l.screen && Math.hypot(l.screen[0] - x, l.screen[1] - y) < 40);
    if (hits[0]) onSelect(hits[0].id);
  };
  this.renderer.domElement.addEventListener('pointerdown', this.down);
  this.renderer.domElement.addEventListener('pointerup', this.up);

  this.resize();
  this.wake();
 }

 buildCity() {
  const s = this.scene;
  const rng = random(48);
  this.windowMaterial = new T.MeshBasicMaterial({color: '#ffdb9f', transparent: true, opacity: 0.5});

  const bldg1 = [], bldg2 = [], trims = [], spires = [], windows = [];

  // 36 Skyline buildings positioned far in the background below the penthouse floor
  for (let i = 0; i < 36; i++) {
    const x = (rng() - 0.5) * 140;
    const z = -32 - rng() * 65;
    const w = 3.5 + rng() * 5.5;
    const d = 4.0 + rng() * 7.0;
    const h = 65 + rng() * 32;
    const base = -80;

    const mBody = new T.Matrix4().compose(
      new T.Vector3(x, base + h / 2, z),
      new T.Quaternion(),
      new T.Vector3(w, h, d)
    );
    if (i % 3) bldg1.push(mBody);
    else bldg2.push(mBody);

    const mTrim = new T.Matrix4().compose(
      new T.Vector3(x, base + h + 0.12, z),
      new T.Quaternion(),
      new T.Vector3(w + 0.25, 0.24, d + 0.25)
    );
    trims.push(mTrim);

    if (i % 4 === 0) {
      const mSpire = new T.Matrix4().compose(
        new T.Vector3(x, base + h + 1.2, z),
        new T.Quaternion(),
        new T.Vector3(0.08, 2.3, 0.08)
      );
      spires.push(mSpire);
    }

    for (let y = base + 3; y < base + h - 1; y += 1.8) {
      for (let xx = x - w / 2 + 0.5; xx < x + w / 2 - 0.3; xx += 0.85) {
        if (rng() > 0.25) {
          const mWin = new T.Matrix4().compose(
            new T.Vector3(xx, y, z + d / 2 + 0.02),
            new T.Quaternion(),
            new T.Vector3(0.28, 0.48, 0.02)
          );
          windows.push(mWin);
        }
      }
    }
  }

  const boxGeo = new T.BoxGeometry(1, 1, 1);
  const m1 = new T.InstancedMesh(boxGeo, new T.MeshStandardMaterial({color: '#405b70', roughness: 0.8, metalness: 0.08, flatShading: true}), bldg1.length);
  bldg1.forEach((m, i) => m1.setMatrixAt(i, m));
  s.add(m1);

  const m2 = new T.InstancedMesh(boxGeo, new T.MeshStandardMaterial({color: '#596778', roughness: 0.8, metalness: 0.08, flatShading: true}), bldg2.length);
  bldg2.forEach((m, i) => m2.setMatrixAt(i, m));
  s.add(m2);

  const mT = new T.InstancedMesh(boxGeo, new T.MeshStandardMaterial({color: '#65768a', roughness: 0.7, metalness: 0.08, flatShading: true}), trims.length);
  trims.forEach((m, i) => mT.setMatrixAt(i, m));
  s.add(mT);

  if (spires.length) {
    const mS = new T.InstancedMesh(new T.CylinderGeometry(0.5, 0.5, 1, 8), new T.MeshStandardMaterial({color: '#7c91a4', roughness: 0.5, metalness: 0.2}), spires.length);
    spires.forEach((m, i) => mS.setMatrixAt(i, m));
    s.add(mS);
  }

  const mW = new T.InstancedMesh(boxGeo, this.windowMaterial, windows.length);
  windows.forEach((m, i) => mW.setMatrixAt(i, m));
  s.add(mW);

  // Distant glowing sun/moon disc
  this.sunDisc = new T.Mesh(new T.IcosahedronGeometry(1, 2), new T.MeshBasicMaterial({color: '#ffdfb5'}));
  this.sunDisc.position.set(-36, 17, -75);
  this.sunDisc.scale.set(4, 4, 4);
  s.add(this.sunDisc);
 }

 label(text, position, kind, id=null) {
  const el = document.createElement('div');
  el.className = `nx3-label ${kind}`;
  el.textContent = text;
  this.layer.append(el);
  const obj = {el, position, id};
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
  this.controls.target.set(0, 0, 0);
  this.camera.position.set(...(top ? [0, 60, 0.01] : [40, 34, 46]));
  this.camera.zoom = 1;
  this.camera.lookAt(0, 0, 0);
  this.camera.updateProjectionMatrix();
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
   // Flatten agents from teams array
   const agents = (state.teams || []).flatMap(t => t.agents || []);
   for (const a of agents) this.sim.setBusy(a.id, ['running', 'reviewing', 'recovering'].includes(a.status));
   this.memoryBytes = Number.isFinite(state.memory_bytes) ? state.memory_bytes : (state.memory?.bytes ?? null);
   this.brainLabel.el.textContent = `BIG BRAIN · ${this.memoryBytes === null ? '—' : this.memoryBytes < 1024 ? this.memoryBytes + ' B' : (this.memoryBytes / 1024).toFixed(1) + ' KiB'}`;
   this.setConnection(state.connected ? 'Hermes terhubung' : 'Koneksi terputus · state terakhir');
   for (const event of state.events || []) {
     if (['brain.read', 'snapshot.applied'].includes(event.type)) this.pulse(event);
   }
 }

 pulse(event) {
  if (!event.id || this.seen.has(event.id) || !this.avatars.has(event.agent_id)) return;
  this.seen.set(event.id, this.time);
  if (this.seen.size > 512) this.seen.delete(this.seen.keys().next().value);
  if (this.pulses.length >= 2 || !this.motion || this.reduced.matches) return;
  this.pulses.push({agent: event.agent_id, start: this.time});
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

  if (this.motion && !this.reduced.matches) {
    this.time += dt;
    this.sim.tick(dt);
  }

  // Smooth V2 time-of-day transitions
  this.environment(dt);

  // Character poses & brain rotation
  for (const a of this.sim.agents) {
    poseAvatar(this.avatars.get(a.id), a, this.time, !this.motion || this.reduced.matches);
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
    
      // Particle burst along the beam path
      for (let j = 0; j < 4; j++) {
        const particleIndex = (i * 4 + j) % this.particlePool.length;
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
  this.controls.update();
  this.renderer.render(this.scene, this.camera);

  // Optimized label screen projection
  for (const label of this.labels) {
    const p = typeof label.position === 'function' ? label.position() : label.position;
    this.projVec.copy(p).project(this.camera);
    const x = (this.projVec.x * 0.5 + 0.5) * this.width;
    const y = (-this.projVec.y * 0.5 + 0.5) * this.height;
    label.screen = [x, y];
    label.el.style.display = (this.projVec.z > 1 || this.projVec.z < -1) ? 'none' : '';
    label.el.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`;
  }

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
  this.scene.traverse(o => {
    if (o.isInstancedMesh || o.isMesh) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    }
  });
  if (this.skyTexture) this.skyTexture.dispose();
  if (this.windowMaterial) this.windowMaterial.dispose();
  this.renderer.dispose();
  this.renderer.domElement.remove();
  this.layer.remove();
  if (--views === 0) disposeShared();
  this.container.classList.remove('nx3-viewport');
 }
}
