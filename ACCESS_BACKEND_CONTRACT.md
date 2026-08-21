# Contrato de acceso multi-escuela

## Objetivo
Conservar Escuela de muestra 1 y 2 sin modificar sus datos actuales y agregar acceso para el catálogo de escuelas reales.

## Clave de escuela
Formato público: `PCI-####` (4 dígitos, único entre claves activas).

La clave NO debe almacenarse en GitHub, HTML ni JavaScript. En base de datos guardar:
- `code_hash`: hash seguro para validar.
- `code_ciphertext`: copia cifrada reversible para que un administrador autorizado pueda verla/copiarla.
- `active`, `created_at`, `rotated_at`.

La clave de cifrado reversible debe existir únicamente en variables de entorno/secret manager del backend.

## Endpoints esperados
Base sugerida detrás de `https://escuelademaestros.bue.edu.ar/secundariaPCI/`:

### POST `/api/pci/auth/school`
Entrada:
```json
{"school_id":"real-001","code":"PCI-4827","first_name":"Ana","last_name":"Pérez","email":"ana@example.edu.ar"}
```
Salida exitosa:
```json
{"token":"...","school_id":"real-001","role":"editor","redirect":"/secundariaPCI/escuela.html?school=real-001"}
```

### POST `/api/pci/auth/admin`
Autenticación administrativa real. Nunca una clave maestra embebida en frontend.

### GET `/api/pci/admin/schools`
Devuelve listado masivo, estado, última edición y clave descifrada solo para rol admin.

### POST `/api/pci/admin/schools/:schoolId/reset-code`
Genera un nuevo `PCI-####` no repetido, invalida el anterior y registra auditoría.

### GET `/api/pci/schools/:schoolId/state`
Devuelve el estado PCI compartido de la escuela.

### PUT `/api/pci/schools/:schoolId/state`
Guarda el estado PCI. Debe registrar usuario, fecha y versión para control de concurrencia.

## Concurrencia
Para varias personas/dispositivos sobre una misma escuela:
- guardar `version` o `updated_at` por estado;
- usar control optimista (`If-Match`/version) para evitar pisadas silenciosas;
- opcional: WebSocket/Supabase Realtime para reflejar cambios en sesiones abiertas;
- registrar `user_id`, nombre, apellido, mail y acción en `audit_log`.

## Tablas mínimas sugeridas
- `schools`
- `school_access_codes`
- `users` o `school_sessions`
- `school_members`
- `pci_states` (transición desde JSON actual)
- `audit_log`

El catálogo curricular oficial debe mantenerse separado del estado editable de cada escuela.
