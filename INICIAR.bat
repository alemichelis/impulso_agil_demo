@echo off
echo Iniciando Impulso Agil RRHH...
set PYTHONPATH=%~dp0.venv\Lib\site-packages
start "" "http://127.0.0.1:5000"
"C:\Users\mbbg5\AppData\Roaming\uv\python\cpython-3.14-windows-x86_64-none\python.exe" "%~dp0main.py"
pause
