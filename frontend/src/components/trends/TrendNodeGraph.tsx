import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Send,
  ExternalLink,
  Copy,
  Check,
  Search,
} from 'lucide-react';
import { telemetryApi } from '../../services/telemetryApi';
import { TrendGraphData, GraphNode } from '../../types/api';
import { nodeTypes } from '../ui/graph/CustomNodes';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../ui/Button';
import {
  resolveTelegramMessageUrl,
  resolveTelegramChannelUrl,
} from '../../utils/channelRegistry';

export interface TrendNodeGraphProps {
  trendId: string;
  className?: string;
}

export const TrendNodeGraph: React.FC<TrendNodeGraphProps> = ({
  trendId,
  className = '',
}) => {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [graphData, setGraphData] = useState<TrendGraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'channel' | 'entity' | 'narrative' | 'message'>('all');
  const [isCopied, setIsCopied] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const handleCopyLink = useCallback((url: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  }, []);

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
      const telegramUrl =
        (n.metadata?.telegram_url as string) ||
        resolveTelegramChannelUrl(n.id, n.metadata);
      flowNodes.push({
        id: n.id,
        type: 'channel',
        position: { x: 30, y: 50 + idx * 90 },
        data: {
          channelId: n.label,
          channelTitle: n.label,
          platform: 'telegram',
          role: 'origin',
          telegramUrl,
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
      const narrativeName = (n.metadata?.narrative_name as string) || n.label;
      flowNodes.push({
        id: n.id,
        type: 'narrative',
        position: { x: 860, y: 60 + idx * 130 },
        data: {
          narrativeId: n.id.replace(/^narrative:/, ''),
          narrativeName: narrativeName,
          headlineClaim: n.label,
          priorityScore: (n.metadata?.priority_score as number) || (n.metadata?.priority_signal_score as number) || 0.5,
          priorityTier: (n.metadata?.priority_tier as any) || 'routine',
          messageCount: (n.metadata?.message_count as number) || undefined,
          ...n.metadata,
        },
      });
    });

    // 5. Evidence Messages (Bottom cluster)
    messages.forEach((n, idx) => {
      const canonicalId = (n.metadata?.canonical_id as string) || n.id.replace(/^message:/, '');
      const telegramUrl =
        (n.metadata?.telegram_url as string) ||
        resolveTelegramMessageUrl(canonicalId, n.metadata);
      flowNodes.push({
        id: n.id,
        type: 'message',
        position: { x: 530 + (idx % 2 === 0 ? -110 : 110), y: 350 + Math.floor(idx / 2) * 75 },
        data: {
          messageId: n.id.replace(/^message:/, ''),
          canonicalId,
          channelName: (n.metadata?.channel_title as string) || (n.metadata?.channel as string) || undefined,
          telegramUrl,
          textPreview: (n.metadata?.text_content as string) || n.label,
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
        setIsCopied(false);
        setSelectedNode(raw);
      }
    },
    [graphData]
  );

  // Direct double-click redirect to external source (e.g. Telegram message or channel)
  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (!graphData) return;
      const raw = graphData.nodes.find((n) => n.id === node.id);
      if (!raw) return;

      if (raw.type === 'message') {
        const canonicalId = (raw.metadata?.canonical_id as string) || raw.id.replace(/^message:/, '');
        const url =
          (raw.metadata?.telegram_url as string) ||
          resolveTelegramMessageUrl(canonicalId, raw.metadata);
        if (url) {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } else if (raw.type === 'channel') {
        const url =
          (raw.metadata?.telegram_url as string) ||
          resolveTelegramChannelUrl(raw.id, raw.metadata);
        if (url) {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      }
    },
    [graphData]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
    setIsCopied(false);
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
      <div className={`p-6 sm:p-8 rounded-[30px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md shadow-xs space-y-4 ${className}`}>
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252B32] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/40 animate-pulse" />
            <div className="h-5 w-44 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-[460px] rounded-[24px] bg-slate-50 dark:bg-[#12161C] border border-slate-100 dark:border-[#20262E] flex flex-col items-center justify-center space-y-3">
          <div className="w-7 h-7 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-[12px] font-mono text-slate-500 dark:text-slate-400">
            Synthesizing converging trend relationship topology...
          </span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={`p-6 sm:p-8 rounded-[30px] border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 shadow-xs space-y-4 ${className}`}>
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
      <div className={`p-6 sm:p-8 rounded-[30px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md shadow-xs space-y-4 ${className}`}>
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252B32] pb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10.5px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-400/40">
              <Network className="w-3 h-3 text-amber-500" />
              <span>TOPOLOGY GRAPH</span>
            </span>
            <h3 className="text-[17px] font-bold text-slate-900 dark:text-white tracking-tight">
              Trend Relationship Topology
            </h3>
          </div>
        </div>
        <div className="h-[280px] rounded-[24px] bg-[#FAFBFD] dark:bg-[#12161C] border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-6 text-center space-y-2">
          <Info className="w-8 h-8 text-slate-400" />
          <h4 className="text-[15px] font-bold text-slate-800 dark:text-slate-200">
            No Relationship Data Available
          </h4>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 max-w-md">
            This Trend does not have sufficient cross-channel broadcasts or linked narrative candidates to form a relationship topology.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className={`p-6 sm:p-8 rounded-[30px] border border-slate-200/80 dark:border-[#2B323D] bg-white/95 dark:bg-[#181C22]/95 backdrop-blur-md shadow-xs space-y-6 transition-all font-sans ${className}`}>
      {/* 1. Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-[#252B32] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10.5px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-400/40">
              <Network className="w-3 h-3 text-amber-500" />
              <span>TOPOLOGY GRAPH</span>
            </span>
            <h3 className="text-[17px] font-bold text-slate-900 dark:text-white tracking-tight">
              Trend Relationship Topology
            </h3>
            <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 rounded-full border border-blue-100 dark:border-blue-900/40">
              {graphData.node_count} nodes • {graphData.edge_count} edges
            </span>
          </div>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium mt-1">
            Converging flow topology: Broadcast Channels ➔ Cited Entities ➔ Central Trend ➔ Formalized Narrative Candidates
          </p>
        </div>

        {/* Filter Buttons in Crextio Rounded-Full Pill */}
        <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1 mr-0.5">
            <Filter className="w-3 h-3 text-amber-500" /> Filter:
          </span>
          <div className="flex items-center gap-1 bg-[#F5F1E5] dark:bg-[#1E2229] p-1 rounded-full border border-[#E5DFD3] dark:border-[#2D333F] shadow-2xs">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-full text-[11px] font-mono font-bold transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-[#181D24] text-white dark:bg-white dark:text-[#181D24] shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All ({graphData.node_count})
            </button>
            {filterCounts.channel > 0 && (
              <button
                type="button"
                onClick={() => setFilterType('channel')}
                className={`px-3 py-1 rounded-full text-[11px] font-mono font-bold transition-all cursor-pointer ${
                  filterType === 'channel'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-800'
                }`}
              >
                Channels ({filterCounts.channel})
              </button>
            )}
            {filterCounts.entity > 0 && (
              <button
                type="button"
                onClick={() => setFilterType('entity')}
                className={`px-3 py-1 rounded-full text-[11px] font-mono font-bold transition-all cursor-pointer ${
                  filterType === 'entity'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-purple-700 dark:text-purple-400 hover:text-purple-800'
                }`}
              >
                Entities ({filterCounts.entity})
              </button>
            )}
            {filterCounts.narrative > 0 && (
              <button
                type="button"
                onClick={() => setFilterType('narrative')}
                className={`px-3 py-1 rounded-full text-[11px] font-mono font-bold transition-all cursor-pointer ${
                  filterType === 'narrative'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-rose-700 dark:text-rose-400 hover:text-rose-800'
                }`}
              >
                Narratives ({filterCounts.narrative})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Interactive React Flow Canvas (Graph Part Completely Untouched) */}
      <div className="relative w-full h-[500px] rounded-[24px] overflow-hidden border border-slate-200/80 dark:border-[#2B323D] bg-[#FAFBFD] dark:bg-[#12161B] shadow-inner">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
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
        {selectedNode && (() => {
          const isMessage = selectedNode.type === 'message';
          const isChannel = selectedNode.type === 'channel';

          const canonicalId =
            (selectedNode.metadata?.canonical_id as string) ||
            selectedNode.id.replace(/^message:/, '');

          const telegramUrl = isMessage
            ? (selectedNode.metadata?.telegram_url as string) ||
              resolveTelegramMessageUrl(canonicalId, selectedNode.metadata)
            : isChannel
            ? (selectedNode.metadata?.telegram_url as string) ||
              resolveTelegramChannelUrl(selectedNode.id, selectedNode.metadata)
            : null;

          const textContent = (selectedNode.metadata?.text_content as string) || '';

          return (
            <div className="absolute top-4 right-4 z-40 w-80 max-w-[calc(100%-2rem)] rounded-[18px] bg-white/95 dark:bg-[#1A2027]/95 backdrop-blur-md border border-[rgba(228,233,245,0.9)] dark:border-[#2E3743] shadow-xl p-4 space-y-2.5 transition-all animate-in fade-in slide-in-from-top-2 duration-150 font-sans">
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {selectedNode.type === 'trend' && <TrendingUp className="w-4 h-4 text-[#2F65F6] shrink-0" />}
                  {selectedNode.type === 'channel' && <Share2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                  {selectedNode.type === 'narrative' && <GitBranch className="w-4 h-4 text-rose-500 shrink-0" />}
                  {selectedNode.type === 'entity' && <Globe className="w-4 h-4 text-purple-600 shrink-0" />}
                  {selectedNode.type === 'message' && <MessageSquare className="w-4 h-4 text-blue-500 shrink-0" />}
                  <span className="font-bold text-[13px] text-[#111727] dark:text-slate-100 truncate" title={selectedNode.label}>
                    {selectedNode.label}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Message text excerpt */}
              {isMessage && textContent && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#12161C] border border-slate-100 dark:border-slate-800/80 text-[11.5px] text-slate-700 dark:text-slate-300 italic leading-snug line-clamp-2">
                  "{textContent}"
                </div>
              )}

              {/* DIRECT TELEGRAM REDIRECT OPTION */}
              {telegramUrl && (
                <div className="space-y-2 p-2.5 rounded-xl bg-gradient-to-b from-blue-50/70 to-blue-50/30 dark:from-blue-950/40 dark:to-blue-950/15 border border-blue-200/70 dark:border-blue-900/40">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase font-bold text-blue-700 dark:text-blue-300">
                    <span className="flex items-center gap-1">
                      <Send className="w-3 h-3 text-[#2F65F6]" />
                      {isMessage ? 'Telegram Message' : 'Telegram Channel'}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100/90 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 font-bold">
                      EXACT LINK
                    </span>
                  </div>

                  <a
                    href={telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl bg-[#2F65F6] hover:bg-[#2452D6] active:scale-[0.99] text-white text-[12px] font-semibold shadow-sm hover:shadow transition-all group cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    <span>{isMessage ? 'Redirect to Telegram Message' : 'Open Channel in Telegram'}</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </a>

                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleCopyLink(telegramUrl)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-white dark:bg-[#1E252E] hover:bg-slate-50 dark:hover:bg-[#252E3A] border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied Link!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>

                    {isMessage && (
                      <button
                        type="button"
                        onClick={() => navigate(`/explorer?search=${encodeURIComponent(canonicalId)}`)}
                        title="Inspect full canonical record in Data Explorer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-white dark:bg-[#1E252E] hover:bg-slate-50 dark:hover:bg-[#252E3A] border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        <Search className="w-3 h-3 text-slate-400" />
                        <span>Explorer</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Node Details & Metadata */}
              <div className="space-y-1 text-[12px] font-sans">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span>Node Type:</span>
                  <span className="font-mono font-bold uppercase text-[#111727] dark:text-slate-200 text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                    {selectedNode.type}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span>Node ID:</span>
                  <span className="font-mono text-[11px] text-[#2F65F6] dark:text-blue-400 truncate max-w-[140px]" title={selectedNode.id}>
                    {selectedNode.id}
                  </span>
                </div>

                {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 && (
                  <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider">
                      Relationship Metadata
                    </span>
                    {Object.entries(selectedNode.metadata)
                      .filter(([k]) => k !== 'text_content' && k !== 'telegram_url')
                      .slice(0, 5)
                      .map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 capitalize">{k.replace(/_/g, ' ')}:</span>
                          <span className="font-mono font-medium text-[#111727] dark:text-slate-200 truncate max-w-[140px]" title={String(v)}>
                            {typeof v === 'number' ? v.toLocaleString() : String(v)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* 3. Topology Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] font-sans text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-[#252B32]">
        <div className="flex items-center gap-5 flex-wrap text-[11.5px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-2xs" />
            <span>Channel (<strong className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">observed_in</strong>)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-2xs" />
            <span>Entity (<strong className="font-mono text-[11px] text-purple-700 dark:text-purple-400">cited_in</strong>)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2F65F6] shadow-2xs" />
            <span className="font-bold text-slate-900 dark:text-white">Central Trend Anchor</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-2xs" />
            <span>Narrative Candidate (<strong className="font-mono text-[11px] text-rose-700 dark:text-rose-400">promoted_to</strong>)</span>
          </div>
        </div>

        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#13171C] px-3 py-1 rounded-full border border-slate-200/60 dark:border-[#2B323D]">
          Entities observed: <span className="font-bold text-slate-900 dark:text-white">{filterCounts.entity + filterCounts.channel}</span>
        </div>
      </div>
    </section>
  );
};
