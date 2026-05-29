# WMS Planner — How We Work Together

Paste this file (or mention it) at the start of a new conversation to restore context.

---

## Starting a session

1. Mention this file and the current branch/feature you want to work on
2. Reference `FEEDBACK.md` for the pending `[ ]` items backlog
3. Reference the plan file (`C:\Users\J4ck\.claude\plans\`) for large features in progress
4. State what you want to accomplish — Claude will ask clarifying questions if needed before starting

---

## Branch strategy

| Rule | Detail |
|---|---|
| Never commit to `main` directly | Always branch first |
| Branch naming | `feature/short-description` (e.g. `feature/dashboard-rag-deps-tabs`) |
| One branch per feature set | Group related changes; don't mix unrelated features |
| Merge only when complete | Feature done + docs updated + smoke test passed |

```bash
git checkout -b feature/my-feature
# ... work ...
git checkout main && git merge feature/my-feature --no-ff
git push
```

---

## Commit discipline

- **One commit per logical change** — not one per file, not one per session
- Format: `type(scope): description` (conventional commits)
  - `feat(gantt): add multi-segment task bars`
  - `fix(ui): correct this-week panel width`
  - `docs: update README for RAG pill`
  - `chore: update test project file`
- Always `git push` immediately after each commit — no local-only commits
- Always add `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` at the end

---

## Before committing — approval flow

**The mandatory flow for any code change:**

1. Claude implements the change and states which files changed and why
2. **User tests the build** — either `npx tauri dev` (full Tauri window) or `npx serve renderer -l 8080` (browser, no Rust) — and approves or requests changes
3. Claude commits only after explicit user approval ("ok", "good", "commit it", etc.)

**Exceptions (Claude may commit directly after stating intent, no build test needed):**

- Typo / formatting fixes in docs
- Doc-only commits (README, MAINTAINER, FEEDBACK)
- `WORKFLOW.md` updates

**If a tool call is rejected:**
- Do NOT retry the exact same call
- Read the rejection reason — it usually contains the fix
- Adjust approach and confirm before retrying

---

## Documentation — end of session AND before merging

Update docs **at the end of every working session**, not only at merge time:

| File | Language | When to update |
|---|---|---|
| `README.md` | French | Any user-visible change |
| `README.en.md` | English | Same, translated |
| `MAINTAINER.md` | English | Any architecture / IPC / gotcha change |
| `FEEDBACK.md` | French/mixed | Mark completed items `[x]` immediately |
| `WORKFLOW.md` | English | When the collaboration process itself changes |

Before every `git merge feature/* → main`, verify all five files are current.

---

## FEEDBACK.md is the living backlog

```
- [ ] pending item
- [x] done item — OK
```

New items are added by the user after testing. We work through them section by section. Mark `[x]` on the commit that closes the item, not before.

---

## Language rules

| Context | Language |
|---|---|
| App UI, labels, modals | French |
| User messages | French or English — Claude responds in kind |
| Code comments | None by default (only add WHY if non-obvious) |
| Commit messages | English (conventional commits) |
| README.md, MAINTAINER.md | English |
| README.fr.md, FEEDBACK.md | French |

---

## Coding style

- **No comments** unless the WHY is non-obvious (a bug workaround, a hidden constraint, a surprise behavior)
- **No docstrings** — well-named identifiers are self-documenting
- **No backwards-compat shims** — change the code directly
- **No defensive error handling** for impossible/internal cases — only at system boundaries (user input, IPC)
- **Prefer editing existing files** over creating new ones
- **No premature abstractions** — three similar lines is better than a helper for two uses

---

## Known technical constraints

### 2026-05-23 — Windows path safety in inline onclick
Windows paths (`C:\Users\...`) embedded as raw string literals in `onclick="fn('...')"` are silently corrupted — `\U` becomes `U`, `\t` becomes TAB, etc.

**Rule:** always use `data-path` HTML attributes and read back with `this.dataset.path`.
```js
// BAD
`onclick="openProject('${path}')"`

// GOOD
`data-path="${esc(path)}" onclick="openProject(this.dataset.path)"`
```

### 2026-05-23 — SortableJS `forceFallback:true` required for WebView2
WebView2's native HTML5 drag-and-drop is broken for table rows — rows grey out but never move.

**Rule:** always create SortableJS instances with:
```js
Sortable.create(tbody, { forceFallback: true, fallbackTolerance: 3, ... })
```
Use destroy-and-recreate before every `renderXxx()` that rebuilds a sortable table.

### 2026-05-24 — Tauri window URL must be explicit
Built `.exe` crashes looking for `index.html` unless `tauri.conf.json` has an explicit `"url": "home.html"` in the window config. Never leave it blank.

### 2026-05-23 — ES module window exports
`wms.js` is loaded as `type="module"` — nothing is global by default. Every function called from inline `onclick`/`onblur`/`onchange` **must** appear in `Object.assign(window, {...})` at the bottom of the file. Missing exports fail silently — most common class of bug.

### 2026-05-23 — IPC stub pattern
All Tauri calls go through `tauri-ipc.js`, which falls back to `localStorage` when running in a plain browser. This allows full UI iteration without a Tauri build.

---

## Dated development log

### 2026-05-23 — Initial build (Steps 1–7)
- Tauri v2 scaffold: Rust IPC, WebView2, `home.html`/`app.html`/`wms.js`/`wms.css`
- Home screen: project cards, search, create/open/duplicate/delete
- App: all tabs (Gantt, Heures, Interfaces, Fonctionnel, Dry Run, Install, Facturation, JIRA, Custom tabs)
- JSON persistence as `.wmsplan`, auto-save 800ms debounce, versioned backups
- Token system: 5 meta tokens (`clientName`, `DPName`, etc.) replaced at render time
- HTML export (data-driven, not DOM clone), PDF export, Markdown export
- Custom tabs: column builder modal, row CRUD, drag-drop, resizable columns
- SortableJS replaces native drag-and-drop on all tables (`forceFallback: true`)
- FEEDBACK.md created as tab-by-tab backlog

### 2026-05-24 — Tauri fix + docs
- Fixed `tauri.conf.json` window URL crash on built `.exe`
- Replaced EasyWMS / company-specific strings with generic WMS tokens
- Added bilingual README links

### 2026-05-25 — Core UX polish (feedback pass 1)
- Save dialogs for PDF/HTML, auto-folder for new projects
- `data-path` onclick fix for Windows paths (first discovery of backslash bug)
- Settings modal: custom save folder
- Demo/example project (`example.wmsplan`)
- Hours tracking: dynamic totals by type (Standard/Custom/Offre Comp), type dropdown per row, history accordion, KPI breakdown
- Column resizing on all tables (pointer events, persisted to `localStorage`)
- Gantt improvements: phase duration, drag-drop across phases, dependency outlines
- Edit modals with delete button for every table row
- Owner dropdown (Client / MECALUX / Intégrateur / Autre) propagated across tabs
- Status badges on cards

### 2026-05-25 — Multi-segment Gantt (`feature/multi-segment-gantt`)
- Tasks can carry `segments: [{start, end}]` for disconnected date ranges (holidays, unavailability)
- `isUnavail: true` flag suppresses Statut/Priorité/J/Avancement cells
- Each segment rendered as a separate Gantt bar; tooltip shows all periods
- `taskSegments()` helper normalises single-segment and multi-segment tasks into one path

### 2026-05-25 — RAG, dependencies, tab manager, this-week (`feature/dashboard-rag-deps-tabs`)
- **RAG status**: `projectMeta.rag` ('R'|'A'|'G'|''); `setRag()` + `_syncRagUI()`; initially shown as nav-logo dot
- **Task dependencies**: `task.deps[]`; Gantt outlines dep-violated rows in orange; This-week panel flags them with ⚠
- **Tab manager**: `⇄ Onglets` opens reorder/rename/hide modal; config stored in `projectMeta.tabOrder/tabHidden/tabLabels`
- **This-week panel**: overdue + tasks due within 7 days, grouped by section, on the Dashboard tab
- **Portfolio dashboard** (`home.js`): `loadPortfolioData()` reads all projects in parallel via `Promise.allSettled`; `renderPortfolio()` builds KPIs, Cette semaine, Événements, Santé table

### 2026-05-25 — Portfolio + RAG polish
- RAG dot moved from nav-logo to a dedicated **navbar pill dropdown** (always accessible from any tab)
- `toggleRagDropdown` / `closeRagDropdown`; outside-click closes dropdown
- Home screen card RAG changed from inline dot (truncated by name overflow) to **colored left border** (`.rag-border-g/a/r`) — always visible
- Portfolio layout: health table moved to top (always expanded, bigger rows); Cette semaine and Événements à venir **collapsed by default**, grouped by project under `pf-group-row` headers, toggled by `togglePfSection(id)`
- Fresh RAG values synced back to `recent[]` after portfolio loads → cards stay current without reopening projects
- All docs updated; branch merged to `main`

### 2026-05-29 — Company name + feedback
- Replaced remaining "MECALUX" occurrences in views and settings with configurable company name
- FEEDBACK.md updated with new pending items

### 2026-05-29 — Home screen tabs + light mode (`feature/home-tabs-light-mode`)

- Portfolio moved from collapsible accordion to dedicated **📊 Portfolio** tab in the header bar
- Tab bar integrated into the header (CSS grid 3-col, tabs centered, 15px bold)
- Light mode: `:root[data-theme="light"]` CSS overrides; toggled from Settings "Mode clair" toggle; persisted in `appSettings.lightMode`
- Portfolio auto-refresh after project delete, remove-from-recent, and duplicate
- WORKFLOW.md, README.md, README.en.md, MAINTAINER.md updated

### 2026-05-29 — Polish pass (`feature/phase-collapse-dashboard-polish`)

- **Collapsible Gantt phases**: toggle ▼/▶ button on each phase row; collapsed state stored in `_collapsedPhases` Set (resets on reload)
- **Dashboard Personnaliser**: modal now includes all items — Cartes KPI, Indicateur dérive installation, Tâches de la semaine + 8 graphiques; `isChartVisible()` applied in `renderDashboard`, `renderInstallDrift`, `renderThisWeek`
- **Tauri identifier**: `com.mecalux.wmsplanner` → `com.wmsplanner.app` (removes "mecalux" from AppData path)
- **PDF export**: header label changed from "Chef de Projet" → "Directeur de Projet" (field `pm`)
- **Interfaces / Fonctionnel column headers**: "Recette Mecalux" / "Test Mecalux" now use `_companyName` from Settings dynamically, updated in `renderInterfaces()` and `renderFonctionnel()`
- **HTML export button**: temporarily disabled pending formatting review (code preserved, button commented out in `app.html`)

### 2026-05-29 — Save, backup, template, owner options (`feature/settings-autosave-backup-template-dropdowns`)

- **Per-project secondary save**: `projectMeta.autoSavePath` + `autoSaveIntervalMins`; configured via new ⚙ project settings modal in app nav; file is copied to secondary path on each save when the interval has elapsed
- **Daily backup**: new Rust command `write_daily_backup`; writes `<project_dir>/Backup/<stem>_YYYYMMDD.wmsplan` on first save of each day; keeps last 30 daily files
- **Custom project template**: `appSettings.templatePath`; in home Settings → "Template de projet"; new projects are based on the chosen `.wmsplan` file instead of the built-in `template.json`
- **Per-project owner options**: `projectMeta.ownerOptions[]`; managed via ⚙ project settings modal → "Options Propriétaire"; add/remove custom values; drives all owner dropdowns (inline Gantt, inline Tâches, edit modals) — re-renders Gantt and Tâches tables on change

---

## Pending items (summary from FEEDBACK.md as of 2026-05-29)

**Export:**

- HTML export formatting doesn't match app (button disabled — pending review)

**Evolutions (larger features):**
- Global resource calendar (CDP Tech / DP availability, synced from Google Calendar)
- Client test tracking process integration
- Excel import as a new tab
- Zoom in/out on Gantt (Ctrl+scroll or +/- buttons)
