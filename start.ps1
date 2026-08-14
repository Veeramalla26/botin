$root = $PSScriptRoot

Write-Host "Starting Interview Bot (Firebase + Vercel stack)..." -ForegroundColor Cyan
Write-Host "Make sure backend\.env and frontend\.env are configured first.`n"

Set-Location $root
npm run dev
