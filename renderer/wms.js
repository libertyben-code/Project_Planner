// =====================================================
//  WMS Project Planning — Application Script (v2)
//  ES module — loaded via <script type="module">
// =====================================================
import { invoke, listenFileChanged, setWindowTitle } from './tauri-ipc.js';

// ═══ STATE ═══
let currentPath = null;
let _saveTimer = null;
let _ownWrite = false;
let _fileWatcherRegistered = false;

let projectMeta = {};
let phases = [];
let tasks = [];
let heuresData = [];
let internalTasks = [];
let interfacesData = [];
let fonctionnelData = [];
let dryrunData = [];
let installData = [];
let jalonsProjet = [];
let jalonsEquip = [];
let customTabs = [];

// ═══ IPC / SAVE ═══
function buildState() {
  return {
    meta: { ...projectMeta, updatedAt: new Date().toISOString() },
    phases, tasks, heuresData, internalTasks,
    interfaces: interfacesData,
    functional: fonctionnelData,
    dryRun: dryrunData,
    install: installData,
    billing: { jalonsProjet, jalonsEquipement: jalonsEquip },
    customTabs
  };
}

async function saveProject() {
  if (!currentPath) return;
  try {
    _ownWrite = true;
    const state = buildState();
    projectMeta.updatedAt = state.meta.updatedAt;
    await invoke('write_project_backup', { path: currentPath });
    await invoke('write_project', { path: currentPath, data: JSON.stringify(state, null, 2) });
    showSaveIndicator('saved');
  } catch (e) {
    showSaveIndicator('error');
    console.error('Save failed:', e);
  } finally {
    setTimeout(() => { _ownWrite = false; }, 300);
  }
}

function debouncedSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(saveProject, 800);
}
window._DS = debouncedSave;

function showSaveIndicator(state) {
  const el = document.getElementById('save-indicator');
  if (!el) return;
  if (state === 'saved') {
    el.textContent = 'Sauvegardé ✓'; el.className = 'save-indicator saved';
    setTimeout(() => { el.textContent = ''; el.className = 'save-indicator'; }, 2000);
  } else {
    el.textContent = 'Erreur de sauvegarde'; el.className = 'save-indicator error';
  }
}

async function loadProject(path) {
  try {
    const raw = await invoke('read_project', { path });
    const state = JSON.parse(raw);
    currentPath = path;
    applyState(state);
    renderAll();
    if (!_fileWatcherRegistered) {
      _fileWatcherRegistered = true;
      listenFileChanged(() => {
        if (_ownWrite) return;
        document.getElementById('reload-banner').style.display = 'flex';
      });
    }
  } catch (e) {
    document.body.innerHTML = `<div style="padding:40px;color:#dc2626;font-family:sans-serif"><h2>Erreur de chargement</h2><p>${e}</p><button onclick="window.location.href='home.html'">Retour à l'accueil</button></div>`;
  }
}

function applyState(state) {
  projectMeta = state.meta || {};
  phases        = state.phases        || [];
  tasks         = state.tasks         || [];
  heuresData    = state.heuresData    || [];
  internalTasks = state.internalTasks || [];
  interfacesData = state.interfaces   || [];
  fonctionnelData = state.functional  || [];
  dryrunData    = state.dryRun        || [];
  installData   = state.install       || [];
  jalonsProjet  = state.billing?.jalonsProjet    || [];
  jalonsEquip   = state.billing?.jalonsEquipement || [];
  customTabs    = state.customTabs    || [];

  const m = projectMeta;
  setVal('pi-project', m.name || '');
  setVal('pi-pm', m.pm || '');
  setVal('pi-client', m.client || '');
  setVal('pi-cdptech', m.cdptech || '');
  setVal('pi-resplog', m.respLog || '');
  setVal('pi-erpconsult', m.erpConsult || '');
  setVal('pi-notes', m.notes || '');
  setVal('pi-start', m.startDate || '');
  setVal('pi-end', m.endDate || '');
  setVal('pi-install-orig', m.installDateOriginal || '');
  setVal('pi-install-delayed', m.installDateDelayed || '');
  setVal('pi-install-actual', m.installDateActual || '');
  setVal('pi-install-comment', m.installDateComment || '');

  const title = 'WMS Planning — ' + (m.name || 'Sans titre');
  setWindowTitle(title); document.title = title;
}

function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }

function reloadProject() {
  document.getElementById('reload-banner').style.display = 'none';
  if (currentPath) loadProject(currentPath);
}

function goHome() { window.location.href = 'home.html'; }

function renderAll() {
  renderGantt(); renderHeures(); renderTaches(); renderInterfaces();
  renderFonctionnel(); renderDryrun(); renderInstall(); renderFacturation();
  renderDashboard(); renderInstallDrift();
}

// ═══ META INPUTS ═══
function onMetaInput() {
  if (!currentPath) return;
  const m = projectMeta;
  m.name     = document.getElementById('pi-project').value;
  m.pm       = document.getElementById('pi-pm').value;
  m.client   = document.getElementById('pi-client').value;
  m.cdptech  = document.getElementById('pi-cdptech').value;
  m.respLog  = document.getElementById('pi-resplog').value;
  m.erpConsult = document.getElementById('pi-erpconsult').value;
  m.notes    = document.getElementById('pi-notes').value;
  m.startDate = document.getElementById('pi-start').value;
  m.endDate   = document.getElementById('pi-end').value;
  m.installDateOriginal = document.getElementById('pi-install-orig').value;
  m.installDateDelayed  = document.getElementById('pi-install-delayed').value;
  m.installDateActual   = document.getElementById('pi-install-actual').value;
  m.installDateComment  = document.getElementById('pi-install-comment').value;
  const title = 'WMS Planning — ' + (m.name || 'Sans titre');
  setWindowTitle(title); document.title = title;
  debouncedSave();
  renderInstallDrift();
}
function syncNav() { onMetaInput(); }

// ═══ INSTALL DRIFT ═══
function renderInstallDrift() {
  const block = document.getElementById('install-drift-block');
  if (!block) return;
  const m = projectMeta;
  const orig = m.installDateOriginal, delayed = m.installDateDelayed, actual = m.installDateActual;
  if (!orig) { block.style.display = 'none'; return; }
  block.style.display = 'block';
  const fmt = d => { if (!d) return '—'; const p = d.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; };
  const diff = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);
  let html = `<div class="drift-title">📅 Date d'installation</div><div class="drift-timeline">`;
  html += `<div class="drift-point"><span class="drift-label">Originale</span><span class="drift-date">${fmt(orig)}</span></div>`;
  if (delayed) {
    const d = diff(delayed, orig);
    html += `<span class="drift-arrow ${d > 0 ? 'drift-late' : ''}">→</span>`;
    html += `<div class="drift-point"><span class="drift-label drift-label-delayed">Reportée${d !== 0 ? ' ('+(d>0?'+':'')+d+'j)' : ''}</span><span class="drift-date drift-delayed">${fmt(delayed)}</span></div>`;
  }
  if (actual) {
    const base = delayed || orig;
    const d = diff(actual, base);
    html += `<span class="drift-arrow">→</span>`;
    html += `<div class="drift-point"><span class="drift-label drift-label-actual">Réelle${d !== 0 ? ' ('+(d>0?'+':'')+d+'j)' : ''}</span><span class="drift-date drift-actual">${fmt(actual)}</span></div>`;
  }
  html += `</div>`;
  if (m.installDateComment) html += `<div class="drift-comment">💬 ${m.installDateComment}</div>`;
  block.innerHTML = html;
}

// ═══ UNDO TOAST ═══
let _lastDeleted = null, _undoTimer = null;
function showUndoToast(msg, restoreFn) {
  _lastDeleted = restoreFn;
  clearTimeout(_undoTimer);
  document.getElementById('undo-toast-msg').textContent = msg;
  document.getElementById('undo-toast').style.display = 'flex';
  _undoTimer = setTimeout(() => { document.getElementById('undo-toast').style.display = 'none'; _lastDeleted = null; }, 5000);
}
function undoDelete() {
  if (!_lastDeleted) return;
  _lastDeleted();
  _lastDeleted = null;
  clearTimeout(_undoTimer);
  document.getElementById('undo-toast').style.display = 'none';
  debouncedSave();
}

// ═══ NAV ═══
document.querySelectorAll('.nav-tab[data-page]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const pg = document.getElementById(tab.dataset.page);
    if (pg) { pg.classList.add('active'); if (tab.dataset.page === 'page-dashboard') setTimeout(renderDashboard, 50); }
  });
});

// ═══ UTILS ═══
function uid() { return '_' + Math.random().toString(36).slice(2, 9); }

const TOKEN_CLIENT = 'clientName', TOKEN_PM = 'DPName', TOKEN_CDP = 'CDPName',
      TOKEN_RL = 'RespoLogClient', TOKEN_ERP = 'ERP Consultant';
function getClientLabel()   { return document.getElementById('pi-client')?.value    || TOKEN_CLIENT; }
function getPMLabel()       { return document.getElementById('pi-pm')?.value        || TOKEN_PM; }
function getCDPLabel()      { return document.getElementById('pi-cdptech')?.value   || TOKEN_CDP; }
function getRLLabel()       { return document.getElementById('pi-resplog')?.value   || TOKEN_RL; }
function getERPLabel()      { return document.getElementById('pi-erpconsult')?.value || TOKEN_ERP; }

function formatTemplate(text) {
  return String(text)
    .replaceAll(TOKEN_CLIENT, getClientLabel())
    .replaceAll(TOKEN_PM,     getPMLabel())
    .replaceAll(TOKEN_CDP,    getCDPLabel())
    .replaceAll(TOKEN_RL,     getRLLabel())
    .replaceAll(TOKEN_ERP,    getERPLabel());
}
function formatOwner(owner) {
  if (owner === TOKEN_CLIENT) return getClientLabel();
  if (owner === TOKEN_PM)     return getPMLabel();
  if (owner === TOKEN_CDP)    return getCDPLabel();
  if (owner === TOKEN_RL)     return getRLLabel();
  return owner || '';
}
function normalizeSpecialLabel(value) {
  if (value === getClientLabel()) return TOKEN_CLIENT;
  if (value === getPMLabel())     return TOKEN_PM;
  if (value === getCDPLabel())    return TOKEN_CDP;
  if (value === getRLLabel())     return TOKEN_RL;
  return value;
}

// ═══ FLOATING DROPDOWN ═══
let _activeDD = null;
function closeAllDD() { if (_activeDD) { _activeDD.remove(); _activeDD = null; } }
document.addEventListener('click', closeAllDD);
function showDropdown(anchorEl, options, onSelect) {
  closeAllDD();
  const dd = document.createElement('div'); dd.className = 'fl-dropdown'; _activeDD = dd;
  options.forEach(opt => {
    const el = document.createElement('div'); el.className = 'fl-opt';
    const dot = document.createElement('span'); dot.className = 'fl-opt-dot'; dot.style.background = opt.dot || '#cbd5e1'; el.appendChild(dot);
    el.appendChild(document.createTextNode(opt.label !== undefined ? opt.label : opt));
    el.onmousedown = e => { e.preventDefault(); e.stopPropagation(); onSelect(opt.value !== undefined ? opt.value : opt); closeAllDD(); };
    dd.appendChild(el);
  });
  document.body.appendChild(dd);
  const r = anchorEl.getBoundingClientRect();
  let top = r.bottom + 3, left = r.left;
  dd.style.visibility = 'hidden'; dd.style.top = top + 'px'; dd.style.left = left + 'px';
  requestAnimationFrame(() => {
    if (top + dd.offsetHeight > window.innerHeight - 8) top = r.top - dd.offsetHeight - 3;
    if (left + dd.offsetWidth > window.innerWidth - 8) left = window.innerWidth - dd.offsetWidth - 8;
    dd.style.top = top + 'px'; dd.style.left = left + 'px'; dd.style.visibility = 'visible';
  });
  dd.addEventListener('click', e => e.stopPropagation());
}

// ═══ DRAG & DROP ═══
let _dragSrc = null, _dragArr = null, _dragRender = null;
function makeDraggable(tr, arr, renderFn) {
  tr.draggable = true;
  tr.addEventListener('dragstart', e => { _dragSrc = tr; _dragArr = arr; _dragRender = renderFn; tr.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
  tr.addEventListener('dragend', () => { tr.classList.remove('dragging'); document.querySelectorAll('.drag-over-top,.drag-over-bot').forEach(x => x.classList.remove('drag-over-top', 'drag-over-bot')); _dragSrc = null; });
  tr.addEventListener('dragover', e => { if (!_dragSrc || _dragSrc === tr) return; e.preventDefault(); document.querySelectorAll('.drag-over-top,.drag-over-bot').forEach(x => x.classList.remove('drag-over-top', 'drag-over-bot')); const mid = tr.getBoundingClientRect().top + tr.getBoundingClientRect().height / 2; tr.classList.add(e.clientY < mid ? 'drag-over-top' : 'drag-over-bot'); });
  tr.addEventListener('dragleave', () => tr.classList.remove('drag-over-top', 'drag-over-bot'));
  tr.addEventListener('drop', e => {
    e.preventDefault(); if (!_dragSrc || _dragSrc === tr) return;
    const si = _dragArr.findIndex(r => r.id === _dragSrc.dataset.rowId), ti = _dragArr.findIndex(r => r.id === tr.dataset.rowId);
    if (si < 0 || ti < 0) return;
    const [item] = _dragArr.splice(si, 1);
    const after = e.clientY >= tr.getBoundingClientRect().top + tr.getBoundingClientRect().height / 2;
    _dragArr.splice(after ? ti : ti, 0, item);
    tr.classList.remove('drag-over-top', 'drag-over-bot');
    _dragRender(); debouncedSave();
  });
}
function dh() { return `<span class="drag-handle" title="Réorganiser">⠿</span>`; }

// ═══ GANTT ENGINE ═══
function mondayOf(d) { const day = new Date(d); day.setHours(0,0,0,0); const dow = day.getDay(); day.setDate(day.getDate() + (dow === 0 ? -6 : 1 - dow)); return day; }
const TODAY = new Date(); TODAY.setHours(0,0,0,0);
const MONTHS_FR = ['JANVIER','FÉVRIER','MARS','AVRIL','MAI','JUIN','JUILLET','AOÛT','SEPTEMBRE','OCTOBRE','NOVEMBRE','DÉCEMBRE'];

function getGanttBounds() {
  const startEl = document.getElementById('pi-start').value, endEl = document.getElementById('pi-end').value;
  let minD = startEl ? new Date(startEl) : new Date('2026-03-01');
  let maxD = endEl ? new Date(endEl) : new Date('2026-12-31');
  tasks.forEach(t => { if (t.start) { const d = new Date(t.start); if (d < minD) minD = d; } if (t.end) { const d = new Date(t.end); if (d > maxD) maxD = d; } });
  minD.setDate(minD.getDate() - 14); maxD.setDate(maxD.getDate() + 14);
  return { start: mondayOf(minD), end: mondayOf(maxD) };
}
function generateWeeks() {
  const { start, end } = getGanttBounds(); const w = [], c = new Date(start);
  while (c <= end) { w.push(new Date(c)); c.setDate(c.getDate() + 7); } return w;
}
function weekLabel(d) { return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0'); }
function isInWeek(s, e, w) { if (!s || !e) return false; const sd = new Date(s), ed = new Date(e), ws = new Date(w), we = new Date(w); ed.setHours(23,59,59); we.setDate(we.getDate()+6); we.setHours(23,59,59); return sd <= we && ed >= ws; }
function isToday(w) { const ws = new Date(w), we = new Date(w); we.setDate(we.getDate()+6); we.setHours(23,59,59); return TODAY >= ws && TODAY <= we; }
function monthGroups(weeks) { const g = []; let c = null; weeks.forEach((w,i) => { const m = w.getMonth(); if (!c || c.month !== m) { c = {month:m,label:MONTHS_FR[m],start:i,span:1}; g.push(c); } else c.span++; }); return g; }
function getPhaseColor(task) { if (task.barColor) return task.barColor; const ph = phases.find(p => p.id === task.phaseId); return ph ? ph.color : '#94a3b8'; }

const STATUS_OPTS = [
  {label:'— Aucun —',value:'',dot:'#e2e7ed'},{label:'Non commencé',value:'Non commencé',dot:'#94a3b8'},
  {label:'En cours',value:'En cours',dot:'#2563eb'},{label:'Terminé',value:'Terminé',dot:'#059669'},
  {label:'En attente',value:'En attente',dot:'#d97706'},{label:'En retard',value:'En retard',dot:'#dc2626'},
  {label:'Vérification requise',value:'Vérification requise',dot:'#7c3aed'},{label:'Mise à jour requise',value:'Mise à jour requise',dot:'#0891b2'},
];
const PRIO_OPTS = [
  {label:'— Aucune —',value:'',dot:'#e2e7ed'},{label:'FAIBLE',value:'FAIBLE',dot:'#10b981'},
  {label:'MOYENNE',value:'MOYENNE',dot:'#f59e0b'},{label:'ÉLEVÉE',value:'ÉLEVÉE',dot:'#ef4444'},
];
function statusBadgeHTML(s) { const cls = s ? 'badge-'+s.replace(/\s+/g,'-') : 'badge-empty'; return `<span class="badge ${cls}">${s||'—'}</span>`; }
function prioHTML(p) { if (!p) return `<span style="color:var(--text-muted);font-size:11px;cursor:pointer">—</span>`; return `<span class="prio-${p}" style="cursor:pointer">${p}</span>`; }

let _editingTaskId = null;
function openEditTask(taskId) {
  _editingTaskId = taskId;
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  document.getElementById('modal-task-title').textContent = 'Modifier la tâche';
  document.getElementById('btn-save-task').textContent = 'Mettre à jour';
  const sel = document.getElementById('task-phase'); sel.innerHTML = '';
  phases.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name; if (p.id === task.phaseId) o.selected = true; sel.appendChild(o); });
  document.getElementById('task-name').value = task.name;
  document.getElementById('task-owner').value = task.owner || '';
  document.getElementById('task-start').value = task.start || '';
  document.getElementById('task-end').value = task.end || '';
  document.getElementById('task-status').value = task.status || '';
  document.getElementById('task-priority').value = task.priority || '';
  document.getElementById('task-progress').value = task.progress || 0;
  document.getElementById('task-deliverable').value = task.deliverable || '';
  document.getElementById('modal-task').classList.add('open');
}

function renderGantt() {
  const WEEKS = generateWeeks();
  const table = document.getElementById('gantt-table'); table.innerHTML = '';
  const mGroups = monthGroups(WEEKS);
  const showDates = document.getElementById('tog-dates').checked;
  const showOwner = document.getElementById('tog-owner').checked;
  const showPrio  = document.getElementById('tog-prio').checked;
  const showAvance = document.getElementById('tog-avance').checked;
  const fixedCols = [
    ['STATUT','col-statut',true],['PRIORITÉ','col-priorite',showPrio],
    ['INTITULÉ','col-intitule',true],['PROPRIÉTAIRE','col-proprio',showOwner],
    ['DÉBUT','col-debut',showDates],['FIN','col-fin',showDates],
    ['J','col-jours',showDates],['% AVA.','col-avancement',showAvance],
    ['','col-actions',true],
  ];
  const visFC = fixedCols.filter(c => c[2]);
  const fixedCount = visFC.length;

  const r1 = table.insertRow();
  const thB = document.createElement('th'); thB.colSpan = fixedCount; thB.className = 'th-month'; thB.style.background = '#1a2332'; r1.appendChild(thB);
  mGroups.forEach(mg => { const th = document.createElement('th'); th.colSpan = mg.span; th.className = 'th-month'; th.textContent = mg.label; r1.appendChild(th); });

  const r2 = table.insertRow();
  visFC.forEach(([lbl,cls]) => { const th = document.createElement('th'); th.className = 'th-fixed '+cls; th.textContent = lbl; r2.appendChild(th); });
  WEEKS.forEach(w => { const th = document.createElement('th'); th.className = 'th-week col-week'; th.textContent = weekLabel(w); if (isToday(w)) th.style.borderLeft = '2px solid #f97316'; r2.appendChild(th); });

  phases.forEach(phase => {
    const phaseTasks = tasks.filter(t => t.phaseId === phase.id);
    const rp = table.insertRow(); rp.className = 'tr-phase';
    const tdPh = document.createElement('td'); tdPh.colSpan = fixedCount; tdPh.style.background = phase.color;
    tdPh.innerHTML = `<span style="cursor:pointer" title="Modifier la phase" onclick="openEditPhase('${phase.id}')">${phase.name}</span>
      <span style="float:right;display:flex;gap:6px;align-items:center">
        <button onclick="openAddTaskModal('${phase.id}')" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:10px;font-family:inherit">+ Tâche</button>
        <button onclick="removePhase('${phase.id}')" style="background:rgba(255,0,0,.25);border:none;color:#fff;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:10px;font-family:inherit" title="Supprimer la phase">✕</button>
      </span>`;
    rp.appendChild(tdPh);
    WEEKS.forEach(w => { const td = document.createElement('td'); td.className = 'gantt-cell'; td.style.background = phase.color; td.style.opacity = '.2'; if (isToday(w)) td.style.borderLeft = '2px solid #f97316'; rp.appendChild(td); });

    if (phaseTasks.length === 0) {
      const re = table.insertRow(); re.className = 'tr-task';
      visFC.forEach(([lbl,cls]) => { const td = document.createElement('td'); td.className = cls; if (lbl === 'INTITULÉ') { td.style.padding = '4px 8px'; td.style.color = 'var(--text-muted)'; td.style.fontStyle = 'italic'; td.textContent = 'Aucune tâche — cliquer "+ Tâche" pour en ajouter'; } re.appendChild(td); });
      WEEKS.forEach(w => { const td = document.createElement('td'); td.className = 'gantt-cell'; if (isToday(w)) td.classList.add('today-col'); re.appendChild(td); });
      return;
    }

    phaseTasks.forEach(task => {
      const rt = table.insertRow(); rt.className = task.isUnavail ? 'tr-unavail' : 'tr-task'; rt.dataset.taskId = task.id;
      const done = task.progress >= 100;

      fixedCols.forEach(([lbl,cls,vis]) => {
        if (!vis) return;
        const td = document.createElement('td'); td.className = cls;

        if (lbl === 'STATUT') {
          td.className += ' status-cell'; td.innerHTML = statusBadgeHTML(task.status);
          td.querySelector('.badge').addEventListener('click', e => { e.stopPropagation(); showDropdown(td.querySelector('.badge'), STATUS_OPTS, val => { updateTask(task.id,'status',val); renderGantt(); renderDashboard(); }); });
        } else if (lbl === 'PRIORITÉ') {
          td.style.padding = '2px 6px'; td.innerHTML = prioHTML(task.priority);
          td.querySelector('span').addEventListener('click', e => { e.stopPropagation(); showDropdown(td.querySelector('span'), PRIO_OPTS, val => { updateTask(task.id,'priority',val); renderGantt(); }); });
        } else if (lbl === 'INTITULÉ') {
          td.contentEditable = true; td.textContent = formatTemplate(task.name); td.style.padding = '2px 6px'; td.style.fontWeight = task.isUnavail ? '400' : '500';
          if (done) { td.style.textDecoration = 'line-through'; td.style.color = 'var(--text-muted)'; }
          td.onblur = e => { updateTask(task.id,'name',e.target.textContent.trim()); debouncedSave(); };
        } else if (lbl === 'PROPRIÉTAIRE') {
          td.contentEditable = true; td.textContent = formatOwner(task.owner); td.style.padding = '2px 6px';
          td.onblur = e => { updateTask(task.id,'owner',normalizeSpecialLabel(e.target.textContent.trim())); debouncedSave(); };
        } else if (lbl === 'DÉBUT' || lbl === 'FIN') {
          const field = lbl === 'DÉBUT' ? 'start' : 'end';
          const inp = document.createElement('input'); inp.type = 'date'; inp.value = task[field] || '';
          inp.style.cssText = 'border:none;background:transparent;font-family:inherit;font-size:11px;color:inherit;width:100%;cursor:pointer;padding:1px 3px;';
          inp.onchange = e => { updateTask(task.id,field,e.target.value); renderGantt(); debouncedSave(); };
          td.appendChild(inp);
        } else if (lbl === 'J') {
          td.style.textAlign = 'center'; td.style.fontSize = '11px';
          if (task.start && task.end) { const d = Math.round((new Date(task.end) - new Date(task.start)) / 86400000) + 1; td.textContent = d > 0 ? d : ''; }
        } else if (lbl === '% AVA.') {
          td.style.padding = '2px 6px'; td.style.cursor = 'pointer';
          const pct = task.progress || 0; const color = getPhaseColor(task);
          td.innerHTML = `<div class="progress-wrap"><div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div><span class="progress-pct">${pct}%</span></div>`;
          td.onclick = () => { const v = prompt("% d'avancement :", pct); if (v !== null && !isNaN(+v)) { updateTask(task.id,'progress',Math.min(100,Math.max(0,+v))); renderGantt(); renderDashboard(); debouncedSave(); } };
        } else if (lbl === '') {
          td.style.padding = '1px 4px'; td.style.textAlign = 'center'; td.style.whiteSpace = 'nowrap';
          td.innerHTML = `<button title="Modifier" onclick="openEditTask('${task.id}')" style="background:var(--accent-light);border:none;color:var(--accent);border-radius:4px;padding:2px 7px;cursor:pointer;font-size:10px;font-family:inherit;margin-right:2px">✏</button><button title="Supprimer" onclick="deleteTask('${task.id}')" style="background:#fee2e2;border:none;color:#dc2626;border-radius:4px;padding:2px 7px;cursor:pointer;font-size:10px;font-family:inherit">✕</button>`;
        }
        rt.appendChild(td);
      });

      const phColor = getPhaseColor(task);
      WEEKS.forEach(w => {
        const td = document.createElement('td'); td.className = 'gantt-cell';
        if (isToday(w)) td.classList.add('today-col');
        if (isInWeek(task.start, task.end, w)) {
          const bar = document.createElement('span'); bar.className = 'gantt-bar'; bar.style.background = phColor;
          if (done) bar.classList.add('gantt-bar-done');
          td.appendChild(bar);
        }
        rt.appendChild(td);
      });
    });
  });
}

function updateTask(id, field, value) { const t = tasks.find(t => t.id === id); if (t) t[field] = value; }

function deleteTask(id) {
  const idx = tasks.findIndex(t => t.id === id); if (idx < 0) return;
  const deleted = { ...tasks[idx] }; const phaseId = deleted.phaseId;
  tasks.splice(idx, 1); renderGantt(); renderDashboard(); debouncedSave();
  showUndoToast(`Tâche "${formatTemplate(deleted.name)}" supprimée`, () => {
    tasks.splice(idx, 0, deleted); renderGantt(); renderDashboard();
  });
}

function removePhase(id) {
  if (!confirm('Supprimer la phase et toutes ses tâches ?')) return;
  const ph = phases.find(p => p.id === id);
  const deletedPhase = { ...ph };
  const deletedTasks = tasks.filter(t => t.phaseId === id);
  phases = phases.filter(p => p.id !== id); tasks = tasks.filter(t => t.phaseId !== id);
  renderGantt(); debouncedSave();
  showUndoToast(`Phase "${deletedPhase.name}" supprimée`, () => {
    phases.push(deletedPhase); tasks.push(...deletedTasks); renderGantt();
  });
}

function scrollToToday() { const WEEKS = generateWeeks(); const idx = WEEKS.findIndex(w => isToday(w)); if (idx < 0) return; const wr = document.getElementById('gantt-wrapper'); wr.scrollLeft = Math.max(0, idx * 22 - 200); }

// ═══ MODALS ═══
let _editingPhaseId = null;
function openAddTaskModal(phaseId) {
  _editingTaskId = null;
  document.getElementById('modal-task-title').textContent = 'Nouvelle Tâche';
  document.getElementById('btn-save-task').textContent = 'Enregistrer';
  const sel = document.getElementById('task-phase'); sel.innerHTML = '';
  phases.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name; if (p.id === phaseId) o.selected = true; sel.appendChild(o); });
  ['task-name','task-owner','task-start','task-end','task-deliverable'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('task-progress').value = 0; document.getElementById('task-status').value = ''; document.getElementById('task-priority').value = '';
  document.getElementById('modal-task').classList.add('open');
}
function openAddPhaseModal() {
  _editingPhaseId = null;
  document.getElementById('modal-phase-title').textContent = 'Nouvelle Phase';
  ['phase-name','phase-code'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('phase-color').value = '#1a56db';
  document.getElementById('modal-phase').classList.add('open');
}
function openEditPhase(phaseId) {
  _editingPhaseId = phaseId;
  const ph = phases.find(p => p.id === phaseId);
  document.getElementById('modal-phase-title').textContent = 'Modifier la Phase';
  document.getElementById('phase-name').value = ph.name; document.getElementById('phase-code').value = ph.code; document.getElementById('phase-color').value = ph.color;
  document.getElementById('modal-phase').classList.add('open');
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function saveTask() {
  const name = document.getElementById('task-name').value.trim();
  if (!name) { alert('Veuillez saisir un intitulé.'); return; }
  const data = { phaseId: document.getElementById('task-phase').value, name, owner: normalizeSpecialLabel(document.getElementById('task-owner').value.trim()), start: document.getElementById('task-start').value, end: document.getElementById('task-end').value, status: document.getElementById('task-status').value, priority: document.getElementById('task-priority').value, progress: +document.getElementById('task-progress').value || 0, deliverable: document.getElementById('task-deliverable').value.trim() };
  if (_editingTaskId) { Object.assign(tasks.find(t => t.id === _editingTaskId), data); }
  else { tasks.push({ id: uid(), ...data }); }
  closeModal('modal-task'); renderGantt(); renderDashboard(); debouncedSave();
}
function savePhase() {
  const name = document.getElementById('phase-name').value.trim(); if (!name) { alert('Veuillez saisir un nom.'); return; }
  const code = document.getElementById('phase-code').value.trim().toUpperCase() || name.slice(0,2).toUpperCase();
  const color = document.getElementById('phase-color').value;
  if (_editingPhaseId) { const ph = phases.find(p => p.id === _editingPhaseId); ph.name = name.toUpperCase(); ph.code = code; ph.color = color; }
  else { phases.push({ id: uid(), name: name.toUpperCase(), code, color }); }
  closeModal('modal-phase'); renderGantt(); debouncedSave();
}
document.querySelectorAll('.modal-overlay').forEach(el => el.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('open'); }));

// ═══ PDF ═══
async function exportPDF() {
  const btn = document.querySelector('.btn-primary'); const orig = btn.innerHTML; btn.innerHTML = 'Génération…'; btn.disabled = true;
  try {
    const { jsPDF } = window.jspdf; const panel = document.getElementById('planning-panel');
    const wr = document.getElementById('gantt-wrapper'); const prev = wr.style.overflow; wr.style.overflow = 'visible';
    const canvas = await html2canvas(panel, {scale:1.3,useCORS:true,backgroundColor:'#fff',logging:false,scrollX:0,scrollY:0,windowWidth:panel.scrollWidth,width:panel.scrollWidth});
    wr.style.overflow = prev;
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({orientation:'landscape',unit:'mm',format:'a3'});
    const pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight();
    const m = 10, aw = pageW - m*2, ah = pageH - m*2 - 14;
    const ratio = canvas.width / canvas.height; let dw = aw, dh = dw / ratio; if (dh > ah) { dh = ah; dw = dh * ratio; }
    const proj = projectMeta.name || '', cli = projectMeta.client || '', pm = projectMeta.pm || '', today = new Date().toLocaleDateString('fr-FR');
    pdf.setFillColor(26,35,50); pdf.rect(m,m,pageW-m*2,10,'F');
    pdf.setFont('helvetica','bold'); pdf.setFontSize(11); pdf.setTextColor(255,255,255); pdf.text(`PLANNING — ${proj.toUpperCase()}`, m+4, m+6.5);
    pdf.setFont('helvetica','normal'); pdf.setFontSize(9); pdf.text(`Client: ${cli}  |  Chef de Projet: ${pm}  |  ${today}`, pageW-m-4, m+6.5, {align:'right'});
    pdf.addImage(imgData,'PNG',m,m+12,dw,dh);
    pdf.setFontSize(8); pdf.setTextColor(150,150,150); pdf.text(`Document confidentiel — ${proj}`, m, pageH-4); pdf.text('Page 1', pageW-m, pageH-4, {align:'right'});
    pdf.save(`Planning_${proj.replace(/\s+/g,'_')}_${today.replace(/\//g,'-')}.pdf`);
  } catch (e) { console.error(e); alert('Erreur PDF.'); }
  btn.innerHTML = orig; btn.disabled = false;
}

// ═══ HEURES ═══
function updateHeures(id, field, val) {
  const r = heuresData.find(r => r.id === id);
  if (!r) return;
  if (field === 'actuel' && val !== null) {
    if (!r.history) r.history = [];
    const today = new Date().toISOString().slice(0,10);
    r.history.push({ date: today, value: val, note: '' });
  }
  r[field] = val;
  renderHeures(); renderDashboard(); debouncedSave();
}
function updateHeuresDesc(id, val) {
  const r = heuresData.find(r => r.id === id); if (r) { r.desc = val; debouncedSave(); }
}
function heuresVenteTotale() { return heuresData.filter(r => !r.sep && r.bold).reduce((s,r) => s + (r.vente||0), 0); }
function heuresActuelTotal() { return heuresData.filter(r => !r.sep).reduce((s,r) => s + (r.actuel||0), 0); }

function renderHeures() {
  const tbody = document.getElementById('tbody-heures'); tbody.innerHTML = '';
  heuresData.forEach(row => {
    if (row.sep) { const tr = tbody.insertRow(); tr.innerHTML = `<td colspan="7" style="height:7px;background:#f7f9fb;border:none"></td>`; return; }
    const tr = tbody.insertRow();
    const ecart = (row.vente != null && row.actuel != null) ? (row.actuel - row.vente) : null;
    const ecartColor = ecart == null ? '' : ecart > 0 ? '#dc2626' : ecart < 0 ? '#059669' : 'var(--text-muted)';
    const ecartHtml = ecart != null ? `<span style="color:${ecartColor};font-weight:500">${ecart>0?'+':''}${ecart}</span>` : '<span style="color:var(--text-muted)">—</span>';
    tr.innerHTML = `
      <td style="font-weight:${row.bold?700:400}">${row.cat}</td>
      <td style="text-align:right"><input class="h-input" type="number" value="${row.vente!=null?row.vente:''}" placeholder="0" min="0" onchange="updateHeures('${row.id}','vente',this.value===''?null:+this.value)"></td>
      <td style="text-align:right"><input class="h-input" type="number" value="${row.actuel!=null?row.actuel:''}" placeholder="—" min="0" onchange="updateHeures('${row.id}','actuel',this.value===''?null:+this.value)"></td>
      <td style="text-align:right">${ecartHtml}</td>
      <td style="text-align:center">${(row.history||[]).length > 0 ? `<span title="Voir l'historique" style="cursor:pointer;color:var(--text-muted);font-size:14px" onclick="toggleHeuresHistory('${row.id}',this)">🕐</span>` : ''}</td>
      <td contenteditable="true" style="color:var(--text-muted)" onblur="updateHeuresDesc('${row.id}',this.textContent.trim())">${row.desc||''}</td>
      <td style="text-align:center">${row.custom ? `<button class="btn btn-sm btn-danger" onclick="deleteHeuresRow('${row.id}')">✕</button>` : ''}</td>`;
  });
  const vente = heuresVenteTotale(), actuel = heuresActuelTotal();
  document.getElementById('kpi-heures').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Total Vente</div><div class="kpi-value">${vente} h</div><div class="kpi-sub">Budget initial</div></div>
    <div class="kpi-card"><div class="kpi-label">Total Actuel</div><div class="kpi-value">${actuel} h</div><div class="kpi-sub">${vente>0?Math.round(actuel/vente*100):0}% du budget</div><div class="kpi-bar"><div class="kpi-bar-fill" style="width:${vente>0?Math.min(100,actuel/vente*100):0}%;background:${actuel>vente?'#dc2626':'var(--accent)'}"></div></div></div>
    <div class="kpi-card"><div class="kpi-label">Écart</div><div class="kpi-value" style="color:${actuel>vente?'#dc2626':actuel<vente?'#059669':'var(--text)'}">${actuel>vente?'+':''}${actuel-vente} h</div></div>
    <div class="kpi-card"><div class="kpi-label">Jours Restants (vente)</div><div class="kpi-value">${Math.round((vente-actuel)/7)}</div><div class="kpi-sub">Base 7h/jour</div></div>`;
}

function addCustomHeuresRow() {
  heuresData.push({ id: uid(), cat: 'Nouvelle catégorie', vente: 0, actuel: 0, desc: '', bold: false, sep: false, custom: true, history: [] });
  renderHeures(); debouncedSave();
}
function deleteHeuresRow(id) {
  const idx = heuresData.findIndex(r => r.id === id); if (idx < 0) return;
  const deleted = { ...heuresData[idx] };
  heuresData.splice(idx, 1); renderHeures(); debouncedSave();
  showUndoToast(`Catégorie "${deleted.cat}" supprimée`, () => { heuresData.splice(idx, 0, deleted); renderHeures(); });
}
function toggleHeuresHistory(id, btn) {
  const existingRow = btn.closest('tr').nextElementSibling;
  if (existingRow && existingRow.classList.contains('history-row')) { existingRow.remove(); return; }
  const row = heuresData.find(r => r.id === id); if (!row || !row.history?.length) return;
  const tr = document.createElement('tr'); tr.className = 'history-row';
  const td = document.createElement('td'); td.colSpan = 7; td.style.padding = '0 12px 8px 40px';
  const hist = row.history;
  let rows = hist.map((h,i) => {
    const delta = i === 0 ? '' : (h.value - hist[i-1].value);
    const deltaHtml = delta === '' ? '' : `<span style="color:${delta>0?'#dc2626':delta<0?'#059669':'var(--text-muted)'}">${delta>0?'+':''}${delta}</span>`;
    return `<tr><td style="font-size:11px;padding:2px 6px">${h.date}</td><td style="text-align:right;font-size:11px;padding:2px 6px">${h.value} h</td><td style="text-align:center;font-size:11px;padding:2px 6px">${deltaHtml}</td><td contenteditable="true" style="font-size:11px;color:var(--text-muted);padding:2px 6px" onblur="heuresData.find(r=>r.id==='${row.id}').history[${i}].note=this.textContent.trim();_DS()">${h.note||''}</td></tr>`;
  }).join('');
  // mini sparkline
  const pts = hist.map(h => h.value); const max = Math.max(...pts, 1); const min = Math.min(...pts, 0);
  const W = 120, H = 30;
  const sparkPts = pts.map((v,i) => `${Math.round(i/(pts.length-1||1)*W)},${Math.round(H - (v-min)/(max-min||1)*H)}`).join(' ');
  td.innerHTML = `<div style="display:flex;gap:16px;align-items:flex-start;padding:6px 0">
    <table style="font-size:11px;border-collapse:collapse"><thead><tr><th style="padding:2px 6px;text-align:left">Date</th><th style="padding:2px 6px">Valeur</th><th style="padding:2px 6px">Δ</th><th style="padding:2px 6px">Note</th></tr></thead><tbody>${rows}</tbody></table>
    <svg width="${W}" height="${H}" style="flex-shrink:0"><polyline points="${sparkPts}" fill="none" stroke="#2563eb" stroke-width="1.5"/></svg>
  </div>`;
  tr.appendChild(td);
  btn.closest('tr').insertAdjacentElement('afterend', tr);
}

// ═══ TÂCHES INTERNES ═══
const ETAT_INT = ['FAIT','EN COURS','À FAIRE','EN ATTENTE','ANNULÉ'];
const ETAT_B = {'FAIT':'cell-ok','EN COURS':'cell-wip','À FAIRE':'cell-none','EN ATTENTE':'cell-warn','ANNULÉ':'cell-ko'};
const ETAT_D = {'FAIT':'#059669','EN COURS':'#2563eb','À FAIRE':'#94a3b8','EN ATTENTE':'#d97706','ANNULÉ':'#dc2626'};
const URG_OPTS = [{label:'— Aucune —',value:0,dot:'#e2e7ed'},{label:'⭐ Faible',value:1,dot:'#94a3b8'},{label:'⭐⭐ Moyenne',value:2,dot:'#f59e0b'},{label:'⭐⭐⭐ Haute',value:3,dot:'#ef4444'}];

function renderTaches() {
  const tbody = document.getElementById('tbody-taches'); tbody.innerHTML = '';
  internalTasks.forEach(task => {
    const tr = tbody.insertRow(); tr.dataset.rowId = task.id;
    const urgStr = task.urg ? '⭐'.repeat(task.urg) : '—';
    tr.innerHTML = `<td>${dh()}</td>
      <td contenteditable="true" style="min-width:190px" onblur="internalTasks.find(t=>t.id==='${task.id}').action=this.textContent.trim();_DS()">${task.action}</td>
      <td style="min-width:98px"><span class="${ETAT_B[task.etat]||'cell-none'}" style="cursor:pointer">${task.etat}</span></td>
      <td style="text-align:center"><input type="number" value="${task.temps||0}" min="0" style="width:48px;border:none;background:transparent;font-family:'DM Mono',monospace;font-size:12px;text-align:center" onchange="internalTasks.find(t=>t.id==='${task.id}').temps=+this.value;_DS()"></td>
      <td><input type="date" value="${task.deadline||''}" style="border:none;background:transparent;font-family:inherit;font-size:11.5px;width:100%" onchange="internalTasks.find(t=>t.id==='${task.id}').deadline=this.value;_DS()"></td>
      <td style="text-align:center;cursor:pointer"><span>${urgStr}</span></td>
      <td contenteditable="true" style="color:var(--text-muted);min-width:120px" onblur="internalTasks.find(t=>t.id==='${task.id}').comment=this.textContent.trim();_DS()">${task.comment}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteInternalTask('${task.id}')">✕</button></td>`;
    const etatSp = tr.cells[2].querySelector('span');
    etatSp.addEventListener('click', e => { e.stopPropagation(); showDropdown(etatSp, ETAT_INT.map(v => ({label:v,value:v,dot:ETAT_D[v]})), val => { task.etat = val; renderTaches(); debouncedSave(); }); });
    tr.cells[5].querySelector('span').addEventListener('click', e => { e.stopPropagation(); showDropdown(tr.cells[5].querySelector('span'), URG_OPTS, val => { task.urg = val; renderTaches(); debouncedSave(); }); });
    makeDraggable(tr, internalTasks, renderTaches);
  });
}
function addInternalTask() { internalTasks.push({id:uid(),action:'Nouvelle tâche',etat:'À FAIRE',temps:0,deadline:'',urg:1,comment:''}); renderTaches(); debouncedSave(); }
function deleteInternalTask(id) {
  const idx = internalTasks.findIndex(t => t.id === id); if (idx < 0) return;
  const deleted = { ...internalTasks[idx] };
  internalTasks.splice(idx, 1); renderTaches(); debouncedSave();
  showUndoToast(`Tâche interne "${deleted.action}" supprimée`, () => { internalTasks.splice(idx, 0, deleted); renderTaches(); });
}

// ═══ INTERFACES ═══
const ITF_STATES = ['NON','EN COURS','OUI','KO'];
const ITF_TYPE_OPTS = ['Connecteur ERP','API REST','Fichier plat','Web Service','Manuel'];
const ITF_D = {'OUI':'#059669','NON':'#94a3b8','EN COURS':'#2563eb','KO':'#dc2626'};
const ITF_B = {'OUI':'cell-ok','NON':'cell-none','EN COURS':'cell-wip','KO':'cell-ko'};

function itfBadge(v) { return `<span class="${ITF_B[v]||'cell-none'}" style="cursor:pointer">${v}</span>`; }
function renderInterfaces() {
  const tbody = document.getElementById('tbody-interfaces'); tbody.innerHTML = '';
  interfacesData.forEach(row => {
    const tr = tbody.insertRow(); tr.dataset.rowId = row.id;
    tr.innerHTML = `<td>${dh()}</td>
      <td><select class="tbl-sel" onchange="interfacesData.find(r=>r.id==='${row.id}').type=this.value;_DS()">${ITF_TYPE_OPTS.map(o=>`<option${o===row.type?' selected':''}>${o}</option>`).join('')}</select></td>
      <td contenteditable="true" style="font-weight:500;min-width:180px" onblur="interfacesData.find(r=>r.id==='${row.id}').name=this.textContent.trim();_DS()">${row.name}</td>
      <td>${itfBadge(row.dev)}</td><td>${itfBadge(row.preprod)}</td><td>${itfBadge(row.recMecalux)}</td><td>${itfBadge(row.recClient)}</td><td>${itfBadge(row.valide)}</td>
      <td contenteditable="true" style="color:var(--text-muted);min-width:120px" onblur="interfacesData.find(r=>r.id==='${row.id}').comment=this.textContent.trim();_DS()">${row.comment}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteInterface('${row.id}')">✕</button></td>`;
    ['dev','preprod','recMecalux','recClient','valide'].forEach((f,fi) => {
      const sp = tr.cells[fi+3].querySelector('span');
      sp.addEventListener('click', e => { e.stopPropagation(); showDropdown(sp, ITF_STATES.map(v => ({label:v,value:v,dot:ITF_D[v]})), val => { row[f] = val; sp.className = ITF_B[val]||'cell-none'; sp.textContent = val; renderDashboard(); debouncedSave(); }); });
    });
    makeDraggable(tr, interfacesData, renderInterfaces);
  });
}
function addInterface() { interfacesData.push({id:uid(),type:'Connecteur ERP',name:'Nouvelle interface',dev:'NON',preprod:'NON',recMecalux:'NON',recClient:'NON',valide:'NON',comment:''}); renderInterfaces(); debouncedSave(); }
function deleteInterface(id) {
  const idx = interfacesData.findIndex(r => r.id === id); if (idx < 0) return;
  const deleted = { ...interfacesData[idx] };
  interfacesData.splice(idx, 1); renderInterfaces(); debouncedSave();
  showUndoToast(`Interface "${deleted.name}" supprimée`, () => { interfacesData.splice(idx, 0, deleted); renderInterfaces(); });
}

// ═══ FONCTIONNEL ═══
function renderFonctionnel() {
  const tbody = document.getElementById('tbody-fonctionnel'); tbody.innerHTML = '';
  fonctionnelData.forEach(row => {
    const tr = tbody.insertRow(); tr.dataset.rowId = row.id;
    tr.innerHTML = `<td>${dh()}</td>
      <td contenteditable="true" style="font-weight:600;min-width:160px" onblur="fonctionnelData.find(r=>r.id==='${row.id}').name=this.textContent.trim();_DS()">${row.name}</td>
      <td>${itfBadge(row.dev)}</td>
      <td style="text-align:center;cursor:pointer"><span>${row.pct}%</span></td>
      <td>${itfBadge(row.testMec)}</td><td>${itfBadge(row.preprod)}</td><td>${itfBadge(row.formKU)}</td><td>${itfBadge(row.testClient)}</td><td>${itfBadge(row.formUsers)}</td>
      <td contenteditable="true" style="color:var(--text-muted);min-width:110px" onblur="fonctionnelData.find(r=>r.id==='${row.id}').comment=this.textContent.trim();_DS()">${row.comment}</td>
      <td><button class="btn btn-sm btn-danger" onclick="fonctionnelData=fonctionnelData.filter(r=>r.id!=='${row.id}');renderFonctionnel();_DS()">✕</button></td>`;
    ['dev','testMec','preprod','formKU','testClient','formUsers'].forEach((f,fi) => {
      const td = tr.cells[[2,4,5,6,7,8][fi]]; const sp = td.querySelector('span');
      sp.addEventListener('click', e => { e.stopPropagation(); showDropdown(sp, ITF_STATES.map(v => ({label:v,value:v,dot:ITF_D[v]})), val => { row[f] = val; sp.className = ITF_B[val]||'cell-none'; sp.textContent = val; debouncedSave(); }); });
    });
    tr.cells[3].querySelector('span').addEventListener('click', () => { const v = prompt('% tâches terminées :', row.pct); if (v !== null && !isNaN(+v)) { row.pct = Math.min(100,Math.max(0,+v)); renderFonctionnel(); debouncedSave(); } });
    makeDraggable(tr, fonctionnelData, renderFonctionnel);
  });
}
function addFonctionnel() { fonctionnelData.push({id:uid(),name:'Nouveau flux',dev:'NON',pct:0,testMec:'NON',preprod:'NON',formKU:'NON',testClient:'NON',formUsers:'NON',comment:''}); renderFonctionnel(); debouncedSave(); }

// ═══ DRY RUN ═══
const DR_STATES = ['NON','En cours','OK','KO'];
const DR_D = {'OK':'#059669','NON':'#94a3b8','En cours':'#2563eb','KO':'#dc2626'};
const DR_B = {'OK':'cell-ok','NON':'cell-none','En cours':'cell-wip','KO':'cell-ko'};

function drBadge(v) { return `<span class="${DR_B[v]||'cell-none'}" style="cursor:pointer">${v}</span>`; }
function renderDryrun() {
  const tbody = document.getElementById('tbody-dryrun'); tbody.innerHTML = '';
  dryrunData.forEach(row => {
    const tr = tbody.insertRow(); tr.dataset.rowId = row.id;
    tr.innerHTML = `<td>${dh()}</td>
      <td contenteditable="true" style="font-weight:500" onblur="dryrunData.find(r=>r.id==='${row.id}').name=this.textContent.trim();_DS()">${formatTemplate(row.name)}</td>
      <td style="min-width:98px">${drBadge(row.etat)}</td>
      <td contenteditable="true" style="color:var(--text-muted)" onblur="dryrunData.find(r=>r.id==='${row.id}').comment=this.textContent.trim();_DS()">${row.comment}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteDryrun('${row.id}')">✕</button></td>`;
    const sp = tr.cells[2].querySelector('span');
    sp.addEventListener('click', e => { e.stopPropagation(); showDropdown(sp, DR_STATES.map(v => ({label:v,value:v,dot:DR_D[v]})), val => { row.etat = val; sp.className = DR_B[val]||'cell-none'; sp.textContent = val; renderDashboard(); debouncedSave(); }); });
    makeDraggable(tr, dryrunData, renderDryrun);
  });
}
function addDryrun() { dryrunData.push({id:uid(),name:'Nouveau prérequis',etat:'NON',comment:''}); renderDryrun(); debouncedSave(); }
function deleteDryrun(id) {
  const idx = dryrunData.findIndex(r => r.id === id); if (idx < 0) return;
  const deleted = { ...dryrunData[idx] };
  dryrunData.splice(idx, 1); renderDryrun(); debouncedSave();
  showUndoToast(`Prérequis "${deleted.name}" supprimé`, () => { dryrunData.splice(idx, 0, deleted); renderDryrun(); });
}

// ═══ INSTALL ═══
const INST_STATES = ['Non','En cours','Oui','KO'];
const INST_D = {'Oui':'#059669','Non':'#94a3b8','En cours':'#2563eb','KO':'#dc2626'};
const INST_B = {'Oui':'cell-ok','Non':'cell-none','En cours':'cell-wip','KO':'cell-ko'};
const INST_QUI = ['MECALUX', TOKEN_CLIENT,'TOUS','Prestataire externe','—'];

function instBadge(v) { return `<span class="${INST_B[v]||'cell-none'}" style="cursor:pointer">${v}</span>`; }
function renderInstall() {
  const tbody = document.getElementById('tbody-install'); tbody.innerHTML = '';
  installData.forEach(row => {
    const tr = tbody.insertRow(); tr.dataset.rowId = row.id;
    tr.innerHTML = `<td>${dh()}</td>
      <td contenteditable="true" style="font-weight:500;min-width:230px" onblur="installData.find(r=>r.id==='${row.id}').action=this.textContent.trim();_DS()">${row.action}</td>
      <td style="min-width:88px">${instBadge(row.etat)}</td>
      <td><select class="tbl-sel" onchange="installData.find(r=>r.id==='${row.id}').qui=normalizeSpecialLabel(this.value);_DS()">${INST_QUI.map(o=>`<option value="${o}"${(o===row.qui||(o===TOKEN_CLIENT&&row.qui===getClientLabel()))?' selected':''}>${o===TOKEN_CLIENT?getClientLabel():o}</option>`).join('')}</select></td>
      <td><input type="date" value="${row.deadline||''}" style="border:none;background:transparent;font-family:inherit;font-size:11.5px;width:100%" onchange="installData.find(r=>r.id==='${row.id}').deadline=this.value;_DS()"></td>
      <td contenteditable="true" style="color:var(--text-muted);min-width:170px" onblur="installData.find(r=>r.id==='${row.id}').comment=this.textContent.trim();_DS()">${row.comment}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteInstall('${row.id}')">✕</button></td>`;
    const sp = tr.cells[2].querySelector('span');
    sp.addEventListener('click', e => { e.stopPropagation(); showDropdown(sp, INST_STATES.map(v => ({label:v,value:v,dot:INST_D[v]})), val => { row.etat = val; sp.className = INST_B[val]||'cell-none'; sp.textContent = val; renderDashboard(); debouncedSave(); }); });
    makeDraggable(tr, installData, renderInstall);
  });
}
function addInstall() { installData.push({id:uid(),action:'Nouveau prérequis',etat:'Non',qui:'MECALUX',deadline:'',comment:''}); renderInstall(); debouncedSave(); }
function deleteInstall(id) {
  const idx = installData.findIndex(r => r.id === id); if (idx < 0) return;
  const deleted = { ...installData[idx] };
  installData.splice(idx, 1); renderInstall(); debouncedSave();
  showUndoToast(`Prérequis install "${deleted.action}" supprimé`, () => { installData.splice(idx, 0, deleted); renderInstall(); });
}

// ═══ FACTURATION ═══
const FACT_STATES = ['Payé','En cours','Retard','—'];
const FACT_D = {'Payé':'#059669','En cours':'#2563eb','Retard':'#dc2626','—':'#94a3b8'};
const FACT_B = {'Payé':'cell-ok','En cours':'cell-wip','Retard':'cell-ko','—':'cell-none'};

function factBadge(v) { return `<span class="${FACT_B[v]||'cell-none'}" style="cursor:pointer">${v}</span>`; }
function renderFactRow(tbody, list, type) {
  tbody.innerHTML = '';
  list.forEach(row => {
    const tr = tbody.insertRow(); tr.dataset.rowId = row.id;
    tr.innerHTML = `<td>${dh()}</td>
      <td contenteditable="true" style="font-weight:600;min-width:180px" onblur="(${type}==='projet'?jalonsProjet:jalonsEquip).find(r=>r.id==='${row.id}').jalon=this.textContent.trim();_DS()">${row.jalon}</td>
      <td><input type="date" value="${row.date||''}" style="border:none;background:transparent;font-family:inherit;font-size:11.5px" onchange="(${type}==='projet'?jalonsProjet:jalonsEquip).find(r=>r.id==='${row.id}').date=this.value;_DS()"></td>
      <td><input type="date" value="${row.echeance||''}" style="border:none;background:transparent;font-family:inherit;font-size:11.5px" onchange="(${type}==='projet'?jalonsProjet:jalonsEquip).find(r=>r.id==='${row.id}').echeance=this.value;_DS()"></td>
      <td style="min-width:78px">${factBadge(row.etat)}</td>
      <td><input type="number" value="${row.pct}" min="0" max="100" style="width:40px;border:none;background:transparent;font-size:12px;text-align:right" onchange="(${type}==='projet'?jalonsProjet:jalonsEquip).find(r=>r.id==='${row.id}').pct=+this.value;renderFacturation();_DS()">%</td>
      <td><input type="number" value="${row.montant}" min="0" style="width:88px;border:none;background:transparent;font-family:'DM Mono',monospace;font-size:12px;font-weight:600;text-align:right" onchange="(${type}==='projet'?jalonsProjet:jalonsEquip).find(r=>r.id==='${row.id}').montant=+this.value;renderFacturation();_DS()"> €</td>
      <td><button class="btn btn-sm btn-danger" onclick="del_fact_${type}('${row.id}')">✕</button></td>`;
    const sp = tr.cells[4].querySelector('span');
    sp.addEventListener('click', e => { e.stopPropagation(); showDropdown(sp, FACT_STATES.map(v => ({label:v,value:v,dot:FACT_D[v]})), val => { row.etat = val; sp.className = FACT_B[val]||'cell-none'; sp.textContent = val; renderFacturation(); renderDashboard(); debouncedSave(); }); });
    makeDraggable(tr, list, renderFacturation);
  });
}
function del_fact_projet(id) { jalonsProjet = jalonsProjet.filter(r => r.id !== id); renderFacturation(); debouncedSave(); }
function del_fact_equip(id)  { jalonsEquip  = jalonsEquip.filter(r => r.id !== id);  renderFacturation(); debouncedSave(); }
function addJalon(type) { const list = type === 'projet' ? jalonsProjet : jalonsEquip; list.push({id:uid(),jalon:'Nouveau jalon',date:'',echeance:'',etat:'—',pct:0,montant:0}); renderFacturation(); debouncedSave(); }
function renderFacturation() {
  renderFactRow(document.getElementById('tbody-jalons-projet'), jalonsProjet, 'projet');
  renderFactRow(document.getElementById('tbody-jalons-equip'), jalonsEquip, 'equip');
  const tP = jalonsProjet.reduce((s,r) => s+r.montant, 0), tE = jalonsEquip.reduce((s,r) => s+r.montant, 0), total = tP + tE;
  const paye = [...jalonsProjet,...jalonsEquip].filter(r => r.etat === 'Payé').reduce((s,r) => s+r.montant, 0);
  const reste = total - paye, sp = v => total > 0 ? Math.round(v/total*100) : 0;
  document.getElementById('kpi-fact').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Total Projet</div><div class="kpi-value">${tP.toLocaleString('fr-FR')} €</div></div>
    <div class="kpi-card"><div class="kpi-label">Total Équipement</div><div class="kpi-value">${tE.toLocaleString('fr-FR')} €</div></div>
    <div class="kpi-card"><div class="kpi-label">Total Contrat</div><div class="kpi-value">${total.toLocaleString('fr-FR')} €</div></div>
    <div class="kpi-card"><div class="kpi-label">Encaissé</div><div class="kpi-value" style="color:#059669">${paye.toLocaleString('fr-FR')} €</div><div class="kpi-sub">${sp(paye)}%</div><div class="kpi-bar"><div class="kpi-bar-fill" style="width:${sp(paye)}%;background:#059669"></div></div></div>
    <div class="kpi-card"><div class="kpi-label">Reste à facturer</div><div class="kpi-value" style="color:#dc2626">${reste.toLocaleString('fr-FR')} €</div><div class="kpi-sub">${sp(reste)}%</div></div>`;
}

// ═══ DASHBOARD ═══
const charts = {};
function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

function renderDashboard() {
  const totalTasks = tasks.length, doneTasks = tasks.filter(t => t.status === 'Terminé').length;
  const inProgressTasks = tasks.filter(t => t.status === 'En cours').length, lateTasks = tasks.filter(t => t.status === 'En retard').length;
  const totalJalons = [...jalonsProjet,...jalonsEquip];
  const totalMontant = totalJalons.reduce((s,r) => s+r.montant, 0), payeMontant = totalJalons.filter(r => r.etat === 'Payé').reduce((s,r) => s+r.montant, 0);
  const vente = heuresVenteTotale(), actuel = heuresActuelTotal();
  document.getElementById('dash-kpi').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Tâches Totales</div><div class="kpi-value">${totalTasks}</div><div class="kpi-sub">${doneTasks} terminées · ${inProgressTasks} en cours</div></div>
    <div class="kpi-card"><div class="kpi-label">Tâches en Retard</div><div class="kpi-value" style="color:${lateTasks?'#dc2626':'#059669'}">${lateTasks}</div><div class="kpi-sub">${lateTasks?'⚠ Attention requise':'✓ Tout est à jour'}</div></div>
    <div class="kpi-card"><div class="kpi-label">Avancement Global</div><div class="kpi-value">${totalTasks>0?Math.round(tasks.reduce((s,t)=>s+(t.progress||0),0)/totalTasks):0}%</div><div class="kpi-bar"><div class="kpi-bar-fill" style="width:${totalTasks>0?Math.round(tasks.reduce((s,t)=>s+(t.progress||0),0)/totalTasks):0}%"></div></div></div>
    <div class="kpi-card"><div class="kpi-label">Facturation</div><div class="kpi-value" style="color:#059669">${payeMontant.toLocaleString('fr-FR')} €</div><div class="kpi-sub">/ ${totalMontant.toLocaleString('fr-FR')} € total</div></div>
    <div class="kpi-card"><div class="kpi-label">Heures Actuel / Vente</div><div class="kpi-value">${actuel} / ${vente} h</div><div class="kpi-bar"><div class="kpi-bar-fill" style="width:${vente>0?Math.min(100,actuel/vente*100):0}%;background:${actuel>vente?'#dc2626':'var(--accent)'}"></div></div></div>
    <div class="kpi-card"><div class="kpi-label">Phases</div><div class="kpi-value">${phases.length}</div><div class="kpi-sub">${tasks.length} tâches réparties</div></div>`;

  destroyChart('phases');
  const phaseLabels = phases.map(p => p.name.length>20 ? p.name.slice(0,20)+'…' : p.name);
  const phaseData = phases.map(ph => { const pt = tasks.filter(t => t.phaseId === ph.id); return pt.length ? Math.round(pt.reduce((s,t) => s+(t.progress||0), 0)/pt.length) : 0; });
  charts['phases'] = new Chart(document.getElementById('ch-phases'), {type:'bar',data:{labels:phaseLabels,datasets:[{label:'Avancement %',data:phaseData,backgroundColor:phases.map(p=>p.color+'cc'),borderColor:phases.map(p=>p.color),borderWidth:2,borderRadius:5}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{max:100,ticks:{callback:v=>v+'%'},grid:{color:'#f0f2f5'}},y:{grid:{display:false}}}}});

  destroyChart('statuts');
  const statusCounts = {}; tasks.forEach(t => { const s = t.status||'Non défini'; statusCounts[s] = (statusCounts[s]||0)+1; });
  const statusColors = {'Terminé':'#059669','En cours':'#2563eb','Non commencé':'#94a3b8','En attente':'#d97706','En retard':'#dc2626','Vérification requise':'#7c3aed','Mise à jour requise':'#0891b2','Non défini':'#e2e7ed'};
  charts['statuts'] = new Chart(document.getElementById('ch-statuts'), {type:'doughnut',data:{labels:Object.keys(statusCounts),datasets:[{data:Object.values(statusCounts),backgroundColor:Object.keys(statusCounts).map(s=>statusColors[s]||'#e2e7ed'),borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{font:{size:11},boxWidth:12}}}}});

  destroyChart('heures');
  const hRows = heuresData.filter(r => !r.sep && !r.bold && r.vente);
  charts['heures'] = new Chart(document.getElementById('ch-heures'), {type:'bar',data:{labels:hRows.map(r=>r.cat.length>14?r.cat.slice(0,14)+'…':r.cat),datasets:[{label:'Vente',data:hRows.map(r=>r.vente||0),backgroundColor:'#bfdbfe',borderColor:'#2563eb',borderWidth:1,borderRadius:3},{label:'Actuel',data:hRows.map(r=>r.actuel||0),backgroundColor:'#fca5a5',borderColor:'#dc2626',borderWidth:1,borderRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{font:{size:11},boxWidth:12}}},scales:{x:{ticks:{font:{size:10}},grid:{display:false}},y:{grid:{color:'#f0f2f5'}}}}});

  destroyChart('fact');
  const allJ = [...jalonsProjet,...jalonsEquip];
  charts['fact'] = new Chart(document.getElementById('ch-fact'), {type:'bar',data:{labels:allJ.map(j=>j.jalon.length>18?j.jalon.slice(0,18)+'…':j.jalon),datasets:[{label:'Montant (€)',data:allJ.map(j=>j.montant),backgroundColor:allJ.map(j=>j.etat==='Payé'?'#86efac':j.etat==='En cours'?'#93c5fd':j.etat==='Retard'?'#fca5a5':'#e2e7ed'),borderWidth:1,borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{font:{size:10}},grid:{display:false}},y:{ticks:{callback:v=>v.toLocaleString('fr-FR')+' €'},grid:{color:'#f0f2f5'}}}}});

  destroyChart('itf');
  const itfCounts = ITF_STATES.reduce((o,s) => { o[s] = interfacesData.filter(r=>r.valide===s).length; return o; }, {});
  charts['itf'] = new Chart(document.getElementById('ch-itf'), {type:'doughnut',data:{labels:['Validé (OUI)','En cours','Non validé (NON)','KO'],datasets:[{data:[itfCounts.OUI||0,itfCounts['EN COURS']||0,itfCounts.NON||0,itfCounts.KO||0],backgroundColor:['#86efac','#93c5fd','#e2e7ed','#fca5a5'],borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:10}}}}});

  destroyChart('install');
  charts['install'] = new Chart(document.getElementById('ch-install'), {type:'doughnut',data:{labels:['Oui','En cours','Non','KO'],datasets:[{data:[installData.filter(r=>r.etat==='Oui').length,installData.filter(r=>r.etat==='En cours').length,installData.filter(r=>r.etat==='Non').length,installData.filter(r=>r.etat==='KO').length],backgroundColor:['#86efac','#93c5fd','#e2e7ed','#fca5a5'],borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:10}}}}});

  destroyChart('dryrun');
  charts['dryrun'] = new Chart(document.getElementById('ch-dryrun'), {type:'doughnut',data:{labels:['OK','En cours','NON','KO'],datasets:[{data:[dryrunData.filter(r=>r.etat==='OK').length,dryrunData.filter(r=>r.etat==='En cours').length,dryrunData.filter(r=>r.etat==='NON').length,dryrunData.filter(r=>r.etat==='KO').length],backgroundColor:['#86efac','#93c5fd','#e2e7ed','#fca5a5'],borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:10}}}}});
}

// ═══ CUSTOM TABS (Step 6 stubs) ═══
function openAddCustomTabModal() { document.getElementById('modal-custom-tab').classList.add('open'); }
function addCustomTabColumn() { /* Step 6 */ }
function saveCustomTab()      { closeModal('modal-custom-tab'); /* Step 6 */ }

// ═══ HTML EXPORT (Step 7 stubs) ═══
function openExportHTMLModal() {
  const list = document.getElementById('export-tab-list'); list.innerHTML = '';
  const tabs = [
    {id:'page-dashboard',label:'Tableau de bord'},{id:'page-planning',label:'Planning'},
    {id:'page-heures',label:'Suivi Heures'},{id:'page-taches',label:'Tâches Internes'},
    {id:'page-interfaces',label:'Interfaces'},{id:'page-fonctionnel',label:'Fonctionnel'},
    {id:'page-dryrun',label:'Prérequis Dry Run'},{id:'page-install',label:'Prérequis Install'},
    {id:'page-facturation',label:'Facturation'},
    ...customTabs.map(ct => ({id:'page-ct-'+ct.id, label: (ct.icon||'')+ ' '+ct.name, custom:true}))
  ];
  tabs.forEach(t => {
    const label = document.createElement('label'); label.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = true; cb.dataset.tabId = t.id;
    label.appendChild(cb); label.appendChild(document.createTextNode(t.label));
    list.appendChild(label);
  });
  document.getElementById('modal-export-html').classList.add('open');
}
function exportSelectAll(val) { document.getElementById('export-tab-list').querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = val); }
async function doExportHTML() {
  closeModal('modal-export-html');
  const selectedIds = new Set([...document.getElementById('export-tab-list').querySelectorAll('input:checked')].map(cb => cb.dataset.tabId));
  const clone = document.documentElement.cloneNode(true);
  // Remove edit controls
  clone.querySelectorAll('[contenteditable]').forEach(el => { el.removeAttribute('contenteditable'); });
  clone.querySelectorAll('button:not(.nav-tab)').forEach(el => el.remove());
  clone.querySelectorAll('input,select,textarea').forEach(el => {
    const span = document.createElement('span'); span.textContent = el.value; el.replaceWith(span);
  });
  clone.querySelectorAll('.modal-overlay,.reload-banner,.undo-toast,.save-indicator,.nav-tab-add').forEach(el => el.remove());
  clone.querySelectorAll('.page').forEach(pg => { if (!selectedIds.has(pg.id)) pg.remove(); });
  clone.querySelectorAll('.nav-tab[data-page]').forEach(tab => { if (!selectedIds.has(tab.dataset.page)) tab.remove(); });
  // Make first nav-tab active
  const firstTab = clone.querySelector('.nav-tab[data-page]');
  if (firstTab) { const pageId = firstTab.dataset.page; firstTab.classList.add('active'); const pg = clone.getElementById(pageId); if (pg) pg.classList.add('active'); }
  // Add header
  const header = document.createElement('div');
  header.style.cssText = 'background:#1e3a5f;color:#fff;padding:8px 20px;font-size:13px;font-family:sans-serif;position:sticky;top:0;z-index:100;display:flex;gap:16px;align-items:center';
  header.innerHTML = `<strong>DOCUMENT CONFIDENTIEL</strong><span>—</span><span>${projectMeta.client||''}</span><span>—</span><span>${projectMeta.name||''}</span><span style="margin-left:auto">Exporté le ${new Date().toLocaleDateString('fr-FR')}</span>`;
  clone.querySelector('body').prepend(header);
  // Remove scripts; add state
  clone.querySelectorAll('script').forEach(s => s.remove());
  const stateScript = document.createElement('script');
  stateScript.textContent = `const PROJECT_DATA = ${JSON.stringify(buildState())};`;
  clone.querySelector('head').appendChild(stateScript);
  // Inline CSS link as noop (styles referenced by href will still load from relative path)
  const html = '<!DOCTYPE html>\n' + clone.outerHTML;
  const name = (projectMeta.client||'export') + '_' + (projectMeta.name||'projet');
  try {
    const result = await invoke('export_html_dialog', { name });
    if (!result) return;
    if (result._browserDownload) {
      await invoke('export_html_write', { content: html, filename: result.filename });
    } else {
      await invoke('export_html_write', { path: result, content: html });
    }
  } catch (e) { console.error('Export HTML error:', e); }
}

// ═══ KEYBOARD SHORTCUTS ═══
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveProject(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'o') { e.preventDefault(); openFilePicker(); }
  if (e.key === 'Escape') {
    const open = document.querySelector('.modal-overlay.open');
    if (open) { open.classList.remove('open'); return; }
  }
});
async function openFilePicker() {
  const path = await invoke('open_dialog');
  if (path) loadProject(path);
}

// ═══ WINDOW EXPORTS (for onclick handlers in HTML) ═══
Object.assign(window, {
  goHome, reloadProject, undoDelete,
  syncNav, onMetaInput,
  openAddPhaseModal, openAddTaskModal, openEditTask, openEditPhase,
  closeModal, saveTask, savePhase,
  deleteTask, removePhase, updateTask,
  scrollToToday, renderGantt, renderDashboard, exportPDF,
  addInternalTask, addInterface, addFonctionnel, addDryrun, addInstall, addJalon,
  del_fact_projet, del_fact_equip, renderFacturation,
  addCustomHeuresRow, deleteHeuresRow, toggleHeuresHistory,
  openExportHTMLModal, doExportHTML, exportSelectAll,
  openAddCustomTabModal, addCustomTabColumn, saveCustomTab,
  normalizeSpecialLabel, buildState,
});

// ═══ INIT ═══
const params = new URLSearchParams(window.location.search);
const projectPath = params.get('project');
if (projectPath) {
  loadProject(projectPath);
} else {
  // Dev fallback: load last project from localStorage or show empty state
  const lastKey = Object.keys(localStorage).find(k => k.startsWith('wmsplan_') && !k.endsWith('recent'));
  if (lastKey) {
    loadProject(lastKey.slice('wmsplan_'.length));
  } else {
    document.body.innerHTML += `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;font-family:sans-serif;color:#64748b"><h2>Aucun projet ouvert</h2><p>Retournez à l'accueil pour créer ou ouvrir un projet.</p><button onclick="window.location.href='home.html'" style="margin-top:12px;padding:8px 20px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px">Aller à l'accueil</button></div>`;
  }
}
