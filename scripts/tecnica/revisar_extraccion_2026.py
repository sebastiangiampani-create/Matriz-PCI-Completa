#!/usr/bin/env python3
"""Review and normalize the offline PDF extractor output, without touching any PCI.

This is not pedagogical validation: all derived fields remain provisional.
"""
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/"data/tecnica"
CATALOG=BASE/"catalogo-priorizados-2026.json"
SOURCE=BASE/"fuentes-priorizadas-caba-2026.json"
DOCS=BASE/"priorizados"

def norm(s):
    return "".join(c for c in unicodedata.normalize("NFKD",str(s))
                   if not unicodedata.combining(c)).lower()

def verify():
    source=json.loads(SOURCE.read_text(encoding="utf-8"))
    catalog=json.loads(CATALOG.read_text(encoding="utf-8"))
    entries=source["especialidades"]+source["transversal"]
    assert len(source["especialidades"])==26 and len(entries)==27
    assert len({e["id"] for e in entries})==27
    assert not catalog.get("errores"),catalog.get("errores")
    assert len(catalog["documentos"])==27
    count=0
    checked=[]
    for e in entries:
        path=DOCS/(e["id"]+".json")
        assert path.is_file(),f"Falta {path}"
        data=json.loads(path.read_text(encoding="utf-8"))
        assert data["especialidad_id"]==e["id"]
        assert data["fuente_url"].startswith("https://static.buenosaires.gob.ar/")
        assert re.fullmatch("[0-9a-f]{64}",data["sha256_pdf"])
        assert data["asignaturas"]
        assert data["paginas_pdf"]>5
        # Classify with headings from the PDF, not only inferred generic fields.
        # Technical subjects do not automatically inherit the Scientific field.
        field="formacion_general"
        normalized_subjects=[]
        for s in data["asignaturas"]:
            pages=[]
            labels=[]
            for p in s["paginas"]:
                page=int(p["pagina_pdf"])
                assert 1<=page<=data["paginas_pdf"],(e["id"],page)
                text=p["texto_pagina"]
                assert isinstance(text,str) and text.strip()
                header=norm(text[:1150])
                if "campo de la formacion cientifico tecnologica" in header or "campo de la formacion cientifico-tecnologica" in header:
                    field="formacion_cientifico_tecnologica"
                if "campo de la especialidad" in header or "campo de la formacion tecnica especifica" in header:
                    field="formacion_tecnica_especifica"
                if "campo de las practicas profesionalizantes" in header:
                    field="practicas_profesionalizantes"
                # Computacion 2026 lacks a visible field-heading in its
                # specialty section. The annual subject is known from the
                # official 05/10/2026 composition rules; mark a possible
                # boundary and keep it explicitly provisional.
                if (e["id"]=="computacion" and page>=84 and
                        field=="formacion_cientifico_tecnologica"):
                    field="formacion_tecnica_especifica"
                pages.append({"pagina_pdf":page,"texto_pagina":text,
                             "anio_contextual_inferido":p.get("anio_contextual_no_validado")})
                labels.append(field)
            candidate=Counter(labels).most_common(1)[0][0]
            if "practicas profesionalizantes" in norm(s["asignatura"]):
                candidate="practicas_profesionalizantes"
            if e["id"]=="tecnologia_representacion":
                candidate="formacion_tecnica_especifica"
            normalized_subjects.append({
                "id":s["id"],"asignatura":s["asignatura"],
                "campo_estimado":candidate,"campo_verificado":False,
                "anios_detectados":s["anios_detectados"],
                "anio_verificado":False,
                "pagina_inicio":s["pagina_inicio"],"pagina_fin":s["pagina_fin"],
                "paginas":pages,
                "estado":"extraccion_automatica_pendiente_revision",
                "fuente_url":data["fuente_url"]
            })
        count+=len(normalized_subjects)
        compact={
            "schema":"pci-tecnica-priorizados/2",
            "especialidad_id":e["id"],"especialidad_nombre":e["nombre"],
            "fuente_url":data["fuente_url"],"fuente_archivo":data["fuente_archivo"],
            "sha256_pdf":data["sha256_pdf"],"paginas_pdf":data["paginas_pdf"],
            "estado":"extraccion_automatica_pendiente_revision",
            "advertencia":"Campos, anios y cortes automaticos; validar antes de homologar. La pagina PDF prevalece. No sustituye los trabajos de escuelas.",
            "asignaturas":normalized_subjects
        }
        path.write_text(json.dumps(compact,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
        checked.append({
            "id":e["id"],"nombre":e["nombre"],
            "fuente_url":data["fuente_url"],"sha256_pdf":data["sha256_pdf"],
            "paginas_pdf":data["paginas_pdf"],
            "asignaturas_indexadas":len(normalized_subjects),
            "campos_estimados":dict(Counter(s["campo_estimado"] for s in normalized_subjects)),
            "anios_detectados":sorted({a for s in normalized_subjects for a in s["anios_detectados"]}),
            "estado":"pendiente_validacion_pedagogica"
        })
    assert count>1000,count
    catalog["schema"]="pci-tecnica-priorizados-caba/2"
    catalog["estado"]="extraido_pendiente_validacion_pedagogica"
    catalog["esquema_escolar_modificado"]=False
    catalog["debe_aplicarse_a_pci_existentes"]=False
    catalog["requiere_validacion_pedagogica"]=True
    catalog["documentos"]=checked
    catalog["totales"]={
        "especialidades_documentadas":26,
        "documentos_documentados":27,
        "asignaturas_indexadas":count,
        "paginas_pdf":sum(x["paginas_pdf"] for x in checked)
    }
    CATALOG.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("REVIEWED",catalog["totales"])
    assert catalog["totales"]["paginas_pdf"]==2822

if __name__=="__main__":
    verify()
