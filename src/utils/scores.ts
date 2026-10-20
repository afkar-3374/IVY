import type { PointRow, PointSource } from '../services/gameService';
import { todayKey } from '../data/gameQuestions';

const DAY_MS = 86_400_000;

/** Monday 00:00 (local) of the week containing `d`. */
export function weekStart(d = new Date()): Date {
  const day = (d.getDay() + 6) % 7; // Monday = 0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
}

export function sumBy(rows: PointRow[], userId?: string): number {
  return rows.reduce((t, r) => (userId && r.user_id !== userId ? t : t + r.points), 0);
}

export function inRange(rows: PointRow[], from: Date, to?: Date): PointRow[] {
  return rows.filter((r) => {
    const t = new Date(r.created_at).getTime();
    return t >= from.getTime() && (!to || t < to.getTime());
  });
}

export interface WeeklyBoard {
  me: number;
  partner: number;
  bySource: Record<PointSource, number>;
  lastWeek: { me: number; partner: number };
}

export function weeklyBoard(rows: PointRow[], me: string, partner: string, now = new Date()): WeeklyBoard {
  const start = weekStart(now);
  const lastStart = new Date(start.getTime() - 7 * DAY_MS);
  const thisWeek = inRange(rows, start);
  const lastWeek = inRange(rows, lastStart, start);
  const bySource = {} as Record<PointSource, number>;
  for (const r of thisWeek) bySource[r.source] = (bySource[r.source] || 0) + r.points;
  return {
    me: sumBy(thisWeek, me),
    partner: sumBy(thisWeek, partner),
    bySource,
    lastWeek: { me: sumBy(lastWeek, me), partner: sumBy(lastWeek, partner) },
  };
}

/** Consecutive days (ending today, or yesterday if today isn't done yet) where both earned points. */
export function coupleStreak(rows: PointRow[], me: string, partner: string, now = new Date()): number {
  const days = new Map<string, Set<string>>();
  for (const r of rows) {
    const key = new Date(r.created_at).toDateString();
    if (!days.has(key)) days.set(key, new Set());
    days.get(key)!.add(r.user_id);
  }
  const both = (d: Date) => {
    const s = days.get(d.toDateString());
    return Boolean(s && s.has(me) && s.has(partner));
  };
  let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!both(cursor)) cursor = new Date(cursor.getTime() - DAY_MS);
  let streak = 0;
  while (both(cursor)) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}

/** Days in a row (ending today, or yesterday if today isn't done yet) that you both watered the garden. */
export function wateringStreak(rows: PointRow[], me: string, partner: string, now = new Date()): number {
  const watered = new Set(rows.filter((r) => r.ref.startsWith('garden:')).map((r) => `${r.user_id}|${r.ref}`));
  const both = (d: Date) => watered.has(`${me}|garden:${todayKey(d)}`) && watered.has(`${partner}|garden:${todayKey(d)}`);
  let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  if (!both(cursor)) cursor = new Date(cursor.getTime() - DAY_MS);
  let streak = 0;
  while (both(cursor)) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}

export const SOURCE_LABELS: Record<PointSource, string> = {
  tap: '💗 Love taps',
  hug: '🤗 Hugs',
  daily_question: '💭 Daily question',
  know_me: '🧠 Know me', // retired game, kept for old points
  would_you_rather: '🤔 Would you rather',
  tic_tac_toe: '❤️ Tic-tac-toe',
  garden: '🌱 Garden care',
};

/* ── Garden growth ── */
export interface GardenLevel {
  level: number;
  name: string;
  min: number;
}

export const GARDEN_LEVELS: GardenLevel[] = [
  { level: 1, name: 'A tiny seed', min: 0 },
  { level: 2, name: 'First sprout', min: 40 },
  { level: 3, name: 'Little buds', min: 120 },
  { level: 4, name: 'First blooms', min: 250 },
  { level: 5, name: 'Flower patch', min: 450 },
  { level: 6, name: 'Rose garden', min: 750 },
  { level: 7, name: 'Garden of hearts', min: 1200 },
  { level: 8, name: 'Enchanted garden', min: 2000 },
  { level: 9, name: 'Forever garden', min: 3500 },
];

export function gardenLevel(total: number): { current: GardenLevel; next: GardenLevel | null; progress: number } {
  let i = GARDEN_LEVELS.length - 1;
  while (i > 0 && total < GARDEN_LEVELS[i].min) i -= 1;
  const current = GARDEN_LEVELS[i];
  const next = GARDEN_LEVELS[i + 1] || null;
  const progress = next ? (total - current.min) / (next.min - current.min) : 1;
  return { current, next, progress };
}
