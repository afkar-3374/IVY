import React from 'react';

interface DividerProps {
  label?: string;
  className?: string;
}

export const Divider: React.FC<DividerProps> = ({ label, className = '' }) => {
  if (label) {
    return (
      <div className={`flex items-center my-4 ${className}`}>
        <div className="flex-1 border-t border-stone-200/60 dark:border-stone-800" />
        <span className="px-3 text-[11px] font-semibold tracking-wider text-stone-400 dark:text-stone-500 uppercase">
          {label}
        </span>
        <div className="flex-1 border-t border-stone-200/60 dark:border-stone-800" />
      </div>
    );
  }

  return <hr className={`border-t border-stone-100 dark:border-stone-800/80 my-3 ${className}`} />;
};
