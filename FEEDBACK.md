# WMS Planner — Feedback & Change Requests

Add items below as you test the app. I'll work through them section by section.

Format: `- [ ] description` for pending, `- [x] description` once done.

---

## Home Screen

<!-- Project cards, search, create/open/duplicate/delete -->

- [x] Le bouton ouvrir... ne fonctionne pas. Il devrait permettre d; importe in Json de projet et de créer ce nouveau projet - OK
- [x] Dans la modale de création de projet, enlever le nom de la société du champ Dir Projet. - OK
- [x] Dans la meme modale, enlever la date de fin. Celle ci sera renseignée automatiquement avec la date la plus eloignée d'une tâche du planning. - OK
- [x] Enlever (Originiale) du champ date d'installation. - OK
- [x] En plus de supprimer et dupliquer un projet, ajouter la possibilité de partager un projet. - OK
- [x] Remplir le nom du client en même temps que le nom de projet car c'est souvent le meme mais garder le champ editable. - OK
- [x] Actulisation du portfolio lors de la suppression ou l'ajout d; un projet — OK
- [x] Mettre le portfolio sur une tab à part entière. — OK
- [x] Mettre le porfolio et la page principale en mode clair — OK
- [x] Dans settings, ajouter l'option mode dark ou light — OK

## Portfolio

- [x] Dans le portfolio, mettre le nom du DP et CDP Tech ainsi que le nombre de jours ouvrés restant avant installation pour le suivi niveau managerial — OK

## Planning (Gantt)

<!-- Gantt chart, task add/edit/delete, phase management, date inputs -->

- [x] Pour les dates, mettre seulemetn les date de début et d'installation prévue. Si la date est reportée, on devra afficher un tag Reportée et offrir la possibilité de mettre un commentaire.
  - [x] Si la date est changée, demandé si c'est un retard de projet ou juste un ajustement et afficher les deux dates. - OK
- [x]  bouttons + tache du navbar doit etre supprimé car déjà existant au niveau de chaques taches - OK
- [x] Le bouton + phase du navbar doit etre descndu qu niveau du bouton export PDF au dessus du planning - OK
- [x] le bouton de suppression de tache doit etre dans la modate d'edition - OK
- [x] le bouton de suppression de tache doit se trouver aussi dans une modate edition au niveau de la phase. - OK
- [x] pour les colonnes avec un menu déroulant, celui ci doit être clickable dans toute la cellule. - OK
- [x] Dans la colonne propriétaire, il faut les champs suivant : nom du client, intégrateur (nom configurable), autre dans un menu déroulant.
  - [x] Si le nom du client est changé en haut de la page, cela doit se refletter dans les menus déroulant et autres pages. - OK
- [x] Chaque phase doit avoir le nombre de jours de durée en prenant les dates de tache min et max - ok
- [x] si l'on hover sur une celulle colorié du planning, on doit pouvoir voir la date hovered. - OK
  - [x] Améliorer les infos du la bulle. - OK
- [x] Le statut des tache doit être Non commencé par défaut.  
- [x] Un bouton edit planning doit permettre de drag and drop les taches dans toutes les phases. - OK
- [x] Ce meme bouton doit permettre de drag and drop une phase avec toute ses taches. - OK
- [x] Une phase JIRA dans le planning (épics + tâches, barres de Gantt, progression). Backbone complet : onglet JIRA dédié, modal de configuration (URL Atlassian, clé projet, email, token API), fonction syncJira() prête pour la vraie clé. Données de démonstration pré-chargées dans le template. - OK
- [x] Ajouter la possibilité de "réduire" une phase pour n'afficher que la ligne du nom de phase. — OK
- [x] Ajouter la possibilité de supprimer la date revue d'installation et donc le message retardé. — OK
- [x] Dans la phase Indisponibilité/Congés, les nouvelles tâches créées ne doivent pas afficher le statut, priorité, J et %AVA comme le reste des tâche dans cette phase. — OK
- [x] Dans la tâche Chef de Projet Technique, remplis le nom du CDP Tech et non du DP. — OK
- [x] Dans la vue planning, permettre que les phases JIRA et tâches aient les mêmes attribut que le reste des taches/phase = réduire, deplacer en drag and drop etc. — OK
- [x] Dans les taches JIRA, integrer les dates de début et fin avec le nombre de jours prévus. — OK
- [x] Si une l'avancement d'une tâche est passé à 100%. Changer le statut de cette tâche à Terminé. De la même manière si l'avancement est changé >= 0, alors passer la tâche à "En Cours" — OK
- [x] Ajouter le nombre de jours ouvrés restant à coté de la date d'installation. — OK
  - [x] Ajouter ces jours dans le planning en dessous de la date d'installation — OK
- [x] Ajouter une indication des semaines avec des jours fériés. (colonne grisée, cellule semaine d'une certaine couleur ?) — OK

## Suivi Heures

<!-- Hours table, custom rows, history accordion, KPI cards -->
- [x] laisser le texte des champs de la colone catégorie editable.
- [x] Ajouter une colonne avec un dropdown contenant les catégorie Custom, Standard, Offre Comp.
  - [x] Pour le type d'heures, rendre cela un menu déroulant editable en cliquant dessus - OK
- [x] Cette colonne permettra de remplur les lignes du haux du tableau qui ne seront pas editable.
  - [x] Les lignes Heures Standard, Heure Custom et une nouvelle ligne Heures Comp. ne doivent pas être editable. Ce sont les totaux des lignes en dessous - OK
- [x] Touts les lignes autres que les totals des heures doivent avoir un boutton Edit avec un bouton delete dans la modale
  - [x] Le bouton edit doit être cohérent avec le reste du document. On ne le voit pas. - OK
- [x] Toutes les lignes doivent pouvoir être réorganisées
- [x] Les totaux (Heures Standard, Custom, Comp.) doivent se calculer automatiquement à partir des lignes de détail selon leur type — plus de valeurs codées en dur. - OK
- [x] Ajouter une ligne Heures Comp. calculée (type Offre Comp). - OK
- [x] Changer le type d'une ligne doit recalculer immédiatement les totaux et le dashboard. - OK
- [x] Les KPI doivent afficher le détail par type (Std / Custom / Comp) en sous-titre. - OK
- [x] pour la colonne vendu des frais de déplacements, rentrer le montant directement dans la cellule (inline, sans popup, même pattern que Facturation). — OK

## Tâches Internes

<!-- Internal tasks table, status, urgency, drag-drop -->
- [x] le drag and drop ne fonctionne pas.
- [x] toutes les lignes doivent avoir un bouton edit avec un bouton delete dans la modale.
- [x] Les taches doivent avoir une colonne propriétaire
  - [x] Ce champs propriétaire doit avoir le meme menu déroulant que dans le planning. - OK
- [x] Utiliser des couleurs plut'^ot que des étoiles pour la priorisation des tâches. - OK
  
## Interfaces ERP

<!-- Interface tracking table, status badges -->
- [x] toutes les lignes doivent avoir un bouton edit avec un bouton delete dans la modale.
- [x] Les colonnes doivent être assez large pour afficher tout le texte.
- [x] le drag and drop ne fonctionne pas.
- [x] dans la colonne type, les cellules doivent être un menu déroulant avec les options : Connecteur ERP, GNA, Connecteur SAGE, REST API, Autre — OK

## Fonctionnel

<!-- Functional flows table -->

- [x] toutes les lignes doivent avoir un bouton edit avec un bouton delete dans la modale.
- [x] le drag and drop ne fonctionne pas.

## Prérequis Dry Run

<!-- Dry run checklist -->
- [x] toutes les lignes doivent avoir un bouton edit avec un bouton delete dans la modale.
- [x] le drag and drop ne fonctionne pas.

## Prérequis Installation

<!-- Install checklist -->
- [x] toutes les lignes doivent avoir un bouton edit avec un bouton delete dans la modale.
- [x] Les colonnes doivent être assez large pour afficher tout le texte.
- [x] le drag and drop ne fonctionne pas.
- [x] La colonne Qui? doit être un menu déroulant avec les mêmes infos que celle du planning. — OK

## Facturation

<!-- Billing milestones, KPI cards -->
- [x] toutes les lignes doivent avoir un bouton edit avec un bouton delete dans la modale.
- [x] Les colonnes doivent être assez large pour afficher tout le texte.
- [x] le drag and drop ne fonctionne pas.
- [x] ajuster le formating des montants.
- [x] Les pourcentages doivent être calculés automatiquement en fonction du cout total et des manton de chaques jalons. - OK
- [x] Ajouter une partie Déplacement dans la facturation avec une ligne Avion/Train, Voiture, Hôtel et Restauration. — OK (déplacé dans Suivi Heures, colonne État supprimée)
  - [x] Pour ces lignes, ajouter une colonne Vendu (comme les heures) et permettre de rentrer les dépenses lorsqu'elles arrivent (comme le récap des heures lors des éditions) — OK
  - [x] pour la colonne montant, rentrer les montants directement dans la cellule sans passer par le bouton editer. Le faire dans la cellule sans pop up en haut de page. La mise à jour des pourcentage ce fait à ce moment là directement. — OK

## Tableau de Bord (Dashboard)

<!-- KPI cards, charts, install drift block -->
- [x] pour la facturation, utiliser un graphique d'une barreavec les différentes parties payé ou non et le montant global.
- [x] Ajouter la possibilité de customiser ce dashboard en selectionnant les graphique à afficher. - OK
- [x] Ajouter un graphique JIRA dans le dashboard : barres horizontales empilées par épic (Terminé / En cours / À faire), activable/désactivable comme les autres graphiques. - OK
- [x] actualiser la modale personalliser avec toutes les différentres cartes et graphs. — OK
  
## Onglets Personnalisés (Custom Tabs)

<!-- Tab creation modal, column builder, row CRUD -->

## Export HTML

<!-- Tab selection modal, exported file quality -->
- [x] Le bouton export HTML doit proposer un endroit de sauvegarde du fichier html - OK
- [ ] La formating de l'export HTML n'est pas le meme que celui de l'appli. Il doit ressembler à l'appli (bouton désactivé en attente de révision)

## Export PDF

<!-- Gantt PDF export -->
- [x] Changer le Chef de Projet en haut à gauche et mettre Directeur de Projet. — OK
- [x] les fichiers pdf exporté sont beaucoup trop lourd. Il faut qu'ils fassent moins de 4mb. De plus pour les taches jira, il faut que les colonnes rentrent dans la largeur de la page et le fichier peux avoir plus d'une page. — OK

## JIRA

- [x] Enregistrer les indentifiants JIRA dans le JSON settings de l'utilisateur et non du projet. Chaque utilisateur devra mettre ses identifiants et clé JIRA. — OK
- [x] Les identifiants et clé API JIRA seront renseigné au niveau du menu settings du menu principal. La clé 3 lettres du projet sera renseigné au niveau du projet dans le menu settings de chaques projets. — OK
- [x] Récuperer le statut de la tâche dans l'onglet JIRA au lieu du statut pris du planning. — OK
- [x] Mettre un lien hyperlink vers la tâche dans l'ID de la tâche = CLE-XXX — OK
- [x] La collone J doit correspondre à l'estimation originale et ajouter une autre colonne avec le temps passé actuel. — OK
- [x] Synchronisation JIRA automatique à l'ouverture du projet et toutes les 10 minutes. — OK
- [x] Ajouter une colonne priorité pour les tâches et reprendre les iconnes JIRA — OK
- [x] Permettre de filtrer les tâches par Responsable — OK

## General / Cross-cutting

<!-- Nav, save indicator, undo toast, keyboard shortcuts, responsive layout, performance -->
- [x] Le bouton PDF dans le nav bar doit s'appliquer seulement à l'onglet sélectionné. - OK
- [x] Permettre d'ajuster la largeur des colonnes comme dans excel. - OK
- [x] Permettre de choisir un dossier d'enregistrement automatique par projet en plus du dossier principale à des intervalles régulières. — OK
- [x] Pour les backups, prévoir un dossier "Backup" dans le dossier de sauvegarde principale pour permettre la récupération d'une version anterieure. Prévoir la fréquence de manière journalière. — OK
- [x] Dans le menu Settings du menu principal, prévoir la possibilité de choisir son propre template pour tous les nouveaux projets. — OK
- [x] Ajouter une partie Settings qui permet de définit les listes de menu déroulant comme "propriétaire". — OK (par projet, via ⚙ Paramètres du projet)
- [x] Mettre à jour l'identifiant app dans AppData — OK (identifier → com.wmsplanner.app)
- [x] Pour chaques projets, demander le path d'ouverture du Json. Par exemple si celui ci est partager sur un dossier git, cela permet au manager d'avoir la dernière version. — OK (`projectMeta.sourcePath` dans ⚙ Paramètres du projet ; au clic sur la carte, l'app lit depuis sourcePath et met à jour le fichier local avant de naviguer)

## Notes Techniques

<!-- Implementation notes for future reference -->
- [x] **Drag & drop natif** : SortableJS remplace les boutons ↑↓ — drag-handle ⠿ sur toutes les tables. - OK
  - Ajouter `<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js"></script>` dans app.html
  - Remplacer `makeReorderable(tr, arr, renderFn)` par `Sortable.create(tbody, { handle: '.drag-handle', animation: 150, onEnd: ({ oldIndex, newIndex }) => { const [item] = arr.splice(oldIndex, 1); arr.splice(newIndex, 0, item); renderFn(); debouncedSave(); } })`
  - SortableJS utilise les pointer events en interne — contourne le bug Chromium/WebView2 avec l'API HTML5 drag dans les tableaux.
- [x] **Heures dynamiques** : les lignes bold ont un champ `totalType` ("Standard", "Custom", "Offre Comp"). `renderHeures()` recalcule vente/actuel via `heuresVenteByType(type)` / `heuresActuelByType(type)`. Les lignes éditables ont un champ `type` qui détermine à quel total elles contribuent. Changer le type ou une valeur déclenche `renderHeures(); renderDashboard();` immédiatement.

## Evolutions

### Fonctionnalités standalone (pas de backend requis)

- [x] Permettre le zoom in et out sur le Gantt en faisant Ctrl+scroll ou boutons +/- dans le nav. — OK (étendu à toutes les pages, Ctrl+scroll + bouton reset dans le nav)
- [ ] Intégrer l'import de fichier Excel en tant que nouvelle tab (tableau avec colonnes et types configurables).
- [ ] Calendrier global des ressources : connaitre les disponibilités de chaque CDP Tech et DP. Leurs congés pourront être remplis automatiquement depuis ce calendrier (source actuelle : Google Calendar).
  - [ ] Les utilisateurs devront être créés à l'avance. Dans la création de projet, un menu déroulant permettra de choisir le DP et le CDP Tech.
- [x] **Mises à jour automatiques** : vérification silencieuse au démarrage, bannière + bouton "Installer et redémarrer", notes de version affichées. GitHub Releases + `tauri-plugin-updater`. — OK (v1.2.0)
- [ ] Faire une version multilangue en FR, EN et SP configurable dans settings du homepage.

### Phase 1 — Vue client read-only (export HTML autonome)

<!-- Objectif : partager le planning avec le client sans backend, sans login, sans installation. -->
<!-- Décision 2026-06-02 : commencer par cette phase, tester sur des projets réels avant d'aller plus loin. -->

- [ ] Bouton "Générer vue client" dans le nav de l'app (remplace / complète l'export HTML existant désactivé).
  - Produit un fichier `.html` autonome (CSS + données JSON inlinés) — le client l'ouvre dans n'importe quel navigateur.
  - Flag `CLIENT_MODE = true` injecté : tous les contrôles d'édition (dropdowns inline, boutons Edit/Delete, drag-handle) sont masqués dans les fonctions `renderXxx()`.
  - Onglets visibles côté client : Gantt, Interfaces, Fonctionnel, Dry Run, Installation, onglets personnalisés.
  - Onglets masqués : Heures, Facturation, JIRA, Dashboard, Paramètres projet.
- [ ] Onglet "Retours / UAT" dans la vue client exportée.
  - Liste des retours déjà enregistrés par le DP (titre, type, priorité, statut) — lecture seule.
  - Formulaire "Signaler un problème" : type (Bug / Question / Amélioration), description, priorité.
  - À la soumission : génère un lien `mailto:` pré-rempli → email envoyé au DP.
- [ ] Onglet "Retours / UAT" dans l'app (côté DP).  - Tableau des retours clients : titre, type, priorité, statut (Nouveau / En cours / Résolu), commentaire DP.
  - CRUD complet (ajout manuel + réception des retours email), drag-drop pour réordonner.
  - Les retours sont stockés dans le `.wmsplan` et visibles en read-only dans l'export client.

### Phase 2 — Accès en ligne multi-utilisateurs (backend requis)

<!-- À engager uniquement après validation de la Phase 1 sur des projets réels. -->
<!-- Décision 2026-06-02 : l'hébergement des données sensibles clients est un point bloquant à trancher avant de démarrer. -->

- [ ] Définir la stratégie d'hébergement des données (données sensibles : noms clients, planning, contacts).
  - Option A : Supabase région EU (Frankfurt) — GDPR-compatible, tiers de confiance, ~25$/mois.
  - Option B : VPS auto-hébergé (Hetzner/OVH France ou Allemagne) — contrôle total, ~5–15€/mois, maintenance à prévoir.
  - Option C : Serveur on-premises entreprise — contrôle maximal, dépend de l'IT interne.
- [ ] Trois rôles utilisateurs à implémenter :
  - **Manager** : voit tous les projets, accès lecture seule, vue Portfolio complète.
  - **DP / CDP Tech** : accès aux projets qui leur sont assignés, édition complète.
  - **Client** : lien UUID public (pas de compte), lecture seule Gantt + onglets métier + onglet Retours/UAT.
- [ ] Stack cible envisagée : frontend HTML/JS/CSS existant (déjà browser-ready via tauri-ipc.js), backend Supabase (auth, PostgreSQL, real-time subscriptions), hébergement frontend Vercel ou Netlify.
- [ ] Intégrer le process de suivi des tests clients (UAT structuré avec scenarios de test, validation par le client, suivi d'avancement).
- [ ] Synchronisation live entre DP et CDP Tech sur un même projet (real-time via Supabase Realtime ou équivalent).
