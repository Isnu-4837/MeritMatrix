import React, { useEffect, useMemo, useRef, useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const CYCLE_DAY = 9;
const CYCLE_LENGTH = 14;

const FILTERS = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'in_progress', label: 'In Progress', match: (p) => p.status === 'In Progress' },
  {
    id: 'review',
    label: 'In Review',
    match: (p) => p.status === 'QA Review' || p.status === 'Review Required',
  },
];

const SORTS = [
  { id: 'default', label: 'Default order' },
  { id: 'progress', label: 'Most progress' },
  { id: 'name', label: 'Name (A–Z)' },
];

const METRICS = [
  {
    id: 'projects',
    label: 'Active Projects',
    icon: 'folder_open',
    iconBg: 'bg-primary/10',
    iconTone: 'text-primary',
    value: 12,
    decimals: 0,
    badge: { kind: 'up', text: '+18%' },
    sub: '4 approaching deadline',
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
    iconBg: 'bg-secondary/10',
    iconTone: 'text-secondary',
    value: 94.2,
    decimals: 1,
    unit: 'pts',
    badge: { kind: 'up', text: '+6.4 pts' },
    sub: '98% team capacity used',
    right: 'T‑4 days left',
    progress: 94,
    bar: 'bg-secondary',
    spark: [71, 76, 80, 84, 88, 94.2],
    sparkTone: 'text-secondary',
  },
  {
    id: 'ai',
    label: 'AI Time Saved',
    icon: 'auto_awesome',
    iconBg: 'bg-tertiary/10',
    iconTone: 'text-tertiary',
    value: 34,
    decimals: 0,
    unit: 'hrs',
    badge: { kind: 'pill', text: 'Saved' },
    sub: '1,280 neural actions run',
    right: 'Neural v3.4',
    progress: 86,
    bar: 'bg-gradient-to-r from-tertiary to-primary',
    spark: [8, 14, 19, 24, 29, 34],
    sparkTone: 'text-tertiary',
  },
];

const BURNDOWN = {
  total: 120,
  days: CYCLE_LENGTH,
  today: CYCLE_DAY,
  actual: [120, 114, 106, 98, 90, 81, 72, 63, 53, 42],
};

const WEEKLY_CAPACITY = 40;
const TEAM_LOAD = [
  { name: 'Alex Rivera', hours: 40 },
  { name: 'Elena Vance', hours: 32 },
  { name: 'Marcus Chen', hours: 56 },
  { name: 'Sophia Patel', hours: 25 },
  { name: 'David Kim', hours: 36 },
];

const STATUS_GROUPS = [
  { id: 'progress', label: 'In Progress',  text: 'text-secondary', bg: 'bg-secondary', match: (s) => s === 'In Progress' },
  { id: 'review',   label: 'In Review',    text: 'text-tertiary',  bg: 'bg-tertiary',  match: (s) => s === 'QA Review' || s === 'Review Required' },
  { id: 'planning', label: 'Planning',     text: 'text-primary',   bg: 'bg-primary',   match: (s) => s === 'Planning' },
  { id: 'other',    label: 'Other',        text: 'text-outline',   bg: 'bg-outline',   match: () => true },
];

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');

.dp-root {
  font-family: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
}
.dp-root h1, .dp-root h2, .dp-root h3, .dp-root h4 { letter-spacing: -0.015em; }

@keyframes dp-rise   { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
@keyframes dp-sheen  { from { transform:translateX(-120%) skewX(-20deg); } to { transform:translateX(340%) skewX(-20deg); } }
@keyframes dp-draw   { to { stroke-dashoffset: 0; } }
@keyframes dp-fade   { from { opacity: 0; } to { opacity: 1; } }
@keyframes dp-pulse-dot { 0%,100%{ transform:scale(1); opacity:.8; } 50%{ transform:scale(1.6); opacity:.4; } }

.dp-rise  { animation: dp-rise .55s cubic-bezier(.2,.7,.2,1) backwards; animation-delay: var(--d, 0ms); }
.group:hover .dp-sheen { animation: dp-sheen .9s ease; }
.dp-sheen { transform: translateX(-120%) skewX(-20deg); }
.dp-fade  { animation: dp-fade .5s 1.4s ease-out backwards; }
.dp-draw  { stroke-dasharray:100; stroke-dashoffset:100; animation: dp-draw 1.4s .6s ease-out forwards; }
.dp-avatars { display:flex; }
.dp-avatars > * + * { margin-left:-8px; transition:margin-left .25s ease; }
.group:hover .dp-avatars > * + * { margin-left:-2px; }

/* glass card */
.dp-card {
  background: rgba(var(--surface-container-rgb, 30 30 46), 0.6);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 1.25rem;
  box-shadow: 0 4px 24px rgba(0,0,0,.18), 0 1px 2px rgba(0,0,0,.12);
  transition: box-shadow .25s, transform .25s, background .25s, border-color .25s;
}
.dp-card:hover {
  box-shadow: 0 8px 36px rgba(0,0,0,.26), 0 2px 4px rgba(0,0,0,.14);
  border-color: rgba(255,255,255,.12);
}

/* section divider pill */
.dp-section-pill {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  padding: .2rem .75rem;
  border-radius: 999px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.08);
  font-size: .7rem;
  font-weight: 600;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--color-on-surface-variant, #aaa);
}

/* animated gradient border on card hover */
.dp-card-border {
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(var(--glow-a),.5) 0%, rgba(var(--glow-b),.5) 50%, rgba(var(--glow-a),.5) 100%);
  background-size: 200% 200%;
  opacity: 0;
  pointer-events: none;
  transition: opacity .3s ease;
  z-index: 0;
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  padding: 1px;
}
.group:hover .dp-card-border { opacity: 1; animation: dp-border 2.5s linear infinite; }

@media (prefers-reduced-motion: reduce) {
  .dp-rise, .dp-draw, .dp-fade { animation: none !important; }
  .dp-draw { stroke-dashoffset: 0; }
  .group:hover .dp-sheen { animation: none; }
}
`;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

const formatToday = () =>
  new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

const asButton = (onActivate) => ({
  role: 'button',
  tabIndex: 0,
  onClick: onActivate,
  onKeyDown: (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onActivate(e);
    }
  },
});

/* ------------------------------------------------------------------ */
/*  Animated primitives                                                */
/* ------------------------------------------------------------------ */

const CountUp = ({ to, decimals = 0, duration = 1200, delay = 0 }) => {
  const [val, setVal] = useState(() => (prefersReducedMotion() ? to : 0));
  useEffect(() => {
    if (prefersReducedMotion()) { setVal(to); return; }
    let raf, start;
    const timer = setTimeout(() => {
      const tick = (now) => {
        if (start === undefined) start = now;
        const p = Math.min((now - start) / duration, 1);
        setVal(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [to, duration, delay]);
  return (
    <span className="tabular-nums">
      {val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
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
      <polygon points={`0,32 ${points} 100,32`} fill="currentColor" fillOpacity="0.15" className="dp-fade" />
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
      <circle cx={lx} cy={ly} r="3" fill="currentColor" className="dp-fade" />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Section label                                                      */
/* ------------------------------------------------------------------ */

const SectionLabel = ({ icon, children }) => (
  <span className="dp-section-pill">
    {icon && <span className="material-symbols-outlined" style={{ fontSize: '0.8rem' }}>{icon}</span>}
    {children}
  </span>
);

/* ------------------------------------------------------------------ */
/*  Metric Cards                                                       */
/* ------------------------------------------------------------------ */

const MetricCard = ({ metric, index }) => {
  const delay = 100 + index * 80;
  return (
    <div
      style={{ '--d': `${delay}ms` }}
      className="dp-rise dp-card group relative overflow-hidden p-6 flex flex-col gap-4 cursor-default hover:-translate-y-0.5"
    >
      {/* Sheen */}
      <div className="dp-sheen absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />

      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className={`w-10 h-10 rounded-xl ${metric.iconBg} flex items-center justify-center ${metric.iconTone} flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
          <span className="material-symbols-outlined text-xl">{metric.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-0.5">
            {metric.label}
          </p>
          {metric.badge.kind === 'up' && (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">
              <span className="material-symbols-outlined text-xs leading-none">trending_up</span>
              {metric.badge.text}
            </span>
          )}
          {metric.badge.kind === 'pill' && (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-tertiary bg-tertiary/10 px-2 py-0.5 rounded-full">
              {metric.badge.text}
            </span>
          )}
        </div>
        <Sparkline data={metric.spark} className={`w-16 h-7 shrink-0 ${metric.sparkTone} opacity-80`} />
      </div>

      {/* Value */}
      <div className="flex items-end gap-2">
        <span
          className="font-bold text-on-surface tabular-nums leading-none"
          style={{ fontSize: 'clamp(2rem, 5vw, 2.75rem)', letterSpacing: '-0.04em' }}
        >
          <CountUp to={metric.value} decimals={metric.decimals} delay={delay} />
        </span>
        {metric.unit && (
          <span className="text-sm text-outline font-medium mb-1">{metric.unit}</span>
        )}
      </div>

      {/* Sub-info */}
      <div className="flex items-center justify-between text-xs text-on-surface-variant gap-2">
        <span className="truncate">{metric.sub}</span>
        <span className="shrink-0 text-outline">{metric.right}</span>
      </div>

      {/* Progress bar */}
      <div>
        <div
          role="progressbar"
          aria-label={metric.label}
          aria-valuenow={metric.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden"
        >
          <AnimatedBar value={metric.progress} delay={delay + 200} className={`${metric.bar} relative`} />
          {/* shimmer sweep on the bar */}
          <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.25), transparent)', animation: 'dp-sheen 1.8s ease-out 1' }} aria-hidden="true" />
        </div>
        <p className="mt-1 text-right text-xs text-outline">{metric.progress}%</p>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Insight card wrapper                                               */
/* ------------------------------------------------------------------ */

const InsightCard = ({ title, subtitle, badge, index = 0, className = '', children }) => (
  <div
    style={{ '--d': `${200 + index * 80}ms` }}
    className={`dp-rise dp-card relative p-6 flex flex-col gap-4 ${className}`}
  >
    {/* subtle top gradient line */}
    <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-outline-variant/50 to-transparent" aria-hidden="true" />

    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold text-on-surface leading-tight">{title}</h3>
        {subtitle && <p className="text-xs text-on-surface-variant mt-0.5">{subtitle}</p>}
      </div>
      {badge}
    </div>
    {children}
  </div>
);

const Chip = ({ tone = 'secondary', children }) => (
  <span
    className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
      tone === 'error' ? 'bg-error/15 text-error' : 'bg-secondary/15 text-secondary'
    }`}
  >
    {children}
  </span>
);

/* ------------------------------------------------------------------ */
/*  Burndown chart                                                     */
/* ------------------------------------------------------------------ */

const BurndownChart = () => {
  const { total, days, today, actual } = BURNDOWN;
  const W = 560; const H = 210;
  const L = 36; const R = 12; const T = 18; const B = 28;
  const pw = W - L - R;
  const ph = H - T - B;
  const x = (d) => L + (d / days) * pw;
  const y = (v) => T + (1 - v / total) * ph;
  const ideal = (d) => total - (total * d) / days;
  const last = actual[actual.length - 1];
  const line = actual.map((v, d) => `${x(d)},${y(v)}`).join(' ');
  const area = `${x(0)},${y(0)} ${line} ${x(actual.length - 1)},${y(0)}`;
  const ahead = ideal(today) - last;
  const onTrack = ahead >= 0;

  const [hover, setHover] = useState(null);
  const ref = useRef(null);
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(days, Math.round(((vx - L) / pw) * days))));
  };

  return (
    <InsightCard
      title="Sprint Burndown"
      subtitle="Story points remaining"
      index={0}
      className="lg:col-span-7"
      badge={
        <Chip tone={onTrack ? 'secondary' : 'error'}>
          <span className="material-symbols-outlined text-xs">{onTrack ? 'check' : 'warning'}</span>
          {Math.abs(ahead).toFixed(1)} pts {onTrack ? 'ahead' : 'behind'}
        </Chip>
      }
    >
      <div className="relative">
        <svg
          ref={ref}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Burndown: ${last} of ${total} points left on day ${today}`}
          className="w-full h-auto"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="dp-burn-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.28" className="text-secondary" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0"   className="text-secondary" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const v = Math.round(total * f);
            return (
              <g key={f} className="text-outline">
                <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity="0.15" strokeDasharray="4 5" />
                <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="currentColor" fillOpacity="0.6">{v}</text>
              </g>
            );
          })}

          {/* X axis labels */}
          {Array.from({ length: days / 2 + 1 }, (_, i) => i * 2).map((d) => (
            <text key={d} x={x(d)} y={H - 8} textAnchor="middle" fontSize="10" className="text-outline" fill="currentColor" fillOpacity="0.6">
              {d === 0 ? 'D0' : `D${d}`}
            </text>
          ))}

          {/* Ideal */}
          <line x1={x(0)} y1={y(total)} x2={x(days)} y2={y(0)} className="text-outline" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" />

          {/* Projected pace */}
          <line x1={x(today)} y1={y(last)} x2={x(days)} y2={y(0)} className="text-primary" stroke="currentColor" strokeWidth="2" strokeDasharray="6 5" strokeLinecap="round" />

          {/* Actual area + line */}
          <g className="text-secondary">
            <polygon points={area} fill="url(#dp-burn-fill)" className="dp-fade" />
            <polyline points={line} pathLength="100" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="dp-draw" />
            <circle cx={x(today)} cy={y(last)} r="10" fill="currentColor" opacity="0.15" className="animate-pulse motion-reduce:animate-none" />
            <circle cx={x(today)} cy={y(last)} r="4.5" fill="currentColor" className="dp-fade" />
          </g>

          {/* Today line */}
          <line x1={x(today)} x2={x(today)} y1={T} y2={H - B} className="text-secondary" stroke="currentColor" strokeOpacity="0.35" strokeDasharray="3 4" />
          <text x={x(today)} y={T - 4} textAnchor="middle" fontSize="10" fontWeight="700" className="text-secondary" fill="currentColor">Today</text>

          {/* Hover crosshair */}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="text-on-surface" stroke="currentColor" strokeOpacity="0.2" />
              <circle cx={x(hover)} cy={y(ideal(hover))} r="4" className="text-outline" fill="currentColor" />
              {hover < actual.length && <circle cx={x(hover)} cy={y(actual[hover])} r="5" className="text-secondary" fill="currentColor" />}
            </g>
          )}
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 dp-card px-3 py-2 text-xs shadow-xl"
            style={{ left: `${Math.min(86, Math.max(14, (x(hover) / W) * 100))}%` }}
          >
            <p className="font-semibold text-on-surface mb-0.5">{hover === 0 ? 'Sprint start' : `Day ${hover}`}</p>
            <p className="text-on-surface-variant">Ideal: <span className="text-outline">{Math.round(ideal(hover))} pts</span></p>
            {hover < actual.length && <p className="text-secondary font-medium">Actual: {actual[hover]} pts</p>}
          </div>
        )}
      </div>

      {/* Legend */}
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
        <li className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded bg-secondary" />Actual</li>
        <li className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded bg-outline opacity-50" />Ideal</li>
        <li className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-primary" />Projected</li>
        <li className="ml-auto font-medium text-on-surface">{last} / {total} pts left</li>
      </ul>
    </InsightCard>
  );
};

/* ------------------------------------------------------------------ */
/*  Status donut                                                       */
/* ------------------------------------------------------------------ */

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
    <InsightCard title="Status Breakdown" subtitle="Projects by current state" index={1} className="lg:col-span-5">
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-on-surface-variant">No projects yet.</p>
      ) : (
        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-6">
          {/* Donut */}
          <div className="relative w-32 h-32 shrink-0" role="img" aria-label={`${total} projects`}>
            <svg viewBox="0 0 42 42" className="w-full h-full -rotate-90">
              <circle cx="21" cy="21" r="15.9155" fill="none" strokeWidth="5" stroke="currentColor" className="text-surface-container-highest" />
              {segments.map((g, i) => {
                const len = Math.max(g.pct - (segments.length > 1 ? 1.2 : 0), 0.1);
                return (
                  <circle
                    key={g.id}
                    cx="21" cy="21" r="15.9155"
                    fill="none" strokeWidth="5" stroke="currentColor"
                    className={g.text}
                    strokeDasharray={ready ? `${len} ${100 - len}` : '0 100'}
                    strokeDashoffset={-g.offset}
                    style={{ opacity: active === null || active === g.id ? 1 : 0.2, transition: `stroke-dasharray .9s ease-out ${i * 120}ms, opacity .2s` }}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-on-surface" style={{ letterSpacing: '-0.03em' }}>{current ? current.count : total}</span>
              <span className="text-xs text-on-surface-variant leading-tight">{current ? current.label : 'projects'}</span>
            </div>
          </div>

          {/* Legend */}
          <ul className="flex flex-col gap-1.5 flex-1 w-full">
            {segments.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(g.id)} onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(g.id)} onBlur={() => setActive(null)}
                  className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm text-left transition-colors cursor-default hover:bg-surface-container-high ${FOCUS_RING}`}
                >
                  <span className="flex items-center gap-2 text-on-surface-variant">
                    <span className={`w-2.5 h-2.5 rounded-full ${g.bg} shrink-0`} aria-hidden="true" />
                    {g.label}
                  </span>
                  <span className="text-on-surface font-semibold tabular-nums">
                    {g.count}
                    <span className="text-outline font-normal text-xs ml-1">· {Math.round(g.pct)}%</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </InsightCard>
  );
};

/* ------------------------------------------------------------------ */
/*  Workload chart                                                     */
/* ------------------------------------------------------------------ */

const WorkloadChart = () => {
  const SCALE = 60;
  const sorted = [...TEAM_LOAD].sort((a, b) => b.hours - a.hours);
  const over = TEAM_LOAD.filter((m) => m.hours > WEEKLY_CAPACITY);
  const busiest = sorted[0];
  const freest = sorted[sorted.length - 1];

  return (
    <InsightCard
      title="Team Workload"
      subtitle={`Capacity: ${WEEKLY_CAPACITY}h / week`}
      index={2}
      className="lg:col-span-6"
      badge={
        over.length
          ? <Chip tone="error"><span className="material-symbols-outlined text-xs">warning</span>{over.length} over capacity</Chip>
          : <Chip><span className="material-symbols-outlined text-xs">check_circle</span>Balanced</Chip>
      }
    >
      <ul className="flex flex-col gap-3.5">
        {TEAM_LOAD.map((m, i) => {
          const isOver = m.hours > WEEKLY_CAPACITY;
          const tone = isOver ? 'bg-error' : m.hours === WEEKLY_CAPACITY ? 'bg-primary' : 'bg-secondary';
          const initials = m.name.split(' ').map((n) => n[0]).join('');
          return (
            <li key={m.name} className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-7 h-7 rounded-full bg-surface-container-highest flex items-center justify-center font-mono text-xs font-bold text-on-surface-variant shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-medium text-on-surface truncate">{m.name}</span>
                  <span className={`tabular-nums text-xs font-bold shrink-0 ${isOver ? 'text-error' : 'text-on-surface-variant'}`}>
                    {m.hours}h
                  </span>
                </div>
                <div
                  className="relative h-2 rounded-full bg-surface-container-highest overflow-hidden"
                  role="progressbar"
                  aria-label={`${m.name}: ${m.hours}h of ${WEEKLY_CAPACITY}h capacity`}
                  aria-valuenow={m.hours} aria-valuemin={0} aria-valuemax={SCALE}
                >
                  <AnimatedBar value={(m.hours / SCALE) * 100} delay={500 + i * 80} className={tone} />
                  <span
                    className="absolute inset-y-0 w-px bg-on-surface/40"
                    style={{ left: `${(WEEKLY_CAPACITY / SCALE) * 100}%` }}
                    aria-hidden="true"
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {busiest.hours > WEEKLY_CAPACITY && (
        <div className="flex items-start gap-2 rounded-xl bg-error/8 border border-error/15 px-3 py-2.5 text-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-sm text-error mt-px shrink-0">lightbulb</span>
          <span>
            <span className="font-semibold text-error">{busiest.name}</span> is {busiest.hours - WEEKLY_CAPACITY}h over capacity.{' '}
            <span className="font-semibold text-secondary">{freest.name}</span> has {WEEKLY_CAPACITY - freest.hours}h available.
          </span>
        </div>
      )}
    </InsightCard>
  );
};

/* ------------------------------------------------------------------ */
/*  Quick stats bar (new)                                              */
/* ------------------------------------------------------------------ */

const QuickStatBar = ({ projects }) => {
  const urgent = projects.filter((p) => p.isUrgent).length;
  const done   = projects.filter((p) => p.progressPercent >= 100).length;
  const avg    = projects.length
    ? Math.round(projects.reduce((s, p) => s + (p.progressPercent || 0), 0) / projects.length)
    : 0;

  const stats = [
    { icon: 'rocket_launch', label: 'Total',    value: projects.length, tone: 'text-on-surface-variant' },
    { icon: 'timer',         label: 'Urgent',   value: urgent,          tone: urgent > 0 ? 'text-error' : 'text-on-surface-variant' },
    { icon: 'check_circle',  label: 'Complete', value: done,            tone: done > 0 ? 'text-secondary' : 'text-on-surface-variant' },
    { icon: 'bar_chart',     label: 'Avg prog', value: `${avg}%`,       tone: 'text-on-surface-variant' },
  ];

  return (
    <div className="dp-card grid grid-cols-2 sm:grid-cols-4 divide-x divide-outline-variant/20 overflow-hidden mb-6">
      {stats.map((s, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5">
          <span className={`material-symbols-outlined text-lg ${s.tone}`}>{s.icon}</span>
          <div>
            <p className="text-xs text-on-surface-variant leading-tight">{s.label}</p>
            <p className={`text-lg font-bold leading-tight ${s.tone}`}>{s.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Project card & row                                                 */
/* ------------------------------------------------------------------ */

const StatusBadge = ({ project }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-mono text-xs font-semibold ${project.statusColor}`}>
    {project.status}
  </span>
);

const DueDate = ({ project }) => (
  <span className={`font-mono text-xs font-medium flex items-center gap-1 ${project.isUrgent ? 'text-error' : 'text-outline'}`}>
    {project.isUrgent && <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />}
    <span className="material-symbols-outlined text-xs">{project.isUrgent ? 'timer' : 'calendar_month'}</span>
    {project.isUrgent ? `Due soon · ${project.dueDate}` : project.dueDate}
  </span>
);

const Avatars = ({ assignees }) => (
  <div className="dp-avatars">
    {assignees.map((assignee, idx) => (
      <div
        key={idx}
        className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-mono text-xs font-bold ring-2 ring-surface ${assignee.color}`}
        title={assignee.name}
      >
        {assignee.initials}
      </div>
    ))}
  </div>
);

const ProjectCard = ({ project, index, onSelect }) => {
  const assignees = project.assignees || [];
  const delay = 300 + Math.min(index, 8) * 60;
  return (
    <div
      {...asButton(() => onSelect && onSelect(project))}
      aria-label={`Open ${project.title}`}
      style={{ '--d': `${delay}ms` }}
      className={`dp-rise dp-card group relative flex flex-col overflow-hidden cursor-pointer hover:-translate-y-0.5 hover:border-primary/30 ${FOCUS_RING}`}
    >
      {/* Top accent bar */}
      <div className={`h-1 w-full bg-gradient-to-r ${project.accentGradient} opacity-80 group-hover:opacity-100 transition-opacity`} />

      <div className="flex flex-col flex-1 p-5 gap-4">
        {/* Row 1: status + due */}
        <div className="flex items-center justify-between gap-2">
          <StatusBadge project={project} />
          <DueDate project={project} />
        </div>

        {/* Title + description */}
        <div className="flex-1">
          <h3 className="text-base font-semibold text-on-surface mb-1 group-hover:text-primary transition-colors line-clamp-1">
            {project.title}
          </h3>
          <p className="text-sm text-on-surface-variant line-clamp-2 leading-relaxed">
            {project.description}
          </p>
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between font-mono text-xs mb-1.5">
            <span className="text-on-surface-variant">Progress</span>
            <span className="text-on-surface font-semibold flex items-center gap-1">
              {project.progressPercent >= 100 && (
                <span className="material-symbols-outlined text-xs text-secondary">check_circle</span>
              )}
              {project.completedTasks}/{project.totalTasks} tasks · {project.progressPercent}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={`${project.title} progress`}
            aria-valuenow={project.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="relative w-full bg-surface-container-highest h-2 rounded-full overflow-hidden"
          >
            <AnimatedBar
              value={project.progressPercent}
              delay={delay + 150}
              className={`bg-gradient-to-r ${project.accentGradient} relative`}
            />
            {/* shimmer on bar */}
            <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'linear-gradient(90deg, transparent 20%, rgba(255,255,255,.3) 50%, transparent 80%)', backgroundSize: '200% 100%', animation: 'dp-pan 1.5s ease-out 1' }}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-surface-container-highest/50">
          <Avatars assignees={assignees} />
          <span className="flex items-center gap-1 text-outline font-mono text-xs">
            {project.code}
            <span className="material-symbols-outlined text-base text-primary opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
              arrow_forward
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

const ProjectRow = ({ project, index, onSelect }) => {
  const assignees = project.assignees || [];
  const delay = 250 + Math.min(index, 10) * 45;
  return (
    <div
      {...asButton(() => onSelect && onSelect(project))}
      aria-label={`Open ${project.title}`}
      style={{ '--d': `${delay}ms` }}
      className={`dp-rise dp-card group relative overflow-hidden flex flex-col md:flex-row md:items-center gap-3 md:gap-4 pl-5 pr-4 py-3.5 hover:border-primary/30 cursor-pointer hover:-translate-y-px ${FOCUS_RING}`}
    >
      {/* Left accent bar */}
      <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${project.accentGradient}`} />

      <div className="relative min-w-0 md:flex-1">
        <h3 className="text-sm font-semibold text-on-surface truncate group-hover:text-primary transition-colors">{project.title}</h3>
        <span className="text-outline font-mono text-xs">{project.code}</span>
      </div>

      <div className="relative md:w-32">
        <StatusBadge project={project} />
      </div>

      <div className="relative md:w-44">
        <div className="flex items-center justify-between font-mono text-xs mb-1">
          <span className="text-outline">{project.completedTasks}/{project.totalTasks} tasks</span>
          <span className="text-on-surface font-semibold">{project.progressPercent}%</span>
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

      <div className="relative md:w-28 md:flex md:justify-end">
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
  <div className="dp-rise flex flex-col items-center text-center rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container/20 backdrop-blur-xl px-8 py-16">
    <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center text-primary mb-4 shadow-lg">
      <span className="material-symbols-outlined text-3xl">{hasProjects ? 'search_off' : 'rocket_launch'}</span>
    </div>
    <h3 className="text-lg font-semibold text-on-surface mb-2">
      {hasProjects ? 'No projects match' : 'No projects yet'}
    </h3>
    <p className="text-sm text-outline max-w-sm mb-6 leading-relaxed">
      {hasProjects
        ? 'Try a different word or clear the filters to see all projects.'
        : 'Create your first project to start planning a sprint.'}
    </p>
    <div className="flex flex-wrap justify-center gap-3">
      {hasProjects && (
        <button
          type="button"
          onClick={onClear}
          className={`px-4 py-2 rounded-xl bg-surface-container-high text-on-surface text-sm font-medium hover:bg-surface-container-highest transition-colors cursor-pointer ${FOCUS_RING}`}
        >
          Clear filters
        </button>
      )}
      <button
        type="button"
        onClick={onNew}
        className={`px-4 py-2 rounded-xl bg-gradient-to-r from-primary-container to-secondary-container text-on-primary-container text-sm font-semibold active:scale-95 transition-transform cursor-pointer ${FOCUS_RING}`}
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
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('default');
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);

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
    if (sortBy === 'progress') list = [...list].sort((a, b) => (b.progressPercent || 0) - (a.progressPercent || 0));
    else if (sortBy === 'name') list = [...list].sort((a, b) => String(a.title).localeCompare(String(b.title)));
    return list;
  }, [projects, filterType, q, sortBy]);

  const activeIndex = Math.max(0, FILTERS.findIndex((f) => f.id === filterType));
  const isFiltered = filterType !== 'all' || q !== '';

  const clearFilters = () => { setQuery(''); setFilterType('all'); setSortBy('default'); };

  return (
    <div className="dp-root relative isolate flex flex-col w-full max-w-7xl mx-auto pb-32 px-1">
      <style>{STYLES}</style>

      <p className="sr-only" aria-live="polite">
        Showing {visible.length} of {projects.length} projects
      </p>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <section className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 py-8">
        {/* Left: greeting */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center flex-wrap gap-3">
            <h1 className="text-3xl font-bold text-on-surface">
              {getGreeting()}, <span className="text-primary">{userName}</span> 👋
            </h1>
            <div
              title="Sprint 14 is 84% on schedule"
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20"
            >
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              <span className="text-xs text-secondary font-semibold">Sprint 14 · 84% on schedule</span>
            </div>
          </div>

          <p className="text-sm text-on-surface-variant flex items-center gap-2 flex-wrap">
            <span className="material-symbols-outlined text-sm text-outline">calendar_today</span>
            {formatToday()}
            <span className="opacity-30">·</span>
            Sprint day <strong className="text-on-surface">{CYCLE_DAY}</strong> of {CYCLE_LENGTH}
          </p>

          {/* Sprint day pips */}
          <div
            className="flex items-center gap-1 mt-1"
            role="img"
            aria-label={`Day ${CYCLE_DAY} of ${CYCLE_LENGTH} in this sprint`}
          >
            {Array.from({ length: CYCLE_LENGTH }).map((_, i) => (
              <span
                key={i}
                style={{ '--d': `${200 + i * 35}ms` }}
                className={`dp-rise rounded-full transition-all ${
                  i < CYCLE_DAY
                    ? `bg-secondary ${i === CYCLE_DAY - 1 ? 'w-2.5 h-4 animate-pulse' : 'w-1.5 h-3.5'}`
                    : 'w-1.5 h-2 bg-surface-container-highest'
                }`}
              />
            ))}
            <span className="ml-2 text-xs text-on-surface-variant font-mono">{Math.round((CYCLE_DAY / CYCLE_LENGTH) * 100)}%</span>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center flex-wrap gap-3 lg:mt-1">
          <button
            onClick={onOpenQuickTask}
            title="Create a task without opening a project"
            className={`group flex items-center gap-2 px-4 py-2.5 rounded-xl dp-card hover:border-outline-variant/40 text-on-surface transition-all duration-200 hover:shadow-lg active:scale-95 cursor-pointer ${FOCUS_RING}`}
            type="button"
          >
            <span className="material-symbols-outlined text-xl text-secondary group-hover:rotate-90 transition-transform duration-300">add_task</span>
            <span className="text-sm font-semibold">Quick Task</span>
          </button>

          <button
            onClick={onOpenGenerateSprint}
            title="Let AI draft a plan for your next sprint"
            className={`group relative overflow-hidden flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-container via-secondary-container to-primary-container text-on-primary-container text-sm font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 cursor-pointer transition-all duration-300 ${FOCUS_RING}`}
            type="button"
          >
            <div className="dp-sheen absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
            <span className="relative material-symbols-outlined text-xl transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">auto_awesome</span>
            <span className="relative">Generate Sprint Plan</span>
          </button>
        </div>
      </section>

      {/* ── Metric cards ─────────────────────────────────────────────── */}
      <section aria-label="Key metrics" className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {METRICS.map((m, i) => <MetricCard key={m.id} metric={m} index={i} />)}
      </section>

      {/* ── Sprint insights ──────────────────────────────────────────── */}
      <section aria-label="Sprint insights" className="mb-10">
        <div className="flex items-center gap-3 mb-5">
          <SectionLabel icon="insights">Sprint Insights</SectionLabel>
          <span className="text-xs text-on-surface-variant">Sprint 14 · Day {CYCLE_DAY}/{CYCLE_LENGTH}</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <BurndownChart />
          <StatusDonut projects={projects} />
          <WorkloadChart />
        </div>
      </section>

      {/* ── Projects header + toolbar ────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <SectionLabel icon="folder_open">Projects</SectionLabel>
          <span className="text-xs text-on-surface-variant font-mono">
            {isFiltered ? `${visible.length} of ${projects.length} shown` : `${projects.length} active`}
          </span>
          {isFiltered && (
            <button
              type="button"
              onClick={clearFilters}
              className={`text-xs text-primary hover:underline cursor-pointer ${FOCUS_RING}`}
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Quick stat bar */}
        {projects.length > 0 && <QuickStatBar projects={projects} />}

        {/* Controls row */}
        <div className="flex flex-col xl:flex-row xl:items-center gap-3">
          {/* Search */}
          <div className="relative flex items-center flex-1 xl:max-w-sm">
            <span className="material-symbols-outlined absolute left-3 text-outline text-lg pointer-events-none">search</span>
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); e.currentTarget.blur(); } }}
              placeholder="Search by name, code or person…"
              aria-label="Search projects"
              className="w-full pl-10 pr-14 py-2.5 rounded-xl bg-surface-container/60 backdrop-blur-lg border border-outline-variant/30 text-on-surface text-sm placeholder:text-outline/60 transition-all focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/25 focus:bg-surface-container-high"
            />
            {query ? (
              <button
                type="button"
                onClick={() => { setQuery(''); searchRef.current && searchRef.current.focus(); }}
                aria-label="Clear search"
                className={`absolute right-2 p-1 rounded-md text-outline hover:text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer ${FOCUS_RING}`}
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            ) : (
              <kbd
                title="Press / to search"
                className="hidden sm:inline-flex absolute right-3 px-1.5 py-0.5 rounded border border-outline-variant/40 font-mono text-xs text-outline pointer-events-none"
              >
                /
              </kbd>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
            {/* Filter tabs */}
            <div
              role="group"
              aria-label="Filter by status"
              className="relative grid grid-cols-3 p-1 rounded-xl bg-surface-container/60 backdrop-blur-lg border border-outline-variant/30"
            >
              <span
                aria-hidden="true"
                className="absolute top-1 bottom-1 left-1 rounded-lg bg-surface-container-highest shadow-md transition-transform duration-300 ease-out motion-reduce:transition-none"
                style={{ width: 'calc((100% - 0.5rem) / 3)', transform: `translateX(${activeIndex * 100}%)` }}
              />
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterType(f.id)}
                  aria-pressed={filterType === f.id}
                  className={`relative z-10 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${FOCUS_RING} ${
                    filterType === f.id ? 'text-on-surface' : 'text-outline hover:text-on-surface'
                  }`}
                >
                  {f.label}
                  <span className={`px-1.5 rounded-full font-mono text-xs ${filterType === f.id ? 'bg-secondary/20 text-secondary' : 'bg-surface-container-high text-outline'}`}>
                    {counts[f.id]}
                  </span>
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none">sort</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort projects"
                className="appearance-none pl-9 pr-8 py-2.5 rounded-xl bg-surface-container/60 backdrop-blur-lg border border-outline-variant/30 text-on-surface text-xs cursor-pointer hover:bg-surface-container-high transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {SORTS.map((s) => <option key={s.id} value={s.id} className="bg-surface text-on-surface">{s.label}</option>)}
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none">expand_more</span>
            </div>

            {/* View toggle */}
            <div
              role="group"
              aria-label="Layout"
              className="flex items-center gap-1 p-1 rounded-xl bg-surface-container/60 backdrop-blur-lg border border-outline-variant/30"
            >
              {[
                { id: 'grid',    icon: 'grid_view',  label: 'Card view' },
                { id: 'compact', icon: 'view_list',  label: 'List view' },
              ].map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setViewMode(v.id)}
                  aria-pressed={viewMode === v.id}
                  aria-label={v.label}
                  title={v.label}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${FOCUS_RING} ${
                    viewMode === v.id ? 'bg-surface-container-highest text-on-surface shadow' : 'text-outline hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">{v.icon}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Project list ─────────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <EmptyState hasProjects={projects.length > 0} onClear={clearFilters} onNew={onOpenNewProject} />
      ) : viewMode === 'grid' ? (
        <section
          key={`grid-${filterType}-${sortBy}`}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {visible.map((project, i) => (
            <ProjectCard key={project.id} project={project} index={i} onSelect={onSelectProject} />
          ))}

          {/* New project tile */}
          <div
            {...asButton(() => onOpenNewProject && onOpenNewProject())}
            aria-label="Create a new project"
            style={{ '--d': `${300 + Math.min(visible.length, 8) * 60}ms` }}
            className={`dp-rise group relative rounded-2xl bg-surface-container/20 backdrop-blur-xl p-6 hover:bg-surface-container/40 transition-all duration-300 flex flex-col justify-center items-center text-center cursor-pointer min-h-[260px] border border-dashed border-outline-variant/40 hover:border-primary/40 hover:-translate-y-0.5 ${FOCUS_RING}`}
          >
            <div className="w-12 h-12 rounded-xl bg-surface-container-high group-hover:bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 group-hover:rotate-90 transition-all duration-300 mb-4 shadow-inner">
              <span className="material-symbols-outlined text-2xl">add</span>
            </div>
            <h4 className="text-base font-semibold text-on-surface mb-1">New Project</h4>
            <p className="text-sm text-outline max-w-xs mb-4 leading-relaxed">
              Start from a template or let AI set it up for you.
            </p>
            <span className="px-3 py-1 rounded-full bg-surface-container-highest text-primary font-mono text-xs font-semibold group-hover:bg-primary group-hover:text-on-primary transition-colors">
              Get started →
            </span>
          </div>
        </section>
      ) : (
        <section key={`list-${filterType}-${sortBy}`} className="flex flex-col gap-2">
          {visible.map((project, i) => (
            <ProjectRow key={project.id} project={project} index={i} onSelect={onSelectProject} />
          ))}

          <div
            {...asButton(() => onOpenNewProject && onOpenNewProject())}
            aria-label="Create a new project"
            className={`group flex items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant/40 hover:border-primary/40 bg-surface-container/20 hover:bg-surface-container/40 py-4 text-outline hover:text-primary transition-all duration-300 cursor-pointer ${FOCUS_RING}`}
          >
            <span className="material-symbols-outlined group-hover:rotate-90 transition-transform duration-300">add</span>
            <span className="text-sm font-semibold">New Project</span>
          </div>
        </section>
      )}
    </div>
  );
};

export default DashboardPage;
