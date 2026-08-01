import React from 'react';
import { NavLink } from 'react-router-dom';
import { MessageCircle, Search, Settings } from 'lucide-react';

export const BottomTabBar: React.FC = () => {
  const navItems = [
    { to: '/chat', label: 'Chat', icon: MessageCircle },
    { to: '/search', label: 'Search', icon: Search },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/90 dark:bg-[#1E1D24]/90 backdrop-blur-md border-t border-stone-100 dark:border-stone-800/80 pb-safe">
      <div className="max-w-md mx-auto flex items-center justify-around h-14 px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center w-16 h-full text-[11px] font-semibold transition-all duration-200 ${
                  isActive
                    ? 'text-[#C95565] scale-105'
                    : 'text-stone-400 hover:text-stone-600 dark:text-stone-500'
                }`
              }
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
