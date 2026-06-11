# Maintainer Guide — WMS Project Planner

## Stack

- **Frontend**: plain HTML + CSS + JavaScript (ES modules, no build step)
- **Desktop shell**: Tauri v2 (Rust + WebView2)
- **Charts**: Chart.js 4 (CDN)
- **Drag & drop**: SortableJS 1.15 (CDN, `forceFallback: true` required for WebView2)
- **PDF export**: jsPDF + html2canvas (CDN)

## Repository layout

```
Project_Planner/
├── renderer/
│   ├── home.html / home.js / home.css   — home screen (project list, settings)
│   ├── app.html                          — main app shell (all tabs, modals)
│   ├── wms.js                            — all app logic (ES module)
│   ├── wms.css                           — all styles
│   ├── template.json                     — blank project seed (no client data)
│   ├── example.wmsplan                   — demo project (half-complete, fictional data)
│   └── tauri-ipc.js                      — thin wrapper: Tauri invoke or localStorage stub
├── src-tauri/
│   ├── src/lib.rs                        — Rust IPC commands
│   ├── tauri.conf.json                   — app config, bundle settings
│   └── Cargo.toml
├── package.json                          — scripts: dev, build
└── MAINTAINER.md                         — this file
```

## Branch strategy

| Branch | Purpose |
| --- | --- |
| `main` | Stable, smoke-tested releases |
| `feature/*` | Feature branches — merge to `main` after smoke test |

All work happens on feature branches. Merge to `main` only after the smoke test below.

## Dev setup

```bash
# Prerequisites (one-time)
# - Rust toolchain: https://rustup.rs
# - Node.js 18+

npm install
npm run dev          # serves renderer/ on localhost:8080 (browser only, no Tauri)
npx tauri dev        # full Tauri window with hot reload
npx tauri build      # produces WMSPlanner.exe in src-tauri/target/release/
```

The `npm run dev` script (`npx serve renderer -l 8080`) lets you iterate on the UI in a browser without rebuilding Rust. All IPC calls fall back to `localStorage` stubs defined in `tauri-ipc.js`.

## Architecture

### ES module / window exports

`wms.js` is loaded as `type="module"`, so nothing is global by default. Every function called from inline HTML `onclick` / `onblur` / `onchange` attributes **must** appear in the `Object.assign(window, {...})` block at the bottom of the file. Missing exports fail silently — this is the most common class of bug.

### State model

All mutable data lives in module-level `let` variables:

```
phases[], tasks[], heuresData[], internalTasks[], interfacesData[],
fonctionnelData[], dryrunData[], installData[], jalonsProjet[], jalonsEquip[],
jiraData, projectMeta, customTabs[]
```

`buildState()` serialises them to a plain object for saving.
`applyState(state)` deserialises and runs a backwards-compat migration loop (adds missing fields to old project files).

Auto-save: every mutation calls `debouncedSave()` (800 ms debounce). `saveProject()`:

1. Calls `write_project_backup` (versioned, AppData).
2. Writes primary `.wmsplan` via `write_project`.
3. On first save of a new calendar day, calls `write_daily_backup` → creates `<project_dir>/Backup/<stem>_YYYYMMDD.wmsplan`.
4. If `projectMeta.autoSavePath` is set and `autoSaveIntervalMins` have elapsed since last secondary save, also writes a copy to `<autoSavePath>/<filename>`.

### Home screen / settings

`home.js` manages the project list, settings, example project loading, and the portfolio dashboard:

- **Settings** (`appSettings`) are loaded from `settings.json` (AppData) on startup and cached in memory. Fields: `saveFolder`, `companyName`, `lightMode`, `templatePath`. Persisted via `write_settings` / `read_settings`.
- **Custom template**: if `appSettings.templatePath` is set, `createProject()` loads that file via `read_project` and uses it as the base state instead of the bundled `template.json`. Falls back to `template.json` on read error.
- **Theme**: `applyTheme()` sets `data-theme="light"` or `"dark"` on `<html>`. `window.toggleTheme()` is called by the Settings modal toggle, saves `appSettings.lightMode`, and calls `applyTheme()`. Called once during `init()` so the theme is restored on page load.
- **Tab switching**: `window.switchTab(id)` shows/hides `#tab-panel-projects` and `#tab-panel-portfolio` and flips the `.active` class on the corresponding `#tab-btn-*` buttons. The tab bar lives inside the `<header>` element, centered via CSS grid (`grid-template-columns: auto 1fr auto`).
- **Save folder**: passed as the optional `folder` param to `get_new_project_path`. If empty/null, Rust falls back to `AppData/projects/`.
- **Example project**: `example.wmsplan` is fetched from the renderer directory, a copy is written to the projects folder with a fresh ID, and the user is navigated to it.

### Portfolio dashboard

Lives in `#tab-panel-portfolio` (the Portfolio tab). Loaded at startup by `loadPortfolioData()`, which reads every file in `recent[]` in parallel via `Promise.allSettled` and passes the results to `renderPortfolio(projects)`. Also called after project delete, remove-from-recent, and duplicate so the portfolio stays current without a page reload.

After a successful load, fresh `rag` values from project files are synced back into `recent[]` so home screen card borders stay current.

Sections rendered in this order into `#portfolio-body`:

- **Santé du portefeuille** — always expanded; one row per project: RAG dot, task progress bar, hours consumed vs. sold, billing collected, install date, checklist counts. Uses `.pf-health-table` for larger row height.
- **KPI strip** — aggregate counts: active/completed, RAG distribution, total overdue tasks, total billing, total hours.
- **Cette semaine & retards** — collapsed by default (`pf-collapsible` + `pf-toggle`). Rows grouped by project under `.pf-group-row` headers; within each project sorted overdue-first then by date. Toggle via `togglePfSection('pf-week')`.
- **Événements à venir — 30 jours** — collapsed by default. Billing milestones and install dates grouped by project, sorted by project name then date. Toggle via `togglePfSection('pf-upcoming')`.

Clicking any data row navigates to that project via `window.openProjectCard(this.dataset.path)` (uses `data-path` attribute, never inline path string — see Windows path safety). Files that fail to read are silently skipped (graceful degradation via `Promise.allSettled`).

### RAG status

`projectMeta.rag` — `'R' | 'A' | 'G' | ''`. Set by `setRag(val)`, callable from the navbar pill dropdown. `_syncRagUI()` updates `#rag-nav-dot` (class `rag-dot-{r|a|g}`) and `#rag-nav-lbl` text; called at the end of `renderDashboard()`. The dropdown (`#rag-nav-dropdown`) is toggled by `toggleRagDropdown(e)` and closed by `closeRagDropdown()` (also wired to `document.addEventListener('click', ...)`).

The home screen card border reflects RAG via `.rag-border-{g|a|r}` on `.project-card`. The `recent[]` entry is updated (1) when a project is saved via `addToRecent`, and (2) after `loadPortfolioData()` syncs fresh values from every project file.

### This week panel

`renderThisWeek()` runs at the end of `renderDashboard()` and populates `#dash-this-week`. It scans `tasks[]` via `taskSegments()` and buckets into two groups: overdue (`end < today`) and active this week (`end <= today+7 || start in [today, today+7]`). Dependency violations are flagged inline with a ⚠ icon.

### Task dependencies

`task.deps = [taskId, …]` — optional array, omitted when empty. `_buildDepsSelect(currentTaskId, selectedDeps)` populates the `#task-deps` multi-select in the task modal; `_readDepsSelect()` reads it back. In `renderGantt()`, a row checks if any dep's last segment end > task.start — if so, the row gets `style.outline = '2px solid #f97316'` and the task name gets a 🔗 icon.

### Tab management

`projectMeta.tabOrder`, `projectMeta.tabHidden`, `projectMeta.tabLabels` persist tab configuration. `_applyTabConfig()` reads these and: applies custom labels to all `.nav-tab` elements, sets `display:none` for hidden tabs, and reorders tab elements in the DOM before the ＋ button. Called from `applyState()` and `renderCustomTabs()`. `BUILTIN_TABS` constant lists all built-in page IDs and default labels.

### Multi-segment tasks

Tasks can carry an optional `segments: [{start, end}]` array for disconnected date ranges (holidays, unavailability). The root `start`/`end` fields always hold the overall span and are kept in sync for backwards compatibility.

Key helpers in `wms.js`:

- `taskSegments(task)` — returns `[{start,end}]`. Falls back to `[{start:task.start, end:task.end}]` for tasks without `segments`, so all rendering code goes through one path.
- `addTaskSegment()` / `removeTaskSegment(btn)` — called from the task modal to add/remove period rows.
- `_populateSegments(segs)` — called by `openAddTaskModal` / `openEditTask` to fill the modal's segment list.

The `isUnavail: true` flag on a task suppresses Statut, Priorité, J, and % Avancement cells in the Gantt — call sites check `if (!task.isUnavail)` before rendering those cells.

When saving, `saveTask()` reads all `.task-seg-row` elements, filters out blanks, sets `task.segments` only when there are 2+, and deletes the property otherwise to keep the JSON clean.

### Shared file / conflict detection

The app uses a Tauri file watcher to detect when another user saves the shared `.wmsplan`. When triggered:

1. `_externalChangeDetected` flag is set to `true` — all subsequent `saveProject()` calls are blocked.
2. A 500 ms delayed read fetches `meta.lastEditedBy` from the updated file and populates `_externalEditorName`.
3. The reload banner updates to show: *"Modifié par [name] — pensez à recharger."*
4. If the user then edits and auto-save fires, `_showConflictModal()` is called instead of writing.
5. The conflict modal offers: **Annuler** (close modal, flag stays set) or **Écraser et sauvegarder** (clears flag, writes, hides banner).
6. **Reloading** (`reloadProject()`) calls `loadProject()` which resets `_externalChangeDetected = false`.

State that is NOT written to the `.wmsplan` and therefore never conflicts between users:
- Column widths → `localStorage` key `col-w:<tbodyId>`
- Per-page zoom → `localStorage` key `pageZoom`
- Phase collapse state → `_collapsedPhases` Set in memory, resets on every load

### Per-page zoom

`_pageZoom` is a module-level object (`{ [pageId]: zoomPercent }`) persisted to `localStorage` under the key `pageZoom`. Range: 50–200, step: 10.

- `_syncZoomDisplay(pageId)` — applies `element.style.zoom = z + '%'` to the page element and updates the `#nav-zoom-display` button text. Called on every page switch (both built-in nav-tab click handler and custom-tab click handler) and once on project load for the initial `page-dashboard`.
- `changeZoom(delta)` — reads the active page via `document.querySelector('.page.active')?.id`, clamps and saves, then calls `_syncZoomDisplay`. Wired to `Ctrl+wheel` on `document`.
- `resetZoom()` — deletes the active page's entry from `_pageZoom` and syncs. Wired to the `#nav-zoom-display` button in `app.html`.

`element.style.zoom` is set on the `.page` div, not on inner containers, so `renderXxx()` calls that only touch children do not reset the zoom.

### Column resizing

`makeResizable(tbodyId)` attaches pointer-event resize handles to all `thead th` elements of the table containing that tbody. Widths are persisted to `localStorage` under `col-w:<tbodyId>` and restored on each render call.

- Called once on init for the standard tables (via `RESIZABLE_TBODIES`).
- Called again after `applyStaticI18n()` in `loadProject()` — **important**: `applyStaticI18n` sets `el.textContent` on `[data-i18n]` elements, which destroys child nodes including the `.col-resize-handle` divs. `applyStaticI18n` now re-appends saved child elements after the text update, and `initResizableTables()` is called immediately after as a safety net.
- Called at the end of `renderCustomTabRows(tabId)` for every custom tab (key: `col-w:tbody-ct-<tabId>`).
- The Gantt fixed columns use a separate `makeGanttResizable(table)` (key: `col-w:gantt`) called at the end of `renderGantt()`, targeting `th.th-fixed` elements only.

### Token system

Five placeholder strings in `template.json` are replaced at render time with values from `projectMeta`:

| Token | Meta field |
|-------|------------|
| `clientName` | `meta.client` |
| `DPName` | `meta.pm` |
| `CDPName` | `meta.cdptech` |
| `RespoLogClient` | `meta.respLog` |
| `ERP Consultant` | `meta.erpConsult` |

`normalizeSpecialLabel(str)` does the substitution. Call it whenever rendering a user-visible string that might contain a token.

### SortableJS and WebView2

WebView2's native HTML5 drag-and-drop API is broken for table rows (rows grey out but never move). Always create SortableJS instances with:

```js
Sortable.create(tbody, { forceFallback: true, fallbackTolerance: 3, ... })
```

Use the destroy-and-recreate pattern (`const ex = Sortable.get(tbody); if (ex) ex.destroy();`) before every `renderXxx()` call that rebuilds a sortable table, so `onEnd` always captures a fresh array reference.

### Windows path safety in inline onclick

Windows paths (`C:\Users\...`) must **never** be embedded as raw string literals in `onclick="fn('...')"` attributes — backslashes are silently dropped by the JavaScript parser (`\U` → `U`, etc.). Always store paths in `data-path` HTML attributes and read them via `this.dataset.path` / `this.closest('[data-path]').dataset.path`.

### Dashboard charts

Each chart is stored in `charts[key]`. Always call `destroyChart(key)` before creating a new instance. `DASH_CHARTS` is the source of truth for which charts exist — adding a chart requires:

1. An entry in `DASH_CHARTS` in `wms.js`
2. A `<canvas id="ch-KEY">` inside a `<div id="card-KEY">` in `app.html`
3. A `destroyChart / isChartVisible / new Chart(...)` block in `renderDashboard()`

### JIRA integration

`normalizeJiraStatus(name)` maps free-text Jira status names to five internal codes: `TO_DO`, `IN_PROGRESS`, `IN_REVIEW`, `BLOCKED`, `DONE`. All internal code compares against these **uppercase** codes — never against raw Jira strings.

`transformJiraIssues(epicsRaw, tasksRaw)` maps the Jira REST API v3 response to the internal schema. Tasks carry `epicId` (the parent epic's key), not `epicKey`. Each task now also carries `priority` (the raw Jira priority name, e.g. `"High"`, `"Medium"`).

`jiraPriorityIcon(name)` converts a Jira priority name to a small coloured badge (`<span>`). Colour table: Blocker → red `⊘`, Highest → red `↑↑`, High → orange `↑`, Medium → yellow `↔`, Low → blue `↓`, Lowest/Trivial → light-blue `↓↓`.

`filterJiraAssignee(val)` sets the module-level `_jiraAssigneeFilter` string and re-renders the JIRA tab. `renderJira()` populates the `#jira-filter-assignee` select from the current task list on every render and applies the filter to each epic's task list. Filter is reset to `''` on every `syncJira()` call.

`syncJira()` is the entry point. It opens the config modal if credentials are missing. It calls `invoke('jira_fetch', ...)` — **not** `fetch()` directly — because WebView2 blocks cross-origin requests to external APIs (CORS). The Rust `jira_fetch` command makes the HTTP call via `reqwest` and returns the response text; `syncJira()` then `JSON.parse`s it.

### WebView2 CORS — external API calls must go through Rust

WebView2 blocks `fetch()` calls to external domains. Any new integration that needs to call an external REST API (Jira, Google Calendar, etc.) **must** route through a Rust `#[tauri::command]` that uses `reqwest`. See `jira_fetch` in `lib.rs` for the pattern.

### HTML export

The export (`doExportHTML`) is **data-driven** — it generates clean static HTML from the in-memory state arrays, not from cloning the live DOM. This avoids IPC size limits and DOM serialisation issues. Key design decisions:

- Each section is built by a local `addSection(id, label, html)` helper that skips unselected tabs.
- Badges are inline-styled spans (no external CSS dependency).
- A minimal `<style>` block is embedded directly in the `<head>`.
- Tab navigation uses a 3-line inline `<script>` (`st(i)` function).
- The file is written via `write_project` (text IPC), which is sufficient for HTML files of reasonable size.

### Custom tabs

Custom tabs are rendered by `buildCustomTabHTML(tab)` + `renderCustomTabRows(tabId)`. Their panel header and button styles intentionally match the standard tabs:

- Panel header: `<span class="panel-title">` + `btn-secondary btn-sm` add button + ghost icon buttons for edit (✏) and delete tab (🗑).
- Row edit button: `btn-secondary btn-sm` with ✏ — opens `modal-edit-ct-row`, which is dynamically populated by `openEditCustomTabRow(tabId, rowId)` based on the tab's column definitions.
- `renderCustomTabRows` calls `makeResizable('tbody-ct-' + tabId)` after every render so column widths are drag-resizable and persisted to `localStorage`.

## Project file format

Files are saved as `.wmsplan` (plain JSON). The schema is defined by `buildState()` in `wms.js`. Key fields:

- `meta` — project header, install dates, JIRA config
  - `meta.lastEditedBy` — display name of the user who last saved (from `appSettings.displayName`; falls back to `'Utilisateur'`)
- `phases[]` / `tasks[]` — Gantt data; tasks optionally carry `segments:[{start,end}]` for multi-period rows and `isUnavail:true` for holiday/absence rows
- `heuresData[]` — hours rows; bold rows have `totalType`, editable rows have `type`
- `jiraData` — `{ epics[], tasks[], lastSync }` populated by `syncJira()`
- `customTabs[]` — user-defined tabs with column definitions and rows

`applyState()` contains a migration block that fixes files created before `totalType` / `type` fields existed on hours rows. Add new migrations there when changing the schema.

## Adding a new tab

1. Add a `<div class="nav-tab" data-page="page-xxx">Label</div>` in `app.html`.
2. Add a `<div class="page" id="page-xxx">...</div>` in `app.html`.
3. Add the corresponding data array to the state model, `buildState()`, and `applyState()`.
4. Add a `renderXxx()` function in `wms.js` and call it from `renderAll()`.
5. Export any functions called from inline HTML in `Object.assign(window, {...})`.
6. Add the tab to the export modal checkbox list in `openExportHTMLModal()` in `wms.js`.
7. Add a section builder in `doExportHTML()` using `addSection('page-xxx', ...)`.

## Tauri IPC commands (Rust — `src-tauri/src/lib.rs`)

| Command | Description |
|---------|-------------|
| `read_project(path)` | Reads a `.wmsplan` file, returns JSON string |
| `write_project(path, data)` | Writes string to file (used for projects, HTML export) |
| `write_file_bytes(path, bytes)` | Writes binary bytes to file (used for PDF export) |
| `write_project_backup(app, path)` | Versioned backup: `AppData/backups/<stem>/<stem>_<ts>.wmsplan`, keeps last 10 |
| `write_daily_backup(path)` | Daily backup: `<project_dir>/Backup/<stem>_YYYYMMDD.wmsplan`, overwrites same-day file, keeps last 30 |
| `get_new_project_path(app, name, folder?)` | Generates a unique `.wmsplan` path in `folder` (or `AppData/projects/` if null) |
| `read_recent(app)` | Reads `AppData/recent.json` |
| `write_recent(app, data)` | Writes `AppData/recent.json` |
| `read_settings(app)` | Reads `AppData/settings.json` |
| `write_settings(app, data)` | Writes `AppData/settings.json` |
| `open_dialog(app)` | Native file picker (`.wmsplan`, `.json`), returns path or null |
| `save_dialog(app, name)` | Native save-as for `.wmsplan` files |
| `export_html_dialog(app, name)` | Native save-as for HTML export |
| `export_html_write(path, content)` | (Legacy — prefer `write_project`) Writes HTML string |
| `save_pdf_dialog(app, name)` | Native save-as for PDF files |
| `save_md_dialog(app, name)` | Native save-as for Markdown files |
| `set_window_title(app, title)` | Updates the window title bar |
| `reveal_file(path)` | Opens Explorer with the file selected |
| `delete_project(path)` | Deletes `.wmsplan` file and its `.bak` if present |
| `pick_folder(app)` | Native folder chooser dialog, returns path or null |
| `get_version()` | Returns `env!("CARGO_PKG_VERSION")` — always in sync with `Cargo.toml` |
| `jira_fetch(url, email, token, body?)` | Proxies an HTTP request to Jira (bypasses WebView2 CORS). POST with JSON body if `body` is provided, GET otherwise. Returns the response body as a string. |

All called via `invoke(cmd, args)` in `tauri-ipc.js`, which falls back to `localStorage` stubs in browser-only mode. `getAppVersion()` (exported from `tauri-ipc.js`) calls `get_version` in Tauri and returns `'dev'` in browser mode.

### FilePath / path safety in Rust

Tauri v2's dialog plugin returns `FilePath` which may contain a `file:///C:/...` URI. **Always** use `file_path_to_string(fp)` (defined in `lib.rs`) to convert — it calls `.into_path()` to extract a proper `PathBuf`, then `to_string_lossy()`. Never call `.to_string()` directly on a `FilePath`.

## Auto-update

### How it works

`tauri-plugin-updater` is registered in `lib.rs`. On startup, `home.js` calls `checkForUpdates()` (fire-and-forget). If an update is found, a banner appears at the top of the home screen. The Settings panel also has a manual "Vérifier les mises à jour" button.

Two custom Rust commands handle the flow:

| Command | Returns | Notes |
| --- | --- | --- |
| `check_update` | `{ available, version?, notes?, checkFailed? }` | Never returns `Err` — network/404 becomes `{ checkFailed: true }` |
| `install_update` | `Ok(())` | Downloads, installs, then calls `app.restart()` |

The public key is in `tauri.conf.json → plugins.updater.pubkey`. The private key must be stored as a GitHub Secret `TAURI_SIGNING_PRIVATE_KEY`. Generated once with `npx tauri signer generate --ci -p ""`.

### JSON schema migration

Every `.wmsplan` file carries `meta.schemaVersion`. `migrateProjectData()` in `wms.js` runs on every project open. Current version: `1`.

When adding a new schema change:

1. Bump `CURRENT_SCHEMA_VERSION` in `wms.js`
2. Add a migration patch inside `migrateProjectData()` for the previous version number
3. Update `template.json` and `example.wmsplan`

### Releasing a new version

```powershell
# 1. Merge feature branch to main, then:
.\scripts\bump-version.ps1 X.Y.Z
git add src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "chore: bump version to X.Y.Z"

# 2. Add FR+EN release notes to CHANGELOG.md (Claude writes these at session end)

# 3. Tag and push — triggers GitHub Actions automatically
git push
git tag vX.Y.Z
git push origin vX.Y.Z
```

CI (`.github/workflows/release.yml`) builds on `windows-latest`, signs the NSIS installer, creates a GitHub Release, uploads the installer + `latest.json`. The release body is extracted from `CHANGELOG.md` for the matching version.

## Building for distribution

```bash
npx tauri build
```

Output:

- `src-tauri/target/release/WMSPlanner.exe` — portable, copy and run
- `src-tauri/target/release/bundle/nsis/WMSPlanner_setup.exe` — installer (~5 MB)

The portable `.exe` is the primary sharing artifact. WebView2 is pre-installed on Windows 11.

## Smoke test checklist

1. Create a project, add tasks, change hours, add a billing jalon — verify auto-save writes the `.wmsplan` file.
2. Close and reopen the project from the home screen — verify all data loads correctly.
3. Duplicate a project from the home screen — verify the copy opens independently.
4. Export HTML with 3 tabs selected — open in browser, confirm read-only, all selected tabs present.
5. Export MD — open in a Markdown viewer, confirm all sections present.
6. Open example project — verify it loads a pre-filled copy in the projects folder.
7. Change save folder in settings — create a project and confirm it lands in the chosen folder.
8. Add a multi-period task (2+ segments) with Indisponibilité checked — confirm Statut/Priorité/J/Avancement cells are blank and each period renders a separate bar.
9. Set RAG to Rouge via the navbar pill — confirm pill turns red, home screen card left border turns red after returning home.
10. Click the **📊 Portfolio** tab — confirm "Santé du portefeuille" table is visible; click "Cette semaine" header — confirm it expands and rows are grouped by project. Delete a project and confirm the portfolio refreshes.
11. Open Settings, toggle **Mode clair** — confirm the entire home screen switches to a light theme. Toggle back to dark and confirm it restores.
12. `WMSPlanner.exe` runs on a machine without Node or Rust installed.
