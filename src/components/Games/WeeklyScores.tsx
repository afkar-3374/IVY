import React, { useMemo } from 'react';
import { Crown, Flame } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { useAuthStore } from '../../store/useAuthStore';
import { useGameStore } from '../../store/useGameStore';
import { weeklyBoard, coupleStreak, SOURCE_LABELS, weekStart } from '../../utils/scores';
import { cardClass } from '../Couple/CoupleCards';
import type { PointSource } from '../../services/gameService';

/** This week's love points for each partner, last week's winner and the shared streak. */
export const WeeklyScores: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const me = useAuthStore((s) => s.user);
  const partner = useAuthStore((s) => s.getPartnerProfile());
  const partnerName = me?.nickname || partner.display_name;
  const points = useGameStore((s) => s.points);

  const board = useMemo(() => weeklyBoard(points, me?.id || '', partner.id), [points, me?.id, partner.id]);
  const streak = useMemo(() => coupleStreak(points, me?.id || '', partner.id), [points, me?.id, partner.id]);
  const max = Math.max(board.me, board.partner, 1);
  const leader = board.me === board.partner ? null : board.me > board.partner ? 'me' : 'partner';
  const lastWinner =
    board.lastWeek.me === board.lastWeek.partner
      ? board.lastWeek.me > 0 ? 'tie' : null
      : board.lastWeek.me > board.lastWeek.partner ? me?.display_name : partnerName;
  const daysLeft = 7 - Math.floor((Date.now() - weekStart().getTime()) / 86_400_000);

  const rows = [
    { key: 'me', name: 'You', avatar: me?.avatar_url, full: me?.display_name, score: board.me },
    { key: 'partner', name: partnerName, avatar: partner.avatar_url, full: partnerName, score: board.partner },
  ];

  return (
    <div className={`${cardClass} p-5`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#E05A74]">This week</p>
          <p className="text-xs text-stone-400">{daysLeft} day{daysLeft === 1 ? '' : 's'} left · resets Monday</p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 px-3 py-1 text-xs font-bold" title="Days in a row you both played">
          <Flame className="w-3.5 h-3.5" /> {streak}-day streak
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-3">
            <div className="relative">
              <Avatar src={r.avatar} name={r.full} size="md" />
              {leader === r.key && <Crown className="absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-5 text-amber-400 fill-amber-300" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-semibold text-stone-700 dark:text-stone-200 truncate">{r.name}</span>
                <span className="font-cute font-semibold text-[#E05A74]">{r.score}</span>
              </div>
              <div className="h-2.5 rounded-full bg-rose-50 dark:bg-stone-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#F9A8D4] to-[#E05A74] transition-all duration-700"
                  style={{ width: `${(r.score / max) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-stone-500 dark:text-stone-400 mt-4">
        {leader === null
          ? board.me > 0 ? "You're tied — so cute 💞" : 'Play a game or send love to start the week 💌'
          : leader === 'me' ? `You're ahead by ${board.me - board.partner} 👑` : `${partnerName} is ahead by ${board.partner - board.me} 👑`}
        {lastWinner && ` · Last week: ${lastWinner === 'tie' ? 'a tie' : `${lastWinner} won`}`}
      </p>

      {!compact && Object.keys(board.bySource).length > 0 && (
        <div className="mt-4 pt-4 border-t border-rose-100/70 dark:border-stone-800 grid grid-cols-2 gap-2">
          {(Object.entries(board.bySource) as [PointSource, number][]).map(([source, pts]) => (
            <div key={source} className="flex justify-between rounded-xl bg-stone-50/80 dark:bg-stone-800/40 px-3 py-2 text-xs">
              <span className="text-stone-600 dark:text-stone-300">{SOURCE_LABELS[source]}</span>
              <span className="font-semibold text-stone-800 dark:text-stone-100">{pts}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
