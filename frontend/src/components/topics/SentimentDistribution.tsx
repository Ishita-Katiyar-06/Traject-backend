import React from 'react';

export interface SentimentDistributionProps {
  positive: number;
  neutral: number;
  negative: number;
  negativeShiftPercent?: number;
  className?: string;
}

export const SentimentDistribution: React.FC<SentimentDistributionProps> = ({
  positive,
  neutral,
  negative,
  negativeShiftPercent,
  className = '',
}) => {
  return (
    <div className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white p-5 sm:p-6 shadow-xs space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-[16px] font-bold text-[#111727]">
          Sentiment Distribution
        </h4>
        {typeof negativeShiftPercent === 'number' && (
          <span className="font-mono text-[11px] text-[#8591A5]">
            Negative shift:{' '}
            <strong className="text-[#FF6D5A] font-semibold">
              +{negativeShiftPercent} pts
            </strong>
          </span>
        )}
      </div>

      {/* Horizontal Multi-color Distribution Bar */}
      <div className="flex h-3 w-full rounded-full overflow-hidden bg-[#EEF1F8] border border-[rgba(228,233,245,0.8)] p-[1px]">
        <div
          style={{ width: `${positive}%` }}
          className="bg-[#53E5C3] rounded-l-full transition-all duration-normal"
          title={`Positive: ${positive}%`}
        />
        <div
          style={{ width: `${neutral}%` }}
          className="bg-[#CBD5E1] transition-all duration-normal"
          title={`Neutral: ${neutral}%`}
        />
        <div
          style={{ width: `${negative}%` }}
          className="bg-[#FF6D5A] rounded-r-full transition-all duration-normal"
          title={`Negative: ${negative}%`}
        />
      </div>

      {/* Percentages Readout */}
      <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[12px]">
        <div className="flex items-center gap-1.5 text-[#10B981] font-medium">
          <span className="w-2 h-2 rounded-full bg-[#10B981]" />
          <span>Positive {positive}%</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 text-[#64748B] font-medium">
          <span className="w-2 h-2 rounded-full bg-[#CBD5E1]" />
          <span>Neutral {neutral}%</span>
        </div>
        <div className="flex items-center justify-end gap-1.5 text-[#FF6D5A] font-medium">
          <span className="w-2 h-2 rounded-full bg-[#FF6D5A]" />
          <span>Negative {negative}%</span>
        </div>
      </div>

      <p className="text-[12px] text-[#8591A5] font-sans pt-2 border-t border-[rgba(228,233,245,0.8)] leading-relaxed">
        Sentiment distribution measured across public posts containing topic keywords. Expresses lexical tone rather than causal attribution.
      </p>
    </div>
  );
};
