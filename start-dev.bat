@echo off
echo ==========================================
echo    Legal AI - Development Server
echo ==========================================
echo.

:: Change to script directory
cd /d "%~dp0"

echo [1/6] Cleaning up old containers...
docker-compose down 2>nul
docker stop legal-ai-redis legal-ai-db 2>nul
docker rm legal-ai-redis legal-ai-db 2>nul
echo      Done!
echo.

echo [2/6] Starting database and Redis...
docker-compose up -d db redis
echo      Done!
echo.

echo [3/6] Waiting for database to be ready...
timeout /t 5 /nobreak >nul
:check_db
docker exec legal-ai-db pg_isready -U postgres >nul 2>&1
if errorlevel 1 (
    echo      Waiting for PostgreSQL...
    timeout /t 2 /nobreak >nul
    goto check_db
)
echo      Database is ready!
echo.

echo [4/6] Setting up Prisma...
call npx prisma generate
call npx prisma db push --accept-data-loss
echo      Done!
echo.

echo [5/6] Starting Python Document Processor...
start "Python Worker" cmd /k "cd /d "%~dp0workers" && python document_processor.py"
echo      Worker started in new window!
echo.

echo [6/6] Starting Next.js Development Server...
echo.
echo ==========================================
echo    All services are starting!
echo.
echo    - Database:     localhost:5432
echo    - Redis:        localhost:6379
echo    - Next.js:      http://localhost:3000
echo    - Python Worker: Running in separate window
echo ==========================================
echo.
npm run dev

:: Cleanup on exit
echo.
echo Shutting down...
docker-compose down 2>nul
taskkill /FI "WINDOWTITLE eq Python Worker" /F 2>nul
