// Colour mode toggle (Figma component "Colour mode toggle", 56:72): sun = light, moon = dark.
import { useState } from 'react';
import { currentTheme, setTheme, type ThemeMode } from './theme.ts';

const Sun = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="wf-icon wf-sun">
    <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const Moon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="wf-icon wf-moon">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="currentColor" stroke="none" />
  </svg>
);

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(() => currentTheme());
  const choose = (m: ThemeMode) => {
    setTheme(m);
    setMode(m);
  };
  return (
    <div className="wf-mode" role="group" aria-label="Colour mode">
      <button type="button" aria-pressed={mode === 'light'} aria-label="Light mode" title="Light mode" onClick={() => choose('light')}>
        <Sun />
      </button>
      <button type="button" aria-pressed={mode === 'dark'} aria-label="Dark mode" title="Dark mode" onClick={() => choose('dark')}>
        <Moon />
      </button>
    </div>
  );
}
