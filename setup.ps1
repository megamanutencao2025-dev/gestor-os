# MaintenancePro - setup local para Windows

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$VenvPython = Join-Path $Root ".venv\Scripts\python.exe"

function Step($Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Success($Message) {
    Write-Host "    [OK] $Message" -ForegroundColor Green
}

Set-Location $Root

Step "Verificando pre-requisitos"
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Python 3.12+ nao encontrado no PATH."
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js 20+ nao encontrado no PATH."
}
if (-not (Test-Path "backend\manage.py")) {
    throw "Execute este script na raiz do projeto."
}
Success "Python e Node.js encontrados"

Step "Preparando ambiente virtual Python"
if (-not (Test-Path $VenvPython)) {
    & python -m venv ".venv"
}
& $VenvPython -m pip install --upgrade pip
& $VenvPython -m pip install -r "backend\requirements\development.txt"
Success "Dependencias do backend instaladas"

Step "Configurando banco Django"
& $VenvPython "backend\manage.py" migrate
& $VenvPython "backend\manage.py" check
Success "Migrations aplicadas"

$AdminExistsOutput = & $VenvPython "backend\manage.py" shell -c `
    "from django.contrib.auth import get_user_model; print(get_user_model().objects.filter(role='admin').exists())"
$AdminExists = ($AdminExistsOutput | Select-Object -Last 1).Trim() -eq "True"

if (-not $AdminExists) {
    Step "Criando administrador local"
    $SecurePassword = Read-Host "Senha inicial do usuario admin" -AsSecureString
    $Credential = New-Object System.Management.Automation.PSCredential("admin", $SecurePassword)
    $env:DJANGO_ADMIN_PASSWORD = $Credential.GetNetworkCredential().Password
    try {
        & $VenvPython "backend\manage.py" bootstrap_admin
    } finally {
        Remove-Item Env:DJANGO_ADMIN_PASSWORD -ErrorAction SilentlyContinue
    }
    Success "Administrador criado"
} else {
    Success "Administrador ja configurado"
}

Step "Preparando frontend"
& npm install
& npm run deploy:check
Success "Frontend validado e compilado"

Step "Executando testes do backend"
Push-Location "backend"
try {
    & $VenvPython -m coverage erase
    & $VenvPython -m coverage run -m pytest
    & $VenvPython -m coverage report
} finally {
    Pop-Location
}
Success "Backend validado"

Write-Host ""
Write-Host "Setup concluido." -ForegroundColor Green
Write-Host "Backend:  .\.venv\Scripts\python.exe backend\manage.py runserver 127.0.0.1:8000"
Write-Host "Frontend: npm run dev"
Write-Host "Acesso:   http://127.0.0.1:5173"

