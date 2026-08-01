import React from 'react';
import { Heart } from 'lucide-react';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export const Loader: React.FC<LoaderProps> = ({ size = 'md', text }) => {
  const sizes = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 gap-3">
      <div className="relative">
        <Heart className={`${sizes[size]} text-[#C95565] fill-[#C95565] animate-pulse`} />
      </div>
      {text && <p className="text-xs font-medium text-[#C95565] tracking-wide animate-pulse">{text}</p>}
    </div>
  );
};
