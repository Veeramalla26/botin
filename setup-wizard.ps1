# One-time setup wizard - configures Firebase + OpenAI for Interview Bot
# Usage: Right-click setup-wizard.bat -> Run, OR: powershell -ExecutionPolicy Bypass -File .\setup-wizard.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Interview Bot - Setup Wizard" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "IMPORTANT: Do NOT share your Google/Firebase login password here." -ForegroundColor Yellow
Write-Host "You only need to complete Step 1 in your browser (5 minutes)." -ForegroundColor Yellow
Write-Host ""

# Step 1 - Open Firebase
Write-Host "STEP 1: Create Firebase project in browser" -ForegroundColor Green
Write-Host "  Opening Firebase Console..."
Start-Process "https://console.firebase.google.com/"
Start-Sleep -Seconds 2
Start-Process "https://console.firebase.google.com/project/_/authentication/providers"
Start-Sleep -Seconds 1
Start-Process "https://console.firebase.google.com/project/_/firestore"

Write-Host ""
Write-Host "  In the browser tabs that opened:" -ForegroundColor White
Write-Host "  1. Create a new project (name it: interview-bot)" -ForegroundColor White
Write-Host "  2. Authentication -> Sign-in method -> Enable EMAIL/PASSWORD" -ForegroundColor White
Write-Host "  3. Firestore Database -> Create database -> Start in TEST mode" -ForegroundColor White
Write-Host "  4. Project Settings (gear icon) -> Your apps -> Add WEB app" -ForegroundColor White
Write-Host "  5. Copy the firebaseConfig values shown" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter when you have created the web app and see the config"

# Step 2 - Collect Firebase config
Write-Host ""
Write-Host "STEP 2: Paste your Firebase config values" -ForegroundColor Green
Write-Host "(From Project Settings -> Your apps -> SDK setup and configuration)" -ForegroundColor Gray
Write-Host ""

$apiKey = Read-Host "apiKey"
$authDomain = Read-Host "authDomain"
$projectId = Read-Host "projectId"
$storageBucket = Read-Host "storageBucket"
$messagingSenderId = Read-Host "messagingSenderId"
$appId = Read-Host "appId"

if (-not $apiKey -or -not $projectId -or -not $appId) {
    Write-Host "Missing required Firebase values. Please run setup again." -ForegroundColor Red
    exit 1
}

# Step 3 - OpenAI key
Write-Host ""
Write-Host "STEP 3: OpenAI API key (server-side only)" -ForegroundColor Green
Write-Host "Get one at: https://platform.openai.com/api-keys" -ForegroundColor Gray
Start-Process "https://platform.openai.com/api-keys"
Write-Host ""
$openaiKey = Read-Host "Paste your OpenAI API key (starts with sk-)"

if (-not $openaiKey.StartsWith("sk-")) {
    Write-Host "Warning: OpenAI keys usually start with sk-" -ForegroundColor Yellow
}

# Write frontend .env
$frontendEnv = @"
VITE_FIREBASE_API_KEY=$apiKey
VITE_FIREBASE_AUTH_DOMAIN=$authDomain
VITE_FIREBASE_PROJECT_ID=$projectId
VITE_FIREBASE_STORAGE_BUCKET=$storageBucket
VITE_FIREBASE_MESSAGING_SENDER_ID=$messagingSenderId
VITE_FIREBASE_APP_ID=$appId
"@

$frontendEnvPath = Join-Path $root "frontend\.env"
Set-Content -Path $frontendEnvPath -Value $frontendEnv.TrimEnd()
Write-Host "Created frontend\.env" -ForegroundColor Green

# Write root .env
$rootEnv = @"
OPENAI_API_KEY=$openaiKey
OPENAI_MODEL=gpt-4o-mini
API_PORT=3001
"@

$rootEnvPath = Join-Path $root ".env"
Set-Content -Path $rootEnvPath -Value $rootEnv.TrimEnd()
Write-Host "Created .env" -ForegroundColor Green

# Step 4 - Firestore rules
Write-Host ""
Write-Host "STEP 4: Publish Firestore security rules" -ForegroundColor Green
Start-Process "https://console.firebase.google.com/project/$projectId/firestore/rules"

Write-Host "  In the browser:" -ForegroundColor White
Write-Host "  1. Delete the existing rules" -ForegroundColor White
Write-Host "  2. Paste the rules below:" -ForegroundColor White
Write-Host ""

$rules = Get-Content (Join-Path $root "firestore.rules") -Raw
Write-Host $rules -ForegroundColor DarkGray
Write-Host ""
Write-Host "  3. Click PUBLISH" -ForegroundColor White
Read-Host "Press Enter after publishing the rules"

# Install deps if needed
Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Cyan
Set-Location $root
if (-not (Test-Path "node_modules")) { npm install }
if (-not (Test-Path "frontend\node_modules")) { npm install --prefix frontend }

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Setup complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Starting the app..." -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "  Sign UP with any email/password in the app" -ForegroundColor White
Write-Host ""

npm run dev
