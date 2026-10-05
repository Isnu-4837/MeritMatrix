import React, { useEffect, useId, useRef, useState } from 'react';

/* ==========================================================================
   Shared pieces: one shell, one field style, one set of buttons
   ========================================================================== */

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
.md-root { font-family: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif; font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }
.md-root .font-mono { font-family: inherit; }
@keyframes md-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes md-pop { from { opacity: 0; transform: translateY(12px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes md-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.md-fade { animation: md-fade .2s ease-out both; }
.md-pop { animation: md-pop .28s cubic-bezier(.2, .8, .2, 1) both; }
.md-rise { animation: md-rise .35s ease-out backwards; animation-delay: var(--d, 0ms); }
@media (prefers-reduced-motion: reduce) { .md-fade, .md-pop, .md-rise { animation: none !important; } }
`;

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const inputCls =
  'w-full px-space-md py-2.5 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline border border-outline-variant/30 transition-all hover:border-outline-variant/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30';

const btnGhost = `px-space-md py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-medium transition-colors cursor-pointer ${focusRing}`;
const btnSolid = `px-space-md py-2 rounded-xl font-semibold shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-200 cursor-pointer ${focusRing}`;
const btnPrimary = `${btnSolid} bg-primary text-on-primary hover:bg-primary-fixed-dim`;

const Icon = ({ name, className = '' }) => (
  <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{name}</span>
);

const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="block text-sm font-medium text-on-surface mb-1.5">{label}</span>
    {children}
    {hint && <span className="block text-xs text-outline mt-1">{hint}</span>}
  </label>
);

const Footer = ({ children }) => (
  <div className="flex items-center justify-end gap-space-sm pt-space-sm border-t border-outline-variant/20 mt-2">
    {children}
  </div>
);

/* Backdrop + dialog: closes on Esc or backdrop click, locks page scroll, announces itself to screen readers. */
const ModalShell = ({ title, subtitle, icon, iconTone = 'text-primary', avatar, size = 'max-w-lg', onClose, children }) => {
  const titleId = useId();

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="md-root md-fade fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <style>{STYLES}</style>
      <div
        role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={`md-pop w-full ${size} max-h-[90vh] overflow-y-auto rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-2xl p-space-lg flex flex-col gap-space-md`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-outline-variant/20 pb-space-sm">
          <div className="flex items-center gap-3 min-w-0">
            {avatar ? (
              <img src={avatar.src} alt={avatar.alt} className="w-10 h-10 rounded-xl object-cover ring-2 ring-outline-variant/40" />
            ) : (
              <span className={`inline-flex p-2 rounded-xl bg-surface-container-high ${iconTone}`}>
                <Icon name={icon} className="text-headline-sm" />
              </span>
            )}
            <div className="min-w-0">
              <h2 id={titleId} className="font-semibold text-headline-sm text-on-surface truncate">{title}</h2>
              {subtitle && <p className="text-xs text-on-surface-variant truncate">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button" onClick={onClose} aria-label="Close"
            className={`p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high hover:rotate-90 transition-all duration-200 cursor-pointer ${focusRing}`}
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

const PROJECT_STATUSES = ['Planning', 'In Progress', 'QA Review', 'Ready for Staging'];
const PRIORITIES = ['High', 'Critical', 'Medium', 'Low'];

export const NewProjectModal = ({ isOpen, onClose, onAddProject }) => {
  const [title, setTitle] = useState('');
  const [code, setCode] = useState(newCode);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('Planning');
  const [dueDate, setDueDate] = useState('Nov 20');
  const [priority, setPriority] = useState('High');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

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
    // Start fresh next time the dialog opens.
    setTitle('');
    setDescription('');
    setCode(newCode());
    onClose();
  };

  return (
    <ModalShell title="Create a new project" subtitle="Add a workstream to Sprint 14" icon="add_circle" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-space-sm text-body-sm">
        <Field label="Project name">
          <input autoFocus required type="text" placeholder="e.g. Distributed Vector Indexer"
            value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
          <Field label="Project code">
            <input type="text" value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Due date">
            <input type="text" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <Field label="Description" hint="Optional. Describe deliverables, specifications or system APIs.">
          <textarea rows={3} placeholder="What does this project need to deliver?"
            value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} resize-none`} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
          <Field label="Starting status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </div>

        <Footer>
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="submit" className={btnPrimary}>Create project</button>
        </Footer>
      </form>
    </ModalShell>
  );
};

/* ==========================================================================
   Quick task
   ========================================================================== */

const WORKSTREAMS = ['Kinetic UI Token Library', 'Realtime Multi-Agent Orchestrator', 'Hyperion Client Portal', 'Zero-Trust Access Control'];
const ASSIGNEES = [
  { value: 'Elena Vance', label: 'Elena Vance' },
  { value: 'Marcus Chen', label: 'Marcus Chen' },
  { value: 'Sophia Patel', label: 'Sophia Patel (on bench)' },
  { value: 'David Kim', label: 'David Kim' },
  { value: 'Aria Montgomery', label: 'Aria Montgomery' },
];

export const QuickTaskModal = ({ isOpen, onClose, onAddTask }) => {
  const [taskName, setTaskName] = useState('');
  const [workstream, setWorkstream] = useState(WORKSTREAMS[0]);
  const [hours, setHours] = useState('8h');
  const [assignee, setAssignee] = useState('Elena Vance');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!taskName.trim()) return;
    if (onAddTask) onAddTask({ taskName, workstream, hours, assignee });
    setTaskName('');
    onClose();
  };

  return (
    <ModalShell title="Quick task" subtitle="Add a task without opening a project" icon="add_task" iconTone="text-secondary" size="max-w-md" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-space-sm text-body-sm">
        <Field label="Task title">
          <input autoFocus required type="text" placeholder="e.g. Optimize WebGL shader uniform buffers"
            value={taskName} onChange={(e) => setTaskName(e.target.value)} className={inputCls} />
        </Field>

        <Field label="Project">
          <select value={workstream} onChange={(e) => setWorkstream(e.target.value)} className={inputCls}>
            {WORKSTREAMS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
          <Field label="Assigned to">
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={inputCls}>
              {ASSIGNEES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </Field>
          <Field label="Estimated hours">
            <input type="text" value={hours} onChange={(e) => setHours(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <Footer>
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="submit" className={`${btnSolid} bg-secondary text-on-secondary`}>Add to Sprint 14</button>
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

const PLAN_STEPS = [
  { title: 'Resolve Marcus Chen’s double-booking', tag: 'Shift 16h', tone: 'text-secondary', body: 'Reassign Hyperion Client Portal sprint finish to Sophia Patel, who is on the bench.' },
  { title: 'Fast-track Kinetic UI 3D shaders', tag: 'Week 2 milestone', tone: 'text-primary', body: 'Keep Marcus at 32h per week on token generation and shader integration.' },
  { title: 'Zero-Trust gateway auditing', tag: 'M4 release', tone: 'text-tertiary', body: 'Elena Vance delivers the architecture milestone on day 14.' },
];

export const GenerateSprintModal = ({ isOpen, onClose, onApplyPlan }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [planGenerated, setPlanGenerated] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!isOpen) return null;

  const handleRunAI = () => {
    setIsGenerating(true);
    timer.current = setTimeout(() => {
      setIsGenerating(false);
      setPlanGenerated(true);
    }, 1200);
  };

  const handleClose = () => {
    clearTimeout(timer.current);
    setIsGenerating(false);
    setPlanGenerated(false);
    onClose();
  };

  return (
    <ModalShell title="Generate sprint plan" subtitle="AI-assisted planning for Sprint 15" icon="auto_awesome" iconTone="text-tertiary" size="max-w-xl" onClose={handleClose}>
      {!planGenerated ? (
        <div className="flex flex-col gap-space-md">
          <p className="text-body-sm text-on-surface-variant leading-relaxed">
            The AI looks at active projects, verified skills, your current velocity (94.2 pts) and team time zones to draft a balanced plan for Sprint 15.
          </p>

          <div className="p-space-md rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2.5">
            <h3 className="text-sm font-semibold text-on-surface">Planning limits</h3>
            {CONSTRAINTS.map((c) => (
              <div key={c.label} className="flex items-center justify-between text-body-sm">
                <span className="text-on-surface-variant">{c.label}</span>
                <span className={`font-medium ${c.tone}`}>{c.value}</span>
              </div>
            ))}
          </div>

          <Footer>
            <button type="button" onClick={handleClose} className={btnGhost}>Cancel</button>
            <button type="button" disabled={isGenerating} onClick={handleRunAI}
              className={`${btnPrimary} flex items-center gap-2 disabled:opacity-70 disabled:cursor-wait disabled:hover:translate-y-0`}>
              <Icon name={isGenerating ? 'progress_activity' : 'auto_awesome'} className={`text-base ${isGenerating ? 'animate-spin motion-reduce:animate-none' : ''}`} />
              <span>{isGenerating ? 'Building your plan…' : 'Generate plan'}</span>
            </button>
          </Footer>
        </div>
      ) : (
        <div className="flex flex-col gap-space-md">
          <div className="md-rise flex items-center justify-between gap-2 p-space-sm rounded-xl bg-secondary/10 border border-secondary/30">
            <span className="text-sm text-secondary font-semibold flex items-center gap-1.5">
              <Icon name="verified" className="text-base" />
              Plan ready: 99.4% capacity balance
            </span>
            <span className="text-xs text-on-surface-variant">Confidence: high</span>
          </div>

          <ol className="flex flex-col gap-2 max-h-60 overflow-y-auto">
            {PLAN_STEPS.map((step, i) => (
              <li key={step.title} style={{ '--d': `${80 + i * 80}ms` }} className="md-rise p-3 rounded-xl bg-surface-container-low border border-outline-variant/20">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-body-sm font-semibold text-on-surface">{i + 1}. {step.title}</span>
                  <span className={`text-xs font-medium whitespace-nowrap ${step.tone}`}>{step.tag}</span>
                </div>
                <p className="text-xs text-on-surface-variant">{step.body}</p>
              </li>
            ))}
          </ol>

          <Footer>
            <button type="button" onClick={() => setPlanGenerated(false)} className={btnGhost}>Adjust and regenerate</button>
            <button type="button" onClick={() => { if (onApplyPlan) onApplyPlan(); handleClose(); }} className={btnPrimary}>
              Apply plan to sprint
            </button>
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
  if (!isOpen || !member) return null;
  const hash = member.sandboxHash || '0x8f2d...93b';
  const stats = [
    { label: 'Audit baseline', value: '120 FPS', tone: 'text-secondary' },
    { label: 'Test coverage', value: '98.6%', tone: 'text-tertiary' },
    { label: 'Reliability', value: `${member.availabilityScore}%`, tone: 'text-primary' },
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
      avatar={{ src: member.avatar, alt: member.name }} size="max-w-xl" onClose={onClose}
    >
      <div className="flex flex-col gap-space-sm text-body-sm">
        <div className="grid grid-cols-3 gap-2">
          {stats.map((s, i) => (
            <div key={s.label} style={{ '--d': `${i * 70}ms` }} className="md-rise p-3 rounded-xl bg-surface-container-low text-center">
              <span className="text-xs text-on-surface-variant block">{s.label}</span>
              <span className={`text-headline-sm font-semibold ${s.tone}`}>{s.value}</span>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-surface-container-high/50 p-space-sm flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-secondary">Latest sandbox run</h3>
          <ul className="bg-surface-container-lowest p-2.5 rounded-lg text-xs text-on-surface-variant space-y-1">
            {log.map((line) => (
              <li key={line} className="flex gap-2"><Icon name="check" className="text-sm text-secondary shrink-0" />{line}</li>
            ))}
          </ul>
        </div>

        {(member.meritBadges || []).length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-on-surface mb-1.5">Verified badges</h3>
            <div className="flex flex-wrap gap-1.5">
              {member.meritBadges.map((b, i) => (
                <span key={i} className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface text-xs flex items-center gap-1.5">
                  <Icon name="shield" className="text-sm text-secondary" />
                  {b.title}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <Footer>
        <button type="button" onClick={onClose} className={`${btnSolid} bg-surface-container-high text-on-surface hover:bg-surface-container-highest`}>Close</button>
      </Footer>
    </ModalShell>
  );
};


/* ==========================================================================
   Command Palette (The missing piece)
   ========================================================================== */

export const CommandPalette = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <ModalShell title="Command Palette" subtitle="Search and quick actions" icon="terminal" size="max-w-2xl" onClose={onClose}>
      <div className="flex flex-col gap-space-sm">
        <Field label="Search">
          <input autoFocus type="text" placeholder="Search projects, tasks, or settings..." className={inputCls} />
        </Field>
        <div className="text-body-sm text-on-surface-variant mt-4 text-center py-8">
          Start typing to see available commands or search results.
        </div>
      </div>
    </ModalShell>
  );
};

export default CommandPalette;