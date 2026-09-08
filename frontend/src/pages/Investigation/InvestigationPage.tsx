import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from '@xyflow/react';
import {
  RefreshCw,
  Filter,
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
import type { NarrativeSummaryResponse, TopicSummaryResponse } from '../../types/api';

export const InvestigationPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const [narratives, setNarratives] = useState<NarrativeSummaryResponse[]>([]);
  const [topics, setTopics] = useState<TopicSummaryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntityContext | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const loadData = useCallback(async (isManualSync = false) => {
    setIsRefreshing(true);
    try {
      const minDelay = isManualSync ? new Promise((resolve) => setTimeout(resolve, 600)) : Promise.resolve();
      const [narrativesRes, topicsRes] = await Promise.all([
        telemetryApi.getNarratives({ page: 1, page_size: 20 }),
        telemetryApi.getTopics({ page: 1, page_size: 20 }),
        minDelay,
      ]);
      setNarratives(narrativesRes.data);
      setTopics(topicsRes.data);
    } catch (err) {
      console.error('Failed to load investigation telemetry:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const handleSync = async () => {
    telemetryApi.clearCache();
    await loadData(true);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // If URL specifies an investigation ID, pre-select that entity
  useEffect(() => {
    if (!id || narratives.length === 0) return;
    const matchedNarrative = narratives.find(
      (n) => n.narrative_id.toLowerCase() === id.toLowerCase()
    );
    if (matchedNarrative) {
      setSelectedEntity({
        type: 'narrative',
        id: matchedNarrative.narrative_id,
        title: matchedNarrative.headline_claim,
        subtitle: `Priority tier: ${matchedNarrative.priority_tier.toUpperCase()}`,
        priorityTier: matchedNarrative.priority_tier,
        priorityScore: matchedNarrative.priority_signal_score,
        messageCount: matchedNarrative.message_count,
        subScores: matchedNarrative.sub_scores,
      });
      return;
    }
    const matchedTopic = topics.find(
      (t) => String(t.topic_id) === id || String(t.cluster_label) === id
    );
    if (matchedTopic) {
      setSelectedEntity({
        type: 'topic',
        id: matchedTopic.topic_id,
        title: `Topic Cluster #${matchedTopic.cluster_label}`,
        messageCount: matchedTopic.message_count,
        keywords: matchedTopic.representative_keywords?.map((k) => k.keyword) || [],
      });
    }
  }, [id, narratives, topics]);

  // Build Synthesis Evidence Graph (Topics ➔ Narratives)
  useEffect(() => {
    if (isLoading || narratives.length === 0) return;

    const filteredNarratives =
      selectedTier === 'all'
        ? narratives
        : narratives.filter((n) => n.priority_tier === selectedTier);

    const generatedNodes: Node[] = [];
    const generatedEdges: Edge[] = [];

    // 1. Topic Nodes (Left column: x = 100)
    const referencedTopicIds = new Set(filteredNarratives.map((n) => n.promoted_from_topic_id));
    const activeTopics = topics.filter((t) => referencedTopicIds.has(t.topic_id));

    activeTopics.forEach((t, idx) => {
      generatedNodes.push({
        id: `topic-${t.topic_id}`,
        type: 'topic',
        position: { x: 100, y: 80 + idx * 170 },
        data: {
          topicId: t.topic_id,
          clusterLabel: t.cluster_label,
          messageCount: t.message_count,
          keywords: t.representative_keywords?.map((k) => k.keyword) || [],
        },
      });
    });

    // 2. Narrative Candidate Nodes (Right column: x = 540)
    filteredNarratives.forEach((n, idx) => {
      generatedNodes.push({
        id: `narrative-${n.narrative_id}`,
        type: 'narrative',
        position: { x: 540, y: 60 + idx * 160 },
        data: {
          narrativeId: n.narrative_id,
          headlineClaim: n.headline_claim,
          priorityScore: n.priority_signal_score,
          priorityTier: n.priority_tier,
          promotedFromTopicId: n.promoted_from_topic_id,
          messageCount: n.message_count,
        },
      });

      // Link Topic to Narrative
      if (n.promoted_from_topic_id) {
        generatedEdges.push({
          id: `edge-${n.promoted_from_topic_id}-${n.narrative_id}`,
          source: `topic-${n.promoted_from_topic_id}`,
          target: `narrative-${n.narrative_id}`,
          type: 'smoothstep',
          animated: n.has_coordination_signals,
          label: n.has_coordination_signals ? 'coordination signal' : 'promoted',
          style: {
            stroke: n.has_coordination_signals ? '#E11D48' : '#2F65F6',
            strokeWidth: n.has_coordination_signals ? 2 : 1.5,
          },
          labelStyle: {
            fontSize: 10,
            fill: n.has_coordination_signals ? '#E11D48' : '#64748B',
            fontFamily: 'monospace',
            fontWeight: 600,
          },
          data: {
            relationship: 'Cluster Evidence ➔ 4G Narrative Synthesis',
            source: n.promoted_from_topic_id,
            target: n.narrative_id,
          },
        });
      }
    });

    setNodes(generatedNodes);
    setEdges(generatedEdges);
  }, [isLoading, narratives, topics, selectedTier, setNodes, setEdges]);

  // Handle node selection
  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    if (node.type === 'narrative') {
      const nData = node.data as any;
      const nObj = narratives.find((n) => n.narrative_id === nData.narrativeId);
      setSelectedEntity({
        type: 'narrative',
        id: nData.narrativeId,
        title: nData.headlineClaim,
        subtitle: `Priority tier: ${nData.priorityTier.toUpperCase()}`,
        priorityTier: nData.priorityTier,
        priorityScore: nData.priorityScore,
        messageCount: nData.messageCount,
        subScores: nObj?.sub_scores,
      });
    } else if (node.type === 'topic') {
      const tData = node.data as any;
      setSelectedEntity({
        type: 'topic',
        id: tData.topicId,
        title: `Topic Cluster #${tData.clusterLabel}`,
        messageCount: tData.messageCount,
        keywords: tData.keywords,
      });
    }
  }, [narratives]);

  const handleEdgeClick: EdgeMouseHandler = useCallback((_event, edge) => {
    const eData = edge.data as any;
    setSelectedEntity({
      type: 'edge',
      id: edge.id,
      title: edge.label ? String(edge.label) : 'Evidence Link',
      subtitle: eData?.relationship,
      edgeDetails: {
        source: eData?.source || edge.source,
        target: eData?.target || edge.target,
        relationship: eData?.relationship || 'Evidence relationship',
      },
    });
  }, []);

  // Handle smooth node selection and dimming of unrelated elements
  useEffect(() => {
    const selectedNodeId = selectedEntity
      ? selectedEntity.type === 'narrative'
        ? `narrative-${selectedEntity.id}`
        : selectedEntity.type === 'topic'
        ? `topic-${selectedEntity.id}`
        : null
      : null;

    if (!selectedNodeId) {
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: {
            ...n.data,
            isEmphasized: false,
            isSubdued: false,
            selected: false,
          },
        }))
      );
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          style: {
            ...(e.style || {}),
            opacity: 1,
            strokeWidth: (e.data as any)?.strokeWidthDefault ?? 1.5,
          },
        }))
      );
      return;
    }

    const connectedNodeIds = new Set<string>([selectedNodeId]);
    const connectedEdgeIds = new Set<string>();

    edges.forEach((edge) => {
      if (edge.source === selectedNodeId || edge.target === selectedNodeId) {
        connectedEdgeIds.add(edge.id);
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
      }
    });

    setNodes((nds) =>
      nds.map((n) => {
        const isSelected = n.id === selectedNodeId;
        const isConnected = connectedNodeIds.has(n.id);
        return {
          ...n,
          data: {
            ...n.data,
            selected: isSelected,
            isEmphasized: isSelected || isConnected,
            isSubdued: !isConnected,
          },
        };
      })
    );

    setEdges((eds) =>
      eds.map((e) => {
        const isConnected = connectedEdgeIds.has(e.id);
        return {
          ...e,
          style: {
            ...(e.style || {}),
            opacity: isConnected ? 1 : 0.22,
            strokeWidth: isConnected ? 2.5 : 1,
          },
        };
      })
    );
  }, [selectedEntity, edges.length, setNodes, setEdges]);

  return (
    <div className="space-y-6 font-sans">
      <PageHeader
        title="Investigation Workspace & Evidence Synthesis"
        description="Collaborative analyst case management, multi-source evidence linking, and hypothesis testing."
        actions={
          <Button
            variant="secondary"
            size="md"
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
            onClick={handleSync}
            disabled={isRefreshing}
          >
            Sync Evidence
          </Button>
        }
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-[20px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] shadow-xs">
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-bold text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5 font-mono">
            <Filter className="w-3.5 h-3.5 text-[#2F65F6]" />
            Priority Tier Filter:
          </span>
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="text-[13px] font-medium py-1.5 px-3 rounded-xl border border-slate-200 dark:border-[#2B323A] bg-slate-50 dark:bg-[#13171C] text-[#111727] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2F65F6]/20"
          >
            <option value="all">All Priority Tiers ({narratives.length})</option>
            <option value="critical">Critical Only</option>
            <option value="high">High Only</option>
            <option value="elevated">Elevated Only</option>
            <option value="routine">Routine Only</option>
          </select>
        </div>

        <div className="text-[12px] text-[#8591A5] dark:text-[#94A3B8] flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-[#2F65F6]" />
          <span>Select any narrative or topic cluster to inspect its synthesized evidence.</span>
        </div>
      </div>

      {/* Main Investigation Canvas */}
      <div className="relative h-[620px] rounded-[24px] overflow-hidden border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] shadow-dashboard bg-white dark:bg-[#171C22]">
        {isLoading ? (
          <div className="w-full h-full p-8 flex flex-col justify-center space-y-4 bg-white dark:bg-[#171C22]">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-full w-full rounded-[20px]" />
          </div>
        ) : (
          <div className="w-full h-full relative">
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

        <InvestigationContextDrawer
          selectedEntity={selectedEntity}
          onClose={() => setSelectedEntity(null)}
        />
      </div>
    </div>
  );
};
