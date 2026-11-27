# Validación curricular integral — Matriz PCI V2

**Fecha:** 27/11/2026  
**Estado:** **Estructura y carga de perfiles verificada; homologación pedagógica pendiente.**  
**Ámbito:** Media, 26 especialidades de Técnica, 16 orientaciones de BA+15. Sin escrituras en Supabase.

## Fuentes documentales

- **Bachillerato BA+15:** [Resolución 1375/MEDGC/25, Anexo I IF-2025-44785236-GCABA-SSPIE](https://documentosboletinoficial.buenosaires.gob.ar/publico/PE-RES-MEDGC-MEDGC-1375-25-ANX-2.pdf), apartados 6.3–6.5. Se contrastó su tabla de niveles y 38 horas semanales.
- **Media y Técnica:** IF-2026-51169092-GCABA-SSPIE, Anexo II, modelo de composición codificado en `src/normativa/composicion-pci-20261117.mjs`; referencia pública: [Normativa Secundaria Aprende](https://sites.google.com/view/educacin-nivel-secundario/normas-escolares/secundaria-aprende). El cotejo documental externo de cada plan de especialidad continúa pendiente.
- **Contenidos técnicos:** `data/tecnica/priorizados/*.json` y `data/tecnica/base-curricular/*.json`, obtenidos de PDF CABA 2026, sin declaración de homologación.

## Resultados reproducibles

| Prueba | Resultado |
|---|---|
| Módulo curricular real BA+15, orientaciones | **16/16 cargan**, cuatro vía catálogos V2 individuales |
| Módulo curricular real Técnica, especialidades | **26/26 cargan** |
| Términos por modalidad | Media C1–C10; Técnica C1–C12; BA+15 C1–C8 |
| BA+15: horas por nivel | **38 / 38 / 38 / 38**, conforme anexo |
| BA+15: catálogo FG reindexado | **1.126 contenidos** de Media preservados y redistribuidos 1º+2º→Nivel I; 3º→II; 4º→III; 5º→IV |
| BA+15: FO | **860 referencias en el catálogo general**, con archivos alternativos para las cuatro orientaciones no cubiertas; ninguna orientación queda sin fuente en el motor |
| Técnica: especialidades con anual prescripto | **20** |
| Técnica: anual no definido en el anexo | **5**: Refrigeración/ventilación/calefacción/aire, Metalurgia, Órtesis y Prótesis, Diseño de Interiores, Diseño de Artesanías |
| Técnica: especialidad sin anual | **1**, Geógrafo Matemático |
| Técnica: referencias de páginas fuente | **2.674** |
| Técnica: contenidos de base reconstruida | **61.114** |
| Técnica: sin eje explícito en base reconstruida | **12.432** |
| Técnica: sin subeje explícito en base reconstruida | **28.857** |
| Técnica: cotejos de contenidos atómicos con fuente en el barrido | **10.610** |
| Técnica: fragmentos documentales provisionales adicionales | **5.657**, ninguno declara eje/subeje pedagógico verificado |
| Técnica: referencias sin resolver | **87**: 61 extracciones de columnas ambiguas y 26 páginas sin texto extraído |
| Tests especializados | **34/34 aprobados**, sin errores en los 42 cargadores reales |

**Importante:** las cifras de `base-curricular` (61.114) y de `qa-tecnica-priorizados` (cotejos, provisionales y pendientes) corresponden a **capas distintas del procesamiento documental**; no deben sumarse ni tratarse como contenidos homogéneos u oficialmente homologados.

## Conclusiones

1. **Carga de los motores:** no se encontraron fallos de apertura ni de estructura en los 42 perfiles. El código preserva IDs y archivos de referencia. La FO de BA+15 utiliza el respaldo original de orientación cuando la base FO v96 no contiene sus saberes; no faltan las cuatro orientaciones.
2. **BA+15:** estructura horaria y reindexación de priorizados FG correctas. La distribución de materias FO del plan NES por alternativa, su validación específica para BA+15 y las articulaciones de talleres requieren revisión de cada propuesta institucional.
3. **Técnica:** existen contenidos recuperados y materias seleccionables en todas las especialidades, pero hay registros documentales provisionales y cantidades de PP, talleres, integraciones y horas que dependen del diseño curricular particular. **No declarar homologación automática ni establecer valores por inferencia.**
4. **Operación:** las pruebas de guardado/concurrencia en CI usan datos simulados. Falta ejecutar en producción, con una escuela de prueba autorizada y sus credenciales existentes, la secuencia DIR→PCI→guardar→salir→reabrir desde otro equipo y cotejar historial.
5. **Estados:** conservar `pending_rules` para los PCI de Técnica y BA+15 hasta la validación normativa específica; evitar cambios artificiales de estado o reescrituras del legado.

## Evidencia y ejecución

- [GitHub Actions — Auditoría curricular integral y reportes descargables](https://github.com/sebastiangiampani-create/Matriz-PCI-Completa/actions/runs/46017999012), archivo `auditoria-curricular-informe-20261127`.
- `node scripts/qa-lanzamiento-curricular-integral.mjs`: verifica todos los cargadores reales con `fetch` estrictamente local, sin red ni secretos, y guarda `test-artifacts/auditoria-curricular/informe-completo-20261127.json`.
- `node scripts/qa-tecnica-priorizados.mjs`: genera `test-artifacts/tecnica/auditoria-pendientes-2026.json`, con 87 referencias pendientes, motivos, campos y fuente documental.
- [Acta anterior de auditoría técnica y de seguridad](https://github.com/sebastiangiampani-create/Matriz-PCI-Completa/blob/main/auditoria/cierre-20261127.md) y pruebas HTTP públicas.
- [Seguimiento de homologación normativa](https://github.com/sebastiangiampani-create/Matriz-PCI-Completa/issues/73).
- [Prueba institucional real de roles y guardado](https://github.com/sebastiangiampani-create/Matriz-PCI-Completa/issues/74).

**Decisión:** estructura y carga de perfiles aptas para un **piloto acotado**. **No habilitar uso masivo como completamente certificado** hasta homologación documental/curricular y prueba real de persistencia y permisos.
