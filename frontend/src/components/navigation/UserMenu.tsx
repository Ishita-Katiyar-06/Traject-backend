import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Settings, LogOut, Bookmark, ChevronDown } from 'lucide-react';
import { WatchlistModal } from '../watchlist/WatchlistModal';
import { dropdownMenu } from '../../utils/motion';

export const UserMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isWatchlistOpen, setIsWatchlistOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <div ref={menuRef} className="relative inline-flex">
        <button
          type="button"
          aria-label="User account menu"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2.5 h-10 pl-2 pr-3.5 rounded-full bg-white border border-[rgba(228,233,245,0.85)] hover:bg-[#F8FAFD] hover:border-slate-300 shadow-xs transition-all duration-150 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6]/40 cursor-pointer"
        >
          <div className="w-7 h-7 rounded-full bg-[#FFF1F0] text-[#FF6D5A] border border-[#FFD8D3] flex items-center justify-center font-bold text-[11px] shadow-2xs">
            AK
          </div>
          <span className="hidden sm:inline-block text-[13px] font-sans text-[#111727] font-bold">
            Analyst
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-[#8591A5]" />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              role="menu"
              aria-label="User account options"
              variants={dropdownMenu}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute right-0 top-full mt-2 min-w-[230px] rounded-[22px] bg-white border border-[rgba(228,233,245,0.9)] shadow-xl p-2 z-50 font-sans origin-top"
            >
            <div className="px-3.5 py-2.5 mb-1.5 rounded-[16px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.7)] text-left">
              <div className="text-[13px] font-bold text-[#111727]">Analyst AK</div>
              <div className="text-[11px] font-medium text-[#8591A5] mt-0.5">Role: Lead Observer</div>
            </div>

            <div className="space-y-0.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  setIsWatchlistOpen(true);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 rounded-[14px] text-left text-[13px] font-medium text-[#475569] hover:text-[#111727] hover:bg-[#F1F4F9] transition-all cursor-pointer"
              >
                <Bookmark className="w-4 h-4 text-[#FF6D5A]" />
                <span>Pinned Watchlist</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="flex w-full items-center gap-2.5 px-3 py-2 rounded-[14px] text-left text-[13px] font-medium text-[#475569] hover:text-[#111727] hover:bg-[#F1F4F9] transition-all cursor-pointer"
              >
                <Settings className="w-4 h-4 text-[#8591A5]" />
                <span>Preferences</span>
              </button>
            </div>

            <div className="pt-1 mt-1 border-t border-[rgba(228,233,245,0.85)]">
              <button
                type="button"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="flex w-full items-center gap-2.5 px-3 py-2 rounded-[14px] text-left text-[13px] font-medium text-[#FF6D5A] hover:bg-[#FFF1F0] transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {/* Persistent Modals */}
      <WatchlistModal
        isOpen={isWatchlistOpen}
        onClose={() => setIsWatchlistOpen(false)}
      />
    </>
  );
};
