import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ==========================================================================
   TeamPage
   --------------------------------------------------------------------------
   1. Constants & filter rules   chips, sort options, status + score colors
   2. Helpers & hooks            search matching, tween, toast
   3. UI primitives              Icon, SpotlightCard, Avatar
   4. Member card pieces         ScoreGauge, BadgePill, MemberCard, AddCard
   5. Page sections              Header, Overview, Toolbar, SquadTray, Copilot
   6. Page                       state + composition
   ========================================================================== */

/* ==========================================================================
   1. CONSTANTS & FILTER RULES
   ========================================================================== */

const hasSkill = (m, list) => (m.skills ?? []).some((s) => list.includes(s));
const hasBadge = (m, words) => (m.meritBadges ?? []).some((b) => words.some((w) => b.title.includes(w)));
const isBench = (m) => m.statusType === 'bench' || (m.statusText ?? '').includes('Bench');

// Each chip carries its own rule, so adding a filter means adding one entry.
const FILTERS = [
  { id: 'all', label: 'Everyone', test: () => true },
  { id: 'rust-go', label: 'Rust / Go', icon: 'memory', iconColor: 'text-tertiary', test: (m) => hasSkill(m, ['Go', 'Rust', 'gRPC']) },
  { id: 'webgl', label: 'Three.js / WebGL', icon: 'deployed_code', iconColor: 'text-secondary', test: (m) => hasSkill(m, ['WebSockets', 'Next.js', 'Tailwind']) || hasBadge(m, ['WebGL']) },
  { id: 'aws', label: 'AWS certified', icon: 'cloud_done', iconColor: 'text-primary', test: (m) => hasBadge(m, ['AWS', 'Cloud']) },
  { id: 'high-score', label: 'High availability (90%+)', icon: 'verified', iconColor: 'text-secondary', test: (m) => m.availabilityScore >= 90 },
  { id: 'bench', label: 'On bench', dot: 'bg-secondary-container', test: isBench },
];

const SORTS = [
  { id: 'default', label: 'Default order' },
  { id: 'score-desc', label: 'Highest availability' },
  { id: 'name', label: 'Name A–Z' },
];

// Status colors (full class names so Tailwind can see them).
const STATUS_TONES = {
  leading: { dot: 'bg-tertiary', text: 'text-tertiary', pulse: true },
  optimal: { dot: 'bg-primary', text: 'text-primary', pulse: false },
  bench: { dot: 'bg-secondary', text: 'text-secondary', pulse: false },
};
const statusTone = (type) => STATUS_TONES[type] ?? STATUS_TONES.bench;

const STATUS_LABELS = { leading: 'Leading', optimal: 'Optimal', bench: 'On bench' };
const statusKey = (m) => (isBench(m) ? 'bench' : STATUS_TONES[m.statusType] ? m.statusType : 'bench');

const scoreTone = (score) =>
  score >= 95
    ? 'text-secondary'
    : score >= 90
      ? 'text-primary'
      : 'text-tertiary';

const HIGHLIGHT_SKILLS = ['WebSockets', 'Go', 'CUDA', 'Rust', 'Redis'];

const COPILOT_DEFAULT = 'Recommend a 3-person squad for High-Throughput Streaming Engine';

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary';

/* ==========================================================================
   2. HELPERS & HOOKS
   ========================================================================== */

const matchesQuery = (m, q) =>
  !q ||
  m.name.toLowerCase().includes(q) ||
  m.role.toLowerCase().includes(q) ||
  (m.skills ?? []).some((s) => s.toLowerCase().includes(q)) ||
  (m.meritBadges ?? []).some((b) => b.title.toLowerCase().includes(q));

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Smoothly tweens a number toward `target` (starts at 0).
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

/* ==========================================================================
   3. UI PRIMITIVES
   ========================================================================== */

const Icon = ({ name, className = '' }) => (
  <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{name}</span>
);

const SpotlightCard = ({ as: Tag = 'div', className = '', style, children, ...rest }) => (
  <Tag style={style} className={`relative ${className}`} {...rest}>{children}</Tag>
);

const Avatar = ({ src, name, className = '' }) => {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <div role="img" aria-label={name} className={`bg-surface-container-highest text-on-surface font-mono font-semibold flex items-center justify-center ring-1 ring-outline-variant/40 ${className}`}>
        {name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
      </div>
    );
  }
  return <img src={src} alt={name} loading="lazy" onError={() => setFailed(true)} className={`object-cover ring-1 ring-outline-variant/40 ${className}`} />;
};

/* ==========================================================================
   4. MEMBER CARD PIECES
   ========================================================================== */

const ScoreGauge = ({ score }) => {
  const shown = useTween(score);
  const circ = 2 * Math.PI * 19;
  return (
    <div className="relative w-12 h-12 flex items-center justify-center shrink-0" role="img" aria-label={`Availability score ${score} percent`}>
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
        <circle className="text-surface-container-highest" cx="24" cy="24" r="19" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle
          className={scoreTone(score)} cx="24" cy="24" r="19" fill="none" stroke="currentColor"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - shown / 100)} strokeLinecap="round" strokeWidth="3"
        />
      </svg>
      <span className="absolute font-mono text-sm font-semibold text-on-surface tabular-nums">{Math.round(shown)}%</span>
    </div>
  );
};

// A merit badge. The proof popover opens on hover and on keyboard focus.
const BadgePill = ({ badge, popId }) => (
  <div className="group/pop relative">
    <button
      type="button" aria-describedby={badge.verificationDetail ? popId : undefined}
      className={`flex items-center gap-1 px-space-xs py-0.5 rounded bg-surface-container-high text-on-surface font-mono text-xs border border-outline-variant/20 hover:border-secondary/40 cursor-help transition-colors ${focusRing}`}
    >
      <Icon name={badge.icon} className={`text-xs ${badge.iconColor}`} />
      <span>{badge.title}</span>
      {badge.hasCheck && <Icon name="check_circle" className="text-xs text-secondary" />}
    </button>
    {badge.verificationDetail && (
      <div
        id={popId} role="tooltip"
        className="absolute bottom-full left-0 mb-2 w-64 max-w-[80vw] p-space-sm rounded-xl bg-surface-container-highest shadow-2xl backdrop-blur-2xl z-30 opacity-0 translate-y-1 pointer-events-none group-hover/pop:opacity-100 group-hover/pop:translate-y-0 group-focus-within/pop:opacity-100 group-focus-within/pop:translate-y-0 transition-all duration-200 border border-secondary/30"
      >
        <div className="flex items-center gap-1.5 text-secondary mb-1">
          <Icon name="verified" className="text-xs" />
          <span className="font-mono text-xs font-semibold">Verified proof</span>
        </div>
        <p className="text-on-surface-variant text-xs leading-snug">{badge.verificationDetail}</p>
      </div>
    )}
  </div>
);

const MemberCard = ({ member, index, query, inSquad, onToggleSquad, onInspect }) => {
  const tone = statusTone(member.statusType);
  const q = query.trim().toLowerCase();
  return (
    <SpotlightCard
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      className="tm-enter group rounded-2xl bg-surface-container-low/70 backdrop-blur-xl p-space-lg flex flex-col justify-between gap-space-md shadow-lg hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1 hover:z-20 focus-within:z-20 transition-all duration-300 border border-outline-variant/20 hover:border-primary/30"
    >
      <div className="relative flex flex-col gap-space-md">
        {/* Who */}
        <div className="flex items-start justify-between gap-space-sm">
          <div className="flex items-center gap-space-sm min-w-0">
            <div className="relative shrink-0">
              <Avatar src={member.avatar} name={member.name} className="w-14 h-14 rounded-xl shadow-md transition-transform duration-300 group-hover:scale-105" />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-surface flex items-center justify-center">
                <span className={`w-2.5 h-2.5 rounded-full ${tone.dot}`} />
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-lg font-semibold text-on-surface truncate">{member.name}</h3>
                {member.verified && <Icon name="verified" className="text-secondary text-sm shrink-0" />}
                {member.verified && <span className="sr-only">Identity verified</span>}
              </div>
              <span className="text-sm text-on-surface-variant font-medium truncate">{member.role}</span>
            </div>
          </div>
          <ScoreGauge score={member.availabilityScore} />
        </div>

        {/* Audit status */}
        <div className="flex items-center justify-between gap-2 py-1.5 px-space-sm rounded-lg bg-surface-container/60 border border-outline-variant/10">
          <span className="text-xs text-on-surface-variant">Sandbox audit</span>
          <span className={`font-mono text-xs flex items-center gap-1.5 font-medium ${tone.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${tone.dot} ${tone.pulse ? 'animate-pulse' : ''}`} />
            {member.statusText}
          </span>
        </div>

        {/* Badges */}
        {(member.meritBadges ?? []).length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-on-surface-variant">Verified badges</span>
            <div className="flex flex-wrap gap-1.5 items-center">
              {member.meritBadges.map((b, i) => <BadgePill key={i} badge={b} popId={`pop-${member.id}-${i}`} />)}
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        {/* Skills (matching the search are highlighted) */}
        <div className="flex flex-wrap gap-1 mb-space-md">
          {(member.skills ?? []).slice(0, 6).map((skill) => {
            const hit = q && skill.toLowerCase().includes(q);
            return (
              <span
                key={skill}
                className={`px-2 py-0.5 rounded-full font-mono text-xs transition-colors ${
                  hit
                    ? 'bg-secondary text-on-secondary font-semibold'
                    : HIGHLIGHT_SKILLS.includes(skill)
                      ? 'bg-surface-container-highest text-secondary'
                      : 'bg-surface-container-highest/80 text-on-surface-variant'
                }`}
              >
                {skill}
              </span>
            );
          })}
          {(member.skills ?? []).length > 6 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-surface-container-highest/80 text-on-surface-variant" title={(member.skills ?? []).slice(6).join(', ')}>
              +{member.skills.length - 6}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between pt-space-sm border-t border-outline-variant/10">
          <button type="button" onClick={() => onInspect?.(member)} className={`group/link text-secondary hover:text-secondary-fixed-dim text-sm font-semibold flex items-center gap-1 transition-colors cursor-pointer rounded ${focusRing}`}>
            <span>Inspect sandbox</span>
            <Icon name="arrow_forward" className="text-sm transition-transform duration-200 group-hover/link:translate-x-1" />
          </button>
          <button
            type="button" onClick={() => onToggleSquad(member)} aria-pressed={inSquad}
            aria-label={inSquad ? `Remove ${member.name} from squad` : `Add ${member.name} to squad`}
            title={inSquad ? 'In your squad. Click to remove' : 'Add to squad'}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-semibold transition-all active:scale-90 cursor-pointer ${focusRing} ${inSquad ? 'bg-secondary text-on-secondary' : 'hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface'}`}
          >
            <Icon name={inSquad ? 'check' : 'person_add'} className="text-lg" />
            {inSquad && <span className="tm-pop">In squad</span>}
          </button>
        </div>
      </div>
    </SpotlightCard>
  );
};

const AddCard = ({ onClick, index }) => (
  <button
    type="button" onClick={onClick} style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    className={`tm-enter group relative rounded-2xl bg-surface-container-lowest/60 backdrop-blur-xl p-space-lg flex flex-col justify-between items-center text-center shadow-lg hover:shadow-2xl hover:bg-surface-container-low hover:-translate-y-1 transition-all duration-300 cursor-pointer border border-dashed border-outline-variant/40 hover:border-secondary/60 min-h-[360px] ${focusRing}`}
  >
    <div className="w-full flex justify-end">
      <span className="px-space-xs py-0.5 rounded bg-secondary-container/20 text-secondary font-mono text-xs font-semibold">AI match</span>
    </div>
    <div className="flex flex-col items-center justify-center my-auto py-space-lg">
      <div className="w-16 h-16 rounded-2xl bg-primary-container/10 group-hover:bg-primary-container/25 group-hover:scale-110 group-hover:-rotate-3 flex items-center justify-center mb-space-md text-primary transition-all duration-300 shadow-inner">
        <Icon name="group_add" className="text-3xl" />
      </div>
      <h3 className="text-lg font-semibold text-on-surface mb-1">Add a team member</h3>
      <p className="text-sm text-on-surface-variant max-w-xs mb-space-lg leading-relaxed">
        Onboard someone from your company, or let AI find a contractor whose skills are verified in a sandbox.
      </p>
      <span className="flex items-center gap-space-xs px-space-md py-space-sm rounded-xl bg-surface-container-high group-hover:bg-surface-container-highest text-on-surface text-sm font-semibold shadow-sm transition-all border border-outline-variant/30">
        <Icon name="bolt" className="text-lg text-secondary" /> Find a match now
      </span>
    </div>
    <div className="w-full pt-space-xs text-outline font-mono text-xs flex items-center justify-center gap-1">
      <Icon name="lock" className="text-xs" /> Skills proven with zero-knowledge verification
    </div>
  </button>
);

/* ==========================================================================
   5. PAGE SECTIONS
   ========================================================================== */

const PageHeader = ({ onExport, onVerify }) => (
  <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg mb-space-xl pt-space-md">
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-sm font-medium text-secondary">
        <span className="material-symbols-outlined" style={{fontSize:'16px'}} aria-hidden="true">hub</span>
        People &amp; credentials
      </p>
      <h1
        className="font-semibold text-on-surface"
        style={{
          fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
          letterSpacing: '-0.025em',
          lineHeight: '1.15',
        }}
      >
        Team &amp; skills
      </h1>
      <p className="text-sm text-on-surface-variant max-w-xl leading-relaxed">
        Find verified people, check their sandbox audit status, and build a squad.
      </p>
    </div>
    <div className="flex items-center gap-space-sm flex-wrap">
      <button type="button" onClick={onExport} className={`flex items-center gap-space-xs px-space-md py-space-sm rounded-xl bg-surface-container-high/80 hover:bg-surface-container-highest text-on-surface text-sm font-medium backdrop-blur-md shadow-sm transition-all border border-outline-variant/20 hover:border-secondary/50 active:scale-95 cursor-pointer ${focusRing}`}>
        <Icon name="file_download" className="text-lg text-secondary" /> Export audit report
      </button>
      <button type="button" onClick={onVerify} className={`group flex items-center gap-space-xs px-space-md py-space-sm rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary text-sm font-semibold shadow-lg shadow-primary-container/20 hover:shadow-primary-container/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all cursor-pointer ${focusRing}`}>
        <Icon name="verified_user" className="text-lg transition-transform duration-300 group-hover:scale-110" /> Verify a credential
      </button>
    </div>
  </div>
);

const StatCard = ({ label, value, suffix = '', icon, tone, delay }) => {
  const shown = useTween(value, 800);
  return (
    <SpotlightCard
      style={{ animationDelay: `${delay}ms` }}
      className="tm-enter rounded-2xl bg-surface-container/70 backdrop-blur-xl border border-outline-variant/30 p-space-md shadow-md hover:border-secondary/40 hover:-translate-y-0.5 transition-all duration-300"
    >
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-xs text-on-surface-variant">{label}</span>
          <span className={`text-3xl font-semibold tabular-nums leading-tight ${tone}`}>{Math.round(shown)}{suffix}</span>
        </div>
        <div className={`w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center shadow-inner ${tone}`}>
          <Icon name={icon} />
        </div>
      </div>
    </SpotlightCard>
  );
};

const Overview = ({ members }) => {
  const stats = useMemo(() => {
    const n = members.length;
    const avg = n ? members.reduce((s, m) => s + (m.availabilityScore || 0), 0) / n : 0;
    const by = { leading: 0, optimal: 0, bench: 0 };
    members.forEach((m) => { by[statusKey(m)] += 1; });
    return { people: n, verified: members.filter((m) => m.verified).length, avg, bench: by.bench, by };
  }, [members]);
  const segs = Object.keys(STATUS_LABELS).filter((k) => stats.by[k] > 0);
  return (
    <section aria-label="Team overview" className="mb-space-xl flex flex-col gap-space-md">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-md">
        <StatCard label="People" value={stats.people} icon="groups" tone="text-on-surface" delay={0} />
        <StatCard label="Identity verified" value={stats.verified} icon="verified" tone="text-secondary" delay={70} />
        <StatCard label="Avg. availability" value={stats.avg} suffix="%" icon="speed" tone="text-primary" delay={140} />
        <StatCard label="On bench" value={stats.bench} icon="event_available" tone="text-tertiary" delay={210} />
      </div>
      {segs.length > 0 && (
        <div className="rounded-2xl bg-surface-container/50 border border-outline-variant/30 px-space-md py-space-sm">
          <div className="flex h-2 w-full gap-0.5 rounded-full overflow-hidden" role="img" aria-label={segs.map((k) => `${STATUS_LABELS[k]}: ${stats.by[k]}`).join(', ')}>
            {segs.map((k) => <div key={k} style={{ flexGrow: stats.by[k] }} className={STATUS_TONES[k].dot} />)}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-space-md gap-y-1 text-xs text-on-surface-variant">
            {segs.map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${STATUS_TONES[k].dot}`} aria-hidden="true" />
                {STATUS_LABELS[k]} <span className="tabular-nums font-medium text-on-surface">{stats.by[k]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

const Toolbar = ({ query, onQuery, searchRef, active, onActive, counts, sort, onSort, shown, total, hasFilters, onClear, onAskCopilot, grouped, onGrouped }) => (
  <div className="bg-surface-container-low/70 backdrop-blur-2xl rounded-2xl p-space-lg mb-space-lg shadow-xl border border-outline-variant/30 flex flex-col gap-space-md">
    <div className="relative w-full flex items-center">
      <Icon name="search" className="absolute left-space-md text-lg text-secondary pointer-events-none" />
      <input
        ref={searchRef} type="text" aria-label="Search people" value={query}
        onChange={(e) => onQuery(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && onQuery('')}
        placeholder="Search by name, role, skill or badge (for example: WebSockets)"
        className="w-full pl-12 pr-14 py-space-md rounded-xl bg-surface-container-lowest/80 text-on-surface placeholder:text-outline text-base shadow-inner border border-outline-variant/20 transition-all focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
      />
      {query ? (
        <button type="button" onClick={() => { onQuery(''); searchRef.current?.focus(); }} aria-label="Clear search" className={`absolute right-space-md p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high transition ${focusRing}`}>
          <Icon name="close" className="text-base" />
        </button>
      ) : (
        <kbd className="absolute right-space-md px-1.5 rounded border border-outline-variant/40 font-mono text-xs text-outline pointer-events-none" aria-hidden="true">/</kbd>
      )}
    </div>

    <div className="flex items-center gap-space-xs overflow-x-auto pb-1" role="group" aria-label="Filter by specialization">
      {FILTERS.map((chip) => {
        const on = active === chip.id;
        return (
          <button
            key={chip.id} type="button" aria-pressed={on} onClick={() => onActive(chip.id)}
            className={`flex items-center gap-1.5 px-space-md py-1.5 rounded-full font-mono text-sm whitespace-nowrap transition-all cursor-pointer active:scale-95 ${focusRing} ${on ? 'bg-secondary text-on-secondary font-semibold' : 'bg-surface-container-high/80 hover:bg-surface-container-highest text-on-surface border border-outline-variant/20'}`}
          >
            {chip.icon && <Icon name={chip.icon} className={`text-sm ${on ? 'text-on-secondary' : chip.iconColor}`} />}
            {chip.dot && <span className={`w-2 h-2 rounded-full ${chip.dot}`} />}
            <span>{chip.label}</span>
            <span className={`rounded-full px-1.5 text-xs tabular-nums ${on ? 'bg-on-secondary/15' : 'bg-surface-container-highest'}`}>{counts[chip.id]}</span>
          </button>
        );
      })}
    </div>

    <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-outline">
      <span aria-live="polite">
        Showing {shown} of {total} people
        {hasFilters && <button type="button" onClick={onClear} className={`ml-3 text-primary hover:underline rounded ${focusRing}`}>Clear filters</button>}
        {query.trim() && <button type="button" onClick={onAskCopilot} className={`ml-3 text-tertiary hover:underline rounded ${focusRing}`}>Not finding them? Ask Copilot</button>}
      </span>
      <div className="flex items-center gap-space-sm">
      <button type="button" aria-pressed={grouped} onClick={() => onGrouped(!grouped)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer active:scale-95 ${focusRing} ${grouped ? 'bg-secondary text-on-secondary' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}>
        <Icon name="view_agenda" className="text-sm" /> Group by status
      </button>
      <label className="flex items-center gap-2">
        Sort by
        <select value={sort} onChange={(e) => onSort(e.target.value)} className="rounded-lg bg-surface-container-lowest/80 border border-outline-variant/30 px-2 py-1 text-on-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-secondary">
          {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>
      </div>
    </div>
  </div>
);

const SquadTray = ({ squad, onRemove, onClear, onReview }) => (
  <div className="tm-pop mb-space-lg flex flex-wrap items-center justify-between gap-3 px-space-md py-3 rounded-2xl bg-secondary/[0.07] border border-secondary/30 backdrop-blur-xl">
    <div className="flex items-center gap-3 min-w-0">
      <span className="font-mono text-xs text-secondary font-semibold whitespace-nowrap">Your squad ({squad.length})</span>
      <div className="flex items-center -space-x-2">
        {squad.map((m) => (
          <button key={m.id} type="button" onClick={() => onRemove(m)} title={`Remove ${m.name}`} aria-label={`Remove ${m.name} from squad`} className={`rounded-full ring-2 ring-surface transition-transform hover:-translate-y-1 hover:z-10 ${focusRing}`}>
            <Avatar src={m.avatar} name={m.name} className="w-8 h-8 rounded-full" />
          </button>
        ))}
      </div>
    </div>
    <div className="flex items-center gap-space-sm">
      <button type="button" onClick={onClear} className={`font-mono text-xs text-outline hover:text-on-surface rounded ${focusRing}`}>Clear</button>
      <button type="button" onClick={onReview} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tertiary hover:bg-tertiary-fixed text-on-tertiary-fixed text-sm font-semibold transition-all active:scale-95 cursor-pointer ${focusRing}`}>
        <Icon name="auto_awesome" className="text-sm" /> Ask Copilot to review
      </button>
    </div>
  </div>
);

const EmptyState = ({ onClear, onAskCopilot, hasQuery }) => (
  <div className="tm-enter flex flex-col items-center text-center gap-3 py-16 px-4 rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container/30">
    <Icon name="person_search" className="text-4xl text-outline" />
    <h3 className="text-lg font-semibold text-on-surface">No one matches yet</h3>
    <p className="text-sm text-on-surface-variant max-w-sm">Try a different keyword or filter, or clear everything to see the whole team.</p>
    <div className="flex flex-wrap justify-center gap-2 mt-1">
      <button type="button" onClick={onClear} className={`px-space-md py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-sm font-semibold border border-outline-variant/30 active:scale-95 transition ${focusRing}`}>Clear filters</button>
      {hasQuery && (
        <button type="button" onClick={onAskCopilot} className={`px-space-md py-2 rounded-xl bg-tertiary text-on-tertiary-fixed text-sm font-semibold active:scale-95 transition ${focusRing}`}>Ask Copilot to find them</button>
      )}
    </div>
  </div>
);

const Toast = ({ message, onDismiss }) => (
  <div className="fixed left-4 right-4 sm:left-auto sm:right-8 bottom-24 z-50 flex justify-center sm:justify-end pointer-events-none" aria-live="polite">
    {message && (
      <div className="tm-pop pointer-events-auto max-w-md flex items-start gap-2 p-space-sm pr-2 rounded-xl bg-surface-container-lowest/95 backdrop-blur-xl border border-secondary/40 text-secondary text-sm font-medium shadow-2xl">
        <Icon name="check_circle" className="text-sm mt-0.5" />
        <span className="flex-1">{message}</span>
        <button type="button" onClick={onDismiss} aria-label="Dismiss message" className={`p-0.5 rounded text-outline hover:text-on-surface ${focusRing}`}><Icon name="close" className="text-sm" /></button>
      </div>
    )}
  </div>
);

const CopilotBar = ({ prompt, label, onAsk }) => (
  <div className="fixed bottom-6 left-0 right-0 px-gutter z-30 pointer-events-none flex justify-center">
    <div className="w-full max-w-3xl pointer-events-auto bg-surface-container-lowest/90 backdrop-blur-2xl p-space-sm pl-space-md rounded-2xl shadow-2xl border border-outline-variant/40 flex items-center justify-between gap-space-md transition-shadow hover:shadow-[0_0_28px_rgba(183,109,255,0.25)]">
      <button type="button" onClick={() => onAsk(prompt)} className={`flex items-center gap-space-sm flex-1 min-w-0 text-left rounded-lg cursor-pointer ${focusRing}`}>
        <span className="w-8 h-8 rounded-lg bg-tertiary-container/20 flex items-center justify-center text-tertiary shrink-0">
          <Icon name="magic_button" className="text-lg" />
        </span>
        <span className="text-on-surface text-sm truncate">{label}</span>
      </button>
      <div className="flex items-center gap-space-xs">
        <span className="hidden sm:inline font-mono text-xs text-outline">Ctrl/⌘ + Enter</span>
        <button type="button" onClick={() => onAsk(prompt)} aria-label="Send to Copilot" className={`w-10 h-10 rounded-xl bg-gradient-to-r from-primary to-secondary text-on-primary flex items-center justify-center shadow-lg shadow-secondary/20 hover:shadow-secondary/40 hover:-translate-y-0.5 active:scale-90 transition-all cursor-pointer ${focusRing}`}>
          <Icon name="arrow_upward" className="text-lg" />
        </button>
      </div>
    </div>
  </div>
);

/* ==========================================================================
   6. PAGE
   ========================================================================== */

export const TeamPage = ({
  teamMembers = [],
  onInspectSandbox,
  onOpenVerifyModal,
  onOpenInstantMatch,
  onAskCopilotQuery,
  showCopilotBar = false, // your app shell already has a global Copilot bar
}) => {
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState('all');
  const [sort, setSort] = useState('default');
  const [grouped, setGrouped] = useState(false);
  const [squadIds, setSquadIds] = useState([]);
  const searchRef = useRef(null);
  const toast = useToast();

  const ask = useCallback((text) => onAskCopilotQuery?.(text), [onAskCopilotQuery]);

  /* --- filtering, counts, sorting --- */
  const q = query.trim().toLowerCase();
  const searched = useMemo(() => teamMembers.filter((m) => matchesQuery(m, q)), [teamMembers, q]);

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, searched.filter(f.test).length])),
    [searched]
  );

  const visible = useMemo(() => {
    const rule = FILTERS.find((f) => f.id === activeTag) ?? FILTERS[0];
    const list = searched.filter(rule.test);
    if (sort === 'score-desc') list.sort((a, b) => b.availabilityScore - a.availabilityScore);
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [searched, activeTag, sort]);

  const sections = useMemo(() => {
    if (!grouped) return [{ key: 'all', title: null, items: visible }];
    return Object.keys(STATUS_LABELS)
      .map((k) => ({ key: k, title: STATUS_LABELS[k], items: visible.filter((m) => statusKey(m) === k) }))
      .filter((x) => x.items.length);
  }, [visible, grouped]);
  let running = 0;

  const hasFilters = activeTag !== 'all' || q !== '';
  const clearFilters = () => { setActiveTag('all'); setQuery(''); };

  /* --- squad --- */
  const squad = useMemo(() => teamMembers.filter((m) => squadIds.includes(m.id)), [teamMembers, squadIds]);

  const toggleSquad = useCallback(
    (member) => {
      const has = squadIds.includes(member.id);
      setSquadIds((ids) => (has ? ids.filter((id) => id !== member.id) : [...ids, member.id]));
      toast.show(has ? `${member.name} removed from your squad.` : `${member.name} added to your squad.`);
    },
    [squadIds, toast]
  );

  const reviewSquad = () => ask(`Review this squad: ${squad.map((m) => m.name).join(', ')}`);
  const askToFind = () => ask(`Find a team member: ${query.trim()}`);

  const copilotPrompt = squad.length ? `Review this squad: ${squad.map((m) => m.name).join(', ')}` : COPILOT_DEFAULT;
  const copilotLabel = squad.length ? `Ask Copilot to review your squad of ${squad.length}` : `Ask Copilot: ${COPILOT_DEFAULT}`;

  /* --- keyboard: "/" focuses search, Ctrl/Cmd+Enter asks Copilot --- */
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        ask(copilotPrompt);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ask, copilotPrompt]);

  return (
    <div className="tm-root max-w-7xl mx-auto relative isolate flex flex-col w-full pb-32">
      <style>{`
        .tm-root { font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }
        .tm-root .font-mono { font-family: inherit; }
        .tm-root h1, .tm-root h2, .tm-root h3, .tm-root h4 { letter-spacing: -0.015em; }
        @keyframes tmEnter { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes tmPop { from { opacity: 0; transform: translateY(6px) scale(.97); } to { opacity: 1; transform: none; } }
        .tm-enter { animation: tmEnter .55s cubic-bezier(.2,.7,.2,1) both; }
        .tm-pop { animation: tmPop .2s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .tm-enter, .tm-pop { animation: none !important; }
          .animate-spin, .animate-pulse { animation: none !important; }
        }
      `}</style>


      <PageHeader
        onExport={() => toast.show('Exporting the signed audit report (PDF and JSON)…')}
        onVerify={onOpenVerifyModal}
      />

      <Overview members={teamMembers} />

      <section aria-label="Team directory">
        <Toolbar
          query={query} onQuery={setQuery} searchRef={searchRef}
          active={activeTag} onActive={setActiveTag} counts={counts}
          sort={sort} onSort={setSort}
          shown={visible.length} total={teamMembers.length}
          hasFilters={hasFilters} onClear={clearFilters} onAskCopilot={askToFind}
          grouped={grouped} onGrouped={setGrouped}
        />

        {squad.length > 0 && (
          <SquadTray squad={squad} onRemove={toggleSquad} onClear={() => setSquadIds([])} onReview={reviewSquad} />
        )}

        {visible.length > 0 || !hasFilters ? (
          <div key={`${activeTag}|${sort}|${grouped}`} className="flex flex-col gap-space-xl">
            {sections.map((sec) => {
              const start = running;
              running += sec.items.length;
              return (
                <div key={sec.key}>
                  {sec.title && (
                    <div className="flex items-center gap-2 mb-space-md">
                      <span className={`w-2.5 h-2.5 rounded-full ${STATUS_TONES[sec.key].dot}`} aria-hidden="true" />
                      <h2 className="text-lg font-semibold text-on-surface">{sec.title}</h2>
                      <span className="text-xs tabular-nums rounded-full px-2 py-0.5 bg-surface-container-highest text-on-surface-variant">{sec.items.length}</span>
                      <div className="flex-1 h-px bg-outline-variant/20 ml-2" />
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-lg">
                    {sec.items.map((m, i) => (
                      <MemberCard
                        key={m.id} member={m} index={start + i} query={query}
                        inSquad={squadIds.includes(m.id)} onToggleSquad={toggleSquad} onInspect={onInspectSandbox}
                      />
                    ))}
                    {!grouped && <AddCard index={visible.length} onClick={onOpenInstantMatch} />}
                  </div>
                </div>
              );
            })}
            {grouped && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-lg">
                <AddCard index={0} onClick={onOpenInstantMatch} />
              </div>
            )}
          </div>
        ) : (
          <EmptyState onClear={clearFilters} onAskCopilot={askToFind} hasQuery={q !== ''} />
        )}
      </section>

      <Toast message={toast.message} onDismiss={toast.dismiss} />
      {showCopilotBar && <CopilotBar prompt={copilotPrompt} label={copilotLabel} onAsk={ask} />}
    </div>
  );
};