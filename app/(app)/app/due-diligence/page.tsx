'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Shield,
  Globe,
  Building2,
  Download,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface CheckResult {
  checkId: string;
  status: string;
  overallRisk: {
    score: number;
    category: string;
  };
  entityCount: number;
  entities: Array<{
    id: string;
    name: string;
    normalizedName: string;
    jurisdiction?: string;
    riskScore: number;
    riskCategory: string;
    matchConfidence: number;
    findings: Array<{
      category: string;
      severity: number;
      title: string;
      description: string;
      source: string;
      sourceUrl?: string;
      date?: string;
    }>;
    counts: {
      sanctions: number;
      regulatory: number;
      news: number;
      web: number;
    };
  }>;
}

export default function DueDiligencePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('search');
  const [companyName, setCompanyName] = useState('');
  const [country, setCountry] = useState('');
  const [enforcementMode, setEnforcementMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [recentChecks, setRecentChecks] = useState<any[]>([]);

  // Poll for results when check is pending
  useEffect(() => {
    if (!checkResult || (checkResult.status !== 'pending' && checkResult.status !== 'processing')) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/adverse-media/check/${checkResult.checkId}/results`);
        if (res.ok) {
          const data = await res.json();
          setCheckResult(data);
          if (data.status !== 'pending' && data.status !== 'processing') {
            clearInterval(interval);
          }
        }
      } catch (error) {
        console.error('Poll error:', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [checkResult]);

  // Load recent checks
  useEffect(() => {
    fetchRecentChecks();
  }, []);

  const fetchRecentChecks = async () => {
    try {
      const res = await fetch('/api/adverse-media/checks?limit=5');
      if (res.ok) {
        const data = await res.json();
        setRecentChecks(data.checks);
      }
    } catch (error) {
      console.error('Failed to load recent checks:', error);
    }
  };

  const loadCheckResults = async (checkId: string) => {
    try {
      const res = await fetch(`/api/adverse-media/check/${checkId}/results`);
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to load check' }));
        throw new Error(error.error || 'Failed to load check');
      }
      const data = await res.json();
      setCheckResult(data);
      setActiveTab('search');
    } catch (error: any) {
      toast.error(error.message || 'Failed to load check');
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    setIsLoading(true);
    setCheckResult(null);

    try {
      const res = await fetch('/api/adverse-media/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companies: [{
            name: companyName,
            country: country || undefined,
          }],
          options: {
            depth: 'standard',
            sources: ['sanctions', 'news', 'web'],
            enforcementMode,
          },
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Check failed');
      }

      const data = await res.json();
      
      // Fetch initial results
      const resultsRes = await fetch(`/api/adverse-media/check/${data.checkId}/results`);
      if (resultsRes.ok) {
        const results = await resultsRes.json();
        setCheckResult(results);
      }

      toast.success('Adverse media check initiated');
      fetchRecentChecks();
    } catch (error: any) {
      toast.error(error.message || 'Failed to check company');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setCheckResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('enforcementMode', String(enforcementMode));

    try {
      const res = await fetch('/api/adverse-media/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await res.json();
      
      // Fetch initial results
      const resultsRes = await fetch(`/api/adverse-media/check/${data.checkId}/results`);
      if (resultsRes.ok) {
        const results = await resultsRes.json();
        setCheckResult(results);
      }

      toast.success('Document uploaded. Extracting companies...');
      fetchRecentChecks();
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload document');
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskColor = (category: string) => {
    switch (category) {
      case 'High': return 'bg-red-100 text-red-700 border-red-200';
      case 'Medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Low': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'pending': return <Clock className="w-5 h-5 text-amber-500" />;
      case 'processing': return <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />;
      case 'error': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Third-Party Due Diligence</h1>
          <p className="text-slate-500 mt-1">
            Screen vendors, partners, and counterparties against sanctions, news, and web sources
          </p>
        </div>
      </div>

      {/* Input Section */}
      <Card className="border-0 shadow-lg bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-500" />
            Adverse Media Check
          </CardTitle>
          <CardDescription>
            Search by company name or upload a document with multiple companies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="search">
                <Search className="w-4 h-4 mr-2" />
                Search
              </TabsTrigger>
              <TabsTrigger value="upload">
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="mt-6">
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      Company Name
                    </label>
                    <Input
                      placeholder="e.g., Acme Corporation"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      Country (optional)
                    </label>
                    <Input
                      placeholder="e.g., United States"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Enforcement Mode</p>
                    <p className="text-xs text-slate-600">
                      Prioritize regulator actions and fines (FCA/SEC/FINRA) as higher risk.
                    </p>
                  </div>
                  <Switch
                    checked={enforcementMode}
                    onCheckedChange={setEnforcementMode}
                    aria-label="Toggle enforcement mode"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoading || !companyName.trim()}
                  className="bg-amber-500 hover:bg-amber-600"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Check Company
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="upload" className="mt-6">
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:border-amber-300 transition-colors">
                <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Enforcement Mode</p>
                    <p className="text-xs text-slate-600">
                      Apply strict enforcement weighting during document screening.
                    </p>
                  </div>
                  <Switch
                    checked={enforcementMode}
                    onCheckedChange={setEnforcementMode}
                    aria-label="Toggle enforcement mode for upload"
                  />
                </div>
                <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  Upload Document
                </h3>
                <p className="text-sm text-slate-500 mb-4 max-w-md mx-auto">
                  Upload a PDF, DOCX, XLSX, or TXT file containing company names.
                  We'll extract and check all companies automatically.
                </p>
                <Input
                  type="file"
                  accept=".pdf,.docx,.xlsx,.txt"
                  onChange={handleFileUpload}
                  disabled={isLoading}
                  className="max-w-xs mx-auto"
                />
                <p className="text-xs text-slate-400 mt-2">
                  Maximum 100 companies per upload
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Results */}
      {checkResult && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {getStatusIcon(checkResult.status)}
                Check Results
              </CardTitle>
              <Badge className={getRiskColor(checkResult.overallRisk?.category)}>
                {checkResult.overallRisk?.category} Risk ({checkResult.overallRisk?.score}/100)
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {(checkResult.status === 'pending' || checkResult.status === 'processing') && (
              <div className="flex items-center gap-4 py-8">
                <Progress value={33} className="flex-1" />
                <span className="text-sm text-slate-500 whitespace-nowrap">
                  Checking sources...
                </span>
              </div>
            )}

            {checkResult.entities?.length > 0 && (
              <div className="space-y-4">
                {checkResult.entities.map((entity) => (
                  <Card key={entity.id} className="border-slate-200">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-slate-400" />
                            <h3 className="font-semibold text-slate-900">
                              {entity.name}
                            </h3>
                          </div>
                          {entity.jurisdiction && (
                            <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                              <Globe className="w-3 h-3" />
                              {entity.jurisdiction}
                            </div>
                          )}
                        </div>
                        <Badge className={getRiskColor(entity.riskCategory)}>
                          {entity.riskCategory} ({entity.riskScore}/100)
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {/* Findings count */}
                      <div className="flex gap-4 text-sm mb-4">
                        {entity.counts.sanctions > 0 && (
                          <span className="text-red-600 font-medium">
                            {entity.counts.sanctions} Sanctions
                          </span>
                        )}
                        {entity.counts.regulatory > 0 && (
                          <span className="text-amber-600 font-medium">
                            {entity.counts.regulatory} Regulatory
                          </span>
                        )}
                        {entity.counts.news > 0 && (
                          <span className="text-blue-600 font-medium">
                            {entity.counts.news} News
                          </span>
                        )}
                        {entity.counts.web > 0 && (
                          <span className="text-slate-600">
                            {entity.counts.web} Web
                          </span>
                        )}
                        {entity.findings?.length === 0 && (
                          <span className="text-emerald-600">No adverse findings</span>
                        )}
                      </div>

                      {/* Findings list */}
                      {entity.findings?.length > 0 && (
                        <div className="space-y-2">
                          {entity.findings.slice(0, 3).map((finding, idx) => (
                            <div
                              key={idx}
                              className="p-3 bg-slate-50 rounded-lg text-sm"
                            >
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-medium text-slate-900">
                                    {finding.title}
                                  </p>
                                  <p className="text-slate-600 mt-1">
                                    {finding.description}
                                  </p>
                                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                                    <span className="capitalize">{finding.source}</span>
                                    {finding.sourceUrl && (
                                      <a
                                        href={finding.sourceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-amber-600 hover:underline flex items-center gap-1"
                                      >
                                        View source
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                          {entity.findings.length > 3 && (
                            <p className="text-sm text-slate-500 text-center">
                              +{entity.findings.length - 3} more findings
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Checks */}
      {recentChecks.length > 0 && (
        <Card className="border-0 shadow-lg bg-white">
          <CardHeader>
            <CardTitle className="text-lg">Recent Checks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentChecks.map((check) => (
                <div
                  key={check.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  onClick={() => {
                    loadCheckResults(check.id);
                  }}
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(check.status)}
                    <div>
                      <p className="font-medium text-slate-900 truncate max-w-md">
                        {check.rawInput}
                      </p>
                      <p className="text-xs text-slate-500">
                        {check.entityCount} companies - {new Date(check.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {check.highRiskCount > 0 && (
                      <Badge className="bg-red-100 text-red-700">
                        {check.highRiskCount} High Risk
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        loadCheckResults(check.id);
                      }}
                    >
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
