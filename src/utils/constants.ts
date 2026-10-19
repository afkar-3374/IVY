import type { UserProfile } from '../types';

export const USER_1_ID = '11111111-1111-4111-a111-111111111111';
export const USER_2_ID = '22222222-2222-4222-a222-222222222222';

// Sign-in accounts; each partner's PIN is their account password.
export const ACCOUNT_EMAILS = ['afkar@ivy.example.com', 'princess@ivy.example.com'];

export const DEFAULT_USER_1_PROFILE: UserProfile = {
  id: USER_1_ID,
  display_name: 'Afkar',
  nickname: 'My Princess ❤️',
  about: 'Just a boy in love. ❤️',
  avatar_url: '', // User uploads photo directly from device
  wallpaper: 'botanical',
  theme: 'rose',
  created_at: '2025-05-01T00:00:00.000Z',
  updated_at: '2025-05-01T00:00:00.000Z',
};

export const DEFAULT_USER_2_PROFILE: UserProfile = {
  id: USER_2_ID,
  display_name: 'Princess',
  nickname: 'My Hero ❤️',
  about: 'You are my today and all of my tomorrows.',
  avatar_url: '', // User uploads photo directly from device
  wallpaper: 'botanical',
  theme: 'rose',
  created_at: '2025-05-01T00:00:00.000Z',
  updated_at: '2025-05-01T00:00:00.000Z',
};

export const WALLPAPER_PRESETS = [
  { id: 'botanical', name: 'Soft Floral Watermark', bgClass: 'bg-botanical-pattern' },
  { id: 'sunset', name: 'Warm Golden Sunset', bgClass: 'bg-gradient-to-b from-amber-50 to-rose-100' },
  { id: 'starry', name: 'Midnight Starry Dusk', bgClass: 'bg-slate-900' },
  { id: 'minimal', name: 'Minimal Soft Cream', bgClass: 'bg-[#FDF8F6]' },
];

export const QUICK_EMOJIS = ['❤️', '😂', '😍', '👍', '😢', '😮', '😡', '🎉'];
