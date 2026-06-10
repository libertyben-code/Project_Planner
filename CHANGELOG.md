# Changelog — WMS Project Planner

---

## 1.6.2 — 2026-06-10

### 🇫🇷 Correctifs & améliorations

- **Export PDF multi-pages** : le Gantt est découpé en autant de pages A4 paysage que nécessaire, avec des coupures alignées sur les bords de lignes (aucun texte tronqué entre deux pages).
- **Export PDF planning — page unique** : le planning exporte sur une seule page A4 paysage, contenu redimensionné pour tenir entièrement.
- **Barre d'outils masquée à l'export** : la toolbar du planning (boutons Zoom, filtre, etc.) n'apparaît plus dans le PDF.
- **Qualité d'image améliorée** : rendu à l'échelle × 2,5 pour le multi-pages, × 1,8 pour la page unique ; JPEG qualité maximale (1.0).
- **Format A4** : les exports utilisent désormais le format A4 paysage au lieu de A3.
- **Taille de fichier maîtrisée** : < 5 MB pour le planning, < 4 MB pour les onglets.
- **Suppression de projet — chemin affiché** : la boîte de confirmation affiche maintenant le chemin complet du fichier `.wmsplan` qui sera supprimé, pour éviter toute confusion.

### 🇬🇧 Fixes & improvements

- **Multi-page PDF export**: the Gantt is split across as many A4 landscape pages as needed, with page breaks snapped to row boundaries (no text sliced mid-row).
- **Planning PDF — single page**: the planning exports on a single A4 landscape page, content scaled to fit.
- **Toolbar hidden on export**: the planning toolbar (Zoom, filter buttons, etc.) no longer appears in the PDF.
- **Improved image quality**: rendered at scale × 2.5 for multi-page, × 1.8 for single-page; JPEG quality set to maximum (1.0).
- **A4 format**: exports now use A4 landscape instead of A3.
- **File size under control**: < 5 MB for the planning, < 4 MB for other tabs.
- **Project deletion — path shown**: the confirmation dialog now displays the full `.wmsplan` file path so users know exactly which file will be permanently deleted.

---

## 1.6.1 — 2026-06-09

### 🇫🇷 Correctifs & améliorations

- **Édition inline** : les cellules texte de tous les onglets (Tâches Internes, Interfaces, Fonctionnel, Prérequis Dry Run, Prérequis Installation, Facturation, onglets personnalisés) sont désormais éditables directement dans la cellule — même style que Suivi Heures (cadre bleu pleine cellule, coins arrondis). `Entrée` passe à la ligne ; un second `Entrée` sur une ligne vide valide et sort de la cellule.
- **Statistiques de phase** : chaque ligne de phase affiche le nombre de tâches et le pourcentage d'avancement global de la phase.
- **Colonnes épic JIRA** : les cellules de semaine des épics JIRA utilisent le style des phases (fond atténué, sans couleur jour férié).
- **Statut JIRA dans le Gantt** : le badge de statut des tâches JIRA affiche désormais le vrai statut JIRA (ex. « In Review ») avec la couleur de la catégorie.
- **Lien JIRA dans le Gantt** : la clé de tâche JIRA dans le Gantt est un lien cliquable qui ouvre la tâche dans le navigateur.
- **Couleur du texte des épics JIRA** : le libellé des épics utilise la couleur de l'épic au lieu du blanc (illisible sur fond clair).
- **Ligne du jour au zoom < 100 %** : la ligne rouge du jour reste visible quel que soit le niveau de zoom.
- **Chemin source automatique** : à l'ouverture d'un projet via le bouton « Ouvrir », le champ *Chemin source* est renseigné automatiquement si vide.
- **Cellules dropdown entièrement cliquables** : toute la cellule (pas seulement le badge) déclenche le menu déroulant, sur tous les onglets.
- **Badge Qui?** : la colonne *Qui?* de Prérequis Installation affiche désormais un badge pill gris comme les autres colonnes dropdown.
- **Badge Type (Interfaces)** : la colonne *Type* affiche un badge pill gris cohérent avec les autres colonnes.
- **Scrollbar de navigation** : fine scrollbar stylisée sur la barre d'onglets (visible uniquement en cas de dépassement).

### 🇬🇧 Fixes & improvements

- **Inline editing**: text cells in all tabs (Internal Tasks, Interfaces, Functional, Dry Run, Install, Billing, custom tabs) are now directly editable in the cell — same style as Suivi Heures (full-cell blue outline, rounded corners). `Enter` inserts a new line; a second `Enter` on an empty line validates and exits.
- **Phase statistics**: each phase row now shows the task count and overall completion percentage.
- **JIRA epic week columns**: week cells on JIRA epic rows use the phase style (dimmed background, no holiday colour override).
- **JIRA status in Gantt**: JIRA task status badges now show the real JIRA status name (e.g. "In Review") with the category colour.
- **Clickable JIRA key in Gantt**: the JIRA task key in the Gantt is now a clickable link that opens the issue in the browser.
- **JIRA epic text colour**: epic labels now use the epic colour instead of white (which was unreadable on light backgrounds).
- **Today line at zoom < 100 %**: the red today line remains visible at any zoom level.
- **Auto-fill source path**: opening a project via the Open button automatically fills the *Source path* field if empty.
- **Full-cell dropdown click**: the entire cell (not just the badge) triggers the dropdown, across all tabs.
- **Qui? badge**: the *Qui?* column in Prérequis Installation now shows a grey pill badge like other dropdown columns.
- **Type badge (Interfaces)**: the *Type* column shows a consistent grey pill badge.
- **Nav scrollbar**: thin styled scrollbar on the tab bar (visible only when content overflows).

---

## 1.6.0 — 2026-06-09

### 🇫🇷 Nouveautés

- **Partage OneDrive / dossier réseau** : définissez votre nom d'utilisateur dans ⚙ Paramètres. Chaque sauvegarde estampille `lastEditedBy` dans le fichier `.wmsplan` pour identifier qui a modifié le projet.
- **Détection de conflits** : si un autre utilisateur sauvegarde pendant que vous travaillez, une bannière indique *"Modifié par [Prénom Nom] — pensez à recharger."* Si vous continuez d'éditer avant de recharger, une modale de conflit s'affiche et vous laisse choisir entre annuler ou écraser.

### 🇬🇧 What's new

- **OneDrive / network folder sharing**: set your username in ⚙ Settings. Every save stamps `lastEditedBy` in the `.wmsplan` file so team members know who last edited the project.
- **Conflict detection**: if another user saves while you are working, a banner shows *"Modified by [Name] — consider reloading."* If you continue editing before reloading, a conflict modal appears and lets you choose between cancelling or overwriting.

---

## 1.5.0 — 2026-06-08

### 🇫🇷 Nouveautés

- **Onglet JIRA — Statut réel** : le statut affiché correspond désormais au statut réel de JIRA (ex. « In Review », « Backlog »), coloré selon la catégorie du statut, au lieu d'un statut normalisé générique.
- **Lien vers la tâche JIRA** : cliquez sur l'identifiant d'une tâche (ex. `WMS-42`) pour ouvrir directement la tâche dans votre navigateur.
- **Estimation originale et temps passé** : la colonne « J » affiche désormais l'estimation originale en heures (issue de JIRA). Une nouvelle colonne « Passé » indique le temps déjà enregistré sur la tâche.
- **Synchronisation automatique** : le projet se synchronise avec JIRA à l'ouverture, puis toutes les 10 minutes, si les identifiants sont configurés.

### 🇬🇧 What's new

- **JIRA tab — Real status**: the status badge now shows the actual JIRA status name (e.g. "In Review", "Backlog") coloured by status category, instead of a generic normalised label.
- **Clickable task key**: click any task identifier (e.g. `WMS-42`) to open that issue directly in your browser.
- **Original estimate & time spent**: the "J" column now shows the original estimate in hours from JIRA. A new "Spent" column displays time already logged on the task.
- **Auto-sync**: the project syncs with JIRA on open and every 10 minutes when credentials are configured.

---

## 1.3.0 — 2026-06-06

### 🇫🇷 Nouveautés

- **Zoom par page** : maintenez `Ctrl` et faites défiler la molette pour zoomer ou dézoomer n'importe quelle page indépendamment (50 % – 200 %, pas de 10 %). Le niveau de zoom est affiché dans la barre de navigation et mémorisé par page entre les sessions. Cliquez sur l'indicateur de zoom pour revenir à 100 %.

### 🇬🇧 What's new

- **Per-page zoom**: hold `Ctrl` and scroll the mouse wheel to zoom in or out on any page independently (50 % – 200 %, 10 % steps). The zoom level is shown in the nav bar and remembered per page across sessions. Click the zoom indicator to reset to 100 %.

---

## 1.2.1 — 2026-06-06

### 🇫🇷 Correctifs

- Test de la mise à jour automatique — vérification du circuit complet de livraison.

### 🇬🇧 Fixes

- Auto-update smoke test — verifying the full delivery pipeline end-to-end.

---

## 1.2.0 — 2026-06-06

### 🇫🇷 Nouveautés

- **Mise à jour automatique** : l'application vérifie au démarrage si une nouvelle version est disponible sur GitHub et propose de l'installer en un clic. Un bouton "Vérifier les mises à jour" est également disponible dans les Paramètres.
- **Notes de version** : lors d'une mise à jour disponible, les notes de la release s'affichent dans le panneau Paramètres avant installation.
- **Migration de schéma JSON** : les fichiers `.wmsplan` anciens sont automatiquement mis à jour vers le schéma courant à l'ouverture. Chaque projet inclut désormais un champ `schemaVersion` pour faciliter les migrations futures.

### 🇬🇧 What's new

- **Auto-update**: the app silently checks for a new version on GitHub at startup and offers a one-click install. A "Check for updates" button is also available in Settings.
- **Release notes**: when an update is available, the release notes are displayed in the Settings panel before installation.
- **JSON schema migration**: legacy `.wmsplan` files are automatically patched to the current schema on open. Each project now carries a `schemaVersion` field to simplify future migrations.

---

## 1.1.0 — 2026-06-06

### 🇫🇷 Nouveautés

- **Paramètres JIRA séparés** : les identifiants Atlassian (URL, email, token) sont désormais dans les Paramètres globaux. La clé de projet (ex : WMS) se configure dans les paramètres de chaque projet.
- **Chemin source par projet** : un nouveau champ "Source Path" dans ⚙ paramètres projet permet de pointer vers un fichier `.wmsplan` partagé (dossier réseau, dépôt git). L'application récupère automatiquement la version la plus récente à l'ouverture.
- **Informations projet dans les paramètres** : Nom, Client, DP, CDP Tech, Resp. Logistique et Consultant ERP sont maintenant éditables directement depuis le modal ⚙ paramètres projet.
- **Type d'interface** : les interfaces disposent d'un menu déroulant de type (Connecteur ERP, GNA, Connecteur SAGE, REST API, Autre).

### 🇬🇧 What's new

- **Split JIRA settings**: Atlassian credentials (URL, email, token) are now in global Settings. The project key (e.g. WMS) is configured per-project in ⚙ project settings.
- **Per-project source path**: a new "Source Path" field in ⚙ project settings lets you point to a shared `.wmsplan` file (network drive, git repo). The app automatically pulls the latest version on open.
- **Project info in settings**: Name, Client, PM, CDP Tech, Logistics and ERP Consultant are now editable directly from the ⚙ project settings modal.
- **Interface type**: interfaces now have a type dropdown (ERP Connector, GNA, SAGE Connector, REST API, Other).

---
