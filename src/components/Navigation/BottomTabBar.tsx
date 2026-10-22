import React from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from './navItems';

/** Phone navigation (hidden on large screens, where SideNav takes over). */
export const BottomTabBar: React.FC = () => (
  <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pointer-events-none">
    <div className="max-w-md mx-auto flex items-center justify-around h-16 px-2 rounded-[1.75rem] bg-white/90 dark:bg-[#1E1D24]/90 backdrop-blur-md border border-rose-100/80 dark:border-stone-800 shadow-soft-lg pointer-events-auto">
      {NAV_ITEMS.filter((item) => item.mobile).map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/chat'}
          className={({ isActive }) =>
            `relative flex flex-col items-center justify-center w-14 h-12 rounded-2xl text-[10px] font-semibold transition-all duration-200 ${
              isActive ? 'text-[#E05A74] bg-rose-50 dark:bg-[#E05A74]/10' : 'text-stone-400 hover:text-stone-600 dark:text-stone-500'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'fill-[#E05A74]/20' : ''}`} />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </div>
  </nav>
);
