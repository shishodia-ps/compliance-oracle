'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { Check, X, HelpCircle, Sparkles, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'For small teams getting started with AI document analysis',
    monthlyPrice: null,
    yearlyPrice: null,
    icon: Sparkles,
    features: [
      { text: 'Up to 100 documents/month', included: true },
      { text: '5 team members', included: true },
      { text: 'Basic clause extraction', included: true },
      { text: 'Document Q&A', included: true },
      { text: 'Email support', included: true },
      { text: 'API access', included: false },
      { text: 'Custom AI models', included: false },
      { text: 'Dedicated support', included: false },
    ],
    cta: 'Contact Sales',
    popular: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'For growing legal teams with higher volume needs',
    monthlyPrice: null,
    yearlyPrice: null,
    icon: Building2,
    features: [
      { text: 'Up to 500 documents/month', included: true },
      { text: '20 team members', included: true },
      { text: 'Advanced clause extraction', included: true },
      { text: 'Document Q&A with citations', included: true },
      { text: 'Risk detection', included: true },
      { text: 'Version comparison', included: true },
      { text: 'Priority support', included: true },
      { text: 'API access', included: false },
      { text: 'Custom AI models', included: false },
      { text: 'Dedicated support', included: false },
    ],
    cta: 'Contact Sales',
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations with advanced requirements',
    monthlyPrice: null,
    yearlyPrice: null,
    icon: Building2,
    features: [
      { text: 'Unlimited documents', included: true },
      { text: 'Unlimited team members', included: true },
      { text: 'All Professional features', included: true },
      { text: 'Custom AI model training', included: false },
      { text: 'Full API access', included: true },
      { text: 'SSO & advanced security', included: false },
      { text: 'Dedicated account manager', included: true },
      { text: 'Custom integrations', included: true },
      { text: 'SLA guarantees', included: true },
      { text: 'On-premise deployment option', included: false },
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

const faqs = [
  {
    question: 'How does the document limit work?',
    answer:
      'Document limits are based on the number of documents processed per month. Each unique document upload counts toward your limit. Analyzed documents remain accessible without counting toward future months.',
  },
  {
    question: 'Can I upgrade or downgrade my plan?',
    answer:
      'Yes, you can change your plan at any time. Contact our sales team to discuss your requirements.',
  },
  {
    question: 'What happens to my documents if I cancel?',
    answer:
      'You can export all your documents and data before cancellation. After cancellation, data is retained for a limited period per our data retention policy.',
  },
  {
    question: 'Is there a free trial?',
    answer:
      'Contact our sales team to discuss trial options and evaluate the platform with your specific use cases.',
  },
  {
    question: 'Do you offer discounts for nonprofits or education?',
    answer:
      'Special pricing may be available for qualifying nonprofit organizations and educational institutions. Contact our sales team for details.',
  },
];

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(true);

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
            Simple, transparent <span className="text-gradient">pricing</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8"
          >
            Choose the plan that fits your team. Contact us for a custom quote.
          </motion.p>

          {/* Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex items-center justify-center gap-4"
          >
            <span className={`text-sm ${!isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>
              Monthly
            </span>
            <Switch checked={isYearly} onCheckedChange={setIsYearly} />
            <span className={`text-sm ${isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>
              Yearly
            </span>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 mb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card
                className={`h-full relative ${
                  plan.popular
                    ? 'border-ice-500/50 shadow-lg shadow-ice-500/10'
                    : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-ice-500 text-white">Most Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-ice-500/10 flex items-center justify-center">
                      <plan.icon className="w-5 h-5 text-ice-400" />
                    </div>
                    <CardTitle>{plan.name}</CardTitle>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                  <div className="mt-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-muted-foreground">
                        Not decided yet
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li
                        key={feature.text}
                        className="flex items-center gap-3"
                      >
                        {feature.included ? (
                          <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <X className="w-5 h-5 text-muted-foreground/50 flex-shrink-0" />
                        )}
                        <span
                          className={
                            feature.included
                              ? 'text-sm'
                              : 'text-sm text-muted-foreground'
                          }
                        >
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/contact">
                    <Button
                      className={`w-full ${
                        plan.popular
                          ? 'bg-ice-500 hover:bg-ice-600'
                          : ''
                      }`}
                      variant={plan.popular ? 'default' : 'outline'}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Disclaimer */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 mb-24">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Note:</strong> Pricing is currently under review. 
            All prices will be determined based on your specific requirements. Contact our sales team 
            for a custom quote.
          </p>
        </div>
      </section>

      {/* FAQs */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-start gap-3">
                      <HelpCircle className="w-5 h-5 text-ice-400 flex-shrink-0 mt-0.5" />
                      {faq.question}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{faq.answer}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
