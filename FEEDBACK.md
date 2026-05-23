# WMS Planner — Feedback & Change Requests

Add items below as you test the app. I'll work through them section by section.

Format: `- [ ] description` for pending, `- [x] description` once done.

---

## Home Screen

<!-- Project cards, search, create/open/duplicate/delete -->

- [x] Le bouton ouvrir... ne fonctionne pas. Il devrait permettre d; importe in Json de projet et de créer ce nouveau projet
- [x] Dans la modale de création de projet, enlever (mecalux) du champ Dir Projet.
- [x] Dans la meme modale, enlever la date de fin. Celle ci sera renseignée automatiquement avec la date la plus eloignée d'une tâche du planning.
- [x] Enlever (Originiale) du champ date d'installation.
- [ ] En plus de supprimer et dupliquer un projet, ajouter la possibilité de partager un projet.
- [x] Remplir le nom du client en même temps que le nom de projet car c'est souvent le meme mais garder le champ editable.

## Planning (Gantt)

<!-- Gantt chart, task add/edit/delete, phase management, date inputs -->

- [x] Pour les dates, mettre seulemetn les date de début et d'installation prévue. Si la date est reportée, on devra afficher un tag Reportée et offrir la possibilité de mettre un commentaire.
- [x]  bouttons + tache du navbar doit etre supprimé car déjà existant au niveau de chaques taches
- [x] Le bouton + phase du navbar doit etre descndu qu niveau du bouton export PDF au dessus du planning
- [x] le bouton de suppression de tache doit etre dans la modate d'edition
- [x] le bouton de suppression de tache doit se trouver aussi dans une modate edition au niveau de la phase.
- [x] pour les colonnes avec un menu déroulant, celui ci doit être clickable dans toute la cellule.
- [x] Dans la colonne propriétaire, il faut les champs suivant : nom du client, mecalux, intégrateur, autre dans un menu déroulant.
- [x] Chaque phase doit avoir le nombre de jours de durée en prenant les dates de tache min et max
- [x] si l'on hover sur une celulle colorié du planning, on doit pouvoir voir la date hovered.
- [x] Le statut des tache doit être Non commencé par défaut.  
- [ ] Une phase Développement pour regrouper les taches de dev venues de JIRA via API. à prévoir mais pas mettre en place pour le moment.

## Suivi Heures

<!-- Hours table, custom rows, history accordion, KPI cards -->
- [x] laisser le texte des champs de la colone catégorie editable.
- [x] Ajouter une colonne avec un dropdown contenant les catégorie Custom, Standard, Offre Comp.
- [x] Cette colonne permettra de remplur les lignes du haux du tableau qui ne seront pas editable.
- [x] Touts les lignes autres que les totals des heures doivent avoir un boutton Edit avec un bouton delete dans la modale
- [x] Toutes les lignes doivent pouvoir être réorganisées

## Tâches Internes

<!-- Internal tasks table, status, urgency, drag-drop -->
- [x] le drag and drop ne fonctionne pas.
- [x] toutes les lignes doivent avoir un bouton edit avec un bouton delete dans la modale.
- [x] Les taches doivent avoir une colonne propriétaire
  
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

## Facturation

<!-- Billing milestones, KPI cards -->
- [x] toutes les lignes doivent avoir un bouton edit avec un bouton delete dans la modale.
- [x] Les colonnes doivent être assez large pour afficher tout le texte.
- [x] le drag and drop ne fonctionne pas.
- [x] ajuster le formating des montants.

## Tableau de Bord (Dashboard)

<!-- KPI cards, charts, install drift block -->
- [ ] pour la facturation, utiliser un graphique d'une barreavec les différentes parties payé ou non et le montant global.
- [ ] Ajouter la possibilité de customiser ce dashboard en selectionnant les graphique à afficher.
  
## Onglets Personnalisés (Custom Tabs)

<!-- Tab creation modal, column builder, row CRUD -->

## Export HTML

<!-- Tab selection modal, exported file quality -->
- [ ] Le bouton export HTML doit proposer un endroit de sauvegarde du fichier html
  
## Export PDF

<!-- Gantt PDF export -->

## General / Cross-cutting

<!-- Nav, save indicator, undo toast, keyboard shortcuts, responsive layout, performance -->
- [ ] Le bouton PDF dans le nav bar doit s'appliquer seulement à l'onglet sélectionné.

## Notes Techniques

<!-- Implementation notes for future reference -->
- [ ] **Drag & drop natif (futur)** : remplacer les boutons ↑↓ par SortableJS pour un vrai drag & drop.
  - Ajouter `<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js"></script>` dans app.html
  - Remplacer `makeReorderable(tr, arr, renderFn)` par `Sortable.create(tbody, { handle: '.drag-handle', animation: 150, onEnd: ({ oldIndex, newIndex }) => { const [item] = arr.splice(oldIndex, 1); arr.splice(newIndex, 0, item); renderFn(); debouncedSave(); } })`
  - SortableJS utilise les pointer events en interne — contourne le bug Chromium/WebView2 avec l'API HTML5 drag dans les tableaux.
