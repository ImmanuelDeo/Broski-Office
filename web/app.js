import {AGENTS, TEAMS, SKINS} from './nexus-v3/roster.js';
import {mountLivingOffice} from './nexus-v3/bridge.js';

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
let brain = null, toastTimer, polling = false;
let unsubscribeRefresh = null;
let nexusView = null;

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
  if (type === 'brain') toast('Big Brain dipilih · buka memori melalui panel kanan');
}

function switchView(name) {
  view = name;
  for (let el of document.querySelectorAll('.view')) el.hidden = el.id !== name + '-view';
  for (let b of document.querySelectorAll('[data-view]')) b.classList.toggle('selected', b.dataset.view === name);
  if (name === 'brain') loadBrain();
  if (name === 'tasks') renderTasks();
  if (name === 'activity') renderActivity();
  if (name === 'hermes') loadHermes();
  
  // Pause/resume 3D view based on visibility
  if (nexusView) {
    nexusView.setActive(name === 'office');
  }
}

function openExistingInspector(kind, id) {
  choose(kind, id);
}

async function refresh() {
  if (polling) return;
  polling = true;
  try {
        if (!token) {
          let r = await fetch('/api/session');
          if (!r.ok) throw Error('Runtime tidak tersedia');
          token = (await r.json()).token;
        }
        state = await api('/state');

        $('connection').textContent = '● CONNECTED';
        $('connection').classList.remove('amber');
        $('mode').textContent = state.mode.toUpperCase();
        $('mode').classList.toggle('amber', state.mode === 'demo');
        $('scene-mode').textContent = (state.mode === 'demo' ? 'SIMULATION' : 'HERMES LIVE') + ' · VIDEO';
        $('agent-count').textContent = state.teams.reduce((n, t) => n + t.agents.length, 0);
        $('active-count').textContent = state.tasks.filter(t => t.status === 'running').length;
        $('memory-count').textContent = humanBytes(state.memory.bytes);
        $('review-count').textContent = state.runs.filter(r => r.status === 'awaiting_approval').length + state.memory.pending;
        $('footer-status').textContent = 'Runtime connected · ' + state.max_parallel + ' parallel workers · ' + date(state.server_time);

        // Initialize the living office once, then feed it projected state.
        if (!nexusView) {
          const viewport = $('office-viewport');
          if (viewport) {
            nexusView = mountLivingOffice({
              container: viewport,
              quality: 'balanced',
              projectState: projectOfficeState,
              onSelect: id => {
                if (id === 'brain') choose('brain', 'brain');
                else if (TEAMS.some(t => t.id === id)) choose('team', id);
                else choose('agent', id);
              },
              onError: e => console.error('Living office:', e)
            });
            window.nexusView = nexusView;
          }
        }
        if (nexusView) nexusView.update(state);

        renderTeams();
        renderAgents();
        renderInspector();
        $('recent').replaceChildren(...state.events.slice(0, 5).map(eventEl));
        if (view === 'tasks') renderTasks();
        if (view === 'activity') renderActivity();

      } catch (e) {
    $('connection').textContent = 'OFFLINE';
    $('connection').classList.add('amber');
    if (nexusView) nexusView.disconnect();
    $('footer-status').textContent = 'Koneksi terputus. Tampilan terakhir dapat kedaluwarsa. ' + e.message;
  } finally {
    polling = false;
  }
}

// Project the office API state into the canonical living-office state.
const pulseKinds = new Set(['task.started', 'brain.read', 'snapshot.applied']);
function projectOfficeState(s) {
  const busy = new Map();
  for (const t of s.tasks) {
    if (t.status === 'running') busy.set(t.agent, 'running');
    else if (t.status === 'reviewing' && !busy.has(t.agent)) busy.set(t.agent, 'reviewing');
  }
  return {
    schema_version: 3,
    connected: true,
    memory_bytes: Number.isSafeInteger(s.memory?.bytes) ? s.memory.bytes : null,
    agents: (s.teams || []).flatMap(t => t.agents || []).map(a => ({id: a.id, status: busy.get(a.id) || 'idle'})),
    events: (s.events || []).filter(ev => pulseKinds.has(ev.type || ev.kind)).map(ev => ({id: ev.id, type: ev.type || ev.kind, agent_id: ev.agent_id}))
  };
}

// --- UI handlers (unchanged from original) ---

for (let b of document.querySelectorAll('[data-view]')) b.onclick = () => switchView(b.dataset.view);
for (let b of document.querySelectorAll('[data-close]')) b.onclick = () => $(b.dataset.close).close();

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

// Scene controls
$('camera-home').onclick = () => nexusView?.home(false);
$('camera-top').onclick = () => nexusView?.home(true);
$('time-mode').onchange = e => nexusView?.setTime(e.target.value);
$('motion').onclick = () => {
  if (!nexusView) return;
  const on = $('motion').getAttribute('aria-pressed') !== 'true';
  $('motion').setAttribute('aria-pressed', String(on));
  $('motion').textContent = on ? 'Ⅱ Motion' : '▶ Motion';
  nexusView.setMotion(on);
};
$('quality-mode').onchange = e => {
  if (!nexusView) return;
  const q = e.target.value;
  // Recreate the view at the chosen quality; state feeds in on the next poll.
  const viewport = $('office-viewport');
  nexusView.dispose();
  nexusView = mountLivingOffice({
    container: viewport, quality: q,
    projectState: projectOfficeState,
    onSelect: id => {
      if (id === 'brain') choose('brain', 'brain');
      else if (TEAMS.some(t => t.id === id)) choose('team', id);
      else choose('agent', id);
    },
    onError: err => console.error('Living office:', err)
  });
  window.nexusView = nexusView;
  if (state) nexusView.update(state);
  nexusView.setTime($('time-mode').value);
  nexusView.setMotion($('motion').getAttribute('aria-pressed') === 'true');
};

$('props-toggle').onclick = () => {
  const open = $('props-toggle').getAttribute('aria-expanded') !== 'true';
  $('props-toggle').setAttribute('aria-expanded', String(open));
  $('props-panel').hidden = !open;
};
for (const [id, method, scale] of [
  ['prop-particles', 'setParticles', 1], ['prop-ambient', 'setAmbient', 1],
  ['prop-speed', 'setSpeed', 1], ['prop-zoom', 'setZoomLevel', 1]
]) $(id).oninput = e => nexusView?.[method]?.(Number(e.target.value) * scale);
$('prop-hover').onchange = e => nexusView?.setHover(e.target.checked);
$('prop-follow').onchange = e => nexusView?.setFollow(e.target.checked);
setInterval(() => {
  if (!nexusView || $('props-panel').hidden) return;
  const s = nexusView.stats?.();
  if (s) $('prop-stats').textContent = `${s.fps} fps · ${s.agents} agen · ${s.draws} draw · ${s.selected || 'tidak ada pilihan'}`;
}, 1000);

function renderTeams() {
  let root = $('team-strip');
  root.replaceChildren();
  const icons = {film: '▣', search: '⌕', code: '⌘', layers: '▤'};
  for (let t of state.teams) {
    let b = E('button', 'team-card');
    b.style.setProperty('--accent', t.color);
    b.onclick = () => choose('team', t.id);
    let line = E('div');
    line.append(E('span', 'team-symbol', icons[t.icon] || '◈'), E('h3', '', t.name));
    b.append(line, E('p', '', t.description));
    let bottom = E('div', 'team-bottom'), avatars = E('span', 'mini-avatars');
    for (let a of t.agents) avatars.append(E('i', '', a.name[0]));
    let n = state.tasks.filter(x => x.status === 'running' && t.agents.some(a => a.id === x.agent)).length;
    bottom.append(avatars, E('span', '', n ? n + ' working' : t.agents.length + ' agents · ready'));
    b.append(bottom);
    root.append(b);
  }
}

function renderAgents() {
  const root = $('agent-strip');
  if (!root) return;
  const busy = new Map();
  for (const t of state.tasks) {
    if (t.status === 'running') busy.set(t.agent, t);
    else if (t.status === 'reviewing' && !busy.has(t.agent)) busy.set(t.agent, t);
  }
  const frag = document.createDocumentFragment();
  for (const t of state.teams) for (const a of t.agents) {
    const task = busy.get(a.id);
    const b = E('button', 'agent-chip' + (task ? ' working' : ''));
    b.style.setProperty('--accent', t.color);
    b.title = a.name + ' · ' + a.role + (task ? ' · ' + task.progress + '%' : ' · siap');
    b.onclick = () => choose('agent', a.id);
    b.append(E('i', 'agent-dot'), E('strong', '', a.name), E('small', '', task ? (task.status === 'reviewing' ? 'Review ' : '') + task.progress + '%' : 'Ready'));
    frag.append(b);
  }
  root.replaceChildren(frag);
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
          b = button(a.name + ' ↗', () => choose('agent', a.id));
      b.append(E('small', '', a.role + ' · ' + a.stage));
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
    const actions = E('div', 'inspector-actions');
    actions.append(
      button('⌖ Fokus di kantor', () => { switchView('office'); nexusView?.focusAgent(a.id); }),
      button('✦ Tanya di Hermes', () => {
        switchView('hermes');
        $('hermes-prompt').value = `Konteks agen ${a.name} (${a.role}, tim ${t.name}, profil ${a.profile}). `;
        $('hermes-prompt').focus();
      })
    );
    root.append(actions);
    if (task) {
      root.append(inspectorRow('Progres', task.progress + '%'), E('p', '', task.message), button('Lihat tugas ↗', () => showRun(task.run_id), 'wide'));
    } else {
      root.append(button('＋ Tugas untuk tim ini', () => showTaskForm(t.id), 'wide'));
    }
  }
}

function eventEl(ev) {
  let el = E('div', 'event');
  el.append(E('p', '', ev.message), E('time', '', date(ev.ts) + ' · ' + (ev.type || ev.kind || '')));
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
      card.append(E('small', '', team?.name + ' · ' + r.mode.toUpperCase()), E('h3', '', r.title), E('small', '', statusLabel[r.status]));
      let track = E('div', 'progress-track'), bar = E('span');
      bar.style.width = (tasks.length ? tasks.reduce((a, t) => a + t.progress, 0) / tasks.length : 0) + '%';
      track.append(bar);
      card.append(track, E('small', '', tasks.filter(t => t.status === 'done').length + '/' + tasks.length + ' tasks · ' + date(r.created)), button('Detail ↗', () => showRun(r.id)));
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
  root.replaceChildren(E('p', '', statusLabel[r.status] + ' · ' + r.mode.toUpperCase() + ' · ' + id));
  for (let t of tasks) {
    let el = E('div', 'task-detail');
    el.append(E('h3', '', t.agent + ' / ' + t.stage), E('p', '', t.item), E('small', 'muted', (statusLabel[t.status] || t.status) + ' · ' + t.progress + '% · ' + t.message));
    let details = E('div');
    el.append(button('Baca keluaran & snapshot', async () => {
      let d = await api('/tasks/' + t.id);
      details.replaceChildren(E('pre', '', d.output || 'Belum ada keluaran. ' + d.message));
      if (d.snapshot) {
        let snap = JSON.parse(d.snapshot);
        details.append(E('p', '', `Snapshot: ${snap.included_bytes} / ${snap.total_bytes} bytes · ${snap.truncated ? 'dipotong sesuai batas' : 'utuh'}`), E('small', 'muted', 'SHA256 ' + snap.sha256));
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
    el.append(E('h3', '', s.id + ' · ' + s.status), E('small', '', s.path + ' · ' + s.size.toLocaleString() + ' bytes · ' + date(s.updated)));
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
    el.append(E('h3', '', n.title + ' · ' + n.status), E('small', '', n.source + ' · ' + date(n.created)), E('pre', '', n.content));
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
}

// Hermes console
let hermesBusy = false;
function hRow(label, value) {
  let row = E('div', 'console-row');
  row.append(E('span', '', label), E('b', '', value ?? '—'));
  return row;
}
function hLog(kind, text) {
  let log = $('hermes-log'), empty = log.querySelector('.console-empty');
  if (empty) empty.remove();
  let el = E('div', 'console-msg ' + kind);
  el.append(E('small', '', new Date().toLocaleTimeString('id-ID')), E('pre', '', text));
  log.append(el);
  log.scrollTop = log.scrollHeight;
  return el;
}
function renderHermes(d) {
  $('hermes-badge').textContent = d.available ? 'CLI siap' : 'CLI tidak ada';
  $('hermes-badge').classList.toggle('warn', !d.available);
  if (!d.available) {
    $('hermes-status').replaceChildren(E('p', 'empty', d.error || 'Hermes CLI tidak ditemukan di mesin ini.'));
    return;
  }
  const modelLine = (d.status || []).find(x => /model|provider/i.test(x)) || '';
  $('hermes-model').textContent = modelLine.replace(/^\s*[-·]\s*/, '').slice(0, 90) || 'model dari config';
  let st = $('hermes-status');
  st.replaceChildren(hRow('Versi', d.version || '—'), hRow('Diperbarui', new Date(d.fetched_at * 1000).toLocaleTimeString('id-ID')));
  for (const line of (d.status || []).slice(0, 10)) st.append(E('p', 'console-line', line));
  let cron = $('hermes-cron');
  cron.replaceChildren();
  const cronLines = (d.cron || []).filter(l => !/^usage:/i.test(l));
  if (!cronLines.length) cron.append(E('p', 'empty', 'Tidak ada job terjadwal.'));
  for (const line of cronLines.slice(0, 8)) cron.append(E('p', 'console-line', line));
  let kb = $('hermes-kanban');
  kb.replaceChildren();
  if (!d.kanban?.length) kb.append(...(d.kanban_text || ['Tidak ada task.']).slice(0, 6).map(l => E('p', 'console-line', l)));
  for (const t of d.kanban || []) {
    let row = E('div', 'console-kanban');
    row.append(E('b', '', t.title || t.id), E('span', 'chip ' + (t.status || ''), t.status || '—'));
    kb.append(row);
  }
  let ses = $('hermes-sessions'), sel = $('hermes-session');
  ses.replaceChildren(); sel.replaceChildren(new Option('Sesi baru', ''));
  const lines = (d.sessions || []).filter(l => !/^usage:/i.test(l));
  if (!lines.length) ses.append(E('p', 'empty', 'Belum ada sesi.'));
  for (const line of lines.slice(0, 8)) {
    ses.append(E('p', 'console-line', line));
    const m = line.match(/([0-9a-f]{8,}|[0-9]{8}_[0-9]{6}_[0-9a-f]+)/);
    if (m) sel.append(new Option(line.slice(0, 64), m[1]));
  }
}
async function loadHermes(force = false) {
  $('hermes-badge').textContent = '…';
  try { renderHermes(await api('/hermes/overview' + (force ? '?refresh=1' : ''))); }
  catch (e) { $('hermes-badge').textContent = 'Gagal'; toast(e.message); }
}
$('hermes-refresh').onclick = () => loadHermes(true);
$('hermes-clear').onclick = () => $('hermes-log').replaceChildren(E('div', 'console-empty', 'Transkrip dibersihkan. Sesi Hermes tidak berubah.'));
$('hermes-override').onchange = e => { $('hermes-model-input').disabled = !e.target.checked; };
$('hermes-form').onsubmit = async e => {
  e.preventDefault();
  const prompt = $('hermes-prompt').value.trim();
  if (!prompt || hermesBusy) return;
  hermesBusy = true;
  const btn = $('hermes-form').querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Berjalan…';
  hLog('user', prompt);
  const pending = hLog('pending', 'Menjalankan Hermes…');
  const modelInput = $('hermes-override').checked ? $('hermes-model-input').value.trim() : '';
  const [provider, model] = modelInput.includes('/') ? modelInput.split('/', 2) : ['', modelInput];
  try {
    let r = await api('/hermes/chat', {prompt, resume: $('hermes-session').value || undefined, model: model || undefined, provider: provider || undefined});
    pending.remove();
    hLog('assistant', r.text || '(tanpa keluaran)');
  } catch (err) {
    pending.remove();
    hLog('error', err.message);
  } finally {
    hermesBusy = false; btn.disabled = false; btn.textContent = 'Kirim ↵';
    loadHermes(true);
  }
};
$('hermes-prompt').addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('hermes-form').requestSubmit();
});
for (const b of document.querySelectorAll('[data-hermes-act]')) {
  b.onclick = async () => {
    const out = $('hermes-output');
    out.hidden = false; out.textContent = 'Menjalankan ' + b.dataset.hermesAct + '…';
    try {
      const r = await api('/hermes/act', {action: b.dataset.hermesAct});
      out.textContent = r.text || '(selesai tanpa keluaran)';
    } catch (e) { out.textContent = e.message; }
    loadHermes(true);
  };
}

refresh();
setInterval(refresh, 1500);