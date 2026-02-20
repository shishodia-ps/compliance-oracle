'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play, Sparkles, Shield, FileText, Search, Zap } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 bg-white">
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2394a3b8' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }} />
      
      {/* Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 mb-8">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-700">
              Now with Kimi K2.5 powered legal analysis
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-slate-900">
            Legal documents
            <br />
            <span className="text-amber-500">Intelligently analyzed</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            AI-powered contract review, clause extraction, and compliance mapping
            for law firms and in-house legal teams. Get insights in minutes, not hours.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/contact">
              <Button
                size="lg"
                className="bg-amber-500 hover:bg-amber-600 text-white px-8 h-12 text-base rounded-xl border-0"
              >
                Request Demo
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link href="/product">
              <Button
                variant="outline"
                size="lg"
                className="px-8 h-12 text-base rounded-xl border-slate-300 hover:bg-slate-50"
              >
                <Play className="mr-2 w-4 h-4" />
                See How It Works
              </Button>
            </Link>
          </div>

          {/* Demo Preview Card */}
          <div className="relative mx-auto max-w-4xl">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
              {/* Browser Chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="h-6 rounded-lg bg-white border border-slate-200 flex items-center px-3 text-xs text-slate-400">
                    legal-ai.app/documents/analysis
                  </div>
                </div>
              </div>

              {/* Demo Content */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Document Preview */}
                <div className="md:col-span-2 space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-amber-600" />
                    </div>
                    <span className="font-medium text-slate-900">Purchase Agreement.pdf</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                      Analyzed
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-100 rounded-lg w-full" />
                    <div className="h-3 bg-slate-100 rounded-lg w-11/12" />
                    <div className="h-3 bg-slate-100 rounded-lg w-4/5" />
                    <div className="h-3 bg-slate-100 rounded-lg w-full" />
                    <div className="h-3 bg-slate-50 rounded-lg w-3/4" />
                  </div>
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                      <Search className="w-4 h-4" />
                      <span>Ask about this document...</span>
                    </div>
                  </div>
                </div>

                {/* AI Insights Panel */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="font-medium text-sm text-slate-900">AI Insights</span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-3 h-3 text-rose-500" />
                        <span className="text-xs font-medium text-rose-700">Risk Detected</span>
                      </div>
                      <p className="text-xs text-rose-600">
                        Unlimited liability clause
                      </p>
                    </div>
                    
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-3 h-3 text-amber-600" />
                        <span className="text-xs font-medium text-amber-700">Key Clause</span>
                      </div>
                      <p className="text-xs text-amber-600">
                        Termination: 30 days
                      </p>
                    </div>
                    
                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-3 h-3 text-blue-500" />
                        <span className="text-xs font-medium text-blue-700">Extraction</span>
                      </div>
                      <p className="text-xs text-blue-600">
                        Governing Law: Delaware
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
