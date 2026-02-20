#!/usr/bin/env python3
"""
Adverse Media Check Worker
Processes adverse media checks from Redis queue

Flow:
1. Fetch web search results (DuckDuckGo HTML endpoint)
2. Call Kimi k2.5 LLM to analyze and summarize adverse media findings
3. Persist results to database for UI display
"""
import os
import sys
import json
import time
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

import aioredis
import psycopg2
import aiohttp
from bs4 import BeautifulSoup
from urllib.parse import quote_plus

from openai import OpenAI

# Database connection
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/legal_ai')
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')

MOONSHOT_API_KEY = os.getenv('MOONSHOT_API_KEY') or os.getenv('KIMI_API_KEY')
ADVERSE_MEDIA_RETENTION_DAYS = int(os.getenv('ADVERSE_MEDIA_RETENTION_DAYS', '90'))

# Initialize Kimi (Moonshot) client if configured
kimi_client: Optional[OpenAI] = None
if MOONSHOT_API_KEY:
    try:
        kimi_client = OpenAI(
            api_key=MOONSHOT_API_KEY,
            base_url="https://api.moonshot.ai/v1",
        )
        print(f"[Worker] Kimi client initialized successfully")
    except Exception as e:
        print(f"[Worker] Failed to initialize Kimi client: {e}")
else:
    print(f"[Worker] WARNING: MOONSHOT_API_KEY not set - LLM analysis will be skipped")


async def fetch_duckduckgo_results(
    query: str,
    max_results: int = 10,
) -> List[Dict[str, Any]]:
    """
    Lightweight web search using DuckDuckGo HTML endpoint.
    This avoids dedicated paid APIs and uses simple scraping.
    """
    search_url = f"https://duckduckgo.com/html/?q={quote_plus(query)}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }

    results: List[Dict[str, Any]] = []

    try:
        async with aiohttp.ClientSession(headers=headers) as session:
            async with session.get(search_url, timeout=20, ssl=False) as resp:
                if resp.status != 200:
                    print(f"[Worker] DuckDuckGo search failed with status {resp.status}")
                    return results

                html = await resp.text()
                print(f"[Worker] DuckDuckGo returned {len(html)} bytes")
    except Exception as e:
        print(f"[Worker] Error fetching DuckDuckGo results: {e}")
        return results

    try:
        soup = BeautifulSoup(html, "html.parser")
        
        # Try multiple selectors for DuckDuckGo results (they change over time)
        selectors = [
            ".result",           # Classic
            ".web-result",       # Alternative
            "[data-result]",     # Data attribute
            ".result__body",     # Body container
        ]
        
        result_elements = []
        for selector in selectors:
            result_elements = soup.select(selector)
            if result_elements:
                print(f"[Worker] Found {len(result_elements)} results with selector: {selector}")
                break

        for result in result_elements:
            # Try multiple link selectors
            link_el = (result.select_one("a.result__a") or 
                      result.select_one("h2 a") or 
                      result.select_one("a[href^='http']") or
                      result.select_one("a"))
            
            if not link_el:
                continue

            title = link_el.get_text(" ", strip=True)
            url = link_el.get("href", "")
            
            # Clean URL (remove DuckDuckGo redirects)
            if url.startswith("//"):
                url = "https:" + url
            elif url.startswith("/"):
                continue  # Skip internal links

            # Try multiple snippet selectors
            snippet_el = (result.select_one(".result__snippet") or 
                         result.select_one(".result__snippet.js-result-snippet") or
                         result.select_one("[class*='snippet']") or
                         result.select_one("p"))
            
            snippet = snippet_el.get_text(" ", strip=True) if snippet_el else ""

            if not title and not snippet:
                continue

            results.append({
                "source": "Web Search",
                "title": title,
                "summary": snippet,
                "url": url,
                "date": None,
            })

            if len(results) >= max_results:
                break
                
    except Exception as e:
        print(f"[Worker] Error parsing DuckDuckGo HTML: {e}")
        import traceback
        traceback.print_exc()

    print(f"[Worker] Returning {len(results)} web search results")
    return results


async def call_kimi_for_adverse_media(
    company_name: str,
    jurisdiction: Optional[str],
    search_results: List[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """
    Use Kimi (Moonshot k2.5) to synthesize adverse media assessment from search results.
    Returns a JSON-compatible dict or None on failure.
    """
    if not kimi_client:
        print("[Worker] Kimi client not configured, skipping LLM analysis.")
        return None

    if not search_results:
        print("[Worker] No search results to analyze")
        return None

    # Build context from search results
    lines = []
    for idx, item in enumerate(search_results, start=1):
        title = item.get("title") or ""
        summary = item.get("summary") or ""
        url = item.get("url") or ""
        source = item.get("source") or "Web"
        lines.append(
            f"[{idx}] Source: {source}\nTitle: {title}\nURL: {url}\nSummary: {summary}"
        )

    context = "\n\n---\n\n".join(lines)[:15000]  # keep reasonably bounded

    system_prompt = (
        "You are an adverse media and KYC analyst for a legal/compliance team. "
        "Given web search snippets about a company, identify any sanctions, "
        "regulatory enforcement, serious investigations, lawsuits, fraud, corruption, "
        "or other adverse information that could create legal, regulatory, financial, "
        "reputational, environmental, or cyber risk.\n\n"
        "Respond with STRICT JSON only, no prose. Use this exact schema:\n"
        "{\n"
        '  "risk_score": number (0-100),\n'
        '  "risk_category": "Low" | "Medium" | "High",\n'
        '  "match_confidence": number (0-1),\n'
        '  "findings": [\n'
        "    {\n"
        '      "source": string,               // e.g. "News Media", "Regulator", "Web"\n'
        '      "source_category": "sanctions" | "regulatory" | "news" | "web",\n'
        '      "date": string | null,         // ISO date like "2024-01-15" if known, else null\n'
        '      "title": string,\n'
        '      "summary": string,             // Detailed summary of the finding\n'
        '      "severity": "Low" | "Medium" | "High",\n'
        '      "url": string | null\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "If there is no clear adverse information, set risk_score near 0 and include "
        "at least one finding explaining that only neutral/positive coverage was found."
    )

    user_prompt = (
        f"Company name: {company_name}\n"
        f"Jurisdiction (if any): {jurisdiction or 'unknown'}\n\n"
        f"Web search snippets:\n\n{context}\n\n"
        "Based ONLY on this evidence, produce the JSON response."
    )

    def _sync_call() -> str:
        resp = kimi_client.chat.completions.create(
            model="kimi-k2.5",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            max_tokens=2000,
        )
        content = resp.choices[0].message.content or ""
        return content.strip()

    try:
        print(f"[Worker] Calling Kimi k2.5 for analysis...")
        raw_content = await asyncio.to_thread(_sync_call)
        print(f"[Worker] Kimi returned {len(raw_content)} characters")
    except Exception as e:
        print(f"[Worker] Kimi adverse media call failed: {e}")
        return None

    # Try to parse JSON, handling ```json fences if present
    cleaned = raw_content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()

    try:
        data = json.loads(cleaned)
        if not isinstance(data, dict):
            raise ValueError("Kimi response is not a JSON object")
        print(f"[Worker] Successfully parsed Kimi JSON response")
        return data
    except Exception as e:
        print(f"[Worker] Failed to parse Kimi JSON: {e}")
        print(f"[Worker] Raw content preview: {raw_content[:500]}")
        return None


async def search_adverse_media(company_name: str, jurisdiction: str = None) -> Dict[str, Any]:
    """
    Search for adverse media about a company:
    1) Fetch web search results (DuckDuckGo HTML endpoint)
    2) Ask Kimi (Moonshot k2.5) to synthesize risk assessment
    """
    print(f"[Worker] Searching adverse media for: {company_name}")
    
    # Build search query biased toward adverse events
    query_terms = [
        f'"{company_name}"',
        "sanctions OR fraud OR lawsuit OR investigation OR fine OR penalty OR bribery OR corruption",
    ]
    if jurisdiction:
        query_terms.append(jurisdiction)
    query = " ".join(query_terms)
    
    print(f"[Worker] Search query: {query}")

    # Step 1: Web search
    web_results = await fetch_duckduckgo_results(query, max_results=10)
    
    if not web_results:
        print(f"[Worker] WARNING: No web results found for {company_name}")

    # Step 2: LLM analysis
    llm_result = await call_kimi_for_adverse_media(company_name, jurisdiction, web_results)

    # Default values
    risk_score = 0
    risk_category = "Low"
    match_confidence = 0.5
    findings: List[Dict[str, Any]] = []

    if llm_result:
        risk_score = int(max(0, min(100, float(llm_result.get("risk_score", 0)))))
        rc = str(llm_result.get("risk_category", "Low")).title()
        if rc not in ("Low", "Medium", "High"):
            rc = "Low"
        risk_category = rc

        try:
            mc = float(llm_result.get("match_confidence", 0.7))
            match_confidence = max(0.0, min(1.0, mc))
        except Exception:
            match_confidence = 0.7

        llm_findings = llm_result.get("findings") or []
        if isinstance(llm_findings, list):
            findings = llm_findings
            print(f"[Worker] Kimi returned {len(findings)} findings")

    # Fallback if LLM failed but we have raw web results
    if not findings and web_results:
        print(f"[Worker] Using fallback findings from web results")
        for item in web_results[:5]:  # Limit to top 5
            findings.append({
                "source": item.get("source", "Web Search"),
                "source_category": "web",
                "date": item.get("date"),
                "title": item.get("title"),
                "summary": item.get("summary"),
                "severity": "Low",
                "url": item.get("url"),
            })

    # Derive counts by category
    sanctions_count = sum(
        1 for f in findings
        if str(f.get("source_category", "")).lower() == "sanctions"
    )
    regulatory_count = sum(
        1 for f in findings
        if str(f.get("source_category", "")).lower() == "regulatory"
    )
    news_count = sum(
        1 for f in findings
        if str(f.get("source_category", "")).lower() == "news"
    )
    web_count = sum(
        1 for f in findings
        if str(f.get("source_category", "")).lower() == "web"
    )

    # Collect source metadata for audit trail
    sources_meta: List[Dict[str, Any]] = []
    for f in findings:
        sources_meta.append({
            "source": f.get("source"),
            "category": f.get("source_category"),
            "title": f.get("title"),
            "url": f.get("url"),
            "date": f.get("date"),
            "severity": f.get("severity"),
        })

    # Raw cache for debugging / re-analysis
    raw_cache = {
        "company_name": company_name,
        "jurisdiction": jurisdiction,
        "query": query,
        "web_results": web_results,
        "llm_result": llm_result,
    }

    return {
        "findings": findings,
        "risk_score": risk_score,
        "risk_category": risk_category,
        "match_confidence": match_confidence,
        "sanctions_count": sanctions_count,
        "regulatory_count": regulatory_count,
        "news_count": news_count,
        "web_count": web_count,
        "sources": sources_meta,
        "raw_cache": raw_cache,
        "checked_at": datetime.utcnow().isoformat(),
    }


async def process_check(redis_client, db_conn, check_data: Dict):
    """Process a single adverse media check"""
    check_id = check_data['checkId']
    companies = check_data['companies']
    options = check_data.get('options', {})
    
    print(f"[Worker] Processing check {check_id} for {len(companies)} companies")
    
    try:
        cursor = db_conn.cursor()

        # Update status to processing
        cursor.execute(
            """
            UPDATE adverse_media_checks 
            SET status = 'processing'
            WHERE id = %s
            """,
            (check_id,),
        )
        db_conn.commit()
        
        # Process each company
        results = []
        for company in companies:
            company_name = company['name']
            print(f"[Worker] Searching: {company_name}")
            
            search_result = await search_adverse_media(
                company_name,
                company.get('country')
            )

            # Compute cache expiry
            cache_expires_at = datetime.utcnow() + timedelta(days=ADVERSE_MEDIA_RETENTION_DAYS)

            # Update entity in database (align with Prisma schema)
            cursor.execute(
                """
                UPDATE adverse_media_entities
                SET 
                    match_confidence = %s,
                    match_reasoning = %s,
                    "riskScore" = %s,
                    risk_category = %s,
                    findings = %s,
                    sanctions_count = %s,
                    regulatory_count = %s,
                    news_count = %s,
                    web_count = %s,
                    sources = %s,
                    raw_cache = %s,
                    cache_expires_at = %s
                WHERE check_id = %s AND name = %s
                """,
                (
                    search_result['match_confidence'],
                    None,  # match_reasoning (reserved for future explanation)
                    search_result['risk_score'],
                    search_result['risk_category'],
                    json.dumps(search_result['findings']),
                    search_result['sanctions_count'],
                    search_result['regulatory_count'],
                    search_result['news_count'],
                    search_result['web_count'],
                    json.dumps(search_result['sources']),
                    json.dumps(search_result['raw_cache']),
                    cache_expires_at,
                    check_id,
                    company_name,
                ),
            )
            
            results.append({
                'company': company_name,
                **search_result
            })
            
            print(f"[Worker] Completed analysis for {company_name}: risk={search_result['risk_category']} ({search_result['risk_score']})")
            
            # Rate limiting between companies
            await asyncio.sleep(1)
        
        # Calculate overall risk
        max_risk = max(r['risk_score'] for r in results) if results else 0
        overall_category = 'Low' if max_risk < 30 else 'Medium' if max_risk < 70 else 'High'
        
        # Update check as completed
        cursor.execute(
            """
            UPDATE adverse_media_checks 
            SET 
                status = 'completed',
                completed_at = NOW(),
                results = %s,
                risk_score = %s
            WHERE id = %s
            """,
            (
                json.dumps({'entities': results}),
                max_risk,
                check_id,
            ),
        )
        
        db_conn.commit()
        cursor.close()
        
        print(f"[Worker] Completed check {check_id} - Overall risk: {overall_category} ({max_risk})")
        
        # Publish completion event
        await redis_client.publish('adverse-media:completed', json.dumps({
            'checkId': check_id,
            'status': 'completed',
            'overallRisk': overall_category
        }))
        
    except Exception as e:
        print(f"[Worker] Error processing check {check_id}: {e}")
        import traceback
        traceback.print_exc()
        
        # Update status to error
        cursor = db_conn.cursor()
        cursor.execute(
            """
            UPDATE adverse_media_checks 
            SET 
                status = 'error',
                results = %s
            WHERE id = %s
            """,
            (json.dumps({'error': str(e)}), check_id),
        )
        db_conn.commit()
        cursor.close()


async def main():
    """Main worker loop"""
    print("[Worker] Starting Adverse Media Check Worker")
    print(f"[Worker] Redis: {REDIS_URL}")
    print(f"[Worker] Database: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'localhost'}")
    print(f"[Worker] Kimi API: {'Configured' if kimi_client else 'NOT CONFIGURED'}")
    print(f"[Worker] Cache retention: {ADVERSE_MEDIA_RETENTION_DAYS} days")
    
    # Connect to Redis
    redis_client = await aioredis.from_url(REDIS_URL, decode_responses=True)
    
    # Connect to PostgreSQL
    db_conn = psycopg2.connect(DATABASE_URL)
    
    print("[Worker] Connected. Waiting for jobs...")
    
    try:
        while True:
            # Wait for job from queue (blocking pop)
            result = await redis_client.brpop('adverse-media:queue', timeout=5)
            
            if result:
                _, job_data = result
                check_data = json.loads(job_data)
                
                await process_check(redis_client, db_conn, check_data)
            else:
                # No jobs, sleep briefly
                await asyncio.sleep(1)
                
    except KeyboardInterrupt:
        print("\n[Worker] Shutting down...")
    finally:
        redis_client.close()
        db_conn.close()


if __name__ == '__main__':
    asyncio.run(main())
