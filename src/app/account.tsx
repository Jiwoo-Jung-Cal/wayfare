// Google sign-in and Google Calendar sync: designed demo states only (r2-final §2).
// Nothing contacts Google. The dialog says so, and the state lasts for this page
// session only. Per-booking "Add to Google Calendar" links (Itinerary) are real
// public template links and need no sign-in.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { GoogleG, Icon } from '../ui/icons.tsx';
import { useToast } from './toasts.tsx';

type Account = {
  user: { name: string; initials: string } | null;
  calendarOn: boolean;
  openAuth(kind: 'signin' | 'cal', onDone?: () => void): void;
  signOut(): void;
};

const Ctx = createContext<Account | null>(null);
export const useAccount = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAccount outside AccountProvider');
  return v;
};

const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function AccountProvider({ children, tripTitle, bookingCount, deadlineCount }: { children: ReactNode; tripTitle: string; bookingCount: number; deadlineCount: number }) {
  const toast = useToast();
  const [user, setUser] = useState<Account['user']>(null);
  const [calendarOn, setCalendarOn] = useState(false);
  const [dialog, setDialog] = useState<'signin' | 'cal' | null>(null);
  const [waiting, setWaiting] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const lastFocus = useRef<Element | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (dialog && !d.open) d.showModal();
    if (!dialog && d.open) d.close();
  }, [dialog]);

  const close = () => {
    setDialog(null);
    setWaiting(false);
    (lastFocus.current as HTMLElement | null)?.focus?.();
  };

  const go = () => {
    const kind = dialog;
    setWaiting(true);
    setTimeout(
      () => {
        close();
        if (!user) setUser({ name: 'Sample Traveler', initials: 'ST' });
        if (kind === 'cal') {
          setCalendarOn(true);
          toast(
            'Google Calendar connected',
            `Demo: your ${bookingCount} bookings and ${deadlineCount} refund deadlines would be added to the calendar “${tripTitle}”. Nothing was sent to Google.`,
            'gain',
          );
        } else toast('Signed in', `Demo: “${tripTitle}” stays saved in this browser; no Google account was contacted.`, 'gain');
      },
      reduceMotion() ? 0 : 1100,
    );
  };

  const value = useMemo<Account>(
    () => ({
      user,
      calendarOn,
      openAuth: (kind) => {
        lastFocus.current = document.activeElement;
        setDialog(kind);
      },
      signOut: () => {
        setUser(null);
        setCalendarOn(false);
        toast('Signed out', 'Your trip stays on this device.', 'faint');
      },
    }),
    [user, calendarOn, toast],
  );

  const cal = dialog === 'cal';
  return (
    <Ctx.Provider value={value}>
      {children}
      <dialog ref={ref} className="wf-dialog wf-auth" aria-labelledby="wf-auth-title" onClose={close} onClick={(e) => e.target === ref.current && close()}>
        <h2 id="wf-auth-title">{cal ? 'Connect Google Calendar' : 'Sign in to WayFare'}</h2>
        <p>
          {cal
            ? 'Keep your trip and its refund deadlines in your own calendar. WayFare will ask Google for permission to:'
            : 'Use your Google account to save trips and sync them across devices.'}
        </p>
        {cal && (
          <ul>
            <li>
              <Icon name="check" />
              Add your bookings and refund deadlines to a calendar you choose
            </li>
            <li>
              <Icon name="check" />
              Update them when something changes, like a cancellation
            </li>
            <li>
              <Icon name="check" />
              Never read your other events
            </li>
          </ul>
        )}
        <button type="button" className="wf-gbig" onClick={go} disabled={waiting} autoFocus>
          {waiting ? (
            <>
              <span className="wf-spin" aria-hidden="true" />
              Waiting for Google…
            </>
          ) : (
            <>
              <GoogleG />
              Continue with Google
            </>
          )}
        </button>
        <p className="wf-auth-note">
          Demo: in the real app this opens Google’s own sign-in window. Here we simulate a successful {cal ? 'connection' : 'sign-in'}; no Google account is
          contacted.
        </p>
        <div className="wf-row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
          <button type="button" className="wf-button" data-size="sm" onClick={close}>
            Not now
          </button>
        </div>
      </dialog>
    </Ctx.Provider>
  );
}
