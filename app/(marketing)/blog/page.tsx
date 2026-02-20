'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Calendar, Clock, ArrowRight, User } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const blogPosts = [
  {
    slug: 'ai-traceability-legal-documents',
    title: 'The Importance of Traceability in AI-Powered Legal Analysis',
    excerpt:
      'Why every AI insight needs a citation, and how traceability builds trust in legal technology.',
    author: 'Sarah Chen',
    date: '2024-03-15',
    readTime: '8 min read',
    category: 'Best Practices',
    featured: true,
  },
  {
    slug: 'human-in-the-loop-legal-ai',
    title: 'Human-in-the-Loop: Why Lawyers Remain Essential',
    excerpt:
      'AI augments legal work but cannot replace human judgment. Here is how to structure effective human-AI collaboration.',
    author: 'Michael Rodriguez',
    date: '2024-03-10',
    readTime: '6 min read',
    category: 'AI Governance',
    featured: false,
  },
  {
    slug: 'contract-review-automation',
    title: 'Automating Contract Review: A Practical Guide',
    excerpt:
      'Step-by-step guidance on implementing automated contract review in your organization.',
    author: 'Jennifer Park',
    date: '2024-03-05',
    readTime: '10 min read',
    category: 'Implementation',
    featured: false,
  },
  {
    slug: 'gdpr-compliance-ai-tools',
    title: 'GDPR Compliance for AI Legal Tools',
    excerpt:
      'Understanding data protection requirements when using AI for legal document processing.',
    author: 'David Kumar',
    date: '2024-02-28',
    readTime: '7 min read',
    category: 'Compliance',
    featured: false,
  },
  {
    slug: 'building-legal-ai-workflows',
    title: 'Building Effective Legal AI Workflows',
    excerpt:
      'How to design workflows that combine AI efficiency with human oversight for optimal results.',
    author: 'Sarah Chen',
    date: '2024-02-20',
    readTime: '9 min read',
    category: 'Best Practices',
    featured: false,
  },
];

export default function BlogPage() {
  const featuredPost = blogPosts.find((p) => p.featured);
  const regularPosts = blogPosts.filter((p) => !p.featured);

  return (
    <div className="pt-24 lg:pt-32">
      {/* Hero */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
          >
            Legal AI <span className="text-gradient">Blog</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Insights on legal technology, AI governance, and best practices for
            modern legal teams.
          </motion.p>
        </div>
      </section>

      {/* Featured Post */}
      {featuredPost && (
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Link href={`/blog/${featuredPost.slug}`}>
              <Card className="overflow-hidden group hover:border-ice-500/30 transition-colors">
                <div className="grid grid-cols-1 lg:grid-cols-2">
                  <div className="aspect-video lg:aspect-auto bg-gradient-to-br from-ice-500/20 to-ice-600/10 flex items-center justify-center">
                    <div className="text-center p-8">
                      <Badge className="mb-4">Featured</Badge>
                      <div className="w-16 h-16 mx-auto rounded-xl bg-ice-500/20 flex items-center justify-center">
                        <span className="text-2xl font-bold text-ice-400">
                          {featuredPost.title.charAt(0)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="p-8 flex flex-col justify-center">
                    <Badge variant="secondary" className="w-fit mb-4">
                      {featuredPost.category}
                    </Badge>
                    <h2 className="text-2xl font-bold mb-4 group-hover:text-ice-400 transition-colors">
                      {featuredPost.title}
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      {featuredPost.excerpt}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {featuredPost.author}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {featuredPost.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {featuredPost.readTime}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          </motion.div>
        </section>
      )}

      {/* All Posts */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <h2 className="text-2xl font-bold mb-8">All Articles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {regularPosts.map((post, index) => (
            <motion.div
              key={post.slug}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Link href={`/blog/${post.slug}`}>
                <Card className="h-full group hover:border-ice-500/30 transition-colors">
                  <CardHeader>
                    <Badge variant="secondary" className="w-fit mb-4">
                      {post.category}
                    </Badge>
                    <h3 className="text-xl font-bold group-hover:text-ice-400 transition-colors">
                      {post.title}
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm mb-4">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {post.author}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {post.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {post.readTime}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
