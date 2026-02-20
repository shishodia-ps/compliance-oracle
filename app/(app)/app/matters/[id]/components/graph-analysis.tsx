'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Network,
  Loader2,
  Info,
  Maximize2,
  Users,
  FileText,
  Shield,
  Calendar,
  Gavel,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Document {
  id: string;
  name: string;
  status: string;
}

interface GraphNode {
  id: string;
  name: string;
  type: 'document' | 'entity' | 'clause' | 'party' | 'date';
  val: number;
  color: string;
  description?: string;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
  type: 'contains' | 'references' | 'mentions' | 'related';
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface GraphAnalysisProps {
  matterId: string;
  documents: Document[];
}

const nodeColors: Record<string, string> = {
  document: '#f59e0b',
  entity: '#3b82f6',
  clause: '#10b981',
  party: '#8b5cf6',
  date: '#f43f5e',
};

const typeLabels: Record<string, string> = {
  document: 'Document',
  entity: 'Entity',
  clause: 'Clause',
  party: 'Party',
  date: 'Date',
};

const typeIcons: Record<string, React.ReactNode> = {
  document: <FileText className="w-4 h-4" />,
  entity: <Shield className="w-4 h-4" />,
  clause: <Gavel className="w-4 h-4" />,
  party: <Users className="w-4 h-4" />,
  date: <Calendar className="w-4 h-4" />,
};

// Simple force-directed layout simulation
function simulateForceLayout(nodes: GraphNode[], links: GraphLink[], width: number, height: number): GraphNode[] {
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Initialize positions in a circle
  nodes.forEach((node, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI;
    const radius = Math.min(width, height) * 0.35;
    node.x = centerX + Math.cos(angle) * radius;
    node.y = centerY + Math.sin(angle) * radius;
  });

  // Simple force simulation (100 iterations)
  for (let iteration = 0; iteration < 100; iteration++) {
    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];
        const dx = (nodeB.x || 0) - (nodeA.x || 0);
        const dy = (nodeB.y || 0) - (nodeA.y || 0);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 2000 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        
        nodeA.x = (nodeA.x || 0) - fx;
        nodeA.y = (nodeA.y || 0) - fy;
        nodeB.x = (nodeB.x || 0) + fx;
        nodeB.y = (nodeB.y || 0) + fy;
      }
    }

    // Attraction along links
    links.forEach((link) => {
      const source = nodes.find((n) => n.id === link.source);
      const target = nodes.find((n) => n.id === link.target);
      if (source && target && source.x !== undefined && target.x !== undefined) {
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 100) * 0.01;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        
        source.x += fx;
        source.y += fy;
        target.x -= fx;
        target.y -= fy;
      }
    });

    // Center gravity
    nodes.forEach((node) => {
      if (node.x !== undefined && node.y !== undefined) {
        node.x += (centerX - node.x) * 0.01;
        node.y += (centerY - node.y) * 0.01;
      }
    });
  }

  return nodes;
}

export function GraphAnalysis({ matterId, documents }: GraphAnalysisProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [dimensions] = useState({ width: 800, height: 500 });

  useEffect(() => {
    fetchGraphData();
  }, [matterId]);

  const fetchGraphData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/matters/${matterId}/graph`);
      if (!response.ok) throw new Error('Failed to fetch graph data');
      const data = await response.json();
      
      if (!data.nodes || data.nodes.length === 0) {
        setGraphData(generateDemoData());
      } else {
        setGraphData(data);
      }
    } catch (error) {
      toast.error('Failed to load graph analysis');
      console.error(error);
      setGraphData(generateDemoData());
    } finally {
      setIsLoading(false);
    }
  };

  const generateDemoData = (): GraphData => {
    const nodes: GraphNode[] = [
      { id: 'doc1', name: 'Service Agreement', type: 'document', val: 25, color: nodeColors.document, description: 'Main service contract' },
      { id: 'doc2', name: 'NDA', type: 'document', val: 20, color: nodeColors.document, description: 'Non-disclosure agreement' },
      { id: 'doc3', name: 'Employment Contract', type: 'document', val: 22, color: nodeColors.document, description: 'Senior developer hire' },
      { id: 'party1', name: 'Acme Corp', type: 'party', val: 30, color: nodeColors.party, description: 'Technology company' },
      { id: 'party2', name: 'Legal Solutions LLC', type: 'party', val: 28, color: nodeColors.party, description: 'Legal service provider' },
      { id: 'entity1', name: 'Intellectual Property', type: 'entity', val: 15, color: nodeColors.entity, description: 'IP rights and ownership' },
      { id: 'entity2', name: 'Confidential Info', type: 'entity', val: 16, color: nodeColors.entity, description: 'Protected data' },
      { id: 'clause1', name: 'Indemnification', type: 'clause', val: 12, color: nodeColors.clause, description: 'Liability protection' },
      { id: 'clause2', name: 'Non-Compete', type: 'clause', val: 12, color: nodeColors.clause, description: 'Restriction on competition' },
      { id: 'date1', name: 'Jan 15, 2024', type: 'date', val: 8, color: nodeColors.date, description: 'Effective date' },
    ];

    const links: GraphLink[] = [
      { source: 'doc1', target: 'entity1', type: 'contains' },
      { source: 'doc1', target: 'clause1', type: 'contains' },
      { source: 'doc2', target: 'entity2', type: 'contains' },
      { source: 'doc3', target: 'clause2', type: 'contains' },
      { source: 'doc1', target: 'party1', type: 'mentions' },
      { source: 'doc1', target: 'party2', type: 'mentions' },
      { source: 'doc2', target: 'party1', type: 'mentions' },
      { source: 'doc1', target: 'date1', type: 'references' },
      { source: 'entity1', target: 'entity2', type: 'related' },
      { source: 'clause1', target: 'party1', type: 'related' },
    ];

    return { nodes, links };
  };

  const positionedNodes = useMemo(() => {
    if (!graphData) return [];
    return simulateForceLayout([...graphData.nodes], graphData.links, dimensions.width, dimensions.height);
  }, [graphData, dimensions]);

  const getConnectedNodes = (nodeId: string) => {
    if (!graphData) return [];
    const connected = new Set<string>();
    graphData.links.forEach((link) => {
      if (link.source === nodeId) connected.add(link.target);
      if (link.target === nodeId) connected.add(link.source);
    });
    return Array.from(connected);
  };

  if (isLoading) {
    return (
      <Card className="h-[600px]">
        <CardContent className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </CardContent>
      </Card>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <Card className="h-[600px]">
        <CardContent className="flex flex-col items-center justify-center h-full text-center">
          <Network className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Graph Data Available</h3>
          <p className="text-muted-foreground max-w-md">
            Upload and analyze documents to generate entity relationship graphs.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-4">
        <Card className="flex-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Network className="w-5 h-5" />
              Entity Relationship Graph
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[500px] relative bg-slate-50 rounded-lg overflow-hidden">
              <svg width={dimensions.width} height={dimensions.height} className="w-full h-full">
                {/* Links */}
                {graphData.links.map((link, idx) => {
                  const source = positionedNodes.find((n) => n.id === link.source);
                  const target = positionedNodes.find((n) => n.id === link.target);
                  if (!source || !target || source.x === undefined || target.x === undefined) return null;
                  
                  const isHighlighted = selectedNode && 
                    (link.source === selectedNode.id || link.target === selectedNode.id);
                  
                  return (
                    <line
                      key={idx}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={isHighlighted ? '#f59e0b' : '#cbd5e1'}
                      strokeWidth={isHighlighted ? 3 : 1}
                      opacity={selectedNode && !isHighlighted ? 0.2 : 1}
                    />
                  );
                })}
                
                {/* Nodes */}
                {positionedNodes.map((node) => {
                  const isSelected = selectedNode?.id === node.id;
                  const isConnected = selectedNode && getConnectedNodes(selectedNode.id).includes(node.id);
                  const isDimmed = selectedNode && !isSelected && !isConnected;
                  
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={() => setSelectedNode(node)}
                      style={{ cursor: 'pointer' }}
                      opacity={isDimmed ? 0.3 : 1}
                    >
                      <circle
                        r={isSelected ? 35 : 25 + (node.val / 2)}
                        fill={node.color}
                        stroke={isSelected ? '#f59e0b' : '#fff'}
                        strokeWidth={isSelected ? 4 : 2}
                        className="transition-all duration-300"
                      />
                      <text
                        y={5}
                        textAnchor="middle"
                        className="text-xs font-medium fill-white pointer-events-none"
                      >
                        {node.name.length > 12 ? node.name.slice(0, 12) + '...' : node.name}
                      </text>
                    </g>
                  );
                })}
              </svg>
              
              {/* Legend */}
              <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-sm rounded-lg border shadow-lg p-3">
                <p className="text-xs font-semibold mb-2">Node Types</p>
                <div className="space-y-1.5">
                  {Object.entries(typeLabels).map(([type, label]) => (
                    <div key={type} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: nodeColors[type] }}
                      />
                      <span className="text-xs">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="absolute top-4 right-4 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                Click nodes to explore connections
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Node Details Panel */}
        <Card className="lg:w-80">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="w-5 h-5" />
              Node Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <Badge
                    className="mb-2"
                    style={{
                      backgroundColor: `${selectedNode.color}15`,
                      color: selectedNode.color,
                      borderColor: selectedNode.color,
                    }}
                    variant="outline"
                  >
                    {typeIcons[selectedNode.type]}
                    <span className="ml-1">{typeLabels[selectedNode.type]}</span>
                  </Badge>
                  <h3 className="text-xl font-semibold">{selectedNode.name}</h3>
                  {selectedNode.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedNode.description}
                    </p>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Connections</p>
                  <p className="text-2xl font-bold">{getConnectedNodes(selectedNode.id).length}</p>
                </div>

                {selectedNode.type === 'document' && (
                  <Button className="w-full bg-amber-500 hover:bg-amber-600" asChild>
                    <Link href={`/app/documents/${selectedNode.id}`}>
                      <Maximize2 className="w-4 h-4 mr-2" />
                      Open Document
                    </Link>
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setSelectedNode(null)}
                >
                  Clear Selection
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <Network className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Click on any node in the graph to see details about its relationships
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
