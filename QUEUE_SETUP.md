# Document Processing Queue Setup

This document explains how the Redis + Bull queue system works for document processing.

## Architecture

```
┌─────────────┐     Upload      ┌──────────────┐
│  Web App    │ ──────────────► │  PostgreSQL  │
│  (Next.js)  │                 │  (Documents) │
└─────────────┘                 └──────────────┘
       │                               │
       │ Add to Queue                  │ Status Updates
       ▼                               ▼
┌─────────────┐                 ┌──────────────┐
│    Redis    │ ◄────────────── │ Python Worker│
│    Queue    │   Poll for Jobs │  (Pipeline)  │
└─────────────┘                 └──────────────┘
       │                               │
       │ Progress Updates              │ LlamaCloud
       ▼                               │ PageIndex
┌─────────────┐                       │ OpenAI
│   Redis     │                       │
│  (Progress) │                       │
└─────────────┘                       │
       │                              │
       │ Poll Progress                │
       ▼                              │
┌─────────────┐                       │
│  Web App    │ ◄─────────────────────┘
│  (Realtime) │
└─────────────┘
```

## Prerequisites

### 1. Install Redis

**Windows (using Docker):**
```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

**macOS:**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo apt install redis-server
sudo systemctl start redis
```

### 2. Set Environment Variables

Add to your `.env` file:
```env
REDIS_URL=redis://localhost:6379
UPLOAD_DIR=./uploads
LLAMA_CLOUD_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
```

## How It Works

### 1. Document Upload Flow

1. User uploads PDF via web app
2. File saved to `./uploads/{orgId}/{documentId}_{filename}`
3. Document status set to `PROCESSING`
4. Job added to Redis queue with document metadata
5. User sees "Processing" status with progress bar

### 2. Python Worker Processing

The worker (`workers/document_processor.py`) processes documents in 4 steps:

| Step | Description | Progress | Time |
|------|-------------|----------|------|
| Extract | LlamaCloud OCR + text extraction | 0-30% | 30-120s |
| Index | PageIndex semantic indexing | 30-60% | 20-60s |
| Enrich | OpenAI summaries + risk detection | 60-90% | 30-90s |
| Save | Store results to PostgreSQL | 90-100% | 5-10s |

### 3. Real-time Progress

- Frontend polls `/api/documents/{id}/progress` every 2 seconds
- Progress stored in Redis with 1-hour expiry
- UI shows progress bar + current step message

## Running the System

### Terminal 1: Start Next.js App
```bash
npm run dev
# or
npm start
```

### Terminal 2: Start Python Worker

If you **already have a virtual environment** (from earlier):
```bash
# Activate existing venv (Windows)
.venv\Scripts\activate
# or
venv\Scripts\activate

# Navigate to workers
cd workers

# Install new dependencies
pip install -r requirements.txt

# Run worker
python document_processor.py
```

If you **don't have a venv yet**:
```bash
# Create and activate
python -m venv venv
venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Run worker
python document_processor.py
```

## Customizing the Pipeline

### Integrate Your LlamaCloud Code

Edit `workers/document_processor.py` and replace the placeholder methods:

```python
async def _extract_document(self, file_path: str) -> Dict[str, Any]:
    """Replace with your LlamaCloud extraction code"""
    from llama_cloud import LlamaCloud
    
    client = LlamaCloud(api_key=os.getenv('LLAMA_CLOUD_API_KEY'))
    
    # Your extraction logic here
    with open(file_path, 'rb') as f:
        file_obj = await client.files.create(file=f, purpose="parse")
    
    result = await client.parsing.parse(
        file_id=file_obj.id,
        tier="agentic_plus",
        # ... your config
    )
    
    return {
        'text': result.text,
        'markdown': result.markdown,
        'items': result.items,
    }
```

### Integrate PageIndex

```python
async def _index_document(self, extracted_data: Dict) -> Dict:
    from pageindex import PageIndex
    
    pi = PageIndex()
    tree = pi.from_text(
        text=extracted_data['markdown'],
        model="gpt-4o-mini",
        max_pages_per_node=10,
        add_node_summary=False,
    )
    
    return {'tree': tree.to_dict(), 'extracted': extracted_data}
```

### Integrate OpenAI

```python
async def _enrich_document(self, index_data: Dict) -> Dict:
    from openai import AsyncOpenAI
    
    client = AsyncOpenAI()
    
    # Generate summary
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"Summarize: {index_data['extracted']['text'][:4000]}"
        }]
    )
    
    summary = response.choices[0].message.content
    
    # Detect risks (add your logic)
    risks = await self._detect_risks(index_data)
    
    return {
        'index': index_data,
        'summary': summary,
        'risks': risks,
    }
```

## Monitoring

### Check Queue Status

Using Redis CLI:
```bash
redis-cli

# List pending jobs
LRANGE bull:document-processing:wait 0 -1

# Check active jobs
LRANGE bull:document-processing:active 0 -1

# Check progress for document
doc:progress:{documentId}
```

### View Failed Jobs

```bash
LRANGE bull:document-processing:failed 0 -1
```

## Scaling

### Multiple Workers

Run multiple Python workers to process documents in parallel:

```bash
# Terminal 2
python workers/document_processor.py

# Terminal 3
python workers/document_processor.py

# Terminal 4
python workers/document_processor.py
```

Each worker picks up jobs from the same queue automatically.

### Production Deployment

**Docker Compose Example:**
```yaml
version: '3'
services:
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
  
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - REDIS_URL=redis://redis:6379
  
  worker:
    build: ./workers
    environment:
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://...
    deploy:
      replicas: 3  # 3 workers
```

## Troubleshooting

### Redis Connection Error
```
Error: Connection refused
```
- Ensure Redis is running: `redis-cli ping` should return `PONG`
- Check REDIS_URL in .env

### Worker Not Processing
- Check worker logs for errors
- Verify queue has jobs: `redis-cli LRANGE bull:document-processing:wait 0 -1`
- Check document status in database

### Progress Not Updating
- Verify Redis is accessible from Next.js
- Check browser network tab for progress API calls
- Look for errors in `/api/documents/{id}/progress`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/documents` | GET | List all documents |
| `/api/documents` | POST | Create document record |
| `/api/documents/upload` | POST | Upload file + queue job |
| `/api/documents/{id}/progress` | GET | Get processing progress |

## Database Schema

New fields added to `Document` model:
- `processingJobId` - Redis job ID
- `processingError` - Error message if failed
- `processedAt` - Completion timestamp

New tables:
- `DocumentExtraction` - Full text from LlamaCloud
- `DocumentSummary` - AI-generated summary
