<#
.SYNOPSIS
Shows the AWS Free plan status and remaining credits.

.DESCRIPTION
Use this instead of a paid budget alert. The Free plan has no service charges;
S3, API Gateway, and other credit-eligible usage draw from the $100 sign-up
credit. Bedrock is not included in the Free plan; LectureLens defaults to
AiMode=local. The account closes when the credits or the six-month term end.

.PARAMETER AwsProfile
Optional named AWS profile.

.PARAMETER Region
Region used for the Free Tier API call. Defaults to us-east-1.
#>
[CmdletBinding()]
param(
    [string]$AwsProfile,
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot

# Prefer AWS CLI v2 because it has the freetier commands and can read `aws login`
# credentials. Fall back to the repo virtual environment or PATH.
$AwsV2 = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"
if (Test-Path $AwsV2) {
    $Aws = $AwsV2
}
else {
    $env:PATH = (Join-Path $RepoRoot ".venv\Scripts") + ";" + $env:PATH
    $Aws = "aws"
}

$profileArgs = @()
if ($AwsProfile) {
    $profileArgs = @("--profile", $AwsProfile)
}

Write-Host "Reading Free plan state..." -ForegroundColor Cyan
$state = & $Aws freetier get-account-plan-state --region $Region @profileArgs --output json | ConvertFrom-Json

$credits = [math]::Round([double]$state.accountPlanRemainingCredits.amount, 2)
Write-Host ""
Write-Host "Account:  $($state.accountId)"
Write-Host "Plan:     $($state.accountPlanType) ($($state.accountPlanStatus))"
Write-Host "Credits:  `$$credits $($state.accountPlanRemainingCredits.unit) remaining"
Write-Host "Expires:  $($state.accountPlanExpirationDate)"
Write-Host ""

if ($state.accountPlanStatus -ne "ACTIVE") {
    Write-Warning "The Free plan is not active yet. Finish AWS account registration/verification before deploying."
    Write-Host "India accounts: add and verify UPI AutoPay or a card in Billing -> Payment preferences." -ForegroundColor Yellow
    Write-Host "This is identity verification, not a paid upgrade. Do not click Upgrade plan." -ForegroundColor Yellow
}
else {
    Write-Host "Free plan is active. Local AI mode makes no Bedrock calls; other eligible usage draws from these credits, with no out-of-pocket charges." -ForegroundColor Green
}
