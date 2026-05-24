# WMS Project Planner

*[Read in English](README.md)*

Application de bureau pour piloter les projets d'implémentation WMS — du lancement jusqu'à la mise en production.

## Ce que ça fait

Chaque projet est enregistré dans un seul fichier `.wmsplan` que vous pouvez déposer sur un dossier partagé. Tous les membres de l'équipe l'ouvrent avec l'application et travaillent en temps réel (l'app détecte les modifications externes et propose de recharger).

L'application couvre toutes les étapes d'un déploiement WMS :

- **Tableau de bord** — KPIs en direct : avancement des tâches, facturation encaissée, heures consommées, dérive de la date d'installation
- **Planning** — Diagramme de Gantt sur 5 phases — glisser les tâches entre les phases, réordonner les phases
- **Suivi Heures** — Heures vendues vs. réelles par catégorie (Standard / Custom / Offre Comp) avec historique
- **Tâches Internes** — Liste d'actions internes avec urgence, propriétaire et deadline
- **Interfaces ERP** — Statut de validation par interface (DEV → Préprod → Recette → Validé)
- **Fonctionnel** — Avancement par flux fonctionnel
- **Prérequis Dry Run** — Checklist Go/No-Go pour le dry run
- **Prérequis Install** — Checklist Go/No-Go pour la mise en production
- **Facturation** — Jalons de facturation avec calcul automatique des pourcentages
- **JIRA** — Statut des épics et tâches synchronisé depuis votre instance Jira via API
- **Onglets personnalisés** — Créez vos propres onglets avec des colonnes sur mesure

## Prise en main

### Premier lancement

1. Téléchargez `WMSPlanner.exe` et double-cliquez — aucune installation requise (Windows 11 nécessaire).
2. L'écran d'accueil s'ouvre. Cliquez sur **Nouveau projet**.
3. Renseignez le nom du projet, le client et les contacts clés. Cliquez sur **Créer**.

L'application crée un fichier `.wmsplan` vierge et ouvre le projet. Chaque modification est sauvegardée automatiquement en moins d'une seconde.

### Ouvrir un projet existant

- **Projets récents** : ils apparaissent sous forme de cartes sur l'écran d'accueil. Cliquez sur **Ouvrir**.
- **Depuis un dossier partagé** : cliquez sur **Ouvrir...** dans la barre du haut et naviguez jusqu'au fichier `.wmsplan`.

### Partager un projet

- Copiez le fichier `.wmsplan` dans un dossier réseau partagé.
- Chaque membre de l'équipe l'ouvre avec sa propre copie de l'application.
- Si quelqu'un d'autre sauvegarde pendant que vous avez le fichier ouvert, une bannière apparaît en haut : cliquez sur **Recharger** pour récupérer ses modifications.

## Planning (Gantt)

- **Ajouter une tâche** : cliquez sur **＋** à droite de n'importe quelle ligne de phase.
- **Modifier une tâche** : cliquez sur le nom de la tâche pour ouvrir la modale d'édition. La suppression se fait depuis cette modale.
- **Réordonner** : cliquez sur **✏ Réorganiser** pour activer le glisser-déposer. Faites glisser la poignée ⠿ pour déplacer des tâches entre les phases ou réordonner les phases entières. Cliquez sur **✓ Terminer** quand c'est fait.
- **Date d'installation reportée** : modifiez la date d'installation et l'application demande s'il s'agit d'un retard ou d'un simple ajustement. Un retard affiche les deux dates avec un badge orange.

## Suivi Heures

- Les trois lignes en gras (**Heures Standard**, **Heures Custom**, **Heures Comp.**) sont des totaux calculés — ils se mettent à jour automatiquement au fur et à mesure que vous remplissez les lignes en dessous.
- Pour changer le type d'une ligne (Standard / Custom / Offre Comp), cliquez sur le badge de type dans la ligne et choisissez dans le menu déroulant.
- Cliquez sur l'icône horloge d'une ligne pour voir son historique complet des modifications.
- **＋ Ajouter une catégorie** ajoute une ligne personnalisée en bas du tableau.

## Intégration JIRA

1. Allez dans l'onglet **JIRA** et cliquez sur **⚙ Configurer**.
2. Saisissez votre URL Atlassian (ex. `https://votre-entreprise.atlassian.net`), la clé du projet, votre email et un token API.
3. Cliquez sur **↺ Synchroniser** pour importer les épics et les tâches.

Le diagramme de Gantt affichera une phase JIRA sous vos phases manuelles, et le tableau de bord présentera un graphique d'avancement par épic.

## Export

- **PDF** : cliquez sur **PDF** dans la barre du haut pour exporter l'onglet courant en PDF.
- **HTML** : cliquez sur **HTML** dans la barre du haut, choisissez les onglets à inclure et enregistrez un fichier autonome en lecture seule que vous pouvez envoyer au client.

## Raccourcis clavier

- `Ctrl+O` — Ouvrir un fichier projet
- `Ctrl+S` — Forcer la sauvegarde immédiatement
- `Échap` — Fermer la modale ouverte

---

*Les fichiers projet sont du JSON brut — vous pouvez les ouvrir dans n'importe quel éditeur de texte. Ne renommez pas l'extension `.wmsplan`, l'application ne les reconnaîtra plus à l'import.*
