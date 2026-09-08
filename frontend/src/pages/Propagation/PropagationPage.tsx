import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from '@xyflow/react';
import {
  Share2,
  RefreshCw,
  Send,
  Radio,
  GitBranch,
  List,
  Network,
  Info,
  ChevronLeft,
  ChevronRight,
  Hash,
  Clock,
  Zap,
  ExternalLink,
} from 'lucide-react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { motion } from 'motion/react';
import { staggerContainer, kpiCardEnter } from '../../utils/motion';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import {
  GraphCanvas,
  InvestigationContextDrawer,
  type SelectedEntityContext,
} from '../../components/ui/graph';
import { telemetryApi } from '../../services/telemetryApi';
import { resolveChannelInfo, RegisteredChannel } from '../../utils/channelRegistry';
import type {
  TopicDetailData,
  NarrativeSummaryResponse,
  NarrativeDetailData,
  TopicSummaryResponse,
} from '../../types/api';

export const PropagationPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const cascadeFromUrl = searchParams.get('cascade');

  const [topics, setTopics] = useState<TopicSummaryResponse[]>([]);
  const [topicDetails, setTopicDetails] = useState<Record<string, TopicDetailData>>({});
  const [narratives, setNarratives] = useState<NarrativeSummaryResponse[]>([]);
  const [narrativeDetailsCache, setNarrativeDetailsCache] = useState<Record<string, NarrativeDetailData>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterNarrativeId, setFilterNarrativeId] = useState<string>(cascadeFromUrl || 'all');
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntityContext | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const sortedNarratives = useMemo(() => {
    return narratives.slice().sort((a, b) => b.priority_signal_score - a.priority_signal_score);
  }, [narratives]);

  const currentCascadeIdx = sortedNarratives.findIndex((n) => n.narrative_id === filterNarrativeId);
  const activeNarrative = currentCascadeIdx >= 0 ? sortedNarratives[currentCascadeIdx] : null;
  const activeTopic = activeNarrative ? topics.find((t) => t.topic_id === activeNarrative.promoted_from_topic_id) : null;
  const activeNarrativeDetail = filterNarrativeId !== 'all' ? narrativeDetailsCache[filterNarrativeId] : null;

  // Sync URL when cascade selection changes
  const handleSelectCascade = useCallback(
    (id: string) => {
      setFilterNarrativeId(id);
      if (id === 'all') {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('cascade');
        setSearchParams(nextParams, { replace: true });
      } else {
        setSearchParams({ cascade: id }, { replace: true });
      }
    },
    [searchParams, setSearchParams]
  );

  // Fetch full analytical dossier for active narrative to get authentic channels and signals
  useEffect(() => {
    if (!filterNarrativeId || filterNarrativeId === 'all') return;
    if (narrativeDetailsCache[filterNarrativeId]) return;

    let isSubscribed = true;
    telemetryApi
      .getNarrativeById(filterNarrativeId)
      .then((res) => {
        if (isSubscribed && res.data) {
          setNarrativeDetailsCache((prev) => ({ ...prev, [filterNarrativeId]: res.data }));
        }
      })
      .catch((err) => {
        console.warn(`Could not load narrative details for ${filterNarrativeId}:`, err);
      });

    return () => {
      isSubscribed = false;
    };
  }, [filterNarrativeId, narrativeDetailsCache]);

  const loadData = useCallback(async (isManualSync = false) => {
    setIsRefreshing(true);
    try {
      const minDelay = isManualSync ? new Promise((resolve) => setTimeout(resolve, 600)) : Promise.resolve();
      const [topicsRes, narrativesRes] = await Promise.all([
        telemetryApi.getTopics({ page: 1, page_size: 50, sort_by: 'message_count', order: 'desc' }),
        telemetryApi.getNarratives({ page: 1, page_size: 50, sort_by: 'priority_signal_score', order: 'desc' }),
        minDelay,
      ]);

      setTopics(topicsRes.data);
      setNarratives(narrativesRes.data);

      // Default to URL param, or highest priority critical cascade on first load instead of 'all'
      if (cascadeFromUrl && narrativesRes.data.some((n) => n.narrative_id === cascadeFromUrl)) {
        setFilterNarrativeId(cascadeFromUrl);
      } else if (narrativesRes.data.length > 0) {
        const sorted = narrativesRes.data.slice().sort((a, b) => b.priority_signal_score - a.priority_signal_score);
        setFilterNarrativeId((prev) => (prev === 'all' || !prev ? sorted[0].narrative_id : prev));
      }

      // Fetch detailed propagation features for each topic
      const detailsMap: Record<string, TopicDetailData> = {};
      await Promise.all(
        topicsRes.data.map(async (t) => {
          try {
            const detailRes = await telemetryApi.getTopicById(t.topic_id);
            detailsMap[t.topic_id] = detailRes.data;
          } catch (e) {
            console.warn(`Could not load details for topic ${t.topic_id}:`, e);
          }
        })
      );
      setTopicDetails(detailsMap);
    } catch (err) {
      console.error('Failed to load propagation telemetry:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [cascadeFromUrl]);

  const handleSync = async () => {
    telemetryApi.clearCache();
    await loadData(true);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 2. Build graph nodes and edges with real authentic channel telemetry
  useEffect(() => {
    if (isLoading || topics.length === 0 || narratives.length === 0) return;

    const generatedNodes: Node[] = [];
    const generatedEdges: Edge[] = [];

    if (filterNarrativeId !== 'all') {
      // === SINGLE CASCADE FOCUSED FLOW (Dynamic Authentic Channels) ===
      const narrative =
        narratives.find((n) => n.narrative_id === filterNarrativeId) ||
        sortedNarratives[0] ||
        narratives[0];
      if (!narrative) return;

      const topic =
        topics.find((t) => t.topic_id === narrative.promoted_from_topic_id) || topics[0];

      // Dynamically resolve real origin channels from narrative dossier
      const detail = narrativeDetailsCache[narrative.narrative_id];
      const rawOrigins = detail?.origin_channels?.filter(Boolean) || [];
      let originList: RegisteredChannel[] = rawOrigins.map(resolveChannelInfo);

      if (originList.length === 0) {
        // Fallback to domain entities or domain representations recorded in narrative
        const domainEntities = (detail?.key_entities || []).filter(
          (e) => e.startsWith('domain:') || e.includes('.')
        );
        if (domainEntities.length > 0) {
          originList = domainEntities.slice(0, 2).map(resolveChannelInfo);
        } else if (detail?.domains_represented && detail.domains_represented.length > 0) {
          originList = detail.domains_represented.slice(0, 2).map((d) => ({
            id: `domain-${d}`,
            title: `${d.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Feed`,
            handle: `@${d}`,
            category: 'Domain Source',
            platform: 'web' as const,
          }));
        } else {
          originList = [resolveChannelInfo('1554189930')];
        }
      }

      // Dynamically resolve real broadcasting channels from narrative dossier
      const rawAmps = detail?.broadcasting_channels?.filter(Boolean) || [];
      let ampList: RegisteredChannel[] = rawAmps.map(resolveChannelInfo);

      if (ampList.length === 0) {
        const hashtagEntities = (detail?.key_entities || []).filter(
          (e) => e.startsWith('hashtag:') || e.startsWith('#')
        );
        if (hashtagEntities.length > 0) {
          ampList = hashtagEntities.slice(0, 2).map(resolveChannelInfo);
        } else {
          ampList = [resolveChannelInfo('1888348357')];
        }
      }

      const centerY = 260;

      // 1. Origin Channels (Col 1: x = 60)
      const originSpacing = 110;
      const originStartY = centerY - ((originList.length - 1) * originSpacing) / 2;
      originList.forEach((chan, idx) => {
        generatedNodes.push({
          id: `origin-${chan.id}`,
          type: 'channel',
          position: { x: 50, y: Math.max(50, originStartY + idx * originSpacing) },
          data: {
            channelId: chan.id,
            channelTitle: chan.title,
            platform: chan.platform,
            role: 'origin',
          },
        });

        // Edge from origin to topic
        generatedEdges.push({
          id: `edge-${chan.id}-${topic.topic_id}`,
          source: `origin-${chan.id}`,
          target: `topic-${topic.topic_id}`,
          type: 'smoothstep',
          animated: true,
          label: 'originated in',
          style: { stroke: '#10B981', strokeWidth: 1.75 },
          labelStyle: { fontSize: 10, fill: '#10B981', fontFamily: 'monospace', fontWeight: 600 },
          data: {
            relationship: `${chan.title} ➔ Trend #${topic.topic_id.replace(/^topic_|^trend_/, '')}`,
            source: chan.title,
            target: topic.topic_id,
          },
        });
      });

      // 2. Topic Node (Col 2: x = 400)
      generatedNodes.push({
        id: `topic-${topic.topic_id}`,
        type: 'topic',
        position: { x: 400, y: centerY - 45 },
        data: {
          topicId: topic.topic_id,
          clusterLabel: topic.cluster_label,
          messageCount: topic.message_count,
          keywords: topic.representative_keywords?.map((k) => k.keyword) || [],
        },
      });

      // 3. Narrative Node (Col 3: x = 760)
      generatedNodes.push({
        id: `narrative-${narrative.narrative_id}`,
        type: 'narrative',
        position: { x: 760, y: centerY - 55 },
        data: {
          narrativeId: narrative.narrative_id,
          narrativeName: narrative.narrative_name || narrative.headline_claim,
          headlineClaim: narrative.headline_claim,
          priorityScore: narrative.priority_signal_score,
          priorityTier: narrative.priority_tier,
          promotedFromTopicId: narrative.promoted_from_topic_id,
          messageCount: narrative.message_count,
        },
      });

      // Topic -> Narrative Edge
      generatedEdges.push({
        id: `edge-${topic.topic_id}-${narrative.narrative_id}`,
        source: `topic-${topic.topic_id}`,
        target: `narrative-${narrative.narrative_id}`,
        type: 'smoothstep',
        animated: false,
        label: '4G promoted',
        style: { stroke: '#2F65F6', strokeWidth: 2.5 },
        labelStyle: { fontSize: 10, fill: '#2F65F6', fontFamily: 'monospace', fontWeight: 700 },
        data: {
          relationship: `Trend #${topic.topic_id.replace(/^topic_|^trend_/, '')} ➔ ${narrative.narrative_id}`,
          source: topic.topic_id,
          target: narrative.narrative_id,
        },
      });

      // 4. Amplifying Channels (Col 4: x = 1140)
      const ampSpacing = 110;
      const ampStartY = centerY - ((ampList.length - 1) * ampSpacing) / 2;
      ampList.forEach((chan, idx) => {
        generatedNodes.push({
          id: `amplifier-${chan.id}`,
          type: 'channel',
          position: { x: 1140, y: Math.max(50, ampStartY + idx * ampSpacing) },
          data: {
            channelId: chan.id,
            channelTitle: chan.title,
            platform: chan.platform,
            role: 'amplifier',
          },
        });

        // Narrative -> Amplifier Edge
        generatedEdges.push({
          id: `edge-${narrative.narrative_id}-${chan.id}`,
          source: `narrative-${narrative.narrative_id}`,
          target: `amplifier-${chan.id}`,
          type: 'smoothstep',
          animated: true,
          label: 'amplified by',
          style: { stroke: '#A855F7', strokeWidth: 1.75 },
          labelStyle: { fontSize: 10, fill: '#A855F7', fontFamily: 'monospace', fontWeight: 600 },
          data: {
            relationship: `${narrative.narrative_id} ➔ ${chan.title}`,
            source: narrative.narrative_id,
            target: chan.title,
          },
        });
      });
    } else {
      // === 2D GRID MATRIX FOR MULTI-CASCADES (Prevents 8,000px vertical pole!) ===
      const topCascades = sortedNarratives.slice(0, 16);
      topCascades.forEach((narrative, k) => {
        const col = k % 2;
        const row = Math.floor(k / 2);
        const baseX = col * 1420 + 60;
        const baseY = row * 380 + 70;
        const centerY = baseY + 130;

        const topic = topics.find((t) => t.topic_id === narrative.promoted_from_topic_id);
        const detail = narrativeDetailsCache[narrative.narrative_id];
        const origins = (detail?.origin_channels || ['1554189930']).slice(0, 2).map(resolveChannelInfo);
        const amps = (detail?.broadcasting_channels || ['1888348357']).slice(0, 2).map(resolveChannelInfo);

        // origins
        origins.forEach((chan, idx) => {
          generatedNodes.push({
            id: `origin-${chan.id}-${narrative.narrative_id}`,
            type: 'channel',
            position: { x: baseX, y: centerY - 45 + idx * 95 },
            data: { channelId: chan.id, channelTitle: chan.title, platform: chan.platform, role: 'origin' },
          });
          if (topic) {
            generatedEdges.push({
              id: `edge-${chan.id}-${topic.topic_id}-${narrative.narrative_id}`,
              source: `origin-${chan.id}-${narrative.narrative_id}`,
              target: `topic-${topic.topic_id}-${narrative.narrative_id}`,
              type: 'smoothstep',
              animated: true,
              style: { stroke: '#10B981', strokeWidth: 1.5 },
            });
          }
        });

        // topic
        if (topic) {
          generatedNodes.push({
            id: `topic-${topic.topic_id}-${narrative.narrative_id}`,
            type: 'topic',
            position: { x: baseX + 340, y: centerY - 40 },
            data: {
              topicId: topic.topic_id,
              clusterLabel: topic.cluster_label,
              messageCount: topic.message_count,
              keywords: topic.representative_keywords?.map((kw) => kw.keyword) || [],
            },
          });

          // edge to narrative
          generatedEdges.push({
            id: `edge-${topic.topic_id}-${narrative.narrative_id}`,
            source: `topic-${topic.topic_id}-${narrative.narrative_id}`,
            target: `narrative-${narrative.narrative_id}`,
            type: 'smoothstep',
            label: 'promoted',
            style: { stroke: '#2F65F6', strokeWidth: 2 },
            labelStyle: { fontSize: 10, fill: '#2F65F6', fontFamily: 'monospace' },
          });
        }

        // narrative
        generatedNodes.push({
          id: `narrative-${narrative.narrative_id}`,
          type: 'narrative',
          position: { x: baseX + 690, y: centerY - 50 },
          data: {
            narrativeId: narrative.narrative_id,
            narrativeName: narrative.narrative_name || narrative.headline_claim,
            headlineClaim: narrative.headline_claim,
            priorityScore: narrative.priority_signal_score,
            priorityTier: narrative.priority_tier,
            promotedFromTopicId: narrative.promoted_from_topic_id,
            messageCount: narrative.message_count,
          },
        });

        // amps
        amps.forEach((chan, idx) => {
          generatedNodes.push({
            id: `amplifier-${chan.id}-${narrative.narrative_id}`,
            type: 'channel',
            position: { x: baseX + 1060, y: centerY - 45 + idx * 95 },
            data: { channelId: chan.id, channelTitle: chan.title, platform: chan.platform, role: 'amplifier' },
          });

          generatedEdges.push({
            id: `edge-${narrative.narrative_id}-${chan.id}`,
            source: `narrative-${narrative.narrative_id}`,
            target: `amplifier-${chan.id}-${narrative.narrative_id}`,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#A855F7', strokeWidth: 1.5 },
          });
        });
      });
    }

    setNodes(generatedNodes);
    setEdges(generatedEdges);
  }, [isLoading, topics, topicDetails, narratives, filterNarrativeId, sortedNarratives, narrativeDetailsCache, setNodes, setEdges]);

  // Handle node selection
  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    if (node.type === 'narrative') {
      const nData = node.data as any;
      const nObj = narratives.find((n) => n.narrative_id === nData.narrativeId);
      setSelectedEntity({
        type: 'narrative',
        id: nData.narrativeId,
        title: nData.narrativeName || nData.headlineClaim,
        subtitle: `Promoted from Trend #${(nData.promotedFromTopicId || '').replace(/^topic_|^trend_/, '')}`,
        priorityScore: nData.priorityScore,
        priorityTier: nData.priorityTier,
        messageCount: nData.messageCount,
        firstObservedAt: nObj?.first_observed_at,
        lastObservedAt: nObj?.last_observed_at,
        subScores: nObj?.sub_scores,
      });
    } else if (node.type === 'topic') {
      const tData = node.data as any;
      const cleanTrendId = (tData.topicId || '').replace(/^topic_|^trend_/, '') || String(tData.clusterLabel);
      setSelectedEntity({
        type: 'topic',
        id: tData.topicId,
        title: `Trend #${cleanTrendId}`,
        subtitle: `${tData.messageCount} messages analyzed`,
        messageCount: tData.messageCount,
        keywords: tData.keywords,
      });
    } else if (node.type === 'channel') {
      const cData = node.data as any;
      setSelectedEntity({
        type: 'channel',
        id: cData.channelId,
        title: cData.channelTitle,
        subtitle: `${cData.platform.toUpperCase()} broadcasting channel`,
        role: cData.role,
        platform: cData.platform,
      });
    }
  }, [narratives]);

  // Handle edge selection
  const handleEdgeClick: EdgeMouseHandler = useCallback((_event, edge) => {
    const eData = edge.data as any;
    setSelectedEntity({
      type: 'edge',
      id: edge.id,
      title: edge.label ? String(edge.label) : 'Propagation Linkage',
      subtitle: eData?.relationship || `${edge.source} ➔ ${edge.target}`,
      edgeDetails: {
        source: eData?.source || edge.source,
        target: eData?.target || edge.target,
        relationship: eData?.relationship || 'Observed cascade link',
      },
    });
  }, []);

  // Smooth focus & highlight effect on node or edge selection (Section 19 & 20)
  useEffect(() => {
    if (!selectedEntity) {
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          selected: false,
          data: { ...n.data, isSubdued: false, isEmphasized: false },
        }))
      );
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          animated: true,
          style: {
            ...e.style,
            opacity: 1,
            strokeWidth: (e.data as any)?.relationship?.includes('Promoted') ? 2 : 1.5,
          },
        }))
      );
      return;
    }

    const targetNodeId =
      selectedEntity.type === 'narrative'
        ? `narrative-${selectedEntity.id}`
        : selectedEntity.type === 'topic'
        ? `topic-${selectedEntity.id}`
        : selectedEntity.type === 'channel'
        ? selectedEntity.role === 'amplifier'
          ? `amplifier-${selectedEntity.id}`
          : `origin-${selectedEntity.id}`
        : null;

    setEdges((eds) => {
      const connectedEdgeIds = new Set<string>();
      eds.forEach((e) => {
        if (
          targetNodeId &&
          (e.source === targetNodeId ||
            e.target === targetNodeId ||
            e.source.endsWith(`-${selectedEntity.id}`) ||
            e.target.endsWith(`-${selectedEntity.id}`))
        ) {
          connectedEdgeIds.add(e.id);
        } else if (selectedEntity.type === 'edge' && e.id === selectedEntity.id) {
          connectedEdgeIds.add(e.id);
        }
      });

      return eds.map((e) => {
        const isConnected = connectedEdgeIds.has(e.id);
        return {
          ...e,
          animated: isConnected,
          style: {
            ...e.style,
            opacity: isConnected ? 1 : 0.22,
            strokeWidth: isConnected ? 2.5 : 1,
          },
        };
      });
    });

    setNodes((nds) => {
      const connectedNodeIds = new Set<string>();
      if (targetNodeId) {
        connectedNodeIds.add(targetNodeId);
      }
      edges.forEach((e) => {
        if (
          targetNodeId &&
          (e.source === targetNodeId ||
            e.target === targetNodeId ||
            e.source.endsWith(`-${selectedEntity.id}`) ||
            e.target.endsWith(`-${selectedEntity.id}`))
        ) {
          connectedNodeIds.add(e.source);
          connectedNodeIds.add(e.target);
        }
      });

      return nds.map((n) => {
        const isSelected =
          n.id === targetNodeId ||
          (selectedEntity.type === 'channel' && n.id.endsWith(`-${selectedEntity.id}`));
        const isConnected = connectedNodeIds.has(n.id);

        return {
          ...n,
          selected: isSelected,
          data: {
            ...n.data,
            isSubdued: !isSelected && !isConnected,
            isEmphasized: isConnected && !isSelected,
          },
        };
      });
    });
  }, [selectedEntity]);

  // Summary Metrics
  const originChannelsCount = useMemo(() => {
    const set = new Set<string>();
    Object.values(topicDetails).forEach((d) => {
      d.propagation?.unique_origin_channels?.forEach((c) => set.add(c));
    });
    return set.size;
  }, [topicDetails]);

  const amplifyingChannelsCount = useMemo(() => {
    const set = new Set<string>();
    Object.values(topicDetails).forEach((d) => {
      d.propagation?.unique_amplifying_channels?.forEach((c) => set.add(c));
    });
    return set.size;
  }, [topicDetails]);

  const totalForwardsCount = useMemo(() => {
    return Object.values(topicDetails).reduce((acc, d) => {
      return acc + (d.propagation?.observed_forward_count || 0);
    }, 0);
  }, [topicDetails]);

  return (
    <div className="space-y-6 sm:space-y-8 font-sans pb-10">
      {/* 1. Page Header */}
      <PageHeader
        title="Propagation Cascades & Diffusion"
        description="Cross-platform narrative migration tracking, forward cascades, and multi-channel diffusion analysis."
        actions={
          <div className="flex items-center gap-2.5">
            {/* View Mode Toggle (Desktop / Mobile) */}
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-[#1D232A] p-1 border border-slate-200/80 dark:border-[#2B323A]">
              <button
                type="button"
                onClick={() => setViewMode('graph')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all cursor-pointer ${
                  viewMode === 'graph'
                    ? 'bg-white dark:bg-[#111727] text-[#111727] dark:text-white shadow-xs'
                    : 'text-[#64748B] dark:text-slate-400 hover:text-[#111727] dark:hover:text-white'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Graph</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-[#111727] text-[#111727] dark:text-white shadow-xs'
                    : 'text-[#64748B] dark:text-slate-400 hover:text-[#111727] dark:hover:text-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cascade List</span>
              </button>
            </div>

            <Button
              variant="secondary"
              size="md"
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
              onClick={handleSync}
              disabled={isRefreshing}
            >
              Sync Telemetry
            </Button>
          </div>
        }
      />

      {/* 2. Top-Level Summary KPIs (Phase 3 style) */}
      <motion.section
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
      >
        <motion.div
          variants={kpiCardEnter}
          className="rounded-[24px] p-6 bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] shadow-dashboard hover:shadow-dashboard-hover transition-all duration-200 group flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[12px] font-semibold uppercase tracking-wider text-[#8591A5] dark:text-slate-400">
                Origin Channels
              </span>
              <p className="text-[12px] text-[#475569] dark:text-slate-400 font-normal mt-0.5">Discovery feeds</p>
            </div>
            <div className="w-10 h-10 rounded-[12px] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 transition-transform group-hover:scale-105">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-[34px] sm:text-[36px] font-bold text-[#111727] dark:text-slate-100 font-mono tracking-tight leading-none">
              {isLoading ? '...' : <AnimatedNumber value={originChannelsCount} />}
            </div>
            <span className="text-[12px] text-[#8591A5] dark:text-slate-400 font-medium mt-2.5 block">
              Unique discovery sources
            </span>
          </div>
        </motion.div>

        <motion.div
          variants={kpiCardEnter}
          className="rounded-[24px] p-6 bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] shadow-dashboard hover:shadow-dashboard-hover transition-all duration-200 group flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[12px] font-semibold uppercase tracking-wider text-[#8591A5] dark:text-slate-400">
                Active Cascades
              </span>
              <p className="text-[12px] text-[#475569] dark:text-slate-400 font-normal mt-0.5">Narrative flows</p>
            </div>
            <div className="w-10 h-10 rounded-[12px] bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center text-[#2F65F6] dark:text-[#5878C7] transition-transform group-hover:scale-105">
              <GitBranch className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-[34px] sm:text-[36px] font-bold text-[#111727] dark:text-slate-100 font-mono tracking-tight leading-none">
              {isLoading ? '...' : <AnimatedNumber value={narratives.length} />}
            </div>
            <span className="text-[12px] text-[#8591A5] dark:text-slate-400 font-medium mt-2.5 block">
              Synthesized narrative flows
            </span>
          </div>
        </motion.div>

        <motion.div
          variants={kpiCardEnter}
          className="rounded-[24px] p-6 bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] shadow-dashboard hover:shadow-dashboard-hover transition-all duration-200 group flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[12px] font-semibold uppercase tracking-wider text-[#8591A5] dark:text-slate-400">
                Amplifying Channels
              </span>
              <p className="text-[12px] text-[#475569] dark:text-slate-400 font-normal mt-0.5">Secondary broadcasters</p>
            </div>
            <div className="w-10 h-10 rounded-[12px] bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-400 transition-transform group-hover:scale-105">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-[34px] sm:text-[36px] font-bold text-[#111727] dark:text-slate-100 font-mono tracking-tight leading-none">
              {isLoading ? '...' : <AnimatedNumber value={amplifyingChannelsCount} />}
            </div>
            <span className="text-[12px] text-[#8591A5] dark:text-slate-400 font-medium mt-2.5 block">
              Observed secondary broadcasters
            </span>
          </div>
        </motion.div>

        <motion.div
          variants={kpiCardEnter}
          className="rounded-[24px] p-6 bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] shadow-dashboard hover:shadow-dashboard-hover transition-all duration-200 group flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[12px] font-semibold uppercase tracking-wider text-[#8591A5] dark:text-slate-400">
                Observed Forwards
              </span>
              <p className="text-[12px] text-[#475569] dark:text-slate-400 font-normal mt-0.5">Direct transmissions</p>
            </div>
            <div className="w-10 h-10 rounded-[12px] bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400 transition-transform group-hover:scale-105">
              <Share2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-[34px] sm:text-[36px] font-bold text-[#111727] dark:text-slate-100 font-mono tracking-tight leading-none">
              {isLoading ? '...' : <AnimatedNumber value={totalForwardsCount} />}
            </div>
            <span className="text-[12px] text-[#8591A5] dark:text-slate-400 font-medium mt-2.5 block">
              Forward propagation cascades
            </span>
          </div>
        </motion.div>
      </motion.section>

      {/* 3. Friendly Cascade Control Center & Stepper */}
      <div className="p-4 sm:p-5 rounded-[22px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] shadow-dashboard space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Cascade Stepper & Quick Jump */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-[#1D232A] p-1 border border-slate-200/80 dark:border-[#2B323A]">
              <button
                type="button"
                onClick={() => {
                  if (currentCascadeIdx > 0) {
                    setFilterNarrativeId(sortedNarratives[currentCascadeIdx - 1].narrative_id);
                  }
                }}
                disabled={currentCascadeIdx <= 0}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-[#111727] dark:text-white hover:bg-white dark:hover:bg-[#111727] disabled:opacity-35 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
                title="Previous Cascade"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Prev</span>
              </button>

              <div className="px-2.5 py-1 text-[11px] font-mono font-bold text-[#64748B] dark:text-slate-300 select-none">
                {currentCascadeIdx >= 0 ? (
                  <span>
                    Cascade <strong className="text-[#111727] dark:text-white">{currentCascadeIdx + 1}</strong> of {sortedNarratives.length}
                  </span>
                ) : (
                  <span>All Cascades (Grid)</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (currentCascadeIdx < sortedNarratives.length - 1) {
                    setFilterNarrativeId(sortedNarratives[currentCascadeIdx + 1].narrative_id);
                  }
                }}
                disabled={currentCascadeIdx === -1 || currentCascadeIdx >= sortedNarratives.length - 1}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-[#111727] dark:text-white hover:bg-white dark:hover:bg-[#111727] disabled:opacity-35 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
                title="Next Cascade"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Direct Selector Dropdown */}
            <select
              value={filterNarrativeId}
              onChange={(e) => handleSelectCascade(e.target.value)}
              aria-label="Select Cascade"
              className="text-[12px] font-medium py-1.5 px-3 rounded-xl border border-slate-200 dark:border-[#2B323A] bg-[#F8FAFD] dark:bg-[#1D232A] text-[#111727] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2F65F6]/30 font-mono shadow-xs max-w-[280px] sm:max-w-xs truncate cursor-pointer"
            >
              <option value="all">⚡ All Discovered Cascades (Grid View - {narratives.length})</option>
              {sortedNarratives.map((n, idx) => (
                <option key={n.narrative_id} value={n.narrative_id}>
                  #{idx + 1} [{n.priority_tier.toUpperCase()}] {n.narrative_id}: {n.headline_claim.slice(0, 42)}...
                </option>
              ))}
            </select>
          </div>

          <div className="text-[12px] text-[#8591A5] dark:text-slate-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-[#2F65F6] dark:text-[#5878C7] shrink-0" />
            <span className="hidden md:inline">Click any node or relationship link to inspect granular telemetry.</span>
          </div>
        </div>

        {/* Quick Cascade Selection Pills (Top 5 Critical Flows) */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100 dark:border-[#252B32]">
          <span className="text-[11px] font-mono font-bold uppercase text-slate-400 dark:text-slate-500 mr-1 select-none">
            Quick Jump:
          </span>
          {sortedNarratives.slice(0, 5).map((n, idx) => {
            const isSelected = filterNarrativeId === n.narrative_id;
            const isCritical = n.priority_tier === 'critical';
            return (
              <button
                key={n.narrative_id}
                type="button"
                onClick={() => handleSelectCascade(n.narrative_id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#2F65F6] text-white shadow-xs ring-2 ring-[#2F65F6]/30'
                    : 'bg-slate-100/90 dark:bg-[#1D232A] text-[#475569] dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#252C35]'
                }`}
              >
                <span className={isSelected ? 'text-white/80' : 'text-slate-400'}>#{idx + 1}</span>
                <span>{n.narrative_id}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isCritical ? 'bg-rose-500' : 'bg-amber-500'
                  }`}
                />
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => handleSelectCascade('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all cursor-pointer ${
              filterNarrativeId === 'all'
                ? 'bg-[#2F65F6] text-white shadow-xs ring-2 ring-[#2F65F6]/30'
                : 'bg-slate-100/90 dark:bg-[#1D232A] text-[#475569] dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#252C35]'
            }`}
          >
            All Cascades (Grid View)
          </button>
        </div>
      </div>

      {/* 4. Active Cascade Story Card (Clear explanation of the active propagation story) */}
      {activeNarrative && (() => {
        const rawOrigins = activeNarrativeDetail?.origin_channels?.filter(Boolean) || [];
        const resolvedOrigins =
          rawOrigins.length > 0
            ? rawOrigins.map(resolveChannelInfo)
            : activeNarrativeDetail?.domains_represented && activeNarrativeDetail.domains_represented.length > 0
            ? activeNarrativeDetail.domains_represented.slice(0, 2).map((d) => ({
                id: d,
                title: `${d.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Feed`,
                handle: `@${d}`,
                category: 'Domain Source',
                platform: 'web' as const,
              }))
            : [resolveChannelInfo('1554189930')];

        const rawAmps = activeNarrativeDetail?.broadcasting_channels?.filter(Boolean) || [];
        const resolvedAmps =
          rawAmps.length > 0
            ? rawAmps.map(resolveChannelInfo)
            : [resolveChannelInfo('1888348357')];

        const coord = activeNarrativeDetail?.coordination_signals;

        return (
          <div className="p-4 sm:p-6 rounded-[22px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] shadow-dashboard space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[12px] font-bold text-[#2F65F6] dark:text-[#5878C7] bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded border border-blue-200/50 dark:border-blue-900/40">
                    Cascade {activeNarrative.narrative_id}
                  </span>
                  <span
                    className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                      activeNarrative.priority_tier === 'critical'
                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/50'
                        : activeNarrative.priority_tier === 'high'
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50'
                        : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/50'
                    }`}
                  >
                    {activeNarrative.priority_tier} Priority
                  </span>
                  <span className="text-[11px] font-mono text-[#8591A5] dark:text-slate-400">
                    Signal Score: <strong className="text-[#111727] dark:text-slate-100 font-bold">{activeNarrative.priority_signal_score.toFixed(3)}</strong>
                  </span>

                  {coord?.potential_syndication_spike && (
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50 flex items-center gap-1">
                      <Zap className="w-2.5 h-2.5" />
                      Syndication Spike
                    </span>
                  )}
                  {coord?.potential_temporal_burst && (
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/50 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      Temporal Burst
                    </span>
                  )}
                  {coord?.potential_cross_channel_cascade && (
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-1">
                      <Share2 className="w-2.5 h-2.5" />
                      Cross-Channel Spread
                    </span>
                  )}
                </div>

                <h2 className="text-[16px] sm:text-[17px] font-bold text-[#111727] dark:text-slate-100 tracking-tight leading-snug">
                  {activeNarrative.headline_claim}
                </h2>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSelectedEntity({
                      type: 'narrative',
                      id: activeNarrative.narrative_id,
                      title: activeNarrative.headline_claim,
                      subtitle: `Promoted from Trend #${(activeNarrative.promoted_from_topic_id || '').replace(/^topic_|^trend_/, '')}`,
                      priorityScore: activeNarrative.priority_signal_score,
                      priorityTier: activeNarrative.priority_tier,
                      messageCount: activeNarrative.message_count,
                      firstObservedAt: activeNarrative.first_observed_at,
                      lastObservedAt: activeNarrative.last_observed_at,
                      subScores: activeNarrative.sub_scores,
                    });
                  }}
                  leftIcon={<Info className="w-3.5 h-3.5 text-[#2F65F6]" />}
                >
                  Inspect Telemetry
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/narratives/${activeNarrative.narrative_id}`)}
                  rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                >
                  Narrative Dossier
                </Button>
              </div>
            </div>

            {/* Dynamic Telemetry Footprint Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-[#252B32] text-[12px]">
              {/* Origin Feeds */}
              <div className="p-3 rounded-xl bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/60 dark:border-[#252B32] space-y-1">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <Send className="w-3 h-3" />
                  Origin Discovery
                </span>
                <div className="text-[13px] font-bold text-[#111727] dark:text-slate-100 truncate">
                  {resolvedOrigins.map((o) => o.title).join(', ')}
                </div>
                <div className="text-[11px] font-mono text-[#8591A5] truncate">
                  {resolvedOrigins.map((o) => o.handle).join(', ')}
                </div>
              </div>

              {/* Topic Synthesis */}
              <div className="p-3 rounded-xl bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/60 dark:border-[#252B32] space-y-1">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#2F65F6] dark:text-[#5878C7] flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  Parent Trend
                </span>
                <div className="text-[13px] font-bold text-[#111727] dark:text-slate-100 truncate">
                  Trend #{activeNarrative.promoted_from_topic_id.replace(/^topic_|^trend_/, '')}
                </div>
                <div className="text-[11px] font-mono text-[#8591A5] truncate">
                  {activeTopic?.representative_keywords?.slice(0, 3).map((k) => k.keyword).join(', ') || 'Clustered discourse'}
                </div>
              </div>

              {/* Amplifiers */}
              <div className="p-3 rounded-xl bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/60 dark:border-[#252B32] space-y-1">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-1">
                  <Radio className="w-3 h-3" />
                  Broadcasters & Amplifiers
                </span>
                <div className="text-[13px] font-bold text-[#111727] dark:text-slate-100 truncate">
                  {resolvedAmps.map((a) => a.title).join(', ')}
                </div>
                <div className="text-[11px] font-mono text-[#8591A5] truncate">
                  {resolvedAmps.map((a) => a.handle).join(', ')}
                </div>
              </div>

              {/* Velocity & Scope */}
              <div className="p-3 rounded-xl bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/60 dark:border-[#252B32] space-y-1">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Transmission Metrics
                </span>
                <div className="text-[13px] font-bold text-[#111727] dark:text-slate-100 font-mono">
                  {activeNarrative.message_count.toLocaleString()} Messages
                </div>
                <div className="text-[11px] font-mono text-[#8591A5]">
                  Spread: {((activeNarrative.sub_scores?.spread_score || 0) * 100).toFixed(0)}% • Reach: {((activeNarrative.sub_scores?.reach_score || 0) * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 5. Main Workspace (Graph or Accessible Card List) */}
      {viewMode === 'graph' ? (
        <div className="relative h-[640px] rounded-[24px] overflow-hidden border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] shadow-dashboard bg-white dark:bg-[#171C22]">
          {isLoading ? (
            <div className="w-full h-full p-8 flex flex-col justify-center space-y-4 bg-white dark:bg-[#171C22]">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-full w-full rounded-[20px]" />
            </div>
          ) : (
            <div className="w-full h-full relative">
              <GraphCanvas
                key={filterNarrativeId}
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                onEdgeClick={handleEdgeClick}
                onPaneClick={() => setSelectedEntity(null)}
              />
            </div>
          )}

          {/* Contextual Inspection Drawer */}
          <InvestigationContextDrawer
            selectedEntity={selectedEntity}
            onClose={() => setSelectedEntity(null)}
          />
        </div>
      ) : (
        /* Accessible Mobile / Tablet Card View */
        <div className="space-y-4">
          {narratives.map((n) => {
            const topic = topicDetails[n.promoted_from_topic_id];
            const originChannels = topic?.propagation?.unique_origin_channels || [];
            const amplifyingChannels = topic?.propagation?.unique_amplifying_channels || [];

            return (
              <div
                key={n.narrative_id}
                className="p-6 rounded-[20px] bg-white dark:bg-[#171C22] border border-slate-200/80 dark:border-[#252B32] shadow-dashboard space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-[#2F65F6] dark:text-[#93C5FD]">
                        {n.narrative_id}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="font-mono text-[11px] text-[#64748B] dark:text-slate-400">
                        Trend #{n.promoted_from_topic_id.replace(/^topic_|^trend_/, '')}
                      </span>
                    </div>
                    <h3 className="text-[15px] font-bold text-[#111727] dark:text-slate-100 mt-1">
                      {n.headline_claim}
                    </h3>
                  </div>
                  <span className="font-mono text-[11px] font-bold uppercase px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 shrink-0">
                    {n.priority_tier}
                  </span>
                </div>

                {/* Cascade Steps */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-[16px] bg-[#F8FAFD] dark:bg-[#13171C] border border-slate-200/60 dark:border-[#252B32] text-[12px]">
                  <div>
                    <span className="font-mono text-[11px] font-bold text-[#8591A5] dark:text-slate-400 uppercase block mb-1">
                      1. Origin Channels
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {originChannels.length > 0 ? (
                        originChannels.map((c) => (
                          <span
                            key={c}
                            className="font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50 text-[11px]"
                          >
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className="text-[#8591A5] dark:text-slate-500">None recorded</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="font-mono text-[11px] font-bold text-[#8591A5] dark:text-slate-400 uppercase block mb-1">
                      2. Cluster Signal
                    </span>
                    <div className="font-mono text-[12px] text-[#111727] dark:text-slate-100">
                      Score: <strong>{n.priority_signal_score.toFixed(3)}</strong> • {n.message_count.toLocaleString()} msgs
                    </div>
                  </div>

                  <div>
                    <span className="font-mono text-[11px] font-bold text-[#8591A5] dark:text-slate-400 uppercase block mb-1">
                      3. Amplification
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {amplifyingChannels.length > 0 ? (
                        amplifyingChannels.map((c) => (
                          <span
                            key={c}
                            className="font-mono px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50 text-[11px]"
                          >
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className="text-[#8591A5] dark:text-slate-500">None recorded</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
