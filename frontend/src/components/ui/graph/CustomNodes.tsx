import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { GitBranch, Hash, Send, Radio, Globe, MessageSquare, TrendingUp, Tag, ExternalLink } from 'lucide-react';
import type { PriorityTier } from '../../../types/api';
import { resolveTelegramMessageUrl } from '../../../utils/channelRegistry';

export interface NarrativeNodeData extends Record<string, unknown> {
  narrativeId: string;
  narrativeName?: string;
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

export interface TrendNodeData extends Record<string, unknown> {
  trendId: string;
  topicId?: string;
  trendName?: string;
  messageCount: number;
  keywords: string[];
  isCentral?: boolean;
}

export interface EntityNodeData extends Record<string, unknown> {
  entityId: string;
  label: string;
  category?: 'domain' | 'hashtag' | 'entity' | string;
  citationCount?: number;
}

export interface MessageNodeData extends Record<string, unknown> {
  messageId: string;
  canonicalId?: string;
  channelName?: string;
  textPreview?: string;
  telegramUrl?: string;
}

export interface ChannelNodeData extends Record<string, unknown> {
  channelId: string;
  channelTitle: string;
  platform: 'telegram' | 'x' | 'discord' | 'threads' | string;
  role: 'origin' | 'amplifier' | 'broadcaster' | string;
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
  const isSubdued = Boolean((data as any)?.isSubdued);
  const isEmphasized = Boolean((data as any)?.isEmphasized);

  const stateClass = selected
    ? 'border-[#2F65F6] ring-2 ring-[#2F65F6]/30 shadow-md scale-[1.025] opacity-100 z-20'
    : isSubdued
    ? 'opacity-[0.28] scale-[0.98] border-[rgba(228,233,245,0.7)] dark:border-[#20262E]'
    : isEmphasized
    ? 'opacity-100 ring-1.5 ring-[#2F65F6]/40 border-[#2F65F6]/70 shadow-sm z-10'
    : 'border-[rgba(228,233,245,0.9)] dark:border-[#2D3540] hover:border-slate-300 opacity-100';

  return (
    <div
      className={`w-64 rounded-[18px] bg-white dark:bg-[#1A2027] border transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-sm ${stateClass}`}
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
            <span className="font-mono text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider truncate">
              {data.narrativeId}
            </span>
          </div>
          <span
            className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${tierStyle.bg} ${tierStyle.text} ${tierStyle.border} shrink-0`}
          >
            {tier}
          </span>
        </div>

        <p className="text-[13px] font-bold text-[#111727] dark:text-[#F8FAFC] line-clamp-2 leading-snug">
          {data.narrativeName || data.headlineClaim}
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
  const isSubdued = Boolean((data as any)?.isSubdued);
  const isEmphasized = Boolean((data as any)?.isEmphasized);

  const stateClass = selected
    ? 'border-[#2F65F6] ring-2 ring-[#2F65F6]/30 shadow-md scale-[1.025] opacity-100 z-20'
    : isSubdued
    ? 'opacity-[0.28] scale-[0.98] border-[rgba(228,233,245,0.7)] dark:border-[#20262E]'
    : isEmphasized
    ? 'opacity-100 ring-1.5 ring-[#2F65F6]/40 border-[#2F65F6]/70 shadow-sm z-10'
    : 'border-[rgba(228,233,245,0.9)] dark:border-[#2D3540] hover:border-slate-300 opacity-100';

  return (
    <div
      className={`w-56 rounded-[16px] bg-white dark:bg-[#1A2027] border transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-sm ${stateClass}`}
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
              Trend #{(data.topicId || '').replace(/^topic_|^trend_/, '') || data.clusterLabel}
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
  const isSubdued = Boolean((data as any)?.isSubdued);
  const isEmphasized = Boolean((data as any)?.isEmphasized);

  const stateClass = selected
    ? 'border-[#2F65F6] ring-2 ring-[#2F65F6]/30 shadow-md scale-[1.025] opacity-100 z-20'
    : isSubdued
    ? 'opacity-[0.28] scale-[0.98] border-[rgba(228,233,245,0.7)] dark:border-[#20262E]'
    : isEmphasized
    ? 'opacity-100 ring-1.5 ring-[#2F65F6]/40 border-[#2F65F6]/70 shadow-sm z-10'
    : 'border-[rgba(228,233,245,0.9)] dark:border-[#2D3540] hover:border-slate-300 opacity-100';

  return (
    <div
      className={`w-48 rounded-[14px] bg-white dark:bg-[#1A2027] border transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-sm ${stateClass}`}
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
            className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold ${isOrigin
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

export const TrendNode = memo(({ data, selected }: NodeProps<Node<TrendNodeData>>) => {
  const isSubdued = Boolean((data as any)?.isSubdued);
  const isEmphasized = Boolean((data as any)?.isEmphasized);

  const stateClass = selected
    ? 'border-[#2F65F6] ring-3 ring-[#2F65F6]/40 shadow-lg scale-[1.03] opacity-100 z-30'
    : isSubdued
    ? 'opacity-[0.28] scale-[0.98] border-[rgba(228,233,245,0.7)] dark:border-[#20262E]'
    : isEmphasized
    ? 'opacity-100 ring-2 ring-[#2F65F6]/50 border-[#2F65F6] shadow-md z-20'
    : 'border-[#2F65F6]/80 dark:border-[#3B82F6]/70 shadow-sm opacity-100';

  const cleanId = (data.trendId || data.topicId || '').replace(/^trend_|^topic_/, '');

  return (
    <div
      className={`w-64 rounded-[18px] bg-white dark:bg-[#151B22] border-2 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${stateClass}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-[#2F65F6] !border-2 !border-white dark:!border-[#151B22]"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        className="!w-2.5 !h-2.5 !bg-[#2F65F6] !border-2 !border-white dark:!border-[#151B22]"
      />

      <div className="p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5 text-[#2F65F6]" />
            </div>
            <span className="font-mono text-[12px] font-bold text-[#111727] dark:text-[#F8FAFC] truncate">
              Trend #{cleanId}
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold text-[#2F65F6] dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900/40 shrink-0">
            {data.messageCount} msgs
          </span>
        </div>

        {data.keywords && data.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {data.keywords.slice(0, 3).map((kw, i) => (
              <span
                key={i}
                className="text-[10px] font-mono bg-[#F1F4F9] dark:bg-[#1D232A] text-[#475569] dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-[#2B323A]"
              >
                #{kw}
              </span>
            ))}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-[#2F65F6] !border-2 !border-white dark:!border-[#151B22]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-source"
        className="!w-2.5 !h-2.5 !bg-[#2F65F6] !border-2 !border-white dark:!border-[#151B22]"
      />
    </div>
  );
});

TrendNode.displayName = 'TrendNode';

export const EntityNode = memo(({ data, selected }: NodeProps<Node<EntityNodeData>>) => {
  const isSubdued = Boolean((data as any)?.isSubdued);
  const isEmphasized = Boolean((data as any)?.isEmphasized);

  const stateClass = selected
    ? 'border-purple-600 ring-2 ring-purple-500/30 shadow-md scale-[1.025] opacity-100 z-20'
    : isSubdued
    ? 'opacity-[0.28] scale-[0.98] border-purple-200/40 dark:border-purple-900/30'
    : isEmphasized
    ? 'opacity-100 ring-1.5 ring-purple-500/40 border-purple-500 shadow-sm z-10'
    : 'border-purple-200/80 dark:border-purple-900/40 hover:border-purple-300 opacity-100';

  const isDomain = data.category === 'domain' || data.label.includes('.');

  return (
    <div
      className={`w-52 rounded-[14px] bg-white dark:bg-[#171722] border transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-sm ${stateClass}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-purple-500 !border-2 !border-white dark:!border-[#171722]"
      />

      <div className="p-2.5 space-y-1">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {isDomain ? (
              <Globe className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            ) : (
              <Tag className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            )}
            <span className="font-mono text-[11px] font-semibold text-[#111727] dark:text-[#F8FAFC] truncate">
              {data.label}
            </span>
          </div>
          <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/40">
            {data.category || 'entity'}
          </span>
        </div>

        {data.citationCount !== undefined && (
          <div className="text-[10px] text-[#8591A5] font-mono">
            {data.citationCount} {data.citationCount === 1 ? 'citation' : 'citations'}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-purple-500 !border-2 !border-white dark:!border-[#171722]"
      />
    </div>
  );
});

EntityNode.displayName = 'EntityNode';

export const MessageNode = memo(({ data, selected }: NodeProps<Node<MessageNodeData>>) => {
  const isSubdued = Boolean((data as any)?.isSubdued);

  const telegramUrl =
    data.telegramUrl ||
    resolveTelegramMessageUrl(data.canonicalId || data.messageId, data);

  const stateClass = selected
    ? 'border-[#2F65F6] ring-2 ring-[#2F65F6]/30 shadow-md scale-[1.025] opacity-100 z-20'
    : isSubdued
    ? 'opacity-[0.28] scale-[0.98]'
    : 'border-slate-200 dark:border-slate-700 opacity-100 hover:border-blue-400 dark:hover:border-blue-500';

  return (
    <div
      className={`w-48 rounded-[12px] bg-white dark:bg-[#181E25] border p-2 space-y-1.5 transition-all shadow-xs group ${stateClass}`}
    >
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-[#2F65F6] !border-2 !border-white dark:!border-[#181E25]"
      />
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <MessageSquare className="w-3 h-3 text-[#2F65F6] shrink-0" />
          <span className="font-mono text-[10px] font-bold text-[#111727] dark:text-[#F8FAFC] truncate">
            {data.messageId}
          </span>
        </div>
        {telegramUrl && (
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Redirect to exact Telegram message"
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded-md bg-blue-50 dark:bg-blue-950/70 text-[#2F65F6] dark:text-blue-400 hover:bg-[#2F65F6] hover:text-white transition-all shrink-0 cursor-pointer shadow-2xs"
          >
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
      {data.channelName && (
        <div className="text-[9px] text-[#8591A5] font-mono truncate flex items-center justify-between">
          <span>{data.channelName}</span>
          {telegramUrl && (
            <span className="text-[8.5px] font-sans text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
              Telegram ↗
            </span>
          )}
        </div>
      )}
    </div>
  );
});

MessageNode.displayName = 'MessageNode';

export const nodeTypes = {
  narrative: NarrativeNode,
  topic: TopicNode,
  trend: TrendNode,
  channel: ChannelNode,
  entity: EntityNode,
  domain: EntityNode,
  message: MessageNode,
};
