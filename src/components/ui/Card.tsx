import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`bg-white dark:bg-[#1E1D24] rounded-3xl p-4 shadow-soft border border-stone-100 dark:border-stone-800/80 transition-all duration-200 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
