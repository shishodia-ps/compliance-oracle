'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileText,
  AlertTriangle,
  FolderOpen,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Upload,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface DashboardStats {
  documents: {
    total: number;
    analyzed: number;
    change: number;
    trend: 'up' | 'down';
  };
  risks: {
    total: number;
    open: number;
  };
  matters: {
    total: number;
    active: number;
  };
}

interface Document {
  id: string;
  name: string;
  documentType: string;
  status: string;
  createdAt: string;
  matter: { name: string } | null;
  _count: { risks: number };
}

interface Activity {
  id: string;
  action: string;
  resourceType: string;
  createdAt: string;
  user: { name: string | null; email: string };
  details: any;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentDocuments, setRecentDocuments] = useState<Document[]>([]);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const fetchDashboardData = async () => {
      try {
        const response = await fetch('/api/dashboard/stats', { signal: controller.signal });
        if (response.ok) {
          const data = await response.json();
          setStats(data.stats);
          setRecentDocuments(data.recentDocuments);
          setRecentActivity(data.recentActivity);
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') return;
        toast.error('Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboardData();
    return () => controller.abort();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-2">
          Welcome back. Here&apos;s what&apos;s happening with your legal matters.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg bg-white">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Documents</p>
                <p className="text-3xl font-bold text-slate-900">
                  {stats?.documents.total || 0}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  {stats?.documents.trend === 'up' ? (
                    <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-rose-500" />
                  )}
                  <span className={`text-sm ${stats?.documents.trend === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {stats?.documents.change || 0}%
                  </span>
                  <span className="text-sm text-slate-400">vs last month</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Analyzed</p>
                <p className="text-3xl font-bold text-slate-900">
                  {stats?.documents.analyzed || 0}
                </p>
                <p className="text-sm text-slate-400 mt-2">
                  {stats?.documents.total ? Math.round((stats.documents.analyzed / stats.documents.total) * 100) : 0}% completion
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Open Risks</p>
                <p className="text-3xl font-bold text-slate-900">
                  {stats?.risks.open || 0}
                </p>
                <p className="text-sm text-slate-400 mt-2">
                  {stats?.risks.total || 0} total risks
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Active Matters</p>
                <p className="text-3xl font-bold text-slate-900">
                  {stats?.matters.active || 0}
                </p>
                <p className="text-sm text-slate-400 mt-2">
                  {stats?.matters.total || 0} total matters
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <FolderOpen className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Documents */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-lg bg-white">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 py-4">
              <CardTitle className="text-lg font-semibold text-slate-900">Recent Documents</CardTitle>
              <Link href="/app/documents">
                <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-700">
                  View all
                  <ArrowUpRight className="ml-1 w-4 h-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {recentDocuments.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No documents yet</p>
                  <p className="text-sm">Upload your first document to get started</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentDocuments.map((doc) => (
                    <Link
                      key={doc.id}
                      href={`/app/documents/${doc.id}`}
                      className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 group-hover:text-amber-600 transition-colors">
                            {doc.name}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <span>{doc.documentType}</span>
                            <span>•</span>
                            <span>{formatDate(doc.createdAt)}</span>
                            {doc.matter && (
                              <>
                                <span>•</span>
                                <span className="text-amber-600">{doc.matter.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={doc.status === 'ANALYZED' ? 'default' : 'secondary'}
                          className={doc.status === 'ANALYZED' 
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' 
                            : 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                          }
                        >
                          {doc.status}
                        </Badge>
                        {doc._count.risks > 0 && (
                          <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">
                            {doc._count.risks} risks
                          </Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activity Feed */}
        <div>
          <Card className="border-0 shadow-lg bg-white">
            <CardHeader className="border-b border-slate-100 py-4">
              <CardTitle className="text-lg font-semibold text-slate-900">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {recentActivity.length === 0 ? (
                <div className="text-center text-slate-500 py-8">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentActivity.slice(0, 5).map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-slate-600">
                          {getInitials(activity.user.name, activity.user.email)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900">
                          <span className="font-medium">{activity.user.name || activity.user.email}</span>
                          {' '}<span className="text-slate-500">{activity.action.toLowerCase()}</span>
                          {' '}<span className="font-medium">{activity.resourceType.toLowerCase()}</span>
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatDate(activity.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Upload */}
      <Link href="/app/documents/upload">
        <Card className="border-2 border-dashed border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 transition-all cursor-pointer group bg-white">
          <CardContent className="p-8 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 group-hover:bg-amber-100 flex items-center justify-center mb-4 transition-colors">
              <Upload className="w-7 h-7 text-slate-600 group-hover:text-amber-600" />
            </div>
            <h3 className="font-semibold text-slate-900 text-lg mb-1">Upload New Document</h3>
            <p className="text-sm text-slate-500">
              Drag and drop or click to upload a document for analysis
            </p>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
