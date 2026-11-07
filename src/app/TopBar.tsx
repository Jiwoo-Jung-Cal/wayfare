// App shell, design r2-final §2 (Figma "Top bar" 56:234, "Nav tab" 56:59, "Trip button" 56:60,
// "Google sign-in" 56:65, "Notifications bell" 56:80; trip menu on States 72:541).
//
// Honest-data rules: the trip menu lists the workspace's trips, then the reference page's
// two short sample trips (labelled as samples on their page). Google sign-in is a designed
// demo state: the dialog has no credential fields and says no Google account is contacted.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import type { Trip } from '../core/index.ts';
import { GoogleG, Icon, LogoMark, type IconName } from '../ui/icons.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';
import { useAccount } from './account.tsx';
import { TONE_COLOR, type ToastTone } from './toasts.tsx';

export type ShellTab = { to: string; label: string; icon: IconName; end?: boolean };

export function shellTabs(tripId: string | null): ShellTab[] {
  if (!tripId) return [{ to: '/', label: 'Overview', icon: 'home', end: true }];
  const base = `/trips/${tripId}`;
  return [
    { to: base, label: 'Overview', icon: 'home', end: true },
    { to: `${base}/plan`, label: 'Plan', icon: 'compass' },
    { to: `${base}/itinerary`, label: 'Itinerary', icon: 'cal' },
    { to: `${base}/reroute`, label: 'ReRoute', icon: 'route' },
    { to: `${base}/wallet`, label: 'TripWallet', icon: 'wallet' },
  ];
}

/** Trip name for the trip button ("NY Trip"). */
export const tripShortName = (trip: Trip) => trip.title;

/** Trip colour dot: the sample NY trip keeps the accent; added trips get their own colour. */
const tripDot = (id: string) => (id === 'trip-demo-chi' ? 'var(--wf-color-cat-ride)' : id === 'trip-demo-tyo' ? 'var(--wf-color-cat-stay)' : undefined);

const shortRange = (a: string, b: string) => {
  const f = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...o }).format(new Date(`${d}T12:00:00Z`));
  const sameMonth = a.slice(0, 7) === b.slice(0, 7);
  return `${f(a, { month: 'short', day: 'numeric' })} – ${sameMonth ? f(b, { day: 'numeric' }) : f(b, { month: 'short', day: 'numeric' })}, ${a.slice(0, 4)}`;
};

function useScrolled(threshold = 12) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}

function TripMenu({ trips, currentId, statusOf }: { trips: Trip[]; currentId: string | null; statusOf: (tripId: string) => string }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef<HTMLElement[]>([]);
  const navigate = useNavigate();
  const current = trips.find((t) => t.id === currentId) ?? trips[0];

  useEffect(() => {
    if (!open) return;
    itemsRef.current[0]?.focus();
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.wf-tripw')) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const onMenuKey = (e: KeyboardEvent) => {
    const items = itemsRef.current.filter(Boolean);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); buttonRef.current?.focus(); }
  };
  const go = (to: string) => { setOpen(false); navigate(to); };

  if (!current) return null;
  return (
    <div className="wf-tripw">
      <button
        ref={buttonRef}
        type="button"
        className="wf-trip"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Trip: ${tripShortName(current)}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="wf-trip-dot" aria-hidden="true" style={{ background: tripDot(current.id) }} />
        <span className="wf-trip-name">{tripShortName(current)}</span>
        <Icon name="chev" className="wf-icon wf-trip-chev" />
      </button>
      {open && (
        <div className="wf-tmenu" role="menu" id={menuId} aria-label="Trips" onKeyDown={onMenuKey}>
          <div className="wf-tmenu-h" aria-hidden="true">Your trips</div>
          {trips.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => { if (el) itemsRef.current[i] = el; }}
              type="button"
              role="menuitemradio"
              aria-checked={t.id === current.id}
              onClick={() => go(`/trips/${t.id}`)}
            >
              <span className="wf-trip-dot" aria-hidden="true" style={{ background: tripDot(t.id) }} />
              <span>
                <b>{tripShortName(t)}</b>
                <small>
                  {shortRange(t.startDate, t.endDate)} · {statusOf(t.id)}
                </small>
              </span>
              {t.id === current.id ? <Icon name="check" className="wf-icon wf-tmenu-ck" /> : <span />}
            </button>
          ))}
          <hr />
          <button
            ref={(el) => { if (el) itemsRef.current[trips.length] = el; }}
            type="button"
            role="menuitem"
            className="wf-tmenu-new"
            onClick={() => go(`/trips/${current.id}/plan`)}
          >
            <Icon name="plus" />
            <span>Plan a new trip</span>
          </button>
        </div>
      )}
    </div>
  );
}

function SignIn() {
  const { user, openAuth, signOut } = useAccount();
  if (user)
    return (
      <button type="button" className="wf-avatar" aria-label={`Account: ${user.name} (demo). Sign out`} title={`${user.name} · Sign out`} onClick={signOut}>
        {user.initials}
      </button>
    );
  return (
    <button type="button" className="wf-gsign" onClick={() => openAuth('signin')} aria-haspopup="dialog" aria-label="Sign in" title="Sign in">
      <GoogleG />
      <span>Sign in</span>
    </button>
  );
}

export type ShellAlert = { title: string; detail: string; tone: ToastTone; to?: string };

function Bell({ alerts }: { alerts: ShellAlert[] }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    setSeen(alerts.length);
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.wf-bellw')) setOpen(false);
    };
    const esc = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open, alerts.length]);
  const unread = alerts.length > seen;
  return (
    <div className="wf-bellw">
      <button type="button" className="wf-ib" aria-label={`Notifications${unread ? ` (${alerts.length - seen} new)` : ''}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        <Icon name="bell" />
        {unread && <span className="wf-ib-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className="wf-inbox" id={id} role="region" aria-label="Notifications">
          <h3>Notifications</h3>
          {alerts.length === 0 ? (
            <p className="wf-muted">Nothing new.</p>
          ) : (
            <ul>
              {alerts.map((a) => (
                <li key={a.title}>
                  <span className="wf-dotk" aria-hidden="true" style={{ background: TONE_COLOR[a.tone] }} />
                  <span>
                    <b>{a.title}</b>
                    <small>{a.detail}</small>
                    {a.to && (
                      <Link to={a.to} onClick={() => setOpen(false)}>
                        Open
                      </Link>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function TopBar({ trips, tripId, alerts, statusOf }: { trips: Trip[]; tripId: string | null; alerts: ShellAlert[]; statusOf: (tripId: string) => string }) {
  const scrolled = useScrolled();
  const tabs = shellTabs(tripId);
  return (
    <header className={`wf-bar${scrolled ? ' wf-bar-scrolled' : ''}`}>
      <div className="wf-bar-in">
        <div className="wf-bar-left">
          <Link to="/" className="wf-brand" aria-label="WayFare home">
            <LogoMark />
            <span>WayFare</span>
          </Link>
          <TripMenu trips={trips} currentId={tripId} statusOf={statusOf} />
        </div>
        <nav className="wf-tabs" aria-label="Main">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} title={t.label}>
              <Icon name={t.icon} />
              <span>{t.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="wf-tools">
          <SignIn />
          <ThemeToggle />
          <Bell alerts={alerts} />
        </div>
      </div>
    </header>
  );
}

/** Below 760 px the tabs move to a floating bar at the bottom. */
export function BottomTabs({ tripId }: { tripId: string | null }) {
  return (
    <nav className="wf-tabbar" aria-label="Sections">
      {shellTabs(tripId).map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end}>
          <Icon name={t.icon} />
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
