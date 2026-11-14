import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PALETTES, THEME_DEFAULTS, resolveMode } from '../theme';
import BillingSection from '../components/BillingSection';

/* ==========================================================================
   SettingsPage (enhanced)
   --------------------------------------------------------------------------
   1. Constants        options, nav groups, section -> key map
   2. Hooks            tween, toast, copy, scroll-spy
   3. UI primitives    Icon, Card, Heading, Field, Switch, Segmented, Callout...
   4. Sections         Workspace, Appearance, Engine, Notifications, Security, Data
   5. Page chrome      header, overview, grouped nav, save bar, toast
   6. Page             draft vs saved state + composition

   Public API:
     <SettingsPage
       tpuUsage setTpuUsage onSettingsSave
       themePrefs        saved theme { theme, darkPalette, lightPalette }
       onThemePreview    called with the draft theme while editing (null on leave)
       onThemeSave       called with the theme when the user saves
     />
   ========================================================================== */

/* ==========================================================================
   1. CONSTANTS
   ========================================================================== */

const VERIFIER_KEY = '0x8f2d49c81b94a201f92e6205ba8410294fc6b93b';

const ENGINE_VERSIONS = [
  { value: 'v3.4.2 Quantum', label: 'v3.4.2 Quantum (Active)' },
  { value: 'v3.5.0-rc1 Preview', label: 'v3.5.0-rc1 Preview' },
  { value: 'v3.3.8 Stable', label: 'v3.3.8 Stable' },
];

// Navigation is grouped so related settings sit together.
const NAV = [
  { id: 'workspace', label: 'Workspace', icon: 'workspaces', group: 'General' },
  { id: 'appearance', label: 'Appearance', icon: 'palette', group: 'General' },
  { id: 'engine', label: 'Neural engine', icon: 'auto_awesome', group: 'AI & compute' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications', group: 'Alerts' },
  { id: 'security', label: 'Security', icon: 'security', group: 'Security & data' },
  { id: 'data', label: 'Data & privacy', icon: 'database', group: 'Security & data' },
  { id: 'billing', label: 'Billing & plan', icon: 'credit_card', group: 'Billing' },
];
const SECTION_IDS = NAV.map((n) => n.id);
const LABEL_OF = Object.fromEntries(NAV.map((n) => [n.id, n.label]));

const THEME_KEYS = ['theme', 'darkPalette', 'lightPalette'];

const DEFAULTS = {
  // workspace
  capacity: 40, sprintLength: '14', weekStart: 'mon', timezone: 'UTC', landing: 'projects',
  // appearance
  theme: THEME_DEFAULTS.theme, darkPalette: THEME_DEFAULTS.darkPalette, lightPalette: THEME_DEFAULTS.lightPalette,
  density: 'comfortable', reduceMotion: false, keyHints: true,
  // engine
  engineVersion: 'v3.4.2 Quantum', tpu: 78, tpuBurst: true,
  // notifications
  notifyClash: true, overloadAt: 40, notifyInApp: true, notifyEmail: true, notifySlack: false,
  digest: 'daily', quietHours: false, quietFrom: '22:00', quietTo: '07:00',
  // security
  twoFactor: true, signInAlerts: true, sessionTimeout: '60',
  // data
  aiLearning: true, retention: '90',
};

// Which draft keys belong to which section (drives "Edited" badges, counts and revert).
const SECTION_KEYS = {
  workspace: ['capacity', 'sprintLength', 'weekStart', 'timezone', 'landing'],
  appearance: ['theme', 'darkPalette', 'lightPalette', 'density', 'reduceMotion', 'keyHints'],
  engine: ['engineVersion', 'tpu', 'tpuBurst'],
  notifications: ['notifyClash', 'overloadAt', 'notifyInApp', 'notifyEmail', 'notifySlack', 'digest', 'quietHours', 'quietFrom', 'quietTo'],
  security: ['twoFactor', 'signInAlerts', 'sessionTimeout'],
  data: ['aiLearning', 'retention'],
};

const TIMEZONES = ['UTC', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Asia/Kolkata', 'Asia/Singapore']
  .map((v) => ({ value: v, label: v.replace('_', ' ') }));
const LANDING = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'projects', label: 'Projects' },
  { value: 'sprints', label: 'Sprints' },
  { value: 'team', label: 'Team' },
];
const SESSION = [
  { value: '15', label: '15 minutes' },
  { value: '60', label: '1 hour' },
  { value: '240', label: '4 hours' },
  { value: '1440', label: '24 hours' },
];
const RETENTION = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
];
const TPU_PRESETS = [60, 80, 100];

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary';

const formatTimeout = (mins) => {
  const m = Number(mins);
  return m >= 60 ? `${m / 60}h` : `${m} min`;
};

/* ==========================================================================
   2. HOOKS
   ========================================================================== */

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Smoothly tweens a number toward `target`.
const useTween = (target, duration = 500) => {
  const [value, setValue] = useState(reducedMotion() ? target : 0);
  const from = useRef(reducedMotion() ? target : 0);
  useEffect(() => {
    if (reducedMotion()) {
      from.current = target;
      setValue(target);
      return undefined;
    }
    let raf;
    const start = from.current;
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min((now - t0) / duration, 1);
      const next = start + (target - start) * (1 - Math.pow(1 - t, 3));
      from.current = next;
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
};

// One toast at a time; timer cleaned up on unmount.
const useToast = (ms = 3500) => {
  const [message, setMessage] = useState(null);
  const timer = useRef(null);
  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setMessage(null);
  }, []);
  const show = useCallback(
    (text) => {
      clearTimeout(timer.current);
      setMessage(text);
      timer.current = setTimeout(() => setMessage(null), ms);
    },
    [ms]
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  return { message, show, dismiss };
};

// Copies text and flips `copied` to true for a moment.
const useCopy = (ms = 1800) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = useCallback(
    async (text) => {
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          ok = document.execCommand('copy');
          document.body.removeChild(ta);
        } catch {
          ok = false;
        }
      }
      if (ok) {
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), ms);
      }
      return ok;
    },
    [ms]
  );
  return { copied, copy };
};

// Returns the id of the section currently near the top of the viewport.
const useScrollSpy = (ids) => {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id.replace('settings-', ''))),
      { rootMargin: '-25% 0px -60% 0px' }
    );
    ids.forEach((id) => {
      const el = document.getElementById(`settings-${id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);
  return [active, setActive];
};

/* ==========================================================================
   3. UI PRIMITIVES
   ========================================================================== */

const Icon = ({ name, className = '' }) => (
  <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{name}</span>
);

const Card = ({ id, delay = 0, children }) => (
  <section
    id={`settings-${id}`} aria-labelledby={`settings-${id}-title`} style={{ animationDelay: `${delay}ms` }}
    className="st-enter relative scroll-mt-24 rounded-2xl bg-surface-container/60 border border-outline-variant/30 transition-[border-color] duration-300 hover:border-secondary/30"
  >
    <div className="flex flex-col gap-space-lg p-space-lg">{children}</div>
  </section>
);

const SectionHeading = ({ sectionId, icon, iconClass, title, description, editedCount, onRevert }) => (
  <div className="flex items-start gap-3 border-b border-outline-variant/20 pb-space-sm">
    <div className={`w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center shrink-0 shadow-inner ${iconClass}`}>
      <Icon name={icon} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={`settings-${sectionId}-title`} className="text-lg font-semibold text-on-surface">{title}</h2>
        {editedCount > 0 && (
          <span className="st-pop inline-flex items-center gap-1 text-xs text-tertiary bg-tertiary/10 border border-tertiary/20 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary" /> {editedCount} edited
          </span>
        )}
      </div>
      <p className="text-sm text-on-surface-variant">{description}</p>
    </div>
    {editedCount > 0 && (
      <button
        type="button" onClick={onRevert}
        className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition active:scale-95 cursor-pointer ${focusRing}`}
      >
        <Icon name="undo" className="text-sm" /> Revert section
      </button>
    )}
  </div>
);

// Titled block inside a section, separated from its neighbours.
const Group = ({ title, description, children }) => (
  <div className="flex flex-col gap-space-md">
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-outline">{title}</h3>
      {description && <p className="text-xs text-on-surface-variant mt-0.5">{description}</p>}
    </div>
    {children}
  </div>
);

const Divider = () => <hr className="border-0 border-t border-outline-variant/20" />;

// `group` renders a plain text label for controls that are not a single input (segmented, gauge).
const Field = ({ id, label, hint, group = false, children }) => (
  <div className="flex flex-col gap-1.5 min-w-0">
    {group
      ? <span id={`${id}-label`} className="text-sm font-semibold text-on-surface">{label}</span>
      : <label id={`${id}-label`} htmlFor={id} className="text-sm font-semibold text-on-surface">{label}</label>}
    {children}
    {hint && <p className="text-xs text-on-surface-variant" id={`${id}-hint`}>{hint}</p>}
  </div>
);

const Callout = ({ tone = 'info', icon, children }) => {
  const tones = {
    info: 'text-secondary bg-secondary/[0.07] border-secondary/25',
    warn: 'text-tertiary bg-tertiary/[0.08] border-tertiary/30',
  };
  return (
    <div role="note" className={`flex items-start gap-2 p-space-sm rounded-xl border text-xs ${tones[tone]}`}>
      <Icon name={icon || (tone === 'warn' ? 'warning' : 'info')} className="text-base shrink-0" />
      <p className="text-on-surface-variant">{children}</p>
    </div>
  );
};

// Row with a label, optional description and an on/off switch.
const SwitchRow = ({ id, label, description, checked, onChange, disabled = false }) => (
  <div className={`flex items-center justify-between gap-4 p-space-sm rounded-xl border transition-colors ${disabled ? 'opacity-60' : 'hover:border-secondary/40'} ${checked ? 'bg-secondary/[0.06] border-secondary/25' : 'bg-surface-container-low border-outline-variant/20'}`}>
    <label htmlFor={id} className={`flex-1 select-none ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
      <span className="text-sm font-semibold text-on-surface block">{label}</span>
      {description && <span className="text-xs text-on-surface-variant block mt-0.5">{description}</span>}
    </label>
    <button
      id={id} type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-11 h-6 rounded-full border transition-all duration-300 active:scale-95 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${focusRing} ${checked ? 'bg-secondary border-secondary' : 'bg-surface-container-highest border-outline-variant/50'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow-md transition-all duration-300 flex items-center justify-center ${checked ? 'translate-x-5 bg-on-secondary' : 'bg-outline'}`}>
        {checked && <Icon name="check" className="text-[12px] text-secondary font-bold" />}
      </span>
      <span className="sr-only">{checked ? 'On' : 'Off'}</span>
    </button>
  </div>
);

const selectCls = 'w-full appearance-none pl-space-md pr-10 py-2.5 rounded-xl bg-surface-container-low text-on-surface border border-outline-variant/30 text-sm cursor-pointer transition hover:border-secondary/40 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed';

const SelectBox = ({ id, value, onChange, options, describedBy }) => (
  <div className="relative">
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={describedBy} className={selectCls}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <Icon name="expand_more" className="pointer-events-none absolute right-3 top-2.5 text-base text-outline" />
  </div>
);

// A small set of mutually exclusive choices shown side by side.
const Segmented = ({ id, value, onChange, options }) => (
  <div id={id} role="radiogroup" aria-labelledby={`${id}-label`} className="inline-flex w-full p-1 gap-1 rounded-xl bg-surface-container-low border border-outline-variant/30">
    {options.map((o) => {
      const on = value === o.value;
      return (
        <button
          key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition cursor-pointer active:scale-95 ${focusRing} ${on ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}`}
        >
          {o.icon && <Icon name={o.icon} className="text-base" />}{o.label}
        </button>
      );
    })}
  </div>
);

const RangeField = ({ id, value, min, max, onChange, unit, disabled }) => (
  <div className="flex items-center gap-space-md">
    <input
      id={id} type="range" min={min} max={max} step="1" value={value} disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))} aria-valuetext={`${value} ${unit}`}
      className="st-range flex-1" style={{ '--p': `${((value - min) / (max - min)) * 100}%` }}
    />
    <span className="w-14 text-right text-sm font-semibold text-on-surface tabular-nums">{value}{unit}</span>
  </div>
);

const Chip = ({ children, tone = 'secondary', pulse = false }) => {
  const tones = {
    secondary: 'text-secondary bg-secondary/10 border-secondary/25',
    primary: 'text-primary bg-primary/10 border-primary/25',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${tones[tone]}`}>
      {pulse && (
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          <span className="st-ping absolute inline-flex h-full w-full rounded-full bg-secondary" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-secondary" />
        </span>
      )}
      {children}
    </span>
  );
};

/* ==========================================================================
   4. SECTIONS
   ========================================================================== */

// Every section receives: draft, set, editedCount, onRevert, delay.

const WorkspaceSection = ({ draft, set, editedCount, onRevert, delay }) => (
  <Card id="workspace" delay={delay}>
    <SectionHeading sectionId="workspace" icon="workspaces" iconClass="text-primary" title="Workspace" description="How sprints, capacity and time are set up for everyone." editedCount={editedCount} onRevert={onRevert} />

    <Group title="Planning">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
        <Field id="st-sprint" label="Sprint length" group>
          <Segmented id="st-sprint" value={draft.sprintLength} onChange={(v) => set('sprintLength', v)} options={[{ value: '7', label: '1 week' }, { value: '14', label: '2 weeks' }, { value: '21', label: '3 weeks' }]} />
        </Field>
        <Field id="st-capacity" label="Weekly capacity per person" hint="Used to decide who is overbooked or on the bench.">
          <RangeField id="st-capacity" value={draft.capacity} min={20} max={60} unit="h" onChange={(v) => set('capacity', v)} />
        </Field>
      </div>
    </Group>

    <Divider />

    <Group title="Time & start page">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
        <Field id="st-weekstart" label="Week starts on" group>
          <Segmented id="st-weekstart" value={draft.weekStart} onChange={(v) => set('weekStart', v)} options={[{ value: 'mon', label: 'Monday' }, { value: 'sun', label: 'Sunday' }]} />
        </Field>
        <Field id="st-tz" label="Time zone" hint="Dates and meeting overlaps use this zone.">
          <SelectBox id="st-tz" value={draft.timezone} onChange={(v) => set('timezone', v)} options={TIMEZONES} />
        </Field>
        <Field id="st-landing" label="Open on sign-in">
          <SelectBox id="st-landing" value={draft.landing} onChange={(v) => set('landing', v)} options={LANDING} />
        </Field>
      </div>
    </Group>
  </Card>
);

// One selectable palette: a mini preview of its colors plus a name.
const PaletteCard = ({ palette, selected, onSelect }) => {
  const p = palette.preview;
  return (
    <button
      type="button" role="radio" aria-checked={selected} onClick={onSelect}
      className={`text-left rounded-xl border p-2 transition active:scale-[.98] cursor-pointer ${focusRing} ${
        selected ? 'border-secondary bg-secondary/[0.07] ring-1 ring-secondary/60' : 'border-outline-variant/30 bg-surface-container-low hover:border-secondary/40'
      }`}
    >
      <span className="block rounded-lg p-2" style={{ background: p.bg, border: '1px solid rgba(128,128,128,.25)' }} aria-hidden="true">
        <span className="block rounded-md p-1.5" style={{ background: p.card }}>
          <span className="block h-1.5 w-2/3 rounded-full mb-1.5" style={{ background: p.text, opacity: 0.75 }} />
          <span className="flex gap-1">
            {[p.p, p.s, p.t].map((c, i) => <span key={i} className="h-3 flex-1 rounded-full" style={{ background: c }} />)}
          </span>
        </span>
      </span>
      <span className="mt-2 flex items-center justify-between gap-1">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-on-surface truncate">{palette.name}</span>
          <span className="block text-xs text-on-surface-variant truncate">{palette.description}</span>
        </span>
        {selected && <Icon name="check_circle" className="text-base text-secondary shrink-0" />}
      </span>
    </button>
  );
};

// A labelled set of palettes for one mode (dark or light).
const PaletteGroup = ({ id, mode, value, onChange, inUse }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2">
      <Icon name={mode === 'dark' ? 'dark_mode' : 'light_mode'} className="text-base text-outline" />
      <span id={`${id}-label`} className="text-sm font-semibold text-on-surface">{mode === 'dark' ? 'Dark mode colors' : 'Light mode colors'}</span>
      {inUse && (
        <span className="st-pop text-xs text-secondary bg-secondary/10 border border-secondary/25 px-2 py-0.5 rounded-full">In use now</span>
      )}
    </div>
    <div id={id} role="radiogroup" aria-labelledby={`${id}-label`} className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {PALETTES[mode].map((pal) => (
        <PaletteCard key={pal.id} palette={pal} selected={value === pal.id} onSelect={() => onChange(pal.id)} />
      ))}
    </div>
  </div>
);

const AppearanceSection = ({ draft, set, editedCount, onRevert, delay }) => {
  const activeMode = resolveMode(draft.theme);
  return (
    <Card id="appearance" delay={delay}>
      <SectionHeading sectionId="appearance" icon="palette" iconClass="text-tertiary" title="Appearance" description="Theme, colors, spacing and motion. These apply to your account only." editedCount={editedCount} onRevert={onRevert} />

      <Group title="Theme">
        <Field
          id="st-theme" label="Mode" group
          hint={draft.theme === 'system' ? `Following your device. It is ${activeMode} mode right now.` : 'Pick light or dark, or follow your device setting.'}
        >
          <Segmented id="st-theme" value={draft.theme} onChange={(v) => set('theme', v)} options={[{ value: 'light', label: 'Light', icon: 'light_mode' }, { value: 'dark', label: 'Dark', icon: 'dark_mode' }, { value: 'system', label: 'System', icon: 'contrast' }]} />
        </Field>
      </Group>

      <Divider />

      <Group title="Colors" description="Each mode has its own set of colors. Changes preview right away and are kept when you save.">
        <PaletteGroup id="st-dark-palette" mode="dark" value={draft.darkPalette} onChange={(v) => set('darkPalette', v)} inUse={activeMode === 'dark'} />
        <PaletteGroup id="st-light-palette" mode="light" value={draft.lightPalette} onChange={(v) => set('lightPalette', v)} inUse={activeMode === 'light'} />
      </Group>

      <Divider />

      <Group title="Layout">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
          <Field id="st-density" label="Density" hint="Compact fits more rows on screen." group>
            <Segmented id="st-density" value={draft.density} onChange={(v) => set('density', v)} options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]} />
          </Field>
        </div>
      </Group>

      <Divider />

      <Group title="Behavior">
        <div className="flex flex-col gap-2">
          <SwitchRow id="st-motion" checked={draft.reduceMotion} onChange={(v) => set('reduceMotion', v)} label="Reduce motion" description="Turns off page animations and transitions." />
          <SwitchRow id="st-hints" checked={draft.keyHints} onChange={(v) => set('keyHints', v)} label="Show keyboard shortcut hints" description="Displays hints such as “/” to search and Ctrl/⌘ + S to save." />
        </div>
      </Group>
    </Card>
  );
};

const TpuGauge = ({ value }) => {
  const shown = useTween(value);
  const circ = 2 * Math.PI * 18;
  return (
    <div className="relative w-16 h-16 shrink-0 flex items-center justify-center" role="img" aria-label={`TPU cap ${value} percent`}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
        <circle className="text-surface-container-highest" cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="4.5" />
        <circle
          className="text-secondary" cx="22" cy="22" r="18" fill="none"
          stroke="currentColor" strokeLinecap="round" strokeWidth="4.5"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - shown / 100)}
        />
      </svg>
      <span className="absolute text-sm font-bold text-on-surface tabular-nums">{Math.round(shown)}%</span>
    </div>
  );
};

const EngineSection = ({ draft, saved, set, canEditTpu, editedCount, onRevert, delay }) => {
  const isPreview = draft.engineVersion.includes('Preview');
  const versionHint =
    draft.engineVersion === saved.engineVersion
      ? 'This version is currently in use.'
      : 'Switching versions applies after you save.';
  return (
    <Card id="engine" delay={delay}>
      <SectionHeading sectionId="engine" icon="auto_awesome" iconClass="text-secondary" title="Neural engine" description="Choose which engine version runs your workspace and how much TPU it can use." editedCount={editedCount} onRevert={onRevert} />

      <Group title="Version">
        <Field id="st-version" label="Engine version" hint={versionHint}>
          <SelectBox
            id="st-version" value={draft.engineVersion} describedBy="st-version-hint"
            onChange={(v) => set('engineVersion', v)} options={ENGINE_VERSIONS}
          />
        </Field>
        {isPreview && (
          <Callout tone="warn">Preview builds may change before release. Try this version on non-critical work first.</Callout>
        )}
      </Group>

      <Divider />

      <Group title="Compute">
        <Field id="st-tpu" label="TPU usage cap" hint="A higher cap runs faster but leaves less room for other work." group>
          <div className="flex items-center gap-space-md">
            <TpuGauge value={draft.tpu} />
            <div className="flex-1 flex flex-col gap-2">
              <input
                id="st-tpu" type="range" min="50" max="100" step="1" value={draft.tpu} disabled={!canEditTpu}
                onChange={(e) => set('tpu', Number(e.target.value))} aria-labelledby="st-tpu-label" aria-describedby="st-tpu-hint"
                aria-valuetext={`${draft.tpu} percent`}
                className="st-range w-full" style={{ '--p': `${((draft.tpu - 50) / 50) * 100}%` }}
              />
              <div className="flex items-center justify-between text-xs text-outline">
                <span>50%</span>
                <div className="flex gap-1.5" role="group" aria-label="TPU cap presets">
                  {TPU_PRESETS.map((p) => (
                    <button
                      key={p} type="button" disabled={!canEditTpu} onClick={() => set('tpu', p)} aria-pressed={draft.tpu === p}
                      className={`px-2 py-0.5 rounded-full border transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${focusRing} ${draft.tpu === p ? 'border-secondary/50 bg-secondary/10 text-secondary' : 'border-outline-variant/30 hover:text-on-surface hover:border-outline'}`}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
                <span>100%</span>
              </div>
            </div>
          </div>
        </Field>
        {!canEditTpu && <Callout>The TPU cap is managed by your admin and can't be changed from this page.</Callout>}
        <SwitchRow
          id="st-burst" checked={draft.tpuBurst} onChange={(v) => set('tpuBurst', v)}
          label="Scale up automatically near sprint end"
          description="Lets the engine use extra TPU capacity on the last days of a sprint (Days 12–14)."
        />
      </Group>
    </Card>
  );
};

const NotificationsSection = ({ draft, set, editedCount, onRevert, delay }) => {
  const noChannel = !draft.notifyInApp && !draft.notifyEmail && !draft.notifySlack;
  return (
    <Card id="notifications" delay={delay}>
      <SectionHeading sectionId="notifications" icon="notifications" iconClass="text-tertiary" title="Notifications" description="Choose what you hear about, where, and when." editedCount={editedCount} onRevert={onRevert} />

      <Group title="What to alert">
        <SwitchRow id="st-clash" checked={draft.notifyClash} onChange={(v) => set('notifyClash', v)} label="Alert me when someone is double-booked" description="Sends an alert as soon as a person is booked over the limit below." />
        <Field id="st-overload" label="Overbooked above" hint="A person counts as overbooked past this many hours per week.">
          <RangeField id="st-overload" value={draft.overloadAt} min={36} max={60} unit="h" disabled={!draft.notifyClash} onChange={(v) => set('overloadAt', v)} />
        </Field>
      </Group>

      <Divider />

      <Group title="Where to send alerts">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <SwitchRow id="st-inapp" checked={draft.notifyInApp} onChange={(v) => set('notifyInApp', v)} label="In app" />
          <SwitchRow id="st-email" checked={draft.notifyEmail} onChange={(v) => set('notifyEmail', v)} label="Email" />
          <SwitchRow id="st-slack" checked={draft.notifySlack} onChange={(v) => set('notifySlack', v)} label="Slack" />
        </div>
        {noChannel && draft.notifyClash && (
          <Callout tone="warn">Every channel is off, so you won't receive any alerts. Turn on at least one.</Callout>
        )}
      </Group>

      <Divider />

      <Group title="Summaries">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
          <Field id="st-digest" label="Sprint burndown summary" hint="Sent to the Lead Architect." group>
            <Segmented id="st-digest" value={draft.digest} onChange={(v) => set('digest', v)} options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'off', label: 'Off' }]} />
          </Field>
        </div>
      </Group>

      <Divider />

      <Group title="Quiet hours">
        <SwitchRow id="st-quiet" checked={draft.quietHours} onChange={(v) => set('quietHours', v)} label="Pause alerts at night" description="Alerts wait until quiet hours end." />
        <div className="grid grid-cols-2 gap-space-md max-w-md">
          {[['quietFrom', 'From', 'st-qfrom'], ['quietTo', 'Until', 'st-qto']].map(([k, l, id]) => (
            <Field key={k} id={id} label={l}>
              <input id={id} type="time" value={draft[k]} disabled={!draft.quietHours} onChange={(e) => set(k, e.target.value)} className={`${selectCls} pr-3 cursor-text`} />
            </Field>
          ))}
        </div>
      </Group>
    </Card>
  );
};

const SecuritySection = ({ draft, set, editedCount, onRevert, delay }) => {
  const { copied, copy } = useCopy();
  return (
    <Card id="security" delay={delay}>
      <SectionHeading sectionId="security" icon="security" iconClass="text-primary" title="Security" description="Sign-in protection and the key used to verify your sandboxes." editedCount={editedCount} onRevert={onRevert} />

      <Group title="Sign-in protection">
        <div className="flex flex-col gap-2">
          <SwitchRow id="st-2fa" checked={draft.twoFactor} onChange={(v) => set('twoFactor', v)} label="Two-factor authentication" description="Ask for a code from your authenticator app when you sign in." />
          <SwitchRow id="st-signin" checked={draft.signInAlerts} onChange={(v) => set('signInAlerts', v)} label="Email me about new sign-ins" description="Get a message when your account is used on a new device." />
        </div>
        {!draft.twoFactor && (
          <Callout tone="warn">Without two-factor authentication, anyone with your password can sign in. We recommend keeping it on.</Callout>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
          <Field id="st-session" label="Sign out after being idle for">
            <SelectBox id="st-session" value={draft.sessionTimeout} onChange={(v) => set('sessionTimeout', v)} options={SESSION} />
          </Field>
        </div>
      </Group>

      <Divider />

      <Group title="Sandbox verification">
        <Field id="st-key" label="Verifier public key" hint="Read-only. It can't be edited here.">
          <div className="flex items-stretch gap-2">
            <input
              id="st-key" type="text" readOnly value={VERIFIER_KEY} onFocus={(e) => e.target.select()}
              className="st-mono flex-1 min-w-0 px-space-md py-2.5 rounded-xl bg-surface-container-low text-on-surface-variant border border-outline-variant/30 text-xs focus:outline-none focus:ring-2 focus:ring-secondary"
            />
            <button
              type="button" onClick={() => copy(VERIFIER_KEY)}
              className={`shrink-0 flex items-center gap-1.5 px-space-md rounded-xl border text-sm font-semibold transition-all active:scale-95 cursor-pointer ${focusRing} ${copied ? 'bg-secondary/15 border-secondary/40 text-secondary' : 'bg-surface-container-high border-outline-variant/30 text-on-surface hover:border-secondary/50'}`}
            >
              <Icon name={copied ? 'check' : 'content_copy'} className="text-sm" />
              <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <Chip pulse>Online · hash verified</Chip>
          <Chip tone="primary">120 FPS benchmark enforced</Chip>
        </div>
      </Group>
    </Card>
  );
};

const DataSection = ({ draft, set, editedCount, onRevert, onExport, delay }) => (
  <Card id="data" delay={delay}>
    <SectionHeading sectionId="data" icon="database" iconClass="text-secondary" title="Data & privacy" description="What Copilot can learn from, how long records are kept, and your exports." editedCount={editedCount} onRevert={onRevert} />

    <Group title="Privacy">
      <SwitchRow id="st-ai" checked={draft.aiLearning} onChange={(v) => set('aiLearning', v)} label="Let Copilot learn from my workspace" description="Uses your sprints and allocations to improve suggestions. It is never shared outside your workspace." />
    </Group>

    <Divider />

    <Group title="Retention & export">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
        <Field id="st-retention" label="Keep audit logs for" hint="Older entries are removed automatically.">
          <SelectBox id="st-retention" value={draft.retention} onChange={(v) => set('retention', v)} options={RETENTION} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-on-surface">Export workspace data</span>
          <button type="button" onClick={onExport} className={`self-start flex items-center gap-1.5 px-space-md py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-sm font-semibold border border-outline-variant/30 hover:border-secondary/50 transition active:scale-95 cursor-pointer ${focusRing}`}>
            <Icon name="file_download" className="text-base text-secondary" /> Download as JSON
          </button>
          <p className="text-xs text-on-surface-variant">Includes your saved settings. Unsaved edits are not exported.</p>
        </div>
      </div>
    </Group>
  </Card>
);

/* ==========================================================================
   5. PAGE CHROME
   ========================================================================== */

const PageHeader = ({ onReset }) => (
  <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-space-md mb-space-lg">
    <div className="flex flex-col">
      <p className="text-sm font-medium text-secondary mb-2 flex items-center gap-1.5">
        <Icon name="tune" className="text-base" /> Settings
      </p>
      <h1 className="font-semibold text-on-surface" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', letterSpacing: '-0.025em', lineHeight: 1.15 }}>Workspace settings</h1>
      <p className="text-sm text-on-surface-variant max-w-xl mt-2">
        Set up your workspace, tune the neural engine, and control alerts, security and data. Changes stay as a draft until you save.
      </p>
    </div>
    <button type="button" onClick={onReset} className={`self-start sm:self-auto flex items-center gap-1.5 px-space-md py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-sm font-medium border border-outline-variant/30 hover:border-secondary/50 transition active:scale-95 cursor-pointer ${focusRing}`}>
      <Icon name="restart_alt" className="text-base text-secondary" /> Reset to defaults
    </button>
  </header>
);

// At-a-glance summary of the current (draft) settings. Each card jumps to its section.
const StatusOverview = ({ draft, onSelect }) => {
  const [ver, ...rest] = draft.engineVersion.split(' ');
  const alertsOn = [draft.notifyInApp, draft.notifyEmail, draft.notifySlack].filter(Boolean).length;
  const items = [
    { id: 'engine', label: 'Engine', value: ver, sub: rest.join(' '), icon: 'auto_awesome', cls: 'text-secondary' },
    { id: 'engine', label: 'TPU cap', value: `${draft.tpu}%`, sub: draft.tpuBurst ? 'Auto-scale on' : 'Auto-scale off', icon: 'speed', cls: 'text-primary' },
    { id: 'security', label: 'Security', value: draft.twoFactor ? '2FA on' : '2FA off', sub: `Idle sign-out ${formatTimeout(draft.sessionTimeout)}`, icon: 'verified_user', cls: draft.twoFactor ? 'text-secondary' : 'text-tertiary' },
    { id: 'notifications', label: 'Alerts', value: draft.notifyClash ? `${alertsOn} of 3 channels` : 'Alerts off', sub: draft.quietHours ? `Quiet ${draft.quietFrom}–${draft.quietTo}` : 'No quiet hours', icon: 'notifications_active', cls: 'text-tertiary' },
  ];
  return (
    <div role="region" aria-label="Current settings summary" className="grid grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-lg">
      {items.map((it) => (
        <button
          key={it.label} type="button" onClick={() => onSelect(it.id)}
          className={`text-left flex items-center gap-3 min-w-0 rounded-2xl bg-surface-container/50 border border-outline-variant/30 p-space-md transition hover:border-secondary/40 hover:bg-surface-container/80 cursor-pointer active:scale-[.98] ${focusRing}`}
        >
          <span className={`material-symbols-outlined text-xl p-2 rounded-xl bg-surface-container-high shrink-0 ${it.cls}`} aria-hidden="true">{it.icon}</span>
          <span className="min-w-0 block">
            <span className="block text-xs text-on-surface-variant">{it.label}</span>
            <span className={`block text-lg font-semibold leading-tight truncate ${it.cls}`}>{it.value}</span>
            <span className="block text-xs text-outline truncate">{it.sub}</span>
          </span>
        </button>
      ))}
    </div>
  );
};

// Grouped section navigation. Horizontal chips on small screens, labelled groups on large.
const SectionNav = ({ active, onSelect, counts }) => {
  let lastGroup = null;
  return (
    <nav aria-label="Settings sections" className="lg:sticky lg:top-24 self-start">
      <ul className="flex lg:flex-col gap-1 p-1.5 overflow-x-auto rounded-2xl bg-surface-container-low/70 border border-outline-variant/30">
        {NAV.map((n) => {
          const on = active === n.id;
          const showGroup = n.group !== lastGroup;
          lastGroup = n.group;
          return (
            <React.Fragment key={n.id}>
              {showGroup && (
                <li aria-hidden="true" className="hidden lg:block px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-outline first:pt-1.5">
                  {n.group}
                </li>
              )}
              <li className="shrink-0">
                <button
                  type="button" onClick={() => onSelect(n.id)} aria-current={on ? 'true' : undefined}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm whitespace-nowrap text-left transition cursor-pointer active:scale-95 ${focusRing} ${on ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}`}
                >
                  <Icon name={n.icon} className="text-base" />
                  <span className="flex-1">{n.label}</span>
                  {counts[n.id] > 0 && (
                    <span className="min-w-[1.25rem] px-1.5 text-center text-[11px] font-semibold rounded-full bg-tertiary/15 text-tertiary" title="Unsaved changes" aria-label={`${counts[n.id]} unsaved ${counts[n.id] === 1 ? 'change' : 'changes'}`}>
                      {counts[n.id]}
                    </span>
                  )}
                </button>
              </li>
            </React.Fragment>
          );
        })}
      </ul>
    </nav>
  );
};

const SaveBar = ({ dirtyCount, editedNames, justSaved, onSave, onDiscard }) => {
  const dirty = dirtyCount > 0;
  return (
    <div className={`sticky bottom-6 z-30 flex flex-wrap items-center justify-between gap-3 px-space-md py-3 rounded-2xl backdrop-blur-xl border shadow-2xl transition-all duration-300 ${dirty ? 'bg-surface-container-lowest/95 border-tertiary/40' : 'bg-surface-container/70 border-outline-variant/30'}`}>
      <div className="flex items-center gap-2 text-sm min-w-0" aria-live="polite">
        {dirty ? (
          <>
            <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
              <span className="st-ping absolute inline-flex h-full w-full rounded-full bg-tertiary" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-tertiary" />
            </span>
            <span className="min-w-0">
              <span className="font-semibold text-on-surface">{dirtyCount} unsaved {dirtyCount === 1 ? 'change' : 'changes'}</span>
              <span className="block text-xs text-on-surface-variant truncate">in {editedNames.join(', ')}</span>
            </span>
          </>
        ) : (
          <>
            <Icon name="check_circle" className={`text-base ${justSaved ? 'text-secondary' : 'text-outline'}`} />
            <span className={justSaved ? 'text-secondary font-semibold' : 'text-on-surface-variant'}>
              {justSaved ? 'Settings saved' : 'All changes saved'}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-space-sm">
        <span className="hidden md:inline text-xs text-outline">Ctrl/⌘ + S to save</span>
        <button
          type="button" onClick={onDiscard} disabled={!dirty}
          className={`px-space-md py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-sm font-semibold border border-outline-variant/30 transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer ${focusRing}`}
        >
          Discard
        </button>
        <button
          type="button" onClick={onSave} disabled={!dirty}
          className={`px-space-lg py-2 rounded-xl bg-gradient-to-r from-primary to-secondary text-on-primary font-semibold text-sm shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none cursor-pointer ${focusRing}`}
        >
          Save changes
        </button>
      </div>
    </div>
  );
};

const Toast = ({ message, onDismiss }) => (
  <div className="fixed left-4 right-4 sm:left-auto sm:right-8 top-20 z-50 flex justify-center sm:justify-end pointer-events-none" aria-live="polite">
    {message && (
      <div className="st-pop pointer-events-auto max-w-md flex items-start gap-2 p-space-sm pr-2 rounded-xl bg-surface-container-lowest/95 backdrop-blur-xl border border-secondary/40 text-secondary text-sm font-medium shadow-2xl">
        <Icon name="check_circle" className="text-sm mt-0.5" />
        <span className="flex-1">{message}</span>
        <button type="button" onClick={onDismiss} aria-label="Dismiss message" className={`p-0.5 rounded text-outline hover:text-on-surface cursor-pointer ${focusRing}`}>
          <Icon name="close" className="text-sm" />
        </button>
      </div>
    )}
  </div>
);

/* ==========================================================================
   6. PAGE
   ========================================================================== */

export const SettingsPage = ({ tpuUsage, setTpuUsage, onSettingsSave, themePrefs, onThemePreview, onThemeSave }) => {
  // `saved` is what's applied; `draft` is what's on screen until you save.
  const initial = useMemo(
    () => ({
      ...DEFAULTS,
      tpu: tpuUsage ?? DEFAULTS.tpu,
      ...(themePrefs ? Object.fromEntries(THEME_KEYS.map((k) => [k, themePrefs[k] ?? DEFAULTS[k]])) : {}),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [justSaved, setJustSaved] = useState(false);
  const toast = useToast();
  const savedTimer = useRef(null);
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const [activeSection, setActiveSection] = useScrollSpy(SECTION_IDS);

  const set = useCallback((key, value) => setDraft((d) => ({ ...d, [key]: value })), []);

  // Keep the TPU value in step if the parent changes it while nothing is being edited.
  useEffect(() => {
    if (tpuUsage == null) return;
    const prev = savedRef.current.tpu;
    setSaved((s) => (s.tpu === tpuUsage ? s : { ...s, tpu: tpuUsage }));
    setDraft((d) => (d.tpu === prev ? { ...d, tpu: tpuUsage } : d));
  }, [tpuUsage]);

  // If the theme changes elsewhere (for example the header toggle), follow it.
  useEffect(() => {
    if (!themePrefs) return;
    const changed = THEME_KEYS.filter((k) => themePrefs[k] !== savedRef.current[k]);
    if (!changed.length) return;
    const patch = Object.fromEntries(changed.map((k) => [k, themePrefs[k]]));
    setSaved((s) => ({ ...s, ...patch }));
    setDraft((d) => ({ ...d, ...patch }));
  }, [themePrefs]);

  // Live preview: show the draft theme across the app while editing.
  useEffect(() => {
    onThemePreview?.({ theme: draft.theme, darkPalette: draft.darkPalette, lightPalette: draft.lightPalette });
  }, [draft.theme, draft.darkPalette, draft.lightPalette, onThemePreview]);

  // Leaving the page drops any unsaved preview, so the saved theme comes back.
  useEffect(() => () => onThemePreview?.(null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const changedKeys = useMemo(() => Object.keys(draft).filter((k) => draft[k] !== saved[k]), [draft, saved]);
  const dirtyCount = changedKeys.length;
  const counts = useMemo(
    () => Object.fromEntries(Object.entries(SECTION_KEYS).map(([id, keys]) => [id, keys.filter((k) => changedKeys.includes(k)).length])),
    [changedKeys]
  );
  const editedNames = SECTION_IDS.filter((id) => counts[id] > 0).map((id) => LABEL_OF[id]);

  const handleSave = useCallback(() => {
    if (!dirtyCount) return;
    if (draft.tpu !== saved.tpu) setTpuUsage?.(draft.tpu);
    if (THEME_KEYS.some((k) => draft[k] !== saved[k])) {
      onThemeSave?.({ theme: draft.theme, darkPalette: draft.darkPalette, lightPalette: draft.lightPalette });
    }
    setSaved(draft);
    onSettingsSave?.(draft);
    setJustSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setJustSaved(false), 2500);
    toast.show('Workspace settings saved.');
  }, [dirtyCount, draft, saved, setTpuUsage, onThemeSave, onSettingsSave, toast]);

  const handleReset = useCallback(() => {
    setDraft({ ...DEFAULTS, tpu: saved.tpu });
    toast.show('Defaults restored. Save to apply them.');
  }, [saved.tpu, toast]);

  const handleDiscard = useCallback(() => {
    setDraft(saved);
    toast.show('Changes discarded.');
  }, [saved, toast]);

  const revertSection = useCallback((id) => {
    setDraft((d) => {
      const next = { ...d };
      SECTION_KEYS[id].forEach((k) => { next[k] = savedRef.current[k]; });
      return next;
    });
    toast.show(`${LABEL_OF[id]} changes reverted.`);
  }, [toast]);

  // Downloads the saved settings as a JSON file.
  const handleExport = useCallback(() => {
    try {
      const payload = JSON.stringify({ exportedAt: new Date().toISOString(), settings: saved }, null, 2);
      const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'workspace-settings.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.show('Workspace export downloaded.');
    } catch {
      toast.show('Export failed. Please try again.');
    }
  }, [saved, toast]);

  useEffect(() => () => clearTimeout(savedTimer.current), []);

  // Ctrl/Cmd+S saves.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSave]);

  // Warn before closing the tab with unsaved edits.
  useEffect(() => {
    if (!dirtyCount) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirtyCount]);

  const goTo = (id) => {
    setActiveSection(id);
    document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  };

  const common = (id, i) => ({ draft, set, editedCount: counts[id], onRevert: () => revertSection(id), delay: i * 60 });

  return (
    <div className="st-root relative isolate flex flex-col w-full max-w-6xl mx-auto pb-32 pt-space-md">
      <style>{`
        @keyframes stEnter { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @keyframes stPop { from { opacity: 0; transform: translateY(6px) scale(.97); } to { opacity: 1; transform: none; } }
        @keyframes stPing { 0% { transform: scale(1); opacity: .7; } 100% { transform: scale(2.6); opacity: 0; } }
        .st-root { font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }
        .st-root .st-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
        .st-enter { animation: stEnter .5s cubic-bezier(.2,.7,.2,1) both; }
        .st-pop { animation: stPop .2s ease-out both; }
        .st-ping { animation: stPing 1.8s ease-out infinite; }

        /* Sliders follow the active palette's secondary color */
        .st-range { -webkit-appearance: none; appearance: none; height: 8px; border-radius: 999px; outline: none; cursor: pointer;
          background: linear-gradient(to right, var(--color-secondary, #2bd9ff) var(--p, 50%), rgba(148,163,184,.25) var(--p, 50%)); }
        .st-range:disabled { opacity: .5; cursor: not-allowed; }
        .st-range::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #fff; border: 3px solid var(--color-secondary, #2bd9ff);
          box-shadow: 0 0 12px rgba(var(--glow-b, 43, 217, 255), .6); transition: transform .15s ease, box-shadow .15s ease; }
        .st-range::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 3px solid var(--color-secondary, #2bd9ff); box-shadow: 0 0 12px rgba(var(--glow-b, 43, 217, 255), .6); }
        .st-range:hover::-webkit-slider-thumb { transform: scale(1.15); }
        .st-range:active::-webkit-slider-thumb { transform: scale(1.25); box-shadow: 0 0 18px rgba(var(--glow-b, 43, 217, 255), .85); }
        .st-range:focus-visible { box-shadow: 0 0 0 3px rgba(var(--glow-b, 43, 217, 255), .35); }

        @media (prefers-reduced-motion: reduce) {
          .st-enter, .st-pop, .st-ping { animation: none !important; }
          .st-range::-webkit-slider-thumb { transition: none; }
        }
      `}</style>

      <PageHeader onReset={handleReset} />
      <StatusOverview draft={draft} onSelect={goTo} />

      <div className="grid grid-cols-1 lg:grid-cols-[210px_minmax(0,1fr)] gap-space-lg items-start">
        <SectionNav active={activeSection} onSelect={goTo} counts={counts} />

        <main className="flex flex-col gap-space-lg min-w-0">
          <WorkspaceSection {...common('workspace', 0)} />
          <AppearanceSection {...common('appearance', 1)} />
          <EngineSection {...common('engine', 2)} saved={saved} canEditTpu={!!setTpuUsage} />
          <NotificationsSection {...common('notifications', 3)} />
          <SecuritySection {...common('security', 4)} />
          <DataSection {...common('data', 5)} onExport={handleExport} />
          <BillingSection delay={6 * 60} onNotify={toast.show} />
          <SaveBar dirtyCount={dirtyCount} editedNames={editedNames} justSaved={justSaved} onSave={handleSave} onDiscard={handleDiscard} />
        </main>
      </div>

      <Toast message={toast.message} onDismiss={toast.dismiss} />
    </div>
  );
};