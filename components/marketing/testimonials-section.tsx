'use client';

import { Quote, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const testimonials = [
  {
    quote:
      "Legal AI has transformed our contract review process. What used to take days now takes hours, with better accuracy and complete traceability.",
    author: 'Sarah Chen',
    role: 'General Counsel',
    company: 'TechVentures Inc.',
    initials: 'SC',
  },
  {
    quote:
      "The citation feature is a game-changer. Every AI insight points back to the exact clause, making verification effortless.",
    author: 'Michael Rodriguez',
    role: 'Partner',
    company: 'Rodriguez & Associates',
    initials: 'MR',
  },
  {
    quote:
      "We reduced our contract review backlog by 80% in the first month. The ROI was immediate and substantial.",
    author: 'Jennifer Park',
    role: 'Head of Legal Operations',
    company: 'GlobalRetail Co.',
    initials: 'JP',
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-24 lg:py-32 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6 text-slate-900"
          >
            Loved by legal <span className="text-gradient">teams</span>
          </h2>
          <p
            className="text-lg text-slate-500"
          >
            See what leading legal professionals say about Legal AI.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.author}
            >
              <Card className="h-full bg-white border-slate-200 shadow-sm">
                <CardContent className="p-6">
                  {/* Stars */}
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="w-4 h-4 fill-amber-400 text-amber-400"
                      />
                    ))}
                  </div>

                  {/* Quote */}
                  <Quote className="w-8 h-8 text-amber-200 mb-4" />
                  <p className="text-slate-700 mb-6 leading-relaxed">
                    "{testimonial.quote}"
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-amber-100 text-amber-700">
                        {testimonial.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-slate-900">{testimonial.author}</p>
                      <p className="text-sm text-slate-500">
                        {testimonial.role}, {testimonial.company}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
