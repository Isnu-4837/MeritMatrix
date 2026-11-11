import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

/* ==========================================================================
   Microinteractions in this version
   --------------------------------------------------------------------------
   shell     exit animation, bottom sheet on phones, focus trap + focus restore,
             scrollbar-safe scroll lock, accent line draws in, icon bounces in
   fields    label lights up on focus, shake + inline error on invalid submit,
             animated select chevron, code regenerate button
   controls  sliding priority switch, status/assignee chips, hold-to-repeat
             hours stepper with weekly bandwidth bar
   buttons   click ripple, light sweep, success state with check + particle burst
   preview   live project card that updates as you type
   sprint    staged progress checklist, capacity ring + count-up, accent bars
   audit     count-up stats, staggered log, copy sandbox ID, popping badges
   ========================================================================== */

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
.md-root { font-family: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }
.md-root .font-mono { font-family: inherit; }
@keyframes md-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes md-out { to { opacity: 0; } }
@keyframes md-pop { from { opacity: 0; transform: translateY(12px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes md-pop-out { to { opacity: 0; transform: translateY(10px) scale(.97); } }
@keyframes md-sheet { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: none; } }
@keyframes md-sheet-out { to { opacity: 0; transform: translateY(100%); } }
@keyframes md-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes md-shake { 10%, 90% { transform: translateX(-1px); } 20%, 80% { transform: translateX(2px); } 30%, 50%, 70% { transform: translateX(-4px); } 40%, 60% { transform: translateX(4px); } }
@keyframes md-rip { to { transform: scale(1); opacity: 0; } }
@keyframes md-draw { from { stroke-dashoffset: 24; } to { stroke-dashoffset: 0; } }
@keyframes md-burst { from { transform: translate(0, 0) scale(1); opacity: 1; } to { transform: translate(var(--x), var(--y)) scale(.3); opacity: 0; } }
@keyframes md-chip { 0% { transform: scale(.7); } 60% { transform: scale(1.12); } 100% { transform: scale(1); } }
@keyframes md-line { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes md-icon { 0% { transform: scale(.4) rotate(-20deg); opacity: 0; } 70% { transform: scale(1.12) rotate(4deg); opacity: 1; } 100% { transform: none; opacity: 1; } }
@keyframes md-scan { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
@keyframes md-spin-once { to { transform: rotate(360deg); } }

.md-fade { animation: md-fade .2s ease-out both; }
.md-out { animation: md-out .18s ease-in forwards; }
.md-pop { animation: md-pop .3s cubic-bezier(.2, .8, .2, 1) both; }
.md-pop-out { animation: md-pop-out .18s ease-in forwards; }
.md-rise { animation: md-rise .35s ease-out backwards; animation-delay: var(--d, 0ms); }
.md-shake { animation: md-shake .45s cubic-bezier(.36, .07, .19, .97) both; }
.md-draw { stroke-dasharray: 24; animation: md-draw .45s ease-out .05s both; }
.md-burst { animation: md-burst .7s cubic-bezier(.2, .8, .3, 1) forwards; }
.md-chip { animation: md-chip .3s cubic-bezier(.3, 1.5, .5, 1) backwards; animation-delay: var(--d, 0ms); }
.md-line { transform-origin: left; animation: md-line .6s cubic-bezier(.2, .8, .2, 1) .1s both; }
.md-icon { animation: md-icon .5s cubic-bezier(.3, 1.3, .5, 1) .1s both; }
.md-scan { animation: md-scan 1.4s ease-in-out infinite; }
.md-spring { transition: transform .35s cubic-bezier(.3, 1.4, .5, 1); }
.md-ripple { position: absolute; border-radius: 9999px; background: currentColor; opacity: .25; transform: scale(0); animation: md-rip .6s ease-out forwards; pointer-events: none; }
.md-regen:active .md-regen-icon { animation: md-spin-once .5s ease-out; }

.md-shine > [data-rip]::after { content: ''; position: absolute; inset: 0; background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,.35) 50%, transparent 65%); transform: translateX(-120%); }
.md-shine:hover > [data-rip]::after { transform: translateX(120%); transition: transform .75s ease; }

@media (max-width: 639px) {
  .md-pop { animation-name: md-sheet; }
  .md-pop-out { animation-name: md-sheet-out; }
}
@media (prefers-reduced-motion: reduce) {
  .md-fade, .md-pop, .md-rise, .md-shake, .md-draw, .md-burst, .md-chip, .md-line, .md-icon, .md-scan, .md-ripple { animation: none !important; }
  .md-out, .md-pop-out { animation-duration: 1ms !important; }
  .md-spring { transition: none; }
  .md-shine:hover > [data-rip]::after { transition: none; }
}
`;

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const inputBase =
  'w-full px-space-md py-2.5 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline border transition-all focus:outline-none focus:ring-2';
const inputOk = 'border-outline-variant/30 hover:border-outline-variant/60 focus:border-primary focus:ring-primary/30';
const inputBad = 'border-error focus:border-error focus:ring-error/30';
const inputCls = `${inputBase} ${inputOk}`;

const btnGhost = `px-space-md py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default ${focusRing}`;
const btnSolid = `px-space-md py-2 rounded-xl font-semibold shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:hover:translate-y-0 transition-all duration-200 cursor-pointer ${focusRing}`;
const btnPrimary = `${btnSolid} bg-primary text-on-primary hover:bg-primary-fixed-dim`;

const WEEK_HOURS = 40;

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const Icon = ({ name, className = '' }) => (
  <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{name}</span>
);

const Check = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path className="md-draw" d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

/* ---------- Hooks ---------- */

// Plays the exit animation, then calls onClose. `after` runs just before onClose (use it to reset form state).
const useExit = (onClose) => {
  const [closing, setClosing] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const requestClose = useCallback((after) => {
    if (timer.current) return;
    setClosing(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (typeof after === 'function') after();
      onClose();
      setClosing(false);
    }, reducedMotion() ? 0 : 180);
  }, [onClose]);
  return [closing, requestClose];
};

const useCopy = () => {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); } catch { return; }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };
  return [copied, copy];
};

const CountUp = ({ value, decimals = 0, suffix = '', duration = 900 }) => {
  const [v, setV] = useState(reducedMotion() ? value : 0);
  useEffect(() => {
    if (reducedMotion()) { setV(value); return undefined; }
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min((now - t0) / duration, 1);
      setV(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{v.toFixed(decimals)}{suffix}</>;
};

// Click ripple, drawn inside the button's clipping layer so particles and tooltips can still overflow it.
const ripple = (e) => {
  const el = e.currentTarget;
  const layer = el.querySelector('[data-rip]');
  if (!layer) return;
  const r = el.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * 2;
  const s = document.createElement('span');
  s.className = 'md-ripple';
  s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  layer.appendChild(s);
  setTimeout(() => s.remove(), 650);
};

const Btn = ({ className = '', shine = false, children, onPointerDown, ...rest }) => (
  <button
    {...rest}
    onPointerDown={(e) => { ripple(e); if (onPointerDown) onPointerDown(e); }}
    className={`relative ${shine ? 'md-shine' : ''} ${className}`}
  >
    <span data-rip aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" />
    {children}
  </button>
);

const Burst = () => (
  <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
    {Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      const r = 38 + (i % 3) * 12;
      return (
        <span key={i} className="md-burst absolute h-1.5 w-1.5 rounded-full bg-current" style={{ '--x': `${Math.cos(a) * r}px`, '--y': `${Math.sin(a) * r}px` }} />
      );
    })}
  </span>
);

/* ---------- Form pieces ---------- */

const Field = ({ label, hint, error, children }) => (
  <label className="group/field block">
    <span className="block text-sm font-medium text-on-surface mb-1.5 transition-colors group-focus-within/field:text-primary">{label}</span>
    {children}
    {error ? (
      <span role="alert" className="md-rise flex items-center gap-1 text-xs text-error mt-1">
        <Icon name="error" className="text-sm" />
        {error}
      </span>
    ) : (
      hint && <span className="block text-xs text-outline mt-1">{hint}</span>
    )}
  </label>
);

const GroupField = ({ label, role = 'radiogroup', children }) => {
  const id = useId();
  return (
    <div role={role} aria-labelledby={id}>
      <span id={id} className="block text-sm font-medium text-on-surface mb-1.5">{label}</span>
      {children}
    </div>
  );
};

const SelectBox = ({ value, onChange, options }) => (
  <span className="relative block">
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} appearance-none pr-10 cursor-pointer`}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <Icon name="expand_more" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-outline transition-all duration-200 group-focus-within/field:rotate-180 group-focus-within/field:text-primary" />
  </span>
);

const radioKeys = (options, value, onChange) => (e) => {
  const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
  if (!dir) return;
  e.preventDefault();
  const i = Math.max(0, options.findIndex((o) => o.value === value));
  const next = (i + dir + options.length) % options.length;
  onChange(options[next].value);
  const radios = e.currentTarget.querySelectorAll('[role="radio"]');
  if (radios[next]) radios[next].focus();
};

// Sliding thumb behind the selected option.
const Segmented = ({ options, value, onChange }) => {
  const n = options.length;
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      onKeyDown={radioKeys(options, value, onChange)}
      className="relative grid rounded-xl border border-outline-variant/30 bg-surface-container-low p-0.5"
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="md-spring pointer-events-none absolute inset-y-0.5 left-0.5 rounded-[10px] bg-surface-container-highest shadow-sm ring-1 ring-outline-variant/30"
        style={{ width: `calc((100% - 4px) / ${n})`, transform: `translateX(${idx * 100}%)` }}
      />
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <button
            key={o.value} type="button" role="radio" aria-checked={sel} tabIndex={sel ? 0 : -1} onClick={() => onChange(o.value)}
            className={`relative z-10 flex items-center justify-center gap-1.5 rounded-[10px] py-1.5 text-xs font-medium transition-colors cursor-pointer active:scale-95 ${focusRing} ${sel ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            <span key={sel ? 'on' : 'off'} className={`h-2 w-2 rounded-full ${o.dot} ${sel ? 'md-chip' : 'opacity-60'}`} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
};

const ChipGroup = ({ options, value, onChange }) => (
  <div onKeyDown={radioKeys(options, value, onChange)} className="flex flex-wrap gap-1.5">
    {options.map((o) => {
      const sel = o.value === value;
      return (
        <Btn
          key={o.value} type="button" role="radio" aria-checked={sel} tabIndex={sel ? 0 : -1} onClick={() => onChange(o.value)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-200 cursor-pointer active:scale-95 ${focusRing} ${
            sel
              ? 'border-primary/60 bg-primary/10 text-primary'
              : 'border-outline-variant/30 bg-surface-container-low text-on-surface-variant hover:border-outline-variant/70 hover:text-on-surface'
          }`}
        >
          {o.lead}
          <span>{o.label}</span>
          <span className={`overflow-hidden transition-all duration-200 ${sel ? 'max-w-[16px] opacity-100' : 'max-w-0 opacity-0'}`}>
            <Icon name="check" className="text-sm" />
          </span>
        </Btn>
      );
    })}
  </div>
);

const initials = (name) => name.split(' ').map((p) => p[0]).slice(0, 2).join('');

const clampHours = (v) => Math.min(80, Math.max(1, Math.round(v * 2) / 2));
const HOUR_PRESETS = [2, 4, 8, 16];

// Hold a button to keep stepping. The value setter must accept an updater function.
const Stepper = ({ value, onChange }) => {
  const [draft, setDraft] = useState(null);
  const hold = useRef({ t: null, i: null });
  const stop = useCallback(() => { clearTimeout(hold.current.t); clearInterval(hold.current.i); }, []);
  useEffect(() => stop, [stop]);

  const bump = (d) => onChange((v) => clampHours(v + d));
  const start = (d) => {
    stop();
    bump(d);
    hold.current.t = setTimeout(() => { hold.current.i = setInterval(() => bump(d), 90); }, 380);
  };
  const holdProps = (d) => ({
    onPointerDown: (e) => { e.preventDefault(); start(d); },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onKeyDown: (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); bump(d); } },
  });
  const stepBtn = `flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface active:scale-90 transition-all cursor-pointer select-none ${focusRing}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-xl border border-outline-variant/30 bg-surface-container-low p-0.5 transition-colors focus-within:border-primary">
          <button type="button" aria-label="Decrease hours" {...holdProps(-1)} className={stepBtn}><Icon name="remove" className="text-base" /></button>
          <div className="flex w-16 items-baseline justify-center gap-0.5">
            <input
              aria-label="Estimated hours" inputMode="decimal"
              value={draft ?? value}
              onChange={(e) => {
                setDraft(e.target.value);
                const n = parseFloat(e.target.value);
                if (Number.isFinite(n)) onChange(clampHours(n));
              }}
              onBlur={() => setDraft(null)}
              className="w-9 bg-transparent text-center font-semibold text-on-surface focus:outline-none"
            />
            <span className="text-xs text-outline">h</span>
          </div>
          <button type="button" aria-label="Increase hours" {...holdProps(1)} className={stepBtn}><Icon name="add" className="text-base" /></button>
        </div>

        <div className="flex gap-1">
          {HOUR_PRESETS.map((h) => (
            <button
              key={h} type="button" onClick={() => onChange(h)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all active:scale-90 cursor-pointer ${focusRing} ${
                value === h ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              {h}h
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs text-outline">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-container-highest">
          <div
            className={`h-full rounded-full transition-[width,background-color] duration-300 ${value > WEEK_HOURS ? 'bg-error' : 'bg-secondary'}`}
            style={{ width: `${Math.min(value / WEEK_HOURS, 1) * 100}%` }}
          />
        </div>
        <span>{Math.round((value / WEEK_HOURS) * 100)}% of a {WEEK_HOURS}h week</span>
      </div>
    </div>
  );
};

const Footer = ({ children }) => (
  <div className="flex items-center justify-end gap-space-sm pt-space-sm border-t border-outline-variant/20 mt-2">
    {children}
  </div>
);

/* ==========================================================================
   Modal shell
   Backdrop + dialog: closes on Esc or backdrop click (unless busy), locks page
   scroll, traps focus, restores focus on close, announces itself to screen readers.
   ========================================================================== */

const ModalShell = ({ title, subtitle, icon, iconTone = 'text-primary', avatar, size = 'max-w-lg', onClose, closing = false, busy = false, children }) => {
  const titleId = useId();
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    const prevFocus = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    const prevPad = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    const dialog = dialogRef.current;
    if (dialog && !dialog.contains(document.activeElement)) dialog.focus({ preventScroll: true });

    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (!busyRef.current) closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !dialog) return;
      const focusable = dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) { e.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialog)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPad;
      if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div
      className={`md-root ${closing ? 'md-out' : 'md-fade'} fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm`}
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <style>{STYLES}</style>
      <div
        ref={dialogRef} tabIndex={-1}
        role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy || undefined}
        className={`${closing ? 'md-pop-out' : 'md-pop'} relative w-full ${size} max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-2xl p-space-lg flex flex-col gap-space-md focus:outline-none`}
      >
        <span aria-hidden="true" className="md-line pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-secondary to-tertiary" />

        <div className="flex items-start justify-between gap-3 border-b border-outline-variant/20 pb-space-sm">
          <div className="flex items-center gap-3 min-w-0">
            {avatar ? (
              <span className="md-icon relative shrink-0">
                <img src={avatar.src} alt={avatar.alt} className="w-10 h-10 rounded-xl object-cover ring-2 ring-outline-variant/40" />
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-on-secondary ring-2 ring-surface-container-lowest">
                  <Icon name="check" className="text-[11px]" />
                </span>
              </span>
            ) : (
              <span className={`md-icon inline-flex p-2 rounded-xl bg-surface-container-high ${iconTone}`}>
                <Icon name={icon} className="text-headline-sm" />
              </span>
            )}
            <div className="min-w-0">
              <h2 id={titleId} className="font-semibold text-headline-sm text-on-surface truncate">{title}</h2>
              {subtitle && <p className="text-xs text-on-surface-variant truncate">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button" onClick={onClose} disabled={busy} aria-label="Close"
            className={`p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high hover:rotate-90 active:scale-90 transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:hover:rotate-0 ${focusRing}`}
          >
            <Icon name="close" className="text-base" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

const newCode = () => '#PRJ-' + Math.floor(100 + Math.random() * 900);

/* ==========================================================================
   New project
   ========================================================================== */

const PROJECT_STATUSES = ['Planning', 'In Progress', 'QA Review', 'Ready for Staging'].map((s) => ({ value: s, label: s }));
const PRIORITIES = [
  { value: 'Low', label: 'Low', dot: 'bg-secondary' },
  { value: 'Medium', label: 'Medium', dot: 'bg-primary' },
  { value: 'High', label: 'High', dot: 'bg-tertiary' },
  { value: 'Critical', label: 'Critical', dot: 'bg-error' },
];
const PRIORITY_DOT = Object.fromEntries(PRIORITIES.map((p) => [p.value, p.dot]));

export const NewProjectModal = ({ isOpen, onClose, onAddProject }) => {
  const [title, setTitle] = useState('');
  const [code, setCode] = useState(newCode);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('Planning');
  const [dueDate, setDueDate] = useState('Nov 20');
  const [priority, setPriority] = useState('High');
  const [titleError, setTitleError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [done, setDone] = useState(false);
  const titleRef = useRef(null);
  const timers = useRef({ shake: null, done: null });
  const [closing, requestClose] = useExit(onClose);

  useEffect(() => () => { clearTimeout(timers.current.shake); clearTimeout(timers.current.done); }, []);

  if (!isOpen) return null;

  // Start fresh next time the dialog opens.
  const reset = () => {
    setTitle('');
    setDescription('');
    setCode(newCode());
    setTitleError('');
    setDone(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (done) return;
    if (!title.trim()) {
      setTitleError('Give your project a name.');
      setShaking(true);
      clearTimeout(timers.current.shake);
      timers.current.shake = setTimeout(() => setShaking(false), 450);
      if (titleRef.current) titleRef.current.focus();
      return;
    }

    onAddProject({
      id: 'proj-' + Date.now(),
      code,
      title,
      description: description || 'New enterprise sprint workstream bootstrapped with AI.',
      status,
      statusColor: 'bg-primary/20 text-primary',
      dueDate,
      progressPercent: 10,
      completedTasks: 1,
      totalTasks: 10,
      assignees: [{ name: 'Elena Vance', initials: 'EV', color: 'bg-primary-container text-on-primary-container' }],
      accentGradient: 'from-primary to-secondary',
      priority,
    });
    setDone(true);
    timers.current.done = setTimeout(() => requestClose(reset), reducedMotion() ? 150 : 800);
  };

  return (
    <ModalShell title="Create a new project" subtitle="Add a workstream to Sprint 14" icon="add_circle" busy={done} closing={closing} onClose={requestClose}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-space-sm text-body-sm">
        <Field label="Project name" error={titleError}>
          <div className={shaking ? 'md-shake' : ''}>
            <input
              ref={titleRef} autoFocus required type="text" placeholder="e.g. Distributed Vector Indexer"
              value={title} aria-invalid={titleError ? true : undefined}
              onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError(''); }}
              className={`${inputBase} ${titleError ? inputBad : inputOk}`}
            />
          </div>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
          <Field label="Project code">
            <span className="relative block">
              <input type="text" value={code} onChange={(e) => setCode(e.target.value)} className={`${inputCls} pr-11`} />
              <button
                type="button" onClick={() => setCode(newCode())} aria-label="Generate a new project code" title="Generate a new code"
                className={`md-regen absolute right-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-outline hover:bg-surface-container-high hover:text-primary transition-colors cursor-pointer ${focusRing}`}
              >
                <Icon name="autorenew" className="md-regen-icon text-base" />
              </button>
            </span>
          </Field>
          <Field label="Due date">
            <span className="relative block">
              <Icon name="calendar_today" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-outline transition-colors group-focus-within/field:text-primary" />
              <input type="text" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`${inputCls} pl-10`} />
            </span>
          </Field>
        </div>

        <Field label="Description" hint="Optional. Describe deliverables, specifications or system APIs.">
          <textarea rows={3} placeholder="What does this project need to deliver?"
            value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} resize-none`} />
        </Field>

        <GroupField label="Starting status">
          <ChipGroup options={PROJECT_STATUSES} value={status} onChange={setStatus} />
        </GroupField>

        <GroupField label="Priority">
          <Segmented options={PRIORITIES} value={priority} onChange={setPriority} />
        </GroupField>

        {/* Live preview */}
        <div aria-hidden="true" className="relative overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-low p-3 pl-4">
          <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-secondary" />
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-outline">{code || '#PRJ'}</span>
            <span className="flex items-center gap-1.5 text-on-surface-variant">
              <span key={priority} className={`md-chip h-2 w-2 rounded-full ${PRIORITY_DOT[priority]}`} />
              {priority}
            </span>
          </div>
          <p className={`mt-0.5 truncate text-body-sm font-semibold transition-colors ${title.trim() ? 'text-on-surface' : 'text-outline'}`}>
            {title.trim() || 'Untitled project'}
          </p>
          <div className="mt-1.5 flex items-center justify-between text-xs text-on-surface-variant">
            <span key={status} className="md-chip rounded-full bg-primary/15 px-2 py-0.5 text-primary">{status}</span>
            <span>Due {dueDate}</span>
          </div>
        </div>

        <Footer>
          <Btn type="button" onClick={() => requestClose()} disabled={done} className={btnGhost}>Cancel</Btn>
          <Btn
            type="submit" shine={!done} disabled={done}
            className={`${btnPrimary} min-w-[9.5rem] flex items-center justify-center gap-2 ${done ? '!bg-secondary !text-on-secondary disabled:opacity-100 disabled:cursor-default' : ''}`}
          >
            {done ? (
              <>
                <Check />
                <span className="md-chip">Created</span>
                <Burst />
              </>
            ) : (
              'Create project'
            )}
          </Btn>
        </Footer>
      </form>
    </ModalShell>
  );
};

/* ==========================================================================
   Quick task
   ========================================================================== */

const WORKSTREAMS = ['Kinetic UI Token Library', 'Realtime Multi-Agent Orchestrator', 'Hyperion Client Portal', 'Zero-Trust Access Control'].map((w) => ({ value: w, label: w }));
const ASSIGNEES = [
  { value: 'Elena Vance', label: 'Elena Vance' },
  { value: 'Marcus Chen', label: 'Marcus Chen' },
  { value: 'Sophia Patel', label: 'Sophia Patel (on bench)' },
  { value: 'David Kim', label: 'David Kim' },
  { value: 'Aria Montgomery', label: 'Aria Montgomery' },
].map((a) => ({
  ...a,
  lead: (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-container-highest text-[10px] font-semibold text-on-surface">
      {initials(a.value)}
    </span>
  ),
}));

export const QuickTaskModal = ({ isOpen, onClose, onAddTask }) => {
  const [taskName, setTaskName] = useState('');
  const [workstream, setWorkstream] = useState(WORKSTREAMS[0].value);
  const [hours, setHours] = useState(8);
  const [assignee, setAssignee] = useState('Elena Vance');
  const [nameError, setNameError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [done, setDone] = useState(false);
  const nameRef = useRef(null);
  const timers = useRef({ shake: null, done: null });
  const [closing, requestClose] = useExit(onClose);

  useEffect(() => () => { clearTimeout(timers.current.shake); clearTimeout(timers.current.done); }, []);

  if (!isOpen) return null;

  const reset = () => { setTaskName(''); setNameError(''); setDone(false); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (done) return;
    if (!taskName.trim()) {
      setNameError('Describe the task so your team knows what to do.');
      setShaking(true);
      clearTimeout(timers.current.shake);
      timers.current.shake = setTimeout(() => setShaking(false), 450);
      if (nameRef.current) nameRef.current.focus();
      return;
    }
    if (onAddTask) onAddTask({ taskName, workstream, hours: `${hours}h`, assignee });
    setDone(true);
    timers.current.done = setTimeout(() => requestClose(reset), reducedMotion() ? 150 : 800);
  };

  return (
    <ModalShell title="Quick task" subtitle="Add a task without opening a project" icon="add_task" iconTone="text-secondary" size="max-w-md" busy={done} closing={closing} onClose={requestClose}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-space-sm text-body-sm">
        <Field label="Task title" error={nameError}>
          <div className={shaking ? 'md-shake' : ''}>
            <input
              ref={nameRef} autoFocus required type="text" placeholder="e.g. Optimize WebGL shader uniform buffers"
              value={taskName} aria-invalid={nameError ? true : undefined}
              onChange={(e) => { setTaskName(e.target.value); if (nameError) setNameError(''); }}
              className={`${inputBase} ${nameError ? inputBad : inputOk}`}
            />
          </div>
        </Field>

        <Field label="Project">
          <SelectBox value={workstream} onChange={setWorkstream} options={WORKSTREAMS} />
        </Field>

        <GroupField label="Assigned to">
          <ChipGroup options={ASSIGNEES} value={assignee} onChange={setAssignee} />
        </GroupField>

        <GroupField label="Estimated hours" role="group">
          <Stepper value={hours} onChange={setHours} />
        </GroupField>

        <Footer>
          <Btn type="button" onClick={() => requestClose()} disabled={done} className={btnGhost}>Cancel</Btn>
          <Btn
            type="submit" shine={!done} disabled={done}
            className={`${btnSolid} bg-secondary text-on-secondary min-w-[9.5rem] flex items-center justify-center gap-2 disabled:opacity-100 disabled:cursor-default`}
          >
            {done ? (
              <>
                <Check />
                <span className="md-chip">Added</span>
                <Burst />
              </>
            ) : (
              'Add to Sprint 14'
            )}
          </Btn>
        </Footer>
      </form>
    </ModalShell>
  );
};

/* ==========================================================================
   Generate sprint plan
   ========================================================================== */

const CONSTRAINTS = [
  { label: 'Maximum developer bandwidth', value: '40h per week', tone: 'text-secondary' },
  { label: 'Distributed overlap window', value: '3.5h UTC peak', tone: 'text-tertiary' },
  { label: 'TPU allocation limit', value: '250 TPU hours', tone: 'text-on-surface' },
];

const STAGES = ['Reading active projects', 'Checking verified skills', 'Balancing team capacity', 'Drafting the plan'];
const STAGE_MS = 480;

const PLAN_STEPS = [
  { title: 'Resolve Marcus Chen’s double-booking', tag: 'Shift 16h', tone: 'text-secondary', body: 'Reassign Hyperion Client Portal sprint finish to Sophia Patel, who is on the bench.' },
  { title: 'Fast-track Kinetic UI 3D shaders', tag: 'Week 2 milestone', tone: 'text-primary', body: 'Keep Marcus at 32h per week on token generation and shader integration.' },
  { title: 'Zero-Trust gateway auditing', tag: 'M4 release', tone: 'text-tertiary', body: 'Elena Vance delivers the architecture milestone on day 14.' },
];

const BALANCE = 99.4;

const Ring = ({ percent }) => {
  const [p, setP] = useState(reducedMotion() ? percent : 0);
  useEffect(() => {
    const t = setTimeout(() => setP(percent), 120);
    return () => clearTimeout(t);
  }, [percent]);
  const circ = 2 * Math.PI * 15;
  return (
    <svg viewBox="0 0 36 36" className="h-11 w-11 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" className="stroke-secondary/20" />
      <circle
        cx="18" cy="18" r="15" fill="none" strokeWidth="3" strokeLinecap="round" stroke="currentColor"
        className="text-secondary transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - p / 100)}
      />
    </svg>
  );
};

export const GenerateSprintModal = ({ isOpen, onClose, onApplyPlan }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [stage, setStage] = useState(0); // stages completed so far
  const [planGenerated, setPlanGenerated] = useState(false);
  const [applied, setApplied] = useState(false);
  const interval = useRef(null);
  const finish = useRef(null);
  const applyTimer = useRef(null);
  const [closing, requestClose] = useExit(onClose);

  const clearTimers = () => {
    clearInterval(interval.current);
    clearTimeout(finish.current);
    clearTimeout(applyTimer.current);
  };
  useEffect(() => clearTimers, []);

  if (!isOpen) return null;

  const handleRunAI = () => {
    setIsGenerating(true);
    setStage(0);
    let s = 0;
    interval.current = setInterval(() => {
      s += 1;
      setStage(s);
      if (s >= STAGES.length) {
        clearInterval(interval.current);
        finish.current = setTimeout(() => {
          setIsGenerating(false);
          setPlanGenerated(true);
        }, 380);
      }
    }, reducedMotion() ? 120 : STAGE_MS);
  };

  const resetAll = () => {
    clearTimers();
    setIsGenerating(false);
    setStage(0);
    setPlanGenerated(false);
    setApplied(false);
  };

  const handleClose = () => requestClose(resetAll);

  const handleApply = () => {
    if (applied) return;
    if (onApplyPlan) onApplyPlan();
    setApplied(true);
    applyTimer.current = setTimeout(() => requestClose(resetAll), reducedMotion() ? 150 : 800);
  };

  return (
    <ModalShell title="Generate sprint plan" subtitle="AI-assisted planning for Sprint 15" icon="auto_awesome" iconTone="text-tertiary" size="max-w-xl" busy={applied} closing={closing} onClose={handleClose}>
      {!planGenerated ? (
        <div className="flex flex-col gap-space-md">
          <p className="text-body-sm text-on-surface-variant leading-relaxed">
            The AI looks at active projects, verified skills, your current velocity (94.2 pts) and team time zones to draft a balanced plan for Sprint 15.
          </p>

          {isGenerating ? (
            <div aria-live="polite" className="relative overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-low p-space-md">
              <span className="absolute inset-x-0 top-0 h-0.5 bg-surface-container-highest" aria-hidden="true">
                <span className="block h-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-500 ease-out" style={{ width: `${(stage / STAGES.length) * 100}%` }} />
              </span>
              {stage < STAGES.length && (
                <span className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                  <span className="md-scan block h-full w-1/3 bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
                </span>
              )}
              <ol className="relative flex flex-col gap-2.5">
                {STAGES.map((s, i) => {
                  const state = i < stage ? 'done' : i === stage ? 'active' : 'todo';
                  return (
                    <li key={s} className={`flex items-center gap-2.5 text-body-sm transition-colors duration-300 ${state === 'todo' ? 'text-outline' : state === 'active' ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                      <span className="flex h-5 w-5 items-center justify-center">
                        {state === 'done' && <Icon name="check_circle" className="md-chip text-lg text-secondary" />}
                        {state === 'active' && <Icon name="progress_activity" className="text-lg text-primary animate-spin motion-reduce:animate-none" />}
                        {state === 'todo' && <span className="h-2 w-2 rounded-full bg-outline-variant" />}
                      </span>
                      {s}
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : (
            <div className="p-space-md rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2.5">
              <h3 className="text-sm font-semibold text-on-surface">Planning limits</h3>
              {CONSTRAINTS.map((c, i) => (
                <div key={c.label} style={{ '--d': `${i * 60}ms` }} className="md-rise flex items-center justify-between text-body-sm">
                  <span className="text-on-surface-variant">{c.label}</span>
                  <span className={`font-medium ${c.tone}`}>{c.value}</span>
                </div>
              ))}
            </div>
          )}

          <Footer>
            <Btn type="button" onClick={handleClose} className={btnGhost}>Cancel</Btn>
            <Btn
              type="button" shine={!isGenerating} disabled={isGenerating} onClick={handleRunAI}
              className={`${btnPrimary} group flex items-center gap-2 disabled:opacity-70 disabled:cursor-wait`}
            >
              <Icon name={isGenerating ? 'progress_activity' : 'auto_awesome'} className={`text-base ${isGenerating ? 'animate-spin motion-reduce:animate-none' : 'transition-transform duration-300 group-hover:rotate-12'}`} />
              <span>{isGenerating ? 'Building your plan…' : 'Generate plan'}</span>
            </Btn>
          </Footer>
        </div>
      ) : (
        <div className="flex flex-col gap-space-md">
          <div className="md-rise flex items-center justify-between gap-3 p-space-sm rounded-xl bg-secondary/10 border border-secondary/30">
            <span className="flex items-center gap-3">
              <Ring percent={BALANCE} />
              <span className="flex flex-col leading-tight">
                <span className="text-sm text-secondary font-semibold flex items-center gap-1.5">
                  <Icon name="verified" className="text-base" />
                  Plan ready
                </span>
                <span className="text-xs text-on-surface-variant"><CountUp value={BALANCE} decimals={1} suffix="%" /> capacity balance</span>
              </span>
            </span>
            <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-xs font-medium text-secondary">Confidence: high</span>
          </div>

          <ol className="flex flex-col gap-2 max-h-60 overflow-y-auto">
            {PLAN_STEPS.map((step, i) => (
              <li
                key={step.title} style={{ '--d': `${120 + i * 90}ms` }}
                className="md-rise group relative overflow-hidden p-3 pl-4 rounded-xl bg-surface-container-low border border-outline-variant/20 transition-all duration-200 hover:-translate-y-px hover:border-outline-variant/50 hover:shadow-sm"
              >
                <span aria-hidden="true" className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-current transition-all duration-200 group-hover:top-2 group-hover:bottom-2 group-hover:w-1 ${step.tone}`} />
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-body-sm font-semibold text-on-surface">{i + 1}. {step.title}</span>
                  <span className={`text-xs font-medium whitespace-nowrap ${step.tone}`}>{step.tag}</span>
                </div>
                <p className="text-xs text-on-surface-variant">{step.body}</p>
              </li>
            ))}
          </ol>

          <Footer>
            <Btn type="button" onClick={() => setPlanGenerated(false)} disabled={applied} className={btnGhost}>Adjust and regenerate</Btn>
            <Btn
              type="button" shine={!applied} disabled={applied} onClick={handleApply}
              className={`${btnPrimary} min-w-[10.5rem] flex items-center justify-center gap-2 ${applied ? '!bg-secondary !text-on-secondary disabled:opacity-100 disabled:cursor-default' : ''}`}
            >
              {applied ? (
                <>
                  <Check />
                  <span className="md-chip">Applied</span>
                  <Burst />
                </>
              ) : (
                'Apply plan to sprint'
              )}
            </Btn>
          </Footer>
        </div>
      )}
    </ModalShell>
  );
};

/* ==========================================================================
   Sandbox audit
   ========================================================================== */

export const InspectSandboxModal = ({ member, isOpen, onClose }) => {
  const [closing, requestClose] = useExit(onClose);
  const [copied, copy] = useCopy();
  if (!isOpen || !member) return null;

  const hash = member.sandboxHash || '0x8f2d...93b';
  const avail = Number(member.availabilityScore);
  const stats = [
    { label: 'Audit baseline', value: 120, suffix: ' FPS', tone: 'text-secondary' },
    { label: 'Test coverage', value: 98.6, decimals: 1, suffix: '%', tone: 'text-tertiary' },
    member.availabilityScore != null && Number.isFinite(avail)
      ? { label: 'Reliability', value: avail, decimals: Number.isInteger(avail) ? 0 : 1, suffix: '%', tone: 'text-primary' }
      : { label: 'Reliability', text: member.availabilityScore != null ? `${member.availabilityScore}%` : '—', tone: 'text-primary' },
  ];
  const log = [
    '[0.12s] Cryptographic identity token validated via zero-knowledge proof',
    '[0.84s] Distributed unit tests: 412 passed, 0 failed',
    '[1.45s] Shader rendering profile: 120 FPS lock on Metal and WebGPU',
    `[2.10s] Hash signature registered: ${hash}`,
  ];

  return (
    <ModalShell
      title={`${member.name}’s sandbox audit`} subtitle={`Verified sandbox ID: ${hash}`}
      avatar={{ src: member.avatar, alt: member.name }} size="max-w-xl" closing={closing} onClose={requestClose}
    >
      <div className="flex flex-col gap-space-sm text-body-sm">
        <div className="grid grid-cols-3 gap-2">
          {stats.map((s, i) => (
            <div
              key={s.label} style={{ '--d': `${i * 70}ms` }}
              className="md-rise p-3 rounded-xl bg-surface-container-low text-center transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-container hover:shadow-sm"
            >
              <span className="text-xs text-on-surface-variant block">{s.label}</span>
              <span className={`text-headline-sm font-semibold ${s.tone}`}>
                {s.text ?? <CountUp value={s.value} decimals={s.decimals || 0} suffix={s.suffix} />}
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-surface-container-high/50 p-space-sm flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-secondary">Latest sandbox run</h3>
            <button
              type="button" onClick={() => copy(hash)} aria-label="Copy sandbox ID"
              className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-outline hover:bg-surface-container-high hover:text-on-surface active:scale-95 transition-all cursor-pointer ${focusRing}`}
            >
              <Icon name={copied ? 'check' : 'content_copy'} className={`text-sm ${copied ? 'text-secondary' : ''}`} />
              <span key={copied ? 'c' : 'n'} className="md-chip">{copied ? 'Copied' : 'Copy ID'}</span>
            </button>
          </div>
          <ul className="bg-surface-container-lowest p-2.5 rounded-lg text-xs text-on-surface-variant space-y-1">
            {log.map((line, i) => (
              <li key={line} style={{ '--d': `${200 + i * 160}ms` }} className="md-rise flex gap-2">
                <span style={{ '--d': `${300 + i * 160}ms` }} className="md-chip flex shrink-0">
                  <Icon name="check" className="text-sm text-secondary" />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>

        {(member.meritBadges || []).length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-on-surface mb-1.5">Verified badges</h3>
            <div className="flex flex-wrap gap-1.5">
              {member.meritBadges.map((b, i) => (
                <span
                  key={i} style={{ '--d': `${700 + i * 70}ms` }}
                  className="md-chip group px-2.5 py-1 rounded-lg bg-surface-container text-on-surface text-xs flex items-center gap-1.5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-container-high"
                >
                  <Icon name="shield" className="text-sm text-secondary transition-transform duration-300 group-hover:rotate-[360deg]" />
                  {b.title}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <Footer>
        <Btn type="button" onClick={() => requestClose()} className={`${btnSolid} bg-surface-container-high text-on-surface hover:bg-surface-container-highest`}>Close</Btn>
      </Footer>
    </ModalShell>
  );
};