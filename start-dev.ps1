# Legal AI - Development Startup Script
# Run: .\start-dev.ps1

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Legal AI - Development Server" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Step 1: Cleanup
Write-Host "[1/6] Cleaning up old containers..." -ForegroundColor Yellow
docker-compose down 2>$null
docker stop legal-ai-redis, legal-ai-db 2>$null
docker rm legal-ai-redis, legal-ai-db 2>$null
Write-Host "      Done!" -ForegroundColor Green
Write-Host ""

# Step 2: Start Docker services
Write-Host "[2/6] Starting database and Redis..." -ForegroundColor Yellow
docker-compose up -d db redis
Write-Host "      Done!" -ForegroundColor Green
Write-Host ""

# Step 3: Wait for database
Write-Host "[3/6] Waiting for database to be ready..." -ForegroundColor Yellow
$ready = $false
$attempts = 0
while (-not $ready -and $attempts -lt 30) {
    Start-Sleep -Milliseconds 500
    $result = docker exec legal-ai-db pg_isready -U postgres 2>$null
    if ($LASTEXITCODE -eq 0) {
        $ready = $true
    } else {
        Write-Host "      Waiting for PostgreSQL... (attempt $attempts)" -ForegroundColor Gray
    }
    $attempts++
}
Write-Host "      Database is ready!" -ForegroundColor Green
Write-Host ""

# Step 4: Prisma setup
Write-Host "[4/6] Setting up Prisma..." -ForegroundColor Yellow
npx prisma generate
npx prisma db push --accept-data-loss
Write-Host "      Done!" -ForegroundColor Green
Write-Host ""

# Step 5: Start Python worker
Write-Host "[5/6] Starting Python Document Processor..." -ForegroundColor Yellow
$workerJob = Start-Job -ScriptBlock {
    param($path)
    Set-Location "$path\workers"
    & "..\venv\Scripts\python.exe" document_processor.py
} -ArgumentList $scriptPath
Write-Host "      Worker started in background!" -ForegroundColor Green
Write-Host ""

# Step 6: Display info and start Next.js
Write-Host "[6/6] Starting Next.js Development Server..." -ForegroundColor Yellow
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   All services are starting!" -ForegroundColor Cyan
Write-Host ""
Write-Host "   - Database:      localhost:5432" -ForegroundColor White
Write-Host "   - Redis:         localhost:6379" -ForegroundColor White
Write-Host "   - Next.js:       http://localhost:3000" -ForegroundColor White
Write-Host "   - Python Worker: Running in background" -ForegroundColor White
Write-Host ""
Write-Host "   Press Ctrl+C to stop everything" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

try {
    npm run dev
} finally {
    Write-Host ""
    Write-Host "Shutting down..." -ForegroundColor Yellow
    docker-compose down 2>$null
    Stop-Job $workerJob 2>$null
    Remove-Job $workerJob 2>$null
    Write-Host "Cleanup complete!" -ForegroundColor Green
}
