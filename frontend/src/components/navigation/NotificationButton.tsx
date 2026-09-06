import React, { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck } from 'lucide-react';

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
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
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

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  return (
    <div ref={dropdownRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white border border-[rgba(228,233,245,0.85)] hover:bg-[#F8FAFD] hover:border-slate-300 shadow-xs transition-all duration-150 text-[#8591A5] hover:text-[#111727] outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6]/40 cursor-pointer"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#FF6D5A] text-white text-[10px] font-bold flex items-center justify-center leading-none border-2 border-white shadow-xs"
          >
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="region"
          aria-label="Recent notifications"
          className="absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-[22px] bg-white border border-[rgba(228,233,245,0.9)] shadow-xl p-3 z-50 font-sans animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="flex items-center justify-between px-2 pb-2.5 border-b border-[rgba(228,233,245,0.85)]">
            <span className="text-[13px] font-bold text-[#111727]">
              Recent Activity
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 text-[11px] text-[#2F65F6] hover:text-[#1d4ed8] font-semibold transition-colors cursor-pointer"
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
                    ? 'bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)]'
                    : 'hover:bg-[#F8FAFD]'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-semibold text-[#8591A5]">{item.timestamp}</span>
                  {item.unread && (
                    <span className="w-2 h-2 rounded-full bg-[#FF6D5A] shrink-0" />
                  )}
                </div>
                <p className="text-[12px] font-medium text-[#111727] leading-snug">
                  {item.title}
                </p>
              </div>
            ))}
          </div>

          <div className="px-2 pt-2 border-t border-[rgba(228,233,245,0.85)] text-center">
            <span className="text-[11px] font-medium text-[#8591A5]">
              Telemetry feed • Real-time alerts
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
