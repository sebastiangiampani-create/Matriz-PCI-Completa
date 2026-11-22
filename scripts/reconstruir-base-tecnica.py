#!/usr/bin/env python3
"""
Reconstrucción de la base curricular técnica desde las columnas del PDF OFICIAL.

No usa el texto de páginas mezclado (texto_pagina); lee las coordenadas x/y
y la tipografía de los 26 PDF oficiales. Distingue indicadores de logro a la
izquierda de contenidos a la derecha. Conserva la fuente y el año explícito,
deduplica contenidos y NO rellena vacíos inventando ejes, cursos o textos.

Salida determinista: data/tecnica/base-curricular/<especialidad>.json
Al crear el banco NO se modifica ningún PCI, usuario ni base Supabase.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import re
import time
import unicodedata
import urllib.request
from pathlib import Path
from dataclasses import dataclass
from collections import Counter, defaultdict

import fitz

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"data"/"tecnica"/"priorizados"
OUT_DEFAULT=ROOT/"data"/"tecnica"/"base-curricular"
CACHE=ROOT/"test-artifacts"/"tecnica"/"pdf-cache"
SCHEMA="pci-tecnica-base-contenidos/3"
YEAR_WORDS={"primer":1,"primero":1,"segundo":2,"tercer":3,"tercero":3,
            "cuarto":4,"quinto":5,"sexto":6}
YEAR_RX=re.compile(r"\b(primer|primero|segundo|tercer|tercero|cuarto|quinto|sexto)\s+a[nñ]o\b",re.I)
NOISE_RX=re.compile(r"^(?:contenidos(?: priorizados)?|conocimientos|indicadores de logro(?: de los aprendizajes)?|índice|volver a vista anterior|especialidad .*)$",re.I)
HEAD_RX=re.compile(r"^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 /(),.'ºª+\-–]+$")
SENTENCES=re.compile(r"(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ0-9])")

def squish(v):
    return re.sub(r"\s+"," ",str(v or "")).strip()

def canon(v):
    x=unicodedata.normalize("NFD",squish(v))
    x="".join(ch for ch in x if unicodedata.category(ch)!="Mn").lower()
    return re.sub(r"\s+"," ",re.sub(r"[^a-z0-9]+"," ",x)).strip()

def stable(*parts, prefix="tec-doc"):
    content="|".join(canon(x) for x in parts).encode("utf8")
    return prefix+":"+hashlib.sha256(content).hexdigest()[:24]

def get_documents():
    docs=[]
    for p in sorted(SOURCE.glob("*.json")):
        if p.stem=="tecnologia_representacion":continue
        item=json.loads(p.read_text(encoding="utf8"))
        if item.get("schema")!="pci-tecnica-priorizados/2":continue
        docs.append(item)
    if len(docs)!=26:raise RuntimeError(f"Se esperaban 26 PDF, se detectaron {len(docs)}")
    return docs

def load_pdf(meta):
    url=str(meta["fuente_url"])
    if not re.fullmatch(r"https://static\.buenosaires\.gob\.ar/sites/default/files/2026-10/[\w.%\-]+\.pdf",url):
        raise ValueError("Fuente oficial no autorizada: "+url)
    CACHE.mkdir(parents=True,exist_ok=True)
    target=CACHE/(meta["especialidad_id"]+".pdf")
    if target.exists():
        data=target.read_bytes()
    else:
        last=None
        for retry in range(3):
            try:
                req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (consulta contenidos curriculares)"})
                with urllib.request.urlopen(req,timeout=60) as response:
                    if response.status!=200 or not response.headers.get("content-type","").startswith("application/pdf"):
                        raise ValueError("La URL no entregó un PDF oficial.")
                    data=response.read()
                break
            except Exception as e:
                last=e
                if retry<2:time.sleep(2*(retry+1))
        else:raise RuntimeError(f"No se pudo consultar {url}: {last}")
        if not data.startswith(b"%PDF"):raise ValueError("Respuesta no es PDF: "+url)
        target.write_bytes(data)
    digest=hashlib.sha256(data).hexdigest()
    if meta.get("sha256_pdf") and digest.lower()!=str(meta["sha256_pdf"]).lower():
        raise RuntimeError("La fuente cambió su SHA256: "+meta["especialidad_id"])
    return fitz.open(stream=data,filetype="pdf")

def lines_on(page):
    out=[]
    for block in page.get_text("dict")["blocks"]:
        if block.get("type")!=0:continue
        for l in block.get("lines",[]):
            spans=l.get("spans") or []
            if not spans:continue
            t=squish("".join(s.get("text","") for s in spans))
            if not t:continue
            f=spans[0].get("font","")
            first=squish(spans[0].get("text",""))
            split_topic=(len(spans)>1 and 260<float(l["bbox"][0])<744 and
              ("Bold" in f or bool(spans[0].get("flags",0)&16)) and
              8<=len(first)<=63 and len(first.split())>=2 and not first.endswith(".") and ":" not in first and
              all("Bold" not in z.get("font","") for z in spans[1:]) and
              len(squish("".join(z.get("text","") for z in spans[1:])))>8)
            if split_topic:
                out.append({"x":float(spans[0]["bbox"][0]),"y":float(l["bbox"][1]),
                    "text":first,"bold":True,"size":float(spans[0].get("size",0)),"font":f})
                out.append({"x":float(spans[1]["bbox"][0]),"y":float(l["bbox"][1]),
                    "text":squish("".join(z.get("text","") for z in spans[1:])),
                    "bold":False,"size":float(spans[1].get("size",0)),"font":spans[1].get("font","")})
            else:
                out.append({"x":float(l["bbox"][0]),"y":float(l["bbox"][1]),
                            "text":t,"bold":"Bold" in f or bool(spans[0].get("flags",0)&16),
                            "size":float(spans[0].get("size",0)),"font":f})
    out.sort(key=lambda v:(round(v["y"],1),v["x"]))
    return out

def headings_on(lines,sections,page_index):
    by_name=defaultdict(list)
    for section in sections:by_name[canon(section["asignatura"])].append(section)
    heads=[]
    for line in lines:
        if not(43<line["x"]<290 and 60<line["y"]<500):continue
        if line["size"]<11 or not line["bold"]:continue
        if not HEAD_RX.fullmatch(line["text"]):continue
        candidates=by_name.get(canon(line["text"]),[])
        if not candidates:continue
        ranked=sorted(candidates,key=lambda s:(
            0 if any(int(p["pagina_pdf"])==page_index+1 for p in s["paginas"]) else 1,
            abs(int(s["pagina_inicio"])-page_index-1),s["id"]))
        heads.append((line["y"],ranked[0]))
    return sorted(heads,key=lambda x:x[0])

def year_of(meta,section,page_index,lines,low,high,last_year):
    explicit=[]
    for line in lines:
        if not(low<=line["y"]<high and line["x"]<320):continue
        if len(line["text"])>115:continue
        m=YEAR_RX.search(line["text"])
        if m and (line["text"].lower().startswith(m[1].lower()) or line["text"].lower().startswith("año ")):
            explicit.append((line["y"],YEAR_WORDS[m[1].lower()]))
    if explicit:return explicit[-1][1],"titulo_explicito"
    own=next((p for p in section["paginas"] if int(p["pagina_pdf"])==page_index+1),None)
    meta_year=own.get("anio_contextual_inferido") if own else None
    years=section.get("anios_detectados") or []
    if last_year and (not years or last_year in years):return last_year,"continuidad_documental"
    if len(years)==1 and years[0] in range(1,7):return years[0],"seccion_unica"
    if isinstance(meta_year,int) and 1<=meta_year<=6:return meta_year,"metadato_pdf"
    if canon(section["asignatura"]) in ("musica","diseno","teatro") and section["campo_estimado"]=="formacion_general":
        return 1,"regla_arte_primer_anio"
    return None,"sin_anio"

def is_section_topic(item):
    t=item["text"]
    # Solo rótulos breves en negrita, no una oración de contenidos en negrita.
    return (item["bold"] and len(t)<=70 and len(t.split())<=9 and
            not ":" in t and t.count(".")<=1 and
            not re.search(r"(?:es|son|permite|que|mediante|para)\b",t,re.I) and
            (not t.endswith(".") or len(t)<=56))

def split_atomic(text):
    # Se preservan todas las palabras; el corte está en una oración completa,
    # no en espacios arbitrarios ni en límites de página.
    substitutions={}
    for i,m in enumerate(re.finditer(r"\b(?:N[ºo°]\.|Dec\.|Ley Nac\.|Dr\.|Dra\.|Prof\.|Art\.)",text,re.I)):
        marker=f"ZXZTOKEN{i}X"
        substitutions[marker]=m[0]
        text=text.replace(m[0],marker,1)
    parts=[squish(x) for x in SENTENCES.split(text) if squish(x)]
    output=[]
    for part in parts:
        for key,val in substitutions.items():part=part.replace(key,val)
        if len(part)<11 and output:
            output[-1]=output[-1]+" "+part
        else:output.append(part)
    return output

def extract_document(meta):
    pdf=load_pdf(meta)
    sections=meta["asignaturas"]
    by_id={s["id"]:s for s in sections}
    out=[];unknown=[];warnings=[];state={}
    active=None;last_heading_y=None;serial=0
    # Mantener los párrafos incompletos entre páginas consecutivas.
    pending=None
    def append_entry(txt,info):
        nonlocal serial
        for piece in split_atomic(squish(txt)):
            if len(piece)<8 or not re.search(r"[A-Za-zÁÉÍÓÚáéíóúÑñ]",piece):continue
            year=info["year"]
            if year is None:
                unknown.append({"subject":info["subject"],"page":info["page"],"text":piece[:200],
                                "reason":"anio_no_documentado"})
                continue
            field=info["field"]
            subject=info["subject"]
            content_key=stable(subject,year,info["axis"],info["subaxis"],piece,prefix="tec-concepto")
            original=stable(meta["especialidad_id"],info["sectionId"],year,
                            info["axis"],info["subaxis"],info["page"],piece,
                            prefix="tec-contenido")
            serial+=1
            out.append({"id":original,"conceptId":content_key,"component":"FG" if field=="formacion_general" else "FO",
              "year":year,"subject":subject,"field":field,"axis":info["axis"],
              "subaxis":info["subaxis"],"text":piece,"source":meta["fuente_url"],"page":info["page"],
              "sourceReference":info["sectionId"]+"@p"+str(info["page"]),
              "sourceYearConfidence":info["confidence"],"sourceValidation":"extraccion_geometrica_pdf_oficial",
              "sourceGeometry":{"column":"contenidos","pdf_page":info["page"],"x0_min":info["x0"],"y0":round(info["y0"],1)},
              "pedagogicallyReviewed":False,
              "documentallyVerified":True})
    def flush():
        nonlocal pending
        if pending:
            append_entry(pending["text"],pending)
            pending=None
    for idx in range(len(pdf)):
        ll=lines_on(pdf[idx])
        hs=headings_on(ll,sections,idx)
        sections_here={s["id"] for s in sections for p in s["paginas"] if int(p["pagina_pdf"])==idx+1}
        ranges=[]
        if hs:
            if active and hs[0][0]>170:
                ranges.append((80,hs[0][0],active,False))
            for j,(y,section) in enumerate(hs):
                ranges.append((y,hs[j+1][0] if j+1<len(hs) else 501,section,True))
            active=hs[-1][1]
        else:
            # Si el índice oficial cambia de materia y no hay un título
            # detectable (p. ej. PP), NO atribuir la página al tema anterior.
            if sections_here and active and active["id"] not in sections_here and len(sections_here)==1:
                active=by_id[next(iter(sections_here))]
            elif not active and len(sections_here)==1:
                active=by_id[next(iter(sections_here))]
            if active:ranges=[(65,501,active,False)]
        for lo,hi,section,has_title in ranges:
            if not section or lo>=hi:continue
            if pending and pending["sectionId"]!=section["id"]:flush()
            key=section["id"]
            prev=state.get(key,{})
            year,confidence=year_of(meta,section,idx,ll,lo,min(hi,lo+95),prev.get("year"))
            if year is not None:
                changed=prev.get("year") not in (None,year)
                state[key]={"year":year,
                    "axis":"" if changed else prev.get("axis",""),
                    "subaxis":"" if changed else prev.get("subaxis","")}
            else:state.setdefault(key,{"year":None,"axis":"","subaxis":""})
            y_header=max((l["y"] for l in ll if lo<=l["y"]<hi and l["x"]>=260 and
                         re.fullmatch(r"(?:Contenidos(?: priorizados)?|Conocimientos)",l["text"],re.I)),default=lo)
            body=[l for l in ll if max(lo+9 if has_title else lo,y_header+9)<=l["y"]<min(hi,495)
                  and l["x"]>=260 and l["x"]<744
                  and not NOISE_RX.fullmatch(l["text"])]
            for line in body:
                if is_section_topic(line):
                    flush()
                    name=line["text"].rstrip(".")
                    # La tipografía distingue encabezados temáticos; la
                    # fuente no siempre los llama «eje» o «subeje».
                    norm=canon(name)
                    # Rótulos de sección son ejes; un encabezado descriptivo
                    # dentro de la sección es subeje y no reemplaza el eje.
                    is_major=(norm.startswith("seccion ") or norm.startswith("eje ") or
                        norm in ("produccion","apreciacion","contextualizacion") or
                        (len(name.split())<=2 and not state[key]["axis"]))
                    if is_major or not state[key]["axis"]:
                        state[key]["axis"]=name
                        state[key]["subaxis"]=""
                    else:
                        state[key]["subaxis"]=name
                    continue
                info={"sectionId":key,"subject":section["asignatura"],
                      "field":section["campo_estimado"],"year":year,
                      "confidence":confidence,"axis":state[key]["axis"],
                      "subaxis":state[key]["subaxis"],"page":idx+1,"x0":round(line["x"],1),
                      "y0":line["y"]}
                if pending:
                    contiguous=(pending["sectionId"]==key and pending["year"]==year and
                       ((pending["page"]==idx+1 and line["y"]-pending["yPrev"]<=18) or
                        (pending["page"]==idx and pending["yPrev"]>350 and line["y"]<190)))
                    prev=pending["text"]
                    if contiguous and not re.search(r"[.!?]\s*$",prev) and not prev.endswith(":"):
                        pending["text"]=prev+" "+line["text"]
                        pending["yPrev"]=line["y"]
                        continue
                    flush()
                pending={**info,"text":line["text"],"yPrev":line["y"]}
        if not hs and sections_here and active and active["id"] not in sections_here:
            warnings.append({"page":idx+1,"reason":"continuidad_sin_titulo","sectionId":active["id"]})
    flush()
    # El catálogo de la misma especialidad no debe mostrar una misma oración
    # dos veces si el PDF repite la página o una tabla incluye duplicados.
    unique={}
    for r in out:
        k=(r["conceptId"],r["year"],r["field"],r["sourceReference"])
        unique.setdefault(k,r)
    contents=list(unique.values())
    # El id idéntico dentro de dos páginas diferentes perjudicaría el motor:
    # hacerlo inequívoco por el origen SIN cambiar el ID de concepto global.
    seen=set()
    for row in contents:
        if row["id"] in seen:
            row["id"]=stable(row["id"],row["page"],prefix="tec-contenido")
        seen.add(row["id"])
    out_stats={
      "especialidad":meta["especialidad_id"],"pages":len(pdf),"sections":len(sections),
      "contenidos":len(contents),"conceptosUnicos":len(set(r["conceptId"] for r in contents)),
      "sinAnio":len(unknown),"sinEjeExplicito":sum(not r["axis"] for r in contents),
      "sinSubejeExplicito":sum(not r["subaxis"] for r in contents),
      "porAnio":dict(sorted(Counter(str(r["year"]) for r in contents).items())),
      "porCampo":dict(Counter(r["field"] for r in contents))
    }
    if not contents:raise RuntimeError("El PDF no produjo contenidos: "+meta["especialidad_id"])
    data={"schema":SCHEMA,"especialidad_id":meta["especialidad_id"],
      "especialidad_nombre":meta["especialidad_nombre"],"fuente_url":meta["fuente_url"],
      "fuente_sha256":meta["sha256_pdf"],"extractor":"PyMuPDF · columna de contenidos (no indicadores)",
      "homologacion":"no_declarada","version":3,
      "materias":[{"id":s["id"],"nombre":s["asignatura"],"campo":s["campo_estimado"],
                    "aniosFuente":s.get("anios_detectados",[])} for s in sections],
      "contenidos":contents,"incidencias":unknown,
      "incidenciasTecnicas":warnings[:200],"resumen":out_stats}
    return data

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--only",help="Id de una especialidad para prueba")
    p.add_argument("--output",type=Path,default=OUT_DEFAULT)
    p.add_argument("--jobs",type=int,default=5)
    a=p.parse_args()
    docs=get_documents()
    if a.only:docs=[m for m in docs if m["especialidad_id"]==a.only]
    if not docs:raise RuntimeError("No hay especialidades para procesar.")
    a.output.mkdir(parents=True,exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,min(a.jobs,8))) as pool:
        results=list(pool.map(extract_document,docs))
    global_ids=set();stats=[]; all_concepts=set();bad_ids=set()
    for data in results:
        for row in data["contenidos"]:
            if row["id"] in global_ids:bad_ids.add(row["id"])
            global_ids.add(row["id"]);all_concepts.add(row["conceptId"])
            if not row["text"] or row["year"] not in range(1,7) or row["source"]!=data["fuente_url"]:
                raise ValueError("Contenido sin trazabilidad: "+row["id"])
        path=a.output/(data["especialidad_id"]+".json")
        path.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf8")
        stats.append(data["resumen"])
        print("BASE_TECNICA_ESPECIALIDAD="+json.dumps(data["resumen"],ensure_ascii=False),flush=True)
    if bad_ids:raise RuntimeError("IDs duplicados: "+str(list(bad_ids)[:5]))
    totals={"especialidades":len(results),"referenciasFuente":sum(s["sections"] for s in stats),
            "contenidos":sum(s["contenidos"] for s in stats),"conceptosUnicos":len(all_concepts),
            "sinAnio":sum(s["sinAnio"] for s in stats),
            "sinEjeExplicito":sum(s["sinEjeExplicito"] for s in stats),
            "sinSubejeExplicito":sum(s["sinSubejeExplicito"] for s in stats)}
    manifest={"schema":"pci-tecnica-base-curricular-indice/3","version":3,"homologacion":"no_declarada",
              "fuente":"PDF oficiales GCABA · octubre 2026","totales":totals,
              "especialidades":[{"id":r["especialidad_id"],"archivo":r["especialidad_id"]+".json",
                    "contenidos":r["resumen"]["contenidos"]} for r in results]}
    (a.output/"indice.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print("BASE_TECNICA_TOTAL="+json.dumps(totals,ensure_ascii=False),flush=True)

if __name__=="__main__":
    main()
