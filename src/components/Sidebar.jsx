import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

/* ==========================================================================
   Sidebar
   --------------------------------------------------------------------------
   Microinteractions in this version:
     nav      a highlight that slides between items, a hover highlight that follows
              the pointer, click ripple, icon pop when a page becomes active,
              soft spotlight that tracks the cursor, arrow-key navigation
     shortcuts Alt + 1…6 jump to a page, Ctrl/⌘ + B collapses; hints show on hover
     collapse labels fade and slide instead of vanishing; AI engine card shrinks to a ring
     badges   optional counts per page (pops when the number changes; urgent ones ping)
     engine   number counts up, bar changes colour as usage climbs, light sweeps across the
              bar, the spark icon twinkles, the status dot follows the usage colour
     brand    click the logo for a spin
     rail     hover the sidebar edge for a handle that collapses or expands it
     footer   click the version to copy it
   ========================================================================== */

const STYLES = `
.sb-root { font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }
.sb-root .font-mono { font-family: inherit; }
@keyframes sb-in { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: none; } }
@keyframes sb-bar { from { transform: translateY(-50%) scaleY(0); } to { transform: translateY(-50%) scaleY(1); } }
@keyframes sb-pop { 0% { transform: scale(.6); } 60% { transform: scale(1.25); } 100% { transform: scale(1); } }
@keyframes sb-ripple { from { transform: translate(-50%, -50%) scale(0); opacity: .35; } to { transform: translate(-50%, -50%) scale(1); opacity: 0; } }
@keyframes sb-shine { from { transform: translateX(-120%) rotate(20deg); } to { transform: translateX(220%) rotate(20deg); } }
@keyframes sb-ring { 0% { transform: scale(1); opacity: .6; } 100% { transform: scale(2.4); opacity: 0; } }
.sb-in { animation: sb-in .4s cubic-bezier(.2,.8,.2,1) backwards; animation-delay: var(--d, 0ms); }
.sb-bar { animation: sb-bar .3s cubic-bezier(.2,.9,.3,1.2) both; }
.sb-pop { animation: sb-pop .35s cubic-bezier(.2,.9,.3,1.3) both; }
.sb-ripple { animation: sb-ripple .6s ease-out forwards; }
.sb-logo:hover .sb-shine { animation: sb-shine .7s ease-out; }
.sb-ping { animation: sb-ring 1.8s ease-out infinite; }
.sb-spot { background: radial-gradient(160px circle at var(--mx, 50%) var(--my, 50%), color-mix(in srgb, currentColor 14%, transparent), transparent 70%); }
@keyframes sb-sheen { 0% { transform: translateX(-100%); } 55%, 100% { transform: translateX(100%); } }
@keyframes sb-twinkle { 0%, 100% { transform: scale(1) rotate(0); opacity: .8; } 50% { transform: scale(1.25) rotate(18deg); opacity: 1; } }
@keyframes sb-spin { from { transform: rotate(0) scale(1); } 50% { transform: rotate(180deg) scale(1.35); } to { transform: rotate(360deg) scale(1); } }
.sb-sheen { background: linear-gradient(100deg, transparent, rgba(255,255,255,.4), transparent); animation: sb-sheen 4s ease-in-out infinite; }
.sb-twinkle { animation: sb-twinkle 2.8s ease-in-out infinite; }
.sb-spin { animation: sb-spin .6s cubic-bezier(.3,.9,.3,1.1); }
@media (prefers-reduced-motion: reduce) {
  .sb-in, .sb-bar, .sb-pop, .sb-ripple, .sb-ping, .sb-sheen, .sb-twinkle, .sb-spin { animation: none !important; }
  .sb-logo:hover .sb-shine { animation: none; }
}
`;

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

// Main navigation first; settings sits apart at the end.
const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
      { id: 'projects', label: 'Projects', icon: 'folder_open' },
      { id: 'sprint-board', label: 'Sprints', icon: 'view_kanban' },
      { id: 'team-and-roles', label: 'Team', icon: 'group' },
      { id: 'analytics', label: 'Analytics', icon: 'insights' },
    ],
  },
  { label: 'Account', items: [{ id: 'settings', label: 'Settings', icon: 'settings' }] },
];
const FLAT = NAV_GROUPS.flatMap((g) => g.items);

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const useCountUp = (target, duration = 800) => {
  const [v, setV] = useState(reducedMotion() ? target : 0);
  const from = useRef(reducedMotion() ? target : 0);
  useEffect(() => {
    if (reducedMotion()) { from.current = target; setV(target); return undefined; }
    let raf;
    const start = from.current;
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min((now - t0) / duration, 1);
      const next = start + (target - start) * (1 - Math.pow(1 - t, 3));
      from.current = next;
      setV(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return Math.round(v);
};

const Icon = ({ name, filled = false, size = 20, className = '', style }) => (
  <span
    className={`material-symbols-outlined shrink-0 ${className}`}
    style={{ fontSize: size, fontVariationSettings: `'FILL' ${filled ? 1 : 0}`, ...style }}
    aria-hidden="true"
  >
    {name}
  </span>
);

// Label bubble shown next to an icon when the sidebar is collapsed.
const Tip = ({ children, hint }) => (
  <span
    role="tooltip"
    className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-surface-container-highest text-on-surface text-xs font-medium whitespace-nowrap shadow-lg border border-outline-variant/30 opacity-0 -translate-x-1 scale-95 group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100 group-hover:delay-150 group-focus-visible:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:scale-100 transition-all duration-150 z-50"
  >
    {children}
    {hint && <kbd className="px-1.5 rounded border border-outline-variant/40 text-[11px] text-outline">{hint}</kbd>}
  </span>
);

/* ---------- Nav item ---------- */

const NavItem = ({ item, number, active, collapsed, badge, onNavigate, onHover, setRef, index }) => {
  const [ripples, setRipples] = useState([]);

  const click = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const id = `${Date.now()}${Math.random()}`;
    setRipples((p) => [...p, { id, x: e.clientX - r.left, y: e.clientY - r.top, size: Math.max(r.width, r.height) * 2 }]);
    setTimeout(() => setRipples((p) => p.filter((x) => x.id !== id)), 600);
    onNavigate(item.id);
  };

  const count = typeof badge === 'object' && badge ? badge.count : badge;
  const tone = typeof badge === 'object' && badge?.tone === 'error' ? 'bg-error text-on-error' : 'bg-primary text-on-primary';
  const shortcut = `Alt ${number}`;

  return (
    <button
      ref={setRef} type="button" data-nav onClick={click}
      onPointerEnter={() => onHover(item.id)} onFocus={() => onHover(item.id)}
      aria-current={active ? 'page' : undefined} aria-label={collapsed ? item.label : undefined} aria-keyshortcuts={shortcut}
      style={{ '--d': `${index * 45}ms`, paddingLeft: collapsed ? 22 : 12, paddingRight: 12 }}
      className={`sb-in group relative z-10 w-full flex items-center py-2.5 rounded-xl text-left cursor-pointer select-none transition-[padding,color,transform] duration-300 active:scale-[.97] ${focusRing} ${
        active ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-on-surface'
      }`}
    >
      {/* Ripples are clipped here so the tooltip can still overflow the button */}
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl" aria-hidden="true">
        {ripples.map((r) => (
          <span key={r.id} className="sb-ripple absolute rounded-full bg-primary" style={{ left: r.x, top: r.y, width: r.size, height: r.size }} />
        ))}
      </span>

      <span key={active ? 'on' : 'off'} className={`relative flex ${active ? 'sb-pop' : 'transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6'}`}>
        <Icon name={item.icon} filled={active} />
        {collapsed && count > 0 && (
          <span key={count} className={`sb-pop absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-surface ${tone.split(' ')[0]}`} />
        )}
      </span>

      <span className={`overflow-hidden whitespace-nowrap text-sm font-medium transition-[max-width,opacity,margin] duration-300 ${collapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[150px] opacity-100 ml-3'}`}>
        {item.label}
      </span>

      {!collapsed && (
        <span className="ml-auto flex items-center pl-2">
          {count > 0 ? (
            <span key={count} className="sb-pop relative flex">
              {tone.includes('bg-error') && <span className="sb-ping absolute inset-0 rounded-full bg-error" aria-hidden="true" />}
              <span className={`relative min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold flex items-center justify-center ${tone}`}>{count}</span>
            </span>
          ) : (
            <kbd className="px-1.5 rounded border border-outline-variant/40 text-[11px] text-outline opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 transition-all duration-200">{shortcut}</kbd>
          )}
        </span>
      )}

      {collapsed && <Tip hint={shortcut}>{item.label}{count > 0 ? ` (${count})` : ''}</Tip>}
    </button>
  );
};

/* ---------- AI engine ---------- */

const usageTone = (u) => (u >= 90 ? { text: 'text-error', bar: 'bg-error', stroke: 'text-error', dot: 'bg-error' } : u >= 80 ? { text: 'text-tertiary', bar: 'bg-tertiary', stroke: 'text-tertiary', dot: 'bg-tertiary' } : { text: 'text-secondary', bar: 'bg-gradient-to-r from-primary to-secondary', stroke: 'text-secondary', dot: 'bg-secondary' });

const EngineStatus = ({ usage, used, total, collapsed }) => {
  const shown = useCountUp(usage);
  const [width, setWidth] = useState(0);
  const [flip, setFlip] = useState(false); // click toggles percent <-> hours left
  useEffect(() => {
    const t = setTimeout(() => setWidth(usage), 150);
    return () => clearTimeout(t);
  }, [usage]);
  const tone = usageTone(usage);
  const circ = 2 * Math.PI * 15;

  if (collapsed) {
    return (
      <div className="group relative flex justify-center">
        <div className="relative w-10 h-10 flex items-center justify-center" role="img" aria-label={`AI engine ${usage} percent used`}>
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" className="stroke-surface-container-highest" />
            <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" strokeLinecap="round" className={`${tone.stroke} transition-[stroke-dashoffset] duration-1000 ease-out`} stroke="currentColor" strokeDasharray={circ} strokeDashoffset={circ * (1 - width / 100)} />
          </svg>
          <span className="absolute text-[11px] font-semibold text-on-surface">{shown}</span>
        </div>
        <Tip>AI engine · {usage}% used</Tip>
      </div>
    );
  }

  return (
    <button
      type="button" onClick={() => setFlip((f) => !f)} aria-label="Toggle between percent used and hours left"
      className={`text-left bg-surface-container-low/70 rounded-xl p-3 flex flex-col gap-2 border border-outline-variant/20 transition-all duration-200 hover:border-outline-variant/50 hover:-translate-y-0.5 active:scale-[.98] cursor-pointer ${focusRing}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-on-surface font-semibold flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
            <span className={`sb-ping absolute inline-flex h-full w-full rounded-full transition-colors duration-500 ${tone.dot}`} />
            <span className={`relative inline-flex h-1.5 w-1.5 rounded-full transition-colors duration-500 ${tone.dot}`} />
          </span>
          AI engine
        </span>
        <span key={flip ? 'l' : 'p'} className={`sb-pop text-xs font-semibold ${tone.text}`}>
          {flip ? `${total - used}h left` : `${shown}%`}
        </span>
      </div>
      <div className="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden" role="progressbar" aria-label="TPU hours used" aria-valuenow={usage} aria-valuemin={0} aria-valuemax={100}>
        <div className={`relative h-full overflow-hidden rounded-full transition-[width,background-color] duration-1000 ease-out motion-reduce:transition-none ${tone.bar}`} style={{ width: `${width}%` }}>
          <span className="sb-sheen absolute inset-0" aria-hidden="true" />
        </div>
      </div>
      <div className="flex items-center justify-between text-on-surface-variant">
        <span className="text-xs">{used.toLocaleString()} of {total.toLocaleString()} TPU hours</span>
        <span className="sb-twinkle flex"><Icon name="auto_awesome" filled size={14} className="text-tertiary" /></span>
      </div>
    </button>
  );
};

/* ---------- Version (click to copy) ---------- */

const VersionChip = ({ version }) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try { await navigator.clipboard.writeText(version); } catch { return; }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1400);
  };
  return (
    <button
      type="button" onClick={copy} title="Copy version number"
      className={`group flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors active:scale-95 cursor-pointer ${focusRing}`}
    >
      <span key={copied ? 'c' : 'v'} className="sb-pop">{copied ? 'Copied' : `Version ${version}`}</span>
      <Icon name={copied ? 'check' : 'content_copy'} size={12} className={`transition-opacity ${copied ? 'text-secondary opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
    </button>
  );
};

/* ---------- Sidebar ---------- */

export const Sidebar = ({
  activePage,
  onNavigate,
  isCollapsed,
  onToggleCollapse,
  tpuUsage = 78,
  tpuUsedHours = 784,
  tpuTotalHours = 1000,
  badges = {}, // e.g. { 'sprint-board': { count: 1, tone: 'error' }, projects: 5 }
}) => {
  const navRef = useRef(null);
  const itemRefs = useRef({});
  const [hoverId, setHoverId] = useState(null);
  const [rects, setRects] = useState({ active: null, hover: null });
  const [ready, setReady] = useState(false); // avoids the highlight sliding in from the top on first paint
  const [spark, setSpark] = useState(0); // bumps when the logo is clicked

  const measure = useCallback(() => {
    const rect = (id) => {
      const el = itemRefs.current[id];
      return el ? { top: el.offsetTop, height: el.offsetHeight } : null;
    };
    setRects({ active: rect(activePage), hover: hoverId ? rect(hoverId) : null });
  }, [activePage, hoverId]);

  useLayoutEffect(() => { measure(); }, [measure, isCollapsed]);
  useEffect(() => { const t = setTimeout(() => setReady(true), 50); return () => clearTimeout(t); }, []);

  // Items shift while group labels collapse, so keep measuring as the nav resizes.
  useEffect(() => {
    if (!navRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(navRef.current);
    return () => ro.disconnect();
  }, [measure]);

  // Pointer spotlight
  const onPointerMove = (e) => {
    const r = navRef.current.getBoundingClientRect();
    navRef.current.style.setProperty('--mx', `${e.clientX - r.left}px`);
    navRef.current.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  // Arrow keys move between items.
  const onNavKey = (e) => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const els = Array.from(navRef.current.querySelectorAll('button[data-nav]'));
    const i = els.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? els.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length;
    els[next].focus();
  };

  // Alt + 1…6 go to a page; Ctrl/⌘ + B collapses.
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat) return;
      if (e.altKey && !e.ctrlKey && !e.metaKey && /^[1-9]$/.test(e.key)) {
        const item = FLAT[Number(e.key) - 1];
        if (item) { e.preventDefault(); onNavigate(item.id); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); onToggleCollapse(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNavigate, onToggleCollapse]);

  const numbers = useMemo(() => Object.fromEntries(FLAT.map((it, i) => [it.id, i + 1])), []);
  let runningIndex = 0;
  const slide = ready ? 'transition-[transform,height,opacity] duration-300 ease-[cubic-bezier(.3,.9,.3,1.1)]' : '';

  return (
    <aside
      aria-label="Main"
      className={`sb-root fixed left-0 top-0 h-full ${isCollapsed ? 'w-20' : 'w-72'} bg-surface-container-lowest/85 backdrop-blur-xl z-50 flex flex-col justify-between border-r border-outline-variant/20 transition-[width] duration-300 ease-out`}
    >
      <style>{STYLES}</style>

      <div className="flex flex-col">
        {/* Brand */}
        <div className="h-16 flex items-center border-b border-outline-variant/10 px-[22px] overflow-hidden">
          <div role="presentation" onClick={() => setSpark((k) => k + 1)} className="sb-logo cursor-pointer relative w-9 h-9 rounded-xl bg-gradient-to-br from-primary/80 to-secondary/60 flex items-center justify-center shrink-0 shadow-sm overflow-hidden transition-transform duration-300 hover:rotate-6 hover:scale-105 active:scale-95">
            <span key={spark} className={`flex ${spark ? 'sb-spin' : ''}`}><Icon name="star" filled size={18} className="text-white" /></span>
            <span className="sb-shine pointer-events-none absolute inset-y-0 -left-full w-1/2 bg-white/30" aria-hidden="true" />
          </div>
          <div className={`flex flex-col min-w-0 leading-tight overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-300 ${isCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[180px] opacity-100 ml-3'}`}>
            <span className="font-semibold text-on-surface truncate text-base" style={{ letterSpacing: '-0.01em' }}>MeritMatrix</span>
            <span className="text-xs text-primary font-medium">AI suite</span>
          </div>
        </div>

        {/* Navigation */}
        <nav
          ref={navRef} aria-label="Primary" onKeyDown={onNavKey} onPointerMove={onPointerMove}
          onPointerLeave={() => setHoverId(null)} onBlur={(e) => { if (!navRef.current.contains(e.relatedTarget)) setHoverId(null); }}
          className="group/nav relative flex flex-col gap-1 p-2 pt-3"
        >
          <span className="sb-spot text-primary pointer-events-none absolute inset-0 opacity-0 group-hover/nav:opacity-100 transition-opacity duration-300" aria-hidden="true" />

          {/* Pointer-following highlight */}
          {rects.hover && (
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute left-2 right-2 top-0 rounded-xl bg-surface-container-high ${slide} ${hoverId === activePage ? 'opacity-0' : 'opacity-100'}`}
              style={{ transform: `translateY(${rects.hover.top}px)`, height: rects.hover.height }}
            />
          )}
          {/* Active page highlight: slides between items */}
          {rects.active && (
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute left-2 right-2 top-0 rounded-xl bg-primary/10 ${slide}`}
              style={{ transform: `translateY(${rects.active.top}px)`, height: rects.active.height }}
            >
              <span key={activePage} className="sb-bar absolute left-0 top-1/2 w-1 h-6 rounded-r-full bg-primary" />
            </span>
          )}

          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? 'mt-3 pt-3 border-t border-outline-variant/15' : ''}>
              <p className={`px-3 overflow-hidden text-xs font-medium text-outline transition-[max-height,opacity,padding] duration-300 ${isCollapsed ? 'max-h-0 opacity-0 pb-0' : 'max-h-6 opacity-100 pb-1.5'}`}>
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <NavItem
                    key={item.id} item={item} number={numbers[item.id]} index={runningIndex++}
                    active={activePage === item.id} collapsed={isCollapsed} badge={badges[item.id]}
                    onNavigate={onNavigate} onHover={setHoverId} setRef={(el) => { itemRefs.current[item.id] = el; }}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div className="p-3 flex flex-col gap-3">
        <EngineStatus usage={tpuUsage} used={tpuUsedHours} total={tpuTotalHours} collapsed={isCollapsed} />

        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-1'}`}>
          {!isCollapsed && <VersionChip version="3.4.2" />}
          <button
            type="button" onClick={onToggleCollapse} title={isCollapsed ? undefined : 'Collapse (Ctrl/⌘ + B)'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!isCollapsed} aria-keyshortcuts="Control+B"
            className={`group relative text-outline hover:text-on-surface p-1.5 rounded-lg hover:bg-surface-container-high transition-[color,background-color,transform] active:scale-90 cursor-pointer ${focusRing}`}
          >
            <Icon name="keyboard_double_arrow_left" size={18} className={`transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''} group-hover:-translate-x-0.5 ${isCollapsed ? 'group-hover:translate-x-0.5' : ''}`} />
            {isCollapsed && <Tip hint="Ctrl B">Expand sidebar</Tip>}
          </button>
        </div>
      </div>

      {/* Edge handle: hover the sidebar edge to collapse or expand */}
      <button
        type="button" tabIndex={-1} aria-hidden="true" onClick={onToggleCollapse}
        className="group/edge absolute inset-y-0 -right-1.5 z-10 w-3 cursor-pointer"
      >
        <span className="absolute inset-y-0 left-1/2 w-px bg-primary/0 transition-colors duration-200 group-hover/edge:bg-primary/50" />
        <span className="absolute left-1/2 top-1/2 flex h-10 w-5 -translate-x-1/2 -translate-y-1/2 scale-75 items-center justify-center rounded-full border border-outline-variant/40 bg-surface-container-highest text-on-surface-variant opacity-0 shadow-md transition-all duration-200 group-hover/edge:scale-100 group-hover/edge:opacity-100 group-hover/edge:delay-100">
          <Icon name="chevron_left" size={16} className={`transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
        </span>
      </button>
    </aside>
  );
};