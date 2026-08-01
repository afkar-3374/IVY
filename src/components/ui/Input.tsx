import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  rightElement,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && <label className="text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider">{label}</label>}
      <div className="relative flex items-center">
        {icon && <div className="absolute left-3.5 text-stone-400 pointer-events-none">{icon}</div>}
        <input
          className={`w-full rounded-2xl bg-white dark:bg-[#1E1D24] border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 text-sm px-4 py-3 transition-all duration-200 focus:outline-none focus:border-[#C95565] focus:ring-2 focus:ring-[#C95565]/20 ${
            icon ? 'pl-10' : ''
          } ${rightElement ? 'pr-10' : ''} ${error ? 'border-rose-500' : ''} ${className}`}
          {...props}
        />
        {rightElement && <div className="absolute right-3.5 flex items-center">{rightElement}</div>}
      </div>
      {error && <span className="text-xs text-rose-500 font-medium pl-1">{error}</span>}
    </div>
  );
};
