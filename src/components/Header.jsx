import React, { useCallback, useEffect, useRef, useState } from 'react';

/* Typography and motion live here, scoped to the header, so no Tailwind config changes are needed. */
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
.hd-root { font-family: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
.hd-root .font-mono { font-family: inherit; }

@keyframes hd-pop { from { opacity: 0; transform: translateY(-8px) scale(.96); } to { opacity: 1; transform: none; } }
@keyframes hd-ring { 0%, 100% { transform: rotate(0); } 15% { transform: rotate(14deg); } 30% { transform: rotate(-12deg); } 45% { transform: rotate(8deg); } 60% { transform: rotate(-5deg); } 75% { transform: rotate(0); } }
@keyframes hd-swap { from { opacity: 0; transform: rotate(-90deg) scale(.5); } to { opacity: 1; transform: none; } }
@keyframes hd-badge { from { transform: scale(0); } to { transform: scale(1); } }
@keyframes hd-ping { 0% { transform: scale(1); opacity: .55; } 75%, 100% { transform: scale(2.1); opacity: 0; } }
@keyframes hd-item { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: none; } }
@keyframes hd-leave { from { opacity: 1; transform: none; max-height: 140px; } to { opacity: 0; transform: translateX(36px); max-height: 0; } }
@keyframes hd-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes hd-rip { to { transform: scale(1); opacity: 0; } }
@keyframes hd-kbd { 0% { transform: none; } 35% { transform: translateY(2px) scale(.9); } 100% { transform: none; } }
@keyframes hd-spin { to { transform: rotate(360deg); } }
@keyframes hd-count { from { width: 100%; } to { width: 0; } }
@keyframes hd-draw { from { stroke-dashoffset: 24; } to { stroke-dashoffset: 0; } }

.hd-pop { transform-origin: top right; animation: hd-pop .22s cubic-bezier(.2, .9, .3, 1.15) both; }
.hd-ring { transform-origin: 50% 0; animation: hd-ring 1s ease-in-out .6s 1 both; }
.hd-swap { animation: hd-swap .4s cubic-bezier(.3, 1.4, .5, 1) both; }
.hd-badge { animation: hd-badge .3s cubic-bezier(.3, 1.6, .5, 1) both; }
.hd-ping { animation: hd-ping 2.2s cubic-bezier(0, 0, .2, 1) infinite; }
.hd-item { animation: hd-item .3s ease-out both; }
.hd-leave { overflow: hidden; animation: hd-leave .24s ease-in forwards; }
.hd-fade { animation: hd-fade .35s ease-out both; }
.hd-kbd { animation: hd-kbd .22s ease-out; }
.hd-spin { animation: hd-spin 6s linear infinite; }
.hd-countdown { animation: hd-count 5s linear forwards; }
.hd-draw { stroke-dasharray: 24; animation: hd-draw .5s ease-out .1s both; }
.hd-spring { transition: transform .35s cubic-bezier(.3, 1.5, .5, 1); }

.hd-bellbtn:hover .hd-bellicon { transform-origin: 50% 0; animation: hd-ring .9s ease-in-out 1; }

.hd-ripple { position: absolute; border-radius: 9999px; background: currentColor; opacity: .28; transform: scale(0); animation: hd-rip .6s ease-out forwards; pointer-events: none; }

.hd-shine { position: relative; overflow: hidden; }
.hd-shine::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,.38) 50%, transparent 65%); transform: translateX(-120%); }
.hd-shine:hover::after { transform: translateX(120%); transition: transform .75s ease; }

@media (prefers-reduced-motion: reduce) {
  .hd-pop, .hd-ring, .hd-swap, .hd-badge, .hd-ping, .hd-item, .hd-fade, .hd-kbd, .hd-spin, .hd-countdown, .hd-draw, .hd-ripple { animation: none !important; }
  .hd-leave { animation-duration: 1ms !important; }
  .hd-bellbtn:hover .hd-bellicon { animation: none; }
  .hd-shine:hover::after { transition: none; }
}
`;

const INITIAL_NOTIFICATIONS = [
  { id: 1, icon: 'warning', title: 'Sprint 14 allocation alert', desc: 'Marcus Chen is double-booked across Kinetic UI and Client Portal.', time: '10m ago', urgent: true, read: false },
  { id: 2, icon: 'speed', title: 'Neural sandbox verification', desc: 'Sophia Patel completed the PyTorch 2.4 GPU benchmark (120 FPS).', time: '1h ago', urgent: false, read: false },
  { id: 3, icon: 'rocket_launch', title: 'Hyperion Client Portal', desc: 'Staging deployment test passed with 0 regressions.', time: '3h ago', urgent: false, read: false },
];

const SEARCH_HINTS = ['Search or ask AI…', 'Try “who is double-booked?”', 'Jump to a project or person'];

const AVATAR_SRC =
  'https://lh3.googleusercontent.com/aida/AEtjO1XF4C-B-0Q1ojsPoIn_KahwtWmFGEQLgJUoNX_YGSfrrH77erBz_QLbfRl1ExlyNesryHVbzru-FBuiXq5gOgoVKySHL0rKuYvgNphhT3_p4fKq_4OaplH-mWtxLGom4y5UQapi4rpcEdqx8tGRsUwGepuEcAZEpKCDw9D-2ETUiSo3tUfFRSyeU3pXOdzBVkvVEZj9Vm0Ialxp28kAmYgnZRAeR5diGk6nEBsmMpljqw6WO3pttQRIe4Y';

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const Icon = ({ name, className = '' }) => (
  <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{name}</span>
);

// Click ripple, drawn from the pointer position. The host element needs `relative overflow-hidden`.
const ripple = (e) => {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * 2;
  const s = document.createElement('span');
  s.className = 'hd-ripple';
  s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  el.appendChild(s);
  setTimeout(() => s.remove(), 650);
};

// Closes a menu on Escape or when clicking outside of it.
const useDismiss = (open, onClose, ref) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && onClose();
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open, onClose, ref]);
};

const MenuItem = ({ icon, children, onClick, index = 0 }) => (
  <button
    type="button" role="menuitem" onClick={onClick}
    style={{ animationDelay: `${60 + index * 45}ms` }}
    className={`hd-item group/item relative flex w-full items-center gap-3 px-space-sm py-2 rounded-lg text-body-sm text-on-surface hover:bg-surface-container-high transition-colors text-left cursor-pointer ${focusRing}`}
  >
    <span aria-hidden="true" className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-primary origin-center scale-y-0 transition-transform duration-200 group-hover/item:scale-y-100 group-focus-visible/item:scale-y-100" />
    <Icon name={icon} className="text-base text-outline transition-all duration-200 group-hover/item:translate-x-1 group-hover/item:text-primary" />
    <span className="transition-transform duration-200 group-hover/item:translate-x-0.5">{children}</span>
  </button>
);

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export const Header = ({
  isDarkMode,
  onToggleTheme,
  onOpenCommandPalette,
  onOpenNewProject,
  isSidebarCollapsed,
  // Set to true if the parent does not already bind the Cmd/Ctrl+K shortcut itself.
  bindShortcut = false,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [tab, setTab] = useState('all');
  const [leaving, setLeaving] = useState(() => new Set());
  const [undo, setUndo] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [hintIdx, setHintIdx] = useState(0);
  const [kbdFlash, setKbdFlash] = useState(0);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const headerRef = useRef(null);
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const menuRef = useRef(null);
  const glowRef = useRef(null);
  const barRef = useRef(null);
  const undoTimer = useRef(null);
  const undoSnapshot = useRef([]);

  const closeNotifications = useCallback(() => setShowNotifications(false), []);
  const closeProfile = useCallback(() => setShowProfileMenu(false), []);
  useDismiss(showNotifications, closeNotifications, notifRef);
  useDismiss(showProfileMenu, closeProfile, profileRef);

  // Header gains depth and a reading-progress line once the page scrolls.
  useEffect(() => {
    let raf = 0;
    const onScroll = (e) => {
      const tgt = e.target;
      if (headerRef.current && tgt instanceof Node && headerRef.current.contains(tgt)) return;
      const el = tgt instanceof Element ? tgt : document.documentElement;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = el.scrollHeight - el.clientHeight;
        setScrolled(el.scrollTop > 4);
        if (barRef.current) barRef.current.style.transform = `scaleX(${max > 0 ? Math.min(el.scrollTop / max, 1) : 0})`;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true });
      cancelAnimationFrame(raf);
    };
  }, []);

  // Rotating search hints.
  useEffect(() => {
    const id = setInterval(() => setHintIdx((i) => (i + 1) % SEARCH_HINTS.length), 4500);
    return () => clearInterval(id);
  }, []);

  // The shortcut key always "presses" the on-screen keycap; it only opens the palette if bindShortcut is set.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        setKbdFlash((f) => f + 1);
        if (bindShortcut) {
          e.preventDefault();
          if (onOpenCommandPalette) onOpenCommandPalette();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bindShortcut, onOpenCommandPalette]);

  // Move focus into the profile menu when it opens.
  useEffect(() => {
    if (!showProfileMenu) return;
    const first = menuRef.current && menuRef.current.querySelector('[role="menuitem"]');
    if (first) first.focus({ preventScroll: true });
  }, [showProfileMenu]);

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const unread = notifications.filter((n) => !n.read).length;
  const visible = tab === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  const markRead = (id) => setNotifications((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
  const markAllRead = () => setNotifications((list) => list.map((n) => ({ ...n, read: true })));

  const dismiss = (id) => {
    setLeaving((s) => new Set(s).add(id));
    setTimeout(() => {
      setNotifications((list) => list.filter((n) => n.id !== id));
      setLeaving((s) => { const next = new Set(s); next.delete(id); return next; });
    }, 240);
  };

  const clearAll = () => {
    if (!notifications.length) return;
    undoSnapshot.current = notifications;
    setUndo({ count: notifications.length });
    setNotifications([]);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  };

  const undoClear = () => {
    clearTimeout(undoTimer.current);
    setNotifications(undoSnapshot.current);
    setUndo(null);
  };

  const onSearchMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (glowRef.current) glowRef.current.style.transform = `translate(${e.clientX - r.left - 64}px, ${e.clientY - r.top - 64}px)`;
  };

  const onMenuKey = (e) => {
    const items = Array.from(menuRef.current.querySelectorAll('[role="menuitem"]'));
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  };

  return (
    <header
      ref={headerRef}
      className={`hd-root fixed top-0 right-0 h-16 bg-surface-container-lowest/85 backdrop-blur-xl z-40 px-space-lg flex items-center justify-between gap-space-md border-b transition-all duration-300 ${
        isSidebarCollapsed ? 'left-20' : 'left-72'
      } ${scrolled ? 'border-outline-variant/40 shadow-[0_12px_30px_-20px_rgba(0,0,0,.55)]' : 'border-outline-variant/20'}`}
    >
      <style>{STYLES}</style>

      {/* Reading progress */}
      <span
        ref={barRef} aria-hidden="true"
        className={`pointer-events-none absolute bottom-[-1px] left-0 h-[2px] w-full origin-left bg-gradient-to-r from-primary to-secondary transition-opacity duration-300 ${scrolled ? 'opacity-100' : 'opacity-0'}`}
        style={{ transform: 'scaleX(0)' }}
      />

      {/* Search: opens the command palette */}
      <div className="flex items-center flex-1 max-w-xl">
        <button
          type="button" onClick={onOpenCommandPalette} onMouseMove={onSearchMove} aria-label="Open search and command palette"
          className={`group relative overflow-hidden w-full flex items-center justify-between gap-space-sm bg-surface-container-low/80 px-space-md py-2 rounded-xl border border-outline-variant/30 hover:border-primary/50 hover:bg-surface-container-low hover:shadow-md text-left transition-all duration-300 cursor-pointer ${focusRing}`}
        >
          <span ref={glowRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-32 w-32 rounded-full bg-primary/20 blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <span className="relative flex items-center gap-space-sm text-outline group-hover:text-on-surface transition-colors min-w-0">
            <Icon name="search" className="text-body-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-12" />
            <span key={hintIdx} className="hd-fade text-body-sm truncate">{SEARCH_HINTS[hintIdx]}</span>
          </span>
          <kbd
            key={kbdFlash}
            className={`relative text-label-sm px-space-xs py-0.5 rounded border border-outline-variant/40 bg-surface-container-high text-on-surface-variant font-medium shadow-[0_1px_0_rgba(0,0,0,.25)] transition-colors group-hover:border-primary/40 group-hover:text-primary ${kbdFlash ? 'hd-kbd' : ''}`}
          >
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-space-sm sm:gap-space-md">
        {/* Theme switch */}
        <button
          type="button" role="switch" aria-checked={isDarkMode}
          onClick={onToggleTheme} onPointerDown={ripple}
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'} title="Change color theme"
          className={`relative h-8 w-[60px] shrink-0 overflow-hidden rounded-full bg-surface-container-low/80 hover:bg-surface-container-high border border-outline-variant/30 text-on-surface-variant transition-colors cursor-pointer ${focusRing}`}
        >
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-between px-2 text-outline">
            <Icon name="light_mode" className="text-[14px]" />
            <Icon name="dark_mode" className="text-[14px]" />
          </span>
          <span className={`hd-spring absolute left-[3px] top-[3px] flex h-6 w-6 items-center justify-center rounded-full bg-primary text-on-primary shadow-md ${isDarkMode ? 'translate-x-7' : ''}`}>
            <span key={isDarkMode ? 'dark' : 'light'} className="hd-swap inline-flex">
              <Icon name={isDarkMode ? 'dark_mode' : 'light_mode'} className="text-[14px]" />
            </span>
          </span>
        </button>

        <button
          type="button" onClick={onOpenNewProject} onPointerDown={ripple}
          className={`hd-shine group flex items-center gap-space-xs bg-primary hover:bg-primary-fixed-dim text-on-primary font-semibold text-body-sm px-space-md py-2 rounded-xl shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-200 cursor-pointer ${focusRing}`}
        >
          <Icon name="add" className="text-body-lg transition-transform duration-300 group-hover:rotate-180" />
          <span className="whitespace-nowrap">New project</span>
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => { setShowNotifications((o) => !o); setShowProfileMenu(false); }}
            aria-haspopup="true" aria-expanded={showNotifications}
            aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
            className={`hd-bellbtn group relative p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-all cursor-pointer active:scale-90 ${showNotifications ? 'bg-surface-container-high text-on-surface' : ''} ${focusRing}`}
          >
            <span className={`hd-bellicon inline-flex ${unread ? 'hd-ring' : ''}`}>
              <Icon name={unread ? 'notifications_active' : 'notifications'} className="text-body-lg" />
            </span>
            {unread > 0 && (
              <span key={unread} className="hd-badge absolute top-0.5 right-0.5 min-w-[18px] h-[18px]">
                <span className="hd-ping absolute inset-0 rounded-full bg-secondary" aria-hidden="true" />
                <span className="relative flex h-full w-full items-center justify-center rounded-full bg-secondary px-1 text-on-secondary text-xs font-semibold">
                  {unread}
                </span>
              </span>
            )}
          </button>

          {showNotifications && (
            <div role="region" aria-label="Notifications" className="hd-pop absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl bg-surface-container-low/95 backdrop-blur-2xl border border-outline-variant/40 shadow-2xl p-space-md z-50">
              <div className="flex items-center justify-between pb-space-xs mb-space-sm">
                <h2 className="font-semibold text-headline-sm text-on-surface">Notifications</h2>
                <span key={unread} className="hd-badge text-label-sm text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">
                  {unread} unread
                </span>
              </div>

              {/* Tabs with sliding indicator */}
              <div role="tablist" className="relative mb-space-sm grid grid-cols-2 rounded-xl bg-surface-container/70 p-0.5 text-xs font-medium">
                <span
                  aria-hidden="true"
                  className={`hd-spring absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-[10px] bg-surface-container-highest shadow-sm ${tab === 'unread' ? 'translate-x-full' : ''}`}
                />
                {[['all', 'All', notifications.length], ['unread', 'Unread', unread]].map(([key, label, count]) => (
                  <button
                    key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                    className={`relative z-10 rounded-[10px] py-1.5 transition-colors cursor-pointer ${tab === key ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface'} ${focusRing}`}
                  >
                    {label} <span className="text-outline">{count}</span>
                  </button>
                ))}
              </div>

              {visible.length === 0 ? (
                <div className="hd-fade flex flex-col items-center gap-1 py-8 text-center">
                  <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path className="hd-draw" d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                  <p className="text-body-sm font-medium text-on-surface">
                    {notifications.length === 0 ? 'You’re all caught up' : 'Nothing unread'}
                  </p>
                  <p className="text-xs text-on-surface-variant">New alerts will show up here.</p>
                </div>
              ) : (
                <ul className="flex flex-col gap-space-xs max-h-72 overflow-y-auto pr-0.5">
                  {visible.map((n, i) => {
                    const hot = n.urgent && !n.read;
                    return (
                      <li
                        key={n.id}
                        className={`group/row relative ${leaving.has(n.id) ? 'hd-leave' : 'hd-item'}`}
                        style={leaving.has(n.id) ? undefined : { animationDelay: `${60 + i * 60}ms` }}
                      >
                        <button
                          type="button" onClick={() => markRead(n.id)}
                          title={n.read ? undefined : 'Mark as read'}
                          className={`flex w-full items-start gap-3 text-left p-space-sm pr-9 rounded-xl transition-all duration-200 cursor-pointer hover:-translate-y-px hover:shadow-sm active:scale-[.99] ${focusRing} ${
                            hot
                              ? 'bg-error-container/20 border border-error/30'
                              : 'bg-surface-container/60 hover:bg-surface-container-high/70 border border-transparent'
                          } ${n.read ? 'opacity-60' : ''}`}
                        >
                          <span className={`relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-300 ${hot ? 'bg-error/15 text-error' : 'bg-secondary/10 text-secondary'}`}>
                            <Icon name={n.read ? 'done' : n.icon} className="text-base" />
                            {!n.read && (
                              <span className="absolute -right-0.5 -top-0.5 h-2 w-2" aria-hidden="true">
                                <span className={`hd-ping absolute inset-0 rounded-full ${hot ? 'bg-error' : 'bg-secondary'}`} />
                                <span className={`absolute inset-0 rounded-full ${hot ? 'bg-error' : 'bg-secondary'}`} />
                              </span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2 mb-0.5">
                              <span className={`text-body-sm font-semibold truncate ${hot ? 'text-error' : 'text-on-surface'}`}>{n.title}</span>
                              <span className="text-outline text-xs whitespace-nowrap">{n.time}</span>
                            </span>
                            <span className="block text-xs text-on-surface-variant leading-relaxed">{n.desc}</span>
                          </span>
                        </button>
                        <button
                          type="button" onClick={() => dismiss(n.id)} aria-label={`Dismiss ${n.title}`}
                          className={`absolute right-2 bottom-2 flex h-6 w-6 items-center justify-center rounded-full text-outline opacity-0 scale-75 transition-all duration-200 hover:bg-surface-container-highest hover:text-on-surface group-hover/row:opacity-100 group-hover/row:scale-100 focus-visible:opacity-100 focus-visible:scale-100 cursor-pointer ${focusRing}`}
                        >
                          <Icon name="close" className="text-[14px]" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {undo && (
                <div className="hd-item relative mt-space-sm overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container-high">
                  <div className="flex items-center justify-between gap-2 px-space-sm py-2 text-xs text-on-surface">
                    <span>Cleared {undo.count} {undo.count === 1 ? 'notification' : 'notifications'}</span>
                    <button type="button" onClick={undoClear} className={`font-semibold text-secondary hover:underline rounded cursor-pointer ${focusRing}`}>
                      Undo
                    </button>
                  </div>
                  <span className="hd-countdown absolute bottom-0 left-0 h-0.5 bg-secondary" aria-hidden="true" />
                </div>
              )}

              <div className="mt-space-sm pt-space-xs border-t border-outline-variant/20 flex items-center justify-between text-xs font-medium">
                <button type="button" onClick={markAllRead} disabled={unread === 0}
                  className={`text-secondary hover:underline disabled:text-outline disabled:no-underline disabled:cursor-default cursor-pointer rounded ${focusRing}`}>
                  Mark all as read
                </button>
                <button type="button" onClick={clearAll} disabled={notifications.length === 0}
                  className={`text-outline hover:text-on-surface disabled:opacity-50 disabled:cursor-default cursor-pointer rounded ${focusRing}`}>
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => { setShowProfileMenu((o) => !o); setShowNotifications(false); }}
            aria-haspopup="menu" aria-expanded={showProfileMenu}
            className={`group flex items-center gap-space-sm pl-space-sm border-l border-outline-variant/30 cursor-pointer text-left rounded-lg active:scale-[.97] transition-transform ${focusRing}`}
          >
            <span className="relative h-10 w-10 shrink-0">
              <span aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-full bg-outline-variant/40">
                <span className="hd-spin absolute -inset-2 bg-gradient-to-tr from-primary via-secondary to-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </span>
              {avatarFailed ? (
                <span className="absolute inset-[2px] flex items-center justify-center rounded-full bg-surface-container-high text-body-sm font-semibold text-on-surface">EV</span>
              ) : (
                <img
                  alt="Elena Vance" onError={() => setAvatarFailed(true)}
                  className="absolute inset-[2px] h-9 w-9 rounded-full object-cover transition-transform duration-300 group-hover:scale-105"
                  src={AVATAR_SRC}
                />
              )}
              <span className="absolute bottom-0 right-0 h-3 w-3" aria-hidden="true">
                <span className="hd-ping absolute inset-0 rounded-full bg-secondary" />
                <span className="absolute inset-0 rounded-full bg-secondary ring-2 ring-surface" />
              </span>
            </span>
            <span className="hidden xl:flex flex-col">
              <span className="text-body-sm font-semibold text-on-surface leading-tight">Elena Vance</span>
              <span className="text-label-sm text-on-surface-variant leading-tight">Lead Architect</span>
            </span>
            <Icon name="expand_more" className={`hidden xl:inline text-base text-outline transition-transform duration-300 group-hover:text-on-surface ${showProfileMenu ? 'rotate-180' : ''}`} />
          </button>

          {showProfileMenu && (
            <div ref={menuRef} role="menu" onKeyDown={onMenuKey} className="hd-pop absolute right-0 mt-3 w-64 rounded-2xl bg-surface-container-low/95 backdrop-blur-2xl border border-outline-variant/40 shadow-2xl p-space-sm z-50">
              <div className="hd-item p-space-sm border-b border-outline-variant/20 mb-1" style={{ animationDelay: '30ms' }}>
                <p className="text-body-sm font-semibold text-on-surface">Elena Vance</p>
                <p className="text-xs text-on-surface-variant">elena.vance@nexuspm.ai</p>
                <span className="mt-1.5 inline-block text-xs px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-medium">
                  Principal Systems Architect
                </span>
              </div>
              <MenuItem index={0} icon="badge" onClick={closeProfile}>My cryptographic proofs</MenuItem>
              <MenuItem index={1} icon="tune" onClick={closeProfile}>Account preferences</MenuItem>
              <div className="my-1 border-t border-outline-variant/20" />
              <MenuItem index={2} icon="swap_horiz" onClick={closeProfile}>Switch workspace</MenuItem>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};