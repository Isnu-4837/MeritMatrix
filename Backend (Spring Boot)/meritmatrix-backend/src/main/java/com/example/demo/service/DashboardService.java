package com.example.demo.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;

/**
 * Business logic behind DashboardPage.jsx.
 *
 * Owns the project store, the dashboard metrics, the burndown, the team
 * workload and the sprint-plan draft. DashboardController only handles HTTP
 * and delegates here.
 *
 * Data is held in memory so the class runs on its own. To go live, replace
 * the project store with a repository and the constants with queries, and keep
 * the derived values (percentages, deltas, insight text) computed here.
 *
 * Requires Spring Boot 3.x and Java 17+.
 */
@Service
public class DashboardService {

    /* ======================================================================
       Types returned to the controller (serialized as-is by Jackson)
       ====================================================================== */

    public record Assignee(String name, String initials, String color) {}

    public record Project(
            String id,
            String code,
            String title,
            String description,
            String status,
            String statusColor,
            String accentGradient,
            int progressPercent,
            int completedTasks,
            int totalTasks,
            String dueDate,
            @JsonProperty("isUrgent") boolean isUrgent,
            List<Assignee> assignees) {

        Project withTasks(int completed, int total) {
            int pct = total == 0 ? 0 : Math.round(completed * 100f / total);
            return new Project(id, code, title, description, status, statusColor, accentGradient,
                    pct, completed, total, dueDate, isUrgent, assignees);
        }
    }

    public record Badge(String kind, String text) {}

    public record Metric(
            String id, String label, String icon, String iconTone,
            double value, int decimals, String unit, Badge badge,
            String left, String right, int progress, List<Double> spark) {}

    public record Burndown(
            int total,
            int days,
            int today,
            List<Integer> actual,
            boolean aheadOfSchedule,
            double pointsAhead) {}

    public record TeamLoad(String name, int hours) {}

    public record Workload(int weeklyCapacity, List<TeamLoad> members, int overCount, String insight) {}

    public record StatusSlice(String id, String label, int count, double percent) {}

    public record DashboardResponse(
            String greetingName,
            int sprintNumber,
            int sprintDay,
            int sprintLength,
            int sprintOnSchedulePercent,
            List<Metric> metrics,
            Burndown burndown,
            Workload workload,
            List<StatusSlice> statusBreakdown,
            List<Project> projects) {}

    public record SprintPlanItem(String projectId, String projectTitle, String suggestion) {}

    public record SprintPlan(String goal, int sprintNumber, List<SprintPlanItem> items) {}

    /** Unknown project id. Spring turns it into a 404. */
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public static class ProjectNotFoundException extends RuntimeException {
        public ProjectNotFoundException(String id) {
            super("Project not found: " + id);
        }
    }

    /** Unknown filter or sort value. Spring turns it into a 400. */
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public static class InvalidQueryException extends RuntimeException {
        public InvalidQueryException(String message) {
            super(message);
        }
    }

    /* ======================================================================
       Constants and sample data
       ====================================================================== */

    private static final int SPRINT_NUMBER = 14;
    private static final int SPRINT_DAY = 9;
    private static final int SPRINT_LENGTH = 14;
    private static final int SPRINT_ON_SCHEDULE_PERCENT = 84; // sample figure, no source to derive it from yet
    private static final int WEEKLY_CAPACITY = 40;

    private static final List<Integer> ACTIVE_PROJECT_HISTORY = List.of(3, 4, 4, 5, 5);
    private static final List<Double> VELOCITY_HISTORY = List.of(71.0, 76.0, 80.0, 84.0, 88.0, 94.2);
    private static final double VELOCITY_TARGET = 100.0;
    private static final List<Double> AI_HOURS_SAVED_HISTORY = List.of(8.0, 14.0, 19.0, 24.0, 29.0, 34.0);
    private static final int AI_PROGRESS_PERCENT = 86;
    private static final int NEURAL_ACTIONS = 1280;

    private static final int BURNDOWN_TOTAL = 120;
    private static final List<Integer> BURNDOWN_ACTUAL =
            List.of(120, 114, 106, 98, 90, 81, 72, 63, 53, 42); // points left, day 0 to today

    private static final List<TeamLoad> TEAM_LOAD = List.of(
            new TeamLoad("Alex Rivera", 40), new TeamLoad("Elena Vance", 32),
            new TeamLoad("Marcus Chen", 56), new TeamLoad("Sophia Patel", 25),
            new TeamLoad("David Kim", 36));

    private static final List<String> FILTERS = List.of("all", "in_progress", "review");
    private static final List<String> SORTS = List.of("default", "progress", "name");
    private static final DateTimeFormatter DUE_FORMAT = DateTimeFormatter.ofPattern("MMM dd", Locale.US);

    private static final Assignee ALEX = new Assignee("Alex Rivera", "AR", "bg-primary-container text-on-primary-container");
    private static final Assignee ELENA = new Assignee("Elena Vance", "EV", "bg-secondary-container text-on-secondary-container");
    private static final Assignee MARCUS = new Assignee("Marcus Chen", "MC", "bg-tertiary-container text-on-tertiary-container");
    private static final Assignee SOPHIA = new Assignee("Sophia Patel", "SP", "bg-surface-container-highest text-on-surface");
    private static final Assignee DAVID = new Assignee("David Kim", "DK", "bg-primary text-on-primary");

    private final List<Project> projects = Collections.synchronizedList(new ArrayList<>(List.of(
            new Project("p1", "PRJ-101", "Realtime Multi-Agent Orchestrator",
                    "Core engine phase 2: event bus, agent scheduling and state replication.",
                    "In Progress", "bg-primary/20 text-primary", "from-primary to-secondary",
                    68, 17, 25, "Oct 22", false, List.of(ALEX, ELENA)),
            new Project("p2", "PRJ-102", "Kinetic UI Token Library",
                    "Shader synthesis and design tokens shared across client surfaces.",
                    "In Progress", "bg-primary/20 text-primary", "from-tertiary to-primary",
                    54, 13, 24, "Oct 20", true, List.of(MARCUS)),
            new Project("p3", "PRJ-103", "Zero-Trust Access Control",
                    "Neural boundary gateway with cryptographic session verification.",
                    "QA Review", "bg-secondary/20 text-secondary", "from-secondary to-primary",
                    91, 29, 32, "Oct 18", true, List.of(ELENA, DAVID)),
            new Project("p4", "PRJ-104", "Hyperion Client Portal",
                    "Customer-facing dashboards, billing views and onboarding.",
                    "Review Required", "bg-error/20 text-error", "from-error to-tertiary",
                    76, 19, 25, "Oct 25", false, List.of(MARCUS, SOPHIA)),
            new Project("p5", "PRJ-105", "Global Kubernetes Mesh",
                    "TPU cluster expansion and infrastructure hardening.",
                    "Ready for Staging", "bg-tertiary/20 text-tertiary", "from-primary to-tertiary",
                    88, 22, 25, "Nov 02", false, List.of(DAVID, ALEX)),
            new Project("p6", "PRJ-106", "Neural Prompt Evaluation Pipeline",
                    "Benchmark harness for comparing engine versions.",
                    "Planning", "bg-outline/20 text-on-surface-variant", "from-secondary to-tertiary",
                    12, 3, 26, "Nov 14", false, List.of(SOPHIA))
    )));

    private final AtomicInteger idSeq = new AtomicInteger(7);

    /* ======================================================================
       Public API
       ====================================================================== */

    /** Everything the dashboard renders, in one call. */
    public DashboardResponse dashboard(String userName) {
        List<Project> snapshot = snapshot();
        return new DashboardResponse(
                userName,
                SPRINT_NUMBER, SPRINT_DAY, SPRINT_LENGTH, SPRINT_ON_SCHEDULE_PERCENT,
                metrics(snapshot),
                burndown(),
                workload(),
                statusBreakdown(snapshot),
                snapshot);
    }

    /**
     * Mirrors the page's controls.
     *
     * @param filter all | in_progress | review
     * @param query  matches title, code, description, status or assignee name
     * @param sort   default | progress | name
     */
    public List<Project> listProjects(String filter, String query, String sort) {
        if (!FILTERS.contains(filter)) throw new InvalidQueryException("Unknown filter: " + filter);
        if (!SORTS.contains(sort)) throw new InvalidQueryException("Unknown sort: " + sort);

        String needle = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);

        Comparator<Project> order = switch (sort) {
            case "progress" -> Comparator.comparingInt(Project::progressPercent).reversed();
            case "name" -> Comparator.comparing(Project::title, String.CASE_INSENSITIVE_ORDER);
            default -> (a, b) -> 0; // stable sort keeps insertion order
        };

        return snapshot().stream()
                .filter(p -> matchesFilter(p, filter))
                .filter(p -> needle.isEmpty() || matchesQuery(p, needle))
                .sorted(order)
                .toList();
    }

    public Project getProject(String id) {
        return snapshot().stream()
                .filter(p -> p.id().equals(id))
                .findFirst()
                .orElseThrow(() -> new ProjectNotFoundException(id));
    }

    /** "New project": starts in Planning with no tasks and no assignees. */
    public Project createProject(String title, String description, LocalDate dueDate) {
        int n = idSeq.getAndIncrement();
        Project created = new Project(
                "p" + n, "PRJ-" + (100 + n), title.trim(),
                description == null || description.isBlank() ? "No description yet." : description.trim(),
                "Planning", "bg-outline/20 text-on-surface-variant", "from-primary to-secondary",
                0, 0, 0,
                dueDate == null ? "TBD" : dueDate.format(DUE_FORMAT),
                false, List.of());
        projects.add(created);
        return created;
    }

    /** "Quick Task": adds one open task and recalculates the project's progress. */
    public Project addQuickTask(String projectId) {
        synchronized (projects) {
            Project current = getProject(projectId);
            Project updated = current.withTasks(current.completedTasks(), current.totalTasks() + 1);
            projects.set(projects.indexOf(current), updated);
            return updated;
        }
    }

    /**
     * "Generate sprint plan": a placeholder planner that suggests the least
     * complete unfinished projects first. Swap in your real planning or AI call.
     */
    public SprintPlan generateSprintPlan(String goal) {
        String cleanGoal = goal == null ? "" : goal.trim();
        List<SprintPlanItem> items = snapshot().stream()
                .filter(p -> p.progressPercent() < 100)
                .sorted(Comparator.comparingInt(Project::progressPercent))
                .limit(5)
                .map(p -> new SprintPlanItem(p.id(), p.title(),
                        "Close " + (p.totalTasks() - p.completedTasks()) + " open task(s)"))
                .toList();
        return new SprintPlan(cleanGoal, SPRINT_NUMBER + 1, items);
    }

    /* ======================================================================
       Derived values
       ====================================================================== */

    private List<Project> snapshot() {
        synchronized (projects) {
            return List.copyOf(projects);
        }
    }

    private static boolean matchesFilter(Project p, String filter) {
        return switch (filter) {
            case "in_progress" -> "In Progress".equals(p.status());
            case "review" -> "QA Review".equals(p.status()) || "Review Required".equals(p.status());
            default -> true;
        };
    }

    private static boolean matchesQuery(Project p, String needle) {
        return Stream.concat(
                        Stream.of(p.title(), p.code(), p.description(), p.status()),
                        p.assignees().stream().map(Assignee::name))
                .filter(Objects::nonNull)
                .anyMatch(s -> s.toLowerCase(Locale.ROOT).contains(needle));
    }

    private List<Metric> metrics(List<Project> list) {
        return List.of(activeProjectsMetric(list), velocityMetric(), aiMetric());
    }

    private static Metric activeProjectsMetric(List<Project> list) {
        int current = list.size();
        int previous = ACTIVE_PROJECT_HISTORY.get(ACTIVE_PROJECT_HISTORY.size() - 1);
        int trend = previous == 0 ? 0 : Math.round((current - previous) * 100f / previous);
        int urgent = (int) list.stream().filter(Project::isUrgent).count();
        int onTrackPercent = current == 0 ? 100 : Math.round((current - urgent) * 100f / current);

        List<Double> spark = new ArrayList<>();
        ACTIVE_PROJECT_HISTORY.forEach(v -> spark.add(v.doubleValue()));
        spark.add((double) current);

        return new Metric("projects", "Active Projects", "folder", "text-primary",
                current, 0, null,
                new Badge("trend", String.format(Locale.US, "%+d%%", trend)),
                urgent + " near deadline",
                urgent * 2 > current ? "At risk" : "On schedule",
                onTrackPercent, spark);
    }

    private static Metric velocityMetric() {
        double current = VELOCITY_HISTORY.get(VELOCITY_HISTORY.size() - 1);
        double previous = VELOCITY_HISTORY.get(VELOCITY_HISTORY.size() - 2);
        double delta = Math.round((current - previous) * 10) / 10.0;

        int booked = TEAM_LOAD.stream().mapToInt(TeamLoad::hours).sum();
        int available = TEAM_LOAD.size() * WEEKLY_CAPACITY;
        int capacityPercent = available == 0 ? 0 : Math.round(booked * 100f / available);

        return new Metric("velocity", "Sprint Velocity", "bolt", "text-secondary",
                current, 1, "pts",
                new Badge("delta", String.format(Locale.US, "%+.1f delta", delta)),
                capacityPercent + "% team capacity",
                "T-" + (SPRINT_LENGTH - SPRINT_DAY - 1) + " days remaining",
                (int) Math.min(100, Math.round(current * 100 / VELOCITY_TARGET)),
                VELOCITY_HISTORY);
    }

    private static Metric aiMetric() {
        double hoursSaved = AI_HOURS_SAVED_HISTORY.get(AI_HOURS_SAVED_HISTORY.size() - 1);
        return new Metric("ai", "AI Automation", "auto_awesome", "text-tertiary",
                hoursSaved, 0, "hrs", new Badge("pill", "Saved"),
                String.format(Locale.US, "%,d neural actions run", NEURAL_ACTIONS), "Neural v3.4",
                AI_PROGRESS_PERCENT, AI_HOURS_SAVED_HISTORY);
    }

    /** Ahead of schedule means fewer points are left today than the ideal line allows. */
    private static Burndown burndown() {
        double idealToday = BURNDOWN_TOTAL - (double) BURNDOWN_TOTAL * SPRINT_DAY / SPRINT_LENGTH;
        int last = BURNDOWN_ACTUAL.get(BURNDOWN_ACTUAL.size() - 1);
        double ahead = idealToday - last;
        return new Burndown(BURNDOWN_TOTAL, SPRINT_LENGTH, SPRINT_DAY, BURNDOWN_ACTUAL,
                ahead >= 0, Math.round(Math.abs(ahead) * 10) / 10.0);
    }

    private static Workload workload() {
        int over = (int) TEAM_LOAD.stream().filter(m -> m.hours() > WEEKLY_CAPACITY).count();

        TeamLoad busiest = TEAM_LOAD.stream().max(Comparator.comparingInt(TeamLoad::hours)).orElse(null);
        TeamLoad freest = TEAM_LOAD.stream().min(Comparator.comparingInt(TeamLoad::hours)).orElse(null);

        String insight = null;
        if (busiest != null && freest != null && busiest.hours() > WEEKLY_CAPACITY) {
            insight = busiest.name() + " is " + (busiest.hours() - WEEKLY_CAPACITY) + "h over. "
                    + freest.name() + " has " + (WEEKLY_CAPACITY - freest.hours()) + "h free.";
        }
        return new Workload(WEEKLY_CAPACITY, TEAM_LOAD, over, insight);
    }

    /** Groups for the donut: in progress, in review, planning, other (empty groups are dropped). */
    private static List<StatusSlice> statusBreakdown(List<Project> list) {
        int total = list.size();
        if (total == 0) return List.of();

        Map<String, Integer> counts = new LinkedHashMap<>();
        counts.put("progress", 0);
        counts.put("review", 0);
        counts.put("planning", 0);
        counts.put("other", 0);
        for (Project p : list) {
            String key = switch (p.status()) {
                case "In Progress" -> "progress";
                case "QA Review", "Review Required" -> "review";
                case "Planning" -> "planning";
                default -> "other";
            };
            counts.merge(key, 1, Integer::sum);
        }

        Map<String, String> labels = Map.of(
                "progress", "In progress", "review", "In review", "planning", "Planning", "other", "Other");

        return counts.entrySet().stream()
                .filter(e -> e.getValue() > 0)
                .map(e -> new StatusSlice(e.getKey(), labels.get(e.getKey()), e.getValue(),
                        e.getValue() * 100.0 / total))
                .toList();
    }
}