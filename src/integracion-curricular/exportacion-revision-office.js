/**
 * Exportaciones offline desde una copia de revisión: XLSX y DOCX Office OpenXML
 * reales, sin bibliotecas externas, red ni escrituras escolares.
 * Cada documento indica que no sustituye el respaldo JSON bruto del servidor.
 */
const encoder = new TextEncoder();
const xml = value => String(value ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&apos;'}[c]))
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const stringify = value => value == null ? '' :
  typeof value === 'string' ? value : JSON.stringify(value);
const safeSpreadsheet = value => {
  // No se ejecutan fórmulas suministradas por la escuela.
  const valueText=stringify(value);
  return /^[=+\-@\t\r]/.test(valueText) ? "'" + valueText : valueText;
};
const info = review => {
  if (!review || !review.source?.areas || !review.orientation)
    throw new Error('Primero prepará una copia para revisión.');
  return review;
};

function flatData(review) {
  const source=info(review).source;
  const overview=[
    ['Campo','Dato'],
    ['Documento','Revisión previa a la importación'],
    ['Escuela',source.schoolName || 'Sin nombre'],
    ['Orientación',review.orientation],
    ['Estado',review.approved?'OK de revisión registrado en la sesión':'Pendiente de revisión'],
    ['Origen','Matriz disponible en esta sesión (puede estar normalizada)'],
    ['Seguridad','No sustituye al respaldo íntegro de la base escolar'],
    ['Áreas',review.summary.areaCount],
    ['Agrupamientos',review.summary.groupCount],
    ['Contenidos distintos',review.summary.contentCount],
    ['Planes',review.summary.plans],
    ['Planes desarrollados',review.summary.plansWithData],
    ['Secuencias con etapas',review.summary.sequences]
  ];
  const groups=[['Área','ID del agrupamiento','Nombre','Formato','Año','C inicio','C fin','Objetivo','Síntesis','Contexto','Eje de práctica','Contenidos (IDs)','Campos completos (JSON)']];
  const contents=[['Área','Agrupamiento','Año','Cuatrimestre','ID de contenido','Nombre del contenido']];
  const plans=[['Área','Agrupamiento','ID de agrupamiento','Año','Plan','Nombre del plan','Objetivos','Síntesis','IDs de contenidos','Campos completos (JSON)']];
  const stages=[['Área','Agrupamiento','Plan','Etapa','Descripción','Duración','Recursos','Actividades','Evidencias','Etapa completa (JSON)']];
  const extras=[['Ruta del dato','Valor completo (JSON)']];
  const catalog=Array.isArray(review.catalog)?new Map(review.catalog.filter(x=>x&&x.id!=null).map(x=>[String(x.id), String(x.content||x.contenido||x.text||x.name||x.titulo||'')])):new Map();
  for(const [area,entry] of Object.entries(source.areas||{})) {
    const all=Array.isArray(entry?.groups)?entry.groups:[];
    for(const [index,group] of all.entries()) {
      const id=stringify(group?.id);const name=stringify(group?.name);
      const level=group?.level??(Number(group?.startTerm)>0?Math.ceil(Number(group.startTerm)/2):'');
      const list=Array.isArray(group?.items)?group.items:[];
      groups.push([area,id,name,group?.kind||group?.formatType||'',level,group?.startTerm??'',group?.endTerm??'',
        group?.objective||'',group?.synopsis||'',group?.context||'',group?.practiceAxis||'',list.join(' · '),JSON.stringify(group)]);
      for(const item of list)contents.push([area,name,level,group?.startTerm??'',item,catalog.get(String(item))||'']);
      for(const [i,plan] of (Array.isArray(group?.plansBimestrales)?group.plansBimestrales:[]).entries()) {
        const planName=plan?.name||'Plan '+(i+1);
        plans.push([area,name,id,level,plan?.number??i+1,planName,plan?.objectives||'',plan?.synopsis||'',
          stringify(plan?.contentIds||[]),JSON.stringify(plan)]);
        for(const [key,value] of Object.entries(plan?.stages||{})) {
          stages.push([area,name,planName,key,value?.description??'',value?.duration??'',stringify(value?.resources??''),
            stringify(value?.activities??''),stringify(value?.evidence??value?.evidences??''),JSON.stringify(value)]);
        }
      }
    }
  }
  // Todos los nodos raíz y campos no contemplados en las hojas pedagógicas
  // siguen accesibles por ruta; el JSON ofrece restauración sin pérdidas.
  function dive(value,path) {
    if(value && typeof value==='object'){
      const keys=Object.keys(value);
      if(!keys.length){extras.push([path,JSON.stringify(value)]);return;}
      for(const key of keys)dive(value[key],path+'/'+key.replace(/~/g,'~0').replace(/\//g,'~1'));
    }else extras.push([path,JSON.stringify(value)]);
  }
  dive(source,'');
  const warnings=[['Área','Tipo','Detalle'],...review.warnings.map(w=>[w.area,w.type,w.message])];
  return [
    {name:'Resumen',rows:overview,widths:[29,85]},
    {name:'Agrupamientos',rows:groups,widths:[24,23,27,16,8,10,10,55,55,50,45,48,90]},
    {name:'Contenidos',rows:contents,widths:[24,27,8,12,40,65]},
    {name:'Planes',rows:plans,widths:[25,27,26,10,9,26,55,55,65,90]},
    {name:'Secuencias',rows:stages,widths:[24,26,26,20,85,16,55,55,55,90]},
    {name:'Observaciones',rows:warnings,widths:[26,24,100]},
    {name:'Datos completos',rows:extras,widths:[70,115]}
  ];
}
const crcTable = Uint32Array.from({length:256},(_,i)=>{
  let x=i;for(let n=0;n<8;n++)x=(x&1)?(0xEDB88320^(x>>>1)):(x>>>1);return x>>>0;
});
function crc32(data){let n=0xFFFFFFFF;for(const byte of data)n=crcTable[(n^byte)&255]^(n>>>8);return (n^0xFFFFFFFF)>>>0;}
function zip(files){
  const local=[],central=[];let offset=0;const year=46; // 2026-1980 (solo metadata ZIP)
  const u16=(view,pos,val)=>view.setUint16(pos,val,true),u32=(view,pos,val)=>view.setUint32(pos,val>>>0,true);
  for(const [name,text] of files){
    const path=encoder.encode(name),data=text instanceof Uint8Array?text:encoder.encode(text),crc=crc32(data);
    const header=new Uint8Array(30+path.length),l=new DataView(header.buffer);
    u32(l,0,0x04034b50);u16(l,4,20);u16(l,6,0x0800);u16(l,8,0);u16(l,10,0);
    u16(l,12,year<<9|1<<5|1);u32(l,14,crc);u32(l,18,data.length);u32(l,22,data.length);u16(l,26,path.length);
    header.set(path,30);local.push(header,data);
    const c=new Uint8Array(46+path.length),v=new DataView(c.buffer);
    u32(v,0,0x02014b50);u16(v,4,20);u16(v,6,20);u16(v,8,0x0800);u16(v,10,0);
    u16(v,12,0);u16(v,14,year<<9|1<<5|1);u32(v,16,crc);u32(v,20,data.length);u32(v,24,data.length);
    u16(v,28,path.length);u32(v,42,offset);c.set(path,46);central.push(c);
    offset+=header.length+data.length;
  }
  const centralSize=central.reduce((n,a)=>n+a.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);
  u32(v,0,0x06054b50);u16(v,8,files.length);u16(v,10,files.length);u32(v,12,centralSize);u32(v,16,offset);
  return new Blob([...local,...central,end],{type:'application/zip'});
}
function excelColumn(i){let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;}
function excelCell(value,col,row,head=false) {
  if(typeof value==='number'&&Number.isFinite(value))
    return '<c r="'+excelColumn(col)+row+'" s="'+(head?1:2)+'" t="n"><v>'+value+'</v></c>';
  const str=safeSpreadsheet(value).slice(0,32767);
  return '<c r="'+excelColumn(col)+row+'" s="'+(head?1:0)+'" t="inlineStr"><is><t xml:space="preserve">'+xml(str)+'</t></is></c>';
}
function xlsxXml(sheets) {
  const workbook='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+
    sheets.map((s,i)=>'<sheet name="'+xml(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>';
  const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((s,i)=>
    '<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+
    '<Relationship Id="rId'+(sheets.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  const styles='<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
    '<fonts count="2"><font><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Aptos"/></font></fonts>'+
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF12395C"/><bgColor indexed="64"/></patternFill></fill></fills>'+
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'+
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
    '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="center" wrapText="1"/></xf>'+
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0"><alignment vertical="center" wrapText="1"/></xf>'+
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="center"/></xf></cellXfs></styleSheet>';
  const types='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
    '<Default Extension="xml" ContentType="application/xml"/>'+
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
    sheets.map((s,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>';
  const root='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  const files=[['[Content_Types].xml',types],['_rels/.rels',root],['xl/workbook.xml',workbook],['xl/_rels/workbook.xml.rels',rels],['xl/styles.xml',styles]];
  for(const [i,sheet] of sheets.entries()){
    const rows=sheet.rows.map((values,index)=>'<row r="'+(index+1)+'"'+(index===0?' ht="29" customHeight="1"':'')+'>'+
      values.map((v,col)=>excelCell(v,col,index+1,index===0)).join('')+'</row>').join('');
    const widths='<cols>'+sheet.widths.map((value,col)=>'<col min="'+(col+1)+'" max="'+(col+1)+'" width="'+value+'" customWidth="1"/>').join('')+'</cols>';
    files.push(['xl/worksheets/sheet'+(i+1)+'.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'+widths+
      '<sheetData>'+rows+'</sheetData><autoFilter ref="A1:'+excelColumn(sheet.rows[0].length-1)+sheet.rows.length+'"/></worksheet>']);
  }
  return files;
}
export async function exportReviewXlsx(review) {
  return new Blob([await zip(xlsxXml(flatData(review))).arrayBuffer()],{
    type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}
function paragraph(value,kind='normal') {
  const style=kind==='title'?'<w:pPr><w:pStyle w:val="Title"/></w:pPr>':
    kind==='heading'?'<w:pPr><w:pStyle w:val="Heading2"/></w:pPr>':'';
  const str=String(value??'');
  return '<w:p>'+style+'<w:r><w:t xml:space="preserve">'+xml(str)+'</w:t></w:r></w:p>';
}
export async function exportReviewDocx(review) {
  info(review);const p=[];
  p.push(paragraph('Matriz PCI · Informe previo a la importación','title'));
  p.push(paragraph('Escuela: '+(review.source.schoolName||'Sin nombre')));
  p.push(paragraph('Orientación: '+review.orientation));
  p.push(paragraph('IMPORTANTE: informe de lectura generado desde la Matriz de esta sesión. NO reemplaza el respaldo original de la base. No se aplican cambios.'));
  p.push(paragraph('Inventario general','heading'));
  for(const [k,v] of Object.entries(review.summary))if(k!=='areas')p.push(paragraph(k+': '+stringify(v)));
  p.push(paragraph('Observaciones para revisar','heading'));
  for(const w of review.warnings)p.push(paragraph(w.area+' · '+w.type+': '+w.message));
  if(!review.warnings.length)p.push(paragraph('No se detectaron observaciones preliminares.'));
  for(const [area,entry] of Object.entries(review.source.areas||{})){
    p.push(paragraph(area,'heading'));
    for(const group of (Array.isArray(entry?.groups)?entry.groups:[])){
      p.push(paragraph((group.name||'Agrupamiento')+' · '+(group.id||'sin ID')));
      for(const field of ['kind','level','startTerm','endTerm','objective','synopsis','context','practiceAxis','items']){
        if(group[field]!==undefined)p.push(paragraph(field+': '+stringify(group[field])));
      }
      for(const [i,plan] of (Array.isArray(group.plansBimestrales)?group.plansBimestrales:[]).entries()){
        p.push(paragraph('Plan '+(plan?.number??i+1)+' · '+(plan?.name||''),'heading'));
        for(const [field,value] of Object.entries(plan||{})){
          if(field==='stages')continue;
          p.push(paragraph(field+': '+stringify(value)));
        }
        for(const [stage,value] of Object.entries(plan?.stages||{})){
          p.push(paragraph('Etapa: '+stage));
          for(const [field,detail] of Object.entries(value||{}))p.push(paragraph('   '+field+': '+stringify(detail)));
        }
      }
    }
  }
  p.push(paragraph('Anexo de integridad: todos los campos originales de la copia','heading'));
  // El anexo deja ver todos los datos no listados, incluso metadatos o futuras
  // propiedades; el archivo JSON descargable es el respaldo lógico legible.
  const sourceText=JSON.stringify(review.source,null,2);
  for(let i=0;i<sourceText.length;i+=1300)p.push(paragraph(sourceText.slice(i,i+1300)));
  const body=p.join('');
  const document='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+
    body+'<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1200" w:right="1150" w:bottom="1200" w:left="1150"/></w:sectPr></w:body></w:document>';
  const styles='<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'+
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="21"/></w:rPr></w:style>'+
    '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:color w:val="12395C"/><w:sz w:val="34"/></w:rPr></w:style>'+
    '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:rPr><w:b/><w:color w:val="12395C"/><w:sz w:val="26"/></w:rPr></w:style></w:styles>';
  const types='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'+
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>';
  const root='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const rels='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  const files=[['[Content_Types].xml',types],['_rels/.rels',root],['word/document.xml',document],
    ['word/_rels/document.xml.rels',rels],['word/styles.xml',styles]];
  return new Blob([await zip(files).arrayBuffer()],{
    type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
}
