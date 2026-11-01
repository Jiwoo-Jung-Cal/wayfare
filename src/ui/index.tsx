// Shared UI components (code API v1). Visual values come from src/styles/tokens.css,
// which holds placeholders until Jiwoo approves the foundation design revision.
// Statuses always render words, not color alone. Unknown money renders as text, never $0.00.

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import {
  formatInstant,
  formatMaybeMoney,
  isUnknown,
  type AppError,
  type CapabilityStatus,
  type Instant,
  type MaybeMoney,
  type TimeZone,
} from '../core/index.ts';

export type Tone = 'neutral' | 'positive' | 'warning' | 'danger' | 'info';

export function Button({
  variant = 'secondary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  return <button type="button" className="wf-button" data-variant={variant} {...props} />;
}

export function Card({ title, actions, children, as: Tag = 'section' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; as?: 'section' | 'article' | 'div' }) {
  return (
    <Tag className="wf-card wf-stack">
      {(title || actions) && (
        <div className="wf-row" style={{ justifyContent: 'space-between' }}>
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </Tag>
  );
}

export function StatusBadge({ tone = 'neutral', wrap = false, children }: { tone?: Tone; wrap?: boolean; children: ReactNode }) {
  return (
    <span className="wf-badge" data-tone={tone} data-wrap={wrap || undefined}>
      {children}
    </span>
  );
}

/** Amount display. Unknown values show the reason as a tooltip and "Unknown" as text. */
export function MoneyText({ value, unknownLabel = 'Unknown' }: { value: MaybeMoney; unknownLabel?: string }) {
  const unknown = isUnknown(value);
  return (
    <span className="wf-money" data-unknown={unknown} title={unknown ? value.reason : undefined}>
      {formatMaybeMoney(value, 'en-US', unknownLabel)}
    </span>
  );
}

/** Instant shown in a display timezone, with the UTC instant available on hover. */
export function InstantText({ value, timeZone = 'UTC' }: { value: Instant; timeZone?: TimeZone }) {
  return (
    <time dateTime={value} title={value}>
      {formatInstant(value, timeZone)}
    </time>
  );
}

/** Labels whether a value/action is live or simulated. */
export function CapabilityLabel({ status, children }: { status: CapabilityStatus | 'sample'; children?: ReactNode }) {
  const text = status === 'live' ? 'Live' : status === 'sample' ? 'Sample data' : 'Simulated';
  return <StatusBadge tone={status === 'live' ? 'positive' : 'info'} wrap>{children ? `${text}: ${children}` : text}</StatusBadge>;
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="wf-muted">
      {label}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }: { error: AppError; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="wf-alert wf-stack" data-tone="danger">
      <strong>{title}</strong>
      <span>{error.message}</span>
      {error.issues && (
        <ul>
          {error.issues.map((i) => (
            <li key={i.path}>
              <span className="wf-mono">{i.path}</span>: {i.message}
            </li>
          ))}
        </ul>
      )}
      <span className="wf-muted">
        Error code <span className="wf-mono">{error.code}</span>
        {error.requestId && (
          <>
            {' '}· request <span className="wf-mono">{error.requestId}</span>
          </>
        )}
      </span>
      {onRetry && error.retryable && (
        <div>
          <Button onClick={onRetry}>Retry</Button>
        </div>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="wf-alert wf-stack" data-tone="info">
      <strong>{title}</strong>
      {children}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'danger'; children: ReactNode }) {
  return (
    <div className="wf-alert" data-tone={tone} role={tone === 'danger' ? 'alert' : undefined}>
      {children}
    </div>
  );
}
