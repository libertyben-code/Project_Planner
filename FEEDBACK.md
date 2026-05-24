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
  
## Onglets Personnalisés (Custom Tabs)

<!-- Tab creation modal, column builder, row CRUD -->

## Export HTML

<!-- Tab selection modal, exported file quality -->
- [x] Le bouton export HTML doit proposer un endroit de sauvegarde du fichier html - OK
  
## Export PDF

<!-- Gantt PDF export -->

## General / Cross-cutting

<!-- Nav, save indicator, undo toast, keyboard shortcuts, responsive layout, performance -->
- [x] Le bouton PDF dans le nav bar doit s'appliquer seulement à l'onglet sélectionné. - OK
- [x] Permettre d'ajuster la largeur des colonnes comme dans excel. - OK

## Notes Techniques

<!-- Implementation notes for future reference -->
- [x] **Drag & drop natif** : SortableJS remplace les boutons ↑↓ — drag-handle ⠿ sur toutes les tables. - OK
  - Ajouter `<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js"></script>` dans app.html
  - Remplacer `makeReorderable(tr, arr, renderFn)` par `Sortable.create(tbody, { handle: '.drag-handle', animation: 150, onEnd: ({ oldIndex, newIndex }) => { const [item] = arr.splice(oldIndex, 1); arr.splice(newIndex, 0, item); renderFn(); debouncedSave(); } })`
  - SortableJS utilise les pointer events en interne — contourne le bug Chromium/WebView2 avec l'API HTML5 drag dans les tableaux.
- [x] **Heures dynamiques** : les lignes bold ont un champ `totalType` ("Standard", "Custom", "Offre Comp"). `renderHeures()` recalcule vente/actuel via `heuresVenteByType(type)` / `heuresActuelByType(type)`. Les lignes éditables ont un champ `type` qui détermine à quel total elles contribuent. Changer le type ou une valeur déclenche `renderHeures(); renderDashboard();` immédiatement.
