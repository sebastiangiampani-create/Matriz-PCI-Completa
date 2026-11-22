#!/usr/bin/env python3
"""Temporary diagnostic: document layout of official technical prioritized PDFs."""
import json
import sys
from urllib.request import Request, urlopen
from pathlib import Path
import fitz

manifest = Path("data/tecnica/priorizados/computacion.json")
docinfo = json.loads(manifest.read_text(encoding="utf-8"))
url = docinfo["fuente_url"]
print("PROBE_URL", url,flush=True)
try:
    req = Request(url, headers={"User-Agent":"Mozilla/5.0 (PCI curricular analysis)"})
    with urlopen(req, timeout=45) as response:
        payload=response.read()
        print("FETCH", response.status, response.headers.get("content-type"),len(payload), flush=True)
except Exception as error:
    print("FETCH_ERROR",type(error).__name__,str(error),flush=True)
    raise

pdf=fitz.open(stream=payload,filetype="pdf")
print("DOCUMENT",len(pdf),"pages",flush=True)
for label,page_num in [("contenidos_tecnicos",84),("practicas",97),("musica",12),("diseno",13)]:
    if page_num>=len(pdf):continue
    page=pdf[page_num]
    print("PAGE",label,page_num+1,{"rect":[page.rect.width,page.rect.height]},flush=True)
    blocks=page.get_text("dict")["blocks"]
    lines=[]
    for b in blocks:
        if b.get("type")!=0:continue
        for line in b.get("lines",[]):
            txt="".join(span.get("text","") for span in line["spans"]).strip()
            if not txt:continue
            l={"x":round(line["bbox"][0],1),"y":round(line["bbox"][1],1),
              "x2":round(line["bbox"][2],1),"text":txt[:170]}
            lines.append(l)
    for l in sorted(lines,key=lambda x:x["y"])[:75]:
        print("TEXT",json.dumps(l,ensure_ascii=False),flush=True)
