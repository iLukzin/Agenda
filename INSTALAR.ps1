# Execute este script no PowerShell dentro da pasta do projeto
# Clique direito na pasta -> "Abrir no Terminal" ou "Abrir PowerShell aqui"

Write-Host "=== Corrigindo arquivos no GitHub ===" -ForegroundColor Cyan

# Para o processo do Git se estiver em conflito
git merge --abort 2>$null
git rebase --abort 2>$null
git cherry-pick --abort 2>$null

# Remove TUDO do indice do Git (nao apaga os arquivos locais)
git rm -r --cached . --quiet

# Copia os arquivos do ZIP para substituir tudo
# (voce ja deveria ter extraido o ZIP nesta pasta)

# Adiciona tudo novamente
git add --all

# Verifica se o arquivo da agenda esta correto
$agendaFile = "src\app\dashboard\agenda\page.tsx"
$content = Get-Content $agendaFile -Raw
if ($content -match "retornar") {
    Write-Host "ERRO: arquivo ainda tem 'retornar' - corrigindo..." -ForegroundColor Red
    $content = $content -replace "retornar \(", "return ("
    Set-Content $agendaFile $content -Encoding UTF8
    git add $agendaFile
}

if ($content -match "return \(") {
    Write-Host "OK: arquivo da agenda correto" -ForegroundColor Green
} else {
    Write-Host "AVISO: verificar arquivo da agenda" -ForegroundColor Yellow
}

# Commit e push forcado
git commit -m "fix: force correct files - bypass translation"
git push origin main --force

Write-Host "=== Concluido! Aguarde o deploy na Vercel ===" -ForegroundColor Green
