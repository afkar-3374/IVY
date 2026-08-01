import type { UserProfile } from '../types';

export const USER_1_ID = '11111111-1111-4111-a111-111111111111';
export const USER_2_ID = '22222222-2222-4222-a222-222222222222';

export const DEFAULT_USER_1_PROFILE: UserProfile = {
  id: USER_1_ID,
  login_id_hash: '75c87e7f781db197d10006764516e87f174db9675317424683a9108c48a7ebdf', // SHA-256 of 220609
  display_name: 'Afkar',
  nickname: 'My Princess ❤️',
  about: 'Just a boy in love. ❤️',
  avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
  wallpaper: 'botanical',
  theme: 'rose',
  created_at: '2025-05-01T00:00:00.000Z',
  updated_at: '2025-05-01T00:00:00.000Z',
};

export const DEFAULT_USER_2_PROFILE: UserProfile = {
  id: USER_2_ID,
  login_id_hash: '05c2a1e6ec0f80509a25b138612140a3ec6370bb073f47e30d170f2095f9c5d0', // SHA-256 of 030309
  display_name: 'Princess',
  nickname: 'My Hero ❤️',
  about: 'You are my today and all of my tomorrows.',
  avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
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

export const QUICK_EMOJIS = ['❤️', '😍', '😂', '😮', '😢', '🙏'];
