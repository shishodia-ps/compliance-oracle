'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import {
  FileText,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Download,
  Share2,
  MoreHorizontal,
  ChevronLeft,
  Sparkles,
  Shield,
  FileSearch,
  Loader2,
  Send,
  Trash2,
  Edit,
  Eye,
  X,
  Copy,
  Check,
  Upload,
  FileDigit,
  Brain,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Document {
  id: string;
  name: string;
  fileName: string;
  documentType: string;
  status: 'UPLOADED' | 'PROCESSING' | 'ANALYZED' | 'ERROR';
  processingStage?: string;
  fileSize: number;
  createdAt: string;
  storageKey: string;
  matter: { name: string } | null;
  summary: {
    summary: string;
    keyPoints: string[];
  } | null;
  risks: Risk[];
}

interface Risk {
  id: string;
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Clause {
  title: string;
  content: string;
}

interface ProcessingStage {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const PROCESSING_STAGES: ProcessingStage[] = [
  { id: 'UPLOADED', label: 'Uploaded', icon: <Upload className="w-3 h-3" />, description: 'File received' },
  { id: 'EXTRACTING', label: 'Extracting', icon: <FileDigit className="w-3 h-3" />, description: 'Parsing PDF content' },
  { id: 'INDEXING', label: 'Indexing', icon: <FileText className="w-3 h-3" />, description: 'Building tree structure' },
  { id: 'ANALYZING', label: 'Analyzing', icon: <Brain className="w-3 h-3" />, description: 'AI summary & risks' },
  { id: 'COMPLETED', label: 'Completed', icon: <CheckCircle2 className="w-3 h-3" />, description: 'Ready to use' },
];

export default function DocumentViewerPage() {
  const params = useParams();
  const documentId = params.id as string;
  
  const [doc, setDoc] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  
  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Progress tracking
  const [progress, setProgress] = useState<{progress: number; step: string; message: string} | null>(null);
  const isProcessingRef = useRef(false);

  // Sync processing status to ref (avoids circular useEffect)
  useEffect(() => {
    isProcessingRef.current = doc?.status === 'PROCESSING';
  }, [doc?.status]);

  useEffect(() => {
    const controller = new AbortController();

    fetchDocument(controller.signal);
    fetchClauses(controller.signal);
    setPdfUrl(`/api/documents/${documentId}/preview`);

    // Poll for updates if processing
    const interval = setInterval(() => {
      if (isProcessingRef.current) {
        fetchDocument(controller.signal);
        fetchProgress(controller.signal);
      }
    }, 2000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [documentId]);

  const fetchProgress = async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/progress`, { signal });
      if (response.ok) {
        const data = await response.json();
        setProgress(data);
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
    }
  };

  const fetchDocument = async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, { signal });
      if (response.ok) {
        const data = await response.json();
        setDoc(data);
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      toast.error('Error loading document');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClauses = async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/clauses`, { signal });
      if (response.ok) {
        const data = await response.json();
        setClauses(data.clauses || []);
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      console.error('Failed to fetch clauses');
    }
  };

  const handleDownload = () => {
    window.open(`/api/documents/${documentId}/download`, '_blank');
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresInDays: 7 }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setShareUrl(data.shareUrl);
        setShareDialogOpen(true);
      } else {
        toast.error('Failed to create share link');
      }
    } catch (error) {
      toast.error('Failed to create share link');
    } finally {
      setIsSharing(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await fetch(`/api/documents/${documentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(errorData.error || 'Failed to get response');
        return;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') && response.body) {
        // Stream tokens progressively
        setChatMessages(prev => [...prev, { role: 'assistant', content: '' }]);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));
                if (event.token) {
                  setChatMessages(prev => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last?.role === 'assistant') {
                      updated[updated.length - 1] = { ...last, content: last.content + event.token };
                    }
                    return updated;
                  });
                }
              } catch {}
            }
          }
        }
      } else {
        // Fallback for non-streaming JSON response
        const data = await response.json();
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      toast.error('Chat error: ' + String(error));
      console.error('Chat error:', error);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        toast.success('Document deleted');
        window.location.href = '/app/documents';
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete document');
      }
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Get current stage index for progress
  const getCurrentStageIndex = () => {
    if (!doc) return 0;
    if (doc.status === 'ANALYZED') return 4;
    if (doc.status === 'ERROR') return -1;
    
    const stageMap: Record<string, number> = {
      'UPLOADED': 0,
      'EXTRACTING': 1,
      'INDEXING': 2,
      'ANALYZING': 3,
    };
    return stageMap[doc.processingStage || 'UPLOADED'] || 0;
  };

  if (!doc) {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-96 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          <p className="text-sm text-slate-500">Loading document...</p>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-slate-500">Document not found</p>
      </div>
    );
  }

  const currentStageIndex = getCurrentStageIndex();

  return (
    <div className="space-y-4">
      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Share Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Anyone with this link can view the document for 7 days.
            </p>
            <div className="flex gap-2">
              <Input 
                value={shareUrl} 
                readOnly 
                className="flex-1 bg-slate-50"
              />
              <Button 
                onClick={copyToClipboard}
                variant="outline"
                className={copied ? 'text-emerald-600' : ''}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/app/documents">
            <Button variant="ghost" size="icon" className="hover:bg-slate-100">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{doc.name}</h1>
              <Badge className={
                doc.status === 'ANALYZED' 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : doc.status === 'PROCESSING'
                  ? 'bg-amber-100 text-amber-700'
                  : doc.status === 'ERROR'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-slate-100 text-slate-700'
              }>
                {doc.status === 'PROCESSING' ? 'Processing...' : doc.status}
              </Badge>
            </div>
            <p className="text-sm text-slate-500">
              {doc.documentType} • {formatFileSize(doc.fileSize)} • {doc.matter?.name || 'No matter'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleShare}
            disabled={isSharing}
          >
            {isSharing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Share2 className="w-4 h-4 mr-2" />
            )}
            Share
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white">
              <DropdownMenuItem onClick={handleDownload} className="cursor-pointer">
                <Eye className="w-4 h-4 mr-2" />
                View Original
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                <Edit className="w-4 h-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="cursor-pointer text-rose-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Processing Progress */}
      {doc.status === 'PROCESSING' && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700">Processing Document</span>
                {progress && (
                  <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                    {progress.progress}%
                  </Badge>
                )}
              </div>
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
            </div>
            
            {/* Continuous Progress Bar */}
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-3">
              <div 
                className="h-full bg-amber-500 transition-all duration-1000 ease-out rounded-full"
                style={{ width: `${progress?.progress || (currentStageIndex * 20)}%` }}
              />
            </div>
            
            {/* Stage Labels */}
            <div className="flex justify-between text-xs text-slate-500">
              {PROCESSING_STAGES.map((stage, index) => {
                const isActive = index <= currentStageIndex;
                const isCurrent = index === currentStageIndex;
                
                return (
                  <div 
                    key={stage.id} 
                    className={`flex flex-col items-center ${
                      isActive ? 'text-slate-700' : 'text-slate-400'
                    } ${isCurrent ? 'font-medium' : ''}`}
                  >
                    <span className="flex items-center gap-1">
                      {stage.icon}
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>
            
            {/* Current Step Description */}
            {progress?.message && (
              <p className="text-xs text-amber-600 mt-2 text-center">
                {progress.message}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {doc.status === 'ERROR' && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <div>
              <p className="text-sm font-medium text-rose-700">Processing Failed</p>
              <p className="text-xs text-rose-600">There was an error processing this document. Please try uploading again.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Document Viewer - PDF iframe or Word HTML */}
        <div className="lg:col-span-2">
          <Card className="h-[700px] border-slate-200">
            <CardContent className="p-0 h-full">
              {doc.fileName.toLowerCase().endsWith('.docx') || doc.fileName.toLowerCase().endsWith('.doc') ? (
                /* Word Document - Convert to HTML using mammoth */
                <iframe
                  src={`/api/documents/${documentId}/content`}
                  className="w-full h-full rounded-lg"
                  title={doc.fileName}
                />
              ) : (
                /* PDF - Show in iframe */
                <iframe
                  src={pdfUrl}
                  className="w-full h-full rounded-lg"
                  title={doc.fileName}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* AI Panel */}
        <div>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full bg-slate-100">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="clauses">Clauses</TabsTrigger>
              <TabsTrigger value="risks">Risks</TabsTrigger>
              <TabsTrigger value="chat">Q&A</TabsTrigger>
            </TabsList>

            {/* Summary Tab */}
            <TabsContent value="summary" className="mt-4">
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    AI Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {doc.summary ? (
                    <>
                      <p className="text-sm text-slate-600">
                        {doc.summary.summary}
                      </p>
                      {doc.summary.keyPoints && doc.summary.keyPoints.length > 0 && (
                        <ul className="space-y-2">
                          {doc.summary.keyPoints.map((point, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                              <span className="text-slate-700">{point}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">
                      {doc.status === 'PROCESSING' 
                        ? 'AI summary is being generated...' 
                        : 'No summary available yet.'}
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Clauses Tab */}
            <TabsContent value="clauses" className="mt-4">
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileSearch className="w-4 h-4 text-amber-500" />
                    Key Clauses
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 max-h-[500px] overflow-auto">
                  {clauses.length > 0 ? (
                    clauses.map((clause, i) => (
                      <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <h4 className="font-medium text-sm text-slate-900 mb-1">{clause.title}</h4>
                        <p className="text-xs text-slate-600 line-clamp-3">{clause.content}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <FileSearch className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm text-slate-400">
                        {doc.status === 'PROCESSING' 
                          ? 'Extracting clauses...' 
                          : 'No clauses extracted yet.'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Risks Tab */}
            <TabsContent value="risks" className="mt-4">
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-500" />
                    Detected Risks
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {doc.risks && doc.risks.length > 0 ? (
                    doc.risks.map((risk) => (
                      <div
                        key={risk.id}
                        className={`p-3 rounded-lg border ${
                          risk.severity === 'CRITICAL' || risk.severity === 'HIGH'
                            ? 'bg-rose-50 border-rose-200'
                            : 'bg-amber-50 border-amber-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle
                            className={`w-4 h-4 ${
                              risk.severity === 'CRITICAL' || risk.severity === 'HIGH'
                                ? 'text-rose-500'
                                : 'text-amber-500'
                            }`}
                          />
                          <Badge
                            className={
                              risk.severity === 'CRITICAL' || risk.severity === 'HIGH'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-700'
                            }
                          >
                            {risk.severity}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-slate-900">{risk.title}</p>
                        <p className="text-xs text-slate-600 mt-1">{risk.description}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Shield className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm text-slate-400">
                        {doc.status === 'PROCESSING' 
                          ? 'Analyzing risks...' 
                          : 'No risks detected.'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Chat Tab */}
            <TabsContent value="chat" className="mt-4 h-[calc(100vh-280px)]">
              <Card className="h-full flex flex-col border-slate-200">
                <CardHeader className="pb-3 shrink-0">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-amber-500" />
                    Document Q&A
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0">
                  <div className="flex-1 space-y-4 overflow-y-auto mb-4 px-1">
                    {chatMessages.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-sm">Ask questions about this document</p>
                        <p className="text-xs mt-1">Example: &quot;What are the termination clauses?&quot;</p>
                      </div>
                    ) : (
                      chatMessages.map((msg, index) => (
                        <div
                          key={index}
                          className={`flex gap-3 ${
                            msg.role === 'user' ? 'justify-end' : ''
                          }`}
                        >
                          {msg.role === 'assistant' && (
                            <Avatar className="w-8 h-8 shrink-0">
                              <AvatarFallback className="bg-amber-100 text-amber-600 text-xs">
                                AI
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div
                            className={`max-w-[85%] p-3 rounded-lg text-sm break-words overflow-hidden prose prose-sm ${
                              msg.role === 'user'
                                ? 'bg-amber-500 text-white prose-invert'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {msg.role === 'user' ? (
                              msg.content
                            ) : (
                              <ReactMarkdown>
                                {msg.content}
                              </ReactMarkdown>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    {isChatLoading && (
                      <div className="flex gap-3">
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarFallback className="bg-amber-100 text-amber-600 text-xs">
                            AI
                          </AvatarFallback>
                        </Avatar>
                        <div className="bg-slate-100 p-3 rounded-lg">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0 pt-2 border-t border-slate-100">
                    <Input
                      placeholder="Ask a question..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      className="flex-1"
                    />
                    <Button 
                      size="icon" 
                      onClick={handleSendMessage}
                      disabled={isChatLoading || !chatInput.trim()}
                      className="bg-amber-500 hover:bg-amber-600"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
