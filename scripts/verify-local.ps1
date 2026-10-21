[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$VenvScripts = Join-Path $RepoRoot ".venv\Scripts"
$VenvPython = Join-Path $VenvScripts "python.exe"
$Sam = Join-Path $VenvScripts "sam.exe"
$CfnLint = Join-Path $VenvScripts "cfn-lint.exe"
$BackendDir = Join-Path $RepoRoot "backend"
$FrontendDir = Join-Path $RepoRoot "frontend"

if (-not (Test-Path $VenvPython)) {
    throw "Python virtual environment not found. Create it with: python -m venv .venv"
}
if (-not (Test-Path $Sam)) {
    throw "SAM CLI not found in .venv. Install it with: .\.venv\Scripts\python -m pip install aws-sam-cli"
}
if (-not (Test-Path $CfnLint)) {
    throw "cfn-lint not found in .venv. Install it with: .\.venv\Scripts\python -m pip install cfn-lint"
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found on PATH. Install Node.js 20 or newer."
}

$env:PATH = "$VenvScripts;$env:PATH"
$PyvenvCfg = Join-Path $RepoRoot ".venv\pyvenv.cfg"
if (Test-Path $PyvenvCfg) {
    $homeLine = Get-Content $PyvenvCfg |
        Where-Object { $_ -match '^home\s*=' } |
        Select-Object -First 1
    if ($homeLine) {
        $PythonHome = ($homeLine -split '=', 2)[1].Trim()
        if (Test-Path $PythonHome) {
            $env:PATH = "$VenvScripts;$PythonHome;$env:PATH"
        }
    }
}

Write-Host "== Backend unit tests ==" -ForegroundColor Cyan
& $VenvPython -m unittest discover -s (Join-Path $BackendDir "tests") -p "test_*.py" -v
if ($LASTEXITCODE -ne 0) {
    throw "Backend tests failed."
}

Write-Host "== SAM validation ==" -ForegroundColor Cyan
& $Sam validate --template-file (Join-Path $BackendDir "template.yaml") --region us-east-1 --lint
if ($LASTEXITCODE -ne 0) {
    throw "SAM validation failed."
}

Write-Host "== SAM build (no Docker) ==" -ForegroundColor Cyan
Push-Location $BackendDir
try {
    & $Sam build --template-file template.yaml
    if ($LASTEXITCODE -ne 0) {
        throw "SAM build failed."
    }
}
finally {
    Pop-Location
}

Write-Host "== CloudFormation lint ==" -ForegroundColor Cyan
& $CfnLint (Join-Path $BackendDir "template.yaml") (Join-Path $RepoRoot "infra\frontend.yaml")
if ($LASTEXITCODE -ne 0) {
    throw "cfn-lint failed."
}

Write-Host "== Frontend build and lint ==" -ForegroundColor Cyan
Push-Location $FrontendDir
try {
    if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
        npm ci
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci failed."
        }
    }
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend build failed."
    }
    npm run lint
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend lint failed."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "All local checks passed." -ForegroundColor Green
Write-Host "Backend tests: OK, SAM build: OK, CloudFormation lint: OK, frontend build/lint: OK."
