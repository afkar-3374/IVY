import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`animate-pulse bg-stone-200/70 dark:bg-stone-800 rounded-2xl ${className}`} />
  );
};
