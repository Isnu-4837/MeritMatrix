import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';

/* ---------- Motion helpers ---------- */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Animates a number from 0 to `target`. Re-runs when `runKey` changes (used by Refresh).
const useCountUp = (target, { duration = 1100, decimals = 0, runKey = 0 } = {}) => {
  const [value, setValue] = useState(prefersReducedMotion() ? target : 0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, runKey]);
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

// Grows a bar from 0 to its width after mount / refresh.
const useGrow = (runKey = 0) => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
    return () => cancelAnimationFrame(id);
  }, [runKey]);
  return on;
};

/* ---------- Reusable pieces ---------- */

// Card with a soft spotlight that follows the cursor.
const GlassCard = ({ className = '', children, delay = 0, ...rest }) => {
  const ref = useRef(null);
  return (
    <div
      ref={ref}
      style={{ animationDelay: `${delay}ms` }}
      className={`ap-card ap-enter relative overflow-hidden rounded-2xl bg-surface-container/60 backdrop-blur-xl border border-outline-variant/30 transition-[border-color,transform] duration-300 hover:border-secondary/40 ${className}`}
      {...rest}
    >
      <div className="relative flex flex-col h-full">{children}</div>
    </div>
  );
};

const Sparkline = ({ data, stroke = 'currentColor' }) => {
  const w = 96, h = 28;
  const min = Math.min(...data), max = Math.max(...data);
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - 3 - ((v - min) / (max - min || 1)) * (h - 6),
  ]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-24 h-7" aria-hidden="true">
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" pathLength="1" className="ap-draw" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={stroke} />
    </svg>
  );
};

const KpiCard = ({ label, hint, value, decimals = 0, suffix = '', valueClass, badge, badgeClass, sub, spark, sparkColor, children, delay, runKey }) => {
  const shown = useCountUp(value, { decimals, runKey });
  return (
    <GlassCard delay={delay} className="p-space-md hover:-translate-y-0.5" tabIndex={0} aria-label={`${label}: ${value}${suffix}. ${sub || ''}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-mono text-xs text-outline font-semibold">{label}</span>
        {hint && (
          <span className="text-xs font-mono text-outline/80 border border-outline-variant/40 rounded-full px-2 py-0.5">
            {hint}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2 mb-2">
        <div className="flex items-baseline gap-2">
          <span
            className={`font-semibold font-mono tabular-nums ${valueClass}`}
            style={{fontSize: 'clamp(1.5rem, 3vw, 1.875rem)', letterSpacing: '-0.02em'}}
          >
            {shown}
            {suffix}
          </span>
          <span className={`font-mono text-xs ${badgeClass}`}>{badge}</span>
        </div>
        {spark && (
          <span className={sparkColor}>
            <Sparkline data={spark} />
          </span>
        )}
      </div>
      {children}
      {sub && <span className="text-xs text-on-surface-variant">{sub}</span>}
    </GlassCard>
  );
};

/* ---------- Burndown chart ---------- */

const IDEAL = [
  { d: 1, v: 100 }, { d: 3, v: 85 }, { d: 5, v: 70 }, { d: 7, v: 55 },
  { d: 9, v: 40 }, { d: 11, v: 25 }, { d: 14, v: 0 },
];
const ACTUAL = [
  { d: 1, v: 98 }, { d: 3, v: 88 }, { d: 5, v: 68 }, { d: 7, v: 52 }, { d: 9, v: 36 },
];
const PROJECTED = [{ d: 9, v: 36 }, { d: 11, v: 20 }, { d: 14, v: 0 }];

const W = 420, H = 200, PX = 28, PT = 12, PB = 24;
const sx = (d) => PX + ((d - 1) / 13) * (W - PX * 2);
const sy = (v) => PT + (1 - v / 100) * (H - PT - PB);
const line = (arr) => arr.map((p, i) => `${i ? 'L' : 'M'}${sx(p.d).toFixed(1)},${sy(p.v).toFixed(1)}`).join(' ');

const BurndownChart = ({ show }) => {
  const [hover, setHover] = useState(null);
  const days = IDEAL.map((p) => p.d);
  const info = (d) => {
    const ideal = IDEAL.find((p) => p.d === d)?.v;
    const actual = ACTUAL.find((p) => p.d === d)?.v;
    const proj = PROJECTED.find((p) => p.d === d)?.v;
    const val = actual ?? proj;
    return { d, ideal, actual, proj, diff: val != null ? ideal - val : null };
  };
  const h = hover != null ? info(hover) : null;
  const area = `${line(ACTUAL)} L${sx(9)},${sy(0)} L${sx(1)},${sy(0)} Z`;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Sprint 14 burndown chart. Actual progress is slightly ahead of the ideal line.">
        <defs>
          <linearGradient id="apArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(76,215,246)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(76,215,246)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={PX} x2={W - PX} y1={sy(v)} y2={sy(v)} stroke="currentColor" className="text-outline-variant" strokeOpacity="0.25" strokeDasharray="2 4" />
            <text x={PX - 6} y={sy(v) + 3} textAnchor="end" className="fill-outline" fontSize="10" fontFamily="inherit">{v}</text>
          </g>
        ))}

        {show.ideal && (
          <path d={line(IDEAL)} fill="none" stroke="currentColor" className="text-outline" strokeWidth="1.5" strokeDasharray="5 4" />
        )}
        {show.actual && (
          <>
            <path d={area} fill="url(#apArea)" className="ap-fade" />
            <path d={line(ACTUAL)} fill="none" stroke="rgb(76,215,246)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength="1" className="ap-draw" style={{ filter: 'drop-shadow(0 0 5px rgba(76,215,246,.55))' }} />
            {ACTUAL.map((p) => (
              <circle key={p.d} cx={sx(p.d)} cy={sy(p.v)} r={hover === p.d ? 5 : 3} fill="rgb(76,215,246)" className="transition-all duration-150" />
            ))}
          </>
        )}
        {show.projected && (
          <path d={line(PROJECTED)} fill="none" stroke="rgb(76,215,246)" strokeOpacity="0.6" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" />
        )}

        {/* Day labels + hit areas (mouse + keyboard) */}
        {days.map((d) => (
          <g key={d}>
            <text x={sx(d)} y={H - 8} textAnchor="middle" className={hover === d ? 'fill-secondary' : 'fill-outline'} fontSize="11" fontFamily="inherit">D{d}</text>
            {hover === d && <line x1={sx(d)} x2={sx(d)} y1={PT} y2={H - PB} stroke="rgb(76,215,246)" strokeOpacity="0.35" />}
            <rect
              x={sx(d) - 22} y={0} width={44} height={H}
              fill="transparent" tabIndex={0} className="outline-none cursor-crosshair"
              aria-label={`Day ${d}: ideal ${IDEAL.find((p) => p.d === d).v} points remaining`}
              onMouseEnter={() => setHover(d)} onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(d)} onBlur={() => setHover(null)}
            />
          </g>
        ))}
      </svg>

      {h && (
        <div
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 rounded-xl border border-outline-variant/40 bg-surface-container-highest/95 px-3 py-2 text-xs font-mono shadow-xl backdrop-blur"
          style={{ left: `${(sx(h.d) / W) * 100}%` }}
          role="status"
        >
          <div className="font-semibold text-on-surface mb-1">Day {h.d}</div>
          <div className="text-outline">Ideal: <span className="text-on-surface">{h.ideal} pts</span></div>
          {h.actual != null && <div className="text-outline">Actual: <span className="text-secondary">{h.actual} pts</span></div>}
          {h.actual == null && h.proj != null && <div className="text-outline">Projected: <span className="text-secondary">{h.proj} pts</span></div>}
          {h.diff != null && h.diff > 0 && <div className="text-secondary mt-1">{h.diff} pts ahead</div>}
        </div>
      )}
    </div>
  );
};

/* ---------- Squad rows ---------- */

const SQUADS = [
  {
    id: 'core', name: 'Core Infrastructure', people: 'Elena, Alex, David', pct: 98,
    note: 'Near full capacity. Avoid adding new work this sprint.',
    bar: 'bg-secondary', text: 'text-secondary', tag: '98% capacity',
  },
  {
    id: 'frontend', name: 'Frontend Systems', people: 'Marcus Chen', pct: 88,
    note: 'Capacity is normalized across timezones.',
    bar: 'bg-primary', text: 'text-primary', tag: '88% capacity',
  },
  {
    id: 'ml', name: 'AI / ML Research', people: 'Sophia Patel', pct: 92,
    note: 'Active on the benchmark run. Room for small reviews only.',
    bar: 'bg-tertiary', text: 'text-tertiary', tag: '92% capacity',
  },
];

const SquadRow = ({ s, open, onToggle, grow }) => (
  <div>
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="group w-full text-left rounded-xl p-2 -m-2 transition-colors hover:bg-surface-container-highest/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary"
    >
      <div className="flex justify-between items-center gap-2 text-body-sm font-semibold mb-1.5">
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 20 20" className={`w-3 h-3 text-outline transition-transform duration-200 ${open ? 'rotate-90' : ''}`} fill="currentColor" aria-hidden="true">
            <path d="M7 4l6 6-6 6V4z" />
          </svg>
          {s.name}
        </span>
        <span className={`font-mono text-sm ${s.text}`}>{s.tag}</span>
      </div>
      <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
        <div
          className={`${s.bar} h-full rounded-full transition-[width] duration-1000 ease-out relative overflow-hidden`}
          style={{ width: grow ? `${s.pct}%` : '0%' }}
        >
          <span className="ap-shimmer absolute inset-0" />
        </div>
      </div>
    </button>
    <div className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0'}`}>
      <div className="overflow-hidden">
        <p className="text-xs text-on-surface-variant pl-5">
          <span className="font-semibold text-on-surface">{s.people}.</span> {s.note}
        </p>
      </div>
    </div>
  </div>
);

/* ---------- Page ---------- */

export const AnalyticsPage = ({ tpuUsage = 78 }) => {
  const [runKey, setRunKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [openSquad, setOpenSquad] = useState('core');
  const [show, setShow] = useState({ ideal: true, actual: true, projected: true });
  const grow = useGrow(runKey);

  const refresh = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    setTimeout(() => {
      setRunKey((k) => k + 1);
      setRefreshing(false);
    }, 600);
  }, [refreshing]);

  const toggles = useMemo(
    () => [
      { key: 'ideal', label: 'Target', dot: 'bg-outline' },
      { key: 'actual', label: 'Actual', dot: 'bg-secondary' },
      { key: 'projected', label: 'Projected', dot: 'bg-secondary/50' },
    ],
    []
  );

  return (
    <div className="ap-root max-w-7xl mx-auto flex flex-col w-full pb-32 pt-space-md">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        .ap-root { font-family: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }
        .ap-root .font-mono { font-family: inherit; }
        .ap-root h1, .ap-root h2, .ap-root h3, .ap-root h4 { letter-spacing: -0.015em; }
        @keyframes apEnter { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes apDraw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
        @keyframes apFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes apPing { 0% { transform: scale(1); opacity: .7; } 100% { transform: scale(2.6); opacity: 0; } }
        @keyframes apShimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
        @keyframes apSpin { to { transform: rotate(360deg); } }
        .ap-enter { animation: apEnter .6s cubic-bezier(.2,.7,.2,1) both; }
        .ap-draw { stroke-dasharray: 1; animation: apDraw 1.4s ease-out .3s both; }
        .ap-fade { animation: apFade 1.2s ease-out .8s both; }
        .ap-ping { animation: apPing 1.8s ease-out infinite; }
        .ap-shimmer { background: linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent); animation: apShimmer 2.6s ease-in-out infinite; }
        .ap-spin { animation: apSpin .7s linear infinite; }
        .ap-spot { background: radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), rgba(76,215,246,.10), transparent 70%); }
        .ap-card:hover .ap-spot { opacity: 1; }
        @media (prefers-reduced-motion: reduce) {
          .ap-enter, .ap-draw, .ap-fade, .ap-ping, .ap-shimmer, .ap-spin { animation: none !important; }
          .ap-draw { stroke-dasharray: none; }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-space-xl">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-70" style={{animation: 'apPing 1.8s ease-out infinite'}} />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-tertiary" />
            </span>
            <span className="font-mono text-xs text-tertiary font-semibold">Live data</span>
            <span className="font-mono text-xs text-outline">·</span>
            <span className="font-mono text-xs text-outline">Sprint 14 · Day 9 of 14</span>
          </div>
          <h1
            className="font-semibold text-on-surface"
            style={{
              fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
              letterSpacing: '-0.025em',
              lineHeight: '1.15',
            }}
          >
            System Analytics &amp; Velocity
          </h1>
          <p className="text-sm text-on-surface-variant max-w-lg leading-relaxed">
            How fast the team is shipping, how much compute it is using, and whether every sandbox is verified.
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="self-start sm:self-auto inline-flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container/60 px-4 py-2 text-sm font-semibold text-on-surface backdrop-blur transition hover:border-secondary/60 hover:text-secondary active:scale-95 disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary"
        >
          <svg viewBox="0 0 24 24" className={`w-4 h-4 ${refreshing ? 'ap-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12a9 9 0 11-3-6.7M21 4v5h-5" />
          </svg>
          {refreshing ? 'Refreshing…' : 'Refresh data'}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-xl">
        <KpiCard
          label="Sprint velocity" value={94.2} decimals={1}
          valueClass="text-on-surface" badge="+6.4 vs last sprint" badgeClass="text-secondary"
          sub="87.8 pts in Sprint 13" spark={[78, 82, 80, 87.8, 94.2]} sparkColor="text-secondary"
          delay={0} runKey={runKey}
        />
        <KpiCard
          label="TPU usage" value={tpuUsage} suffix="%"
          valueClass="text-secondary" badge="784 of 1,000 hrs" badgeClass="text-outline"
          delay={80} runKey={runKey}
        >
          <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden mb-2" role="progressbar" aria-valuenow={tpuUsage} aria-valuemin={0} aria-valuemax={100} aria-label="TPU usage">
            <div className="bg-secondary h-full rounded-full transition-[width] duration-1000 ease-out" style={{ width: grow ? `${tpuUsage}%` : '0%' }} />
          </div>
          <span className="text-xs text-on-surface-variant">{100 - tpuUsage}% of the monthly budget left</span>
        </KpiCard>
        <KpiCard
          label="Neural actions" value={1280}
          valueClass="text-tertiary" badge="34 hrs saved" badgeClass="text-tertiary"
          sub="Quantum v3.4 model calls" spark={[40, 55, 52, 70, 88, 100]} sparkColor="text-tertiary"
          delay={160} runKey={runKey}
        />
        <KpiCard
          label="Sandbox audits" value={100} suffix="%"
          valueClass="text-primary" badge="All verified" badgeClass="text-secondary"
          sub="5 of 5 developer sandboxes signed"
          delay={240} runKey={runKey}
        >
          <div className="flex gap-1.5 mb-2" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="h-1.5 flex-1 rounded-full bg-primary" />
            ))}
          </div>
        </KpiCard>
      </div>

      {/* Burndown & Squad */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg mb-space-xl">
        <GlassCard delay={320} className="p-space-lg">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-space-md">
            <div>
              <p className="font-mono text-xs text-outline mb-1">Sprint Burndown</p>
              <h3 className="font-semibold text-on-surface" style={{fontSize: '1.125rem', letterSpacing: '-0.02em'}}>Sprint 14 progress</h3>
              <p className="text-xs text-outline mt-0.5">Story points left. Hover or tab a day for details.</p>
            </div>
            <span className="text-xs font-mono text-secondary bg-secondary/10 px-2 py-1 rounded-full">
              Ahead of schedule
            </span>
          </div>

          <BurndownChart show={show} />

          <div className="flex flex-wrap items-center gap-2 pt-4" role="group" aria-label="Chart lines">
            {toggles.map((t) => (
              <button
                key={t.key}
                type="button"
                aria-pressed={show[t.key]}
                onClick={() => setShow((s) => ({ ...s, [t.key]: !s[t.key] }))}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary ${
                  show[t.key]
                    ? 'border-secondary/40 bg-secondary/10 text-on-surface'
                    : 'border-outline-variant/30 text-outline line-through'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${t.dot}`} />
                {t.label}
              </button>
            ))}
          </div>
        </GlassCard>

        <GlassCard delay={400} className="p-space-lg">
          <div className="flex items-start justify-between gap-3 mb-space-md">
            <div>
              <p className="font-mono text-xs text-outline mb-1">Squad Overview</p>
              <h3 className="font-semibold text-on-surface" style={{fontSize: '1.125rem', letterSpacing: '-0.02em'}}>Team capacity</h3>
              <p className="text-xs text-outline mt-0.5">Select a team to see who is on it.</p>
            </div>
            <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded-full">
              4 timezones
            </span>
          </div>

          <div className="space-y-space-md my-auto">
            {SQUADS.map((s) => (
              <SquadRow
                key={s.id}
                s={s}
                grow={grow}
                open={openSquad === s.id}
                onToggle={() => setOpenSquad(openSquad === s.id ? null : s.id)}
              />
            ))}
          </div>

          {/* 24h overlap strip */}
          <div className="pt-space-sm mt-space-md border-t border-outline-variant/20">
            <div className="flex items-center justify-between text-xs text-outline font-mono mb-2">
              <span>Best time to meet: 14:00 – 17:30 UTC</span>
              <span className="text-secondary font-semibold">3.5 hrs overlap</span>
            </div>
            <div className="flex gap-0.5" role="img" aria-label="24-hour timeline with the overlap window highlighted from 14:00 to 17:30 UTC">
              {Array.from({ length: 24 }, (_, h) => {
                const active = h >= 14 && h < 18;
                return (
                  <span
                    key={h}
                    title={`${String(h).padStart(2, '0')}:00 UTC`}
                    className={`h-3 flex-1 rounded-sm transition-colors ${
                      active ? 'bg-secondary' : 'bg-surface-container-highest hover:bg-outline-variant'
                    }`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs font-mono text-outline mt-1">
              <span>00:00</span><span>12:00</span><span>23:00</span>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};