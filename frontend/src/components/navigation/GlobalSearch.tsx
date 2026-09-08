import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Command } from 'cmdk';
import {
  Search,
  Hash,
  GitBranch,
  Users,
  ShieldCheck,
  X,
  LayoutDashboard,
  Share2,
  Database,
} from 'lucide-react';
import { searchService, SearchResultItem, SearchCategory } from '../../services/searchService';
import { modalBackdrop, modalEnter } from '../../utils/motion';

export interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_NAVIGATION = [
  { id: 'nav-overview', title: 'Intelligence Overview', route: '/overview', icon: LayoutDashboard },
  { id: 'nav-propagation', title: 'Propagation Cascades', route: '/propagation', icon: Share2 },
  { id: 'nav-communities', title: 'Community Networks', route: '/communities', icon: Users },
  { id: 'nav-investigation', title: 'Investigation Workspace', route: '/investigation', icon: ShieldCheck },
  { id: 'nav-explorer', title: 'Corpus Message Explorer', route: '/explorer', icon: Database },
];

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setQuery('');
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
          setIsLoading(false);
        }
      });
    }, 100);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [query]);

  const handleSelect = (route: string) => {
    onClose();
    navigate(route);
  };

  const getCategoryIcon = (category: SearchCategory) => {
    switch (category) {
      case 'Trends':
        return <Hash className="w-3.5 h-3.5 text-[#2F65F6]" />;
      case 'Narratives':
        return <GitBranch className="w-3.5 h-3.5 text-[#FF6D5A]" />;
      case 'Communities':
        return <Users className="w-3.5 h-3.5 text-[#8591A5]" />;
      case 'Investigations':
        return <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />;
    }
  };

  // Group results
  const narrativeResults = results.filter((r) => r.category === 'Narratives');
  const topicResults = results.filter((r) => r.category === 'Trends');
  const communityResults = results.filter((r) => r.category === 'Communities');

  const searchNode = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Command Search"
          variants={modalBackdrop}
          initial="initial"
          animate="animate"
          exit="exit"
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-16 sm:pt-20 px-4 bg-slate-900/40 backdrop-blur-[2px]"
          onClick={onClose}
        >
          <motion.div
            variants={modalEnter}
            initial="initial"
            animate="animate"
            exit="exit"
            className="w-full max-w-xl rounded-[26px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.9)] dark:border-[#2B323A] shadow-2xl overflow-hidden flex flex-col font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            <Command
              shouldFilter={false}
              className="flex flex-col w-full focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onClose();
                }
              }}
            >
              {/* Command Input */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-[#F8FAFD] dark:bg-[#13171C]">
                <Search className="w-4 h-4 text-[#8591A5] dark:text-[#94A3B8] shrink-0" />
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search narratives, trends, channels, or jump to page..."
                  className="w-full bg-transparent text-[14px] font-medium text-[#111727] dark:text-[#F8FAFC] placeholder:text-[#8591A5] dark:placeholder:text-[#8591A5] focus:outline-none focus:ring-0 outline-none border-none"
                  autoFocus
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

              {/* Command Results List */}
              <Command.List className="max-h-96 overflow-y-auto p-2 divide-y divide-[rgba(228,233,245,0.6)] dark:divide-[#222830] bg-white dark:bg-[#171C22]">
                <Command.Empty className="px-4 py-8 text-center text-[#8591A5] dark:text-[#94A3B8] text-[13px]">
                  {isLoading ? 'Scanning intelligence index...' : 'No matching intelligence entities found.'}
                </Command.Empty>

                {/* Narrative Group */}
                {narrativeResults.length > 0 && (
                  <Command.Group
                    heading="Narrative Candidates"
                    className="p-1 text-[11px] font-mono uppercase font-bold text-[#8591A5] px-3 pt-2 pb-1"
                  >
                    {narrativeResults.map((item) => (
                      <Command.Item
                        key={item.id}
                        value={item.id}
                        onSelect={() => handleSelect(item.route)}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-[#111727] dark:text-white hover:bg-[#F1F4F9] dark:hover:bg-[#1D232A] aria-selected:bg-[#F1F4F9] dark:aria-selected:bg-[#1D232A] transition-colors normal-case"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 text-rose-600 shrink-0">
                            {getCategoryIcon(item.category)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold truncate leading-snug">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-[#8591A5] truncate font-mono mt-0.5">
                              {item.subtitle}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono uppercase font-bold text-rose-700 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-full border border-rose-200/60 shrink-0 ml-2">
                          Narrative
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {/* Trend Group */}
                {topicResults.length > 0 && (
                  <Command.Group
                    heading="Trends"
                    className="p-1 text-[11px] font-mono uppercase font-bold text-[#8591A5] px-3 pt-2 pb-1"
                  >
                    {topicResults.map((item) => (
                      <Command.Item
                        key={item.id}
                        value={item.id}
                        onSelect={() => handleSelect(item.route)}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-[#111727] dark:text-white hover:bg-[#F1F4F9] dark:hover:bg-[#1D232A] aria-selected:bg-[#F1F4F9] dark:aria-selected:bg-[#1D232A] transition-colors normal-case"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 text-[#2F65F6] shrink-0">
                            {getCategoryIcon(item.category)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold truncate leading-snug">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-[#8591A5] truncate font-mono mt-0.5">
                              {item.subtitle}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono uppercase font-bold text-blue-700 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full border border-blue-200/60 shrink-0 ml-2">
                          Trend
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {/* Community Group */}
                {communityResults.length > 0 && (
                  <Command.Group
                    heading="Community Clusters"
                    className="p-1 text-[11px] font-mono uppercase font-bold text-[#8591A5] px-3 pt-2 pb-1"
                  >
                    {communityResults.map((item) => (
                      <Command.Item
                        key={item.id}
                        value={item.id}
                        onSelect={() => handleSelect(item.route)}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-[#111727] dark:text-white hover:bg-[#F1F4F9] dark:hover:bg-[#1D232A] aria-selected:bg-[#F1F4F9] dark:aria-selected:bg-[#1D232A] transition-colors normal-case"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 text-[#10B981] shrink-0">
                            {getCategoryIcon(item.category)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold truncate leading-snug">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-[#8591A5] truncate font-mono mt-0.5">
                              {item.subtitle}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono uppercase font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200/60 shrink-0 ml-2">
                          Community
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {/* Quick Navigation Shortcuts */}
                <Command.Group
                  heading="Quick Navigation"
                  className="p-1 text-[11px] font-mono uppercase font-bold text-[#8591A5] px-3 pt-2 pb-1"
                >
                  {QUICK_NAVIGATION.map((nav) => {
                    const Icon = nav.icon;
                    return (
                      <Command.Item
                        key={nav.id}
                        value={nav.title}
                        onSelect={() => handleSelect(nav.route)}
                        className="flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F1F4F9] dark:hover:bg-[#1D232A] aria-selected:bg-[#F1F4F9] dark:aria-selected:bg-[#1D232A] transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="w-3.5 h-3.5 text-[#8591A5]" />
                          <span className="text-[13px] font-medium">{nav.title}</span>
                        </div>
                        <span className="text-[11px] font-mono text-[#8591A5]">Jump</span>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              </Command.List>

              {/* Command Palette Footer */}
              <div className="px-5 py-3 border-t border-[rgba(228,233,245,0.85)] dark:border-[#252B32] bg-[#F8FAFD] dark:bg-[#13171C] flex items-center justify-between text-[11px] font-medium text-[#8591A5] dark:text-[#94A3B8]">
                <div className="flex items-center gap-3">
                  <span>↑↓ Navigate</span>
                  <span>↵ Select</span>
                  <span>ESC Close</span>
                </div>
                <span className="font-semibold text-slate-400 dark:text-[#69727D]">
                  TRAJECT Intelligence Index
                </span>
              </div>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(searchNode, document.body);
};
