import React, { useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { scrollToTop } from '../utils/scroll';

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode | false;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  breadcrumbs,
  className = '',
}) => {
  const location = useLocation();

  const renderedBreadcrumbs = useMemo(() => {
    if (breadcrumbs === false) return null;
    if (breadcrumbs) return breadcrumbs;

    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length <= 1) return null;

    const root = parts[0];
    const detailId = decodeURIComponent(parts[1]);

    const ROOT_MAP: Record<string, { label: string; path: string }> = {
      trends: { label: 'Trends', path: '/trends' },
      topics: { label: 'Trends', path: '/trends' },
      narratives: { label: 'Narratives', path: '/narratives' },
      communities: { label: 'Communities', path: '/communities' },
      investigation: { label: 'Narratives', path: '/narratives' },
    };

    const rootInfo = ROOT_MAP[root];
    if (!rootInfo) return null;

    const formattedId = detailId.replace(/^trend_|^topic_|^narrative_|^community_/, '');

    return (
      <nav aria-label="Breadcrumb context" className="flex items-center gap-1.5 text-[11px] font-sans text-slate-400 dark:text-slate-400 pb-1.5">
        <Link
          to="/overview"
          onClick={() => scrollToTop(true)}
          className="hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          Traject
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
        <Link
          to={rootInfo.path}
          onClick={() => scrollToTop(true)}
          className="hover:text-slate-900 dark:hover:text-white transition-colors font-medium"
        >
          {rootInfo.label}
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full truncate max-w-[220px]">
          #{formattedId}
        </span>
      </nav>
    );
  }, [breadcrumbs, location.pathname]);

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200/80 dark:border-[#2B323D] ${className}`}>
      <div>
        {renderedBreadcrumbs}
        {typeof title === 'string' ? (
          <h1 className="text-page-title text-slate-900 dark:text-slate-100 font-bold tracking-tight">
            {title}
          </h1>
        ) : (
          <div>{title}</div>
        )}
        {description && (
          typeof description === 'string' ? (
            <p className="text-page-subtitle text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              {description}
            </p>
          ) : (
            <div className="text-page-subtitle text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              {description}
            </div>
          )
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap mt-1 sm:mt-0">
          {actions}
        </div>
      )}
    </div>
  );
};
