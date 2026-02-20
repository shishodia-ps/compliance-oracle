'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { 
  FileText, Upload, Loader2, CheckCircle, AlertCircle, 
  RefreshCw, Clock, Trash2, Eye, Search, Filter, X, ChevronDown,
  DollarSign, User, Building2, CalendarDays, Download, FileJson
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
// Filter dropdown state
// Using simple dropdown instead of popover

interface Invoice {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  status: string;
  processingStage: string | null;
  error: string | null;
  // Extracted fields (may be null if not processed)
  vendorName?: string | null;
  employeeName?: string | null;
  amount?: number | null;
  currency?: string;
  category?: string | null;
  invoiceDate?: string | null;
}

interface Filters {
  category: string | null;
  minAmount: string;
  maxAmount: string;
  vendor: string | null;
  employee: string | null;
  dateFrom: string;
  dateTo: string;
}

const CATEGORIES = ['FOOD', 'TAXI_UBER', 'OFFICE_SUPPLIES', 'SOFTWARE', 'ENTERTAINMENT', 'TRAVEL', 'HOTEL', 'MEDICAL', 'OTHER'];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState<Filters>({
    category: null,
    minAmount: '',
    maxAmount: '',
    vendor: null,
    employee: null,
    dateFrom: '',
    dateTo: '',
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch('/api/invoices');
      const data = await res.json();
      setInvoices(data.invoices || []);
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchSearch = 
          inv.fileName.toLowerCase().includes(query) ||
          inv.id.toLowerCase().includes(query) ||
          (inv.vendorName?.toLowerCase() || '').includes(query) ||
          (inv.employeeName?.toLowerCase() || '').includes(query);
        if (!matchSearch) return false;
      }
      
      // Category filter
      if (filters.category && inv.category !== filters.category) return false;
      
      // Amount filter
      if (filters.minAmount && (inv.amount || 0) < parseFloat(filters.minAmount)) return false;
      if (filters.maxAmount && (inv.amount || 0) > parseFloat(filters.maxAmount)) return false;
      
      // Vendor filter
      if (filters.vendor && inv.vendorName !== filters.vendor) return false;
      
      // Employee filter
      if (filters.employee && inv.employeeName !== filters.employee) return false;
      
      // Date filter
      if (filters.dateFrom) {
        const invDate = inv.invoiceDate ? new Date(inv.invoiceDate) : null;
        const fromDate = new Date(filters.dateFrom);
        if (invDate && invDate < fromDate) return false;
      }
      if (filters.dateTo) {
        const invDate = inv.invoiceDate ? new Date(inv.invoiceDate) : null;
        const toDate = new Date(filters.dateTo);
        if (invDate && invDate > toDate) return false;
      }
      
      return true;
    });
  }, [invoices, searchQuery, filters]);

  // Get unique vendors and employees for filter dropdowns
  const { vendors, employees } = useMemo(() => {
    const vendorSet = new Set<string>();
    const employeeSet = new Set<string>();
    invoices.forEach(inv => {
      if (inv.vendorName) vendorSet.add(inv.vendorName);
      if (inv.employeeName) employeeSet.add(inv.employeeName);
    });
    return {
      vendors: Array.from(vendorSet).sort(),
      employees: Array.from(employeeSet).sort(),
    };
  }, [invoices]);

  // Poll for status updates
  useEffect(() => {
    const processingInvoices = invoices.filter(
      inv => inv.status === 'Queued' || inv.status === 'Parsing' || inv.status === 'Processing'
    );
    if (processingInvoices.length === 0) return;

    const interval = setInterval(() => {
      fetchInvoices();
    }, 3000);

    return () => clearInterval(interval);
  }, [invoices, fetchInvoices]);

  // Handle file upload
  const handleUpload = async (file: File) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Only PDF, PNG, JPG allowed.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/invoices/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        toast.success('Invoice uploaded');
        fetchInvoices();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Upload failed');
      }
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) {
      Array.from(e.dataTransfer.files).forEach(file => handleUpload(file));
    }
  };

  // Format helpers
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number | null, currency: string = 'USD') => {
    if (amount == null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Ready':
      case 'ANALYZED':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'Parsing':
      case 'Processing':
      case 'PARSING':
      case 'EXTRACTED':
        return <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />;
      case 'Failed':
      case 'ERROR':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'Ready':
      case 'ANALYZED':
        return 'Ready';
      case 'Parsing':
      case 'Processing':
      case 'PARSING':
        return 'Processing';
      case 'Failed':
      case 'ERROR':
        return 'Failed';
      default:
        return 'Queued';
    }
  };

  const getCategoryColor = (category: string | null) => {
    const colors: Record<string, string> = {
      FOOD: 'bg-orange-100 text-orange-700',
      TAXI_UBER: 'bg-blue-100 text-blue-700',
      OFFICE_SUPPLIES: 'bg-slate-100 text-slate-700',
      SOFTWARE: 'bg-purple-100 text-purple-700',
      ENTERTAINMENT: 'bg-pink-100 text-pink-700',
      TRAVEL: 'bg-cyan-100 text-cyan-700',
      HOTEL: 'bg-indigo-100 text-indigo-700',
      MEDICAL: 'bg-green-100 text-green-700',
      OTHER: 'bg-gray-100 text-gray-700',
    };
    return colors[category || 'OTHER'] || colors.OTHER;
  };

  // Actions
  const handleRetry = async (invoiceId: string) => {
    try {
      toast.info('Retrying...');
      await fetch(`/api/invoices/${invoiceId}/retry`, { method: 'POST' });
      fetchInvoices();
    } catch {
      toast.error('Retry failed');
    }
  };

  const handleDelete = async (invoiceId: string) => {
    if (!confirm('Delete this invoice?')) return;
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Deleted');
        fetchInvoices();
      } else {
        toast.error('Delete failed');
      }
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} invoices?`)) return;
    const promises = Array.from(selectedIds).map(id => 
      fetch(`/api/invoices/${id}`, { method: 'DELETE' })
    );
    await Promise.all(promises);
    toast.success(`Deleted ${selectedIds.size} invoices`);
    setSelectedIds(new Set());
    fetchInvoices();
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredInvoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInvoices.map(i => i.id)));
    }
  };

  const clearFilters = () => {
    setFilters({
      category: null,
      minAmount: '',
      maxAmount: '',
      vendor: null,
      employee: null,
      dateFrom: '',
      dateTo: '',
    });
  };

  const hasActiveFilters = filters.category || filters.minAmount || filters.maxAmount || 
    filters.vendor || filters.employee || filters.dateFrom || filters.dateTo;

  // Export functions
  const exportToJSON = async () => {
    try {
      const params = new URLSearchParams();
      params.set('format', 'json');
      if (filters.category) params.set('category', filters.category);
      if (filters.minAmount) params.set('minAmount', filters.minAmount);
      if (filters.maxAmount) params.set('maxAmount', filters.maxAmount);
      if (filters.vendor) params.set('vendor', filters.vendor);
      if (filters.employee) params.set('employee', filters.employee);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      
      const res = await fetch(`/api/invoices/export?${params}`);
      const data = await res.json();
      
      // Download as file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoices_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success(`Exported ${data.count} invoices to JSON`);
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const exportToCSV = async () => {
    try {
      const params = new URLSearchParams();
      params.set('format', 'csv');
      if (filters.category) params.set('category', filters.category);
      if (filters.minAmount) params.set('minAmount', filters.minAmount);
      if (filters.maxAmount) params.set('maxAmount', filters.maxAmount);
      if (filters.vendor) params.set('vendor', filters.vendor);
      if (filters.employee) params.set('employee', filters.employee);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      
      const res = await fetch(`/api/invoices/export?${params}`);
      const csv = await res.text();
      
      // Download as file
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoices_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('Exported to CSV');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Upload Invoices</h1>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            multiple
          />
          <Button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Upload
          </Button>
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive 
            ? 'border-amber-500 bg-amber-50' 
            : 'border-slate-200 hover:border-slate-300'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <p className="text-sm text-slate-600">
          Drop PDF or image files here, or click Upload button
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[300px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name, vendor, employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>
          
          {/* Filter Toggle */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowFilters(!showFilters)}
            className={`relative ${hasActiveFilters ? 'border-amber-500 text-amber-600' : ''}`}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full" />
            )}
          </Button>
        </div>
        
        {selectedIds.size > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleBulkDelete}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-slate-50 border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Filter Invoices</h4>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear all
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Category Filter */}
            <div>
              <label className="text-xs font-medium text-slate-500">Category</label>
              <select
                className="w-full mt-1 h-9 rounded-md border border-slate-200 px-2 text-sm bg-white"
                value={filters.category || ''}
                onChange={(e) => setFilters(f => ({ ...f, category: e.target.value || null }))}
              >
                <option value="">All Categories</option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            
            {/* Amount Range */}
            <div>
              <label className="text-xs font-medium text-slate-500">Amount Range</label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.minAmount}
                  onChange={(e) => setFilters(f => ({ ...f, minAmount: e.target.value }))}
                  className="h-9"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.maxAmount}
                  onChange={(e) => setFilters(f => ({ ...f, maxAmount: e.target.value }))}
                  className="h-9"
                />
              </div>
            </div>
            
            {/* Vendor Filter */}
            {vendors.length > 0 && (
              <div>
                <label className="text-xs font-medium text-slate-500">Vendor</label>
                <select
                  className="w-full mt-1 h-9 rounded-md border border-slate-200 px-2 text-sm bg-white"
                  value={filters.vendor || ''}
                  onChange={(e) => setFilters(f => ({ ...f, vendor: e.target.value || null }))}
                >
                  <option value="">All Vendors</option>
                  {vendors.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Employee Filter */}
            {employees.length > 0 && (
              <div>
                <label className="text-xs font-medium text-slate-500">Employee</label>
                <select
                  className="w-full mt-1 h-9 rounded-md border border-slate-200 px-2 text-sm bg-white"
                  value={filters.employee || ''}
                  onChange={(e) => setFilters(f => ({ ...f, employee: e.target.value || null }))}
                >
                  <option value="">All Employees</option>
                  {employees.map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Date Range */}
            <div>
              <label className="text-xs font-medium text-slate-500">Invoice Date</label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="date"
                  placeholder="From"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                  className="h-9"
                />
                <Input
                  type="date"
                  placeholder="To"
                  value={filters.dateTo}
                  onChange={(e) => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                  className="h-9"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">Active filters:</span>
          {filters.category && (
            <Badge variant="secondary" className="text-xs">
              Category: {filters.category.replace(/_/g, ' ')}
              <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, category: null }))} />
            </Badge>
          )}
          {(filters.minAmount || filters.maxAmount) && (
            <Badge variant="secondary" className="text-xs">
              Amount: {filters.minAmount || '0'} - {filters.maxAmount || '∞'}
              <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, minAmount: '', maxAmount: '' }))} />
            </Badge>
          )}
          {filters.vendor && (
            <Badge variant="secondary" className="text-xs">
              Vendor: {filters.vendor}
              <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, vendor: null }))} />
            </Badge>
          )}
          {filters.employee && (
            <Badge variant="secondary" className="text-xs">
              Employee: {filters.employee}
              <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, employee: null }))} />
            </Badge>
          )}
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden bg-white">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-400">
            <FileText className="w-8 h-8 mb-2" />
            <p className="text-sm">No invoices found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="w-10 px-4 py-3">
                  <Checkbox 
                    checked={selectedIds.size === filteredInvoices.length && filteredInvoices.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Invoice</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700 w-32">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    Amount
                  </span>
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-700 w-16">Curr</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700 w-28">Category</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700 w-32">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    Vendor
                  </span>
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-700 w-32">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Employee
                  </span>
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-700 w-24">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    Date
                  </span>
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-700 w-24">Status</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700 w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="border-b hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Checkbox 
                      checked={selectedIds.has(invoice.id)}
                      onCheckedChange={() => toggleSelect(invoice.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate" title={invoice.fileName}>
                          {invoice.fileName}
                        </p>
                        <p className="text-xs text-slate-400">{invoice.id.slice(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {invoice.amount != null ? invoice.amount.toLocaleString('en-US', {maximumFractionDigits: 2}) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs font-normal">
                      {invoice.currency || 'USD'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {invoice.category ? (
                      <Badge className={`text-xs ${getCategoryColor(invoice.category)}`}>
                        {invoice.category.replace(/_/g, ' ')}
                      </Badge>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 truncate max-w-[120px]" title={invoice.vendorName || ''}>
                    {invoice.vendorName || '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 truncate max-w-[120px]" title={invoice.employeeName || ''}>
                    {invoice.employeeName || '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(invoice.invoiceDate || invoice.uploadedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(invoice.status)}
                      <span className={`text-xs ${
                        invoice.status === 'Ready' || invoice.status === 'ANALYZED' ? 'text-green-600' :
                        invoice.status === 'Failed' || invoice.status === 'ERROR' ? 'text-red-600' :
                        invoice.status === 'Parsing' || invoice.status === 'Processing' ? 'text-amber-600' :
                        'text-slate-500'
                      }`}>
                        {getStatusText(invoice.status)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link href={`/app/invoices/${invoice.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="w-4 h-4 text-slate-500" />
                        </Button>
                      </Link>
                      {(invoice.status === 'Failed' || invoice.status === 'ERROR') && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleRetry(invoice.id)}
                        >
                          <RefreshCw className="w-4 h-4 text-slate-500" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleDelete(invoice.id)}
                      >
                        <Trash2 className="w-4 h-4 text-slate-500 hover:text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <p>{filteredInvoices.length} invoices</p>
        {selectedIds.size > 0 && <p>{selectedIds.size} selected</p>}
      </div>
    </div>
  );
}
