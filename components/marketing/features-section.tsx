'use client';

import {
  FileSearch,
  MessageSquare,
  AlertTriangle,
  GitCompare,
  Workflow,
  Shield,
  Sparkles,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const features = [
  {
    icon: FileSearch,
    title: 'Clause Extraction',
    description:
      'Automatically identify and extract key clauses, obligations, dates, and parties from any legal document with 95%+ accuracy.',
    highlight: '95%+ accuracy',
    color: 'amber',
    size: 'large',
  },
  {
    icon: MessageSquare,
    title: 'Document Q&A',
    description:
      'Ask questions in natural language and get precise answers with page and paragraph citations.',
    highlight: 'With citations',
    color: 'blue',
    size: 'small',
  },
  {
    icon: AlertTriangle,
    title: 'Risk Detection',
    description:
      'Identify potential risks, unfavorable terms, and compliance gaps before they become problems.',
    highlight: 'Proactive alerts',
    color: 'rose',
    size: 'small',
  },
  {
    icon: GitCompare,
    title: 'Version Comparison',
    description:
      'Compare document versions side-by-side with semantic diff highlighting changes and their significance.',
    highlight: 'Redline view',
    color: 'emerald',
    size: 'small',
  },
  {
    icon: Workflow,
    title: 'Review Workflows',
    description:
      'Streamline approval processes with customizable workflows, assignments, and audit trails.',
    highlight: 'Human-in-loop',
    color: 'amber',
    size: 'small',
  },
  {
    icon: Shield,
    title: 'Compliance Mapping',
    description:
      'Map documents to regulatory frameworks like GDPR, AI Act, and ISO standards automatically.',
    highlight: 'GDPR/AI Act ready',
    color: 'blue',
    size: 'large',
  },
];

const colorMap: Record<string, { bg: string; border: string; text: string; hover: string }> = {
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', hover: 'group-hover:text-amber-600' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', hover: 'group-hover:text-blue-600' },
  rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-600', hover: 'group-hover:text-rose-600' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', hover: 'group-hover:text-emerald-600' },
};

export function FeaturesSection() {
  return (
    <section className="py-24 lg:py-32 relative bg-white">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-50/30 to-transparent" />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 mb-6"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-700">
              Powerful Features
            </span>
          </div>
          
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6 text-slate-900"
          >
            Everything you need for
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-amber-600">intelligent document review</span>
          </h2>
          
          <p
            className="text-lg text-slate-500"
          >
            From ingestion to insights, our platform handles the entire document
            analysis workflow with precision and transparency.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => {
            const colors = colorMap[feature.color];
            const isLarge = feature.size === 'large';
            
            return (
              <div
                key={feature.title}
                className={isLarge ? 'md:col-span-2 lg:col-span-1' : ''}
              >
                <Card className={`h-full bg-white border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-pointer overflow-hidden ${isLarge ? 'lg:col-span-1' : ''}`}>
                  <CardContent className="p-6 h-full flex flex-col">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 rounded-xl ${colors.bg} ${colors.border} border flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                        <feature.icon className={`w-6 h-6 ${colors.text}`} />
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
                        {feature.highlight}
                      </span>
                    </div>
                    
                    <h3 className="text-xl font-semibold mb-3 text-slate-900 ${colors.hover} transition-colors">
                      {feature.title}
                    </h3>
                    
                    <p className="text-slate-500 text-sm leading-relaxed flex-1">
                      {feature.description}
                    </p>
                    
                    <div className="mt-4 flex items-center text-sm text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Learn more</span>
                      <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
