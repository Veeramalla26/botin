# Interview Bot - Windows setup script
# Usage: .\setup.ps1

$ErrorActionPreference = "Stop"
$mysqlBin = "C:\Program Files\MySQL\MySQL Server 9.7\bin\mysql.exe"

Write-Host "`n=== Interview Bot Setup ===`n" -ForegroundColor Cyan

# MySQL password
if (-not $env:MYSQL_PASSWORD) {
    $secure = Read-Host "Enter MySQL root password" -AsSecureString
    $env:MYSQL_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    )
}

# OpenAI key
$envPath = Join-Path $PSScriptRoot "backend\.env"
$envContent = Get-Content $envPath -Raw

if ($envContent -match "OPENAI_API_KEY=\s*$" -or $envContent -match "OPENAI_API_KEY=your_openai") {
    $openaiKey = Read-Host "Enter your OpenAI API key"
    $envContent = $envContent -replace "OPENAI_API_KEY=.*", "OPENAI_API_KEY=$openaiKey"
}

if ($envContent -match "DB_PASSWORD=\s*$") {
    $envContent = $envContent -replace "DB_PASSWORD=.*", "DB_PASSWORD=$($env:MYSQL_PASSWORD)"
}

Set-Content -Path $envPath -Value $envContent -NoNewline
Write-Host "Updated backend\.env" -ForegroundColor Green

# Run database schema
if (-not (Test-Path $mysqlBin)) {
    Write-Host "MySQL not found at $mysqlBin" -ForegroundColor Red
    Write-Host "Install MySQL or update the path in setup.ps1"
    exit 1
}

Write-Host "Creating database and tables..."
$schema = Join-Path $PSScriptRoot "backend\schema.sql"
Get-Content $schema | & $mysqlBin -u root -p"$($env:MYSQL_PASSWORD)"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Database setup failed. Check your MySQL password." -ForegroundColor Red
    Write-Host "Don't know your password? Run: .\reset-mysql-password.ps1 (as Administrator)`n" -ForegroundColor Yellow
    exit 1
}

Write-Host "Database ready!" -ForegroundColor Green

# Install dependencies if needed
foreach ($dir in @("backend", "frontend")) {
    $full = Join-Path $PSScriptRoot $dir
    if (-not (Test-Path (Join-Path $full "node_modules"))) {
        Write-Host "Installing $dir dependencies..."
        Push-Location $full
        npm install
        Pop-Location
    }
}

Write-Host "`n=== Setup complete! ===" -ForegroundColor Cyan
Write-Host "Start the app with: .\start.ps1`n"
