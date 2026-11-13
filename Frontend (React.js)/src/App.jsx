import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { CommandPalette } from './components/CommandPalette';
import { CopilotWidget } from './components/CopilotWidget';
import {
  NewProjectModal,
  QuickTaskModal,
  GenerateSprintModal,
  InspectSandboxModal,
} from './components/Modals';
import { DashboardPage } from './pages/DashboardPage';
import { TeamPage } from './pages/TeamPage';
import { SprintsPage } from './pages/SprintsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import {
  INITIAL_PROJECTS,
  INITIAL_TEAM_MEMBERS,
  INITIAL_ALLOCATIONS,
} from './data/mockData';
import { applyTheme, loadTheme, resolveMode, saveTheme, systemPrefersDark } from './theme';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [tpuUsage, setTpuUsage] = useState(78);

  // Theme: `themePrefs` is what is saved, `themePreview` is the unsaved draft from Settings.
  const [themePrefs, setThemePrefs] = useState(() => {
    const loaded = loadTheme();
    // Persist the initial theme (applies THEME_DEFAULTS if nothing was stored yet).
    saveTheme(loaded);
    return loaded;
  });
  const [themePreview, setThemePreview] = useState(null);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const activeTheme = themePreview ?? themePrefs;
  const isDarkMode = resolveMode(activeTheme.theme, systemDark) === 'dark';

  // Data States
  const [projects, setProjects] = useState(INITIAL_PROJECTS);
  const [teamMembers, setTeamMembers] = useState(INITIAL_TEAM_MEMBERS);
  const [allocations, setAllocations] = useState(INITIAL_ALLOCATIONS);
  const [isConflictResolved, setIsConflictResolved] = useState(false);

  // Modals
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isQuickTaskOpen, setIsQuickTaskOpen] = useState(false);
  const [isGenerateSprintOpen, setIsGenerateSprintOpen] = useState(false);
  const [inspectingMember, setInspectingMember] = useState(null);

  // Follow the device's light/dark setting (used when the mode is "System").
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // Apply the theme (dark class plus the chosen color palette) to <html>.
  useEffect(() => {
    applyTheme(activeTheme, systemDark);
  }, [activeTheme, systemDark]);

  // Header toggle: switch between light and dark and remember the choice.
  const handleToggleTheme = () => {
    const next = { ...themePrefs, theme: isDarkMode ? 'light' : 'dark' };
    setThemePrefs(next);
    saveTheme(next);
  };

  // Settings page: save the chosen theme.
  const handleThemeSave = (next) => {
    setThemePrefs(next);
    saveTheme(next);
  };

  // Conflict Resolution Action
  const handleResolveConflict = () => {
    setIsConflictResolved(true);
    setAllocations((prev) =>
      prev.map((row) => {
        if (row.name === 'Marcus Chen') {
          return {
            ...row,
            hasConflict: false,
            capacityHours: 40,
            capacityText: 'Optimal (40h)',
            statusBadge: {
              text: 'Optimal (40h)',
              bg: 'bg-secondary/15',
              textColor: 'text-secondary',
              dotColor: 'bg-secondary',
            },
          };
        }
        if (row.name === 'Sophia Patel') {
          return {
            ...row,
            capacityHours: 40,
            capacityText: 'At Capacity (40h)',
            statusBadge: {
              text: 'At Capacity (40h)',
              bg: 'bg-primary/20',
              textColor: 'text-primary',
              dotColor: 'bg-primary',
            },
          };
        }
        return row;
      })
    );
  };

  // Add Project
  const handleAddProject = (newProj) => {
    setProjects((prev) => [newProj, ...prev]);
  };

  // Add Quick Task
  const handleAddTask = (task) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.title === task.workstream) {
          return {
            ...p,
            totalTasks: p.totalTasks + 1,
            completedTasks: p.completedTasks + 1,
            progressPercent: Math.min(
              100,
              Math.round(((p.completedTasks + 1) / (p.totalTasks + 1)) * 100)
            ),
          };
        }
        return p;
      })
    );
  };

  // Apply Sprint Plan
  const handleApplyPlan = () => {
    handleResolveConflict();
    setTpuUsage(82);
  };

  return (
    <div className="bg-surface font-body-md text-on-surface min-h-screen relative selection:bg-primary-container selection:text-on-primary-container overflow-x-hidden">
      {/* Dynamic Ambient Background Blur Nodes */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="ambient-grid absolute inset-0" />
        <div className="anim-float-a absolute -top-[20%] -left-[10%] w-[55vw] h-[55vw] rounded-full bg-primary-container/15 blur-[120px]" />
        <div className="anim-float-b absolute top-[40%] -right-[15%] w-[50vw] h-[50vw] rounded-full bg-tertiary-container/10 blur-[140px]" />
        <div className="anim-float-c absolute -bottom-[20%] left-[25%] w-[45vw] h-[45vw] rounded-full bg-secondary-container/10 blur-[130px]" />
        {/* extra shimmer layer for Ember palette */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(ellipse 60% 40% at 70% 20%, rgba(var(--glow-a),1), transparent 70%)' }} />
      </div>

      {/* Persistent Left Sidebar */}
      <Sidebar
        activePage={activePage}
        onNavigate={(p) => setActivePage(p)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        tpuUsage={tpuUsage}
      />

      {/* Main Content Area */}
      <div
        className={`flex flex-col min-h-screen relative z-10 transition-all duration-300 ${
          isSidebarCollapsed ? 'pl-20' : 'pl-72'
        }`}
      >
        {/* Persistent Top Header */}
        <Header
          isDarkMode={isDarkMode}
          onToggleTheme={handleToggleTheme}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenNewProject={() => setIsNewProjectOpen(true)}
          isSidebarCollapsed={isSidebarCollapsed}
        />

        {/* Viewport Content by Active Page */}
        <main className="relative pt-16 w-full px-gutter min-h-screen pb-36">
          <div key={activePage} className="page-enter">
          {activePage === 'dashboard' && (
            <DashboardPage
              projects={projects}
              onOpenQuickTask={() => setIsQuickTaskOpen(true)}
              onOpenGenerateSprint={() => setIsGenerateSprintOpen(true)}
              onOpenNewProject={() => setIsNewProjectOpen(true)}
              onSelectProject={() => setActivePage('projects')}
            />
          )}

          {activePage === 'projects' && (
            <ProjectsPage
              projects={projects}
              onOpenNewProject={() => setIsNewProjectOpen(true)}
              onOpenQuickTask={() => setIsQuickTaskOpen(true)}
              onSelectProject={() => {}}
            />
          )}

          {activePage === 'sprint-board' && (
            <SprintsPage
              allocations={allocations}
              onResolveConflict={handleResolveConflict}
              isConflictResolved={isConflictResolved}
              onOpenAllocateModal={() => setIsNewProjectOpen(true)}
              onAskCopilotQuery={(query) => {
                setIsCommandPaletteOpen(true);
              }}
            />
          )}

          {activePage === 'team-and-roles' && (
            <TeamPage
              teamMembers={teamMembers}
              onInspectSandbox={(member) => setInspectingMember(member)}
              onOpenVerifyModal={() => alert('Cryptographic talent verification portal initiated. Ready for GitHub sandbox connect.')}
              onOpenInstantMatch={() => alert('AI autonomous contractor scouting initialized across verified sandboxes.')}
              onAskCopilotQuery={(query) => {
                setIsCommandPaletteOpen(true);
              }}
            />
          )}

          {activePage === 'analytics' && (
            <AnalyticsPage tpuUsage={tpuUsage} />
          )}

          {activePage === 'settings' && (
            <SettingsPage
              tpuUsage={tpuUsage}
              setTpuUsage={setTpuUsage}
              themePrefs={themePrefs}
              onThemePreview={setThemePreview}
              onThemeSave={handleThemeSave}
            />
          )}
          </div>
        </main>
      </div>

      {/* Docked AI Copilot Floating Widget */}
      <CopilotWidget
        onAutoReallocate={handleResolveConflict}
        onNavigateToSprints={() => setActivePage('sprint-board')}
        onNavigateToTeam={() => setActivePage('team-and-roles')}
      />

      {/* Interactive Command Palette (⌘K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(p) => setActivePage(p)}
        projects={projects}
        teamMembers={teamMembers}
        onOpenNewProject={() => setIsNewProjectOpen(true)}
        onOpenQuickTask={() => setIsQuickTaskOpen(true)}
        onOpenGenerateSprint={() => setIsGenerateSprintOpen(true)}
        onAutoReallocate={handleResolveConflict}
      />

      {/* Modals */}
      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        onAddProject={handleAddProject}
      />

      <QuickTaskModal
        isOpen={isQuickTaskOpen}
        onClose={() => setIsQuickTaskOpen(false)}
        onAddTask={handleAddTask}
      />

      <GenerateSprintModal
        isOpen={isGenerateSprintOpen}
        onClose={() => setIsGenerateSprintOpen(false)}
        onApplyPlan={handleApplyPlan}
      />

      <InspectSandboxModal
        member={inspectingMember}
        isOpen={!!inspectingMember}
        onClose={() => setInspectingMember(null)}
      />
    </div>
  );
}