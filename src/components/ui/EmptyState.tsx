import React from 'react';
import { HeartHandshake } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <HeartHandshake className="w-10 h-10 text-[#C95565]" />,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 max-w-sm mx-auto my-auto">
      <div className="w-16 h-16 rounded-full bg-[#FCE8EC] dark:bg-[#4A1D28] flex items-center justify-center mb-4 shadow-soft">
        {icon}
      </div>
      <h3 className="text-base font-bold text-stone-800 dark:text-stone-100 mb-1">{title}</h3>
      {description && <p className="text-xs text-stone-500 dark:text-stone-400 mb-4 leading-relaxed">{description}</p>}
      {action}
    </div>
  );
};
