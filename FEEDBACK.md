# WMS Planner — Feedback & Change Requests

Add items below as you test the app. I'll work through them section by section.

Format: `- [ ] description` for pending, `- [x] description` once done.

---

## Home Screen

<!-- Project cards, search, create/open/duplicate/delete -->

- [x] Le bouton ouvrir... ne fonctionne pas. Il devrait permettre d; importe in Json de projet et de créer ce nouveau projet - OK
- [x] Dans la modale de création de projet, enlever (mecalux) du champ Dir Projet. - OK
- [x] Dans la meme modale, enlever la date de fin. Celle ci sera renseignée automatiquement avec la date la plus eloignée d'une tâche du planning. - OK
- [x] Enlever (Originiale) du champ date d'installation. - OK
- [x] En plus de supprimer et dupliquer un projet, ajouter la possibilité de partager un projet. - OK
- [x] Remplir le nom du client en même temps que le nom de projet car c'est souvent le meme mais garder le champ editable. - OK
- [x] Actulisation du portfolio lors de la suppression ou l'ajout d; un projet — OK
- [x] Mettre le portfolio sur une tab à part entière. — OK
- [x] Mettre le porfolio et la page principale en mode clair — OK
- [x] Dans settings, ajouter l'option mode dark ou light — OK

## Planning (Gantt)

<!-- Gantt chart, task add/edit/delete, phase management, date inputs -->

- [x] Pour les dates, mettre seulemetn les date de début et d'installation prévue. Si la date est reportée, on devra afficher un tag Reportée et offrir la possibilité de mettre un commentaire.
  - [x] Si la date est changée, demandé si c'est un retard de projet ou juste un ajustement et afficher les deux dates. - OK
- [x]  bouttons + tache du navbar doit etre supprimé car déjà existant au niveau de chaques taches - OK
- [x] Le bouton + phase du navbar doit etre descndu qu niveau du bouton export PDF au dessus du planning - OK
- [x] le bouton de suppression de tache doit etre dans la modate d'edition - OK
- [x] le bouton de suppression de tache doit se trouver aussi dans une modate edition au niveau de la phase. - OK
- [x] pour les colonnes avec un menu déroulant, celui ci doit être clickable dans toute la cellule. - OK
- [x] Dans la colonne propriétaire, il faut les champs suivant : nom du client, mecalux, intégrateur, autre dans un menu déroulant.
  - [x] Si le nom du client est changé en haut de la page, cela doit se refletter dans les menus déroulant et autres pages. - OK
- [x] Chaque phase doit avoir le nombre de jours de durée en prenant les dates de tache min et max - ok
- [x] si l'on hover sur une celulle colorié du planning, on doit pouvoir voir la date hovered. - OK
  - [x] Améliorer les infos du la bulle. - OK
- [x] Le statut des tache doit être Non commencé par défaut.  
- [x] Un bouton edit planning doit permettre de drag and drop les taches dans toutes les phases. - OK
- [x] Ce meme bouton doit permettre de drag and drop une phase avec toute ses taches. - OK
- [x] Une phase JIRA dans le planning (épics + tâches, barres de Gantt, progression). Backbone complet : onglet JIRA dédié, modal de configuration (URL Atlassian, clé projet, email, token API), fonction syncJira() prête pour la vraie clé. Données de démonstration pré-chargées dans le template. - OK
- [ ] Ajouter la possibilité de "réduire" une phase pour n'afficher que la ligne du nom de phase.

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
- [x] La colonne Qui? doit être un menu d;eroulant avec les meme infos que celle du planning. - OK

## Facturation

<!-- Billing milestones, KPI cards -->
- [x] toutes les lignes doivent avoir un bouton edit avec un bouton delete dans la modale.
- [x] Les colonnes doivent être assez large pour afficher tout le texte.
- [x] le drag and drop ne fonctionne pas.
- [x] ajuster le formating des montants.
- [x] Les pourcentages doivent être calculés automatiquement en fonction du cout total et des manton de chaques jalons. - OK

## Tableau de Bord (Dashboard)

<!-- KPI cards, charts, install drift block -->
- [x] pour la facturation, utiliser un graphique d'une barreavec les différentes parties payé ou non et le montant global.
- [x] Ajouter la possibilité de customiser ce dashboard en selectionnant les graphique à afficher. - OK
- [x] Ajouter un graphique JIRA dans le dashboard : barres horizontales empilées par épic (Terminé / En cours / À faire), activable/désactivable comme les autres graphiques. - OK
- [ ] actualiser la modale personalliser avec toutes les différentres cartes et graphs.
  
## Onglets Personnalisés (Custom Tabs)

<!-- Tab creation modal, column builder, row CRUD -->

## Export HTML

<!-- Tab selection modal, exported file quality -->
- [x] Le bouton export HTML doit proposer un endroit de sauvegarde du fichier html - OK
- [ ] La formating de l'export HTML n'est pas le meme que celui de l'appli. Il doit ressembler à l'appli

## Export PDF

<!-- Gantt PDF export -->
- [ ] Changer le Chef de Projet en haut à gauche et mettre Directeur de Projet.

## General / Cross-cutting

<!-- Nav, save indicator, undo toast, keyboard shortcuts, responsive layout, performance -->
- [x] Le bouton PDF dans le nav bar doit s'appliquer seulement à l'onglet sélectionné. - OK
- [x] Permettre d'ajuster la largeur des colonnes comme dans excel. - OK
- [ ] Permettre de choisir un dossier d'enregistrement automatique par projet en plus du dossier principale à des intervalles régulières.
- [ ] Pour les backups, prévoir un dossier "Backup" dans le dossier de sauvegarde principale pour permettre la récupération d'une version anterieure. Prévoir la fréquence de manière journalière. Si un autre système de backup est plus adapté, me le proposer.
- [ ] Dans le menu Settings du menu principal, prévoir la possibilité de choisir son propre template pour tous les nouveaux projets.
- [ ] Ajouter une partie Settings qui permet de définit les listes de menu déroulant comme "propriétaire".

## Notes Techniques

<!-- Implementation notes for future reference -->
- [x] **Drag & drop natif** : SortableJS remplace les boutons ↑↓ — drag-handle ⠿ sur toutes les tables. - OK
  - Ajouter `<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js"></script>` dans app.html
  - Remplacer `makeReorderable(tr, arr, renderFn)` par `Sortable.create(tbody, { handle: '.drag-handle', animation: 150, onEnd: ({ oldIndex, newIndex }) => { const [item] = arr.splice(oldIndex, 1); arr.splice(newIndex, 0, item); renderFn(); debouncedSave(); } })`
  - SortableJS utilise les pointer events en interne — contourne le bug Chromium/WebView2 avec l'API HTML5 drag dans les tableaux.
- [x] **Heures dynamiques** : les lignes bold ont un champ `totalType` ("Standard", "Custom", "Offre Comp"). `renderHeures()` recalcule vente/actuel via `heuresVenteByType(type)` / `heuresActuelByType(type)`. Les lignes éditables ont un champ `type` qui détermine à quel total elles contribuent. Changer le type ou une valeur déclenche `renderHeures(); renderDashboard();` immédiatement.

## Evolutions 

- [ ] Ajouter un calendrier globale des ressources pour permettre de connaitre les disponibilité de chaques CDP Tech et DP. Leurs planning de congés pourront être remplis automatiquement d'après ce planning global. C'est aujourd'hui un google calendar.
  - [ ] Les utilisateurs devront être crées à l'avance et dans la création de projet, un menu déroulant sera utilisé pour choisir les DP et CDP Tech.
- [ ] Integrer le process de suivi des tests clients.
- [ ] Integrer l'import de fichier excel en tant que nouvelle tab (tableau avec colone and type)
- [ ] Permettre le zoom in et out en faisont control + scroll ou bouton + / - si possible.