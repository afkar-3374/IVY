import type { SpecialDate } from '../services/coupleService';

const DAY_MS = 86_400_000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Parse YYYY-MM-DD as a local date (not UTC). */
export function parseLocalDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Day 1 is the day you got together. */
export function daysTogether(startedOn: string, now = new Date()): number | null {
  const start = parseLocalDate(startedOn);
  if (!start) return null;
  return Math.floor((startOfDay(now).getTime() - start.getTime()) / DAY_MS) + 1;
}

/** Days until the next yearly occurrence of a date (0 = today). */
export function daysUntilYearly(iso: string, now = new Date()): number | null {
  const d = parseLocalDate(iso);
  if (!d) return null;
  const today = startOfDay(now);
  let next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
  return Math.round((next.getTime() - today.getTime()) / DAY_MS);
}

export interface UpcomingDate {
  id: string;
  title: string;
  date: string;
  inDays: number;
  /** Years since the original date, on its next occurrence */
  years: number;
}

/** Special dates plus the anniversary, soonest first. */
export function upcomingDates(dates: SpecialDate[], startedOn: string, now = new Date()): UpcomingDate[] {
  const list: UpcomingDate[] = [];
  const add = (id: string, title: string, date: string) => {
    const inDays = daysUntilYearly(date, now);
    const d = parseLocalDate(date);
    if (inDays === null || !d) return;
    const nextYear = new Date(now.getTime() + inDays * DAY_MS).getFullYear();
    list.push({ id, title, date, inDays, years: nextYear - d.getFullYear() });
  };
  if (startedOn) add('anniversary', 'Our anniversary', startedOn);
  dates.forEach((d) => add(d.id, d.title, d.date));
  return list.sort((a, b) => a.inDays - b.inDays);
}

/** "1 year, 2 months" style summary of time together. */
export function togetherSummary(startedOn: string, now = new Date()): string {
  const start = parseLocalDate(startedOn);
  if (!start) return '';
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  const years = Math.floor(months / 12);
  months %= 12;
  const parts = [];
  if (years) parts.push(`${years} year${years > 1 ? 's' : ''}`);
  if (months) parts.push(`${months} month${months > 1 ? 's' : ''}`);
  return parts.join(', ') || 'Just getting started';
}

export const MOODS = [
  { emoji: '😊', label: 'Happy' },
  { emoji: '🥰', label: 'In love' },
  { emoji: '🥺', label: 'Missing you' },
  { emoji: '😴', label: 'Sleepy' },
  { emoji: '📚', label: 'Busy' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '😤', label: 'Grumpy' },
  { emoji: '🤒', label: 'Unwell' },
  { emoji: '🍕', label: 'Hungry' },
  { emoji: '🎉', label: 'Excited' },
];

export function moodLabel(emoji: string): string {
  return MOODS.find((m) => m.emoji === emoji)?.label || '';
}
