# Reset MySQL root password on Windows (MySQL Server 9.7)
# Run as Administrator: Right-click reset-mysql-password.bat -> Run as administrator

$ErrorActionPreference = "Stop"

$mysqlDir = "C:\Program Files\MySQL\MySQL Server 9.7"
$mysqlBin = Join-Path $mysqlDir "bin\mysql.exe"
$mysqldBin = Join-Path $mysqlDir "bin\mysqld.exe"
$myIni = "C:\ProgramData\MySQL\MySQL Server 9.7\my.ini"
$serviceName = "MySQL97"
$initFile = Join-Path $env:TEMP "mysql-init.txt"

function Reset-MySqlWithSkipGrant {
    param([string]$NewPassword, [string]$SqlPassword)

    Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
    Get-Process mysqld -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3

    $skipCmd = "`"$mysqldBin`" --defaults-file=`"$myIni`" --skip-grant-tables --console"
    $skipProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $skipCmd -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 8

    & $mysqlBin -u root -e "FLUSH PRIVILEGES; ALTER USER 'root'@'localhost' IDENTIFIED BY '$SqlPassword'; FLUSH PRIVILEGES;"

    if ($skipProc -and -not $skipProc.HasExited) {
        Stop-Process -Id $skipProc.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2

    Start-Service -Name $serviceName
    Start-Sleep -Seconds 5

    & $mysqlBin -u root "-p$NewPassword" -e "SELECT 1;"
}

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "`nThis script must run as Administrator." -ForegroundColor Red
    Write-Host "Right-click reset-mysql-password.bat -> Run as administrator`n"
    exit 1
}

if (-not (Test-Path $myIni)) {
    Write-Host "MySQL config not found at: $myIni" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Reset MySQL Root Password ===`n" -ForegroundColor Cyan

$newPassword = Read-Host "Enter a NEW MySQL root password"
$confirm = Read-Host "Confirm password"

if ($newPassword -ne $confirm) {
    Write-Host "Passwords do not match." -ForegroundColor Red
    exit 1
}

if ($newPassword.Length -lt 4) {
    Write-Host "Password must be at least 4 characters." -ForegroundColor Red
    exit 1
}

$sqlPassword = $newPassword -replace "'", "''"

Write-Host "`nStopping MySQL service..."
Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 4

Get-Process mysqld -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

@"
ALTER USER 'root'@'localhost' IDENTIFIED BY '$sqlPassword';
FLUSH PRIVILEGES;
"@ | Set-Content -Path $initFile -Encoding ASCII

Write-Host "Resetting password (please wait ~15 seconds)..."

$cmd = "`"$mysqldBin`" --defaults-file=`"$myIni`" --init-file=`"$initFile`" --console"
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $cmd -PassThru -WindowStyle Hidden

$waited = 0
while (-not $proc.HasExited -and $waited -lt 20) {
    Start-Sleep -Seconds 1
    $waited++
}

if (-not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 2
Remove-Item $initFile -Force -ErrorAction SilentlyContinue

Write-Host "Starting MySQL service..."
Start-Service -Name $serviceName
Start-Sleep -Seconds 5

Write-Host "Testing connection..."
& $mysqlBin -u root "-p$newPassword" -e "SELECT 'Password reset successful!' AS status;"

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nTrying alternate reset method..." -ForegroundColor Yellow
    Reset-MySqlWithSkipGrant -NewPassword $newPassword -SqlPassword $sqlPassword
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nPassword reset failed." -ForegroundColor Red
    exit 1
}

$envPath = Join-Path $PSScriptRoot "backend\.env"
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    $envContent = $envContent -replace "DB_PASSWORD=.*", "DB_PASSWORD=$newPassword"
    Set-Content -Path $envPath -Value $envContent -NoNewline
    Write-Host "Updated backend\.env with new password." -ForegroundColor Green
}

Write-Host "`n=== Done! ===" -ForegroundColor Green
Write-Host "Next step: double-click setup.bat (enter your OpenAI API key)`n"
