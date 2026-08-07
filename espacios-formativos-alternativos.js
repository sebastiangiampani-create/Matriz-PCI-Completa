(()=>{
  'use strict';
  const frame=()=>document.getElementById('pci');
  let installed=false;

  function isAlternative(group){
    return !!group&&(group.alternative===true||group.kind==='espacio_formativo_alternativo'||group.type==='Espacio Formativo Alternativo'||group.elective===true);
  }

  function ensureAlternativeGroupShape(group){
    if(!group)return;
    group.alternative=true;
    group.custom=true;
    group.elect