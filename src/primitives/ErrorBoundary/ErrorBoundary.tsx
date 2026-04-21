import React from 'react';
import styles from './ErrorBoundary.module.css';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught render error:', error, info);
  }

  render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (error) {
      if (fallback !== undefined) {
        return fallback;
      }
      return (
        <div className={styles.container}>
          <p className={styles.title}>Something went wrong</p>
          <p className={styles.message}>{error.message}</p>
          <button className={styles.button} onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
