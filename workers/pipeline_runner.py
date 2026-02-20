#!/usr/bin/env python3
"""
PROPER PIPELINE - Uses REAL PageIndex Library (VectifyAI/PageIndex)
A: PDF(s) -> B: Ingestion Runner -> C: Hash+Change Detection -> D: LlamaCloud -> E: Parse Artifact -> F: PageIndex -> G: Tree Artifact -> H: Enrichment -> I: Update Tree -> J: Merge -> K: Master Index
"""
import os
import sys
import json
import hashlib
import time
import re
import signal
import asyncio
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

# Fix nested asyncio issues with LlamaCloud
import nest_asyncio
nest_asyncio.apply()

# Handle graceful shutdown
running = True
def signal_handler(sig, frame):
    global running
    print("\n[SHUTDOWN] Stopping pipeline...")
    running = False
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

# Load env
project_root = Path(__file__).parent.parent
os.environ['PYTHONIOENCODING'] = 'utf-8'

with open(project_root / '.env') as f:
    for line in f:
        if '=' in line and not line.startswith('#'):
            key, value = line.strip().split('=', 1)
            os.environ[key] = value.strip('"')

# Set up PageIndex to use Kimi API
os.environ['CHATGPT_API_KEY'] = os.getenv('MOONSHOT_API_KEY') or os.getenv('KIMI_API_KEY') or ''
os.environ['OPENAI_BASE_URL'] = 'https://api.moonshot.ai/v1'

import psycopg2
from psycopg2.extras import RealDictCursor, execute_values
from psycopg2.pool import SimpleConnectionPool
import redis

# Import REAL PageIndex library
sys.path.insert(0, str(project_root / 'PageIndex'))
from pageindex.page_index_md import md_to_tree
from pageindex.utils import ConfigLoader

MOONSHOT_API_KEY = os.getenv('MOONSHOT_API_KEY') or os.getenv('KIMI_API_KEY')
LLAMA_CLOUD_API_KEY = os.getenv('LLAMA_CLOUD_API_KEY')
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/legal_ai')
if '?' in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.split('?')[0]

# Create connection pool
db_pool = SimpleConnectionPool(minconn=1, maxconn=5, dsn=DATABASE_URL, cursor_factory=RealDictCursor)

# Create data directory for artifacts
data_dir = project_root / 'data'
data_dir.mkdir(exist_ok=True)

# Connect to Redis for progress updates
redis_client = redis.Redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379'), decode_responses=True)

print("=" * 70)
print("ARCHITECTURE PIPELINE: File Artifacts + REAL PageIndex + Master Index")
print("=" * 70)
print("PageIndex: github.com/VectifyAI/PageIndex (Local LLM-based tree building)")
print("=" * 70)

# Initialize LlamaCloud client (EU region for Netherlands)
# Use llama_parse package (pip install llama-parse)
from llama_parse import LlamaParse

# Use EU endpoint for European users
LLAMA_CLOUD_BASE_URL = os.getenv('LLAMA_CLOUD_BASE_URL', 'https://api.cloud.eu.llamaindex.ai')
# Ensure URL has https:// prefix
if not LLAMA_CLOUD_BASE_URL.startswith('http'):
    LLAMA_CLOUD_BASE_URL = f'https://{LLAMA_CLOUD_BASE_URL}'
print(f"LlamaCloud endpoint: {LLAMA_CLOUD_BASE_URL}")

llama = LlamaParse(
    api_key=LLAMA_CLOUD_API_KEY,
    base_url=LLAMA_CLOUD_BASE_URL,
    result_type="markdown",
    verbose=True,
)

# Initialize Kimi client (OpenAI-compatible)
from openai import OpenAI
kimi = OpenAI(
    api_key=MOONSHOT_API_KEY,
    base_url="https://api.moonshot.ai/v1"
) if MOONSHOT_API_KEY else None

# Fix #4: Monotonic progress — stages can only advance, never regress
STAGE_RANKS = {
    'PENDING': 1, 'CACHED': 2, 'EXTRACTING': 3, 'INDEXING': 4,
    'ANALYZING': 5, 'COMPLETED': 6, 'ERROR': 0,
}

def update_progress(doc_id: str, step: str, progress: int, message: str):
    """Update document progress in Redis and DB, enforcing monotonic advancement"""
    try:
        progress_key = f"doc:progress:{doc_id}"
        # Check current rank to prevent backward regression
        current_data = redis_client.get(progress_key)
        if current_data:
            current = json.loads(current_data)
            current_rank = STAGE_RANKS.get(current.get('step', ''), 0)
            new_rank = STAGE_RANKS.get(step, 0)
            # Allow ERROR to override anything, but otherwise only advance
            if step != 'ERROR' and new_rank < current_rank:
                return
            # Within same stage, only allow progress to increase
            if new_rank == current_rank and progress < current.get('progress', 0):
                progress = current['progress']

        redis_client.setex(
            progress_key,
            3600,
            json.dumps({
                "step": step,
                "progress": progress,
                "message": message,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        )
        conn = db_pool.getconn()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE documents SET processing_stage = %s WHERE id = %s",
                (step, doc_id)
            )
            conn.commit()
            cursor.close()
        finally:
            db_pool.putconn(conn)
    except Exception as e:
        print(f"    [Progress update failed: {e}]")

def compute_file_hash(file_path: Path) -> str:
    """C: Compute SHA256 hash of file"""
    sha256 = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            sha256.update(chunk)
    return sha256.hexdigest()

def load_parse_artifact(book_name: str) -> Optional[Dict]:
    """Load existing parse artifact if it exists"""
    artifact_path = data_dir / f"{book_name}_parse.json"
    if artifact_path.exists():
        with open(artifact_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None

def save_parse_artifact(book_name: str, data: Dict):
    """E: Store Parse Artifact {book}_parse.json"""
    artifact_path = data_dir / f"{book_name}_parse.json"
    with open(artifact_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"    [E] Saved parse artifact: {artifact_path}")

def load_tree_artifact(book_name: str) -> Optional[Dict]:
    """Load existing tree artifact if it exists"""
    artifact_path = data_dir / f"{book_name}_tree.json"
    if artifact_path.exists():
        with open(artifact_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None

def save_tree_artifact(book_name: str, data: Dict):
    """G: Store Tree Artifact {book}_tree.json"""
    artifact_path = data_dir / f"{book_name}_tree.json"
    with open(artifact_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"    [G] Saved tree artifact: {artifact_path}")

def normalize_markdown(md: str) -> str:
    """
    Fix #5: Normalize markdown before sending to PageIndex.
    Removes repeating headers/footers, normalizes heading levels,
    and simplifies tables to improve tree quality.
    """
    if not md:
        return md

    lines = md.split('\n')

    # --- Detect and remove repeating headers/footers ---
    # Count line frequency (lines that appear on 3+ pages are likely headers/footers)
    line_counts: Dict[str, int] = {}
    for line in lines:
        stripped = line.strip()
        if 5 < len(stripped) < 120:  # typical header/footer length
            line_counts[stripped] = line_counts.get(stripped, 0) + 1

    # Lines appearing 3+ times are likely repeating page headers/footers
    repeating = {ln for ln, count in line_counts.items() if count >= 3}
    if repeating:
        lines = [ln for ln in lines if ln.strip() not in repeating]
        print(f"    [Normalize] Removed {len(repeating)} repeating header/footer patterns")

    # --- Normalize heading levels ---
    # Ensure headings use consistent markdown syntax (# for h1, ## for h2, etc.)
    normalized = []
    for line in lines:
        # Fix headings with no space after # (e.g., "#Title" -> "# Title")
        heading_match = re.match(r'^(#{1,6})([^ #\n])', line)
        if heading_match:
            line = heading_match.group(1) + ' ' + line[len(heading_match.group(1)):]

        # Convert ALL-CAPS lines that look like section titles to headings
        stripped = line.strip()
        if (stripped.isupper() and 5 < len(stripped) < 80
                and not stripped.startswith('#') and not stripped.startswith('|')):
            line = f'## {stripped.title()}'

        normalized.append(line)
    lines = normalized

    # --- Simplify tables to text ---
    # Convert markdown tables to plain text rows (PageIndex struggles with complex tables)
    result = []
    in_table = False
    for line in lines:
        stripped = line.strip()
        # Detect table separator lines like |---|---|
        if re.match(r'^\|[\s\-:]+\|', stripped):
            in_table = True
            continue  # skip separator row
        if stripped.startswith('|') and stripped.endswith('|'):
            in_table = True
            # Convert table row to plain text: "| A | B | C |" -> "A; B; C"
            cells = [c.strip() for c in stripped.strip('|').split('|')]
            cells = [c for c in cells if c]
            if cells:
                result.append('; '.join(cells))
        else:
            if in_table:
                result.append('')  # blank line after table block
                in_table = False
            result.append(line)

    # --- Collapse excessive blank lines ---
    final = '\n'.join(result)
    final = re.sub(r'\n{4,}', '\n\n\n', final)

    print(f"    [Normalize] {len(md):,} -> {len(final):,} chars after normalization")
    return final


def process_invoice_document(doc: Dict, cursor, conn, parsed_text: str, parsed_md: str) -> bool:
    """
    Invoice-specific processing pipeline
    Extracts invoice data, runs AI classification, detects duplicates
    """
    doc_id = doc['id']
    file_name = doc['file_name']
    org_id = doc['organization_id']
    
    print(f"  [INVOICE] Processing as invoice document...")
    
    # Check if AI client is available
    if not kimi:
        print(f"    [INVOICE] WARNING: Kimi AI client not available (no API key?), using regex extraction only")
    else:
        print(f"    [INVOICE] Kimi AI client ready")
    
    update_progress(doc_id, "ANALYZING", 60, "Extracting invoice data with AI...")
    
    # Create or get existing invoice record
    cursor.execute("""
        SELECT id FROM invoices WHERE document_id = %s
    """, (doc_id,))
    existing = cursor.fetchone()
    
    if not existing:
        # Get uploaded_by from document
        cursor.execute("SELECT organization_id FROM documents WHERE id = %s", (doc_id,))
        doc_row = cursor.fetchone()
        org_id = doc_row['organization_id'] if doc_row else org_id
        
        # Create invoice record - we'll need uploaded_by from document owner
        cursor.execute("""
            INSERT INTO invoices (id, document_id, organization_id, uploaded_by_id, file_name, file_type, file_size, storage_key, status, currency, category, created_at, updated_at)
            VALUES (gen_random_uuid()::text, %s, %s, 
                (SELECT user_id FROM organization_members WHERE organization_id = %s LIMIT 1),
                (SELECT file_name FROM documents WHERE id = %s),
                (SELECT file_type FROM documents WHERE id = %s),
                (SELECT file_size FROM documents WHERE id = %s),
                (SELECT storage_key FROM documents WHERE id = %s),
                'PARSING', 'EUR', 'OTHER', NOW(), NOW())
            ON CONFLICT (document_id) DO UPDATE SET status = 'PARSING', updated_at = NOW()
        """, (doc_id, org_id, org_id, doc_id, doc_id, doc_id, doc_id))
        
        # Fetch the invoice_id (whether inserted or updated)
        cursor.execute("SELECT id FROM invoices WHERE document_id = %s", (doc_id,))
        result = cursor.fetchone()
        invoice_id = result['id'] if result else None
    else:
        invoice_id = existing['id']
        cursor.execute("UPDATE invoices SET status = 'PARSING' WHERE id = %s", (invoice_id,))
    
    conn.commit()
    
    # Extract invoice data using AI
    invoice_data = {
        'vendor_name': None,
        'vendor_tax_id': None,
        'invoice_number': None,
        'invoice_date': None,
        'due_date': None,
        'subtotal': None,
        'tax_amount': None,
        'total_amount': None,
        'currency': 'EUR',
        'line_items': [],
        'category': 'OTHER',
        'category_confidence': 0.5,
        'employee_name': None,
        'buyer_name': None,
    }
    
    # Extract invoice data using AI
    # LlamaParse returns markdown as primary output - use it preferentially
    # Markdown is more structured than plain text for invoice extraction
    if len(parsed_md) > len(parsed_text):
        text_for_extraction = parsed_md
        print(f"    [INVOICE] Using markdown ({len(parsed_md)} chars) for extraction")
    else:
        text_for_extraction = parsed_text
        print(f"    [INVOICE] Using text ({len(parsed_text)} chars) for extraction")
    
    if kimi and len(text_for_extraction) > 50:
        try:
            sample = text_for_extraction[:4000]  # First 4k chars
            
            # DEBUG: Show what we're sending to AI
            print(f"    [INVOICE] Sample being sent to AI (first 300 chars):")
            print(f"    ---START---")
            print(f"    {repr(sample[:300])}")
            print(f"    ---END---")
            
            print(f"    [INVOICE] Sending request to Kimi API...")
            
            try:
                resp = kimi.chat.completions.create(
                    model="kimi-k2.5",
                    messages=[
                        {"role": "system", "content": "You are a data extraction tool. Extract invoice fields and output ONLY the JSON object. No explanations, no reasoning, just the JSON."},
                        {"role": "user", "content": f"Extract these fields from the invoice and return as JSON:\n- vendor_name (string)\n- invoice_number (string)\n- invoice_date (YYYY-MM-DD)\n- total_amount (number)\n- currency (3-letter code: EUR/USD/INR/GBP)\n- category (TRAVEL/HOTEL/FOOD/CLIENT_ENTERTAINMENT/OFFICE_SUPPLIES/SOFTWARE/TRANSPORT/MEDICAL/OTHER)\n- employee_name (string, the person who made the purchase/buyer name if available)\n- buyer_name (string, alternative field for purchaser name)\n\nInvoice text:\n{sample[:2000]}"}
                    ],
                    temperature=1,
                    max_tokens=2000
                )
                
                if hasattr(resp, 'choices') and resp.choices:
                    choice = resp.choices[0]
                    msg = choice.message
                    
                    # Try content first, then reasoning_content as fallback
                    content = msg.content if msg.content else None
                    
                    print(f"    [INVOICE] Raw content: {repr(content)}")
                    print(f"    [INVOICE] Has reasoning_content: {hasattr(msg, 'reasoning_content')}")
                    
                    if not content and hasattr(msg, 'reasoning_content') and msg.reasoning_content:
                        # Try to extract JSON from reasoning
                        reasoning = msg.reasoning_content
                        print(f"    [INVOICE] Reasoning content length: {len(reasoning)}")
                        start = reasoning.find('{')
                        end = reasoning.rfind('}')
                        print(f"    [INVOICE] JSON brackets: start={start}, end={end}")
                        if start >= 0 and end > start:
                            content = reasoning[start:end+1]
                            print(f"    [INVOICE] Extracted from reasoning: {repr(content[:200])}")
                    
                    print(f"    [INVOICE] Response finish_reason: {choice.finish_reason}")
                    print(f"    [INVOICE] Final content: {repr(content[:200] if content else 'EMPTY')}")
                else:
                    print(f"    [INVOICE] No choices in response")
                    content = None
                    
            except Exception as api_err:
                print(f"    [INVOICE] API call failed: {api_err}")
                content = None
            
            if content:
                # Find JSON in response
                content = content.strip()
                if '```' in content:
                    # Extract from code block
                    parts = content.split('```')
                    for part in parts:
                        if '{' in part and '}' in part:
                            content = part.replace('json', '').strip()
                            break
                
                # Find the JSON object
                start = content.find('{')
                end = content.rfind('}')
                if start >= 0 and end > start:
                    json_str = content[start:end+1]
                    try:
                        result = json.loads(json_str)
                        
                        # Map to invoice_data
                        invoice_data['vendor_name'] = result.get('vendor_name') or result.get('vendor') or None
                        invoice_data['invoice_number'] = result.get('invoice_number') or result.get('invoice_num') or None
                        invoice_data['invoice_date'] = result.get('invoice_date') or None
                        invoice_data['total_amount'] = result.get('total_amount') or result.get('total') or result.get('amount') or None
                        invoice_data['currency'] = result.get('currency') or 'EUR'
                        invoice_data['category'] = result.get('category') if result.get('category') in ['TRAVEL', 'HOTEL', 'FOOD', 'CLIENT_ENTERTAINMENT', 'OFFICE_SUPPLIES', 'SOFTWARE', 'TRANSPORT', 'MEDICAL', 'OTHER'] else 'OTHER'
                        invoice_data['employee_name'] = result.get('employee_name') or result.get('buyer_name') or result.get('customer_name') or None
                        invoice_data['buyer_name'] = result.get('buyer_name') or result.get('employee_name') or result.get('customer_name') or None
                        
                        print(f"    [INVOICE] Extracted: vendor={invoice_data['vendor_name']}, amount={invoice_data['total_amount']} {invoice_data['currency']}, employee={invoice_data['employee_name']}")
                    except json.JSONDecodeError:
                        print(f"    [INVOICE] Failed to parse AI response")
                else:
                    print(f"    [INVOICE] No JSON found in AI response")
            else:
                print(f"    [INVOICE] AI returned empty response")
                # Try to extract from reasoning_content analysis text
                try:
                    if hasattr(resp.choices[0].message, 'reasoning_content') and resp.choices[0].message.reasoning_content:
                        reasoning = resp.choices[0].message.reasoning_content
                        print(f"    [INVOICE] Trying to parse reasoning analysis...")
                        
                        # Import re locally to ensure it's available
                        import re as re_local
                        
                        # Extract vendor_name - look for patterns like **Vendor Name**: "value" or 1. **Vendor**: value
                        # Avoid matching prompt instructions by requiring specific context
                        vendor_match = re_local.search(r'(?:1\.?\s*)?\*\*[Vv]endor[^\*]*(?:[Nn]ame)?\*\*[:\s]*["\']?([^"\'\n]{2,50}?)(?:["\']|$|\n)', reasoning)
                        if not vendor_match:
                            # Look for "Vendor: value" format in analysis text
                            vendor_match = re_local.search(r'(?:^|\n)\s*\.?\s*[Vv]endor[^:]{0,20}:\s*["\']?([^"\'\n]{2,50}?)(?:["\']|$|\n)', reasoning)
                        if vendor_match:
                            candidate = vendor_match.group(1).strip()
                            # Filter out prompt artifacts
                            if candidate and 'EUR/USD' not in candidate and 'string' not in candidate.lower() and len(candidate) > 1:
                                invoice_data['vendor_name'] = candidate
                                print(f"    [INVOICE] Parsed vendor: {invoice_data['vendor_name']}")
                        
                        # Extract invoice_number - look for Invoice Number patterns
                        num_match = re_local.search(r'(?:2\.?\s*)?\*\*[Ii]nvoice[^\*]*[Nn]umber\*\*[:\s]*["\']?([^"\'\n]+?)(?:["\']|$|\n)', reasoning)
                        if not num_match:
                            num_match = re_local.search(r'[Ff]actuur[Nn]ummer[:\s]*["\']?([^"\'\n]+?)(?:["\']|$|\n)', reasoning)
                        if not num_match:
                            num_match = re_local.search(r'(?:^|\n)\s*\.?\s*[Ii]nvoice[^:]{0,20}[Nn]um[^:]*:\s*["\']?([^"\'\n]{1,30}?)(?:["\']|$|\n)', reasoning)
                        if num_match:
                            candidate = num_match.group(1).strip()
                            if candidate and 'EUR/USD' not in candidate and 'string' not in candidate.lower():
                                invoice_data['invoice_number'] = candidate
                                print(f"    [INVOICE] Parsed invoice_number: {invoice_data['invoice_number']}")
                        
                        # Extract invoice_date - look for Date patterns
                        date_match = re_local.search(r'\*\*[Ii]nvoice[^\*]*[Dd]ate[^\*]*\*\*[:\s]*["\']?([^"\'\n]+)["\']?', reasoning)
                        if not date_match:
                            date_match = re_local.search(r'[Ff]actuurdatum[:\s]*["\']?([^"\'\n]+)["\']?', reasoning)
                        if date_match:
                            date_str = date_match.group(1).strip()
                            # Try to convert to YYYY-MM-DD
                            date_patterns = [
                                (r'(\d{2})/(\d{2})/(\d{4})', lambda m: f"{m.group(3)}-{m.group(2)}-{m.group(1)}"),
                                (r'(\d{2})-(\d{2})-(\d{4})', lambda m: f"{m.group(3)}-{m.group(2)}-{m.group(1)}"),
                                (r'(\d{4})-(\d{2})-(\d{2})', lambda m: f"{m.group(1)}-{m.group(2)}-{m.group(3)}"),
                            ]
                            for pattern, formatter in date_patterns:
                                dm = re_local.match(pattern, date_str)
                                if dm:
                                    invoice_data['invoice_date'] = formatter(dm)
                                    break
                            else:
                                invoice_data['invoice_date'] = date_str
                            print(f"    [INVOICE] Parsed invoice_date: {invoice_data['invoice_date']}")
                        
                        # Extract total_amount - look for amount patterns
                        amt_match = re_local.search(r'\*\*[Tt]otal[^\*]*[Aa]mount[^\*]*\*\*[:\s]*[$€£₹]?\s*([\d,]+\.?\d*)', reasoning)
                        if not amt_match:
                            amt_match = re_local.search(r'[Tt]otaal[:\s]*[$€£₹]?\s*([\d,]+\.?\d*)', reasoning)
                        if amt_match:
                            amt_str = amt_match.group(1).replace(',', '.')
                            try:
                                invoice_data['total_amount'] = float(amt_str)
                                print(f"    [INVOICE] Parsed total_amount: {invoice_data['total_amount']}")
                            except:
                                pass
                        
                        # Extract currency - look for actual currency codes, not prompt examples
                        curr_match = re_local.search(r'(?:^|\n)\s*\.?\s*[Cc]urrency[^:]*:\s*["\']?([A-Z]{3})(?:["\']|$|\n)', reasoning)
                        if curr_match:
                            candidate = curr_match.group(1)
                            # Make sure it's not from the prompt examples
                            if candidate in ['EUR', 'USD', 'INR', 'GBP']:
                                invoice_data['currency'] = candidate
                                print(f"    [INVOICE] Parsed currency: {invoice_data['currency']}")
                        elif '€' in text_for_extraction:
                            invoice_data['currency'] = 'EUR'
                        elif '$' in text_for_extraction and 'USD' in text_for_extraction.upper():
                            invoice_data['currency'] = 'USD'
                        elif '₹' in text_for_extraction or 'INR' in text_for_extraction.upper():
                            invoice_data['currency'] = 'INR'
                        
                        # Extract category - look for actual category values, not the list
                        cat_match = re_local.search(r'(?:^|\n)\s*\.?\s*[Cc]ategory[^:]*:\s*["\']?([A-Z][A-Z_]+)(?:["\']|$|\n)', reasoning)
                        if cat_match:
                            candidate = cat_match.group(1).strip()
                            # Validate it's an actual category, not the prompt list
                            valid_categories = ['TRAVEL', 'HOTEL', 'FOOD', 'CLIENT_ENTERTAINMENT', 'OFFICE_SUPPLIES', 'SOFTWARE', 'TRANSPORT', 'MEDICAL', 'OTHER']
                            if candidate in valid_categories:
                                invoice_data['category'] = candidate
                                print(f"    [INVOICE] Parsed category: {invoice_data['category']}")
                            elif candidate == 'MISC':
                                invoice_data['category'] = 'OTHER'
                                print(f"    [INVOICE] Parsed category: OTHER (from MISC)")
                        
                        # Extract employee/buyer name
                        emp_match = re_local.search(r'(?:^|\n)\s*\.?\s*(?:[Ee]mployee|[Bb]uyer|[Cc]ustomer)[^:]*:\s*["\']?([^"\'\n]{2,50}?)(?:["\']|$|\n)', reasoning)
                        if emp_match:
                            candidate = emp_match.group(1).strip()
                            if candidate and 'string' not in candidate.lower() and len(candidate) > 2:
                                invoice_data['employee_name'] = candidate
                                invoice_data['buyer_name'] = candidate
                                print(f"    [INVOICE] Parsed employee: {invoice_data['employee_name']}")
                except Exception as reasoning_err:
                    print(f"    [INVOICE] Reasoning extraction error: {reasoning_err}")
                
        except Exception as e:
            print(f"    [INVOICE] AI extraction failed: {e}")
    
    # Fallback: Regex extraction if AI failed
    if not invoice_data['total_amount'] or not invoice_data['vendor_name']:
        import re
        text_upper = text_for_extraction.upper()
        
        # Vendor extraction - look for company names near invoice/statement headers
        if not invoice_data['vendor_name']:
            # Try to find vendor name from common patterns
            # Pattern 1: Look for text after # FACTUUR or similar headers
            vendor_patterns = [
                r'#\s*([A-Z][A-Za-z0-9\s\.]+(?:Limited|Ltd|Inc|LLC|GmbH|BV|\.nl|\.com)?)\s*\n',
                r'^(?!Wi-Fi|MONTHLY|STATEMENT)([A-Z][A-Za-z][A-Za-z0-9\s]+(?:Limited|Ltd|Inc|LLC|GmbH|BV)?)\s*\n',
                r'from\s+([A-Z][A-Za-z0-9\s\.]+)\s*(?:on|for|dated)?',
            ]
            for pattern in vendor_patterns:
                match = re.search(pattern, text_for_extraction, re.MULTILINE | re.IGNORECASE)
                if match:
                    vendor = match.group(1).strip()
                    if len(vendor) > 2 and 'your' not in vendor.lower() and 'plan' not in vendor.lower():
                        invoice_data['vendor_name'] = vendor
                        print(f"    [INVOICE] Regex vendor: {vendor}")
                        break
            
            # If still no vendor, try to extract from first non-empty line after markdown headers
            if not invoice_data['vendor_name']:
                lines = [l.strip() for l in text_for_extraction.split('\n') if l.strip()]
                for line in lines[:10]:  # Check first 10 lines
                    # Skip headers and common non-vendor lines
                    if line.startswith('#') or line.startswith('Wi-Fi') or line.startswith('MONTHLY'):
                        continue
                    if len(line) > 2 and len(line) < 50 and not line.startswith('Email') and not line.startswith('Phone'):
                        # Check if it looks like a company name (has uppercase, not just an address)
                        if any(c.isupper() for c in line) and not line[0].isdigit():
                            invoice_data['vendor_name'] = line
                            print(f"    [INVOICE] Line extract vendor: {line}")
                            break
        
        # Total amount patterns
        if not invoice_data['total_amount']:
            total_patterns = [
                r'TOTAL[\s:]*(?:AMOUNT|PAYABLE)?[\s:]*[$€£₹]?\s*([\d,]+\.?\d*)',
                r'AMOUNT[\s:]*(?:DUE|PAYABLE)[\s:]*[$€£₹]?\s*([\d,]+\.?\d*)',
                r'TOTAL[^\d]{0,20}([\d,]+\.\d{2})',
            ]
            for pattern in total_patterns:
                match = re.search(pattern, text_upper)
                if match:
                    try:
                        amount_str = match.group(1).replace(',', '')
                        invoice_data['total_amount'] = float(amount_str)
                        print(f"    [INVOICE] Regex amount: {invoice_data['total_amount']}")
                        break
                    except:
                        pass
        
        # Currency detection
        if '₹' in text_for_extraction or 'INR' in text_upper:
            invoice_data['currency'] = 'INR'
        elif '$' in text_for_extraction or 'USD' in text_upper:
            invoice_data['currency'] = 'USD'
        elif '€' in text_for_extraction or 'EUR' in text_upper:
            invoice_data['currency'] = 'EUR'
    
    update_progress(doc_id, "ANALYZING", 75, "Running risk analysis...")
    
    # Run AI analysis for classification and risks
    analysis_result = {
        'reimbursement_decision': 'REVIEW',
        'decision_reason': 'Requires manual review',
        'risk_score': 0,
        'is_weekend': False,
        'is_alcohol': False,
        'is_duplicate': False,
        'exceeds_policy': False,
        'risk_flags': []
    }
    
    if kimi:
        try:
            invoice_summary = {
                'vendor': invoice_data['vendor_name'],
                'amount': invoice_data['total_amount'],
                'currency': invoice_data['currency'],
                'category': invoice_data['category']
            }
            
            resp = kimi.chat.completions.create(
                model="kimi-k2.5",
                messages=[
                    {"role": "system", "content": "Analyze invoice for policy compliance. Return compact JSON: {decision:APPROVED|REJECTED|REVIEW,reason:string,risk_score:number}. Risk score 0-100."},
                    {"role": "user", "content": f"Analyze: {json.dumps(invoice_summary)}"}
                ],
                temperature=1,
                max_tokens=300
            )
            
            content = resp.choices[0].message.content if resp.choices else None
            if content:
                content = content.strip()
                if '```' in content:
                    parts = content.split('```')
                    for part in parts:
                        if '{' in part and '}' in part:
                            content = part.replace('json', '').strip()
                            break
                
                start = content.find('{')
                end = content.rfind('}')
                if start >= 0 and end > start:
                    result = json.loads(content[start:end+1])
                    analysis_result['reimbursement_decision'] = result.get('decision') or result.get('reimbursement_decision') or 'REVIEW'
                    analysis_result['decision_reason'] = result.get('reason') or result.get('decision_reason') or 'Requires review'
                    analysis_result['risk_score'] = result.get('risk_score') or 50
                    print(f"    [INVOICE] Decision: {analysis_result['reimbursement_decision']} (Risk: {analysis_result['risk_score']})")
        except Exception as e:
            print(f"    [INVOICE] Analysis error: {e}")
    
    # Check for duplicates
    if invoice_data['invoice_number'] and invoice_data['total_amount']:
        cursor.execute("""
            SELECT id FROM invoices 
            WHERE organization_id = %s 
            AND id != %s 
            AND (invoice_number = %s OR (amount = %s AND vendor_name = %s))
            LIMIT 1
        """, (org_id, invoice_id, invoice_data['invoice_number'], 
              invoice_data['total_amount'], invoice_data['vendor_name']))
        if cursor.fetchone():
            analysis_result['is_duplicate'] = True
            analysis_result['risk_flags'].append('Possible duplicate invoice')
            analysis_result['risk_score'] = min(analysis_result['risk_score'] + 20, 100)
    
    update_progress(doc_id, "ANALYZING", 85, "Saving invoice data...")
    
    # Calculate risk level from score
    risk_level = 'LOW'
    if analysis_result['risk_score'] >= 80:
        risk_level = 'CRITICAL'
    elif analysis_result['risk_score'] >= 60:
        risk_level = 'HIGH'
    elif analysis_result['risk_score'] >= 40:
        risk_level = 'MEDIUM'
    
    # Determine reimbursable status
    reimbursable = 'PENDING'
    if analysis_result['reimbursement_decision'] == 'APPROVED':
        reimbursable = 'APPROVED'
    elif analysis_result['reimbursement_decision'] == 'REJECTED':
        reimbursable = 'REJECTED'
    
    # Update invoice record - use correct column names
    print(f"    [INVOICE] Saving to DB: invoice_id={invoice_id}, vendor={invoice_data['vendor_name']}, amount={invoice_data['total_amount']}, currency={invoice_data['currency']}")
    
    if invoice_id:
        cursor.execute("""
            UPDATE invoices SET
                vendor_name = %s,
                invoice_number = %s,
                invoice_date = %s::date,
                due_date = %s::date,
                amount = %s,
                tax_amount = %s,
                total = %s,
                vat_rate = %s,
                currency = %s,
                category = %s,
                employee_name = %s,
                reimbursable = %s,
                reimbursement_reason = %s,
                risk_score = %s,
                risk_level = %s,
                status = 'ANALYZED'
            WHERE id = %s
        """, (
            invoice_data['vendor_name'], invoice_data['invoice_number'],
            invoice_data['invoice_date'], invoice_data['due_date'],
            invoice_data['subtotal'], invoice_data['tax_amount'], invoice_data['total_amount'],
            None,  # vat_rate - could calculate from data
            invoice_data['currency'], invoice_data['category'],
            invoice_data['employee_name'],
            reimbursable, analysis_result['decision_reason'],
            analysis_result['risk_score'], risk_level,
            invoice_id
        ))
        print(f"    [INVOICE] Database updated for invoice_id={invoice_id}")
    else:
        print(f"    [INVOICE] ERROR: No invoice_id, cannot update database!")
    
    # Add line items
    if invoice_data['line_items']:
        cursor.execute("DELETE FROM invoice_line_items WHERE invoice_id = %s", (invoice_id,))
        for item in invoice_data['line_items']:
            cursor.execute("""
                INSERT INTO invoice_line_items (id, invoice_id, description, quantity, unit_price, amount, tax_rate, category)
                VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s, %s)
            """, (
                invoice_id, item.get('description', ''),
                item.get('quantity'), item.get('unit_price'), item.get('total_price'),
                None, invoice_data['category']
            ))
    
    # Add risk flags
    if analysis_result['risk_flags']:
        cursor.execute("DELETE FROM invoice_risk_flags WHERE invoice_id = %s", (invoice_id,))
        for flag in analysis_result['risk_flags']:
            severity = 'HIGH' if 'duplicate' in flag.lower() or 'fraud' in flag.lower() else 'MEDIUM'
            flag_type = 'duplicate' if 'duplicate' in flag.lower() else 'policy_violation' if 'policy' in flag.lower() else 'other'
            cursor.execute("""
                INSERT INTO invoice_risk_flags (id, invoice_id, flag_type, severity, title, description)
                VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s)
            """, (invoice_id, flag_type, severity, flag[:100], flag))
    
    conn.commit()
    
    # Save basic extraction for search
    cursor.execute("""
        INSERT INTO document_extractions (id, document_id, content, markdown, extracted_at, updated_at)
        VALUES (gen_random_uuid()::text, %s, %s, %s, NOW(), NOW())
        ON CONFLICT (document_id) DO UPDATE SET
            content = EXCLUDED.content,
            markdown = EXCLUDED.markdown,
            updated_at = NOW()
    """, (doc_id, parsed_text, parsed_md))
    
    conn.commit()
    
    # Create a simple tree artifact for consistency
    tree_dict = {
        'title': f"Invoice: {invoice_data['vendor_name'] or 'Unknown'}",
        'doc_name': invoice_data['vendor_name'] or 'Invoice',
        'doc_description': f"Invoice {invoice_data['invoice_number'] or ''} from {invoice_data['vendor_name'] or 'Unknown'} for {invoice_data['total_amount']} {invoice_data['currency']}",
        'nodes': [
            {'title': 'Vendor', 'content': invoice_data['vendor_name'] or 'N/A'},
            {'title': 'Amount', 'content': f"{invoice_data['total_amount']} {invoice_data['currency']}"},
            {'title': 'Category', 'content': invoice_data['category']},
        ],
        'invoice_data': invoice_data,
        'analysis': analysis_result
    }
    
    tree_artifact = {
        'book_name': file_name.replace('.pdf', ''),
        'file_name': file_name,
        'metadata': {'document_id': doc_id, 'organization_id': org_id, 'is_invoice': True},
        'tree': tree_dict,
        'risks': [{'type': flag, 'description': flag, 'severity': 'Medium'} for flag in analysis_result['risk_flags']]
    }
    
    # Save artifacts
    save_tree_artifact(file_name.replace('.pdf', ''), tree_artifact)
    
    # Update master index
    update_master_index_incremental(file_name.replace('.pdf', ''), tree_artifact)
    
    print(f"  [INVOICE] Processing complete!")
    return True


def process_document(doc: Dict, cursor, conn) -> bool:
    """
    Main processing pipeline matching architecture:
    A->B->C->D->E->F->G->H->I->J->K
    
    Branches based on document_type:
    - INVOICE: Use invoice-specific processing
    - Others: Standard legal document processing
    """
    doc_id = doc['id']
    file_name = doc['file_name']
    storage_key = doc['storage_key']
    org_id = doc['organization_id']
    doc_type = doc.get('documentType', 'OTHER')
    
    # Create book name from file
    book_name = file_name.replace('.pdf', '').replace(' ', '_')
    file_path = project_root / storage_key
    
    print(f"\n[PROCESSING] {file_name}")
    update_progress(doc_id, "PENDING", 0, "Starting processing...")
    
    # ============================================================
    # C: Hash + Change Detection (SHA256 per PDF)
    # ============================================================
    print("  [C] Computing file hash...")
    if not file_path.exists():
        print(f"    [ERROR] File not found: {file_path}")
        return False
    
    current_hash = compute_file_hash(file_path)
    
    # Check for existing artifacts
    existing_parse = load_parse_artifact(book_name)
    existing_tree = load_tree_artifact(book_name)
    
    if existing_parse and existing_parse.get('hash') == current_hash:
        print(f"    [C] File unchanged, using cached artifacts")

        # Fix #3: Full short-circuit — if doc is already ANALYZED, skip ALL downstream
        cursor.execute("SELECT status FROM documents WHERE id = %s", (doc_id,))
        db_row = cursor.fetchone()
        if db_row and db_row['status'] == 'ANALYZED':
            print(f"    [C] Already ANALYZED with same hash — full pipeline skip")
            update_progress(doc_id, "COMPLETED", 100, "Already processed (unchanged)")
            return True

        # For INVOICE documents, we need to run AI extraction even with cached parse
        if doc_type == 'INVOICE':
            print(f"    [C] Invoice document with cached parse - running AI extraction")
            extracted_text = existing_parse.get('text', '')
            extracted_md = existing_parse.get('markdown', '')
            success = process_invoice_document(doc, cursor, conn, extracted_text, extracted_md)
            if success:
                cursor.execute("""
                    UPDATE documents SET status = 'ANALYZED', processing_stage = 'COMPLETED', processed_at = NOW()
                    WHERE id = %s
                """, (doc_id,))
                conn.commit()
                invalidate_redis_cache(doc_id)
                update_progress(doc_id, "COMPLETED", 100, "Invoice processing complete!")
            return success

        # Not yet ANALYZED (e.g., previous run failed mid-way) — replay DB writes + master index
        update_progress(doc_id, "CACHED", 50, "Using cached artifacts")
        
        # Build proper tree_artifact structure for save_to_database
        tree_artifact = existing_tree if existing_tree else {
            'tree': {'root': existing_parse},
            'metadata': {'document_id': doc_id, 'organization_id': org_id},
            'book_name': book_name,
            'file_name': file_name,
            'hash': current_hash,
            'risks': []
        }
        # Ensure tree_artifact has required structure
        if not isinstance(tree_artifact, dict):
            tree_artifact = {
                'tree': {'root': existing_parse},
                'metadata': {'document_id': doc_id, 'organization_id': org_id},
                'book_name': book_name,
                'file_name': file_name,
                'hash': current_hash,
                'risks': []
            }
        if 'tree' not in tree_artifact:
            tree_artifact['tree'] = {'root': existing_parse}
        if 'metadata' not in tree_artifact:
            tree_artifact['metadata'] = {'document_id': doc_id, 'organization_id': org_id}
        
        save_to_database(doc_id, existing_parse, tree_artifact, cursor, conn)
        
        # Ensure master index also has this document (may have been missed in previous crash)
        update_master_index_incremental(book_name, tree_artifact)
        
        # Mark document as ANALYZED to prevent reprocessing
        cursor.execute("""
            UPDATE documents 
            SET status = 'ANALYZED', processing_stage = NULL, processing_error = NULL, processed_at = NOW()
            WHERE id = %s
        """, (doc_id,))
        conn.commit()
        
        update_progress(doc_id, "COMPLETED", 100, "Recovery complete (cached artifacts)")
        return True
    
    print(f"    [C] File changed or new, processing...")
    update_progress(doc_id, "EXTRACTING", 10, "File changed, reprocessing...")
    
    # ============================================================
    # D: LlamaCloud Parse (extract markdown/text/items)
    # ============================================================
    print("  [D] LlamaCloud Parse...")
    update_progress(doc_id, "EXTRACTING", 20, "Parsing with LlamaCloud...")
    
    try:
        result = llama.parse(str(file_path))
        
        # Extract text and markdown
        extracted_text = ""
        extracted_md = ""
        
        text_data = getattr(result, 'text', None)
        if text_data:
            if hasattr(text_data, 'pages'):
                extracted_text = '\n\n'.join([p.text for p in text_data.pages if hasattr(p, 'text')])
            elif isinstance(text_data, str):
                extracted_text = text_data
        
        # Get markdown from result.pages (per-page markdown)
        if hasattr(result, 'pages') and result.pages:
            page_contents = []
            for p in result.pages:
                # Try markdown, md, or text attributes
                content = getattr(p, 'markdown', None) or getattr(p, 'md', None) or getattr(p, 'text', '')
                if content:
                    page_contents.append(content)
            extracted_md = '\n\n'.join(page_contents)
        else:
            # Fallback to top-level markdown
            md_data = getattr(result, 'markdown', None)
            if isinstance(md_data, str):
                extracted_md = md_data
            else:
                extracted_md = ''
        
        print(f"    Extracted: {len(extracted_text):,} chars text, {len(extracted_md):,} chars markdown")
        
        # Validate extraction quality
        total_content = len(extracted_text) + len(extracted_md)
        if total_content < 50:
            print(f"    [ERROR] Extraction failed: insufficient content (text={len(extracted_text)}, md={len(extracted_md)})")
            update_progress(doc_id, "ERROR", 0, "Extraction failed: PDF appears empty or unreadable")
            return False
        
        update_progress(doc_id, "EXTRACTING", 40, f"Extracted {total_content:,} characters")
        
    except Exception as e:
        print(f"    [ERROR] Extraction failed: {e}")
        update_progress(doc_id, "ERROR", 0, f"Extraction failed: {str(e)[:100]}")
        return False
    
    # ============================================================
    # E: Store Parse Artifact {book}_parse.json
    # ============================================================
    print("  [E] Storing parse artifact...")
    parse_artifact = {
        'book_name': book_name,
        'file_name': file_name,
        'hash': current_hash,
        'extracted_at': datetime.now(timezone.utc).isoformat(),
        'metadata': {
            'document_id': doc_id,
            'organization_id': org_id,
            'file_size': file_path.stat().st_size,
        },
        'text': extracted_text,
        'markdown': extracted_md,
    }
    save_parse_artifact(book_name, parse_artifact)
    update_progress(doc_id, "INDEXING", 50, "Parse artifact saved")
    
    # ============================================================
    # INVOICE BRANCH: Skip PageIndex for invoice documents
    # ============================================================
    if doc_type == 'INVOICE':
        print(f"  [BRANCH] Document type is INVOICE, using invoice processing pipeline")
        success = process_invoice_document(doc, cursor, conn, extracted_text, extracted_md)
        if success:
            # Mark document as analyzed
            cursor.execute("""
                UPDATE documents SET status = 'ANALYZED', processing_stage = 'COMPLETED', processed_at = NOW()
                WHERE id = %s
            """, (doc_id,))
            conn.commit()
            invalidate_redis_cache(doc_id)
            update_progress(doc_id, "COMPLETED", 100, "Invoice processing complete!")
        return success
    
    # ============================================================
    # F: PageIndex Indexing (from_text/markdown LLM-assisted structure)
    # ============================================================
    print("  [F] PageIndex Indexing (LLM-assisted tree building)...")
    update_progress(doc_id, "INDEXING", 60, "Building PageIndex tree structure...")
    
    # Fix #5: Normalize markdown before PageIndex (removes noise, improves tree quality)
    normalized_md = normalize_markdown(extracted_md)

    # Save normalized markdown to temp file for PageIndex
    temp_md_path = data_dir / f"{book_name}_temp.md"
    with open(temp_md_path, 'w', encoding='utf-8') as f:
        f.write(normalized_md)
    
    try:
        # Load config with Kimi model
        config_loader = ConfigLoader()
        opt = config_loader.load({
            'model': 'kimi-k2.5',  # Use Kimi instead of GPT-4o
            'if_add_node_summary': 'yes',
            'if_add_doc_description': 'yes',
            'if_add_node_text': 'yes',
            'if_add_node_id': 'yes'
        })
        
        # Run PageIndex on markdown
        pageindex_result = asyncio.run(md_to_tree(
            md_path=str(temp_md_path),
            if_thinning=False,
            min_token_threshold=5000,
            if_add_node_summary=opt.if_add_node_summary,
            summary_token_threshold=200,
            model=opt.model,
            if_add_doc_description=opt.if_add_doc_description,
            if_add_node_text=opt.if_add_node_text,
            if_add_node_id=opt.if_add_node_id
        ))
        
        # Clean up temp file
        temp_md_path.unlink(missing_ok=True)
        
        # Extract structure and description from PageIndex result
        if 'structure' in pageindex_result:
            tree_dict = pageindex_result['structure']
            doc_description = pageindex_result.get('doc_description', '')
            doc_name = pageindex_result.get('doc_name', book_name)
        else:
            tree_dict = pageindex_result
            doc_description = ''
            doc_name = book_name
        
        # Handle case where tree_dict is a list (wrap in dict)
        if isinstance(tree_dict, list):
            tree_dict = {'nodes': tree_dict, 'title': book_name}
        
        # Add document-level metadata
        tree_dict['doc_name'] = doc_name
        tree_dict['doc_description'] = doc_description
        
        print(f"    [F] PageIndex tree built: {len(tree_dict.get('nodes', []))} top-level nodes")
        if doc_description:
            print(f"    [F] Document description: {doc_description[:100]}...")
        update_progress(doc_id, "INDEXING", 75, f"Tree built with {len(tree_dict.get('nodes', []))} sections")
        
    except Exception as e:
        print(f"    [F] PageIndex error: {e}")
        import traceback
        traceback.print_exc()
        # Fallback to simple structure
        tree_dict = {
            'title': book_name,
            'content': extracted_md[:5000],
            'nodes': [],
            'metadata': {'error': str(e)}
        }
        temp_md_path.unlink(missing_ok=True)
    
    # ============================================================
    # H: Risk Detection using Kimi
    # ============================================================
    print("  [H] Detecting legal risks...")
    update_progress(doc_id, "ANALYZING", 76, "Analyzing risks...")
    
    risks = []
    if kimi and len(extracted_text) > 500:
        try:
            sample = extracted_text[:10000]
            resp = kimi.chat.completions.create(
                model="kimi-k2.5",
                messages=[
                    {"role": "system", "content": "You are a legal risk analyst. Identify 3-5 potential legal risks, compliance issues, or important caveats in this document. For each risk, provide: 1) Risk type/category, 2) Brief description, 3) Severity (Low/Medium/High). Format: 'RISK: [type] | [description] | [severity]'"},
                    {"role": "user", "content": f"Analyze this document for legal risks:\n\n{sample}"}
                ],
                temperature=1,
                max_tokens=1500
            )
            result = resp.choices[0].message.content.strip()
            
            # Parse risks
            for line in result.split('\n'):
                if 'RISK:' in line.upper() or '|' in line:
                    parts = line.split('|')
                    if len(parts) >= 2:
                        risk_type = parts[0].replace('RISK:', '').strip()
                        description = parts[1].strip() if len(parts) > 1 else ''
                        severity = parts[2].strip() if len(parts) > 2 else 'Medium'
                        risks.append({
                            'type': risk_type,
                            'description': description,
                            'severity': severity
                        })
            
            print(f"    [H] Detected {len(risks)} risks")
        except Exception as e:
            print(f"    [H] Risk detection failed: {e}")
    
    # ============================================================
    # G: Store Tree Artifact {book}_tree.json
    # ============================================================
    print("  [G] Storing tree artifact...")
    tree_artifact = {
        'book_name': book_name,
        'file_name': file_name,
        'hash': current_hash,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'metadata': {
            'document_id': doc_id,
            'organization_id': org_id,
        },
        'tree': tree_dict,
        'risks': risks,
    }
    save_tree_artifact(book_name, tree_artifact)
    update_progress(doc_id, "ANALYZING", 80, "Tree artifact saved")
    
    # ============================================================
    # Save to database for UI consistency
    # ============================================================
    save_to_database(doc_id, parse_artifact, tree_artifact, cursor, conn)
    
    # ============================================================
    # J→K: Incremental Master Index Update
    # ============================================================
    update_master_index_incremental(book_name, tree_artifact)
    
    update_progress(doc_id, "COMPLETED", 100, "Processing complete!")
    print(f"  [DONE] Document processed successfully\n")
    return True

def invalidate_redis_cache(doc_id: str):
    """Invalidate Redis cache when document is updated"""
    try:
        redis_client.delete(f'tree:{doc_id}')
        redis_client.delete('master:index')
        # Invalidate query cache patterns
        for key in redis_client.scan_iter(match=f'query:{doc_id}:*'):
            redis_client.delete(key)
        print(f"    [Redis] Cache invalidated for {doc_id}")
    except Exception as e:
        print(f"    [Redis] Cache invalidation failed: {e}")

def extract_key_points_from_tree(tree_dict: Dict) -> List[str]:
    """Extract key points from tree node titles/summaries"""
    key_points = []
    nodes = tree_dict.get('nodes', [])

    for node in nodes[:8]:  # Top 8 nodes
        title = node.get('title', '')
        summary = node.get('summary', '') or node.get('prefix_summary', '')

        if title and len(title) > 5:
            # Use summary if available, otherwise just title
            if summary and len(summary) > 20:
                key_points.append(f"{title}: {summary[:150]}")
            else:
                key_points.append(title)

    return key_points[:6]  # Max 6 key points

def collect_search_chunks(tree_dict: Dict, doc_id: str, org_id: str, matter_id: str = None) -> List[Dict]:
    """Collect all nodes from tree for search indexing (Fix: split large chunks to avoid index limits)"""
    chunks = []
    MAX_CHUNK_SIZE = 1500  # Keep under PostgreSQL's ~2704 byte index limit

    def traverse(node: Dict, path: List[str], parent_titles: List[str], depth: int = 0):
        if depth > 6:  # Max depth
            return

        title = node.get('title', '')
        text = node.get('text', '') or node.get('content', '') or node.get('summary', '')
        node_id = node.get('node_id', '') or node.get('id', '')

        if text and len(text) > 30:  # Only index meaningful content
            # Build section path string
            section_path = ' > '.join(path + [title]) if title else ' > '.join(path)

            # Extract section number (e.g., "2.1.3")
            section_match = re.match(r'^(\d+(?:\.\d+)*)', title)
            section_number = section_match.group(1) if section_match else None

            # Compute content hash
            content_hash = hashlib.md5(text.encode('utf-8')).hexdigest()[:16]

            # FIX: Split very large text into multiple searchable chunks
            # This ensures full text is searchable, not just first 2000 chars
            if len(text) > MAX_CHUNK_SIZE:
                # Split into overlapping chunks for better search coverage
                words = text.split()
                current_chunk = []
                current_len = 0
                chunk_num = 0
                
                for word in words:
                    word_len = len(word) + 1  # +1 for space
                    if current_len + word_len > MAX_CHUNK_SIZE and current_chunk:
                        # Save current chunk
                        chunk_text = ' '.join(current_chunk)
                        chunks.append({
                            'doc_id': doc_id,
                            'org_id': org_id,
                            'matter_id': matter_id,
                            'chunk_id': f"{node_id or content_hash}_{chunk_num}",
                            'section_path': section_path[:500],
                            'section_number': section_number,
                            'text': chunk_text,
                            'chunk_type': 'section' if node.get('nodes') else 'paragraph',
                            'level': depth,
                            'path': path + [title] if title else path,
                            'tree_node_id': node_id,
                            'hash': hashlib.md5(chunk_text.encode('utf-8')).hexdigest()[:16],
                            'section_depth': depth,
                            'parent_titles': parent_titles[:],
                        })
                        # Start new chunk with overlap (last 50 words for context)
                        overlap = current_chunk[-50:] if len(current_chunk) > 50 else current_chunk
                        current_chunk = overlap + [word]
                        current_len = sum(len(w) + 1 for w in current_chunk)
                        chunk_num += 1
                    else:
                        current_chunk.append(word)
                        current_len += word_len
                
                # Don't forget the last chunk
                if current_chunk:
                    chunk_text = ' '.join(current_chunk)
                    chunks.append({
                        'doc_id': doc_id,
                        'org_id': org_id,
                        'matter_id': matter_id,
                        'chunk_id': f"{node_id or content_hash}_{chunk_num}",
                        'section_path': section_path[:500],
                        'section_number': section_number,
                        'text': chunk_text,
                        'chunk_type': 'section' if node.get('nodes') else 'paragraph',
                        'level': depth,
                        'path': path + [title] if title else path,
                        'tree_node_id': node_id,
                        'hash': hashlib.md5(chunk_text.encode('utf-8')).hexdigest()[:16],
                        'section_depth': depth,
                        'parent_titles': parent_titles[:],
                    })
            else:
                # Small chunk - add as-is
                chunks.append({
                    'doc_id': doc_id,
                    'org_id': org_id,
                    'matter_id': matter_id,
                    'chunk_id': node_id or content_hash,
                    'section_path': section_path[:500],
                    'section_number': section_number,
                    'text': text,
                    'chunk_type': 'section' if node.get('nodes') else 'paragraph',
                    'level': depth,
                    'path': path + [title] if title else path,
                    'tree_node_id': node_id,
                    'hash': content_hash,
                    'section_depth': depth,
                    'parent_titles': parent_titles[:],
                })

        # Traverse children
        child_parents = parent_titles + [title] if title else parent_titles
        for child in node.get('nodes', []):
            child_path = path + [title] if title else path
            traverse(child, child_path, child_parents, depth + 1)

    # Start traversal from top-level nodes
    for node in tree_dict.get('nodes', []):
        traverse(node, [], [], 0)

    return chunks

def save_to_database(doc_id: str, parse_artifact: Dict, tree_artifact: Dict, cursor, conn):
    """Save artifacts to database and invalidate cache"""
    try:
        # Safely extract metadata with fallbacks
        if not isinstance(tree_artifact, dict):
            tree_artifact = {}
        metadata = tree_artifact.get('metadata') or {}
        if not isinstance(metadata, dict):
            metadata = {}
        org_id = metadata.get('organization_id', '')

        # Save extraction
        cursor.execute("""
            INSERT INTO document_extractions (id, document_id, content, markdown, extracted_at, updated_at)
            VALUES (gen_random_uuid()::text, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (document_id) DO UPDATE SET
                content = EXCLUDED.content,
                markdown = EXCLUDED.markdown,
                updated_at = NOW()
        """, (doc_id, parse_artifact['text'], parse_artifact['markdown']))

        # Save tree (include full artifact with risks)
        tree_data = tree_artifact.get('tree') or {}
        if not isinstance(tree_data, dict):
            tree_data = {}
        tree_data_for_db = {
            **tree_data,
            'risks': tree_artifact.get('risks', []),
            'doc_name': tree_data.get('doc_name'),
            'doc_description': tree_data.get('doc_description'),
        }
        cursor.execute("""
            INSERT INTO pageindex_trees (id, document_id, tree_data, metadata, created_at, updated_at)
            VALUES (gen_random_uuid()::text, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (document_id) DO UPDATE SET
                tree_data = EXCLUDED.tree_data,
                metadata = EXCLUDED.metadata,
                updated_at = NOW()
        """, (doc_id, json.dumps(tree_data_for_db), json.dumps(metadata)))

        # ============================================================
        # NEW: Save AI-generated summary to document_summaries table
        # ============================================================
        doc_description = tree_data.get('doc_description', '')
        key_points = extract_key_points_from_tree(tree_data)
        risks_json = json.dumps(tree_artifact.get('risks', []))

        # If no doc_description from PageIndex, generate a basic one
        if not doc_description or len(doc_description) < 20:
            doc_name = tree_data.get('doc_name', tree_artifact.get('file_name', 'Document'))
            nodes = tree_data.get('nodes', [])
            if nodes:
                titles = [n.get('title', '') for n in nodes[:5] if n.get('title')]
                doc_description = f"This document '{doc_name}' covers the following topics: {', '.join(titles)}."
            else:
                doc_description = f"Document '{doc_name}' has been analyzed and indexed."

        # Ensure we have key points
        if not key_points:
            key_points = ['Document structure analyzed', 'Content indexed for search']

        cursor.execute("""
            INSERT INTO document_summaries (id, document_id, summary, key_points, risks, metadata, created_at, updated_at)
            VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (document_id) DO UPDATE SET
                summary = EXCLUDED.summary,
                key_points = EXCLUDED.key_points,
                risks = EXCLUDED.risks,
                metadata = EXCLUDED.metadata,
                updated_at = NOW()
        """, (doc_id, doc_description, key_points, risks_json, json.dumps({'source': 'pageindex'})))

        print(f"    [Summary] Saved: {doc_description[:80]}...")
        print(f"    [Summary] Key points: {len(key_points)}")

        # ============================================================
        # NEW: Populate search_chunks for full-text search
        # ============================================================
        # First, delete existing chunks for this document
        cursor.execute("DELETE FROM search_chunks WHERE document_id = %s", (doc_id,))

        # Create document_indexes entry if not exists
        cursor.execute("""
            INSERT INTO document_indexes (id, document_id, matter_id, indexed_at, model_used, created_at, updated_at)
            VALUES (gen_random_uuid()::text, %s, %s, NOW(), 'kimi-k2.5', NOW(), NOW())
            ON CONFLICT (document_id) DO UPDATE SET
                indexed_at = NOW(),
                updated_at = NOW()
        """, (doc_id, metadata.get('matter_id', doc_id)))

        # Collect and insert search chunks
        chunks = collect_search_chunks(tree_data, doc_id, org_id)

        if chunks:
            chunk_values = []
            for chunk in chunks:
                path_array = chunk['path'] if chunk['path'] else []
                parent_titles_array = chunk.get('parent_titles', [])
                chunk_values.append((
                    chunk['doc_id'],
                    chunk['matter_id'] or doc_id,
                    chunk['org_id'],
                    chunk['chunk_id'],
                    chunk['section_path'],
                    chunk['section_number'],
                    chunk['text'],
                    chunk['text'],  # For tsvector
                    chunk['chunk_type'],
                    chunk['level'],
                    path_array,
                    chunk['tree_node_id'],
                    chunk['hash'],
                    chunk.get('section_depth', chunk['level']),
                    parent_titles_array,
                ))

            # Chunks are now pre-split to <1500 chars, safe for indexing
            execute_values(cursor, """
                INSERT INTO search_chunks (
                    id, document_id, matter_id, org_id, chunk_id,
                    section_path, section_number, text, text_vector, embedding,
                    chunk_type, level, path, tree_node_id, hash, pipeline_version,
                    section_depth, parent_titles,
                    created_at, updated_at
                ) VALUES %s
            """, chunk_values, template="""(
                    gen_random_uuid()::text, %s, %s, %s, %s,
                    %s, %s, %s, to_tsvector('english', %s), ARRAY[]::float8[],
                    %s, %s, %s::text[], %s, %s, '1.0.0',
                    %s, %s::text[],
                    NOW(), NOW()
                )""")

        print(f"    [Search] Indexed {len(chunks)} chunks for search")

        # Update document status
        cursor.execute("""
            UPDATE documents
            SET status = 'ANALYZED', processed_at = NOW()
            WHERE id = %s
        """, (doc_id,))

        conn.commit()

        # Invalidate Redis cache
        invalidate_redis_cache(doc_id)

    except Exception as e:
        print(f"    [DB save error: {e}]")
        import traceback
        traceback.print_exc()
        conn.rollback()

def update_master_index_incremental(book_name: str, tree_artifact: Dict):
    """
    J→K: Incremental Master Index Update
    Only adds/updates the changed document instead of rebuilding entire index
    """
    try:
        # Safely extract tree_data
        if not isinstance(tree_artifact, dict):
            tree_artifact = {}
        tree_data = tree_artifact.get('tree') or {}
        if not isinstance(tree_data, dict):
            tree_data = {}
        
        master_path = project_root / 'master_index.json'
        
        # Load existing master index or create new
        if master_path.exists():
            with open(master_path, 'r', encoding='utf-8') as f:
                master_index = json.load(f)
        else:
            master_index = {
                'version': '1.0',
                'created_at': datetime.now(timezone.utc).isoformat(),
                'document_count': 0,
                'books': [],
                'root': {
                    'title': 'Legal Corpus',
                    'nodes': [],
                    'metadata': {}
                }
            }
        
        # Find if book already exists
        books = master_index.get('books', [])
        existing_idx = None
        for i, book in enumerate(books):
            if book['book_name'] == book_name:
                existing_idx = i
                break
        
        # Create book entry (include risks)
        book_entry = {
            'book_name': tree_artifact.get('book_name', 'Unknown'),
            'file_name': tree_artifact.get('file_name', 'Unknown'),
            'hash': tree_artifact.get('hash', ''),
            'tree': {
                **tree_data,
                'risks': tree_artifact.get('risks', [])
            }
        }
        
        # Update or append
        if existing_idx is not None:
            books[existing_idx] = book_entry
            print(f"    [J→K] Updated existing book in master index: {book_name}")
        else:
            books.append(book_entry)
            print(f"    [J→K] Added new book to master index: {book_name}")
        
        # Update master index
        master_index['books'] = books
        master_index['document_count'] = len(books)
        master_index['root'] = {
            'title': 'Legal Corpus',
            'nodes': [b['tree'] for b in books],
            'metadata': {
                'document_count': len(books),
                'updated_at': datetime.now(timezone.utc).isoformat(),
            }
        }
        
        # Fix #1: Atomic write — write to .tmp, rename, keep .prev backup
        tmp_path = project_root / 'master_index.tmp'
        prev_path = project_root / 'master_index.prev.json'

        with open(tmp_path, 'w', encoding='utf-8') as f:
            json.dump(master_index, f, ensure_ascii=False, indent=2)

        # Keep previous version as backup
        if master_path.exists():
            # Remove old .prev if it exists, then rename current -> .prev
            if prev_path.exists():
                prev_path.unlink()
            master_path.rename(prev_path)

        # Atomic rename: .tmp -> master_index.json
        tmp_path.rename(master_path)

        print(f"    [K] Master index updated atomically: {len(books)} documents total")

    except Exception as e:
        print(f"    [Master index error: {e}]")
        # If atomic write failed, try to restore from .prev
        prev_path = project_root / 'master_index.prev.json'
        master_path = project_root / 'master_index.json'
        if not master_path.exists() and prev_path.exists():
            prev_path.rename(master_path)
            print(f"    [K] Restored master index from backup")

def update_master_index(cursor):
    """Legacy: Full rebuild (kept for compatibility)"""
    pass  # Now using incremental updates

# Main processing loop
print("\n[INFO] Starting main processing loop...")
print("[INFO] Waiting for documents to process...\n")

while running:
    conn = None
    try:
        conn = db_pool.getconn()
        cursor = conn.cursor()

        # Get ONE unprocessed document
        cursor.execute("""
            SELECT id, name, file_name, storage_key, organization_id, file_size, "documentType"
            FROM documents
            WHERE status IN ('UPLOADED', 'PROCESSING')
            ORDER BY created_at
            LIMIT 1
        """)
        doc = cursor.fetchone()

        if doc:
            process_document(doc, cursor, conn)
            print(f"[QUEUE] Checking for more documents...")

        cursor.close()
        db_pool.putconn(conn)
        conn = None

        time.sleep(3)

    except Exception as e:
        print(f"\n[ERROR] Main loop error: {e}")
        import traceback
        traceback.print_exc()
        if conn:
            try:
                db_pool.putconn(conn, close=True)
            except Exception:
                pass
        time.sleep(5)
