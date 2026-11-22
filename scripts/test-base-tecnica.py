#!/usr/bin/env python3
"""Control de calidad del banco reconstruido, sin aprobación humana por ítem."""
from pathlib import Path
import json
from collections import Counter
from hashlib import sha256
import sys

root=Path(__file__).resolve().parents[1]
folder=root/"data"/"tecnica"/"base-curricular"
manifest=json.loads((folder/"indice.json").read_text(encoding="utf8"))
assert manifest["schema"]=="pci-tecnica-base-curricular-indice/3"
assert manifest["totales"]["especialidades"]==26
seen=set();total=0;without_axis=0
for entry in manifest["especialidades"]:
    item=json.loads((folder/entry["archivo"]).read_text(encoding="utf8"))
    assert item["schema"]=="pci-tecnica-base-contenidos/3",entry["id"]
    assert item["especialidad_id"]==entry["id"]
    assert item["fuente_url"].startswith("https://static.buenosaires.gob.ar/")
    ids=set()
    for c in item["contenidos"]:
        assert 1<=c["year"]<=6,c
        assert c["component"] in ("FG","FO"),c
        assert c["source"]==item["fuente_url"],c
        assert c["sourceValidation"]=="extraccion_geometrica_pdf_oficial"
        assert c["sourceGeometry"]["column"]=="contenidos"
        assert not c["text"].startswith(("Indicadores de logro","CONTENIDOS PRIORIZADOS"))
        assert 1<=c["page"]<=1200
        assert c["id"] not in ids,(entry["id"],c["id"])
        assert c["id"] not in seen,(entry["id"],c["id"])
        ids.add(c["id"]);seen.add(c["id"])
        without_axis+=not bool(c["axis"])
    assert item["contenidos"],entry["id"]
    assert len(item["contenidos"])==entry["contenidos"]
    total+=len(item["contenidos"])
assert total==manifest["totales"]["contenidos"]

computacion=json.loads((folder/"computacion.json").read_text(encoding="utf8"))["contenidos"]
norm=lambda s:str(s).lower()
assert any(c["subject"]=="Base de Datos" and c["year"]==4 and
           "organización de datos" in norm(c["text"]) and c["page"] in (84,85) for c in computacion),\
           "Los contenidos de Base de Datos deben venir de la columna de contenido del PDF."
assert not any(c["subject"]=="Base de Datos" and
               "comprende y aplica los conceptos fundamentales" in norm(c["text"]) for c in computacion),\
           "No importar indicadores de logro como contenidos."
assert any(c["subject"]=="Diseño" and c["page"]==14 and
           "concepto de diseño" in norm(c["text"]) for c in computacion),\
           "La página 14 contiene Diseño aunque también continúa Música."
assert any(c["subject"]=="Música" and c["page"]==14 for c in computacion),\
           "La página 14 aún incluye Música, que no debe atribuirse a Diseño."
assert not any(c["page"]==98 and c["subject"]=="Prácticas Profesionalizantes" for c in computacion),\
           "La página vacía 98 no es un contenido."

print("PRUEBA_BASE_TECNICA_OK",json.dumps({
 "especialidades":manifest["totales"]["especialidades"],
 "contenidos":total,"conceptosUnicos":manifest["totales"]["conceptosUnicos"],
 "sinEjeExplicito":without_axis
},ensure_ascii=False))
