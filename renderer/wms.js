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
let jiraData = { epics: [], tasks: [], lastSync: '' };
let _ganttEditMode = false;

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
    customTabs,
    jiraData
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
  jiraData      = state.jiraData      || { epics: [], tasks: [], lastSync: '' };
  if (!jiraData.epics)  jiraData.epics  = [];
  if (!jiraData.tasks)  jiraData.tasks  = [];
  if (!projectMeta.jiraConfig) projectMeta.jiraConfig = { url: '', projectKey: '', email: '', token: '' };
  // Backwards-compat: add totalType/type to projects saved before dynamic totals
  heuresData.forEach(r => {
    if (r.bold && !r.totalType) {
      const c = (r.cat || '').toLowerCase();
      if (c.includes('standard')) r.totalType = 'Standard';
      else if (c.includes('custom')) r.totalType = 'Custom';
      else if (c.includes('comp')) r.totalType = 'Offre Comp';
    }
    if (!r.bold && !r.sep && !r.type) r.type = r.custom ? 'Custom' : 'Standard';
  });
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
  _syncInstallDelayUI();

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
  renderCustomTabs();
  customTabs.forEach(t => renderCustomTabRows(t.id));
  renderJira();
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

// ═══ INSTALL DELAY UI ═══
function _syncInstallDelayUI() {
  const hasDelay = !!document.getElementById('pi-install-delayed').value;
  document.getElementById('install-delay-section').style.display = hasDelay ? 'flex' : 'none';
  document.getElementById('btn-signal-report').style.display    = hasDelay ? 'none' : '';
}
function handleInstallOrigChange(newVal) {
  const prev = projectMeta.installDateOriginal;
  if (prev && prev !== newVal) {
    const isRetard = confirm(
      'La date d\'installation a changé.\n\nClic OK = Retard : la date originale est conservée, la nouvelle date devient "Reportée".\nClic Annuler = Ajustement : la date originale est simplement mise à jour.'
    );
    if (isRetard) {
      document.getElementById('pi-install-orig').value = prev; // restore original
      document.getElementById('pi-install-delayed').value = newVal;
      openInstallDelaySection();
    }
  }
  onMetaInput();
}
function openInstallDelaySection() {
  document.getElementById('install-delay-section').style.display = 'flex';
  document.getElementById('btn-signal-report').style.display = 'none';
  document.getElementById('pi-install-delayed').focus();
}
function clearInstallDelay() {
  document.getElementById('pi-install-delayed').value = '';
  document.getElementById('pi-install-comment').value = '';
  _syncInstallDelayUI();
  onMetaInput();
}

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
const OWNER_OPTIONS = [
  { value: '',              label: '—' },
  { value: TOKEN_CLIENT,    label: () => getClientLabel() },
  { value: 'MECALUX',       label: 'MECALUX' },
  { value: 'Intégrateur',   label: 'Intégrateur' },
  { value: 'Autre',         label: 'Autre' },
];
function buildOwnerSelect(sel, currentValue) {
  sel.innerHTML = OWNER_OPTIONS.map(o => {
    const lbl = typeof o.label === 'function' ? o.label() : o.label;
    const sel_ = o.value === (currentValue || '') ? ' selected' : '';
    return `<option value="${o.value}"${sel_}>${lbl}</option>`;
  }).join('');
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

// ═══ ROW REORDER (SortableJS drag & drop) ═══
function makeSortable(tbody, arr, renderFn) {
  if (!window.Sortable) return;
  const existing = Sortable.get(tbody);
  if (existing) existing.destroy();
  Sortable.create(tbody, {
    handle: '.drag-handle',
    animation: 150,
    forceFallback: true,
    fallbackTolerance: 3,
    onEnd({ oldIndex, newIndex }) {
      if (oldIndex === newIndex) return;
      const [moved] = arr.splice(oldIndex, 1);
      arr.splice(newIndex, 0, moved);
      renderFn();
      debouncedSave();
    }
  });
}
function dh() { return `<span class="drag-handle" title="Déplacer">⠿</span>`; }

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
function fmtDateShort(d) { return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}); }
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
  buildOwnerSelect(document.getElementById('task-owner'), task.owner || '');
  document.getElementById('task-start').value = task.start || '';
  document.getElementById('task-end').value = task.end || '';
  document.getElementById('task-status').value = task.status || '';
  document.getElementById('task-priority').value = task.priority || '';
  document.getElementById('task-progress').value = task.progress || 0;
  document.getElementById('task-deliverable').value = task.deliverable || '';
  document.getElementById('btn-delete-task').style.display = '';
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

  const r1 = table.insertRow(); r1.className = 'gantt-hrow';
  const thB = document.createElement('th'); thB.colSpan = fixedCount; thB.className = 'th-month'; thB.style.background = '#1a2332'; r1.appendChild(thB);
  mGroups.forEach(mg => { const th = document.createElement('th'); th.colSpan = mg.span; th.className = 'th-month'; th.textContent = mg.label; r1.appendChild(th); });

  const r2 = table.insertRow(); r2.className = 'gantt-hrow';
  visFC.forEach(([lbl,cls]) => { const th = document.createElement('th'); th.className = 'th-fixed '+cls; th.textContent = lbl; r2.appendChild(th); });
  WEEKS.forEach(w => { const th = document.createElement('th'); th.className = 'th-week col-week'; th.textContent = weekLabel(w); if (isToday(w)) th.style.borderLeft = '2px solid #f97316'; r2.appendChild(th); });

  phases.forEach(phase => {
    const phaseTasks = tasks.filter(t => t.phaseId === phase.id);
    const rp = table.insertRow(); rp.className = 'tr-phase'; rp.dataset.phaseId = phase.id;
    const tdPh = document.createElement('td'); tdPh.colSpan = fixedCount; tdPh.style.background = phase.color;
    const phStarts = phaseTasks.map(t => t.start).filter(Boolean).map(d => new Date(d).getTime());
    const phEnds   = phaseTasks.map(t => t.end).filter(Boolean).map(d => new Date(d).getTime());
    const phDurStr = phStarts.length && phEnds.length ? ` <span style="opacity:.75;font-size:10px;font-weight:400">(${Math.round((Math.max(...phEnds) - Math.min(...phStarts)) / 86400000) + 1}j)</span>` : '';
    if (_ganttEditMode) {
      tdPh.innerHTML = `<span class="drag-handle gantt-drag-handle" style="color:rgba(255,255,255,.85);margin-right:8px;font-size:15px;vertical-align:middle">⠿</span>${phase.name}${phDurStr}`;
    } else {
      tdPh.innerHTML = `<span style="cursor:pointer" title="Modifier la phase" onclick="openEditPhase('${phase.id}')">${phase.name}${phDurStr}</span>
        <span style="float:right;display:flex;gap:6px;align-items:center">
          <button onclick="openAddTaskModal('${phase.id}')" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:10px;font-family:inherit">+ Tâche</button>
        </span>`;
    }
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
          if (_ganttEditMode) {
            td.innerHTML = `<span class="drag-handle gantt-drag-handle" title="Déplacer la tâche" style="display:block;text-align:center">⠿</span>`;
          } else {
            td.className += ' status-cell'; td.innerHTML = statusBadgeHTML(task.status); td.style.cursor = 'pointer';
            td.addEventListener('click', e => { e.stopPropagation(); showDropdown(td.querySelector('.badge'), STATUS_OPTS, val => { updateTask(task.id,'status',val); renderGantt(); renderDashboard(); }); });
          }
        } else if (lbl === 'PRIORITÉ') {
          td.style.padding = '2px 6px'; td.innerHTML = prioHTML(task.priority); td.style.cursor = 'pointer';
          td.addEventListener('click', e => { e.stopPropagation(); showDropdown(td.querySelector('span'), PRIO_OPTS, val => { updateTask(task.id,'priority',val); renderGantt(); }); });
        } else if (lbl === 'INTITULÉ') {
          td.contentEditable = true; td.textContent = formatTemplate(task.name); td.style.padding = '2px 6px'; td.style.fontWeight = task.isUnavail ? '400' : '500';
          if (done) { td.style.textDecoration = 'line-through'; td.style.color = 'var(--text-muted)'; }
          td.onblur = e => { updateTask(task.id,'name',e.target.textContent.trim()); debouncedSave(); };
        } else if (lbl === 'PROPRIÉTAIRE') {
          const ownSel = document.createElement('select');
          ownSel.className = 'gantt-select'; ownSel.style.cssText = 'width:100%';
          buildOwnerSelect(ownSel, task.owner);
          ownSel.onchange = () => { updateTask(task.id,'owner',ownSel.value); debouncedSave(); };
          td.style.padding = '2px 4px'; td.appendChild(ownSel);
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
          td.innerHTML = `<button title="Modifier" onclick="openEditTask('${task.id}')" style="background:var(--accent-light);border:none;color:var(--accent);border-radius:4px;padding:2px 7px;cursor:pointer;font-size:10px;font-family:inherit">✏</button>`;
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
          const wEnd = new Date(w); wEnd.setDate(wEnd.getDate() + 6);
          const phase = phases.find(p => p.id === task.phaseId);
          td.title = [
            formatTemplate(task.name),
            phase ? phase.name : '',
            `${fmtDateShort(new Date(task.start))} → ${fmtDateShort(new Date(task.end))}`,
            task.progress ? `${task.progress}%` : ''
          ].filter(Boolean).join('\n');
        }
        rt.appendChild(td);
      });
    });
  });
  // ── JIRA phase ──
  if (jiraData.tasks.length > 0) {
    const JIRA_COLOR = '#0052CC';
    const rpJ = table.insertRow(); rpJ.className = 'tr-phase';
    const tdPhJ = document.createElement('td'); tdPhJ.colSpan = fixedCount; tdPhJ.style.background = JIRA_COLOR;
    tdPhJ.innerHTML = `<span style="font-weight:700;letter-spacing:.5px">◈ JIRA</span>
      <span style="opacity:.7;font-size:10px;margin-left:8px">${jiraData.tasks.length} tâches · ${jiraData.epics.length} epics</span>
      <span style="float:right"><button onclick="syncJira()" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:10px;font-family:inherit">⟳ Sync</button></span>`;
    rpJ.appendChild(tdPhJ);
    WEEKS.forEach(w => { const td = document.createElement('td'); td.className = 'gantt-cell'; td.style.background = JIRA_COLOR; td.style.opacity = '.2'; if (isToday(w)) td.style.borderLeft = '2px solid #f97316'; rpJ.appendChild(td); });

    jiraData.epics.forEach(epic => {
      const epicTasks = jiraData.tasks.filter(t => t.epicId === epic.id);
      if (!epicTasks.length) return;
      // Epic sub-header
      const repic = table.insertRow(); repic.className = 'tr-phase';
      const tdEpic = document.createElement('td'); tdEpic.colSpan = fixedCount;
      tdEpic.style.cssText = `background:${epic.color}18;border-left:3px solid ${epic.color};padding-left:12px;font-size:11px`;
      tdEpic.innerHTML = `<span style="font-weight:700;color:${epic.color};font-family:monospace;margin-right:6px">${epic.key}</span>${epic.summary}`;
      repic.appendChild(tdEpic);
      WEEKS.forEach(w => { const td = document.createElement('td'); td.className = 'gantt-cell'; if (isToday(w)) td.classList.add('today-col'); repic.appendChild(td); });

      epicTasks.forEach(jTask => {
        const rt = table.insertRow(); rt.className = 'tr-task';
        visFC.forEach(([lbl, cls]) => {
          const td = document.createElement('td'); td.className = cls;
          if (lbl === 'STATUT') {
            td.className += ' status-cell';
            td.innerHTML = `<span class="badge badge-${jiraStatusBadgeClass(jTask.status)}">${jiraStatusLabel(jTask.status)}</span>`;
          } else if (lbl === 'PRIORITÉ') {
            td.style.cssText = 'text-align:center;font-size:10px;color:var(--text-muted)';
            td.textContent = jTask.storyPoints ? jTask.storyPoints + ' pts' : '—';
          } else if (lbl === 'INTITULÉ') {
            td.style.cssText = 'padding:2px 6px;font-size:11.5px';
            td.innerHTML = `<span style="font-size:10px;font-weight:700;color:#0052CC;background:#EAF0FF;padding:1px 4px;border-radius:2px;margin-right:5px;font-family:monospace">${jTask.key}</span>${jTask.summary}`;
          } else if (lbl === 'PROPRIÉTAIRE') {
            td.style.cssText = 'padding:2px 4px;font-size:11px'; td.textContent = jTask.assignee || '—';
          } else if (lbl === 'DÉBUT') {
            td.style.fontSize = '11px'; td.textContent = jTask.startDate || '—';
          } else if (lbl === 'FIN') {
            td.style.fontSize = '11px'; td.textContent = jTask.dueDate || '—';
          } else if (lbl === 'J') {
            td.style.cssText = 'text-align:center;font-size:11px';
            if (jTask.startDate && jTask.dueDate) { const d = Math.round((new Date(jTask.dueDate) - new Date(jTask.startDate)) / 86400000) + 1; td.textContent = d > 0 ? d : ''; }
          } else if (lbl === '% AVA.') {
            const pct = jTask.progress || 0; td.style.padding = '2px 6px';
            td.innerHTML = `<div class="progress-wrap"><div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${epic.color}"></div></div><span class="progress-pct">${pct}%</span></div>`;
          }
          rt.appendChild(td);
        });
        WEEKS.forEach(w => {
          const td = document.createElement('td'); td.className = 'gantt-cell';
          if (isToday(w)) td.classList.add('today-col');
          if (jTask.startDate && jTask.dueDate && isInWeek(jTask.startDate, jTask.dueDate, w)) {
            const bar = document.createElement('span'); bar.className = 'gantt-bar'; bar.style.background = epic.color;
            if ((jTask.progress || 0) >= 100) bar.classList.add('gantt-bar-done');
            td.appendChild(bar);
            td.title = `${jTask.key}: ${jTask.summary}\n${jiraStatusLabel(jTask.status)}\n${jTask.startDate} → ${jTask.dueDate}\n${jTask.progress || 0}%`;
          }
          rt.appendChild(td);
        });
      });
    });
  }

  if (_ganttEditMode) {
    const tbody = table.tBodies[0];
    if (tbody) initGanttSort(tbody);
  }
}

function toggleGanttEditMode() {
  _ganttEditMode = !_ganttEditMode;
  const btn = document.getElementById('btn-edit-planning');
  btn.textContent = _ganttEditMode ? '✓ Terminer' : '✏ Réorganiser';
  btn.style.cssText = _ganttEditMode
    ? 'background:var(--accent);color:#fff;border-color:var(--accent)'
    : '';
  renderGantt();
}

function initGanttSort(tbody) {
  if (!window.Sortable) return;
  const ex = Sortable.get(tbody);
  if (ex) ex.destroy();
  Sortable.create(tbody, {
    handle: '.gantt-drag-handle',
    animation: 150,
    forceFallback: true,
    fallbackTolerance: 3,
    onMove(evt) {
      // Block dropping before/onto header rows
      if (evt.related.classList.contains('gantt-hrow')) return false;
      return true;
    },
    onEnd({ item }) {
      const rows = Array.from(tbody.rows);
      if (item.classList.contains('tr-phase')) {
        // Phase moved: reorder phases[], tasks keep their phaseId
        const newOrder = rows
          .filter(r => r.classList.contains('tr-phase') && r.dataset.phaseId)
          .map(r => phases.find(p => p.id === r.dataset.phaseId))
          .filter(Boolean);
        phases = newOrder;
      } else if (item.dataset.taskId) {
        // Task moved: rebuild phaseId assignments + task order from DOM
        let curPhaseId = null;
        const taskAssign = [];
        rows.forEach(tr => {
          if (tr.classList.contains('tr-phase') && tr.dataset.phaseId) curPhaseId = tr.dataset.phaseId;
          else if (tr.dataset.taskId) taskAssign.push({ id: tr.dataset.taskId, phaseId: curPhaseId });
        });
        taskAssign.forEach(({ id, phaseId }) => {
          const t = tasks.find(t => t.id === id); if (t && phaseId) t.phaseId = phaseId;
        });
        tasks.sort((a, b) => {
          const ia = taskAssign.findIndex(x => x.id === a.id);
          const ib = taskAssign.findIndex(x => x.id === b.id);
          return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
        });
      }
      renderGantt(); debouncedSave();
    }
  });
}

// ═══ JIRA ═══
function jiraStatusLabel(s) {
  return { TO_DO:'Non commencé', IN_PROGRESS:'En cours', DONE:'Terminé', IN_REVIEW:'En révision', BLOCKED:'Bloqué' }[s] || (s || '—');
}
function jiraStatusBadgeClass(s) {
  return { TO_DO:'Non-commencé', IN_PROGRESS:'En-cours', DONE:'Terminé', IN_REVIEW:'Vérification-requise', BLOCKED:'En-attente' }[s] || 'empty';
}
function normalizeJiraStatus(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('done') || n.includes('terminé') || n.includes('closed') || n.includes('resolved')) return 'DONE';
  if (n.includes('progress') || n.includes('cours') || n.includes('doing')) return 'IN_PROGRESS';
  if (n.includes('review') || n.includes('révision') || n.includes('testing')) return 'IN_REVIEW';
  if (n.includes('blocked') || n.includes('bloqué')) return 'BLOCKED';
  return 'TO_DO';
}
function transformJiraIssues(epicsRaw, tasksRaw) {
  const COLORS = ['#4f46e5','#0891b2','#059669','#d97706','#dc2626','#7c3aed','#ea580c'];
  const epics = (epicsRaw.issues || []).map((iss, i) => ({
    id: iss.key, key: iss.key, summary: iss.fields.summary,
    status: normalizeJiraStatus(iss.fields.status?.name || ''),
    color: COLORS[i % COLORS.length]
  }));
  const tasks = (tasksRaw.issues || []).map(iss => ({
    id: iss.key, key: iss.key,
    epicId: iss.fields.parent?.key || null,
    summary: iss.fields.summary,
    status: normalizeJiraStatus(iss.fields.status?.name || ''),
    assignee: iss.fields.assignee?.displayName || '',
    storyPoints: iss.fields.customfield_10016 || 0,
    startDate: '',
    dueDate: iss.fields.duedate || '',
    progress: iss.fields.progress?.percent || 0
  }));
  return { epics, tasks, lastSync: '' };
}
async function syncJira() {
  const cfg = projectMeta.jiraConfig;
  if (!cfg?.token || !cfg?.url || !cfg?.projectKey) {
    openJiraConfig();
    return;
  }
  const syncBtn = document.getElementById('jira-sync-btn');
  if (syncBtn) { syncBtn.disabled = true; syncBtn.textContent = '⟳ Synchro…'; }
  try {
    const auth = btoa(`${cfg.email}:${cfg.token}`);
    const h = { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' };
    const [er, tr] = await Promise.all([
      fetch(`${cfg.url}/rest/api/3/search?jql=project%3D${cfg.projectKey}%20AND%20issuetype%3DEpic&fields=summary,status&maxResults=50`, { headers: h }),
      fetch(`${cfg.url}/rest/api/3/search?jql=project%3D${cfg.projectKey}%20AND%20issuetype%20in%20(Story%2CTask%2CBug)&fields=summary,status,assignee,customfield_10016,duedate,parent,progress&maxResults=100`, { headers: h })
    ]);
    if (!er.ok) throw new Error(`JIRA ${er.status}`);
    jiraData = transformJiraIssues(await er.json(), await tr.json());
    jiraData.lastSync = new Date().toLocaleString('fr-FR');
    renderJira(); renderGantt(); debouncedSave();
    document.getElementById('jira-sync-info').textContent = `Dernière synchro : ${jiraData.lastSync} — ${jiraData.tasks.length} tâches importées`;
  } catch (e) {
    console.error('JIRA sync:', e);
    const info = document.getElementById('jira-sync-info');
    if (info) info.textContent = 'Erreur : ' + e.message;
  } finally {
    if (syncBtn) { syncBtn.disabled = false; syncBtn.textContent = '⟳ Synchroniser'; }
  }
}
function openJiraConfig() {
  const cfg = projectMeta.jiraConfig || {};
  document.getElementById('jira-cfg-url').value   = cfg.url          || '';
  document.getElementById('jira-cfg-key').value   = cfg.projectKey   || '';
  document.getElementById('jira-cfg-email').value = cfg.email        || '';
  document.getElementById('jira-cfg-token').value = cfg.token        || '';
  document.getElementById('modal-jira-config').classList.add('open');
}
function saveJiraConfig() {
  if (!projectMeta.jiraConfig) projectMeta.jiraConfig = {};
  projectMeta.jiraConfig.url        = document.getElementById('jira-cfg-url').value.trim().replace(/\/$/, '');
  projectMeta.jiraConfig.projectKey = document.getElementById('jira-cfg-key').value.trim();
  projectMeta.jiraConfig.email      = document.getElementById('jira-cfg-email').value.trim();
  projectMeta.jiraConfig.token      = document.getElementById('jira-cfg-token').value.trim();
  closeModal('modal-jira-config');
  debouncedSave();
}
function renderJira() {
  const container = document.getElementById('jira-epics-container');
  if (!container) return;
  const { epics = [], tasks = [], lastSync = '' } = jiraData;
  const syncInfo = document.getElementById('jira-sync-info');
  if (syncInfo) syncInfo.textContent = lastSync ? `Dernière synchro : ${lastSync}` : 'Jamais synchronisé — données de démonstration affichées';
  const done = tasks.filter(t => t.status === 'DONE').length;
  const inProg = tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const kpi = document.getElementById('kpi-jira');
  if (kpi) kpi.innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Total Tâches</div><div class="kpi-value">${tasks.length}</div></div>
    <div class="kpi-card"><div class="kpi-label">Terminées</div><div class="kpi-value" style="color:#059669">${done}</div><div class="kpi-sub">${tasks.length ? Math.round(done/tasks.length*100) : 0}%</div></div>
    <div class="kpi-card"><div class="kpi-label">En cours</div><div class="kpi-value" style="color:#2563eb">${inProg}</div></div>
    <div class="kpi-card"><div class="kpi-label">Epics</div><div class="kpi-value">${epics.length}</div></div>`;
  container.innerHTML = '';
  if (!tasks.length && !epics.length) {
    container.innerHTML = `<div class="jira-empty"><p style="font-size:15px;font-weight:600;margin-bottom:6px">Aucune donnée JIRA</p><p>Configurez la connexion et synchronisez pour importer les tâches.</p></div>`;
    return;
  }
  [...epics, { id: '__orphan__', key: '', summary: 'Sans Epic', color: '#94a3b8', status: '' }].forEach(epic => {
    const epicTasks = epic.id === '__orphan__'
      ? tasks.filter(t => !t.epicId || !epics.find(e => e.id === t.epicId))
      : tasks.filter(t => t.epicId === epic.id);
    if (!epicTasks.length) return;
    const epicDone = epicTasks.filter(t => t.status === 'DONE').length;
    const epicPct  = epicTasks.length ? Math.round(epicDone / epicTasks.length * 100) : 0;
    const section  = document.createElement('div');
    section.className = 'jira-epic';
    section.innerHTML = `
      <div class="jira-epic-header" onclick="this.closest('.jira-epic').classList.toggle('collapsed')">
        <span class="jira-collapse-icon">▾</span>
        <span class="jira-epic-color-dot" style="background:${epic.color}"></span>
        ${epic.key ? `<span class="jira-epic-key">${epic.key}</span>` : ''}
        <span style="font-weight:600;font-size:13px;flex:1">${epic.summary}</span>
        ${epic.status ? `<span class="badge badge-${jiraStatusBadgeClass(epic.status)}" style="font-size:10px">${jiraStatusLabel(epic.status)}</span>` : ''}
        <div class="jira-epic-progress">
          <div class="progress-bar" style="width:80px"><div class="progress-fill" style="width:${epicPct}%;background:${epic.color}"></div></div>
          <span class="progress-pct">${epicPct}%</span>
          <span style="color:var(--text-muted);font-size:11px">${epicDone}/${epicTasks.length}</span>
        </div>
      </div>
      <div class="jira-epic-tasks">
        <div class="jira-tasks-header"><span>Clé</span><span>Intitulé</span><span>Statut</span><span>Responsable</span><span>Pts</span><span>Échéance</span><span>Avancement</span></div>
        ${epicTasks.map(t => `<div class="jira-task-row">
          <span class="jira-task-key">${t.key}</span>
          <span class="jira-task-summary">${t.summary}</span>
          <span class="badge badge-${jiraStatusBadgeClass(t.status)}" style="font-size:10px">${jiraStatusLabel(t.status)}</span>
          <span style="font-size:12px;color:var(--text-muted)">${t.assignee ? formatTemplate(t.assignee) : '—'}</span>
          <span style="font-size:12px;text-align:center">${t.storyPoints ? t.storyPoints + ' pts' : '—'}</span>
          <span style="font-size:12px;color:var(--text-muted)">${t.dueDate ? new Date(t.dueDate).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}) : '—'}</span>
          <div class="progress-wrap"><div class="progress-bar"><div class="progress-fill" style="width:${t.progress||0}%;background:${epic.color}"></div></div><span class="progress-pct">${t.progress||0}%</span></div>
        </div>`).join('')}
      </div>`;
    container.appendChild(section);
  });
}

function updateTask(id, field, value) { const t = tasks.find(t => t.id === id); if (t) t[field] = value; }

function deleteTask(id) {
  const idx = tasks.findIndex(t => t.id === id); if (idx < 0) return;
  const deleted = { ...tasks[idx] };
  tasks.splice(idx, 1); renderGantt(); renderDashboard(); debouncedSave();
  showUndoToast(`Tâche "${formatTemplate(deleted.name)}" supprimée`, () => {
    tasks.splice(idx, 0, deleted); renderGantt(); renderDashboard();
  });
}
function deleteTaskFromModal() {
  if (!_editingTaskId) return;
  closeModal('modal-task');
  deleteTask(_editingTaskId);
}

function removePhase(id) {
  const ph = phases.find(p => p.id === id);
  const deletedPhase = { ...ph };
  const deletedTasks = tasks.filter(t => t.phaseId === id);
  phases = phases.filter(p => p.id !== id); tasks = tasks.filter(t => t.phaseId !== id);
  renderGantt(); debouncedSave();
  showUndoToast(`Phase "${deletedPhase.name}" supprimée`, () => {
    phases.push(deletedPhase); tasks.push(...deletedTasks); renderGantt();
  });
}
function removePhaseFromModal() {
  if (!_editingPhaseId) return;
  closeModal('modal-phase');
  removePhase(_editingPhaseId);
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
  ['task-name','task-start','task-end','task-deliverable'].forEach(id => document.getElementById(id).value = '');
  buildOwnerSelect(document.getElementById('task-owner'), '');
  document.getElementById('task-progress').value = 0; document.getElementById('task-status').value = 'Non commencé'; document.getElementById('task-priority').value = '';
  document.getElementById('btn-delete-task').style.display = 'none';
  document.getElementById('modal-task').classList.add('open');
}
function openAddPhaseModal() {
  _editingPhaseId = null;
  document.getElementById('modal-phase-title').textContent = 'Nouvelle Phase';
  ['phase-name','phase-code'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('phase-color').value = '#1a56db';
  document.getElementById('btn-delete-phase').style.display = 'none';
  document.getElementById('modal-phase').classList.add('open');
}
function openEditPhase(phaseId) {
  _editingPhaseId = phaseId;
  const ph = phases.find(p => p.id === phaseId);
  document.getElementById('modal-phase-title').textContent = 'Modifier la Phase';
  document.getElementById('phase-name').value = ph.name; document.getElementById('phase-code').value = ph.code; document.getElementById('phase-color').value = ph.color;
  document.getElementById('btn-delete-phase').style.display = '';
  document.getElementById('modal-phase').classList.add('open');
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function saveTask() {
  const name = document.getElementById('task-name').value.trim();
  if (!name) { alert('Veuillez saisir un intitulé.'); return; }
  const data = { phaseId: document.getElementById('task-phase').value, name, owner: document.getElementById('task-owner').value, start: document.getElementById('task-start').value, end: document.getElementById('task-end').value, status: document.getElementById('task-status').value, priority: document.getElementById('task-priority').value, progress: +document.getElementById('task-progress').value || 0, deliverable: document.getElementById('task-deliverable').value.trim() };
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

async function exportCurrentTabPDF() {
  const activeTab = document.querySelector('.nav-tab.active');
  const pageId = activeTab?.dataset?.page;
  const panel = pageId === 'page-planning'
    ? document.getElementById('planning-panel')
    : document.getElementById(pageId);
  if (!panel) return;
  const btn = document.getElementById('btn-nav-pdf');
  const orig = btn?.innerHTML; if (btn) { btn.innerHTML = 'Génération…'; btn.disabled = true; }
  try {
    const { jsPDF } = window.jspdf;
    const wr = pageId === 'page-planning' ? document.getElementById('gantt-wrapper') : null;
    const prev = wr?.style.overflow; if (wr) wr.style.overflow = 'visible';
    const canvas = await html2canvas(panel, {scale:1.3,useCORS:true,backgroundColor:'#fff',logging:false,scrollX:0,scrollY:0,windowWidth:panel.scrollWidth,width:panel.scrollWidth});
    if (wr) wr.style.overflow = prev;
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({orientation:'landscape',unit:'mm',format:'a3'});
    const pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight();
    const m = 10, aw = pageW - m*2, ah = pageH - m*2 - 14;
    const ratio = canvas.width / canvas.height; let dw = aw, dh = dw / ratio; if (dh > ah) { dh = ah; dw = dh * ratio; }
    const tabName = activeTab?.textContent?.trim() || 'Export';
    const proj = projectMeta.name || '', cli = projectMeta.client || '', today = new Date().toLocaleDateString('fr-FR');
    pdf.setFillColor(26,35,50); pdf.rect(m,m,pageW-m*2,10,'F');
    pdf.setFont('helvetica','bold'); pdf.setFontSize(11); pdf.setTextColor(255,255,255); pdf.text(`${tabName.toUpperCase()} — ${proj.toUpperCase()}`, m+4, m+6.5);
    pdf.setFont('helvetica','normal'); pdf.setFontSize(9); pdf.text(`Client: ${cli}  |  ${today}`, pageW-m-4, m+6.5, {align:'right'});
    pdf.addImage(imgData,'PNG', m+(aw-dw)/2, m+12, dw, dh);
    pdf.setFontSize(8); pdf.setTextColor(150,150,150); pdf.text(`Document confidentiel — ${proj}`, m, pageH-4); pdf.text('Page 1', pageW-m, pageH-4, {align:'right'});
    pdf.save(`${tabName.replace(/\s+/g,'_')}_${proj.replace(/\s+/g,'_')}_${today.replace(/\//g,'-')}.pdf`);
  } catch (e) { console.error(e); alert('Erreur PDF.'); }
  if (btn) { btn.innerHTML = orig; btn.disabled = false; }
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
function updateHeureCat(id, val) {
  const r = heuresData.find(r => r.id === id); if (r) { r.cat = val; debouncedSave(); }
}
function updateHeureHistNote(rowId, idx, val) {
  const r = heuresData.find(r => r.id === rowId); if (r?.history?.[idx] != null) { r.history[idx].note = val; debouncedSave(); }
}
function heuresVenteTotale() { return heuresData.filter(r => !r.sep && !r.bold).reduce((s,r) => s + (r.vente||0), 0); }
function heuresActuelTotal() { return heuresData.filter(r => !r.sep && !r.bold).reduce((s,r) => s + (r.actuel||0), 0); }
function heuresVenteByType(type) { return heuresData.filter(r => !r.sep && !r.bold && (r.type||'Standard') === type).reduce((s,r) => s + (r.vente||0), 0); }
function heuresActuelByType(type) { return heuresData.filter(r => !r.sep && !r.bold && (r.type||'Standard') === type).reduce((s,r) => s + (r.actuel||0), 0); }

const HEURE_TYPES = ['Standard','Custom','Offre Comp'];
let _editingHeureId = null;

function openEditHeure(id) {
  const row = heuresData.find(r => r.id === id); if (!row) return;
  _editingHeureId = id;
  document.getElementById('eh-cat').value    = row.cat || '';
  document.getElementById('eh-type').value   = row.type || (row.custom ? 'Custom' : 'Standard');
  document.getElementById('eh-vente').value  = row.vente ?? 0;
  document.getElementById('eh-actuel').value = row.actuel ?? 0;
  document.getElementById('eh-desc').value   = row.desc || '';
  document.getElementById('modal-edit-heure').classList.add('open');
}
function saveHeures() {
  const row = heuresData.find(r => r.id === _editingHeureId); if (!row) return;
  row.cat    = document.getElementById('eh-cat').value.trim() || row.cat;
  row.type   = document.getElementById('eh-type').value;
  row.vente  = +document.getElementById('eh-vente').value || 0;
  const newActuel = +document.getElementById('eh-actuel').value || 0;
  if (newActuel !== row.actuel) {
    if (!row.history) row.history = [];
    row.history.push({ date: new Date().toISOString().slice(0,10), value: newActuel, note: '' });
  }
  row.actuel = newActuel;
  row.desc   = document.getElementById('eh-desc').value.trim();
  closeModal('modal-edit-heure'); renderHeures(); renderDashboard(); debouncedSave();
}
function deleteHeuresFromModal() {
  if (!_editingHeureId) return;
  closeModal('modal-edit-heure');
  deleteHeuresRow(_editingHeureId);
}

function renderHeures() {
  const tbody = document.getElementById('tbody-heures'); tbody.innerHTML = '';
  heuresData.forEach(row => {
    if (row.sep) { const tr = tbody.insertRow(); tr.innerHTML = `<td colspan="9" style="height:7px;background:#f7f9fb;border:none"></td>`; return; }
    const tr = tbody.insertRow(); tr.dataset.rowId = row.id;
    const ecart = (row.vente != null && row.actuel != null) ? (row.actuel - row.vente) : null;
    const ecartColor = ecart == null ? '' : ecart > 0 ? '#dc2626' : ecart < 0 ? '#059669' : 'var(--text-muted)';
    const ecartHtml = ecart != null ? `<span style="color:${ecartColor};font-weight:500">${ecart>0?'+':''}${ecart}</span>` : '<span style="color:var(--text-muted)">—</span>';
    const rowType = row.type || (row.custom ? 'Custom' : 'Standard');
    const isLocked = !!row.bold; // total/header rows are non-editable
    if (isLocked) {
      const tType = row.totalType;
      const bVente = tType ? heuresVenteByType(tType) : (row.vente||0);
      const bActuel = tType ? heuresActuelByType(tType) : (row.actuel||0);
      const bEcart = bActuel - bVente;
      const bEcartColor = bEcart > 0 ? '#dc2626' : bEcart < 0 ? '#059669' : 'var(--text-muted)';
      const bEcartHtml = `<span style="color:${bEcartColor};font-weight:500">${bEcart>0?'+':''}${bEcart}</span>`;
      tr.innerHTML = `
        <td>${dh()}</td>
        <td style="font-weight:700">${row.cat}</td>
        <td style="font-size:11px;color:var(--text-muted)">${tType||rowType}</td>
        <td style="text-align:right;font-weight:600">${bVente}</td>
        <td style="text-align:right;font-weight:600">${bActuel}</td>
        <td style="text-align:right">${bEcartHtml}</td>
        <td></td>
        <td style="color:var(--text-muted)">${row.desc||''}</td>
        <td></td>`;
    } else {
      tr.innerHTML = `
        <td>${dh()}</td>
        <td style="font-weight:400" contenteditable="true" onblur="updateHeureCat('${row.id}',this.textContent.trim())">${row.cat}</td>
        <td style="padding:2px 4px"></td>
        <td style="text-align:right"><input class="h-input" type="number" value="${row.vente!=null?row.vente:''}" placeholder="0" min="0" onchange="updateHeures('${row.id}','vente',this.value===''?null:+this.value)"></td>
        <td style="text-align:right"><input class="h-input" type="number" value="${row.actuel!=null?row.actuel:''}" placeholder="—" min="0" onchange="updateHeures('${row.id}','actuel',this.value===''?null:+this.value)"></td>
        <td style="text-align:right">${ecartHtml}</td>
        <td style="text-align:center">${(row.history||[]).length > 0 ? `<span title="Voir l'historique" style="cursor:pointer;color:var(--text-muted);font-size:14px" onclick="toggleHeuresHistory('${row.id}',this)">🕐</span>` : ''}</td>
        <td contenteditable="true" style="color:var(--text-muted)" onblur="updateHeuresDesc('${row.id}',this.textContent.trim())">${row.desc||''}</td>
        <td style="text-align:center"><button class="btn btn-secondary btn-sm" onclick="openEditHeure('${row.id}')" title="Modifier">✏</button></td>`;
      // Inline type select
      const typeSel = document.createElement('select');
      typeSel.className = 'gantt-select'; typeSel.style.width = '100%';
      HEURE_TYPES.forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t; if (t === rowType) o.selected = true; typeSel.appendChild(o); });
      typeSel.onchange = () => { row.type = typeSel.value; renderHeures(); renderDashboard(); debouncedSave(); };
      tr.cells[2].appendChild(typeSel);
    }
  });
  makeSortable(tbody, heuresData, renderHeures);
  const vente = heuresVenteTotale(), actuel = heuresActuelTotal();
  const vStd = heuresVenteByType('Standard'),   aStd = heuresActuelByType('Standard');
  const vCust = heuresVenteByType('Custom'),    aCust = heuresActuelByType('Custom');
  const vComp = heuresVenteByType('Offre Comp'),aComp = heuresActuelByType('Offre Comp');
  document.getElementById('kpi-heures').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Total Vente</div><div class="kpi-value">${vente} h</div><div class="kpi-sub">Std: ${vStd}h · Custom: ${vCust}h · Comp: ${vComp}h</div></div>
    <div class="kpi-card"><div class="kpi-label">Total Actuel</div><div class="kpi-value">${actuel} h</div><div class="kpi-sub">${vente>0?Math.round(actuel/vente*100):0}% du budget</div><div class="kpi-bar"><div class="kpi-bar-fill" style="width:${vente>0?Math.min(100,actuel/vente*100):0}%;background:${actuel>vente?'#dc2626':'var(--accent)'}"></div></div></div>
    <div class="kpi-card"><div class="kpi-label">Écart</div><div class="kpi-value" style="color:${actuel>vente?'#dc2626':actuel<vente?'#059669':'var(--text)'}">${actuel>vente?'+':''}${actuel-vente} h</div></div>
    <div class="kpi-card"><div class="kpi-label">Jours Restants (vente)</div><div class="kpi-value">${Math.round((vente-actuel)/7)}</div><div class="kpi-sub">Base 7h/jour</div></div>`;
}

function addCustomHeuresRow() {
  heuresData.push({ id: uid(), cat: 'Nouvelle catégorie', vente: 0, actuel: 0, desc: '', bold: false, sep: false, custom: true, type: 'Custom', history: [] });
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
  const td = document.createElement('td'); td.colSpan = 9; td.style.padding = '0 12px 8px 40px';
  const hist = row.history;
  let rows = hist.map((h,i) => {
    const delta = i === 0 ? '' : (h.value - hist[i-1].value);
    const deltaHtml = delta === '' ? '' : `<span style="color:${delta>0?'#dc2626':delta<0?'#059669':'var(--text-muted)'}">${delta>0?'+':''}${delta}</span>`;
    return `<tr><td style="font-size:11px;padding:2px 6px">${h.date}</td><td style="text-align:right;font-size:11px;padding:2px 6px">${h.value} h</td><td style="text-align:center;font-size:11px;padding:2px 6px">${deltaHtml}</td><td contenteditable="true" style="font-size:11px;color:var(--text-muted);padding:2px 6px" onblur="updateHeureHistNote('${row.id}',${i},this.textContent.trim())">${h.note||''}</td></tr>`;
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
const URG_OPTS = [{label:'— Aucune —',value:0,dot:'#e2e7ed'},{label:'Faible',value:1,dot:'#94a3b8'},{label:'Moyenne',value:2,dot:'#f59e0b'},{label:'Haute',value:3,dot:'#ef4444'}];
const URG_CHIP = {0:'',1:'<span class="urg-chip urg-faible" style="cursor:pointer">Faible</span>',2:'<span class="urg-chip urg-moyenne" style="cursor:pointer">Moyenne</span>',3:'<span class="urg-chip urg-haute" style="cursor:pointer">Haute</span>'};
function urgChipHTML(v) { return URG_CHIP[v||0] || '<span style="color:var(--text-muted);cursor:pointer;font-size:11px">—</span>'; }

let _editingTacheId = null;
function openEditInternalTask(id) {
  _editingTacheId = id;
  const t = internalTasks.find(t => t.id === id); if (!t) return;
  document.getElementById('et-action').value   = t.action || '';
  buildOwnerSelect(document.getElementById('et-owner'), t.owner || '');
  document.getElementById('et-etat').value     = t.etat || 'À FAIRE';
  document.getElementById('et-urg').value      = t.urg ?? 1;
  document.getElementById('et-temps').value    = t.temps || 0;
  document.getElementById('et-deadline').value = t.deadline || '';
  document.getElementById('et-comment').value  = t.comment || '';
  document.getElementById('modal-edit-tache').classList.add('open');
}
function saveInternalTask() {
  if (!_editingTacheId) return;
  const t = internalTasks.find(t => t.id === _editingTacheId); if (!t) return;
  const action = document.getElementById('et-action').value.trim();
  if (!action) { alert('Veuillez saisir une action.'); return; }
  t.action   = action;
  t.owner    = document.getElementById('et-owner').value;
  t.etat     = document.getElementById('et-etat').value;
  t.urg      = +document.getElementById('et-urg').value;
  t.temps    = +document.getElementById('et-temps').value || 0;
  t.deadline = document.getElementById('et-deadline').value;
  t.comment  = document.getElementById('et-comment').value.trim();
  closeModal('modal-edit-tache'); renderTaches(); debouncedSave();
}
function deleteInternalTaskFromModal() {
  if (!_editingTacheId) return;
  closeModal('modal-edit-tache');
  deleteInternalTask(_editingTacheId);
}

function renderTaches() {
  const tbody = document.getElementById('tbody-taches'); tbody.innerHTML = '';
  internalTasks.forEach(task => {
    const tr = tbody.insertRow(); tr.dataset.rowId = task.id;
    const urgChip = urgChipHTML(task.urg);
    tr.innerHTML = `<td>${dh()}</td>
      <td style="font-weight:500;min-width:190px">${task.action}</td>
      <td style="padding:2px 4px"></td>
      <td style="min-width:98px"><span class="${ETAT_B[task.etat]||'cell-none'}" style="cursor:pointer">${task.etat}</span></td>
      <td style="text-align:center;font-size:12px">${task.temps||0} h</td>
      <td style="font-size:12px">${task.deadline||'—'}</td>
      <td style="text-align:center">${urgChip}</td>
      <td style="color:var(--text-muted);min-width:120px;font-size:12px">${task.comment||''}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="openEditInternalTask('${task.id}')">✏</button></td>`;
    // Owner inline select
    const ownerSel = document.createElement('select');
    ownerSel.className = 'gantt-select'; ownerSel.style.width = '100%';
    buildOwnerSelect(ownerSel, task.owner);
    ownerSel.onchange = () => { task.owner = ownerSel.value; debouncedSave(); };
    tr.cells[2].appendChild(ownerSel);
    const etatSp = tr.cells[3].querySelector('span');
    etatSp.addEventListener('click', e => { e.stopPropagation(); showDropdown(etatSp, ETAT_INT.map(v => ({label:v,value:v,dot:ETAT_D[v]})), val => { task.etat = val; renderTaches(); debouncedSave(); }); });
    tr.cells[6].querySelector('span').addEventListener('click', e => { e.stopPropagation(); showDropdown(tr.cells[6].querySelector('span'), URG_OPTS, val => { task.urg = val; renderTaches(); debouncedSave(); }); });
  });
  makeSortable(tbody, internalTasks, renderTaches);
}
function addInternalTask() { internalTasks.push({id:uid(),action:'Nouvelle tâche',owner:'',etat:'À FAIRE',temps:0,deadline:'',urg:1,comment:''}); renderTaches(); debouncedSave(); }
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

let _editingInterfaceId = null;
function openEditInterface(id) {
  _editingInterfaceId = id;
  const r = interfacesData.find(r => r.id === id); if (!r) return;
  document.getElementById('ei-name').value       = r.name || '';
  document.getElementById('ei-type').value       = r.type || 'Connecteur ERP';
  document.getElementById('ei-dev').value        = r.dev || 'NON';
  document.getElementById('ei-preprod').value    = r.preprod || 'NON';
  document.getElementById('ei-recMecalux').value = r.recMecalux || 'NON';
  document.getElementById('ei-recClient').value  = r.recClient || 'NON';
  document.getElementById('ei-valide').value     = r.valide || 'NON';
  document.getElementById('ei-comment').value    = r.comment || '';
  document.getElementById('modal-edit-interface').classList.add('open');
}
function saveInterface() {
  if (!_editingInterfaceId) return;
  const r = interfacesData.find(r => r.id === _editingInterfaceId); if (!r) return;
  const name = document.getElementById('ei-name').value.trim();
  if (!name) { alert('Veuillez saisir un nom.'); return; }
  r.name       = name;
  r.type       = document.getElementById('ei-type').value;
  r.dev        = document.getElementById('ei-dev').value;
  r.preprod    = document.getElementById('ei-preprod').value;
  r.recMecalux = document.getElementById('ei-recMecalux').value;
  r.recClient  = document.getElementById('ei-recClient').value;
  r.valide     = document.getElementById('ei-valide').value;
  r.comment    = document.getElementById('ei-comment').value.trim();
  closeModal('modal-edit-interface'); renderInterfaces(); renderDashboard(); debouncedSave();
}
function deleteInterfaceFromModal() {
  if (!_editingInterfaceId) return;
  closeModal('modal-edit-interface');
  deleteInterface(_editingInterfaceId);
}

function itfBadge(v) { return `<span class="${ITF_B[v]||'cell-none'}" style="cursor:pointer">${v}</span>`; }
function renderInterfaces() {
  const tbody = document.getElementById('tbody-interfaces'); tbody.innerHTML = '';
  interfacesData.forEach(row => {
    const tr = tbody.insertRow(); tr.dataset.rowId = row.id;
    tr.innerHTML = `<td>${dh()}</td>
      <td style="font-size:12px">${row.type}</td>
      <td style="font-weight:500">${row.name}</td>
      <td>${itfBadge(row.dev)}</td><td>${itfBadge(row.preprod)}</td><td>${itfBadge(row.recMecalux)}</td><td>${itfBadge(row.recClient)}</td><td>${itfBadge(row.valide)}</td>
      <td style="color:var(--text-muted);font-size:12px">${row.comment}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="openEditInterface('${row.id}')">✏</button></td>`;
    ['dev','preprod','recMecalux','recClient','valide'].forEach((f,fi) => {
      const sp = tr.cells[fi+3].querySelector('span');
      sp.addEventListener('click', e => { e.stopPropagation(); showDropdown(sp, ITF_STATES.map(v => ({label:v,value:v,dot:ITF_D[v]})), val => { row[f] = val; sp.className = ITF_B[val]||'cell-none'; sp.textContent = val; renderDashboard(); debouncedSave(); }); });
    });
  });
  makeSortable(tbody, interfacesData, renderInterfaces);
}
function addInterface() { interfacesData.push({id:uid(),type:'Connecteur ERP',name:'Nouvelle interface',dev:'NON',preprod:'NON',recMecalux:'NON',recClient:'NON',valide:'NON',comment:''}); renderInterfaces(); debouncedSave(); }
function deleteInterface(id) {
  const idx = interfacesData.findIndex(r => r.id === id); if (idx < 0) return;
  const deleted = { ...interfacesData[idx] };
  interfacesData.splice(idx, 1); renderInterfaces(); renderDashboard(); debouncedSave();
  showUndoToast(`Interface "${deleted.name}" supprimée`, () => { interfacesData.splice(idx, 0, deleted); renderInterfaces(); renderDashboard(); });
}

// ═══ FONCTIONNEL ═══
let _editingFonctionnelId = null;
function openEditFonctionnel(id) {
  _editingFonctionnelId = id;
  const r = fonctionnelData.find(r => r.id === id); if (!r) return;
  document.getElementById('ef-name').value       = r.name || '';
  document.getElementById('ef-pct').value        = r.pct || 0;
  document.getElementById('ef-dev').value        = r.dev || 'NON';
  document.getElementById('ef-testMec').value    = r.testMec || 'NON';
  document.getElementById('ef-preprod').value    = r.preprod || 'NON';
  document.getElementById('ef-formKU').value     = r.formKU || 'NON';
  document.getElementById('ef-testClient').value = r.testClient || 'NON';
  document.getElementById('ef-formUsers').value  = r.formUsers || 'NON';
  document.getElementById('ef-comment').value    = r.comment || '';
  document.getElementById('modal-edit-fonctionnel').classList.add('open');
}
function saveFonctionnel() {
  if (!_editingFonctionnelId) return;
  const r = fonctionnelData.find(r => r.id === _editingFonctionnelId); if (!r) return;
  const name = document.getElementById('ef-name').value.trim();
  if (!name) { alert('Veuillez saisir un nom de flux.'); return; }
  r.name       = name;
  r.pct        = Math.min(100, Math.max(0, +document.getElementById('ef-pct').value || 0));
  r.dev        = document.getElementById('ef-dev').value;
  r.testMec    = document.getElementById('ef-testMec').value;
  r.preprod    = document.getElementById('ef-preprod').value;
  r.formKU     = document.getElementById('ef-formKU').value;
  r.testClient = document.getElementById('ef-testClient').value;
  r.formUsers  = document.getElementById('ef-formUsers').value;
  r.comment    = document.getElementById('ef-comment').value.trim();
  closeModal('modal-edit-fonctionnel'); renderFonctionnel(); debouncedSave();
}
function deleteFonctionnelFromModal() {
  if (!_editingFonctionnelId) return;
  closeModal('modal-edit-fonctionnel');
  const id = _editingFonctionnelId;
  const idx = fonctionnelData.findIndex(r => r.id === id); if (idx < 0) return;
  const deleted = { ...fonctionnelData[idx] };
  fonctionnelData.splice(idx, 1); renderFonctionnel(); debouncedSave();
  showUndoToast(`Flux "${deleted.name}" supprimé`, () => { fonctionnelData.splice(idx, 0, deleted); renderFonctionnel(); });
}

function renderFonctionnel() {
  const tbody = document.getElementById('tbody-fonctionnel'); tbody.innerHTML = '';
  fonctionnelData.forEach(row => {
    const tr = tbody.insertRow(); tr.dataset.rowId = row.id;
    tr.innerHTML = `<td>${dh()}</td>
      <td style="font-weight:600;min-width:160px">${row.name}</td>
      <td>${itfBadge(row.dev)}</td>
      <td style="text-align:center;cursor:pointer"><span>${row.pct}%</span></td>
      <td>${itfBadge(row.testMec)}</td><td>${itfBadge(row.preprod)}</td><td>${itfBadge(row.formKU)}</td><td>${itfBadge(row.testClient)}</td><td>${itfBadge(row.formUsers)}</td>
      <td style="color:var(--text-muted);min-width:110px;font-size:12px">${row.comment}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="openEditFonctionnel('${row.id}')">✏</button></td>`;
    ['dev','testMec','preprod','formKU','testClient','formUsers'].forEach((f,fi) => {
      const td = tr.cells[[2,4,5,6,7,8][fi]]; const sp = td.querySelector('span');
      sp.addEventListener('click', e => { e.stopPropagation(); showDropdown(sp, ITF_STATES.map(v => ({label:v,value:v,dot:ITF_D[v]})), val => { row[f] = val; sp.className = ITF_B[val]||'cell-none'; sp.textContent = val; debouncedSave(); }); });
    });
    tr.cells[3].querySelector('span').addEventListener('click', e => { e.stopPropagation(); showDropdown(tr.cells[3].querySelector('span'), [0,10,20,30,40,50,60,70,80,90,100].map(v=>({label:v+'%',value:v,dot:'#2563eb'})), val => { row.pct = val; renderFonctionnel(); debouncedSave(); }); });
  });
  makeSortable(tbody, fonctionnelData, renderFonctionnel);
}
function addFonctionnel() { fonctionnelData.push({id:uid(),name:'Nouveau flux',dev:'NON',pct:0,testMec:'NON',preprod:'NON',formKU:'NON',testClient:'NON',formUsers:'NON',comment:''}); renderFonctionnel(); debouncedSave(); }

// ═══ DRY RUN ═══
const DR_STATES = ['NON','En cours','OK','KO'];
const DR_D = {'OK':'#059669','NON':'#94a3b8','En cours':'#2563eb','KO':'#dc2626'};
const DR_B = {'OK':'cell-ok','NON':'cell-none','En cours':'cell-wip','KO':'cell-ko'};

let _editingDryrunId = null;
function openEditDryrun(id) {
  _editingDryrunId = id;
  const r = dryrunData.find(r => r.id === id); if (!r) return;
  document.getElementById('edr-name').value    = r.name || '';
  document.getElementById('edr-etat').value    = r.etat || 'NON';
  document.getElementById('edr-comment').value = r.comment || '';
  document.getElementById('modal-edit-dryrun').classList.add('open');
}
function saveDryrun() {
  if (!_editingDryrunId) return;
  const r = dryrunData.find(r => r.id === _editingDryrunId); if (!r) return;
  const name = document.getElementById('edr-name').value.trim();
  if (!name) { alert('Veuillez saisir un nom.'); return; }
  r.name    = name;
  r.etat    = document.getElementById('edr-etat').value;
  r.comment = document.getElementById('edr-comment').value.trim();
  closeModal('modal-edit-dryrun'); renderDryrun(); renderDashboard(); debouncedSave();
}
function deleteDryrunFromModal() {
  if (!_editingDryrunId) return;
  closeModal('modal-edit-dryrun');
  deleteDryrun(_editingDryrunId);
}

function drBadge(v) { return `<span class="${DR_B[v]||'cell-none'}" style="cursor:pointer">${v}</span>`; }
function renderDryrun() {
  const tbody = document.getElementById('tbody-dryrun'); tbody.innerHTML = '';
  dryrunData.forEach(row => {
    const tr = tbody.insertRow(); tr.dataset.rowId = row.id;
    tr.innerHTML = `<td>${dh()}</td>
      <td style="font-weight:500">${formatTemplate(row.name)}</td>
      <td style="min-width:98px">${drBadge(row.etat)}</td>
      <td style="color:var(--text-muted);font-size:12px">${row.comment}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="openEditDryrun('${row.id}')">✏</button></td>`;
    const sp = tr.cells[2].querySelector('span');
    sp.addEventListener('click', e => { e.stopPropagation(); showDropdown(sp, DR_STATES.map(v => ({label:v,value:v,dot:DR_D[v]})), val => { row.etat = val; sp.className = DR_B[val]||'cell-none'; sp.textContent = val; renderDashboard(); debouncedSave(); }); });
  });
  makeSortable(tbody, dryrunData, renderDryrun);
}
function addDryrun() { dryrunData.push({id:uid(),name:'Nouveau prérequis',etat:'NON',comment:''}); renderDryrun(); debouncedSave(); }
function deleteDryrun(id) {
  const idx = dryrunData.findIndex(r => r.id === id); if (idx < 0) return;
  const deleted = { ...dryrunData[idx] };
  dryrunData.splice(idx, 1); renderDryrun(); renderDashboard(); debouncedSave();
  showUndoToast(`Prérequis "${deleted.name}" supprimé`, () => { dryrunData.splice(idx, 0, deleted); renderDryrun(); renderDashboard(); });
}

// ═══ INSTALL ═══
const INST_STATES = ['Non','En cours','Oui','KO'];
const INST_D = {'Oui':'#059669','Non':'#94a3b8','En cours':'#2563eb','KO':'#dc2626'};
const INST_B = {'Oui':'cell-ok','Non':'cell-none','En cours':'cell-wip','KO':'cell-ko'};
const INST_QUI = ['MECALUX', TOKEN_CLIENT,'TOUS','Prestataire externe','—'];

let _editingInstallId = null;
function openEditInstall(id) {
  _editingInstallId = id;
  const r = installData.find(r => r.id === id); if (!r) return;
  document.getElementById('einst-action').value   = r.action || '';
  document.getElementById('einst-etat').value     = r.etat || 'Non';
  buildOwnerSelect(document.getElementById('einst-qui'), r.qui || 'MECALUX');
  document.getElementById('einst-deadline').value = r.deadline || '';
  document.getElementById('einst-comment').value  = r.comment || '';
  document.getElementById('modal-edit-install').classList.add('open');
}
function saveInstall() {
  if (!_editingInstallId) return;
  const r = installData.find(r => r.id === _editingInstallId); if (!r) return;
  const action = document.getElementById('einst-action').value.trim();
  if (!action) { alert('Veuillez saisir une action.'); return; }
  r.action   = action;
  r.etat     = document.getElementById('einst-etat').value;
  r.qui      = document.getElementById('einst-qui').value;
  r.deadline = document.getElementById('einst-deadline').value;
  r.comment  = document.getElementById('einst-comment').value.trim();
  closeModal('modal-edit-install'); renderInstall(); renderDashboard(); debouncedSave();
}
function deleteInstallFromModal() {
  if (!_editingInstallId) return;
  closeModal('modal-edit-install');
  deleteInstall(_editingInstallId);
}

function instBadge(v) { return `<span class="${INST_B[v]||'cell-none'}" style="cursor:pointer">${v}</span>`; }
function renderInstall() {
  const tbody = document.getElementById('tbody-install'); tbody.innerHTML = '';
  installData.forEach(row => {
    const tr = tbody.insertRow(); tr.dataset.rowId = row.id;
    const quiLabel = row.qui === TOKEN_CLIENT ? getClientLabel() : (row.qui || '—');
    tr.innerHTML = `<td>${dh()}</td>
      <td style="font-weight:500">${row.action}</td>
      <td style="min-width:88px">${instBadge(row.etat)}</td>
      <td style="font-size:12px">${quiLabel}</td>
      <td style="font-size:12px">${row.deadline||'—'}</td>
      <td style="color:var(--text-muted);font-size:12px">${row.comment}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="openEditInstall('${row.id}')">✏</button></td>`;
    const sp = tr.cells[2].querySelector('span');
    sp.addEventListener('click', e => { e.stopPropagation(); showDropdown(sp, INST_STATES.map(v => ({label:v,value:v,dot:INST_D[v]})), val => { row.etat = val; sp.className = INST_B[val]||'cell-none'; sp.textContent = val; renderDashboard(); debouncedSave(); }); });
  });
  makeSortable(tbody, installData, renderInstall);
}
function addInstall() { installData.push({id:uid(),action:'Nouveau prérequis',etat:'Non',qui:'MECALUX',deadline:'',comment:''}); renderInstall(); debouncedSave(); }
function deleteInstall(id) {
  const idx = installData.findIndex(r => r.id === id); if (idx < 0) return;
  const deleted = { ...installData[idx] };
  installData.splice(idx, 1); renderInstall(); renderDashboard(); debouncedSave();
  showUndoToast(`Prérequis install "${deleted.action}" supprimé`, () => { installData.splice(idx, 0, deleted); renderInstall(); renderDashboard(); });
}

// ═══ FACTURATION ═══
const FACT_STATES = ['Payé','En cours','Retard','—'];
const FACT_D = {'Payé':'#059669','En cours':'#2563eb','Retard':'#dc2626','—':'#94a3b8'};
const FACT_B = {'Payé':'cell-ok','En cours':'cell-wip','Retard':'cell-ko','—':'cell-none'};

let _editingJalonId = null, _editingJalonType = null;
function _jalonTotalMontant() {
  return [...jalonsProjet, ...jalonsEquip].reduce((s, j) => s + (j.montant || 0), 0);
}
function autoCalcJalonPct() {
  const montant = +document.getElementById('ej-montant').value || 0;
  const total   = _jalonTotalMontant();
  // Subtract the current row's old montant to avoid double-counting it
  const current = _editingJalonId ? (([...jalonsProjet,...jalonsEquip].find(j=>j.id===_editingJalonId)||{}).montant||0) : 0;
  const base = total - current + montant;
  const pct = base > 0 ? Math.round(montant / base * 100) : 0;
  document.getElementById('ej-pct').value = pct;
}
function openEditJalon(id, type) {
  _editingJalonId = id; _editingJalonType = type;
  const list = type === 'projet' ? jalonsProjet : jalonsEquip;
  const r = list.find(r => r.id === id); if (!r) return;
  document.getElementById('modal-edit-jalon-title').textContent = type === 'projet' ? 'Modifier le jalon Projet' : 'Modifier le jalon Équipement';
  document.getElementById('ej-jalon').value   = r.jalon || '';
  document.getElementById('ej-date').value    = r.date || '';
  document.getElementById('ej-echeance').value = r.echeance || '';
  document.getElementById('ej-etat').value    = r.etat || '—';
  document.getElementById('ej-pct').value     = r.pct || 0;
  document.getElementById('ej-montant').value = r.montant || 0;
  autoCalcJalonPct();
  document.getElementById('modal-edit-jalon').classList.add('open');
}
function saveJalon() {
  if (!_editingJalonId) return;
  const list = _editingJalonType === 'projet' ? jalonsProjet : jalonsEquip;
  const r = list.find(r => r.id === _editingJalonId); if (!r) return;
  const jalon = document.getElementById('ej-jalon').value.trim();
  if (!jalon) { alert('Veuillez saisir un nom de jalon.'); return; }
  r.jalon    = jalon;
  r.date     = document.getElementById('ej-date').value;
  r.echeance = document.getElementById('ej-echeance').value;
  r.etat     = document.getElementById('ej-etat').value;
  r.pct      = Math.min(100, Math.max(0, +document.getElementById('ej-pct').value || 0));
  r.montant  = +document.getElementById('ej-montant').value || 0;
  closeModal('modal-edit-jalon'); renderFacturation(); renderDashboard(); debouncedSave();
}
function deleteJalonFromModal() {
  if (!_editingJalonId) return;
  closeModal('modal-edit-jalon');
  if (_editingJalonType === 'projet') del_fact_projet(_editingJalonId);
  else del_fact_equip(_editingJalonId);
}

function factBadge(v) { return `<span class="${FACT_B[v]||'cell-none'}" style="cursor:pointer">${v}</span>`; }
function fmtMontant(v) { return (v || 0).toLocaleString('fr-FR') + ' €'; }
function renderFactRow(tbody, list, type) {
  tbody.innerHTML = '';
  list.forEach(row => {
    const tr = tbody.insertRow(); tr.dataset.rowId = row.id;
    tr.innerHTML = `<td>${dh()}</td>
      <td style="font-weight:600">${row.jalon}</td>
      <td style="font-size:12px">${row.date||'—'}</td>
      <td style="font-size:12px">${row.echeance||'—'}</td>
      <td style="min-width:78px">${factBadge(row.etat)}</td>
      <td style="text-align:right;font-size:12px">${row.pct||0}%</td>
      <td style="text-align:right;font-weight:600;font-family:'DM Mono',monospace">${fmtMontant(row.montant)}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="openEditJalon('${row.id}','${type}')">✏</button></td>`;
    const sp = tr.cells[4].querySelector('span');
    sp.addEventListener('click', e => { e.stopPropagation(); showDropdown(sp, FACT_STATES.map(v => ({label:v,value:v,dot:FACT_D[v]})), val => { row.etat = val; sp.className = FACT_B[val]||'cell-none'; sp.textContent = val; renderFacturation(); renderDashboard(); debouncedSave(); }); });
  });
  makeSortable(tbody, list, renderFacturation);
}
function del_fact_projet(id) {
  const idx = jalonsProjet.findIndex(r => r.id === id); if (idx < 0) return;
  const deleted = { ...jalonsProjet[idx] };
  jalonsProjet.splice(idx, 1); renderFacturation(); renderDashboard(); debouncedSave();
  showUndoToast(`Jalon "${deleted.jalon}" supprimé`, () => { jalonsProjet.splice(idx, 0, deleted); renderFacturation(); renderDashboard(); });
}
function del_fact_equip(id) {
  const idx = jalonsEquip.findIndex(r => r.id === id); if (idx < 0) return;
  const deleted = { ...jalonsEquip[idx] };
  jalonsEquip.splice(idx, 1); renderFacturation(); renderDashboard(); debouncedSave();
  showUndoToast(`Jalon "${deleted.jalon}" supprimé`, () => { jalonsEquip.splice(idx, 0, deleted); renderFacturation(); renderDashboard(); });
}
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
const DASH_CHARTS = [
  { key: 'phases',  label: 'Avancement par Phase' },
  { key: 'statuts', label: 'Répartition des Statuts' },
  { key: 'heures',  label: 'Suivi Heures' },
  { key: 'fact',    label: 'Facturation' },
  { key: 'itf',     label: 'Interfaces ERP' },
  { key: 'install', label: 'Prérequis Installation' },
  { key: 'dryrun',  label: 'Prérequis Dry Run' },
  { key: 'jira',    label: 'JIRA — Épics & Tâches' },
];
function isChartVisible(key) {
  const v = projectMeta.dashboardCharts;
  return !v || v.includes(key);
}

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
  if (isChartVisible('phases')) {
    const phaseLabels = phases.map(p => p.name.length>20 ? p.name.slice(0,20)+'…' : p.name);
    const phaseData = phases.map(ph => { const pt = tasks.filter(t => t.phaseId === ph.id); return pt.length ? Math.round(pt.reduce((s,t) => s+(t.progress||0), 0)/pt.length) : 0; });
    charts['phases'] = new Chart(document.getElementById('ch-phases'), {type:'bar',data:{labels:phaseLabels,datasets:[{label:'Avancement %',data:phaseData,backgroundColor:phases.map(p=>p.color+'cc'),borderColor:phases.map(p=>p.color),borderWidth:2,borderRadius:5}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{max:100,ticks:{callback:v=>v+'%'},grid:{color:'#f0f2f5'}},y:{grid:{display:false}}}}});
  }

  destroyChart('statuts');
  if (isChartVisible('statuts')) {
    const statusCounts = {}; tasks.forEach(t => { const s = t.status||'Non défini'; statusCounts[s] = (statusCounts[s]||0)+1; });
    const statusColors = {'Terminé':'#059669','En cours':'#2563eb','Non commencé':'#94a3b8','En attente':'#d97706','En retard':'#dc2626','Vérification requise':'#7c3aed','Mise à jour requise':'#0891b2','Non défini':'#e2e7ed'};
    charts['statuts'] = new Chart(document.getElementById('ch-statuts'), {type:'doughnut',data:{labels:Object.keys(statusCounts),datasets:[{data:Object.values(statusCounts),backgroundColor:Object.keys(statusCounts).map(s=>statusColors[s]||'#e2e7ed'),borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{font:{size:11},boxWidth:12}}}}});
  }

  destroyChart('heures');
  if (isChartVisible('heures')) {
    const hRows = heuresData.filter(r => !r.sep && !r.bold && r.vente);
    charts['heures'] = new Chart(document.getElementById('ch-heures'), {type:'bar',data:{labels:hRows.map(r=>r.cat.length>14?r.cat.slice(0,14)+'…':r.cat),datasets:[{label:'Vente',data:hRows.map(r=>r.vente||0),backgroundColor:'#bfdbfe',borderColor:'#2563eb',borderWidth:1,borderRadius:3},{label:'Actuel',data:hRows.map(r=>r.actuel||0),backgroundColor:'#fca5a5',borderColor:'#dc2626',borderWidth:1,borderRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{font:{size:11},boxWidth:12}}},scales:{x:{ticks:{font:{size:10}},grid:{display:false}},y:{grid:{color:'#f0f2f5'}}}}});
  }

  destroyChart('fact');
  if (isChartVisible('fact')) {
    const allJ = [...jalonsProjet,...jalonsEquip];
    const totM   = allJ.reduce((s,j)=>s+(j.montant||0),0);
    const payeM  = allJ.filter(j=>j.etat==='Payé').reduce((s,j)=>s+(j.montant||0),0);
    const coursM = allJ.filter(j=>j.etat==='En cours').reduce((s,j)=>s+(j.montant||0),0);
    const retardM= allJ.filter(j=>j.etat==='Retard').reduce((s,j)=>s+(j.montant||0),0);
    const resteM = Math.max(0, totM - payeM - coursM - retardM);
    const fmtEur = v => v.toLocaleString('fr-FR') + ' €';
    const factTitle = document.getElementById('ch-fact-title');
    if (factTitle) factTitle.textContent = `Facturation — ${fmtEur(payeM)} payé / ${fmtEur(totM)} total`;
    charts['fact'] = new Chart(document.getElementById('ch-fact'), {
      type:'bar',
      data:{labels:[''],datasets:[
        {label:'Payé',    data:[payeM],  backgroundColor:'#86efac'},
        {label:'En cours',data:[coursM], backgroundColor:'#93c5fd'},
        {label:'Retard',  data:[retardM],backgroundColor:'#fca5a5'},
        {label:'Restant', data:[resteM], backgroundColor:'#e2e7ed'},
      ]},
      options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
        plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:10}},
          tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${fmtEur(ctx.raw)}`}}},
        scales:{x:{stacked:true,ticks:{callback:v=>fmtEur(v),font:{size:10}},grid:{color:'#f0f2f5'}},y:{stacked:true,display:false}}}
    });
  }

  destroyChart('itf');
  if (isChartVisible('itf')) {
    const itfCounts = ITF_STATES.reduce((o,s) => { o[s] = interfacesData.filter(r=>r.valide===s).length; return o; }, {});
    charts['itf'] = new Chart(document.getElementById('ch-itf'), {type:'doughnut',data:{labels:['Validé (OUI)','En cours','Non validé (NON)','KO'],datasets:[{data:[itfCounts.OUI||0,itfCounts['EN COURS']||0,itfCounts.NON||0,itfCounts.KO||0],backgroundColor:['#86efac','#93c5fd','#e2e7ed','#fca5a5'],borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:10}}}}});
  }

  destroyChart('install');
  if (isChartVisible('install')) {
    charts['install'] = new Chart(document.getElementById('ch-install'), {type:'doughnut',data:{labels:['Oui','En cours','Non','KO'],datasets:[{data:[installData.filter(r=>r.etat==='Oui').length,installData.filter(r=>r.etat==='En cours').length,installData.filter(r=>r.etat==='Non').length,installData.filter(r=>r.etat==='KO').length],backgroundColor:['#86efac','#93c5fd','#e2e7ed','#fca5a5'],borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:10}}}}});
  }

  destroyChart('dryrun');
  if (isChartVisible('dryrun')) {
    charts['dryrun'] = new Chart(document.getElementById('ch-dryrun'), {type:'doughnut',data:{labels:['OK','En cours','NON','KO'],datasets:[{data:[dryrunData.filter(r=>r.etat==='OK').length,dryrunData.filter(r=>r.etat==='En cours').length,dryrunData.filter(r=>r.etat==='NON').length,dryrunData.filter(r=>r.etat==='KO').length],backgroundColor:['#86efac','#93c5fd','#e2e7ed','#fca5a5'],borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:10}}}}});
  }

  destroyChart('jira');
  if (isChartVisible('jira')) {
    const epics = jiraData.epics || [];
    const tasks_j = jiraData.tasks || [];
    if (epics.length) {
      const epicLabels = epics.map(e => (e.key + ' ' + e.summary).slice(0, 30));
      const doneData = epics.map(e => tasks_j.filter(t => t.epicKey === e.key && t.status === 'done').length);
      const inProgData = epics.map(e => tasks_j.filter(t => t.epicKey === e.key && t.status === 'inprogress').length);
      const todoData = epics.map(e => tasks_j.filter(t => t.epicKey === e.key && t.status === 'todo').length);
      charts['jira'] = new Chart(document.getElementById('ch-jira'), {
        type: 'bar',
        data: { labels: epicLabels, datasets: [
          { label: 'Terminé',   data: doneData,   backgroundColor: '#86efac', borderRadius: 3 },
          { label: 'En cours',  data: inProgData, backgroundColor: '#93c5fd', borderRadius: 3 },
          { label: 'À faire',   data: todoData,   backgroundColor: '#e2e7ed', borderRadius: 3 },
        ]},
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } } },
          scales: { x: { stacked: true, ticks: { stepSize: 1 }, grid: { color: '#f0f2f5' } }, y: { stacked: true, grid: { display: false } } }
        }
      });
    } else {
      const canvas = document.getElementById('ch-jira');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#94a3b8'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Aucune donnée JIRA — synchronisez dans l\'onglet JIRA', canvas.width / 2, 60);
    }
  }

  DASH_CHARTS.forEach(c => {
    const card = document.getElementById('card-' + c.key);
    if (card) card.style.display = isChartVisible(c.key) ? '' : 'none';
  });
}

function openDashCustomize() {
  const list = document.getElementById('dash-customize-list'); list.innerHTML = '';
  const visible = projectMeta.dashboardCharts || DASH_CHARTS.map(c => c.key);
  DASH_CHARTS.forEach(c => {
    const label = document.createElement('label');
    label.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = c.key; cb.checked = visible.includes(c.key);
    label.appendChild(cb); label.appendChild(document.createTextNode(c.label));
    list.appendChild(label);
  });
  document.getElementById('modal-dash-customize').classList.add('open');
}

function saveDashCustomize() {
  projectMeta.dashboardCharts = [...document.getElementById('dash-customize-list').querySelectorAll('input:checked')].map(cb => cb.value);
  closeModal('modal-dash-customize');
  renderDashboard();
  debouncedSave();
}

// ═══ CUSTOM TABS ═══
let _editingTabId = null;

function openAddCustomTabModal() {
  _editingTabId = null;
  document.getElementById('modal-custom-tab-title').textContent = 'Nouvel Onglet';
  document.getElementById('ct-name').value = '';
  document.getElementById('ct-icon').value = '📋';
  document.getElementById('ct-columns-list').innerHTML = '';
  _ctCols = [];
  addCustomTabColumn();
  document.getElementById('modal-custom-tab').classList.add('open');
}

function openEditCustomTabModal(tabId) {
  const tab = customTabs.find(t => t.id === tabId);
  if (!tab) return;
  _editingTabId = tabId;
  document.getElementById('modal-custom-tab-title').textContent = 'Modifier l\'Onglet';
  document.getElementById('ct-name').value = tab.name;
  document.getElementById('ct-icon').value = tab.icon || '📋';
  _ctCols = tab.columns.map(c => ({ ...c }));
  renderCtColumns();
  document.getElementById('modal-custom-tab').classList.add('open');
}

let _ctCols = [];
function renderCtColumns() {
  const list = document.getElementById('ct-columns-list');
  list.innerHTML = '';
  _ctCols.forEach((col, i) => {
    const row = document.createElement('div');
    row.className = 'ct-col-row';
    row.innerHTML = `
      <input type="text" placeholder="Libellé *" value="${col.label||''}" style="flex:1;min-width:120px" oninput="ctColLabel(${i},this.value)">
      <select style="width:110px" onchange="ctColType(${i},this.value)">
        ${['text','select','date','checkbox'].map(t=>`<option value="${t}"${col.type===t?' selected':''}>${{text:'Texte',select:'Liste',date:'Date',checkbox:'Case'}[t]}</option>`).join('')}
      </select>
      ${col.type==='select' ? `<input type="text" placeholder="opt1, opt2…" value="${(col.options||[]).join(', ')}" style="flex:1;min-width:100px" oninput="ctColOptions(${i},this.value)">` : '<span style="flex:1"></span>'}
      <button class="btn btn-ghost btn-sm" onclick="ctColRemove(${i})" ${_ctCols.length<=1?'disabled':''}>✕</button>`;
    list.appendChild(row);
  });
  document.getElementById('btn-add-col').disabled = _ctCols.length >= 5;
}

function ctColLabel(i, v)   { _ctCols[i].label = v; }
function ctColType(i, v)    { _ctCols[i].type = v; renderCtColumns(); }
function ctColOptions(i, v) { _ctCols[i].options = v.split(',').map(s => s.trim()).filter(Boolean); }
function ctColRemove(i)     { _ctCols.splice(i, 1); renderCtColumns(); }

function addCustomTabColumn() {
  if (_ctCols.length >= 5) return;
  _ctCols.push({ key: 'col' + uid(), label: '', type: 'text', editable: true });
  renderCtColumns();
}

function saveCustomTab() {
  const name = document.getElementById('ct-name').value.trim();
  if (!name) { alert('Veuillez saisir un nom d\'onglet.'); return; }
  const cols = _ctCols.filter(c => c.label.trim());
  if (!cols.length) { alert('Ajoutez au moins une colonne.'); return; }
  if (_editingTabId) {
    const tab = customTabs.find(t => t.id === _editingTabId);
    tab.name = name; tab.icon = document.getElementById('ct-icon').value || '📋';
    tab.columns = cols;
  } else {
    customTabs.push({ id: uid(), name, icon: document.getElementById('ct-icon').value || '📋', columns: cols, rows: [] });
  }
  closeModal('modal-custom-tab');
  renderCustomTabs();
  debouncedSave();
}

function renderCustomTabs() {
  // Remove existing custom tab pages and nav tabs
  document.querySelectorAll('.page.page-custom-tab').forEach(el => el.remove());
  document.querySelectorAll('.nav-tab.nav-tab-custom').forEach(el => el.remove());

  const navTabs = document.getElementById('nav-tabs');
  const addBtn = navTabs.querySelector('.nav-tab-add');

  customTabs.forEach(tab => {
    // Nav tab
    const navTab = document.createElement('div');
    navTab.className = 'nav-tab nav-tab-custom';
    navTab.dataset.page = 'page-ct-' + tab.id;
    navTab.innerHTML = `${tab.icon||''} ${tab.name}`;
    navTab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      navTab.classList.add('active');
      document.getElementById('page-ct-' + tab.id).classList.add('active');
    });
    navTabs.insertBefore(navTab, addBtn);

    // Page
    const page = document.createElement('div');
    page.className = 'page page-custom-tab';
    page.id = 'page-ct-' + tab.id;
    page.innerHTML = buildCustomTabHTML(tab);
    document.getElementById('custom-tabs-container').appendChild(page);
  });
}

function buildCustomTabHTML(tab) {
  const cols = tab.columns;
  const headerCells = `<th style="width:26px"></th>${cols.map(c=>`<th>${c.label}</th>`).join('')}<th style="width:34px"></th>`;
  const bodyId = `tbody-ct-${tab.id}`;
  return `
    <div class="panel">
      <div class="panel-header">
        <span class="panel-title">${tab.icon||''} ${tab.name}</span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="openEditCustomTabModal('${tab.id}')" title="Modifier l'onglet">✏ Modifier</button>
          <button class="btn btn-secondary btn-sm" onclick="addCustomTabRow('${tab.id}')">＋ Ligne</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCustomTab('${tab.id}')">🗑 Supprimer</button>
        </div>
      </div>
      <div style="padding:0"><table class="data-table">
        <thead><tr>${headerCells}</tr></thead>
        <tbody id="${bodyId}"></tbody>
      </table></div>
    </div>`;
}

function renderCustomTabRows(tabId) {
  const tab = customTabs.find(t => t.id === tabId);
  if (!tab) return;
  const tbody = document.getElementById('tbody-ct-' + tabId);
  if (!tbody) return;
  tbody.innerHTML = '';
  tab.rows.forEach(row => {
    const tr = tbody.insertRow(); tr.dataset.rowId = row.id;
    let cells = `<td>${dh()}</td>`;
    tab.columns.forEach(col => {
      const val = row[col.key] !== undefined ? row[col.key] : '';
      if (col.type === 'checkbox') {
        cells += `<td style="text-align:center"><input type="checkbox" ${val?'checked':''} onchange="ctSetCell('${tabId}','${row.id}','${col.key}',this.checked);_DS()"></td>`;
      } else if (col.type === 'date') {
        cells += `<td><input type="date" value="${val}" style="border:none;background:transparent;font-family:inherit;font-size:11.5px;width:100%" onchange="ctSetCell('${tabId}','${row.id}','${col.key}',this.value);_DS()"></td>`;
      } else if (col.type === 'select') {
        const opts = (col.options||[]).map(o=>`<option${o===val?' selected':''}>${o}</option>`).join('');
        cells += `<td><select class="tbl-sel" onchange="ctSetCell('${tabId}','${row.id}','${col.key}',this.value);_DS()">${opts}</select></td>`;
      } else {
        cells += `<td contenteditable="true" onblur="ctSetCell('${tabId}','${row.id}','${col.key}',this.textContent.trim());_DS()">${val}</td>`;
      }
    });
    cells += `<td><button class="btn btn-sm btn-danger" onclick="deleteCustomTabRow('${tabId}','${row.id}')">✕</button></td>`;
    tr.innerHTML = cells;
  });
  makeSortable(tbody, tab.rows, () => { renderCustomTabRows(tabId); debouncedSave(); });
}

function ctSetCell(tabId, rowId, key, value) {
  const tab = customTabs.find(t => t.id === tabId);
  if (!tab) return;
  const row = tab.rows.find(r => r.id === rowId);
  if (row) row[key] = value;
}

function addCustomTabRow(tabId) {
  const tab = customTabs.find(t => t.id === tabId);
  if (!tab) return;
  const row = { id: uid() };
  tab.columns.forEach(col => { row[col.key] = col.type === 'checkbox' ? false : col.type === 'select' ? (col.options||[''])[0] : ''; });
  tab.rows.push(row);
  renderCustomTabRows(tabId);
  debouncedSave();
}

function deleteCustomTabRow(tabId, rowId) {
  const tab = customTabs.find(t => t.id === tabId);
  if (!tab) return;
  const idx = tab.rows.findIndex(r => r.id === rowId); if (idx < 0) return;
  const deleted = { ...tab.rows[idx] };
  tab.rows.splice(idx, 1);
  renderCustomTabRows(tabId); debouncedSave();
  showUndoToast('Ligne supprimée', () => { tab.rows.splice(idx, 0, deleted); renderCustomTabRows(tabId); });
}

function deleteCustomTab(tabId) {
  if (!confirm('Supprimer cet onglet et toutes ses données ?')) return;
  const idx = customTabs.findIndex(t => t.id === tabId); if (idx < 0) return;
  const deleted = { ...customTabs[idx], rows: [...customTabs[idx].rows] };
  customTabs.splice(idx, 1);
  renderCustomTabs();
  // Re-render rows for remaining tabs
  customTabs.forEach(t => renderCustomTabRows(t.id));
  debouncedSave();
  showUndoToast(`Onglet "${deleted.name}" supprimé`, () => {
    customTabs.splice(idx, 0, deleted); renderCustomTabs(); customTabs.forEach(t => renderCustomTabRows(t.id));
  });
}

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

  // Fetch and inline CSS
  let inlineCSS = '';
  try { inlineCSS = await fetch('./wms.css').then(r => r.text()); } catch {}

  const clone = document.documentElement.cloneNode(true);

  // Replace CSS link with inline style
  clone.querySelectorAll('link[rel="stylesheet"]').forEach(el => el.remove());
  const styleEl = document.createElement('style');
  styleEl.textContent = inlineCSS;
  clone.querySelector('head').prepend(styleEl);

  // Replace input/select/textarea with static text spans
  clone.querySelectorAll('input[type="date"],input[type="text"],input[type="number"],textarea').forEach(el => {
    const span = document.createElement('span'); span.textContent = el.value; el.replaceWith(span);
  });
  clone.querySelectorAll('input[type="checkbox"]').forEach(el => {
    const span = document.createElement('span'); span.textContent = el.checked ? '☑' : '☐'; el.replaceWith(span);
  });
  clone.querySelectorAll('select').forEach(el => {
    const span = document.createElement('span'); span.textContent = el.options[el.selectedIndex]?.text || ''; el.replaceWith(span);
  });

  // Strip editing UI
  clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
  clone.querySelectorAll('button').forEach(el => el.remove());
  clone.querySelectorAll('.modal-overlay,.reload-banner,.undo-toast,.save-indicator,.nav-tab-add,.history-row').forEach(el => el.remove());

  // Keep only selected tabs
  clone.querySelectorAll('.page').forEach(pg => { if (!selectedIds.has(pg.id)) pg.remove(); });
  clone.querySelectorAll('.nav-tab[data-page],.nav-tab.nav-tab-custom').forEach(tab => {
    const pageId = tab.dataset.page; if (!selectedIds.has(pageId)) tab.remove();
  });

  // Activate first selected tab
  const firstTab = clone.querySelector('.nav-tab[data-page]');
  if (firstTab) {
    const pageId = firstTab.dataset.page; firstTab.classList.add('active');
    const pg = clone.getElementById(pageId); if (pg) pg.classList.add('active');
  }

  // Confidentiality header
  const headerDiv = document.createElement('div');
  headerDiv.style.cssText = 'background:#1e3a5f;color:#fff;padding:8px 20px;font-size:13px;font-family:sans-serif;position:sticky;top:0;z-index:100;display:flex;gap:16px;align-items:center';
  headerDiv.innerHTML = `<strong>DOCUMENT CONFIDENTIEL</strong><span>—</span><span>${projectMeta.client||''}</span><span>—</span><span>${projectMeta.name||''}</span><span style="margin-left:auto">Exporté le ${new Date().toLocaleDateString('fr-FR')}</span>`;
  clone.querySelector('body').prepend(headerDiv);

  // Remove all scripts; embed project state for reference
  clone.querySelectorAll('script').forEach(s => s.remove());
  const stateScript = document.createElement('script');
  stateScript.textContent = `const PROJECT_DATA=${JSON.stringify(buildState())};`;
  clone.querySelector('head').appendChild(stateScript);

  // Minimal nav click handler (read-only tab switching)
  const navScript = document.createElement('script');
  navScript.textContent = `document.querySelectorAll('.nav-tab[data-page]').forEach(t=>t.addEventListener('click',()=>{document.querySelectorAll('.nav-tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));t.classList.add('active');const p=document.getElementById(t.dataset.page);if(p)p.classList.add('active');}));`;
  clone.querySelector('body').appendChild(navScript);

  const html = '<!DOCTYPE html>\n' + clone.outerHTML;
  const name = (projectMeta.client||'export').replace(/\s+/g,'_') + '_' + (projectMeta.name||'projet').replace(/\s+/g,'_');

  try {
    const result = await invoke('export_html_dialog', { name });
    if (!result) return;
    if (result && result._browserDownload) {
      await invoke('export_html_write', { content: html, filename: result.filename });
    } else {
      await invoke('export_html_write', { path: result, content: html });
    }
  } catch (e) { console.error('Export HTML error:', e); alert('Erreur export HTML: ' + e); }
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

// ═══ COLUMN RESIZING ═══
const RESIZABLE_TBODIES = ['tbody-heures','tbody-taches','tbody-interfaces','tbody-fonctionnel','tbody-dryrun','tbody-install','tbody-jalons-projet','tbody-jalons-equip'];

function makeResizable(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  const table = tbody?.closest('table');
  if (!table) return;
  const ths = Array.from(table.querySelectorAll('thead th'));
  const storageKey = 'col-w:' + tbodyId;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    ths.forEach((th, i) => { if (saved[i]) { th.style.width = saved[i] + 'px'; th.style.minWidth = saved[i] + 'px'; } });
  } catch {}
  ths.forEach((th, i) => {
    if (th.querySelector('.col-resize-handle')) return;
    const handle = document.createElement('div');
    handle.className = 'col-resize-handle';
    th.style.position = 'relative';
    th.appendChild(handle);
    let startX, startW;
    handle.addEventListener('pointerdown', e => {
      e.stopPropagation(); e.preventDefault();
      startX = e.clientX; startW = th.offsetWidth;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', e => {
      if (!(e.buttons & 1)) return;
      const newW = Math.max(30, startW + (e.clientX - startX));
      th.style.width = newW + 'px'; th.style.minWidth = newW + 'px';
    });
    handle.addEventListener('pointerup', () => {
      const widths = {};
      ths.forEach((t, idx) => { widths[idx] = t.offsetWidth; });
      localStorage.setItem(storageKey, JSON.stringify(widths));
    });
  });
}

function initResizableTables() {
  RESIZABLE_TBODIES.forEach(makeResizable);
}

// ═══ WINDOW EXPORTS (for onclick handlers in HTML) ═══
Object.assign(window, {
  goHome, reloadProject, undoDelete,
  syncNav, onMetaInput, handleInstallOrigChange, openInstallDelaySection, clearInstallDelay,
  openAddPhaseModal, openAddTaskModal, openEditTask, openEditPhase,
  closeModal, saveTask, savePhase,
  deleteTask, deleteTaskFromModal, removePhase, removePhaseFromModal, updateTask,
  scrollToToday, renderGantt, renderDashboard, exportPDF, exportCurrentTabPDF, toggleGanttEditMode,
  renderJira, openJiraConfig, saveJiraConfig, syncJira,
  addInternalTask, openEditInternalTask, saveInternalTask, deleteInternalTask, deleteInternalTaskFromModal,
  addInterface, openEditInterface, saveInterface, deleteInterfaceFromModal,
  openEditFonctionnel, saveFonctionnel, deleteFonctionnelFromModal, addFonctionnel,
  openEditDryrun, saveDryrun, deleteDryrunFromModal, addDryrun,
  addInstall, openEditInstall, saveInstall, deleteInstallFromModal, deleteInstall,
  addJalon, openEditJalon, saveJalon, deleteJalonFromModal, autoCalcJalonPct,
  del_fact_projet, del_fact_equip, renderFacturation,
  addCustomHeuresRow, deleteHeuresRow, deleteHeuresFromModal, openEditHeure, saveHeures, toggleHeuresHistory,
  updateHeures, updateHeuresDesc, updateHeureCat, updateHeureHistNote,
  openExportHTMLModal, doExportHTML, exportSelectAll,
  openDashCustomize, saveDashCustomize,
  openAddCustomTabModal, openEditCustomTabModal, addCustomTabColumn, saveCustomTab,
  renderCtColumns, ctColLabel, ctColType, ctColOptions, ctColRemove,
  renderCustomTabs, renderCustomTabRows, addCustomTabRow, deleteCustomTabRow, deleteCustomTab, ctSetCell,
  normalizeSpecialLabel, buildState,
});

initResizableTables();

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
