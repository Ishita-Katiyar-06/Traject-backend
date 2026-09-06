import React from 'react';

export interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className = '',
}) => {
  return (
    <div
      className={`w-full max-w-[1720px] mx-auto px-4 sm:px-5 md:px-7 lg:px-10 py-6 sm:py-8 space-y-6 transition-opacity duration-normal ${className}`}
    >
      {children}
    </div>
  );
};
