# Changelog — WMS Project Planner

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
