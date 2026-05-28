#!/bin/bash
# Execute: bash INSTALAR.sh

echo "=== Corrigindo arquivos no GitHub ==="

git merge --abort 2>/dev/null || true
git rebase --abort 2>/dev/null || true

# Limpa o cache do git
git rm -r --cached . --quiet 2>/dev/null || true

# Corrige o arquivo se necessario
AGENDA="src/app/dashboard/agenda/page.tsx"
if grep -q "retornar" "$AGENDA"; then
    echo "Corrigindo 'retornar' -> 'return'..."
    sed -i 's/retornar (/return (/g' "$AGENDA"
fi

git add --all
git commit -m "fix: force correct files - bypass translation"
git push origin main --force

echo "=== Concluido ==="
