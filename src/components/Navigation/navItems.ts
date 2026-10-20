import { Heart, MessageCircle, Gamepad2, Flower2, HandHeart, Search, Settings, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the phone tab bar (the desktop sidebar shows everything) */
  mobile: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/us', label: 'Us', icon: Heart, mobile: true },
  { to: '/chat', label: 'Chat', icon: MessageCircle, mobile: true },
  { to: '/play', label: 'Play', icon: Gamepad2, mobile: true },
  { to: '/garden', label: 'Garden', icon: Flower2, mobile: true },
  { to: '/love', label: 'Virtual hug', icon: HandHeart, mobile: false },
  { to: '/search', label: 'Search', icon: Search, mobile: false },
  { to: '/settings', label: 'Settings', icon: Settings, mobile: true },
];
