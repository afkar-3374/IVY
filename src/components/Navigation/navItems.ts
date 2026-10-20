import { Heart, MessageCircle, HandHeart, Search, Settings, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/us', label: 'Us', icon: Heart },
  { to: '/chat', label: 'Chat', icon: MessageCircle },
  { to: '/love', label: 'Hug', icon: HandHeart },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/settings', label: 'Settings', icon: Settings },
];
