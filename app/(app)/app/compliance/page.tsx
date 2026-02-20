'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import {
  Shield,
  FileCheck,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface ComplianceStats {
  documentCompliance: number;
  invoiceCompliance: number;
  retentionCompliance: number;
  overallCompliance: number;
  stats: {
    totalDocuments: number;
    compliantDocuments: number;
    totalInvoices: number;
    compliantInvoices: number;
    expiringDocuments: number;
    missingMetadata: number;
  };
  recentChecks: Array<{
    id: string;
    documentName: string;
    status: 'pass' | 'fail';
    date: string;
    issues: string[];
  }>;
}

export default function CompliancePage() {
  const [compliance, setCompliance] = useState<ComplianceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchComplianceData();
  }, []);

  const fetchComplianceData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/compliance');
      if (!response.ok) throw new Error('Failed to fetch compliance data');
      const data = await response.json();
      setCompliance(data);
    } catch (error) {
      toast.error('Failed to load compliance data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!compliance) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
        <p>Failed to load compliance data</p>
        <button
          onClick={fetchComplianceData}
          className="mt-4 text-amber-500 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-bold">Compliance Center</h1>
        <p className="text-muted-foreground">
          Monitor and ensure regulatory compliance
        </p>
      </motion.div>

      {/* Overall Score */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card>
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="relative">
                <svg className="w-32 h-32 -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-muted/20"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeDasharray={`${compliance.overallCompliance * 3.52} 352`}
                    className={`${
                      compliance.overallCompliance >= 80
                        ? 'text-emerald-500'
                        : compliance.overallCompliance >= 60
                        ? 'text-amber-500'
                        : 'text-red-500'
                    }`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold">{compliance.overallCompliance}%</span>
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-xl font-semibold mb-2">Overall Compliance Score</h2>
                <p className="text-muted-foreground">
                  Based on document metadata completeness, invoice processing accuracy,
                  and retention policy adherence.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Compliance Categories */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileCheck className="w-4 h-4" />
              Document Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-bold">{compliance.documentCompliance}%</span>
              <span className="text-sm text-muted-foreground">
                {compliance.stats.compliantDocuments}/{compliance.stats.totalDocuments}
              </span>
            </div>
            <Progress value={compliance.documentCompliance} className="h-2" />
            <p className="text-xs text-muted-foreground mt-3">
              {compliance.stats.missingMetadata} documents missing metadata
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Invoice Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-bold">{compliance.invoiceCompliance}%</span>
              <span className="text-sm text-muted-foreground">
                {compliance.stats.compliantInvoices}/{compliance.stats.totalInvoices}
              </span>
            </div>
            <Progress value={compliance.invoiceCompliance} className="h-2" />
            <p className="text-xs text-muted-foreground mt-3">
              Vendor and amount extraction accuracy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Retention Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-bold">{compliance.retentionCompliance}%</span>
              <span className="text-sm text-muted-foreground">
                {compliance.stats.expiringDocuments} expiring
              </span>
            </div>
            <Progress value={compliance.retentionCompliance} className="h-2" />
            <p className="text-xs text-muted-foreground mt-3">
              Documents approaching retention limit
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Compliance Checks */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Recent Compliance Checks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {compliance.recentChecks.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No compliance checks yet. Upload documents to see compliance status.
                </p>
              ) : (
                compliance.recentChecks.map((check) => (
                  <div
                    key={check.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {check.status === 'pass' ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                      <div>
                        <p className="font-medium">{check.documentName}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(check.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {check.status === 'pass' ? (
                        <span className="text-sm text-emerald-500 font-medium">Compliant</span>
                      ) : (
                        <span className="text-sm text-red-500 font-medium">
                          {check.issues.length} issue{check.issues.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
