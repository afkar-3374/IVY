import { supabase } from '../supabaseClient';
import { logger } from '../logger/logger';

/**
 * End-to-end encryption for the couple.
 *
 * A single random AES-256-GCM "couple key" encrypts everything. Each partner's
 * account stores its own copy of that key, wrapped with a key derived (PBKDF2)
 * from their login PIN. The server only ever sees ciphertext.
 *
 * Sealed formats:
 *   enc1:<iv>:<ciphertext>     small payloads, stored inline in the row
 *   encf1:<storage path>       large payloads, encrypted blob in the private bucket
 */

export interface KeyVaultRow {
  salt: string;
  iv: string;
  wrapped_key: string;
  iterations: number;
}

const INLINE_PREFIX = 'enc1:';
const FILE_PREFIX = 'encf1:';
const BUCKET = 'ivy-media';
const INLINE_LIMIT = 300_000; // characters; bigger payloads go to storage
const VAULT_CACHE_KEY = 'ivy_vault_cache';
export const DECRYPT_FAILED = '🔒 Unable to decrypt this message';

let coupleKey: CryptoKey | null = null;

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Derive the PIN key and unwrap the couple key. Throws if the PIN is wrong. */
export async function unwrapCoupleKey(pin: string, vault: KeyVaultRow): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin.trim()), 'PBKDF2', false, ['deriveKey']);
  const kek = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(vault.salt), iterations: vault.iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(vault.iv) }, kek, fromB64(vault.wrapped_key));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export function setCoupleKey(key: CryptoKey | null): void {
  coupleKey = key;
}

export function hasCoupleKey(): boolean {
  return coupleKey !== null;
}

/** The wrapped vault is cached per device so the lock screen can unlock offline. */
export function cacheVault(userId: string, vault: KeyVaultRow): void {
  try {
    localStorage.setItem(VAULT_CACHE_KEY, JSON.stringify({ userId, vault }));
  } catch {
    /* storage unavailable */
  }
}

export function getCachedVault(): { userId: string; vault: KeyVaultRow } | null {
  try {
    const raw = localStorage.getItem(VAULT_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearCachedVault(): void {
  try {
    localStorage.removeItem(VAULT_CACHE_KEY);
  } catch {
    /* storage unavailable */
  }
}

function requireKey(): CryptoKey {
  if (!coupleKey) throw new Error('Chat is locked');
  return coupleKey;
}

async function encryptBytes(data: Uint8Array<ArrayBuffer>): Promise<{ iv: Uint8Array<ArrayBuffer>; ct: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, requireKey(), data);
  return { iv, ct };
}

async function decryptBytes(iv: Uint8Array<ArrayBuffer>, ct: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, requireKey(), ct);
}

export function isSealed(value: unknown): value is string {
  return typeof value === 'string' && (value.startsWith(INLINE_PREFIX) || value.startsWith(FILE_PREFIX));
}

/** Encrypt a string (text, data URL, ...) for storage on the server. */
export async function seal(plain: string): Promise<string> {
  if (!plain || isSealed(plain)) return plain;
  const { iv, ct } = await encryptBytes(enc.encode(plain));
  const inline = `${INLINE_PREFIX}${toB64(iv)}:${toB64(ct)}`;
  if (inline.length <= INLINE_LIMIT || !supabase) return inline;

  // Large payload: upload the encrypted bytes to the private bucket instead
  const packed = new Uint8Array(iv.length + ct.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(ct), iv.length);
  const path = `m/${crypto.randomUUID()}.bin`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, new Blob([packed], { type: 'application/octet-stream' }), { upsert: false });
  if (error) throw new Error(`Encrypted upload failed: ${error.message}`);
  return `${FILE_PREFIX}${path}`;
}

/** Decrypt a value produced by seal(). Plain (legacy/unencrypted) values pass through. */
export async function open(sealed: string): Promise<string> {
  if (!isSealed(sealed)) return sealed;
  try {
    if (sealed.startsWith(INLINE_PREFIX)) {
      const [ivB64, ctB64] = sealed.slice(INLINE_PREFIX.length).split(':');
      return dec.decode(await decryptBytes(fromB64(ivB64), fromB64(ctB64)));
    }
    if (!supabase) throw new Error('Storage unavailable');
    const path = sealed.slice(FILE_PREFIX.length);
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error || !data) throw new Error(error?.message || 'Download failed');
    const packed = new Uint8Array(await data.arrayBuffer());
    return dec.decode(await decryptBytes(packed.subarray(0, 12), packed.subarray(12)));
  } catch (err) {
    logger.error('Unable to decrypt content:', err);
    return DECRYPT_FAILED;
  }
}
