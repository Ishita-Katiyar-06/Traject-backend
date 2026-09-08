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
                rightIcon={<ArrowUpRight className="w-3 h-3" />}
                onClick={() => {
                  onClose();
                  navigate(`/trends/${detail.assigned_topic_id}`);
                }}
              >
                Go to Trend #{detail.assigned_topic_id}
              </Button>
            )}
          </div>

          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-4 font-sans py-1">
        {/* Metadata Badges Row */}
        <div className="flex items-center gap-2 flex-wrap text-[12px]">
          <Badge variant={item.platform === 'telegram' ? 'data' : 'neutral'} size="sm">
            {item.platform.toUpperCase()}
          </Badge>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <span className="text-[#111727] dark:text-[#F8FAFC] font-semibold">{item.channel_title || item.author_id}</span>
          {item.language && (
            <>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-[#8591A5] dark:text-[#94A3B8] font-medium uppercase text-[11px]">{item.language}</span>
            </>
          )}
          {item.published_at && (
            <>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-[#8591A5] dark:text-[#94A3B8] font-mono text-[11px]">
                {new Date(item.published_at).toLocaleString()}
              </span>
            </>
          )}
          {isLoading && (
            <span className="text-[11px] font-mono text-[#2F65F6] animate-pulse">
              • Fetching canonical metadata...
            </span>
          )}
        </div>

        {/* Full Message Text Excerpt */}
        <div className="p-5 rounded-[20px] bg-[#F8FAFD] dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] space-y-2.5">
          <div className="flex items-center gap-1.5 text-[#8591A5] dark:text-[#94A3B8] text-[10px] font-bold uppercase tracking-wider">
            <Quote className="w-3.5 h-3.5 text-[#2F65F6]" />
            <span>Canonical Post Text</span>
          </div>
          <p className="text-[14px] text-[#111727] dark:text-[#E2E8F0] leading-relaxed">
            "{item.text_content || '<media attachment / no text>'}"
          </p>
        </div>

        {/* Telemetry Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-[16px] bg-[#F8FAFD] dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32]">
            <div className="text-[10px] text-[#8591A5] dark:text-[#94A3B8] font-bold uppercase flex items-center gap-1">
              <Eye className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              <span>Views</span>
            </div>
            <div className="font-mono text-[18px] font-bold text-[#111727] dark:text-[#F8FAFC] mt-0.5">
              {item.views_count !== null && item.views_count !== undefined
                ? item.views_count.toLocaleString()
                : '—'}
            </div>
          </div>

          <div className="p-3 rounded-[16px] bg-[#F8FAFD] dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32]">
            <div className="text-[10px] text-[#8591A5] dark:text-[#94A3B8] font-bold uppercase flex items-center gap-1">
              <Share2 className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              <span>Forwards</span>
            </div>
            <div className="font-mono text-[18px] font-bold text-[#111727] dark:text-[#F8FAFC] mt-0.5">
              {item.forwards_count !== null && item.forwards_count !== undefined
                ? item.forwards_count.toLocaleString()
                : '—'}
            </div>
          </div>

          <div className="p-3 rounded-[16px] bg-[#F8FAFD] dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32]">
            <div className="text-[10px] text-[#8591A5] dark:text-[#94A3B8] font-bold uppercase flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              <span>Replies</span>
            </div>
            <div className="font-mono text-[18px] font-bold text-[#111727] dark:text-[#F8FAFC] mt-0.5">
              {detail?.replies_count !== null && detail?.replies_count !== undefined
                ? detail.replies_count.toLocaleString()
                : '—'}
            </div>
          </div>

          <div className="p-3 rounded-[16px] bg-[#F8FAFD] dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32]">
            <div className="text-[10px] text-[#8591A5] dark:text-[#94A3B8] font-bold uppercase flex items-center gap-1">
              <span>Subscribers</span>
            </div>
            <div className="font-mono text-[18px] font-bold text-[#111727] dark:text-[#F8FAFC] mt-0.5">
              {detail?.subscriber_count !== null && detail?.subscriber_count !== undefined
                ? detail.subscriber_count.toLocaleString()
                : '—'}
            </div>
          </div>
        </div>

        {/* Extracted Hashtags & Mentions */}
        {detail && (detail.hashtags.length > 0 || detail.mentions.length > 0) && (
          <div className="space-y-1.5 pt-2">
            <div className="text-[11px] font-bold text-[#8591A5] dark:text-[#94A3B8] uppercase flex items-center gap-1">
              <Tag className="w-3 h-3 text-[#2F65F6]" />
              <span>Tags & Mentions</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {detail.hashtags.map((h, i) => (
                <span key={`h-${i}`} className="px-2.5 py-0.5 bg-blue-50 dark:bg-[#2F65F6]/10 text-[#2F65F6] rounded-full text-[12px] font-medium border border-blue-100 dark:border-[#2F65F6]/20">
                  #{h}
                </span>
              ))}
              {detail.mentions.map((m, i) => (
                <span key={`m-${i}`} className="px-2.5 py-0.5 bg-slate-100 dark:bg-[#1E252D] text-[#334155] dark:text-[#CBD5E1] rounded-full text-[12px] font-medium">
                  @{m}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Canonical Hash & Native IDs */}
        <div className="p-3.5 rounded-[16px] bg-[#F8FAFD] dark:bg-[#13171C] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32] font-mono text-[11px] text-[#64748B] dark:text-[#94A3B8] space-y-1">
          <div>
            Canonical ID: <span className="text-[#111727] dark:text-[#F8FAFC] font-semibold">{item.canonical_id}</span>
          </div>
          <div>
            Native ID: <span className="text-[#111727] dark:text-[#F8FAFC]">{item.native_id}</span>
          </div>
          {detail?.raw_reference && (
            <div>
              Raw Reference: <span className="text-[#111727] dark:text-[#F8FAFC]">{detail.raw_reference}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
