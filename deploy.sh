#!/bin/bash
set -e

echo "🚀 Starting production deployment..."

# Export commit hash for build tracking
export GIT_COMMIT_HASH=$(git rev-parse --short HEAD)
echo "📦 Build ID: $GIT_COMMIT_HASH"

# Clean up old builds
echo "🧹 Cleaning old builds..."
rm -rf .next
rm -rf node_modules/.cache

# Install dependencies (clean)
echo "📥 Installing dependencies..."
npm ci --only=production

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Build application
echo "🏗️ Building application..."
npm run build

# Run database migrations
echo "🗄️ Running database migrations..."
npx prisma migrate deploy

# Build and start Docker containers
echo "🐳 Building Docker containers..."
docker-compose down --remove-orphans
docker-compose build --no-cache app
docker-compose up -d

# Wait for health check
echo "⏳ Waiting for health check..."
sleep 10

# Verify deployment
if curl -sf http://localhost:3000/api/health > /dev/null; then
    echo "✅ Deployment successful!"
    echo "🌐 Application is running at http://localhost:3000"
else
    echo "❌ Health check failed!"
    docker-compose logs app
    exit 1
fi
