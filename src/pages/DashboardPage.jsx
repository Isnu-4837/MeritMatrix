import React, { useEffect, useMemo, useRef, useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const CYCLE_DAY = 9;
const CYCLE_LENGTH = 14;

const FILTERS = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'in_progress', label: 'In progress', match: (p) => p.status === 'In Progress' },
  {
    id: 'review',
    label: 'In review',
    match: (p) => p.status === 'QA Review' || p.status === 'Review Required',
  },
];

const SORTS = [
  { id: 'default', label: 'Default order' },
  { id: 'progress', label: 'Most progress' },
  { id: 'name', label: 'Name (A-Z)' },
];

const METRICS = [
  {
    id: 'projects',
    label: 'Active Projects',
    icon: 'folder',
    iconTone: 'text-primary',
    value: 12,
    decimals: 0,
    badge: { kind: 'trend', text: '+18%' },
    left: '4 near deadline',
    right: 'On schedule',
    progress: 75,
    bar: 'bg-gradient-to-r from-primary to-secondary',
    spark: [6, 7, 7, 9, 10, 12],
    sparkTone: 'text-primary',
  },
  {
    id: 'velocity',
    label: 'Sprint Velocity',
    icon: 'bolt',
    iconTone: 'text-secondary',
    value: 94.2,
    decimals: 1,
    unit: 'pts',
    badge: { kind: 'delta', text: '+6.4 delta' },
    left: '98% team capacity',
    leftTone: 'text-secondary font-medium',
    right: 'T-4 days remaining',
    progress: 94,
    bar: 'bg-secondary shadow-[0_0_8px_rgba(76,215,246,0.6)]',
    spark: [71, 76, 80, 84, 88, 94.2],
    sparkTone: 'text-secondary',
  },
  {
    id: 'ai',
    label: 'AI Automation',
    icon: 'auto_awesome',
    iconTone: 'text-tertiary',
    value: 34,
    decimals: 0,
    unit: 'hrs',
    badge: { kind: 'pill', text: 'Saved' },
    left: '1,280 neural actions run',
    leftTone: 'text-on-surface-variant font-medium',
    right: 'Neural v3.4',
    progress: 86,
    bar: 'bg-gradient-to-r from-tertiary to-primary',
    spark: [8, 14, 19, 24, 29, 34],
    sparkTone: 'text-tertiary',
  },
];

// Sample sprint data for the insight charts (same style as METRICS above).
const BURNDOWN = {
  total: 120, // story points at sprint start
  days: CYCLE_LENGTH,
  today: CYCLE_DAY,
  actual: [120, 114, 106, 98, 90, 81, 72, 63, 53, 42], // points left, day 0 to today
};

const WEEKLY_CAPACITY = 40;
const TEAM_LOAD = [
  { name: 'Alex Rivera', hours: 40 },
  { name: 'Elena Vance', hours: 32 },
  { name: 'Marcus Chen', hours: 56 },
  { name: 'Sophia Patel', hours: 25 },
  { name: 'David Kim', hours: 36 },
];

// Projects are grouped by status for the donut. Colours stay within the page palette.
const STATUS_GROUPS = [
  { id: 'progress', label: 'In progress', text: 'text-secondary', bg: 'bg-secondary', match: (s) => s === 'In Progress' },
  { id: 'review', label: 'In review', text: 'text-tertiary', bg: 'bg-tertiary', match: (s) => s === 'QA Review' || s === 'Review Required' },
  { id: 'planning', label: 'Planning', text: 'text-primary', bg: 'bg-primary', match: (s) => s === 'Planning' },
  { id: 'other', label: 'Other', text: 'text-outline', bg: 'bg-outline', match: () => true },
];

/* All custom motion lives here, so no Tailwind config changes are needed. */
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
.dp-root { font-family: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }
.dp-root .font-mono { font-family: inherit; }
.dp-root h1, .dp-root h2, .dp-root h3, .dp-root h4 { letter-spacing: -0.015em; }
@keyframes dp-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
@keyframes dp-float { 0%, 100% { transform: translate3d(0, 0, 0) scale(1); } 50% { transform: translate3d(26px, -18px, 0) scale(1.08); } }
@keyframes dp-pan { from { background-position: 0% 50%; } to { background-position: 100% 50%; } }
@keyframes dp-sheen { from { transform: translateX(-120%) skewX(-20deg); } to { transform: translateX(340%) skewX(-20deg); } }
@keyframes dp-draw { to { stroke-dashoffset: 0; } }
@keyframes dp-fade { from { opacity: 0; } to { opacity: 1; } }

.dp-rise { animation: dp-rise .6s cubic-bezier(.2, .7, .2, 1) backwards; animation-delay: var(--d, 0ms); }
.dp-float { animation: dp-float 14s ease-in-out infinite; }
.dp-float-b { animation: dp-float 18s ease-in-out infinite reverse; }
.dp-pan { background-size: 200% 100%; animation: dp-pan 5s ease-in-out infinite alternate; }
.dp-sheen { transform: translateX(-120%) skewX(-20deg); }
.group:hover .dp-sheen { animation: dp-sheen .9s ease; }
.dp-fade { animation: dp-fade .5s 1.6s ease-out backwards; }
.dp-draw { stroke-dasharray: 100; stroke-dashoffset: 100; animation: dp-draw 1.4s .6s ease-out forwards; }
.dp-spot { background: radial-gradient(320px circle at var(--mx, 50%) var(--my, 50%), rgba(76, 215, 246, .12), transparent 65%); }
.dp-avatars { display: flex; }
.dp-avatars > * + * { margin-left: -8px; transition: margin-left .25s ease; }
.group:hover .dp-avatars > * + * { margin-left: -2px; }

@media (prefers-reduced-motion: reduce) {
  .dp-rise, .dp-float, .dp-float-b, .dp-pan, .dp-draw, .dp-fade { animation: none !important; }
  .dp-draw { stroke-dashoffset: 0; }
  .group:hover .dp-sheen { animation: none; }
  .dp-spot { display: none; }
}
`;

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const formatToday = () =>
  new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

// Makes a div behave like a button for keyboard users.
const asButton = (onActivate) => ({
  role: 'button',
  tabIndex: 0,
  onClick: onActivate,
  onKeyDown: (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onActivate();
    }
  },
});

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

/* ------------------------------------------------------------------ */
/*  Animated building blocks                                           */
/* ------------------------------------------------------------------ */

const CountUp = ({ to, decimals = 0, duration = 1200, delay = 0 }) => {
  const [val, setVal] = useState(() => (prefersReducedMotion() ? to : 0));

  useEffect(() => {
    if (prefersReducedMotion()) {
      setVal(to);
      return undefined;
    }
    let raf;
    let start;
    const timer = setTimeout(() => {
      const tick = (now) => {
        if (start === undefined) start = now;
        const p = Math.min((now - start) / duration, 1);
        setVal(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [to, duration, delay]);

  return (
    <span className="tabular-nums">
      {val.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </span>
  );
};

const AnimatedBar = ({ value, className = '', delay = 0 }) => {
  const [w, setW] = useState(() => (prefersReducedMotion() ? value : 0));

  useEffect(() => {
    const t = setTimeout(() => setW(value), delay + 60);
    return () => clearTimeout(t);
  }, [value, delay]);

  return (
    <div
      className={`h-full rounded-full transition-[width] duration-1000 ease-out motion-reduce:transition-none ${className}`}
      style={{ width: `${w}%` }}
    />
  );
};

const Sparkline = ({ data, className = '' }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * 100, 28 - ((v - min) / range) * 24]);
  const points = pts.map((p) => p.join(',')).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox="0 0 100 32" className={className} aria-hidden="true" style={{ overflow: 'visible' }}>
      <polygon points={`0,32 ${points} 100,32`} fill="currentColor" fillOpacity="0.12" className="dp-fade" />
      <polyline
        points={points}
        pathLength="100"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="dp-draw"
      />
      <circle cx={lx} cy={ly} r="2.8" fill="currentColor" className="dp-fade" />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Metric card                                                        */
/* ------------------------------------------------------------------ */

const MetricCard = ({ metric, index }) => {
  const delay = 150 + index * 90;
  return (
    <div
      style={{ '--d': `${delay}ms` }}
      className="dp-rise group relative overflow-hidden rounded-2xl bg-surface-container/60 backdrop-blur-xl p-space-lg shadow-xl hover:bg-surface-container-high/70 hover:shadow-2xl transition-all duration-300 border border-outline-variant/20"
    >

      <div className="relative">
        <div className="flex items-center justify-between mb-space-sm">
          <span className="text-sm text-on-surface-variant font-medium">
            {metric.label}
          </span>
          <span
            className={`p-2 rounded-lg bg-surface-container-highest/60 ${metric.iconTone} material-symbols-outlined text-body-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6`}
          >
            {metric.icon}
          </span>
        </div>

        <div className="flex items-end justify-between gap-space-sm mb-space-xs">
          <div className="flex items-baseline flex-wrap gap-space-xs">
            <span
              className="font-semibold text-on-surface tabular-nums"
              style={{ fontSize: 'clamp(1.75rem, 4vw, 2.25rem)', letterSpacing: '-0.03em', lineHeight: '1' }}
            >
              <CountUp to={metric.value} decimals={metric.decimals} delay={delay} />
            </span>
            {metric.unit && (
              <span className="text-sm text-outline font-mono">{metric.unit}</span>
            )}
            {metric.badge.kind === 'trend' && (
              <span className="font-mono text-xs text-secondary flex items-center font-semibold">
                <span className="material-symbols-outlined text-sm">trending_up</span>
                {metric.badge.text}
              </span>
            )}
            {metric.badge.kind === 'delta' && (
              <span className="font-mono text-xs text-secondary font-medium">
                {metric.badge.text}
              </span>
            )}
            {metric.badge.kind === 'pill' && (
              <span className="px-space-xs py-0.5 rounded-full bg-tertiary/20 text-tertiary font-mono text-xs font-semibold">
                {metric.badge.text}
              </span>
            )}
          </div>
          <Sparkline data={metric.spark} className={`w-20 h-7 shrink-0 ${metric.sparkTone}`} />
        </div>

        <div className="flex items-center justify-between text-outline text-xs">
          <span className={metric.leftTone || ''}>{metric.left}</span>
          <span className="text-xs text-on-surface-variant">{metric.right}</span>
        </div>

        <div
          role="progressbar"
          aria-label={metric.label}
          aria-valuenow={metric.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="w-full bg-surface-container-highest h-1 rounded-full mt-space-sm overflow-hidden"
        >
          <AnimatedBar value={metric.progress} delay={delay + 200} className={metric.bar} />
        </div>
      </div>
    </div>
  );
};


/* ------------------------------------------------------------------ */
/*  Insights: burndown, project status donut, team workload            */
/* ------------------------------------------------------------------ */

const InsightCard = ({ title, subtitle, badge, index = 0, className = '', children }) => (
  <div
    style={{ '--d': `${200 + index * 90}ms` }}
    className={`dp-rise relative rounded-2xl bg-surface-container/60 backdrop-blur-xl p-space-lg shadow-xl flex flex-col gap-space-sm ${className}`}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-headline-sm font-semibold text-on-surface">{title}</h3>
        {subtitle && <p className="text-xs text-on-surface-variant mt-0.5">{subtitle}</p>}
      </div>
      {badge}
    </div>
    {children}
  </div>
);

const Chip = ({ tone = 'secondary', children }) => (
  <span
    className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
      tone === 'error' ? 'bg-error/15 text-error' : 'bg-secondary/15 text-secondary'
    }`}
  >
    {children}
  </span>
);

// Points left each day, against the ideal straight line. Hover to read any day.
const BurndownChart = () => {
  const { total, days, today, actual } = BURNDOWN;
  const W = 600;
  const H = 230;
  const L = 34;
  const R = 14;
  const T = 16;
  const B = 28;
  const pw = W - L - R;
  const ph = H - T - B;
  const x = (d) => L + (d / days) * pw;
  const y = (v) => T + (1 - v / total) * ph;
  const ideal = (d) => total - (total * d) / days;
  const last = actual[actual.length - 1];
  const line = actual.map((v, d) => `${x(d)},${y(v)}`).join(' ');
  const area = `${x(0)},${y(0)} ${line} ${x(actual.length - 1)},${y(0)}`;
  const ahead = ideal(today) - last; // positive: fewer points left than planned
  const onTrack = ahead >= 0;

  const [hover, setHover] = useState(null);
  const ref = useRef(null);
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(days, Math.round(((vx - L) / pw) * days))));
  };

  const summary = `Burndown: ${last} of ${total} points left on day ${today} of ${days}, ${Math.abs(ahead).toFixed(1)} points ${onTrack ? 'ahead of' : 'behind'} plan.`;

  return (
    <InsightCard
      title="Sprint burndown"
      subtitle="Story points still to do"
      index={0}
      className="lg:col-span-6"
      badge={<Chip tone={onTrack ? 'secondary' : 'error'}>{Math.abs(ahead).toFixed(1)} pts {onTrack ? 'ahead' : 'behind'}</Chip>}
    >
      <div className="relative">
        <svg
          ref={ref}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={summary}
          className="w-full h-auto"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="dp-burn-fill" x1="0" y1="0" x2="0" y2="1" className="text-secondary">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.3" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const v = Math.round(total * f);
            return (
              <g key={f} className="text-outline">
                <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity="0.2" strokeDasharray="3 4" />
                <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="currentColor">{v}</text>
              </g>
            );
          })}
          {Array.from({ length: days / 2 + 1 }, (_, i) => i * 2).map((d) => (
            <text key={d} x={x(d)} y={H - 8} textAnchor="middle" fontSize="11" className="text-outline" fill="currentColor">
              {d === 0 ? 'Start' : `D${d}`}
            </text>
          ))}

          {/* Ideal pace */}
          <line x1={x(0)} y1={y(total)} x2={x(days)} y2={y(0)} className="text-outline" stroke="currentColor" strokeOpacity="0.65" strokeWidth="1.5" />

          {/* Projection from today to the end, if the current pace holds */}
          <line x1={x(today)} y1={y(last)} x2={x(days)} y2={y(0)} className="text-primary" stroke="currentColor" strokeWidth="2.5" strokeDasharray="6 6" strokeLinecap="round" />

          {/* Actual */}
          <g className="text-secondary">
            <polygon points={area} fill="url(#dp-burn-fill)" className="dp-fade" />
            <polyline points={line} pathLength="100" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="dp-draw" />
            <circle cx={x(today)} cy={y(last)} r="9" fill="currentColor" opacity="0.2" className="animate-pulse motion-reduce:animate-none" />
            <circle cx={x(today)} cy={y(last)} r="4.5" fill="currentColor" className="dp-fade" />
          </g>

          {/* Today marker */}
          <line x1={x(today)} x2={x(today)} y1={T} y2={H - B} className="text-secondary" stroke="currentColor" strokeOpacity="0.4" strokeDasharray="2 4" />
          <text x={x(today)} y={T - 4} textAnchor="middle" fontSize="11" fontWeight="600" className="text-secondary" fill="currentColor">Today</text>

          {/* Hover read-out */}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="text-on-surface" stroke="currentColor" strokeOpacity="0.25" />
              <circle cx={x(hover)} cy={y(ideal(hover))} r="4" className="text-outline" fill="currentColor" />
              {hover < actual.length && <circle cx={x(hover)} cy={y(actual[hover])} r="5" className="text-secondary" fill="currentColor" />}
            </g>
          )}
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-surface-container-highest/95 border border-outline-variant/30 px-2.5 py-1.5 text-xs shadow-lg"
            style={{ left: `${Math.min(86, Math.max(14, (x(hover) / W) * 100))}%` }}
          >
            <p className="font-semibold text-on-surface">{hover === 0 ? 'Sprint start' : `Day ${hover}`}</p>
            <p className="text-on-surface-variant">Ideal: {Math.round(ideal(hover))} pts</p>
            {hover < actual.length && <p className="text-secondary font-medium">Actual: {actual[hover]} pts</p>}
          </div>
        )}
      </div>

      <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-on-surface-variant">
        <li className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-secondary" />Actual</li>
        <li className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-outline" />Ideal pace</li>
        <li className="flex items-center gap-1.5"><span className="w-3 border-t-2 border-dashed border-primary" />If pace holds</li>
        <li className="ml-auto text-on-surface font-medium">{last} of {total} pts left</li>
      </ul>
    </InsightCard>
  );
};

// Projects by status. Hover or focus a legend row to isolate its slice.
const StatusDonut = ({ projects }) => {
  const [ready, setReady] = useState(prefersReducedMotion());
  const [active, setActive] = useState(null);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 500);
    return () => clearTimeout(t);
  }, []);

  const total = projects.length;
  const segments = useMemo(() => {
    const counts = new Map(STATUS_GROUPS.map((g) => [g.id, 0]));
    projects.forEach((p) => {
      const group = STATUS_GROUPS.find((g) => g.match(p.status)) || STATUS_GROUPS[STATUS_GROUPS.length - 1];
      counts.set(group.id, (counts.get(group.id) || 0) + 1);
    });
    let offset = 0;
    return STATUS_GROUPS.filter((g) => counts.get(g.id) > 0).map((g) => {
      const count = counts.get(g.id) || 0;
      const pct = (count / total) * 100;
      const seg = { ...g, count, pct, offset };
      offset += pct;
      return seg;
    });
  }, [projects, total]);

  const current = segments.find((g) => g.id === active);

  return (
    <InsightCard title="Projects by status" subtitle="Where every project stands" index={1} className="lg:col-span-3">
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-on-surface-variant">No projects yet.</p>
      ) : (
        <>
          <div className="relative mx-auto w-36 h-36" role="img" aria-label={`${total} projects: ${segments.map((g) => `${g.count} ${g.label}`).join(', ')}`}>
            <svg viewBox="0 0 42 42" className="w-full h-full -rotate-90">
              <circle cx="21" cy="21" r="15.9155" fill="none" strokeWidth="5" stroke="currentColor" className="text-surface-container-highest" />
              {segments.map((g, i) => {
                const len = Math.max(g.pct - (segments.length > 1 ? 1.4 : 0), 0.1);
                return (
                  <circle
                    key={g.id}
                    cx="21" cy="21" r="15.9155" fill="none" strokeWidth="5" stroke="currentColor"
                    className={g.text}
                    strokeDasharray={ready ? `${len} ${100 - len}` : '0 100'}
                    strokeDashoffset={-g.offset}
                    style={{ opacity: active === null || active === g.id ? 1 : 0.25, transition: `stroke-dasharray .9s ease-out ${i * 120}ms, opacity .2s` }}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-semibold text-on-surface" style={{ letterSpacing: '-0.03em' }}>{current ? current.count : total}</span>
              <span className="text-xs text-on-surface-variant">{current ? current.label : total === 1 ? 'project' : 'projects'}</span>
            </div>
          </div>

          <ul className="flex flex-col gap-1">
            {segments.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(g.id)} onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(g.id)} onBlur={() => setActive(null)}
                  className={`w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-sm text-left hover:bg-surface-container-high transition-colors cursor-default ${FOCUS_RING}`}
                >
                  <span className="flex items-center gap-2 text-on-surface-variant"><span className={`w-2.5 h-2.5 rounded-full ${g.bg}`} aria-hidden="true" />{g.label}</span>
                  <span className="text-on-surface font-medium">{g.count} <span className="text-outline font-normal">· {Math.round(g.pct)}%</span></span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </InsightCard>
  );
};

// Hours booked per person this week. The tick on each bar marks the weekly capacity.
const WorkloadChart = () => {
  const SCALE = 60; // bars span 0 to 60h so the 40h tick sits two thirds along
  const sorted = [...TEAM_LOAD].sort((a, b) => b.hours - a.hours);
  const over = TEAM_LOAD.filter((m) => m.hours > WEEKLY_CAPACITY);
  const busiest = sorted[0];
  const freest = sorted[sorted.length - 1];

  return (
    <InsightCard
      title="Team workload"
      subtitle={`Hours booked this week (capacity ${WEEKLY_CAPACITY}h)`}
      index={2}
      className="lg:col-span-3"
      badge={over.length ? <Chip tone="error">{over.length} over</Chip> : <Chip>Balanced</Chip>}
    >
      <ul className="flex flex-col gap-3">
        {TEAM_LOAD.map((m, i) => {
          const isOver = m.hours > WEEKLY_CAPACITY;
          const tone = isOver ? 'bg-error' : m.hours === WEEKLY_CAPACITY ? 'bg-primary' : 'bg-secondary';
          return (
            <li key={m.name}>
              <div className="flex items-baseline justify-between gap-2 text-sm mb-1">
                <span className="text-on-surface font-medium truncate">{m.name}</span>
                <span className={`tabular-nums font-semibold ${isOver ? 'text-error' : 'text-on-surface-variant'}`}>{m.hours}h</span>
              </div>
              <div
                className="relative h-2 rounded-full bg-surface-container-highest overflow-hidden"
                role="progressbar" aria-label={`${m.name} is booked ${m.hours} of ${WEEKLY_CAPACITY} hours`}
                aria-valuenow={m.hours} aria-valuemin={0} aria-valuemax={SCALE}
              >
                <AnimatedBar value={(m.hours / SCALE) * 100} delay={500 + i * 90} className={tone} />
                <span className="absolute inset-y-0 w-px bg-on-surface/50" style={{ left: `${(WEEKLY_CAPACITY / SCALE) * 100}%` }} aria-hidden="true" />
              </div>
            </li>
          );
        })}
      </ul>
      {busiest.hours > WEEKLY_CAPACITY && (
        <p className="flex items-start gap-1.5 text-xs text-on-surface-variant leading-relaxed">
          <span className="material-symbols-outlined text-sm text-tertiary mt-px">lightbulb</span>
          <span>{busiest.name} is {busiest.hours - WEEKLY_CAPACITY}h over. {freest.name} has {WEEKLY_CAPACITY - freest.hours}h free.</span>
        </p>
      )}
    </InsightCard>
  );
};

/* ------------------------------------------------------------------ */
/*  Project card (grid) and project row (list)                         */
/* ------------------------------------------------------------------ */

const StatusBadge = ({ project }) => (
  <span className={`px-space-sm py-1 rounded-full font-mono text-label-sm font-semibold ${project.statusColor}`}>
    {project.status}
  </span>
);

const DueDate = ({ project }) => (
  <span
    className={`font-mono text-label-sm font-medium flex items-center gap-1 ${
      project.isUrgent ? 'text-error' : 'text-outline'
    }`}
  >
    {project.isUrgent && <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />}
    <span className="material-symbols-outlined text-xs">
      {project.isUrgent ? 'timer' : 'calendar_month'}
    </span>
    {project.isUrgent ? `Due soon · ${project.dueDate}` : project.dueDate}
  </span>
);

const Avatars = ({ assignees }) => (
  <div className="dp-avatars">
    {assignees.map((assignee, idx) => (
      <div
        key={idx}
        className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-mono text-label-sm font-bold ring-2 ring-surface ${assignee.color}`}
        title={assignee.name}
      >
        {assignee.initials}
      </div>
    ))}
  </div>
);

const ProjectCard = ({ project, index, onSelect }) => {
  const assignees = project.assignees || [];
  const delay = 300 + Math.min(index, 8) * 70;
  return (
    <div
      {...asButton(() => onSelect && onSelect(project))}
      aria-label={`Open ${project.title}`}
      style={{ '--d': `${delay}ms` }}
      className={`dp-rise group relative rounded-2xl bg-surface-container/60 backdrop-blur-xl p-space-lg shadow-xl hover:bg-surface-container-high/80 hover:shadow-2xl transition-all duration-300 flex flex-col justify-between overflow-hidden border border-outline-variant/20 cursor-pointer hover:border-primary/40 hover:-translate-y-0.5 ${FOCUS_RING}`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${project.accentGradient} opacity-80 group-hover:opacity-100 transition-opacity`}
      />

      <div className="relative">
        <div className="flex items-center justify-between gap-space-sm mb-space-md">
          <StatusBadge project={project} />
          <DueDate project={project} />
        </div>

        <h3 className="text-headline-sm text-on-surface font-semibold mb-space-xs group-hover:text-primary transition-colors">
          {project.title}
        </h3>
        <p className="text-body-sm text-on-surface-variant mb-space-lg line-clamp-2 leading-relaxed">
          {project.description}
        </p>

        <div className="space-y-space-xs mb-space-md">
          <div className="flex items-center justify-between font-mono text-label-sm">
            <span className="text-on-surface-variant">Progress</span>
            <span className="text-on-surface font-medium flex items-center gap-1">
              {project.progressPercent >= 100 && (
                <span className="material-symbols-outlined text-sm text-secondary">check_circle</span>
              )}
              {project.completedTasks} of {project.totalTasks} tasks · {project.progressPercent}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={`${project.title} progress`}
            aria-valuenow={project.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden"
          >
            <AnimatedBar
              value={project.progressPercent}
              delay={delay + 150}
              className={`bg-gradient-to-r ${project.accentGradient}`}
            />
          </div>
        </div>
      </div>

      <div className="relative pt-space-sm flex items-center justify-between border-t border-surface-container-highest/60">
        <Avatars assignees={assignees} />
        <span className="flex items-center gap-1 text-outline font-mono text-label-sm">
          {project.code}
          <span className="material-symbols-outlined text-body-lg text-primary opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
            arrow_forward
          </span>
        </span>
      </div>
    </div>
  );
};

const ProjectRow = ({ project, index, onSelect }) => {
  const assignees = project.assignees || [];
  const delay = 250 + Math.min(index, 10) * 50;
  return (
    <div
      {...asButton(() => onSelect && onSelect(project))}
      aria-label={`Open ${project.title}`}
      style={{ '--d': `${delay}ms` }}
      className={`dp-rise group relative overflow-hidden flex flex-col md:flex-row md:items-center gap-space-sm md:gap-space-md rounded-xl bg-surface-container/60 backdrop-blur-xl pl-space-lg pr-space-md py-space-sm border border-outline-variant/20 hover:bg-surface-container-high/80 hover:border-primary/40 transition-all duration-300 cursor-pointer ${FOCUS_RING}`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${project.accentGradient}`} />

      <div className="relative min-w-0 md:flex-1">
        <h3 className="text-body-lg text-on-surface font-semibold truncate group-hover:text-primary transition-colors">
          {project.title}
        </h3>
        <span className="text-outline font-mono text-label-sm">{project.code}</span>
      </div>

      <div className="relative md:w-36">
        <StatusBadge project={project} />
      </div>

      <div className="relative md:w-44">
        <div className="flex items-center justify-between font-mono text-label-sm mb-1">
          <span className="text-outline">
            {project.completedTasks}/{project.totalTasks} tasks
          </span>
          <span className="text-on-surface font-medium">{project.progressPercent}%</span>
        </div>
        <div
          role="progressbar"
          aria-label={`${project.title} progress`}
          aria-valuenow={project.progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden"
        >
          <AnimatedBar
            value={project.progressPercent}
            delay={delay + 150}
            className={`bg-gradient-to-r ${project.accentGradient}`}
          />
        </div>
      </div>

      <div className="relative md:w-32 md:flex md:justify-end">
        <DueDate project={project} />
      </div>

      <div className="relative">
        <Avatars assignees={assignees} />
      </div>

      <span className="relative hidden md:block material-symbols-outlined text-outline group-hover:text-primary group-hover:translate-x-0.5 transition-all">
        chevron_right
      </span>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */

const EmptyState = ({ hasProjects, onClear, onNew }) => (
  <div className="dp-rise flex flex-col items-center text-center rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container/30 backdrop-blur-xl px-space-lg py-space-xl">
    <div className="w-14 h-14 rounded-2xl bg-surface-container-high flex items-center justify-center text-primary mb-space-sm">
      <span className="material-symbols-outlined text-headline-md">
        {hasProjects ? 'search_off' : 'rocket_launch'}
      </span>
    </div>
    <h3 className="text-headline-sm text-on-surface font-semibold mb-1">
      {hasProjects ? 'No projects match your search' : 'No projects yet'}
    </h3>
    <p className="text-body-sm text-outline max-w-sm mb-space-md leading-relaxed">
      {hasProjects
        ? 'Try a different word, or clear the filters to see every project.'
        : 'Create your first project to start planning a sprint.'}
    </p>
    <div className="flex flex-wrap justify-center gap-space-sm">
      {hasProjects && (
        <button
          type="button"
          onClick={onClear}
          className={`px-space-md py-space-sm rounded-xl bg-surface-container-high text-on-surface text-body-md font-medium hover:bg-surface-container-highest transition-colors cursor-pointer ${FOCUS_RING}`}
        >
          Clear filters
        </button>
      )}
      <button
        type="button"
        onClick={onNew}
        className={`px-space-md py-space-sm rounded-xl bg-gradient-to-r from-primary-container to-secondary-container text-on-primary-container text-body-md font-semibold active:scale-95 transition-transform cursor-pointer ${FOCUS_RING}`}
      >
        New project
      </button>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export const DashboardPage = ({
  projects = [],
  userName = 'Elena',
  onOpenQuickTask,
  onOpenGenerateSprint,
  onOpenNewProject,
  onSelectProject,
}) => {
  const [filterType, setFilterType] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'compact'
  const [sortBy, setSortBy] = useState('default');
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);

  // Press "/" anywhere to jump to search.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
      e.preventDefault();
      searchRef.current && searchRef.current.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, projects.filter(f.match).length])),
    [projects]
  );

  const q = query.trim().toLowerCase();

  const visible = useMemo(() => {
    const active = FILTERS.find((f) => f.id === filterType) || FILTERS[0];
    let list = projects.filter(active.match).filter((p) => {
      if (!q) return true;
      const haystack = [p.title, p.code, p.description, p.status, ...(p.assignees || []).map((a) => a.name)];
      return haystack.filter(Boolean).some((s) => String(s).toLowerCase().includes(q));
    });
    if (sortBy === 'progress') {
      list = [...list].sort((a, b) => (b.progressPercent || 0) - (a.progressPercent || 0));
    } else if (sortBy === 'name') {
      list = [...list].sort((a, b) => String(a.title).localeCompare(String(b.title)));
    }
    return list;
  }, [projects, filterType, q, sortBy]);

  const activeIndex = Math.max(0, FILTERS.findIndex((f) => f.id === filterType));
  const isFiltered = filterType !== 'all' || q !== '';

  const clearFilters = () => {
    setQuery('');
    setFilterType('all');
    setSortBy('default');
  };

  return (
    <div className="dp-root relative isolate flex flex-col w-full max-w-7xl mx-auto pb-32">
      <style>{STYLES}</style>

      <p className="sr-only" aria-live="polite">
        Showing {visible.length} of {projects.length} projects
      </p>

      {/* Welcome header and quick actions */}
      <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md py-space-lg">
        <div className="flex flex-col gap-2">
          <div className="flex items-center flex-wrap gap-3">
            <h1 className="text-3xl font-semibold text-on-surface">
              {getGreeting()}, {userName}
            </h1>
            <div
              title="Sprint 14 is 84% on schedule"
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high/80 backdrop-blur-md shadow-sm border border-outline-variant/20"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
              <span className="text-sm text-secondary font-medium">
                Sprint 14 · 84% on schedule
              </span>
            </div>
          </div>

          <p className="text-sm text-on-surface-variant flex items-center flex-wrap gap-2">
            <span className="material-symbols-outlined text-sm text-secondary">calendar_today</span>
            <span>{formatToday()}</span>
            <span className="opacity-40">·</span>
            <span>Sprint day {CYCLE_DAY} of {CYCLE_LENGTH}</span>
          </p>

          {/* Cycle progress, one tick per day */}
          <div
            className="flex items-center gap-1 mt-1.5"
            role="img"
            aria-label={`Day ${CYCLE_DAY} of ${CYCLE_LENGTH} in this sprint cycle`}
          >
            {Array.from({ length: CYCLE_LENGTH }).map((_, i) => (
              <span
                key={i}
                style={{ '--d': `${300 + i * 40}ms` }}
                className={`dp-rise w-1.5 h-3.5 rounded-full ${
                  i < CYCLE_DAY ? 'bg-secondary' : 'bg-surface-container-highest'
                } ${i === CYCLE_DAY - 1 ? 'animate-pulse' : ''}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-space-sm">
          <button
            onClick={onOpenQuickTask}
            title="Create a task without opening a project"
            className={`group flex items-center gap-space-xs px-space-md py-space-sm rounded-xl bg-surface-container/70 backdrop-blur-lg hover:bg-surface-container-high text-on-surface transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 border border-outline-variant/30 cursor-pointer ${FOCUS_RING}`}
            type="button"
          >
            <span className="material-symbols-outlined text-headline-sm text-secondary group-hover:rotate-90 transition-transform duration-300">
              add_task
            </span>
            <span className="text-body-md font-medium">Quick Task</span>
          </button>

          <button
            onClick={onOpenGenerateSprint}
            title="Let AI draft a plan for your next sprint"
            className={`group relative overflow-hidden flex items-center gap-space-xs px-space-md py-space-sm rounded-xl bg-gradient-to-r from-primary-container via-secondary-container to-primary-container text-on-primary-container text-body-md font-semibold transition-all duration-300 shadow-lg shadow-primary-container/20 hover:shadow-xl hover:shadow-primary-container/40 hover:-translate-y-0.5 active:scale-95 cursor-pointer ${FOCUS_RING}`}
            type="button"
          >
            <span className="relative material-symbols-outlined text-headline-sm transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">
              auto_awesome
            </span>
            <span className="relative">Generate sprint plan</span>
          </button>
        </div>
      </section>

      {/* High-level metrics */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-gutter mb-space-xl">
        {METRICS.map((m, i) => (
          <MetricCard key={m.id} metric={m} index={i} />
        ))}
      </section>

      {/* Insights: charts that explain the numbers above */}
      <section aria-label="Sprint insights" className="mb-space-xl">
        <div className="flex items-baseline gap-3 mb-space-md">
          <h2 className="text-2xl font-semibold text-on-surface">Sprint insights</h2>
          <span className="text-sm text-on-surface-variant">How Sprint 14 is going</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          <BurndownChart />
          <StatusDonut projects={projects} />
          <WorkloadChart />
        </div>
      </section>

      {/* Workstreams toolbar */}
      <div className="flex flex-col gap-space-md mb-space-lg">
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-2xl font-semibold text-on-surface">Projects</h2>
          </div>
          <span className="mt-auto mb-0.5 px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-mono text-xs font-semibold">
            {isFiltered ? `${visible.length} of ${projects.length} shown` : `${projects.length} active`}
          </span>
        </div>

        <div className="flex flex-col xl:flex-row xl:items-center gap-space-sm">
          {/* Search */}
          <div className="relative flex items-center flex-1 xl:max-w-sm">
            <span className="material-symbols-outlined absolute left-3 text-outline text-body-lg pointer-events-none">
              search
            </span>
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setQuery('');
                  e.currentTarget.blur();
                }
              }}
              placeholder="Search by name, code or person"
              aria-label="Search projects"
              className="w-full pl-10 pr-14 py-2.5 rounded-xl bg-surface-container/70 backdrop-blur-lg border border-outline-variant/30 text-on-surface text-body-md placeholder:text-outline transition-all focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30 focus:bg-surface-container-high"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  searchRef.current && searchRef.current.focus();
                }}
                aria-label="Clear search"
                className={`absolute right-2 p-1 rounded-md text-outline hover:text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer ${FOCUS_RING}`}
              >
                <span className="material-symbols-outlined text-body-lg">close</span>
              </button>
            ) : (
              <kbd
                title="Press / to search"
                className="hidden sm:inline-flex absolute right-3 px-1.5 py-0.5 rounded border border-outline-variant/40 font-mono text-label-sm text-outline pointer-events-none"
              >
                /
              </kbd>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-space-sm xl:ml-auto">
            {/* Status tabs with a sliding highlight */}
            <div
              role="group"
              aria-label="Filter by status"
              className="relative grid grid-cols-3 p-1 rounded-xl bg-surface-container/70 backdrop-blur-lg border border-outline-variant/30"
            >
              <span
                aria-hidden="true"
                className="absolute top-1 bottom-1 left-1 rounded-lg bg-surface-container-highest shadow transition-transform duration-300 ease-out motion-reduce:transition-none"
                style={{
                  width: 'calc((100% - 0.5rem) / 3)',
                  transform: `translateX(${activeIndex * 100}%)`,
                }}
              />
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterType(f.id)}
                  aria-pressed={filterType === f.id}
                  className={`relative z-10 flex items-center justify-center gap-1.5 px-space-sm py-1.5 rounded-lg text-body-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${FOCUS_RING} ${
                    filterType === f.id ? 'text-on-surface' : 'text-outline hover:text-on-surface'
                  }`}
                >
                  {f.label}
                  <span
                    className={`px-1.5 rounded-full font-mono text-label-sm ${
                      filterType === f.id ? 'bg-secondary/20 text-secondary' : 'bg-surface-container-high text-outline'
                    }`}
                  >
                    {counts[f.id]}
                  </span>
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-body-lg pointer-events-none">
                sort
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort projects"
                className="appearance-none pl-9 pr-8 py-2.5 rounded-xl bg-surface-container/70 backdrop-blur-lg border border-outline-variant/30 text-on-surface text-body-sm cursor-pointer hover:bg-surface-container-high transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id} className="bg-surface text-on-surface">
                    {s.label}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-outline text-body-lg pointer-events-none">
                expand_more
              </span>
            </div>

            {/* View toggle */}
            <div
              role="group"
              aria-label="Layout"
              className="flex items-center gap-1 p-1 rounded-xl bg-surface-container/70 backdrop-blur-lg border border-outline-variant/30"
            >
              {[
                { id: 'grid', icon: 'grid_view', label: 'Card view' },
                { id: 'compact', icon: 'view_list', label: 'List view' },
              ].map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setViewMode(v.id)}
                  aria-pressed={viewMode === v.id}
                  aria-label={v.label}
                  title={v.label}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${FOCUS_RING} ${
                    viewMode === v.id
                      ? 'bg-surface-container-highest text-on-surface shadow'
                      : 'text-outline hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-body-lg">{v.icon}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Projects */}
      {visible.length === 0 ? (
        <EmptyState hasProjects={projects.length > 0} onClear={clearFilters} onNew={onOpenNewProject} />
      ) : viewMode === 'grid' ? (
        <section
          key={`grid-${filterType}-${sortBy}`}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter"
        >
          {visible.map((project, i) => (
            <ProjectCard key={project.id} project={project} index={i} onSelect={onSelectProject} />
          ))}

          {/* Create new project */}
          <div
            {...asButton(() => onOpenNewProject && onOpenNewProject())}
            aria-label="Create a new project"
            style={{ '--d': `${300 + Math.min(visible.length, 8) * 70}ms` }}
            className={`dp-rise group relative rounded-2xl bg-surface-container/30 backdrop-blur-xl p-space-lg shadow-lg hover:bg-surface-container/60 transition-all duration-300 flex flex-col justify-center items-center text-center cursor-pointer min-h-[260px] border border-dashed border-outline-variant/40 hover:border-primary/50 hover:-translate-y-0.5 ${FOCUS_RING}`}
          >
            <div className="w-12 h-12 rounded-xl bg-surface-container-high group-hover:bg-primary-container/20 flex items-center justify-center text-primary group-hover:scale-110 group-hover:rotate-90 transition-all duration-300 mb-space-sm shadow-inner">
              <span className="material-symbols-outlined text-headline-md">add</span>
            </div>
            <h4 className="text-headline-sm text-on-surface font-semibold mb-1">New project</h4>
            <p className="text-body-sm text-outline max-w-xs mb-space-sm leading-relaxed">
              Start from a template or let AI set it up.
            </p>
            <span className="px-space-sm py-1 rounded-full bg-surface-container-highest text-primary font-mono text-label-sm font-medium group-hover:bg-primary group-hover:text-on-primary transition-colors">
              Get started
            </span>
          </div>
        </section>
      ) : (
        <section key={`list-${filterType}-${sortBy}`} className="flex flex-col gap-space-sm">
          {visible.map((project, i) => (
            <ProjectRow key={project.id} project={project} index={i} onSelect={onSelectProject} />
          ))}

          <div
            {...asButton(() => onOpenNewProject && onOpenNewProject())}
            aria-label="Create a new project"
            className={`group flex items-center justify-center gap-space-sm rounded-xl border border-dashed border-outline-variant/40 hover:border-primary/50 bg-surface-container/30 hover:bg-surface-container/60 py-space-md text-outline hover:text-primary transition-all duration-300 cursor-pointer ${FOCUS_RING}`}
          >
            <span className="material-symbols-outlined group-hover:rotate-90 transition-transform duration-300">add</span>
            <span className="text-body-md font-medium">New project</span>
          </div>
        </section>
      )}
    </div>
  );
};

export default DashboardPage;