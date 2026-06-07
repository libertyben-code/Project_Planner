// home.js — WMS Project Planner home screen logic
import { invoke, setWindowTitle, getAppVersion, checkForUpdates, installUpdate } from './tauri-ipc.js';
import { t, setLanguage, getCurrentLang, applyStaticI18n } from './i18n.js';

setWindowTitle('WMS Project Planner');

// ── State ────────────────────────────────────────────────────────────────────
let recent = [];       // [{ name, client, pm, path, updatedAt, installStatus, installProgress, dryRunProgress }]
let filteredRecent = [];
let pendingConfirm = null;  // fn to call when user clicks "Confirmer"
let appSettings = { saveFolder: '', companyName: '', lightMode: false, templatePath: '', language: 'fr', jiraConfig: { url: '', email: '', token: '' } };

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const rawSettings = await invoke('read_settings');
    const loaded = typeof rawSettings === 'string' ? JSON.parse(rawSettings) : (rawSettings || {});
    appSettings = { ...appSettings, ...loaded, jiraConfig: { ...appSettings.jiraConfig, ...(loaded.jiraConfig || {}) } };
  } catch { appSettings = { saveFolder: '', companyName: '', lightMode: false, templatePath: '', language: 'fr', jiraConfig: { url: '', email: '', token: '' } }; }

  setLanguage(appSettings.language || 'fr');
  applyTheme();
  applyStaticI18n(document);

  getAppVersion().then(v => {
    const badge = document.getElementById('app-version');
    if (badge) badge.textContent = `v${v}`;
    const settingsVer = document.getElementById('settings-version-text');
    if (settingsVer) settingsVer.textContent = `WMS Project Planner v${v}`;
  });

  try {
    const raw = await invoke('read_recent');
    // Tauri returns a JSON string; browser stub may return a parsed array — handle both
    recent = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
  } catch { recent = []; }

  if (!appSettings.examplesSeeded) {
    try {
      await seedExamples();
      appSettings.examplesSeeded = true;
      await persistSettings();
    } catch { /* non-blocking */ }
  }

  render();
  loadPortfolioData();
  checkForUpdates().then(r => {
    if (r?.available) showUpdateBanner(r.version, r.notes);
  }).catch(() => {});
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
    <div>${t('home.btn.new')}</div>
  </div>`;
  grid.innerHTML = html;
}

function cardHTML(p) {
  const badge = statusBadge(p);
  const locale = getCurrentLang() === 'en' ? 'en-GB' : getCurrentLang() === 'es' ? 'es-ES' : 'fr-FR';
  const updated = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString(locale, { day:'2-digit', month:'short', year:'numeric' }) : '—';
  const installPct = p.installProgress || '—';
  const dryPct    = p.dryRunProgress  || '—';

  // Path stored in data-path attribute (HTML-safe); onclick reads it back via dataset.path
  // This avoids JS escape sequence corruption of Windows backslashes in inline onclick strings.
  const ragClass = p.rag ? ` rag-border-${p.rag.toLowerCase()}` : '';
  const ragTitle = p.rag ? ` title="${t('rag.project_status')} : ${p.rag === 'G' ? t('rag.ok') : p.rag === 'A' ? t('rag.attention') : t('rag.blocked')}"` : '';
  return `<div class="project-card${ragClass}" data-path="${esc(p.path)}" onclick="openProjectCard(this.dataset.path)"${ragTitle}>
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
      <div class="card-date">${t('home.card.modified')} ${updated}</div>
      <div class="card-actions" onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-icon btn-sm" title="${t('home.card.share')}" onclick="shareProject(this.closest('.project-card').dataset.path)">📤</button>
        <button class="btn btn-ghost btn-icon btn-sm" title="${t('home.card.duplicate')}" onclick="duplicateProject(this.closest('.project-card').dataset.path)">⧉</button>
        <button class="btn btn-ghost btn-icon btn-sm" title="${t('home.card.remove')}" onclick="removeFromRecent(this.closest('.project-card').dataset.path)">✕</button>
        <button class="btn btn-ghost btn-icon btn-sm btn-danger-ghost" title="${t('home.card.delete')}" onclick="deleteProject(this.closest('.project-card').dataset.path)">🗑</button>
      </div>
    </div>
  </div>`;
}

function statusBadge(p) {
  if (p.installDateActual) {
    return `<span class="status-badge badge-termine">${t('home.card.status.done')}</span>`;
  }
  if (p.installDateDelayed) {
    return `<span class="status-badge badge-retarde">${t('home.card.status.delayed')}</span>`;
  }
  return `<span class="status-badge badge-en-cours">${t('home.card.status.active')}</span>`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Language ──────────────────────────────────────────────────────────────────
window.saveLanguage = async function(lang) {
  setLanguage(lang);
  appSettings.language = lang;
  await persistSettings();
  applyStaticI18n(document);
  render();
  loadPortfolioData();
};

// ── Theme ─────────────────────────────────────────────────────────────────────
function applyTheme() {
  document.documentElement.setAttribute('data-theme', appSettings.lightMode ? 'light' : 'dark');
}

window.toggleTheme = async function() {
  appSettings.lightMode = document.getElementById('settings-light-mode').checked;
  await persistSettings();
  applyTheme();
};

// ── Tab switching ─────────────────────────────────────────────────────────────
window.switchTab = function(id) {
  ['projects', 'portfolio'].forEach(t => {
    document.getElementById(`tab-panel-${t}`).style.display = t === id ? '' : 'none';
    document.getElementById(`tab-btn-${t}`).classList.toggle('active', t === id);
  });
};

// ── Filter ───────────────────────────────────────────────────────────────────
window.filterCards = render;

// ── Open project ──────────────────────────────────────────────────────────────
window.openProjectCard = async function(path) {
  try {
    const raw = await invoke('read_project', { path });
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const sourcePath = data.meta?.sourcePath;
    if (sourcePath && sourcePath !== path) {
      try {
        const srcRaw = await invoke('read_project', { path: sourcePath });
        const srcData = typeof srcRaw === 'string' ? JSON.parse(srcRaw) : srcRaw;
        srcData.meta = { ...srcData.meta, sourcePath };
        await invoke('write_project', { path, data: JSON.stringify(srcData) });
      } catch { /* source unreachable — use local copy */ }
    }
  } catch { /* file unreadable — let app.html handle error */ }
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

  // Load template (custom or default)
  let template;
  try {
    if (appSettings.templatePath) {
      const raw = await invoke('read_project', { path: appSettings.templatePath });
      template = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } else {
      const lang = getCurrentLang();
      const templateFile = lang === 'en' ? './template.en.json' : lang === 'es' ? './template.es.json' : './template.json';
      const res = await fetch(templateFile);
      template = await res.json();
    }
  } catch {
    try {
      const lang = getCurrentLang();
      const templateFile = lang === 'en' ? './template.en.json' : lang === 'es' ? './template.es.json' : './template.json';
      const res = await fetch(templateFile);
      template = await res.json();
    } catch {
      showToast(t('error.template_not_found'));
      return;
    }
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
    loadPortfolioData();
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
      loadPortfolioData();
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
      loadPortfolioData();
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
    rag:                meta.rag || '',
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
  display.textContent = appSettings.saveFolder || t('settings.folder.default');
  document.getElementById('settings-company-name').value = appSettings.companyName || '';
  document.getElementById('settings-light-mode').checked = appSettings.lightMode || false;
  const langSelect = document.getElementById('settings-language');
  if (langSelect) langSelect.value = appSettings.language || getCurrentLang();
  const tplDisplay = document.getElementById('settings-template-display');
  if (tplDisplay) tplDisplay.textContent = appSettings.templatePath
    ? appSettings.templatePath.split(/[\\/]/).pop()
    : t('settings.template.default');
  const jc = appSettings.jiraConfig || {};
  const jiraUrl = document.getElementById('settings-jira-url');
  if (jiraUrl) jiraUrl.value = jc.url || '';
  const jiraEmail = document.getElementById('settings-jira-email');
  if (jiraEmail) jiraEmail.value = jc.email || '';
  const jiraToken = document.getElementById('settings-jira-token');
  if (jiraToken) jiraToken.value = jc.token || '';
  document.getElementById('modal-settings').classList.add('open');
};

window.saveJiraCredentials = async function() {
  if (!appSettings.jiraConfig) appSettings.jiraConfig = { url: '', email: '', token: '' };
  appSettings.jiraConfig.url   = (document.getElementById('settings-jira-url')?.value || '').trim().replace(/\/$/, '');
  appSettings.jiraConfig.email = (document.getElementById('settings-jira-email')?.value || '').trim();
  appSettings.jiraConfig.token = (document.getElementById('settings-jira-token')?.value || '').trim();
  await persistSettings();
};

window.saveCompanyName = async function() {
  appSettings.companyName = document.getElementById('settings-company-name').value.trim();
  await persistSettings();
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
  document.getElementById('settings-folder-display').textContent = t('settings.folder.default');
  await persistSettings();
  showToast('Dossier réinitialisé au défaut.');
};

window.pickTemplatePath = async function() {
  const path = await invoke('open_dialog');
  if (!path) return;
  appSettings.templatePath = path;
  const display = document.getElementById('settings-template-display');
  if (display) display.textContent = path.split(/[\\/]/).pop();
  await persistSettings();
  showToast('Template mis à jour.');
};

window.resetTemplatePath = async function() {
  appSettings.templatePath = '';
  const display = document.getElementById('settings-template-display');
  if (display) display.textContent = t('settings.template.default');
  await persistSettings();
  showToast('Template réinitialisé.');
};

document.getElementById('modal-settings').addEventListener('click', function(e) {
  if (e.target === this) closeSettings();
});

// ── Seed examples on first run ────────────────────────────────────────────────
async function seedExamples() {
  const lang = getCurrentLang();
  let baseDir;
  try { baseDir = await invoke('get_app_data_dir'); } catch { return; }

  const sep = baseDir.includes('\\') ? '\\' : '/';
  const examplesDir = [baseDir, 'projects', 'Exemples'].join(sep);

  for (let i = 1; i <= 3; i++) {
    const file = `./example.${lang}.${i}.wmsplan`;
    try {
      const res = await fetch(file);
      if (!res.ok) continue;
      const data = await res.json();
      data.meta.id = uid();
      const filename = `example.${lang}.${i}.wmsplan`;
      const fullPath = examplesDir + sep + filename;
      await invoke('write_project', { path: fullPath, data: JSON.stringify(data, null, 2) });
      await addToRecent(data.meta, fullPath);
    } catch { /* skip */ }
  }
}

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

// ══════════════════════════════════════════════════════
//  PORTFOLIO DASHBOARD
// ══════════════════════════════════════════════════════

window.togglePfSection = function(id) {
  const section = document.getElementById(id);
  if (!section) return;
  const open = section.classList.toggle('open');
  section.querySelector('.pf-chevron').textContent = open ? '▾' : '▸';
};

function wdLeft(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  const y = target.getFullYear();
  if (y < 2000 || y > 2100) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (target <= today) return null;
  let count = 0; const d = new Date(today);
  while (d <= target) { const day = d.getDay(); if (day !== 0 && day !== 6) count++; d.setDate(d.getDate() + 1); }
  return count;
}

async function loadPortfolioData() {
  if (!recent.length) {
    document.getElementById('portfolio-loading').textContent = t('pf.no_projects');
    return;
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
  const monthEnd = new Date(today); monthEnd.setDate(today.getDate() + 30);

  const results = await Promise.allSettled(
    recent.map(async p => {
      const raw = await invoke('read_project', { path: p.path });
      const data = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
      const meta = data.meta || {};
      const tasks = data.tasks || [];
      const billing = [...(data.billing?.jalonsProjet || []), ...(data.billing?.jalonsEquipement || [])];
      const heures = data.heuresData || [];
      const install = data.install || [];
      const dryrun = data.dryRun || [];

      // Task stats
      const nonUnavail = tasks.filter(t => !t.isUnavail);
      const done = nonUnavail.filter(t => t.status === 'Terminé').length;
      const overdueList = nonUnavail.filter(t => {
        if (t.status === 'Terminé') return false;
        const end = t.segments?.length ? t.segments[t.segments.length-1].end : t.end;
        return end && new Date(end) < today;
      });
      const thisWeekList = nonUnavail.filter(t => {
        if (t.status === 'Terminé') return false;
        const end = t.segments?.length ? t.segments[t.segments.length-1].end : t.end;
        if (!end) return false;
        const d = new Date(end);
        return d >= today && d <= weekEnd;
      });

      // Hours
      const hVente  = heures.filter(r => !r.bold && !r.sep).reduce((s, r) => s + (r.vente || 0), 0);
      const hActuel = heures.filter(r => !r.bold && !r.sep).reduce((s, r) => s + (r.actuel || 0), 0);

      // Billing
      const bTotal = billing.reduce((s, j) => s + (j.montant || 0), 0);
      const bPaid  = billing.filter(j => j.etat === 'Payé').reduce((s, j) => s + (j.montant || 0), 0);

      // Upcoming billing milestones (unpaid, with date, within 30 days)
      const upcomingBilling = billing
        .filter(j => j.etat !== 'Payé' && j.date)
        .filter(j => { const d = new Date(j.date); return d >= today && d <= monthEnd; })
        .map(j => ({ date: j.date, label: j.label || j.jalon || 'Jalon', montant: j.montant || 0, project: meta.name || p.name, path: p.path }));

      // Upcoming install date (not yet done)
      const installDate = meta.installDateDelayed || meta.installDateOriginal;
      const upcomingInstall = (!meta.installDateActual && installDate)
        ? [{ date: installDate, label: t('pf.install_label'), project: meta.name || p.name, path: p.path, delayed: !!meta.installDateDelayed }]
        : [];

      const activeInstallDate = meta.installDateActual || installDate;

      return {
        name: meta.name || p.name,
        client: meta.client || p.client || '—',
        pm: meta.pm || p.pm || '',
        cdptech: meta.cdptech || '',
        rag: meta.rag || '',
        path: p.path,
        installDate,
        installActual: meta.installDateActual,
        installDelayed: !!meta.installDateDelayed,
        installWd: meta.installDateActual ? null : wdLeft(installDate),
        tasks: { total: nonUnavail.length, done, overdue: overdueList, thisWeek: thisWeekList },
        hours: { sold: hVente, actual: hActuel },
        billing: { total: bTotal, paid: bPaid },
        install: { done: install.filter(r => r.etat === 'Oui').length, total: install.length },
        dryrun: { done: dryrun.filter(r => r.etat === 'OK').length, total: dryrun.length },
        upcomingBilling,
        upcomingInstall,
      };
    })
  );

  const projects = results.filter(r => r.status === 'fulfilled').map(r => r.value);
  const failed = results.filter(r => r.status === 'rejected').length;

  if (!projects.length) {
    const msg = failed ? `Impossible de lire les fichiers projet (${failed} erreur${failed > 1 ? 's' : ''}).` : t('pf.no_data');
    document.getElementById('portfolio-body').innerHTML = `<div class="portfolio-loading">${msg}</div>`;
    return;
  }

  // Sync fresh RAG values back to home screen cards
  let ragChanged = false;
  projects.forEach(proj => {
    const entry = recent.find(r => r.path === proj.path);
    if (entry && entry.rag !== proj.rag) { entry.rag = proj.rag; ragChanged = true; }
  });
  if (ragChanged) { render(); persistRecent(); }

  try {
    renderPortfolio(projects);
  } catch (e) {
    document.getElementById('portfolio-body').innerHTML = `<div class="portfolio-loading" style="color:#dc2626">Erreur d'affichage : ${e.message}</div>`;
  }
}

function renderPortfolio(projects) {
  const body = document.getElementById('portfolio-body');
  if (!projects.length) { body.innerHTML = `<div class="portfolio-loading">${t('pf.no_data')}</div>`; return; }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const monthEnd = new Date(today); monthEnd.setDate(today.getDate() + 30);

  // ── KPIs ──
  const total = projects.length;
  const active = projects.filter(p => !p.installActual).length;
  const completed = total - active;
  const ragG = projects.filter(p => p.rag === 'G').length;
  const ragA = projects.filter(p => p.rag === 'A').length;
  const ragR = projects.filter(p => p.rag === 'R').length;
  const totalOverdue = projects.reduce((s, p) => s + p.tasks.overdue.length, 0);
  const totalBillingPaid = projects.reduce((s, p) => s + p.billing.paid, 0);
  const totalBillingAll  = projects.reduce((s, p) => s + p.billing.total, 0);
  const totalHoursSold   = projects.reduce((s, p) => s + p.hours.sold, 0);
  const totalHoursActual = projects.reduce((s, p) => s + p.hours.actual, 0);

  const fmtEur = n => n.toLocaleString('fr-FR') + ' €';
  const pct = (a, b) => b > 0 ? Math.round(a / b * 100) : 0;

  const kpis = `<div class="pf-kpi-strip">
    <div class="pf-kpi"><div class="pf-kpi-val">${active}</div><div class="pf-kpi-lbl">${t('pf.kpi.active')}</div><div class="pf-kpi-sub">${completed} ${t('home.card.status.done').toLowerCase()}</div></div>
    <div class="pf-kpi"><div class="pf-kpi-val" style="display:flex;gap:10px;align-items:center;justify-content:center">
      <span class="rag-dot rag-dot-g" style="width:12px;height:12px"></span><span>${ragG}</span>
      <span class="rag-dot rag-dot-a" style="width:12px;height:12px"></span><span>${ragA}</span>
      <span class="rag-dot rag-dot-r" style="width:12px;height:12px"></span><span>${ragR}</span>
    </div><div class="pf-kpi-lbl">${t('pf.kpi.rag')}</div><div class="pf-kpi-sub">${total - ragG - ragA - ragR} ${t('pf.no_status')}</div></div>
    <div class="pf-kpi"><div class="pf-kpi-val" style="color:${totalOverdue ? '#dc2626' : '#059669'}">${totalOverdue}</div><div class="pf-kpi-lbl">${t('pf.kpi.overdue')}</div><div class="pf-kpi-sub">${t('pf.all')}</div></div>
    <div class="pf-kpi"><div class="pf-kpi-val">${fmtEur(totalBillingPaid)}</div><div class="pf-kpi-lbl">${t('pf.kpi.billing_paid')}</div><div class="pf-kpi-sub">/ ${fmtEur(totalBillingAll)} — ${pct(totalBillingPaid, totalBillingAll)} %</div></div>
    <div class="pf-kpi"><div class="pf-kpi-val">${totalHoursActual} h</div><div class="pf-kpi-lbl">${t('pf.kpi.hours')}</div><div class="pf-kpi-sub">/ ${totalHoursSold} h — ${pct(totalHoursActual, totalHoursSold)} %</div></div>
  </div>`;

  // ── Cette semaine (grouped by project, sorted by project name then date) ──
  const weekAllTasks = projects.flatMap(p =>
    [...p.tasks.overdue.map(tk => ({ ...tk, _proj: p, _late: true })),
     ...p.tasks.thisWeek.map(tk => ({ ...tk, _proj: p, _late: false }))]
  );
  weekAllTasks.sort((a, b) => {
    const pCmp = a._proj.name.localeCompare(b._proj.name, 'fr');
    if (pCmp !== 0) return pCmp;
    if (a._late !== b._late) return a._late ? -1 : 1;
    const aEnd = a.segments?.length ? a.segments[a.segments.length-1].end : a.end;
    const bEnd = b.segments?.length ? b.segments[b.segments.length-1].end : b.end;
    return (aEnd || '').localeCompare(bEnd || '');
  });

  let weekHtml = '';
  if (weekAllTasks.length) {
    let lastProj = null;
    const rows = weekAllTasks.map(tk => {
      const end = tk.segments?.length ? tk.segments[tk.segments.length-1].end : tk.end;
      let groupRow = '';
      if (tk._proj.name !== lastProj) {
        lastProj = tk._proj.name;
        groupRow = `<tr class="pf-group-row" data-path="${esc(tk._proj.path)}" onclick="window.openProjectCard(this.dataset.path)"><td colspan="4">${esc(tk._proj.name)}</td></tr>`;
      }
      return groupRow + `<tr class="pf-row" data-path="${esc(tk._proj.path)}" onclick="window.openProjectCard(this.dataset.path)" style="cursor:pointer">
        <td style="padding-left:20px">${tk._late ? '<span class="pf-late">⚠</span> ' : ''}${esc(tk.name || '')}</td>
        <td>${esc(tk.owner || '—')}</td>
        <td style="white-space:nowrap">${end ? fmtDateShort(end) : '—'}</td>
        <td>${tk._late ? `<span class="pf-late">${t('pf.late')}</span>` : ''}</td>
      </tr>`;
    }).join('');
    weekHtml = `<div class="pf-section pf-collapsible" id="pf-week">
      <div class="pf-section-title pf-toggle" onclick="window.togglePfSection('pf-week')">
        <span>${t('pf.week_title')}</span>
        <span class="pf-count-badge">${weekAllTasks.length}</span>
        <span class="pf-chevron">▸</span>
      </div>
      <div class="pf-section-body">
        <table class="pf-table"><thead><tr><th>${t('pf.col.task_week')}</th><th>${t('pf.col.pm')}</th><th>${t('pf.col.fin_prev')}</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      </div>
    </div>`;
  }

  // ── Événements à venir (30 j, grouped by project) ──
  const upcoming = projects.flatMap(p => [
    ...p.upcomingInstall.filter(e => { const d = new Date(e.date); return d >= today && d <= monthEnd; }),
    ...p.upcomingBilling,
  ]);
  upcoming.sort((a, b) => {
    const pCmp = (a.project || '').localeCompare(b.project || '', 'fr');
    if (pCmp !== 0) return pCmp;
    return new Date(a.date) - new Date(b.date);
  });

  let upcomingHtml = '';
  if (upcoming.length) {
    let lastProjUp = null;
    const rows = upcoming.map(e => {
      const daysLeft = Math.round((new Date(e.date) - today) / 86400000);
      const urgCls = daysLeft <= 7 ? 'pf-urgent' : daysLeft <= 14 ? 'pf-warn' : '';
      const typeIcon = e.montant !== undefined ? '💶' : (e.delayed ? '⚠ ' : '🏭');
      const detail = e.montant !== undefined ? fmtEur(e.montant) : (e.delayed ? t('pf.delayed') : '');
      let groupRow = '';
      if (e.project !== lastProjUp) {
        lastProjUp = e.project;
        groupRow = `<tr class="pf-group-row" data-path="${esc(e.path)}" onclick="window.openProjectCard(this.dataset.path)"><td colspan="5">${esc(e.project)}</td></tr>`;
      }
      return groupRow + `<tr class="pf-row ${urgCls}" data-path="${esc(e.path)}" onclick="window.openProjectCard(this.dataset.path)" style="cursor:pointer">
        <td style="white-space:nowrap;padding-left:20px">${fmtDateShort(e.date)}</td>
        <td>${typeIcon} ${esc(e.label)}</td>
        <td style="text-align:right">${detail}</td>
        <td><span class="pf-days ${urgCls}">J-${daysLeft}</span></td>
        <td></td>
      </tr>`;
    }).join('');
    upcomingHtml = `<div class="pf-section pf-collapsible" id="pf-upcoming">
      <div class="pf-section-title pf-toggle" onclick="window.togglePfSection('pf-upcoming')">
        <span>${t('pf.upcoming_title')}</span>
        <span class="pf-count-badge">${upcoming.length}</span>
        <span class="pf-chevron">▸</span>
      </div>
      <div class="pf-section-body">
        <table class="pf-table"><thead><tr><th>${t('pf.col.date')}</th><th>${t('pf.col.event')}</th><th style="text-align:right">${t('pf.col.amount')}</th><th>${t('pf.col.delay')}</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      </div>
    </div>`;
  }

  // ── Santé du portefeuille ──
  const healthRows = projects.map(p => {
    const taskPct = p.tasks.total > 0 ? pct(p.tasks.done, p.tasks.total) : 0;
    const hPct = p.hours.sold > 0 ? pct(p.hours.actual, p.hours.sold) : 0;
    const hOver = p.hours.actual > p.hours.sold;
    const bPct = p.billing.total > 0 ? pct(p.billing.paid, p.billing.total) : 0;
    const ragDot = p.rag ? `<span class="rag-dot rag-dot-${p.rag.toLowerCase()}" style="width:13px;height:13px;display:inline-block;border-radius:50%;vertical-align:middle"></span>` : '<span style="display:inline-block;width:13px"></span>';
    const installDateStr = p.installActual ? `<span style="color:#059669">✓ ${fmtDateShort(p.installActual)}</span>`
      : p.installDate ? (p.installDelayed ? `<span style="color:#ea580c">⚠ ${fmtDateShort(p.installDate)}</span>` : fmtDateShort(p.installDate))
      : '—';
    const wdBadge = p.installWd !== null && p.installWd !== undefined
      ? ` <span style="font-size:10px;padding:1px 5px;border-radius:8px;font-weight:600;background:${p.installWd <= 30 ? '#fef2f2' : p.installWd <= 60 ? '#fffbeb' : '#f0fdf4'};color:${p.installWd <= 30 ? '#dc2626' : p.installWd <= 60 ? '#d97706' : '#059669'}">${p.installWd} j.o.</span>`
      : '';
    const installStr = installDateStr + wdBadge;
    return `<tr class="pf-row" data-path="${esc(p.path)}" data-pm="${esc(p.pm)}" data-cdptech="${esc(p.cdptech)}" onclick="window.openProjectCard(this.dataset.path)" style="cursor:pointer">
      <td><strong>${esc(p.name)}</strong></td>
      <td style="color:var(--text-muted)">${esc(p.client)}</td>
      <td style="font-size:11px">${esc(p.pm) || '—'}</td>
      <td style="font-size:11px">${esc(p.cdptech) || '—'}</td>
      <td>${ragDot}</td>
      <td><div class="pf-mini-bar"><div style="width:${taskPct}%;background:var(--accent)"></div></div><span class="pf-bar-lbl">${p.tasks.done}/${p.tasks.total}</span>${p.tasks.overdue.length ? `<span class="pf-late"> ⚠${p.tasks.overdue.length}</span>` : ''}</td>
      <td><span style="color:${hOver ? '#dc2626' : 'inherit'}">${p.hours.actual}/${p.hours.sold} h</span></td>
      <td><div class="pf-mini-bar"><div style="width:${bPct}%;background:#059669"></div></div><span class="pf-bar-lbl">${fmtEur(p.billing.paid)}</span></td>
      <td>${installStr}</td>
      <td style="font-size:11px;color:var(--text-muted)">${p.install.total ? p.install.done+'/'+p.install.total : '—'} · ${p.dryrun.total ? p.dryrun.done+'/'+p.dryrun.total : '—'}</td>
    </tr>`;
  }).join('');

  const pmValues   = [...new Set(projects.map(p => p.pm).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  const cdpValues  = [...new Set(projects.map(p => p.cdptech).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  const filterBar  = (pmValues.length > 1 || cdpValues.length > 1) ? `
    <div class="pf-filter-bar">
      ${pmValues.length > 1 ? `<select id="pf-filter-pm" class="pf-filter-select" onchange="window.filterHealthTable()"><option value="">${t('pf.filter.all_pm')}</option>${pmValues.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select>` : ''}
      ${cdpValues.length > 1 ? `<select id="pf-filter-cdp" class="pf-filter-select" onchange="window.filterHealthTable()"><option value="">${t('pf.filter.all_cdp')}</option>${cdpValues.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select>` : ''}
    </div>` : '';

  window.filterHealthTable = function() {
    const pmVal  = (document.getElementById('pf-filter-pm')  || {}).value || '';
    const cdpVal = (document.getElementById('pf-filter-cdp') || {}).value || '';
    document.querySelectorAll('#pf-health-tbody tr').forEach(tr => {
      const ok = (!pmVal  || tr.dataset.pm      === pmVal)
              && (!cdpVal || tr.dataset.cdptech  === cdpVal);
      tr.style.display = ok ? '' : 'none';
    });
  };

  const healthHtml = `<div class="pf-section pf-health-section">
    <div class="pf-section-title">${t('pf.health')}</div>
    ${filterBar}
    <table class="pf-table pf-health-table"><thead><tr><th>${t('pf.col.project')}</th><th>${t('pf.col.client')}</th><th>${t('pf.col.pm')}</th><th>${t('pf.col.cdp')}</th><th>${t('pf.col.rag')}</th><th>${t('pf.col.tasks')}</th><th>${t('pf.col.hours')}</th><th>${t('pf.col.billing')}</th><th>${t('pf.col.install')}</th><th>${t('pf.col.checklists')}</th></tr></thead><tbody id="pf-health-tbody">${healthRows}</tbody></table>
  </div>`;

  body.innerHTML = healthHtml + kpis + weekHtml + upcomingHtml;
}

function fmtDateShort(iso) {
  if (!iso) return '—';
  const locale = getCurrentLang() === 'en' ? 'en-GB' : getCurrentLang() === 'es' ? 'es-ES' : 'fr-FR';
  try { return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: '2-digit' }); }
  catch { return iso; }
}

// Expose so pf-row onclick works
window.openProjectCard = async function(path) {
  if (!path) return;
  navigateToApp(path);
};

// ── Update check ─────────────────────────────────────────────────────────────
function showUpdateBanner(version, notes) {
  const banner = document.getElementById('update-banner');
  const text   = document.getElementById('update-banner-text');
  if (!banner || !text) return;
  text.textContent = `Version ${version} disponible.`;
  banner.style.display = 'flex';
  const notesEl    = document.getElementById('update-notes');
  const statusEl   = document.getElementById('update-status');
  const installBtn = document.getElementById('btn-install-update');
  if (notesEl && notes)  notesEl.textContent  = notes;
  if (statusEl)          statusEl.textContent = `Version ${version} disponible.`;
  if (installBtn)        installBtn.style.display = 'inline-block';
}

window.dismissUpdateBanner = function() {
  const banner = document.getElementById('update-banner');
  if (banner) banner.style.display = 'none';
};

window.installFromBanner = function() {
  window.dismissUpdateBanner();
  window.openSettings();
};

window.checkForUpdatesManual = async function() {
  const btn        = document.getElementById('btn-check-update');
  const statusEl   = document.getElementById('update-status');
  const notesEl    = document.getElementById('update-notes');
  const installBtn = document.getElementById('btn-install-update');
  if (btn)        btn.disabled = true;
  if (statusEl)   statusEl.textContent = 'Vérification…';
  if (notesEl)    notesEl.textContent  = '';
  if (installBtn) installBtn.style.display = 'none';
  try {
    const result = await checkForUpdates();
    if (result?.available) {
      if (statusEl)   statusEl.textContent = `Version ${result.version} disponible.`;
      if (notesEl && result.notes) notesEl.textContent = result.notes;
      if (installBtn) installBtn.style.display = 'inline-block';
    } else if (result?.checkFailed) {
      if (statusEl) statusEl.textContent = 'Vérification impossible (réseau ou aucune release publiée).';
    } else {
      if (statusEl) statusEl.textContent = 'Application à jour.';
    }
  } catch {
    if (statusEl) statusEl.textContent = 'Vérification impossible.';
  } finally {
    if (btn) btn.disabled = false;
  }
};

window.doInstallUpdate = async function() {
  const installBtn = document.getElementById('btn-install-update');
  const statusEl   = document.getElementById('update-status');
  if (installBtn) installBtn.disabled = true;
  if (statusEl)   statusEl.textContent = 'Téléchargement en cours…';
  try {
    await installUpdate();
  } catch (e) {
    if (statusEl)   statusEl.textContent = `Erreur : ${e}`;
    if (installBtn) installBtn.disabled = false;
  }
};

// ── Boot ──────────────────────────────────────────────────────────────────────
init();
