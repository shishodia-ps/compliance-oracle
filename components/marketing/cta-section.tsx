'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Calendar, Mail, Sparkles } from 'lucide-react';

export function CTASection() {
  return (
    <section className="py-24 lg:py-32 relative overflow-hidden bg-white">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-50/50 to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-radial from-amber-200/40 via-amber-100/20 to-transparent blur-3xl" />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div
          className="relative max-w-4xl mx-auto"
        >
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-amber-100/50 overflow-hidden">
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-50/50 via-transparent to-transparent" />
            
            {/* Content */}
            <div className="relative p-8 md:p-12 lg:p-16 text-center">
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 mb-8"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-700">
                  Start your free trial today
                </span>
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6 text-slate-900">
                Ready to transform your
                <br />
                <span className="text-gradient">legal workflow?</span>
              </h2>

              <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-10">
                Join hundreds of legal teams who have accelerated their document
                review process with Legal AI. Schedule a demo or start your free
                trial today.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/contact">
                  <Button
                    size="lg"
                    className="bg-amber-500 hover:bg-amber-600 text-white px-8 h-12 text-base rounded-xl group border-0"
                  >
                    <Calendar className="mr-2 w-4 h-4" />
                    Schedule Demo
                    <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button
                    variant="outline"
                    size="lg"
                    className="px-8 h-12 text-base rounded-xl border-slate-200 hover:bg-slate-50"
                  >
                    <Mail className="mr-2 w-4 h-4" />
                    Contact Sales
                  </Button>
                </Link>
              </div>

              <p className="mt-6 text-sm text-slate-400">
                Free 14-day trial. No credit card required.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
