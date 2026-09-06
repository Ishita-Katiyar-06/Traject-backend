import React from 'react';
import { TopicTrendType } from '../../data/mock/topics';
import { TrendingUp, ArrowUpRight, Minus, TrendingDown } from 'lucide-react';

export interface TopicTrendProps {
  trend: TopicTrendType;
  className?: string;
}

export const TopicTrend: React.FC<TopicTrendProps> = ({ trend, className = '' }) => {
  const config: Record<
    TopicTrendType,
    { label: string; textClass: string; icon: React.ReactNode; bgClass: string; borderClass: string }
  > = {
    Accelerating: {
      label: 'Accelerating',
      textClass: 'text-[#FF6D5A]',
      icon: <TrendingUp className="w-3 h-3" />,
      bgClass: 'bg-[#FFF1F0]',
      borderClass: 'border-[#FFD8D3]',
    },
    Emerging: {
      label: 'Emerging',
      textClass: 'text-[#FF6D5A]',
      icon: <ArrowUpRight className="w-3 h-3" />,
      bgClass: 'bg-[#FFF1F0]',
      borderClass: 'border-[#FFD8D3]',
    },
    Persistent: {
      label: 'Persistent',
      textClass: 'text-[#2F65F6]',
      icon: <Minus className="w-3 h-3" />,
      bgClass: 'bg-[#EFF4FE]',
      borderClass: 'border-[#D6E3FD]',
    },
    Cooling: {
      label: 'Cooling',
      textClass: 'text-[#64748B]',
      icon: <TrendingDown className="w-3 h-3" />,
      bgClass: 'bg-[#F1F5F9]',
      borderClass: 'border-[#E2E8F0]',
    },
  };

  const item = config[trend] || config.Persistent;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border ${item.bgClass} ${item.borderClass} ${item.textClass} text-[11px] font-sans font-semibold ${className}`}
    >
      {item.icon}
      <span>{item.label}</span>
    </span>
  );
};
