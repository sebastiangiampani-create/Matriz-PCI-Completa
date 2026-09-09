# Matriz PCI Offline para Windows

Esta edición se construye exclusivamente desde la rama `offline-windows`. No reemplaza ni modifica la aplicación online de `main`.

## Funcionamiento

- Ejecuta la misma Matriz PCI dentro de un servidor local (`127.0.0.1`).
- Guarda cada escuela en el perfil local de Windows.
- Conserva las claves de edición vigentes mediante verificadores locales; las claves no se guardan en texto plano en el repositorio.
- Permite preparar una copia desde la versión online usando la administración general, solo con operaciones de lectura del estado.
- Permite exportar un respaldo `.pci-offline.zip` e importarlo en otra PC desde un pendrive.
- No sincroniza automáticamente los cambios offline hacia Supabase. Esto evita sobrescribir datos online o resolver conflictos de manera implícita.

## Primer equipo con internet

1. Instalar o abrir `Matriz PCI Offline`.
2. Ir a **Copia offline / respaldo**.
3. Usar **Preparar / actualizar copia** con la administración online.
4. Ingresar como administración offline y elegir **Exportar respaldo al pendrive**.

## Equipo sin internet

1. Instalar `Matriz-PCI-Offline-Setup.exe` desde el pendrive.
2. Abrir **Copia offline / respaldo**.
3. Importar el archivo `.pci-offline.zip`.
4. Volver a **Ingresar a una escuela**.
5. Usar la misma clave `PCI-####` vigente cuando se generó el respaldo.

Los datos locales quedan en el perfil del usuario de Windows, separados de los archivos del programa y de la versión online.
