/**
 * Computes SHA-256 hash of a string using Web Crypto API.
 * Ensures Login IDs are never stored or transmitted in plain text.
 */
export async function hashLoginId(loginId: string): Promise<string> {
  const cleanId = loginId.trim();
  const msgUint8 = new TextEncoder().encode(cleanId);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Pre-computed SHA-256 hashes for predefined couple users:
 * - User 1 (Afkar): "220609" -> "75c87e7f781db197d10006764516e87f174db9675317424683a9108c48a7ebdf"
 * - User 2 (Princess): "030309" -> "05c2a1e6ec0f80509a25b138612140a3ec6370bb073f47e30d170f2095f9c5d0"
 */
export const PREDEFINED_HASHES = {
  USER_1: '75c87e7f781db197d10006764516e87f174db9675317424683a9108c48a7ebdf', // ID: 220609
  USER_2: '05c2a1e6ec0f80509a25b138612140a3ec6370bb073f47e30d170f2095f9c5d0', // ID: 030309
};
