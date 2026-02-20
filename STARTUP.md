# Legal AI - Quick Start Guide

## One Command to Run Everything

We created **3 ways** to start the entire development environment with a single command:

### Option 1: PowerShell Script (Recommended)
```powershell
.\start-dev.ps1
```

### Option 2: Batch File
```batch
.\start-dev.bat
```

### Option 3: npm Command
```bash
npm run start:dev
```

---

## What These Scripts Do

All scripts perform these steps automatically:

| Step | Action | Why |
|------|--------|-----|
| 1 | Stop old Docker containers | Fixes port conflicts |
| 2 | Start PostgreSQL database | Stores your data |
| 3 | Start Redis | Job queue for document processing |
| 4 | Wait for database ready | Prevents connection errors |
| 5 | Run Prisma generate & db push | Syncs database schema |
| 6 | Start Python document processor | Processes uploaded files |
| 7 | Start Next.js dev server | Your web app |

---

## Services After Running

| Service | URL / Port | Purpose |
|---------|-----------|---------|
| Next.js App | http://localhost:3000 | Web interface |
| PostgreSQL | localhost:5432 | Main database |
| Redis | localhost:6379 | Job queue & cache |
| Python Worker | Terminal window | Document processing |

---

## Individual Commands (If Needed)

```bash
# Just cleanup Docker
npm run docker:clean

# Just start Docker services
npm run docker:up

# Just sync Prisma
npm run prisma:sync

# Just run Python worker
npm run worker

# Just run Next.js (without other services)
npm run dev
```

---

## Stopping Everything

Press **Ctrl+C** in the terminal, or run:
```bash
docker-compose down
```

---

## Troubleshooting

### "Port already in use" error
The scripts handle this automatically by stopping old containers first.

### Prisma errors
The scripts run `prisma db push` which updates your database without needing migrations.

### Python worker not starting
Make sure your virtual environment is at `legal-ai\venv\` with all dependencies installed.

---

## Just Remember

```bash
# Every time you open the project, run:
npm run start:dev
```

That's it! Everything else is automatic.
