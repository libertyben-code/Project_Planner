// home.js — WMS Project Planner home screen logic
import { invoke, setWindowTitle } from './tauri-ipc.js';

setWindowTitle('WMS Project Planner');

// ── State ────────────────────────────────────────────────────────────────────
let recent = [];       // [{ name, client, pm, path, updatedAt, installStatus, installProgress, dryRunProgress }]
let filteredRecent = [];
let pendingConfirm = null;  // fn to call when user clicks "Confirmer"
let appSettings = { saveFolder: '' };

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const rawSettings = await invoke('read_settings');
    appSettings = typeof rawSettings === 'string' ? JSON.parse(rawSettings) : (rawSettings || {});
    if (!appSettings.saveFolder) appSettings.saveFolder = '';
  } catch { appSettings = { saveFolder: '' }; }

  try {
    const raw = await invoke('read_recent');
    // Tauri returns a JSON string; browser stub may return a parsed array — handle both
    recent = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
  } catch { recent = []; }
  render();
}

async function persistSettings() {
  await invoke('write_settings', { data: JSON.stringify(appSettings) });
}

async function persistRecent() {
  await invoke('write_recent', { data: JSON.stringify(recent) });
}

// ── Render project cards ──────────────────────────────────────────────────────
function render() {
  const query = document.getElementById('search-input').value.toLowerCase();
  filteredRecent = recent.filter(p =>
    p.name.toLowerCase().includes(query) ||
    (p.client || '').toLowerCase().includes(query)
  );

  const grid = document.getElementById('project-grid');
  const empty = document.getElementById('empty-state');

  if (filteredRecent.length === 0 && recent.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  let html = '';
  filteredRecent.forEach(p => {
    html += cardHTML(p);
  });
  // "New project" card at the end
  html += `<div class="project-card project-card-new" onclick="openNewProjectModal()">
    <div class="new-icon">＋</div>
    <div>Nouveau projet</div>
  </div>`;
  grid.innerHTML = html;
}

function cardHTML(p) {
  const badge = statusBadge(p);
  const updated = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : '—';
  const installPct = p.installProgress || '—';
  const dryPct    = p.dryRunProgress  || '—';

  // Path stored in data-path attribute (HTML-safe); onclick reads it back via dataset.path
  // This avoids JS escape sequence corruption of Windows backslashes in inline onclick strings.
  return `<div class="project-card" data-path="${esc(p.path)}" onclick="openProjectCard(this.dataset.path)">
    <div class="card-top">
      <div class="card-icon">📋</div>
      <div class="card-title-block">
        <div class="card-name">${esc(p.name)}</div>
        <div class="card-client">${esc(p.client || '—')}</div>
      </div>
      ${badge}
    </div>
    <div class="card-meta">
      ${p.pm    ? `<div class="card-meta-item">DP: <strong>${esc(p.pm)}</strong></div>` : ''}
      ${p.cdptech ? `<div class="card-meta-item">CDP: <strong>${esc(p.cdptech)}</strong></div>` : ''}
      ${p.installDateOriginal ? `<div class="card-meta-item">Install: <strong>${fmtDate(p.installDateOriginal)}</strong></div>` : ''}
    </div>
    <div class="card-progress">
      <div class="progress-pill">Install <strong>${installPct}</strong></div>
      <div class="progress-pill">Dry Run <strong>${dryPct}</strong></div>
    </div>
    <div class="card-footer">
      <div class="card-date">Modifié ${updated}</div>
      <div class="card-actions" onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-icon btn-sm" title="Partager (ouvrir dans l'explorateur)" onclick="shareProject(this.closest('.project-card').dataset.path)">📤</button>
        <button class="btn btn-ghost btn-icon btn-sm" title="Dupliquer" onclick="duplicateProject(this.closest('.project-card').dataset.path)">⧉</button>
        <button class="btn btn-ghost btn-icon btn-sm" title="Retirer de la liste (conserver le fichier)" onclick="removeFromRecent(this.closest('.project-card').dataset.path)">✕</button>
        <button class="btn btn-ghost btn-icon btn-sm btn-danger-ghost" title="Supprimer définitivement" onclick="deleteProject(this.closest('.project-card').dataset.path)">🗑</button>
      </div>
    </div>
  </div>`;
}

function statusBadge(p) {
  if (p.installDateActual) {
    return `<span class="status-badge badge-termine">Terminé</span>`;
  }
  if (p.installDateDelayed) {
    return `<span class="status-badge badge-retarde">Retardé</span>`;
  }
  return `<span class="status-badge badge-en-cours">En cours</span>`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Filter ───────────────────────────────────────────────────────────────────
window.filterCards = render;

// ── Open project ──────────────────────────────────────────────────────────────
window.openProjectCard = function(path) {
  navigateToApp(path);
};

window.openProject = async function() {
  const path = await invoke('open_dialog');
  if (!path) return;
  // Verify file exists / is readable
  try {
    const raw = await invoke('read_project', { path });
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    await addToRecent(data.meta, path);
    navigateToApp(path);
  } catch (e) {
    showToast('Impossible d\'ouvrir le fichier : ' + e.message);
  }
};

function navigateToApp(path) {
  const encoded = encodeURIComponent(path);
  window.location.href = `app.html?project=${encoded}`;
}

// ── Create project ────────────────────────────────────────────────────────────
let _clientManuallyEdited = false;

window.openNewProjectModal = function() {
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('np-start').value = today;
  document.getElementById('np-name').value = '';
  document.getElementById('np-client').value = '';
  _clientManuallyEdited = false;
  document.getElementById('modal-new-project').classList.add('open');
  document.getElementById('np-name').focus();
};

window.autoFillClient = function() {
  if (_clientManuallyEdited) return;
  const name = document.getElementById('np-name').value;
  document.getElementById('np-client').value = name;
};

// Mark client as manually edited once the user types in it
document.getElementById('np-client').addEventListener('input', () => {
  _clientManuallyEdited = true;
});

window.closeNewProjectModal = function() {
  document.getElementById('modal-new-project').classList.remove('open');
};

window.createProject = async function() {
  const name = document.getElementById('np-name').value.trim();
  const client = document.getElementById('np-client').value.trim();
  if (!name || !client) {
    showToast('Nom du projet et client requis.');
    return;
  }

  // Load template
  let template;
  try {
    const res = await fetch('./template.json');
    template = await res.json();
  } catch {
    showToast('Erreur: template.json introuvable.');
    return;
  }

  // Fill meta from form
  const now = new Date().toISOString();
  const meta = {
    ...template.meta,
    id: uid(),
    name,
    client,
    pm:        document.getElementById('np-pm').value.trim()        || 'DPName',
    cdptech:   document.getElementById('np-cdptech').value.trim()   || 'CDPName',
    respLog:   document.getElementById('np-resplog').value.trim()   || 'RespoLogClient',
    erpConsult:document.getElementById('np-erpconsult').value.trim()|| 'ERP Consultant',
    startDate:       document.getElementById('np-start').value   || '',
    installDateOriginal: document.getElementById('np-install').value || '',
    installDateDelayed: '',
    installDateActual:  '',
    installDateComment: '',
    endDate:         '',
    createdAt: now,
    updatedAt: now,
  };

  const projectData = { ...template, meta };

  let fullPath;
  try {
    fullPath = await invoke('get_new_project_path', { name, folder: appSettings.saveFolder || null });
  } catch (e) {
    showToast('Erreur création chemin : ' + e);
    return;
  }

  try {
    await invoke('write_project', { path: fullPath, data: JSON.stringify(projectData, null, 2) });
    await addToRecent(meta, fullPath);
    closeNewProjectModal();
    navigateToApp(fullPath);
  } catch (e) {
    showToast('Erreur lors de la création : ' + e.message);
  }
};

// ── Duplicate project ─────────────────────────────────────────────────────────
window.duplicateProject = async function(path) {
  try {
    const raw = await invoke('read_project', { path });
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const now = new Date().toISOString();
    const newName = data.meta.name + ' (copie)';

    const newData = {
      ...data,
      meta: {
        ...data.meta,
        id: uid(),
        name: newName,
        createdAt: now,
        updatedAt: now,
      }
    };

    const fullPath = await invoke('get_new_project_path', { name: newName, folder: appSettings.saveFolder || null });

    await invoke('write_project', { path: fullPath, data: JSON.stringify(newData, null, 2) });
    await addToRecent(newData.meta, fullPath);
    showToast(`Projet dupliqué : ${newName}`);
    render();
  } catch (e) {
    showToast('Erreur : ' + e.message);
  }
};

// ── Share project (reveal file in Explorer for drag-to-Teams / email) ────────
window.shareProject = async function(path) {
  try {
    await invoke('reveal_file', { path });
    showToast('Fichier localisé dans l\'explorateur — partagez-le par Teams ou email.');
  } catch (e) {
    showToast('Erreur : ' + e.message);
  }
};

// ── Remove from recent (does NOT delete file) ─────────────────────────────────
window.removeFromRecent = function(path) {
  showConfirm(
    'Retirer de la liste',
    'Ce projet sera retiré de la liste récente. Le fichier ne sera pas supprimé.',
    async () => {
      recent = recent.filter(p => p.path !== path);
      await persistRecent();
      render();
    }
  );
};

// ── Delete project (removes from list AND deletes file) ───────────────────────
window.deleteProject = function(path) {
  const entry = recent.find(p => p.path === path);
  const name = entry ? entry.name : path.split(/[\\/]/).pop();
  showConfirm(
    'Supprimer le projet',
    `"${name}" sera définitivement supprimé du disque. Cette action est irréversible.`,
    async () => {
      try {
        await invoke('delete_project', { path });
      } catch (e) {
        showToast('Erreur suppression fichier : ' + e);
      }
      recent = recent.filter(p => p.path !== path);
      await persistRecent();
      render();
    }
  );
};

// ── Recent list helpers ───────────────────────────────────────────────────────
async function addToRecent(meta, path) {
  // Remove existing entry for same path, then prepend
  recent = recent.filter(p => p.path !== path);

  // Compute checklist progress from loaded data (if available)
  let installProgress = '—', dryRunProgress = '—';
  try {
    const raw = await invoke('read_project', { path });
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (data.install)  installProgress  = checklistProgress(data.install,  ['Oui']);
    if (data.dryRun)   dryRunProgress   = checklistProgress(data.dryRun,   ['OK']);
  } catch { /* ignore */ }

  recent.unshift({
    name:               meta.name,
    client:             meta.client,
    pm:                 meta.pm,
    cdptech:            meta.cdptech,
    installDateOriginal: meta.installDateOriginal,
    installDateDelayed:  meta.installDateDelayed,
    installDateActual:   meta.installDateActual,
    path,
    updatedAt:          meta.updatedAt,
    installProgress,
    dryRunProgress,
  });

  // Keep max 20 recent
  if (recent.length > 20) recent = recent.slice(0, 20);
  await persistRecent();
}

function checklistProgress(items, doneValues) {
  const done = items.filter(i => doneValues.includes(i.etat)).length;
  return `${done}/${items.length}`;
}

// ── Settings modal ────────────────────────────────────────────────────────────
window.openSettings = function() {
  const display = document.getElementById('settings-folder-display');
  display.textContent = appSettings.saveFolder || 'Dossier par défaut (AppData)';
  document.getElementById('modal-settings').classList.add('open');
};

window.closeSettings = function() {
  document.getElementById('modal-settings').classList.remove('open');
};

window.pickSaveFolder = async function() {
  const folder = await invoke('pick_folder');
  if (!folder) return;
  appSettings.saveFolder = folder;
  document.getElementById('settings-folder-display').textContent = folder;
  await persistSettings();
  showToast('Dossier de sauvegarde mis à jour.');
};

window.resetSaveFolder = async function() {
  appSettings.saveFolder = '';
  document.getElementById('settings-folder-display').textContent = 'Dossier par défaut (AppData)';
  await persistSettings();
  showToast('Dossier réinitialisé au défaut.');
};

document.getElementById('modal-settings').addEventListener('click', function(e) {
  if (e.target === this) closeSettings();
});

// ── Example project ───────────────────────────────────────────────────────────
window.openExampleProject = async function() {
  try {
    const res = await fetch('./example.wmsplan');
    if (!res.ok) throw new Error('example.wmsplan introuvable');
    const data = await res.json();
    const now = new Date().toISOString();
    data.meta.id = uid();
    data.meta.updatedAt = now;
    const fullPath = await invoke('get_new_project_path', { name: data.meta.name, folder: appSettings.saveFolder || null });
    await invoke('write_project', { path: fullPath, data: JSON.stringify(data, null, 2) });
    await addToRecent(data.meta, fullPath);
    navigateToApp(fullPath);
  } catch (e) {
    showToast('Erreur chargement exemple : ' + e.message);
  }
};

// ── Confirm dialog ────────────────────────────────────────────────────────────
function showConfirm(title, msg, onOk) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent = msg;
  pendingConfirm = onOk;
  document.getElementById('confirm-overlay').classList.add('open');
}

window.closeConfirm = function() {
  document.getElementById('confirm-overlay').classList.remove('open');
  pendingConfirm = null;
};

window.confirmOk = async function() {
  document.getElementById('confirm-overlay').classList.remove('open');
  if (pendingConfirm) { await pendingConfirm(); pendingConfirm = null; }
};

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function uid() { return '_' + Math.random().toString(36).slice(2, 11); }

// ── Close modals on overlay click ─────────────────────────────────────────────
document.getElementById('modal-new-project').addEventListener('click', function(e) {
  if (e.target === this) closeNewProjectModal();
});

// ── Keyboard: Escape closes modals ───────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeNewProjectModal();
    closeSettings();
    closeConfirm();
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────────
init();
