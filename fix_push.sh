#!/bin/bash
# Execute este script na pasta do projeto
# Ele força o reenvio de todos os arquivos para o GitHub

echo "=== Forcando reenvio para GitHub ==="

# Remove o cache do git para todos os arquivos tsx
git rm -r --cached src/ 2>/dev/null || true

# Adiciona todos os arquivos novamente
git add -f src/
git add -f public/

# Commit com mensagem clara
git commit -m "fix: force resend all files - remove translation artifacts"

# Push forçado
git push origin main --force

echo "=== Concluido ==="
