// =====================================================
//  WMS Project Planning — Application Script (v2)
//  ES module — loaded via <script type="module">
// =====================================================
import { invoke, listenFileChanged, setWindowTitle, getAppVersion } from './tauri-ipc.js';

// ── Schema migration ────────────────────────────────���────────────────────────
const CURRENT_SCHEMA_VERSION = 1;

function migrateProjectData(data) {
  const v = data?.meta?.schemaVersion ?? 0;
  if (v >= CURRENT_SCHEMA_VERSION) return data;
  // v0 → v1: no structural changes yet; just stamp the version
  if (!data.meta) data.meta = {};
  data.meta.schemaVersion = CURRENT_SCHEMA_VERSION;
  return data;
}

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
let jalonsDeplacements = [];
const DEFAULT_DEPLACEMENTS = [
  { id: 'avion-train',  label: 'Avion / Train',  vendu: 0, depenses: [] },
  { id: 'voiture',      label: 'Voiture',         vendu: 0, depenses: [] },
  { id: 'hotel',        label: 'Hôtel',           vendu: 0, depenses: [] },
  { id: 'restauration', label: 'Restauration',    vendu: 0, depenses: [] },
];
let customTabs = [];
let jiraData = { epics: [], tasks: [], lastSync: '' };
let _ganttEditMode = false;
let _collapsedPhases = new Set();
let _companyName = 'COMPANY';
let _ownerOptions = ['Intégrateur', 'Autre'];
let _userSettings = {};
let _lastDailyBackupDay = '';
let _lastSecondaryBackupTime = 0;

// ═══ IPC / SAVE ═══
function buildState() {
  return {
    meta: { ...projectMeta, updatedAt: new Date().toISOString() },
    phases, tasks, heuresData, internalTasks,
    interfaces: interfacesData,
    functional: fonctionnelData,
    dryRun: dryrunData,
    install: installData,
    billing: { jalonsProjet, jalonsEquipement: jalonsEquip, jalonsDeplacements },
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
    const json = JSON.stringify(state, null, 2);
    await invoke('write_project', { path: currentPath, data: json });

    // Daily backup to {project folder}/Backup/
    const today = new Date().toISOString().slice(0, 10);
    if (today !== _lastDailyBackupDay) {
      try { await invoke('write_daily_backup', { path: currentPath }); } catch {}
      _lastDailyBackupDay = today;
    }

    // Secondary auto-save to per-project folder at configured interval
    const autoSavePath = projectMeta.autoSavePath;
    if (autoSavePath) {
      const intervalMs = ((projectMeta.autoSaveIntervalMins || 5)) * 60 * 1000;
      if (Date.now() - _lastSecondaryBackupTime >= intervalMs) {
        try {
          const fileName = currentPath.split(/[\\/]/).pop();
          const sep = autoSavePath.includes('\\') ? '\\' : '/';
          const secondaryPath = autoSavePath.replace(/[/\\]+$/, '') + sep + fileName;
          await invoke('write_project', { path: secondaryPath, data: json });
          _lastSecondaryBackupTime = Date.now();
        } catch {}
      }
    }

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
    try {
      const rawSettings = await invoke('read_settings');
      const s = typeof rawSettings === 'string' ? JSON.parse(rawSettings) : (rawSettings || {});
      if (s.companyName) _companyName = s.companyName;
      _userSettings = s;
    } catch {}
    const raw = await invoke('read_project', { path });
    const state = migrateProjectData(JSON.parse(raw));
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
    const msg = String(e).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    document.body.innerHTML = `<div style="padding:40px;color:#dc2626;font-family:sans-serif"><h2>Erreur de chargement</h2><p>${msg}</p><button onclick="window.location.href='home.html'">Retour à l'accueil</button></div>`;
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
  if (!_userSettings.jiraConfig) _userSettings.jiraConfig = { url: '', email: '', token: '' };
  _ownerOptions = (Array.isArray(projectMeta.ownerOptions) && projectMeta.ownerOptions.length > 0)
    ? projectMeta.ownerOptions
    : ['Intégrateur', 'Autre'];
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
  // Merge saved deplacements with defaults — migrate old montant → vendu
  const savedDepl = state.billing?.jalonsDeplacements || [];
  jalonsDeplacements = DEFAULT_DEPLACEMENTS.map(def => {
    const saved = savedDepl.find(r => r.id === def.id);
    if (!saved) return { ...def };
    return { ...def, vendu: saved.vendu ?? saved.montant ?? 0, depenses: saved.depenses || [] };
  });
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
  _updateInstallWdBadge();

  const title = 'WMS Planning — ' + (m.name || 'Sans titre');
  setWindowTitle(title); document.title = title;
  _applyTabConfig();
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
  _updateInstallWdBadge();
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
  renderDashboard();
}

// ═══ INSTALL DRIFT ═══
function _updateInstallWdBadge() {
  const badge = document.getElementById('install-wd-badge');
  if (!badge) return;
  const m = projectMeta;
  const activeDate = m.installDateActual || m.installDateDelayed || m.installDateOriginal;
  const wd = workingDaysLeft(activeDate);
  if (wd !== null) {
    badge.textContent = `🗓 ${wd} jour${wd > 1 ? 's' : ''} ouvré${wd > 1 ? 's' : ''} restant${wd > 1 ? 's' : ''}`;
    badge.style.color = wd <= 30 ? '#dc2626' : wd <= 60 ? '#d97706' : '#059669';
  } else if (activeDate) {
    badge.textContent = 'Date d\'installation dépassée';
    badge.style.color = '#dc2626';
  } else {
    badge.textContent = '';
  }
}
function workingDaysLeft(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr); target.setHours(0,0,0,0);
  const y = target.getFullYear();
  if (y < 2000 || y > 2100) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  if (target < today) return null;
  let count = 0;
  const d = new Date(today);
  while (d <= target) { const day = d.getDay(); if (day !== 0 && day !== 6) count++; d.setDate(d.getDate()+1); }
  return count;
}
function renderInstallDrift() {
  const block = document.getElementById('install-drift-block');
  if (!block) return;
  if (!isChartVisible('drift')) { block.style.display = 'none'; return; }
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
  const activeDate = m.installDateActual || m.installDateDelayed || orig;
  const wdLeft = workingDaysLeft(activeDate);
  if (wdLeft !== null) html += `<div class="drift-comment" style="font-weight:600">🗓 ${wdLeft} jour${wdLeft > 1 ? 's' : ''} ouvré${wdLeft > 1 ? 's' : ''} restant${wdLeft > 1 ? 's' : ''}</div>`;
  else if (activeDate) html += `<div class="drift-comment" style="color:var(--danger)">Date d'installation dépassée</div>`;
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
function getCompanyLabel()  { return _companyName; }
function getClientLabel()   { return document.getElementById('pi-client')?.value    || TOKEN_CLIENT; }
function getPMLabel()       { return document.getElementById('pi-pm')?.value        || TOKEN_PM; }
function getCDPLabel()      { return document.getElementById('pi-cdptech')?.value   || TOKEN_CDP; }
function getRLLabel()       { return document.getElementById('pi-resplog')?.value   || TOKEN_RL; }
function getERPLabel()      { return document.getElementById('pi-erpconsult')?.value || TOKEN_ERP; }

function formatTemplate(text) {
  return String(text)
    .replaceAll(TOKEN_CLIENT, getClientLabel())
    .replaceAll(TOKEN_CDP,    getCDPLabel())
    .replaceAll(TOKEN_PM,     getPMLabel())
    .replaceAll(TOKEN_RL,     getRLLabel())
    .replaceAll(TOKEN_ERP,    getERPLabel());
}
function formatOwner(owner) {
  if (owner === 'COMPANY')    return getCompanyLabel();
  if (owner === TOKEN_CLIENT) return getClientLabel();
  if (owner === TOKEN_PM)     return getPMLabel();
  if (owner === TOKEN_CDP)    return getCDPLabel();
  if (owner === TOKEN_RL)     return getRLLabel();
  return owner || '';
}
function getOwnerOptions() {
  return [
    { value: '',           label: '—' },
    { value: TOKEN_CLIENT, label: () => getClientLabel() },
    { value: 'COMPANY',    label: () => getCompanyLabel() },
    ..._ownerOptions.map(v => ({ value: v, label: v })),
  ];
}
function buildOwnerSelect(sel, currentValue) {
  sel.innerHTML = getOwnerOptions().map(o => {
    const lbl = typeof o.label === 'function' ? o.label() : o.label;
    const selected = o.value === (currentValue || '') ? ' selected' : '';
    return `<option value="${o.value}"${selected}>${lbl}</option>`;
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
  const sane = d => d.getFullYear() >= 2000 && d.getFullYear() <= 2100;
  let minD = startEl ? new Date(startEl) : new Date('2026-03-01');
  let maxD = endEl ? new Date(endEl) : new Date('2026-12-31');
  if (!sane(minD)) minD = new Date('2026-01-01');
  if (!sane(maxD)) maxD = new Date('2026-12-31');
  tasks.forEach(t => { if (t.start) { const d = new Date(t.start); if (sane(d) && d < minD) minD = d; } if (t.end) { const d = new Date(t.end); if (sane(d) && d > maxD) maxD = d; } });
  minD.setDate(minD.getDate() - 14); maxD.setDate(maxD.getDate() + 14);
  return { start: mondayOf(minD), end: mondayOf(maxD) };
}
function generateWeeks() {
  const { start, end } = getGanttBounds(); const w = [], c = new Date(start);
  while (c <= end && w.length < 520) { w.push(new Date(c)); c.setDate(c.getDate() + 7); } return w;
}
function weekLabel(d) { return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0'); }
function fmtDateShort(d) { return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}); }
function fmtDDMMYY(iso) { const [y,m,d] = iso.split('-'); return `${d}/${m}/${y.slice(2)}`; }
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
  _populateSegments(taskSegments(task));
  document.getElementById('task-status').value = task.status || '';
  document.getElementById('task-priority').value = task.priority || '';
  document.getElementById('task-progress').value = task.progress || 0;
  document.getElementById('task-deliverable').value = task.deliverable || '';
  document.getElementById('task-unavail').checked = !!task.isUnavail;
  _buildDepsSelect(taskId, task.deps || []);
  document.getElementById('btn-delete-task').style.display = '';
  document.getElementById('modal-task').classList.add('open');
}

function easterDate(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
function getFrenchHolidays(year) {
  const iso = d => d.toISOString().slice(0, 10);
  const off = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const e = easterDate(year);
  return new Map([
    [`${year}-01-01`, 'Jour de l\'An'],
    [iso(off(e, 1)), 'Lundi de Pâques'],
    [`${year}-05-01`, 'Fête du Travail'],
    [`${year}-05-08`, 'Victoire 1945'],
    [iso(off(e, 39)), 'Ascension'],
    [iso(off(e, 50)), 'Lundi de Pentecôte'],
    [`${year}-07-14`, 'Fête Nationale'],
    [`${year}-08-15`, 'Assomption'],
    [`${year}-11-01`, 'Toussaint'],
    [`${year}-11-11`, 'Armistice'],
    [`${year}-12-25`, 'Noël'],
  ]);
}

function renderGantt() {
  const WEEKS = generateWeeks();
  const _hMap = new Map();
  new Set(WEEKS.map(w => w.getFullYear())).forEach(y => getFrenchHolidays(y).forEach((name, iso) => _hMap.set(iso, name)));
  const WEEK_HOLIDAYS = WEEKS.map(w => {
    const names = [];
    for (let i = 0; i <= 4; i++) { const d = new Date(w); d.setDate(d.getDate() + i); const k = d.toISOString().slice(0, 10); if (_hMap.has(k)) names.push(_hMap.get(k)); }
    return names;
  });
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
  WEEKS.forEach((w, wi) => { const th = document.createElement('th'); th.className = 'th-week col-week'; th.textContent = weekLabel(w); if (isToday(w)) th.style.borderLeft = '2px solid #f97316'; if (WEEK_HOLIDAYS[wi].length) { th.classList.add('holiday-week'); th.title = WEEK_HOLIDAYS[wi].join(', '); } r2.appendChild(th); });

  phases.forEach(phase => {
    const phaseTasks = tasks.filter(t => t.phaseId === phase.id);
    const isCollapsed = _collapsedPhases.has(phase.id);
    const rp = table.insertRow(); rp.className = 'tr-phase'; rp.dataset.phaseId = phase.id;
    const tdPh = document.createElement('td'); tdPh.colSpan = fixedCount; tdPh.style.background = phase.color;
    const phStarts = phaseTasks.map(t => t.start).filter(Boolean).map(d => new Date(d).getTime());
    const phEnds   = phaseTasks.map(t => t.end).filter(Boolean).map(d => new Date(d).getTime());
    const phDurStr = phStarts.length && phEnds.length ? ` <span style="opacity:.75;font-size:10px;font-weight:400">(${Math.round((Math.max(...phEnds) - Math.min(...phStarts)) / 86400000) + 1}j)</span>` : '';
    const collapseBtn = `<button data-phase-id="${phase.id}" onclick="togglePhaseCollapse('${phase.id}')" title="${isCollapsed ? 'Développer la phase' : 'Réduire la phase'}" style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:4px;padding:1px 7px;cursor:pointer;font-size:11px;font-family:inherit;line-height:1.4">${isCollapsed ? '▶' : '▼'}</button>`;
    if (_ganttEditMode) {
      tdPh.innerHTML = `<span class="drag-handle gantt-drag-handle" style="color:rgba(255,255,255,.85);margin-right:8px;font-size:15px;vertical-align:middle">⠿</span>${phase.name}${phDurStr}`;
    } else {
      tdPh.innerHTML = `${collapseBtn}<span style="cursor:pointer;margin-left:6px" title="Modifier la phase" onclick="openEditPhase('${phase.id}')">${phase.name}${phDurStr}</span>
        <span style="float:right;display:flex;gap:6px;align-items:center">
          <button onclick="openAddTaskModal('${phase.id}')" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:10px;font-family:inherit">+ Tâche</button>
        </span>`;
    }
    rp.appendChild(tdPh);
    WEEKS.forEach(w => { const td = document.createElement('td'); td.className = 'gantt-cell'; td.style.background = phase.color; td.style.opacity = '.2'; if (isToday(w)) td.style.borderLeft = '2px solid #f97316'; rp.appendChild(td); });

    if (isCollapsed) return;

    if (phaseTasks.length === 0) {
      const re = table.insertRow(); re.className = 'tr-task';
      visFC.forEach(([lbl,cls]) => { const td = document.createElement('td'); td.className = cls; if (lbl === 'INTITULÉ') { td.style.padding = '4px 8px'; td.style.color = 'var(--text-muted)'; td.style.fontStyle = 'italic'; td.textContent = 'Aucune tâche — cliquer "+ Tâche" pour en ajouter'; } re.appendChild(td); });
      WEEKS.forEach((w, wi) => { const td = document.createElement('td'); td.className = 'gantt-cell'; if (isToday(w)) td.classList.add('today-col'); if (WEEK_HOLIDAYS[wi].length) td.classList.add('holiday-col'); re.appendChild(td); });
      return;
    }

    phaseTasks.forEach(task => {
      const depViolation = (task.deps||[]).some(dId => {
        const dep = tasks.find(x => x.id === dId); if (!dep) return false;
        const depSegs = taskSegments(dep);
        const depEnd = depSegs.length ? depSegs[depSegs.length-1].end : null;
        return depEnd && task.start && depEnd > task.start;
      });
      const rt = table.insertRow(); rt.className = task.isUnavail ? 'tr-unavail' : 'tr-task'; rt.dataset.taskId = task.id;
      if (depViolation) rt.style.outline = '2px solid #f97316';
      const done = task.progress >= 100;

      fixedCols.forEach(([lbl,cls,vis]) => {
        if (!vis) return;
        const td = document.createElement('td'); td.className = cls;

        if (lbl === 'STATUT') {
          if (_ganttEditMode) {
            td.innerHTML = `<span class="drag-handle gantt-drag-handle" title="Déplacer la tâche" style="display:block;text-align:center">⠿</span>`;
          } else if (!task.isUnavail) {
            td.className += ' status-cell'; td.innerHTML = statusBadgeHTML(task.status); td.style.cursor = 'pointer';
            td.addEventListener('click', e => { e.stopPropagation(); showDropdown(td.querySelector('.badge'), STATUS_OPTS, val => { updateTask(task.id,'status',val); renderGantt(); renderDashboard(); }); });
          }
        } else if (lbl === 'PRIORITÉ') {
          if (!task.isUnavail) { td.style.padding = '2px 6px'; td.innerHTML = prioHTML(task.priority); td.style.cursor = 'pointer';
          td.addEventListener('click', e => { e.stopPropagation(); showDropdown(td.querySelector('span'), PRIO_OPTS, val => { updateTask(task.id,'priority',val); renderGantt(); }); }); }
        } else if (lbl === 'INTITULÉ') {
          td.contentEditable = true; td.textContent = formatTemplate(task.name); td.style.padding = '2px 6px'; td.style.fontWeight = task.isUnavail ? '400' : '500';
          if (task.deps && task.deps.length) { const ic = document.createElement('span'); ic.textContent = ' 🔗'; ic.contentEditable = 'false'; ic.style.cssText = 'font-size:10px;opacity:.6'; td.appendChild(ic); }
          if (done) { td.style.textDecoration = 'line-through'; td.style.color = 'var(--text-muted)'; }
          td.onblur = e => { updateTask(task.id,'name',e.target.textContent.trim()); debouncedSave(); };
        } else if (lbl === 'PROPRIÉTAIRE') {
          const ownSel = document.createElement('select');
          ownSel.className = 'gantt-select'; ownSel.style.cssText = 'width:100%';
          buildOwnerSelect(ownSel, task.owner);
          ownSel.onchange = () => { updateTask(task.id,'owner',ownSel.value); debouncedSave(); };
          td.style.padding = '2px 4px'; td.appendChild(ownSel);
        } else if (lbl === 'DÉBUT' || lbl === 'FIN') {
          const segs = taskSegments(task);
          if (segs.length > 1) {
            td.style.cssText = 'padding:2px 6px;cursor:pointer;text-align:center';
            const label = lbl === 'DÉBUT'
              ? `<span class="seg-multi-chip">${segs.length}×</span> ${segs[0].start ? fmtDateShort(new Date(segs[0].start)) : '—'}`
              : (segs[segs.length-1].end ? fmtDateShort(new Date(segs[segs.length-1].end)) : '—');
            td.innerHTML = label;
            td.title = segs.map(s => `${s.start||'?'} → ${s.end||'?'}`).join('\n');
            td.onclick = () => openEditTask(task.id);
          } else {
            const field = lbl === 'DÉBUT' ? 'start' : 'end';
            const inp = document.createElement('input'); inp.type = 'date'; inp.value = task[field] || '';
            inp.style.cssText = 'border:none;background:transparent;font-family:inherit;font-size:11px;color:inherit;width:100%;cursor:pointer;padding:1px 3px;';
            inp.onchange = e => { updateTask(task.id,field,e.target.value); renderGantt(); debouncedSave(); };
            td.appendChild(inp);
          }
        } else if (lbl === 'J') {
          if (!task.isUnavail) {
            td.style.textAlign = 'center'; td.style.fontSize = '11px';
            const segs = taskSegments(task);
            const total = segs.reduce((sum, s) => {
              if (!s.start || !s.end) return sum;
              const d = Math.round((new Date(s.end) - new Date(s.start)) / 86400000) + 1;
              return sum + (d > 0 ? d : 0);
            }, 0);
            if (total > 0) td.textContent = total;
          }
        } else if (lbl === '% AVA.') {
          if (!task.isUnavail) {
            td.style.padding = '2px 6px'; td.style.cursor = 'pointer';
            const pct = task.progress || 0; const color = getPhaseColor(task);
            td.innerHTML = `<div class="progress-wrap"><div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div><span class="progress-pct">${pct}%</span></div>`;
            td.onclick = () => { const v = prompt("% d'avancement :", pct); if (v !== null && !isNaN(+v)) { const newPct = Math.min(100,Math.max(0,+v)); updateTask(task.id,'progress',newPct); if (newPct === 100) { updateTask(task.id,'status','Terminé'); } else if (newPct > 0 && (task.status === '' || task.status === 'Non commencé' || task.status === 'Terminé')) { updateTask(task.id,'status','En cours'); } renderGantt(); renderDashboard(); debouncedSave(); } };
          }
        } else if (lbl === '') {
          td.style.padding = '1px 4px'; td.style.textAlign = 'center'; td.style.whiteSpace = 'nowrap';
          td.innerHTML = `<button title="Modifier" onclick="openEditTask('${task.id}')" style="background:var(--accent-light);border:none;color:var(--accent);border-radius:4px;padding:2px 7px;cursor:pointer;font-size:10px;font-family:inherit">✏</button>`;
        }
        rt.appendChild(td);
      });

      const phColor = getPhaseColor(task);
      const taskSegs = taskSegments(task);
      const phase = phases.find(p => p.id === task.phaseId);
      const segDesc = taskSegs.map(s =>
        (s.start ? fmtDateShort(new Date(s.start)) : '?') + ' → ' + (s.end ? fmtDateShort(new Date(s.end)) : '?')
      ).join(' | ');
      const tooltipLines = [formatTemplate(task.name), phase ? phase.name : '', segDesc, task.progress ? `${task.progress}%` : ''].filter(Boolean).join('\n');
      WEEKS.forEach((w, wi) => {
        const td = document.createElement('td'); td.className = 'gantt-cell';
        if (isToday(w)) td.classList.add('today-col');
        if (WEEK_HOLIDAYS[wi].length) td.classList.add('holiday-col');
        if (taskSegs.some(s => isInWeek(s.start, s.end, w))) {
          const bar = document.createElement('span'); bar.className = 'gantt-bar'; bar.style.background = phColor;
          if (done) bar.classList.add('gantt-bar-done');
          td.appendChild(bar);
          td.title = tooltipLines;
        }
        rt.appendChild(td);
      });
    });
  });
  // ── JIRA phase ──
  if (jiraData.tasks.length > 0) {
    const JIRA_COLOR = '#0052CC';
    const jiraCollapsed = _collapsedPhases.has('__jira__');
    const rpJ = table.insertRow(); rpJ.className = 'tr-phase jira-main-row';
    const tdPhJ = document.createElement('td'); tdPhJ.colSpan = fixedCount; tdPhJ.style.background = JIRA_COLOR;
    const jiraCollapseBtn = `<button data-phase-id="__jira__" onclick="togglePhaseCollapse('__jira__')" title="${jiraCollapsed ? 'Développer' : 'Réduire'}" style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:4px;padding:1px 7px;cursor:pointer;font-size:11px;font-family:inherit;line-height:1.4">${jiraCollapsed ? '▶' : '▼'}</button>`;
    tdPhJ.innerHTML = `${jiraCollapseBtn}<span style="font-weight:700;letter-spacing:.5px;margin-left:6px">◈ JIRA</span>
      <span style="opacity:.7;font-size:10px;margin-left:8px">${jiraData.tasks.length} tâches · ${jiraData.epics.length} epics</span>
      <span style="float:right"><button onclick="syncJira()" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:10px;font-family:inherit">⟳ Sync</button></span>`;
    rpJ.appendChild(tdPhJ);
    WEEKS.forEach(w => { const td = document.createElement('td'); td.className = 'gantt-cell'; td.style.background = JIRA_COLOR; td.style.opacity = '.2'; if (isToday(w)) td.style.borderLeft = '2px solid #f97316'; rpJ.appendChild(td); });

    if (!jiraCollapsed) {
      jiraData.epics.forEach(epic => {
        const epicTasks = jiraData.tasks.filter(t => t.epicId === epic.id);
        if (!epicTasks.length) return;
        const epicCollapsed = _collapsedPhases.has('__epic_' + epic.id);
        // Epic sub-header
        const repic = table.insertRow(); repic.className = 'tr-phase'; repic.dataset.jiraEpicId = epic.id;
        const tdEpic = document.createElement('td'); tdEpic.colSpan = fixedCount;
        tdEpic.style.cssText = `background:${epic.color}18;border-left:3px solid ${epic.color};padding-left:8px;font-size:11px`;
        const epicCollapseBtn = `<button onclick="togglePhaseCollapse('__epic_${epic.id}')" title="${epicCollapsed ? 'Développer' : 'Réduire'}" style="background:rgba(0,0,0,.08);border:none;color:${epic.color};border-radius:4px;padding:1px 7px;cursor:pointer;font-size:11px;font-family:inherit;line-height:1.4;margin-right:4px">${epicCollapsed ? '▶' : '▼'}</button>`;
        if (_ganttEditMode) {
          tdEpic.innerHTML = `<span class="drag-handle gantt-drag-handle" style="color:${epic.color};margin-right:6px;font-size:13px;vertical-align:middle">⠿</span><span style="font-weight:700;color:${epic.color};font-family:monospace;margin-right:6px">${epic.key}</span>${epic.summary}`;
        } else {
          tdEpic.innerHTML = `${epicCollapseBtn}<span style="font-weight:700;color:${epic.color};font-family:monospace;margin-right:6px">${epic.key}</span>${epic.summary}`;
        }
        repic.appendChild(tdEpic);
        WEEKS.forEach((w, wi) => { const td = document.createElement('td'); td.className = 'gantt-cell'; if (isToday(w)) td.classList.add('today-col'); if (WEEK_HOLIDAYS[wi].length) td.classList.add('holiday-col'); repic.appendChild(td); });

        if (!epicCollapsed) {
          epicTasks.forEach(jTask => {
            const rt = table.insertRow(); rt.className = 'tr-task'; rt.dataset.jiraTaskId = jTask.id;
            visFC.forEach(([lbl, cls]) => {
              const td = document.createElement('td'); td.className = cls;
              if (lbl === 'STATUT') {
                if (_ganttEditMode) {
                  td.innerHTML = `<span class="drag-handle gantt-drag-handle" title="Déplacer la tâche" style="display:block;text-align:center">⠿</span>`;
                } else {
                  td.className += ' status-cell';
                  td.innerHTML = `<span class="badge badge-${jiraStatusBadgeClass(jTask.status)}">${jiraStatusLabel(jTask.status)}</span>`;
                }
              } else if (lbl === 'PRIORITÉ') {
                td.style.cssText = 'text-align:center;font-size:10px;color:var(--text-muted)';
                td.textContent = jTask.storyPoints ? jTask.storyPoints + ' pts' : '—';
              } else if (lbl === 'INTITULÉ') {
                td.style.cssText = 'padding:2px 6px;font-size:11.5px';
                td.innerHTML = `<span style="font-size:10px;font-weight:700;color:#0052CC;background:#EAF0FF;padding:1px 4px;border-radius:2px;margin-right:5px;font-family:monospace">${jTask.key}</span>${jTask.summary}`;
              } else if (lbl === 'PROPRIÉTAIRE') {
                td.style.cssText = 'padding:2px 4px;font-size:11px'; td.textContent = jTask.assignee || '—';
              } else if (lbl === 'DÉBUT') {
                td.style.fontSize = '11px'; td.textContent = jTask.startDate ? fmtDDMMYY(jTask.startDate) : '—';
              } else if (lbl === 'FIN') {
                td.style.fontSize = '11px'; td.textContent = jTask.dueDate ? fmtDDMMYY(jTask.dueDate) : '—';
              } else if (lbl === 'J') {
                td.style.cssText = 'text-align:center;font-size:11px';
                if (jTask.startDate && jTask.dueDate) { const d = Math.round((new Date(jTask.dueDate) - new Date(jTask.startDate)) / 86400000) + 1; if (d > 0) td.textContent = d; }
              } else if (lbl === '% AVA.') {
                const pct = jTask.progress || 0; td.style.padding = '2px 6px';
                td.innerHTML = `<div class="progress-wrap"><div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${epic.color}"></div></div><span class="progress-pct">${pct}%</span></div>`;
              }
              rt.appendChild(td);
            });
            WEEKS.forEach((w, wi) => {
              const td = document.createElement('td'); td.className = 'gantt-cell';
              if (isToday(w)) td.classList.add('today-col');
              if (WEEK_HOLIDAYS[wi].length) td.classList.add('holiday-col');
              if (jTask.startDate && jTask.dueDate && isInWeek(jTask.startDate, jTask.dueDate, w)) {
                const bar = document.createElement('span'); bar.className = 'gantt-bar'; bar.style.background = epic.color;
                if ((jTask.progress || 0) >= 100) bar.classList.add('gantt-bar-done');
                td.appendChild(bar);
                td.title = `${jTask.key}: ${jTask.summary}\n${jiraStatusLabel(jTask.status)}\n${jTask.startDate} → ${jTask.dueDate}\n${jTask.progress || 0}%`;
              }
              rt.appendChild(td);
            });
          });
        }
      });
    }
  }

  if (_ganttEditMode) {
    const tbody = table.tBodies[0];
    if (tbody) initGanttSort(tbody);
  }

  makeGanttResizable(table);
}

function makeGanttResizable(table) {
  const STORAGE_KEY = 'col-w:gantt';
  const ths = Array.from(table.querySelectorAll('th.th-fixed'));
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    ths.forEach((th, i) => { if (saved[i]) { th.style.width = saved[i] + 'px'; th.style.minWidth = saved[i] + 'px'; } });
  } catch {}
  ths.forEach((th, i) => {
    th.style.position = 'relative';
    const handle = document.createElement('div');
    handle.className = 'col-resize-handle';
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
    });
  });
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

function togglePhaseCollapse(phaseId) {
  if (_collapsedPhases.has(phaseId)) _collapsedPhases.delete(phaseId);
  else _collapsedPhases.add(phaseId);
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
      if (evt.related.classList.contains('gantt-hrow')) return false;
      const draggingJira = !!(evt.dragged.dataset.jiraEpicId || evt.dragged.dataset.jiraTaskId);
      const targetIsJira  = !!(evt.related.dataset.jiraEpicId || evt.related.dataset.jiraTaskId)
                              || evt.related.classList.contains('jira-main-row');
      if (draggingJira && !targetIsJira) return false;
      if (!draggingJira && targetIsJira) return false;
      return true;
    },
    onEnd({ item }) {
      const rows = Array.from(tbody.rows);
      if (item.dataset.jiraEpicId) {
        // JIRA epic reordered within the JIRA section
        const newOrder = rows
          .filter(r => r.dataset.jiraEpicId)
          .map(r => jiraData.epics.find(e => e.id === r.dataset.jiraEpicId))
          .filter(Boolean);
        jiraData.epics = newOrder;
      } else if (item.dataset.jiraTaskId) {
        // JIRA task reordered: rebuild epicId from nearest epic row above
        let curEpicId = null;
        const taskAssign = [];
        rows.forEach(tr => {
          if (tr.dataset.jiraEpicId) curEpicId = tr.dataset.jiraEpicId;
          else if (tr.dataset.jiraTaskId) taskAssign.push({ id: tr.dataset.jiraTaskId, epicId: curEpicId });
        });
        taskAssign.forEach(({ id, epicId }) => {
          const t = jiraData.tasks.find(t => t.id === id); if (t && epicId) t.epicId = epicId;
        });
        jiraData.tasks.sort((a, b) => {
          const ia = taskAssign.findIndex(x => x.id === a.id);
          const ib = taskAssign.findIndex(x => x.id === b.id);
          return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
        });
      } else if (item.classList.contains('tr-phase')) {
        // Regular phase moved: reorder phases[], tasks keep their phaseId
        const newOrder = rows
          .filter(r => r.classList.contains('tr-phase') && r.dataset.phaseId)
          .map(r => phases.find(p => p.id === r.dataset.phaseId))
          .filter(Boolean);
        phases = newOrder;
      } else if (item.dataset.taskId) {
        // Regular task moved: rebuild phaseId assignments + task order from DOM
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
    startDate: iss.fields.startdate || '',
    dueDate: iss.fields.duedate || '',
    progress: iss.fields.progress?.percent || 0
  }));
  return { epics, tasks, lastSync: '' };
}
async function syncJira() {
  const cfg = _userSettings.jiraConfig;
  const projectKey = projectMeta.jiraProjectKey;
  if (!cfg?.token || !cfg?.url || !projectKey) {
    const info = document.getElementById('jira-sync-info');
    if (!cfg?.url || !cfg?.token) {
      if (info) info.textContent = 'Configurez vos identifiants JIRA dans les Paramètres de l\'application (écran d\'accueil).';
    } else {
      if (info) info.textContent = 'Clé de projet JIRA manquante — configurez-la dans ⚙ Paramètres du projet.';
      openProjectSettings();
    }
    return;
  }
  const syncBtn = document.getElementById('jira-sync-btn');
  if (syncBtn) { syncBtn.disabled = true; syncBtn.textContent = '⟳ Synchro…'; }
  try {
    const jiraUrl = `${cfg.url}/rest/api/3/search/jql`;
    const [erText, trText] = await Promise.all([
      invoke('jira_fetch', { url: jiraUrl, email: cfg.email, token: cfg.token, body: JSON.stringify({ jql: `project=${projectKey} AND issuetype=Epic`, fields: ['summary', 'status'], maxResults: 50 }) }),
      invoke('jira_fetch', { url: jiraUrl, email: cfg.email, token: cfg.token, body: JSON.stringify({ jql: `project=${projectKey} AND issuetype in (Story,Task,Bug)`, fields: ['summary', 'status', 'assignee', 'customfield_10016', 'duedate', 'startdate', 'parent', 'progress'], maxResults: 100 }) })
    ]);
    jiraData = transformJiraIssues(JSON.parse(erText), JSON.parse(trText));
    jiraData.lastSync = new Date().toLocaleString('fr-FR');
    renderJira(); renderGantt(); debouncedSave();
    document.getElementById('jira-sync-info').textContent = `Dernière synchro : ${jiraData.lastSync} — ${jiraData.tasks.length} tâches importées`;
  } catch (e) {
    console.error('JIRA sync:', e);
    const info = document.getElementById('jira-sync-info');
    if (info) info.textContent = 'Erreur : ' + (e.message ?? e);
  } finally {
    if (syncBtn) { syncBtn.disabled = false; syncBtn.textContent = '⟳ Synchroniser'; }
  }
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
        <div class="jira-tasks-header"><span>Clé</span><span>Intitulé</span><span>Statut</span><span>Responsable</span><span>Pts</span><span>Début</span><span>Échéance</span><span>J</span><span>Avancement</span></div>
        ${epicTasks.map(t => {
          const days = (t.startDate && t.dueDate) ? Math.round((new Date(t.dueDate) - new Date(t.startDate)) / 86400000) + 1 : null;
          return `<div class="jira-task-row">
          <span class="jira-task-key">${t.key}</span>
          <span class="jira-task-summary">${t.summary}</span>
          <span class="badge badge-${jiraStatusBadgeClass(t.status)}" style="font-size:10px">${jiraStatusLabel(t.status)}</span>
          <span style="font-size:12px;color:var(--text-muted)">${t.assignee ? formatTemplate(t.assignee) : '—'}</span>
          <span style="font-size:12px;text-align:center">${t.storyPoints ? t.storyPoints + ' pts' : '—'}</span>
          <span style="font-size:12px;color:var(--text-muted)">${t.startDate ? fmtDDMMYY(t.startDate) : '—'}</span>
          <span style="font-size:12px;color:var(--text-muted)">${t.dueDate ? fmtDDMMYY(t.dueDate) : '—'}</span>
          <span style="font-size:12px;text-align:center;color:var(--text-muted)">${days && days > 0 ? days : '—'}</span>
          <div class="progress-wrap"><div class="progress-bar"><div class="progress-fill" style="width:${t.progress||0}%;background:${epic.color}"></div></div><span class="progress-pct">${t.progress||0}%</span></div>
        </div>`;}).join('')}
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

// ── Multi-segment helpers ──
function taskSegments(task) {
  if (task.segments && task.segments.length > 0) return task.segments;
  if (task.start || task.end) return [{ start: task.start || '', end: task.end || '' }];
  return [{ start: '', end: '' }];
}

function _addSegRow(list, start = '', end = '') {
  const div = document.createElement('div');
  div.className = 'task-seg-row';
  div.innerHTML = `<div class="form-2col" style="align-items:flex-end;gap:6px">
    <div class="form-row"><label>Début</label><input type="date" class="seg-start" value="${start}"></div>
    <div class="form-row"><label>Fin</label><input type="date" class="seg-end" value="${end}"></div>
    <button type="button" class="btn btn-ghost btn-icon btn-sm btn-danger-ghost seg-del" onclick="removeTaskSegment(this)" title="Supprimer cette période" style="margin-bottom:2px">🗑</button>
  </div>`;
  list.appendChild(div);
}

function _syncSegDelBtns() {
  const rows = Array.from(document.querySelectorAll('#task-segments-list .task-seg-row'));
  rows.forEach(r => { r.querySelector('.seg-del').style.visibility = rows.length > 1 ? 'visible' : 'hidden'; });
}

function _populateSegments(segs) {
  const list = document.getElementById('task-segments-list');
  list.innerHTML = '';
  const src = segs.length ? segs : [{ start: '', end: '' }];
  src.forEach(s => _addSegRow(list, s.start || '', s.end || ''));
  _syncSegDelBtns();
}

function addTaskSegment() {
  _addSegRow(document.getElementById('task-segments-list'));
  _syncSegDelBtns();
}

function removeTaskSegment(btn) {
  btn.closest('.task-seg-row').remove();
  _syncSegDelBtns();
}

function openAddTaskModal(phaseId) {
  _editingTaskId = null;
  document.getElementById('modal-task-title').textContent = 'Nouvelle Tâche';
  document.getElementById('btn-save-task').textContent = 'Enregistrer';
  const sel = document.getElementById('task-phase'); sel.innerHTML = '';
  phases.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name; if (p.id === phaseId) o.selected = true; sel.appendChild(o); });
  document.getElementById('task-name').value = '';
  document.getElementById('task-deliverable').value = '';
  buildOwnerSelect(document.getElementById('task-owner'), '');
  _populateSegments([]);
  document.getElementById('task-progress').value = 0;
  document.getElementById('task-status').value = 'Non commencé';
  document.getElementById('task-priority').value = '';
  const _isIndispo = phaseId === 'INDISPO' || (phases.find(p => p.id === phaseId)?.name || '').toLowerCase().includes('indisponib');
  document.getElementById('task-unavail').checked = _isIndispo;
  _buildDepsSelect(null, []);
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
  const segs = Array.from(document.querySelectorAll('#task-segments-list .task-seg-row'))
    .map(r => ({ start: r.querySelector('.seg-start').value, end: r.querySelector('.seg-end').value }))
    .filter(s => s.start || s.end);
  const start = segs[0]?.start || '';
  const end = (segs[segs.length - 1]?.end) || segs[0]?.end || '';
  const data = {
    phaseId: document.getElementById('task-phase').value, name,
    owner: document.getElementById('task-owner').value,
    start, end,
    segments: segs.length > 1 ? segs : undefined,
    status: document.getElementById('task-status').value,
    priority: document.getElementById('task-priority').value,
    progress: +document.getElementById('task-progress').value || 0,
    deliverable: document.getElementById('task-deliverable').value.trim(),
    isUnavail: document.getElementById('task-unavail').checked || undefined,
    deps: _readDepsSelect().length ? _readDepsSelect() : undefined
  };
  if (_editingTaskId) {
    const t = tasks.find(t => t.id === _editingTaskId);
    Object.assign(t, data);
    if (!data.segments) delete t.segments;
    if (!data.isUnavail) delete t.isUnavail;
    if (!data.deps) delete t.deps;
  } else {
    tasks.push({ id: uid(), ...data });
  }
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
    pdf.setFont('helvetica','normal'); pdf.setFontSize(9); pdf.text(`Client: ${cli}  |  Directeur de Projet: ${pm}  |  ${today}`, pageW-m-4, m+6.5, {align:'right'});
    pdf.addImage(imgData,'PNG',m,m+12,dw,dh);
    pdf.setFontSize(8); pdf.setTextColor(150,150,150); pdf.text(`Document confidentiel — ${proj}`, m, pageH-4); pdf.text('Page 1', pageW-m, pageH-4, {align:'right'});
    const fileName = `Planning_${proj.replace(/\s+/g,'_')}_${today.replace(/\//g,'-')}.pdf`;
    const savePath = await invoke('save_pdf_dialog', { name: fileName });
    if (!savePath) { btn.innerHTML = orig; btn.disabled = false; return; }
    const arrayBuf = pdf.output('arraybuffer');
    await invoke('write_file_bytes', { path: savePath, bytes: Array.from(new Uint8Array(arrayBuf)) });
  } catch (e) { console.error(e); alert('Erreur PDF : ' + e); }
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
    const fileName = `${tabName.replace(/\s+/g,'_')}_${proj.replace(/\s+/g,'_')}_${today.replace(/\//g,'-')}.pdf`;
    const savePath = await invoke('save_pdf_dialog', { name: fileName });
    if (!savePath) { if (btn) { btn.innerHTML = orig; btn.disabled = false; } return; }
    const arrayBuf = pdf.output('arraybuffer');
    await invoke('write_file_bytes', { path: savePath, bytes: Array.from(new Uint8Array(arrayBuf)) });
  } catch (e) { console.error(e); alert('Erreur PDF : ' + e); }
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
  renderDeplRow(document.getElementById('tbody-deplacements'));
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
const ITF_TYPES = ['Connecteur ERP','GNA','Connecteur SAGE','REST API','Autre'];

let _editingInterfaceId = null;
function openEditInterface(id) {
  _editingInterfaceId = id;
  const r = interfacesData.find(r => r.id === id); if (!r) return;
  document.getElementById('ei-name').value       = r.name || '';
  document.getElementById('ei-type').value       = r.type || 'Connecteur ERP';
  document.getElementById('ei-dev').value        = r.dev || 'NON';
  document.getElementById('ei-preprod').value    = r.preprod || 'NON';
  document.getElementById('ei-recCompany').value = r.recCompany || 'NON';
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
  r.recCompany = document.getElementById('ei-recCompany').value;
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

function cellBadge(map, v) { return `<span class="${map[v]||'cell-none'}" style="cursor:pointer">${v}</span>`; }
function renderInterfaces() {
  const tbody = document.getElementById('tbody-interfaces'); tbody.innerHTML = '';
  const cn = _companyName || 'Intégrateur';
  ['th-rec-company','lbl-rec-company'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = 'Recette ' + cn; });
  interfacesData.forEach(row => {
    const tr = tbody.insertRow(); tr.dataset.rowId = row.id;
    tr.innerHTML = `<td>${dh()}</td>
      <td style="font-size:12px"><span class="cell-type" style="cursor:pointer">${row.type || 'Connecteur ERP'}</span></td>
      <td style="font-weight:500">${row.name}</td>
      <td>${cellBadge(ITF_B,row.dev)}</td><td>${cellBadge(ITF_B,row.preprod)}</td><td>${cellBadge(ITF_B,row.recCompany)}</td><td>${cellBadge(ITF_B,row.recClient)}</td><td>${cellBadge(ITF_B,row.valide)}</td>
      <td style="color:var(--text-muted);font-size:12px">${row.comment}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="openEditInterface('${row.id}')">✏</button></td>`;
    const typeSp = tr.cells[1].querySelector('span');
    typeSp.addEventListener('click', e => { e.stopPropagation(); showDropdown(typeSp, ITF_TYPES.map(v => ({label:v,value:v,dot:'#94a3b8'})), val => { row.type = val; typeSp.textContent = val; debouncedSave(); }); });
    ['dev','preprod','recCompany','recClient','valide'].forEach((f,fi) => {
      const sp = tr.cells[fi+3].querySelector('span');
      sp.addEventListener('click', e => { e.stopPropagation(); showDropdown(sp, ITF_STATES.map(v => ({label:v,value:v,dot:ITF_D[v]})), val => { row[f] = val; sp.className = ITF_B[val]||'cell-none'; sp.textContent = val; renderDashboard(); debouncedSave(); }); });
    });
  });
  makeSortable(tbody, interfacesData, renderInterfaces);
}
function addInterface() { interfacesData.push({id:uid(),type:'Connecteur ERP',name:'Nouvelle interface',dev:'NON',preprod:'NON',recCompany:'NON',recClient:'NON',valide:'NON',comment:''}); renderInterfaces(); debouncedSave(); }
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
  document.getElementById('ef-testCompany').value    = r.testCompany || 'NON';
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
  r.testCompany    = document.getElementById('ef-testCompany').value;
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
  ['th-test-company','lbl-test-company'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = 'Test ' + (_companyName || 'Intégrateur'); });
  fonctionnelData.forEach(row => {
    const tr = tbody.insertRow(); tr.dataset.rowId = row.id;
    tr.innerHTML = `<td>${dh()}</td>
      <td style="font-weight:600;min-width:160px">${row.name}</td>
      <td>${cellBadge(ITF_B,row.dev)}</td>
      <td style="text-align:center;cursor:pointer"><span>${row.pct}%</span></td>
      <td>${cellBadge(ITF_B,row.testCompany)}</td><td>${cellBadge(ITF_B,row.preprod)}</td><td>${cellBadge(ITF_B,row.formKU)}</td><td>${cellBadge(ITF_B,row.testClient)}</td><td>${cellBadge(ITF_B,row.formUsers)}</td>
      <td style="color:var(--text-muted);min-width:110px;font-size:12px">${row.comment}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="openEditFonctionnel('${row.id}')">✏</button></td>`;
    ['dev','testCompany','preprod','formKU','testClient','formUsers'].forEach((f,fi) => {
      const td = tr.cells[[2,4,5,6,7,8][fi]]; const sp = td.querySelector('span');
      sp.addEventListener('click', e => { e.stopPropagation(); showDropdown(sp, ITF_STATES.map(v => ({label:v,value:v,dot:ITF_D[v]})), val => { row[f] = val; sp.className = ITF_B[val]||'cell-none'; sp.textContent = val; debouncedSave(); }); });
    });
    tr.cells[3].querySelector('span').addEventListener('click', e => { e.stopPropagation(); showDropdown(tr.cells[3].querySelector('span'), [0,10,20,30,40,50,60,70,80,90,100].map(v=>({label:v+'%',value:v,dot:'#2563eb'})), val => { row.pct = val; renderFonctionnel(); debouncedSave(); }); });
  });
  makeSortable(tbody, fonctionnelData, renderFonctionnel);
}
function addFonctionnel() { fonctionnelData.push({id:uid(),name:'Nouveau flux',dev:'NON',pct:0,testCompany:'NON',preprod:'NON',formKU:'NON',testClient:'NON',formUsers:'NON',comment:''}); renderFonctionnel(); debouncedSave(); }

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

function renderDryrun() {
  const tbody = document.getElementById('tbody-dryrun'); tbody.innerHTML = '';
  dryrunData.forEach(row => {
    const tr = tbody.insertRow(); tr.dataset.rowId = row.id;
    tr.innerHTML = `<td>${dh()}</td>
      <td style="font-weight:500">${formatTemplate(row.name)}</td>
      <td style="min-width:98px">${cellBadge(DR_B,row.etat)}</td>
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
const INST_QUI = ['COMPANY', TOKEN_CLIENT,'TOUS','Prestataire externe','—'];

let _editingInstallId = null;
function openEditInstall(id) {
  _editingInstallId = id;
  const r = installData.find(r => r.id === id); if (!r) return;
  document.getElementById('einst-action').value   = r.action || '';
  document.getElementById('einst-etat').value     = r.etat || 'Non';
  buildOwnerSelect(document.getElementById('einst-qui'), r.qui || 'COMPANY');
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

function renderInstall() {
  const tbody = document.getElementById('tbody-install'); tbody.innerHTML = '';
  installData.forEach(row => {
    const tr = tbody.insertRow(); tr.dataset.rowId = row.id;
    const quiLabel = row.qui === TOKEN_CLIENT ? getClientLabel() : row.qui === 'COMPANY' ? getCompanyLabel() : (row.qui || '—');
    tr.innerHTML = `<td>${dh()}</td>
      <td style="font-weight:500">${row.action}</td>
      <td style="min-width:88px">${cellBadge(INST_B,row.etat)}</td>
      <td style="font-size:12px;cursor:pointer"><span class="qui-label">${quiLabel}</span></td>
      <td style="font-size:12px">${row.deadline||'—'}</td>
      <td style="color:var(--text-muted);font-size:12px">${row.comment}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="openEditInstall('${row.id}')">✏</button></td>`;
    const sp = tr.cells[2].querySelector('span');
    sp.addEventListener('click', e => { e.stopPropagation(); showDropdown(sp, INST_STATES.map(v => ({label:v,value:v,dot:INST_D[v]})), val => { row.etat = val; sp.className = INST_B[val]||'cell-none'; sp.textContent = val; renderDashboard(); debouncedSave(); }); });
    const quiSpan = tr.cells[3].querySelector('.qui-label');
    quiSpan.addEventListener('click', e => {
      e.stopPropagation();
      showDropdown(quiSpan, getOwnerOptions().map(o => ({ label: typeof o.label === 'function' ? o.label() : o.label, value: o.value })), val => {
        row.qui = val;
        quiSpan.textContent = val === TOKEN_CLIENT ? getClientLabel() : val === 'COMPANY' ? getCompanyLabel() : val || '—';
        debouncedSave();
      });
    });
  });
  makeSortable(tbody, installData, renderInstall);
}
function addInstall() { installData.push({id:uid(),action:'Nouveau prérequis',etat:'Non',qui:'COMPANY',deadline:'',comment:''}); renderInstall(); debouncedSave(); }
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
  _delFactJalon(_editingJalonId, _editingJalonType === 'projet' ? jalonsProjet : jalonsEquip);
}

function fmtMontant(v) { return (v || 0).toLocaleString('fr-FR') + ' €'; }
function renderFactRow(tbody, list, type) {
  tbody.innerHTML = '';
  list.forEach(row => {
    const tr = tbody.insertRow(); tr.dataset.rowId = row.id;
    tr.innerHTML = `<td>${dh()}</td>
      <td style="font-weight:600">${row.jalon}</td>
      <td style="font-size:12px">${row.date||'—'}</td>
      <td style="font-size:12px">${row.echeance||'—'}</td>
      <td style="min-width:78px">${cellBadge(FACT_B,row.etat)}</td>
      <td style="text-align:right;font-size:12px">${row.pct||0}%</td>
      <td style="text-align:right;font-weight:600;font-family:'DM Mono',monospace">${fmtMontant(row.montant)}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="openEditJalon('${row.id}','${type}')">✏</button></td>`;
    const sp = tr.cells[4].querySelector('span');
    sp.addEventListener('click', e => { e.stopPropagation(); showDropdown(sp, FACT_STATES.map(v => ({label:v,value:v,dot:FACT_D[v]})), val => { row.etat = val; sp.className = FACT_B[val]||'cell-none'; sp.textContent = val; renderFacturation(); renderDashboard(); debouncedSave(); }); });
  });
  makeSortable(tbody, list, renderFacturation);
}
function _delFactJalon(id, list) {
  const idx = list.findIndex(r => r.id === id); if (idx < 0) return;
  const deleted = { ...list[idx] };
  list.splice(idx, 1); renderFacturation(); renderDashboard(); debouncedSave();
  showUndoToast(`Jalon "${deleted.jalon}" supprimé`, () => { list.splice(idx, 0, deleted); renderFacturation(); renderDashboard(); });
}
function addJalon(type) { const list = type === 'projet' ? jalonsProjet : jalonsEquip; list.push({id:uid(),jalon:'Nouveau jalon',date:'',echeance:'',etat:'—',pct:0,montant:0}); renderFacturation(); debouncedSave(); }
let _addingDeplId = null;
function openAddDeplExpense(id) {
  _addingDeplId = id;
  document.getElementById('depl-exp-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('depl-exp-montant').value = '';
  document.getElementById('depl-exp-note').value = '';
  document.getElementById('modal-depl-expense').classList.add('open');
}
function saveDeplExpense() {
  const row = jalonsDeplacements.find(r => r.id === _addingDeplId); if (!row) return;
  const montant = +document.getElementById('depl-exp-montant').value || 0;
  const date    = document.getElementById('depl-exp-date').value || new Date().toISOString().slice(0,10);
  const note    = document.getElementById('depl-exp-note').value.trim();
  if (!row.depenses) row.depenses = [];
  row.depenses.push({ date, montant, note });
  closeModal('modal-depl-expense');
  renderHeures(); renderDashboard(); debouncedSave();
}
function deleteDeplExpense(id, idx) {
  const row = jalonsDeplacements.find(r => r.id === id); if (!row) return;
  row.depenses.splice(idx, 1);
  renderHeures(); renderDashboard(); debouncedSave();
}
function toggleDeplHistory(id, btn) {
  const existingRow = btn.closest('tr').nextElementSibling;
  if (existingRow && existingRow.classList.contains('depl-history-row')) { existingRow.remove(); return; }
  const row = jalonsDeplacements.find(r => r.id === id);
  if (!row || !row.depenses?.length) return;
  const tr = document.createElement('tr'); tr.className = 'depl-history-row';
  const td = document.createElement('td'); td.colSpan = 5; td.style.padding = '0 16px 8px 24px';
  const rows = row.depenses.map((d,i) => `<tr>
    <td style="font-size:11px;padding:2px 8px">${d.date||'—'}</td>
    <td style="text-align:right;font-size:11px;padding:2px 8px;font-weight:600">${fmtMontant(d.montant)}</td>
    <td style="font-size:11px;color:var(--text-muted);padding:2px 8px">${d.note||''}</td>
    <td><button style="font-size:10px;border:none;background:none;cursor:pointer;color:#dc2626;padding:0 4px" onclick="deleteDeplExpense('${id}',${i})">✕</button></td>
  </tr>`).join('');
  td.innerHTML = `<table style="font-size:11px;border-collapse:collapse;margin:4px 0">
    <thead><tr><th style="padding:2px 8px;text-align:left;color:var(--text-muted)">Date</th><th style="padding:2px 8px;color:var(--text-muted)">Montant</th><th style="padding:2px 8px;color:var(--text-muted)">Note</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table>`;
  tr.appendChild(td);
  btn.closest('tr').insertAdjacentElement('afterend', tr);
}
function _renderDeplKpi() {
  const el = document.getElementById('kpi-deplacements');
  if (!el) return;
  const tDVendu = jalonsDeplacements.reduce((s,r) => s+(r.vendu||0), 0);
  const tDDepl  = jalonsDeplacements.reduce((s,r) => s+(r.depenses||[]).reduce((a,d) => a+(d.montant||0), 0), 0);
  const ecart = tDDepl - tDVendu;
  const ec = ecart > 0 ? '#dc2626' : ecart < 0 ? '#059669' : 'var(--text-muted)';
  el.innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Budget Déplacements</div><div class="kpi-value">${tDVendu.toLocaleString('fr-FR')} €</div></div>
    <div class="kpi-card"><div class="kpi-label">Dépensé</div><div class="kpi-value">${tDDepl.toLocaleString('fr-FR')} €</div>${tDVendu > 0 ? `<div class="kpi-bar"><div class="kpi-bar-fill" style="width:${Math.min(100,Math.round(tDDepl/tDVendu*100))}%;background:${ecart>0?'#dc2626':'var(--accent)'}"></div></div>` : ''}</div>
    <div class="kpi-card"><div class="kpi-label">Écart</div><div class="kpi-value" style="color:${ec}">${ecart > 0 ? '+' : ''}${ecart.toLocaleString('fr-FR')} €</div></div>`;
}
function renderDeplRow(tbody) {
  tbody.innerHTML = '';
  jalonsDeplacements.forEach(row => {
    const totalDepl = (row.depenses||[]).reduce((s,d) => s+(d.montant||0), 0);
    const tr = tbody.insertRow();
    tr.innerHTML = `
      <td style="font-weight:600">${row.label}</td>
      <td style="text-align:right;cursor:pointer;text-decoration:underline dotted;font-family:'DM Mono',monospace" title="Cliquer pour modifier le budget vendu">${fmtMontant(row.vendu||0)}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:600">${fmtMontant(totalDepl)}</td>
      <td style="text-align:center;white-space:nowrap">
        ${(row.depenses||[]).length ? `<span title="Historique des dépenses" style="cursor:pointer;font-size:14px" onclick="toggleDeplHistory('${row.id}',this)">🕐</span> ` : ''}
        <span title="Ajouter une dépense" style="cursor:pointer;font-size:16px;color:var(--accent);font-weight:700" onclick="openAddDeplExpense('${row.id}')">+</span>
      </td>`;
    tr.cells[1].addEventListener('click', () => {
      const v = prompt(`Budget vendu — ${row.label} :`, row.vendu || 0);
      if (v !== null && !isNaN(+v)) { row.vendu = +v; renderHeures(); renderDashboard(); debouncedSave(); }
    });
  });
  _renderDeplKpi();
}
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
  { key: 'kpi',      label: 'Cartes KPI (résumé)' },
  { key: 'drift',    label: 'Indicateur dérive installation' },
  { key: 'thisweek', label: 'Tâches de la semaine' },
  { key: 'phases',   label: 'Graphique — Avancement par Phase' },
  { key: 'statuts',  label: 'Graphique — Répartition des Statuts' },
  { key: 'heures',   label: 'Graphique — Suivi Heures' },
  { key: 'fact',     label: 'Graphique — Facturation' },
  { key: 'itf',      label: 'Graphique — Interfaces ERP' },
  { key: 'install',  label: 'Graphique — Prérequis Installation' },
  { key: 'dryrun',   label: 'Graphique — Prérequis Dry Run' },
  { key: 'jira',     label: 'Graphique — JIRA Épics & Tâches' },
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
  const kpiEl = document.getElementById('dash-kpi');
  kpiEl.style.display = isChartVisible('kpi') ? '' : 'none';
  kpiEl.innerHTML = `
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
      const doneData = epics.map(e => tasks_j.filter(t => t.epicId === e.key && t.status === 'DONE').length);
      const inProgData = epics.map(e => tasks_j.filter(t => t.epicId === e.key && (t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW')).length);
      const todoData = epics.map(e => tasks_j.filter(t => t.epicId === e.key && (t.status === 'TO_DO' || t.status === 'BLOCKED')).length);
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

  _syncRagUI();
  renderThisWeek();
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

// ═══ RAG STATUS ═══
function setRag(val) {
  projectMeta.rag = val || undefined;
  _syncRagUI();
  debouncedSave();
}
function _syncRagUI() {
  const v = projectMeta.rag || '';
  const dot = document.getElementById('rag-nav-dot');
  const lbl = document.getElementById('rag-nav-lbl');
  if (dot) dot.className = 'rag-nav-dot' + (v ? ' rag-dot-' + v.toLowerCase() : '');
  if (lbl) lbl.textContent = v === 'G' ? 'OK' : v === 'A' ? 'Attention' : v === 'R' ? 'Bloqué' : '—';
}
function toggleRagDropdown(e) {
  e.stopPropagation();
  document.getElementById('rag-nav-dropdown')?.classList.toggle('open');
}
function closeRagDropdown() {
  document.getElementById('rag-nav-dropdown')?.classList.remove('open');
}
document.addEventListener('click', closeRagDropdown);

// ═══ THIS WEEK PANEL ═══
function renderThisWeek() {
  const panel = document.getElementById('dash-this-week');
  if (!panel) return;
  if (!isChartVisible('thisweek')) { panel.style.display = 'none'; return; }
  const today = new Date(); today.setHours(0,0,0,0);
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);

  const overdue = [], thisWeek = [];
  tasks.forEach(task => {
    if (task.isUnavail || task.status === 'Terminé') return;
    const segs = taskSegments(task);
    segs.forEach(s => {
      if (!s.end) return;
      const end = new Date(s.end); end.setHours(0,0,0,0);
      const start = s.start ? new Date(s.start) : null; if (start) start.setHours(0,0,0,0);
      if (end < today) { if (!overdue.find(x => x.id === task.id)) overdue.push(task); }
      else if (end <= weekEnd || (start && start <= weekEnd && start >= today)) { if (!thisWeek.find(x => x.id === task.id)) thisWeek.push(task); }
    });
  });

  if (!overdue.length && !thisWeek.length) { panel.style.display = 'none'; return; }
  panel.style.display = '';

  const row = t => {
    const ph = phases.find(p => p.id === t.phaseId);
    const segs = taskSegments(t);
    const endStr = segs.length ? (segs[segs.length-1].end || '—') : '—';
    const depViolation = (t.deps||[]).some(dId => {
      const dep = tasks.find(x => x.id === dId); if (!dep) return false;
      const depSegs = taskSegments(dep);
      const depEnd = depSegs.length ? depSegs[depSegs.length-1].end : null;
      return depEnd && t.start && depEnd > t.start;
    });
    return `<tr>
      <td style="padding:3px 8px;font-size:12px;font-weight:500">${formatTemplate(t.name)}${depViolation ? ' <span style="color:#f97316" title="Dépendance non respectée">⚠</span>' : ''}</td>
      <td style="padding:3px 8px;font-size:11px;color:var(--text-muted)">${ph ? ph.name : ''}</td>
      <td style="padding:3px 8px;font-size:11px">${t.owner || '—'}</td>
      <td style="padding:3px 8px;font-size:11px">${endStr}</td>
    </tr>`;
  };

  let html = '<div class="this-week-block">';
  if (overdue.length) {
    html += `<div class="this-week-section"><div class="this-week-title tw-overdue">⚠ En retard (${overdue.length})</div>
      <table style="width:100%;border-collapse:collapse"><thead><tr>${['Tâche','Phase','Propriétaire','Fin prévue'].map(h=>`<th style="padding:3px 8px;font-size:10px;font-weight:600;color:var(--text-muted);text-align:left;border-bottom:1px solid var(--border)">${h}</th>`).join('')}</tr></thead>
      <tbody>${overdue.map(row).join('')}</tbody></table></div>`;
  }
  if (thisWeek.length) {
    html += `<div class="this-week-section"><div class="this-week-title tw-week">📅 Cette semaine (${thisWeek.length})</div>
      <table style="width:100%;border-collapse:collapse"><thead><tr>${['Tâche','Phase','Propriétaire','Fin prévue'].map(h=>`<th style="padding:3px 8px;font-size:10px;font-weight:600;color:var(--text-muted);text-align:left;border-bottom:1px solid var(--border)">${h}</th>`).join('')}</tr></thead>
      <tbody>${thisWeek.map(row).join('')}</tbody></table></div>`;
  }
  html += '</div>';
  panel.innerHTML = html;
}

// ═══ TASK DEPENDENCIES ═══
function _buildDepsSelect(currentTaskId, selectedDeps) {
  const sel = document.getElementById('task-deps');
  sel.innerHTML = '';
  tasks.forEach(t => {
    if (t.id === currentTaskId) return;
    const ph = phases.find(p => p.id === t.phaseId);
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = (ph ? ph.name + ' — ' : '') + formatTemplate(t.name);
    opt.selected = (selectedDeps || []).includes(t.id);
    sel.appendChild(opt);
  });
}

function _readDepsSelect() {
  return Array.from(document.getElementById('task-deps').selectedOptions).map(o => o.value);
}

// ═══ TAB MANAGEMENT ═══
const BUILTIN_TABS = [
  { id: 'page-dashboard',   defaultLabel: 'Tableau de bord' },
  { id: 'page-planning',    defaultLabel: 'Planning' },
  { id: 'page-heures',      defaultLabel: 'Suivi Heures' },
  { id: 'page-taches',      defaultLabel: 'Tâches Internes' },
  { id: 'page-interfaces',  defaultLabel: 'Interfaces' },
  { id: 'page-fonctionnel', defaultLabel: 'Fonctionnel' },
  { id: 'page-dryrun',      defaultLabel: 'Prérequis Dry Run' },
  { id: 'page-install',     defaultLabel: 'Prérequis Install' },
  { id: 'page-facturation', defaultLabel: 'Facturation' },
  { id: 'page-jira',        defaultLabel: '◈ JIRA' },
];

function _applyTabConfig() {
  const tabLabels  = projectMeta.tabLabels  || {};
  const tabOrder   = projectMeta.tabOrder   || [];
  const tabHidden  = projectMeta.tabHidden  || [];
  const navTabs    = document.getElementById('nav-tabs');
  const addBtn     = navTabs.querySelector('.nav-tab-add');

  // Apply labels to built-in tabs
  BUILTIN_TABS.forEach(({ id, defaultLabel }) => {
    const el = navTabs.querySelector(`[data-page="${id}"]`);
    if (el) el.textContent = tabLabels[id] || defaultLabel;
  });

  // Apply labels to custom tabs
  customTabs.forEach(tab => {
    const el = navTabs.querySelector(`[data-page="page-ct-${tab.id}"]`);
    if (el) el.textContent = tabLabels['page-ct-' + tab.id] || (tab.icon ? tab.icon + ' ' + tab.name : tab.name);
  });

  // Apply visibility
  navTabs.querySelectorAll('.nav-tab').forEach(el => {
    const pageId = el.dataset.page;
    el.style.display = tabHidden.includes(pageId) ? 'none' : '';
  });

  // Apply order (move tab elements to match saved order, keep ＋ button last)
  if (tabOrder.length) {
    tabOrder.forEach(pageId => {
      const el = navTabs.querySelector(`[data-page="${pageId}"]`);
      if (el) navTabs.insertBefore(el, addBtn);
    });
  }
}

function openManageTabsModal() {
  const tabLabels = projectMeta.tabLabels || {};
  const tabHidden = projectMeta.tabHidden || [];
  const tabOrder  = projectMeta.tabOrder  || [];

  const allTabs = [
    ...BUILTIN_TABS.map(t => ({ id: t.id, label: tabLabels[t.id] || t.defaultLabel, defaultLabel: t.defaultLabel })),
    ...customTabs.map(t => ({ id: 'page-ct-' + t.id, label: tabLabels['page-ct-' + t.id] || (t.icon ? t.icon + ' ' + t.name : t.name), defaultLabel: t.name })),
  ];

  // Sort by saved order if exists
  if (tabOrder.length) allTabs.sort((a, b) => {
    const ai = tabOrder.indexOf(a.id), bi = tabOrder.indexOf(b.id);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });

  const list = document.getElementById('manage-tabs-list');
  list.innerHTML = '';
  allTabs.forEach(tab => {
    const row = document.createElement('div');
    row.className = 'manage-tab-row';
    row.dataset.pageId = tab.id;
    row.innerHTML = `<span class="drag-handle" style="cursor:grab;font-size:16px;color:var(--text-muted)">⠿</span>
      <input type="checkbox" class="mt-visible" ${tabHidden.includes(tab.id) ? '' : 'checked'} style="width:auto;cursor:pointer">
      <input type="text" class="mt-label" value="${tab.label}" placeholder="${tab.defaultLabel}" style="flex:1;border:1px solid var(--border);border-radius:4px;padding:4px 8px;font-size:13px;font-family:inherit">`;
    list.appendChild(row);
  });

  // Make sortable
  const ex = Sortable.get(list); if (ex) ex.destroy();
  Sortable.create(list, { handle: '.drag-handle', animation: 150, forceFallback: true, fallbackTolerance: 3 });
  document.getElementById('modal-manage-tabs').classList.add('open');
}

function saveManageTabs() {
  const rows = Array.from(document.querySelectorAll('#manage-tabs-list .manage-tab-row'));
  projectMeta.tabOrder  = rows.map(r => r.dataset.pageId);
  projectMeta.tabHidden = rows.filter(r => !r.querySelector('.mt-visible').checked).map(r => r.dataset.pageId);
  const labels = {};
  rows.forEach(r => {
    const val = r.querySelector('.mt-label').value.trim();
    if (val) labels[r.dataset.pageId] = val;
  });
  projectMeta.tabLabels = labels;
  closeModal('modal-manage-tabs');
  _applyTabConfig();
  debouncedSave();
}

function resetTabOrder() {
  delete projectMeta.tabOrder;
  delete projectMeta.tabHidden;
  delete projectMeta.tabLabels;
  closeModal('modal-manage-tabs');
  _applyTabConfig();
  // Restore default tab labels explicitly
  BUILTIN_TABS.forEach(({ id, defaultLabel }) => {
    const el = document.querySelector(`[data-page="${id}"]`);
    if (el) el.textContent = defaultLabel;
  });
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

  _applyTabConfig();
}

function buildCustomTabHTML(tab) {
  const cols = tab.columns;
  const headerCells = `<th style="width:26px"></th>${cols.map(c=>`<th>${c.label}</th>`).join('')}<th style="width:28px"></th>`;
  const bodyId = `tbody-ct-${tab.id}`;
  return `
    <div class="panel">
      <div class="panel-header">
        <span class="panel-title">${tab.icon||''} ${tab.name}</span>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-secondary btn-sm" onclick="addCustomTabRow('${tab.id}')">＋ Ligne</button>
          <button class="btn btn-ghost btn-icon btn-sm" onclick="openEditCustomTabModal('${tab.id}')" title="Modifier l'onglet">✏</button>
          <button class="btn btn-ghost btn-icon btn-sm btn-danger-ghost" onclick="deleteCustomTab('${tab.id}')" title="Supprimer cet onglet">🗑</button>
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
        cells += `<td style="text-align:center"><input type="checkbox" ${val?'checked':''} onchange="ctSetCell('${tabId}','${row.id}','${col.key}',this.checked);debouncedSave()"></td>`;
      } else if (col.type === 'date') {
        cells += `<td><input type="date" value="${val}" style="border:none;background:transparent;font-family:inherit;font-size:11.5px;width:100%" onchange="ctSetCell('${tabId}','${row.id}','${col.key}',this.value);debouncedSave()"></td>`;
      } else if (col.type === 'select') {
        const opts = (col.options||[]).map(o=>`<option${o===val?' selected':''}>${o}</option>`).join('');
        cells += `<td><select class="tbl-sel" onchange="ctSetCell('${tabId}','${row.id}','${col.key}',this.value);debouncedSave()">${opts}</select></td>`;
      } else {
        cells += `<td contenteditable="true" onblur="ctSetCell('${tabId}','${row.id}','${col.key}',this.textContent.trim());debouncedSave()">${val}</td>`;
      }
    });
    cells += `<td><button class="btn btn-secondary btn-sm" onclick="openEditCustomTabRow('${tabId}','${row.id}')">✏</button></td>`;
    tr.innerHTML = cells;
  });
  makeSortable(tbody, tab.rows, () => { renderCustomTabRows(tabId); debouncedSave(); });
  makeResizable('tbody-ct-' + tabId);
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

let _editingCtTabId = null, _editingCtRowId = null;

function openEditCustomTabRow(tabId, rowId) {
  const tab = customTabs.find(t => t.id === tabId);
  if (!tab) return;
  const row = tab.rows.find(r => r.id === rowId);
  if (!row) return;
  _editingCtTabId = tabId; _editingCtRowId = rowId;
  document.getElementById('modal-edit-ct-row-title').textContent = `Modifier — ${tab.name}`;
  const container = document.getElementById('modal-edit-ct-row-fields');
  container.innerHTML = '';
  tab.columns.forEach(col => {
    const val = row[col.key] !== undefined ? row[col.key] : '';
    const wrap = document.createElement('div'); wrap.className = 'form-row';
    const lbl = document.createElement('label'); lbl.textContent = col.label;
    wrap.appendChild(lbl);
    let input;
    if (col.type === 'checkbox') {
      input = document.createElement('input'); input.type = 'checkbox'; input.checked = !!val;
      input.style.cssText = 'width:auto;margin-top:6px';
    } else if (col.type === 'date') {
      input = document.createElement('input'); input.type = 'date'; input.value = val;
    } else if (col.type === 'select') {
      input = document.createElement('select');
      (col.options || []).forEach(o => { const opt = document.createElement('option'); opt.value = o; opt.textContent = o; if (o === val) opt.selected = true; input.appendChild(opt); });
    } else {
      input = document.createElement('input'); input.type = 'text'; input.value = val;
    }
    input.dataset.colKey = col.key;
    input.dataset.colType = col.type;
    wrap.appendChild(input);
    container.appendChild(wrap);
  });
  document.getElementById('modal-edit-ct-row').classList.add('open');
}

function saveCustomTabRowFromModal() {
  const tab = customTabs.find(t => t.id === _editingCtTabId); if (!tab) return;
  const row = tab.rows.find(r => r.id === _editingCtRowId); if (!row) return;
  document.querySelectorAll('#modal-edit-ct-row-fields [data-col-key]').forEach(inp => {
    row[inp.dataset.colKey] = inp.dataset.colType === 'checkbox' ? inp.checked : inp.value;
  });
  closeModal('modal-edit-ct-row');
  renderCustomTabRows(_editingCtTabId); debouncedSave();
}

function deleteCustomTabRowFromModal() {
  const tabId = _editingCtTabId, rowId = _editingCtRowId;
  closeModal('modal-edit-ct-row');
  deleteCustomTabRow(tabId, rowId);
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
  const sel = new Set([...document.getElementById('export-tab-list').querySelectorAll('input:checked')].map(cb => cb.dataset.tabId));

  const m = projectMeta;
  const e = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const dt = iso => { if (!iso) return '—'; try { return fmtDateShort(new Date(iso)); } catch { return e(iso); } };
  const pct = v => `${v||0}%`;

  // Shared badge helper — green/blue/gray/red based on common values
  const BADGE_COLORS = {
    'OUI':'#059669','OK':'#059669','Oui':'#059669','FAIT':'#059669','Terminé':'#059669','Payé':'#059669',
    'En cours':'#2563eb','EN COURS':'#2563eb','In Progress':'#2563eb',
    'NON':'#94a3b8','Non':'#94a3b8','À FAIRE':'#94a3b8','À faire':'#94a3b8','—':'#94a3b8',
    'KO':'#dc2626','BLOQUÉ':'#dc2626','Retard':'#dc2626',
  };
  const bdg = v => {
    const c = BADGE_COLORS[v] || '#64748b';
    return `<span style="background:${c}22;color:${c};border:1px solid ${c}55;padding:1px 7px;border-radius:10px;font-size:11px;font-weight:600;white-space:nowrap">${e(v||'—')}</span>`;
  };
  const tblHead = cols => `<thead><tr>${cols.map(c=>`<th>${e(c)}</th>`).join('')}</tr></thead>`;
  const tblRow  = cells => `<tr>${cells.map(c=>`<td>${c}</td>`).join('')}</tr>`;

  // ── Sections ──────────────────────────────────────────────────────────────
  const tabDefs = [];
  const addSection = (id, label, content) => { if (sel.has(id)) tabDefs.push({id, label, content}); };

  // Dashboard — summary cards
  const doneT = tasks.filter(t=>t.status==='Terminé').length;
  const totalT = tasks.filter(t=>t.phaseId!=='INDISPO').length;
  const instDone = installData.filter(i=>i.etat==='Oui').length;
  const drDone   = dryrunData.filter(d=>d.etat==='OK').length;
  const hStd = heuresData.find(r=>r.totalType==='Standard'), hCust = heuresData.find(r=>r.totalType==='Custom');
  const installStatus = m.installDateActual ? 'Terminé' : m.installDateDelayed ? 'Retardé' : 'En cours';
  const hVente = heuresVenteTotale(), hActuel = heuresActuelTotal();
  const progGlobal = totalT > 0 ? Math.round(tasks.filter(t=>t.phaseId!=='INDISPO').reduce((s,t)=>s+(t.progress||0),0)/totalT) : 0;
  const allJ = [...jalonsProjet,...jalonsEquip];
  const totM = allJ.reduce((s,j)=>s+(j.montant||0),0), payeM = allJ.filter(j=>j.etat==='Payé').reduce((s,j)=>s+(j.montant||0),0);
  const kpi = v => `<div class="kc">${v}</div>`;
  addSection('page-dashboard', 'Tableau de bord', `
    <div class="kpi-grid">
      ${[
        {lbl:'Installation',     val:bdg(installStatus), sub: m.installDateDelayed ? `<s>${dt(m.installDateOriginal)}</s> → ${dt(m.installDateDelayed)}` : dt(m.installDateOriginal)},
        {lbl:'Tâches Terminées', val:`${doneT}<span class="kv-of">/${totalT}</span>`, bar: totalT ? Math.round(doneT/totalT*100) : 0},
        {lbl:'Avancement Global',val:`${progGlobal}%`, bar: progGlobal},
        {lbl:'Heures Actuel / Vente', val:`${hActuel}<span class="kv-of">/${hVente} h</span>`, bar: hVente > 0 ? Math.min(100, Math.round(hActuel/hVente*100)) : 0, barColor: hActuel > hVente ? '#dc2626' : '#2563eb'},
        {lbl:'Prérequis Install', val:`${instDone}<span class="kv-of">/${installData.length}</span>`, bar: installData.length ? Math.round(instDone/installData.length*100) : 0},
        {lbl:'Dry Run',           val:`${drDone}<span class="kv-of">/${dryrunData.length}</span>`, bar: dryrunData.length ? Math.round(drDone/dryrunData.length*100) : 0},
        {lbl:'Facturation',       val:`${payeM.toLocaleString('fr-FR')} €`, sub:`/ ${totM.toLocaleString('fr-FR')} € total`, bar: totM ? Math.round(payeM/totM*100) : 0, barColor:'#059669'},
        {lbl:'Phases',            val:`${phases.length}`, sub:`${tasks.filter(t=>t.phaseId!=='INDISPO').length} tâches`},
      ].map(c=>`<div class="kpi-card"><div class="kpi-lbl">${c.lbl}</div><div class="kpi-val">${c.val}</div>${c.sub?`<div class="kpi-sub">${c.sub}</div>`:''}${c.bar!==undefined?`<div class="kpi-bar"><div class="kpi-bar-fill" style="width:${c.bar}%;background:${c.barColor||'#2563eb'}"></div></div>`:''}</div>`).join('')}
    </div>
    ${m.notes?`<div class="note-block">${e(m.notes)}</div>`:''}
  `);

  // Planning
  let planHtml = `<table><thead><tr><th>Statut</th><th>Tâche</th><th>Propriétaire</th><th>Début</th><th>Fin</th><th>J</th><th style="min-width:90px">%</th></tr></thead><tbody>`;
  phases.forEach(ph => {
    const pt = tasks.filter(t=>t.phaseId===ph.id && !t.isUnavail);
    if (!pt.length) return;
    const phStarts = pt.map(t=>t.start).filter(Boolean).map(d=>new Date(d).getTime());
    const phEnds   = pt.map(t=>t.end).filter(Boolean).map(d=>new Date(d).getTime());
    const phDur = phStarts.length && phEnds.length ? `${Math.round((Math.max(...phEnds)-Math.min(...phStarts))/86400000)+1}j` : '';
    planHtml += `<tr><td colspan="7" style="background:${e(ph.color)};color:#fff;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.3px;padding:6px 10px;border:none">${e(ph.name)}${phDur?` <span style="opacity:.75;font-weight:400">(${phDur})</span>`:''}</td></tr>`;
    pt.forEach(t => {
      const segs = taskSegments(t);
      const days = segs.reduce((s,seg)=>{ if(!seg.start||!seg.end) return s; const d=Math.round((new Date(seg.end)-new Date(seg.start))/86400000)+1; return s+(d>0?d:0); },0);
      const p = t.progress||0;
      const bar = `<div style="display:flex;align-items:center;gap:6px"><div style="background:#e2e8f0;border-radius:3px;height:6px;width:60px;flex-shrink:0"><div style="background:${e(ph.color)};width:${p}%;height:6px;border-radius:3px"></div></div><span style="font-size:11px;color:#475569">${p}%</span></div>`;
      planHtml += tblRow([bdg(t.status||'Non commencé'),`<span style="font-weight:500">${e(formatTemplate(t.name))}</span>`,e(formatTemplate(t.owner||'—')),dt(t.start),dt(t.end),days||'—',bar]);
    });
  });
  planHtml += '</tbody></table>';
  addSection('page-planning', 'Planning', planHtml);

  // Hours
  let hHtml = `<table>${tblHead(['Catégorie','Vendu (h)','Actuel (h)','Écart'])}<tbody>`;
  heuresData.forEach(r => {
    if (r.sep) { hHtml += `<tr><td colspan="4" style="background:#f1f5f9;height:4px;padding:0"></td></tr>`; return; }
    const ecart = (r.actuel||0)-(r.vente||0);
    const ecartStr = ecart>0?`<span style="color:#dc2626">+${ecart}</span>`:ecart<0?`<span style="color:#059669">${ecart}</span>`:'0';
    hHtml += tblRow([r.bold?`<strong>${e(r.cat)}</strong>`:e(r.cat||''), e(r.vente||0), e(r.actuel||0), ecartStr]);
  });
  hHtml += '</tbody></table>';
  addSection('page-heures', 'Suivi Heures', hHtml);

  // Internal tasks
  addSection('page-taches', 'Tâches Internes', `<table>${tblHead(['Action','État','Temps (j)','Échéance','Commentaire'])}<tbody>
    ${internalTasks.map(t=>tblRow([e(t.action),bdg(t.etat),e(t.temps||'—'),dt(t.deadline),e(t.comment||'')])).join('')}
  </tbody></table>`);

  // Interfaces
  addSection('page-interfaces', 'Interfaces ERP', `<table>${tblHead(['Interface','Type','Dev','Préprod','Rec. '+(_companyName||'Intégrateur'),'Rec. Client','Validé','Commentaire'])}<tbody>
    ${interfacesData.map(i=>tblRow([e(i.name),e(i.type),bdg(i.dev),bdg(i.preprod),bdg(i.recCompany),bdg(i.recClient),bdg(i.valide),e(i.comment||'')])).join('')}
  </tbody></table>`);

  // Functional
  addSection('page-fonctionnel', 'Suivi Fonctionnel', `<table>${tblHead(['Processus','Dev','%','Test Mec.','Préprod','Form. KU','Test Client','Form. Users','Commentaire'])}<tbody>
    ${fonctionnelData.map(f=>tblRow([e(f.name),bdg(f.dev),pct(f.pct),bdg(f.testCompany),bdg(f.preprod),bdg(f.formKU),bdg(f.testClient),bdg(f.formUsers),e(f.comment||'')])).join('')}
  </tbody></table>`);

  // Dry Run
  addSection('page-dryrun', 'Prérequis Dry Run', `<table>${tblHead(['','Prérequis','État','Commentaire'])}<tbody>
    ${dryrunData.map(r=>tblRow([r.etat==='OK'?'✅':'⬜',e(r.name),bdg(r.etat),e(r.comment||'')])).join('')}
  </tbody></table>`);

  // Install
  addSection('page-install', 'Prérequis Installation', `<table>${tblHead(['','Action','État','Qui ?','Deadline','Commentaire'])}<tbody>
    ${installData.map(r=>{const ql=r.qui===TOKEN_CLIENT?e(getClientLabel()):e(r.qui||'—');return tblRow([r.etat==='Oui'?'✅':'⬜',e(r.action),bdg(r.etat),ql,dt(r.deadline),e(r.comment||'')])}).join('')}
  </tbody></table>`);

  // Billing
  let factHtml = '';
  if (jalonsProjet.length) {
    factHtml += `<h3 style="font-size:13px;font-weight:600;margin:0 0 8px">Jalons Projet</h3>
    <table>${tblHead(['Jalon','%','Montant','Échéance','Date paiement','État'])}<tbody>
    ${jalonsProjet.map(j=>tblRow([e(j.jalon),pct(j.pct),e(fmtMontant(j.montant)),dt(j.echeance),dt(j.date),bdg(j.etat)])).join('')}
    </tbody></table>`;
  }
  if (jalonsEquip.length) {
    factHtml += `<h3 style="font-size:13px;font-weight:600;margin:16px 0 8px">Jalons Équipement</h3>
    <table>${tblHead(['Jalon','%','Montant','Échéance','Date paiement','État'])}<tbody>
    ${jalonsEquip.map(j=>tblRow([e(j.jalon),pct(j.pct),e(fmtMontant(j.montant)),dt(j.echeance),dt(j.date),bdg(j.etat)])).join('')}
    </tbody></table>`;
  }
  addSection('page-facturation', 'Facturation', factHtml);

  // Custom tabs
  customTabs.forEach(ct => {
    if (!sel.has('page-ct-' + ct.id) || !ct.columns?.length) return;
    const ctHtml = ct.rows?.length
      ? `<table>${tblHead(ct.columns.map(c=>c.label))}<tbody>
          ${ct.rows.map(r=>tblRow(ct.columns.map(c=>e(r[c.key]??'')))).join('')}
         </tbody></table>`
      : '<p style="color:#94a3b8;font-style:italic">Aucune ligne.</p>';
    tabDefs.push({id:'page-ct-'+ct.id, label:(ct.icon||'')+' '+ct.name, content: ctHtml});
  });

  if (!tabDefs.length) { alert('Sélectionnez au moins un onglet.'); return; }

  // ── Assemble HTML ──────────────────────────────────────────────────────────
  const installLine = m.installDateDelayed
    ? `<td><strong>Installation</strong></td><td><s>${dt(m.installDateOriginal)}</s> → <span style="color:#d97706">${dt(m.installDateDelayed)}</span>${m.installDateComment?` <em style="color:#94a3b8">(${e(m.installDateComment)})</em>`:''}</td>`
    : `<td><strong>Installation prévue</strong></td><td>${dt(m.installDateOriginal)}</td>`;

  const tabBtns = tabDefs.map((t,i)=>`<button class="tb${i===0?' active':''}" onclick="st(${i})">${e(t.label)}</button>`).join('');
  const tabPages = tabDefs.map((t,i)=>`<div class="tp" id="tp${i}" style="display:${i===0?'block':'none'}">${t.content}</div>`).join('');

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(m.name||'Export')} — ${e(m.client||'')}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;font-size:13px;background:#f1f5f9}
.hdr{background:#1a2332;color:#fff;padding:8px 24px;display:flex;gap:16px;align-items:center;font-size:12px;position:sticky;top:0;z-index:10;border-bottom:1px solid rgba(255,255,255,.08)}
.hdr strong{font-size:13px;font-weight:700;letter-spacing:.2px}
.hdr .hdr-sep{opacity:.35}
.hdr span:last-child{margin-left:auto;opacity:.75}
.wrap{padding:20px 24px;max-width:1200px;margin:0 auto}
.proj-title{font-size:22px;font-weight:700;color:#1e293b;margin-bottom:14px}
.panel{background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:16px}
.panel-hdr{background:#f8fafc;padding:10px 16px;font-weight:600;font-size:12px;color:#374151;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #e2e8f0}
.meta{border-collapse:collapse;width:100%;font-size:12px}
.meta td{padding:5px 14px;border-bottom:1px solid #f1f5f9;vertical-align:top}
.meta tr:last-child td{border-bottom:none}
.meta .meta-lbl{color:#64748b;white-space:nowrap;width:140px;font-size:11px;text-transform:uppercase;letter-spacing:.3px}
.tnav{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:16px;border-bottom:2px solid #e2e8f0;padding-bottom:8px;background:#fff;padding:12px 16px 0;border-radius:10px 10px 0 0;border:1px solid #e2e8f0;border-bottom:none}
.tnav+.tp-wrap{border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;background:#fff;padding:16px}
.tb{background:none;border:none;padding:8px 16px;font-size:12px;font-weight:500;cursor:pointer;color:#64748b;border-radius:6px 6px 0 0;border:1px solid transparent;margin-bottom:-1px}
.tb:hover{background:#f1f5f9;color:#1e293b}
.tb.active{background:#fff;color:#2563eb;border-color:#e2e8f0 #e2e8f0 #fff;font-weight:600}
table{border-collapse:collapse;width:100%;margin-bottom:0;font-size:12px}
thead tr{background:#f8fafc}
th{text-align:left;padding:7px 10px;border:1px solid #e2e8f0;font-weight:600;font-size:11px;color:#374151;white-space:nowrap;text-transform:uppercase;letter-spacing:.3px}
td{padding:6px 10px;border:1px solid #e2e8f0;vertical-align:middle}
tr:hover td{background:#f8fafc}
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin-bottom:16px}
.kpi-card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px}
.kpi-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;margin-bottom:6px}
.kpi-val{font-size:22px;font-weight:700;color:#1e293b;line-height:1.1}
.kv-of{font-size:14px;font-weight:400;color:#94a3b8}
.kpi-sub{font-size:11px;color:#94a3b8;margin-top:3px}
.kpi-bar{height:5px;background:#e2e8f0;border-radius:3px;margin-top:8px;overflow:hidden}
.kpi-bar-fill{height:5px;border-radius:3px}
.note-block{border-left:3px solid #2563eb;padding:10px 16px;background:#eff6ff;color:#1e40af;font-style:italic;border-radius:0 6px 6px 0;margin-top:12px;font-size:12px}
h3{font-size:13px;font-weight:600;color:#374151;margin:16px 0 8px}
footer{margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px;text-align:center}
</style></head>
<body>
<div class="hdr"><strong>📋 WMS Project Planner</strong><span class="hdr-sep">|</span><span>${e(m.client||'')}</span><span class="hdr-sep">—</span><span>${e(m.name||'')}</span><span>Exporté le ${new Date().toLocaleDateString('fr-FR')}</span></div>
<div class="wrap">
<div class="proj-title">${e(m.name||'Projet')}</div>
<div class="panel" style="margin-bottom:20px">
  <div class="panel-hdr">Informations du projet</div>
  <table class="meta"><tbody>
    <tr><td class="meta-lbl">Client</td><td><strong>${e(m.client||'—')}</strong></td><td class="meta-lbl" style="padding-left:24px">Directeur de Projet</td><td>${e(m.pm||'—')}</td></tr>
    <tr><td class="meta-lbl">CDP Technique</td><td>${e(m.cdptech||'—')}</td><td class="meta-lbl" style="padding-left:24px">Resp. Logistique</td><td>${e(m.respLog||'—')}</td></tr>
    <tr><td class="meta-lbl">Consultant ERP</td><td>${e(m.erpConsult||'—')}</td><td class="meta-lbl" style="padding-left:24px">Date de début</td><td>${dt(m.startDate)}</td></tr>
    <tr>${installLine}</tr>
    ${m.installDateActual?`<tr><td class="meta-lbl">Installation réelle</td><td style="color:#059669;font-weight:600">${dt(m.installDateActual)}</td></tr>`:''}
  </tbody></table>
</div>
<div class="tnav">${tabBtns}</div><div class="tp-wrap">
${tabPages}
</div>
<footer>WMS Project Planner — ${e(m.name||'')} — ${e(m.client||'')} — ${new Date().toLocaleDateString('fr-FR')}</footer>
</div>
<script>function st(i){document.querySelectorAll('.tp').forEach((p,j)=>p.style.display=j===i?'block':'none');document.querySelectorAll('.tb').forEach((b,j)=>b.classList.toggle('active',j===i));}</script>
</body></html>`;

  const name = ((m.client||'export')+'_'+(m.name||'projet')).replace(/\s+/g,'_').replace(/[^\w\-]/g,'');
  try {
    const result = await invoke('export_html_dialog', { name });
    if (!result) return;
    if (result._browserDownload) {
      const blob = new Blob([html], {type:'text/html;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download=result.filename; a.click();
      URL.revokeObjectURL(url);
    } else {
      await invoke('write_project', { path: result, data: html });
    }
    showSaveIndicator('saved');
  } catch (err) {
    showSaveIndicator('error');
    console.error('Export HTML error:', err);
    alert('Erreur export HTML : ' + err);
  }
}

// ═══ MARKDOWN EXPORT ═══
async function exportMarkdown() {
  const m = projectMeta;
  const d = s => { if (!s) return '—'; try { return fmtDateShort(new Date(s)); } catch { return s; } };
  const c = s => String(s ?? '—').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const row = cells => '| ' + cells.map(c).join(' | ') + ' |';
  const sep = n => '| ' + Array(n).fill('---').join(' | ') + ' |';

  const lines = [];

  // ── Header ──
  lines.push(`# ${m.name || 'Projet'}`);
  lines.push('');
  lines.push(row(['', '']));
  lines.push(sep(2));
  lines.push(row(['**Client**', m.client || '—']));
  lines.push(row(['**Dir. Projet**', m.pm || '—']));
  lines.push(row(['**CDP Technique**', m.cdptech || '—']));
  lines.push(row(['**Resp. Logistique**', m.respLog || '—']));
  lines.push(row(['**Consultant ERP**', m.erpConsult || '—']));
  lines.push(row(['**Date de début**', d(m.startDate)]));
  if (m.installDateDelayed) {
    lines.push(row(['**Installation (originale)**', `~~${d(m.installDateOriginal)}~~`]));
    lines.push(row(['**Installation (reportée)**', d(m.installDateDelayed)]));
    if (m.installDateComment) lines.push(row(['**Motif du report**', m.installDateComment]));
  } else {
    lines.push(row(['**Installation prévue**', d(m.installDateOriginal)]));
  }
  if (m.installDateActual) lines.push(row(['**Installation réelle**', d(m.installDateActual)]));
  if (m.endDate) lines.push(row(['**Fin de projet**', d(m.endDate)]));
  lines.push('');
  if (m.notes) { lines.push(`> ${m.notes.replace(/\n/g, '\n> ')}`); lines.push(''); }

  // ── Gantt ──
  lines.push('## Planning du projet');
  lines.push('');
  phases.forEach(phase => {
    const pt = tasks.filter(t => t.phaseId === phase.id);
    if (!pt.length) return;
    lines.push(`### ${phase.name}`);
    lines.push('');
    lines.push(row(['Tâche', 'Propriétaire', 'Début', 'Fin', 'Statut', '%']));
    lines.push(sep(6));
    pt.forEach(t => lines.push(row([t.name, t.owner || '—', d(t.start), d(t.end), t.status || '—', t.progress ? `${t.progress}%` : '—'])));
    lines.push('');
  });

  // ── Hours ──
  lines.push('## Suivi des heures');
  lines.push('');
  lines.push(row(['Catégorie', 'Vendu', 'Actuel', 'Écart']));
  lines.push(sep(4));
  heuresData.forEach(r => {
    if (r.sep) return;
    const ecart = (r.actuel || 0) - (r.vente || 0);
    const label = r.bold ? `**${r.cat}**` : (r.cat || '');
    lines.push(row([label, String(r.vente || 0), String(r.actuel || 0), ecart > 0 ? `+${ecart}` : String(ecart)]));
  });
  lines.push('');

  // ── Interfaces ──
  if (interfacesData.length) {
    lines.push('## Interfaces ERP');
    lines.push('');
    lines.push(row(['Interface', 'Type', 'Dev', 'Préprod', 'Rec. '+(_companyName||'Intégrateur'), 'Rec. Client', 'Validé', 'Commentaire']));
    lines.push(sep(8));
    interfacesData.forEach(i => lines.push(row([i.name, i.type, i.dev, i.preprod, i.recCompany, i.recClient, i.valide, i.comment || ''])));
    lines.push('');
  }

  // ── Functional ──
  if (fonctionnelData.length) {
    lines.push('## Avancement fonctionnel');
    lines.push('');
    lines.push(row(['Processus', 'Dev', '%', 'Test Mec.', 'Préprod', 'Form. KU', 'Test Client', 'Form. Users', 'Commentaire']));
    lines.push(sep(9));
    fonctionnelData.forEach(f => lines.push(row([f.name, f.dev, `${f.pct}%`, f.testCompany, f.preprod, f.formKU, f.testClient, f.formUsers, f.comment || ''])));
    lines.push('');
  }

  // ── Internal tasks ──
  if (internalTasks.length) {
    lines.push('## Tâches internes');
    lines.push('');
    lines.push(row(['Action', 'État', 'Temps (j)', 'Échéance', 'Commentaire']));
    lines.push(sep(5));
    internalTasks.forEach(t => lines.push(row([t.action, t.etat, String(t.temps || '—'), d(t.deadline), t.comment || ''])));
    lines.push('');
  }

  // ── Dry Run ──
  if (dryrunData.length) {
    lines.push('## Checklist Dry Run');
    lines.push('');
    dryrunData.forEach(dr => {
      lines.push(`- [${dr.etat === 'OK' ? 'x' : ' '}] ${dr.name}${dr.comment ? ` *(${dr.comment})*` : ''}`);
    });
    lines.push('');
  }

  // ── Install ──
  if (installData.length) {
    lines.push('## Checklist Installation');
    lines.push('');
    installData.forEach(i => {
      lines.push(`- [${i.etat === 'Oui' ? 'x' : ' '}] ${i.action}${i.qui ? ` — *${i.qui}*` : ''}${i.comment ? ` *(${i.comment})*` : ''}`);
    });
    lines.push('');
  }

  // ── Billing ──
  if (jalonsProjet.length) {
    lines.push('## Facturation — Jalons Projet');
    lines.push('');
    lines.push(row(['Jalon', '%', 'Montant', 'Échéance', 'Date paiement', 'État']));
    lines.push(sep(6));
    jalonsProjet.forEach(j => lines.push(row([j.jalon, `${j.pct}%`, fmtMontant(j.montant), d(j.echeance), d(j.date), j.etat])));
    lines.push('');
  }
  if (jalonsEquip.length) {
    lines.push('## Facturation — Jalons Équipement');
    lines.push('');
    lines.push(row(['Jalon', '%', 'Montant', 'Échéance', 'Date paiement', 'État']));
    lines.push(sep(6));
    jalonsEquip.forEach(j => lines.push(row([j.jalon, `${j.pct}%`, fmtMontant(j.montant), d(j.echeance), d(j.date), j.etat])));
    lines.push('');
  }

  // ── Custom tabs ──
  customTabs.forEach(tab => {
    lines.push(`## ${tab.icon ? tab.icon + ' ' : ''}${tab.name}`);
    lines.push('');
    if (tab.columns?.length && tab.rows?.length) {
      lines.push(row(tab.columns.map(col => col.label)));
      lines.push(sep(tab.columns.length));
      tab.rows.forEach(r => lines.push(row(tab.columns.map(col => r[col.key] || ''))));
    }
    lines.push('');
  });

  lines.push('---');
  lines.push(`*Exporté le ${new Date().toLocaleDateString('fr-FR')} — WMS Project Planner*`);

  const md = lines.join('\n');
  const name = ((m.client || 'export') + '_' + (m.name || 'projet')).replace(/\s+/g, '_').replace(/[^\w\-]/g, '');

  try {
    const savePath = await invoke('save_md_dialog', { name });
    if (!savePath) return;
    await invoke('write_project', { path: savePath, data: md });
    showSaveIndicator('saved');
  } catch (e) {
    showSaveIndicator('error');
    console.error('MD export failed:', e);
  }
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

// ═══ PROJECT SETTINGS MODAL ═══
function openProjectSettings() {
  const g = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  g('ps-meta-name',      projectMeta.name      || '');
  g('ps-meta-client',    projectMeta.client    || '');
  g('ps-meta-pm',        projectMeta.pm        || '');
  g('ps-meta-cdptech',   projectMeta.cdptech   || '');
  g('ps-meta-resplog',   projectMeta.respLog   || '');
  g('ps-meta-erpconsult',projectMeta.erpConsult|| '');
  const folderDisplay = document.getElementById('ps-folder-display');
  if (folderDisplay) folderDisplay.textContent = projectMeta.autoSavePath || 'Aucun';
  const intervalInput = document.getElementById('ps-interval');
  if (intervalInput) intervalInput.value = projectMeta.autoSaveIntervalMins || 5;
  renderProjectOwnerList();
  const jiraKey = document.getElementById('ps-jira-key');
  if (jiraKey) jiraKey.value = projectMeta.jiraProjectKey || '';
  const sourceDisplay = document.getElementById('ps-source-path-display');
  if (sourceDisplay) sourceDisplay.textContent = projectMeta.sourcePath || 'Aucun (chemin par défaut)';
  const modal = document.getElementById('modal-project-settings');
  if (modal) modal.classList.add('open');
}
function renderProjectOwnerList() {
  const list = document.getElementById('ps-owner-list');
  if (!list) return;
  const opts = Array.isArray(projectMeta.ownerOptions) ? projectMeta.ownerOptions : [];
  list.innerHTML = opts.length === 0
    ? `<p class="settings-hint" style="margin:0;font-style:italic">Aucune valeur (défaut : Intégrateur, Autre)</p>`
    : opts.map((v, i) => `
        <div class="settings-tag-row">
          <span>${v.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</span>
          <button class="btn btn-ghost btn-sm btn-danger-ghost" onclick="removeProjectOwnerOption(${i})">✕</button>
        </div>`).join('');
}
async function addProjectOwnerOption() {
  const input = document.getElementById('ps-owner-new');
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;
  if (!Array.isArray(projectMeta.ownerOptions)) projectMeta.ownerOptions = [];
  if (projectMeta.ownerOptions.includes(val)) return;
  projectMeta.ownerOptions.push(val);
  _ownerOptions = projectMeta.ownerOptions;
  input.value = '';
  renderProjectOwnerList();
  renderGantt();
  renderTaches();
  debouncedSave();
}
function removeProjectOwnerOption(idx) {
  if (!Array.isArray(projectMeta.ownerOptions)) return;
  projectMeta.ownerOptions.splice(idx, 1);
  _ownerOptions = projectMeta.ownerOptions.length > 0 ? projectMeta.ownerOptions : ['Intégrateur', 'Autre'];
  renderProjectOwnerList();
  renderGantt();
  renderTaches();
  debouncedSave();
}
function closeProjectSettings() {
  const modal = document.getElementById('modal-project-settings');
  if (modal) modal.classList.remove('open');
}
function saveMetaFromSettings() {
  const r = id => document.getElementById(id)?.value || '';

  // Capture old resolved names before overwriting — needed to patch baked-in task names
  const oldPm     = projectMeta.pm         || '';
  const oldCdp    = projectMeta.cdptech    || '';
  const oldRl     = projectMeta.respLog    || '';
  const oldErp    = projectMeta.erpConsult || '';
  const oldClient = projectMeta.client     || '';

  projectMeta.name       = r('ps-meta-name');
  projectMeta.pm         = r('ps-meta-pm');
  projectMeta.client     = r('ps-meta-client');
  projectMeta.cdptech    = r('ps-meta-cdptech');
  projectMeta.respLog    = r('ps-meta-resplog');
  projectMeta.erpConsult = r('ps-meta-erpconsult');

  // For tasks where the actual name was baked in (not a token placeholder),
  // replace the old name with the new one so congés rows stay in sync.
  // Skip if oldVal is itself a token — formatTemplate handles those at render time.
  const tokens = new Set([TOKEN_PM, TOKEN_CDP, TOKEN_RL, TOKEN_ERP, TOKEN_CLIENT]);
  const nameChanges = [
    [oldPm,     projectMeta.pm],
    [oldCdp,    projectMeta.cdptech],
    [oldRl,     projectMeta.respLog],
    [oldErp,    projectMeta.erpConsult],
    [oldClient, projectMeta.client],
  ];
  tasks.forEach(task => {
    if (!task.isUnavail) return;
    nameChanges.forEach(([oldVal, newVal]) => {
      if (oldVal && newVal !== oldVal && !tokens.has(oldVal) && task.name.includes(oldVal))
        task.name = task.name.replaceAll(oldVal, newVal);
    });
  });

  // Keep pi-* inputs in sync so Planning tab header stays current
  const s = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  s('pi-project',   projectMeta.name);
  s('pi-pm',        projectMeta.pm);
  s('pi-client',    projectMeta.client);
  s('pi-cdptech',   projectMeta.cdptech);
  s('pi-resplog',   projectMeta.respLog);
  s('pi-erpconsult',projectMeta.erpConsult);
  const title = 'WMS Planning — ' + (projectMeta.name || 'Sans titre');
  setWindowTitle(title); document.title = title;
  renderGantt(); renderTaches();
  debouncedSave();
}
async function pickAutoSavePath() {
  const folder = await invoke('pick_folder');
  if (!folder) return;
  projectMeta.autoSavePath = folder;
  _lastSecondaryBackupTime = 0;
  const display = document.getElementById('ps-folder-display');
  if (display) display.textContent = folder;
  debouncedSave();
}
function resetAutoSavePath() {
  projectMeta.autoSavePath = '';
  _lastSecondaryBackupTime = 0;
  const display = document.getElementById('ps-folder-display');
  if (display) display.textContent = 'Aucun';
  debouncedSave();
}
function saveAutoSaveInterval() {
  const val = parseInt(document.getElementById('ps-interval')?.value || '5', 10);
  projectMeta.autoSaveIntervalMins = isNaN(val) || val < 1 ? 5 : val;
  debouncedSave();
}
function saveJiraProjectKey() {
  projectMeta.jiraProjectKey = (document.getElementById('ps-jira-key')?.value || '').trim().toUpperCase();
  debouncedSave();
}
async function pickSourcePath() {
  const path = await invoke('open_dialog');
  if (!path) return;
  projectMeta.sourcePath = path;
  const display = document.getElementById('ps-source-path-display');
  if (display) display.textContent = path;
  debouncedSave();
}
function resetSourcePath() {
  projectMeta.sourcePath = '';
  const display = document.getElementById('ps-source-path-display');
  if (display) display.textContent = 'Aucun (chemin par défaut)';
  debouncedSave();
}

// ═══ WINDOW EXPORTS (for onclick handlers in HTML) ═══
Object.assign(window, {
  goHome, reloadProject, undoDelete, toggleRagDropdown, closeRagDropdown,
  syncNav, onMetaInput, handleInstallOrigChange, openInstallDelaySection, clearInstallDelay,
  openAddPhaseModal, openAddTaskModal, openEditTask, openEditPhase,
  closeModal, saveTask, savePhase,
  deleteTask, deleteTaskFromModal, removePhase, removePhaseFromModal, updateTask,
  scrollToToday, renderGantt, renderDashboard, exportPDF, exportCurrentTabPDF, toggleGanttEditMode, togglePhaseCollapse,
  addTaskSegment, removeTaskSegment,
  setRag,
  openManageTabsModal, saveManageTabs, resetTabOrder,
  renderJira, syncJira,
  renderTaches, renderInstall,
  addInternalTask, openEditInternalTask, saveInternalTask, deleteInternalTask, deleteInternalTaskFromModal,
  addInterface, openEditInterface, saveInterface, deleteInterfaceFromModal,
  openEditFonctionnel, saveFonctionnel, deleteFonctionnelFromModal, addFonctionnel,
  openEditDryrun, saveDryrun, deleteDryrunFromModal, addDryrun,
  addInstall, openEditInstall, saveInstall, deleteInstallFromModal, deleteInstall,
  addJalon, openEditJalon, saveJalon, deleteJalonFromModal, autoCalcJalonPct,
  renderFacturation,
  openAddDeplExpense, saveDeplExpense, deleteDeplExpense, toggleDeplHistory,
  addCustomHeuresRow, deleteHeuresRow, deleteHeuresFromModal, openEditHeure, saveHeures, toggleHeuresHistory,
  updateHeures, updateHeuresDesc, updateHeureCat, updateHeureHistNote,
  openProjectSettings, closeProjectSettings, saveMetaFromSettings,
  pickAutoSavePath, resetAutoSavePath, saveAutoSaveInterval,
  saveJiraProjectKey, pickSourcePath, resetSourcePath,
  addProjectOwnerOption, removeProjectOwnerOption,
  openExportHTMLModal, doExportHTML, exportSelectAll, exportMarkdown,
  openDashCustomize, saveDashCustomize,
  openAddCustomTabModal, openEditCustomTabModal, addCustomTabColumn, saveCustomTab,
  renderCtColumns, ctColLabel, ctColType, ctColOptions, ctColRemove,
  renderCustomTabs, renderCustomTabRows, addCustomTabRow, deleteCustomTabRow, deleteCustomTab, ctSetCell,
  openEditCustomTabRow, saveCustomTabRowFromModal, deleteCustomTabRowFromModal,
});

initResizableTables();

// ═══ INIT ═══
getAppVersion().then(v => {
  const el = document.getElementById('nav-app-version');
  if (el) el.textContent = `v${v}`;
});

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
