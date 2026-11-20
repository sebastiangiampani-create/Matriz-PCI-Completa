# Revisión local: tres motores V2 independientes

**Solo para evaluación. No contiene credenciales ni se conecta con los datos de las escuelas.**

## Abrir en Windows
1. Extraer el paquete conservando las carpetas.
2. Hacer doble clic en `experiencias-v2/INICIAR_EN_WINDOWS.cmd`.
3. Se abre `http://127.0.0.1:8765/experiencias-v2/index.html`.

Requiere Python 3 instalado. El programa inicia un servidor HTTP limitado a `127.0.0.1` (tu equipo). Cerrar la ventana de comandos detiene el servidor. No usar el archivo HTML mediante `file://`, porque los módulos curriculares requieren HTTP.

## Estructura

- `experiencias-v2/media.html`: abre **Media V2 original**, cinco niveles, C1–C10.
- `experiencias-v2/tecnica.html`: selector de especialidad, abre **Técnica V2 derivado**, seis niveles, C1–C12.
- `experiencias-v2/ba15.html`: selector de orientación, abre **BA +15 V2 derivado**, cuatro niveles, C1–C8.

Todos los motores incluyen construcción curricular, bolsa de materias y desarrollo de planes desde la misma lógica del código V2. El repositorio de origen se usa como copia inalterada bajo `vendor/pci-sec-aprende-v2/`.

**Límite curricular:** las bases técnicas incluyen textos extraídos de PDF pendientes de validación, y los contenidos FO de BA +15 requieren comprobación normativa.

La prueba de navegador automatizada está en `tests/tres-motores-v2-independientes-browser.mjs`.

Los borradores de esta revisión se guardan únicamente en el almacenamiento del navegador. No sustituyen los PCI institucionales ni realizan escrituras en Supabase.
