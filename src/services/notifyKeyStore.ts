// Shared with the service worker (public/push-handler.js reads the same database), so a
// notification can say who wrote and what — decrypted on this device, even when Ivy is closed.
const DB_NAME = 'ivy-notify';
const STORE = 'kv';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => void): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function get<T>(key: string): Promise<T | undefined> {
  let value: T | undefined;
  await run('readonly', (store) => {
    const req = store.get(key);
    req.onsuccess = () => (value = req.result as T | undefined);
  });
  return value;
}

export const notifyKeyStore = {
  /** The couple key stays non-extractable: the worker can decrypt with it, nobody can read it out. */
  async remember(key: CryptoKey, userId: string): Promise<void> {
    try {
      await run('readwrite', (store) => {
        store.put(key, 'coupleKey');
        store.put(userId, 'userId');
      });
    } catch {
      /* storage unavailable: notifications fall back to "New message" */
    }
  },

  async forget(): Promise<void> {
    try {
      await run('readwrite', (store) => {
        store.delete('coupleKey');
        store.delete('userId');
      });
    } catch {
      /* storage unavailable */
    }
  },

  async getShowText(): Promise<boolean> {
    try {
      return (await get<boolean>('showText')) !== false;
    } catch {
      return true;
    }
  },

  async setShowText(show: boolean): Promise<void> {
    try {
      await run('readwrite', (store) => store.put(show, 'showText'));
    } catch {
      /* storage unavailable */
    }
  },
};
