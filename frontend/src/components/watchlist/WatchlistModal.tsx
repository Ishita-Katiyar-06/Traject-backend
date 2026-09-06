import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { watchlistService, WatchItem } from '../../services/watchlistService';
import { ArrowUpRight, Trash2, Hash, GitBranch, Users, ShieldCheck } from 'lucide-react';

export interface WatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WatchlistModal: React.FC<WatchlistModalProps> = ({ isOpen, onClose }) => {
  const [items, setItems] = useState<WatchItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setItems(watchlistService.getWatchlist());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    watchlistService.removeWatch(id);
    setItems(watchlistService.getWatchlist());
  };

  const handleNavigate = (route: string) => {
    onClose();
    navigate(route);
  };

  const getTypeIcon = (type: WatchItem['type']) => {
    switch (type) {
      case 'Topic':
        return <Hash className="w-3.5 h-3.5 text-data" />;
      case 'Narrative':
        return <GitBranch className="w-3.5 h-3.5 text-signal" />;
      case 'Community':
        return <Users className="w-3.5 h-3.5 text-text-secondary" />;
      case 'Investigation':
        return <ShieldCheck className="w-3.5 h-3.5 text-confirmed" />;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Analyst Watchlist"
      subtitle="Priority topics, narratives, communities, and investigations pinned for active tracking"
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-[12px] font-medium text-[#8591A5]">
            {items.length} entity {items.length === 1 ? 'item' : 'items'} in watchlist
          </span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-2.5 font-sans py-1 max-h-96 overflow-y-auto select-none">
        {items.length === 0 ? (
          <div className="py-8 text-center text-[#8591A5] text-[13px]">
            No entities currently pinned to your watchlist.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              onClick={() => handleNavigate(item.route)}
              className="p-3.5 rounded-[18px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)] flex items-center justify-between hover:bg-white hover:border-[#2F65F6]/40 hover:shadow-xs transition-all duration-150 cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="w-8 h-8 rounded-full bg-white border border-[rgba(228,233,245,0.85)] flex items-center justify-center shrink-0 shadow-2xs">
                  {getTypeIcon(item.type)}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-[#8591A5] uppercase tracking-wider">
                      {item.type}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-[11px] text-[#FF6D5A] font-semibold">
                      {item.lastChange}
                    </span>
                  </div>
                  <div className="text-[14px] font-bold text-[#111727] group-hover:text-[#2F65F6] transition-colors truncate">
                    {item.title}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="neutral" size="sm">
                  {item.currentStatus}
                </Badge>

                <button
                  type="button"
                  onClick={(e) => handleRemove(item.id, e)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[#8591A5] hover:text-[#FF6D5A] hover:bg-[#FFF1F0] transition-colors"
                  title="Remove from watchlist"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <div className="w-7 h-7 rounded-full bg-white border border-[rgba(228,233,245,0.85)] flex items-center justify-center text-[#8591A5] group-hover:bg-[#2F65F6] group-hover:text-white transition-colors">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
};
