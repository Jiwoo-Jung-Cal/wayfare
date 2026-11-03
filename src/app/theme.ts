// Light/dark colour mode (r2-final §2 "Colour mode"): a sun/moon toggle, remembered
// per browser. With no stored choice the OS preference decides. The same logic runs
// inline in index.html before first paint so a stored dark choice never flashes light.

export type ThemeMode = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'wayfare:v1:theme';

function stored(): ThemeMode | null {
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

export function currentTheme(): ThemeMode {
  const attr = document.documentElement.dataset.theme;
  if (attr === 'light' || attr === 'dark') return attr;
  return stored() ?? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function setTheme(mode: ThemeMode): void {
  document.documentElement.dataset.theme = mode;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Storage blocked (private window): the choice lasts for this page only.
  }
}
