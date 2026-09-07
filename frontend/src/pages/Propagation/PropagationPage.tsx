import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Filter,
  RefreshCw,
  Send,
  Radio,
  GitBranch,
  List,
  Network,
  Info,
} from 'lucide-react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  GraphCanvas,
  InvestigationContextDrawer,
  type SelectedEntityContext,
} from '../../components/ui/graph';
import { telemetryApi } from '../../services/telemetryApi';
import type {
  TopicDetailData,
  NarrativeSummaryResponse,
  TopicSummaryResponse,
} from '../../types/api';

export const PropagationPage: React.FC = () => {
  const [topics, setTopics] = useState<TopicSummaryResponse[]>([]);
  const [topicDetails, setTopicDetails] = useState<Record<string, TopicDetailData>>({});
  const [narratives, setNarratives] = useState<NarrativeSummaryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterNarrativeId, setFilterNarrativeId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntityContext | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // 1. Fetch real topics and narratives
  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [topicsRes, narrativesRes] = await Promise.all([
        telemetryApi.getTopics({ page: 1, page_size: 20 }),
        telemetryApi.getNarratives({ page: 1, page_size: 20 }),
      ]);

      setTopics(topicsRes.data);
      setNarratives(narrativesRes.data);

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
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 2. Build graph nodes and edges from authentic backend telemetry
  useEffect(() => {
    if (isLoading || topics.length === 0) return;

    const generatedNodes: Node[] = [];
    const generatedEdges: Edge[] = [];

    const originChannelSet = new Set<string>();
    const amplifyingChannelSet = new Set<string>();

    // Determine which narratives to display based on filter
    const activeNarratives =
      filterNarrativeId === 'all'
        ? narratives
        : narratives.filter((n) => n.narrative_id === filterNarrativeId);

    // Active topic IDs associated with active narratives
    const activeTopicIds = new Set(activeNarratives.map((n) => n.promoted_from_topic_id));

    // Also include topics if "all" is selected
    const displayedTopics =
      filterNarrativeId === 'all'
        ? topics
        : topics.filter((t) => activeTopicIds.has(t.topic_id));

    // Collect channels from active topics
    displayedTopics.forEach((t) => {
      const detail = topicDetails[t.topic_id];
      if (detail?.propagation) {
        detail.propagation.unique_origin_channels?.forEach((c) => originChannelSet.add(c));
        detail.propagation.unique_amplifying_channels?.forEach((c) => amplifyingChannelSet.add(c));
      }
    });

    // 1. Origin Channel Nodes (Column 1: x = 60)
    const originList = Array.from(originChannelSet);
    originList.forEach((chan, idx) => {
      generatedNodes.push({
        id: `origin-${chan}`,
        type: 'channel',
        position: { x: 60, y: 100 + idx * 110 },
        data: {
          channelId: chan,
          channelTitle: chan,
          platform: 'telegram',
          role: 'origin',
        },
      });
    });

    // 2. Topic Cluster Nodes (Column 2: x = 360)
    displayedTopics.forEach((t, idx) => {
      generatedNodes.push({
        id: `topic-${t.topic_id}`,
        type: 'topic',
        position: { x: 360, y: 80 + idx * 150 },
        data: {
          topicId: t.topic_id,
          clusterLabel: t.cluster_label,
          messageCount: t.message_count,
          keywords: t.representative_keywords?.map((k) => k.keyword) || [],
        },
      });

      // Edges from origin channels to this topic
      const detail = topicDetails[t.topic_id];
      if (detail?.propagation?.unique_origin_channels) {
        detail.propagation.unique_origin_channels.forEach((chan) => {
          generatedEdges.push({
            id: `edge-${chan}-${t.topic_id}`,
            source: `origin-${chan}`,
            target: `topic-${t.topic_id}`,
            type: 'smoothstep',
            animated: true,
            label: 'originated in',
            style: { stroke: '#10B981', strokeWidth: 1.5 },
            labelStyle: { fontSize: 10, fill: '#64748B', fontFamily: 'monospace' },
            data: {
              relationship: 'Origin Channel ➔ Discovered Topic',
              source: chan,
              target: t.topic_id,
            },
          });
        });
      }
    });

    // 3. Narrative Nodes (Column 3: x = 700)
    activeNarratives.forEach((n, idx) => {
      generatedNodes.push({
        id: `narrative-${n.narrative_id}`,
        type: 'narrative',
        position: { x: 700, y: 70 + idx * 160 },
        data: {
          narrativeId: n.narrative_id,
          headlineClaim: n.headline_claim,
          priorityScore: n.priority_signal_score,
          priorityTier: n.priority_tier,
          promotedFromTopicId: n.promoted_from_topic_id,
          messageCount: n.message_count,
        },
      });

      // Edge from Topic to Promoted Narrative
      if (n.promoted_from_topic_id) {
        generatedEdges.push({
          id: `edge-${n.promoted_from_topic_id}-${n.narrative_id}`,
          source: `topic-${n.promoted_from_topic_id}`,
          target: `narrative-${n.narrative_id}`,
          type: 'smoothstep',
          animated: false,
          label: 'promoted from',
          style: { stroke: '#2F65F6', strokeWidth: 2 },
          labelStyle: { fontSize: 10, fill: '#2F65F6', fontFamily: 'monospace', fontWeight: 600 },
          data: {
            relationship: 'Source Topic ➔ 4G Promoted Narrative',
            source: n.promoted_from_topic_id,
            target: n.narrative_id,
          },
        });
      }
    });

    // 4. Amplifying Channel Nodes (Column 4: x = 1040)
    const amplifierList = Array.from(amplifyingChannelSet);
    amplifierList.forEach((chan, idx) => {
      generatedNodes.push({
        id: `amplifier-${chan}`,
        type: 'channel',
        position: { x: 1040, y: 90 + idx * 110 },
        data: {
          channelId: chan,
          channelTitle: chan,
          platform: 'telegram',
          role: 'amplifier',
        },
      });

      // Connect narratives or topics to amplifying channels
      activeNarratives.forEach((n) => {
        const topicDetail = topicDetails[n.promoted_from_topic_id];
        if (topicDetail?.propagation?.unique_amplifying_channels?.includes(chan)) {
          generatedEdges.push({
            id: `edge-${n.narrative_id}-${chan}`,
            source: `narrative-${n.narrative_id}`,
            target: `amplifier-${chan}`,
            type: 'smoothstep',
            animated: true,
            label: 'amplified by',
            style: { stroke: '#A855F7', strokeWidth: 1.5 },
            labelStyle: { fontSize: 10, fill: '#8591A5', fontFamily: 'monospace' },
            data: {
              relationship: 'Narrative Signal ➔ Amplifying Channel',
              source: n.narrative_id,
              target: chan,
            },
          });
        }
      });
    });

    setNodes(generatedNodes);
    setEdges(generatedEdges);
  }, [isLoading, topics, topicDetails, narratives, filterNarrativeId, setNodes, setEdges]);

  // Handle node selection
  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    if (node.type === 'narrative') {
      const nData = node.data as any;
      const nObj = narratives.find((n) => n.narrative_id === nData.narrativeId);
      setSelectedEntity({
        type: 'narrative',
        id: nData.narrativeId,
        title: nData.headlineClaim,
        subtitle: `Promoted from Topic #${nData.promotedFromTopicId}`,
        priorityTier: nData.priorityTier,
        priorityScore: nData.priorityScore,
        messageCount: nData.messageCount,
        subScores: nObj?.sub_scores,
      });
    } else if (node.type === 'topic') {
      const tData = node.data as any;
      const tDetail = topicDetails[tData.topicId];
      setSelectedEntity({
        type: 'topic',
        id: tData.topicId,
        title: `Topic Cluster #${tData.clusterLabel}`,
        messageCount: tData.messageCount,
        keywords: tData.keywords,
        subtitle: tDetail?.propagation
          ? `Cross-channel spread: ${tDetail.propagation.cross_channel_observed_spread} • Observed forwards: ${tDetail.propagation.observed_forward_count}`
          : undefined,
      });
    } else if (node.type === 'channel') {
      const cData = node.data as any;
      setSelectedEntity({
        type: 'channel',
        id: cData.channelId,
        title: cData.channelTitle,
        platform: cData.platform,
        role: cData.role,
        messageCount: cData.messageCount,
      });
    }
  }, [narratives, topicDetails]);

  // Handle edge selection
  const handleEdgeClick: EdgeMouseHandler = useCallback((_event, edge) => {
    const eData = edge.data as any;
    setSelectedEntity({
      type: 'edge',
      id: edge.id,
      title: edge.label ? String(edge.label) : 'Propagation Edge',
      subtitle: eData?.relationship,
      edgeDetails: {
        source: eData?.source || edge.source,
        target: eData?.target || edge.target,
        relationship: eData?.relationship || 'Observed cascade link',
      },
    });
  }, []);

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
    <div className="space-y-6 font-sans">
      {/* 1. Page Header */}
      <PageHeader
        title="Propagation Cascades & Diffusion"
        description="Cross-platform narrative migration tracking, forward cascades, and multi-channel velocity analysis."
        actions={
          <div className="flex items-center gap-2.5">
            {/* View Mode Toggle (Desktop / Mobile) */}
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200/80 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('graph')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                  viewMode === 'graph'
                    ? 'bg-white dark:bg-[#1A2027] text-[#111727] dark:text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#111727]'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Graph</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-[#1A2027] text-[#111727] dark:text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#111727]'
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
              onClick={loadData}
              disabled={isRefreshing}
            >
              Sync Telemetry
            </Button>
          </div>
        }
      />

      {/* 2. Top-Level Summary KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[22px] p-5 bg-white border border-[rgba(228,233,245,0.85)] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#8591A5] uppercase tracking-wider font-mono">
              Origin Channels
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[28px] font-bold text-[#111727] font-mono mt-3">
            {isLoading ? '...' : originChannelsCount}
          </div>
          <span className="text-[11px] text-[#64748B] font-medium">Unique discovery sources</span>
        </div>

        <div className="rounded-[22px] p-5 bg-white border border-[rgba(228,233,245,0.85)] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#8591A5] uppercase tracking-wider font-mono">
              Active Cascades
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2F65F6]">
              <GitBranch className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[28px] font-bold text-[#111727] font-mono mt-3">
            {isLoading ? '...' : narratives.length}
          </div>
          <span className="text-[11px] text-[#64748B] font-medium">Synthesized narrative flows</span>
        </div>

        <div className="rounded-[22px] p-5 bg-white border border-[rgba(228,233,245,0.85)] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#8591A5] uppercase tracking-wider font-mono">
              Amplifying Channels
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[28px] font-bold text-[#111727] font-mono mt-3">
            {isLoading ? '...' : amplifyingChannelsCount}
          </div>
          <span className="text-[11px] text-[#64748B] font-medium">Observed secondary broadcasters</span>
        </div>

        <div className="rounded-[22px] p-5 bg-white border border-[rgba(228,233,245,0.85)] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#8591A5] uppercase tracking-wider font-mono">
              Observed Forwards
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Share2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[28px] font-bold text-[#111727] font-mono mt-3">
            {isLoading ? '...' : totalForwardsCount}
          </div>
          <span className="text-[11px] text-[#64748B] font-medium">Direct forward transmissions</span>
        </div>
      </section>

      {/* 3. Filter and Isolation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-[20px] bg-white border border-[rgba(228,233,245,0.85)] shadow-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[12px] font-bold text-[#64748B] flex items-center gap-1.5 font-mono">
            <Filter className="w-3.5 h-3.5 text-[#2F65F6]" />
            Isolate Cascade:
          </span>
          <select
            value={filterNarrativeId}
            onChange={(e) => setFilterNarrativeId(e.target.value)}
            className="text-[13px] font-medium py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[#111727] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2F65F6]/20"
          >
            <option value="all">All Discovered Cascades ({narratives.length})</option>
            {narratives.map((n) => (
              <option key={n.narrative_id} value={n.narrative_id}>
                [{n.priority_tier.toUpperCase()}] {n.narrative_id} — {n.headline_claim.slice(0, 45)}...
              </option>
            ))}
          </select>
        </div>

        <div className="text-[12px] text-[#8591A5] flex items-center gap-2">
          <Info className="w-4 h-4 text-[#2F65F6]" />
          <span>Click any node or relationship link to inspect granular telemetry.</span>
        </div>
      </div>

      {/* 4. Main Workspace (Graph or Accessible Card List) */}
      {viewMode === 'graph' ? (
        <div className="relative h-[620px] rounded-[24px] overflow-hidden flex border border-[rgba(228,233,245,0.85)] shadow-dashboard">
          {isLoading ? (
            <div className="w-full h-full p-8 flex flex-col justify-center space-y-4 bg-white">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-full w-full rounded-[20px]" />
            </div>
          ) : (
            <div className="flex-1 h-full relative">
              <GraphCanvas
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
                className="p-6 rounded-[22px] bg-white border border-[rgba(228,233,245,0.85)] shadow-xs space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-[#2F65F6]">
                        {n.narrative_id}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="font-mono text-[11px] text-[#64748B]">
                        Topic #{n.promoted_from_topic_id}
                      </span>
                    </div>
                    <h3 className="text-[15px] font-bold text-[#111727] mt-1">
                      {n.headline_claim}
                    </h3>
                  </div>
                  <span className="font-mono text-[11px] font-bold uppercase px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                    {n.priority_tier}
                  </span>
                </div>

                {/* Cascade Steps */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-[16px] bg-[#F8FAFD] border border-slate-200/60 text-[12px]">
                  <div>
                    <span className="font-mono text-[11px] font-bold text-[#8591A5] uppercase block mb-1">
                      1. Origin Channels
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {originChannels.length > 0 ? (
                        originChannels.map((c) => (
                          <span
                            key={c}
                            className="font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px]"
                          >
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className="text-[#8591A5]">None recorded</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="font-mono text-[11px] font-bold text-[#8591A5] uppercase block mb-1">
                      2. Cluster Signal
                    </span>
                    <div className="font-mono text-[12px] text-[#111727]">
                      Score: <strong>{n.priority_signal_score.toFixed(3)}</strong> • {n.message_count} msgs
                    </div>
                  </div>

                  <div>
                    <span className="font-mono text-[11px] font-bold text-[#8591A5] uppercase block mb-1">
                      3. Amplification
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {amplifyingChannels.length > 0 ? (
                        amplifyingChannels.map((c) => (
                          <span
                            key={c}
                            className="font-mono px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 text-[11px]"
                          >
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className="text-[#8591A5]">None recorded</span>
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
