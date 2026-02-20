# Production Deployment Guide

## 🎯 Key Principles for Error Prevention

### 1. **Clean Builds Every Time**
- Never reuse `.next` cache between builds
- Use Docker multi-stage builds
- CI/CD pipeline removes `node_modules` and `.next` before building

### 2. **Immutable Deployments**
- Each deployment gets a unique Docker tag (git commit hash)
- Old containers remain running until new ones are healthy
- Instant rollback capability

### 3. **Health Checks**
- `/api/health` endpoint verifies database connectivity
- Docker healthcheck prevents routing to unhealthy containers
- Kubernetes (if used) liveness and readiness probes

## 🚀 Deployment Options

### Option A: Docker Compose (Single Server)

```bash
# 1. Set environment variables
cp .env.example .env
# Edit .env with production values

# 2. Deploy
npm run deploy

# Or manually:
docker-compose down --remove-orphans
docker-compose build --no-cache app
docker-compose up -d

# 3. Check status
curl http://localhost:3000/api/health
```

### Option B: CI/CD Pipeline (GitHub Actions)

1. Set repository secrets:
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
   - `KIMI_API_KEY`
   - `LLAMACLOUD_API_KEY`
   - `DOCKER_USERNAME`
   - `DOCKER_PASSWORD`

2. Push to `main` branch triggers automatic deployment

### Option C: Manual Clean Build

```bash
# Clean everything
npm run clean

# Install fresh dependencies
npm ci

# Generate Prisma client
npx prisma generate

# Build
npm run build

# Start production server
npm start
```

## 🔧 Configuration

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/legal_ai?schema=public

# Auth
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=https://your-domain.com

# AI Services
KIMI_API_KEY=your-kimi-key
LLAMACLOUD_API_KEY=your-llamacloud-key

# Redis (optional, for caching)
REDIS_URL=redis://localhost:6379

# Build tracking
GIT_COMMIT_HASH=abc123
```

### Next.js Config (`next.config.js`)

Key settings for production stability:

```javascript
{
  output: 'standalone',  // Creates minimal Docker image
  webpack: {
    cache: false  // Prevents chunk corruption in production
  },
  generateBuildId: async () => {
    return process.env.GIT_COMMIT_HASH || Date.now().toString();
  }
}
```

## 🛡️ Monitoring & Alerts

### Health Check Endpoint

```bash
# Check application health
curl http://localhost:3000/api/health

# Response:
{
  "status": "healthy",
  "database": true,
  "timestamp": "2024-01-01T12:00:00Z",
  "version": "abc123"
}
```

### Docker Logs

```bash
# View application logs
npm run docker:logs

# View all services
docker-compose logs -f
```

## 🔥 Emergency Rollback

If deployment fails:

```bash
# Rollback to previous version
docker-compose down
docker pull your-dockerhub/legal-ai:previous-tag
docker-compose up -d

# Or use git
git log --oneline -10  # Find previous commit
git checkout <commit-hash>
npm run deploy
```

## ✅ Pre-Deployment Checklist

- [ ] Environment variables set
- [ ] Database migrations tested
- [ ] Build completes without errors
- [ ] Health check passes
- [ ] Smoke tests (login, invoice upload) pass
- [ ] Rollback plan ready

## 🐛 Troubleshooting

### "Cannot find module" errors
```bash
npm run clean
npm run build:clean
```

### Database connection issues
```bash
# Check database is running
docker-compose ps db

# Run migrations manually
npx prisma migrate deploy
```

### Port already in use
```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9
```
