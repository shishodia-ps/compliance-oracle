'use client';

import { Upload, Cpu, FileCheck, ArrowRight, Sparkles } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Upload,
    title: 'Upload Documents',
    description:
      'Drag and drop contracts, policies, and legal documents. We support PDF, Word, and email exports with automatic OCR for scanned files.',
  },
  {
    number: '02',
    icon: Cpu,
    title: 'AI Analysis',
    description:
      'Our AI engine extracts clauses, identifies risks, and maps obligations. Every insight includes citations to the source text.',
  },
  {
    number: '03',
    icon: FileCheck,
    title: 'Review & Act',
    description:
      'Review AI-generated insights, verify extractions, assign tasks to your team, and export reports with full audit trails.',
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-24 lg:py-32 relative overflow-hidden bg-slate-50">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-50/30 to-transparent" />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 mb-6"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-700">Simple Process</span>
          </div>
          
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6 text-slate-900"
          >
            How it <span className="text-gradient">works</span>
          </h2>
          <p
            className="text-lg text-slate-500"
          >
            From upload to insights in three simple steps. No complex setup required.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connection Line */}
          <div className="hidden lg:block absolute top-24 left-1/2 -translate-x-1/2 w-2/3 h-0.5 bg-gradient-to-r from-transparent via-amber-300 to-transparent" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className="relative"
              >
                <div className="text-center">
                  {/* Step Number & Icon */}
                  <div className="relative inline-flex items-center justify-center mb-6">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 border border-amber-200 flex items-center justify-center shadow-lg shadow-amber-500/10">
                      <step.icon className="w-8 h-8 text-amber-600" />
                    </div>
                    <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                      {step.number}
                    </span>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-semibold mb-3 text-slate-900">{step.title}</h3>
                  <p className="text-slate-500 max-w-sm mx-auto">
                    {step.description}
                  </p>
                </div>

                {/* Arrow (hidden on last item and mobile) */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:flex absolute top-10 left-full -translate-x-1/2 z-10">
                    <ArrowRight className="w-6 h-6 text-amber-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8"
        >
          {[
            { value: '10x', label: 'Faster review' },
            { value: '95%', label: 'Extraction accuracy' },
            { value: '50K+', label: 'Documents analyzed' },
            { value: '<2min', label: 'Average processing' },
          ].map((stat) => (
            <div key={stat.label} className="text-center p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <div className="text-3xl lg:text-4xl font-bold text-gradient mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-slate-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
