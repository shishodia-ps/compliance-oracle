'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import {
  MessageSquare,
  FileSearch,
  AlertTriangle,
  GitCompare,
  Sparkles,
  Check,
  Quote,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const features = [
  {
    id: 'qa',
    icon: MessageSquare,
    title: 'Document Q&A',
    description: 'Ask questions in natural language and get precise answers with citations.',
    content: {
      headline: 'Get answers with complete traceability',
      description:
        'Ask any question about your documents and receive precise answers with page and paragraph citations. Every response includes the source text, so you can verify accuracy instantly.',
      benefits: [
        'Natural language queries',
        'Page and paragraph citations',
        'Multi-document questions',
        'Conversation history saved',
      ],
    },
  },
  {
    id: 'extraction',
    icon: FileSearch,
    title: 'Clause Extraction',
    description: 'Automatically identify and extract key clauses and terms.',
    content: {
      headline: 'Never miss a critical clause',
      description:
        'Our AI identifies and extracts key clauses, obligations, dates, parties, and terms. Extracted data is structured and searchable.',
      benefits: [
        'Automated clause detection',
        'Custom extraction fields',
        'Structured data export',
        'Confidence scoring',
      ],
    },
  },
  {
    id: 'risks',
    icon: AlertTriangle,
    title: 'Risk Scoring',
    description: 'Identify potential risks and unfavorable terms automatically.',
    content: {
      headline: 'Spot risks before they become problems',
      description:
        'Automatically identify potential risks, unfavorable terms, and compliance gaps. Each risk is categorized by severity.',
      benefits: [
        'Severity-based categorization',
        'Risk highlighting',
        'Compliance gap detection',
        'Document-level risk summaries',
      ],
    },
  },
  {
    id: 'compare',
    icon: GitCompare,
    title: 'Policy Comparison',
    description: 'Compare documents against benchmarks and regulatory frameworks.',
    content: {
      headline: 'Ensure compliance with confidence',
      description:
        'Compare your policies against regulatory benchmarks or standard documents. Identify gaps and get recommendations for improvement.',
      benefits: [
        'Benchmark comparison',
        'Gap analysis',
        'Compliance scoring',
        'Improvement recommendations',
      ],
    },
  },
];

export default function ProductPage() {
  const [activeTab, setActiveTab] = useState('qa');

  return (
    <div className="pt-24 lg:pt-32">
      {/* Hero */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ice-500/10 border border-ice-500/20 mb-6"
          >
            <Sparkles className="w-4 h-4 text-ice-400" />
            <span className="text-sm font-medium text-ice-300">
              Product Overview
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
          >
            Everything you need for
            <br />
            <span className="text-gradient">intelligent legal work</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8"
          >
            From document ingestion to actionable insights, our platform handles
            the legal document analysis workflow with precision and transparency.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/contact">
              <Button size="lg" className="bg-ice-500 hover:bg-ice-600">
                Request Demo
              </Button>
            </Link>
            <Link href="/docs">
              <Button variant="outline" size="lg">
                View Documentation
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features Tabs */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 mb-24">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto mb-8 bg-transparent border-b border-border/50 rounded-none h-auto p-0">
            {features.map((feature) => (
              <TabsTrigger
                key={feature.id}
                value={feature.id}
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-ice-500 rounded-none px-4 py-3 whitespace-nowrap"
              >
                <feature.icon className="w-4 h-4 mr-2" />
                {feature.title}
              </TabsTrigger>
            ))}
          </TabsList>

          {features.map((feature) => (
            <TabsContent key={feature.id} value={feature.id} className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div>
                  <h2 className="text-3xl font-bold mb-4">
                    {feature.content.headline}
                  </h2>
                  <p className="text-lg text-muted-foreground mb-6">
                    {feature.content.description}
                  </p>
                  <ul className="space-y-3">
                    {feature.content.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
                          <Check className="w-3 h-3 text-emerald-400" />
                        </div>
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative">
                  <div className="rounded-xl border border-border/50 bg-legal-900/50 p-6">
                    {/* Mock UI based on feature */}
                    {feature.id === 'qa' && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                          <MessageSquare className="w-4 h-4" />
                          <span>Ask about this document...</span>
                        </div>
                        <div className="p-3 rounded-lg bg-legal-800/50">
                          <p className="text-sm">What are the termination conditions?</p>
                        </div>
                        <div className="p-3 rounded-lg bg-ice-500/10 border border-ice-500/20">
                          <p className="text-sm mb-2">
                            Either party may terminate this agreement with 30 days written notice. 
                            See <span className="text-ice-400">Section 12.3, Page 24</span>.
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Quote className="w-3 h-3" />
                            <span className="italic">"Either party may terminate..."</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {feature.id === 'extraction' && (
                      <div className="space-y-3">
                        {[
                          { label: 'Effective Date', value: 'Jan 15, 2024' },
                          { label: 'Governing Law', value: 'Delaware' },
                          { label: 'Term', value: '3 years' },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-legal-800/50">
                            <div>
                              <p className="text-xs text-muted-foreground">{item.label}</p>
                              <p className="font-medium">{item.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {feature.id === 'risks' && (
                      <div className="space-y-3">
                        {[
                          { type: 'HIGH', text: 'Unlimited liability clause', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
                          { type: 'MED', text: 'Missing data breach timeframe', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                        ].map((risk, i) => (
                          <div key={i} className={`p-3 rounded-lg border ${risk.color}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <AlertTriangle className="w-4 h-4" />
                              <span className="text-xs font-medium">{risk.type}</span>
                            </div>
                            <p className="text-sm">{risk.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {feature.id === 'compare' && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                          <span>Your Policy</span>
                          <span>GDPR Requirements</span>
                        </div>
                        <div className="p-2 rounded bg-red-500/10 text-red-400 text-sm">
                          Missing: Data retention policy
                        </div>
                        <div className="p-2 rounded bg-emerald-500/10 text-emerald-400 text-sm">
                          Match: Data subject rights
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </section>

      {/* Disclaimer */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Disclaimer:</strong> Legal AI is a 
            document analysis tool and does not provide legal advice. All AI-generated 
            insights should be reviewed by qualified legal professionals. Human oversight 
            is essential for all legal decisions.
          </p>
        </div>
      </section>
    </div>
  );
}
