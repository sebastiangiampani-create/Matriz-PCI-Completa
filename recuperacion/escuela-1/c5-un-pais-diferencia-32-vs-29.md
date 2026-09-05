# C5 · “Un país sin manual” — diferencia histórica 32 vs 29

> Investigación forense. No modifica `main` ni Supabase y **no rellena IDs por inferencia**.

## Hechos comprobados

1. La captura histórica identificada como **Mapa Curricular Institucional · Escuela 1 · PCI-101** muestra en C5:
   - `Un país sin manual`
   - **32 contenidos**.
2. La única copia JSON sobreviviente encontrada hoy con ese mismo nombre está en `school_id=4` (`Media 1`) y conserva **29 IDs**.
3. El documento histórico `PCI Laboratorios CN CS.docx` define para este laboratorio contenidos de:
   - Historia 3.º;
   - Formación Ética y Ciudadana 3.º;
   - Economía 3.º.
4. Al cruzar ese documento con `Base_Contenidos_PCI.xlsx`, el conjunto documental completo de contenidos asociados al recorte suma **35 IDs posibles**.

## Los 29 IDs sobrevivientes

```text
c277,c278,c279,c291,c293,c294,
c736,c737,c738,c739,c741,
c828,c829,c830,c831,c832,c833,c834,c835,c836,c837,c838,c839,c840,c841,c842,c843,c844,c845
```

## Los seis IDs documentales que no están en la copia de 29

El cruce exacto entre el texto del laboratorio y el catálogo deja estos **seis candidatos comprobados por contenido curricular**:

| ID | Materia | Contenido |
|---|---|---|
| `c275` | Economía | La economía como ciencia social. |
| `c276` | Economía | Niveles de análisis económicos: microeconomía y macroeconomía. |
| `c292` | Economía | Los recursos del Estado: los tributos y las contribuciones a la seguridad social como principales fuentes de ingreso. |
| `c295` | Economía | Las funciones y objetivos económicos del Estado: el Estado como regulador y promotor de actividades económicas. |
| `c296` | Economía | Breve reseña sobre la evolución del pensamiento en materia de intervención estatal en la economía. |
| `c740` | Formación Ética y Ciudadana | Los derechos sociales, económicos y culturales como resultado de reivindicaciones sociales y políticas. |

## Qué puede afirmarse y qué no

La Escuela 1 histórica tenía **32**, mientras la copia secundaria tiene **29**. Por lo tanto, **exactamente tres IDs adicionales** estaban presentes en aquel snapshot respecto de la copia actual.

La evidencia disponible permite reducir la búsqueda de los tres faltantes a este conjunto de seis:

```text
c275,c276,c292,c295,c296,c740
```

Todavía **no existe evidencia suficiente para decidir cuáles tres de esos seis eran los que estaban efectivamente asignados en PCI-101**. Elegirlos ahora sería reconstrucción especulativa, no recuperación.

## Qué resolvería la diferencia definitivamente

Cualquiera de estas fuentes permitiría cerrar el C5 exacto:

- snapshot/PITR de Supabase de `school_id=1` alrededor de `2026-08-07 18:36:45.840+00`;
- exportación JSON antigua de PCI-101;
- copia histórica del `localStorage` de un navegador que haya abierto Escuela 1;
- captura del editor de `Un país sin manual` donde se vea la lista completa de contenidos asignados.

Hasta que aparezca una de esas fuentes, los seis candidatos quedan preservados aquí y el snapshot reconstruido mantiene sólo los 29 IDs efectivamente recuperados.
