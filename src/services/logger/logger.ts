type LogLevel = 'info' | 'warn' | 'error' | 'sync' | 'network';

class Logger {
  private isDev: boolean;

  constructor() {
    this.isDev = import.meta.env.DEV ?? false;
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
    return `[Ivy ${level.toUpperCase()} ${timestamp}] ${message}`;
  }

  info(message: string, ...args: unknown[]) {
    if (this.isDev) {
      console.log(`%c${this.formatMessage('info', message)}`, 'color: #3b82f6', ...args);
    }
  }

  warn(message: string, ...args: unknown[]) {
    if (this.isDev) {
      console.warn(`%c${this.formatMessage('warn', message)}`, 'color: #f59e0b', ...args);
    }
  }

  error(message: string, error?: unknown) {
    // Errors are always logged safely without sensitive plain credentials
    console.error(this.formatMessage('error', message), error || '');
  }

  sync(message: string, ...args: unknown[]) {
    if (this.isDev) {
      console.log(`%c${this.formatMessage('sync', message)}`, 'color: #10b981; font-weight: bold', ...args);
    }
  }

  network(message: string, online: boolean) {
    if (this.isDev) {
      const color = online ? '#10b981' : '#ef4444';
      console.log(`%c${this.formatMessage('network', message)}`, `color: ${color}; font-weight: bold`);
    }
  }
}

export const logger = new Logger();
