import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { kimi } from '@/lib/ai';
import { redis } from '@/lib/redis';

// Valid topics for policy comparison (whitelist)
const VALID_TOPICS = [
  'compliance', 'privacy', 'security', 'data_protection', 'gdpr', 
  'employment', 'contracts', 'ip', 'anti_corruption', 'safety',
  'confidentiality', 'ethics', 'termination', 'retention'
];

// Maximum topics to prevent DoS
const MAX_TOPICS = 10;

/**
 * Validate and sanitize topics array
 */
function validateTopics(topics: any): string[] {
  if (!Array.isArray(topics)) {
    return ['compliance'];
  }
  
  // Limit number of topics
  const limited = topics.slice(0, MAX_TOPICS);
  
  // Filter to only valid topics and sanitize
  return limited
    .filter((t): t is string => typeof t === 'string')
    .map(t => t.toLowerCase().trim())
    .filter(t => VALID_TOPICS.includes(t) && t.length > 0 && t.length < 100);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    const body = await request.json();
    const { company_doc_id, benchmark_doc_id, jurisdiction, regulation, filters } = body;

    if (!company_doc_id || !benchmark_doc_id) {
      return NextResponse.json(
        { error: 'Missing document IDs' },
        { status: 400 }
      );
    }

    const { comparison_mode, topics, risk_filter, auto_match } = filters || {};
    const cacheKey = `policy-compare:${company_doc_id}:${benchmark_doc_id}:${topics?.join(',') || 'all'}`;
    
    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return NextResponse.json(JSON.parse(cached));
    }

    // Validate and sanitize topics to prevent injection attacks
    const topicsArray = validateTopics(topics);
    
    if (topicsArray.length === 0) {
      return NextResponse.json(
        { error: 'No valid topics provided. Valid topics: ' + VALID_TOPICS.join(', ') },
        { status: 400 }
      );
    }

    // Verify documents exist
    const [companyDoc, benchmarkDoc] = await Promise.all([
      prisma.document.findFirst({
        where: { id: company_doc_id, organizationId: membership.organizationId },
        select: { id: true, name: true, status: true }
      }),
      prisma.document.findFirst({
        where: { id: benchmark_doc_id, organizationId: membership.organizationId },
        select: { id: true, name: true, status: true }
      }),
    ]);

    if (!companyDoc) {
      return NextResponse.json(
        { error: 'Company document not found' },
        { status: 404 }
      );
    }

    if (!benchmarkDoc) {
      return NextResponse.json(
        { error: 'Benchmark document not found' },
        { status: 404 }
      );
    }

    // Get benchmark content - try search_chunks first, fall back to extraction
    let benchmarkChunks: any[] = [];
    
    try {
      benchmarkChunks = await prisma.searchChunk.findMany({
        where: {
          documentId: benchmark_doc_id,
          OR: topicsArray.map((topic: string) => ({
            text: { contains: topic, mode: 'insensitive' },
          })),
        },
        orderBy: { sectionDepth: 'asc' },
        take: 20,
      });
    } catch (e) {
      console.log('search_chunks not available, using fallback');
    }

    // Fallback: Extract from document extraction/markdown
    if (benchmarkChunks.length === 0) {
      const [benchmarkExtraction, companyExtraction] = await Promise.all([
        prisma.documentExtraction.findFirst({
          where: { documentId: benchmark_doc_id },
          select: { markdown: true, content: true }
        }),
        prisma.documentExtraction.findFirst({
          where: { documentId: company_doc_id },
          select: { markdown: true, content: true }
        })
      ]);

      if (!benchmarkExtraction && !companyExtraction) {
        return NextResponse.json(
          { error: 'Documents not processed yet. Please wait for analysis to complete.' },
          { status: 400 }
        );
      }

      // Create pseudo-chunks from extraction content
      const benchmarkText = benchmarkExtraction?.markdown || benchmarkExtraction?.content || '';
      const companyText = companyExtraction?.markdown || companyExtraction?.content || '';

      // Split into sections
      const sections = benchmarkText.split(/\n#+ /).filter(s => s.length > 200);
      
      benchmarkChunks = sections.slice(0, 10).map((section, idx) => ({
        id: `section-${idx}`,
        text: section.slice(0, 2000),
        sectionPath: section.split('\n')[0] || `Section ${idx + 1}`,
        sectionDepth: 1,
      }));

      // If still no chunks, use simple paragraph splitting
      if (benchmarkChunks.length === 0) {
        const paragraphs = benchmarkText.split('\n\n').filter(p => p.length > 300);
        benchmarkChunks = paragraphs.slice(0, 8).map((para, idx) => ({
          id: `para-${idx}`,
          text: para.slice(0, 2000),
          sectionPath: `Paragraph ${idx + 1}`,
          sectionDepth: 1,
        }));
      }
    }

    if (benchmarkChunks.length === 0) {
      return NextResponse.json(
        { error: 'No content available for comparison. Documents may still be processing.' },
        { status: 400 }
      );
    }

    // Get company document content for comparison
    const companyExtraction = await prisma.documentExtraction.findFirst({
      where: { documentId: company_doc_id },
      select: { markdown: true, content: true }
    });

    const companyText = companyExtraction?.markdown || companyExtraction?.content || '';

    // Build comparison prompt
    const prompt = buildComparisonPrompt({
      jurisdiction: jurisdiction || 'General',
      regulation: regulation || 'Standard',
      comparison_mode: comparison_mode || 'detailed',
      benchmark_chunks: benchmarkChunks,
      company_text: companyText.slice(0, 15000), // Limit context
      topics: topicsArray,
    });

    // Call LLM
    const llmResponse = await kimi.chat.completions.create({
      model: 'kimi-k2.5',
      messages: [
        {
          role: 'system',
          content: `You are a compliance analysis engine. Compare company policy against benchmark requirements.

STRICT RULES:
1. ONLY use the provided content - DO NOT hallucinate
2. If company policy doesn't address a requirement, mark as "Missing"
3. Return ONLY valid JSON - no markdown, no extra text

Output format:
{
  "comparison_rows": [
    {
      "benchmark_clause": "Title",
      "benchmark_citation": "Source",
      "company_match": "Matching text or null",
      "company_citation": "Source or null",
      "status": "Covered|Partial|Missing",
      "risk": "High|Medium|Low",
      "notes": "Explanation"
    }
  ],
  "suggestions": [
    {
      "issue": "What's missing",
      "recommendation": "Suggested wording",
      "confidence": 0.0-1.0
    }
  ]
}`
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 4000,
    });

    // Parse response
    const responseContent = llmResponse.choices[0].message.content || '{}';
    let parsedResult;

    try {
      const jsonMatch = responseContent.match(/```json\n?([\s\S]*?)\n?```/) ||
                       responseContent.match(/```\n?([\s\S]*?)\n?```/) ||
                       [null, responseContent];
      parsedResult = JSON.parse(jsonMatch[1] || responseContent);
    } catch (e) {
      console.error('LLM response parsing error:', e);
      console.error('Raw response:', responseContent);
      return NextResponse.json(
        { error: 'Failed to parse comparison results' },
        { status: 500 }
      );
    }

    const result = {
      comparison_rows: parsedResult.comparison_rows || [],
      suggestions: parsedResult.suggestions || [],
      metadata: {
        company_doc: companyDoc.name,
        benchmark_doc: benchmarkDoc.name,
        jurisdiction: jurisdiction || 'General',
        regulation: regulation || 'Standard',
        topics_analyzed: topicsArray,
        benchmark_clauses_analyzed: benchmarkChunks.length,
      },
    };

    // Cache for 30 minutes
    await redis.setex(cacheKey, 1800, JSON.stringify(result));

    return NextResponse.json(result);

  } catch (error) {
    console.error('Policy comparison error:', error);
    return NextResponse.json(
      { error: 'Comparison failed' },
      { status: 500 }
    );
  }
}

function buildComparisonPrompt(evidence: any): string {
  const { jurisdiction, regulation, comparison_mode, benchmark_chunks, company_text, topics } = evidence;

  let prompt = `COMPLIANCE ANALYSIS REQUEST
===========================

JURISDICTION: ${jurisdiction}
REGULATION: ${regulation}
MODE: ${comparison_mode}
TOPICS: ${topics.join(', ')}

BENCHMARK REQUIREMENTS:
=======================
`;

  benchmark_chunks.forEach((chunk: any, index: number) => {
    prompt += `\n[${index + 1}] ${chunk.sectionPath || `Section ${index + 1}`}\n`;
    prompt += `${chunk.text?.slice(0, 1000) || chunk}\n`;
  });

  prompt += `\n\nCOMPANY POLICY DOCUMENT:
========================\n${company_text.slice(0, 8000)}\n`;

  prompt += `\n\nANALYZE:
========
1. Compare each benchmark requirement against company policy
2. Determine: Covered (fully addressed), Partial (addressed but incomplete), Missing (not addressed)
3. Assess risk: High (legal violation), Medium (gap), Low (minor issue)
4. Provide specific suggestions for gaps

Return results as JSON per system instructions.`;

  return prompt;
}
