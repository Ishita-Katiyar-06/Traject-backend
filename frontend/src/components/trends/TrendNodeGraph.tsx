import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Network,
  Share2,
  Globe,
  GitBranch,
  Filter,
  X,
  RefreshCw,
  AlertTriangle,
  Info,
  TrendingUp,
  MessageSquare,
} from 'lucide-react';
import { telemetryApi } from '../../services/telemetryApi';
import { TrendGraphData, GraphNode } from '../../types/api';
import { nodeTypes } from '../ui/graph/CustomNodes';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../ui/Button';

export interface TrendNodeGraphProps {
  trendId: string;
  className?: string;
}

export const TrendNodeGraph: React.FC<TrendNodeGraphProps> = ({
  trendId,
  className = '',
}) => {
  const { isDark } = useTheme();

  const [graphData, setGraphData] = useState<TrendGraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'channel' | 'entity' | 'narrative' | 'message'>('all');

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const fetchGraph = useCallback(async () => {
    if (!trendId) return;
    setIsLoading(true);
    setIsError(false);
    setErrorMessage('');
    setSelectedNode(null);

    try {
      const res = await telemetryApi.getTrendGraph(trendId);
      setGraphData(res.data);
    } catch (err: any) {
      console.error('Failed to load trend relationship graph:', err);
      setIsError(true);
      setErrorMessage(err.message || 'Failed to retrieve relationship graph data from backend.');
    } finally {
      setIsLoading(false);
    }
  }, [trendId]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Compute Layout when graphData or filterType changes
  useEffect(() => {
    if (!graphData) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const rawNodes = graphData.nodes || [];
    const rawEdges = graphData.edges || [];

    // Filter nodes if a specific category is isolated (always keep central trend node)
    const activeNodes = rawNodes.filter((n) => {
      if (n.type === 'trend') return true;
      if (filterType === 'all') return true;
      return n.type === filterType;
    });

    const activeNodeIds = new Set(activeNodes.map((n) => n.id));
    const activeEdges = rawEdges.filter(
      (e) => activeNodeIds.has(e.source) && activeNodeIds.has(e.target)
    );

    // Layout partition
    const channels = activeNodes.filter((n) => n.type === 'channel');
    const entities = activeNodes.filter((n) => n.type === 'entity');
    const narratives = activeNodes.filter((n) => n.type === 'narrative');
    const messages = activeNodes.filter((n) => n.type === 'message');
    const centralTrends = activeNodes.filter((n) => n.type === 'trend');

    const flowNodes: Node[] = [];

    // 1. Channels (Left Column)
    channels.forEach((n, idx) => {
      flowNodes.push({
        id: n.id,
        type: 'channel',
        position: { x: 30, y: 50 + idx * 90 },
        data: {
          channelId: n.label,
          channelTitle: n.label,
          platform: 'telegram',
          role: 'origin',
          messageCount: (n.metadata?.message_count as number) || undefined,
          ...n.metadata,
        },
      });
    });

    // 2. Entities & Domains (Upper/Lower Left Converging Column)
    entities.forEach((n, idx) => {
      flowNodes.push({
        id: n.id,
        type: 'entity',
        position: { x: 260, y: 40 + idx * 80 },
        data: {
          entityId: n.id,
          label: n.label,
          category: (n.metadata?.category as string) || 'entity',
          citationCount: (n.metadata?.citation_count as number) || undefined,
          ...n.metadata,
        },
      });
    });

    // 3. Central Trend Node (Center)
    centralTrends.forEach((n) => {
      const maxRows = Math.max(channels.length, entities.length, 1);
      const centerY = Math.max(120, (maxRows * 85) / 2);
      flowNodes.push({
        id: n.id,
        type: 'trend',
        position: { x: 530, y: centerY },
        data: {
          trendId: n.id,
          trendName: n.label,
          messageCount: (n.metadata?.message_count as number) || 0,
          keywords: (n.metadata?.keywords as string[]) || [],
          isCentral: true,
          ...n.metadata,
        },
      });
    });

    // 4. Narratives (Right Column - Outgoing Candidates)
    narratives.forEach((n, idx) => {
      flowNodes.push({
        id: n.id,
        type: 'narrative',
        position: { x: 860, y: 60 + idx * 130 },
        data: {
          narrativeId: n.id.replace(/^narrative:/, ''),
          headlineClaim: n.label,
          priorityScore: (n.metadata?.priority_score as number) || 0.5,
          priorityTier: (n.metadata?.priority_tier as any) || 'routine',
          messageCount: (n.metadata?.message_count as number) || undefined,
          ...n.metadata,
        },
      });
    });

    // 5. Evidence Messages (Bottom cluster)
    messages.forEach((n, idx) => {
      flowNodes.push({
        id: n.id,
        type: 'message',
        position: { x: 530 + (idx % 2 === 0 ? -110 : 110), y: 350 + Math.floor(idx / 2) * 75 },
        data: {
          messageId: n.id.replace(/^message:/, ''),
          channelName: (n.metadata?.channel as string) || undefined,
          ...n.metadata,
        },
      });
    });

    // Compute Flow Edges with semantic styling
    const flowEdges: Edge[] = activeEdges.map((e, idx) => {
      let stroke = isDark ? '#6B7280' : '#94A3B8';
      let strokeWidth = 1.5;
      let label = e.relationship_type.replace(/_/g, ' ');

      if (e.relationship_type === 'observed_in') {
        stroke = isDark ? '#10B981' : '#059669';
        label = 'observed in';
      } else if (e.relationship_type === 'cited_in') {
        stroke = isDark ? '#A855F7' : '#7C3AED';
        label = 'cited in';
      } else if (e.relationship_type === 'promoted_to') {
        stroke = isDark ? '#F43F5E' : '#E11D48';
        strokeWidth = 2.0;
        label = 'promoted to';
      } else if (e.relationship_type === 'contributes_evidence') {
        stroke = isDark ? '#3B82F6' : '#2563EB';
        label = 'evidence';
      }

      return {
        id: `edge-${e.source}-${e.target}-${idx}`,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        animated: e.relationship_type === 'promoted_to',
        label: label,
        labelStyle: {
          fontSize: 10,
          fill: stroke,
          fontFamily: 'monospace',
          fontWeight: 600,
        },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
        labelBgStyle: {
          fill: isDark ? '#171C22' : '#FFFFFF',
          fillOpacity: 0.88,
        },
        style: {
          stroke,
          strokeWidth,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: stroke,
        },
      };
    });

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [graphData, filterType, isDark, setNodes, setEdges]);

  // Handle node selection
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (!graphData) return;
      const raw = graphData.nodes.find((n) => n.id === node.id);
      if (raw) {
        setSelectedNode(raw);
      }
    },
    [graphData]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Relationship counts for filter badges
  const filterCounts = useMemo(() => {
    if (!graphData) return { channel: 0, entity: 0, narrative: 0, message: 0 };
    return {
      channel: graphData.nodes.filter((n) => n.type === 'channel').length,
      entity: graphData.nodes.filter((n) => n.type === 'entity').length,
      narrative: graphData.nodes.filter((n) => n.type === 'narrative').length,
      message: graphData.nodes.filter((n) => n.type === 'message').length,
    };
  }, [graphData]);

  if (isLoading) {
    return (
      <div className={`p-6 md:p-8 rounded-[24px] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-white dark:bg-[#171C22] shadow-dashboard space-y-4 ${className}`}>
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252B32] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/40 animate-pulse" />
            <div className="h-5 w-44 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-[460px] rounded-[20px] bg-slate-50 dark:bg-[#12161C] border border-slate-100 dark:border-[#20262E] flex flex-col items-center justify-center space-y-3">
          <div className="w-7 h-7 border-3 border-[#2F65F6] border-t-transparent rounded-full animate-spin" />
          <span className="text-[12px] font-mono text-[#8591A5] dark:text-slate-400">
            Synthesizing converging trend relationship topology...
          </span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={`p-6 md:p-8 rounded-[24px] border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 shadow-dashboard space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            <h3 className="text-[16px] font-bold text-rose-900 dark:text-rose-200">
              Trend Relationship Graph Unavailable
            </h3>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchGraph} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Retry Graph
          </Button>
        </div>
        <p className="text-[13px] text-rose-700 dark:text-rose-300">
          {errorMessage || 'Trend relationship data could not be loaded.'}
        </p>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length <= 1) {
    return (
      <div className={`p-6 md:p-8 rounded-[24px] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-white dark:bg-[#171C22] shadow-dashboard space-y-4 ${className}`}>
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252B32] pb-4">
          <div className="flex items-center gap-2.5">
            <Network className="w-5 h-5 text-[#2F65F6]" />
            <h3 className="text-[17px] font-bold text-[#111727] dark:text-slate-100">
              Trend Relationship Topology
            </h3>
          </div>
        </div>
        <div className="h-[280px] rounded-[20px] bg-[#FAFBFD] dark:bg-[#12161C] border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-6 text-center space-y-2">
          <Info className="w-8 h-8 text-[#8591A5]" />
          <h4 className="text-[15px] font-bold text-[#111727] dark:text-slate-200">
            No Relationship Data Available
          </h4>
          <p className="text-[13px] text-[#8591A5] dark:text-slate-400 max-w-md">
            This Trend does not have sufficient cross-channel broadcasts or linked narrative candidates to form a relationship topology.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className={`p-6 md:p-8 rounded-[24px] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-white dark:bg-[#171C22] shadow-dashboard space-y-5 transition-all ${className}`}>
      {/* 1. Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-[#252B32] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Network className="w-5 h-5 text-[#2F65F6]" />
            <h3 className="text-[17px] font-bold text-[#111727] dark:text-slate-100 tracking-tight">
              Trend Relationship Topology
            </h3>
            <span className="text-[11px] font-mono font-bold text-[#2F65F6] dark:text-[#93C5FD] bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 rounded-full border border-blue-100 dark:border-blue-900/40">
              {graphData.node_count} nodes • {graphData.edge_count} edges
            </span>
          </div>
          <p className="text-[12px] text-[#8591A5] dark:text-slate-400 font-medium mt-0.5">
            Converging flow topology: Broadcast Channels + Cited Entities ➔ Central Trend ➔ Formalized Narrative Candidates
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-mono text-[#8591A5] dark:text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" /> Filter:
          </span>
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold transition-colors ${
              filterType === 'all'
                ? 'bg-[#2F65F6] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-[#1D232A] text-[#64748B] dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#252C36]'
            }`}
          >
            All ({graphData.node_count})
          </button>
          {filterCounts.channel > 0 && (
            <button
              type="button"
              onClick={() => setFilterType('channel')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold transition-colors ${
                filterType === 'channel'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/40'
              }`}
            >
              Channels ({filterCounts.channel})
            </button>
          )}
          {filterCounts.entity > 0 && (
            <button
              type="button"
              onClick={() => setFilterType('entity')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold transition-colors ${
                filterType === 'entity'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border border-purple-200/60 dark:border-purple-900/40'
              }`}
            >
              Entities ({filterCounts.entity})
            </button>
          )}
          {filterCounts.narrative > 0 && (
            <button
              type="button"
              onClick={() => setFilterType('narrative')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold transition-colors ${
                filterType === 'narrative'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40'
              }`}
            >
              Narratives ({filterCounts.narrative})
            </button>
          )}
        </div>
      </div>

      {/* 2. Interactive React Flow Canvas */}
      <div className="relative w-full h-[500px] rounded-[20px] overflow-hidden border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-[#FAFBFD] dark:bg-[#12161B]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          fitView={true}
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.25}
          maxZoom={1.75}
          proOptions={{ hideAttribution: true }}
          elevateNodesOnSelect={true}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={18}
            size={1}
            color={isDark ? '#2D3748' : '#D5DDE8'}
          />

          <Controls
            showInteractive={false}
            position="bottom-left"
            className="!bg-white dark:!bg-[#1C232B] !border !border-slate-200 dark:!border-[#2E3844] !rounded-xl !shadow-sm !overflow-hidden !m-4"
          />

          <MiniMap
            nodeStrokeWidth={2}
            zoomable
            pannable
            position="bottom-right"
            className="!bg-white/90 dark:!bg-[#1C232B]/90 !border !border-slate-200 dark:!border-[#2E3844] !rounded-xl !shadow-sm !overflow-hidden !m-4 hidden sm:block"
            nodeColor={(n) => {
              if (n.type === 'trend') return '#2F65F6';
              if (n.type === 'narrative') return '#FF6D5A';
              if (n.type === 'channel') return '#10B981';
              if (n.type === 'entity') return '#8B5CF6';
              return '#94A3B8';
            }}
            maskColor={isDark ? 'rgba(18, 22, 27, 0.7)' : 'rgba(240, 244, 250, 0.7)'}
          />
        </ReactFlow>

        {/* Floating Node Inspector Drawer */}
        {selectedNode && (
          <div className="absolute top-4 right-4 z-40 w-72 max-w-[calc(100%-2rem)] rounded-[18px] bg-white/95 dark:bg-[#1A2027]/95 backdrop-blur-md border border-[rgba(228,233,245,0.9)] dark:border-[#2E3743] shadow-lg p-4 space-y-3 transition-all animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2 min-w-0">
                {selectedNode.type === 'trend' && <TrendingUp className="w-4 h-4 text-[#2F65F6] shrink-0" />}
                {selectedNode.type === 'channel' && <Share2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                {selectedNode.type === 'narrative' && <GitBranch className="w-4 h-4 text-rose-500 shrink-0" />}
                {selectedNode.type === 'entity' && <Globe className="w-4 h-4 text-purple-600 shrink-0" />}
                {selectedNode.type === 'message' && <MessageSquare className="w-4 h-4 text-blue-500 shrink-0" />}
                <span className="font-bold text-[13px] text-[#111727] dark:text-slate-100 truncate">
                  {selectedNode.label}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5 text-[12px] font-sans">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Node Type:</span>
                <span className="font-mono font-bold uppercase text-[#111727] dark:text-slate-200 text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                  {selectedNode.type}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Node ID:</span>
                <span className="font-mono text-[11px] text-[#2F65F6] dark:text-blue-400 truncate max-w-[140px]">
                  {selectedNode.id}
                </span>
              </div>

              {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider">
                    Relationship Metadata
                  </span>
                  {Object.entries(selectedNode.metadata).slice(0, 5).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 capitalize">{k.replace(/_/g, ' ')}:</span>
                      <span className="font-mono font-medium text-[#111727] dark:text-slate-200 truncate max-w-[140px]">
                        {typeof v === 'number' ? v.toLocaleString() : String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Topology Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] font-sans text-[#64748B] dark:text-slate-400 pt-1">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Channel (<strong className="font-mono text-[11px]">observed_in</strong>)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span>Entity (<strong className="font-mono text-[11px]">cited_in</strong>)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2F65F6]" />
            <span>Central Trend Anchor</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Narrative Candidate (<strong className="font-mono text-[11px]">promoted_to</strong>)</span>
          </div>
        </div>

        <div className="text-[11px] font-mono text-[#8591A5]">
          Entities observed: {filterCounts.entity + filterCounts.channel}
        </div>
      </div>
    </section>
  );
};
