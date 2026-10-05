import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ==========================================================================
   SprintsPage
   --------------------------------------------------------------------------
   1. Data & constants      people, squads, weeks, status + color maps
   2. Styles                fonts, keyframes, effect classes
   3. Hooks                 motion, number tween, toast, dismiss (Esc/outside)
   4. UI primitives         Dot, Avatar, StatusBadge, HoursBar, SpotlightCard…
   5. Board pieces          allocation bars, person cards, week ruler, legend
   6. Page sections         Header, Overview, Filters, Toolbar, Toast, Copilot
   7. Page                  state + composition

   Page layout, top to bottom:
     Header     title, sprint progress + the two main actions
     Left rail  overview cards, then squad and status filters (sticky)
     Board      search + zoom, week ruler, one card per person, legend
   ========================================================================== */

/* ==========================================================================
   1. DATA & CONSTANTS
   ========================================================================== */

const CAPACITY = 40; // weekly hours per person
const CYCLE_DAY = 9; // today, within the sprint
const CYCLE_TOTAL = 14; // sprint length in days

const WEEKS = [
  { name: 'Oct W1', range: 'Oct 02 – Oct 08' },
  { name: 'Oct W2', range: 'Oct 09 – Oct 15', current: true },
  { name: 'Oct W3', range: 'Oct 16 – Oct 22' },
  { name: 'Oct W4', range: 'Oct 23 – Oct 29' },
];

const TIMESPANS = [
  { id: 'weeks', label: 'Weeks' },
  { id: 'days', label: 'Days' },
  { id: 'quarter', label: 'Quarter' },
];

const SQUADS = {
  'All squads': null,
  'Core Infrastructure': ['alex', 'elena', 'david'],
  'Frontend Core': ['marcus'],
  'AI / ML Research': ['sophia'],
};

const PHOTO = (id) => `https://lh3.googleusercontent.com/aida-public/${id}`;

// `hours` and `status` can depend on whether the conflict has been resolved.
const PEOPLE = [
  {
    id: 'alex', name: 'Alex Rivera', role: 'Staff Backend · UTC+1',
    photo: PHOTO('AB6AXuDPqIvxWt-spFep14lvLaSquRSwmWLOSghqKoV307NcLJi8LVNS3eT90mYff0ode2Ju52w1PCXmFw3kltGCpaHnWWTwdP7MNLXuaRrUV__1_n1J_RrxRnVPr851yrX6I5n8RpcYNCcjXXpO8ZbPnoEbvB5kC-dt_XjvYbdL2_p3FszmiulnRWL8pyMGiU-gIZchPBkPBos7zIR2GBCyhw_TyD4d3YimwQHR_TN8Bed2gQS_Wtn3U2rM'),
    hours: () => 40, status: () => 'capacity',
  },
  {
    id: 'elena', name: 'Elena Vance', role: 'Lead Architect · PST',
    photo: PHOTO('AB6AXuAuGeznKb3vIPB7C-iahg9p1NzAImK8TbGa5XaA59B3doFtuECWC_mmK0M4fKTK0aDk8siljlx8_nd-QYZABYGCAlNMr6Qw4E2BI8WTS0hob397ObnOvnDrn9OJ9WktJa-1U3Sgk1VbKU7Dfin4T9OYwkHW4mxl3lHeyG6qBqixFaNtR7PUth86ME-OR2ec7zOGlUsh18hcz6z13GrQVre0utKcAqHXl3wogCiSz48oh1vDEceeNhND'),
    hours: () => 32, status: () => 'optimal',
  },
  {
    id: 'marcus', name: 'Marcus Chen', role: 'Sr. Frontend · EST',
    photo: PHOTO('AB6AXuDrhykBxkuUSfhcarTSgKYimr0PYPwwvYN0q4GMkbIrItfyFW37Dskpk5CNx3QoFN8MIEkbeK_jWqf8wGor-jbjGIq-ScQxYFDg_Tm9wNFoYX6XYO8lPUO0uujLCNNoQJvOpeT_nmNqkacB3xMCQRI4NQTE4_fnzlg37eokpbIb37UvlG0VdFdIg3Fh9_3xEL786e4KPKCAVtfxMfWo-TOWORGyflfSGNYEV6W2jzMz3wLTyvV0cR31'),
    hours: (r) => (r ? 40 : 56), status: (r) => (r ? 'optimal' : 'overbooked'),
  },
  {
    id: 'sophia', name: 'Sophia Patel', role: 'AI / ML Engineer · IST',
    photo: PHOTO('AB6AXuBuObjAsc3e8ZffivHqcG2V59a2vSAAUeixcMXVWnHgncGC0nJUwlZKsgiICiSdgtNXiUioBWmQttX5IHWDZrLNzgN02Tw41o8y2ab1ntEIxLojcGs86-jzkQflV_ZiynY0Hc6SGYOZCy13GzSd_HKCSRpeFTjKmA3TsgfYcuQtyl6_IZCOl1t96-cKxZCMRj7UhOIz9gN4ucmI8YKG14ko6QsHfNficmXvxcbMPSst_UbhTS9VAQtd'),
    hours: (r) => (r ? 40 : 25), status: (r) => (r ? 'capacity' : 'bench'),
  },
  {
    id: 'david', name: 'David Kim', role: 'DevOps / Cloud · UTC+0',
    photo: PHOTO('AB6AXuCPOOtHbpcm7Yhkd0gMPYuhHtGlJSM8S5XOPUzD3Zz7kWdAc41REwL4__qsjFGI3oPs8uUmJN5NpXS0kyrEr7PKgPE7C09PCOgOdETYM6lHzqjFaKPwFh0B2nmvoD6h0muKZsOGSFBNCI7HMsHT82MUvDJSiKU7G1VIAJctEw1GAwKA17aolERTA_NgFd4w_DbqDyXTT9ekMb3uy6z-cCH0xWfKEur1ttQM9aMy90EEwAinJNct8avk'),
    hours: () => 36, status: () => 'optimal',
  },
];

// Status labels and colors (all class names are written out in full for Tailwind).
const STATUS = {
  overbooked: {
    filter: 'Overbooked', dot: 'bg-error',
    badge: 'bg-error text-on-error font-semibold',
    text: (h) => `Double-booked (${h}h)`,
  },
  bench: {
    filter: 'On bench', dot: 'bg-secondary',
    badge: 'bg-secondary/15 text-secondary border border-secondary/20 font-semibold',
    text: (h) => `On bench (${CAPACITY - h}h free)`,
  },
  capacity: {
    filter: 'At capacity', dot: 'bg-primary',
    badge: 'bg-primary/20 text-primary border border-primary/30 font-semibold',
    text: (h) => `At capacity (${h}h)`,
  },
  optimal: {
    filter: 'Optimal', dot: 'bg-secondary',
    badge: 'bg-secondary/10 text-secondary border border-secondary/20 font-semibold',
    text: (h) => `Optimal (${h}h)`,
  },
};
const STATUS_FILTERS = ['all', 'overbooked', 'bench', 'capacity', 'optimal'];

// Colors for allocation bars.
const TONES = {
  primary: { bar: 'bg-gradient-to-r from-primary-container/30 via-primary-container/20 to-primary-container/30 border-primary/20', dot: 'bg-primary text-primary', tag: 'text-primary bg-surface-container-lowest/70' },
  accent: { bar: 'bg-gradient-to-r from-secondary-container/30 via-tertiary-container/20 to-primary-container/30 border-secondary/30', dot: 'bg-secondary text-secondary', tag: 'text-tertiary bg-surface-container-lowest/80' },
  mixed: { bar: 'bg-gradient-to-r from-primary-container/20 via-secondary-container/20 to-surface-container-high/60 border-outline-variant/20', dot: 'bg-secondary text-secondary', tag: 'text-on-surface-variant bg-surface-container-lowest/60' },
  neutral: { bar: 'bg-surface-container-high/60 border-outline-variant/20', dot: 'bg-secondary text-secondary', tag: 'text-secondary bg-transparent' },
  focus: { bar: 'bg-gradient-to-r from-tertiary-container/30 to-primary-container/20 border-tertiary/30', dot: 'bg-tertiary text-tertiary', tag: 'text-secondary bg-surface-container-lowest/80' },
  moved: { bar: 'bg-gradient-to-r from-secondary-container/20 to-primary-container/20 border-secondary/40', dot: 'bg-secondary text-secondary', tag: 'text-on-surface bg-transparent' },
};

// Simple allocations (people with special rows are handled in section 4).
const ALLOCATIONS = {
  alex: [
    { title: 'Realtime Multi-Agent Orchestrator', meta: 'Core Engine Phase 2 · 36h/wk', tag: 'Oct 02 – Oct 22', tone: 'primary', span: 'col-span-3' },
    { title: 'Telemetry Sweep', meta: '12h', tone: 'neutral', span: 'col-span-1', compact: true },
  ],
  david: [
    { title: 'Global Kubernetes Mesh & TPU Cluster Expansion', meta: 'Infrastructure hardening · 36h/wk', tag: 'All sprint', tone: 'mixed', span: 'col-span-4' },
  ],
};

/* ==========================================================================
   2. STYLES  (fonts, keyframes and effect classes, scoped to .sp-root)
   ========================================================================== */

const STYLES = `
  .sp-root { font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }
  .sp-root .font-mono { font-family: inherit; }
  .sp-root h1, .sp-root h2, .sp-root h3, .sp-root h4 { letter-spacing: -0.015em; }
  @keyframes spEnter { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
  @keyframes spPop { from { opacity: 0; transform: translateY(6px) scale(.97); } to { opacity: 1; transform: none; } }
  @keyframes spGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  @keyframes spGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(255,180,171,0); } 50% { box-shadow: 0 0 22px 2px rgba(255,180,171,.28); } }
  @keyframes spRing { 0% { box-shadow: 0 0 0 0 rgba(255,180,171,.55); } 100% { box-shadow: 0 0 0 12px rgba(255,180,171,0); } }
  @keyframes spOrb { 0% { transform: scale(1); opacity: .7; } 100% { transform: scale(1.9); opacity: 0; } }
  @keyframes spDrift { 0%,100% { transform: translate(0,0); } 50% { transform: translate(24px,18px); } }
  @keyframes spLine { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  @keyframes spParticle { from { transform: translate(-50%,-50%) rotate(var(--a)) translateY(0) scale(1); opacity: 1; } to { transform: translate(-50%,-50%) rotate(var(--a)) translateY(-40px) scale(.2); opacity: 0; } }
  @keyframes spShine { from { background-position: 0% 50%; } to { background-position: 200% 50%; } }
  @keyframes spFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
  @keyframes spBarIn { from { opacity: 0; transform: translateX(-16px) scaleX(.94); } to { opacity: 1; transform: none; } }
  @keyframes spFill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  @keyframes spFlash { 0% { background-color: rgba(76,215,246,.22); } 100% { background-color: transparent; } }
  @keyframes spShrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }
  @keyframes spBeam { 0% { transform: translateX(-120%); } 60%,100% { transform: translateX(520%); } }
  .sp-enter { animation: spEnter .5s cubic-bezier(.2,.7,.2,1) backwards; }
  .sp-shine { animation: spShine 7s linear infinite; }
  .{ animation: spFloat 4s ease-in-out infinite; }
  .sp-barin { transform-origin: left; animation: spBarIn .6s cubic-bezier(.2,.7,.2,1) backwards; }
  .sp-fill { transform-origin: left; animation: spFill .9s cubic-bezier(.2,.7,.2,1) backwards; }
  .sp-flash { animation: spFlash 1.4s ease-out; }
  .sp-slide { animation: spShine 5s linear infinite; }
  .sp-shrink { transform-origin: left; animation: spShrink 4s linear forwards; }
  .sp-beam { animation: spBeam 3.6s ease-in-out 1.2s infinite; }
  .{ position: relative; overflow: hidden; }
  .sp-sheen::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(110deg, transparent 35%, rgba(255,255,255,.16) 50%, transparent 65%); transform: translateX(-130%); transition: transform .8s ease; }
  .sp-sheen:hover::after { transform: translateX(130%); }
  .sp-pop { animation: spPop .2s ease-out both; }
  .sp-grow { transform-origin: left; animation: spGrow .9s cubic-bezier(.2,.7,.2,1) .2s both; }
  .sp-underline { transform-origin: left; animation: spLine .9s cubic-bezier(.2,.7,.2,1) .15s both; }
  .{ animation: spGlow 2.4s ease-in-out infinite; }
  .sp-ring { animation: spRing 1.8s ease-out infinite; }
  .sp-orb { animation: spOrb 2s ease-out infinite; }
  .sp-drift { animation: spDrift 14s ease-in-out infinite; }
  .sp-particle { animation: spParticle .9s ease-out both; }
  .sp-spot { background: radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), rgba(76,215,246,.10), transparent 70%); }
  .sp-card:hover .sp-spot { opacity: 1; }
  @media (prefers-reduced-motion: reduce) {
    .sp-enter, .sp-pop, .sp-grow, .sp-underline, .sp-glow, .sp-ring, .sp-orb, .sp-drift, .sp-particle, .sp-shine, .sp-float, .sp-barin, .sp-fill, .sp-flash, .sp-slide, .sp-shrink, .sp-beam { animation: none !important; }
    .sp-sheen::after { display: none; }
  }
`;

/* ==========================================================================
   3. HOOKS
   ========================================================================== */

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Smoothly tweens a number toward `target` (starts at 0 on first render).
const useTween = (target, duration = 900) => {
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

// One toast at a time, auto-dismissed, timer cleaned up on unmount.
const useToast = (ms = 4000) => {
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

// Calls onDismiss on Escape (and optionally on clicks outside `ref`).
const useDismiss = (active, onDismiss, ref) => {
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => e.key === 'Escape' && onDismiss();
    const onDoc = (e) => ref?.current && !ref.current.contains(e.target) && onDismiss();
    window.addEventListener('keydown', onKey);
    if (ref) document.addEventListener('mousedown', onDoc);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (ref) document.removeEventListener('mousedown', onDoc);
    };
  }, [active, onDismiss, ref]);
};

/* ==========================================================================
   4. UI PRIMITIVES
   ========================================================================== */

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary';

const Dot = ({ className = '' }) => (
  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${className}`} aria-hidden="true" />
);

const Icon = ({ name, className = '' }) => (
  <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{name}</span>
);

const Avatar = ({ src, name, alert = false }) => (
  <span className="relative inline-flex shrink-0 rounded-full">
    {alert && <span className="sp-ring absolute inset-0 rounded-full" aria-hidden="true" />}
    <AvatarImg src={src} name={name} />
  </span>
);

const AvatarImg = ({ src, name }) => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div role="img" aria-label={name} className="w-11 h-11 rounded-full shrink-0 bg-surface-container-highest text-on-surface font-mono text-sm font-semibold flex items-center justify-center ring-1 ring-outline-variant/40">
        {name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
      </div>
    );
  }
  return (
    <img
      src={src} alt={name} loading="lazy" onError={() => setFailed(true)}
      className="w-11 h-11 rounded-full object-cover shadow-md shrink-0 ring-2 ring-outline-variant/40 transition-all duration-300 group-hover:scale-110 group-hover:ring-secondary/60"
    />
  );
};

const StatusBadge = ({ status, hours }) => {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-xs ${s.badge}`}>
      {status !== 'overbooked' && <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />}
      {s.text(hours)}
    </span>
  );
};

const HoursBar = ({ name, hours, over }) => (
  <div
    className="mt-1.5 h-1 w-full max-w-[170px] rounded-full bg-surface-container-highest overflow-hidden"
    role="progressbar" aria-valuenow={hours} aria-valuemin={0} aria-valuemax={CAPACITY}
    aria-label={`${name} is booked ${hours} of ${CAPACITY} hours`}
  >
    <div
      className={`sp-fill h-full rounded-full transition-[width,background-color] duration-700 ease-out ${over ? 'bg-error' : 'bg-secondary'}`}
      style={{ width: `${Math.min((hours / CAPACITY) * 100, 100)}%` }}
    />
  </div>
);

// Card with a soft spotlight that follows the cursor.
const SpotlightCard = ({ className = '', delay = 0, children }) => {
  const ref = useRef(null);
  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <div
      ref={ref} onMouseMove={onMove} style={{ animationDelay: `${delay}ms` }}
      className={`sp-card sp-enter group/card relative overflow-hidden rounded-2xl bg-surface-container/70 backdrop-blur-xl border border-outline-variant/30 shadow-md transition-[border-color,transform,box-shadow] duration-300 hover:border-secondary/40 hover:-translate-y-1 hover:shadow-xl ${className}`}
    >
      <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-secondary/70 to-transparent opacity-0 transition-opacity duration-300 group-hover/card:opacity-100" aria-hidden="true" />
      <div className="relative h-full">{children}</div>
    </div>
  );
};

// Short celebratory burst, shown briefly after a conflict is resolved.
const Burst = () => (
  <span className="pointer-events-none absolute inset-0" aria-hidden="true">
    {Array.from({ length: 12 }, (_, i) => (
      <span key={i} className="sp-particle absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full bg-secondary" style={{ '--a': `${i * 30}deg`, animationDelay: `${(i % 3) * 40}ms` }} />
    ))}
  </span>
);

/* ==========================================================================
   5. TIMELINE PIECES
   ========================================================================== */

// A single bar in a person's timeline.
const AllocationBar = ({ title, meta, tag, tone = 'neutral', span = '', compact = false, delay = 0 }) => {
  const t = TONES[tone];
  return (
    <div
      title={[title, meta, tag].filter(Boolean).join(' · ')}
      style={{ animationDelay: `${delay}ms` }}
      className={`${span} sp-barin h-14 rounded-xl backdrop-blur-md p-2.5 flex items-center justify-between gap-2 border shadow-md transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 ${t.bar}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {!compact && <Dot className={t.dot} />}
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-on-surface truncate">{title}</span>
          {meta && <span className="font-mono text-xs text-on-surface-variant truncate">{meta}</span>}
        </div>
      </div>
      {tag && <span className={`font-mono text-xs px-2 py-0.5 rounded-md shrink-0 ${t.tag}`}>{tag}</span>}
    </div>
  );
};

// Standard right-hand cell: bars laid out on the 4-week grid.
const SimpleCell = ({ bars }) => (
  <div className="grid grid-cols-4 gap-2 items-center">
    {bars.map((b, i) => <AllocationBar key={b.title} delay={250 + i * 140} {...b} />)}
  </div>
);

const MilestoneDetails = ({ onClose, onOpenArtifact }) => (
  <div className="rounded-2xl bg-surface-container-lowest/90 backdrop-blur-xl p-space-md border border-secondary/40 shadow-xl">
    <div className="flex items-center justify-between pb-2 mb-2 border-b border-outline-variant/20">
      <span className="font-mono text-xs text-secondary font-semibold flex items-center gap-1">
        <Icon name="verified" className="text-xs" /> Active milestone · MS-904
      </span>
      <button type="button" onClick={onClose} aria-label="Close milestone details" className={`p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high transition active:scale-90 ${focusRing}`}>
        <Icon name="close" className="text-sm" />
      </button>
    </div>
    <h4 className="text-lg font-semibold text-on-surface leading-snug">Zero-Trust Access Control</h4>
    <div className="grid grid-cols-2 gap-2 mt-2 bg-surface-container-high/40 p-2 rounded-lg">
      <div>
        <span className="font-mono text-xs text-outline block">Assigned hours</span>
        <span className="text-lg font-semibold text-on-surface font-mono">32h / wk</span>
      </div>
      <div>
        <span className="font-mono text-xs text-outline block">Cost rate</span>
        <span className="text-lg font-semibold text-secondary font-mono">$180 / hr</span>
      </div>
    </div>
    <div className="flex items-center justify-between mt-2 font-mono text-xs">
      <button type="button" onClick={onOpenArtifact} className={`text-tertiary hover:underline cursor-pointer flex items-center gap-1 rounded ${focusRing}`}>
        <Icon name="link" className="text-xs" /> View milestone artifact
      </button>
      <span className="text-outline">Sprint 14 target</span>
    </div>
  </div>
);

// Elena: one wide bar that expands into milestone details.
const ElenaCell = ({ open, onToggle, onOpenArtifact }) => (
  <div className="flex flex-col justify-center gap-2">
    <button
      type="button" onClick={onToggle} aria-expanded={open} aria-controls="sp-milestone"
      className={`w-full h-14 rounded-xl border backdrop-blur-md p-2.5 flex items-center justify-between gap-2 text-left shadow-lg cursor-pointer transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 ${TONES.accent.bar} ${focusRing}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Dot className={TONES.accent.dot} />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-on-surface truncate">Zero-Trust Access Control &amp; Neural Boundary Gateway</span>
          <span className="font-mono text-xs text-on-surface-variant truncate">Arch Milestone 4 · 32h/wk · High velocity</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="px-2 py-0.5 rounded-full bg-surface-container-lowest/80 font-mono text-xs text-tertiary">M4 release</span>
        <Icon name="expand_more" className={`text-base text-outline transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </div>
    </button>
    <div id="sp-milestone" className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
      <div className="overflow-hidden">
        <MilestoneDetails onClose={onToggle} onOpenArtifact={onOpenArtifact} />
      </div>
    </div>
  </div>
);

// Marcus: shows the overlap while conflicted, a clean bar once balanced.
const MarcusCell = ({ resolved, onRebalance }) => (
  <div className="flex flex-col justify-center">
    {!resolved ? (
      <div key="conflict" className="w-full rounded-2xl p-2.5 bg-error-container/20 backdrop-blur-md shadow-2xl flex flex-col gap-2 border border-error/30">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5 text-error">
            <Icon name="emergency_home" className="text-base" />
            <span className="font-mono text-xs font-semibold">Overbooked by 16h across Kinetic UI and Client Portal</span>
          </div>
          <button type="button" onClick={onRebalance} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg bg-error hover:brightness-110 text-on-error text-sm font-semibold transition-all shadow-md cursor-pointer active:scale-95 ${focusRing}`}>
            <Icon name="tune" className="text-xs" /> Quick rebalance
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="col-span-3 h-11 rounded-lg bg-surface-container-high/90 p-2 flex items-center justify-between shadow-md border border-outline-variant/30">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-tertiary" />
              <span className="text-sm font-semibold text-on-surface truncate">Kinetic UI Token Library</span>
            </div>
            <span className="font-mono text-xs text-tertiary">32h/wk</span>
          </div>
          <div className="col-start-2 col-span-3 -mt-3.5 h-11 rounded-lg bg-surface-container-highest/95 p-2 flex items-center justify-between shadow-xl border border-error/40">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
              <span className="text-sm font-semibold text-error truncate">Hyperion Client Portal Sprint Finish</span>
            </div>
            <span className="font-mono text-xs text-error bg-error-container/60 px-1.5 py-0.5 rounded">24h/wk · overlaps</span>
          </div>
        </div>
      </div>
    ) : (
      <div key="balanced" className="sp-enter grid grid-cols-4">
        <AllocationBar title="Kinetic UI Token Library (Shader Synthesis)" meta="Dedicated focus · 36h/wk · Sprint 14 target" tag="Balanced ✓" tone="focus" span="col-span-4" />
      </div>
    )}
  </div>
);

// Sophia: her normal work, plus an empty slot (bench) or the moved work (resolved).
const SophiaCell = ({ resolved, onAssign }) => (
  <div className="grid grid-cols-4 gap-2 items-center">
    <AllocationBar title="Neural Prompt Evaluation Pipeline" meta="25h booked" tag="W1–W2" tone="neutral" span="col-span-2" />
    {!resolved ? (
      <button
        type="button" onClick={onAssign} aria-label="Assign Marcus's overflow work to Sophia"
        className={`group/drop col-span-2 h-14 rounded-xl bg-surface-container-lowest/40 backdrop-blur-sm p-2.5 flex items-center justify-between gap-2 text-left border border-dashed border-secondary/40 hover:bg-surface-container-low hover:border-secondary transition-all cursor-pointer active:scale-[0.99] ${focusRing}`}
      >
        <span className="flex items-center gap-2 text-outline group-hover/drop:text-secondary transition-colors min-w-0">
          <Icon name="add_circle" className="text-sm shrink-0 transition-transform duration-300 group-hover/drop:rotate-90" />
          <span className="font-mono text-xs font-medium">15h free, a good fit for the frontend overflow</span>
        </span>
        <span className="px-2 py-1 rounded bg-secondary/10 text-secondary group-hover/drop:bg-secondary group-hover/drop:text-on-secondary font-mono text-xs font-semibold transition-all shrink-0">Assign task</span>
      </button>
    ) : (
      <div key="moved" className="sp-enter col-span-2 grid grid-cols-2">
        <AllocationBar title="Hyperion Client Portal Sprint Finish" meta="Reallocated +15h" tag="W2–W3" tone="moved" span="col-span-2" />
      </div>
    )}
  </div>
);

// One card per person: who they are and how loaded they are on top, their weekly lane underneath.
const PersonCard = ({ person, index, resolved, flash = false, showDays, children }) => {
  const hours = person.hours(resolved);
  const status = person.status(resolved);
  const conflict = status === 'overbooked';
  return (
    <article
      style={{ animationDelay: `${index * 70}ms` }}
      className={`sp-enter group relative overflow-hidden rounded-3xl border backdrop-blur-xl shadow-md transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-xl ${flash ? 'sp-flash ' : ''}${
        conflict ? 'border-error/40 bg-error-container/15' : 'border-outline-variant/30 bg-surface-container/70 hover:border-secondary/40'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${
          conflict ? 'from-error/20 via-error to-error/20' : 'from-primary/0 via-secondary to-primary/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100'
        }`}
      />
      <div className="flex flex-wrap items-center gap-x-space-md gap-y-3 px-5 pt-4 pb-3">
        <Avatar src={person.photo} name={person.name} alert={conflict} />
        <div className="min-w-0 flex-1 basis-48">
          <div className="flex items-center gap-1.5">
            <h3 className="text-lg font-semibold text-on-surface truncate">{person.name}</h3>
            {conflict && <Icon name="priority_high" className="text-error text-sm" />}
          </div>
          <p className="text-sm text-on-surface-variant truncate">{person.role}</p>
        </div>
        <StatusBadge status={status} hours={hours} />
        <div className="w-40 shrink-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className={`text-lg font-semibold ${conflict ? 'text-error' : 'text-on-surface'}`}>{hours}h</span>
            <span className="font-mono text-xs text-outline">of {CAPACITY}h / wk</span>
          </div>
          <HoursBar name={person.name} hours={hours} over={conflict} />
        </div>
      </div>
      <div className="relative px-5 pb-5 pt-1">
        <LaneGuides showDays={showDays} />
        <div className="relative">{children}</div>
      </div>
    </article>
  );
};

// Day gridlines behind each lane, shown only in Days view. No coloured boxes in the other views.
const LaneGuides = ({ showDays }) =>
  showDays ? (
    <div className="pointer-events-none absolute inset-y-0 left-5 right-5 grid grid-cols-4 gap-2" aria-hidden="true">
      {WEEKS.map((w) => (
        <div
          key={w.name}
          style={{ backgroundImage: 'linear-gradient(to right, transparent calc(100% - 1px), rgba(148,163,184,.14) 0)', backgroundSize: 'calc(100% / 7) 100%' }}
        />
      ))}
    </div>
  ) : null;

// Week labels, lined up with the lanes inside every card.
const WeekRuler = ({ showDays }) => (
  <div className="grid grid-cols-4 gap-2 px-[21px] mb-space-sm">
    {WEEKS.map((w) => (
      <div
        key={w.name}
        className={`relative flex flex-col items-center rounded-xl border py-2 ${w.current ? 'border-secondary/40 bg-secondary/10' : 'border-outline-variant/20 bg-surface-container-highest/40'}`}
      >
        {w.current && <span className="absolute -top-2 px-1.5 rounded-full font-mono text-xs font-semibold bg-secondary text-on-secondary shadow-sm">Current</span>}
        <span className={`font-mono text-sm font-semibold ${w.current ? 'text-secondary' : 'text-on-surface'}`}>{w.name}</span>
        <span className={`font-mono text-xs ${w.current ? 'text-secondary' : 'text-outline'}`}>{w.range}</span>
        {showDays && (
          <div className="sp-pop flex w-full justify-between mt-1 px-2 font-mono text-[11px] text-outline" aria-hidden="true">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}
          </div>
        )}
      </div>
    ))}
  </div>
);

const Legend = () => (
  <div className="mt-space-sm rounded-2xl flex flex-wrap items-center gap-x-5 gap-y-1 px-space-md py-3 border border-outline-variant/20 bg-surface-container-highest/30 font-mono text-xs text-outline">
    <span className="text-on-surface-variant">Key</span>
    {['overbooked', 'bench', 'capacity', 'optimal'].map((k) => (
      <span key={k} className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${STATUS[k].dot}`} /> {STATUS[k].filter}
      </span>
    ))}
    <span className="ml-auto hidden sm:inline">The bar beside each name shows hours booked out of {CAPACITY}</span>
  </div>
);

/* ==========================================================================
   6. PAGE SECTIONS
   ========================================================================== */

const TimespanToggle = ({ value, onChange }) => (
  <div className="flex items-center bg-surface-container-low rounded-xl p-1 shadow-inner border border-outline-variant/20" role="group" aria-label="Timeline zoom">
    {TIMESPANS.map((t) => (
      <button
        key={t.id} type="button" aria-pressed={value === t.id} onClick={() => onChange(t.id)}
        className={`px-space-sm py-1 rounded-lg text-sm font-mono transition-all cursor-pointer active:scale-95 ${focusRing} ${value === t.id ? 'bg-surface-container-highest text-on-surface font-semibold shadow-sm' : 'text-outline hover:text-on-surface'}`}
      >
        {t.label}
      </button>
    ))}
  </div>
);

const ConflictStatus = ({ resolved, celebrate, onResolve }) =>
  !resolved ? (
    <button
      type="button" onClick={onResolve} title="Fix the overbooking automatically"
      className={`sp-ring flex items-center gap-2 px-space-md py-2 rounded-xl bg-error-container/40 hover:bg-error-container/60 text-error text-sm font-semibold transition-all border border-error/40 cursor-pointer active:scale-95 ${focusRing}`}
    >
      <Icon name="warning" className="text-base" />
      <span>Resolve 1 conflict</span>
    </button>
  ) : (
    <div key="ok" className="sp-pop relative flex items-center gap-2 px-space-md py-2 rounded-xl bg-secondary/15 text-secondary text-sm font-semibold border border-secondary/30">
      {celebrate && <Burst />}
      <Icon name="check_circle" className="text-base" />
      <span>No conflicts</span>
    </div>
  );

const PageHeader = ({ resolved, celebrate, onResolve, onAllocate }) => (
  <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md">
    <div className="flex flex-col">
      <p className="text-sm font-medium text-secondary mb-1">Sprints 14–16</p>
      <h1 className="font-semibold text-on-surface" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', letterSpacing: '-0.025em', lineHeight: 1.15 }}>
        Team allocation &amp; timeline
      </h1>
      <p className="text-sm text-on-surface-variant max-w-xl mt-2">
        See who is booked on what, spot overloads, and rebalance work across squads.
      </p>
      <div className="mt-4 flex items-center gap-3 max-w-md">
        <span className="text-sm font-medium text-on-surface whitespace-nowrap">Sprint 14 · Day {CYCLE_DAY} of {CYCLE_TOTAL}</span>
        <div className="flex-1 h-1.5 rounded-full bg-surface-container-highest overflow-hidden" role="progressbar" aria-label="Sprint progress" aria-valuenow={Math.round((CYCLE_DAY / CYCLE_TOTAL) * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="sp-fill h-full rounded-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${(CYCLE_DAY / CYCLE_TOTAL) * 100}%` }} />
        </div>
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-space-sm">
      <ConflictStatus resolved={resolved} celebrate={celebrate} onResolve={onResolve} />
      <button
        type="button" onClick={onAllocate}
        className={`group flex items-center gap-space-xs bg-primary hover:bg-primary-fixed-dim text-on-primary font-semibold text-sm px-space-md py-2 rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer ${focusRing}`}
      >
        <Icon name="add" className="text-base font-semibold transition-transform duration-300 group-hover:rotate-90" />
        <span>Allocate member</span>
      </button>
    </div>
  </div>
);

const SectionTitle = ({ title, hint }) => (
  <div className="flex items-baseline justify-between gap-3 mb-space-sm">
    <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
    {hint && <span className="font-mono text-xs text-outline">{hint}</span>}
  </div>
);

const SummarySection = ({ resolved }) => {
  const pct = useTween(resolved ? 91 : 88);
  const booked = Math.round(useTween(resolved ? 182 : 178));
  const circ = 2 * Math.PI * 18;
  return (
    <section aria-label="Overview" className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
      {/* Utilization */}
      <SpotlightCard className="p-space-md" delay={0}>
        <div className="flex items-center gap-space-md">
          <div className="relative w-16 h-16 shrink-0 flex items-center justify-center" role="img" aria-label={`Total utilization ${resolved ? 91 : 88} percent`}>
            <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
              <circle className="text-surface-container-highest" cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="4.5" />
              <circle className="text-secondary drop-shadow-[0_0_5px_currentColor]" cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="4.5" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} />
            </svg>
            <span className="absolute font-mono text-sm font-semibold text-on-surface tabular-nums">{Math.round(pct)}%</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-lg font-semibold text-on-surface">Total utilization</span>
              <span className="font-mono text-xs text-secondary bg-secondary/10 px-1.5 py-0.5 rounded">Healthy</span>
            </div>
            <span className="text-sm text-on-surface-variant font-mono">{booked}h booked of 200h available</span>
          </div>
        </div>
      </SpotlightCard>

      {/* Sync windows */}
      <SpotlightCard className="p-space-md" delay={80}>
        <div className="flex items-center justify-between gap-2 text-sm mb-2">
          <span className="text-on-surface font-semibold flex items-center gap-1.5">
            <Icon name="public" className="text-sm text-tertiary" /> Meeting overlap by timezone
          </span>
          <span className="text-secondary font-mono text-xs font-semibold bg-secondary-container/20 px-2 py-0.5 rounded-full whitespace-nowrap">3.5h shared</span>
        </div>
        <div className="sp-grow relative h-2.5 w-full bg-surface-container-highest rounded-full overflow-hidden flex">
          <div className="w-1/4 h-full bg-primary/40" title="PST (San Francisco)" />
          <div className="w-1/4 h-full bg-primary-container" title="EST (New York)" />
          <div className="w-1/4 h-full bg-secondary" title="UTC (London): best overlap" />
          <div className="w-1/4 h-full bg-tertiary/60" title="IST (Bengaluru)" />
        </div>
        <div className="flex justify-between items-center text-outline font-mono text-xs mt-1.5">
          <span>PST 14h</span><span>EST 32h</span>
          <span className="text-secondary font-semibold">UTC 68h (peak)</span>
          <span>IST 64h</span>
        </div>
      </SpotlightCard>

      {/* Health */}
      <SpotlightCard className="p-space-md" delay={160}>
        <div className="flex items-center justify-between gap-space-md">
          <div className="flex flex-col">
            <span className="font-mono text-xs text-outline">Team health</span>
            <div className="flex items-center gap-2" key={resolved ? 'ok' : 'bad'}>
              {!resolved ? (
                <>
                  <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-error animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-error" /></span>
                  <span className="sp-pop text-lg font-semibold text-error">1 overload</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-secondary" />
                  <span className="sp-pop text-lg font-semibold text-secondary">All balanced</span>
                </>
              )}
            </div>
            <span className="font-mono text-xs text-secondary font-medium">{resolved ? 'Bench is fully booked' : '1 person on bench, ready to help'}</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-surface-container-highest flex items-center justify-center text-primary shadow-inner shrink-0">
            <Icon name="hub" />
          </div>
        </div>
      </SpotlightCard>
    </section>
  );
};

const RailOption = ({ active, onClick, dot, icon, label, count }) => (
  <button
    type="button" aria-pressed={active} onClick={onClick}
    className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm text-left transition-all cursor-pointer active:scale-[.98] ${focusRing} ${
      active ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
    }`}
  >
    <span className="flex items-center gap-2 min-w-0">
      {dot ? <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} aria-hidden="true" /> : <Icon name={icon} className="text-base shrink-0" />}
      <span className="truncate">{label}</span>
    </span>
    <span key={count} className={`sp-pop rounded-full px-1.5 text-xs tabular-nums ${active ? 'bg-on-primary-container/15' : 'bg-surface-container-highest'}`}>{count}</span>
  </button>
);

const FilterGroup = ({ title, children }) => (
  <div className="flex flex-col gap-0.5" role="group" aria-label={title}>
    <p className="px-2 pb-1 text-xs font-medium text-outline">{title}</p>
    {children}
  </div>
);

// Left rail: squad and status as vertical lists.
const FilterRail = ({ squad, onSquad, status, onStatus, counts, hasFilters, onClear }) => (
  <SpotlightCard className="p-space-sm" delay={240}>
    <div className="flex flex-col gap-space-sm">
      <div className="flex items-center justify-between px-2 pt-1">
        <h2 className="text-lg font-semibold text-on-surface flex items-center gap-1.5">
          <Icon name="tune" className="text-base text-primary" /> Filters
        </h2>
        {hasFilters && (
          <button type="button" onClick={onClear} className={`text-sm text-primary hover:underline rounded ${focusRing}`}>Clear</button>
        )}
      </div>
      <FilterGroup title="Squad">
        {Object.keys(SQUADS).map((name) => (
          <RailOption key={name} active={squad === name} onClick={() => onSquad(name)} icon="groups" label={name} count={SQUADS[name] ? SQUADS[name].length : PEOPLE.length} />
        ))}
      </FilterGroup>
      <FilterGroup title="Status">
        {STATUS_FILTERS.map((key) => (
          <RailOption
            key={key} active={status === key} onClick={() => onStatus(key)}
            dot={key === 'all' ? null : STATUS[key].dot} icon="apps"
            label={key === 'all' ? 'Everyone' : STATUS[key].filter} count={counts[key]}
          />
        ))}
      </FilterGroup>
    </div>
  </SpotlightCard>
);

// Above the cards: search and zoom.
const BoardToolbar = ({ query, onQuery, searchRef, timespan, onTimespan, sort, onSort }) => (
  <div className="flex flex-col sm:flex-row sm:items-center gap-space-sm mb-space-md">
      <div className="relative flex-1 min-w-[200px]">
        <Icon name="search" className="absolute left-3 top-2.5 text-sm text-outline" />
        <input
          ref={searchRef} type="text" aria-label="Search people" placeholder="Search by name or role"
          value={query} onChange={(e) => onQuery(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && onQuery('')}
          className="w-full pl-9 pr-10 py-2 rounded-xl bg-surface-container-lowest/80 text-on-surface placeholder:text-outline text-sm border border-outline-variant/30 transition focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
        />
        {query ? (
          <button type="button" onClick={() => { onQuery(''); searchRef.current?.focus(); }} aria-label="Clear search" className="absolute right-2 top-1.5 p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high transition">
            <Icon name="close" className="text-sm" />
          </button>
        ) : (
          <kbd className="absolute right-3 top-2 rounded border border-outline-variant/40 px-1.5 text-xs font-mono text-outline" aria-hidden="true">/</kbd>
        )}
      </div>
    <label className="flex items-center gap-2 text-xs text-on-surface-variant">
      Sort
      <select value={sort} onChange={(e) => onSort(e.target.value)} className="rounded-lg bg-surface-container-lowest/80 border border-outline-variant/30 px-2 py-1.5 text-sm text-on-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-secondary">
        <option value="default">Default order</option>
        <option value="load">Most booked</option>
        <option value="free">Most free time</option>
        <option value="name">Name A–Z</option>
      </select>
    </label>
    <TimespanToggle value={timespan} onChange={onTimespan} />
  </div>
);

const EmptyState = ({ onClear }) => (
  <div className="sp-enter flex flex-col items-center text-center gap-3 py-16 px-4">
    <Icon name="person_search" className="text-4xl text-outline" />
    <h3 className="text-lg font-semibold text-on-surface">No one matches these filters</h3>
    <p className="text-sm text-on-surface-variant max-w-sm">Try a different squad, status or name, or clear your filters to see the whole team.</p>
    <button type="button" onClick={onClear} className={`mt-1 px-space-md py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-sm font-semibold border border-outline-variant/30 active:scale-95 transition ${focusRing}`}>
      Clear filters
    </button>
  </div>
);

const Toast = ({ message, onDismiss }) => (
  <div className="fixed left-4 right-4 sm:left-auto sm:right-8 bottom-24 z-50 flex justify-center sm:justify-end pointer-events-none" aria-live="polite">
    {message && (
      <div className="sp-pop pointer-events-auto relative overflow-hidden max-w-md flex items-start gap-2 p-space-sm pr-2 rounded-xl bg-surface-container-lowest/95 backdrop-blur-xl border border-secondary/40 text-secondary text-sm font-medium shadow-2xl">
        <Icon name="check_circle" className="text-sm mt-0.5" />
        <span className="flex-1">{message}</span>
        <button type="button" onClick={onDismiss} aria-label="Dismiss message" className={`p-0.5 rounded text-outline hover:text-on-surface ${focusRing}`}>
          <Icon name="close" className="text-sm" />
        </button>
        <span key={message} className="sp-shrink absolute bottom-0 left-0 h-0.5 w-full bg-secondary/60" aria-hidden="true" />
      </div>
    )}
  </div>
);

const CopilotBar = ({ resolved, onAsk, onAutoFix }) => (
  <div
    className={`fixed bottom-6 left-4 right-4 sm:left-auto sm:right-8 z-40 sm:max-w-xl rounded-full p-px shadow-xl ${resolved ? 'bg-secondary/40' : 'sp-slide bg-gradient-to-r from-primary via-secondary to-primary'}`}
    style={resolved ? undefined : { backgroundSize: '200% 100%' }}
  >
  <div className="flex items-center gap-space-sm bg-surface-container-lowest/95 backdrop-blur-2xl px-space-md py-3 rounded-full">
    <div className="relative shrink-0">
      {!resolved && <span className="sp-orb absolute inset-0 rounded-full bg-tertiary/40" aria-hidden="true" />}
      <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-tertiary via-secondary to-primary-container p-0.5 flex items-center justify-center">
        <div className="w-full h-full bg-surface-container-lowest rounded-full flex items-center justify-center">
          <Icon name="auto_awesome" className="text-sm text-tertiary" />
        </div>
      </div>
    </div>

    <button type="button" onClick={onAsk} disabled={resolved} className={`flex flex-col min-w-0 flex-1 text-left rounded-lg cursor-pointer disabled:cursor-default ${focusRing}`}>
      <span className="text-sm font-semibold text-on-surface truncate">
        {!resolved ? "Ask Copilot how to fix Marcus Chen's overbooking" : 'Sprint 14 is balanced. No allocation clashes.'}
      </span>
      <span className="font-mono text-xs text-outline truncate">
        {!resolved ? 'Suggestion: split Hyperion client tasks with Sophia Patel' : 'Suggestion: watch W3 burn rate on Zero-Trust Access Control'}
      </span>
    </button>

    {!resolved ? (
      <button type="button" onClick={onAutoFix} className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-tertiary hover:bg-tertiary-fixed text-on-tertiary-fixed text-xs font-semibold transition-all shadow-md cursor-pointer active:scale-95 ${focusRing}`}>
        <Icon name="bolt" className="text-xs" /> Auto-fix
      </button>
    ) : (
      <span key="done" className="sp-pop shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary text-on-secondary font-mono text-xs font-semibold shadow-md">
        <Icon name="check" className="text-xs" /> Resolved
      </span>
    )}
  </div>
  </div>
);

/* ==========================================================================
   7. PAGE
   ========================================================================== */

export const SprintsPage = ({
  allocations, // reserved: rows are currently built from the PEOPLE / ALLOCATIONS constants above
  onResolveConflict,
  isConflictResolved,
  onOpenAllocateModal,
  onAskCopilotQuery,
  showCopilotBar = false, // your app shell already has a global Copilot bar
}) => {
  const resolved = !!isConflictResolved;

  const [squad, setSquad] = useState('All squads');
  const [timespan, setTimespan] = useState('weeks'); // 'weeks' | 'days' | 'quarter'
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('default');
  const [milestoneOpen, setMilestoneOpen] = useState(true);
  const [celebrate, setCelebrate] = useState(false);
  const toast = useToast();
  const searchRef = useRef(null);
  const wasResolved = useRef(resolved);

  /* --- actions --- */
  const rebalance = useCallback(() => {
    if (resolved) return;
    onResolveConflict?.();
    toast.show('Done: 16h moved to Sophia Patel (bench). All allocations are now within capacity.');
  }, [resolved, onResolveConflict, toast]);

  const closeMilestone = useCallback(() => setMilestoneOpen(false), []);
  useDismiss(milestoneOpen, closeMilestone);

  // Play the celebration only when the conflict flips to resolved during this visit.
  useEffect(() => {
    if (resolved && !wasResolved.current) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 1400);
      wasResolved.current = true;
      return () => clearTimeout(t);
    }
    wasResolved.current = resolved;
    return undefined;
  }, [resolved]);

  // "/" jumps to search.
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* --- filtering --- */
  const scoped = useMemo(() => {
    const ids = SQUADS[squad];
    const q = query.trim().toLowerCase();
    return PEOPLE.filter((p) => (!ids || ids.includes(p.id)) && (!q || p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q)));
  }, [squad, query]);

  const counts = useMemo(() => {
    const c = { all: scoped.length, overbooked: 0, bench: 0, capacity: 0, optimal: 0 };
    scoped.forEach((p) => { c[p.status(resolved)] += 1; });
    return c;
  }, [scoped, resolved]);

  const visible = useMemo(() => {
    const list = scoped.filter((p) => statusFilter === 'all' || p.status(resolved) === statusFilter);
    if (sort === 'load') list.sort((a, b) => b.hours(resolved) - a.hours(resolved));
    if (sort === 'free') list.sort((a, b) => a.hours(resolved) - b.hours(resolved));
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [scoped, statusFilter, resolved, sort]);

  const hasFilters = squad !== 'All squads' || statusFilter !== 'all' || query.trim() !== '';
  const clearFilters = () => { setSquad('All squads'); setStatusFilter('all'); setQuery(''); };

  const showDays = timespan === 'days';

  const renderCell = (p) => {
    switch (p.id) {
      case 'elena': return <ElenaCell open={milestoneOpen} onToggle={() => setMilestoneOpen((o) => !o)} onOpenArtifact={() => toast.show('Opening milestone artifact MS-904')} />;
      case 'marcus': return <MarcusCell resolved={resolved} onRebalance={rebalance} />;
      case 'sophia': return <SophiaCell resolved={resolved} onAssign={rebalance} />;
      default: return <SimpleCell bars={ALLOCATIONS[p.id]} />;
    }
  };

  return (
    <div className="sp-root relative isolate flex flex-col w-full max-w-[1400px] mx-auto pb-32">
      <style>{STYLES}</style>


      <div className="pt-space-md mb-space-lg">
        <PageHeader
          resolved={resolved} celebrate={celebrate} onResolve={rebalance} onAllocate={onOpenAllocateModal}
        />
      </div>

      <div className="mb-space-xl">
        <SectionTitle title="Sprint 14 overview" />
        <SummarySection resolved={resolved} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-space-lg items-start">
        {/* Left rail: what to show */}
        <aside aria-label="Filters" className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:p-1 lg:-m-1">
          <FilterRail
            squad={squad} onSquad={setSquad} status={statusFilter} onStatus={setStatusFilter}
            counts={counts} hasFilters={hasFilters} onClear={clearFilters}
          />
        </aside>

        {/* Board: one card per person */}
        <section aria-label="Allocation board" className="min-w-0">
          <SectionTitle title="Who is working on what" hint={`Showing ${visible.length} of ${PEOPLE.length} people`} />
          <p className="sr-only" aria-live="polite">Showing {visible.length} of {PEOPLE.length} people</p>
          <BoardToolbar query={query} onQuery={setQuery} searchRef={searchRef} timespan={timespan} onTimespan={setTimespan} sort={sort} onSort={setSort} />

          {timespan === 'quarter' && (
            <p className="sp-pop mb-3 text-sm text-on-surface-variant flex items-center gap-2" role="status">
              <Icon name="info" className="text-sm text-outline" />
              Quarter view isn&apos;t available yet. The board below still shows Sprint 14–16 by week.
            </p>
          )}

          <WeekRuler showDays={showDays} />
          {visible.length > 0 ? (
            <div key={`${squad}|${statusFilter}|${sort}`} className="flex flex-col gap-space-sm">
              {visible.map((p, i) => (
                <PersonCard key={p.id} person={p} index={i} resolved={resolved} showDays={showDays} flash={celebrate && (p.id === 'marcus' || p.id === 'sophia')}>
                  {renderCell(p)}
                </PersonCard>
              ))}
            </div>
          ) : (
            <EmptyState onClear={clearFilters} />
          )}
          <Legend />
        </section>
      </div>

      <Toast message={toast.message} onDismiss={toast.dismiss} />
      {showCopilotBar && (
        <CopilotBar
          resolved={resolved} onAutoFix={rebalance}
          onAsk={() => onAskCopilotQuery?.('How can I resolve Marcus Chen sprint clash?')}
        />
      )}
    </div>
  );
};