// Shared UI components (code API v1), styled to design draft r1 (Figma file
// ZZS9jEmANeCrjGxWxxCofK, page 01 — Foundations). Visual values come from
// src/styles/tokens.css. Formal visual approval is still pending.
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

export type Tone = 'neutral' | 'positive' | 'warning' | 'danger' | 'info' | 'simulated' | 'accent';

export function Button({
  variant = 'secondary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  return <button type="button" className="wf-button" data-variant={variant} {...props} />;
}

export function Card({ title, actions, children, as: Tag = 'section' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; as?: 'section' | 'article' | 'div' }) {
  return (
    <Tag className="wf-card wf-stack">
      {(title || actions) && (
        <div className="wf-card-header">
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
  return <StatusBadge tone={status === 'live' ? 'positive' : 'simulated'} wrap>{children ? `${text}: ${children}` : text}</StatusBadge>;
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
          {/* Several valid issues can share one path (e.g. two budget rules), so the position is part of the key. */}
          {error.issues.map((i, n) => (
            <li key={`${n}:${i.path}`}>
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
    <div className="wf-alert wf-stack" data-tone="neutral">
      <strong>{title}</strong>
      {children}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'danger' | 'success' | 'simulated'; children: ReactNode }) {
  return (
    <div className="wf-alert" data-tone={tone} role={tone === 'danger' ? 'alert' : undefined}>
      {children}
    </div>
  );
}

/** One labelled money figure (Figma `MoneyStat`). The caption must state the scope:
 *  trip-wide vs one claim, cash vs noncash. Unknown renders as words, never $0.00. */
export function MoneyStat({ label, value, caption, size = 'medium', tone = 'default' }: {
  label: string;
  value: MaybeMoney | string;
  caption?: ReactNode;
  size?: 'medium' | 'hero';
  tone?: 'default' | 'positive' | 'warning' | 'danger' | 'muted';
}) {
  return (
    <div className="wf-moneystat" data-size={size} data-tone={tone}>
      <span className="wf-moneystat-label">{label}</span>
      <span className="wf-moneystat-amount">{typeof value === 'string' ? value : <MoneyText value={value} />}</span>
      {caption && <span className="wf-muted">{caption}</span>}
    </div>
  );
}

/** Label + right-aligned value line (Figma `KeyValue`). `total` adds a divider and larger amount. */
export function KeyValue({ label, value, emphasis = 'default' }: { label: ReactNode; value: ReactNode; emphasis?: 'default' | 'total' | 'muted' }) {
  return (
    <div className="wf-kv" data-emphasis={emphasis}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
