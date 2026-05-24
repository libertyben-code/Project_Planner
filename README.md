# WMS Project Planner

A desktop application for managing EasyWMS implementation projects — from kick-off to go-live.

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

## Planning (Gantt)

- **Add a task**: click **＋** on the right side of any phase row.
- **Edit a task**: click the task name to open the edit modal. Delete is inside the modal.
- **Reorder**: click **✏ Réorganiser** to enable drag-and-drop. Drag the ⠿ handle to move tasks across phases or reorder phases entirely. Click **✓ Terminer** when done.
- **Install date postponed**: change the install date and the app asks whether it is a delay or an adjustment. A delay shows both the original and new date with an orange badge.

## Suivi Heures

- The three bold rows (**Heures Standard**, **Heures Custom**, **Heures Comp.**) are calculated totals — they update automatically as you fill in the rows below.
- To change the type of a row (Standard / Custom / Offre Comp), click the type badge in the row and pick from the dropdown.
- Click the clock icon on any row to see its full edit history.
- **＋ Ajouter une catégorie** adds a custom row at the bottom.

## JIRA integration

1. Go to the **JIRA** tab and click **⚙ Configurer**.
2. Enter your Atlassian URL (e.g. `https://yourcompany.atlassian.net`), project key, email, and an API token.
3. Click **↺ Synchroniser** to import epics and tasks.

The Gantt chart will display a JIRA phase below your manual phases, and the dashboard will show an epic-progress chart.

## Export

- **PDF**: click **PDF** in the top bar to export the current tab as a PDF.
- **HTML**: click **HTML** in the top bar, choose which tabs to include, and save a standalone read-only file you can send to the client.

## Keyboard shortcuts

- `Ctrl+O` — Open a project file
- `Ctrl+S` — Force save immediately
- `Escape` — Close the open modal

---

*Project files are plain JSON — you can open them in any text editor. Do not rename the `.wmsplan` extension or the app won't recognise them on import.*
