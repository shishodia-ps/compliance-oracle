import type { Metadata } from 'next';
import { Inter, Calistoga } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const calistoga = Calistoga({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-cal',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Legal AI - Intelligent Document Analysis for Legal Teams',
    template: '%s | Legal AI',
  },
  description:
    'AI-powered legal document analysis, contract review, and compliance management. Built for law firms and in-house legal teams.',
  keywords: [
    'legal AI',
    'contract analysis',
    'document review',
    'compliance',
    'legal tech',
    'law firm software',
  ],
  authors: [{ name: 'Legal AI' }],
  creator: 'Legal AI',
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'Legal AI',
    title: 'Legal AI - Intelligent Document Analysis',
    description:
      'AI-powered legal document analysis, contract review, and compliance management.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Legal AI - Intelligent Document Analysis',
    description:
      'AI-powered legal document analysis, contract review, and compliance management.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${calistoga.variable} font-sans min-h-screen bg-white`}
      >
        <Providers>
          {children}
        </Providers>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
