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
│   ├── home.html / home.js / home.css   — home screen (project list)
│   ├── app.html                          — main app shell (all tabs, modals)
│   ├── wms.js                            — all app logic (ES module)
│   ├── wms.css                           — all styles
│   ├── template.json                     — blank project seed (no client data)
│   └── tauri-ipc.js                      — thin wrapper: Tauri invoke or localStorage stub
├── src-tauri/
│   ├── src/main.rs                       — Rust IPC commands
│   ├── tauri.conf.json                   — app config, bundle settings
│   └── Cargo.toml
├── package.json                          — scripts: dev, build
├── FEEDBACK.md                           — change request tracker
└── MAINTAINER.md                         — this file
```

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
functionalData[], dryrunData[], installData[], jalonsProjet[], jalonsEquip[],
jiraData, projectMeta, customTabs[]
```

`buildState()` serialises them to a plain object for saving.
`applyState(state)` deserialises and runs a backwards-compat migration loop (adds missing fields to old project files).

Auto-save: every mutation calls `debouncedSave()` (800 ms debounce). `saveProject()` writes a `.bak` backup first, then overwrites the `.wmsplan` file via the `write_project` Tauri command.

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

### Dashboard charts

Each chart is stored in `charts[key]`. Always call `destroyChart(key)` before creating a new instance. `DASH_CHARTS` is the source of truth for which charts exist — adding a chart requires:

1. An entry in `DASH_CHARTS` in `wms.js`
2. A `<canvas id="ch-KEY">` inside a `<div id="card-KEY">` in `app.html`
3. A `destroyChart / isChartVisible / new Chart(...)` block in `renderDashboard()`

### JIRA integration

`normalizeJiraStatus(name)` maps free-text Jira status names to five internal codes: `TO_DO`, `IN_PROGRESS`, `IN_REVIEW`, `BLOCKED`, `DONE`. All internal code compares against these uppercase codes — never against raw Jira strings.

`transformJiraIssues(epicsRaw, tasksRaw)` maps the Jira REST API v3 response to the internal schema. Tasks carry `epicId` (the parent epic's key), not `epicKey`.

`syncJira()` is the entry point. It opens the config modal if credentials are missing.

## Project file format

Files are saved as `.wmsplan` (plain JSON). The schema is defined by `buildState()` in `wms.js` and documented in the plan file. Key fields:

- `meta` — project header, install dates, JIRA config
- `phases[]` / `tasks[]` — Gantt data
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
6. Add the tab to the HTML export modal checkbox list in `app.html`.

## Tauri IPC commands (Rust)

Defined in `src-tauri/src/main.rs`:

- `read_project(path)` — reads a `.wmsplan` file, returns JSON string
- `write_project(path, data)` — writes JSON string to file
- `write_project_backup(path)` — copies file to `<path>.bak`
- `open_dialog()` — native file picker, returns selected path or null
- `save_dialog(name)` — native save-as picker
- `export_html_dialog(name)` — native save-as for HTML export
- `read_recent(app)` — reads `appData/recent.json`
- `write_recent(app, data)` — writes `appData/recent.json`

All called via `tauriInvoke(cmd, args)` in `tauri-ipc.js`, which falls back to `localStorage` stubs in browser-only mode.

## Building for distribution

```bash
npx tauri build
```

Output:

- `src-tauri/target/release/WMSPlanner.exe` — portable, copy and run
- `src-tauri/target/release/bundle/nsis/WMSPlanner_setup.exe` — installer (~5 MB)

The portable `.exe` is the primary sharing artifact. WebView2 is pre-installed on Windows 11.

## Branch strategy

All work is on `feature/tauri-rebuild`. Merge to `main` only after an end-to-end smoke test:

1. Create a project, add tasks, change hours, add a billing jalon — verify auto-save writes the `.wmsplan` file.
2. Close and reopen the project from the home screen — verify all data loads correctly.
3. Duplicate a project from the home screen — verify the copy opens independently.
4. Export HTML with 3 tabs selected — open in browser, confirm no edit controls are visible.
5. `WMSPlanner.exe` runs on a machine without Node or Rust installed.
