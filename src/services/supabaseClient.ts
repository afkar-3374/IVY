import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger/logger';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'YOUR_SUPABASE_URL') {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
    logger.info('Supabase client initialized successfully with live URL');
  } catch (err) {
    logger.error('Failed to initialize Supabase client:', err);
  }
} else {
  logger.info('Running in dual local-fallback engine mode (No valid VITE_SUPABASE_URL in .env)');
}
