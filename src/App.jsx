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

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [tpuUsage, setTpuUsage] = useState(78);

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

  // Handle theme class on <html>
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Toggle Theme
  const handleToggleTheme = () => {
    setIsDarkMode((prev) => !prev);
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
        <div className="absolute -top-[20%] -left-[10%] w-[55vw] h-[55vw] rounded-full bg-primary-container/15 blur-[120px]" />
        <div className="absolute top-[40%] -right-[15%] w-[50vw] h-[50vw] rounded-full bg-tertiary-container/10 blur-[140px]" />
        <div className="absolute -bottom-[20%] left-[25%] w-[45vw] h-[45vw] rounded-full bg-secondary-container/10 blur-[130px]" />
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
            <SettingsPage tpuUsage={tpuUsage} setTpuUsage={setTpuUsage} />
          )}
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
