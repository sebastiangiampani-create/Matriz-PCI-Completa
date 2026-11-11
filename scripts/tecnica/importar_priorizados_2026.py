#!/usr/bin/env python3
"""CABA 2026 technical prioritized curriculum: source-preserving import.

Builds a disconnected, revision-required reference catalogue. NEVER calls
Supabase, authenticates with schools, or edits an institutional PCI.
Original PDFs permit non-commercial educational redistribution with source
attribution. Source URL, PDF hash, and printed page are stored per subject.
"""
import concurrent.futures
import hashlib
import json
import re
import time
import unicodedata
from collections import Counter
from pathlib import Path
from urllib.parse import urljoin, urlparse, unquote

import fitz
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "data/tecnica/fuentes-priorizadas-caba-2026.json"
OUT = ROOT / "data/tecnica/priorizados"
INDEX = ROOT / "data/tecnica/catalogo-priorizados-2026.json"
MANIFEST = json.loads(SOURCE.read_text(encoding="utf-8"))
PORTAL = MANIFEST["portal"]
TOC = re.compile(r"^\s*(.{3,120}?)\s*\.{3,}\s*(\d{1,3})\s*$")
ALTERNATE = re.compile(r"^\s*(.{3,120}?)\s{4,}(\d{1,3})\s*$")
YEAR = {"primer":1,"primero":1,"segundo":2,"tercer":3,"tercero":3,
        "cuarto":4,"quinto":5,"sexto":6}
YEAR_RE = re.compile(r"\b(primer|primero|segundo|tercer|tercero|cuarto|quinto|sexto)\s+a(?:n|\u00f1)o\b", re.I)
SKIP = {"indice","contenidos priorizados","introduccion","bibliografia","anexo"}

def norm(s):
    s = unicodedata.normalize("NFKD", str(s))
    return "".join(ch for ch in s if not unicodedata.combining(ch)).casefold().strip()

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", norm(s)).strip("-")[:85]

def clean(s):
    return str(s).replace("\u00ad", "").replace("\x00", "").replace("\r", "")

def official_links():
    try:
        res = requests.get(PORTAL, timeout=(20,60), headers={"User-Agent":"Mozilla/5.0"})
        res.raise_for_status()
        links = {}
        for a in BeautifulSoup(res.text,"html.parser").find_all("a",href=True):
            url = urljoin(PORTAL,a["href"])
            if urlparse(url).path.casefold().endswith(".pdf"):
                links[norm(unquote(urlparse(url).path).split("/")[-1])] = url
        print("OFFICIAL_LINKS",len(links), flush=True)
        return links
    except Exception as exc:
        print("PORTAL_WARNING",str(exc)[:160],flush=True)
        return {}

def download(entry,links):
    name = norm(entry["archivo"])
    url = links.get(name,entry["url"])
    last_error = None
    for attempt in range(3):
        try:
            res = requests.get(url,timeout=(25,150),headers={
                "User-Agent":"Mozilla/5.0","Accept":"application/pdf"})
            res.raise_for_status()
            data = res.content
            if not data.startswith(b"%PDF-"):
                raise ValueError("Not a PDF: status 200 with non-PDF bytes")
            if len(data)>45_000_000:
                raise ValueError("PDF too large; manual inspection required")
            return (entry,url,data,None)
        except Exception as exc:
            last_error = str(exc)
            time.sleep(attempt+1)
    return (entry,url,None,last_error)

def extract_toc(doc,transversal):
    # The cross-cutting document indexes years rather than subject names.
    if transversal:
        return [{"asignatura":"Tecnolog\u00eda de la Representaci\u00f3n",
                 "pagina_inicio":6,"pagina_fin":len(doc)}]
    entries = []
    for pidx in range(4,min(10,len(doc))):
        text = clean(doc[pidx].get_text("text",sort=False))
        if pidx==4 and "indice" not in norm(text):
            print("TOC_NOTE",pidx,"index marker missing",flush=True)
        lines = [x.strip() for x in text.splitlines() if x.strip()]
        for k,line in enumerate(lines):
            hit = TOC.match(line) or ALTERNATE.match(line)
            if hit:
                title,number = hit.groups()
            elif k+1<len(lines) and re.fullmatch(r"\d{1,3}",lines[k+1]) and ".." in line:
                title,number = line.rstrip(" ."),lines[k+1]
            else:
                continue
            page=int(number)
            title=re.sub(r"\s+"," ",title).strip(" .")
            if page<7 or page>len(doc) or norm(title) in SKIP or len(title)<3:
                continue
            entries.append({"asignatura":title,"pagina_inicio":page})
    dedup = {}
    for e in entries:
        dedup[(norm(e["asignatura"]),e["pagina_inicio"])] = e
    entries = sorted(dedup.values(),key=lambda e:e["pagina_inicio"])
    for j,e in enumerate(entries):
        next_page=entries[j+1]["pagina_inicio"] if j+1<len(entries) else len(doc)+1
        e["pagina_fin"]=max(e["pagina_inicio"],next_page-1)
    return entries

def year_labels(text,transversal=False):
    labels=[]
    for line in text.splitlines():
        line=line.strip()
        if len(line)>110:
            continue
        key=norm(line)
        m=YEAR_RE.search(key)
        if m:
            v=YEAR[m.group(1)]
            if v not in labels:
                labels.append(v)
        if transversal:
            abbr=re.search(r"\b([12])\s*\.?\s*(?:er|do|o)\s+a(?:n|\u00f1)o\b",key)
            if abbr:
                v=int(abbr.group(1))
                if "segundo ciclo" in key:
                    v+=2
                if v not in labels:
                    labels.append(v)
    return labels

def field_on_page(text,current):
    key=re.sub(r"\s+"," ",norm(text[:1800]))
    tags=list(re.finditer(r"campo de la formacion\s+(general|cientifico[\s-]*tecnologica|tecnica especifica)",key))
    if tags:
        value=tags[-1][1]
        return ("formacion_general" if value=="general" else
                "formacion_tecnica_especifica" if "especifica" in value
                else "formacion_cientifico_tecnologica")
    return current

def parse_pdf(entry,url,raw):
    doc=fitz.open(stream=raw,filetype="pdf")
    if len(doc)<5:
        raise ValueError("Unexpectedly short PDF")
    is_transversal=entry["id"]=="tecnologia_representacion"
    chapters=extract_toc(doc,is_transversal)
    if len(chapters)<8 and not is_transversal:
        raise ValueError(f"TOC parsed only {len(chapters)} entries; needs manual review")
    first=min(e["pagina_inicio"] for e in chapters)
    fields={}
    last_field="formacion_general"
    for pnum in range(first,len(doc)+1):
        last_field=field_on_page(clean(doc[pnum-1].get_text("text")),last_field)
        fields[pnum]=last_field
    subjects=[]
    covered=set()
    for pos,e in enumerate(chapters):
        pages=[]
        yrs=set()
        contextual=None
        for pnum in range(e["pagina_inicio"],min(len(doc),e["pagina_fin"])+1):
            page=doc[pnum-1]
            text=clean(page.get_text("text",sort=True)).strip()
            detected=year_labels(text,is_transversal)
            if len(detected)==1:
                contextual=detected[0]
            yrs.update(detected)
            if not detected and contextual:
                yrs.add(contextual)
            w=page.rect.width
            right=clean(page.get_text("text",
                clip=fitz.Rect(w*.52,0,w,page.rect.height),sort=True)).strip()
            left=clean(page.get_text("text",
                clip=fitz.Rect(0,0,w*.52,page.rect.height),sort=True)).strip()
            pages.append({
                "pagina_pdf":pnum,"anio_mencionado":detected,
                "anio_contextual_no_validado":contextual if len(detected)<=1 else None,
                "campo_inferido":fields.get(pnum,"sin_clasificar"),
                "texto_pagina":text,
                "columna_contenidos_candidata":right,
                "columna_indicadores_candidata":left,
                "geometria_columnas_pendiente_verificacion":True
            })
            covered.add(pnum)
        campo=Counter(x["campo_inferido"] for x in pages).most_common(1)[0][0]
        if "practicas profesionalizantes" in norm(e["asignatura"]):
            campo="practicas_profesionalizantes"
        if is_transversal:
            campo="transversal_sin_homologacion_de_campo"
        subjects.append({
            "id":entry["id"]+"-"+str(pos+1).zfill(3)+"-"+slug(e["asignatura"]),
            "asignatura":e["asignatura"],"campo_estimado":campo,
            "anios_detectados":sorted(yrs),
            "anio_oficial_verificado":False,
            "pagina_inicio":e["pagina_inicio"],"pagina_fin":e["pagina_fin"],
            "paginas":pages,"estado":"extraccion_automatica_pendiente_validacion",
            "fuente_url":url
        })
    pdf_hash=hashlib.sha256(raw).hexdigest()
    record={
        "schema":"pci-tecnica-priorizados/1",
        "especialidad_id":entry["id"],"especialidad_nombre":entry["nombre"],
        "fuente_url":url,"fuente_archivo":entry["archivo"],
        "sha256_pdf":pdf_hash,"paginas_pdf":len(doc),
        "licencia":"GCABA Ministerio de Educacion. Material para fines educativos no comerciales con atribucion; prohibida su venta.",
        "estado":"extraccion_automatica_pendiente_validacion",
        "advertencia":"No es un plan de estudios; anios, campos, cortes y columnas inferidos requieren validacion. No modificar el PCI escolar.",
        "asignaturas":subjects,
        "paginas_sin_asignacion":sorted(set(range(first,len(doc)+1))-covered)
    }
    report={
        "id":entry["id"],"nombre":entry["nombre"],
        "fuente_url":url,"sha256_pdf":pdf_hash,
        "paginas_pdf":len(doc),"asignaturas_indexadas":len(subjects),
        "anios_detectados":sorted({year for s in subjects for year in s["anios_detectados"]}),
        "campos_estimados":dict(Counter(s["campo_estimado"] for s in subjects)),
        "estado":"requiere_revision_humana"
    }
    return record,report

def main():
    entries=MANIFEST["especialidades"]+MANIFEST["transversal"]
    if len(MANIFEST["especialidades"])!=26 or len(entries)!=27 or len({e["id"] for e in entries})!=27:
        raise SystemExit("Source manifest must contain 26 specialities and one transversal document")
    OUT.mkdir(parents=True,exist_ok=True)
    links=official_links()
    found={}
    errors=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for future in concurrent.futures.as_completed([pool.submit(download,e,links) for e in entries]):
            item,url,data,error=future.result()
            if error:
                errors.append({"id":item["id"],"tipo":"descarga","mensaje":error[:200]})
                print("DOWNLOAD_FAIL",item["id"],error[:200],flush=True)
            else:
                found[item["id"]]=(item,url,data)
                print("DOWNLOADED",item["id"],len(data),flush=True)
    reports=[]
    for entry in entries:
        if entry["id"] not in found:
            continue
        item,url,raw=found[entry["id"]]
        try:
            record,report=parse_pdf(item,url,raw)
            (OUT/(item["id"]+".json")).write_text(
                json.dumps(record,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
            reports.append(report)
            print("INDEXED",item["id"],report["asignaturas_indexadas"],
                  "subjects",report["paginas_pdf"],"pages",flush=True)
        except Exception as exc:
            errors.append({"id":item["id"],"tipo":"extraccion","mensaje":str(exc)[:220]})
            print("EXTRACT_FAIL",item["id"],str(exc)[:220],flush=True)
    catalog={
        "schema":"pci-tecnica-priorizados-caba/1",
        "portal":PORTAL,
        "fuentes":"data/tecnica/fuentes-priorizadas-caba-2026.json",
        "estado":"extraccion_automatica_pendiente_validacion" if not errors else "parcial_con_errores",
        "esquema_escolar_modificado":False,
        "debe_aplicarse_a_pci_existentes":False,
        "requiere_validacion_pedagogica":True,
        "observaciones":["No es un plan de estudio ni una asignacion oficial de horas.",
          "Las referencias exactas y los PDF originales prevalecen ante errores de extraccion.",
          "No mezclar con planes docentes, matrices antiguas o contenidos V2 de Media."],
        "documentos":reports,"errores":errors,
        "totales":{
            "especialidades_documentadas":sum(x["id"]!="tecnologia_representacion" for x in reports),
            "documentos_documentados":len(reports),
            "asignaturas_indexadas":sum(x["asignaturas_indexadas"] for x in reports),
            "paginas_pdf":sum(x["paginas_pdf"] for x in reports)
        }
    }
    INDEX.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("RESULT",json.dumps(catalog["totales"],ensure_ascii=False),flush=True)
    if errors:
        print("IMPORT_ERRORS",json.dumps(errors,ensure_ascii=False),flush=True)
    if not reports:
        raise SystemExit("No verified PDF could be indexed")
    if errors:
        raise SystemExit("Incomplete import: artifacts available for review; do not mark complete")

if __name__=="__main__":
    main()
