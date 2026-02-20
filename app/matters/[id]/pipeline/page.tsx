'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Play,
  RefreshCw,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  Terminal,
  ChevronDown,
  ChevronUp,
  Database,
  Brain,
  Layers,
  GitMerge,
  Clock,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

const STEP_ICONS: Record<string, React.ReactNode> = {
  IDLE: <Clock className="w-5 h-5" />,
  EXTRACT: <FileText className="w-5 h-5" />,
  INDEX: <Database className="w-5 h-5" />,
  ENRICH: <Brain className="w-5 h-5" />,
  MERGE: <GitMerge className="w-5 h-5" />,
  COMPLETE: <CheckCircle className="w-5 h-5" />,
  ERROR: <AlertCircle className="w-5 h-5" />,
};

const STEP_LABELS: Record<string, string> = {
  IDLE: 'Idle',
  EXTRACT: 'Extract (LlamaCloud)',
  INDEX: 'Index (PageIndex)',
  ENRICH: 'Enrich (OpenAI)',
  MERGE: 'Merge (Master JSON)',
  COMPLETE: 'Complete',
  ERROR: 'Error',
};

export default function PipelinePage() {
  const params = useParams();
  const [isStarting, setIsStarting] = useState(false);
  const [activeTab, setActiveTab] = useState('progress');

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
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold">AI Pipeline</h1>
            <Badge variant="outline" className="glass text-xs">
              <Sparkles className="w-3 h-3 mr-1 text-brand-400" />
              GPT-4 Powered
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Build offline index for intelligent document analysis
          </p>
        </div>
        <Button
          className="btn-gradient text-white border-0"
        >
          <Play className="w-4 h-4 mr-2" />
          Build Offline Index
        </Button>
      </motion.div>

      {/* Progress Overview */}
      <div className="grid grid-cols-5 gap-3">
        {['EXTRACT', 'INDEX', 'ENRICH', 'MERGE', 'COMPLETE'].map((step, index) => (
          <Card key={step} className="glass-card">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mb-2">
                {STEP_ICONS[step]}
              </div>
              <span className="text-xs font-medium">{STEP_LABELS[step]}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="glass">
          <TabsTrigger value="progress" className="data-[state=active]:bg-brand-500/20">Progress</TabsTrigger>
          <TabsTrigger value="documents" className="data-[state=active]:bg-brand-500/20">Documents</TabsTrigger>
          <TabsTrigger value="artifacts" className="data-[state=active]:bg-brand-500/20">Artifacts</TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="space-y-4">
          {/* Current Status */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="w-5 h-5 text-brand-400" />
                Pipeline Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Overall Progress</span>
                  <span className="font-medium">0%</span>
                </div>
                <Progress value={0} className="h-2 bg-white/5" />
              </div>
              
              <div className="p-4 glass rounded-xl border border-white/5">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Clock className="w-5 h-5" />
                  <span>Ready to start. Click "Build Offline Index" to begin processing.</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live Logs */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Terminal className="w-5 h-5 text-violet-400" />
                Live Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-black/40 rounded-xl p-4 font-mono text-sm h-64 overflow-y-auto border border-white/5">
                <div className="text-muted-foreground text-center py-8">
                  No logs yet. Start the pipeline to see live logs.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-400" />
                Select Documents to Process
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No documents in this matter yet.</p>
                <p className="text-sm">Upload documents first to process them.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="artifacts" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-violet-400" />
                Generated Artifacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No artifacts yet.</p>
                <p className="text-sm">Complete a pipeline run to generate artifacts.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
