/* ==========================================================================
   theme.js
   --------------------------------------------------------------------------
   Theme engine: mode (light / dark / system) plus a separate color palette
   for dark mode and for light mode.

   How it works
   - The app's colors are CSS variables (Tailwind v4 @theme tokens).
   - A palette is a set of overrides for those variables. The default
     palettes have no overrides, so they use the values from index.css.
   - applyTheme() toggles the `dark` class on <html> and writes the chosen
     palette as inline variables on <html>, which wins over index.css.

   Put this file at src/theme.js.
   ========================================================================== */

const STORAGE_KEY = 'workspace-theme-v1';

export const THEME_MODES = ['light', 'dark', 'system'];
export const THEME_DEFAULTS = { theme: 'dark', darkPalette: 'ember', lightPalette: 'indigo' };

/* ---------- palette building blocks ---------- */

const accents = (a) => ({
  '--color-primary': a.primary,
  '--color-on-primary': a.onPrimary ?? '#ffffff',
  '--color-primary-container': a.primaryContainer,
  '--color-on-primary-container': a.onPrimaryContainer ?? '#ffffff',
  '--color-primary-fixed-dim': a.primaryHover,
  '--color-inverse-primary': a.primaryContainer,
  '--color-surface-tint': a.primary,
  '--color-secondary': a.secondary,
  '--color-on-secondary': a.onSecondary ?? '#ffffff',
  '--color-secondary-container': a.secondaryContainer,
  '--color-tertiary': a.tertiary,
  '--color-on-tertiary': a.onTertiary ?? '#ffffff',
  '--color-tertiary-container': a.tertiaryContainer,
  '--color-tertiary-fixed': a.tertiaryHover,
  '--color-on-tertiary-fixed': a.onTertiary ?? '#ffffff',
});

const surfaces = (s) => ({
  '--color-surface': s.base,
  '--color-surface-dim': s.base,
  '--color-background': s.base,
  '--color-surface-container-lowest': s.lowest,
  '--color-surface-container-low': s.low,
  '--color-surface-container': s.mid,
  '--color-surface-container-high': s.high,
  '--color-surface-container-highest': s.highest,
  '--color-surface-variant': s.highest,
  '--color-outline-variant': s.line,
});

/* ---------- palettes ----------
   `preview` is only used to draw the small swatches in Settings.
   The first palette in each list is the default (no overrides). */

export const PALETTES = {
  dark: [
    {
      id: 'crimson', name: 'Crimson & Aqua', description: 'Black, dark red, aqua',
      preview: { bg: '#030304', card: '#0e0e11', text: '#f2f2f4', p: '#dc2626', s: '#2bd9ff', t: '#f87171' },
      vars: null,
    },
    {
      id: 'ocean', name: 'Midnight Ocean', description: 'Navy, blue, cyan',
      preview: { bg: '#050810', card: '#0f1626', text: '#e8edf8', p: '#3b82f6', s: '#22d3ee', t: '#a78bfa' },
      vars: {
        ...accents({
          primary: '#3b82f6', primaryContainer: '#1d4ed8', primaryHover: '#60a5fa',
          secondary: '#22d3ee', onSecondary: '#03303a', secondaryContainer: '#0891b2',
          tertiary: '#a78bfa', onTertiary: '#1e1065', tertiaryContainer: '#6d28d9', tertiaryHover: '#c4b5fd',
        }),
        ...surfaces({ base: '#050810', lowest: '#02040a', low: '#0a0f1c', mid: '#0f1626', high: '#151d31', highest: '#1d2640', line: '#232c45' }),
      },
    },
    {
      id: 'forest', name: 'Forest', description: 'Green-black, green, amber',
      preview: { bg: '#040605', card: '#0d120f', text: '#eaf3ec', p: '#22c55e', s: '#fbbf24', t: '#5eead4' },
      vars: {
        ...accents({
          primary: '#22c55e', onPrimary: '#052e16', primaryContainer: '#15803d', primaryHover: '#4ade80',
          secondary: '#fbbf24', onSecondary: '#2a1c00', secondaryContainer: '#d97706',
          tertiary: '#5eead4', onTertiary: '#042f2e', tertiaryContainer: '#0f766e', tertiaryHover: '#99f6e4',
        }),
        ...surfaces({ base: '#040605', lowest: '#000000', low: '#070a08', mid: '#0d120f', high: '#131a15', highest: '#1b231d', line: '#243029' }),
      },
    },
    {
      id: 'violet', name: 'Violet Night', description: 'Purple-black, violet, pink',
      preview: { bg: '#07050c', card: '#130f1d', text: '#f0eaf8', p: '#8b5cf6', s: '#f472b6', t: '#c4b5fd' },
      vars: {
        ...accents({
          primary: '#8b5cf6', primaryContainer: '#6d28d9', primaryHover: '#a78bfa',
          secondary: '#f472b6', onSecondary: '#4a0425', secondaryContainer: '#db2777',
          tertiary: '#c4b5fd', onTertiary: '#2e1065', tertiaryContainer: '#7c3aed', tertiaryHover: '#ddd6fe',
        }),
        ...surfaces({ base: '#07050c', lowest: '#030207', low: '#0c0914', mid: '#130f1d', high: '#1a1527', highest: '#231d33', line: '#2d2541' }),
      },
    },
    {
      id: 'ember', name: 'Ember', description: 'Black, amber, sky blue',
      preview: { bg: '#030304', card: '#0e0e11', text: '#f2f2f4', p: '#f59e0b', s: '#38bdf8', t: '#fcd34d' },
      vars: accents({
        primary: '#f59e0b', onPrimary: '#1f1300', primaryContainer: '#b45309', primaryHover: '#fbbf24',
        secondary: '#38bdf8', onSecondary: '#04293a', secondaryContainer: '#0284c7',
        tertiary: '#fcd34d', onTertiary: '#2a1c00', tertiaryContainer: '#b45309', tertiaryHover: '#fde68a',
      }),
    },
  ],
  light: [
    {
      id: 'indigo', name: 'Indigo & Sky', description: 'Soft white, indigo, blue',
      preview: { bg: '#f8fafc', card: '#ffffff', text: '#0f172a', p: '#4f46e5', s: '#0284c7', t: '#7c3aed' },
      vars: null,
    },
    {
      id: 'rose', name: 'Rose', description: 'Rose red, teal, magenta',
      preview: { bg: '#f8fafc', card: '#ffffff', text: '#0f172a', p: '#e11d48', s: '#0891b2', t: '#c026d3' },
      vars: accents({
        primary: '#e11d48', primaryContainer: '#f43f5e', primaryHover: '#fb7185',
        secondary: '#0891b2', secondaryContainer: '#06b6d4',
        tertiary: '#c026d3', tertiaryContainer: '#d946ef', tertiaryHover: '#e879f9',
      }),
    },
    {
      id: 'teal', name: 'Teal', description: 'Teal, blue, amber',
      preview: { bg: '#f8fafc', card: '#ffffff', text: '#0f172a', p: '#0d9488', s: '#2563eb', t: '#d97706' },
      vars: accents({
        primary: '#0d9488', primaryContainer: '#14b8a6', primaryHover: '#2dd4bf',
        secondary: '#2563eb', secondaryContainer: '#3b82f6',
        tertiary: '#d97706', tertiaryContainer: '#f59e0b', tertiaryHover: '#fbbf24',
      }),
    },
    {
      id: 'sunset', name: 'Sunset', description: 'Orange, deep blue, pink',
      preview: { bg: '#f8fafc', card: '#ffffff', text: '#0f172a', p: '#ea580c', s: '#0369a1', t: '#be185d' },
      vars: accents({
        primary: '#ea580c', primaryContainer: '#f97316', primaryHover: '#fb923c',
        secondary: '#0369a1', secondaryContainer: '#0284c7',
        tertiary: '#be185d', tertiaryContainer: '#db2777', tertiaryHover: '#f472b6',
      }),
    },
    {
      id: 'meadow', name: 'Meadow', description: 'Green, cyan, olive',
      preview: { bg: '#f8fafc', card: '#ffffff', text: '#0f172a', p: '#16a34a', s: '#0e7490', t: '#a16207' },
      vars: accents({
        primary: '#16a34a', primaryContainer: '#22c55e', primaryHover: '#4ade80',
        secondary: '#0e7490', secondaryContainer: '#0891b2',
        tertiary: '#a16207', tertiaryContainer: '#ca8a04', tertiaryHover: '#eab308',
      }),
    },
    {
      id: 'graphite', name: 'Graphite', description: 'Slate, blue, violet',
      preview: { bg: '#f8fafc', card: '#ffffff', text: '#0f172a', p: '#334155', s: '#0284c7', t: '#6d28d9' },
      vars: accents({
        primary: '#334155', primaryContainer: '#475569', primaryHover: '#64748b',
        secondary: '#0284c7', secondaryContainer: '#0ea5e9',
        tertiary: '#6d28d9', tertiaryContainer: '#7c3aed', tertiaryHover: '#8b5cf6',
      }),
    },
  ],
};

// Every variable any palette can set, so switching palettes never leaves stale values behind.
const MANAGED_VARS = [
  ...new Set(Object.values(PALETTES).flat().flatMap((p) => Object.keys(p.vars ?? {}))),
  '--glow-a',
  '--glow-b',
];

/* ---------- helpers ---------- */

export const getPalette = (mode, id) =>
  PALETTES[mode].find((p) => p.id === id) ?? PALETTES[mode][0];

export const systemPrefersDark = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

// 'system' follows the device; otherwise the choice is used as is.
export const resolveMode = (theme, systemDark = systemPrefersDark()) =>
  theme === 'system' ? (systemDark ? 'dark' : 'light') : theme === 'light' ? 'light' : 'dark';

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};

// Makes sure stored or incoming values are valid, falling back to the defaults.
export const normalizeTheme = (raw) => {
  const t = raw && typeof raw === 'object' ? raw : {};
  return {
    theme: THEME_MODES.includes(t.theme) ? t.theme : THEME_DEFAULTS.theme,
    darkPalette: PALETTES.dark.some((p) => p.id === t.darkPalette) ? t.darkPalette : THEME_DEFAULTS.darkPalette,
    lightPalette: PALETTES.light.some((p) => p.id === t.lightPalette) ? t.lightPalette : THEME_DEFAULTS.lightPalette,
  };
};

/* ---------- apply, load, save ---------- */

// Applies the theme to <html> and returns the mode that is now showing.
export const applyTheme = (prefs, systemDark = systemPrefersDark()) => {
  if (typeof document === 'undefined') return 'dark';
  const { theme, darkPalette, lightPalette } = normalizeTheme(prefs);
  const root = document.documentElement;
  const mode = resolveMode(theme, systemDark);
  const palette = getPalette(mode, mode === 'dark' ? darkPalette : lightPalette);

  root.classList.toggle('dark', mode === 'dark');
  root.style.colorScheme = mode;
  MANAGED_VARS.forEach((v) => root.style.removeProperty(v));
  Object.entries(palette.vars ?? {}).forEach(([k, v]) => root.style.setProperty(k, v));
  root.style.setProperty('--glow-a', hexToRgb(palette.preview.p));
  root.style.setProperty('--glow-b', hexToRgb(palette.preview.s));
  return mode;
};

export const loadTheme = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return normalizeTheme(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...THEME_DEFAULTS };
  }
};

export const saveTheme = (prefs) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeTheme(prefs)));
  } catch {
    /* storage can be blocked (private mode); the theme still applies for this session */
  }
};