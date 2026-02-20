'use client';

import { motion } from 'framer-motion';
import {
  Scale,
  Building2,
  ShieldCheck,
  ShoppingCart,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const solutions = [
  {
    id: 'law-firms',
    icon: Scale,
    title: 'Law Firms',
    subtitle: 'Accelerate document review and deliver more value to clients',
    painPoints: [
      'Contract review consuming excessive associate hours',
      'Difficulty maintaining consistency across reviewers',
      'Managing high volumes of due diligence documents',
    ],
    solutions: [
      'AI-powered document analysis with citations',
      'Automated clause extraction and risk detection',
      'Document comparison and version tracking',
      'Chat-based document Q&A',
    ],
    features: [
      'Document Q&A with source citations',
      'Automated clause extraction',
      'Risk identification and scoring',
      'Multi-document analysis',
    ],
    color: 'ice',
  },
  {
    id: 'in-house',
    icon: Building2,
    title: 'In-House Counsel',
    subtitle: 'Manage contract volume and gain portfolio visibility',
    painPoints: [
      'Overwhelmed by contract review requests',
      'Limited visibility into contract portfolio',
      'Difficulty demonstrating team value',
    ],
    solutions: [
      'Self-service document analysis for business teams',
      'Centralized document repository with search',
      'Matter-based organization and tracking',
      'Compliance framework mapping',
    ],
    features: [
      'Matter-based document organization',
      'Document search and retrieval',
      'Compliance tracking',
      'Team collaboration features',
    ],
    color: 'emerald',
  },
  {
    id: 'compliance',
    icon: ShieldCheck,
    title: 'Compliance Teams',
    subtitle: 'Stay ahead of regulatory requirements with confidence',
    painPoints: [
      'Complex regulatory landscape to navigate',
      'Manual compliance checks are time-consuming',
      'Difficulty proving compliance posture',
    ],
    solutions: [
      'Policy comparison against regulatory frameworks',
      'Systematic document analysis for compliance gaps',
      'Compliance reporting and tracking',
      'Audit trail for all activities',
    ],
    features: [
      'Policy comparison tools',
      'Compliance framework management',
      'Gap analysis reporting',
      'Complete audit logging',
    ],
    color: 'amber',
  },
  {
    id: 'procurement',
    icon: ShoppingCart,
    title: 'Procurement',
    subtitle: 'Streamline vendor contract analysis and expense management',
    painPoints: [
      'Slow vendor onboarding due to contract review',
      'Invoice processing and verification overhead',
      'Limited visibility into vendor obligations',
    ],
    solutions: [
      'Rapid contract analysis for vendor agreements',
      'Invoice intelligence and automated extraction',
      'Vendor risk assessment via adverse media checks',
      'Structured obligation extraction',
    ],
    features: [
      'Contract analysis for vendor agreements',
      'Invoice processing and data extraction',
      'Adverse media checks for vendor screening',
      'Risk flag detection',
    ],
    color: 'purple',
  },
];

export default function SolutionsPage() {
  return (
    <div className="pt-24 lg:pt-32">
      {/* Hero */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
          >
            Solutions for every
            <br />
            <span className="text-gradient">legal team</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Whether you are a law firm, in-house team, compliance department, or
            procurement organization, Legal AI adapts to your specific needs.
          </motion.p>
        </div>
      </section>

      {/* Solutions */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-24 pb-24">
        {solutions.map((solution, index) => (
          <motion.div
            key={solution.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start"
          >
            {/* Left: Description */}
            <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-xl bg-${solution.color}-500/10 flex items-center justify-center`}>
                  <solution.icon className={`w-6 h-6 text-${solution.color}-400`} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{solution.title}</h2>
                  <p className="text-muted-foreground">{solution.subtitle}</p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Pain Points */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                    Common Challenges
                  </h3>
                  <ul className="space-y-2">
                    {solution.painPoints.map((point) => (
                      <li key={point} className="flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span className="text-muted-foreground">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA */}
                <Link href="/contact">
                  <Button className="bg-ice-500 hover:bg-ice-600">
                    Talk to Sales
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right: Solutions & Features */}
            <div className={`space-y-6 ${index % 2 === 1 ? 'lg:order-1' : ''}`}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">How Legal AI Helps</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {solution.solutions.map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Key Features</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3">
                    {solution.features.map((feature) => (
                      <div
                        key={feature}
                        className="flex items-center gap-2 p-3 rounded-lg bg-legal-800/30"
                      >
                        <CheckCircle2 className="w-4 h-4 text-ice-400" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        ))}
      </section>
    </div>
  );
}
