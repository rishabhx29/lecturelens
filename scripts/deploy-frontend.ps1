[CmdletBinding()]
param(
    [string]$BackendStackName = "lecturelens",
    [string]$FrontendStackName = "lecturelens-frontend",
    [string]$BucketPrefix = "lecturelens",
    [string]$Region = "us-east-1",
    [string]$AwsProfile = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$FrontendDir = Join-Path $RepoRoot "frontend"
$TemplateFile = Join-Path $RepoRoot "infra\frontend.yaml"
$VenvScripts = Join-Path $RepoRoot ".venv\Scripts"
if (Test-Path $VenvScripts) {
    $env:PATH = "$VenvScripts;$env:PATH"
}

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    throw "AWS CLI was not found on PATH. Install it, then reopen PowerShell."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found on PATH. Install Node.js 20 or newer."
}

$profileArgs = @()
if ($AwsProfile) {
    $profileArgs = @("--profile", $AwsProfile)
}

function Get-StackOutput {
    param(
        [string]$StackName,
        [string]$OutputKey
    )
    $value = aws cloudformation describe-stacks `
        --stack-name $StackName `
        --region $Region `
        @profileArgs `
        --query "Stacks[0].Outputs[?OutputKey=='$OutputKey'].OutputValue" `
        --output text
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($value) -or $value -eq "None") {
        throw "Missing output '$OutputKey' on stack '$StackName'. Deploy the backend first."
    }
    return $value.Trim()
}

Write-Host "Reading backend outputs from '$BackendStackName'..." -ForegroundColor Cyan
$ApiEndpoint = Get-StackOutput -StackName $BackendStackName -OutputKey "ApiGatewayBaseUrl"
$UserPoolId = Get-StackOutput -StackName $BackendStackName -OutputKey "CognitoUserPool"
$UserPoolClientId = Get-StackOutput -StackName $BackendStackName -OutputKey "CognitoUserPoolClient"

Write-Host "Deploying frontend hosting stack '$FrontendStackName'..." -ForegroundColor Cyan
aws cloudformation deploy `
    --template-file $TemplateFile `
    --stack-name $FrontendStackName `
    --region $Region `
    --capabilities CAPABILITY_IAM `
    --no-fail-on-empty-changeset `
    --parameter-overrides "BucketPrefix=$BucketPrefix" `
    @profileArgs
if ($LASTEXITCODE -ne 0) {
    throw "Frontend hosting stack deployment failed."
}

$BucketName = Get-StackOutput -StackName $FrontendStackName -OutputKey "FrontendBucketName"
$FrontendUrl = Get-StackOutput -StackName $FrontendStackName -OutputKey "FrontendUrl"

Write-Host "Writing frontend environment file..." -ForegroundColor Cyan
$envContent = @"
VITE_REGION=$Region
VITE_API_REGION=$Region
VITE_API_ENDPOINT=$ApiEndpoint
VITE_USER_POOL_ID=$UserPoolId
VITE_USER_POOL_CLIENT_ID=$UserPoolClientId
"@
$envFile = Join-Path $FrontendDir ".env.production"
Set-Content -Path $envFile -Value $envContent -Encoding ascii

Write-Host "Installing frontend dependencies and building..." -ForegroundColor Cyan
Push-Location $FrontendDir
try {
    npm ci
    if ($LASTEXITCODE -ne 0) {
        throw "npm ci failed."
    }
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "npm run build failed."
    }
}
finally {
    Pop-Location
}

$DistDir = Join-Path $FrontendDir "dist"
if (-not (Test-Path $DistDir)) {
    throw "Frontend build output was not found at $DistDir."
}

Write-Host "Uploading frontend to s3://$BucketName..." -ForegroundColor Cyan
aws s3 sync $DistDir "s3://$BucketName" --delete --region $Region --exclude "index.html" --cache-control "public,max-age=31536000,immutable" @profileArgs
if ($LASTEXITCODE -ne 0) {
    throw "S3 sync failed."
}
aws s3 cp (Join-Path $DistDir "index.html") "s3://$BucketName/index.html" --region $Region --cache-control "no-cache" @profileArgs
if ($LASTEXITCODE -ne 0) {
    throw "S3 upload of index.html failed."
}

Write-Host ""
Write-Host "LectureLens is deployed:" -ForegroundColor Green
Write-Host "  $FrontendUrl" -ForegroundColor Green
