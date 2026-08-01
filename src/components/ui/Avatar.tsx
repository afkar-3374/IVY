import React from 'react';
import { getInitials } from '../../utils/format';

interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name = 'Ivy',
  size = 'md',
  isOnline,
  className = '',
}) => {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-lg',
    xl: 'w-24 h-24 text-2xl',
  };

  const badgeSizes = {
    sm: 'w-2.5 h-2.5 right-0 bottom-0 ring-1',
    md: 'w-3 h-3 right-0 bottom-0 ring-2',
    lg: 'w-4 h-4 right-0.5 bottom-0.5 ring-2',
    xl: 'w-6 h-6 right-1 bottom-1 ring-4',
  };

  return (
    <div className={`relative inline-block flex-shrink-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sizes[size]} rounded-full object-cover shadow-soft border border-rose-100 dark:border-stone-800`}
        />
      ) : (
        <div
          className={`${sizes[size]} rounded-full bg-gradient-to-br from-[#FCE8EC] to-[#F3DBD3] text-[#C95565] font-bold flex items-center justify-center border border-rose-200 shadow-soft`}
        >
          {getInitials(name)}
        </div>
      )}

      {isOnline !== undefined && (
        <span
          className={`absolute rounded-full ring-white dark:ring-[#16151A] ${
            isOnline ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-600'
          } ${badgeSizes[size]}`}
        />
      )}
    </div>
  );
};
