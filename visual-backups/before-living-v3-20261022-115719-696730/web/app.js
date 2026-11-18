import {OfficeScene} from './scene.js';
import {NexusOfficeView} from './nexus-v2/view.js';
import {SKINS} from './nexus-v2/model.js';
import {mountUpgrade} from './nexus-v2/bridge.js';

const $ = id => document.getElementById(id);
const E = (tag, cls, text) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
};
const humanBytes = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KiB' : (n / 1048576).toFixed(2) + ' MiB';
const date = t => new Date(t * 1000).toLocaleString('id-ID', {hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: 'short'});
const statusLabel = {
  queued: 'Antrean', running: 'Bekerja', reviewing: 'Pemeriksaan',
  awaiting_approval: 'Perlu persetujuan', done: 'Selesai', failed: 'Gagal',
  cancelled: 'Dibatalkan', interrupted: 'Terputus'
};

let token = '', state = null, view = 'office', selection = {type: 'brain', id: 'brain'};
let scene, legacyScene, brain = null, toastTimer, polling = false;
let upgradeView = null, upgradePresenter = null, upgradeRollback = null;
let unsubscribeRefresh = null;

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 6000);
}

function button(text, fn, cls = '') {
  let b = E('button', cls, text);
  b.type = 'button';
  b.onclick = async () => {
    b.disabled = true;
    try { await fn(); }
    catch (e) { toast(e.message); }
    finally { b.disabled = false; }
  };
  return b;
}

async function api(path, data) {
  let r = await fetch('/api' + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token},
    body: data === undefined ? undefined : JSON.stringify(data)
  });
  let b = await r.json();
  if (!r.ok) throw Error(b.error || 'Request gagal');
  return b;
}

function choose(type, id) {
  selection = {type, id};
  renderInspector();
  if (upgradeView && type !== 'brain') {
    upgradeView.focus(id);
  } else if (legacyScene) {
    legacyScene.focus(type, id);
  }
  if (type === 'brain') toast('Big Brain dipilih . buka memori melalui panel kanan');
}

function switchView(name) {
  view = name;
  for (let el of document.querySelectorAll('.view')) el.hidden = el.id !== name + '-view';
  for (let b of document.querySelectorAll('[data-view]')) b.classList.toggle('selected', b.dataset.view === name);
  if (name === 'brain') loadBrain();
  if (name === 'tasks') renderTasks();
  if (name === 'activity') renderActivity();
}

function pauseLegacy() {
  if (legacyScene) {
    legacyScene.paused = true;
    const canvas = $('office-canvas');
    if (canvas) canvas.hidden = true;
  }
}

function resumeLegacy() {
  if (legacyScene) {
    legacyScene.paused = false;
    const canvas = $('office-canvas');
    if (canvas) canvas.hidden = false;
  }
}

function openExistingInspector(kind, id) {
  choose(kind, id);
}

async function initializeUpgrade(state) {
  if (upgradeView) return; // Already initialized

  const container = $('office-viewport');
  const legacyElement = $('office-canvas');

  // Build teams config for the view
  const teams = state.teams.map(t => ({
    id: t.id,
    name: t.name,
    color: t.color,
    agents: t.agents.map(a => ({id: a.id, name: a.name, role: a.role})),
    icon: t.icon
  }));

  // Map agent IDs to visual skins from config/visual.example.json
  // Uses actual agent IDs from config/office.json
  const skinIds = {
    'editor-1': 'eren', 'editor-2': 'shinei', 'brand': 'asta',
    'analyst': 'deku', 'research-review': 'choso', 'builder': 'levi',
    'code-review': 'archer', 'planner': 'saber', 'ops-review': 'lancer'
  };
  const skins = Object.fromEntries(
    Object.entries(skinIds)
      .map(([id, skin]) => {
        const match = SKINS.find(s => s.id === skin);
        if (!match) throw Error('Unknown visual skin ' + skin);
        return [id, match];
      })
  );

  // mapState: convert real Nexus state to presentation frame
  function mapState(raw) {
    if (!raw || !raw.teams || !raw.tasks) {
      return {mode: 'live', memoryBytes: null, agents: []};
    }
    const configured = raw.teams.flatMap(t => t.agents);
    console.log('[Nexus-v2] mapState: tasks=', raw.tasks.map(t => ({agent: t.agent, status: t.status, stage: t.stage})));
    console.log('[Nexus-v2] mapState: agents=', configured.map(a => ({id: a.id, stage: a.stage})));
    const result = {
      mode: raw.mode,
      memoryBytes: raw.memory?.bytes ?? null,
      agents: configured.map(agent => {
        // Find the most recent task for this agent (any status except done/failed/cancelled if there's a running one)
        const agentTasks = raw.tasks.filter(t => t.agent === agent.id);
        // Prefer running > reviewing > awaiting_approval > interrupted > other
        const priority = {running: 5, reviewing: 4, awaiting_approval: 3, interrupted: 2, queued: 1, done: 0, failed: 0, cancelled: 0};
        const task = agentTasks.sort((a, b) => (priority[b.status] || 0) - (priority[a.status] || 0))[0] || null;
        const run = task ? raw.runs?.find(r => r.id === task.run_id) : null;
        return {
          id: String(agent.id),
          status: derivePresentationStatus(agent, task),
          taskId: task ? String(task.id) : null,
          snapshotReady: task ? hasVerifiedSnapshot(task, run) : false
        };
      })
    };
    return result;
  }

  function derivePresentationStatus(agent, task) {
    if (!task) return 'idle';
    if (task.status === 'running' && agent.stage === 'worker') return 'working';
    if (task.status === 'running' && agent.stage === 'reviewer') return 'reviewing';
    if (task.status === 'failed' || task.status === 'cancelled' || task.status === 'interrupted') return 'error';
    if (task.status === 'awaiting_approval') return 'reviewing';
    return 'idle';
  }

  function hasVerifiedSnapshot(task, run) {
    // Check if task has result.json or snapshot data
    return task && task.progress === 100 && task.status === 'done';
  }

  // mapEvents: extract verified memory events from raw state
  function mapEvents(raw) {
    if (!raw || !raw.events) return [];
    // Only return events that represent actual memory reads/writes
    // Filter by kind if available, otherwise use all events with IDs
    return raw.events
      .filter(e => e.id && (e.kind === 'memory-read' || e.kind === 'snapshot' || e.kind === 'memory-write'))
      .map(e => ({
        id: String(e.id),
        agentId: String(e.agentId || 'unknown'),
        kind: e.kind === 'snapshot' ? 'snapshot' : 'memory-read'
      }));
  }

  try {
    const upgrade = await mountUpgrade({
      container,
      legacyElement,
      pauseLegacy,
      resumeLegacy,
      options: {
        teams,
        quality: 'balanced',
        timeMode: 'auto',
        motion: true,
        skins,
        onInspect: openExistingInspector
      },
      mapState,
      mapEvents
    });

    upgradeView = upgrade.view;
    upgradePresenter = upgrade.presenter;
    upgradeRollback = upgrade.rollback;

    // Subscribe to existing refresh results
    unsubscribeRefresh = subscribeToRefresh(upgradePresenter);

    console.log('[Nexus-v2] Visual upgrade mounted successfully');
  } catch (error) {
    console.error('[Nexus-v2] Failed to mount visual upgrade:', error);
    if (upgradeView) {
      upgradeView.dispose();
      upgradeView = null;
    }
    // Fallback to legacy renderer is automatic via mountUpgrade rollback
  }
}

function subscribeToRefresh(presenter) {
  let lastSequence = -Infinity;
  return async (raw, sequence) => {
    if (Number.isFinite(sequence) && sequence <= lastSequence) return;
    lastSequence = sequence;
    try {
      await presenter.onState(raw, {sequence});
    } catch (error) {
      console.error('[Nexus-v2] Presenter error:', error);
    }
  };
}

async function refresh() {
  console.log('[Nexus-v2] refresh() called');
  if (polling) return;
  polling = true;
  try {
    if (!token) {
      let r = await fetch('/api/session');
      if (!r.ok) throw Error('Runtime tidak tersedia');
      token = (await r.json()).token;
    }
    state = await api('/state');
      // Initialize upgrade on first successful state fetch
    if (!upgradeView && state) {
  await initializeUpgrade(state);
    }

    $('connection').textContent = '● CONNECTED';
    $('connection').classList.remove('amber');
    $('mode').textContent = state.mode.toUpperCase();
    $('mode').classList.toggle('amber', state.mode === 'demo');
    $('scene-mode').textContent = (state.mode === 'demo' ? 'SIMULATION' : 'HERMES LIVE') + (legacyScene?.software ? ' . CPU' : ' . GPU');
    $('agent-count').textContent = state.teams.reduce((n, t) => n + t.agents.length, 0);
    $('active-count').textContent = state.tasks.filter(t => t.status === 'running').length;
    $('memory-count').textContent = humanBytes(state.memory.bytes);
    $('review-count').textContent = state.runs.filter(r => r.status === 'awaiting_approval').length + state.memory.pending;
    $('footer-status').textContent = 'Runtime connected . ' + state.max_parallel + ' parallel workers . ' + date(state.server_time);

    // Update legacy scene if upgrade not active
    if (!upgradeView && legacyScene) {
      legacyScene.update(state);
    }

    renderTeams();
    renderInspector();
    $('recent').replaceChildren(...state.events.slice(0, 5).map(eventEl));
    if (view === 'tasks') renderTasks();
    if (view === 'activity') renderActivity();

    // Feed state to visual upgrade presenter
    if (upgradePresenter && state) {
      try {
        console.log('[Nexus-v2] Feeding state to presenter, tasks:', state.tasks?.length);
        await unsubscribeRefresh(state, Date.now());
      } catch (e) {
        console.error('[Nexus-v2] Presenter update error:', e);
      }
    } else {
      console.log('[Nexus-v2] Not feeding - presenter:', !!upgradePresenter, 'state:', !!state);
    }

  } catch (e) {
    $('connection').textContent = 'OFFLINE';
    $('connection').classList.add('amber');
    $('footer-status').textContent = 'Koneksi terputus. Tampilan terakhir dapat kedaluwarsa. ' + e.message;
  } finally {
    polling = false;
  }
}

// --- UI handlers (unchanged from original) ---

for (let b of document.querySelectorAll('[data-view]')) b.onclick = () => switchView(b.dataset.view);
for (let b of document.querySelectorAll('[data-close]')) b.onclick = () => $(b.dataset.close).close();

try {
  legacyScene = new OfficeScene($('office-canvas'), $('labels'), choose);
} catch (e) {
  $('scene-error').hidden = false;
  $('scene-error').textContent = e.message;
}

$('camera-home').onclick = () => {
  if (upgradeView) upgradeView.home();
  else legacyScene?.home();
};
$('camera-top').onclick = () => {
  if (upgradeView) upgradeView.top();
  else legacyScene?.top();
};
$('motion').onclick = () => {
  const enabled = !$('motion').getAttribute('aria-pressed') || $('motion').getAttribute('aria-pressed') === 'false';
  if (upgradeView) {
    upgradeView.setMotion(enabled);
  } else if (legacyScene) {
    legacyScene.paused = !enabled;
  }
  $('motion').setAttribute('aria-pressed', String(enabled));
  $('motion').textContent = enabled ? 'Ⅱ Motion' : '▶ Motion';
};

$('reset-inspector').onclick = () => choose('brain', 'brain');

function showTaskForm(team) {
  if (!state) return toast('Runtime belum tersambung');
  $('task-team').replaceChildren(...state.teams.map(t => {
    let o = E('option', '', t.name);
    o.value = t.id;
    return o;
  }));
  if (team) $('task-team').value = team;
  $('task-mode-note').textContent = state.mode === 'demo'
    ? 'Mode DEMO: alur dan animasi berjalan, tanpa memanggil model atau membuat hasil media.'
    : 'Mode LIVE: tugas menjalankan Hermes lokal dan dapat memakai kuota model sesuai konfigurasi profilmu.';
  $('task-dialog').showModal();
}

$('new-task').onclick = () => showTaskForm();

$('task-form').onsubmit = async e => {
  e.preventDefault();
  let b = e.submitter;
  b.disabled = true;
  try {
    let r = await api('/runs', {
      team: $('task-team').value,
      title: $('task-title').value,
      items: $('task-items').value.split('\n').map(x => x.trim()).filter(Boolean)
    });
    $('task-dialog').close();
    $('task-form').reset();
    toast('Tugas ' + r.id.slice(0, 6) + ' masuk antrean');
    await refresh();
    switchView('tasks');
  } catch (e) { toast(e.message); }
  finally { b.disabled = false; }
};

$('add-memory').onclick = () => $('memory-dialog').showModal();

$('memory-form').onsubmit = async e => {
  e.preventDefault();
  let b = e.submitter;
  b.disabled = true;
  try {
    await api('/memory/propose', {title: $('memory-title').value, content: $('memory-text').value});
    $('memory-dialog').close();
    $('memory-form').reset();
    toast('Proposal tersimpan; menunggu persetujuan');
    await loadBrain();
    await refresh();
  } catch (e) { toast(e.message); }
  finally { b.disabled = false; }
};

$('sync-memory').onclick = async () => {
  try {
    await api('/memory/sync', {});
    await loadBrain();
    await refresh();
    toast('Sumber memori disegarkan');
  } catch (e) { toast(e.message); }
};

let searchTimer;
$('memory-search').oninput = () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadBrain, 250);
};

$('refresh-tasks').onclick = refresh;

function renderTeams() {
  let root = $('team-strip');
  root.replaceChildren();
  const icons = {film: '▣', search: '⌕', code: '⌘', layers: '▤'};
  for (let t of state.teams) {
    let b = E('button', 'team-card');
    b.style.setProperty('--accent', t.color);
    b.onclick = () => { choose('team', t.id); if (upgradeView) upgradeView.focus('team', t.id); else legacyScene?.focus('team', t.id); };
    let line = E('div');
    line.append(E('span', 'team-symbol', icons[t.icon] || '◈'), E('h3', '', t.name));
    b.append(line, E('p', '', t.description));
    let bottom = E('div', 'team-bottom'), avatars = E('span', 'mini-avatars');
    for (let a of t.agents) avatars.append(E('i', '', a.name[0]));
    let n = state.tasks.filter(x => x.status === 'running' && t.agents.some(a => a.id === x.agent)).length;
    bottom.append(avatars, E('span', '', n ? n + ' working' : t.agents.length + ' agents . ready'));
    b.append(bottom);
    root.append(b);
  }
}

function inspectorRow(label, value) {
  let r = E('div', 'inspector-row');
  r.append(E('span', '', label), E('strong', '', value));
  return r;
}

function renderInspector() {
  if (!state) return;
  let root = $('inspector');
  root.replaceChildren();
  let hero = E('div', 'inspector-hero');
  if (selection.type === 'brain') {
    hero.append(E('span', 'brain-icon', '◈'), E('h2', '', 'The shared brain'), E('p', '', 'Konteks bersama untuk setiap tim.'));
    let metrics = E('div', 'inspector-metrics');
    for (let [value, label] of [[humanBytes(state.memory.bytes), 'STORED MEMORY'], [state.memory.sources.filter(x => x.status === 'ready').length, 'SOURCES READY']]) {
      let el = E('div');
      el.append(E('strong', '', value), E('small', '', label));
      metrics.append(el);
    }
    hero.append(metrics);
    root.append(hero);
    let list = E('div', 'inspector-list');
    list.append(
      inspectorRow('Ukuran aktual', state.memory.bytes.toLocaleString() + ' bytes'),
      inspectorRow('Proposal baru', String(state.memory.pending)),
      inspectorRow('Sumber dibaca', 'Read-only'),
      inspectorRow('Sinkronisasi', 'Setiap 5 detik'),
      inspectorRow('Pemakaian konteks', 'Snapshot per tugas')
    );
    root.append(list, button('Buka shared memory ↗', () => switchView('brain'), 'wide'));
  } else if (selection.type === 'team') {
    let t = state.teams.find(x => x.id === selection.id);
    if (!t) return;
    hero.style.borderColor = t.color;
    hero.append(E('span', 'brain-icon', '▤'), E('h2', '', t.name), E('p', '', t.description));
    root.append(hero);
    for (let a of t.agents) {
      let row = E('div', 'inspector-member'),
          b = button(a.name + ' ↗', () => { choose('agent', a.id); if (upgradeView) upgradeView.focus('agent', a.id); else legacyScene?.focus('agent', a.id); });
      b.append(E('small', '', a.role + ' . ' + a.stage));
      row.append(b);
      root.append(row);
    }
    root.append(button('＋ Kirim tugas ke tim', () => showTaskForm(t.id), 'primary wide'));
  } else {
    let t = state.teams.find(x => x.agents.some(a => a.id === selection.id)),
        a = t?.agents.find(x => x.id === selection.id);
    if (!a) return;
    let task = state.tasks.find(x => x.agent === a.id && x.status === 'running');
    hero.append(E('span', 'brain-icon', '▧'), E('h2', '', a.name), E('p', '', a.role));
    root.append(hero,
      inspectorRow('Tim', t.name),
      inspectorRow('Status', task ? 'Working' : 'Ready'),
      inspectorRow('Model', state.mode === 'demo' ? 'Simulasi' : a.model || 'Dari profil Hermes'),
      inspectorRow('Profil', a.profile),
      inspectorRow('Tahap', a.stage)
    );
    if (task) {
      root.append(inspectorRow('Progres', task.progress + '%'), E('p', '', task.message), button('Lihat tugas ↗', () => showRun(task.run_id), 'wide'));
    } else {
      root.append(button('＋ Tugas untuk tim ini', () => showTaskForm(t.id), 'wide'));
    }
  }
}

function eventEl(ev) {
  let el = E('div', 'event');
  el.append(E('p', '', ev.message), E('time', '', date(ev.ts) + ' . ' + ev.kind));
  return el;
}

function renderActivity() {
  $('activity-list').replaceChildren(...state.events.map(eventEl));
}

function renderTasks() {
  if (!state) return;
  let board = $('task-board');
  board.replaceChildren();
  const columns = [
    ['Antrean', ['queued']],
    ['Dikerjakan', ['running', 'reviewing']],
    ['Tinjauan', ['awaiting_approval']],
    ['Arsip', ['done', 'failed', 'cancelled', 'interrupted']]
  ];
  for (let [label, statuses] of columns) {
    let col = E('div', 'board-column'),
        runs = state.runs.filter(r => statuses.includes(r.status));
    col.append(E('h3', '', label + ' / ' + runs.length));
    if (!runs.length) col.append(E('p', 'empty', 'Belum ada tugas di tahap ini.'));
    for (let r of runs) {
      let card = E('article', 'run-card'),
          tasks = state.tasks.filter(t => t.run_id === r.id),
          team = state.teams.find(t => t.id === r.team);
      card.append(E('small', '', team?.name + ' . ' + r.mode.toUpperCase()), E('h3', '', r.title), E('small', '', statusLabel[r.status]));
      let track = E('div', 'progress-track'), bar = E('span');
      bar.style.width = (tasks.length ? tasks.reduce((a, t) => a + t.progress, 0) / tasks.length : 0) + '%';
      track.append(bar);
      card.append(track, E('small', '', tasks.filter(t => t.status === 'done').length + '/' + tasks.length + ' tasks . ' + date(r.created)), button('Detail ↗', () => showRun(r.id)));
      if (r.status === 'awaiting_approval') card.append(button('Tinjau & putuskan', () => showRun(r.id), 'primary'));
      if (['queued', 'running', 'reviewing'].includes(r.status)) card.append(button('Batalkan', async () => { await api('/cancel', {id: r.id}); await refresh(); }));
      col.append(card);
    }
    board.append(col);
  }
}

async function showRun(id) {
  let r = state.runs.find(x => x.id === id);
  if (!r) return;
  let tasks = state.tasks.filter(x => x.run_id === id);
  $('detail-title').textContent = r.title;
  let root = $('detail-content');
  root.replaceChildren(E('p', '', statusLabel[r.status] + ' . ' + r.mode.toUpperCase() + ' . ' + id));
  for (let t of tasks) {
    let el = E('div', 'task-detail');
    el.append(E('h3', '', t.agent + ' / ' + t.stage), E('p', '', t.item), E('small', 'muted', (statusLabel[t.status] || t.status) + ' . ' + t.progress + '% . ' + t.message));
    let details = E('div');
    el.append(button('Baca keluaran & snapshot', async () => {
      let d = await api('/tasks/' + t.id);
      details.replaceChildren(E('pre', '', d.output || 'Belum ada keluaran. ' + d.message));
      if (d.snapshot) {
        let snap = JSON.parse(d.snapshot);
        details.append(E('p', '', `Snapshot: ${snap.included_bytes} / ${snap.total_bytes} bytes . ${snap.truncated ? 'dipotong sesuai batas' : 'utuh'}`), E('small', 'muted', 'SHA256 ' + snap.sha256));
      }
    }), details);
    root.append(el);
  }
  root.append(button('↻ Perbarui detail', async () => { await refresh(); await showRun(id); }));
  if (r.status === 'awaiting_approval') {
    root.append(E('p', 'callout', 'Baca keluaran worker dan reviewer sebelum memutuskan. Persetujuan mencatat penerimaan hasil; tidak mengunggah atau memublikasikan apa pun.'),
      button('Setujui hasil', async () => { await api('/approve', {id}); $('detail-dialog').close(); await refresh(); toast('Hasil disetujui'); }, 'primary wide'),
      button('Tolak / tutup run', async () => { await api('/cancel', {id}); $('detail-dialog').close(); await refresh(); }, 'wide'));
  }
  if (['failed', 'interrupted', 'cancelled', 'done'].includes(r.status)) {
    root.append(button('Jalankan ulang sebagai run baru', async () => {
      await api('/runs', {team: r.team, title: r.title, items: tasks.filter(t => t.stage === 'worker').map(t => t.item)});
      $('detail-dialog').close(); await refresh(); toast('Run baru dibuat; hasil lama tetap tersimpan');
    }, 'wide'));
  }
  if (!$('detail-dialog').open) $('detail-dialog').showModal();
}

async function loadBrain() {
  try {
    brain = await api('/brain?q=' + encodeURIComponent($('memory-search').value));
    renderBrain();
  } catch (e) { toast(e.message); }
}

function renderBrain() {
  let root = $('brain-content');
  root.replaceChildren();
  root.append(E('p', 'callout', `Total tersimpan: ${brain.bytes.toLocaleString()} byte. Jumlah ini adalah byte file sumber + isi catatan yang disetujui, bukan token, RAM, atau KV cache model.`));
  for (let s of brain.sources) {
    let el = E('article', 'memory-card');
    el.append(E('h3', '', s.id + ' . ' + s.status), E('small', '', s.path + ' . ' + s.size.toLocaleString() + ' bytes . ' + date(s.updated)));
    if (s.content) {
      el.append(E('pre', '', s.content.slice(0, 16000)));
      if (s.content.length > 16000) el.append(E('small', 'muted', 'Pratinjau dipotong ke 16.000 karakter. Sumber asli tidak berubah.'));
    } else {
      el.append(E('p', 'empty', s.status === 'missing' ? 'File belum ditemukan. Atur memory_sources pada config/office.json lalu restart.' : 'Sumber belum dapat dibaca sebagai teks UTF-8.'));
    }
    root.append(el);
  }
  for (let n of brain.notes) {
    let el = E('article', 'memory-card');
    el.append(E('h3', '', n.title + ' . ' + n.status), E('small', '', n.source + ' . ' + date(n.created)), E('pre', '', n.content));
    if (n.status === 'pending') {
      for (let [label, decision] of [['Setujui', 'approved'], ['Tolak', 'rejected']]) {
        el.append(button(label, async () => { await api('/memory/decide', {id: n.id, decision}); await loadBrain(); await refresh(); }, decision === 'approved' ? 'primary' : ''));
      }
    }
    root.append(el);
  }
  if (!brain.sources.length && !brain.notes.length) root.append(E('p', 'empty', 'Tidak ada memori yang cocok.'));
}

$('help').onclick = () => {
  $('detail-title').textContent = 'Panduan singkat';
  let root = $('detail-content');
  root.replaceChildren();
  for (let [h, p] of [
    ['1. Jelajahi kantor', 'Drag untuk memutar, scroll untuk zoom, klik label ruangan atau agen untuk detail. Tombol keyboard pada kanvas: panah, +, −, Home.'],
    ['2. Kirim pekerjaan', 'Buat tugas, pilih tim, isi brief dan satu item per baris. Worker berjalan paralel sesuai batas, reviewer memeriksa hasil, lalu pengguna memutuskan.'],
    ['3. Sambungkan Hermes', 'Baca START_HERE.md dan HERMES_SETUP.md pada paket. Konfigurasi default menggunakan mode demo. Mode live memerlukan Hermes yang sudah terautentikasi, profil unik per agen, dan konfigurasi MCP.'],
    ['4. Big Brain', 'File cache Hermes diimpor read-only. Catatan baru hanya dibagikan setelah persetujuan. Snapshot diambil setiap tugas dimulai; MCP memungkinkan pembacaan terkini.'],
    ['5. Batas implementasi', 'Kantor memakai model 3D prosedural. Kemiripan dengan video belum terverifikasi karena video tidak dapat diakses saat pembuatan. Tool-level telemetry Hermes tidak disadap: progres berasal dari milestone MCP atau status proses.']
  ]) root.append(E('h3', '', h), E('p', 'callout', p));
  $('detail-dialog').showModal();
};

refresh();
setInterval(refresh, 1500);
