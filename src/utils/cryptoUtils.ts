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
 * - User 1 (Afkar): "220609" -> "0bffe87dfa4bd113259d65cb7182428a8bba979dd60e89b641bcb835a2e1acfa"
 * - User 2 (Princess): "030309" -> "1c5f1257f1b520659769643539651ea62813ca7ca87e567111588e6cd9d6a94c"
 */
export const PREDEFINED_HASHES = {
  USER_1: '0bffe87dfa4bd113259d65cb7182428a8bba979dd60e89b641bcb835a2e1acfa', // ID: 220609
  USER_2: '1c5f1257f1b520659769643539651ea62813ca7ca87e567111588e6cd9d6a94c', // ID: 030309
};
