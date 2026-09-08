import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Settings, LogOut, Bookmark, ChevronDown, User } from 'lucide-react';
import { WatchlistModal } from '../watchlist/WatchlistModal';
import { AnalystProfileModal } from './AnalystProfileModal';
import { telemetryApi } from '../../services/telemetryApi';
import { dropdownMenu } from '../../utils/motion';

interface UserMenuProps {
  triggerStyle?: 'pill' | 'circle';
}

export const UserMenu: React.FC<UserMenuProps> = ({ triggerStyle = 'pill' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isWatchlistOpen, setIsWatchlistOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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

  const handleOpenProfile = () => {
    setIsOpen(false);
    setIsProfileOpen(true);
  };

  const handleOpenPreferences = () => {
    setIsOpen(false);
    navigate('/settings');
  };

  const handleSignOut = () => {
    setIsOpen(false);
    telemetryApi.clearCache();
    navigate('/overview');
  };

  return (
    <>
      <div ref={menuRef} className="relative inline-flex shrink-0">
        {triggerStyle === 'circle' ? (
          <button
            type="button"
            aria-label="User account menu"
            aria-expanded={isOpen}
            onClick={() => setIsOpen(!isOpen)}
            className="w-10 h-10 rounded-full border border-slate-300/80 dark:border-[#333C48] bg-white/80 dark:bg-[#181C22]/80 backdrop-blur-md flex items-center justify-center text-slate-700 dark:text-slate-300 shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:bg-slate-50 dark:hover:bg-[#20262E] hover:border-slate-400 dark:hover:border-slate-600 transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer"
          >
            <User className="w-4 h-4 text-slate-700 dark:text-slate-300" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="User account menu"
            aria-expanded={isOpen}
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 h-9 pl-1 pr-3 rounded-full bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] hover:bg-[#F8FAFD] dark:hover:bg-[#1D232A] hover:border-slate-300 dark:hover:border-[#37404B] shadow-subtle transition-all duration-150 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6]/30 cursor-pointer"
          >
            <div className="w-6 h-6 rounded-full bg-[#2F65F6]/10 dark:bg-[#5878C7]/20 text-[#2F65F6] dark:text-[#93C5FD] border border-[#2F65F6]/20 flex items-center justify-center font-semibold text-[10px]">
              AK
            </div>
            <span className="hidden sm:inline-block text-[12px] font-sans text-[#111727] dark:text-[#F8FAFC] font-semibold">
              Analyst
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#8591A5] dark:text-[#7A8699] transition-transform duration-150 ${
                isOpen ? 'rotate-180 text-[#2F65F6]' : ''
              }`}
            />
          </button>
        )}

        <AnimatePresence>
          {isOpen && (
            <motion.div
              role="menu"
              aria-label="User account options"
              variants={dropdownMenu}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute right-0 top-full mt-2 min-w-[230px] rounded-[20px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] shadow-modal p-2 z-[10001] font-sans origin-top"
            >
              {/* Analyst Profile Header Card - Clickable */}
              <button
                type="button"
                role="menuitem"
                onClick={handleOpenProfile}
                className="w-full text-left px-3.5 py-2.5 mb-1.5 rounded-[14px] bg-[#F8FAFD] dark:bg-[#1D232A] border border-[rgba(228,233,245,0.7)] dark:border-[#252B32] hover:border-[#2F65F6]/40 dark:hover:border-[#2F65F6]/40 transition-colors group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-bold text-[#111727] dark:text-[#F8FAFC] group-hover:text-[#2F65F6] dark:group-hover:text-[#93C5FD] transition-colors">
                    Analyst AK
                  </div>
                  <User className="w-3.5 h-3.5 text-[#8591A5] dark:text-[#94A3B8] group-hover:text-[#2F65F6] transition-colors" />
                </div>
                <div className="text-[11px] font-medium text-[#8591A5] dark:text-[#94A3B8] mt-0.5">
                  Role: Lead Observer (View Profile)
                </div>
              </button>

              <div className="space-y-0.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsOpen(false);
                    setIsWatchlistOpen(true);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 rounded-[12px] text-left text-[13px] font-medium text-[#475569] dark:text-[#CBD5E1] hover:text-[#111727] dark:hover:text-[#F8FAFC] hover:bg-[#F1F4F9] dark:hover:bg-[#191F26] transition-all cursor-pointer"
                >
                  <Bookmark className="w-4 h-4 text-[#2F65F6] dark:text-[#93C5FD]" />
                  <span>Pinned Watchlist</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleOpenPreferences}
                  className="flex w-full items-center gap-2.5 px-3 py-2 rounded-[12px] text-left text-[13px] font-medium text-[#475569] dark:text-[#CBD5E1] hover:text-[#111727] dark:hover:text-[#F8FAFC] hover:bg-[#F1F4F9] dark:hover:bg-[#191F26] transition-all cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-[#8591A5] dark:text-[#94A3B8]" />
                  <span>Preferences</span>
                </button>
              </div>

              <div className="pt-1 mt-1 border-t border-[rgba(228,233,245,0.85)] dark:border-[#2B323A]">
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2.5 px-3 py-2 rounded-[12px] text-left text-[13px] font-medium text-[#E35D5D] dark:text-[#F87171] hover:bg-[#E35D5D]/10 dark:hover:bg-[#E35D5D]/15 transition-all cursor-pointer"
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

      <AnalystProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </>
  );
};
