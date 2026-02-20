'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  FileText,
  AlertCircle,
  RefreshCw,
  PieChart,
  Calendar,
  Wallet,
  CheckCircle2,
  XCircle,
  Flag,
  Building2,
  Users,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  PieChart as RePieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  Legend,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar
} from 'recharts';

// Formatting utilities
function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

// Modern color palette
const COLORS = {
  primary: ['#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#84cc16'],
  gradients: [
    ['#f59e0b', '#fbbf24'],
    ['#f97316', '#fb923c'],
    ['#ef4444', '#f87171'],
    ['#ec4899', '#f472b6'],
    ['#8b5cf6', '#a78bfa'],
    ['#6366f1', '#818cf8'],
    ['#3b82f6', '#60a5fa'],
    ['#06b6d4', '#22d3ee'],
    ['#10b981', '#34d399'],
    ['#84cc16', '#a3e635'],
  ],
  status: {
    APPROVED: '#10b981',
    PENDING: '#f59e0b',
    REJECTED: '#ef4444',
    FLAGGED: '#f97316',
    DRAFT: '#94a3b8',
    REVIEW: '#8b5cf6'
  }
};

interface InvoiceStats {
  totalInvoices: number;
  totalAmount: number;
  averageAmount: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  flagged: number;
  monthlyData: Array<{
    month: string;
    count: number;
    amount: number;
  }>;
  topVendors: Array<{
    vendor: string;
    count: number;
    amount: number;
  }>;
  statusBreakdown: Array<{
    status: string;
    count: number;
    amount: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    count: number;
    amount: number;
  }>;
}

// Animated counter component
function AnimatedCounter({ value, prefix = '', suffix = '', duration = 2000 }: { 
  value: number; 
  prefix?: string; 
  suffix?: string;
  duration?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    let startTime: number;
    let animationFrame: number;
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.floor(value * easeOut));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);
  
  return (
    <span>
      {prefix}{formatNumber(displayValue)}{suffix}
    </span>
  );
}

// Custom Donut Chart Component
function DonutChart({ data, title, total, colors }: { 
  data: Array<{ name: string; value: number; amount?: number }>;
  title: string;
  total: number;
  colors: string[];
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  
  const totalAmount = useMemo(() => 
    data.reduce((sum, item) => sum + (item.amount || item.value), 0),
    [data]
  );

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-100">
          <p className="font-semibold text-slate-900">{item.name}</p>
          <p className="text-amber-600 font-medium">
            {formatNumber(item.value)} invoices
          </p>
          {item.amount && (
            <p className="text-slate-500 text-sm">
              {formatCurrency(item.amount)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RePieChart>
          <defs>
            {colors.map((color, index) => (
              <linearGradient key={`gradient-${index}`} id={`gradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={color} />
                <stop offset="100%" stopColor={COLORS.gradients[index % COLORS.gradients.length][1]} />
              </linearGradient>
            ))}
          </defs>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={4}
            dataKey="value"
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={`url(#gradient-${index})`}
                stroke={activeIndex === index ? '#fff' : 'none'}
                strokeWidth={activeIndex === index ? 3 : 0}
                style={{
                  filter: activeIndex === index ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' : 'none',
                  transition: 'all 0.3s ease'
                }}
              />
            ))}
          </Pie>
          <ReTooltip content={<CustomTooltip />} />
        </RePieChart>
      </ResponsiveContainer>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className="text-xl font-bold text-slate-900">{total}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">{title}</p>
        </div>
      </div>
    </div>
  );
}

// Area Chart Component for Monthly Trend
function MonthlyTrendChart({ data }: { data: Array<{ month: string; count: number; amount: number }> }) {
  const chartData = useMemo(() => 
    data.map(item => ({
      ...item,
      formattedAmount: item.amount / 1000 // Convert to thousands
    })),
    [data]
  );

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis 
            dataKey="month" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 12 }}
          />
          <YAxis 
            yAxisId="left"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 12 }}
            tickFormatter={(value) => `$${value}k`}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 12 }}
          />
          <ReTooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              borderRadius: '12px', 
              border: '1px solid #e2e8f0',
              boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
            }}
            formatter={(value: number, name: string) => {
              if (name === 'Amount') return [formatCurrency(value * 1000), name];
              return [value, name];
            }}
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="formattedAmount"
            name="Amount"
            stroke="#f59e0b"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorAmount)"
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="count"
            name="Invoices"
            stroke="#6366f1"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorCount)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Horizontal Bar Chart for Top Vendors
function VendorBarChart({ data }: { data: Array<{ vendor: string; count: number; amount: number }> }) {
  const chartData = useMemo(() => 
    data.slice(0, 5).map(item => ({
      ...item,
      name: item.vendor.length > 15 ? item.vendor.substring(0, 15) + '...' : item.vendor
    })).reverse(),
    [data]
  );

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
          <XAxis type="number" hide />
          <YAxis 
            dataKey="name" 
            type="category"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#475569', fontSize: 12, fontWeight: 500 }}
            width={75}
          />
          <ReTooltip
            cursor={{ fill: 'rgba(245, 158, 11, 0.1)' }}
            contentStyle={{ 
              backgroundColor: '#fff', 
              borderRadius: '12px', 
              border: '1px solid #e2e8f0',
              boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
            }}
            formatter={(value: number, name: string, props: any) => {
              return [formatCurrency(props.payload.amount), 'Amount'];
            }}
          />
          <Bar 
            dataKey="count" 
            name="Invoices"
            fill="#f59e0b"
            radius={[0, 8, 8, 0]}
            barSize={24}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS.primary[index % COLORS.primary.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function InvoiceInsightsPage() {
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/invoices/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Prepare chart data
  const statusChartData = useMemo(() => {
    if (!stats) return [];
    return stats.statusBreakdown.map(item => ({
      name: item.status.charAt(0) + item.status.slice(1).toLowerCase(),
      value: item.count,
      amount: item.amount
    }));
  }, [stats]);

  const categoryChartData = useMemo(() => {
    if (!stats) return [];
    return stats.categoryBreakdown.map(item => ({
      name: item.category.charAt(0) + item.category.slice(1).toLowerCase().replace(/_/g, ' '),
      value: item.count,
      amount: item.amount
    }));
  }, [stats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-amber-200 border-t-amber-500" />
          <div className="absolute inset-0 animate-ping rounded-full h-16 w-16 border-4 border-amber-400 opacity-20" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <p className="text-slate-600">{error}</p>
        <Button onClick={fetchStats} variant="outline" className="rounded-full">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!stats || stats.totalInvoices === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
          <BarChart3 className="w-10 h-10 text-slate-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">No Invoice Data Yet</h2>
        <p className="text-slate-500 max-w-md text-center">
          Upload your first invoice to see insights and analytics here.
        </p>
        <Link href="/app/invoices">
          <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-full shadow-lg shadow-amber-200">
            <FileText className="w-4 h-4 mr-2" />
            Upload Invoices
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
            Invoice Insights
          </h1>
          <p className="text-slate-500 mt-1">Analytics and overview of your invoice data</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchStats} variant="outline" size="sm" className="rounded-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Link href="/app/invoices">
            <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-full shadow-lg shadow-amber-200" size="sm">
              <FileText className="w-4 h-4 mr-2" />
              View Invoices
            </Button>
          </Link>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { 
            label: 'Total Invoices', 
            value: stats.totalInvoices, 
            icon: FileText, 
            gradient: 'from-amber-500 to-orange-500',
            bg: 'bg-amber-50',
            text: 'text-amber-600'
          },
          { 
            label: 'Total Amount', 
            value: stats.totalAmount, 
            prefix: '$',
            icon: DollarSign, 
            gradient: 'from-emerald-500 to-teal-500',
            bg: 'bg-emerald-50',
            text: 'text-emerald-600'
          },
          { 
            label: 'Average Amount', 
            value: stats.averageAmount, 
            prefix: '$',
            icon: Wallet, 
            gradient: 'from-blue-500 to-indigo-500',
            bg: 'bg-blue-50',
            text: 'text-blue-600'
          },
          { 
            label: 'Pending Review', 
            value: stats.pendingReview, 
            icon: AlertCircle, 
            gradient: 'from-rose-500 to-pink-500',
            bg: 'bg-rose-50',
            text: 'text-rose-600'
          },
        ].map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="border-0 shadow-lg shadow-slate-200/50 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{metric.label}</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">
                      {metric.prefix ? (
                        <AnimatedCounter value={metric.value} prefix={metric.prefix} />
                      ) : (
                        <AnimatedCounter value={metric.value} />
                      )}
                    </p>
                  </div>
                  <div className={`w-14 h-14 rounded-2xl ${metric.bg} flex items-center justify-center transform rotate-3`}>
                    <metric.icon className={`w-7 h-7 ${metric.text}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Row 1 - Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Breakdown Donut */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-0 shadow-lg shadow-slate-200/50 h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                      <PieChart className="w-4 h-4 text-white" />
                    </div>
                    Status
                  </CardTitle>
                  <CardDescription>By review status</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative h-[220px]">
                <DonutChart 
                  data={statusChartData} 
                  title="Total"
                  total={stats.totalInvoices}
                  colors={COLORS.primary.slice(0, statusChartData.length)}
                />
              </div>
              <div className="mt-4 space-y-2 max-h-[120px] overflow-y-auto">
                {stats.statusBreakdown.slice(0, 4).map((item, index) => (
                  <div key={item.status} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full shadow-sm"
                        style={{ background: `linear-gradient(135deg, ${COLORS.primary[index % COLORS.primary.length]}, ${COLORS.gradients[index % COLORS.gradients.length][1]})` }}
                      />
                      <span className="text-xs font-medium text-slate-700 capitalize">
                        {item.status.toLowerCase()}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-slate-900">{item.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Category Breakdown Donut */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <Card className="border-0 shadow-lg shadow-slate-200/50 h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                      <PieChart className="w-4 h-4 text-white" />
                    </div>
                    Categories
                  </CardTitle>
                  <CardDescription>By expense category</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative h-[220px]">
                <DonutChart 
                  data={categoryChartData} 
                  title="Total"
                  total={stats.totalInvoices}
                  colors={COLORS.primary.slice(3, 3 + categoryChartData.length)}
                />
              </div>
              <div className="mt-4 space-y-2 max-h-[120px] overflow-y-auto">
                {stats.categoryBreakdown.slice(0, 4).map((item, index) => (
                  <div key={item.category} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full shadow-sm"
                        style={{ background: `linear-gradient(135deg, ${COLORS.primary[(index + 3) % COLORS.primary.length]}, ${COLORS.gradients[(index + 3) % COLORS.gradients.length][1]})` }}
                      />
                      <span className="text-xs font-medium text-slate-700 capitalize">
                        {item.category.toLowerCase().replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-slate-900">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Vendors Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="border-0 shadow-lg shadow-slate-200/50 h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-white" />
                    </div>
                    Top Vendors
                  </CardTitle>
                  <CardDescription>By invoice amount</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {stats.topVendors.length > 0 ? (
                <VendorBarChart data={stats.topVendors} />
              ) : (
                <div className="h-[250px] flex items-center justify-center text-slate-400">
                  No vendor data available
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts Row 2 - Monthly Trend Area Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="border-0 shadow-lg shadow-slate-200/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-white" />
                  </div>
                  Monthly Trend
                </CardTitle>
                <CardDescription>Invoice volume and amount over time</CardDescription>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-slate-600">Amount</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-500" />
                  <span className="text-slate-600">Count</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {stats.monthlyData.length > 0 ? (
              <MonthlyTrendChart data={stats.monthlyData} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-400">
                No monthly data available
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Summary Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Approved', value: stats.approved, icon: CheckCircle2, color: 'emerald', gradient: 'from-emerald-500 to-teal-500' },
            { label: 'Pending', value: stats.pendingReview, icon: AlertCircle, color: 'amber', gradient: 'from-amber-500 to-orange-500' },
            { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'rose', gradient: 'from-rose-500 to-pink-500' },
            { label: 'Flagged', value: stats.flagged, icon: Flag, color: 'orange', gradient: 'from-orange-500 to-red-500' },
          ].map((stat) => (
            <Card key={stat.label} className="border-0 shadow-lg shadow-slate-200/50 overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">
                      <AnimatedCounter value={stat.value} />
                    </p>
                    <p className="text-sm text-slate-500">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
