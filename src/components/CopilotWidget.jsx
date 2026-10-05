import React, { useCallback, useEffect, useRef, useState } from 'react';

/* ==========================================================================
   CopilotWidget
   --------------------------------------------------------------------------
   Idle: one small glowing orb in the corner.
   Click it and the orb itself expands into the chat panel (a clip-path morph
   from a circle to the full panel, with the orb's colours fading out as the
   content staggers in). Closing collapses the panel back into the orb.

     orb      slow-orbiting colour ring, breathing aura, twinkling spark, leans
              toward the cursor, label + shortcut on hover, ping when there are
              unread replies, turns red while a voice session is live
     panel    morph open/close, drifting aurora behind the header that speeds up
              while Copilot is busy, cursor-following light, gradient focus glow
              on the input, send icon that flies off, expand/shrink toggle
     replies  streamed text, avatar, copy with tick, thumbs up/down,
              action buttons (loading -> done)
     keys     Ctrl/Cmd + / toggles Copilot, Esc closes
   ========================================================================== */

const STYLES = `
.cw-root { -webkit-font-smoothing: antialiased; }
.cw-root .font-mono { font-family: inherit; }

@keyframes cw-expand { from { clip-path: inset(calc(100% - 56px) 0 0 calc(100% - 56px) round 28px); } to { clip-path: inset(0 0 0 0 round 24px); } }
@keyframes cw-collapse { from { clip-path: inset(0 0 0 0 round 24px); } to { clip-path: inset(calc(100% - 56px) 0 0 calc(100% - 56px) round 28px); } }
@keyframes cw-skin-out { 0%, 22% { opacity: 1; } 100% { opacity: 0; } }
@keyframes cw-skin-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes cw-shadow { from { opacity: 0; } to { opacity: 1; } }
@keyframes cw-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@keyframes cw-msg { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes cw-dot { 0%, 80%, 100% { transform: translateY(0); opacity: .4; } 40% { transform: translateY(-4px); opacity: 1; } }
@keyframes cw-wave { 0%, 100% { transform: scaleY(.25); } 50% { transform: scaleY(1); } }
@keyframes cw-ring { 0% { box-shadow: 0 0 0 0 rgba(255,120,110,.5); } 100% { box-shadow: 0 0 0 10px rgba(255,120,110,0); } }
@keyframes cw-pop { 0% { transform: scale(0); } 70% { transform: scale(1.25); } 100% { transform: scale(1); } }
@keyframes cw-orb-in { 0% { transform: scale(.4); opacity: 0; } 70% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
@keyframes cw-breathe { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
@keyframes cw-flow { from { background-position: 0% 50%; } to { background-position: 200% 50%; } }
@keyframes cw-nudge { from { opacity: 0; transform: translateY(10px) scale(.95); } to { opacity: 1; transform: none; } }
@keyframes cw-spin { to { transform: rotate(360deg); } }
@keyframes cw-orbit { to { transform: rotate(360deg); } }
@keyframes cw-aura { 0%, 100% { opacity: .55; transform: scale(1); } 50% { opacity: .95; transform: scale(1.12); } }
@keyframes cw-ping { 0% { transform: scale(1); opacity: .6; } 100% { transform: scale(1.9); opacity: 0; } }
@keyframes cw-twinkle { 0%, 100% { transform: scale(1) rotate(0); } 50% { transform: scale(1.12) rotate(10deg); } }
@keyframes cw-drift-a { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(44px, 14px) scale(1.2); } }
@keyframes cw-drift-b { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-38px, 20px) scale(1.15); } }
@keyframes cw-drift-c { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(22px, -10px) scale(1.25); } }
@keyframes cw-fly { 0% { transform: none; opacity: 1; } 45% { transform: translateY(-14px); opacity: 0; } 55% { transform: translateY(14px); opacity: 0; } 100% { transform: none; opacity: 1; } }
@keyframes cw-line { from { transform: scaleX(0); } to { transform: scaleX(1); } }

.cw-expand { animation: cw-expand .55s cubic-bezier(.2, .85, .25, 1) both; }
.cw-collapse { animation: cw-collapse .34s cubic-bezier(.55, 0, .75, .25) both; }
.cw-skin-out { animation: cw-skin-out .5s ease-out both; }
.cw-skin-in { animation: cw-skin-in .22s ease-in .1s both; }
.cw-shadow { animation: cw-shadow .35s ease-out .15s both; }
.cw-rise { animation: cw-rise .45s cubic-bezier(.2, .8, .2, 1) backwards; animation-delay: var(--d, 0ms); }
.cw-msg { animation: cw-msg .3s ease-out both; }
.cw-dot { animation: cw-dot 1.2s ease-in-out infinite; }
.cw-wave { transform-origin: center; animation: cw-wave .9s ease-in-out infinite; }
.cw-ring { animation: cw-ring 1.4s ease-out infinite; }
.cw-pop { animation: cw-pop .3s cubic-bezier(.2, .9, .3, 1.3) both; }
.cw-orb-in { animation: cw-orb-in .45s cubic-bezier(.2, .9, .3, 1.2) both; }
.cw-breathe { animation: cw-breathe 2.4s ease-in-out infinite; }
.cw-flow { background-size: 200% 100%; animation: cw-flow 1.6s linear infinite; }
.cw-nudge { animation: cw-nudge .35s cubic-bezier(.2, .9, .25, 1.1) both; }
.cw-spin { animation: cw-spin .8s linear infinite; }
.cw-orbit { animation: cw-orbit 6s linear infinite; }
.cw-aura { animation: cw-aura 3.2s ease-in-out infinite; }
.cw-ping { animation: cw-ping 1.8s ease-out infinite; }
.cw-twinkle { animation: cw-twinkle 3.2s ease-in-out infinite; }
.cw-drift-a { animation: cw-drift-a 11s ease-in-out infinite; }
.cw-drift-b { animation: cw-drift-b 13s ease-in-out infinite; }
.cw-drift-c { animation: cw-drift-c 9s ease-in-out infinite; }
.cw-busy .cw-drift-a { animation-duration: 4.5s; }
.cw-busy .cw-drift-b { animation-duration: 5.5s; }
.cw-busy .cw-drift-c { animation-duration: 3.8s; }
.cw-fly { animation: cw-fly .45s ease-in-out both; }
.cw-line { transform-origin: left; animation: cw-line .7s cubic-bezier(.2, .8, .2, 1) .25s both; }
.cw-mag { transform: translate(var(--tx, 0px), var(--ty, 0px)); transition: transform .25s cubic-bezier(.2, .8, .2, 1); }
.cw-spot { background: radial-gradient(260px circle at var(--mx, 70%) var(--my, 10%), color-mix(in srgb, currentColor 11%, transparent), transparent 70%); }
.cw-press { transition: transform .15s ease, box-shadow .2s ease, background-color .2s ease, opacity .2s ease; }
.cw-press:active:not(:disabled) { transform: scale(.93); }

@media (prefers-reduced-motion: reduce) {
  .cw-expand, .cw-collapse, .cw-shadow, .cw-rise, .cw-msg, .cw-dot, .cw-wave, .cw-ring, .cw-pop, .cw-orb-in, .cw-breathe, .cw-flow, .cw-nudge,
  .cw-orbit, .cw-aura, .cw-ping, .cw-twinkle, .cw-drift-a, .cw-drift-b, .cw-drift-c, .cw-fly, .cw-line { animation: none !important; }
  .cw-skin-out, .cw-skin-in { display: none; }
  .cw-press, .cw-mag { transition: none; }
}
`;

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary';

const QUICK_PROMPTS = [
  { label: 'Resolve clash', icon: 'tune', prompt: "How can I resolve Marcus Chen's sprint clash?" },
  { label: 'Streaming squad', icon: 'groups', prompt: 'Recommend a 3-person squad for High-Throughput Streaming Engine' },
  { label: 'Sprint summary', icon: 'monitoring', prompt: 'Summarize Sprint 14 velocity and remaining capacity' },
];

const PLACEHOLDERS = ['Message Meri…', 'Try “Who is overbooked?”', 'Try “Summarize Sprint 14”'];

const GREETING =
  'Meri is ready. I monitor Sprint 14 telemetry, verified skills and resource allocation. How can I help?';

const NUDGE = { text: 'Marcus Chen is 16h over capacity', cta: 'Resolve', prompt: "How can I resolve Marcus Chen's sprint clash?" };

const CLOSE_MS = 340;

/* ---------- helpers & hooks ---------- */

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const Icon = ({ name, className = '', filled = false }) => (
  <span className={`material-symbols-outlined ${className}`} style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined} aria-hidden="true">{name}</span>
);

// Re-renders every `ms` so relative timestamps stay fresh.
const useNow = (ms = 30000) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
};

const timeAgo = (ts, now) => {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'Just now';
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

// Reveals text a few characters at a time.
const useTypewriter = (text, enabled) => {
  const [n, setN] = useState(enabled && !reducedMotion() ? 0 : text.length);
  useEffect(() => {
    if (!enabled || reducedMotion()) { setN(text.length); return undefined; }
    let i = 0;
    const id = setInterval(() => {
      i = Math.min(i + 2, text.length);
      setN(i);
      if (i >= text.length) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [text, enabled]);
  return n;
};

const fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/* ---------- reply pieces ---------- */

// Action button: idle -> working -> done, then stays done.
const ActionButton = ({ act }) => {
  const [state, setState] = useState('idle');
  const run = () => {
    if (state !== 'idle') return;
    setState('working');
    setTimeout(() => { act.action(); setState('done'); }, reducedMotion() ? 0 : 650);
  };
  return (
    <button
      type="button" onClick={run} disabled={state !== 'idle'}
      className={`cw-press inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:cursor-default ${focusRing} ${
        state === 'done' ? 'bg-secondary/15 text-secondary border border-secondary/30' : 'bg-gradient-to-r from-secondary to-primary text-on-secondary hover:shadow-md hover:-translate-y-0.5'
      }`}
    >
      {state === 'working' && <Icon name="progress_activity" className="cw-spin text-sm" />}
      {state === 'done' && <Icon name="check" className="cw-pop text-sm" />}
      {state === 'done' ? 'Done' : state === 'working' ? 'Working…' : act.label}
    </button>
  );
};

const Message = ({ m, now, onGrow, onFeedback }) => {
  const isUser = m.sender === 'user';
  const n = useTypewriter(m.text, !!m.fresh && !isUser);
  const done = n >= m.text.length;
  const [copied, setCopied] = useState(false);
  useEffect(() => { onGrow(); }, [n]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async () => {
    try { await navigator.clipboard.writeText(m.text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  return (
    <div className={`cw-msg group flex items-end gap-2 max-w-[92%] ${isUser ? 'ml-auto' : 'mr-auto'}`}>
      {!isUser && (
        <span className="mb-5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-on-primary shadow-sm" aria-hidden="true">
          <Icon name="auto_awesome" filled className="text-[13px]" />
        </span>
      )}
      <div className={`flex min-w-0 flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`px-3 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
          isUser
            ? 'bg-gradient-to-br from-primary to-secondary text-on-primary rounded-br-md shadow-sm'
            : 'bg-surface-container-high/80 text-on-surface border border-outline-variant/20 rounded-bl-md'
        }`}>
          {m.text.slice(0, n)}
          {!done && <span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle bg-secondary cw-breathe" aria-hidden="true" />}
        </div>

        {done && m.actions && (
          <div className="cw-msg mt-2 flex flex-wrap gap-1.5">
            {m.actions.map((act) => <ActionButton key={act.label} act={act} />)}
          </div>
        )}

        <div className="mt-1 px-1 flex items-center gap-1 text-xs text-outline">
          <span>{timeAgo(m.ts, now)}</span>
          {!isUser && done && m.id !== 'm0' && (
            <span className="flex items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
              <button type="button" onClick={copy} aria-label="Copy reply" className={`cw-press p-1 rounded hover:text-on-surface ${focusRing}`}>
                <Icon name={copied ? 'check' : 'content_copy'} className={`text-sm ${copied ? 'cw-pop text-secondary' : ''}`} />
              </button>
              {['up', 'down'].map((k) => (
                <button
                  key={k} type="button" onClick={() => onFeedback(m.id, m.fb === k ? null : k)} aria-pressed={m.fb === k}
                  aria-label={k === 'up' ? 'Good reply' : 'Bad reply'}
                  className={`cw-press p-1 rounded hover:text-on-surface ${focusRing} ${m.fb === k ? 'text-secondary' : ''}`}
                >
                  <Icon name={k === 'up' ? 'thumb_up' : 'thumb_down'} className={`text-sm ${m.fb === k ? 'cw-pop' : ''}`} />
                </button>
              ))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------- widget ---------- */

export const CopilotWidget = ({ onAutoReallocate, onNavigateToSprints, onNavigateToTeam }) => {
  const [open, setOpen] = useState(false); // logical state
  const [mounted, setMounted] = useState(false); // stays true during the collapse animation
  const [wide, setWide] = useState(false);
  const [inputText, setInputText] = useState('');
  const [phIndex, setPhIndex] = useState(0);
  const [sendKey, setSendKey] = useState(0);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceSecs, setVoiceSecs] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [nudge, setNudge] = useState('idle'); // idle | show | dismissed
  const [unread, setUnread] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [messages, setMessages] = useState([{ id: 'm0', sender: 'assistant', text: GREETING, ts: Date.now() }]);

  const now = useNow();
  const counter = useRef(0);
  const timers = useRef([]);
  const closeTimer = useRef(null);
  const clearTimer = useRef(null);
  const listRef = useRef(null);
  const atBottom = useRef(true);
  const taRef = useRef(null);
  const prevLen = useRef(1);
  const orbBtn = useRef(null);
  const orbRef = useRef(null);
  const panelRef = useRef(null);

  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t); return t; };
  const addMessage = (msg) => setMessages((prev) => [...prev, { id: `m${++counter.current}`, ts: Date.now(), ...msg }]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); clearTimeout(closeTimer.current); clearTimeout(clearTimer.current); }, []);

  const openDrawer = useCallback(() => {
    clearTimeout(closeTimer.current);
    setMounted(true); setOpen(true); setUnread(0); setNudge('dismissed');
  }, []);
  const closeDrawer = useCallback(() => {
    setOpen(false);
    clearTimeout(closeTimer.current);
    const hadFocus = !!(panelRef.current && panelRef.current.contains(document.activeElement));
    closeTimer.current = setTimeout(() => {
      setMounted(false);
      // Hand focus back to the orb so keyboard users do not lose their place.
      if (hadFocus) requestAnimationFrame(() => orbBtn.current && orbBtn.current.focus({ preventScroll: true }));
    }, reducedMotion() ? 0 : CLOSE_MS);
  }, []);

  /* ---- orb: leans toward the cursor ---- */
  const onOrbMove = (e) => {
    const el = orbRef.current;
    if (!el || reducedMotion()) return;
    const r = e.currentTarget.getBoundingClientRect();
    const clamp = (v) => Math.max(-5, Math.min(5, v));
    el.style.setProperty('--tx', `${clamp((e.clientX - (r.left + r.width / 2)) * 0.25)}px`);
    el.style.setProperty('--ty', `${clamp((e.clientY - (r.top + r.height / 2)) * 0.25)}px`);
  };
  const onOrbLeave = () => {
    const el = orbRef.current;
    if (!el) return;
    el.style.setProperty('--tx', '0px');
    el.style.setProperty('--ty', '0px');
  };

  /* ---- panel: cursor-following light ---- */
  const onPanelMove = (e) => {
    const el = panelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  /* ---- scrolling ---- */
  const scrollToEnd = useCallback((smooth = true) => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
  }, []);
  const onScroll = () => {
    const el = listRef.current;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    atBottom.current = near;
    setShowJump(!near);
  };
  const onGrow = useCallback(() => { if (atBottom.current) scrollToEnd(false); }, [scrollToEnd]);
  useEffect(() => { if (atBottom.current) scrollToEnd(); }, [messages, isAnalyzing, isVoiceActive, open, scrollToEnd]);

  /* ---- drawer lifecycle ---- */
  useEffect(() => {
    if (!open) return undefined;
    taRef.current && taRef.current.focus();
    const onKey = (e) => e.key === 'Escape' && closeDrawer();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeDrawer]);

  // Ctrl/Cmd + / toggles Copilot from anywhere.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); open ? closeDrawer() : openDrawer(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, openDrawer, closeDrawer]);

  // Unread badge for replies that land while the drawer is closed.
  useEffect(() => {
    if (messages.length > prevLen.current && !open && messages[messages.length - 1].sender === 'assistant') setUnread((u) => u + 1);
    prevLen.current = messages.length;
  }, [messages, open]);

  // One proactive nudge, a few seconds after load.
  useEffect(() => {
    if (open || nudge !== 'idle') return undefined;
    const t = setTimeout(() => setNudge('show'), 7000);
    return () => clearTimeout(t);
  }, [open, nudge]);

  // Rotate the input placeholder while the panel is open and empty.
  useEffect(() => {
    if (!open || inputText || reducedMotion()) return undefined;
    const id = setInterval(() => setPhIndex((i) => (i + 1) % PLACEHOLDERS.length), 4000);
    return () => clearInterval(id);
  }, [inputText, open]);

  // Auto-growing textarea.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [inputText, mounted]);

  // Voice clock.
  useEffect(() => {
    if (!isVoiceActive) { setVoiceSecs(0); return undefined; }
    const id = setInterval(() => setVoiceSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isVoiceActive]);

  /* ---- actions & replies ---- */
  const reallocate = (doneText) => ({
    label: 'Auto-reallocate to bench',
    action: () => {
      if (onAutoReallocate) onAutoReallocate();
      addMessage({ sender: 'assistant', text: doneText, fresh: true });
    },
  });

  const voiceTimer = useRef(null);
  const toggleVoiceMode = () => {
    if (isVoiceActive) { clearTimeout(voiceTimer.current); setIsVoiceActive(false); return; }
    setIsVoiceActive(true);
    openDrawer();
    addMessage({ sender: 'assistant', text: 'Voice session started. Ask about sprint capacity or rebalancing work.', fresh: true });
    voiceTimer.current = later(() => {
      addMessage({
        sender: 'assistant', fresh: true,
        text: 'I heard: “Are there any overallocated engineers in Sprint 14?”\n\nYes. Marcus Chen is double-booked at 56h across Kinetic UI and Client Portal. I can move the overflow to the bench.',
        actions: [reallocate('Done: 16h reallocated to Sophia Patel. Marcus Chen is now at 40h per week.')],
      });
      setIsVoiceActive(false);
    }, 3500);
  };

  const buildReply = (text) => {
    const lower = text.toLowerCase();
    if (['marcus', 'clash', 'conflict', 'rebalance', 'overbooked'].some((w) => lower.includes(w))) {
      return {
        text: 'Marcus Chen is booked 56h per week, 16h over capacity, across Kinetic UI Token Library and Hyperion Client Portal. Sophia Patel is on the bench with 15h free. Shall I move the Hyperion finishing tasks to her?',
        actions: [reallocate('Done: 16h of Hyperion Client Portal work moved to Sophia Patel. Marcus Chen is now at 40h per week (optimal) with no conflicts.')],
      };
    }
    if (['squad', 'stream', '3-person'].some((w) => lower.includes(w))) {
      return {
        text: 'Based on verified sandbox benchmarks, I recommend this squad for the High-Throughput Streaming Engine:\n\n1. Elena Vance: lead architect (Go, gRPC, distributed queues)\n2. Marcus Chen: WebGL and WebSocket streaming (120 FPS audited)\n3. Sophia Patel: vector pipeline and PyTorch GPU acceleration\n\nCombined latency target: under 12ms p99 with zero-trust session compliance.',
        actions: [{ label: 'View in team matrix', action: () => { onNavigateToTeam && onNavigateToTeam(); closeDrawer(); } }],
      };
    }
    if (['sprint', 'plan', 'summar'].some((w) => lower.includes(w))) {
      return {
        text: 'Sprint 14 is 84% on schedule at day 9 of 14. Velocity is 94.2 pts (+6.4) and team capacity is 98% used, with 4 days left. 5 workstreams are active and 1 conflict is in review.',
        actions: [{ label: 'Open allocation timeline', action: () => { onNavigateToSprints && onNavigateToSprints(); closeDrawer(); } }],
      };
    }
    return { text: `I checked the workspace for “${text}”. All verification checks pass and TPU usage is 78% (784 of 1,000 hours). Which sprint or talent details would you like to adjust?` };
  };

  const handleSend = (textToSend) => {
    const text = (typeof textToSend === 'string' ? textToSend : inputText).trim();
    if (!text || isAnalyzing) return;
    atBottom.current = true;
    addMessage({ sender: 'user', text });
    setInputText('');
    setSendKey((k) => k + 1);
    setIsAnalyzing(true);
    openDrawer();
    later(() => {
      addMessage({ sender: 'assistant', fresh: true, ...buildReply(text) });
      setIsAnalyzing(false);
    }, 1000);
  };

  const onFeedback = (id, fb) => setMessages((p) => p.map((m) => (m.id === id ? { ...m, fb } : m)));

  const clearChat = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => setConfirmClear(false), 2500);
      return;
    }
    setConfirmClear(false);
    setMessages([{ id: 'm0', sender: 'assistant', text: GREETING, ts: Date.now() }]);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const canSend = inputText.trim().length > 0 && !isAnalyzing;
  const busy = isAnalyzing || isVoiceActive;
  const status = isVoiceActive ? 'Listening…' : isAnalyzing ? 'Thinking…' : 'Online';
  const statusDot = isVoiceActive ? 'bg-error' : isAnalyzing ? 'bg-tertiary' : 'bg-secondary';
  const hasUserMsg = messages.some((m) => m.sender === 'user');

  return (
    <div className="cw-root">
      <style>{STYLES}</style>

      {/* Proactive nudge */}
      {nudge === 'show' && !mounted && (
        <div className="cw-nudge fixed bottom-24 right-4 sm:right-8 z-50 flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-2xl bg-surface-container-lowest/95 backdrop-blur-xl border border-tertiary/40 shadow-xl">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="cw-breathe absolute inline-flex h-full w-full rounded-full bg-tertiary" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-tertiary" />
          </span>
          <span className="text-sm text-on-surface">{NUDGE.text}</span>
          <button type="button" onClick={() => { openDrawer(); handleSend(NUDGE.prompt); }} className={`cw-press px-2.5 py-1 rounded-full bg-tertiary text-on-tertiary-fixed text-xs font-semibold hover:brightness-110 cursor-pointer ${focusRing}`}>
            {NUDGE.cta}
          </button>
          <button type="button" onClick={() => setNudge('dismissed')} aria-label="Dismiss suggestion" className={`cw-press p-1 rounded-full text-outline hover:text-on-surface hover:bg-surface-container-high cursor-pointer ${focusRing}`}>
            <Icon name="close" className="text-sm" />
          </button>
        </div>
      )}

      {/* The orb: the only thing on screen while Copilot is closed */}
      {!mounted && (
        <div className="fixed bottom-6 right-4 sm:right-8 z-50">
          <button
            ref={orbBtn} type="button" onClick={openDrawer}
            onPointerMove={onOrbMove} onPointerLeave={onOrbLeave}
            aria-haspopup="dialog" aria-expanded={false} aria-keyshortcuts="Control+/"
            aria-label={unread ? `Open Meri, ${unread} new ${unread === 1 ? 'reply' : 'replies'}` : 'Open Meri'}
            className={`cw-orb-in group relative block h-14 w-14 rounded-full cursor-pointer ${focusRing}`}
          >
            <span ref={orbRef} className="cw-mag block h-full w-full">
              {/* breathing aura */}
              <span
                aria-hidden="true"
                className={`cw-aura absolute -inset-3 rounded-full blur-xl ${isVoiceActive ? 'bg-error/60' : 'bg-gradient-to-tr from-primary/50 via-secondary/50 to-tertiary/50'}`}
              />
              {unread > 0 && <span aria-hidden="true" className="cw-ping absolute inset-0 rounded-full bg-error/40" />}

              {/* orbiting colour ring */}
              <span aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-full shadow-lg">
                <span className={`cw-orbit absolute inset-0 ${isVoiceActive ? 'bg-error' : 'bg-gradient-to-tr from-primary via-secondary to-tertiary'}`} />
              </span>

              {/* body */}
              <span
                className={`absolute inset-[3px] flex items-center justify-center rounded-full shadow-inner transition-transform duration-300 group-hover:scale-105 group-active:scale-95 ${
                  isVoiceActive ? 'bg-error text-on-error' : 'bg-gradient-to-br from-primary-container to-secondary-container text-on-primary-container'
                }`}
              >
                <span className="cw-twinkle flex">
                  <Icon name={isVoiceActive ? 'mic' : 'auto_awesome'} filled className="text-2xl transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                </span>
              </span>

              {unread > 0 && (
                <span key={unread} className="cw-pop absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-on-error text-[11px] font-semibold flex items-center justify-center ring-2 ring-surface">
                  {unread}
                </span>
              )}

              {/* label that slides out on hover */}
              <span
                role="tooltip"
                className="pointer-events-none absolute right-full top-1/2 mr-4 flex -translate-y-1/2 translate-x-2 items-center gap-1.5 whitespace-nowrap rounded-full border border-outline-variant/40 bg-surface-container-lowest/95 px-3.5 py-1.5 text-sm font-medium text-on-surface opacity-0 shadow-lg backdrop-blur-xl transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
              >
                {isVoiceActive ? 'Listening…' : 'Ask Meri'}
                <kbd className="rounded border border-outline-variant/40 px-1.5 text-[11px] font-normal text-outline">{isMac ? '⌘ /' : 'Ctrl /'}</kbd>
              </span>
            </span>
          </button>
        </div>
      )}

      {/* Chat panel: grows out of the orb's corner */}
      {mounted && (
        <div
          className={`fixed bottom-6 right-4 sm:right-8 z-50 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-3rem)] transition-[width,height] duration-500 ease-[cubic-bezier(.2,.85,.25,1)] ${
            wide ? 'w-[34rem] h-[min(780px,calc(100vh-3rem))]' : 'w-96 h-[560px]'
          } ${open ? '' : 'pointer-events-none'}`}
        >
          {/* soft shadow lives outside the clipped panel and fades in after the morph starts */}
          <span aria-hidden="true" className={`absolute inset-0 rounded-3xl shadow-2xl ${open ? 'cw-shadow' : 'opacity-0 transition-opacity duration-150'}`} />

          <section
            ref={panelRef} onPointerMove={onPanelMove} role="dialog" aria-label="Meri chat"
            className={`${open ? 'cw-expand' : 'cw-collapse'} ${busy ? 'cw-busy' : ''} group/panel relative flex h-full w-full flex-col overflow-hidden rounded-3xl border border-outline-variant/40 bg-surface-container-lowest/90 backdrop-blur-2xl`}
          >
            {/* Orb skin: the panel starts out looking like the orb, then reveals its content */}
            <span aria-hidden="true" className={`${open ? 'cw-skin-out' : 'cw-skin-in'} pointer-events-none absolute inset-0 z-40 bg-gradient-to-br from-primary-container to-secondary-container`}>
              <span className="absolute bottom-0 right-0 flex h-14 w-14 items-center justify-center text-on-primary-container">
                <Icon name="auto_awesome" filled className="text-2xl" />
              </span>
            </span>

            {/* Drifting aurora behind the header */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-x-0 top-0 z-0 h-40 overflow-hidden transition-opacity duration-700 ${busy ? 'opacity-100' : 'opacity-60'}`}
              style={{ WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)', maskImage: 'linear-gradient(to bottom, black, transparent)' }}
            >
              <span className="cw-drift-a absolute -left-10 -top-16 h-44 w-44 rounded-full bg-primary/40 blur-3xl" />
              <span className="cw-drift-b absolute left-1/3 -top-20 h-44 w-44 rounded-full bg-secondary/40 blur-3xl" />
              <span className="cw-drift-c absolute -right-10 -top-14 h-40 w-40 rounded-full bg-tertiary/35 blur-3xl" />
            </div>
            <span aria-hidden="true" className="cw-line pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 bg-gradient-to-r from-primary via-secondary to-tertiary" />
            {/* Light that follows the cursor */}
            <span aria-hidden="true" className="cw-spot pointer-events-none absolute inset-0 z-0 text-secondary opacity-0 transition-opacity duration-300 group-hover/panel:opacity-100" />

            <div className={`relative z-10 flex min-h-0 flex-1 flex-col transition-opacity duration-150 ${open ? 'opacity-100' : 'opacity-0'}`}>
              {/* Header */}
              <div style={{ '--d': '140ms' }} className="cw-rise px-space-md py-3 border-b border-outline-variant/20 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {/* Avatar ring flows while Copilot is busy */}
                  <span className={`w-9 h-9 rounded-xl p-0.5 flex bg-gradient-to-r from-primary via-secondary to-tertiary shadow-md ${busy ? 'cw-flow' : ''}`}>
                    <span className="w-full h-full bg-surface-container-lowest rounded-[10px] flex items-center justify-center">
                      <span className="cw-twinkle flex"><Icon name="auto_awesome" filled className="text-base text-secondary" /></span>
                    </span>
                  </span>
                  <div className="flex flex-col leading-tight">
                    <h2 className="font-semibold text-lg text-on-surface">Meri</h2>
                    <span className="text-xs text-on-surface-variant flex items-center gap-1.5" aria-live="polite">
                      <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${statusDot} ${busy ? '' : 'cw-breathe'}`} aria-hidden="true" />
                      <span key={status} className="cw-msg">{status}{isVoiceActive ? ` ${fmtClock(voiceSecs)}` : ''}</span>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  {hasUserMsg && (
                    <button
                      type="button" onClick={clearChat} aria-label={confirmClear ? 'Confirm clear chat' : 'Clear chat'}
                      className={`cw-press flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs cursor-pointer ${focusRing} ${confirmClear ? 'bg-error-container/40 text-error font-semibold' : 'text-outline hover:text-on-surface hover:bg-surface-container-high'}`}
                    >
                      <Icon name="delete_sweep" className="text-base" />{confirmClear && 'Clear?'}
                    </button>
                  )}
                  <button
                    type="button" onClick={toggleVoiceMode} aria-label={isVoiceActive ? 'Stop voice session' : 'Start voice session'} aria-pressed={isVoiceActive}
                    className={`cw-press p-1.5 rounded-lg cursor-pointer ${focusRing} ${isVoiceActive ? 'text-error bg-error-container/30' : 'text-outline hover:text-on-surface hover:bg-surface-container-high'}`}
                  >
                    <Icon name={isVoiceActive ? 'mic' : 'mic_none'} className="text-base" />
                  </button>
                  <button
                    type="button" onClick={() => setWide((w) => !w)} aria-label={wide ? 'Shrink Meri' : 'Expand Meri'} aria-pressed={wide}
                    className={`cw-press hidden sm:block p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high cursor-pointer ${focusRing}`}
                  >
                    <Icon name={wide ? 'close_fullscreen' : 'open_in_full'} className="text-base" />
                  </button>
                  <button type="button" onClick={closeDrawer} aria-label="Close Meri" className={`cw-press p-1.5 text-outline hover:text-on-surface hover:bg-surface-container-high hover:rotate-90 rounded-lg transition-transform duration-200 cursor-pointer ${focusRing}`}>
                    <Icon name="close" className="text-base" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div style={{ '--d': '200ms' }} className="cw-rise relative flex-1 min-h-0">
                <div ref={listRef} onScroll={onScroll} className="h-full p-space-md overflow-y-auto flex flex-col gap-space-sm" role="log" aria-live="polite">
                  {messages.map((m) => <Message key={m.id} m={m} now={now} onGrow={onGrow} onFeedback={onFeedback} />)}

                  {isVoiceActive && (
                    <div className="cw-msg mr-auto flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-secondary/15 text-secondary text-xs font-medium border border-secondary/30">
                      <span className="flex items-center gap-0.5 h-4" aria-hidden="true">
                        {[0, 1, 2, 3, 4].map((i) => <span key={i} className="cw-wave w-0.5 h-full rounded-full bg-secondary" style={{ animationDelay: `${i * 110}ms`, animationDuration: `${700 + (i % 3) * 180}ms` }} />)}
                      </span>
                      Listening… {fmtClock(voiceSecs)}
                    </div>
                  )}
                  {isAnalyzing && (
                    <div className="cw-msg mr-auto flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-surface-container-high/60 text-secondary text-xs" role="status" aria-label="Meri is thinking">
                      <span className="flex items-center gap-1" aria-hidden="true">
                        {[0, 1, 2].map((i) => <span key={i} className="cw-dot w-1.5 h-1.5 rounded-full bg-secondary" style={{ animationDelay: `${i * 160}ms` }} />)}
                      </span>
                      Checking sprints and skills…
                    </div>
                  )}
                </div>

                {showJump && (
                  <button
                    type="button" onClick={() => { atBottom.current = true; setShowJump(false); scrollToEnd(); }}
                    className={`cw-nudge cw-press absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container-highest text-on-surface text-xs font-medium shadow-lg border border-outline-variant/30 cursor-pointer ${focusRing}`}
                  >
                    <Icon name="arrow_downward" className="text-sm" /> Latest
                  </button>
                )}
              </div>

              {/* Suggestions (fade away once the chat is going) */}
              {!hasUserMsg && (
                <div style={{ '--d': '260ms' }} className="cw-rise px-space-md py-2 border-t border-outline-variant/20 flex gap-1.5 overflow-x-auto">
                  {QUICK_PROMPTS.map((p, i) => (
                    <button
                      key={p.label} type="button" onClick={() => handleSend(p.prompt)} disabled={isAnalyzing}
                      style={{ animationDelay: `${320 + i * 70}ms` }}
                      className={`cw-msg cw-press group/chip flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-container border border-transparent hover:border-secondary/50 hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface whitespace-nowrap hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer ${focusRing}`}
                    >
                      <Icon name={p.icon} className="text-sm text-secondary transition-transform duration-300 group-hover/chip:rotate-12 group-hover/chip:scale-110" />{p.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div style={{ '--d': '320ms' }} className="cw-rise p-space-sm bg-surface-container-low/80 border-t border-outline-variant/20">
                <div className="flex items-end gap-space-xs">
                  <div className="flex-1 rounded-xl p-px bg-outline-variant/30 transition-all duration-300 focus-within:bg-gradient-to-r focus-within:from-primary focus-within:via-secondary focus-within:to-tertiary focus-within:shadow-[0_0_22px_-4px] focus-within:shadow-secondary/50">
                    <textarea
                      ref={taRef} rows={1} value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={onKeyDown}
                      aria-label="Message Meri" placeholder={PLACEHOLDERS[phIndex]}
                      className="block w-full resize-none rounded-[11px] bg-surface-container-high px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:outline-none"
                    />
                  </div>
                  <button
                    type="button" onClick={() => handleSend()} disabled={!canSend} aria-label="Send message"
                    className={`cw-press w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden cursor-pointer ${focusRing} ${canSend ? 'bg-gradient-to-br from-primary to-secondary text-on-primary shadow-md hover:shadow-lg hover:-translate-y-0.5' : 'bg-surface-container-highest text-outline cursor-default'}`}
                  >
                    <span key={sendKey} className={`flex ${sendKey ? 'cw-fly' : ''}`}>
                      <Icon name="arrow_upward" className={`text-base transition-transform duration-200 ${canSend ? '-translate-y-px' : ''}`} />
                    </span>
                  </button>
                </div>
                <p className="mt-1.5 px-1 text-[11px] text-outline">Enter to send · Shift + Enter for a new line · Esc to close</p>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};  