'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, User, Share2, Twitter, Linkedin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const blogPosts: Record<string, {
  title: string;
  content: string;
  author: string;
  date: string;
  readTime: string;
  category: string;
  initials: string;
}> = {
  'ai-traceability-legal-documents': {
    title: 'The Importance of Traceability in AI-Powered Legal Analysis',
    content: `
## Why Traceability Matters

In the legal profession, the source of information is as important as the information itself. When AI systems analyze legal documents, every insight must be traceable back to its source. This is not just a nice-to-have feature—it is a fundamental requirement for trust and accountability.

## The Citation Principle

Legal AI systems should follow the same citation standards that lawyers have used for centuries. Every claim, every extracted clause, every identified risk must include:

- **Document reference**: Which document contains this information
- **Page number**: Where in the document to find it
- **Quote**: The exact text that supports the insight
- **Context**: Surrounding text for verification

## Building Trust Through Transparency

When AI provides an answer like "The termination clause requires 30 days notice," the system must also provide:

1. The specific page where this appears
2. The exact quoted text
3. Confidence level in the extraction
4. Any alternative interpretations

## Practical Implementation

Modern legal AI platforms implement traceability through:

- **Chunk-based analysis**: Documents are broken into semantic chunks, each with unique identifiers
- **Offset tracking**: Precise character positions for every extraction
- **Version control**: Tracking which document version was analyzed
- **Audit logs**: Recording who queried what and when

## Regulatory Considerations

As AI regulation evolves, traceability is becoming a legal requirement. The EU AI Act and similar frameworks emphasize:

- Transparency in automated decision-making
- Right to explanation
- Auditability of AI systems

Legal teams that adopt traceable AI systems today will be ahead of the compliance curve.

## Conclusion

Traceability is not a technical detail—it is a foundational principle that makes AI useful in legal contexts. Without it, AI-generated insights are unverifiable and therefore untrustworthy. With it, AI becomes a powerful tool that augments legal expertise while maintaining professional standards.
    `,
    author: 'Sarah Chen',
    date: '2024-03-15',
    readTime: '8 min read',
    category: 'Best Practices',
    initials: 'SC',
  },
  'human-in-the-loop-legal-ai': {
    title: 'Human-in-the-Loop: Why Lawyers Remain Essential',
    content: `
## The AI Augmentation Model

Artificial intelligence has made remarkable progress in legal document analysis, but it is not a replacement for human lawyers. The most effective approach combines AI efficiency with human judgment—a model known as "human-in-the-loop."

## What AI Does Well

AI excels at:

- **Pattern recognition**: Identifying standard clauses across thousands of documents
- **Speed**: Processing documents in minutes rather than hours
- **Consistency**: Applying the same criteria every time
- **Scale**: Handling volume that would overwhelm human reviewers

## What Humans Do Better

Lawyers remain essential for:

- **Contextual understanding**: Interpreting clauses in business context
- **Strategic thinking**: Deciding which risks matter and why
- **Client relationships**: Understanding nuanced client needs
- **Final accountability**: Taking responsibility for legal advice

## Effective Collaboration Patterns

Successful legal AI implementations follow these patterns:

1. **AI first pass**: Automated extraction and risk flagging
2. **Human review**: Lawyers verify and contextualize AI findings
3. **Feedback loop**: Human corrections improve future AI performance
4. **Escalation paths**: Complex issues automatically route to senior lawyers

## Implementation Best Practices

- Start with high-volume, lower-risk document types
- Define clear escalation criteria
- Train lawyers on AI capabilities and limitations
- Measure outcomes, not just efficiency gains

## The Future of Legal Work

The lawyers who thrive will be those who learn to work effectively with AI—using it to handle routine analysis while focusing their expertise on high-value strategic work.
    `,
    author: 'Michael Rodriguez',
    date: '2024-03-10',
    readTime: '6 min read',
    category: 'AI Governance',
    initials: 'MR',
  },
};

export default function BlogPostPage() {
  const params = useParams();
  const slug = params.slug as string;
  const post = blogPosts[slug];

  if (!post) {
    return (
      <div className="pt-24 lg:pt-32 container mx-auto px-4 text-center">
        <h1 className="text-2xl font-bold mb-4">Article not found</h1>
        <Link href="/blog">
          <Button variant="outline">
            <ArrowLeft className="mr-2 w-4 h-4" />
            Back to Blog
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-24 lg:pt-32 pb-24">
      <article className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        {/* Back Link */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <Link
            href="/blog"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="mr-2 w-4 h-4" />
            Back to Blog
          </Link>
        </motion.div>

        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-12"
        >
          <Badge className="mb-4">{post.category}</Badge>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-ice-500/10 text-ice-400 text-xs">
                  {post.initials}
                </AvatarFallback>
              </Avatar>
              <span>{post.author}</span>
            </div>
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {post.date}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {post.readTime}
            </span>
          </div>
        </motion.header>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="prose prose-invert prose-lg max-w-none"
        >
          {post.content.split('\n\n').map((paragraph, index) => {
            if (paragraph.startsWith('## ')) {
              return (
                <h2 key={index} className="text-2xl font-bold mt-12 mb-4">
                  {paragraph.replace('## ', '')}
                </h2>
              );
            }
            if (paragraph.startsWith('- ')) {
              return (
                <ul key={index} className="list-disc list-inside space-y-2 my-4">
                  {paragraph.split('\n').map((item, i) => (
                    <li key={i} className="text-muted-foreground">
                      {item.replace('- ', '').replace(/\*\*/g, '')}
                    </li>
                  ))}
                </ul>
              );
            }
            if (/^\d+\./.test(paragraph)) {
              return (
                <ol key={index} className="list-decimal list-inside space-y-2 my-4">
                  {paragraph.split('\n').map((item, i) => (
                    <li key={i} className="text-muted-foreground">
                      {item.replace(/^\d+\. /, '').replace(/\*\*/g, '')}
                    </li>
                  ))}
                </ol>
              );
            }
            return (
              <p key={index} className="text-muted-foreground leading-relaxed mb-4">
                {paragraph.replace(/\*\*/g, '')}
              </p>
            );
          })}
        </motion.div>

        {/* Share */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 pt-8 border-t border-border/50"
        >
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Share:</span>
            <Button variant="ghost" size="icon" className="w-9 h-9">
              <Twitter className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="w-9 h-9">
              <Linkedin className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="w-9 h-9">
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </article>
    </div>
  );
}
