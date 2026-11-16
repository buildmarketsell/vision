import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  name: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Keeps one broken part from taking down the window: shows an error card with Reload. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`${this.props.name} crashed`, error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle size={20} strokeWidth={1.5} color="var(--color-danger)" />
        <div className="font-medium">{this.props.name} stopped working</div>
        <div className="max-w-sm text-(--color-text-muted)" style={{ fontSize: 'var(--size-small)' }}>
          {error.message}
        </div>
        <button className="button-secondary" onClick={() => this.setState({ error: null })}>
          Reload {this.props.name}
        </button>
      </div>
    );
  }
}
