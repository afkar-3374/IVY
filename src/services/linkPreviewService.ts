import { supabase } from './supabaseClient';
import { logger } from './logger/logger';

export interface LinkPreview {
  title?: string;
  description?: string;
  image?: string;
  site?: string;
}

const CACHE_KEY = 'ivy_link_previews';
const MAX_CACHED = 150;

const memory = new Map<string, LinkPreview>();
const inFlight = new Map<string, Promise<LinkPreview>>();

function loadCache(): Record<string, LinkPreview> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveToCache(url: string, preview: LinkPreview) {
  try {
    const all = loadCache();
    all[url] = preview;
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_CACHED))) delete all[k];
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
}

export const URL_PATTERN = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi;

/** The first link in a message, if any. */
export function firstUrl(text: string): string | null {
  return text.match(URL_PATTERN)?.[0] ?? null;
}

/** Title / description / image for a link (cached on this device). */
export function getLinkPreview(url: string): Promise<LinkPreview> {
  const known = memory.get(url) ?? loadCache()[url];
  if (known) {
    memory.set(url, known);
    return Promise.resolve(known);
  }
  const pending = inFlight.get(url);
  if (pending) return pending;

  const request = (async () => {
    if (!supabase) return {};
    try {
      const { data, error } = await supabase.functions.invoke('link-preview', { body: { url } });
      if (error) throw error;
      const preview = (data || {}) as LinkPreview;
      memory.set(url, preview);
      saveToCache(url, preview);
      return preview;
    } catch (err) {
      logger.warn('Link preview unavailable:', err);
      return {};
    } finally {
      inFlight.delete(url);
    }
  })();
  inFlight.set(url, request);
  return request;
}
