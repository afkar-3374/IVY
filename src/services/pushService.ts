import { supabase } from './supabaseClient';
import { logger } from './logger/logger';
import { usePresenceStore } from '../store/usePresenceStore';

export type PushKind = 'message' | 'call' | 'tap' | 'hug' | 'game';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Throttle repeated pushes of the same kind (e.g. a burst of messages). */
const lastSent = new Map<PushKind, number>();
const THROTTLE_MS: Record<PushKind, number> = { message: 20_000, call: 0, tap: 30_000, hug: 30_000, game: 20_000 };

class PushService {
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && Boolean(VAPID_PUBLIC_KEY);
  }

  /** iOS only allows web push once Ivy is added to the home screen. */
  needsInstall(): boolean {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;
    return ios && !standalone;
  }

  async getSubscription(): Promise<PushSubscription | null> {
    if (!this.isSupported()) return null;
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? reg.pushManager.getSubscription() : null;
  }

  async isEnabled(): Promise<boolean> {
    return typeof Notification !== 'undefined' && Notification.permission === 'granted' && Boolean(await this.getSubscription());
  }

  /** Ask permission (must follow a tap), subscribe this device and save it. */
  async enable(): Promise<'enabled' | 'denied' | 'unsupported' | 'error'> {
    if (!this.isSupported() || !supabase) return 'unsupported';
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return 'denied';
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) }));
      await this.save(sub);
      return 'enabled';
    } catch (err) {
      logger.error('Unable to enable push:', err);
      return 'error';
    }
  }

  async disable(): Promise<void> {
    const sub = await this.getSubscription();
    if (!sub) return;
    if (supabase) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }

  /** Keep the saved subscription current (it can change, or belong to the other partner after switching). */
  async refresh(): Promise<void> {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const sub = await this.getSubscription();
    if (sub) await this.save(sub);
  }

  private async save(sub: PushSubscription): Promise<void> {
    if (!supabase) return;
    const json = sub.toJSON();
    // A device belongs to whoever is signed in on it now
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    const { error } = await supabase
      .from('push_subscriptions')
      .insert({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth });
    if (error) logger.error('Unable to save push subscription:', error.message);
  }

  /**
   * Notify the partner's closed/background devices. Skipped while they are online in
   * Ivy (they already get it live), except calls, which always ring.
   */
  async notifyPartner(kind: PushKind): Promise<void> {
    if (!supabase) return;
    if (kind !== 'call' && usePresenceStore.getState().partnerPresence.online) return;
    const now = Date.now();
    if (now - (lastSent.get(kind) || 0) < THROTTLE_MS[kind]) return;
    lastSent.set(kind, now);
    const { error } = await supabase.functions.invoke('send-push', { body: { kind } });
    if (error) logger.warn('Push not sent:', error.message);
  }
}

export const pushService = new PushService();
