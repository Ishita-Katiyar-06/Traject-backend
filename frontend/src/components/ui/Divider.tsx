import React from 'react';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  className = '',
}) => {
  if (orientation === 'vertical') {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={`inline-block w-px self-stretch bg-border ${className}`}
      />
    );
  }

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={`w-full h-px bg-border my-2 ${className}`}
    />
  );
};
