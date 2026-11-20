@echo off
setlocal
cd /d "%~dp0.."
set "PCI_URL=http://127.0.0.1:8765/experiencias-v2/index.html"
where py >nul 2>nul
if not errorlevel 1 (
  start "" "%PCI_URL%"
  py -3 -m http.server 8765 --bind 127.0.0.1
  goto end
)
where python >nul 2>nul
if not errorlevel 1 (
  start "" "%PCI_URL%"
  python -m http.server 8765 --bind 127.0.0.1
  goto end
)
echo.
echo No se encontro Python en este equipo.
echo Instala Python 3 o abre la carpeta desde un servidor local.
echo No se modificaron archivos ni bases de datos.
pause
:end
endlocal
