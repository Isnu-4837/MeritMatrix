package com.example.demo.service;

import com.example.demo.repository.DashboardRepository;
import com.example.demo.repository.DashboardRepository.AiUsage;
import com.example.demo.repository.DashboardRepository.BurndownData;
import com.example.demo.repository.DashboardRepository.ProjectRecord;
import com.example.demo.repository.DashboardRepository.SprintInfo;
import com.example.demo.repository.DashboardRepository.TeamLoadRecord;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Stream;

/**
 * Business logic behind DashboardPage.jsx.
 *
 * Reads raw data from {@link DashboardRepository} and computes everything
 * derived from it (progress percentages, deltas, insight text, filtering,
 * searching, sorting). DashboardController only handles HTTP and delegates here.
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
            List<Assignee> assignees) {}

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
       Constants
       ====================================================================== */

    private static final List<String> FILTERS = List.of("all", "in_progress", "review");
    private static final List<String> SORTS = List.of("default", "progress", "name");
    private static final DateTimeFormatter DUE_FORMAT = DateTimeFormatter.ofPattern("MMM dd", Locale.US);

    /* ======================================================================
       Dependencies
       ====================================================================== */

    private final DashboardRepository repo;

    public DashboardService(DashboardRepository repo) {
        this.repo = repo;
    }

    /* ======================================================================
       Public API
       ====================================================================== */

    /** Everything the dashboard renders, in one call. */
    public DashboardResponse dashboard(String userName) {
        SprintInfo sprint = repo.findCurrentSprint();
        List<Project> snapshot = snapshot();
        return new DashboardResponse(
                userName,
                sprint.number(), sprint.day(), sprint.length(), sprint.onSchedulePercent(),
                metrics(snapshot, sprint),
                burndown(sprint),
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
        return repo.findProjectById(id)
                .map(DashboardService::toProject)
                .orElseThrow(() -> new ProjectNotFoundException(id));
    }

    /** "New project": starts in Planning with no tasks and no assignees. */
    public Project createProject(String title, String description, LocalDate dueDate) {
        int n = repo.nextProjectNumber();
        ProjectRecord created = new ProjectRecord(
                "p" + n, "PRJ-" + (100 + n), title.trim(),
                description == null || description.isBlank() ? "No description yet." : description.trim(),
                "Planning", "bg-outline/20 text-on-surface-variant", "from-primary to-secondary",
                0, 0,
                dueDate == null ? "TBD" : dueDate.format(DUE_FORMAT),
                false, List.of());
        return toProject(repo.saveProject(created));
    }

    /** "Quick Task": adds one open task and recalculates the project's progress. */
    public Project addQuickTask(String projectId) {
        return repo.addOpenTask(projectId)
                .map(DashboardService::toProject)
                .orElseThrow(() -> new ProjectNotFoundException(projectId));
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
        return new SprintPlan(cleanGoal, repo.findCurrentSprint().number() + 1, items);
    }

    /* ======================================================================
       Mapping (repository records -> response types)
       ====================================================================== */

    private static Project toProject(ProjectRecord r) {
        int pct = r.totalTasks() == 0 ? 0 : Math.round(r.completedTasks() * 100f / r.totalTasks());
        List<Assignee> assignees = r.assignees().stream()
                .map(a -> new Assignee(a.name(), a.initials(), a.color()))
                .toList();
        return new Project(r.id(), r.code(), r.title(), r.description(), r.status(),
                r.statusColor(), r.accentGradient(), pct, r.completedTasks(), r.totalTasks(),
                r.dueDate(), r.urgent(), assignees);
    }

    private static TeamLoad toTeamLoad(TeamLoadRecord t) {
        return new TeamLoad(t.name(), t.hours());
    }

    /* ======================================================================
       Derived values
       ====================================================================== */

    private List<Project> snapshot() {
        return repo.findAllProjects().stream().map(DashboardService::toProject).toList();
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

    private List<Metric> metrics(List<Project> list, SprintInfo sprint) {
        return List.of(activeProjectsMetric(list), velocityMetric(sprint), aiMetric());
    }

    private Metric activeProjectsMetric(List<Project> list) {
        List<Integer> history = repo.findActiveProjectHistory();
        int current = list.size();
        int previous = history.get(history.size() - 1);
        int trend = previous == 0 ? 0 : Math.round((current - previous) * 100f / previous);
        int urgent = (int) list.stream().filter(Project::isUrgent).count();
        int onTrackPercent = current == 0 ? 100 : Math.round((current - urgent) * 100f / current);

        List<Double> spark = new ArrayList<>();
        history.forEach(v -> spark.add(v.doubleValue()));
        spark.add((double) current);

        return new Metric("projects", "Active Projects", "folder", "text-primary",
                current, 0, null,
                new Badge("trend", String.format(Locale.US, "%+d%%", trend)),
                urgent + " near deadline",
                urgent * 2 > current ? "At risk" : "On schedule",
                onTrackPercent, spark);
    }

    private Metric velocityMetric(SprintInfo sprint) {
        List<Double> history = repo.findVelocityHistory();
        double current = history.get(history.size() - 1);
        double previous = history.get(history.size() - 2);
        double delta = Math.round((current - previous) * 10) / 10.0;

        List<TeamLoadRecord> team = repo.findTeamLoad();
        int booked = team.stream().mapToInt(TeamLoadRecord::hours).sum();
        int available = team.size() * repo.findWeeklyCapacityHours();
        int capacityPercent = available == 0 ? 0 : Math.round(booked * 100f / available);

        return new Metric("velocity", "Sprint Velocity", "bolt", "text-secondary",
                current, 1, "pts",
                new Badge("delta", String.format(Locale.US, "%+.1f delta", delta)),
                capacityPercent + "% team capacity",
                "T-" + (sprint.length() - sprint.day() - 1) + " days remaining",
                (int) Math.min(100, Math.round(current * 100 / repo.findVelocityTarget())),
                history);
    }

    private Metric aiMetric() {
        AiUsage ai = repo.findAiUsage();
        List<Double> history = ai.hoursSavedHistory();
        double hoursSaved = history.get(history.size() - 1);
        return new Metric("ai", "AI Automation", "auto_awesome", "text-tertiary",
                hoursSaved, 0, "hrs", new Badge("pill", "Saved"),
                String.format(Locale.US, "%,d neural actions run", ai.neuralActions()), "Neural v3.4",
                ai.progressPercent(), history);
    }

    /** Ahead of schedule means fewer points are left today than the ideal line allows. */
    private Burndown burndown(SprintInfo sprint) {
        BurndownData data = repo.findBurndown();
        double idealToday = data.totalPoints()
                - (double) data.totalPoints() * sprint.day() / sprint.length();
        int last = data.actual().get(data.actual().size() - 1);
        double ahead = idealToday - last;
        return new Burndown(data.totalPoints(), sprint.length(), sprint.day(), data.actual(),
                ahead >= 0, Math.round(Math.abs(ahead) * 10) / 10.0);
    }

    private Workload workload() {
        int capacity = repo.findWeeklyCapacityHours();
        List<TeamLoad> team = repo.findTeamLoad().stream().map(DashboardService::toTeamLoad).toList();

        int over = (int) team.stream().filter(m -> m.hours() > capacity).count();

        TeamLoad busiest = team.stream().max(Comparator.comparingInt(TeamLoad::hours)).orElse(null);
        TeamLoad freest = team.stream().min(Comparator.comparingInt(TeamLoad::hours)).orElse(null);

        String insight = null;
        if (busiest != null && freest != null && busiest.hours() > capacity) {
            insight = busiest.name() + " is " + (busiest.hours() - capacity) + "h over. "
                    + freest.name() + " has " + (capacity - freest.hours()) + "h free.";
        }
        return new Workload(capacity, team, over, insight);
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