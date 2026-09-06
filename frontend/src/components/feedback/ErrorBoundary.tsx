import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Tessera Uncaught UI Error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg flex items-center justify-center p-6">
          <div className="max-w-md w-full border border-critical/40 bg-surface rounded-modal p-6 text-center shadow-modal">
            <div className="w-12 h-12 rounded-card bg-critical/15 text-critical border border-critical/30 flex items-center justify-center mx-auto mb-4">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <h1 className="text-section-title font-sans text-text-primary mb-2">
              Application Runtime Fault
            </h1>
            <p className="text-secondary-ui text-body-ui mb-4">
              An unexpected exception was encountered in the rendering engine. Telemetry state has been protected.
            </p>
            {this.state.error && (
              <div className="p-3 bg-bg border border-border rounded-sm text-left font-mono text-[12px] text-critical/90 mb-5 max-h-32 overflow-y-auto break-all">
                {this.state.error.message}
              </div>
            )}
            <Button
              variant="secondary"
              onClick={this.handleReset}
              leftIcon={<RotateCcw className="w-4 h-4" />}
            >
              Reload Application
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
