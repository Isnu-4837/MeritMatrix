import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ================================================================== */
/*  Styles                                                             */
/* ================================================================== */

const STYLES = `
.pp-root {
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
}
.pp-root h1,.pp-root h2,.pp-root h3,.pp-root h4 { letter-spacing:-0.016em; }

/* glass card */
.pp-card {
  background: rgba(20,20,20,0.70);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 1.25rem;
  box-shadow: 0 4px 28px rgba(0,0,0,.35), 0 1px 2px rgba(0,0,0,.2);
  transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease, background .22s ease;
}
.pp-card:hover {
  box-shadow: 0 10px 42px rgba(0,0,0,.45), 0 2px 4px rgba(0,0,0,.2);
  border-color: rgba(224,53,53,.22);
}
.pp-card-row:hover {
  background: rgba(26,26,26,0.85);
  border-color: rgba(224,53,53,.18);
}

/* toolbar glass */
.pp-toolbar {
  background: rgba(10,10,10,0.88);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 1.25rem;
  box-shadow: 0 8px 32px rgba(0,0,0,.4);
}

/* modal overlay */
.pp-overlay {
  background: rgba(0,0,0,0.75);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

/* modal panel */
.pp-modal {
  background: rgba(14,14,14,0.98);
  border: 1px solid rgba(224,53,53,.2);
  border-radius: 1.5rem;
  box-shadow: 0 24px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.04);
}

/* stat box */
.pp-stat {
  background: rgba(26,26,26,0.80);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 1rem;
  transition: border-color .2s, background .2s;
}
.pp-stat:hover { border-color: rgba(224,53,53,.25); background: rgba(30,20,20,.9); }

/* overview bar */
.pp-overview {
  background: rgba(18,18,18,0.80);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 1.25rem;
}

/* section pill */
.pp-section-pill {
  display: inline-flex;
  align-items: center;
  gap:.35rem;
  padding:.18rem .65rem;
  border-radius:999px;
  background:rgba(224,53,53,.1);
  border:1px solid rgba(224,53,53,.2);
  font-size:.68rem;
  font-weight:700;
  letter-spacing:.07em;
  text-transform:uppercase;
  color: #e03535;
}

/* glow accent for primary buttons */
.pp-btn-primary {
  background: linear-gradient(135deg, #c01f1f 0%, #e03535 50%, #9b1515 100%);
  box-shadow: 0 4px 18px rgba(224,53,53,.4);
  transition: box-shadow .2s, transform .2s;
}
.pp-btn-primary:hover { box-shadow: 0 6px 28px rgba(224,53,53,.6); transform: translateY(-1px); }

/* red shimmer */
@keyframes ppShimmer { from{transform:translateX(-100%);} to{transform:translateX(100%);} }
.pp-shimmer::after {
  content:'';
  position:absolute;
  inset:0;
  background:linear-gradient(90deg,transparent,rgba(224,53,53,.08),transparent);
  animation: ppShimmer 3s ease-in-out infinite;
  pointer-events:none;
}

@keyframes ppEnter { from{opacity:0;transform:translateY(12px);} to{opacity:1;transform:none;} }
@keyframes ppFade  { from{opacity:0;} to{opacity:1;} }
@keyframes ppPop   { from{opacity:0;transform:translateY(10px) scale(.96);} to{opacity:1;transform:none;} }
@keyframes ppScale { from{stroke-dashoffset:var(--c);} to{stroke-dashoffset:var(--end);} }

.pp-enter { animation: ppEnter .42s cubic-bezier(.2,.7,.2,1) both; }
.pp-fade  { animation: ppFade  .2s ease-out both; }
.pp-pop   { animation: ppPop   .3s cubic-bezier(.2,.8,.2,1) both; }

@media(prefers-reduced-motion:reduce){
  .pp-enter,.pp-fade,.pp-pop,.pp-shimmer::after,.pp-btn-primary { animation:none!important; transition:none!important; }
}
`;

/* ================================================================== */
/*  Config                                                             */
/* ================================================================== */

const TABS = ['All', 'In Progress', 'QA Review', 'Ready for Staging', 'Planning', 'Review Required'];

const STATUS_META = {
  'In Progress':       { dot: 'bg-primary',   text: 'text-primary',   badge: 'bg-primary/15 text-primary' },
  'QA Review':         { dot: 'bg-secondary',  text: 'text-secondary',  badge: 'bg-secondary/15 text-secondary' },
  'Ready for Staging': { dot: 'bg-tertiary',   text: 'text-tertiary',   badge: 'bg-tertiary/15 text-tertiary' },
  'Planning':          { dot: 'bg-outline',    text: 'text-outline',    badge: 'bg-outline/15 text-outline' },
  'Review Required':   { dot: 'bg-error',      text: 'text-error',      badge: 'bg-error/15 text-error' },
};

const SORTS = [
  { id: 'default',      label: 'Default order'  },
  { id: 'progress-desc',label: 'Most complete'  },
  { id: 'progress-asc', label: 'Least complete' },
  { id: 'urgent',       label: 'Urgent first'   },
  { id: 'name',         label: 'Name A–Z'       },
];

const FR = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/70 focus-visible:outline-offset-2';

/* ================================================================== */
/*  Hooks                                                              */
/* ================================================================== */

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const useCountUp = (target, duration = 900) => {
  const [v, setV] = useState(reducedMotion() ? target : 0);
  useEffect(() => {
    if (reducedMotion()) { setV(target); return; }
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min((now - t0) / duration, 1);
      setV(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
};

const useGrow = (dep) => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
    return () => cancelAnimationFrame(id);
  }, [dep]);
  return on;
};

/* ================================================================== */
/*  Shared primitives                                                  */
/* ================================================================== */

const Avatars = ({ people = [], max = 3 }) => (
  <div className="flex items-center">
    {people.slice(0, max).map((a, i) => (
      <div
        key={i}
        title={a.name}
        style={{ marginLeft: i ? -7 : 0, fontSize: 11 }}
        className={`inline-flex items-center justify-center w-7 h-7 shrink-0 rounded-full font-bold leading-none overflow-hidden ring-2 ring-surface ${a.color}`}
      >
        {String(a.initials || '').slice(0, 2)}
      </div>
    ))}
    {people.length > max && (
      <div
        style={{ marginLeft: -7, fontSize: 11 }}
        className="inline-flex items-center justify-center w-7 h-7 shrink-0 rounded-full font-bold leading-none ring-2 ring-surface bg-surface-container-highest text-on-surface-variant"
      >
        +{people.length - max}
      </div>
    )}
  </div>
);

const DueLabel = ({ proj }) => (
  <span className={`text-xs font-medium inline-flex items-center gap-1 whitespace-nowrap ${proj.isUrgent ? 'text-error' : 'text-on-surface-variant'}`}>
    {proj.isUrgent && <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />}
    <span className="material-symbols-outlined text-xs" aria-hidden="true">
      {proj.isUrgent ? 'timer' : 'calendar_month'}
    </span>
    {proj.dueDate}
  </span>
);

const ProgressBar = ({ proj, grow, thin = false }) => (
  <div
    className={`w-full bg-surface-container-highest rounded-full overflow-hidden ${thin ? 'h-1.5' : 'h-2'}`}
    role="progressbar"
    aria-label={`${proj.title} — ${proj.progressPercent}%`}
    aria-valuenow={proj.progressPercent}
    aria-valuemin={0}
    aria-valuemax={100}
  >
    <div
      className={`bg-gradient-to-r ${proj.accentGradient} h-full rounded-full transition-[width] duration-1000 ease-out`}
      style={{ width: grow ? `${proj.progressPercent}%` : '0%' }}
    />
  </div>
);

const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || { badge: 'bg-outline/15 text-outline' };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${m.badge}`}>
      {status}
    </span>
  );
};

/* ================================================================== */
/*  Overview panel                                                     */
/* ================================================================== */

const Overview = ({ projects, counts, activeTab, onPick }) => {
  const total  = projects.length;
  const avg    = total ? Math.round(projects.reduce((s, p) => s + p.progressPercent, 0) / total) : 0;
  const urgent = projects.filter((p) => p.isUrgent).length;
  const done   = projects.reduce((s, p) => s + (p.completedTasks || 0), 0);
  const all    = projects.reduce((s, p) => s + (p.totalTasks    || 0), 0);
  const avgNum = useCountUp(avg);

  const stats = [
    { label: 'Total Projects',    value: total,         icon: 'folder_open',  tone: 'text-on-surface',  bg: 'bg-on-surface/8'  },
    { label: 'Avg. Completion',   value: `${avgNum}%`,  icon: 'donut_large',  tone: 'text-secondary',   bg: 'bg-secondary/10'  },
    { label: 'Due Soon',          value: urgent,        icon: 'timer',        tone: urgent ? 'text-error' : 'text-on-surface', bg: urgent ? 'bg-error/10' : 'bg-on-surface/8' },
    { label: 'Tasks Completed',   value: `${done}/${all}`, icon: 'task_alt',  tone: 'text-primary',     bg: 'bg-primary/10'   },
  ];

  const segments = TABS.slice(1).filter((t) => counts[t]);

  return (
    <div role="region" aria-label="Portfolio overview" className="pp-overview p-5 mb-6">
      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <div
            key={s.label}
            style={{ animationDelay: `${i * 60}ms` }}
            className="pp-enter pp-stat flex items-center gap-3 px-4 py-3"
          >
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
              <span className={`material-symbols-outlined text-xl ${s.tone}`} aria-hidden="true">{s.icon}</span>
            </div>
            <div className="min-w-0">
              <div className={`text-2xl font-bold leading-none ${s.tone}`}>{s.value}</div>
              <div className="text-xs text-on-surface-variant mt-0.5 truncate">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Distribution bar */}
      {total > 0 && segments.length > 0 && (
        <div className="mt-5 pt-5 border-t border-outline-variant/15">
          <div className="flex h-2 w-full gap-0.5 rounded-full overflow-hidden" role="group" aria-label="Projects by status">
            {segments.map((t) => (
              <button
                key={t}
                onClick={() => onPick(activeTab === t ? 'All' : t)}
                aria-label={`${t}: ${counts[t]}`}
                aria-pressed={activeTab === t}
                title={`${t} · ${counts[t]}`}
                style={{ flexGrow: counts[t] }}
                className={`${(STATUS_META[t] || {}).dot || 'bg-outline'} transition-opacity cursor-pointer rounded-full ${
                  activeTab !== 'All' && activeTab !== t ? 'opacity-25' : 'opacity-100 hover:opacity-75'
                }`}
              />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-on-surface-variant">
            {segments.map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${(STATUS_META[t] || {}).dot || 'bg-outline'}`} aria-hidden="true" />
                {t}
                <span className="tabular-nums font-semibold text-on-surface">{counts[t]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/* ================================================================== */
/*  Project Card (grid view)                                           */
/* ================================================================== */

const ProjectCard = ({ proj, index, onOpen }) => {
  const grow = useGrow(proj.id);
  const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(proj); } };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${proj.title}, ${proj.progressPercent}% complete, due ${proj.dueDate}`}
      onClick={() => onOpen(proj)}
      onKeyDown={onKey}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      className={`pp-enter pp-card group relative flex flex-col overflow-hidden cursor-pointer hover:-translate-y-0.5 active:scale-[0.99] ${FR}`}
    >
      {/* Top accent bar */}
      <div className={`h-1 w-full bg-gradient-to-r ${proj.accentGradient} opacity-85 group-hover:opacity-100 transition-opacity`} />

      {/* Shimmer on hover */}
      <div className="relative flex flex-col flex-1 p-5 gap-4">
        {/* Row 1: status + due */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <StatusBadge status={proj.status} />
          <DueLabel proj={proj} />
        </div>

        {/* Title / description */}
        <div className="flex-1">
          <p className="text-xs font-mono text-outline mb-1">{proj.code}</p>
          <h3 className="text-base font-semibold leading-snug text-on-surface mb-2 group-hover:text-primary transition-colors line-clamp-1">
            {proj.title}
          </h3>
          <p className="text-sm text-on-surface-variant line-clamp-2 leading-relaxed">
            {proj.description}
          </p>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-2xl font-bold text-on-surface tabular-nums leading-none">{proj.progressPercent}%</span>
            <span className="text-on-surface-variant tabular-nums">{proj.completedTasks} / {proj.totalTasks} tasks</span>
          </div>
          <ProgressBar proj={proj} grow={grow} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-white/5">
          <Avatars people={proj.assignees} />
          <span className="flex items-center gap-1 text-xs text-outline font-mono group-hover:text-primary transition-colors">
            {proj.code}
            <span className="material-symbols-outlined text-base opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" aria-hidden="true">
              arrow_forward
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

/* ================================================================== */
/*  Project Row (list view)                                            */
/* ================================================================== */

const ProjectRow = ({ proj, index, onOpen }) => {
  const grow = useGrow(proj.id);
  const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(proj); } };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${proj.title}`}
      onClick={() => onOpen(proj)}
      onKeyDown={onKey}
      style={{ animationDelay: `${Math.min(index, 10) * 32}ms` }}
      className={`pp-enter pp-card-row group relative flex flex-col md:flex-row md:items-center gap-3 md:gap-4 px-5 py-3.5 border-b border-white/5 last:border-b-0 cursor-pointer transition-all duration-200 ${FR}`}
    >
      {/* Left accent */}
      <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${proj.accentGradient} opacity-70 group-hover:opacity-100 transition-opacity rounded-l-2xl`} />

      <div className="pl-2 min-w-0 md:flex-[2.2]">
        <p className="text-sm font-semibold text-on-surface truncate group-hover:text-primary transition-colors">{proj.title}</p>
        <p className="text-xs text-outline font-mono">{proj.code}</p>
      </div>

      <div className="hidden md:block md:w-36">
        <StatusBadge status={proj.status} />
      </div>

      <div className="hidden md:flex md:flex-[1.2] items-center gap-2">
        <ProgressBar proj={proj} grow={grow} thin />
        <span className="text-xs tabular-nums text-on-surface font-semibold w-9 text-right shrink-0">{proj.progressPercent}%</span>
      </div>

      <div className="hidden md:flex md:w-28 justify-end">
        <DueLabel proj={proj} />
      </div>

      <div className="hidden md:flex md:w-20 justify-end">
        <Avatars people={proj.assignees} max={2} />
      </div>

      <span className="hidden md:block material-symbols-outlined text-outline group-hover:text-primary group-hover:translate-x-0.5 transition-all text-base" aria-hidden="true">
        chevron_right
      </span>

      {/* Mobile compact row */}
      <div className="md:hidden flex flex-wrap items-center gap-2 pl-2">
        <StatusBadge status={proj.status} />
        <DueLabel proj={proj} />
        <span className="ml-auto text-xs tabular-nums font-semibold text-on-surface">{proj.progressPercent}%</span>
        <div className="w-full"><ProgressBar proj={proj} grow={grow} thin /></div>
      </div>
    </div>
  );
};

/* ================================================================== */
/*  Progress ring (modal)                                              */
/* ================================================================== */

const ProgressRing = ({ percent }) => {
  const shown = useCountUp(percent);
  const r = 26;
  const c = 2 * Math.PI * r;
  const grow = useGrow(percent);
  return (
    <div className="relative w-16 h-16 shrink-0" role="img" aria-label={`${percent}% complete`}>
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-surface-container-highest" />
        <circle
          cx="32" cy="32" r={r}
          fill="none" strokeWidth="6" strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset] duration-1000 ease-out"
          strokeDasharray={c}
          strokeDashoffset={grow ? c * (1 - percent / 100) : c}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-on-surface tabular-nums">
        {shown}%
      </span>
    </div>
  );
};

/* ================================================================== */
/*  Detail Modal                                                       */
/* ================================================================== */

const ProjectModal = ({ proj, onClose, onPrev, onNext, position }) => {
  const closeRef   = useRef(null);
  const lastFocus  = useRef(null);

  useEffect(() => {
    lastFocus.current = document.activeElement;
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; lastFocus.current?.focus?.(); };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape')      onClose();
      if (e.key === 'ArrowRight')  onNext();
      if (e.key === 'ArrowLeft')   onPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNext, onPrev]);

  const tasks = proj.tasks || [
    { title: 'Core Interface Architecture & Token Bindings',          done: true },
    { title: 'Metal & WebGPU Shader Pipeline Test Suite',            done: true },
    { title: 'Sub-second event bus streaming integration',           done: proj.progressPercent > 50 },
    { title: 'Cryptographic state hash verification & deployment',   done: proj.progressPercent > 80 },
  ];
  const doneCount = tasks.filter((t) => t.done).length;

  const infoItems = [
    { label: 'Current phase',  value: proj.status,                             cls: 'text-on-surface' },
    { label: 'Target release', value: proj.dueDate,                             cls: proj.isUrgent ? 'text-error' : 'text-secondary' },
    { label: 'Tasks done',     value: `${proj.completedTasks} of ${proj.totalTasks}`, cls: 'text-primary' },
  ];

  return (
    <div
      className="pp-fade pp-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pp-modal-title"
        className="pp-pop pp-modal relative w-full max-w-2xl flex flex-col gap-5 p-6 max-h-[88vh] overflow-y-auto"
      >
        {/* Accent bar */}
        <div className={`absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r ${proj.accentGradient}`} />

        {/* Modal header */}
        <div className="flex items-start justify-between gap-4 pt-1">
          <div className="flex items-center gap-4">
            <ProgressRing percent={proj.progressPercent} />
            <div>
              <span className="text-xs text-primary font-bold tracking-widest uppercase">{proj.code}</span>
              <h2 id="pp-modal-title" className="text-xl font-bold text-on-surface leading-tight mt-0.5">
                {proj.title}
              </h2>
              <div className="mt-2"><Avatars people={proj.assignees} max={5} /></div>
            </div>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close details"
            className={`p-2 rounded-xl bg-surface-container-high/60 hover:bg-surface-container-high text-outline hover:text-on-surface transition active:scale-90 mt-1 ${FR}`}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">close</span>
          </button>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-outline-variant/30 to-transparent" />

        {/* Description */}
        <p className="text-sm text-on-surface-variant leading-relaxed">{proj.description}</p>

        {/* Info cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {infoItems.map((s) => (
            <div key={s.label} className="pp-stat px-4 py-3">
              <span className="text-xs text-outline block mb-0.5">{s.label}</span>
              <span className={`text-sm font-bold ${s.cls}`}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Subtasks */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-on-surface">Subtasks</h4>
            <span className="text-xs text-outline">
              <span className="text-secondary font-bold">{doneCount}</span> / {tasks.length} done
            </span>
          </div>

          {/* Mini progress bar */}
          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${tasks.length ? (doneCount / tasks.length) * 100 : 0}%` }}
            />
          </div>

          <ul className="space-y-1.5">
            {tasks.map((t, i) => (
              <li
                key={i}
                style={{ animationDelay: `${140 + i * 65}ms` }}
                className={`pp-enter flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  t.done
                    ? 'bg-primary/8 border border-primary/15'
                    : 'bg-surface-container-high/30 border border-white/5'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-base shrink-0 ${t.done ? 'text-primary' : 'text-outline'}`}
                  aria-hidden="true"
                >
                  {t.done ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <span className={t.done ? 'text-on-surface' : 'text-on-surface-variant'}>{t.title}</span>
                {t.done && <span className="ml-auto text-xs text-primary/70 font-semibold">Done</span>}
              </li>
            ))}
          </ul>
        </div>

        {/* Modal footer */}
        <div className="h-px bg-gradient-to-r from-transparent via-outline-variant/25 to-transparent" />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={onPrev}
              aria-label="Previous project"
              className={`p-2 rounded-xl bg-surface-container-high/50 hover:bg-surface-container-high text-outline hover:text-on-surface transition active:scale-90 ${FR}`}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">chevron_left</span>
            </button>
            <span className="text-xs text-outline tabular-nums px-2">{position}</span>
            <button
              onClick={onNext}
              aria-label="Next project"
              className={`p-2 rounded-xl bg-surface-container-high/50 hover:bg-surface-container-high text-outline hover:text-on-surface transition active:scale-90 ${FR}`}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">chevron_right</span>
            </button>
          </div>
          <button
            onClick={onClose}
            className={`px-5 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-sm font-semibold transition active:scale-95 ${FR}`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/* ================================================================== */
/*  Empty state                                                        */
/* ================================================================== */

const EmptyState = ({ hasProjects, onClear, onNew }) => (
  <div className="pp-enter flex flex-col items-center text-center gap-4 py-20 rounded-2xl border border-dashed border-primary/20 bg-primary/4">
    <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center">
      <span className="material-symbols-outlined text-3xl text-primary" aria-hidden="true">
        {hasProjects ? 'search_off' : 'rocket_launch'}
      </span>
    </div>
    <div>
      <h3 className="text-lg font-bold text-on-surface mb-1">
        {hasProjects ? 'No projects match' : 'No workstreams yet'}
      </h3>
      <p className="text-sm text-on-surface-variant max-w-sm leading-relaxed">
        {hasProjects
          ? 'Try a different keyword or status, or clear your filters.'
          : 'Create your first workstream to start tracking progress.'}
      </p>
    </div>
    {hasProjects ? (
      <button
        onClick={onClear}
        className={`px-5 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-sm font-semibold transition active:scale-95 ${FR}`}
      >
        Clear filters
      </button>
    ) : (
      <button
        onClick={onNew}
        className={`pp-btn-primary relative overflow-hidden px-6 py-2.5 rounded-xl text-white text-sm font-bold active:scale-95 ${FR}`}
      >
        New workstream
      </button>
    )}
  </div>
);

/* ================================================================== */
/*  Toggle button style helper                                         */
/* ================================================================== */

const toggleCls = (active) =>
  `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer active:scale-95 ${FR} ${
    active
      ? 'bg-primary/15 text-primary border border-primary/25'
      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface border border-transparent'
  }`;

/* ================================================================== */
/*  Page                                                               */
/* ================================================================== */

export const ProjectsPage = ({ projects = [], onOpenNewProject, onOpenQuickTask, onSelectProject }) => {
  const [activeTab,      setActiveTab]      = useState('All');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [sort,           setSort]           = useState('default');
  const [view,           setView]           = useState('grid');
  const [grouped,        setGrouped]        = useState(false);
  const [urgentOnly,     setUrgentOnly]     = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const searchRef = useRef(null);

  /* Counts */
  const counts = useMemo(() => {
    const c = { All: projects.length };
    projects.forEach((p) => (c[p.status] = (c[p.status] || 0) + 1));
    return c;
  }, [projects]);

  const urgentCount = useMemo(() => projects.filter((p) => p.isUrgent).length, [projects]);

  /* Filter + sort */
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = projects.filter((p) => {
      if (activeTab !== 'All' && p.status !== activeTab) return false;
      if (urgentOnly && !p.isUrgent) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    });
    const s = [...list];
    if (sort === 'progress-desc') s.sort((a, b) => b.progressPercent - a.progressPercent);
    if (sort === 'progress-asc')  s.sort((a, b) => a.progressPercent - b.progressPercent);
    if (sort === 'urgent')        s.sort((a, b) => Number(!!b.isUrgent) - Number(!!a.isUrgent));
    if (sort === 'name')          s.sort((a, b) => a.title.localeCompare(b.title));
    return s;
  }, [projects, activeTab, searchQuery, sort, urgentOnly]);

  /* Sections */
  const sections = useMemo(() => {
    if (!grouped) return [{ key: 'all', title: null, items: filtered }];
    return TABS.slice(1)
      .map((t) => ({ key: t, title: t, items: filtered.filter((p) => p.status === t) }))
      .filter((s) => s.items.length);
  }, [filtered, grouped]);

  const visibleOrder = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  /* Modal controls */
  const open  = useCallback((proj) => { setSelectedProject(proj); onSelectProject?.(proj); }, [onSelectProject]);
  const close = useCallback(() => setSelectedProject(null), []);
  const step  = useCallback((dir) => {
    setSelectedProject((cur) => {
      if (!cur || !visibleOrder.length) return cur;
      const i = visibleOrder.findIndex((p) => p.id === cur.id);
      return visibleOrder[(i + dir + visibleOrder.length) % visibleOrder.length];
    });
  }, [visibleOrder]);

  /* "/" shortcut */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/') return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || selectedProject) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedProject]);

  const hasFilters  = activeTab !== 'All' || searchQuery.trim() !== '' || urgentOnly;
  const clearFilters = () => { setActiveTab('All'); setSearchQuery(''); setUrgentOnly(false); };
  const modalIndex  = selectedProject ? visibleOrder.findIndex((p) => p.id === selectedProject.id) : -1;

  let running = 0;

  return (
    <div className="pp-root max-w-7xl mx-auto flex flex-col w-full pb-32 pt-6 px-1">
      <style>{STYLES}</style>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-5 mb-8">
        <div className="flex flex-col gap-2">
          {/* Eyebrow */}
          <span className="pp-section-pill">
            <span className="material-symbols-outlined" style={{ fontSize: '0.75rem' }}>folder_open</span>
            Cycle 14 Portfolio
          </span>

          <h1
            className="font-bold text-on-surface"
            style={{ fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.025em', lineHeight: 1.15 }}
          >
            Projects &amp; Workstreams
          </h1>

          <p className="text-sm text-on-surface-variant max-w-xl leading-relaxed">
            Track every workstream, spot what's due soon, and open any project to see its subtasks and team.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 mt-1 shrink-0">
          <button
            onClick={onOpenQuickTask}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-sm font-semibold border border-outline-variant/25 hover:border-primary/30 active:scale-95 transition cursor-pointer ${FR}`}
          >
            <span className="material-symbols-outlined text-lg text-secondary" aria-hidden="true">add_task</span>
            Quick Task
          </button>
          <button
            onClick={onOpenNewProject}
            className={`pp-btn-primary relative overflow-hidden flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold active:scale-95 cursor-pointer ${FR}`}
          >
            <span className="relative material-symbols-outlined text-base" aria-hidden="true">add</span>
            <span className="relative">New Workstream</span>
          </button>
        </div>
      </header>

      {/* ── Overview ─────────────────────────────────────────────────── */}
      <Overview projects={projects} counts={counts} activeTab={activeTab} onPick={setActiveTab} />

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="sticky top-2 z-20 pp-toolbar flex flex-col gap-3 p-4 mb-6">
        {/* Status tabs + search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Tabs */}
          <div
            className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none"
            role="group"
            aria-label="Filter by status"
          >
            {TABS.map((tab) => {
              const active = activeTab === tab;
              const m = STATUS_META[tab];
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  aria-pressed={active}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer active:scale-95 ${FR} ${
                    active
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-transparent'
                  }`}
                >
                  {tab !== 'All' && m && (
                    <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} aria-hidden="true" />
                  )}
                  {tab}
                  <span className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${active ? 'bg-primary/20 text-primary' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                    {counts[tab] || 0}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative md:w-64 shrink-0">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm pointer-events-none" aria-hidden="true">search</span>
            <input
              ref={searchRef}
              type="text"
              aria-label="Search workstreams"
              placeholder="Search workstreams…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setSearchQuery('')}
              className="w-full pl-9 pr-10 py-2 rounded-xl bg-surface-container-lowest/70 text-on-surface placeholder:text-outline/60 text-sm border border-outline-variant/25 transition focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40"
            />
            {searchQuery ? (
              <button
                onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high transition"
              >
                <span className="material-symbols-outlined text-sm" aria-hidden="true">close</span>
              </button>
            ) : (
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-outline-variant/40 px-1.5 py-0.5 text-xs text-outline font-mono pointer-events-none" aria-hidden="true">/</kbd>
            )}
          </div>
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-3 border-t border-white/5 text-xs">
          <span className="text-on-surface-variant" aria-live="polite">
            Showing{' '}
            <span className="text-on-surface font-bold tabular-nums">{filtered.length}</span>
            {' '}of {projects.length} workstreams
            {hasFilters && (
              <button onClick={clearFilters} className={`ml-3 text-primary hover:underline rounded ${FR}`}>
                Clear filters
              </button>
            )}
          </span>

          <div className="flex flex-wrap items-center gap-2">
            {/* Urgent toggle */}
            <button onClick={() => setUrgentOnly((v) => !v)} aria-pressed={urgentOnly} className={toggleCls(urgentOnly)}>
              <span className="material-symbols-outlined text-xs" aria-hidden="true">timer</span>
              Due soon
              <span className="tabular-nums">({urgentCount})</span>
            </button>

            {/* Group toggle */}
            <button onClick={() => setGrouped((v) => !v)} aria-pressed={grouped} className={toggleCls(grouped)}>
              <span className="material-symbols-outlined text-xs" aria-hidden="true">view_agenda</span>
              Group by status
            </button>

            {/* Sort */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-outline text-xs pointer-events-none" aria-hidden="true">sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Sort workstreams"
                className={`appearance-none pl-7 pr-7 py-1.5 rounded-lg bg-surface-container-lowest/70 border border-outline-variant/25 text-on-surface text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 ${FR}`}
              >
                {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <span className="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-outline text-xs pointer-events-none" aria-hidden="true">expand_more</span>
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-0.5 p-0.5 rounded-xl border border-outline-variant/25 bg-surface-container-lowest/50" role="group" aria-label="Layout">
              {[
                { id: 'grid', icon: 'grid_view',  label: 'Card view' },
                { id: 'list', icon: 'view_list',  label: 'List view' },
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  aria-pressed={view === v.id}
                  aria-label={v.label}
                  title={v.label}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${FR} ${
                    view === v.id ? 'bg-primary/15 text-primary' : 'text-outline hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">{v.icon}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Results ──────────────────────────────────────────────────── */}
      {filtered.length > 0 ? (
        <div className="flex flex-col gap-10">
          {sections.map((sec) => {
            const start = running;
            running += sec.items.length;
            const m = sec.title ? STATUS_META[sec.title] : null;
            return (
              <section key={sec.key} aria-label={sec.title || 'All workstreams'}>
                {sec.title && (
                  <div className="flex items-center gap-2.5 mb-4">
                    {m && <span className={`w-3 h-3 rounded-full ${m.dot}`} aria-hidden="true" />}
                    <h2 className="text-base font-bold text-on-surface">{sec.title}</h2>
                    <span className="text-xs tabular-nums rounded-full px-2 py-0.5 bg-surface-container-highest text-on-surface-variant font-semibold">
                      {sec.items.length}
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-r from-outline-variant/20 to-transparent ml-1" />
                  </div>
                )}

                {view === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {sec.items.map((p, i) => (
                      <ProjectCard key={p.id} proj={p} index={start + i} onOpen={open} />
                    ))}
                  </div>
                ) : (
                  <div className="pp-card overflow-hidden">
                    {/* List header */}
                    <div className="hidden md:grid grid-cols-[minmax(0,2.2fr)_9rem_minmax(8rem,1.2fr)_7rem_5rem_2rem] gap-x-4 px-5 py-2.5 text-xs font-semibold text-outline border-b border-white/5 bg-surface-container-low/40">
                      <span>Workstream</span>
                      <span>Status</span>
                      <span>Progress</span>
                      <span>Due</span>
                      <span className="text-right">Team</span>
                      <span />
                    </div>
                    {sec.items.map((p, i) => (
                      <ProjectRow key={p.id} proj={p} index={start + i} onOpen={open} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState hasProjects={projects.length > 0} onClear={clearFilters} onNew={onOpenNewProject} />
      )}

      {/* ── Detail Modal ─────────────────────────────────────────────── */}
      {selectedProject && (
        <ProjectModal
          proj={selectedProject}
          onClose={close}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          position={modalIndex >= 0 ? `${modalIndex + 1} of ${visibleOrder.length}` : ''}
        />
      )}
    </div>
  );
};

export default ProjectsPage;