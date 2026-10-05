import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ==========================================================================
   SettingsPage
   --------------------------------------------------------------------------
   1. Constants        engine versions, nav items, public key
   2. Hooks            number tween, toast, copy-to-clipboard, scroll-spy
   3. UI primitives    Icon, SpotlightCard, SwitchRow, Field, Chip
   4. Sections         Engine, Security, Notifications
   5. Page chrome      header, section nav, save bar, toast
   6. Page             state (draft vs saved) + composition
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

const NAV = [
  { id: 'workspace', label: 'Workspace', icon: 'workspaces' },
  { id: 'engine', label: 'Neural engine', icon: 'auto_awesome' },
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications' },
  { id: 'security', label: 'Security', icon: 'security' },
  { id: 'data', label: 'Data & privacy', icon: 'database' },
];

const DEFAULTS = {
  // workspace
  capacity: 40, sprintLength: '14', weekStart: 'mon', timezone: 'UTC', landing: 'projects',
  // engine
  engineVersion: 'v3.4.2 Quantum', tpu: 78, tpuBurst: true,
  // appearance
  theme: 'system', density: 'comfortable', reduceMotion: false, keyHints: true,
  // notifications
  notifyClash: true, notifyEmail: true, notifyInApp: true, notifySlack: false,
  overloadAt: 40, digest: 'daily', quietHours: false, quietFrom: '22:00', quietTo: '07:00',
  // security
  twoFactor: true, signInAlerts: true, sessionTimeout: '60',
  // data
  aiLearning: true, retention: '90',
};

// Which draft keys belong to which section (drives the "Edited" badges and nav dots).
const SECTION_KEYS = {
  workspace: ['capacity', 'sprintLength', 'weekStart', 'timezone', 'landing'],
  engine: ['engineVersion', 'tpu', 'tpuBurst'],
  appearance: ['theme', 'density', 'reduceMotion', 'keyHints'],
  notifications: ['notifyClash', 'notifyEmail', 'notifyInApp', 'notifySlack', 'overloadAt', 'digest', 'quietHours', 'quietFrom', 'quietTo'],
  security: ['twoFactor', 'signInAlerts', 'sessionTimeout'],
  data: ['aiLearning', 'retention'],
};

const TIMEZONES = ['UTC', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Asia/Kolkata', 'Asia/Singapore'].map((v) => ({ value: v, label: v.replace('_', ' ') }));
const LANDING = [{ value: 'dashboard', label: 'Dashboard' }, { value: 'projects', label: 'Projects' }, { value: 'sprints', label: 'Sprints' }, { value: 'team', label: 'Team' }];
const SESSION = [{ value: '15', label: '15 minutes' }, { value: '60', label: '1 hour' }, { value: '240', label: '4 hours' }, { value: '1440', label: '24 hours' }];
const RETENTION = [{ value: '30', label: '30 days' }, { value: '90', label: '90 days' }, { value: '365', label: '1 year' }];

const TPU_PRESETS = [60, 80, 100];

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary';

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

const SpotlightCard = ({ id, className = '', delay = 0, children }) => (
  <section
    id={id} style={{ animationDelay: `${delay}ms` }}
    className={`st-enter relative scroll-mt-24 rounded-2xl bg-surface-container/60 border border-outline-variant/30 transition-[border-color] duration-300 hover:border-secondary/30 ${className}`}
  >
    <div className="flex flex-col gap-space-md p-space-lg">{children}</div>
  </section>
);

const SectionHeading = ({ icon, iconClass, title, description, modified }) => (
  <div className="flex items-start gap-3 border-b border-outline-variant/20 pb-space-sm">
    <div className={`w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center shrink-0 shadow-inner ${iconClass}`}>
      <Icon name={icon} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
        {modified && (
          <span className="st-pop inline-flex items-center gap-1 font-mono text-xs text-tertiary bg-tertiary/10 border border-tertiary/20 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary" /> Edited
          </span>
        )}
      </div>
      <p className="text-sm text-on-surface-variant">{description}</p>
    </div>
  </div>
);

const Field = ({ id, label, hint, children }) => (
  <div className="flex flex-col gap-1.5">
    <label id={`${id}-label`} htmlFor={id} className="text-sm font-semibold text-on-surface">{label}</label>
    {children}
    {hint && <p className="text-xs text-on-surface-variant" id={`${id}-hint`}>{hint}</p>}
  </div>
);

// Row with a label, optional description and an on/off switch.
const SwitchRow = ({ id, label, description, checked, onChange }) => (
  <div className={`flex items-center justify-between gap-4 p-space-sm rounded-xl border transition-colors ${checked ? 'bg-secondary/[0.06] border-secondary/25' : 'bg-surface-container-low border-outline-variant/20'} hover:border-secondary/40`}>
    <label htmlFor={id} className="flex-1 cursor-pointer select-none">
      <span className="text-sm font-semibold text-on-surface block">{label}</span>
      {description && <span className="text-xs text-on-surface-variant block mt-0.5">{description}</span>}
    </label>
    <button
      id={id} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-11 h-6 rounded-full border transition-all duration-300 cursor-pointer active:scale-95 ${focusRing} ${checked ? 'bg-secondary border-secondary' : 'bg-surface-container-highest border-outline-variant/50'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow-md transition-all duration-300 flex items-center justify-center ${checked ? 'translate-x-5 bg-on-secondary' : 'bg-outline'}`}>
        <Icon name={checked ? 'check' : ''} className="text-[12px] text-secondary font-bold" />
      </span>
      <span className="sr-only">{checked ? 'On' : 'Off'}</span>
    </button>
  </div>
);

const selectCls = 'w-full appearance-none pl-space-md pr-10 py-2.5 rounded-xl bg-surface-container-low text-on-surface border border-outline-variant/30 text-sm cursor-pointer transition hover:border-secondary/40 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent disabled:opacity-50';

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

const SubGroup = ({ title, children }) => (
  <div className="flex flex-col gap-2">
    <p className="text-xs font-medium text-outline">{title}</p>
    {children}
  </div>
);

const RangeField = ({ id, value, min, max, onChange, unit, disabled }) => (
  <div className="flex items-center gap-space-md">
    <input
      id={id} type="range" min={min} max={max} step="1" value={value} disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))} aria-valuetext={`${value} ${unit}`}
      className="st-range flex-1" style={{ '--p': `${((value - min) / (max - min)) * 100}%` }}
    />
    <span className="w-16 text-right text-sm font-semibold text-on-surface tabular-nums">{value}{unit}</span>
  </div>
);

const Chip = ({ children, tone = 'secondary', pulse = false }) => {
  const tones = {
    secondary: 'text-secondary bg-secondary/10 border-secondary/25',
    primary: 'text-primary bg-primary/10 border-primary/25',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-full border ${tones[tone]}`}>
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
      <span className="absolute font-mono text-sm font-bold text-on-surface tabular-nums">{Math.round(shown)}%</span>
    </div>
  );
};

const EngineSection = ({ draft, saved, set, canEditTpu, modified }) => {
  const version = ENGINE_VERSIONS.find((v) => v.value === draft.engineVersion);
  const versionHint =
    draft.engineVersion === saved.engineVersion
      ? 'This version is currently in use.'
      : draft.engineVersion.includes('Preview')
        ? 'Preview builds may change before release. Try it on non-critical work first.'
        : 'Switching versions applies after you save.';
  return (
    <SpotlightCard id="settings-engine" delay={0}>
      <SectionHeading icon="auto_awesome" iconClass="text-secondary" title="Neural engine" description="Choose which engine version runs your workspace and how much TPU it can use." modified={modified} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
        <Field id="st-version" label="Engine version" hint={versionHint}>
          <div className="relative">
            <select
              id="st-version" value={draft.engineVersion} onChange={(e) => set('engineVersion', e.target.value)} aria-describedby="st-version-hint"
              className={`w-full appearance-none pl-space-md pr-10 py-2.5 rounded-xl bg-surface-container-low text-on-surface border border-outline-variant/30 text-sm cursor-pointer transition hover:border-secondary/40 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent`}
            >
              {ENGINE_VERSIONS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
            <Icon name="expand_more" className="pointer-events-none absolute right-3 top-2.5 text-base text-outline" />
          </div>
          <span className="sr-only">{version?.label}</span>
        </Field>

        <Field id="st-tpu" label="TPU usage cap" hint="Limits how much TPU time the engine may use. A higher cap runs faster but leaves less room for other work.">
          <div className="flex items-center gap-space-md">
            <TpuGauge value={draft.tpu} />
            <div className="flex-1 flex flex-col gap-2">
              <input
                id="st-tpu" type="range" min="50" max="100" step="1" value={draft.tpu} disabled={!canEditTpu}
                onChange={(e) => set('tpu', Number(e.target.value))} aria-describedby="st-tpu-hint"
                aria-valuetext={`${draft.tpu} percent`}
                className="st-range w-full" style={{ '--p': `${((draft.tpu - 50) / 50) * 100}%` }}
              />
              <div className="flex items-center justify-between font-mono text-xs text-outline">
                <span>50%</span>
                <div className="flex gap-1.5" role="group" aria-label="TPU cap presets">
                  {TPU_PRESETS.map((p) => (
                    <button
                      key={p} type="button" disabled={!canEditTpu} onClick={() => set('tpu', p)} aria-pressed={draft.tpu === p}
                      className={`px-2 py-0.5 rounded-full border transition active:scale-95 disabled:opacity-50 ${focusRing} ${draft.tpu === p ? 'border-secondary/50 bg-secondary/10 text-secondary' : 'border-outline-variant/30 hover:text-on-surface hover:border-outline'}`}
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
      </div>

      <SwitchRow
        id="st-burst" checked={draft.tpuBurst} onChange={(v) => set('tpuBurst', v)}
        label="Scale up automatically near sprint end"
        description="Lets the engine use extra TPU capacity on the last days of a sprint (Days 12–14)."
      />
    </SpotlightCard>
  );
};

const WorkspaceSection = ({ draft, set, modified }) => (
  <SpotlightCard id="settings-workspace" delay={0}>
    <SectionHeading icon="workspaces" iconClass="text-primary" title="Workspace" description="How sprints, capacity and time are set up for everyone." modified={modified} />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
      <Field id="st-capacity" label="Weekly capacity per person" hint="Used to decide who is overbooked or on the bench.">
        <RangeField id="st-capacity" value={draft.capacity} min={20} max={60} unit="h" onChange={(v) => set('capacity', v)} />
      </Field>
      <Field id="st-sprint" label="Sprint length">
        <Segmented id="st-sprint" value={draft.sprintLength} onChange={(v) => set('sprintLength', v)} options={[{ value: '7', label: '1 week' }, { value: '14', label: '2 weeks' }, { value: '21', label: '3 weeks' }]} />
      </Field>
      <Field id="st-weekstart" label="Week starts on">
        <Segmented id="st-weekstart" value={draft.weekStart} onChange={(v) => set('weekStart', v)} options={[{ value: 'mon', label: 'Monday' }, { value: 'sun', label: 'Sunday' }]} />
      </Field>
      <Field id="st-tz" label="Time zone" hint="Dates and meeting overlaps are shown in this zone.">
        <SelectBox id="st-tz" value={draft.timezone} onChange={(v) => set('timezone', v)} options={TIMEZONES} />
      </Field>
      <Field id="st-landing" label="Open this page on sign-in">
        <SelectBox id="st-landing" value={draft.landing} onChange={(v) => set('landing', v)} options={LANDING} />
      </Field>
    </div>
  </SpotlightCard>
);

const AppearanceSection = ({ draft, set, modified }) => (
  <SpotlightCard id="settings-appearance" delay={120}>
    <SectionHeading icon="palette" iconClass="text-tertiary" title="Appearance" description="Theme, spacing and motion. These apply to your account only." modified={modified} />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
      <Field id="st-theme" label="Theme">
        <Segmented id="st-theme" value={draft.theme} onChange={(v) => set('theme', v)} options={[{ value: 'light', label: 'Light', icon: 'light_mode' }, { value: 'dark', label: 'Dark', icon: 'dark_mode' }, { value: 'system', label: 'System', icon: 'contrast' }]} />
      </Field>
      <Field id="st-density" label="Density" hint="Compact fits more rows on screen.">
        <Segmented id="st-density" value={draft.density} onChange={(v) => set('density', v)} options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]} />
      </Field>
    </div>
    <div className="flex flex-col gap-2">
      <SwitchRow id="st-motion" checked={draft.reduceMotion} onChange={(v) => set('reduceMotion', v)} label="Reduce motion" description="Turns off page animations and transitions." />
      <SwitchRow id="st-hints" checked={draft.keyHints} onChange={(v) => set('keyHints', v)} label="Show keyboard shortcut hints" description="Displays hints such as “/” to search and Ctrl/⌘ + S to save." />
    </div>
  </SpotlightCard>
);

const NotificationsSection = ({ draft, set, modified }) => (
  <SpotlightCard id="settings-notifications" delay={160}>
    <SectionHeading icon="notifications" iconClass="text-tertiary" title="Notifications" description="Choose what you hear about, where, and when." modified={modified} />

    <SubGroup title="What to alert">
      <SwitchRow id="st-clash" checked={draft.notifyClash} onChange={(v) => set('notifyClash', v)} label="Alert me when someone is double-booked" description="Sends an alert as soon as a person is booked over the limit below." />
      <Field id="st-overload" label="Overbooked above" hint="A person counts as overbooked past this many hours per week.">
        <RangeField id="st-overload" value={draft.overloadAt} min={36} max={60} unit="h" disabled={!draft.notifyClash} onChange={(v) => set('overloadAt', v)} />
      </Field>
    </SubGroup>

    <SubGroup title="Where to send alerts">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <SwitchRow id="st-inapp" checked={draft.notifyInApp} onChange={(v) => set('notifyInApp', v)} label="In app" />
        <SwitchRow id="st-email" checked={draft.notifyEmail} onChange={(v) => set('notifyEmail', v)} label="Email" />
        <SwitchRow id="st-slack" checked={draft.notifySlack} onChange={(v) => set('notifySlack', v)} label="Slack" />
      </div>
    </SubGroup>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
      <Field id="st-digest" label="Sprint burndown summary" hint="Sent to the Lead Architect.">
        <Segmented id="st-digest" value={draft.digest} onChange={(v) => set('digest', v)} options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'off', label: 'Off' }]} />
      </Field>
    </div>

    <SubGroup title="Quiet hours">
      <SwitchRow id="st-quiet" checked={draft.quietHours} onChange={(v) => set('quietHours', v)} label="Pause alerts at night" description="Alerts wait until quiet hours end." />
      <div className="grid grid-cols-2 gap-space-md max-w-md">
        {[['quietFrom', 'From', 'st-qfrom'], ['quietTo', 'Until', 'st-qto']].map(([k, l, id]) => (
          <Field key={k} id={id} label={l}>
            <input id={id} type="time" value={draft[k]} disabled={!draft.quietHours} onChange={(e) => set(k, e.target.value)} className={`${selectCls} pr-3 cursor-text`} />
          </Field>
        ))}
      </div>
    </SubGroup>
  </SpotlightCard>
);

const SecuritySection = ({ draft, set, modified }) => {
  const { copied, copy } = useCopy();
  return (
    <SpotlightCard id="settings-security" delay={200}>
      <SectionHeading icon="security" iconClass="text-primary" title="Security" description="Sign-in protection and the key used to verify your sandboxes." modified={modified} />

      <div className="flex flex-col gap-2">
        <SwitchRow id="st-2fa" checked={draft.twoFactor} onChange={(v) => set('twoFactor', v)} label="Two-factor authentication" description="Ask for a code from your authenticator app when you sign in." />
        <SwitchRow id="st-signin" checked={draft.signInAlerts} onChange={(v) => set('signInAlerts', v)} label="Email me about new sign-ins" description="Get a message when your account is used on a new device." />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
        <Field id="st-session" label="Sign out after being idle for">
          <SelectBox id="st-session" value={draft.sessionTimeout} onChange={(v) => set('sessionTimeout', v)} options={SESSION} />
        </Field>
      </div>

      <Field id="st-key" label="Sandbox verifier public key" hint="Read-only. It can't be edited here.">
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
    </SpotlightCard>
  );
};

const DataSection = ({ draft, set, modified, onExport }) => (
  <SpotlightCard id="settings-data" delay={240}>
    <SectionHeading icon="database" iconClass="text-secondary" title="Data & privacy" description="What Copilot can learn from, how long records are kept, and your exports." modified={modified} />
    <SwitchRow id="st-ai" checked={draft.aiLearning} onChange={(v) => set('aiLearning', v)} label="Let Copilot learn from my workspace" description="Uses your sprints and allocations to improve suggestions. It is never shared outside your workspace." />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
      <Field id="st-retention" label="Keep audit logs for" hint="Older entries are removed automatically.">
        <SelectBox id="st-retention" value={draft.retention} onChange={(v) => set('retention', v)} options={RETENTION} />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-on-surface">Export workspace data</span>
        <button type="button" onClick={onExport} className={`self-start flex items-center gap-1.5 px-space-md py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-sm font-semibold border border-outline-variant/30 hover:border-secondary/50 transition active:scale-95 cursor-pointer ${focusRing}`}>
          <Icon name="file_download" className="text-base text-secondary" /> Download as JSON
        </button>
        <p className="text-xs text-on-surface-variant">Includes projects, allocations and settings.</p>
      </div>
    </div>
  </SpotlightCard>
);

/* ==========================================================================
   5. PAGE CHROME
   ========================================================================== */

const PageHeader = ({ onReset }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-space-md mb-space-lg">
    <div className="flex flex-col">
      <p className="text-sm font-medium text-secondary mb-2 flex items-center gap-1.5">
        <Icon name="tune" className="text-base" /> Settings
      </p>
      <h1 className="font-semibold text-on-surface" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', letterSpacing: '-0.025em', lineHeight: 1.15 }}>Workspace settings</h1>
      <p className="text-sm text-on-surface-variant max-w-xl mt-2">
        Set up your workspace, tune the neural engine, and control alerts, security and data.
      </p>
    </div>
    <button type="button" onClick={onReset} className={`self-start sm:self-auto flex items-center gap-1.5 px-space-md py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-sm font-medium border border-outline-variant/30 hover:border-secondary/50 transition active:scale-95 cursor-pointer ${focusRing}`}>
      <Icon name="restart_alt" className="text-base text-secondary" /> Reset to defaults
    </button>
  </div>
);

const SectionNav = ({ active, onSelect, edited }) => (
  <nav aria-label="Settings sections" className="lg:sticky lg:top-24 self-start">
    <ul className="flex lg:flex-col gap-1 p-1.5 overflow-x-auto rounded-2xl bg-surface-container-low/70 border border-outline-variant/30">
      {NAV.map((n) => {
        const on = active === n.id;
        return (
          <li key={n.id} className="shrink-0">
            <button
              type="button" onClick={() => onSelect(n.id)} aria-current={on ? 'true' : undefined}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm whitespace-nowrap text-left transition cursor-pointer active:scale-95 ${focusRing} ${on ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}`}
            >
              <Icon name={n.icon} className="text-base" />
              <span className="flex-1">{n.label}</span>
              {edited.includes(n.id) && <span className="w-1.5 h-1.5 rounded-full bg-tertiary" title="Unsaved changes" aria-label="Unsaved changes" />}
            </button>
          </li>
        );
      })}
    </ul>
  </nav>
);

// At-a-glance summary of the current (draft) settings.
const StatusOverview = ({ draft }) => {
  const [ver, ...rest] = draft.engineVersion.split(' ');
  const alertsOn = [draft.notifyInApp, draft.notifyEmail, draft.notifySlack].filter(Boolean).length;
  const items = [
    { label: 'Engine', value: ver, sub: rest.join(' '), icon: 'auto_awesome', cls: 'text-secondary' },
    { label: 'TPU cap', value: `${draft.tpu}%`, sub: draft.tpuBurst ? 'Auto-scale on' : 'Auto-scale off', icon: 'speed', cls: 'text-primary' },
    { label: 'Security', value: draft.twoFactor ? '2FA on' : '2FA off', sub: `Idle sign-out ${draft.sessionTimeout >= 60 ? draft.sessionTimeout / 60 + 'h' : draft.sessionTimeout + ' min'}`, icon: 'verified_user', cls: 'text-secondary' },
    { label: 'Alerts', value: draft.notifyClash ? `${alertsOn} of 3 channels` : 'Alerts off', sub: draft.quietHours ? `Quiet ${draft.quietFrom}–${draft.quietTo}` : 'No quiet hours', icon: 'notifications_active', cls: 'text-tertiary' },
  ];
  return (
    <div role="region" aria-label="Current settings summary" className="grid grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-lg">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3 min-w-0 rounded-2xl bg-surface-container/50 border border-outline-variant/30 p-space-md">
          <span className={`material-symbols-outlined text-xl p-2 rounded-xl bg-surface-container-high shrink-0 ${it.cls}`} aria-hidden="true">{it.icon}</span>
          <div className="min-w-0">
            <div className="text-xs text-on-surface-variant">{it.label}</div>
            <div className={`text-lg font-semibold leading-tight truncate ${it.cls}`}>{it.value}</div>
            <div className="text-xs text-outline truncate">{it.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

const SaveBar = ({ dirtyCount, justSaved, onSave, onDiscard }) => {
  const dirty = dirtyCount > 0;
  return (
    <div className={`sticky bottom-24 z-30 flex flex-wrap items-center justify-between gap-3 px-space-md py-3 rounded-2xl backdrop-blur-xl border shadow-2xl transition-all duration-300 ${dirty ? 'bg-surface-container-lowest/95 border-tertiary/40' : 'bg-surface-container/70 border-outline-variant/30'}`}>
      <div className="flex items-center gap-2 text-sm" aria-live="polite">
        {dirty ? (
          <>
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="st-ping absolute inline-flex h-full w-full rounded-full bg-tertiary" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-tertiary" />
            </span>
            <span className="font-semibold text-on-surface">{dirtyCount} unsaved {dirtyCount === 1 ? 'change' : 'changes'}</span>
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
        <button type="button" onClick={onDismiss} aria-label="Dismiss message" className={`p-0.5 rounded text-outline hover:text-on-surface ${focusRing}`}>
          <Icon name="close" className="text-sm" />
        </button>
      </div>
    )}
  </div>
);

/* ==========================================================================
   6. PAGE
   ========================================================================== */

export const SettingsPage = ({ tpuUsage, setTpuUsage, onSettingsSave }) => {
  // `saved` is what's applied; `draft` is what's on screen until you save.
  const initial = useMemo(
    () => ({ ...DEFAULTS, tpu: tpuUsage ?? DEFAULTS.tpu }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [justSaved, setJustSaved] = useState(false);
  const toast = useToast();
  const savedTimer = useRef(null);
  const sectionIds = useMemo(() => NAV.map((n) => n.id), []);
  const [activeSection, setActiveSection] = useScrollSpy(sectionIds);

  const set = useCallback((key, value) => setDraft((d) => ({ ...d, [key]: value })), []);

  // Keep the TPU value in step if the parent changes it while nothing is being edited.
  useEffect(() => {
    if (tpuUsage == null) return;
    setSaved((s) => (s.tpu === tpuUsage ? s : { ...s, tpu: tpuUsage }));
    setDraft((d) => (d.tpu === saved.tpu ? { ...d, tpu: tpuUsage } : d));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tpuUsage]);

  const changedKeys = useMemo(() => Object.keys(draft).filter((k) => draft[k] !== saved[k]), [draft, saved]);
  const dirtyCount = changedKeys.length;
  const modified = Object.fromEntries(Object.entries(SECTION_KEYS).map(([id, keys]) => [id, keys.some((k) => changedKeys.includes(k))]));

  const editedSections = Object.keys(modified).filter((id) => modified[id]);

  const handleSave = useCallback(() => {
    if (!dirtyCount) return;
    if (draft.tpu !== saved.tpu) setTpuUsage?.(draft.tpu);
    setSaved(draft);
    onSettingsSave?.(draft);
    setJustSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setJustSaved(false), 2500);
    toast.show('Workspace settings saved.');
  }, [dirtyCount, draft, saved, setTpuUsage, onSettingsSave, toast]);

  const handleReset = useCallback(() => {
    setDraft({ ...DEFAULTS, tpu: saved.tpu });
    toast.show('Defaults restored. Save to apply them.');
  }, [saved.tpu, toast]);

  const handleDiscard = useCallback(() => {
    setDraft(saved);
    toast.show('Changes discarded.');
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

  return (
    <div className="st-root relative isolate flex flex-col w-full max-w-6xl mx-auto pb-40 pt-space-md">
      <style>{`
        @keyframes stEnter { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @keyframes stPop { from { opacity: 0; transform: translateY(6px) scale(.97); } to { opacity: 1; transform: none; } }
        @keyframes stPing { 0% { transform: scale(1); opacity: .7; } 100% { transform: scale(2.6); opacity: 0; } }
        .st-root { font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }
        .st-root .font-mono { font-family: inherit; }
        .st-root .st-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
        .st-enter { animation: stEnter .5s cubic-bezier(.2,.7,.2,1) both; }
        .st-pop { animation: stPop .2s ease-out both; }
        .st-ping { animation: stPing 1.8s ease-out infinite; }

        .st-range { -webkit-appearance: none; appearance: none; height: 8px; border-radius: 999px; outline: none; cursor: pointer;
          background: linear-gradient(to right, rgb(76,215,246) var(--p, 50%), rgba(148,163,184,.25) var(--p, 50%)); }
        .st-range:disabled { opacity: .5; cursor: not-allowed; }
        .st-range::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #fff; border: 3px solid rgb(76,215,246);
          box-shadow: 0 0 12px rgba(76,215,246,.6); transition: transform .15s ease, box-shadow .15s ease; }
        .st-range::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 3px solid rgb(76,215,246); box-shadow: 0 0 12px rgba(76,215,246,.6); }
        .st-range:hover::-webkit-slider-thumb { transform: scale(1.15); }
        .st-range:active::-webkit-slider-thumb { transform: scale(1.25); box-shadow: 0 0 18px rgba(76,215,246,.85); }
        .st-range:focus-visible { box-shadow: 0 0 0 3px rgba(76,215,246,.35); }

        @media (prefers-reduced-motion: reduce) {
          .st-enter, .st-pop, .st-ping { animation: none !important; }
          .st-range::-webkit-slider-thumb { transition: none; }
        }
      `}</style>

      <PageHeader onReset={handleReset} />
      <StatusOverview draft={draft} />

      <div className="grid grid-cols-1 lg:grid-cols-[210px_minmax(0,1fr)] gap-space-lg items-start">
        <SectionNav active={activeSection} onSelect={goTo} edited={editedSections} />

        <div className="flex flex-col gap-space-lg min-w-0">
          <WorkspaceSection draft={draft} set={set} modified={modified.workspace} />
          <EngineSection draft={draft} saved={saved} set={set} canEditTpu={!!setTpuUsage} modified={modified.engine} />
          <AppearanceSection draft={draft} set={set} modified={modified.appearance} />
          <NotificationsSection draft={draft} set={set} modified={modified.notifications} />
          <SecuritySection draft={draft} set={set} modified={modified.security} />
          <DataSection draft={draft} set={set} modified={modified.data} onExport={() => toast.show('Preparing your workspace export (JSON)…')} />
          <SaveBar dirtyCount={dirtyCount} justSaved={justSaved} onSave={handleSave} onDiscard={handleDiscard} />
        </div>
      </div>

      <Toast message={toast.message} onDismiss={toast.dismiss} />
    </div>
  );
};  