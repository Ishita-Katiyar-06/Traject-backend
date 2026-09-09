# ==============================================================================
# TRAJECT: Full-Stack Developer Launcher (Backend + Frontend + Telegram Bot)
# ==============================================================================

$Host.UI.RawUI.WindowTitle = "TRAJECT Full-Stack Launcher"

Write-Host @"
========================================================================
  ______ _____            _ ______ _____ _______ 
 |__   _|  __ \   /\     | |  ____/ ____|__   __|
    | | | |__) | /  \    | | |__ | |       | |   
    | | |  _  / / /\ \   | |  __|| |       | |   
    | | | | \ \/ ____ \ _| | |___| |____   | |   
    |_| |_|  \/_/    \_\___/______\_____|  |_|   
                                                 
  Social Intelligence, Narrative Tracking & Trend Forecasting Platform
========================================================================
"@ -ForegroundColor Cyan

$Current = $PSScriptRoot
while ($Current -and -not (Test-Path (Join-Path $Current ".git") -PathType Container) -and -not (Test-Path (Join-Path $Current ".env"))) {
    $Parent = Split-Path -Parent $Current
    if ($Parent -eq $Current) { break }
    $Current = $Parent
}
$RepoRoot = $Current
Set-Location $RepoRoot

# 1. Start Backend FastAPI Server
Write-Host "[1/3] Launching FastAPI Backend Server on http://127.0.0.1:8000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
`$Host.UI.RawUI.WindowTitle = 'TRAJECT Backend API';
Set-Location '$RepoRoot\backend';
if (Test-Path '.\.venv\Scripts\Activate.ps1') { .\.venv\Scripts\Activate.ps1 }
Write-Host 'Starting Uvicorn API Server...' -ForegroundColor Cyan;
uvicorn app.main:create_app --reload --host 127.0.0.1 --port 8000
"@

# 2. Start Frontend Vite Server
Write-Host "[2/3] Launching React Vite Frontend on http://localhost:3000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
`$Host.UI.RawUI.WindowTitle = 'TRAJECT Frontend UI';
Set-Location '$RepoRoot\frontend';
Write-Host 'Starting Vite Dev Server...' -ForegroundColor Cyan;
npm run dev
"@

# 3. Check and Start Telegram Bot
$EnvFile = Join-Path $RepoRoot ".env"
$HasBotToken = $false

if (Test-Path $EnvFile) {
    $EnvContent = Get-Content $EnvFile -Raw
    if ($EnvContent -match "TELEGRAM_BOT_TOKEN=([0-9]+:[A-Za-z0-9_-]+)") {
        $HasBotToken = $true
    }
}

if ($HasBotToken) {
    Write-Host "[3/3] Launching Telegram Bot Service..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
`$Host.UI.RawUI.WindowTitle = 'TRAJECT Telegram Bot';
Set-Location '$RepoRoot\backend';
if (Test-Path '.\.venv\Scripts\Activate.ps1') { .\.venv\Scripts\Activate.ps1 }
Write-Host 'Starting Telegram Bot Worker...' -ForegroundColor Cyan;
python -m app.bot.main
"@
} else {
    Write-Host "[3/3] Telegram Bot Token not set in .env." -ForegroundColor Yellow
    Write-Host "      To enable the Telegram Bot:" -ForegroundColor DarkYellow
    Write-Host "      1. Obtain a bot token from https://t.me/BotFather" -ForegroundColor DarkYellow
    Write-Host "      2. Add TELEGRAM_BOT_TOKEN=<your_token> in your root .env" -ForegroundColor DarkYellow
    Write-Host "      3. Run: python -m app.bot.main inside backend directory" -ForegroundColor DarkYellow
}

Write-Host @"

========================================================================
  TRAJECT Services Initialized:
  • Web Dashboard:     http://localhost:3000
  • Interactive Docs:  http://127.0.0.1:8000/docs
  • Live WebSocket:    ws://127.0.0.1:8000/api/v1/ws/live
========================================================================
"@ -ForegroundColor Cyan
