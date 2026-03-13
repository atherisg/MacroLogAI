import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'Something went wrong.';
      
      try {
        // Check if it's a Firestore permission error (JSON string)
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.error.includes('Missing or insufficient permissions')) {
            errorMessage = 'You do not have permission to perform this action. Please check your account settings.';
          }
        }
      } catch (e) {
        // Not a JSON error message, keep default
      }

      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-4">
            <h1 className="text-4xl font-black italic text-primary uppercase tracking-tighter">System Error</h1>
            <p className="text-zinc-400 text-sm leading-relaxed">
              {errorMessage}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-primary text-black font-bold rounded-full hover:opacity-80 transition-opacity"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
