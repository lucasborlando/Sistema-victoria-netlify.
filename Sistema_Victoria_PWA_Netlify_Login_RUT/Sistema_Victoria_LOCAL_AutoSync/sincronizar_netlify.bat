@echo off
set SV_PUBLIC_DIR=%~dp0..\Sistema_Victoria_NETLIFY_Informativo
set SV_AUTO_GIT=1
python exportar_netlify.py
pause
