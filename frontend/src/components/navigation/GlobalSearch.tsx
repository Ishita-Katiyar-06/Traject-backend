import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, Hash, GitBranch, Users, Radio, ShieldCheck, X } from 'lucide-react';
import { searchService, SearchResultItem, SearchCategory } from '../../services/searchService';

export interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputRef.current?.focus(), 40);
      setQuery('');
      setSelectedIndex(0);
      searchService.search('').then(setResults);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);

    const timer = setTimeout(() => {
      searchService.search(query).then((items) => {
        if (isCurrent) {
          setResults(items);
          setSelectedIndex(0);
          setIsLoading(false);
        }
      });
    }, 120);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [query]);

  const handleSelect = (item: SearchResultItem) => {
    onClose();
    navigate(item.route);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  const getCategoryIcon = (category: SearchCategory) => {
    switch (category) {
      case 'Topics':
        return <Hash className="w-3.5 h-3.5 text-[#2F65F6]" />;
      case 'Narratives':
        return <GitBranch className="w-3.5 h-3.5 text-[#FF6D5A]" />;
      case 'Communities':
        return <Users className="w-3.5 h-3.5 text-[#8591A5]" />;
      case 'Signals':
        return <Radio className="w-3.5 h-3.5 text-[#FF6D5A]" />;
      case 'Investigations':
        return <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />;
    }
  };

  const searchNode = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search Tessera"
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-16 sm:pt-20 px-4 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-[26px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.9)] dark:border-[#2B323A] shadow-2xl overflow-hidden flex flex-col font-sans animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-[#F8FAFD] dark:bg-[#13171C]">
          <Search className="w-4 h-4 text-[#8591A5] dark:text-[#94A3B8] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search topics, narratives, communities, signals, investigations..."
            className="w-full bg-transparent text-[14px] font-medium text-[#111727] dark:text-[#F8FAFC] placeholder:text-[#8591A5] dark:placeholder:text-[#8591A5] focus:outline-none focus:ring-0 outline-none border-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-[#8591A5] hover:text-[#111727] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] p-0.5"
              aria-label="Clear query"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="px-2 py-0.5 text-[10px] font-mono bg-white dark:bg-[#1D232A] border border-slate-200 dark:border-[#2B323A] text-[#8591A5] dark:text-[#94A3B8] rounded-full shadow-2xs">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto py-1 divide-y divide-[rgba(228,233,245,0.7)] dark:divide-[#222830] bg-white dark:bg-[#171C22]">
          {isLoading && results.length === 0 ? (
            <div className="px-4 py-8 text-center text-[#8591A5] dark:text-[#94A3B8] font-mono text-[12px]">
              Scanning intelligence index...
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-8 text-center text-[#8591A5] dark:text-[#94A3B8] text-[13px]">
              No matching intelligence entities found.
            </div>
          ) : (
            results.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={`${item.category}-${item.id}`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-5 py-3 cursor-pointer transition-colors duration-150 ${isSelected
                      ? 'bg-[#EEF2FF] dark:bg-[#222B38]'
                      : 'hover:bg-[#F8FAFD] dark:hover:bg-[#1D232A]'
                    }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-[10px] bg-[#F8FAFD] dark:bg-[#191F26] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] flex items-center justify-center shrink-0 shadow-2xs">
                      {getCategoryIcon(item.category)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected
                            ? 'text-[#8591A5] dark:text-[#7B9DE0]'
                            : 'text-[#8591A5] dark:text-[#94A3B8]'
                          }`}>
                          {item.category}
                        </span>
                      </div>
                      <div className={`text-[14px] font-bold truncate ${isSelected
                          ? 'text-[#111727] dark:text-white'
                          : 'text-[#111727] dark:text-[#F8FAFC]'
                        }`}>
                        {item.title}
                      </div>
                      <div className={`text-[12px] font-medium truncate mt-0.5 ${isSelected
                          ? 'text-[#8591A5] dark:text-[#CBD5E1]'
                          : 'text-[#8591A5] dark:text-[#94A3B8]'
                        }`}>
                        {item.subtitle}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-5 py-3 border-t border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-[#F8FAFD] dark:bg-[#13171C] flex items-center justify-between text-[11px] font-medium text-[#8591A5] dark:text-[#94A3B8]">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span className="font-semibold text-slate-400 dark:text-[#69727D]">Tessera Indexed Telemetry</span>
        </div>
      </div>
    </div>
  );

  return createPortal(searchNode, document.body);
};
