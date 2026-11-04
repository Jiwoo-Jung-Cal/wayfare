// Toasts (design r2-final §2 "Notifications"): top-right, above menus and drawers,
// at most three, auto-dismissed after 7 s, each with optional link-style actions.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../ui/icons.tsx';

export type ToastTone = 'gain' | 'accent' | 'loss' | 'faint' | 'amber';
export type ToastAction = { label: string; run: () => void };
type Toast = { id: number; title: string; body: string; tone: ToastTone; actions: ToastAction[]; leaving?: boolean };

const Ctx = createContext<(title: string, body: string, tone?: ToastTone, actions?: ToastAction[]) => void>(() => {});

export const useToast = () => useContext(Ctx);

export const TONE_COLOR: Record<ToastTone, string> = {
  gain: 'var(--wf-color-positive)',
  accent: 'var(--wf-color-accent)',
  loss: 'var(--wf-color-danger)',
  faint: 'var(--wf-color-text-faint)',
  amber: 'var(--wf-color-warning)',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const kill = useCallback((id: number) => {
    setItems((xs) => xs.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setItems((xs) => xs.filter((t) => t.id !== id)), 250);
  }, []);
  const push = useCallback(
    (title: string, body: string, tone: ToastTone = 'accent', actions: ToastAction[] = []) => {
      const id = ++seq.current;
      setItems((xs) => [{ id, title, body, tone, actions }, ...xs].slice(0, 3));
      setTimeout(() => kill(id), 7000);
    },
    [kill],
  );
  const value = useMemo(() => push, [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="wf-toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="wf-toast" data-out={t.leaving || undefined} role="status">
            <span className="wf-dotk" style={{ background: TONE_COLOR[t.tone] }} aria-hidden="true" />
            <div>
              <strong>{t.title}</strong>
              <p>{t.body}</p>
              {t.actions.length > 0 && (
                <div className="wf-toast-acts">
                  {t.actions.map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      className="wf-linkbtn"
                      onClick={() => {
                        a.run();
                        kill(t.id);
                      }}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className="wf-toast-x" aria-label="Dismiss" onClick={() => kill(t.id)}>
              <Icon name="x" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
