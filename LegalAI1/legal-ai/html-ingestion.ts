#!/usr/bin/env tsx

export interface HtmlFetchResult {
  url: string;
  language?: string;
  html: string;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#160;/gi, ' ')
    .replace(/&#8211;/gi, '-')
    .replace(/&#8212;/gi, '-')
    .replace(/&#8220;|&#8221;/gi, '"')
    .replace(/&#8230;/gi, '...')
    .replace(/&#(\d+);/g, (_, code) => {
      const parsed = Number(code);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : _;
    });
}

function stripTags(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function extractTitle(html: string): string | undefined {
  const candidates = [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["']/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i,
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
  ];

  for (const pattern of candidates) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const title = stripTags(match[1]);
      if (title) {
        return title;
      }
    }
  }

  return undefined;
}

export function htmlToStructuredText(html: string): { title?: string; text: string; sections: string[] } {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ');

  const title = extractTitle(withoutNoise);

  const structuredHtml = withoutNoise
    .replace(/<(h1|h2|h3|h4)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, heading) => `\n## ${stripTags(heading)}\n`)
    .replace(/<(li)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, item) => `\n- ${stripTags(item)}\n`);

  const text = stripTags(structuredHtml);
  const sections = text
    .split(/\n##\s+/)
    .map((part, index) => (index === 0 ? part : `## ${part}`))
    .map((part) => part.trim())
    .filter(Boolean);

  return { title, text, sections };
}

export async function fetchHtmlWithFallback(
  attempts: Array<{ url: string; language?: string }>,
): Promise<HtmlFetchResult> {
  let lastError: string | null = null;

  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, {
        headers: {
          'User-Agent': 'LegalAI-Ingestion/1.0 (+https://karmai.work)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      if (!response.ok) {
        lastError = `${attempt.url} -> ${response.status}`;
        continue;
      }

      const html = await response.text();
      if (!html || html.length < 200) {
        lastError = `${attempt.url} -> empty html`;
        continue;
      }

      return {
        url: attempt.url,
        language: attempt.language,
        html,
      };
    } catch (error) {
      lastError = `${attempt.url} -> ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  throw new Error(lastError || 'Failed to fetch HTML source');
}
