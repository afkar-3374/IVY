import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'rose' | 'cream' | 'emerald' | 'stone';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'rose', className = '' }) => {
  const variants = {
    rose: 'bg-[#FCE8EC] text-[#C95565] border-rose-200/60 dark:bg-[#4A1D28] dark:text-[#FCE8EC]',
    cream: 'bg-[#F9EEE9] text-[#501C25] border-[#F3DBD3]',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
    stone: 'bg-stone-100 text-stone-600 border-stone-200 dark:bg-stone-800 dark:text-stone-300',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};
