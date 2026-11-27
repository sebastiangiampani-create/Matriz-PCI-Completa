# Auditoría de seguridad · Matriz-PCI-Completa · 26/11/2026

**ESTADO: PLAN PREPARADO, NO EJECUTAR EN PRODUCCIÓN.**

Estos archivos son una revisión documental del paquete de Claude. No se
han aplicado a Supabase. No contienen credenciales ni copias de datos.

## Condiciones obligatorias

- Versionar previamente las funciones Edge `pci-access` y `pci-master` y el
  esquema SQL; conservar copia verificable en un sitio privado, no exponer
  claves en GitHub ni ejecutar `sql/01` sin ese respaldo.
- Crear una rama o proyecto **aislado** de Supabase con datos de prueba.
- Ejecutar primero `sql/00-verificaciones-previas.sql` y conservar las dos
  huellas. **Solo se ejecuta antes del cambio**: su quinto control exige
  expresamente que el esquema de respaldo no exista.
- Ejecutar `01-c2-clave-maestra.sql`, después `02-c3-indice-intentos.sql`,
  después `03-m7-permisos-tablas-sensibles.sql` **solo en el proyecto de prueba**.
- Comprobar con `sql/05-verificaciones-posteriores.sql` los controles y que las
  huellas de escuelas y unidades sean idénticas a las anteriores.
- Ensayar reversiones (`03-revertir-m7.sql`, `02-revertir-c3.sql`,
  `01-revertir-c2.sql`) y verificar restitución de acceso.
- El archivo opcional `04-opcional-escuelas-muestra.sql` **no forma parte de
  la primera intervención**: rompe las demos `escuela.html` y
  `escuela-muestra.html`.
- El límite de intentos en `pci-access` **no está desplegado**. El módulo
  entregado por Claude debe incorporarse a la función completa, probarse
  en el proyecto aislado y recién entonces considerarse para producción.
  El umbral preparado es de 10 fallos en 15 minutos; el intento 11 debe dar 429.
- `pci-master` solo puede darse de baja tras guardar la función completa,
  invalidar su código, verificar usos históricos y planificar reversión.

## Correcciones frente al ZIP original

1. `00` queda identificado como verificación **previa**, y se incorpora `05`
   para la revisión posterior. La ejecución de `00` después de `01` genera
   un falso incumplimiento por la presencia del respaldo.
2. `03-revertir-m7.sql` restaura **únicamente** los privilegios que `anon` y
   `authenticated` tenían en el respaldo ACL. El original ejecutaba
   `GRANT ALL`, que no garantiza una reversión de privilegios exacta.

No cambiar esquemas, claves de las escuelas, contratos `oferta/map`, IDs de
contenidos, ni `vendor/pci-sec-aprende-v2/`. Ante discrepancias, detenerse.
