#!/usr/bin/env python3
"""Check what's happening in the Redis queue"""
import os
import sys
import json
from pathlib import Path
from dotenv import load_dotenv

# Load environment
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

import redis

REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')

print(f"Connecting to Redis: {REDIS_URL}")
r = redis.from_url(REDIS_URL, decode_responses=True)

# Check if Redis is up
print(f"\n[OK] Redis ping: {r.ping()}")

# List all keys matching bull:*
print("\n=== All Bull Queue Keys ===")
keys = r.keys('bull:*')
if keys:
    for key in sorted(keys):
        key_type = r.type(key)
        if key_type == 'list':
            length = r.llen(key)
            print(f"  {key} (list, length: {length})")
            if length > 0:
                items = r.lrange(key, 0, 2)
                for i, item in enumerate(items):
                    print(f"    [{i}] {item[:200]}...")
        elif key_type == 'hash':
            print(f"  {key} (hash)")
            # Show hash contents
            data = r.hgetall(key)
            for field, value in data.items():
                if field == 'data':
                    try:
                        parsed = json.loads(value)
                        print(f"    {field}: {json.dumps(parsed, indent=2)[:300]}...")
                    except:
                        print(f"    {field}: {value[:100]}...")
                else:
                    print(f"    {field}: {value[:100]}")
        elif key_type == 'string':
            value = r.get(key)
            print(f"  {key} (string): {value}")
        elif key_type == 'zset':
            length = r.zcard(key)
            print(f"  {key} (zset, length: {length})")
        elif key_type == 'set':
            members = r.smembers(key)
            print(f"  {key} (set): {members}")
        else:
            print(f"  {key} ({key_type})")
else:
    print("  No bull:* keys found")

# Check document progress keys
print("\n=== Document Progress Keys ===")
progress_keys = r.keys('doc:progress:*')
if progress_keys:
    for key in sorted(progress_keys):
        value = r.get(key)
        print(f"  {key}: {value}")
else:
    print("  No progress keys found")

print("\n=== Done ===")
