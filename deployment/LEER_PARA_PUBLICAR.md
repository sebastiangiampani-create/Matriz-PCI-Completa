# ENTREGA DE PUBLICACIÓN — PCI POR ORIENTACIÓN

**Rama definitiva para el despliegue:** release/pci-orientaciones-aditivo-20261111  
**Pull request:** https://github.com/sebastiangiampani-create/Matriz-PCI-Completa/pull/34

## Preparado por nosotros en GitHub
- Pantalla de orientaciones, vínculos desde panel administrativo e institucional
- Base FG histórica, referencia FG V2 y FO V2
- Varios PCI independientes para la misma escuela, incluso de la misma orientación
- Mapa de oferta C1–C10, composición FO y cuatro planes por espacio
- Guardado por unidad con revisión 409, historial y borrador temporal por pestaña
- La función Supabase completa: supabase/functions/pci-access/
- Dos scripts SQL aditivos, sin reemplazo de public.pci_proposals.data
- Pruebas de concurrencia, currículo, interfaz y permisos

## Publicación por el programador
No tiene que reconstruir ninguna pantalla ni conectar a mano la Edge.

1. Clonar la rama indicada y acceder privadamente al proyecto Supabase.
2. Obtener las credenciales de Postgres y el hash **actual** del administrador
   desde la Edge Function original por un canal seguro. Ninguno se publica.
3. Realizar una copia EXTERNA y PROBAR LA RESTAURACIÓN EN OTRA BASE.
   La instantánea privada dentro del mismo Supabase no basta.
4. Configurar su consola con las variables SUPABASE_PROJECT_REF,
   SUPABASE_DB_URL, PCI_ADMIN_HASH y PCI_DEPLOY_MODE.
   El proyecto de producción es agmebsotbuurbnldxewf.
5. Para staging: PCI_DEPLOY_MODE=staging y ref de base aislada.
6. Para producción: PCI_DEPLOY_MODE=production,
   PCI_PUBLICACION_AUTORIZADA=SI y
   PCI_RESTAURACION_EXTERNA_VERIFICADA=SI.
7. Ejecutar: bash deployment/publicar-orientaciones.sh.
8. El script respalda, compara las huellas de todos los documentos, aplica las
   estructuras privadas y despliega la función completa con módulo APAGADO.
9. Probar la plataforma anterior (login y guardado), dos PCI de una escuela,
   dos escuelas separadas, cierre y reapertura, red interrumpida y revisión 409.
10. Solo con resultados verificados, habilitar la variable secreta:
    PCI_ORIENTACIONES_ENABLED=true. El botón de orientaciones ya está incluido
    en los paneles.

## Bloqueantes no técnicos
- Confirmar backup externo íntegro (incluye A-414M, ID 1234) y restauración.
- Auditar los contenidos desaparecidos en escuelas anteriormente afectadas:
  no convertir una matriz incompleta en fuente definitiva de los nuevos PCI.
- Autorizar institucionalmente el despliegue.
- Los tests de CI deben estar aprobados, sin errores pendientes.

Si hay problemas: desactivar la función nueva con
PCI_ORIENTACIONES_ENABLED=false. NO borrar los esquemas nuevos ni restaurar
una base antigua encima de los trabajos que puedan haberse generado después.

El script por seguridad no habilita los nuevos guardados automáticamente.
La base histórica y su Edge original siguen operativas hasta autorización.
