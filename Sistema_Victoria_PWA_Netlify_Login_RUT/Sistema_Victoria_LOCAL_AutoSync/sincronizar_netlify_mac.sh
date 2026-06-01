#!/bin/bash
cd "$(dirname "$0")"
export SV_PUBLIC_DIR="$(pwd)/../Sistema_Victoria_NETLIFY_Informativo"
export SV_AUTO_GIT=1
python3 exportar_netlify.py
