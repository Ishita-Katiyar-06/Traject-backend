import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Settings, LogOut, Bookmark, ChevronDown, User, LogIn, UserPlus, Shield } from 'lucide-react';
import { WatchlistModal } from '../watchlist/WatchlistModal';
import { AnalystProfileModal } from './AnalystProfileModal';
import { telemetryApi } from '../../services/telemetryApi';
import { dropdownMenu } from '../../utils/motion';
import { useAuth } from '../../auth';
import { useRole } from '../../contexts/RoleContext';

interface UserMenuProps {
  triggerStyle?: 'pill' | 'circle';
}

export const UserMenu: React.FC<UserMenuProps> = ({ triggerStyle = 'pill' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isWatchlistOpen, setIsWatchlistOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { user, signOut } = useAuth();
  const { role, isNtroAnalyst } = useRole();

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

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
    telemetryApi.clearCache();
    navigate('/login');
  };

  const userInitials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'U';

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
            {user ? (
              <span className="font-mono text-[11px] font-bold text-[#2F65F6] dark:text-blue-400">
                {userInitials}
              </span>
            ) : (
              <User className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            )}
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
              {userInitials}
            </div>
            <span className="hidden sm:inline-block text-[12px] font-sans text-[#111727] dark:text-[#F8FAFC] font-semibold truncate max-w-[100px]">
              {user ? user.email?.split('@')[0] : 'Account'}
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
              className="absolute right-0 top-full mt-2 min-w-[240px] rounded-[20px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] shadow-modal p-2 z-[10001] font-sans origin-top"
            >
              {/* Account Status Card */}
              {user ? (
                <button
                  type="button"
                  onClick={handleOpenProfile}
                  className="w-full text-left px-3.5 py-2.5 mb-1.5 rounded-[14px] bg-[#F8FAFD] dark:bg-[#1D232A] border border-[rgba(228,233,245,0.7)] dark:border-[#252B32] hover:border-[#2F65F6]/40 dark:hover:border-[#2F65F6]/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] font-bold text-[#111727] dark:text-[#F8FAFC] truncate max-w-[170px]" title={user.email}>
                      {user.email}
                    </div>
                    <User className="w-3.5 h-3.5 text-[#2F65F6] shrink-0" />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10.5px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      ● Active Session
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase">
                      {role === 'ntro_analyst' ? 'NTRO' : 'Public'}
                    </span>
                  </div>
                </button>
              ) : (
                <div className="w-full text-left px-3.5 py-2.5 mb-1.5 rounded-[14px] bg-slate-50 dark:bg-[#1D232A] border border-slate-200/60 dark:border-[#252B32]">
                  <div className="text-[12.5px] font-bold text-slate-800 dark:text-slate-200">
                    Not Signed In
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Supabase Authentication
                  </div>
                </div>
              )}

              <div className="space-y-0.5">
                {user ? (
                  <>
                    {isNtroAnalyst && (
                      <Link
                        to="/console/overview"
                        role="menuitem"
                        onClick={() => setIsOpen(false)}
                        className="flex w-full items-center gap-2.5 px-3 py-2 rounded-[12px] text-left text-[13px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all cursor-pointer"
                      >
                        <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>NTRO Console</span>
                      </Link>
                    )}
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
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      role="menuitem"
                      onClick={() => setIsOpen(false)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 rounded-[12px] text-left text-[13px] font-medium text-[#2F65F6] dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all cursor-pointer"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Sign In</span>
                    </Link>

                    <Link
                      to="/signup"
                      role="menuitem"
                      onClick={() => setIsOpen(false)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 rounded-[12px] text-left text-[13px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4 text-slate-400" />
                      <span>Create Account</span>
                    </Link>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleOpenPreferences}
                      className="flex w-full items-center gap-2.5 px-3 py-2 rounded-[12px] text-left text-[13px] font-medium text-[#475569] dark:text-[#CBD5E1] hover:text-[#111727] dark:hover:text-[#F8FAFC] hover:bg-[#F1F4F9] dark:hover:bg-[#191F26] transition-all cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-[#8591A5] dark:text-[#94A3B8]" />
                      <span>Preferences</span>
                    </button>
                  </>
                )}
              </div>

              {user && (
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
              )}
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
