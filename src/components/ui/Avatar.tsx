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
    <div className={`relative inline-block flex-shrink-0 rounded-full align-middle ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sizes[size]} rounded-full object-cover shadow-soft border border-rose-100 dark:border-stone-800`}
        />
      ) : (
        <div
          className={`${sizes[size]} rounded-full bg-gradient-to-br from-[#FCE8EC] to-[#F3DBD3] dark:from-[#3A2630] dark:to-[#2B2027] text-[#C95565] dark:text-[#F28DA0] font-bold flex items-center justify-center border border-rose-200 dark:border-[#4A2E38] shadow-soft`}
        >
          {getInitials(name)}
        </div>
      )}

      {/* Like WhatsApp: a green dot while online, nothing otherwise */}
      {isOnline && <span className={`absolute rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#16151A] ${badgeSizes[size]}`} />}
    </div>
  );
};
