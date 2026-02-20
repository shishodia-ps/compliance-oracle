#!/usr/bin/env python3
"""Queue documents for processing with correct absolute paths"""
import os
import sys
import json
from pathlib import Path
from dotenv import load_dotenv

# Load environment
project_root = Path(__file__).parent.parent
env_path = project_root / '.env'
load_dotenv(dotenv_path=env_path)

import redis
import psycopg2
from psycopg2.extras import RealDictCursor

REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/legal_ai')
if DATABASE_URL and '?' in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.split('?')[0]

r = redis.from_url(REDIS_URL, decode_responses=True)
conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

# Clear old queue
r.delete('bull:document-processing:wait')
r.delete('bull:document-processing:active')
r.delete('bull:document-processing:completed')
r.delete('bull:document-processing:failed')
print('[QUEUE] Cleared old queue')

# Get documents
cursor = conn.cursor()
cursor.execute("SELECT id, name, file_name, storage_key, organization_id FROM documents WHERE status = 'UPLOADED'")
docs = cursor.fetchall()

job_id = 1
for doc in docs:
    doc_id = doc['id']
    file_path = doc['storage_key']
    
    # Make path absolute
    if not Path(file_path).is_absolute():
        file_path = str(project_root / file_path)
    
    # Check file exists
    if not Path(file_path).exists():
        print(f'[MISSING] {doc_id}: {file_path}')
        continue
    
    # Create job data
    job_data = {
        'id': job_id,
        'name': 'process-document',
        'data': {
            'documentId': doc_id,
            'filePath': file_path,
            'fileName': doc['file_name'],
            'organizationId': doc['organization_id'],
            'userId': 'system'
        },
        'opts': {
            'attempts': 3,
            'backoff': {'type': 'exponential', 'delay': 5000},
            'removeOnComplete': 100,
            'removeOnFail': 50
        },
        'timestamp': 1234567890,
        'delay': 0,
        'priority': 0
    }
    
    # Save job hash
    job_key = f'bull:document-processing:{job_id}'
    r.hset(job_key, mapping={
        'id': job_id,
        'name': 'process-document',
        'data': json.dumps(job_data['data']),
        'opts': json.dumps(job_data['opts']),
        'timestamp': '1234567890',
        'delay': '0',
        'priority': '0'
    })
    
    # Add to queue
    r.lpush('bull:document-processing:wait', job_id)
    
    print(f'[QUEUED] Job {job_id}: {doc["file_name"]}')
    job_id += 1

# Update ID counter
r.set('bull:document-processing:id', job_id - 1)

cursor.close()
conn.close()
print(f'[DONE] Queued {job_id - 1} jobs')
