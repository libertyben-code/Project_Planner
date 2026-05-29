# WMS Project Planner

*[Read in English](README.en.md)*

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

## Écran d'accueil

L'écran d'accueil comporte deux onglets dans la barre du haut :

- **📋 Projets récents** — cartes projets, recherche, création, ouverture, duplication, partage, suppression.
- **📊 Portfolio** — vue transversale de tous les projets :
  - **Santé du portefeuille** — une ligne par projet avec statut RAG, avancement des tâches, heures consommées/vendues, facturation, date d'installation et scores des checklists.
  - **Bandeau KPIs** — projets actifs, répartition RAG, total des tâches en retard, facturation encaissée, heures consommées.
  - **Cette semaine & retards** — replié par défaut ; cliquez sur l'en-tête pour déplier. Tâches en retard ou se terminant dans les 7 prochains jours, regroupées par projet.
  - **Événements à venir — 30 jours** — replié par défaut. Jalons de facturation et dates d'installation dans les 30 prochains jours, avec compteur J-N.

Chaque carte projet a une **bordure gauche colorée** indiquant le statut RAG (vert / orange / rouge). Le portfolio se rafraîchit automatiquement après l'ajout, la suppression ou la duplication d'un projet.

## Tableau de bord

- **Statut RAG** — cliquez sur la pastille de statut à côté de **WMS Planning** dans la barre de navigation pour définir le statut du projet (Vert = OK, Orange = Attention, Rouge = Bloqué). La pastille se met à jour immédiatement et la bordure de la carte à l'accueil reflète le statut après le prochain chargement du portefeuille.
- **Cette semaine** — un panneau sous les KPIs liste les tâches en retard et celles qui se terminent dans les 7 prochains jours, avec propriétaire et date de fin.
- **⇄ Onglets** — ouvre le gestionnaire d'onglets depuis la barre de navigation : glissez pour réordonner, renommez, masquez les onglets inutilisés. Paramètre enregistré par projet.

## Planning (Gantt)

- **Ajouter une tâche** : cliquez sur **＋** à droite de n'importe quelle ligne de phase.
- **Modifier une tâche** : cliquez sur le bouton ✏ de la ligne ou sur le nom de la tâche. La suppression se fait depuis la modale.
- **Réordonner** : cliquez sur **✏ Réorganiser** pour activer le glisser-déposer. Faites glisser la poignée ⠿ pour déplacer des tâches entre les phases ou réordonner les phases entières. Cliquez sur **✓ Terminer** quand c'est fait.
- **Date d'installation reportée** : modifiez la date d'installation et l'application demande s'il s'agit d'un retard ou d'un simple ajustement. Un retard affiche les deux dates avec un badge orange.
- **Redimensionner les colonnes** : faites glisser le bord droit d'un en-tête de colonne (Statut, Intitulé, etc.) pour ajuster sa largeur. Les largeurs sont mémorisées.
- **Dépendances** : dans la modale d'édition d'une tâche, sélectionnez une ou plusieurs tâches prédécesseurs sous **Dépendances**. Si la tâche démarre avant qu'un prédécesseur soit terminé, la ligne est encadrée en orange sur le Gantt et signalée dans le panneau "Cette semaine".

### Tâches multi-périodes (congés / indisponibilités)

Une tâche peut couvrir plusieurs plages de dates disjointes sur une même ligne — pratique pour une phase congés où chaque personne est absente à des moments différents :

- Dans la modale d'édition, cliquez sur **＋ Ajouter une période** pour ajouter une deuxième plage (ou plus). Chaque période a son propre Début et Fin. Le bouton 🗑 permet de supprimer une période dès qu'il y en a au moins deux.
- Cochez **Indisponibilité / congé** pour marquer la ligne comme une absence : elle s'affiche en italique/atténué et les colonnes Statut, Priorité, J et % Avancement restent vides.
- Sur le Gantt, chaque période apparaît sous forme d'un bloc coloré séparé sur la même ligne. Le survol affiche toutes les plages dans l'infobulle.
- La colonne **J** affiche le total des jours sur toutes les périodes ; **Début** et **Fin** affichent les premières et dernières dates avec un indicateur `N×` lorsque plusieurs périodes existent.

## Suivi Heures

- Les trois lignes en gras (**Heures Standard**, **Heures Custom**, **Heures Comp.**) sont des totaux calculés — ils se mettent à jour automatiquement au fur et à mesure que vous remplissez les lignes en dessous.
- Pour changer le type d'une ligne (Standard / Custom / Offre Comp), cliquez sur le badge de type dans la ligne et choisissez dans le menu déroulant.
- Cliquez sur l'icône horloge d'une ligne pour voir son historique complet des modifications.
- **＋ Ajouter une catégorie** ajoute une ligne personnalisée en bas du tableau.

## Onglets personnalisés

- Cliquez sur **＋** en fin de barre d'onglets pour créer un nouvel onglet. Définissez un nom, une icône et jusqu'à 5 colonnes (texte, liste, date ou case à cocher).
- Chaque ligne dispose d'un bouton **✏** qui ouvre une modale d'édition pour tous les champs, avec un bouton **Supprimer**.
- Faites glisser la poignée ⠿ pour réordonner les lignes. Faites glisser le bord droit d'un en-tête de colonne pour le redimensionner — les largeurs sont mémorisées par onglet.
- Modifiez ou supprimez l'onglet lui-même avec les icônes ✏ / 🗑 dans l'en-tête de l'onglet.

## Intégration JIRA

1. Allez dans l'onglet **JIRA** et cliquez sur **⚙ Configurer**.
2. Saisissez votre URL Atlassian (ex. `https://votre-entreprise.atlassian.net`), la clé du projet, votre email et un token API.
3. Cliquez sur **↺ Synchroniser** pour importer les épics et les tâches.

Le diagramme de Gantt affichera une phase JIRA sous vos phases manuelles, et le tableau de bord présentera un graphique d'avancement par épic.

## Export

Trois formats d'export sont disponibles depuis la barre du haut :

- **PDF** — exporte l'onglet courant en PDF (boîte de dialogue d'enregistrement native).
- **HTML** — choisissez les onglets à inclure et enregistrez un fichier HTML autonome en lecture seule que vous pouvez envoyer au client ou ouvrir dans n'importe quel navigateur.
- **MD** — exporte le projet complet en document Markdown (toutes les sections, tableaux et checklists).

## Paramètres globaux

Cliquez sur l'icône **⚙** en haut à droite de l'écran d'accueil :

- **Nom de la société intégratrice** — remplace "COMPANY" dans le champ Propriétaire de toutes les tâches.
- **Dossier de sauvegarde par défaut** — choisissez où les nouveaux projets sont créés.
- **Template de projet** — choisissez un fichier `.wmsplan` existant comme base pour tous les nouveaux projets (phases, configurations pré-remplies).
- **Mode clair** — bascule entre le mode sombre (défaut) et le mode clair.

## Paramètres par projet

Cliquez sur l'icône **⚙** dans la barre de navigation d'un projet ouvert :

- **Dossier de sauvegarde secondaire** — dossier supplémentaire (réseau, OneDrive…) où le projet est aussi sauvegardé à intervalle régulier.
- **Intervalle (min.)** — fréquence de la sauvegarde secondaire (défaut : 5 min).
- **Options Propriétaire** — valeurs personnalisées pour le menu déroulant "Propriétaire" de ce projet (sous-traitants, équipes spécifiques…).

Une sauvegarde journalière est créée automatiquement dans un sous-dossier `Backup/` au même niveau que le fichier projet (30 jours conservés).

## Projet exemple

Cliquez sur **📖 Exemple** dans l'en-tête de l'écran d'accueil (ou sur le bouton de l'état vide) pour ouvrir un projet de démonstration. L'application copie l'exemple dans votre dossier projets afin que vous puissiez le modifier librement sans affecter l'original.

## Raccourcis clavier

- `Ctrl+O` — Ouvrir un fichier projet
- `Ctrl+S` — Forcer la sauvegarde immédiatement
- `Échap` — Fermer la modale ouverte

---

*Les fichiers projet sont du JSON brut — vous pouvez les ouvrir dans n'importe quel éditeur de texte. Ne renommez pas l'extension `.wmsplan`, l'application ne les reconnaîtra plus à l'import.*
