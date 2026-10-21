<#
.SYNOPSIS
Creates a monthly AWS Budget with email alerts.

.DESCRIPTION
Optional. This is only useful on the Paid plan. The default LectureLens setup
runs on the AWS Free plan, which cannot incur charges; use check-credits.ps1
to monitor the credit balance instead.
#>
[CmdletBinding()]
param(
    [string]$Email = "",
    [decimal]$Amount = 5,
    [string]$BudgetName = "lecturelens-monthly",
    [string]$AwsProfile = ""
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
if ($Amount -le 0) {
    throw "Amount must be greater than zero."
}
if (-not $Email) {
    $Email = Read-Host "Budget alert email"
}
if ($Email -notmatch "^[^@\s]+@[^@\s]+\.[^@\s]+$") {
    throw "Enter a valid email address."
}

$profileArgs = @()
if ($AwsProfile) {
    $profileArgs = @("--profile", $AwsProfile)
}

Write-Host "Reading AWS account..." -ForegroundColor Cyan
$AccountId = aws sts get-caller-identity --query "Account" --output text @profileArgs
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($AccountId)) {
    throw "AWS credentials are not configured. Run 'aws configure' (or 'aws sso login') first."
}
$AccountId = $AccountId.Trim()

$budgetTemplate = Get-Content (Join-Path $RepoRoot "budget.json") -Raw | ConvertFrom-Json
$budgetTemplate.BudgetName = $BudgetName
$budgetTemplate.BudgetLimit.Amount = "$Amount"
$budgetFile = Join-Path $env:TEMP "lecturelens-budget.json"
$notificationsFile = Join-Path $env:TEMP "lecturelens-budget-notifications.json"

$notifications = @(
    @{
        Notification = @{
            NotificationType = "ACTUAL"
            ComparisonOperator = "GREATER_THAN"
            Threshold = 80
            ThresholdType = "PERCENTAGE"
            NotificationState = "ALARM"
        }
        Subscribers = @(
            @{
                SubscriptionType = "EMAIL"
                Address = $Email
            }
        )
    },
    @{
        Notification = @{
            NotificationType = "FORECASTED"
            ComparisonOperator = "GREATER_THAN"
            Threshold = 100
            ThresholdType = "PERCENTAGE"
            NotificationState = "ALARM"
        }
        Subscribers = @(
            @{
                SubscriptionType = "EMAIL"
                Address = $Email
            }
        )
    }
)

try {
    $budgetTemplate | ConvertTo-Json -Depth 10 | Set-Content -Path $budgetFile -Encoding ascii
    $notifications | ConvertTo-Json -Depth 10 | Set-Content -Path $notificationsFile -Encoding ascii

    Write-Host "Creating budget '$BudgetName' for `$$Amount/month..." -ForegroundColor Cyan
    aws budgets create-budget `
        --account-id $AccountId `
        --budget "file://$budgetFile" `
        --notifications-with-subscribers "file://$notificationsFile" `
        @profileArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Could not create the budget. If it already exists, update it in the AWS Billing console."
    }
}
finally {
    Remove-Item -Force $budgetFile, $notificationsFile -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Budget created:" -ForegroundColor Green
Write-Host "  Name:    $BudgetName"
Write-Host "  Limit:   `$$Amount per month"
Write-Host "  Alerts:  80% actual and 100% forecasted"
Write-Host "  Email:   $Email"
Write-Host "Check your inbox for a subscription confirmation."
