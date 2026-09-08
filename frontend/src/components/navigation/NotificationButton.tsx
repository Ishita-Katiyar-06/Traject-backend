import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, CheckCheck } from 'lucide-react';
import { dropdownMenu } from '../../utils/motion';

interface NotificationItem {
  id: string;
  timestamp: string;
  title: string;
  unread: boolean;
}

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    timestamp: '12:42 UTC',
    title: 'Sulina Canal navigation delay alert escalated',
    unread: true,
  },
  {
    id: 'notif-2',
    timestamp: '12:31 UTC',
    title: 'Cross-platform migration detected from Telegram to X desk',
    unread: true,
  },
  {
    id: 'notif-3',
    timestamp: '11:15 UTC',
    title: 'Collector heartbeat latency normalized on EU pool',
    unread: false,
  },
];

export const NotificationButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(MOCK_NOTIFICATIONS);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuCoords, setMenuCoords] = useState<{
    top: number;
    left: number;
    width: number;
  }>({
    top: 0,
    left: 0,
    width: 320,
  });

  const unreadCount = notifications.filter((n) => n.unread).length;

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.min(window.innerWidth - 20, 320);
    const padding = 10;

    const top = rect.bottom + 8;
    const left = Math.max(padding, Math.min(window.innerWidth - width - padding, rect.right - width));

    setMenuCoords({
      top,
      left,
      width,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleClickOutside = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (target && target.closest('[data-traject-notifications]')) return;
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  return (
    <div className="relative inline-flex font-sans">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={isOpen}
        onClick={() => {
          updatePosition();
          setIsOpen(!isOpen);
        }}
        className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.85)] dark:border-[#2B323A] hover:bg-[#F8FAFD] dark:hover:bg-[#1D232A] hover:border-slate-300 dark:hover:border-slate-600 shadow-subtle transition-all duration-150 text-[#8591A5] dark:text-[#94A3B8] hover:text-[#111727] dark:hover:text-[#F8FAFC] outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6]/40 cursor-pointer"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#E35D5D] text-white text-[10px] font-bold flex items-center justify-center leading-none border-2 border-white dark:border-[#171C22] shadow-xs"
          >
            {unreadCount}
          </span>
        )}
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              data-traject-notifications="true"
              role="region"
              aria-label="Recent notifications"
              variants={dropdownMenu}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{
                position: 'fixed',
                top: `${menuCoords.top}px`,
                left: `${menuCoords.left}px`,
                width: `${menuCoords.width}px`,
              }}
              className="rounded-[22px] bg-white dark:bg-[#171C22] border border-[rgba(228,233,245,0.9)] dark:border-[#2B323A] shadow-modal p-3 z-[10001] font-sans"
            >
              <div className="flex items-center justify-between px-2 pb-2.5 border-b border-slate-100 dark:border-[#252B32]">
                <span className="text-[13px] font-bold text-[#111727] dark:text-[#F8FAFC]">
                  Recent Activity
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-[11px] text-[#2F65F6] dark:text-[#93C5FD] hover:underline font-semibold transition-colors cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark read</span>
                  </button>
                )}
              </div>

              <div className="py-2 space-y-1.5 max-h-72 overflow-y-auto">
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-[14px] text-left transition-colors ${
                      item.unread
                        ? 'bg-[#F8FAFD] dark:bg-[#1D232A] border border-[rgba(228,233,245,0.85)] dark:border-[#252B32]'
                        : 'hover:bg-[#F8FAFD] dark:hover:bg-[#1D232A]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1 font-mono">
                      <span className="font-semibold text-[#8591A5] dark:text-[#94A3B8]">{item.timestamp}</span>
                      {item.unread && (
                        <span className="w-2 h-2 rounded-full bg-[#E35D5D] shrink-0" />
                      )}
                    </div>
                    <p className="text-[12px] font-medium text-[#111727] dark:text-[#CBD5E1] leading-snug">
                      {item.title}
                    </p>
                  </div>
                ))}
              </div>

              <div className="px-2 pt-2 border-t border-slate-100 dark:border-[#252B32] text-center">
                <span className="text-[11px] font-medium text-[#8591A5] dark:text-[#7A8699]">
                  Telemetry feed • Real-time alerts
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
