import React from 'react';
import { CheckCheck } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import type { Message } from '../../types';

function when(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })}, ${time}`;
}

/** WhatsApp-style "Message info": when your message was sent, delivered and read. */
export const MessageInfoSheet: React.FC<{ message: Message | null; onClose: () => void }> = ({ message, onClose }) => {
  const isRead = message?.status === 'Read';
  const isDelivered = isRead || message?.status === 'Delivered';
  const rows = [
    { label: 'Read', icon: <CheckCheck className="w-5 h-5 text-[#53bdeb]" />, value: isRead ? when(message?.read_at) : '—' },
    { label: 'Delivered', icon: <CheckCheck className="w-5 h-5 text-[#8696a0]" />, value: isDelivered ? when(message?.delivered_at) : '—' },
    { label: 'Sent', icon: null, value: when(message?.created_at) },
  ];

  return (
    <BottomSheet isOpen={Boolean(message)} onClose={onClose} title="Message info">
      {message && (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-stone-600 dark:text-stone-300 line-clamp-3 italic mb-3">
            {message.message_type === 'text' ? `"${message.content}"` : `${message.message_type[0].toUpperCase()}${message.message_type.slice(1)} message`}
          </p>
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3 py-2.5 border-b border-stone-100 dark:border-stone-800 last:border-0">
              <span className="w-5 flex justify-center">{r.icon}</span>
              <div>
                <p className="text-[15px] font-medium text-stone-800 dark:text-stone-100">{r.label}</p>
                <p className="text-[13px] text-stone-500 dark:text-stone-400">{r.value}</p>
              </div>
            </div>
          ))}
          {isDelivered && !message.delivered_at && (
            <p className="text-[11px] text-stone-400 mt-2">Exact times are recorded for messages from now on.</p>
          )}
        </div>
      )}
    </BottomSheet>
  );
};
