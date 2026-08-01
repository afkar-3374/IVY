import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '../services/logger/logger';
import { RefreshCw, HeartHandshake } from 'lucide-react';
import { Button } from './ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('React Runtime Error Boundary caught crash:', { error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FDF8F6] dark:bg-[#16151A] flex items-center justify-center p-6 text-center">
          <div className="max-w-md bg-white dark:bg-[#1E1D24] p-8 rounded-3xl shadow-soft border border-stone-100 dark:border-stone-800">
            <div className="w-16 h-16 rounded-full bg-[#FCE8EC] text-[#C95565] flex items-center justify-center mx-auto mb-4">
              <HeartHandshake className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-2">
              Something unexpected happened
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-6 leading-relaxed">
              Don't worry! Your private messages and data are safely stored in IndexedDB.
            </p>
            <Button onClick={this.handleReload} leftIcon={<RefreshCw className="w-4 h-4" />}>
              Refresh Application
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
