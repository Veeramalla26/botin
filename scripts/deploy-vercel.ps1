# Deploy Interview Bot to Vercel (production)
# Prerequisites: run `npx vercel login` once, then run this script.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

function Read-DotEnv($path) {
    $vars = @{}
    if (-not (Test-Path $path)) { return $vars }
    Get-Content $path | ForEach-Object {
        if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
        if ($_ -match '^([^=]+)=(.*)$') {
            $vars[$matches[1].Trim()] = $matches[2].Trim()
        }
    }
    return $vars
}

Write-Host "Interview Bot — Vercel deploy" -ForegroundColor Cyan

$frontendEnv = Read-DotEnv "$root\frontend\.env"
$backendEnv = Read-DotEnv "$root\backend\.env"

$envVars = @{
    OPENAI_API_KEY = $backendEnv.OPENAI_API_KEY
    OPENAI_MODEL = if ($backendEnv.OPENAI_MODEL) { $backendEnv.OPENAI_MODEL } else { "gpt-4o-mini" }
    VITE_FIREBASE_API_KEY = $frontendEnv.VITE_FIREBASE_API_KEY
    VITE_FIREBASE_AUTH_DOMAIN = $frontendEnv.VITE_FIREBASE_AUTH_DOMAIN
    VITE_FIREBASE_PROJECT_ID = $frontendEnv.VITE_FIREBASE_PROJECT_ID
    VITE_FIREBASE_STORAGE_BUCKET = $frontendEnv.VITE_FIREBASE_STORAGE_BUCKET
    VITE_FIREBASE_MESSAGING_SENDER_ID = $frontendEnv.VITE_FIREBASE_MESSAGING_SENDER_ID
    VITE_FIREBASE_APP_ID = $frontendEnv.VITE_FIREBASE_APP_ID
}

$missing = @($envVars.GetEnumerator() | Where-Object { -not $_.Value } | ForEach-Object { $_.Key })
if ($missing.Count -gt 0) {
    Write-Host "Missing env values: $($missing -join ', ')" -ForegroundColor Red
    Write-Host "Fill frontend/.env and backend/.env (OpenAI key) then retry."
    exit 1
}

Write-Host "Checking Vercel login..." -ForegroundColor Yellow
npx vercel whoami 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in. Run: npx vercel login" -ForegroundColor Red
    exit 1
}

Write-Host "Linking project (if needed)..." -ForegroundColor Yellow
npx vercel link --yes 2>$null

function Set-VercelEnv($name, $value, $target) {
    $existing = npx vercel env ls $target 2>$null | Select-String -Pattern "^\s*$name\s"
    if ($existing) {
        Write-Host "  $name ($target) — already set, skipping"
        return
    }
    Write-Host "  $name ($target) — adding"
    $value | npx vercel env add $name $target --force 2>$null
}

foreach ($target in @("production", "preview", "development")) {
    Write-Host "Setting env vars for $target..." -ForegroundColor Yellow
    foreach ($entry in $envVars.GetEnumerator()) {
        Set-VercelEnv $entry.Key $entry.Value $target
    }
}

Write-Host "Deploying to production..." -ForegroundColor Green
npx vercel deploy --prod --yes

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Done! Add your Vercel URL to Firebase:" -ForegroundColor Green
    Write-Host "  Firebase Console -> Authentication -> Settings -> Authorized domains"
    Write-Host "  Add: your-app.vercel.app"
}
