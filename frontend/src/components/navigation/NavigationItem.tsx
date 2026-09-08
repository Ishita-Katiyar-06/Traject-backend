import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Tooltip } from '../ui/Tooltip';
import { usePrefersReducedMotion } from '../../utils/motion';
import { scrollToTop } from '../../utils/scroll';

export interface NavigationItemProps {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  badge?: number;
  isCollapsed?: boolean;
  onClick?: () => void;
}

export const NavigationItem: React.FC<NavigationItemProps> = ({
  name,
  path,
  icon: Icon,
  badge,
  isCollapsed = false,
  onClick,
}) => {
  const location = useLocation();

  // Route-aware active state check
  const isActive =
    path === '/overview'
      ? location.pathname === '/' || location.pathname === '/overview'
      : location.pathname === path || location.pathname.startsWith(`${path}/`);

  const prefersReduced = usePrefersReducedMotion();

  const handleClick = () => {
    scrollToTop(true);
    onClick?.();
  };

  const itemContent = (
    <NavLink
      to={path}
      onClick={handleClick}
      aria-label={name}
      title={isCollapsed ? name : undefined}
      aria-current={isActive ? 'page' : undefined}
      className={`group relative flex items-center gap-3.5 transition-colors duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6]/30 ${
        isActive
          ? 'text-[#2F65F6] dark:text-[#93C5FD] font-semibold'
          : 'text-[#475569] dark:text-[#CBD5E1] font-medium hover:text-[#111727] dark:hover:text-[#F8FAFC] hover:bg-[#F4F7FD] dark:hover:bg-[#1A2027]'
      } ${
        isCollapsed
          ? 'justify-center w-10 h-10 rounded-[12px] mx-auto'
          : 'w-full px-3.5 py-2.5 rounded-[12px] text-[13.5px] font-sans'
      }`}
    >
      {/* Smooth Shared Layout Active Indicator */}
      {isActive && (
        <motion.div
          layoutId={prefersReduced ? undefined : 'activeNavBackground'}
          className="absolute inset-0 rounded-[12px] bg-[#EEF3FE] dark:bg-[#1D2636] z-0 shadow-2xs"
          transition={
            prefersReduced
              ? { duration: 0 }
              : {
                  duration: 0.22,
                  ease: [0.16, 1, 0.3, 1],
                }
          }
        />
      )}

      {/* Navigation Icon */}
      <Icon
        className={`shrink-0 transition-colors relative z-10 ${
          isCollapsed ? 'w-5 h-5' : 'w-[19px] h-[19px]'
        } ${
          isActive
            ? 'text-[#2F65F6] dark:text-[#93C5FD]'
            : 'text-[#64748B] dark:text-[#8591A5] group-hover:text-[#111727] dark:group-hover:text-[#F8FAFC]'
        }`}
        strokeWidth={2}
      />

      {/* When Collapsed: notification badge dot if badge is present */}
      {isCollapsed && typeof badge === 'number' && (
        <span
          className="nav-dot absolute top-2 right-2 w-2 h-2 rounded-full bg-[#E9A23B] ring-2 ring-white dark:ring-[#13171C] z-10"
          aria-label={`${badge} notifications`}
        />
      )}

      {/* Label and Badge when Expanded */}
      {!isCollapsed && (
        <>
          <span className="truncate flex-1 tracking-normal relative z-10">{name}</span>
          {typeof badge === 'number' && (
            <span
              className={`font-sans text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors relative z-10 ${
                isActive
                  ? 'bg-[#2F65F6] text-white'
                  : 'bg-[#E5E9F4] dark:bg-[#191F26] text-[#475569] dark:text-[#94A3B8]'
              }`}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  if (isCollapsed) {
    return (
      <Tooltip content={name} position="right" delay={150}>
        {itemContent}
      </Tooltip>
    );
  }

  return itemContent;
};
