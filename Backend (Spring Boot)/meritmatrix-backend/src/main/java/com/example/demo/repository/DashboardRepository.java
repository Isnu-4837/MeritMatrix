package com.example.demo.repository;

import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Data-access layer for {@code DashboardService}.
 *
 * Returns raw stored data only. Derived values (progress percent, metric
 * badges, burndown ahead/behind, workload insight, status breakdown, filtering,
 * searching and sorting) stay in the service.
 *
 * This implementation keeps the sample data in memory so the app runs on its
 * own. To go live, keep the public method signatures and swap the bodies for
 * JPA / JdbcTemplate / metrics-client calls (or turn this class into an
 * interface and move this code into an InMemoryDashboardRepository).
 *
 * Requires Spring Boot 3.x and Java 17+.
 */
@Repository
public class DashboardRepository {

    /* ======================================================================
       Raw data types (kept here so the repository does not depend on the service)
       ====================================================================== */

    public record AssigneeRecord(String name, String initials, String color) {}

    /**
     * A stored project. Progress is not stored: the service derives it from
     * {@code completedTasks / totalTasks}.
     */
    public record ProjectRecord(
            String id,
            String code,
            String title,
            String description,
            String status,
            String statusColor,
            String accentGradient,
            int completedTasks,
            int totalTasks,
            String dueDate,
            boolean urgent,
            List<AssigneeRecord> assignees) {

        public ProjectRecord withTasks(int completed, int total) {
            return new ProjectRecord(id, code, title, description, status, statusColor,
                    accentGradient, completed, total, dueDate, urgent, assignees);
        }
    }

    public record SprintInfo(int number, int day, int length, int onSchedulePercent) {}

    public record TeamLoadRecord(String name, int hours) {}

    public record AiUsage(List<Double> hoursSavedHistory, int progressPercent, int neuralActions) {}

    /** Points left per day, from day 0 to today. */
    public record BurndownData(int totalPoints, List<Integer> actual) {}

    /* ======================================================================
       Sample data
       ====================================================================== */

    private static final SprintInfo CURRENT_SPRINT = new SprintInfo(14, 9, 14, 84);

    private static final int WEEKLY_CAPACITY_HOURS = 40;

    private static final List<Integer> ACTIVE_PROJECT_HISTORY = List.of(3, 4, 4, 5, 5);

    private static final List<Double> VELOCITY_HISTORY = List.of(71.0, 76.0, 80.0, 84.0, 88.0, 94.2);
    private static final double VELOCITY_TARGET = 100.0;

    private static final AiUsage AI_USAGE = new AiUsage(
            List.of(8.0, 14.0, 19.0, 24.0, 29.0, 34.0), 86, 1280);

    private static final BurndownData BURNDOWN = new BurndownData(
            120, List.of(120, 114, 106, 98, 90, 81, 72, 63, 53, 42));

    private static final List<TeamLoadRecord> TEAM_LOAD = List.of(
            new TeamLoadRecord("Alex Rivera", 40),
            new TeamLoadRecord("Elena Vance", 32),
            new TeamLoadRecord("Marcus Chen", 56),
            new TeamLoadRecord("Sophia Patel", 25),
            new TeamLoadRecord("David Kim", 36));

    private static final AssigneeRecord ALEX = new AssigneeRecord(
            "Alex Rivera", "AR", "bg-primary-container text-on-primary-container");
    private static final AssigneeRecord ELENA = new AssigneeRecord(
            "Elena Vance", "EV", "bg-secondary-container text-on-secondary-container");
    private static final AssigneeRecord MARCUS = new AssigneeRecord(
            "Marcus Chen", "MC", "bg-tertiary-container text-on-tertiary-container");
    private static final AssigneeRecord SOPHIA = new AssigneeRecord(
            "Sophia Patel", "SP", "bg-surface-container-highest text-on-surface");
    private static final AssigneeRecord DAVID = new AssigneeRecord(
            "David Kim", "DK", "bg-primary text-on-primary");

    /* ======================================================================
       Mutable state
       ====================================================================== */

    /** Guards every read and write of {@link #projects}. */
    private final Object lock = new Object();

    private final List<ProjectRecord> projects = new ArrayList<>(List.of(
            new ProjectRecord("p1", "PRJ-101", "Realtime Multi-Agent Orchestrator",
                    "Core engine phase 2: event bus, agent scheduling and state replication.",
                    "In Progress", "bg-primary/20 text-primary", "from-primary to-secondary",
                    17, 25, "Oct 22", false, List.of(ALEX, ELENA)),
            new ProjectRecord("p2", "PRJ-102", "Kinetic UI Token Library",
                    "Shader synthesis and design tokens shared across client surfaces.",
                    "In Progress", "bg-primary/20 text-primary", "from-tertiary to-primary",
                    13, 24, "Oct 20", true, List.of(MARCUS)),
            new ProjectRecord("p3", "PRJ-103", "Zero-Trust Access Control",
                    "Neural boundary gateway with cryptographic session verification.",
                    "QA Review", "bg-secondary/20 text-secondary", "from-secondary to-primary",
                    29, 32, "Oct 18", true, List.of(ELENA, DAVID)),
            new ProjectRecord("p4", "PRJ-104", "Hyperion Client Portal",
                    "Customer-facing dashboards, billing views and onboarding.",
                    "Review Required", "bg-error/20 text-error", "from-error to-tertiary",
                    19, 25, "Oct 25", false, List.of(MARCUS, SOPHIA)),
            new ProjectRecord("p5", "PRJ-105", "Global Kubernetes Mesh",
                    "TPU cluster expansion and infrastructure hardening.",
                    "Ready for Staging", "bg-tertiary/20 text-tertiary", "from-primary to-tertiary",
                    22, 25, "Nov 02", false, List.of(DAVID, ALEX)),
            new ProjectRecord("p6", "PRJ-106", "Neural Prompt Evaluation Pipeline",
                    "Benchmark harness for comparing engine versions.",
                    "Planning", "bg-outline/20 text-on-surface-variant", "from-secondary to-tertiary",
                    3, 26, "Nov 14", false, List.of(SOPHIA))));

    /** Next number to use for a new project's id ("p7") and code ("PRJ-107"). */
    private final AtomicInteger projectSeq = new AtomicInteger(7);

    /* ======================================================================
       Project queries and commands
       ====================================================================== */

    /** All projects in insertion order. The returned list is an immutable copy. */
    public List<ProjectRecord> findAllProjects() {
        synchronized (lock) {
            return List.copyOf(projects);
        }
    }

    public Optional<ProjectRecord> findProjectById(String id) {
        synchronized (lock) {
            return projects.stream().filter(p -> p.id().equals(id)).findFirst();
        }
    }

    /** Reserves the next project number. Use it to build the id and code of a new project. */
    public int nextProjectNumber() {
        return projectSeq.getAndIncrement();
    }

    /** Inserts a new project, or replaces the one with the same id. */
    public ProjectRecord saveProject(ProjectRecord project) {
        synchronized (lock) {
            for (int i = 0; i < projects.size(); i++) {
                if (projects.get(i).id().equals(project.id())) {
                    projects.set(i, project);
                    return project;
                }
            }
            projects.add(project);
            return project;
        }
    }

    /**
     * Atomically adds one open task to a project.
     *
     * @return the updated project, or empty if the id does not exist
     */
    public Optional<ProjectRecord> addOpenTask(String projectId) {
        synchronized (lock) {
            for (int i = 0; i < projects.size(); i++) {
                ProjectRecord current = projects.get(i);
                if (current.id().equals(projectId)) {
                    ProjectRecord updated = current.withTasks(
                            current.completedTasks(), current.totalTasks() + 1);
                    projects.set(i, updated);
                    return Optional.of(updated);
                }
            }
            return Optional.empty();
        }
    }

    /* ======================================================================
       Dashboard metrics and workload data
       ====================================================================== */

    public SprintInfo findCurrentSprint() {
        return CURRENT_SPRINT;
    }

    public int findWeeklyCapacityHours() {
        return WEEKLY_CAPACITY_HOURS;
    }

    /** Active project counts for past periods, oldest first (excludes the current count). */
    public List<Integer> findActiveProjectHistory() {
        return ACTIVE_PROJECT_HISTORY;
    }

    /** Velocity per sprint, oldest first. The last entry is the current sprint. */
    public List<Double> findVelocityHistory() {
        return VELOCITY_HISTORY;
    }

    public double findVelocityTarget() {
        return VELOCITY_TARGET;
    }

    public AiUsage findAiUsage() {
        return AI_USAGE;
    }

    public BurndownData findBurndown() {
        return BURNDOWN;
    }

    public List<TeamLoadRecord> findTeamLoad() {
        return TEAM_LOAD;
    }
}