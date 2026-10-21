[CmdletBinding()]
param(
    [string]$BackendStackName = "lecturelens",
    [string]$Region = "us-east-1",
    [string]$AwsProfile = "",
    [string]$Email = "",
    [string]$Password = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$VenvScripts = Join-Path $RepoRoot ".venv\Scripts"
if (Test-Path $VenvScripts) {
    $env:PATH = "$VenvScripts;$env:PATH"
}

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    throw "AWS CLI was not found on PATH. Install it, then reopen PowerShell."
}

$profileArgs = @()
if ($AwsProfile) {
    $profileArgs = @("--profile", $AwsProfile)
}

if (-not $Email) {
    $Email = Read-Host "Demo user email"
}
if (-not $Password) {
    $secure = Read-Host "Demo user password (min 8 chars, upper/lower/number/symbol)" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $Password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

$UserPoolId = aws cloudformation describe-stacks `
    --stack-name $BackendStackName `
    --region $Region `
    @profileArgs `
    --query "Stacks[0].Outputs[?OutputKey=='CognitoUserPool'].OutputValue" `
    --output text
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($UserPoolId) -or $UserPoolId -eq "None") {
    throw "Could not find CognitoUserPool output on stack '$BackendStackName'."
}
$UserPoolId = $UserPoolId.Trim()

Write-Host "Creating Cognito user '$Email'..." -ForegroundColor Cyan
aws cognito-idp admin-create-user `
    --user-pool-id $UserPoolId `
    --username $Email `
    --user-attributes "Name=email,Value=$Email" "Name=email_verified,Value=true" `
    --message-action SUPPRESS `
    --region $Region `
    @profileArgs
if ($LASTEXITCODE -ne 0) {
    throw "Could not create the user. It may already exist. If so, set its password in the Cognito console or use admin-set-user-password."
}

Write-Host "Setting a permanent password..." -ForegroundColor Cyan
aws cognito-idp admin-set-user-password `
    --user-pool-id $UserPoolId `
    --username $Email `
    --password $Password `
    --permanent `
    --region $Region `
    @profileArgs
if ($LASTEXITCODE -ne 0) {
    throw "Could not set the user's password."
}

Write-Host ""
Write-Host "Demo user ready:" -ForegroundColor Green
Write-Host "  Email:    $Email"
Write-Host "  Password: (the value you entered)"
Write-Host "  User pool: $UserPoolId"
