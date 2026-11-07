// UI icons from Phosphor (phosphoricons.com, MIT licence), "regular" weight, at Jiwoo's
// direction. Names are WayFare's own so call sites don't depend on the icon library.
import {
  Airplane, ArrowRight, ArrowSquareOut, ArrowsOut, Bed, Bell, CalendarBlank, Car, CaretRight, Check,
  Clock, Compass, Copy, FileText, Gift, House, Info, MagnifyingGlass, Minus, Money, Paperclip, Path,
  Plus, Receipt, ShieldCheck, Sparkle, Ticket, User, Wallet, Warning, X, type Icon as PhosphorIcon,
} from '@phosphor-icons/react';

const ICONS = {
  home: House, compass: Compass, cal: CalendarBlank, route: Path, wallet: Wallet, bell: Bell,
  chev: CaretRight, check: Check, plus: Plus, x: X, clock: Clock, arrow: ArrowRight, plane: Airplane,
  bed: Bed, ticket: Ticket, car: Car, user: User, ext: ArrowSquareOut, alert: Warning, cash: Money,
  copy: Copy, doc: FileText, expand: ArrowsOut, gift: Gift, info: Info, minus: Minus, receipt: Receipt,
  search: MagnifyingGlass, send: ArrowRight, shield: ShieldCheck, clip: Paperclip, spark: Sparkle,
} satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className = 'wf-icon', label }: { name: IconName; className?: string; label?: string }) {
  const Glyph = ICONS[name];
  return <Glyph className={className} weight={name === 'spark' ? 'fill' : 'regular'} aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label} />;
}

/** Logo / w mark (55:271): rounded lowercase "w" with a separate destination dot, in accent. No hover effect. */
export function LogoMark({ className = 'wf-logo-mark' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        d="M5.5 10 L9.6 21.2 C10.6 23.9 12.9 23.9 13.9 21.2 L16 15.5 L18.1 21.2 C19.1 23.9 21.4 23.9 22.4 21.2 L24.2 16.4"
        fill="none"
        stroke="var(--wf-color-accent)"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="26.6" cy="10" r="2.7" fill="var(--wf-color-accent)" />
    </svg>
  );
}

/** Google "G" for the demo sign-in button (brand colours by Google's guidelines). */
export function GoogleG({ className = 'wf-google-g' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h6c-.3 1.4-1.1 2.6-2.3 3.4v2.8h3.7c2.1-2 3.2-4.9 3.2-8.2z" />
      <path fill="#34A853" d="M12 23c3.1 0 5.7-1 7.6-2.8l-3.7-2.8c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v2.9C3.7 20.5 7.6 23 12 23z" />
      <path fill="#FBBC05" d="M5.6 13.8c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2V6.5H1.8C1 8 .6 9.7.6 11.6s.4 3.6 1.2 5.1z" />
      <path fill="#EA4335" d="M12 4.6c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.2 15.1 0 12 0 7.6 0 3.7 2.5 1.8 6.5l3.8 2.9C6.5 6.6 9 4.6 12 4.6z" />
    </svg>
  );
}
