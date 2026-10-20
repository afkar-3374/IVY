import React from 'react';
import { NavLink } from 'react-router-dom';
import { Heart, Lock } from 'lucide-react';
import { NAV_ITEMS } from './navItems';
import { Avatar } from '../ui/Avatar';
import { useAuthStore } from '../../store/useAuthStore';
import { useCoupleStore } from '../../store/useCoupleStore';
import { daysTogether } from '../../utils/couple';

/** Desktop navigation rail. */
export const SideNav: React.FC = () => {
  const me = useAuthStore((s) => s.user);
  const partner = useAuthStore((s) => s.getPartnerProfile());
  const lock = useAuthStore((s) => s.lock);
  const startedOn = useCoupleStore((s) => s.startedOn);
  const days = daysTogether(startedOn);

  return (
    <aside className="hidden lg:flex w-64 flex-shrink-0 flex-col border-r border-rose-100/80 dark:border-stone-800 bg-white/70 dark:bg-[#1A1920]/80 backdrop-blur px-4 py-6">
      <div className="flex items-center gap-1 px-3 mb-8">
        <span className="font-serif italic text-4xl font-bold text-stone-900 dark:text-stone-100">Ivy</span>
        <Heart className="w-4 h-4 text-[#E05A74] fill-[#E05A74] -mt-5" />
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/chat'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-rose-50 text-[#E05A74] dark:bg-[#E05A74]/10'
                  : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800/60 dark:hover:text-stone-100'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto">
        <div className="rounded-3xl bg-gradient-to-br from-rose-50 to-violet-50 dark:from-[#2A1E26] dark:to-[#221E2E] p-4 mb-3">
          <div className="flex -space-x-3 mb-2">
            <Avatar src={me?.avatar_url} name={me?.display_name} size="md" className="ring-2 ring-white dark:ring-[#1E1D24] rounded-full" />
            <Avatar src={partner.avatar_url} name={me?.nickname || partner.display_name} size="md" className="ring-2 ring-white dark:ring-[#1E1D24] rounded-full" />
          </div>
          {days !== null ? (
            <p className="font-cute text-sm font-medium text-stone-700 dark:text-stone-200">
              <span className="text-[#E05A74] text-lg font-semibold">{days}</span> days together 💞
            </p>
          ) : (
            <p className="text-xs text-stone-500">Set your start date on the Us page</p>
          )}
        </div>
        <button
          onClick={lock}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-stone-500 hover:bg-stone-50 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800/60"
        >
          <Lock className="w-5 h-5" /> Lock
        </button>
      </div>
    </aside>
  );
};
