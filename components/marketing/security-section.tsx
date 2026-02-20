'use client';

import {
  Shield,
  Lock,
  Eye,
  Server,
  FileCheck,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const securityFeatures = [
  {
    icon: Lock,
    title: 'Encryption at Rest & In Transit',
    description: 'AES-256 encryption for stored data and TLS 1.3 for all connections.',
  },
  {
    icon: Eye,
    title: 'Granular Access Controls',
    description: 'Role-based permissions with fine-grained control over documents and data.',
  },
  {
    icon: Server,
    title: 'SOC 2 Type II Ready',
    description: 'Infrastructure and processes designed for SOC 2 compliance.',
  },
  {
    icon: FileCheck,
    title: 'Complete Audit Trails',
    description: 'Every action logged with immutable timestamps and user attribution.',
  },
  {
    icon: Clock,
    title: 'Data Retention Controls',
    description: 'Configurable retention policies with automated purging options.',
  },
  {
    icon: Shield,
    title: 'GDPR & CCPA Compliant',
    description: 'Built-in data subject rights management and privacy controls.',
  },
];

const certifications = [
  'SOC 2 Type II',
  'ISO 27001',
  'GDPR Compliant',
  'CCPA Ready',
];

export function SecuritySection() {
  return (
    <section className="py-24 lg:py-32 bg-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <div>
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6"
            >
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-300">
                Enterprise Security
              </span>
            </div>

            <h2
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6"
            >
              Security built into
              <br />
              <span className="text-gradient">every layer</span>
            </h2>

            <p
              className="text-lg text-slate-400 mb-8"
            >
              Your documents contain sensitive information. We treat security as
              a foundational principle, not an afterthought.
            </p>

            {/* Certifications */}
            <div
              className="flex flex-wrap gap-3"
            >
              {certifications.map((cert) => (
                <div
                  key={cert}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium">{cert}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {securityFeatures.map((feature) => (
              <div
                key={feature.title}
              >
                <Card className="h-full bg-slate-800 border-slate-700 hover:border-emerald-500/30 transition-colors">
                  <CardContent className="p-5">
                    <feature.icon className="w-6 h-6 text-emerald-400 mb-3" />
                    <h3 className="font-medium mb-2 text-white">{feature.title}</h3>
                    <p className="text-sm text-slate-400">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
