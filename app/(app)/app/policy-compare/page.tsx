'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  GitCompare,
  FileText,
  Building2,
  Scale,
  Filter,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileType,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

// Types
interface Document {
  id: string;
  name: string;
  fileName: string;
  status: string;
  documentType: string;
  createdAt: string;
}

interface ComparisonResult {
  comparison_rows: {
    benchmark_clause: string;
    benchmark_citation: string;
    company_match: string | null;
    company_citation: string | null;
    status: 'Covered' | 'Partial' | 'Missing' | 'Conflict';
    risk: 'High' | 'Medium' | 'Low';
    notes: string;
  }[];
  suggestions: {
    issue: string;
    recommendation: string;
    insert_location: string;
    benchmark_citation: string;
    confidence: number;
  }[];
}

const JURISDICTIONS = ['EU', 'Netherlands', 'France', 'Germany', 'UK', 'US', 'Other'];

const REGULATIONS = [
  'GDPR',
  'ISO27001',
  'NIS2',
  'DORA',
  'CCPA',
  'HIPAA',
  'SOX',
  'Internal Benchmark',
  'Custom',
];

const TOPICS = [
  'Data retention',
  'Legal basis',
  'Consent',
  'DPIA',
  'Security controls',
  'Breach notification',
  'Vendor management',
  'Logging/audit',
  'DSAR',
  'International transfer',
  'DPO',
];

const COMPARISON_MODES = [
  { value: 'compliance_gaps', label: 'Compliance gaps (benchmark vs company)' },
  { value: 'conflict_detection', label: 'Conflict detection' },
  { value: 'coverage_completeness', label: 'Coverage completeness' },
  { value: 'full_comparison', label: 'Full comparison' },
];

export default function PolicyComparePage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [companyDoc, setCompanyDoc] = useState<Document | null>(null);
  const [benchmarkDoc, setBenchmarkDoc] = useState<Document | null>(null);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [comparisonMode, setComparisonMode] = useState('compliance_gaps');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [riskFilter, setRiskFilter] = useState('all');
  const [autoMatch, setAutoMatch] = useState(true);
  const [jurisdiction, setJurisdiction] = useState('');
  const [regulation, setRegulation] = useState('');
  const [isComparing, setIsComparing] = useState(false);
  const [results, setResults] = useState<ComparisonResult | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/documents?status=ANALYZED');
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      toast.error('Failed to fetch documents');
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const handleCompare = async () => {
    if (!companyDoc || !benchmarkDoc) {
      toast.error('Please select both documents');
      return;
    }
    if (selectedTopics.length === 0) {
      toast.error('Please select at least one topic');
      return;
    }

    setIsComparing(true);
    setResults(null);

    try {
      const response = await fetch('/api/policy-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_doc_id: companyDoc.id,
          benchmark_doc_id: benchmarkDoc.id,
          jurisdiction,
          regulation,
          filters: {
            comparison_mode: comparisonMode,
            topics: selectedTopics,
            risk_filter: riskFilter,
            auto_match: autoMatch,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Comparison failed');
      }

      const data = await response.json();
      setResults(data);
      toast.success('Comparison complete');
    } catch (error: any) {
      toast.error(error.message || 'Comparison failed');
    } finally {
      setIsComparing(false);
    }
  };

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic)
        ? prev.filter((t) => t !== topic)
        : [...prev, topic]
    );
  };

  const exportToExcel = () => {
    if (!results) return;
    toast.success('Export to Excel started');
  };

  const exportToWord = () => {
    if (!results) return;
    toast.success('Export to Word started');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Covered':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'Partial':
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case 'Missing':
        return <XCircle className="w-5 h-5 text-rose-500" />;
      case 'Conflict':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Covered':
        return 'bg-emerald-100 text-emerald-700';
      case 'Partial':
        return 'bg-amber-100 text-amber-700';
      case 'Missing':
        return 'bg-rose-100 text-rose-700';
      case 'Conflict':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3">
          <Scale className="w-8 h-8 text-amber-500" />
          <div>
            <h1 className="text-2xl font-bold">Policy Comparison</h1>
            <p className="text-muted-foreground">
              Compare your internal policy against regulatory benchmarks
            </p>
          </div>
        </div>
      </motion.div>

      {/* Document Selection */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Company Policy */}
          <Card>
            <CardHeader className="bg-slate-50">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Company Policy
                <Badge variant="secondary">company_policy</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {companyDoc ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{companyDoc.name}</p>
                      <p className="text-sm text-slate-500">{companyDoc.fileName}</p>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700">
                      {companyDoc.status}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCompanyDoc(null)}
                  >
                    Change Document
                  </Button>
                </div>
              ) : (
                <Select
                  onValueChange={(value) => {
                    const doc = documents.find((d) => d.id === value);
                    setCompanyDoc(doc || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select company policy..." />
                  </SelectTrigger>
                  <SelectContent>
                    {documents.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          {/* Benchmark Document */}
          <Card>
            <CardHeader className="bg-slate-50">
              <CardTitle className="text-base flex items-center gap-2">
                <Scale className="w-4 h-4" />
                Benchmark Document
                <Badge variant="secondary">benchmark_policy</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Select value={jurisdiction} onValueChange={setJurisdiction}>
                  <SelectTrigger>
                    <SelectValue placeholder="Jurisdiction" />
                  </SelectTrigger>
                  <SelectContent>
                    {JURISDICTIONS.map((j) => (
                      <SelectItem key={j} value={j}>
                        {j}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={regulation} onValueChange={setRegulation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Regulation" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGULATIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {benchmarkDoc ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{benchmarkDoc.name}</p>
                      <p className="text-sm text-slate-500">{benchmarkDoc.fileName}</p>
                    </div>
                    <Badge className="bg-blue-100 text-blue-700">
                      {benchmarkDoc.status}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBenchmarkDoc(null)}
                  >
                    Change Document
                  </Button>
                </div>
              ) : (
                <Select
                  onValueChange={(value) => {
                    const doc = documents.find((d) => d.id === value);
                    setBenchmarkDoc(doc || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select benchmark..." />
                  </SelectTrigger>
                  <SelectContent>
                    {documents.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Filter Panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card>
          <CardHeader className="bg-slate-50">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Comparison Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Comparison Mode</Label>
                <Select value={comparisonMode} onValueChange={setComparisonMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPARISON_MODES.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Risk Filter</Label>
                <Select value={riskFilter} onValueChange={setRiskFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Show all</SelectItem>
                    <SelectItem value="high">High risk only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Section Mapping</Label>
                <div className="flex items-center space-x-2 pt-2">
                  <Switch checked={autoMatch} onCheckedChange={setAutoMatch} />
                  <Label className="text-sm">Auto match</Label>
                </div>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={handleCompare}
                  disabled={isComparing || !companyDoc || !benchmarkDoc}
                  className="w-full bg-amber-500 hover:bg-amber-600"
                >
                  {isComparing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Comparing...
                    </>
                  ) : (
                    <>
                      <GitCompare className="w-4 h-4 mr-2" />
                      Run Comparison
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Topic Filter (select relevant topics)</Label>
              <div className="flex flex-wrap gap-2">
                {TOPICS.map((topic) => (
                  <Badge
                    key={topic}
                    variant={selectedTopics.includes(topic) ? 'default' : 'outline'}
                    className="cursor-pointer hover:bg-slate-100"
                    onClick={() => toggleTopic(topic)}
                  >
                    {selectedTopics.includes(topic) && (
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                    )}
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Results */}
      {results && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">
                  {results.comparison_rows.filter((r) => r.status === 'Covered').length}
                </p>
                <p className="text-sm text-emerald-700">Covered</p>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-amber-600">
                  {results.comparison_rows.filter((r) => r.status === 'Partial').length}
                </p>
                <p className="text-sm text-amber-700">Partial</p>
              </CardContent>
            </Card>
            <Card className="bg-rose-50 border-rose-200">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-rose-600">
                  {results.comparison_rows.filter((r) => r.status === 'Missing').length}
                </p>
                <p className="text-sm text-rose-700">Missing</p>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-red-600">
                  {results.comparison_rows.filter((r) => r.status === 'Conflict').length}
                </p>
                <p className="text-sm text-red-700">Conflicts</p>
              </CardContent>
            </Card>
          </div>

          {/* Export */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={exportToExcel}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Export to Excel
            </Button>
            <Button variant="outline" onClick={exportToWord}>
              <FileType className="w-4 h-4 mr-2" />
              Export to Word
            </Button>
          </div>

          {/* Comparison Results Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comparison Results</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 text-left font-medium">Benchmark Clause</th>
                      <th className="p-3 text-left font-medium">Company Match</th>
                      <th className="p-3 text-center font-medium">Coverage</th>
                      <th className="p-3 text-center font-medium">Risk</th>
                      <th className="p-3 text-left font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.comparison_rows
                      .filter(
                        (row) =>
                          riskFilter === 'all' ||
                          (riskFilter === 'high' && row.risk === 'High')
                      )
                      .map((row, index) => (
                        <tr key={index} className="border-b hover:bg-slate-50">
                          <td className="p-3">{getStatusIcon(row.status)}</td>
                          <td className="p-3">
                            <div className="max-w-xs">
                              <p className="font-medium truncate">
                                {row.benchmark_clause}
                              </p>
                              <p className="text-xs text-slate-500">
                                {row.benchmark_citation}
                              </p>
                            </div>
                          </td>
                          <td className="p-3">
                            {row.company_match ? (
                              <div className="max-w-xs">
                                <p className="truncate">{row.company_match}</p>
                                <p className="text-xs text-slate-500">
                                  {row.company_citation}
                                </p>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <Badge className={getStatusColor(row.status)}>
                              {row.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            <Badge
                              className={
                                row.risk === 'High'
                                  ? 'bg-rose-100 text-rose-700'
                                  : row.risk === 'Medium'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-100 text-slate-700'
                              }
                            >
                              {row.risk}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <p className="text-slate-600 max-w-sm">{row.notes}</p>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Suggestions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Suggestions</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {results.suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="p-4 border rounded-lg bg-slate-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-slate-900">
                            {suggestion.issue}
                          </h4>
                          <p className="text-sm text-slate-600 mt-1">
                            {suggestion.recommendation}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            <span>Insert: {suggestion.insert_location}</span>
                            <span>
                              Confidence: {Math.round(suggestion.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {suggestion.benchmark_citation}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
