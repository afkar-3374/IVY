import { supabase } from './supabaseClient';
import { logger } from './logger/logger';
import { seal, open } from './crypto/coupleCrypto';

export interface SpecialDate {
  id: string;
  title: string;
  /** ISO date (YYYY-MM-DD); repeats every year */
  date: string;
  created_by: string;
}

export interface LoveTap {
  id: string;
  sender_id: string;
  kind: 'tap' | 'hug';
  created_at: string;
}

export type HugSignal = { userId: string; holding: boolean };

class CoupleService {
  async getStartedOn(): Promise<string> {
    if (!supabase) return '';
    const { data, error } = await supabase.from('couple').select('started_on').eq('id', 1).single();
    if (error) {
      logger.error('Unable to load couple info:', error.message);
      return '';
    }
    return open(data?.started_on || '');
  }

  async setStartedOn(date: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('couple')
      .update({ started_on: await seal(date), updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) throw new Error(error.message);
  }

  async getSpecialDates(): Promise<SpecialDate[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.from('special_dates').select('*').order('created_at');
    if (error) {
      logger.error('Unable to load special dates:', error.message);
      return [];
    }
    return Promise.all(
      (data || []).map(async (row) => ({ ...row, title: await open(row.title), date: await open(row.date) }))
    );
  }

  async addSpecialDate(title: string, date: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('special_dates').insert({ title: await seal(title), date: await seal(date) });
    if (error) throw new Error(error.message);
  }

  async removeSpecialDate(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('special_dates').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async setMood(userId: string, mood: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('profiles').update({ mood: await seal(mood) }).eq('id', userId);
    if (error) throw new Error(error.message);
  }

  /** Love taps and hugs from the last `days` days. */
  async getRecentTaps(days = 30): Promise<LoveTap[]> {
    if (!supabase) return [];
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from('love_taps')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    if (error) {
      logger.error('Unable to load love taps:', error.message);
      return [];
    }
    return data as LoveTap[];
  }

  async sendLove(kind: LoveTap['kind']): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('love_taps').insert({ kind });
    if (error) throw new Error(error.message);
  }

  /** Live updates for taps, dates and the start date. */
  subscribe(handlers: { onTap: (tap: LoveTap) => void; onDatesChanged: () => void; onCoupleChanged: () => void }): () => void {
    if (!supabase) return () => {};
    const client = supabase;
    const channel = client
      .channel('ivy_couple_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'love_taps' }, (payload) =>
        handlers.onTap(payload.new as LoveTap)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_dates' }, () => handlers.onDatesChanged())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'couple' }, () => handlers.onCoupleChanged())
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }

  /**
   * Private live channel for the hold-to-hug screen: each side broadcasts whether its
   * thumb is down. Returns a sender and a cleanup function.
   */
  joinHugRoom(onSignal: (signal: HugSignal) => void): { send: (signal: HugSignal) => void; leave: () => void } {
    if (!supabase) return { send: () => {}, leave: () => {} };
    const client = supabase;
    const channel = client.channel('ivy_hug_room', { config: { private: true, broadcast: { self: false } } });
    channel.on('broadcast', { event: 'hold' }, ({ payload }) => onSignal(payload as HugSignal)).subscribe();
    return {
      send: (signal) => {
        void channel.send({ type: 'broadcast', event: 'hold', payload: signal });
      },
      leave: () => {
        client.removeChannel(channel);
      },
    };
  }
}

export const coupleService = new CoupleService();
