import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Pencil, Plus, Trash2, CalendarHeart, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from '../ui/Avatar';
import { useAuthStore } from '../../store/useAuthStore';
import { useCoupleStore } from '../../store/useCoupleStore';
import { usePresenceStore } from '../../store/usePresenceStore';
import { daysTogether, togetherSummary, upcomingDates, parseLocalDate, MOODS, moodLabel } from '../../utils/couple';

export const cardClass =
  'rounded-3xl bg-white/85 dark:bg-[#1E1D24]/85 backdrop-blur border border-rose-100/80 dark:border-stone-800 shadow-soft';

function useCouple() {
  const me = useAuthStore((s) => s.user);
  const partner = useAuthStore((s) => s.getPartnerProfile());
  const partnerName = me?.nickname || partner.display_name;
  return { me, partner, partnerName };
}

function formatDate(iso: string): string {
  const d = parseLocalDate(iso);
  return d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

/* ── Two avatars, a beating heart and the days-together counter ── */
export const CoupleHero: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { me, partner, partnerName } = useCouple();
  const online = usePresenceStore((s) => s.partnerPresence.online);
  const startedOn = useCoupleStore((s) => s.startedOn);
  const setStartedOn = useCoupleStore((s) => s.setStartedOn);
  const loaded = useCoupleStore((s) => s.loaded);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(startedOn);
  const days = daysTogether(startedOn);

  const save = async () => {
    if (parseLocalDate(draft)) await setStartedOn(draft);
    setEditing(false);
  };

  return (
    <div className={`${cardClass} relative overflow-hidden ${compact ? 'p-4' : 'p-6'} text-center`}>
      <div className="absolute -top-16 -right-10 w-48 h-48 rounded-full bg-rose-200/40 dark:bg-rose-900/20 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-10 w-48 h-48 rounded-full bg-violet-200/40 dark:bg-violet-900/20 blur-2xl pointer-events-none" />

      <div className="relative flex items-center justify-center gap-3">
        <div className="relative">
          <Avatar src={me?.avatar_url} name={me?.display_name} size={compact ? 'lg' : 'xl'} />
          {me?.mood && <span className="absolute -bottom-1 -right-1 text-xl drop-shadow">{me.mood}</span>}
        </div>
        <Heart className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} text-[#E05A74] fill-[#E05A74] animate-heartbeat`} />
        <div className="relative">
          <Avatar src={partner.avatar_url} name={partnerName} size={compact ? 'lg' : 'xl'} isOnline={online} />
          {partner.mood && <span className="absolute -bottom-1 -left-1 text-xl drop-shadow">{partner.mood}</span>}
        </div>
      </div>

      <p className="relative mt-3 text-sm font-semibold text-stone-500 dark:text-stone-400">
        {me?.display_name} <span className="text-[#E05A74]">&</span> {partnerName}
      </p>

      {editing ? (
        <div className="relative mt-3 flex items-center justify-center gap-2">
          <input
            type="date"
            value={draft}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDraft(e.target.value)}
            className="rounded-full border border-rose-200 dark:border-stone-700 bg-white dark:bg-[#16151A] px-4 py-2 text-sm"
          />
          <button onClick={save} aria-label="Save date" className="w-9 h-9 rounded-full bg-[#E05A74] text-white flex items-center justify-center">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={() => setEditing(false)} aria-label="Cancel" className="w-9 h-9 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : days !== null ? (
        <div className="relative mt-2">
          <p className={`font-cute font-semibold text-[#E05A74] leading-none ${compact ? 'text-4xl' : 'text-6xl'}`}>
            {days.toLocaleString()}
          </p>
          <p className="font-cute text-base font-medium text-stone-700 dark:text-stone-200 mt-1">days together 💞</p>
          <button
            onClick={() => { setDraft(startedOn); setEditing(true); }}
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-[#E05A74]"
          >
            {togetherSummary(startedOn)} · since {formatDate(startedOn)} <Pencil className="w-3 h-3" />
          </button>
        </div>
      ) : (
        loaded && (
          <button
            onClick={() => { setDraft(''); setEditing(true); }}
            className="relative mt-3 inline-flex items-center gap-2 rounded-full bg-[#E05A74] text-white px-4 py-2 text-sm font-semibold"
          >
            <CalendarHeart className="w-4 h-4" /> When did you get together?
          </button>
        )
      )}
    </div>
  );
};

/* ── Moods ── */
export const MoodCard: React.FC = () => {
  const { me, partner, partnerName } = useCouple();
  const setMood = useCoupleStore((s) => s.setMood);

  return (
    <div className={`${cardClass} p-4`}>
      <h3 className="font-cute text-base font-semibold text-stone-800 dark:text-stone-100 mb-3">Moods</h3>
      <div className="flex items-center gap-3 mb-3 rounded-2xl bg-rose-50/70 dark:bg-stone-800/50 px-3 py-2.5">
        <span className="text-2xl">{partner.mood || '🤍'}</span>
        <p className="text-sm text-stone-600 dark:text-stone-300">
          <span className="font-semibold text-stone-800 dark:text-stone-100">{partnerName}</span>{' '}
          {partner.mood ? `is feeling ${moodLabel(partner.mood).toLowerCase() || partner.mood}` : "hasn't set a mood yet"}
        </p>
      </div>
      <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-2">How are you feeling?</p>
      <div className="grid grid-cols-5 gap-2">
        {MOODS.map((m) => (
          <button
            key={m.emoji}
            onClick={() => setMood(me?.mood === m.emoji ? '' : m.emoji)}
            title={m.label}
            aria-label={m.label}
            aria-pressed={me?.mood === m.emoji}
            className={`h-11 rounded-2xl text-xl transition-all active:scale-90 ${
              me?.mood === m.emoji
                ? 'bg-[#E05A74]/15 ring-2 ring-[#E05A74] scale-105'
                : 'bg-stone-50 dark:bg-stone-800/60 hover:bg-rose-50 dark:hover:bg-stone-700'
            }`}
          >
            {m.emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

/* ── Special dates ── */
export const SpecialDatesCard: React.FC<{ limit?: number }> = ({ limit }) => {
  const dates = useCoupleStore((s) => s.specialDates);
  const startedOn = useCoupleStore((s) => s.startedOn);
  const addSpecialDate = useCoupleStore((s) => s.addSpecialDate);
  const removeSpecialDate = useCoupleStore((s) => s.removeSpecialDate);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  const upcoming = useMemo(() => upcomingDates(dates, startedOn), [dates, startedOn]);
  const shown = limit ? upcoming.slice(0, limit) : upcoming;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !parseLocalDate(date)) return;
    setSaving(true);
    try {
      await addSpecialDate(title.trim(), date);
      setTitle('');
      setDate('');
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${cardClass} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-cute text-base font-semibold text-stone-800 dark:text-stone-100">Special dates</h3>
        {!limit && (
          <button
            onClick={() => setAdding((a) => !a)}
            aria-label="Add a special date"
            className="w-8 h-8 rounded-full bg-[#E05A74]/10 text-[#E05A74] flex items-center justify-center hover:bg-[#E05A74]/20"
          >
            {adding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={save} className="flex flex-col sm:flex-row gap-2 mb-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="First date, her birthday…"
            maxLength={60}
            className="flex-1 min-w-0 rounded-full border border-rose-200 dark:border-stone-700 bg-white dark:bg-[#16151A] px-4 py-2 text-sm"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-full border border-rose-200 dark:border-stone-700 bg-white dark:bg-[#16151A] px-4 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving || !title.trim() || !date}
            className="rounded-full bg-[#E05A74] text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Save
          </button>
        </form>
      )}

      {shown.length === 0 ? (
        <p className="text-sm text-stone-400 py-2">Add birthdays, your first date and other days to remember 💝</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-2xl bg-stone-50/80 dark:bg-stone-800/50 px-3 py-2.5">
              <div
                className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 ${
                  d.inDays === 0 ? 'bg-[#E05A74] text-white' : 'bg-white dark:bg-[#16151A] text-[#E05A74]'
                }`}
              >
                <span className="font-cute text-lg font-semibold leading-none">{d.inDays === 0 ? '🎉' : d.inDays}</span>
                {d.inDays !== 0 && <span className="text-[9px] font-semibold">{d.inDays === 1 ? 'day' : 'days'}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">
                  {d.title}
                  {d.years > 0 && d.id === 'anniversary' ? ` · ${d.years} year${d.years > 1 ? 's' : ''}` : ''}
                </p>
                <p className="text-xs text-stone-400">
                  {d.inDays === 0 ? 'Today!' : d.inDays === 1 ? 'Tomorrow' : `in ${d.inDays} days`} · {formatDate(d.date)}
                </p>
              </div>
              {!limit && d.id !== 'anniversary' && (
                <button
                  onClick={() => removeSpecialDate(d.id)}
                  aria-label={`Remove ${d.title}`}
                  className="p-2 rounded-full text-stone-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-stone-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {limit && upcoming.length > 0 && (
        <Link to="/us" className="block text-center text-xs font-semibold text-[#E05A74] mt-3">
          See all dates
        </Link>
      )}
    </div>
  );
};

/* ── Love tap button with today's counts ── */
export const LoveTapCard: React.FC = () => {
  const { me, partnerName } = useCouple();
  const taps = useCoupleStore((s) => s.taps);
  const sendLove = useCoupleStore((s) => s.sendLove);
  const today = new Date().toDateString();
  const todays = taps.filter((t) => new Date(t.created_at).toDateString() === today);
  const todaysTaps = todays.filter((t) => t.kind === 'tap');
  const sent = todaysTaps.filter((t) => t.sender_id === me?.id).length;
  const received = todaysTaps.length - sent;
  const hugs = todays.length - todaysTaps.length;

  return (
    <div className={`${cardClass} p-4 flex items-center gap-4`}>
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={() => sendLove('tap')}
        aria-label="Send a love tap"
        className="w-16 h-16 rounded-full bg-gradient-to-br from-[#F27A93] to-[#E05A74] text-white flex items-center justify-center shadow-rose-glow flex-shrink-0"
      >
        <Heart className="w-8 h-8 fill-white" />
      </motion.button>
      <div className="min-w-0">
        <p className="font-cute text-base font-semibold text-stone-800 dark:text-stone-100">Send a love tap</p>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          Today: {sent} sent · {received} from {partnerName}
          {hugs > 0 && ` · ${hugs} hug${hugs > 1 ? 's' : ''} 🤗`}
        </p>
        <Link to="/love" className="text-xs font-semibold text-[#E05A74]">
          Hold hands for a hug →
        </Link>
      </div>
    </div>
  );
};

/* ── Everything together ── */
export const UsDashboard: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <div className="flex flex-col gap-4">
    <CoupleHero compact={compact} />
    <LoveTapCard />
    {!compact && <MoodCard />}
    <SpecialDatesCard limit={compact ? 3 : undefined} />
  </div>
);
