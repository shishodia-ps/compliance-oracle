'use client';

import { Building2, Landmark, Briefcase, Shield, Scale, Gavel } from 'lucide-react';

const logos = [
  { name: 'Global Law Partners', icon: Scale },
  { name: 'Metropolitan Legal', icon: Building2 },
  { name: 'Justice & Associates', icon: Gavel },
  { name: 'Corporate Counsel Co', icon: Briefcase },
  { name: 'SecureLegal Inc', icon: Shield },
  { name: 'Heritage Law Group', icon: Landmark },
];

export function LogoStrip() {
  return (
    <section className="py-16 border-y border-slate-200 bg-slate-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <p
          className="text-center text-sm text-slate-500 mb-8"
        >
          Trusted by leading legal teams worldwide
        </p>
        <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-16">
          {logos.map((logo) => (
            <div
              key={logo.name}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <logo.icon className="w-5 h-5" />
              <span className="text-sm font-medium">{logo.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
