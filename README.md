# Legal AI Platform

A production-grade, AI-powered legal document analysis platform with integrated document processing pipeline, hybrid legal search engine, and evidence-grade citation system.

![Legal AI](https://img.shields.io/badge/Legal%20AI-Platform-blue)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Python](https://img.shields.io/badge/Python-3.11-yellow)

---

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [Step 1: Clone Repository](#step-1-clone-repository)
  - [Step 2: Install Docker](#step-2-install-docker)
  - [Step 3: Install Node.js Dependencies](#step-3-install-nodejs-dependencies)
  - [Step 4: Install Python Dependencies](#step-4-install-python-dependencies)
  - [Step 5: Environment Configuration](#step-5-environment-configuration)
  - [Step 6: Database Setup](#step-6-database-setup)
  - [Step 7: Start Services](#step-7-start-services)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Development Guide](#development-guide)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

---

## ✨ Features

### Core Platform
- **Document Analysis**: AI-powered contract review, clause extraction, risk detection
- **Document Q&A**: Natural language queries with citations
- **Version Comparison**: Semantic diff with change highlighting
- **Compliance Mapping**: GDPR, AI Act framework alignment
- **Review Workflows**: Human-in-the-loop approval with audit trails

### Document Processing Pipeline
- **LlamaCloud Extraction**: High-quality PDF parsing and text extraction
- **PageIndex Integration**: Hierarchical document indexing
- **Moonshot AI Enrichment**: Document summaries, clause detection, and Q&A
- **Portable Master JSON**: Offline-first, reproducible results
- **Query Caching**: Fast repeated queries per matter

### Legal Search Engine
- **Hybrid Search**: Keyword (PostgreSQL tsvector) + Semantic (pgvector) + Structural
- **Clause Type Detection**: Termination, indemnity, liability, etc.
- **Citation System**: Every answer traceable with exact quotes
- **Reviewer Workflow**: Approve/reject/comment on citations

### Third-Party Due Diligence
- **Adverse Media Check**: Automated screening of vendors, partners, and counterparties against news, sanctions, and regulatory sources
  - **Input Methods**: Type company name directly or upload PDF/Word/Excel documents for bulk extraction
  - **Entity Resolution**: AI-powered disambiguation (e.g., "Tesla Inc." vs "Tesla Museum") using location, industry, and registration context
  - **Multi-Tier Sources**:
    - **Tier 1 (Sanctions)**: OFAC, UN, EU sanctions lists, regulatory enforcement actions, court records
    - **Tier 2 (News)**: Reuters, Bloomberg, WSJ, Financial Times, local business press via NewsAPI/GDELT
    - **Tier 3 (Web)**: Company websites, Glassdoor, Better Business Bureau, industry forums
  - **Risk Scoring**: 0-100 score with categorization (Legal, Regulatory, Financial, Reputational, Environmental, Cyber)
  - **Confidence Rating**: Entity match confidence + source credibility weighting
  - **Smart Caching**: 24-48 hour result cache with manual refresh option
  - **Export Reports**: PDF/Excel adverse media summary for compliance records
  - **Monitoring Mode**: Optional ongoing alerts for new adverse mentions of saved entities
  - **Compliance Ready**: GDPR-compliant data handling, configurable data retention (30-90 days), audit trails for all checks

### UI/UX
- **Modern Design**: Glassmorphism, gradients, animations
- **Document Reader**: Page navigation, highlighting, side panels
- **Pipeline Dashboard**: Real-time progress, logs, artifacts
- **Citation Review**: Evidence-grade validation workflow

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              LEGAL AI PLATFORM                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   Next.js    │    │   Pipeline   │    │   Search     │              │
│  │   Frontend   │◄──►│   Worker     │◄──►│   Engine     │              │
│  │              │    │   (Python)   │    │   (Hybrid)   │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│         │                   │                   │                       │
│         │                   │                   │                       │
│         ▼                   ▼                   ▼                       │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │              POSTGRESQL + PGVECTOR DATABASE                   │     │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │     │
│  │  │Documents│  │Pipeline │  │ Search  │  │Citation │         │     │
│  │  │         │  │  Jobs   │  │ Chunks  │  │ Records │         │     │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘         │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Pipeline Flow:**
```
PDF Upload → Extract (LlamaCloud) → Index (PageIndex) → Enrich (Moonshot AI) → Merge → Query
```

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **Python** 3.11+ ([Download](https://www.python.org/downloads/))
- **Docker** and **Docker Compose** ([Download](https://www.docker.com/products/docker-desktop))
- **Git** ([Download](https://git-scm.com/downloads))
- **npm** or **pnpm** (comes with Node.js)

---

## 🚀 Installation

### Step 1: Clone Repository

```bash
# Clone the repository
git clone <your-repo-url>
cd legal-ai
```

If you don't have a git repository yet, initialize one:
```bash
git init
git add .
git commit -m "Initial commit"
```

---

### Step 2: Install Docker

#### Windows
1. Download [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
2. Run the installer
3. Enable WSL 2 integration if prompted
4. Start Docker Desktop
5. Verify installation:
   ```powershell
   docker --version
   docker-compose --version
   ```

#### macOS
1. Download [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
2. Drag Docker.app to Applications
3. Open Docker Desktop
4. Verify installation:
   ```bash
   docker --version
   docker-compose --version
   ```

#### Linux
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

---

### Step 3: Install Node.js Dependencies

```bash
# Install all Node.js dependencies
npm install

# This will install:
# - Next.js 14 and React
# - Prisma ORM
# - shadcn/ui components
# - Authentication libraries
# - All other frontend dependencies
```

---

### Step 4: Install Python Dependencies

#### Windows (PowerShell)
```powershell
# Navigate to pipeline worker directory
cd services/pipeline_worker

# Create virtual environment
python -m venv venv

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Return to root directory
cd ..\..
```

#### macOS/Linux
```bash
# Navigate to pipeline worker directory
cd services/pipeline_worker

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Return to root directory
cd ../..
```

---

### Step 5: Environment Configuration

1. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` file with your configuration:**
   ```env
   # ============================================
   # DATABASE
   # ============================================
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/legal_ai?schema=public"

   # ============================================
   # NEXTAUTH
   # ============================================
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key-here-change-in-production"

   # ============================================
   # OAUTH PROVIDERS (Optional)
   # ============================================
   GOOGLE_CLIENT_ID=""
   GOOGLE_CLIENT_SECRET=""

   # ============================================
   # AI PROVIDERS
   # ============================================
   # Moonshot AI - Primary AI provider for summaries, clauses, and Q&A
   # Get your API key from: https://platform.moonshot.cn/
   MOONSHOT_API_KEY=""

   # LlamaCloud - Required for document extraction
   # Get your API key from: https://cloud.llamaindex.ai/
   LLAMA_CLOUD_API_KEY=""

   # ============================================
   # PIPELINE CONFIGURATION
   # ============================================
   # URL to the pipeline worker service
   PIPELINE_WORKER_URL="http://localhost:8001"

   # Set to "true" to use mock AI responses without external API calls
   # This is useful for development and testing
   AI_MOCK_MODE="true"

   # ============================================
   # FILE STORAGE
   # ============================================
   # For local development, files are stored in /uploads and /data
   # For production, configure S3-compatible storage
   STORAGE_TYPE="local"
   S3_ENDPOINT=""
   S3_BUCKET=""
   S3_ACCESS_KEY=""
   S3_SECRET_KEY=""
   S3_REGION="us-east-1"

   # ============================================
   # APP CONFIGURATION
   # ============================================
   APP_NAME="Legal AI"
   APP_URL="http://localhost:3000"

   # Demo Mode - Enables sample data and walkthroughs
   DEMO_MODE="true"
   ```

3. **Important Notes:**
   - Set `AI_MOCK_MODE="false"` when you have real API keys
   - Generate a secure `NEXTAUTH_SECRET` for production:
     ```bash
     openssl rand -base64 32
     ```

---

### Step 6: Database Setup

#### 6.1: Start PostgreSQL with Docker

```bash
# Start PostgreSQL database with pgvector extension
docker-compose up -d db

# Wait for database to be ready (about 10-15 seconds)
# You can check the logs:
docker-compose logs -f db
# Press Ctrl+C to exit logs when you see "database system is ready to accept connections"
```

#### 6.2: Run Prisma Migrations

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Alternative: Run migrations in development mode (creates migration files)
npx prisma migrate dev
```

#### 6.3: Seed Database (Optional)

```bash
# Seed the database with demo data
npx prisma db seed

# This creates:
# - Demo users (admin@legalai.demo, manager@legalai.demo, etc.)
# - Sample organizations
# - Sample matters and documents
```

**Demo Credentials:**
| Email | Password | Role |
|-------|----------|------|
| admin@legalai.demo | demo123 | Admin |
| manager@legalai.demo | demo123 | Manager |
| reviewer@legalai.demo | demo123 | Reviewer |
| viewer@legalai.demo | demo123 | Viewer |

#### 6.4: Verify Database Setup

```bash
# Open Prisma Studio to view your database
npx prisma studio

# This opens http://localhost:5555 in your browser
# You can browse all tables and data
```

---

### Step 7: Start Services

You need to start **THREE** services. Open three separate terminal windows:

#### Terminal 1: Start Database (if not already running)
```bash
docker-compose up -d db
```

#### Terminal 2: Start Pipeline Worker

**Windows (PowerShell):**
```powershell
cd services/pipeline_worker
.\venv\Scripts\Activate.ps1
uvicorn worker_server:app --reload --port 8001
```

**macOS/Linux:**
```bash
cd services/pipeline_worker
source venv/bin/activate
uvicorn worker_server:app --reload --port 8001
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

#### Terminal 3: Start Next.js App

```bash
# Make sure you're in the root directory
npm run dev
```

You should see:
```
  ▲ Next.js 14.0.0
  - Local:        http://localhost:3000
  - Ready in 2.5s
```

---

### Step 8: Access the Application

Open your browser and navigate to:

- **Web App**: [http://localhost:3000](http://localhost:3000)
- **Pipeline Worker Health Check**: [http://localhost:8001/health](http://localhost:8001/health)
- **Pipeline Worker API Docs**: [http://localhost:8001/docs](http://localhost:8001/docs)
- **Prisma Studio**: [http://localhost:5555](http://localhost:5555)

**First Time Login:**
1. Go to [http://localhost:3000](http://localhost:3000)
2. Click "Sign In"
3. Use one of the demo credentials above
4. Explore the platform!

---

## 📁 Project Structure

```
legal-ai/
├── app/                          # Next.js App Router
│   ├── (marketing)/              # Public marketing pages
│   │   ├── page.tsx              # Landing page
│   │   ├── pricing/              # Pricing page
│   │   ├── product/              # Product page
│   │   ├── solutions/            # Solutions page
│   │   ├── security/             # Security page
│   │   ├── docs/                 # Documentation
│   │   ├── blog/                 # Blog
│   │   └── contact/              # Contact page
│   ├── (app)/                    # Authenticated app
│   │   └── app/
│   │       ├── page.tsx          # Dashboard
│   │       ├── search/           # Legal search
│   │       ├── searchai/         # AI-powered search
│   │       ├── citations/        # Citation review
│   │       ├── matters/          # Matter management
│   │       ├── documents/        # Document library
│   │       ├── compare/          # Document comparison
│   │       ├── compliance/       # Compliance mapping
│   │       └── settings/         # User settings
│   ├── (auth)/                   # Authentication pages
│   │   └── login/                # Login page
│   ├── admin/                    # Admin panel
│   └── api/                      # API routes
│       ├── auth/                 # NextAuth endpoints
│       ├── documents/            # Document CRUD
│       ├── matters/              # Matter CRUD
│       ├── pipeline/             # Pipeline proxy
│       ├── search/               # Search API
│       ├── searchai/             # AI search API
│       ├── citations/            # Citation API
│       └── notifications/        # Notifications API
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── marketing/                # Marketing components
│   ├── app/                      # App components
│   │   ├── header.tsx            # App header
│   │   └── sidebar.tsx           # App sidebar
│   └── legal/                    # Legal-specific components
│       ├── document-reader.tsx   # Document viewer
│       └── citation-review.tsx   # Citation review
├── lib/
│   ├── auth.ts                   # NextAuth config
│   ├── prisma.ts                 # Prisma client
│   ├── utils.ts                  # Utility functions
│   ├── queue.ts                  # Queue utilities
│   ├── retrieval_service.ts      # Document retrieval
│   └── search/                   # Search service
│       └── search-service.ts     # Hybrid search
├── services/
│   └── pipeline_worker/          # Python pipeline service
│       ├── worker_server.py      # FastAPI server
│       ├── pipeline_core.py      # Core pipeline logic
│       ├── chunking.py           # Chunk extraction
│       ├── jobs.py               # Job management
│       ├── paths.py              # File path utilities
│       ├── settings.py           # Configuration
│       ├── logging_utils.py      # Logging
│       ├── requirements.txt      # Python dependencies
│       ├── Dockerfile            # Pipeline worker Docker
│       └── venv/                 # Python virtual env
├── workers/                      # Background workers
│   ├── pipeline_runner.py        # Pipeline executor
│   ├── queue_jobs.py             # Queue job utilities
│   ├── check_queue.py            # Queue checker
│   └── requirements.txt          # Worker dependencies
├── PageIndex/                    # PageIndex library (submodule)
│   ├── pageindex/                # Python package
│   ├── run_pageindex.py          # CLI tool
│   └── requirements.txt          # PageIndex dependencies
├── prisma/
│   ├── schema.prisma             # Database schema
│   ├── seed.ts                   # Database seeding
│   └── migrations/               # Migration history
├── public/                       # Static assets
├── types/                        # TypeScript types
├── data/                         # Generated data files
├── uploads/                      # User uploaded files
├── .env                          # Environment variables (create from .env.example)
├── .env.example                  # Environment template
├── .gitignore                    # Git ignore rules
├── docker-compose.yml            # Docker orchestration
├── Dockerfile                    # Next.js app Docker
├── package.json                  # Node.js dependencies
├── requirements.txt              # Root Python dependencies
├── tsconfig.json                 # TypeScript config
├── tailwind.config.ts            # Tailwind CSS config
├── next.config.js                # Next.js config
├── middleware.ts                 # Next.js middleware (auth)
└── README.md                     # This file
```

---

## 📚 API Documentation

### Pipeline Worker Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/jobs/ingest` | POST | Start document ingestion |
| `/jobs/{id}` | GET | Get job status |
| `/jobs/{id}/logs` | GET | Get job logs |
| `/query` | POST | Query indexed documents |
| `/artifacts` | GET | List artifacts |
| `/artifacts/download` | GET | Download artifact |

**Example: Start Pipeline Job**
```bash
curl -X POST http://localhost:8001/jobs/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "org-123",
    "matterId": "matter-456",
    "documentIds": ["doc-1", "doc-2"],
    "options": {
      "maxConcurrent": 4,
      "model": "moonshot-v1-8k"
    }
  }'
```

### Search API

**POST /api/search**

Request:
```json
{
  "query": "limitation of liability",
  "matterId": "matter-123",
  "clauseType": "liability",
  "queryType": "hybrid",
  "topK": 10,
  "mode": "search"
}
```

Response:
```json
{
  "query": "limitation of liability",
  "queryId": "query-789",
  "results": [
    {
      "chunkId": "chunk-456",
      "documentId": "doc-123",
      "documentTitle": "Contract.pdf",
      "page": 12,
      "sectionPath": "2.1 Liability → Limitation",
      "snippet": "The liability of either party...",
      "matchType": "hybrid",
      "score": 0.92,
      "citation": {
        "chunkId": "chunk-456",
        "quote": "The liability of either party shall be limited to...",
        "startOffset": 123,
        "endOffset": 245
      }
    }
  ]
}
```

### Citation API

**PATCH /api/citations**

Request:
```json
{
  "citationId": "cite-123",
  "reviewStatus": "approved",
  "comment": "Verified against source"
}
```

---

## 💻 Development Guide

### Key Commands

```bash
# Development
npm run dev                 # Start Next.js dev server
npm run build              # Build for production
npm run start              # Start production server
npm run lint               # Run ESLint

# Database
npx prisma migrate dev     # Create and apply migration
npx prisma migrate deploy  # Apply migrations (production)
npx prisma generate        # Generate Prisma client
npx prisma studio          # Open Prisma Studio
npx prisma db seed         # Seed database
npx prisma db push         # Push schema without migration

# Docker
docker-compose up -d       # Start all services
docker-compose down        # Stop all services
docker-compose logs -f app # View app logs
docker-compose ps          # List running services
```

### Working with the Pipeline

1. **Upload Documents**: Go to `/app/documents/upload`
2. **Create Matter**: Go to `/app/matters` and create a matter
3. **Assign Documents**: Add documents to the matter
4. **Run Pipeline**: Go to matter → Pipeline tab → "Build Offline Index"
5. **Monitor Progress**: Watch real-time progress and logs
6. **Query**: Go to Search or Q&A to query the indexed documents

### Configuring Moonshot AI

The platform uses Moonshot AI with OpenAI-compatible API. Configure your API client:

```typescript
// Example configuration in your code
const client = new OpenAI({
  apiKey: process.env.MOONSHOT_API_KEY,
  baseURL: 'https://api.moonshot.cn/v1',
});
```

---

## 🚢 Production Deployment

### Using Docker Compose

1. **Update environment variables:**
   ```bash
   # Edit .env file
   AI_MOCK_MODE="false"
   DEMO_MODE="false"
   MOONSHOT_API_KEY="your-real-key"
   LLAMA_CLOUD_API_KEY="your-real-key"
   NEXTAUTH_SECRET="your-secure-secret"
   ```

2. **Build and start all services:**
   ```bash
   docker-compose up -d
   ```

3. **Run database migrations:**
   ```bash
   docker-compose exec app npx prisma migrate deploy
   ```

4. **View logs:**
   ```bash
   docker-compose logs -f app
   docker-compose logs -f pipeline_worker
   docker-compose logs -f db
   ```

### Manual Deployment

1. **Build Next.js app:**
   ```bash
   npm run build
   ```

2. **Start production server:**
   ```bash
   npm start
   ```

3. **Start pipeline worker:**
   ```bash
   cd services/pipeline_worker
   source venv/bin/activate
   uvicorn worker_server:app --host 0.0.0.0 --port 8001 --workers 4
   ```

---

## 🔍 Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```
Error: P1001: Can't reach database server
```
**Solution:**
- Ensure PostgreSQL is running: `docker-compose ps`
- Check DATABASE_URL in .env
- Start database: `docker-compose up -d db`

#### 2. Pipeline Worker Connection Refused
```
Error: connect ECONNREFUSED 127.0.0.1:8001
```
**Solution:**
- Ensure pipeline worker is running on port 8001
- Check PIPELINE_WORKER_URL in .env
- Restart pipeline worker

#### 3. Prisma Migration Fails
```
Error: P3005: The database schema is not empty
```
**Solution:**
- Reset database (WARNING: clears data):
  ```bash
  npx prisma migrate reset
  ```
- Or apply migrations manually:
  ```bash
  npx prisma migrate deploy
  ```

#### 4. pgvector Extension Missing
```
Error: type "vector" does not exist
```
**Solution:**
- Use the provided Docker image which includes pgvector:
  ```bash
  docker-compose up -d db
  ```
- Or manually install pgvector in PostgreSQL

#### 5. Module Not Found
```
Error: Cannot find module '@/components/ui/button'
```
**Solution:**
- Reinstall dependencies:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```
- Check tsconfig.json paths configuration

#### 6. Python Dependencies Not Found
```
ModuleNotFoundError: No module named 'fastapi'
```
**Solution:**
- Ensure virtual environment is activated
- Reinstall dependencies:
  ```bash
  cd services/pipeline_worker
  source venv/bin/activate  # Windows: .\venv\Scripts\Activate.ps1
  pip install -r requirements.txt
  ```

#### 7. Port Already in Use
```
Error: Port 3000 is already in use
```
**Solution:**
- Find and kill the process:
  ```bash
  # Windows
  netstat -ano | findstr :3000
  taskkill /PID <PID> /F

  # macOS/Linux
  lsof -ti:3000 | xargs kill -9
  ```
- Or use a different port:
  ```bash
  PORT=3001 npm run dev
  ```

### Setup Checklist

Before reporting issues, verify:

- [ ] Node.js 20+ installed (`node --version`)
- [ ] Python 3.11+ installed (`python --version`)
- [ ] Docker running (`docker ps`)
- [ ] PostgreSQL running (`docker-compose ps`)
- [ ] pgvector extension enabled
- [ ] `.env` file created and configured
- [ ] Node dependencies installed (`npm install`)
- [ ] Python dependencies installed (`pip install -r requirements.txt`)
- [ ] Prisma client generated (`npx prisma generate`)
- [ ] Database migrations applied (`npx prisma migrate deploy`)
- [ ] Pipeline worker running on port 8001
- [ ] Next.js running on port 3000

### Getting Help

1. Check the [Troubleshooting](#troubleshooting) section
2. Review logs:
   ```bash
   # Docker logs
   docker-compose logs -f

   # Pipeline worker logs
   cd services/pipeline_worker
   tail -f logs/pipeline.log

   # Next.js logs (in terminal where you ran npm run dev)
   ```
3. Open an issue on GitHub with:
   - Error message
   - Steps to reproduce
   - Environment details (OS, versions)
   - Relevant logs

---

## 🧪 Testing the Installation

### Smoke Test Checklist

After completing installation, verify everything works:

**Database:**
- [ ] Can connect to PostgreSQL
- [ ] pgvector extension enabled
- [ ] Tables created (check with `npx prisma studio`)
- [ ] Demo users seeded

**Pipeline:**
- [ ] Worker health check returns 200: http://localhost:8001/health
- [ ] Can upload documents via UI
- [ ] Can start pipeline job
- [ ] Progress updates in real-time
- [ ] Master index files generated in `/data`

**Search:**
- [ ] Can perform keyword search
- [ ] Results include citations
- [ ] Q&A mode works
- [ ] Citation review workflow functional

**UI:**
- [ ] Marketing pages load (http://localhost:3000)
- [ ] Can log in with demo credentials
- [ ] Dashboard displays stats
- [ ] Document reader works
- [ ] Responsive on mobile

**Quick Test:**
1. Login as `admin@legalai.demo` / `demo123`
2. Upload a PDF document
3. Create a matter and assign the document
4. Run the pipeline
5. Perform a search query
6. Review citations

---

## 🔍 Adverse Media Check - Technical Implementation

### Architecture Overview

The Adverse Media Check module integrates with the existing legal AI platform while maintaining separation of concerns:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ADVERSE MEDIA CHECK FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Input Methods                                                               │
│  ├── Single Company: Type name + context (country, industry)                 │
│  ├── Document Upload: PDF/Word/Excel → Extract company list                  │
│  └── Bulk Paste: Comma-separated or line-separated names                     │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Entity Resolution & Normalization                                    │    │
│  │ ─────────────────────────────────                                    │    │
│  │ • Normalize company names (remove Ltd, Inc, LLC variations)          │    │
│  │ • Deduplicate similar names using Levenshtein distance               │    │
│  │ • AI-powered disambiguation with web context                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Parallel Source Queries (Cached 24-48h)                              │    │
│  │ ─────────────────────────────────                                    │    │
│  │ Tier 1 (Sanctions):    OFAC API → Cached XML → Parse                 │    │
│  │ Tier 2 (News):         NewsAPI/GDELT → Article URLs → Scrape         │    │
│  │ Tier 3 (Web):          Serper.dev/Google → Search results            │    │
│  │ Entity DB:             OpenSanctions API → Structured records        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Content Analysis & Scoring                                           │    │
│  │ ───────────────────────────                                          │    │
│  │ • Filter false positives (NLP: irrelevant mentions)                  │    │
│  │ • Sentiment analysis on news articles                                │    │
│  │ • Categorize: Legal, Regulatory, Financial, Reputational             │    │
│  │ • Source credibility weighting                                       │    │
│  │ • Recency scoring (older = lower weight)                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Risk Report Generation                                               │    │
│  │ ────────────────────────                                             │    │
│  │ Overall Risk Score: 0-100 (High/Medium/Low)                          │    │
│  │ Breakdown by Category + Confidence Score                             │    │
│  │ Source list with direct URLs + Cached snippet                        │    │
│  │ Entity match explanation (why we think this is the company)          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Database Schema Additions

```prisma
model AdverseMediaCheck {
  id              String    @id @default(cuid())
  userId          String    @map("user_id")
  organizationId  String    @map("organization_id")
  
  // Input
  inputType       String    @map("input_type") // single, document, bulk
  rawInput        String    @map("raw_input")  // company name or document text
  
  // Status
  status          String    @default("pending") // pending, processing, completed, error
  
  // Results (stored as JSON for flexibility)
  results         Json?     // Array of company results
  riskScore       Int?      @map("risk_score") // 0-100 aggregated
  
  // Audit
  createdAt       DateTime  @default(now()) @map("created_at")
  completedAt     DateTime? @map("completed_at")
  
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  entities        AdverseMediaEntity[]
  
  @@index([userId])
  @@index([organizationId])
  @@index([createdAt])
  @@map("adverse_media_checks")
}

model AdverseMediaEntity {
  id              String    @id @default(cuid())
  checkId         String    @map("check_id")
  
  // Entity info
  name            String
  normalizedName  String    @map("normalized_name")
  jurisdiction    String?   // Country/region
  industry        String?
  registrationNum String?   @map("registration_num")
  
  // Match confidence
  matchConfidence Float     @map("match_confidence") // 0-1
  matchReasoning  String?   @map("match_reasoning")
  
  // Risk assessment
  riskScore       Int       // 0-100
  riskCategory    String    @map("risk_category") // High, Medium, Low
  
  // Sources found
  findings        Json      // Array of findings
  
  // Raw data cache (expires per ADVERSE_MEDIA_RETENTION_DAYS)
  rawCache        Json?     @map("raw_cache")
  cacheExpiresAt  DateTime? @map("cache_expires_at")
  
  check           AdverseMediaCheck @relation(fields: [checkId], references: [id], onDelete: Cascade)
  
  @@index([checkId])
  @@index([normalizedName])
  @@map("adverse_media_entities")
}
```

### API Endpoints

```typescript
// POST /api/adverse-media/check
// Single company or bulk check
{
  "companies": [
    {
      "name": "Acme Corporation",
      "country": "US",
      "industry": "Technology"
    }
  ],
  "options": {
    "depth": "standard", // quick, standard, deep
    "sources": ["sanctions", "news", "web"], // filter sources
    "maxAge": "2y" // how far back to search
  }
}

// Response
{
  "checkId": "check_abc123",
  "status": "processing",
  "estimatedTime": "30s",
  "resultsUrl": "/api/adverse-media/check/check_abc123/results"
}

// POST /api/adverse-media/upload
// Upload PDF/Word/Excel for bulk extraction
// Returns: Same as above with extracted company list

// GET /api/adverse-media/check/{id}/results
// Poll for results or get cached results

// GET /api/adverse-media/entity/{id}/monitor
// Enable ongoing monitoring (optional)
```

### Cost Optimization Strategy

| Tier | Cost | Speed | Use Case |
|------|------|-------|----------|
| **Quick** | $0.01/company | <5s | Preliminary screening |
| **Standard** | $0.05/company | ~30s | Due diligence |
| **Deep** | $0.20/company | ~2min | High-risk partnerships |

**Caching Strategy:**
- Sanctions lists: Cache 24h (update daily at 00:00 UTC)
- News results: Cache 48h
- Web search: Cache 72h

**Free Tier Options:**
- GDELT (free, global news)
- OpenSanctions (free, sanctions data)
- SEC EDGAR (free, US public companies)

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 🙏 Acknowledgments

- **Next.js 14** - React framework
- **Prisma** - Database ORM
- **PostgreSQL + pgvector** - Database with vector search
- **LlamaCloud** - Document parsing
- **Moonshot AI** - AI capabilities
- **PageIndex** - Document indexing
- **shadcn/ui** - UI components
- **Tailwind CSS** - Styling

---

**Last Updated**: 2026-02-03
**Version**: 1.0.0
