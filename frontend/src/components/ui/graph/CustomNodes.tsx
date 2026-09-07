import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { GitBranch, Hash, Send, Radio } from 'lucide-react';
import type { PriorityTier } from '../../../types/api';

export interface NarrativeNodeData extends Record<string, unknown> {
  narrativeId: string;
  headlineClaim: string;
  priorityScore: number;
  priorityTier: PriorityTier;
  promotedFromTopicId?: string;
  messageCount?: number;
}

export interface TopicNodeData extends Record<string, unknown> {
  topicId: string;
  clusterLabel: number;
  messageCount: number;
  keywords: string[];
}

export interface ChannelNodeData extends Record<string, unknown> {
  channelId: string;
  channelTitle: string;
  platform: 'telegram' | 'x' | 'discord' | 'threads' | string;
  role: 'origin' | 'amplifier' | 'broadcaster';
  messageCount?: number;
}

const TIER_COLORS: Record<PriorityTier, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300' },
  high: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' },
  elevated: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  routine: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-300' },
};

/**
 * 1. Narrative Node
 */
export const NarrativeNode = memo(({ data, selected }: NodeProps<Node<NarrativeNodeData>>) => {
  const tier = data.priorityTier || 'routine';
  const tierStyle = TIER_COLORS[tier] || TIER_COLORS.routine;

  return (
    <div
      className={`w-64 rounded-[18px] bg-white dark:bg-[#1A2027] border transition-all duration-150 shadow-sm ${
        selected
          ? 'border-[#2F65F6] ring-2 ring-[#2F65F6]/20 shadow-md'
          : 'border-[rgba(228,233,245,0.9)] dark:border-[#2D3540] hover:border-slate-300'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-[#2F65F6] !border-2 !border-white dark:!border-[#1A2027]"
      />

      <div className="p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <GitBranch className="w-3.5 h-3.5 text-[#FF6D5A] shrink-0" />
            <span className="font-mono text-[11px] font-bold text-[#111727] dark:text-[#F8FAFC] truncate">
              {data.narrativeId}
            </span>
          </div>
          <span
            className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${tierStyle.bg} ${tierStyle.text} ${tierStyle.border} shrink-0`}
          >
            {tier}
          </span>
        </div>

        <p className="text-[12px] font-medium text-[#475569] dark:text-[#CBD5E1] line-clamp-2 leading-relaxed">
          {data.headlineClaim}
        </p>

        <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-[#8591A5]">
          <span className="font-mono">
            Score: <strong className="text-[#111727] dark:text-white font-bold">{data.priorityScore.toFixed(2)}</strong>
          </span>
          {data.messageCount !== undefined && (
            <span className="font-mono">{data.messageCount} msgs</span>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-[#FF6D5A] !border-2 !border-white dark:!border-[#1A2027]"
      />
    </div>
  );
});

NarrativeNode.displayName = 'NarrativeNode';

/**
 * 2. Topic Cluster Node
 */
export const TopicNode = memo(({ data, selected }: NodeProps<Node<TopicNodeData>>) => {
  return (
    <div
      className={`w-56 rounded-[16px] bg-white dark:bg-[#1A2027] border transition-all duration-150 shadow-sm ${
        selected
          ? 'border-[#2F65F6] ring-2 ring-[#2F65F6]/20 shadow-md'
          : 'border-[rgba(228,233,245,0.9)] dark:border-[#2D3540] hover:border-slate-300'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-[#2F65F6] !border-2 !border-white dark:!border-[#1A2027]"
      />

      <div className="p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Hash className="w-3.5 h-3.5 text-[#2F65F6] shrink-0" />
            <span className="font-mono text-[11px] font-bold text-[#111727] dark:text-[#F8FAFC]">
              Topic #{data.clusterLabel}
            </span>
          </div>
          <span className="text-[10px] font-mono text-[#64748B] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
            {data.messageCount} msgs
          </span>
        </div>

        <div className="flex flex-wrap gap-1 pt-1">
          {data.keywords.slice(0, 3).map((kw, i) => (
            <span
              key={i}
              className="text-[10px] font-mono bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded border border-blue-200/50 dark:border-blue-900/40"
            >
              {kw}
            </span>
          ))}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-[#2F65F6] !border-2 !border-white dark:!border-[#1A2027]"
      />
    </div>
  );
});

TopicNode.displayName = 'TopicNode';

/**
 * 3. Channel Node (Origin or Amplifier)
 */
export const ChannelNode = memo(({ data, selected }: NodeProps<Node<ChannelNodeData>>) => {
  const isOrigin = data.role === 'origin';

  return (
    <div
      className={`w-48 rounded-[14px] bg-white dark:bg-[#1A2027] border transition-all duration-150 shadow-sm ${
        selected
          ? 'border-[#2F65F6] ring-2 ring-[#2F65F6]/20 shadow-md'
          : 'border-[rgba(228,233,245,0.9)] dark:border-[#2D3540] hover:border-slate-300'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-[#8591A5] !border-2 !border-white dark:!border-[#1A2027]"
      />

      <div className="p-2.5 space-y-1">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {isOrigin ? (
              <Send className="w-3 h-3 text-emerald-600 shrink-0" />
            ) : (
              <Radio className="w-3 h-3 text-purple-600 shrink-0" />
            )}
            <span className="font-mono text-[11px] font-semibold text-[#111727] dark:text-[#F8FAFC] truncate">
              {data.channelTitle || data.channelId}
            </span>
          </div>
          <span
            className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold ${
              isOrigin
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-purple-50 text-purple-700 border border-purple-200'
            }`}
          >
            {data.role}
          </span>
        </div>

        <div className="flex items-center justify-between text-[10px] text-[#8591A5] font-mono">
          <span className="capitalize">{data.platform || 'Channel'}</span>
          {data.messageCount !== undefined && <span>{data.messageCount} msgs</span>}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-[#8591A5] !border-2 !border-white dark:!border-[#1A2027]"
      />
    </div>
  );
});

ChannelNode.displayName = 'ChannelNode';

export const nodeTypes = {
  narrative: NarrativeNode,
  topic: TopicNode,
  channel: ChannelNode,
};
