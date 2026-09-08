import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSummaryResponse, MessageDetailData } from '../../types/api';
import { telemetryApi } from '../../services/telemetryApi';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Quote, ArrowUpRight, Eye, Share2, MessageSquare, Tag } from 'lucide-react';

export interface ExplorerDetailModalProps {
  item: MessageSummaryResponse | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ExplorerDetailModal: React.FC<ExplorerDetailModalProps> = ({
  item,
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate();

  const [detail, setDetail] = useState<MessageDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && item) {
      setIsLoading(true);
      telemetryApi
        .getMessageById(item.canonical_id)
        .then((res) => {
          setDetail(res.data);
        })
        .catch((err) => {
          console.warn('Could not fetch full message detail:', err);
          setDetail(null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setDetail(null);
    }
  }, [isOpen, item]);

  if (!item) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Canonical Observation Inspection"
      subtitle={`Record ${item.canonical_id} • ${item.channel_title || item.author_id}`}
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {detail?.assigned_topic_id && (
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full px-4 hover:border-amber-400/80 dark:hover:border-amber-500/50"
                rightIcon={<ArrowUpRight className="w-3.5 h-3.5 text-[#8591A5] group-hover:text-amber-500" />}
                onClick={() => {
                  onClose();
                  navigate(`/trends/${detail.assigned_topic_id}`);
                }}
              >
                Go to Trend #{detail.assigned_topic_id.replace(/^topic_|^trend_/, '')}
              </Button>
            )}
          </div>

          <Button variant="secondary" size="sm" className="rounded-full px-4" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-4 font-sans py-1">
        {/* Metadata Badges Row */}
        <div className="flex items-center gap-2 flex-wrap text-[12px]">
          <Badge variant={item.platform === 'telegram' ? 'data' : 'neutral'} size="sm" className="rounded-full font-mono text-[10px]">
            {item.platform.toUpperCase()}
          </Badge>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <span className="text-[#111727] dark:text-slate-100 font-semibold">{item.channel_title || item.author_id}</span>
          {item.language && (
            <>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-[#8591A5] dark:text-slate-400 font-mono font-medium uppercase text-[11px]">{item.language}</span>
            </>
          )}
          {item.published_at && (
            <>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-[#8591A5] dark:text-slate-400 font-mono text-[11px]">
                {new Date(item.published_at).toLocaleString()}
              </span>
            </>
          )}
          {isLoading && (
            <span className="text-[11px] font-mono text-[#2F65F6] dark:text-[#93C5FD] animate-pulse">
              • Fetching canonical metadata...
            </span>
          )}
        </div>

        {/* Full Message Text Excerpt */}
        <div className="p-5 rounded-[22px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/80 dark:border-[#282F3A] space-y-2.5">
          <div className="flex items-center gap-1.5 text-[#8591A5] dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider font-mono">
            <Quote className="w-3.5 h-3.5 text-[#2F65F6] dark:text-[#93C5FD]" />
            <span>Canonical Post Text</span>
          </div>
          <p className="text-[14px] text-[#111727] dark:text-slate-100 leading-relaxed font-sans">
            "{item.text_content || '<media attachment / no text>'}"
          </p>
        </div>

        {/* Telemetry Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3.5 rounded-[18px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A]">
            <div className="text-[10px] text-[#8591A5] dark:text-slate-400 font-bold font-mono uppercase flex items-center gap-1">
              <Eye className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              <span>Views</span>
            </div>
            <div className="font-mono text-[18px] font-bold text-[#111727] dark:text-slate-100 mt-1">
              {item.views_count !== null && item.views_count !== undefined
                ? item.views_count.toLocaleString()
                : '—'}
            </div>
          </div>

          <div className="p-3.5 rounded-[18px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A]">
            <div className="text-[10px] text-[#8591A5] dark:text-slate-400 font-bold font-mono uppercase flex items-center gap-1">
              <Share2 className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              <span>Forwards</span>
            </div>
            <div className="font-mono text-[18px] font-bold text-[#111727] dark:text-slate-100 mt-1">
              {item.forwards_count !== null && item.forwards_count !== undefined
                ? item.forwards_count.toLocaleString()
                : '—'}
            </div>
          </div>

          <div className="p-3.5 rounded-[18px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A]">
            <div className="text-[10px] text-[#8591A5] dark:text-slate-400 font-bold font-mono uppercase flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              <span>Replies</span>
            </div>
            <div className="font-mono text-[18px] font-bold text-[#111727] dark:text-slate-100 mt-1">
              {detail?.replies_count !== null && detail?.replies_count !== undefined
                ? detail.replies_count.toLocaleString()
                : '—'}
            </div>
          </div>

          <div className="p-3.5 rounded-[18px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A]">
            <div className="text-[10px] text-[#8591A5] dark:text-slate-400 font-bold font-mono uppercase flex items-center gap-1">
              <span>Subscribers</span>
            </div>
            <div className="font-mono text-[18px] font-bold text-[#111727] dark:text-slate-100 mt-1">
              {detail?.subscriber_count !== null && detail?.subscriber_count !== undefined
                ? detail.subscriber_count.toLocaleString()
                : '—'}
            </div>
          </div>
        </div>

        {/* Extracted Hashtags & Mentions */}
        {detail && (detail.hashtags.length > 0 || detail.mentions.length > 0) && (
          <div className="space-y-1.5 pt-2">
            <div className="text-[11px] font-bold text-[#8591A5] dark:text-slate-400 uppercase font-mono flex items-center gap-1">
              <Tag className="w-3 h-3 text-[#2F65F6] dark:text-[#93C5FD]" />
              <span>Tags & Mentions</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {detail.hashtags.map((h, i) => (
                <span key={`h-${i}`} className="px-3 py-1 bg-blue-50/70 dark:bg-blue-950/40 text-[#2F65F6] dark:text-[#93C5FD] rounded-full text-[11px] font-mono font-semibold border border-blue-200/60 dark:border-blue-900/40">
                  #{h}
                </span>
              ))}
              {detail.mentions.map((m, i) => (
                <span key={`m-${i}`} className="px-3 py-1 bg-[#FAFBFD] dark:bg-[#151921] text-[#334155] dark:text-slate-300 rounded-full text-[11px] font-mono border border-slate-200/70 dark:border-[#282F3A]">
                  @{m}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Canonical Hash & Native IDs */}
        <div className="p-4 rounded-[18px] bg-[#FAFBFD] dark:bg-[#12161C] border border-slate-200/70 dark:border-[#282F3A] font-mono text-[11px] text-[#64748B] dark:text-slate-400 space-y-1.5">
          <div>
            Canonical ID: <span className="text-[#111727] dark:text-slate-100 font-semibold">{item.canonical_id}</span>
          </div>
          <div>
            Native ID: <span className="text-[#111727] dark:text-slate-100">{item.native_id}</span>
          </div>
          {detail?.raw_reference && (
            <div>
              Raw Reference: <span className="text-[#111727] dark:text-slate-100">{detail.raw_reference}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
