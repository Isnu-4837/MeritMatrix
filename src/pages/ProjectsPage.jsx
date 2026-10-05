import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ---------- Helpers ---------- */

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

const TABS = ['All', 'In Progress', 'QA Review', 'Ready for Staging', 'Planning', 'Review Required'];

// One fixed color per status so the overview bar, tabs and group headers agree.
const STATUS_DOT = {
  'In Progress': 'bg-primary',
  'QA Review': 'bg-secondary',
  'Ready for Staging': 'bg-tertiary',
  Planning: 'bg-outline',
  'Review Required': 'bg-error',
};

const SORTS = [
  { id: 'default', label: 'Default order' },
  { id: 'progress-desc', label: 'Most complete' },
  { id: 'progress-asc', label: 'Least complete' },
  { id: 'urgent', label: 'Urgent first' },
  { id: 'name', label: 'Name A–Z' },
];

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary';

const Avatars = ({ people = [], max = 3 }) => (
  <div className="flex items-center">
    {people.slice(0, max).map((a, i) => (
      <div
        key={i}
        title={a.name}
        style={{ marginLeft: i ? -6 : 0, fontSize: 11 }}
        className={`inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-full font-semibold leading-none overflow-hidden ring-2 ring-surface ${a.color}`}
      >
        {String(a.initials || '').slice(0, 2)}
      </div>
    ))}
    {people.length > max && (
      <div
        style={{ marginLeft: -6, fontSize: 11 }}
        className="inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-full font-semibold leading-none ring-2 ring-surface bg-surface-container-highest text-on-surface-variant"
      >
        +{people.length - max}
      </div>
    )}
  </div>
);

const DueLabel = ({ proj }) => (
  <span className={`text-xs font-medium inline-flex items-center gap-1 whitespace-nowrap ${proj.isUrgent ? 'text-error' : 'text-on-surface-variant'}`}>
    <span className="material-symbols-outlined text-sm" aria-hidden="true">
      {proj.isUrgent ? 'timer' : 'calendar_month'}
    </span>
    {proj.dueDate}
  </span>
);

const ProgressBar = ({ proj, grow, thin }) => (
  <div
    className={`w-full bg-surface-container-highest rounded-full overflow-hidden ${thin ? 'h-1.5' : 'h-2'}`}
    role="progressbar"
    aria-label={`${proj.title} progress`}
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

/* ---------- Overview: stats + clickable status distribution ---------- */

const Overview = ({ projects, counts, activeTab, onPick }) => {
  const total = projects.length;
  const avg = total ? Math.round(projects.reduce((s, p) => s + p.progressPercent, 0) / total) : 0;
  const urgent = projects.filter((p) => p.isUrgent).length;
  const done = projects.reduce((s, p) => s + (p.completedTasks || 0), 0);
  const all = projects.reduce((s, p) => s + (p.totalTasks || 0), 0);
  const avgShown = useCountUp(avg);

  const stats = [
    { label: 'Workstreams', value: total, icon: 'folder_open', cls: 'text-on-surface' },
    { label: 'Average completion', value: `${avgShown}%`, icon: 'donut_large', cls: 'text-secondary' },
    { label: 'Due soon', value: urgent, icon: 'timer', cls: urgent ? 'text-error' : 'text-on-surface' },
    { label: 'Tasks done', value: `${done}/${all}`, icon: 'task_alt', cls: 'text-primary' },
  ];

  const segments = TABS.slice(1).filter((t) => counts[t]);

  return (
    <div role="region" aria-label="Portfolio overview" className="mb-space-lg rounded-2xl border border-outline-variant/30 bg-surface-container/50 p-space-md">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-md">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-3 min-w-0">
            <span className={`material-symbols-outlined text-xl p-2 rounded-xl bg-surface-container-high shrink-0 ${s.cls}`} aria-hidden="true">{s.icon}</span>
            <div className="min-w-0">
              <div className={`text-2xl font-semibold tabular-nums leading-none ${s.cls}`}>{s.value}</div>
              <div className="text-xs text-on-surface-variant mt-1 truncate">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div className="mt-space-md pt-space-md border-t border-outline-variant/20">
          <div className="flex h-2.5 w-full gap-0.5 rounded-full overflow-hidden" role="group" aria-label="Workstreams by status">
            {segments.map((t) => (
              <button
                key={t}
                onClick={() => onPick(activeTab === t ? 'All' : t)}
                aria-label={`${t}: ${counts[t]}`}
                aria-pressed={activeTab === t}
                title={`${t}: ${counts[t]}`}
                style={{ flexGrow: counts[t] }}
                className={`${STATUS_DOT[t] || 'bg-outline'} transition-opacity cursor-pointer ${activeTab !== 'All' && activeTab !== t ? 'opacity-30' : 'opacity-100 hover:opacity-80'}`}
              />
            ))}
          </div>
          <ul className="mt-space-sm flex flex-wrap gap-x-space-md gap-y-1 text-xs text-on-surface-variant">
            {segments.map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[t] || 'bg-outline'}`} aria-hidden="true" />
                {t} <span className="tabular-nums text-on-surface font-medium">{counts[t]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/* ---------- Grid card ---------- */

const ProjectCard = ({ proj, index, onOpen }) => {
  const grow = useGrow(proj.id);
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(proj); }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${proj.title}, ${proj.progressPercent}% complete, due ${proj.dueDate}`}
      onClick={() => onOpen(proj)}
      onKeyDown={onKey}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      className={`pp-enter group relative flex flex-col gap-space-md rounded-2xl bg-surface-container/60 p-space-lg border border-outline-variant/25 cursor-pointer overflow-hidden transition-[transform,border-color,box-shadow] duration-200 hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.99] ${focusRing}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${proj.accentGradient}`} />

      <div className="flex items-center justify-between gap-space-sm">
        <span className={`px-space-sm py-1 rounded-full text-xs font-semibold ${proj.statusColor}`}>{proj.status}</span>
        <DueLabel proj={proj} />
      </div>

      <div className="flex-1">
        <p className="text-xs text-outline mb-1">{proj.code}</p>
        <h3 className="text-lg font-semibold leading-snug text-on-surface mb-space-xs group-hover:text-primary transition-colors">{proj.title}</h3>
        <p className="text-sm text-on-surface-variant line-clamp-2 leading-relaxed">{proj.description}</p>
      </div>

      <div className="space-y-space-xs">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-on-surface text-xl font-semibold tabular-nums leading-none">{proj.progressPercent}%</span>
          <span className="text-on-surface-variant tabular-nums">{proj.completedTasks} of {proj.totalTasks} tasks</span>
        </div>
        <ProgressBar proj={proj} grow={grow} />
      </div>

      <div className="pt-space-sm flex items-center justify-between border-t border-outline-variant/20">
        <Avatars people={proj.assignees} />
        <span className="material-symbols-outlined text-base text-outline group-hover:text-primary transition-colors" aria-hidden="true">arrow_forward</span>
      </div>
    </div>
  );
};

/* ---------- List row (compact view) ---------- */

const ProjectRow = ({ proj, index, onOpen }) => {
  const grow = useGrow(proj.id);
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(proj); }
  };
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${proj.title}`}
      onClick={() => onOpen(proj)}
      onKeyDown={onKey}
      style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
      className={`pp-enter group grid grid-cols-[1fr_auto] md:grid-cols-[minmax(0,2.2fr)_9rem_minmax(8rem,1.2fr)_6rem_5rem] items-center gap-x-space-md gap-y-2 px-space-md py-3 border-b border-outline-variant/20 last:border-b-0 cursor-pointer hover:bg-surface-container-high/50 transition-colors ${focusRing}`}
    >
      <div className="min-w-0">
        <p className="text-base font-semibold text-on-surface truncate group-hover:text-primary transition-colors">{proj.title}</p>
        <p className="text-xs text-outline">{proj.code}</p>
      </div>
      <span className={`hidden md:inline-flex justify-self-start px-space-sm py-1 rounded-full text-xs font-semibold ${proj.statusColor}`}>{proj.status}</span>
      <div className="hidden md:flex items-center gap-2">
        <ProgressBar proj={proj} grow={grow} thin />
        <span className="text-xs tabular-nums text-on-surface w-9 text-right">{proj.progressPercent}%</span>
      </div>
      <div className="hidden md:block"><DueLabel proj={proj} /></div>
      <div className="justify-self-end"><Avatars people={proj.assignees} max={2} /></div>
      <div className="md:hidden col-span-2 flex items-center gap-3">
        <span className={`px-space-sm py-0.5 rounded-full text-xs font-semibold ${proj.statusColor}`}>{proj.status}</span>
        <DueLabel proj={proj} />
        <span className="ml-auto text-xs tabular-nums">{proj.progressPercent}%</span>
      </div>
    </div>
  );
};

/* ---------- Detail modal ---------- */

const ProgressRing = ({ percent }) => {
  const shown = useCountUp(percent);
  const r = 26, c = 2 * Math.PI * r;
  const grow = useGrow(percent);
  return (
    <div className="relative w-16 h-16 shrink-0" role="img" aria-label={`${percent}% complete`}>
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-surface-container-highest" />
        <circle
          cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          className="stroke-secondary transition-[stroke-dashoffset] duration-1000 ease-out"
          strokeDasharray={c}
          strokeDashoffset={grow ? c * (1 - percent / 100) : c}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-on-surface tabular-nums">{shown}%</span>
    </div>
  );
};

const ProjectModal = ({ proj, onClose, onPrev, onNext, position }) => {
  const closeRef = useRef(null);
  const lastFocus = useRef(null);

  useEffect(() => {
    lastFocus.current = document.activeElement;
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      lastFocus.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'ArrowLeft') onPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNext, onPrev]);

  // Use real subtasks when the project provides them; otherwise fall back to the sample list.
  const tasks = proj.tasks || [
    { title: 'Core Interface Architecture & Token Bindings', done: true },
    { title: 'Metal & WebGPU Shader Pipeline Test Suite', done: true },
    { title: 'Sub-second event bus streaming integration', done: proj.progressPercent > 50 },
    { title: 'Cryptographic state hash verification & deployment', done: proj.progressPercent > 80 },
  ];
  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="pp-fade fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="pp-modal-title" className="pp-pop relative w-full max-w-2xl rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-2xl p-space-lg flex flex-col gap-space-md max-h-[85vh] overflow-y-auto">
        <div className={`absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r ${proj.accentGradient}`} />

        <div className="flex items-start justify-between gap-4 border-b border-outline-variant/20 pb-space-sm pt-1">
          <div className="flex items-center gap-4">
            <ProgressRing percent={proj.progressPercent} />
            <div>
              <span className="text-xs text-primary font-semibold">{proj.code}</span>
              <h2 id="pp-modal-title" className="text-xl font-semibold text-on-surface">{proj.title}</h2>
              <div className="mt-1.5"><Avatars people={proj.assignees} max={5} /></div>
            </div>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close details" className={`p-1.5 rounded-lg hover:bg-surface-container-high text-outline hover:text-on-surface transition active:scale-90 ${focusRing}`}>
            <span className="material-symbols-outlined text-base" aria-hidden="true">close</span>
          </button>
        </div>

        <p className="text-base text-on-surface-variant leading-relaxed max-w-prose">{proj.description}</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
          {[
            { label: 'Current phase', value: proj.status, cls: 'text-on-surface' },
            { label: 'Target release', value: proj.dueDate, cls: proj.isUrgent ? 'text-error' : 'text-secondary' },
            { label: 'Tasks done', value: `${proj.completedTasks} of ${proj.totalTasks}`, cls: 'text-primary' },
          ].map((s) => (
            <div key={s.label} className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20">
              <span className="text-xs text-outline block">{s.label}</span>
              <span className={`text-sm font-semibold ${s.cls}`}>{s.value}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-base text-on-surface">Subtasks</h4>
            <span className="text-xs text-outline">{doneCount} of {tasks.length} done</span>
          </div>
          <ul className="space-y-1.5">
            {tasks.map((t, i) => (
              <li key={i} style={{ animationDelay: `${150 + i * 70}ms` }} className="pp-enter flex items-center gap-2 p-2 rounded-xl bg-surface-container-high/40 text-sm">
                <span className={`material-symbols-outlined text-sm ${t.done ? 'text-secondary' : 'text-outline'}`} aria-hidden="true">{t.done ? 'check_circle' : 'radio_button_unchecked'}</span>
                <span className={t.done ? 'text-on-surface' : 'text-outline'}>{t.title}</span>
                <span className="sr-only">{t.done ? '(done)' : '(not done)'}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between gap-space-sm pt-space-sm border-t border-outline-variant/20">
          <div className="flex items-center gap-1 text-xs text-outline">
            <button onClick={onPrev} aria-label="Previous workstream" className={`p-1.5 rounded-lg hover:bg-surface-container-high hover:text-on-surface transition active:scale-90 ${focusRing}`}>
              <span className="material-symbols-outlined text-base" aria-hidden="true">chevron_left</span>
            </button>
            <span className="tabular-nums">{position}</span>
            <button onClick={onNext} aria-label="Next workstream" className={`p-1.5 rounded-lg hover:bg-surface-container-high hover:text-on-surface transition active:scale-90 ${focusRing}`}>
              <span className="material-symbols-outlined text-base" aria-hidden="true">chevron_right</span>
            </button>
          </div>
          <button onClick={onClose} className={`px-space-md py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-sm font-semibold transition active:scale-95 ${focusRing}`}>Close</button>
        </div>
      </div>
    </div>
  );
};

/* ---------- Page ---------- */

export const ProjectsPage = ({ projects, onOpenNewProject, onOpenQuickTask, onSelectProject }) => {
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState('default');
  const [view, setView] = useState('grid'); // 'grid' | 'list'
  const [grouped, setGrouped] = useState(false);
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const searchRef = useRef(null);

  const counts = useMemo(() => {
    const c = { All: projects.length };
    projects.forEach((p) => (c[p.status] = (c[p.status] || 0) + 1));
    return c;
  }, [projects]);

  const urgentCount = useMemo(() => projects.filter((p) => p.isUrgent).length, [projects]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = projects.filter((p) => {
      if (activeTab !== 'All' && p.status !== activeTab) return false;
      if (urgentOnly && !p.isUrgent) return false;
      if (!q) return true;
      return p.title.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    });
    const s = [...list];
    if (sort === 'progress-desc') s.sort((a, b) => b.progressPercent - a.progressPercent);
    if (sort === 'progress-asc') s.sort((a, b) => a.progressPercent - b.progressPercent);
    if (sort === 'urgent') s.sort((a, b) => Number(!!b.isUrgent) - Number(!!a.isUrgent));
    if (sort === 'name') s.sort((a, b) => a.title.localeCompare(b.title));
    return s;
  }, [projects, activeTab, searchQuery, sort, urgentOnly]);

  // Sections: one flat section, or one per status when grouping.
  const sections = useMemo(() => {
    if (!grouped) return [{ key: 'all', title: null, items: filtered }];
    return TABS.slice(1)
      .map((t) => ({ key: t, title: t, items: filtered.filter((p) => p.status === t) }))
      .filter((s) => s.items.length);
  }, [filtered, grouped]);

  // Keep modal prev/next in the order the user sees on screen.
  const visibleOrder = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  const open = useCallback((proj) => { setSelectedProject(proj); onSelectProject?.(proj); }, [onSelectProject]);
  const close = useCallback(() => setSelectedProject(null), []);
  const step = useCallback(
    (dir) => {
      setSelectedProject((cur) => {
        if (!cur || !visibleOrder.length) return cur;
        const i = visibleOrder.findIndex((p) => p.id === cur.id);
        return visibleOrder[(i + dir + visibleOrder.length) % visibleOrder.length];
      });
    },
    [visibleOrder]
  );

  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && !selectedProject) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedProject]);

  const hasFilters = activeTab !== 'All' || searchQuery.trim() !== '' || urgentOnly;
  const clearFilters = () => { setActiveTab('All'); setSearchQuery(''); setUrgentOnly(false); };
  const modalIndex = selectedProject ? visibleOrder.findIndex((p) => p.id === selectedProject.id) : -1;

  let running = 0; // running index so entrance stagger continues across sections

  const toggleBtn = (active) =>
    `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer active:scale-95 ${focusRing} ${
      active ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
    }`;

  return (
    <div className="pp-root max-w-7xl mx-auto flex flex-col w-full pb-32 pt-space-md">
      <style>{`
        .pp-root { font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }
        .pp-root h1, .pp-root h2, .pp-root h3, .pp-root h4 { letter-spacing: -0.015em; }
        @keyframes ppEnter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes ppFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ppPop { from { opacity: 0; transform: translateY(10px) scale(.96); } to { opacity: 1; transform: none; } }
        .pp-enter { animation: ppEnter .4s cubic-bezier(.2,.7,.2,1) both; }
        .pp-fade { animation: ppFade .2s ease-out both; }
        .pp-pop { animation: ppPop .28s cubic-bezier(.2,.8,.2,1) both; }
        @media (prefers-reduced-motion: reduce) { .pp-enter, .pp-fade, .pp-pop { animation: none !important; } }
      `}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-space-md mb-space-lg">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-secondary">Cycle 14 portfolio</p>
          <h1 className="font-semibold text-on-surface" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', letterSpacing: '-0.025em', lineHeight: 1.15 }}>
            Projects &amp; Workstreams
          </h1>
          <p className="text-sm text-on-surface-variant max-w-xl leading-relaxed">
            Track every workstream, see what is due soon, and open any project for its subtasks.
          </p>
        </div>
        <div className="flex items-center gap-space-sm">
          <button onClick={onOpenQuickTask} className={`flex items-center gap-1.5 px-space-md py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-sm font-medium border border-outline-variant/30 hover:border-secondary/50 active:scale-95 transition cursor-pointer ${focusRing}`}>
            <span className="material-symbols-outlined text-sm text-secondary" aria-hidden="true">add_task</span>
            Quick task
          </button>
          <button onClick={onOpenNewProject} className={`group flex items-center gap-1.5 px-space-md py-2 rounded-xl bg-gradient-to-r from-primary to-secondary text-on-primary font-semibold text-sm shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-95 transition cursor-pointer ${focusRing}`}>
            <span className="material-symbols-outlined text-base transition-transform duration-300 group-hover:rotate-90" aria-hidden="true">add</span>
            New workstream
          </button>
        </div>
      </div>

      <Overview projects={projects} counts={counts} activeTab={activeTab} onPick={setActiveTab} />

      {/* Toolbar */}
      <div className="sticky top-2 z-20 flex flex-col gap-space-sm mb-space-lg p-space-md rounded-2xl bg-surface-container-low/90 backdrop-blur-xl border border-outline-variant/30 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0" role="group" aria-label="Filter by status">
            {TABS.map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  aria-pressed={active}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm whitespace-nowrap transition cursor-pointer active:scale-95 ${focusRing} ${
                    active ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                  }`}
                >
                  {tab !== 'All' && <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[tab] || 'bg-outline'}`} aria-hidden="true" />}
                  {tab}
                  <span className={`rounded-full px-1.5 text-xs tabular-nums ${active ? 'bg-on-primary-container/15' : 'bg-surface-container-highest'}`}>{counts[tab] || 0}</span>
                </button>
              );
            })}
          </div>

          <div className="relative md:w-64">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-sm text-outline" aria-hidden="true">search</span>
            <input
              ref={searchRef}
              type="text"
              aria-label="Search workstreams"
              placeholder="Search workstreams"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setSearchQuery('')}
              className="w-full pl-9 pr-10 py-2 rounded-xl bg-surface-container-lowest/80 text-on-surface placeholder:text-outline text-sm border border-outline-variant/30 transition focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
            />
            {searchQuery ? (
              <button onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }} aria-label="Clear search" className="absolute right-2 top-1.5 p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high transition">
                <span className="material-symbols-outlined text-sm" aria-hidden="true">close</span>
              </button>
            ) : (
              <kbd className="absolute right-3 top-2 rounded border border-outline-variant/40 px-1.5 text-xs text-outline" aria-hidden="true">/</kbd>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-space-md gap-y-2 pt-space-sm border-t border-outline-variant/20 text-xs text-on-surface-variant">
          <span aria-live="polite">
            Showing <span className="text-on-surface font-medium tabular-nums">{filtered.length}</span> of {projects.length} workstreams
            {hasFilters && (
              <button onClick={clearFilters} className={`ml-3 text-primary hover:underline rounded ${focusRing}`}>Clear filters</button>
            )}
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setUrgentOnly((v) => !v)} aria-pressed={urgentOnly} className={toggleBtn(urgentOnly)}>
              <span className="material-symbols-outlined text-sm" aria-hidden="true">timer</span>
              Due soon <span className="tabular-nums">({urgentCount})</span>
            </button>
            <button onClick={() => setGrouped((v) => !v)} aria-pressed={grouped} className={toggleBtn(grouped)}>
              <span className="material-symbols-outlined text-sm" aria-hidden="true">view_agenda</span>
              Group by status
            </button>
            <label className="flex items-center gap-2">
              Sort
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg bg-surface-container-lowest/80 border border-outline-variant/30 px-2 py-1 text-on-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-secondary">
                {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <div className="flex items-center rounded-xl border border-outline-variant/30 p-0.5" role="group" aria-label="Layout">
              <button onClick={() => setView('grid')} aria-pressed={view === 'grid'} aria-label="Card view" className={toggleBtn(view === 'grid')}>
                <span className="material-symbols-outlined text-sm" aria-hidden="true">grid_view</span>
              </button>
              <button onClick={() => setView('list')} aria-pressed={view === 'list'} aria-label="List view" className={toggleBtn(view === 'list')}>
                <span className="material-symbols-outlined text-sm" aria-hidden="true">view_list</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {filtered.length > 0 ? (
        <div className="flex flex-col gap-space-xl">
          {sections.map((sec) => {
            const start = running;
            running += sec.items.length;
            return (
              <section key={sec.key} aria-label={sec.title || 'All workstreams'}>
                {sec.title && (
                  <div className="flex items-center gap-2 mb-space-md">
                    <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[sec.title] || 'bg-outline'}`} aria-hidden="true" />
                    <h2 className="text-lg font-semibold text-on-surface">{sec.title}</h2>
                    <span className="text-xs tabular-nums rounded-full px-2 py-0.5 bg-surface-container-highest text-on-surface-variant">{sec.items.length}</span>
                    <div className="flex-1 h-px bg-outline-variant/20 ml-2" />
                  </div>
                )}
                {view === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
                    {sec.items.map((p, i) => <ProjectCard key={p.id} proj={p} index={start + i} onOpen={open} />)}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-outline-variant/25 bg-surface-container/40 overflow-hidden">
                    <div className="hidden md:grid grid-cols-[minmax(0,2.2fr)_9rem_minmax(8rem,1.2fr)_6rem_5rem] gap-x-space-md px-space-md py-2 text-xs font-medium text-outline border-b border-outline-variant/20 bg-surface-container-low/60">
                      <span>Workstream</span><span>Status</span><span>Progress</span><span>Due</span><span className="justify-self-end">Team</span>
                    </div>
                    {sec.items.map((p, i) => <ProjectRow key={p.id} proj={p} index={start + i} onOpen={open} />)}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="pp-enter flex flex-col items-center text-center gap-3 py-20 rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container/30">
          <span className="material-symbols-outlined text-4xl text-outline" aria-hidden="true">search_off</span>
          <h3 className="text-lg font-semibold text-on-surface">{projects.length === 0 ? 'No workstreams yet' : 'No workstreams match'}</h3>
          <p className="text-sm text-on-surface-variant max-w-sm">
            {projects.length === 0 ? 'Create your first workstream to start tracking progress.' : 'Try a different search or status, or clear your filters to see everything.'}
          </p>
          {projects.length === 0 ? (
            <button onClick={onOpenNewProject} className="mt-2 px-space-md py-2 rounded-xl bg-gradient-to-r from-primary to-secondary text-on-primary font-semibold text-sm active:scale-95 transition">New workstream</button>
          ) : (
            <button onClick={clearFilters} className="mt-2 px-space-md py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-sm font-semibold border border-outline-variant/30 active:scale-95 transition">Clear filters</button>
          )}
        </div>
      )}

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