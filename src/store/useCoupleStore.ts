import { create } from 'zustand';
import { coupleService, type LoveTap, type SpecialDate } from '../services/coupleService';
import { notificationService } from '../services/notificationService';
import { logger } from '../services/logger/logger';
import { upcomingDates } from '../utils/couple';
import { useAuthStore } from './useAuthStore';
import { useUIStore } from './useUIStore';
import { useGameStore } from './useGameStore';
import { todayKey } from '../data/gameQuestions';

interface LoveBurst {
  id: string;
  kind: LoveTap['kind'];
  fromMe: boolean;
}

interface CoupleState {
  startedOn: string;
  specialDates: SpecialDate[];
  taps: LoveTap[];
  /** Latest love tap/hug to celebrate on screen */
  burst: LoveBurst | null;
  loaded: boolean;
  /** True while the hold-to-hug screen is open (it celebrates hugs itself) */
  inHugRoom: boolean;
  setInHugRoom: (value: boolean) => void;
  init: () => () => void;
  reload: () => Promise<void>;
  setStartedOn: (date: string) => Promise<void>;
  addSpecialDate: (title: string, date: string) => Promise<void>;
  removeSpecialDate: (id: string) => Promise<void>;
  setMood: (mood: string) => Promise<void>;
  sendLove: (kind?: LoveTap['kind']) => Promise<void>;
  clearBurst: () => void;
}

const REMINDER_KEY = 'ivy_date_reminders_shown';

/** Show each special date reminder once on its day. */
function remindAboutToday(dates: SpecialDate[], startedOn: string) {
  const today = new Date().toISOString().slice(0, 10);
  let shown: string[] = [];
  try {
    shown = JSON.parse(localStorage.getItem(REMINDER_KEY) || '[]');
  } catch {
    /* storage unavailable */
  }
  const due = upcomingDates(dates, startedOn).filter((d) => d.inDays === 0 && !shown.includes(`${today}:${d.id}`));
  for (const d of due) {
    const text = d.id === 'anniversary' ? `Happy ${d.years ? `${d.years}-year ` : ''}anniversary! 💞` : `Today: ${d.title} 💝`;
    useUIStore.getState().addToast(text, 'success');
    void notificationService.notifyNewMessage(`date-${today}-${d.id}`, 'Ivy', text, 'system');
    shown.push(`${today}:${d.id}`);
  }
  try {
    localStorage.setItem(REMINDER_KEY, JSON.stringify(shown.slice(-50)));
  } catch {
    /* storage unavailable */
  }
}

export const useCoupleStore = create<CoupleState>((set, get) => ({
  startedOn: '',
  specialDates: [],
  taps: [],
  burst: null,
  loaded: false,
  inHugRoom: false,
  setInHugRoom: (value) => set({ inHugRoom: value }),

  init: () => {
    void get().reload();
    return coupleService.subscribe({
      onTap: (tap) => {
        const me = useAuthStore.getState().user?.id;
        set((s) => ({
          taps: s.taps.some((t) => t.id === tap.id) ? s.taps : [tap, ...s.taps],
          burst:
            tap.sender_id === me || (tap.kind === 'hug' && s.inHugRoom)
              ? s.burst
              : { id: tap.id, kind: tap.kind, fromMe: false },
        }));
        if (tap.sender_id !== me) {
          navigator.vibrate?.(tap.kind === 'hug' ? [80, 60, 80, 60, 200] : [60, 40, 60]);
          if (document.hidden) {
            void notificationService.notifyNewMessage(
              tap.id,
              'Ivy',
              tap.kind === 'hug' ? 'You got a hug 🤗' : 'Thinking of you 💗',
              'system'
            );
          }
        }
      },
      onDatesChanged: async () => set({ specialDates: await coupleService.getSpecialDates() }),
      onCoupleChanged: async () => set({ startedOn: await coupleService.getStartedOn() }),
    });
  },

  reload: async () => {
    const [startedOn, specialDates, taps] = await Promise.all([
      coupleService.getStartedOn(),
      coupleService.getSpecialDates(),
      coupleService.getRecentTaps(),
    ]);
    set({ startedOn, specialDates, taps, loaded: true });
    remindAboutToday(specialDates, startedOn);
  },

  setStartedOn: async (date) => {
    set({ startedOn: date });
    await coupleService.setStartedOn(date);
  },

  addSpecialDate: async (title, date) => {
    await coupleService.addSpecialDate(title, date);
    set({ specialDates: await coupleService.getSpecialDates() });
  },

  removeSpecialDate: async (id) => {
    set((s) => ({ specialDates: s.specialDates.filter((d) => d.id !== id) }));
    await coupleService.removeSpecialDate(id);
  },

  setMood: async (mood) => {
    const auth = useAuthStore.getState();
    const me = auth.user;
    if (!me) return;
    useAuthStore.setState({ user: { ...me, mood } });
    try {
      await coupleService.setMood(me.id, mood);
    } catch (err) {
      logger.error('Unable to save mood:', err);
      useUIStore.getState().addToast('Could not save your mood', 'error');
    }
  },

  sendLove: async (kind = 'tap') => {
    const id = `local-${Date.now()}`;
    set({ burst: { id, kind, fromMe: true } });
    navigator.vibrate?.(30);
    try {
      await coupleService.sendLove(kind);
      if (kind === 'tap') {
        // 1 point per love tap, up to 10 a day
        const me = useAuthStore.getState().user?.id;
        const today = todayKey();
        const earned = useGameStore
          .getState()
          .points.filter((p) => p.user_id === me && p.source === 'tap' && p.ref.startsWith(`tap:${today}:`)).length;
        if (earned < 10) void useGameStore.getState().award('tap', 1, `tap:${today}:${earned + 1}`);
      }
    } catch (err) {
      logger.error('Unable to send love:', err);
      useUIStore.getState().addToast('Love tap not sent — check your connection', 'error');
    }
  },

  clearBurst: () => set({ burst: null }),
}));
