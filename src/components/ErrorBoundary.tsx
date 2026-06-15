import React, { Component, ErrorInfo, ReactNode } from 'react';
import { isRetryableImportError } from '@/utils/lazyLoading';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function getImportRecoveryKey(error: Error) {
  const path = typeof window !== 'undefined' ? window.location.pathname : 'unknown';
  const message = error?.message || 'unknown';
  return `wakti-import-recovery:${path}:${message}`;
}

function shouldAutoReloadTransientError(error: Error) {
  if (!isRetryableImportError(error)) return false;
  try {
    const key = getImportRecoveryKey(error);
    if (sessionStorage.getItem(key) === '1') return false;
    sessionStorage.setItem(key, '1');
  } catch {}
  return true;
}

function clearTransientErrorReloadFlag(error: Error | null) {
  if (!error) return;
  try {
    sessionStorage.removeItem(getImportRecoveryKey(error));
  } catch {}
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    if (shouldAutoReloadTransientError(error)) {
      window.setTimeout(() => window.location.reload(), 0);
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public resetErrorBoundary = () => {
    clearTransientErrorReloadFlag(this.state.error);
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      // If custom fallback provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          padding: '24px',
          textAlign: 'center',
          background: 'var(--background, #0c0f14)',
          color: 'var(--foreground, #f2f2f2)',
        }}>
          <div style={{
            maxWidth: '420px',
            width: '100%',
            padding: '32px 24px',
            background: 'var(--card, #1a1d24)',
            borderRadius: '0.75rem',
            border: '1px solid var(--border, rgba(255,255,255,0.08))',
            boxShadow: '0 4px 32px hsla(0,0%,0%,0.5)',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ marginBottom: '12px', fontSize: '1.25rem', fontWeight: 600 }}>
              Something went wrong
            </h2>
            <p style={{ marginBottom: '8px', opacity: 0.7, fontSize: '0.9rem', lineHeight: 1.5 }}>
              An unexpected error occurred. Your data is safe.
            </p>
            <p style={{ marginBottom: '24px', opacity: 0.45, fontSize: '0.75rem', fontFamily: 'monospace', wordBreak: 'break-word' }}>
              {this.state.error?.message}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={this.resetErrorBoundary}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  color: 'var(--foreground, #f2f2f2)',
                  border: '1px solid var(--border, rgba(255,255,255,0.15))',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                Try again
              </button>
              <button
                onClick={() => {
                  clearTransientErrorReloadFlag(this.state.error);
                  window.location.reload();
                }}
                style={{
                  padding: '10px 20px',
                  background: 'hsl(210 100% 65%)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                Reload app
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
