# WMS Project Planner

*[Lire en français](README.md)*

A desktop application for managing WMS implementation projects — from kick-off to go-live.

## What it does

Each project is stored as a single `.wmsplan` file you can drop on a shared folder. Anyone on the team opens it with the app and edits in real time (the app detects external changes and prompts you to reload).

The app covers every stage of a WMS deployment:

- **Tableau de bord** — Live KPIs: task progress, billing collected, hours burned, install date drift
- **Planning** — Gantt chart across 5 phases — drag tasks between phases, reorder phases
- **Suivi Heures** — Hours sold vs. actual by category (Standard / Custom / Offre Comp) with history
- **Tâches Internes** — Internal action list with urgency, owner, and deadline
- **Interfaces ERP** — Validation status per interface (DEV → Préprod → Recette → Validé)
- **Fonctionnel** — Functional flow advancement per process
- **Prérequis Dry Run** — Go/No-Go checklist for the dry run
- **Prérequis Install** — Go/No-Go checklist for go-live
- **Facturation** — Billing milestones with automatic % calculations
- **JIRA** — Epic & task status synced from your Jira instance via API
- **Onglets personnalisés** — Add your own tabs with custom columns

## Getting started

### First launch

1. Download `WMSPlanner.exe` and double-click — no installation needed (Windows 11 required).
2. The home screen opens. Click **Nouveau projet**.
3. Fill in the project name, client, and key contacts. Click **Créer**.

The app creates a blank `.wmsplan` file and opens the project. Every change is saved automatically within one second.

### Opening an existing project

- **Recent projects** appear as cards on the home screen. Click **Ouvrir**.
- **From a shared folder**: click **Ouvrir...** in the top bar and browse to the `.wmsplan` file.

### Sharing a project

- Copy the `.wmsplan` file to a shared network folder.
- Each team member opens it with their own copy of the app.
- If someone else saves while you have the file open, a banner appears at the top: click **Recharger** to get their changes.

## Home screen — Portfolio dashboard

A collapsible **📊 Vue d'ensemble du portefeuille** section sits above the project cards and gives a cross-project view:

- **Santé du portefeuille** — always visible at the top: one row per project showing RAG status, task progress bar, hours consumed vs. sold, billing collected, install date, and checklist counts.
- **KPI strip** — active projects, RAG breakdown, total overdue tasks, total billing collected, total hours consumed.
- **Cette semaine & retards** — collapsed by default; click the header to expand. Tasks overdue or due within 7 days, grouped by project. Clicking a row opens that project.
- **Événements à venir — 30 jours** — collapsed by default; click the header to expand. Upcoming billing milestones and install dates in the next 30 days, grouped by project, with a J-N countdown chip.

Each project card has a **colored left border** showing its RAG status (green / orange / red). Click the portfolio header to collapse/expand the entire dashboard.

## Tableau de bord

- **Statut RAG** — click the status pill next to **WMS Planning** in the nav bar to set the project status (Vert = OK, Orange = Attention, Rouge = Bloqué). The pill updates immediately and the home screen card border reflects the status after the next portfolio load.
- **Cette semaine** — a panel below the KPIs lists overdue tasks and tasks ending within 7 days, grouped by section, with owner and due date.
- **⇄ Onglets** — opens the tab manager from the nav bar: drag to reorder, rename any tab, hide tabs you don't use. Resets per project.

## Planning (Gantt)

- **Add a task**: click **＋** on the right side of any phase row.
- **Edit a task**: click the ✏ button on the row or the task name to open the edit modal. Delete is inside the modal.
- **Reorder**: click **✏ Réorganiser** to enable drag-and-drop. Drag the ⠿ handle to move tasks across phases or reorder phases entirely. Click **✓ Terminer** when done.
- **Install date postponed**: change the install date and the app asks whether it is a delay or an adjustment. A delay shows both the original and new date with an orange badge.
- **Resize columns**: drag the right edge of any column header (Statut, Intitulé, etc.) to resize it. Widths are saved per project.
- **Task dependencies**: in the task edit modal, select one or more predecessor tasks under **Dépendances**. If the task starts before a predecessor finishes, the row gets an orange outline on the Gantt and a warning in the "Cette semaine" panel.

### Multi-period tasks (holidays / unavailability)

A task can span several disconnected date ranges on a single row — useful for a holidays phase where people are away at different times:

- In the task edit modal, click **＋ Ajouter une période** to add a second (or third…) date range. Each period has its own Début and Fin. Use the 🗑 button to remove a period when there are two or more.
- Check **Indisponibilité / congé** to mark the row as an absence: the row renders in italic/muted style and the Statut, Priorité, J, and % Avancement columns are left blank.
- On the Gantt, each period shows as a separate coloured block on the same row. Hovering any block shows all date ranges in the tooltip.
- The **J** column shows the total days across all periods; **Début** and **Fin** show the first and last dates with a `N×` indicator when multiple periods exist.

## Suivi Heures

- The three bold rows (**Heures Standard**, **Heures Custom**, **Heures Comp.**) are calculated totals — they update automatically as you fill in the rows below.
- To change the type of a row (Standard / Custom / Offre Comp), click the type badge in the row and pick from the dropdown.
- Click the clock icon on any row to see its full edit history.
- **＋ Ajouter une catégorie** adds a custom row at the bottom.

## Onglets personnalisés

- Click **＋** at the end of the tab bar to create a new tab. Define a name, icon, and up to 5 columns (text, select, date, or checkbox).
- Each row has a **✏** button that opens an edit modal for all fields, including a **Supprimer** button.
- Drag the ⠿ handle to reorder rows. Drag the right edge of any column header to resize it — widths are saved per tab.
- Edit or delete the tab itself with the ✏ / 🗑 icons in the tab header.

## JIRA integration

1. Go to the **JIRA** tab and click **⚙ Configurer**.
2. Enter your Atlassian URL (e.g. `https://yourcompany.atlassian.net`), project key, email, and an API token.
3. Click **↺ Synchroniser** to import epics and tasks.

The Gantt chart will display a JIRA phase below your manual phases, and the dashboard will show an epic-progress chart.

## Export

Three export formats are available from the top bar:

- **PDF** — exports the current tab as a PDF file (native save dialog).
- **HTML** — choose which tabs to include and save a standalone read-only HTML file you can send to the client or open in any browser.
- **MD** — exports the full project as a Markdown document (all sections, tables, and checklists).

## Settings

Click the **⚙** icon in the top-right of the home screen to open settings:

- **Default save folder** — choose where new projects are created. If unset, projects are saved to the application's AppData folder (always accessible, never lost).

## Example project

Click **📖 Exemple** in the home screen header (or the button on the empty state) to open a demo project. The app copies the example into your projects folder so you can freely edit it without affecting the original.

## Keyboard shortcuts

- `Ctrl+O` — Open a project file
- `Ctrl+S` — Force save immediately
- `Escape` — Close the open modal

---

*Project files are plain JSON — you can open them in any text editor. Do not rename the `.wmsplan` extension or the app won't recognise them on import.*
