import { useState, useEffect } from 'react';
import { networkMonitor } from '../services/sync/networkMonitor';

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(networkMonitor.isOnline());

  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe(status => setIsOnline(status));
    return () => unsubscribe();
  }, []);

  return isOnline;
}
