import { logger } from '../logger/logger';

type NetworkListener = (isOnline: boolean) => void;

class NetworkMonitor {
  private listeners: Set<NetworkListener> = new Set();
  private onlineStatus: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  private handleOnline = () => {
    this.onlineStatus = true;
    logger.network('Device re-connected online', true);
    this.notify();
  };

  private handleOffline = () => {
    this.onlineStatus = false;
    logger.network('Device went offline', false);
    this.notify();
  };

  public isOnline(): boolean {
    return this.onlineStatus;
  }

  public subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    // Emit initial status
    listener(this.onlineStatus);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.onlineStatus);
    }
  }
}

export const networkMonitor = new NetworkMonitor();
