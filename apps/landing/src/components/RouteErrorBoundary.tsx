import React from 'react';
import { clearChunkReloadGuard } from '@/routes/lazyRoute.ts';

/**
 * Catches anything a route throws while rendering — most importantly a chunk download that failed
 * twice and could not be recovered by `lazyRoute`'s reload.
 *
 * Before this existed the landing app had no error boundary at all, so such a throw unmounted the
 * whole React tree: the URL changed, the screen went blank, and nothing was reported. A dead end
 * the user can see and act on is strictly better than a silent one.
 *
 * Error boundaries still have to be class components in React 19; there is no hook equivalent.
 */

interface Props {
  children: React.ReactNode;
  /** Changing this clears the error, so navigating elsewhere recovers without a reload. */
  resetKey: string;
}

interface State {
  error: Error | null;
  /** The resetKey the current error belongs to. */
  errorKey: string;
}

export class RouteErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, errorKey: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (state.error && state.errorKey && state.errorKey !== props.resetKey) {
      // The user navigated somewhere else — give that route a clean shot at rendering.
      return { error: null, errorKey: '' };
    }
    if (state.error && !state.errorKey) return { errorKey: props.resetKey };
    return null;
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep it in the console: silent failures are what made this class of bug so hard to see.
    console.error('[route] failed to render', error, info.componentStack);
  }

  private handleRetry = () => {
    // Re-arm the one-shot recovery reload, otherwise a user who already spent it this session is
    // stuck on this screen until they close the tab.
    clearChunkReloadGuard();
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="relative flex min-h-screen items-center justify-center bg-[var(--color-secondary)] p-[var(--px-20)]">
        <div className="relative z-30 max-w-[var(--px-420)] text-center font-helvetica font-light text-[var(--color-text-secondary)]">
          <p className="text-[length:var(--px-11)] uppercase tracking-[var(--px-0-2)] text-[var(--color-primary)]">
            Page failed to load
          </p>
          <p className="mt-[var(--px-12)] font-fira text-[length:var(--px-13)] leading-[var(--px-20)]">
            This usually means the site was updated while your tab was open. Reloading picks up the
            new version.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="mt-[var(--px-20)] cursor-pointer border border-[var(--color-primary)] px-[var(--px-18)] py-[var(--px-10)] font-fira text-[length:var(--px-12)] uppercase tracking-[var(--px-0-2)] text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)] hover:text-[var(--color-secondary)]"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
