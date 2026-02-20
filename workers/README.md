# Document Processing Worker

This Python worker processes uploaded legal documents using the queue system.

## Quick Start (Using Existing Venv)

```bash
# 1. Navigate to project root and activate your existing venv
cd "c:\Users\FTECH_01\Desktop\Agentic AI\Legal AI\legal-ai"
.venv\Scripts\activate
# or if named differently:
# venv\Scripts\activate

# 2. Install worker dependencies
pip install redis psycopg2-binary python-dotenv

# 3. Run the worker
cd workers
python document_processor.py
```

## What the Worker Does

1. **Listens** to Redis queue for new document jobs
2. **Extracts** text using LlamaCloud OCR
3. **Indexes** content with PageIndex
4. **Enriches** with OpenAI summaries
5. **Saves** results to PostgreSQL

## Required Environment Variables

Add these to your `.env` file:
```env
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:pass@localhost:5432/legal_ai
LLAMA_CLOUD_API_KEY=your_key
OPENAI_API_KEY=your_key
```

## Integration Steps

Replace the placeholder methods in `document_processor.py`:

### 1. LlamaCloud Extraction (line ~75)
Replace the `asyncio.sleep(2)` with your actual LlamaCloud extraction code.

### 2. PageIndex Indexing (line ~88)
Replace with your PageIndex `from_text()` call.

### 3. OpenAI Enrichment (line ~101)
Replace with your OpenAI summarization and risk detection logic.

## Running Multiple Workers

For faster processing, run multiple workers in separate terminals:

```bash
# Terminal 2
.venv\Scripts\activate
cd workers
python document_processor.py

# Terminal 3
.venv\Scripts\activate
cd workers
python document_processor.py
```

## Troubleshooting

**"No module named 'redis'"**
→ Run: `pip install redis psycopg2-binary`

**"Connection refused" to Redis**
→ Start Redis: `docker run -d --name redis -p 6379:6379 redis:alpine`

**"Connection refused" to PostgreSQL**
→ Ensure your Docker PostgreSQL container is running
