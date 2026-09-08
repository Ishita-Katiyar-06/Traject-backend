/**
 * Phase 5 Centralized Chart & Visualization Tokens
 * Provides single-source-of-truth semantic palettes, typography settings,
 * and zero-clipping tooltip configurations for ECharts across TRAJECT.
 */

export interface ChartPalette {
  primary: string;
  primarySubtle: string;
  secondary: string;
  tertiary: string;
  success: string;
  warning: string;
  critical: string;
  neutral: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  gridLineColor: string;
  axisLineColor: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
}

export const CHART_PALETTE_LIGHT: ChartPalette = {
  primary: '#2F65F6',
  primarySubtle: 'rgba(47, 101, 246, 0.12)',
  secondary: '#6366F1',
  tertiary: '#0EA5E9',
  success: '#22A06B',
  warning: '#E9A23B',
  critical: '#E35D5D',
  neutral: '#8591A5',
  textPrimary: '#111727',
  textSecondary: '#475569',
  textMuted: '#64748B',
  gridLineColor: 'rgba(0, 0, 0, 0.05)',
  axisLineColor: 'rgba(228, 233, 245, 0.85)',
  tooltipBg: '#FFFFFF',
  tooltipBorder: 'rgba(228, 233, 245, 0.9)',
  tooltipText: '#111727',
};

export const CHART_PALETTE_DARK: ChartPalette = {
  primary: '#5878C7',
  primarySubtle: 'rgba(88, 120, 199, 0.16)',
  secondary: '#818CF8',
  tertiary: '#38BDF8',
  success: '#34D399',
  warning: '#FBBF24',
  critical: '#F87171',
  neutral: '#94A3B8',
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  gridLineColor: 'rgba(255, 255, 255, 0.06)',
  axisLineColor: '#2B323A',
  tooltipBg: '#1C232B',
  tooltipBorder: '#2D3748',
  tooltipText: '#F8FAFC',
};

export const getChartTheme = (isDark: boolean): ChartPalette => {
  return isDark ? CHART_PALETTE_DARK : CHART_PALETTE_LIGHT;
};

export interface TooltipItem {
  label: string;
  value: string | number;
  color?: string;
  isMono?: boolean;
}

/**
 * Standardized HTML tooltip formatter adhering to the Behance SaaS card aesthetic.
 */
export const renderSaaSTooltip = (
  title: string,
  items: TooltipItem[],
  footer?: string,
  isDark = false
): string => {
  const theme = getChartTheme(isDark);

  const itemsHtml = items
    .map(
      (item) => `
    <div style="display: flex; justify-content: space-between; align-items: center; gap: 18px; margin-top: 4px; font-size: 12px; ${
      item.isMono !== false ? 'font-family: \'IBM Plex Mono\', monospace;' : ''
    }">
      <span style="color: ${theme.textMuted}; display: flex; align-items: center; gap: 6px;">
        ${
          item.color
            ? `<span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background-color: ${item.color}; shrink: 0;"></span>`
            : ''
        }
        ${item.label}
      </span>
      <strong style="color: ${theme.textPrimary}; font-weight: 600;">${item.value}</strong>
    </div>`
    )
    .join('');

  const footerHtml = footer
    ? `
    <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid ${
      isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'
    }; font-size: 11px; color: ${theme.textMuted}; font-family: 'IBM Plex Sans', sans-serif;">
      ${footer}
    </div>`
    : '';

  return `
    <div style="min-width: 140px; max-width: 280px; font-family: 'IBM Plex Sans', -apple-system, sans-serif;">
      <div style="font-weight: 600; font-size: 12px; color: ${theme.textPrimary}; margin-bottom: 6px; line-height: 1.3;">
        ${title}
      </div>
      ${itemsHtml}
      ${footerHtml}
    </div>
  `;
};
