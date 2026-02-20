'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Book,
  Upload,
  MessageSquare,
  Search,
  FileCheck,
  AlertTriangle,
  GitCompare,
  Receipt,
  Globe,
  Shield,
  Users,
  Settings,
  Code,
  ArrowRight,
  HelpCircle,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// Tooltip component for hover explanations
function Tooltip({ title, content, children }: { title: string; content: string; children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className="absolute z-50 w-80 p-4 bg-slate-900 text-white rounded-lg shadow-xl -top-2 left-full ml-2">
          <div className="flex items-start gap-2">
            <HelpCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold mb-1">{title}</h4>
              <p className="text-sm text-slate-300">{content}</p>
            </div>
          </div>
          <div className="absolute -left-2 top-4 w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent border-r-slate-900" />
        </div>
      )}
    </div>
  );
}

const docSections = [
  {
    icon: Book,
    title: 'Getting Started',
    description: 'Learn the basics and set up your first matter.',
    tooltipTitle: 'Quick Start Guide',
    tooltipContent: 'Learn how to create an account, set up your organization, create your first matter, and upload documents for analysis.',
    links: [
      { label: 'Platform Overview', href: '#overview', tooltip: 'Understanding the main dashboard, navigation, and core concepts like matters and documents.' },
      { label: 'User Roles & Permissions', href: '#roles', tooltip: 'ADMIN: Full access | MANAGER: Manage matters and documents | REVIEWER: View and comment | VIEWER: Read-only access.' },
      { label: 'Creating Your First Matter', href: '#first-matter', tooltip: 'Matters are containers for related documents. Create a matter, add a description, set due dates, and start uploading documents.' },
    ],
  },
  {
    icon: Upload,
    title: 'Document Management',
    description: 'Upload, process, and organize your legal documents.',
    tooltipTitle: 'Document Processing',
    tooltipContent: 'Upload PDF and Word documents. Our AI pipeline (LlamaCloud + Kimi AI) extracts text, identifies clauses, and creates searchable indexes.',
    links: [
      { label: 'Supported File Types', href: '#file-types', tooltip: 'PDF, DOC, DOCX files up to 50MB. Magic number validation ensures file integrity.' },
      { label: 'Upload & Processing Pipeline', href: '#upload', tooltip: 'Documents go through: Upload → Extraction (LlamaParse) → AI Analysis (Kimi) → Indexing → Storage.' },
      { label: 'Document Organization', href: '#organization', tooltip: 'Organize documents by matters. Use tags and search to find documents quickly.' },
      { label: 'Document Sharing', href: '#sharing', tooltip: 'Create secure share links with tokens. Set expiration dates and download permissions.' },
    ],
  },
  {
    icon: MessageSquare,
    title: 'Document Q&A',
    description: 'Chat with your documents and get cited answers.',
    tooltipTitle: 'AI-Powered Document Chat',
    tooltipContent: 'Ask questions in natural language. AI searches document chunks, finds relevant sections, and provides answers with exact citations.',
    links: [
      { label: 'Starting a Chat Session', href: '#chat-start', tooltip: 'Open any document and start asking questions. Each conversation is saved as a chat session.' },
      { label: 'Understanding Citations', href: '#citations', tooltip: 'Every answer includes citations showing the exact text and location (page/section) in the document.' },
      { label: 'Chat History', href: '#chat-history', tooltip: 'All conversations are saved and searchable. Return to previous discussions anytime.' },
    ],
  },
  {
    icon: FileCheck,
    title: 'Clause Extraction',
    description: 'Automatically extract key terms and clauses.',
    tooltipTitle: 'AI Clause Extraction',
    tooltipContent: 'AI identifies and extracts clauses like termination, liability, payment terms, governing law, and custom clause types.',
    links: [
      { label: 'Available Clause Types', href: '#clause-types', tooltip: 'Termination, Indemnity, Payment, Confidentiality, Governing Law, Force Majeure, and more.' },
      { label: 'Viewing Extractions', href: '#view-extractions', tooltip: 'Browse extracted clauses by type. Each extraction includes confidence scores and source locations.' },
      { label: 'Custom Fields', href: '#custom-fields', tooltip: 'Request custom extraction fields for your specific document types and use cases.' },
    ],
  },
  {
    icon: AlertTriangle,
    title: 'Risk Detection',
    description: 'Identify potential risks and compliance gaps.',
    tooltipTitle: 'Risk Analysis',
    tooltipContent: 'AI scans documents for risky clauses, unfavorable terms, missing protections, and compliance issues. Risks are scored by severity.',
    links: [
      { label: 'Risk Categories', href: '#risk-categories', tooltip: 'HIGH: Critical issues requiring immediate attention | MEDIUM: Significant concerns | LOW: Minor issues.' },
      { label: 'Reviewing & Mitigating Risks', href: '#risk-review', tooltip: 'Review flagged risks, add mitigation plans, assign to team members, and track resolution status.' },
      { label: 'Risk Reports', href: '#risk-reports', tooltip: 'Generate reports showing risk distribution across documents and matters.' },
    ],
  },
  {
    icon: GitCompare,
    title: 'Policy Comparison',
    description: 'Compare documents against benchmarks and frameworks.',
    tooltipTitle: 'Compliance Comparison',
    tooltipContent: 'Compare your company policies against regulatory requirements, standard benchmarks, or other documents to identify gaps.',
    links: [
      { label: 'Creating a Comparison', href: '#compare-create', tooltip: 'Select your document and a benchmark document or framework. AI analyzes coverage and gaps.' },
      { label: 'Understanding Results', href: '#compare-results', tooltip: 'Results show: Covered (fully addressed), Partial (incomplete), Missing (not addressed) with specific recommendations.' },
      { label: 'Compliance Frameworks', href: '#frameworks', tooltip: 'Create and manage custom compliance frameworks for your industry requirements.' },
    ],
  },
  {
    icon: Receipt,
    title: 'Invoice Intelligence',
    description: 'Process and analyze invoices automatically.',
    tooltipTitle: 'Invoice Processing',
    tooltipContent: 'Upload invoices for automatic data extraction. AI identifies vendor details, line items, amounts, tax, and flags potential issues.',
    links: [
      { label: 'Uploading Invoices', href: '#invoice-upload', tooltip: 'Upload PDF or image invoices. System extracts vendor, amounts, dates, and line items.' },
      { label: 'Expense Classification', href: '#expense-classify', tooltip: 'Automatic categorization into Travel, Food, Software, Office Supplies, etc.' },
      { label: 'Risk Flags', href: '#invoice-risks', tooltip: 'Detects duplicates, weekend expenses, policy violations, and unusual spending patterns.' },
    ],
  },
  {
    icon: Globe,
    title: 'Adverse Media Checks',
    description: 'Screen entities against adverse media sources.',
    tooltipTitle: 'Third-Party Due Diligence',
    tooltipContent: 'Screen companies and individuals against sanctions lists, regulatory databases, and news sources for risk assessment.',
    links: [
      { label: 'Running a Check', href: '#adverse-check', tooltip: 'Enter company name or upload a document. System searches multiple sources for adverse information.' },
      { label: 'Understanding Risk Scores', href: '#adverse-scores', tooltip: 'Aggregated risk score (0-100) based on sanctions, regulatory actions, negative news, and web mentions.' },
      { label: 'Source Documentation', href: '#adverse-sources', tooltip: 'All findings include source URLs for audit trail and verification.' },
    ],
  },
  {
    icon: Search,
    title: 'Search & Retrieval',
    description: 'Powerful search across all your documents.',
    tooltipTitle: 'Document Search',
    tooltipContent: 'Hybrid search combining keyword matching, semantic similarity, and citation tracking to find exactly what you need.',
    links: [
      { label: 'Search Types', href: '#search-types', tooltip: 'Keyword: Exact matches | Semantic: Conceptually related | Hybrid: Combines both for best results.' },
      { label: 'Using Search History', href: '#search-history', tooltip: 'Previous searches are saved. Re-run queries or refine them based on previous results.' },
      { label: 'Citation Tracking', href: '#citations', tooltip: 'Every search result citation is tracked for verification and review workflows.' },
    ],
  },
  {
    icon: Shield,
    title: 'Administration',
    description: 'Manage users, organizations, and settings.',
    tooltipTitle: 'Admin Features',
    tooltipContent: 'Admin dashboard provides user management, audit logs, system statistics, and organization settings.',
    links: [
      { label: 'User Management', href: '#users', tooltip: 'Add users, assign roles, manage memberships across organizations.' },
      { label: 'Audit Logs', href: '#audit', tooltip: 'Complete audit trail of all actions: document access, modifications, shares, and admin activities.' },
      { label: 'System Settings', href: '#settings', tooltip: 'Configure notification preferences, security settings, and organization details.' },
    ],
  },
  {
    icon: Code,
    title: 'API Reference',
    description: 'Integrate with our REST API.',
    tooltipTitle: 'API Integration',
    tooltipContent: 'RESTful API for programmatic access to documents, analysis results, and platform features.',
    links: [
      { label: 'Authentication', href: '#auth', tooltip: 'API uses JWT tokens. Obtain tokens via /api/auth endpoints. Include in Authorization header.' },
      { label: 'Documents API', href: '#api-docs', tooltip: 'Upload, retrieve, analyze, and manage documents via API endpoints.' },
      { label: 'Analysis API', href: '#api-analysis', tooltip: 'Trigger extractions, risk analysis, and comparisons programmatically.' },
      { label: 'Rate Limits', href: '#rate-limits', tooltip: 'Admin routes: 100 req/min. Document operations: 50 req/min. Search: 200 req/min.' },
    ],
  },
];

const codeExamples = {
  upload: `// Upload a document
const formData = new FormData();
formData.append('file', documentFile);
formData.append('documentId', docId);

const response = await fetch('/api/documents/upload', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
console.log('Upload complete:', result.documentId);`,

  chat: `// Start a document chat
const response = await fetch(\`/api/documents/\${docId}/chat\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'What are the termination conditions?'
  }),
});

const { response: answer, citations } = await response.json();
console.log('Answer:', answer);
console.log('Citations:', citations);`,

  search: `// Search across documents
const response = await fetch('/api/retrieval/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'liability limitation clause',
    matterId: 'your-matter-id',
    mode: 'hybrid',
  }),
});

const results = await response.json();
results.forEach(r => {
  console.log(\`Found in \${r.documentName}: \${r.text.slice(0, 100)}...\`);
});`,
};

export default function DocsPage() {
  const [activeCode, setActiveCode] = useState<keyof typeof codeExamples>('upload');

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
            Documentation
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Everything you need to use Legal AI effectively. Hover over sections to learn more.
          </motion.p>
        </div>
      </section>

      {/* Doc Sections Grid */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 mb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {docSections.map((section, index) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
            >
              <Tooltip title={section.tooltipTitle} content={section.tooltipContent}>
                <Card className="h-full cursor-help hover:border-amber-500/30 transition-colors">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-ice-500/10 flex items-center justify-center">
                        <section.icon className="w-5 h-5 text-ice-400" />
                      </div>
                      <CardTitle className="text-lg">{section.title}</CardTitle>
                      <HelpCircle className="w-4 h-4 text-muted-foreground opacity-50" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {section.description}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {section.links.map((link) => (
                        <li key={link.label}>
                          <Tooltip title={link.label} content={link.tooltip}>
                            <span className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-help">
                              <ArrowRight className="w-3 h-3" />
                              {link.label}
                            </span>
                          </Tooltip>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </Tooltip>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Code Examples */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 mb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto"
        >
          <h2 className="text-2xl font-bold mb-6 text-center">Quick Code Examples</h2>
          
          {/* Code Tabs */}
          <div className="flex gap-2 mb-4">
            {(Object.keys(codeExamples) as Array<keyof typeof codeExamples>).map((key) => (
              <button
                key={key}
                onClick={() => setActiveCode(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeCode === key
                    ? 'bg-ice-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>

          <div className="rounded-xl overflow-hidden border border-border/50">
            <div className="flex items-center gap-2 px-4 py-2 bg-legal-950 border-b border-border/50">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="ml-4 text-xs text-muted-foreground">
                example.js
              </span>
            </div>
            <pre className="p-4 overflow-x-auto text-sm bg-legal-950">
              <code className="text-white">{codeExamples[activeCode]}</code>
            </pre>
          </div>
        </motion.div>
      </section>

      {/* Architecture Overview */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 mb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto"
        >
          <h2 className="text-2xl font-bold mb-6 text-center">System Architecture</h2>
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Tooltip 
                  title="Document Processing Pipeline" 
                  content="Documents are uploaded, parsed by LlamaCloud, analyzed by Kimi AI (k2.5 model), and stored with searchable indexes."
                >
                  <div className="text-center cursor-help">
                    <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                      <Upload className="w-6 h-6 text-amber-500" />
                    </div>
                    <h3 className="font-semibold mb-1">Ingestion</h3>
                    <p className="text-sm text-muted-foreground">LlamaParse + Kimi AI</p>
                  </div>
                </Tooltip>

                <Tooltip 
                  title="AI Analysis Engine" 
                  content="Kimi k2.5 (128K context) performs clause extraction, risk detection, and generates answers with citations."
                >
                  <div className="text-center cursor-help">
                    <div className="w-12 h-12 rounded-lg bg-ice-500/10 flex items-center justify-center mx-auto mb-3">
                      <MessageSquare className="w-6 h-6 text-ice-500" />
                    </div>
                    <h3 className="font-semibold mb-1">Analysis</h3>
                    <p className="text-sm text-muted-foreground">AI Extraction & Chat</p>
                  </div>
                </Tooltip>

                <Tooltip 
                  title="Storage & Retrieval" 
                  content="PostgreSQL for data, Redis for caching, with hybrid search (keyword + semantic) for fast retrieval."
                >
                  <div className="text-center cursor-help">
                    <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                      <Search className="w-6 h-6 text-emerald-500" />
                    </div>
                    <h3 className="font-semibold mb-1">Storage</h3>
                    <p className="text-sm text-muted-foreground">PostgreSQL + Redis</p>
                  </div>
                </Tooltip>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* Support */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto text-center"
        >
          <h2 className="text-2xl font-bold mb-4">Need Help?</h2>
          <p className="text-muted-foreground mb-6">
            Our team is available to help you get the most out of Legal AI.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/contact">
              <Button className="bg-amber-500 hover:bg-amber-600">
                Contact Support
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
