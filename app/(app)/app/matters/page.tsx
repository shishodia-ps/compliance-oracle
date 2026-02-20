'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import {
  FolderOpen,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Calendar,
  FileText,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { validateForm, schemas, ValidationErrors } from '@/lib/validation';

interface Matter {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  tags: string[];
  _count: {
    documents: number;
    tasks: number;
  };
}

const statusColors: Record<string, string> = {
  ACTIVE: 'success',
  PENDING: 'warning',
  CLOSED: 'secondary',
  ARCHIVED: 'default',
};

const priorityColors: Record<string, string> = {
  high: 'destructive',
  medium: 'warning',
  low: 'secondary',
};

export default function MattersPage() {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priority: 'medium',
    dueDate: '',
  });
  const [formErrors, setFormErrors] = useState<ValidationErrors>({});

  useEffect(() => {
    fetchMatters();
  }, []);

  const fetchMatters = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/matters');
      if (!response.ok) throw new Error('Failed to fetch matters');
      const data = await response.json();
      setMatters(data.matters || []);
    } catch (error) {
      toast.error('Failed to load matters');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateMatterForm = () => {
    const { valid, errors } = validateForm(formData, schemas.matter);
    setFormErrors(errors);
    return valid;
  };

  const handleCreateMatter = async () => {
    if (!validateMatterForm()) {
      const firstError = Object.values(formErrors)[0];
      if (firstError) toast.error(firstError);
      return;
    }

    try {
      setIsCreating(true);
      const response = await fetch('/api/matters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          priority: formData.priority,
          dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
          status: 'ACTIVE',
          tags: [],
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create matter');
      }
      
      toast.success('Matter created successfully');
      setIsCreateDialogOpen(false);
      setFormData({ name: '', description: '', priority: 'medium', dueDate: '' });
      setFormErrors({});
      fetchMatters();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create matter');
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const filteredMatters = useMemo(() => 
    matters.filter((matter) =>
      matter.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (matter.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      matter.tags?.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      )
    ), [matters, searchQuery]
  );

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No due date';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
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
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold">Matters</h1>
          <p className="text-muted-foreground">
            Manage your cases, projects, and legal matters
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-500 hover:bg-amber-600">
              <Plus className="w-4 h-4 mr-2" />
              New Matter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Matter</DialogTitle>
              <DialogDescription>
                Enter the details for your new legal matter.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Matter Name *</Label>
                <Input 
                  id="name" 
                  placeholder="e.g., Acme Corp Acquisition"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                  }}
                  aria-invalid={!!formErrors.name}
                  className={formErrors.name ? 'border-red-500' : ''}
                />
                {formErrors.name && (
                  <p className="text-sm text-red-500">{formErrors.name}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input 
                  id="description" 
                  placeholder="Brief description..."
                  value={formData.description}
                  onChange={(e) => {
                    setFormData({ ...formData, description: e.target.value });
                    if (formErrors.description) setFormErrors({ ...formErrors, description: '' });
                  }}
                  aria-invalid={!!formErrors.description}
                  className={formErrors.description ? 'border-red-500' : ''}
                />
                {formErrors.description && (
                  <p className="text-sm text-red-500">{formErrors.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {formData.description.length}/2000 characters
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <select
                    id="priority"
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input 
                    id="dueDate" 
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-amber-500 hover:bg-amber-600"
                onClick={handleCreateMatter}
                disabled={isCreating}
              >
                {isCreating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
                ) : (
                  'Create Matter'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Search & Filter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search matters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="w-4 h-4" />
          Filter
        </Button>
      </motion.div>

      {/* Matters Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {filteredMatters.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-muted-foreground">
            <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No matters found. Create your first matter to get started.</p>
          </div>
        ) : (
          filteredMatters.map((matter) => (
            <Link key={matter.id} href={`/app/matters/${matter.id}`}>
              <Card className="h-full hover:border-amber-500/30 transition-colors group">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <FolderOpen className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <h3 className="font-medium group-hover:text-amber-500 transition-colors">
                          {matter.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {matter.description || 'No description'}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => e.preventDefault()}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem>Duplicate</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-400">
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant={statusColors[matter.status] as any}>
                      {matter.status}
                    </Badge>
                    <Badge variant={priorityColors[matter.priority] as any}>
                      {matter.priority}
                    </Badge>
                    {matter.tags?.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      {matter._count.documents} docs
                    </span>
                    <span className="flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {matter._count.tasks} tasks
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Due {formatDate(matter.dueDate)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </motion.div>
    </div>
  );
}
