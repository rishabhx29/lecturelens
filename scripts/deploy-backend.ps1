[CmdletBinding()]
param(
    [string]$StackName = "lecturelens",
    [string]$Region = "us-east-1",
    [string]$ModelId = "amazon.nova-pro-v1:0",
    [string]$EmbeddingModelId = "amazon.titan-embed-text-v2:0",
    [string]$BedrockRegion = "us-east-1",
    [ValidateSet("local", "auto", "bedrock")]
    [string]$AiMode = "local",
    [string]$AwsProfile = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $RepoRoot "backend"
$VenvScripts = Join-Path $RepoRoot ".venv\Scripts"
if (Test-Path $VenvScripts) {
    $env:PATH = "$VenvScripts;$env:PATH"

    # SAM's Python builder needs the runtime interpreter on PATH. The venv
    # provides python.exe; adding its base interpreter also covers python3
    # lookups on machines where the Windows Store alias shadows it.
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
}

if (-not (Get-Command sam -ErrorAction SilentlyContinue)) {
    throw "AWS SAM CLI was not found on PATH. Install it, then reopen PowerShell."
}
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    throw "AWS CLI was not found on PATH. Install it, then reopen PowerShell."
}

$profileArgs = @()
if ($AwsProfile) {
    $profileArgs = @("--profile", $AwsProfile)
}

Write-Host "Checking AWS identity..." -ForegroundColor Cyan
aws sts get-caller-identity @profileArgs | Out-Host
if ($LASTEXITCODE -ne 0) {
    throw "AWS credentials are not configured. Run 'aws configure' (or 'aws sso login') first."
}

Write-Host "Building backend with SAM..." -ForegroundColor Cyan
Push-Location $BackendDir
try {
    sam build
    if ($LASTEXITCODE -ne 0) {
        throw "sam build failed."
    }

    $parameterOverrides = @(
        "Frontend=local",
        "Repository=https://github.com/aws-samples/serverless-pdf-chat",
        "ModelId=$ModelId",
        "EmbeddingModelId=$EmbeddingModelId",
        "BedrockRegion=$BedrockRegion",
        "AiMode=$AiMode"
    )

    Write-Host "Deploying backend stack '$StackName' to $Region..." -ForegroundColor Cyan
    sam deploy `
        --stack-name $StackName `
        --region $Region `
        --capabilities CAPABILITY_IAM `
        --resolve-s3 `
        --no-confirm-changeset `
        --no-fail-on-empty-changeset `
        --parameter-overrides @parameterOverrides `
        @profileArgs
    if ($LASTEXITCODE -ne 0) {
        throw "sam deploy failed."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Backend deployed. Stack outputs:" -ForegroundColor Green
aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    @profileArgs `
    --query "Stacks[0].Outputs" `
    --output table | Out-Host

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
if ($AiMode -eq "local") {
    Write-Host "  1. Local AI mode is active: no Bedrock model access is needed and no Bedrock calls are made."
}
else {
    Write-Host "  1. Enable Bedrock model access for '$ModelId' and '$EmbeddingModelId' in $BedrockRegion."
}
Write-Host "  2. Create a login user: .\scripts\create-demo-user.ps1 -BackendStackName $StackName -Region $Region -Email you@example.com"
Write-Host "  3. Deploy the frontend: .\scripts\deploy-frontend.ps1 -BackendStackName $StackName -Region $Region"
