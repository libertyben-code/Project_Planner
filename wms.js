// =====================================================
//  WMS Project Planning — Application Script
// =====================================================
//  Fichiers liés : index.html  /  wms.css
//
//  Sections :
//    1.  Navigation
//    2.  Utilitaires (uid, dropdown flottant, drag & drop)
//    3.  Données Gantt (phases, tâches)
//    4.  Moteur Gantt (rendu, semaines dynamiques)
//    5.  Modaux (ajout/édition tâche, phase)
//    6.  Export PDF
//    7.  Suivi Heures
//    8.  Tâches Internes
//    9.  Interfaces ERP
//    10. Fonctionnel
//    11. Prérequis Dry Run
//    12. Prérequis Installation
//    13. Facturation
//    14. Tableau de bord (graphiques)
//    15. Initialisation
// =====================================================

// ═══ NAV ═══
document.querySelectorAll('.nav-tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    tab.classList.add('active');
    const pg=document.getElementById(tab.dataset.page);
    pg.classList.add('active');
    if(tab.dataset.page==='page-dashboard') setTimeout(renderDashboard,50);
  });
});
function syncNav(){document.title='WMS Planning – '+document.getElementById('pi-project').value;}

// ═══ UTILS ═══
function uid(){return '_'+Math.random().toString(36).slice(2,9);}

// ═══ FLOATING DROPDOWN ═══
let _activeDD=null;
function closeAllDD(){if(_activeDD){_activeDD.remove();_activeDD=null;}}
document.addEventListener('click',closeAllDD);
function showDropdown(anchorEl,options,onSelect){
  closeAllDD();
  const dd=document.createElement('div');dd.className='fl-dropdown';_activeDD=dd;
  options.forEach(opt=>{
    const el=document.createElement('div');el.className='fl-opt';
    const dot=document.createElement('span');dot.className='fl-opt-dot';dot.style.background=opt.dot||'#cbd5e1';el.appendChild(dot);
    el.appendChild(document.createTextNode(opt.label!==undefined?opt.label:opt));
    el.onmousedown=e=>{e.preventDefault();e.stopPropagation();onSelect(opt.value!==undefined?opt.value:opt);closeAllDD();};
    dd.appendChild(el);
  });
  document.body.appendChild(dd);
  const r=anchorEl.getBoundingClientRect();
  let top=r.bottom+3,left=r.left;
  dd.style.visibility='hidden';dd.style.top=top+'px';dd.style.left=left+'px';
  requestAnimationFrame(()=>{
    if(top+dd.offsetHeight>window.innerHeight-8)top=r.top-dd.offsetHeight-3;
    if(left+dd.offsetWidth>window.innerWidth-8)left=window.innerWidth-dd.offsetWidth-8;
    dd.style.top=top+'px';dd.style.left=left+'px';dd.style.visibility='visible';
  });
  dd.addEventListener('click',e=>e.stopPropagation());
}

// ═══ DRAG & DROP ═══
let _dragSrc=null,_dragArr=null,_dragRender=null;
function makeDraggable(tr,arr,renderFn){
  tr.draggable=true;
  tr.addEventListener('dragstart',e=>{_dragSrc=tr;_dragArr=arr;_dragRender=renderFn;tr.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
  tr.addEventListener('dragend',()=>{tr.classList.remove('dragging');document.querySelectorAll('.drag-over-top,.drag-over-bot').forEach(x=>{x.classList.remove('drag-over-top','drag-over-bot');});_dragSrc=null;});
  tr.addEventListener('dragover',e=>{if(!_dragSrc||_dragSrc===tr)return;e.preventDefault();document.querySelectorAll('.drag-over-top,.drag-over-bot').forEach(x=>{x.classList.remove('drag-over-top','drag-over-bot');});const mid=tr.getBoundingClientRect().top+tr.getBoundingClientRect().height/2;tr.classList.add(e.clientY<mid?'drag-over-top':'drag-over-bot');});
  tr.addEventListener('dragleave',()=>tr.classList.remove('drag-over-top','drag-over-bot'));
  tr.addEventListener('drop',e=>{
    e.preventDefault();if(!_dragSrc||_dragSrc===tr)return;
    const si=_dragArr.findIndex(r=>r.id===_dragSrc.dataset.rowId),ti=_dragArr.findIndex(r=>r.id===tr.dataset.rowId);
    if(si<0||ti<0)return;
    const[item]=_dragArr.splice(si,1);
    const after=e.clientY>=tr.getBoundingClientRect().top+tr.getBoundingClientRect().height/2;
    _dragArr.splice(after?ti:ti,0,item);
    tr.classList.remove('drag-over-top','drag-over-bot');
    _dragRender();
  });
}
function dh(){return `<span class="drag-handle" title="Réorganiser">⠿</span>`;}

// ═══ GANTT DATA ═══
let phases=[
  {id:'INDISPO',name:'INDISPONIBILITÉS / CONGÉS',code:'I',color:'#64748b'},
  {id:'PLAN',   name:'PLANIFICATION DU PROJET',  code:'P',color:'#2563eb'},
  {id:'ERP',    name:'INTERFACE ERP',            code:'E',color:'#7c3aed'},
  {id:'DEV',    name:'DÉVELOPPEMENTS',           code:'D',color:'#0891b2'},
  {id:'FORM',   name:'FORMATION & UAT',          code:'F',color:'#059669'},
];
let tasks=[
  {id:uid(),phaseId:'INDISPO',name:'Dir. Projet - Ben LIBERTY',             owner:'MECALUX', start:'2026-07-27',end:'2026-08-26',status:'',priority:'',progress:0,deliverable:'',isUnavail:true},
  {id:uid(),phaseId:'INDISPO',name:'Chef de Projet Technique - Timothy MARCIA',owner:'MECALUX',start:'',end:'',status:'',priority:'',progress:0,deliverable:'',isUnavail:true},
  {id:uid(),phaseId:'INDISPO',name:'Responsable Logistique - Cyril SERAFINI',owner:'NIC IMPEX',start:'',end:'',status:'',priority:'',progress:0,deliverable:'',isUnavail:true},
  {id:uid(),phaseId:'INDISPO',name:'Responsable de dépôt - Stephan GROS',   owner:'NIC IMPEX',start:'',end:'',status:'',priority:'',progress:0,deliverable:'',isUnavail:true},
  {id:uid(),phaseId:'INDISPO',name:'Responsable ADV - Ludiwine MOREAUD',     owner:'NIC IMPEX',start:'',end:'',status:'',priority:'',progress:0,deliverable:'',isUnavail:true},
  {id:uid(),phaseId:'PLAN',name:"Visite d'Analyse Fonctionnelle",            owner:'TOUS',start:'2026-04-02',end:'2026-04-02',status:'Terminé',priority:'',progress:100,deliverable:''},
  {id:uid(),phaseId:'PLAN',name:"Ateliers & Rédaction de l'Analyse Fonctionnelle",owner:'TOUS',start:'2026-04-03',end:'2026-05-15',status:'Terminé',priority:'',progress:100,deliverable:''},
  {id:uid(),phaseId:'PLAN',name:"Validation de l'Analyse Fonctionnelle",     owner:'TOUS',start:'2026-05-15',end:'2026-05-15',status:'Terminé',priority:'',progress:100,deliverable:''},
  {id:uid(),phaseId:'PLAN',name:'Ateliers Mapping pour AF SAGE',             owner:'TOUS',start:'2026-05-04',end:'2026-05-22',status:'En cours',priority:'',progress:75,deliverable:''},
  {id:uid(),phaseId:'PLAN',name:'Analyse technique & Rédaction tâches développement',owner:'MECALUX',start:'2026-05-15',end:'2026-05-29',status:'En cours',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'ERP',name:'Rédaction des spécifications interface',     owner:'',start:'',end:'',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'ERP',name:'Base Article - ITM',                         owner:'',start:'',end:'',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'ERP',name:'Base fournisseurs - SUP',                    owner:'',start:'',end:'',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'ERP',name:'Préavis de réception - ROR/ASN',            owner:'',start:'',end:'',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'ERP',name:'Confirmation de déchargement - Fichier Custom',owner:'',start:'',end:'',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'ERP',name:"Clôture commande d'achat - ROF/ASO/ASK",   owner:'',start:'',end:'',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'ERP',name:'Confirmation de réception - REF',            owner:'',start:'',end:'',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'ERP',name:'Commande client - SOR',                      owner:'',start:'',end:'',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'ERP',name:"Changement d'état de commande - SOC",       owner:'',start:'',end:'',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'ERP',name:'Clôture commande client - SOF',              owner:'',start:'',end:'',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'ERP',name:'Changement de statut de stock - STC',        owner:'',start:'',end:'',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'ERP',name:'Variation de stock - STV',                   owner:'',start:'',end:'',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'ERP',name:"Demande d'état de stock - SCR",             owner:'',start:'',end:'',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'ERP',name:'Image de stock - WSC',                       owner:'',start:'',end:'',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'ERP',name:'Appel API Transporteurs',                    owner:'',start:'',end:'',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'ERP',name:"Erreur d'intégration - ERR",                owner:'',start:'',end:'',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'DEV',name:'Modélisation/Configuration Entrepôt',        owner:'MECALUX',start:'2026-05-15',end:'2026-05-29',status:'En cours',priority:'',progress:50,deliverable:''},
  {id:uid(),phaseId:'DEV',name:'Développements Fonctionnels',                owner:'MECALUX',start:'2026-06-01',end:'2026-06-26',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'DEV',name:'Tests et validation développements fonctionnels',owner:'MECALUX',start:'2026-06-01',end:'2026-06-26',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'DEV',name:'Paramétrage environnement client',            owner:'MECALUX',start:'2026-06-08',end:'2026-06-12',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'DEV',name:'Étiquetage Entrepôt',                       owner:'NIC IMPEX',start:'2026-06-26',end:'2026-06-26',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'DEV',name:'Paramétrage des TRF / Imprimantes',          owner:'MECALUX',start:'2026-06-01',end:'2026-06-12',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'FORM',name:'Formation des Key Users',                   owner:'MECALUX',start:'2026-06-15',end:'2026-06-16',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'FORM',name:'Tests et validation des développements',     owner:'NIC IMPEX',start:'2026-06-17',end:'2026-07-06',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'FORM',name:'Formation des opérateurs',                  owner:'NIC IMPEX',start:'2026-07-09',end:'2026-09-05',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'FORM',name:'Inventaire localisé des stocks - Dry Run WMS',owner:'NIC IMPEX',start:'2026-07-15',end:'2026-07-15',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'FORM',name:'DRY RUN & GO/NO GO',                       owner:'TOUS',start:'2026-07-15',end:'2026-07-15',status:'',priority:'',progress:0,deliverable:'',barColor:'#dc2626'},
  {id:uid(),phaseId:'FORM',name:'Inventaire complet des stocks pour GO LIVE',owner:'NIC IMPEX',start:'2026-09-10',end:'2026-09-11',status:'',priority:'',progress:0,deliverable:''},
  {id:uid(),phaseId:'FORM',name:'INSTALLATION',                              owner:'TOUS',start:'2026-09-14',end:'2026-09-18',status:'',priority:'',progress:0,deliverable:'',barColor:'#ea580c'},
  {id:uid(),phaseId:'FORM',name:'HyperCare',                                 owner:'MECALUX',start:'2026-09-21',end:'2026-10-16',status:'',priority:'',progress:0,deliverable:'',barColor:'#4f46e5'},
];

// ═══ GANTT ENGINE ═══
function mondayOf(d){const day=new Date(d);day.setHours(0,0,0,0);const dow=day.getDay();day.setDate(day.getDate()+(dow===0?-6:1-dow));return day;}
const TODAY=new Date();TODAY.setHours(0,0,0,0);
const MONTHS_FR=['JANVIER','FÉVRIER','MARS','AVRIL','MAI','JUIN','JUILLET','AOÛT','SEPTEMBRE','OCTOBRE','NOVEMBRE','DÉCEMBRE'];

function getGanttBounds(){
  // Compute range from project start/end fields + all task dates, adding 2 weeks buffer each side
  const startEl=document.getElementById('pi-start').value;
  const endEl=document.getElementById('pi-end').value;
  let minD=startEl?new Date(startEl):new Date('2026-03-01');
  let maxD=endEl?new Date(endEl):new Date('2026-12-31');
  tasks.forEach(t=>{
    if(t.start){const d=new Date(t.start);if(d<minD)minD=d;}
    if(t.end){const d=new Date(t.end);if(d>maxD)maxD=d;}
  });
  minD.setDate(minD.getDate()-14);
  maxD.setDate(maxD.getDate()+14);
  return{start:mondayOf(minD),end:mondayOf(maxD)};
}
function generateWeeks(){
  const{start,end}=getGanttBounds();
  const w=[],c=new Date(start);
  while(c<=end){w.push(new Date(c));c.setDate(c.getDate()+7);}
  return w;
}
function weekLabel(d){return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0');}
function isInWeek(s,e,w){if(!s||!e)return false;const sd=new Date(s),ed=new Date(e),ws=new Date(w),we=new Date(w);ed.setHours(23,59,59);we.setDate(we.getDate()+6);we.setHours(23,59,59);return sd<=we&&ed>=ws;}
function isToday(w){const ws=new Date(w),we=new Date(w);we.setDate(we.getDate()+6);we.setHours(23,59,59);return TODAY>=ws&&TODAY<=we;}
function monthGroups(weeks){const g=[];let c=null;weeks.forEach((w,i)=>{const m=w.getMonth();if(!c||c.month!==m){c={month:m,label:MONTHS_FR[m],start:i,span:1};g.push(c);}else c.span++;});return g;}
function getPhaseColor(task){if(task.barColor)return task.barColor;const ph=phases.find(p=>p.id===task.phaseId);return ph?ph.color:'#94a3b8';}

const STATUS_OPTS=[
  {label:'— Aucun —',value:'',dot:'#e2e7ed'},
  {label:'Non commencé',value:'Non commencé',dot:'#94a3b8'},
  {label:'En cours',value:'En cours',dot:'#2563eb'},
  {label:'Terminé',value:'Terminé',dot:'#059669'},
  {label:'En attente',value:'En attente',dot:'#d97706'},
  {label:'En retard',value:'En retard',dot:'#dc2626'},
  {label:'Vérification requise',value:'Vérification requise',dot:'#7c3aed'},
  {label:'Mise à jour requise',value:'Mise à jour requise',dot:'#0891b2'},
];
const PRIO_OPTS=[
  {label:'— Aucune —',value:'',dot:'#e2e7ed'},
  {label:'FAIBLE',value:'FAIBLE',dot:'#10b981'},
  {label:'MOYENNE',value:'MOYENNE',dot:'#f59e0b'},
  {label:'ÉLEVÉE',value:'ÉLEVÉE',dot:'#ef4444'},
];
function statusBadgeHTML(s){const cls=s?'badge-'+s.replace(/\s+/g,'-'):'badge-empty';return`<span class="badge ${cls}">${s||'—'}</span>`;}
function prioHTML(p){if(!p)return`<span style="color:var(--text-muted);font-size:11px;cursor:pointer">—</span>`;return`<span class="prio-${p}" style="cursor:pointer">${p}</span>`;}

// Edit task modal (also used for phase change)
let _editingTaskId=null;
function openEditTask(taskId){
  _editingTaskId=taskId;
  const task=tasks.find(t=>t.id===taskId);
  document.getElementById('modal-task-title').textContent='Modifier la tâche';
  document.getElementById('btn-save-task').textContent='Mettre à jour';
  const sel=document.getElementById('task-phase');sel.innerHTML='';
  phases.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.name;if(p.id===task.phaseId)o.selected=true;sel.appendChild(o);});
  document.getElementById('task-name').value=task.name;
  document.getElementById('task-owner').value=task.owner||'';
  document.getElementById('task-start').value=task.start||'';
  document.getElementById('task-end').value=task.end||'';
  document.getElementById('task-status').value=task.status||'';
  document.getElementById('task-priority').value=task.priority||'';
  document.getElementById('task-progress').value=task.progress||0;
  document.getElementById('task-deliverable').value=task.deliverable||'';
  document.getElementById('modal-task').classList.add('open');
}

function renderGantt(){
  const WEEKS=generateWeeks();
  const table=document.getElementById('gantt-table');table.innerHTML='';
  const mGroups=monthGroups(WEEKS);
  const showDates=document.getElementById('tog-dates').checked;
  const showOwner=document.getElementById('tog-owner').checked;
  const showPrio=document.getElementById('tog-prio').checked;
  const showAvance=document.getElementById('tog-avance').checked;
  const fixedCols=[
    ['STATUT','col-statut',true],['PRIORITÉ','col-priorite',showPrio],
    ['INTITULÉ','col-intitule',true],['PROPRIÉTAIRE','col-proprio',showOwner],
    ['DÉBUT','col-debut',showDates],['FIN','col-fin',showDates],
    ['J','col-jours',showDates],['% AVA.','col-avancement',showAvance],
    ['','col-actions',true], // edit/delete
  ];
  const visFC=fixedCols.filter(c=>c[2]);
  const fixedCount=visFC.length;

  // Month row
  const r1=table.insertRow();
  const thB=document.createElement('th');thB.colSpan=fixedCount;thB.className='th-month';thB.style.background='#1a2332';r1.appendChild(thB);
  mGroups.forEach(mg=>{const th=document.createElement('th');th.colSpan=mg.span;th.className='th-month';th.textContent=mg.label;r1.appendChild(th);});

  // Header row
  const r2=table.insertRow();
  visFC.forEach(([lbl,cls])=>{const th=document.createElement('th');th.className='th-fixed '+cls;th.textContent=lbl;r2.appendChild(th);});
  WEEKS.forEach(w=>{const th=document.createElement('th');th.className='th-week col-week';th.textContent=weekLabel(w);if(isToday(w))th.style.borderLeft='2px solid #f97316';r2.appendChild(th);});

  // Phase rows (always render all phases)
  phases.forEach(phase=>{
    const phaseTasks=tasks.filter(t=>t.phaseId===phase.id);

    // Phase header row — always shown
    const rp=table.insertRow();rp.className='tr-phase';
    const tdPh=document.createElement('td');tdPh.colSpan=fixedCount;tdPh.style.background=phase.color;
    tdPh.innerHTML=`<span style="cursor:pointer" title="Modifier la phase" onclick="openEditPhase('${phase.id}')">${phase.name}</span>
      <span style="float:right;display:flex;gap:6px;align-items:center">
        <button onclick="openAddTaskModal('${phase.id}')" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:10px;font-family:inherit">+ Tâche</button>
        <button onclick="removePhase('${phase.id}')" style="background:rgba(255,0,0,.25);border:none;color:#fff;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:10px;font-family:inherit" title="Supprimer la phase">✕</button>
      </span>`;
    rp.appendChild(tdPh);
    WEEKS.forEach(w=>{const td=document.createElement('td');td.className='gantt-cell';td.style.background=phase.color;td.style.opacity='.2';if(isToday(w))td.style.borderLeft='2px solid #f97316';rp.appendChild(td);});

    if(phaseTasks.length===0){
      // Empty placeholder row
      const re=table.insertRow();re.className='tr-task';
      visFC.forEach(([lbl,cls])=>{
        const td=document.createElement('td');td.className=cls;
        if(lbl==='INTITULÉ'){td.style.padding='4px 8px';td.style.color='var(--text-muted)';td.style.fontStyle='italic';td.textContent='Aucune tâche — cliquer "+ Tâche" pour en ajouter';}
        re.appendChild(td);
      });
      WEEKS.forEach(w=>{const td=document.createElement('td');td.className='gantt-cell';if(isToday(w))td.classList.add('today-col');re.appendChild(td);});
      return;
    }

    phaseTasks.forEach(task=>{
      const rt=table.insertRow();rt.className=task.isUnavail?'tr-unavail':'tr-task';rt.dataset.taskId=task.id;
      const done=task.progress>=100;

      fixedCols.forEach(([lbl,cls,vis])=>{
        if(!vis)return;
        const td=document.createElement('td');td.className=cls;

        if(lbl==='STATUT'){
          td.className+=' status-cell';td.innerHTML=statusBadgeHTML(task.status);
          td.querySelector('.badge').addEventListener('click',e=>{e.stopPropagation();showDropdown(td.querySelector('.badge'),STATUS_OPTS,val=>{updateTask(task.id,'status',val);renderGantt();renderDashboard();});});
        }else if(lbl==='PRIORITÉ'){
          td.style.padding='2px 6px';td.innerHTML=prioHTML(task.priority);
          td.querySelector('span').addEventListener('click',e=>{e.stopPropagation();showDropdown(td.querySelector('span'),PRIO_OPTS,val=>{updateTask(task.id,'priority',val);renderGantt();});});
        }else if(lbl==='INTITULÉ'){
          td.contentEditable=true;td.textContent=task.name;td.style.padding='2px 6px';td.style.fontWeight=task.isUnavail?'400':'500';
          if(done){td.style.textDecoration='line-through';td.style.color='var(--text-muted)';}
          td.onblur=e=>updateTask(task.id,'name',e.target.textContent.trim());
        }else if(lbl==='PROPRIÉTAIRE'){
          td.contentEditable=true;td.textContent=task.owner;td.style.padding='2px 6px';
          td.onblur=e=>updateTask(task.id,'owner',e.target.textContent.trim());
        }else if(lbl==='DÉBUT'||lbl==='FIN'){
          const field=lbl==='DÉBUT'?'start':'end';
          const inp=document.createElement('input');inp.type='date';inp.value=task[field]||'';
          inp.style.cssText='border:none;background:transparent;font-family:inherit;font-size:11px;color:inherit;width:100%;cursor:pointer;padding:1px 3px;';
          inp.onchange=e=>{updateTask(task.id,field,e.target.value);renderGantt();};
          td.appendChild(inp);
        }else if(lbl==='J'){
          td.style.textAlign='center';td.style.fontSize='11px';
          if(task.start&&task.end){const d=Math.round((new Date(task.end)-new Date(task.start))/86400000)+1;td.textContent=d>0?d:'';}
        }else if(lbl==='% AVA.'){
          td.style.padding='2px 6px';td.style.cursor='pointer';
          const pct=task.progress||0;const color=getPhaseColor(task);
          td.innerHTML=`<div class="progress-wrap"><div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div><span class="progress-pct">${pct}%</span></div>`;
          td.onclick=()=>{const v=prompt("% d'avancement :",pct);if(v!==null&&!isNaN(+v)){updateTask(task.id,'progress',Math.min(100,Math.max(0,+v)));renderGantt();renderDashboard();}};
        }else if(lbl===''){
          // Action buttons: edit + delete
          td.style.padding='1px 4px';td.style.textAlign='center';td.style.whiteSpace='nowrap';
          td.innerHTML=`<button title="Modifier / changer de phase" onclick="openEditTask('${task.id}')" style="background:var(--accent-light);border:none;color:var(--accent);border-radius:4px;padding:2px 7px;cursor:pointer;font-size:10px;font-family:inherit;margin-right:2px">✏</button><button title="Supprimer" onclick="deleteTask('${task.id}')" style="background:#fee2e2;border:none;color:#dc2626;border-radius:4px;padding:2px 7px;cursor:pointer;font-size:10px;font-family:inherit">✕</button>`;
        }
        rt.appendChild(td);
      });

      const phColor=getPhaseColor(task);
      WEEKS.forEach(w=>{
        const td=document.createElement('td');td.className='gantt-cell';
        if(isToday(w))td.classList.add('today-col');
        if(isInWeek(task.start,task.end,w)){
          const bar=document.createElement('span');bar.className='gantt-bar';bar.style.background=phColor;
          if(done)bar.classList.add('gantt-bar-done');
          td.appendChild(bar);
        }
        rt.appendChild(td);
      });
    });
  });
}
function updateTask(id,field,value){const t=tasks.find(t=>t.id===id);if(t)t[field]=value;}
function deleteTask(id){if(!confirm('Supprimer cette tâche ?'))return;tasks=tasks.filter(t=>t.id!==id);renderGantt();}
function removePhase(id){if(!confirm('Supprimer la phase ? Les tâches associées seront aussi supprimées.'))return;phases=phases.filter(p=>p.id!==id);tasks=tasks.filter(t=>t.phaseId!==id);renderGantt();}
function scrollToToday(){const WEEKS=generateWeeks();const idx=WEEKS.findIndex(w=>isToday(w));if(idx<0)return;const wr=document.getElementById('gantt-wrapper');wr.scrollLeft=Math.max(0,idx*22-200);}

// ═══ MODALS ═══
let _editingPhaseId=null;
function openAddTaskModal(phaseId){
  _editingTaskId=null;
  document.getElementById('modal-task-title').textContent='Nouvelle Tâche';
  document.getElementById('btn-save-task').textContent='Enregistrer';
  const sel=document.getElementById('task-phase');sel.innerHTML='';
  phases.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.name;if(p.id===phaseId)o.selected=true;sel.appendChild(o);});
  ['task-name','task-owner','task-start','task-end','task-deliverable'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('task-progress').value=0;document.getElementById('task-status').value='';document.getElementById('task-priority').value='';
  document.getElementById('modal-task').classList.add('open');
}
function openAddPhaseModal(){
  _editingPhaseId=null;
  document.getElementById('modal-phase-title').textContent='Nouvelle Phase';
  document.getElementById('phase-name').value='';document.getElementById('phase-code').value='';document.getElementById('phase-color').value='#1a56db';
  document.getElementById('modal-phase').classList.add('open');
}
function openEditPhase(phaseId){
  _editingPhaseId=phaseId;
  const ph=phases.find(p=>p.id===phaseId);
  document.getElementById('modal-phase-title').textContent='Modifier la Phase';
  document.getElementById('phase-name').value=ph.name;document.getElementById('phase-code').value=ph.code;document.getElementById('phase-color').value=ph.color;
  document.getElementById('modal-phase').classList.add('open');
}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function saveTask(){
  const name=document.getElementById('task-name').value.trim();
  if(!name){alert('Veuillez saisir un intitulé.');return;}
  const data={phaseId:document.getElementById('task-phase').value,name,owner:document.getElementById('task-owner').value.trim(),start:document.getElementById('task-start').value,end:document.getElementById('task-end').value,status:document.getElementById('task-status').value,priority:document.getElementById('task-priority').value,progress:+document.getElementById('task-progress').value||0,deliverable:document.getElementById('task-deliverable').value.trim()};
  if(_editingTaskId){Object.assign(tasks.find(t=>t.id===_editingTaskId),data);}
  else{tasks.push({id:uid(),...data});}
  closeModal('modal-task');renderGantt();renderDashboard();
}
function savePhase(){
  const name=document.getElementById('phase-name').value.trim();if(!name){alert('Veuillez saisir un nom.');return;}
  const code=document.getElementById('phase-code').value.trim().toUpperCase()||name.slice(0,2).toUpperCase();
  const color=document.getElementById('phase-color').value;
  if(_editingPhaseId){const ph=phases.find(p=>p.id===_editingPhaseId);ph.name=name.toUpperCase();ph.code=code;ph.color=color;}
  else{phases.push({id:uid(),name:name.toUpperCase(),code,color});}
  closeModal('modal-phase');renderGantt();
}
document.querySelectorAll('.modal-overlay').forEach(el=>el.addEventListener('click',function(e){if(e.target===this)this.classList.remove('open');}));

// ═══ PDF ═══
async function exportPDF(){
  const btn=document.querySelector('.btn-primary');const orig=btn.innerHTML;btn.innerHTML='Génération…';btn.disabled=true;
  try{
    const{jsPDF}=window.jspdf;const panel=document.getElementById('planning-panel');
    const wr=document.getElementById('gantt-wrapper');const prev=wr.style.overflow;wr.style.overflow='visible';
    const canvas=await html2canvas(panel,{scale:1.3,useCORS:true,backgroundColor:'#fff',logging:false,scrollX:0,scrollY:0,windowWidth:panel.scrollWidth,width:panel.scrollWidth});
    wr.style.overflow=prev;
    const imgData=canvas.toDataURL('image/png');
    const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a3'});
    const pageW=pdf.internal.pageSize.getWidth(),pageH=pdf.internal.pageSize.getHeight();
    const m=10,aw=pageW-m*2,ah=pageH-m*2-14;
    const ratio=canvas.width/canvas.height;let dw=aw,dh=dw/ratio;if(dh>ah){dh=ah;dw=dh*ratio;}
    const proj=document.getElementById('pi-project').value,cli=document.getElementById('pi-client').value,pm=document.getElementById('pi-pm').value,today=new Date().toLocaleDateString('fr-FR');
    pdf.setFillColor(26,35,50);pdf.rect(m,m,pageW-m*2,10,'F');
    pdf.setFont('helvetica','bold');pdf.setFontSize(11);pdf.setTextColor(255,255,255);pdf.text(`PLANNING — ${proj.toUpperCase()}`,m+4,m+6.5);
    pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.text(`Client: ${cli}  |  Chef de Projet: ${pm}  |  ${today}`,pageW-m-4,m+6.5,{align:'right'});
    pdf.addImage(imgData,'PNG',m,m+12,dw,dh);
    pdf.setFontSize(8);pdf.setTextColor(150,150,150);pdf.text(`Document confidentiel — ${proj}`,m,pageH-4);pdf.text('Page 1',pageW-m,pageH-4,{align:'right'});
    pdf.save(`Planning_${proj.replace(/\s+/g,'_')}_${today.replace(/\//g,'-')}.pdf`);
  }catch(e){console.error(e);alert('Erreur PDF.');}
  btn.innerHTML=orig;btn.disabled=false;
}
// ═══ HEURES ═══
let heuresData=[
  {cat:'Heures Standard',        vente:988,  actuel:null, desc:'Implémentation, gestion projet, formation, tests',bold:true,sep:false},
  {cat:'Heures Custom',          vente:120,  actuel:null, desc:'Développements spécifiques',bold:true,sep:false},
  {sep:true},
  {cat:'Implémentation Standard',vente:450,  actuel:null, desc:'',bold:false,sep:false},
  {cat:'Gestion Projet',         vente:40,   actuel:null, desc:'',bold:false,sep:false},
  {cat:'Analyse Fonctionnelle',  vente:60,   actuel:null, desc:'',bold:false,sep:false},
  {cat:'Interfaces Mecalux/Sage',vente:60,   actuel:null, desc:'',bold:false,sep:false},
  {cat:'Formation',              vente:50,   actuel:null, desc:'',bold:false,sep:false},
  {cat:'Tests & Dry Run',        vente:60,   actuel:null, desc:'',bold:false,sep:false},
  {cat:'Mise sur Site (2 res, 5j)',vente:80,  actuel:null, desc:'',bold:false,sep:false},
  {cat:'HyperCare à Distance',   vente:40,   actuel:null, desc:'',bold:false,sep:false},
  {cat:'Transporteurs',          vente:100,  actuel:null, desc:'Colissimo/GLS/Schenker…',bold:false,sep:false},
  {cat:'Directives',             vente:40,   actuel:null, desc:'',bold:false,sep:false},
  {cat:'Configuration serveur',  vente:8,    actuel:null, desc:'',bold:false,sep:false},
  {cat:'Enveloppe Customs',      vente:120,  actuel:null, desc:'Dont scan multi N° série',bold:false,sep:false},
];
function heuresVenteTotale(){return heuresData.filter(r=>!r.sep&&r.bold).reduce((s,r)=>s+(r.vente||0),0);}
function heuresActuelTotal(){return heuresData.filter(r=>!r.sep).reduce((s,r)=>s+(r.actuel||0),0);}
function renderHeures(){
  const tbody=document.getElementById('tbody-heures');tbody.innerHTML='';
  heuresData.forEach((row,i)=>{
    if(row.sep){const tr=tbody.insertRow();tr.innerHTML=`<td colspan="5" style="height:7px;background:#f7f9fb;border:none"></td>`;return;}
    const tr=tbody.insertRow();
    const ecart=(row.vente!=null&&row.actuel!=null)?(row.actuel-row.vente):null;
    const ecartColor=ecart==null?'':ecart>0?'#dc2626':ecart<0?'#059669':'var(--text-muted)';
    const ecartHtml=ecart!=null?`<span style="color:${ecartColor};font-weight:500">${ecart>0?'+':''}${ecart}</span>`:'<span style="color:var(--text-muted)">—</span>';
    tr.innerHTML=`
      <td style="font-weight:${row.bold?700:400}">${row.cat}</td>
      <td style="text-align:right"><input class="h-input" type="number" value="${row.vente!=null?row.vente:''}" placeholder="0" min="0" onchange="heuresData[${i}].vente=this.value===''?null:+this.value;renderHeures();renderDashboard()"></td>
      <td style="text-align:right"><input class="h-input" type="number" value="${row.actuel!=null?row.actuel:''}" placeholder="—" min="0" onchange="heuresData[${i}].actuel=this.value===''?null:+this.value;renderHeures();renderDashboard()"></td>
      <td style="text-align:right">${ecartHtml}</td>
      <td style="color:var(--text-muted)">${row.desc||''}</td>`;
  });
  const vente=heuresVenteTotale(),actuel=heuresActuelTotal();
  document.getElementById('kpi-heures').innerHTML=`
    <div class="kpi-card"><div class="kpi-label">Total Vente</div><div class="kpi-value">${vente} h</div><div class="kpi-sub">Budget initial</div></div>
    <div class="kpi-card"><div class="kpi-label">Total Actuel</div><div class="kpi-value">${actuel} h</div><div class="kpi-sub">${vente>0?Math.round(actuel/vente*100):0}% du budget</div><div class="kpi-bar"><div class="kpi-bar-fill" style="width:${vente>0?Math.min(100,actuel/vente*100):0}%;background:${actuel>vente?'#dc2626':'var(--accent)'}"></div></div></div>
    <div class="kpi-card"><div class="kpi-label">Écart</div><div class="kpi-value" style="color:${actuel>vente?'#dc2626':actuel<vente?'#059669':'var(--text)'}">${actuel>vente?'+':''}${actuel-vente} h</div></div>
    <div class="kpi-card"><div class="kpi-label">Jours Restants (vente)</div><div class="kpi-value">${Math.round((vente-actuel)/7)}</div><div class="kpi-sub">Base 7h/jour</div></div>`;
}

// ═══ TÂCHES INTERNES ═══
const ETAT_INT=['FAIT','EN COURS','À FAIRE','EN ATTENTE','ANNULÉ'];
const ETAT_B={'FAIT':'cell-ok','EN COURS':'cell-wip','À FAIRE':'cell-none','EN ATTENTE':'cell-warn','ANNULÉ':'cell-ko'};
const ETAT_D={'FAIT':'#059669','EN COURS':'#2563eb','À FAIRE':'#94a3b8','EN ATTENTE':'#d97706','ANNULÉ':'#dc2626'};
const URG_OPTS=[{label:'— Aucune —',value:0,dot:'#e2e7ed'},{label:'⭐ Faible',value:1,dot:'#94a3b8'},{label:'⭐⭐ Moyenne',value:2,dot:'#f59e0b'},{label:'⭐⭐⭐ Haute',value:3,dot:'#ef4444'}];
let internalTasks=[
  {id:uid(),action:'Plan de tests fonctionnel',etat:'FAIT',temps:4,deadline:'2026-04-27',urg:1,comment:''},
  {id:uid(),action:'Guide utilisateur',etat:'EN COURS',temps:4,deadline:'2026-04-27',urg:2,comment:''},
  {id:uid(),action:'EasyMonitor Checks',etat:'À FAIRE',temps:4,deadline:'2026-06-22',urg:3,comment:''},
  {id:uid(),action:'Project Validator',etat:'À FAIRE',temps:4,deadline:'2026-06-22',urg:3,comment:''},
  {id:uid(),action:'Configuration EasyS',etat:'À FAIRE',temps:8,deadline:'2026-05-29',urg:1,comment:''},
  {id:uid(),action:'Documentation module Delivery SOR (API)',etat:'FAIT',temps:0,deadline:'',urg:1,comment:''},
  {id:uid(),action:'Suite des développements',etat:'EN COURS',temps:56,deadline:'2026-06-08',urg:1,comment:''},
  {id:uid(),action:'Tests dévs + non régression',etat:'FAIT',temps:8,deadline:'',urg:1,comment:''},
  {id:uid(),action:'Module Transporteur (config + tests)',etat:'EN COURS',temps:8,deadline:'2026-05-29',urg:1,comment:''},
  {id:uid(),action:'Dry Run ERP',etat:'EN COURS',temps:2,deadline:'2026-04-27',urg:1,comment:''},
  {id:uid(),action:'Dévs correctifs suite au Dry Run ERP',etat:'EN COURS',temps:0,deadline:'2026-06-08',urg:1,comment:''},
  {id:uid(),action:'Tests par les Key Users',etat:'À FAIRE',temps:0,deadline:'2026-06-08',urg:1,comment:''},
  {id:uid(),action:'Plan de bascule',etat:'À FAIRE',temps:4,deadline:'2026-06-08',urg:2,comment:''},
  {id:uid(),action:'Monter et configurer le WMS de production',etat:'EN COURS',temps:2,deadline:'2026-06-01',urg:2,comment:''},
  {id:uid(),action:'Retravailler chemin de picking (pb Dry Run)',etat:'À FAIRE',temps:2,deadline:'',urg:2,comment:''},
  {id:uid(),action:'Problèmes wifi + config TRF',etat:'À FAIRE',temps:0,deadline:'',urg:1,comment:''},
  {id:uid(),action:'Process de kit à retravailler',etat:'À FAIRE',temps:4,deadline:'',urg:2,comment:''},
  {id:uid(),action:'Process prépa multi-commandes',etat:'À FAIRE',temps:4,deadline:'',urg:2,comment:''},
];
function renderTaches(){
  const tbody=document.getElementById('tbody-taches');tbody.innerHTML='';
  internalTasks.forEach((task,i)=>{
    const tr=tbody.insertRow();tr.dataset.rowId=task.id;
    const urgStr=task.urg?'⭐'.repeat(task.urg):'—';
    tr.innerHTML=`<td>${dh()}</td>
      <td contenteditable="true" style="min-width:190px" onblur="internalTasks.find(t=>t.id==='${task.id}').action=this.textContent.trim()">${task.action}</td>
      <td style="min-width:98px"><span class="${ETAT_B[task.etat]||'cell-none'}" style="cursor:pointer">${task.etat}</span></td>
      <td style="text-align:center"><input type="number" value="${task.temps||0}" min="0" style="width:48px;border:none;background:transparent;font-family:'DM Mono',monospace;font-size:12px;text-align:center" onchange="internalTasks.find(t=>t.id==='${task.id}').temps=+this.value"></td>
      <td><input type="date" value="${task.deadline||''}" style="border:none;background:transparent;font-family:inherit;font-size:11.5px;width:100%" onchange="internalTasks.find(t=>t.id==='${task.id}').deadline=this.value"></td>
      <td style="text-align:center;cursor:pointer"><span>${urgStr}</span></td>
      <td contenteditable="true" style="color:var(--text-muted);min-width:120px" onblur="internalTasks.find(t=>t.id==='${task.id}').comment=this.textContent.trim()">${task.comment}</td>
      <td><button class="btn btn-sm btn-danger" onclick="internalTasks=internalTasks.filter(r=>r.id!=='${task.id}');renderTaches()">✕</button></td>`;
    const etatSp=tr.cells[2].querySelector('span');etatSp.addEventListener('click',e=>{e.stopPropagation();showDropdown(etatSp,ETAT_INT.map(v=>({label:v,value:v,dot:ETAT_D[v]})),val=>{task.etat=val;renderTaches();});});
    tr.cells[5].querySelector('span').addEventListener('click',e=>{e.stopPropagation();showDropdown(tr.cells[5].querySelector('span'),URG_OPTS,val=>{task.urg=val;renderTaches();});});
    makeDraggable(tr,internalTasks,renderTaches);
  });
}
function addInternalTask(){internalTasks.push({id:uid(),action:'Nouvelle tâche',etat:'À FAIRE',temps:0,deadline:'',urg:1,comment:''});renderTaches();}

// ═══ INTERFACES ═══
const ITF_STATES=['NON','EN COURS','OUI','KO'];
const ITF_TYPE_OPTS=['Connecteur SAGE','API REST','Fichier plat','Web Service','Manuel'];
const ITF_D={'OUI':'#059669','NON':'#94a3b8','EN COURS':'#2563eb','KO':'#dc2626'};
const ITF_B={'OUI':'cell-ok','NON':'cell-none','EN COURS':'cell-wip','KO':'cell-ko'};
let interfacesData=['Base Article - ITM','Base fournisseurs - SUP','Préavis de réception - ROR/ASN',
  "Confirmation déchargement - Fichier custom","Clôture commande d'achat - ROF","Clôture commande d'achat - ASO","Clôture commande d'achat - ASK",
  'Confirmation de réception - REF','Commande client - SOR',"Changement d'état - SOC",
  'Clôture commande client - SOF','Changement statut de stock - STC','Variation de stock - STV',
  "Demande état de stock - SCR",'Image de stock - WSC','Transporteur',"Erreur d'intégration - ERR"
].map(name=>({id:uid(),type:'Connecteur SAGE',name,dev:'NON',preprod:'NON',recMecalux:'NON',recClient:'NON',valide:'NON',comment:''}));
function itfBadge(v){return`<span class="${ITF_B[v]||'cell-none'}" style="cursor:pointer">${v}</span>`;}
function renderInterfaces(){
  const tbody=document.getElementById('tbody-interfaces');tbody.innerHTML='';
  interfacesData.forEach(row=>{
    const tr=tbody.insertRow();tr.dataset.rowId=row.id;
    tr.innerHTML=`<td>${dh()}</td>
      <td><select class="tbl-sel" onchange="interfacesData.find(r=>r.id==='${row.id}').type=this.value">${ITF_TYPE_OPTS.map(o=>`<option${o===row.type?' selected':''}>${o}</option>`).join('')}</select></td>
      <td contenteditable="true" style="font-weight:500;min-width:180px" onblur="interfacesData.find(r=>r.id==='${row.id}').name=this.textContent.trim()">${row.name}</td>
      <td>${itfBadge(row.dev)}</td><td>${itfBadge(row.preprod)}</td><td>${itfBadge(row.recMecalux)}</td><td>${itfBadge(row.recClient)}</td><td>${itfBadge(row.valide)}</td>
      <td contenteditable="true" style="color:var(--text-muted);min-width:120px" onblur="interfacesData.find(r=>r.id==='${row.id}').comment=this.textContent.trim()">${row.comment}</td>
      <td><button class="btn btn-sm btn-danger" onclick="interfacesData=interfacesData.filter(r=>r.id!=='${row.id}');renderInterfaces()">✕</button></td>`;
    ['dev','preprod','recMecalux','recClient','valide'].forEach((f,fi)=>{const sp=tr.cells[fi+3].querySelector('span');sp.addEventListener('click',e=>{e.stopPropagation();showDropdown(sp,ITF_STATES.map(v=>({label:v,value:v,dot:ITF_D[v]})),val=>{row[f]=val;sp.className=ITF_B[val]||'cell-none';sp.textContent=val;renderDashboard();});});});
    makeDraggable(tr,interfacesData,renderInterfaces);
  });
}
function addInterface(){interfacesData.push({id:uid(),type:'Connecteur SAGE',name:'Nouvelle interface',dev:'NON',preprod:'NON',recMecalux:'NON',recClient:'NON',valide:'NON',comment:''});renderInterfaces();}

// ═══ FONCTIONNEL ═══
let fonctionnelData=['RECEPTION / RETOUR','RANGEMENT','RÉAPPROVISIONNEMENT','INVENTAIRE','PREPARATION','PICKING','EMBALLAGE','DOCUMENTATION','EXPEDITION + TRANSPORTEUR'].map(name=>({id:uid(),name,dev:'NON',pct:0,testMec:'NON',preprod:'NON',formKU:'NON',testClient:'NON',formUsers:'NON',comment:''}));
function renderFonctionnel(){
  const tbody=document.getElementById('tbody-fonctionnel');tbody.innerHTML='';
  fonctionnelData.forEach(row=>{
    const tr=tbody.insertRow();tr.dataset.rowId=row.id;
    tr.innerHTML=`<td>${dh()}</td>
      <td contenteditable="true" style="font-weight:600;min-width:160px" onblur="fonctionnelData.find(r=>r.id==='${row.id}').name=this.textContent.trim()">${row.name}</td>
      <td>${itfBadge(row.dev)}</td>
      <td style="text-align:center;cursor:pointer"><span>${row.pct}%</span></td>
      <td>${itfBadge(row.testMec)}</td><td>${itfBadge(row.preprod)}</td><td>${itfBadge(row.formKU)}</td><td>${itfBadge(row.testClient)}</td><td>${itfBadge(row.formUsers)}</td>
      <td contenteditable="true" style="color:var(--text-muted);min-width:110px" onblur="fonctionnelData.find(r=>r.id==='${row.id}').comment=this.textContent.trim()">${row.comment}</td>
      <td><button class="btn btn-sm btn-danger" onclick="fonctionnelData=fonctionnelData.filter(r=>r.id!=='${row.id}');renderFonctionnel()">✕</button></td>`;
    ['dev','testMec','preprod','formKU','testClient','formUsers'].forEach((f,fi)=>{const td=tr.cells[[2,4,5,6,7,8][fi]];const sp=td.querySelector('span');sp.addEventListener('click',e=>{e.stopPropagation();showDropdown(sp,ITF_STATES.map(v=>({label:v,value:v,dot:ITF_D[v]})),val=>{row[f]=val;sp.className=ITF_B[val]||'cell-none';sp.textContent=val;});});});
    tr.cells[3].querySelector('span').addEventListener('click',()=>{const v=prompt('% tâches terminées :',row.pct);if(v!==null&&!isNaN(+v)){row.pct=Math.min(100,Math.max(0,+v));renderFonctionnel();}});
    makeDraggable(tr,fonctionnelData,renderFonctionnel);
  });
}
function addFonctionnel(){fonctionnelData.push({id:uid(),name:'Nouveau flux',dev:'NON',pct:0,testMec:'NON',preprod:'NON',formKU:'NON',testClient:'NON',formUsers:'NON',comment:''});renderFonctionnel();}

// ═══ DRY RUN ═══
const DR_STATES=['NON','En cours','OK','KO'];
const DR_D={'OK':'#059669','NON':'#94a3b8','En cours':'#2563eb','KO':'#dc2626'};
const DR_B={'OK':'cell-ok','NON':'cell-none','En cours':'cell-wip','KO':'cell-ko'};
let dryrunData=[
  {id:uid(),name:"Mise à disposition du plan de l'entrepôt",etat:'En cours',comment:''},
  {id:uid(),name:"Création de l'entrepôt dans le WMS",etat:'En cours',comment:''},
  {id:uid(),name:'Validation Wifi',etat:'En cours',comment:''},
  {id:uid(),name:"Étiquetage de l'entrepôt",etat:'KO',comment:''},
  {id:uid(),name:'Plans de tests validés',etat:'NON',comment:''},
  {id:uid(),name:'DRY RUN ERP validé',etat:'NON',comment:''},
  {id:uid(),name:'Imprimantes configurées',etat:'NON',comment:''},
  {id:uid(),name:'TRF configurés',etat:'NON',comment:''},
  {id:uid(),name:'Développements validés',etat:'NON',comment:''},
  {id:uid(),name:'Users formés (par CLIENT)',etat:'NON',comment:''},
  {id:uid(),name:'Inventaire des stocks',etat:'NON',comment:''},
];
function drBadge(v){return`<span class="${DR_B[v]||'cell-none'}" style="cursor:pointer">${v}</span>`;}
function renderDryrun(){
  const tbody=document.getElementById('tbody-dryrun');tbody.innerHTML='';
  dryrunData.forEach(row=>{
    const tr=tbody.insertRow();tr.dataset.rowId=row.id;
    tr.innerHTML=`<td>${dh()}</td>
      <td contenteditable="true" style="font-weight:500" onblur="dryrunData.find(r=>r.id==='${row.id}').name=this.textContent.trim()">${row.name}</td>
      <td style="min-width:98px">${drBadge(row.etat)}</td>
      <td contenteditable="true" style="color:var(--text-muted)" onblur="dryrunData.find(r=>r.id==='${row.id}').comment=this.textContent.trim()">${row.comment}</td>
      <td><button class="btn btn-sm btn-danger" onclick="dryrunData=dryrunData.filter(r=>r.id!=='${row.id}');renderDryrun()">✕</button></td>`;
    const sp=tr.cells[2].querySelector('span');sp.addEventListener('click',e=>{e.stopPropagation();showDropdown(sp,DR_STATES.map(v=>({label:v,value:v,dot:DR_D[v]})),val=>{row.etat=val;sp.className=DR_B[val]||'cell-none';sp.textContent=val;renderDashboard();});});
    makeDraggable(tr,dryrunData,renderDryrun);
  });
}
function addDryrun(){dryrunData.push({id:uid(),name:'Nouveau prérequis',etat:'NON',comment:''});renderDryrun();}

// ═══ INSTALL ═══
const INST_STATES=['Non','En cours','Oui','KO'];
const INST_D={'Oui':'#059669','Non':'#94a3b8','En cours':'#2563eb','KO':'#dc2626'};
const INST_B={'Oui':'cell-ok','Non':'cell-none','En cours':'cell-wip','KO':'cell-ko'};
const INST_QUI=['MECALUX','NIC IMPEX','TOUS','Prestataire externe','—'];
let installData=[
  {id:uid(),action:"Plan de l'entrepôt à jour – autorisations vérifiées",etat:'En cours',qui:'NIC IMPEX',deadline:'',comment:'Mise à jour plan en cours (29/04).'},
  {id:uid(),action:'Entrepôt couvert par le WIFI',etat:'Oui',qui:'',deadline:'',comment:'Audit Wifi fait, 2 antennes encore à tester.'},
  {id:uid(),action:'Serveur installé et WMS accessible sans VPN',etat:'Non',qui:'MECALUX',deadline:'',comment:"SaaS déployé d'ici peu."},
  {id:uid(),action:'TRF disponibles et configurés correctement',etat:'Oui',qui:'NIC IMPEX',deadline:'',comment:''},
  {id:uid(),action:'Racks installés et étiquetés correctement',etat:'En cours',qui:'NIC IMPEX',deadline:'',comment:'Étiquettes test reçues.'},
  {id:uid(),action:'Imprimantes disponibles, alimentées et connectées',etat:'En cours',qui:'NIC IMPEX',deadline:'',comment:"Serveur d'impression sur serveur existant."},
  {id:uid(),action:'Ordinateurs EasyWMS disponibles et connectés',etat:'En cours',qui:'NIC IMPEX',deadline:'',comment:'3 zones emballage : 1 PC + 3 TRF chacune.'},
  {id:uid(),action:'Communications WMS ↔ ERP fonctionnelles',etat:'En cours',qui:'MECALUX',deadline:'',comment:'Dry Run ERP à terminer.'},
  {id:uid(),action:"Process de l'AF en préproduction",etat:'En cours',qui:'MECALUX',deadline:'',comment:'Il manque les transporteurs GLS, BPost, PostNL.'},
  {id:uid(),action:'Process testés et compris par Key Users',etat:'En cours',qui:'TOUS',deadline:'',comment:'Réception, Rangement, Config emplacements OK.'},
  {id:uid(),action:'Plan de tests fonctionnel rédigé et envoyé',etat:'En cours',qui:'MECALUX',deadline:'',comment:'En cours pour préparation commande.'},
  {id:uid(),action:'Plans de tests WMS validés par le client',etat:'Non',qui:'NIC IMPEX',deadline:'',comment:''},
];
function instBadge(v){return`<span class="${INST_B[v]||'cell-none'}" style="cursor:pointer">${v}</span>`;}
function renderInstall(){
  const tbody=document.getElementById('tbody-install');tbody.innerHTML='';
  installData.forEach(row=>{
    const tr=tbody.insertRow();tr.dataset.rowId=row.id;
    tr.innerHTML=`<td>${dh()}</td>
      <td contenteditable="true" style="font-weight:500;min-width:230px" onblur="installData.find(r=>r.id==='${row.id}').action=this.textContent.trim()">${row.action}</td>
      <td style="min-width:88px">${instBadge(row.etat)}</td>
      <td><select class="tbl-sel" onchange="installData.find(r=>r.id==='${row.id}').qui=this.value">${INST_QUI.map(o=>`<option${o===row.qui?' selected':''}>${o}</option>`).join('')}</select></td>
      <td><input type="date" value="${row.deadline||''}" style="border:none;background:transparent;font-family:inherit;font-size:11.5px;width:100%" onchange="installData.find(r=>r.id==='${row.id}').deadline=this.value"></td>
      <td contenteditable="true" style="color:var(--text-muted);min-width:170px" onblur="installData.find(r=>r.id==='${row.id}').comment=this.textContent.trim()">${row.comment}</td>
      <td><button class="btn btn-sm btn-danger" onclick="installData=installData.filter(r=>r.id!=='${row.id}');renderInstall()">✕</button></td>`;
    const sp=tr.cells[2].querySelector('span');sp.addEventListener('click',e=>{e.stopPropagation();showDropdown(sp,INST_STATES.map(v=>({label:v,value:v,dot:INST_D[v]})),val=>{row.etat=val;sp.className=INST_B[val]||'cell-none';sp.textContent=val;renderDashboard();});});
    makeDraggable(tr,installData,renderInstall);
  });
}
function addInstall(){installData.push({id:uid(),action:'Nouveau prérequis',etat:'Non',qui:'MECALUX',deadline:'',comment:''});renderInstall();}
// ═══ FACTURATION ═══
const FACT_STATES=['Payé','En cours','Retard','—'];
const FACT_D={'Payé':'#059669','En cours':'#2563eb','Retard':'#dc2626','—':'#94a3b8'};
const FACT_B={'Payé':'cell-ok','En cours':'cell-wip','Retard':'cell-ko','—':'cell-none'};
let jalonsProjet=[
  {id:uid(),jalon:'OFFRE CONTRAT SIGNÉE',date:'2026-03-15',echeance:'',etat:'Payé',pct:35,montant:20650},
  {id:uid(),jalon:'ANALYSE FONCTIONNELLE LIVRÉE',date:'2026-05-15',echeance:'',etat:'En cours',pct:25,montant:14750},
  {id:uid(),jalon:'LIVRAISON DÉVELOPPEMENTS',date:'',echeance:'',etat:'—',pct:30,montant:17700},
  {id:uid(),jalon:'RÉCEPTION DÉFINITIVE',date:'',echeance:'',etat:'—',pct:10,montant:5900},
];
let jalonsEquip=[
  {id:uid(),jalon:'COMMANDE ÉQUIPEMENT',date:'2026-02-15',echeance:'',etat:'Payé',pct:50,montant:7969},
  {id:uid(),jalon:'LIVRAISON ÉQUIPEMENT',date:'',echeance:'',etat:'—',pct:50,montant:7969},
];
function factBadge(v){return`<span class="${FACT_B[v]||'cell-none'}" style="cursor:pointer">${v}</span>`;}
function renderFactRow(tbody,list,type){
  tbody.innerHTML='';
  list.forEach(row=>{
    const tr=tbody.insertRow();tr.dataset.rowId=row.id;
    tr.innerHTML=`<td>${dh()}</td>
      <td contenteditable="true" style="font-weight:600;min-width:180px" onblur="(${type}==='projet'?jalonsProjet:jalonsEquip).find(r=>r.id==='${row.id}').jalon=this.textContent.trim()">${row.jalon}</td>
      <td><input type="date" value="${row.date||''}" style="border:none;background:transparent;font-family:inherit;font-size:11.5px" onchange="(${type}==='projet'?jalonsProjet:jalonsEquip).find(r=>r.id==='${row.id}').date=this.value"></td>
      <td><input type="date" value="${row.echeance||''}" style="border:none;background:transparent;font-family:inherit;font-size:11.5px" onchange="(${type}==='projet'?jalonsProjet:jalonsEquip).find(r=>r.id==='${row.id}').echeance=this.value"></td>
      <td style="min-width:78px">${factBadge(row.etat)}</td>
      <td><input type="number" value="${row.pct}" min="0" max="100" style="width:40px;border:none;background:transparent;font-size:12px;text-align:right" onchange="(${type}==='projet'?jalonsProjet:jalonsEquip).find(r=>r.id==='${row.id}').pct=+this.value;renderFacturation()">%</td>
      <td><input type="number" value="${row.montant}" min="0" style="width:88px;border:none;background:transparent;font-family:'DM Mono',monospace;font-size:12px;font-weight:600;text-align:right" onchange="(${type}==='projet'?jalonsProjet:jalonsEquip).find(r=>r.id==='${row.id}').montant=+this.value;renderFacturation()"> €</td>
      <td><button class="btn btn-sm btn-danger" onclick="del_fact_${type}('${row.id}')">✕</button></td>`;
    const sp=tr.cells[4].querySelector('span');sp.addEventListener('click',e=>{e.stopPropagation();showDropdown(sp,FACT_STATES.map(v=>({label:v,value:v,dot:FACT_D[v]})),val=>{row.etat=val;sp.className=FACT_B[val]||'cell-none';sp.textContent=val;renderFacturation();renderDashboard();});});
    makeDraggable(tr,list,renderFacturation);
  });
}
function del_fact_projet(id){jalonsProjet=jalonsProjet.filter(r=>r.id!==id);renderFacturation();}
function del_fact_equip(id){jalonsEquip=jalonsEquip.filter(r=>r.id!==id);renderFacturation();}
function addJalon(type){const list=type==='projet'?jalonsProjet:jalonsEquip;list.push({id:uid(),jalon:'Nouveau jalon',date:'',echeance:'',etat:'—',pct:0,montant:0});renderFacturation();}
function renderFacturation(){
  renderFactRow(document.getElementById('tbody-jalons-projet'),jalonsProjet,'projet');
  renderFactRow(document.getElementById('tbody-jalons-equip'),jalonsEquip,'equip');
  const tP=jalonsProjet.reduce((s,r)=>s+r.montant,0),tE=jalonsEquip.reduce((s,r)=>s+r.montant,0),total=tP+tE;
  const paye=[...jalonsProjet,...jalonsEquip].filter(r=>r.etat==='Payé').reduce((s,r)=>s+r.montant,0);
  const reste=total-paye;
  const sp=v=>total>0?Math.round(v/total*100):0;
  document.getElementById('kpi-fact').innerHTML=`
    <div class="kpi-card"><div class="kpi-label">Total Projet</div><div class="kpi-value">${tP.toLocaleString('fr-FR')} €</div></div>
    <div class="kpi-card"><div class="kpi-label">Total Équipement</div><div class="kpi-value">${tE.toLocaleString('fr-FR')} €</div></div>
    <div class="kpi-card"><div class="kpi-label">Total Contrat</div><div class="kpi-value">${total.toLocaleString('fr-FR')} €</div></div>
    <div class="kpi-card"><div class="kpi-label">Encaissé</div><div class="kpi-value" style="color:#059669">${paye.toLocaleString('fr-FR')} €</div><div class="kpi-sub">${sp(paye)}%</div><div class="kpi-bar"><div class="kpi-bar-fill" style="width:${sp(paye)}%;background:#059669"></div></div></div>
    <div class="kpi-card"><div class="kpi-label">Reste à facturer</div><div class="kpi-value" style="color:#dc2626">${reste.toLocaleString('fr-FR')} €</div><div class="kpi-sub">${sp(reste)}%</div></div>`;
}

// ═══════════════════════════════════════════════════════
// DASHBOARD CHARTS
// ═══════════════════════════════════════════════════════
const charts={};
function destroyChart(id){if(charts[id]){charts[id].destroy();delete charts[id];}}

function renderDashboard(){
  // ── KPIs ──
  const totalTasks=tasks.length;
  const doneTasks=tasks.filter(t=>t.status==='Terminé').length;
  const inProgressTasks=tasks.filter(t=>t.status==='En cours').length;
  const lateTasks=tasks.filter(t=>t.status==='En retard').length;
  const totalJalons=[...jalonsProjet,...jalonsEquip];
  const totalMontant=totalJalons.reduce((s,r)=>s+r.montant,0);
  const payeMontant=totalJalons.filter(r=>r.etat==='Payé').reduce((s,r)=>s+r.montant,0);
  const vente=heuresVenteTotale(),actuel=heuresActuelTotal();
  document.getElementById('dash-kpi').innerHTML=`
    <div class="kpi-card"><div class="kpi-label">Tâches Totales</div><div class="kpi-value">${totalTasks}</div><div class="kpi-sub">${doneTasks} terminées · ${inProgressTasks} en cours</div></div>
    <div class="kpi-card"><div class="kpi-label">Tâches en Retard</div><div class="kpi-value" style="color:${lateTasks?'#dc2626':'#059669'}">${lateTasks}</div><div class="kpi-sub">${lateTasks?'⚠ Attention requise':'✓ Tout est à jour'}</div></div>
    <div class="kpi-card"><div class="kpi-label">Avancement Global</div><div class="kpi-value">${totalTasks>0?Math.round(tasks.reduce((s,t)=>s+(t.progress||0),0)/totalTasks):0}%</div><div class="kpi-bar"><div class="kpi-bar-fill" style="width:${totalTasks>0?Math.round(tasks.reduce((s,t)=>s+(t.progress||0),0)/totalTasks):0}%"></div></div></div>
    <div class="kpi-card"><div class="kpi-label">Facturation</div><div class="kpi-value" style="color:#059669">${payeMontant.toLocaleString('fr-FR')} €</div><div class="kpi-sub">/ ${totalMontant.toLocaleString('fr-FR')} € total</div></div>
    <div class="kpi-card"><div class="kpi-label">Heures Actuel / Vente</div><div class="kpi-value">${actuel} / ${vente} h</div><div class="kpi-bar"><div class="kpi-bar-fill" style="width:${vente>0?Math.min(100,actuel/vente*100):0}%;background:${actuel>vente?'#dc2626':'var(--accent)'}"></div></div></div>
    <div class="kpi-card"><div class="kpi-label">Phases</div><div class="kpi-value">${phases.length}</div><div class="kpi-sub">${tasks.length} tâches réparties</div></div>`;

  // ── CHART: Avancement par phase ──
  destroyChart('phases');
  const phaseLabels=phases.map(p=>p.name.length>20?p.name.slice(0,20)+'…':p.name);
  const phaseData=phases.map(ph=>{const pt=tasks.filter(t=>t.phaseId===ph.id);return pt.length?Math.round(pt.reduce((s,t)=>s+(t.progress||0),0)/pt.length):0;});
  const phaseColors=phases.map(p=>p.color);
  charts['phases']=new Chart(document.getElementById('ch-phases'),{type:'bar',data:{labels:phaseLabels,datasets:[{label:'Avancement %',data:phaseData,backgroundColor:phaseColors.map(c=>c+'cc'),borderColor:phaseColors,borderWidth:2,borderRadius:5}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{max:100,ticks:{callback:v=>v+'%'},grid:{color:'#f0f2f5'}},y:{grid:{display:false}}}}});

  // ── CHART: Répartition statuts ──
  destroyChart('statuts');
  const statusCounts={};
  tasks.forEach(t=>{const s=t.status||'Non défini';statusCounts[s]=(statusCounts[s]||0)+1;});
  const statusColors={'Terminé':'#059669','En cours':'#2563eb','Non commencé':'#94a3b8','En attente':'#d97706','En retard':'#dc2626','Vérification requise':'#7c3aed','Mise à jour requise':'#0891b2','Non défini':'#e2e7ed'};
  charts['statuts']=new Chart(document.getElementById('ch-statuts'),{type:'doughnut',data:{labels:Object.keys(statusCounts),datasets:[{data:Object.values(statusCounts),backgroundColor:Object.keys(statusCounts).map(s=>statusColors[s]||'#e2e7ed'),borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{font:{size:11},boxWidth:12}}}}});

  // ── CHART: Heures vente vs actuel ──
  destroyChart('heures');
  const hRows=heuresData.filter(r=>!r.sep&&!r.bold&&r.vente);
  const hLabels=hRows.map(r=>r.cat.length>14?r.cat.slice(0,14)+'…':r.cat);
  const hVente=hRows.map(r=>r.vente||0),hActuel=hRows.map(r=>r.actuel||0);
  charts['heures']=new Chart(document.getElementById('ch-heures'),{type:'bar',data:{labels:hLabels,datasets:[{label:'Vente',data:hVente,backgroundColor:'#bfdbfe',borderColor:'#2563eb',borderWidth:1,borderRadius:3},{label:'Actuel',data:hActuel,backgroundColor:'#fca5a5',borderColor:'#dc2626',borderWidth:1,borderRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{font:{size:11},boxWidth:12}}},scales:{x:{ticks:{font:{size:10}},grid:{display:false}},y:{grid:{color:'#f0f2f5'}}}}});

  // ── CHART: Facturation ──
  destroyChart('fact');
  const fLabels=[...jalonsProjet,...jalonsEquip].map(j=>j.jalon.length>18?j.jalon.slice(0,18)+'…':j.jalon);
  const fMontants=[...jalonsProjet,...jalonsEquip].map(j=>j.montant);
  const fColors=[...jalonsProjet,...jalonsEquip].map(j=>j.etat==='Payé'?'#86efac':j.etat==='En cours'?'#93c5fd':j.etat==='Retard'?'#fca5a5':'#e2e7ed');
  charts['fact']=new Chart(document.getElementById('ch-fact'),{type:'bar',data:{labels:fLabels,datasets:[{label:'Montant (€)',data:fMontants,backgroundColor:fColors,borderColor:fColors.map(c=>c.replace(/..$/,'ff')),borderWidth:1,borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{font:{size:10}},grid:{display:false}},y:{ticks:{callback:v=>v.toLocaleString('fr-FR')+' €'},grid:{color:'#f0f2f5'}}}}});

  // ── CHART: Interfaces ──
  destroyChart('itf');
  const itfCounts=ITF_STATES.reduce((o,s)=>{o[s]=(interfacesData.filter(r=>r.valide===s).length);return o;},{});
  charts['itf']=new Chart(document.getElementById('ch-itf'),{type:'doughnut',data:{labels:['Validé (OUI)','En cours','Non validé (NON)','KO'],datasets:[{data:[itfCounts.OUI||0,itfCounts['EN COURS']||0,itfCounts.NON||0,itfCounts.KO||0],backgroundColor:['#86efac','#93c5fd','#e2e7ed','#fca5a5'],borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:10}}}}});

  // ── CHART: Prérequis Install ──
  destroyChart('install');
  const instC={'Oui':installData.filter(r=>r.etat==='Oui').length,'En cours':installData.filter(r=>r.etat==='En cours').length,'Non':installData.filter(r=>r.etat==='Non').length,'KO':installData.filter(r=>r.etat==='KO').length};
  charts['install']=new Chart(document.getElementById('ch-install'),{type:'doughnut',data:{labels:['Oui','En cours','Non','KO'],datasets:[{data:[instC.Oui,instC['En cours'],instC.Non,instC.KO],backgroundColor:['#86efac','#93c5fd','#e2e7ed','#fca5a5'],borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:10}}}}});

  // ── CHART: Prérequis Dry Run ──
  destroyChart('dryrun');
  const drC={'OK':dryrunData.filter(r=>r.etat==='OK').length,'En cours':dryrunData.filter(r=>r.etat==='En cours').length,'NON':dryrunData.filter(r=>r.etat==='NON').length,'KO':dryrunData.filter(r=>r.etat==='KO').length};
  charts['dryrun']=new Chart(document.getElementById('ch-dryrun'),{type:'doughnut',data:{labels:['OK','En cours','NON','KO'],datasets:[{data:[drC.OK,drC['En cours'],drC.NON,drC.KO],backgroundColor:['#86efac','#93c5fd','#e2e7ed','#fca5a5'],borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:10}}}}});
}

// ═══ INIT ═══
renderGantt();
renderHeures();
renderTaches();
renderInterfaces();
renderFonctionnel();
renderDryrun();
renderInstall();
renderFacturation();
renderDashboard();
setTimeout(()=>{
  document.getElementById('page-dashboard').classList.remove('active');
  document.querySelector('.nav-tab[data-page="page-dashboard"]').classList.remove('active');
  document.getElementById('page-planning').classList.add('active');
  document.querySelector('.nav-tab[data-page="page-planning"]').classList.add('active');
  setTimeout(scrollToToday,80);
},50);
