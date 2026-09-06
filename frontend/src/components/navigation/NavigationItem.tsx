import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Tooltip } from '../ui/Tooltip';

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

  const itemContent = (
    <NavLink
      to={path}
      onClick={onClick}
      aria-label={name}
      title={isCollapsed ? name : undefined}
      aria-current={isActive ? 'page' : undefined}
      className={`group relative flex items-center gap-3 transition-colors duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6]/40 ${
        isActive
          ? 'bg-[#2F65F6]/10 text-[#2F65F6] font-semibold shadow-xs'
          : 'text-[#475569] font-medium hover:text-[#111727] hover:bg-[#F1F4F9]'
      } ${
        isCollapsed
          ? 'justify-center w-11 h-11 rounded-[16px] mx-auto'
          : 'w-full px-3.5 py-2.5 rounded-[14px] text-[13px] font-sans'
      }`}
    >
      {/* Navigation Icon */}
      <Icon
        className={`shrink-0 transition-colors ${
          isCollapsed ? 'w-5 h-5' : 'w-[18px] h-[18px]'
        } ${
          isActive
            ? 'text-[#2F65F6]'
            : 'text-[#475569] group-hover:text-[#111727]'
        }`}
        strokeWidth={isActive ? 2.3 : 2}
      />

      {/* When Collapsed: notification badge dot if badge is present */}
      {isCollapsed && typeof badge === 'number' && (
        <span
          className="nav-dot absolute top-2 right-2 w-2 h-2 rounded-full bg-[#FF6D5A] ring-2 ring-white"
          aria-label={`${badge} notifications`}
        />
      )}

      {/* Label and Badge when Expanded */}
      {!isCollapsed && (
        <>
          <span className="truncate flex-1 tracking-tight">{name}</span>
          {typeof badge === 'number' && (
            <span
              className={`font-sans text-[11px] font-bold px-2 py-0.5 rounded-full ${
                isActive
                  ? 'bg-[#2F65F6] text-white'
                  : 'bg-[#E5E9F4] text-[#475569]'
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
