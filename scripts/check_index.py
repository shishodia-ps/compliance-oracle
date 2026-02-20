#!/usr/bin/env python3
"""Check the type of the text_vector index on search_chunks table"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv('DATABASE_URL').split('?')[0]
conn = psycopg2.connect(db_url)
cursor = conn.cursor()

cursor.execute("""
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE indexname = 'search_chunks_text_vector_idx';
""")
result = cursor.fetchone()

if result:
    print(f"Index: {result[0]}")
    print(f"Definition: {result[1]}")
    if 'gin' in result[1].lower():
        print("\n[SUCCESS] Index is using GIN type (correct for full-text search)")
    elif 'btree' in result[1].lower():
        print("\n[ERROR] Index is still using B-tree type")
    else:
        print(f"\n[WARNING] Unknown index type")
else:
    print("Index not found!")

conn.close()
