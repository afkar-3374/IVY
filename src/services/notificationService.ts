import { logger } from './logger/logger';
import type { MessageType } from '../types';

/* ──────────────────────────────────────────────────────────────────
   IVY NOTIFICATION SERVICE
   – Browser Notification API with deduplication
   – Web Audio API chime (no audio file dependency)
   – Navigator Badge API (Chrome 81+ desktop / some Android)
   – Do Not Disturb mode
   – Granular preferences (messages, calls, sound, vibration)
   ────────────────────────────────────────────────────────────────── */

export interface NotificationPreferences {
  enabled: boolean;
  messages: boolean;
  calls: boolean;
  sound: boolean;
  vibration: boolean;
  dnd: boolean;
}

class NotificationService {
  private permissionState: NotificationPermission = 'default';
  private sentIds = new Set<string>(); // Deduplication
  private audioCtx: AudioContext | null = null;
  private prefs: NotificationPreferences = {
    enabled: true,
    messages: true,
    calls: true,
    sound: true,
    vibration: true,
    dnd: false,
  };

  /* ── Permission ────────────────────────────────────────────────── */
  async requestPermission(): Promise<boolean> {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') {
      this.permissionState = 'granted';
      return true;
    }
    if (Notification.permission === 'denied') {
      this.permissionState = 'denied';
      return false;
    }
    try {
      const result = await Notification.requestPermission();
      this.permissionState = result;
      logger.info('Notification permission:', result);
      return result === 'granted';
    } catch (err) {
      logger.warn('Notification permission request failed:', err);
      return false;
    }
  }

  /* ── Update preferences ────────────────────────────────────────── */
  updatePreferences(prefs: Partial<NotificationPreferences>): void {
    this.prefs = { ...this.prefs, ...prefs };
  }

  /* ── Core notify ───────────────────────────────────────────────── */
  private show(
    title: string,
    body: string,
    options: NotificationOptions & { dedupeKey?: string; onClick?: () => void } = {}
  ): void {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    if (this.prefs.dnd) return;
    if (!this.prefs.enabled) return;

    // Skip if tab is focused
    if (document.hasFocus() && document.visibilityState === 'visible') return;

    // Deduplication
    const key = options.dedupeKey || `${title}-${body}`;
    if (this.sentIds.has(key)) return;
    this.sentIds.add(key);

    // Auto-clear from dedup set after 30 s
    setTimeout(() => this.sentIds.delete(key), 30_000);

    const { dedupeKey: _dk, onClick, ...notifOptions } = options;

    try {
      const notif = new Notification(title, {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        silent: true, // we play our own sound
        tag: key,
        ...notifOptions,
        body,
      });

      if (onClick) {
        notif.onclick = (e) => {
          e.preventDefault();
          window.focus();
          onClick();
          notif.close();
        };
      } else {
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      }
    } catch (err) {
      logger.warn('Failed to show notification:', err);
    }
  }

  /* ── Message notification ──────────────────────────────────────── */
  notifyNewMessage(
    messageId: string,
    partnerName: string,
    body: string,
    messageType: MessageType = 'text'
  ): void {
    if (!this.prefs.messages) return;

    const typeLabel: Record<string, string> = {
      image: '📷 Photo',
      video: '🎥 Video',
      voice: '🎤 Voice note',
      document: '📄 Document',
      file: '📎 File',
      audio: '🎵 Audio',
    };

    const displayBody = typeLabel[messageType] ?? body;

    this.show(`❤️ ${partnerName}`, displayBody, {
      dedupeKey: messageId,
      onClick: () => {
        window.location.hash = '';
        window.dispatchEvent(new CustomEvent('ivy:notification-click', { detail: { messageId } }));
      },
    });

    if (this.prefs.sound) this.playChime('message');
    if (this.prefs.vibration && navigator.vibrate) navigator.vibrate([100, 50, 80]);
  }

  /* ── Call notification ─────────────────────────────────────────── */
  notifyIncomingCall(callType: 'audio' | 'video', partnerName: string): void {
    if (!this.prefs.calls) return;

    const icon = callType === 'video' ? '📹' : '📞';
    this.show(`${icon} Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`, partnerName, {
      dedupeKey: `incoming-call-${Date.now()}`,
      requireInteraction: true,
    });

    if (this.prefs.sound) this.playChime('call');
    if (this.prefs.vibration && navigator.vibrate) navigator.vibrate([300, 200, 300, 200, 300]);
  }

  /* ── Missed call notification ──────────────────────────────────── */
  notifyMissedCall(callType: 'audio' | 'video', partnerName: string): void {
    if (!this.prefs.calls) return;

    const icon = callType === 'video' ? '📹' : '📞';
    this.show(`${icon} Missed ${callType === 'video' ? 'Video' : 'Voice'} Call`, `${partnerName} called`, {
      dedupeKey: `missed-call-${Date.now()}`,
    });
  }

  /* ── Web Audio chime (no file dependency) ──────────────────────── */
  playChime(type: 'message' | 'call' = 'message'): void {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = this.audioCtx;

      const playTone = (freq: number, startTime: number, duration: number, gain: number) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      if (type === 'message') {
        // Soft two-tone ding
        playTone(880, now, 0.25, 0.12);
        playTone(1108, now + 0.12, 0.25, 0.10);
      } else {
        // Repeating call ring
        playTone(660, now, 0.3, 0.18);
        playTone(880, now + 0.35, 0.3, 0.16);
        playTone(660, now + 0.7, 0.3, 0.18);
      }
    } catch {
      // Audio not available — silently skip
    }
  }

  /* ── Badge API ─────────────────────────────────────────────────── */
  async setBadge(count: number): Promise<void> {
    try {
      if ('setAppBadge' in navigator) {
        if (count > 0) {
          await (navigator as any).setAppBadge(count);
        } else {
          await (navigator as any).clearAppBadge();
        }
      }
    } catch { /* Badge API not available */ }
  }

  async clearBadge(): Promise<void> {
    await this.setBadge(0);
  }

  /* ── DND ───────────────────────────────────────────────────────── */
  setDND(enabled: boolean): void {
    this.prefs.dnd = enabled;
  }
}

export const notificationService = new NotificationService();
