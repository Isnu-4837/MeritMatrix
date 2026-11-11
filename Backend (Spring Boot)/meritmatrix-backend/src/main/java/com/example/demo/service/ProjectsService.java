package com.example.demo.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Business logic behind ProjectsPage.jsx.
 *
 * Owns the workstream store, the overview stats and the filter / search / sort /
 * group logic. ProjectsController only handles HTTP and delegates here.
 *
 * Data is held in memory so the class runs on its own. To go live, replace the
 * store with a repository and keep the derived values (progress, due soon,
 * overview, counts) computed here.
 *
 * Requires Spring Boot 3.x and Java 17+.
 */
@Service
public class ProjectsService {

    /* ======================================================================
       Types returned to the controller (serialized as-is by Jackson)
       ====================================================================== */

    public record Assignee(String name, String initials, String color) {}

    public record Task(String id, String title, boolean done) {}

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
            List<Assignee> assignees,
            List<Task> tasks) {}

    /** The stats panel and the per-status counts on the filter tabs (counts ignore filters). */
    public record Overview(
            int workstreams,
            int averageCompletion,
            int dueSoon,
            int tasksDone,
            int tasksTotal,
            Map<String, Integer> countsByStatus) {}

    /** One flat section ("all") or one section per status when grouping. */
    public record Section(String key, String title, List<Project> items) {}

    public record ProjectsResponse(Overview overview, int shown, int total, List<Section> sections) {}

    /** Unknown project id. Spring turns it into a 404. */
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public static class ProjectNotFoundException extends RuntimeException {
        public ProjectNotFoundException(String id) {
            super("Project not found: " + id);
        }
    }

    /** Unknown task id. Spring turns it into a 404. */
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public static class TaskNotFoundException extends RuntimeException {
        public TaskNotFoundException(String id) {
            super("Task not found: " + id);
        }
    }

    /** Unknown status or sort value. Spring turns it into a 400. */
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public static class InvalidQueryException extends RuntimeException {
        public InvalidQueryException(String message) {
            super(message);
        }
    }

    /** Statuses in tab order, each with the classes the page uses for the pill and accent bar. */
    public enum Status {
        IN_PROGRESS("In Progress", "bg-primary/20 text-primary", "from-primary to-secondary"),
        QA_REVIEW("QA Review", "bg-secondary/20 text-secondary", "from-secondary to-primary"),
        READY_FOR_STAGING("Ready for Staging", "bg-tertiary/20 text-tertiary", "from-primary to-tertiary"),
        PLANNING("Planning", "bg-outline/20 text-on-surface-variant", "from-secondary to-tertiary"),
        REVIEW_REQUIRED("Review Required", "bg-error/20 text-error", "from-error to-tertiary");

        private final String label;
        private final String color;
        private final String gradient;

        Status(String label, String color, String gradient) {
            this.label = label;
            this.color = color;
            this.gradient = gradient;
        }

        public String label() { return label; }

        static Status fromLabel(String label) {
            return Arrays.stream(values())
                    .filter(s -> s.label.equalsIgnoreCase(label) || s.name().equalsIgnoreCase(label))
                    .findFirst()
                    .orElseThrow(() -> new InvalidQueryException("Unknown status: " + label));
        }
    }

    /* ======================================================================
       Constants and sample data
       ====================================================================== */

    /** A workstream is "due soon" if it is due within this many days (overdue counts too). */
    private static final int URGENT_WITHIN_DAYS = 7;

    private static final List<String> SORTS = List.of("default", "progress-desc", "progress-asc", "urgent", "name");
    private static final DateTimeFormatter DUE_FORMAT = DateTimeFormatter.ofPattern("MMM dd", Locale.US);

    private static final Assignee ALEX = new Assignee("Alex Rivera", "AR", "bg-primary-container text-on-primary-container");
    private static final Assignee ELENA = new Assignee("Elena Vance", "EV", "bg-secondary-container text-on-secondary-container");
    private static final Assignee MARCUS = new Assignee("Marcus Chen", "MC", "bg-tertiary-container text-on-tertiary-container");
    private static final Assignee SOPHIA = new Assignee("Sophia Patel", "SP", "bg-surface-container-highest text-on-surface");
    private static final Assignee DAVID = new Assignee("David Kim", "DK", "bg-primary text-on-primary");

    /** Internal shape. The public Project record is derived from it on every read. */
    private record Stored(
            String id, String code, String title, String description,
            Status status, LocalDate dueDate, List<Assignee> assignees, List<Task> tasks) {

        Stored withTasks(List<Task> newTasks) {
            return new Stored(id, code, title, description, status, dueDate, assignees, newTasks);
        }
    }

    private final Clock clock = Clock.systemDefaultZone();
    private final AtomicInteger projectSeq = new AtomicInteger(1);
    private final AtomicInteger taskSeq = new AtomicInteger(1);
    private final List<Stored> store = Collections.synchronizedList(new ArrayList<>());

    public ProjectsService() {
        LocalDate today = LocalDate.now(clock);

        seed("Realtime Multi-Agent Orchestrator",
                "Core engine phase 2: event bus, agent scheduling and state replication.",
                Status.IN_PROGRESS, today.plusDays(12), List.of(ALEX, ELENA), 4,
                "Core interface architecture and token bindings", "Event bus streaming integration",
                "Agent scheduler", "State replication", "Load testing", "Rollout runbook");

        seed("Kinetic UI Token Library",
                "Shader synthesis and design tokens shared across client surfaces.",
                Status.IN_PROGRESS, today.plusDays(4), List.of(MARCUS), 3,
                "Token schema", "Shader pipeline test suite", "Theme switching", "Docs site", "Release candidate");

        seed("Zero-Trust Access Control",
                "Neural boundary gateway with cryptographic session verification.",
                Status.QA_REVIEW, today.plusDays(2), List.of(ELENA, DAVID), 5,
                "Gateway policy engine", "Session verification", "Audit log", "Penetration test fixes", "Sign-off");

        seed("Hyperion Client Portal",
                "Customer-facing dashboards, billing views and onboarding.",
                Status.REVIEW_REQUIRED, today.plusDays(15), List.of(MARCUS, SOPHIA), 3,
                "Dashboards", "Billing views", "Onboarding flow insight copy", "Accessibility review");

        seed("Global Kubernetes Mesh",
                "TPU cluster expansion and infrastructure hardening.",
                Status.READY_FOR_STAGING, today.plusDays(23), List.of(DAVID, ALEX), 4,
                "Cluster expansion", "Network policies", "Autoscaling", "Staging smoke tests", "Cost report");

        seed("Neural Prompt Evaluation Pipeline",
                "Benchmark harness for comparing engine versions.",
                Status.PLANNING, today.plusDays(30), List.of(SOPHIA), 0,
                "Define benchmark set", "Harness skeleton", "Scoring rubric", "Dashboard");
    }

    /* ======================================================================
       Public API
       ====================================================================== */

    /**
     * Mirrors the page's controls.
     *
     * @param status     All, or a status label such as "In Progress"
     * @param query      matches title, code or description
     * @param urgentOnly only workstreams that are due soon
     * @param sort       default | progress-desc | progress-asc | urgent | name
     * @param grouped    one section per status instead of a single flat section
     */
    public ProjectsResponse query(String status, String query, boolean urgentOnly, String sort, boolean grouped) {
        if (!SORTS.contains(sort)) throw new InvalidQueryException("Unknown sort: " + sort);
        String statusLabel = isAll(status) ? null : Status.fromLabel(status).label();
        String needle = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);

        List<Project> all = all();

        Comparator<Project> order = switch (sort) {
            case "progress-desc" -> Comparator.comparingInt(Project::progressPercent).reversed();
            case "progress-asc" -> Comparator.comparingInt(Project::progressPercent);
            case "urgent" -> Comparator.comparing((Project p) -> !p.isUrgent()); // urgent first
            case "name" -> Comparator.comparing(Project::title, String.CASE_INSENSITIVE_ORDER);
            default -> (a, b) -> 0; // stable sort keeps insertion order
        };

        List<Project> shown = all.stream()
                .filter(p -> statusLabel == null || p.status().equals(statusLabel))
                .filter(p -> !urgentOnly || p.isUrgent())
                .filter(p -> needle.isEmpty() || matchesQuery(p, needle))
                .sorted(order)
                .toList();

        return new ProjectsResponse(overview(all), shown.size(), all.size(), sections(shown, grouped));
    }

    public Project get(String id) {
        return toDto(find(id));
    }

    /** "New workstream": defaults to Planning, no assignees, one open task per non-blank title. */
    public Project create(String title, String description, String status, LocalDate dueDate, List<String> taskTitles) {
        Status s = status == null || status.isBlank() ? Status.PLANNING : Status.fromLabel(status);
        int n = projectSeq.getAndIncrement();

        List<Task> tasks = new ArrayList<>();
        if (taskTitles != null) {
            for (String t : taskTitles) {
                if (t != null && !t.isBlank()) tasks.add(new Task(nextTaskId(), t.trim(), false));
            }
        }

        Stored created = new Stored(
                "p" + n, "PRJ-" + (100 + n), title.trim(),
                description == null || description.isBlank() ? "No description yet." : description.trim(),
                s, dueDate, List.of(), List.copyOf(tasks));
        store.add(created);
        return toDto(created);
    }

    /** "Quick task": adds an open subtask and recalculates the project's progress. */
    public Project addTask(String projectId, String title) {
        synchronized (store) {
            int i = indexOf(projectId);
            Stored current = store.get(i);
            List<Task> tasks = new ArrayList<>(current.tasks());
            tasks.add(new Task(nextTaskId(), title.trim(), false));
            Stored updated = current.withTasks(List.copyOf(tasks));
            store.set(i, updated);
            return toDto(updated);
        }
    }

    /** Ticks or unticks a subtask and recalculates the project's progress. */
    public Project setTaskDone(String projectId, String taskId, boolean done) {
        synchronized (store) {
            int i = indexOf(projectId);
            Stored current = store.get(i);

            boolean found = false;
            List<Task> tasks = new ArrayList<>();
            for (Task t : current.tasks()) {
                if (t.id().equals(taskId)) {
                    tasks.add(new Task(t.id(), t.title(), done));
                    found = true;
                } else {
                    tasks.add(t);
                }
            }
            if (!found) throw new TaskNotFoundException(taskId);

            Stored updated = current.withTasks(List.copyOf(tasks));
            store.set(i, updated);
            return toDto(updated);
        }
    }

    /* ======================================================================
       Derived values
       ====================================================================== */

    private void seed(String title, String description, Status status, LocalDate due,
                      List<Assignee> assignees, int doneCount, String... taskTitles) {
        int n = projectSeq.getAndIncrement();
        List<Task> tasks = new ArrayList<>();
        for (int i = 0; i < taskTitles.length; i++) {
            tasks.add(new Task(nextTaskId(), taskTitles[i], i < doneCount));
        }
        store.add(new Stored("p" + n, "PRJ-" + (100 + n), title, description,
                status, due, assignees, List.copyOf(tasks)));
    }

    private String nextTaskId() {
        return "t" + taskSeq.getAndIncrement();
    }

    private List<Project> all() {
        synchronized (store) {
            return store.stream().map(this::toDto).toList();
        }
    }

    private Stored find(String id) {
        synchronized (store) {
            return store.get(indexOf(id));
        }
    }

    private int indexOf(String id) {
        synchronized (store) {
            for (int i = 0; i < store.size(); i++) {
                if (store.get(i).id().equals(id)) return i;
            }
        }
        throw new ProjectNotFoundException(id);
    }

    private Project toDto(Stored s) {
        int total = s.tasks().size();
        int done = (int) s.tasks().stream().filter(Task::done).count();
        int pct = total == 0 ? 0 : Math.round(done * 100f / total);

        return new Project(
                s.id(), s.code(), s.title(), s.description(),
                s.status().label, s.status().color, s.status().gradient,
                pct, done, total,
                s.dueDate() == null ? "TBD" : s.dueDate().format(DUE_FORMAT),
                isUrgent(s.dueDate()),
                s.assignees(), s.tasks());
    }

    private boolean isUrgent(LocalDate due) {
        if (due == null) return false;
        return !due.isAfter(LocalDate.now(clock).plusDays(URGENT_WITHIN_DAYS));
    }

    private static boolean isAll(String status) {
        return status == null || status.isBlank() || status.equalsIgnoreCase("All");
    }

    private static boolean matchesQuery(Project p, String needle) {
        return Arrays.asList(p.title(), p.code(), p.description()).stream()
                .filter(Objects::nonNull)
                .anyMatch(s -> s.toLowerCase(Locale.ROOT).contains(needle));
    }

    private static Overview overview(List<Project> list) {
        int total = list.size();
        int avg = total == 0 ? 0 : (int) Math.round(list.stream().mapToInt(Project::progressPercent).average().orElse(0));
        int urgent = (int) list.stream().filter(Project::isUrgent).count();
        int done = list.stream().mapToInt(Project::completedTasks).sum();
        int tasks = list.stream().mapToInt(Project::totalTasks).sum();

        // Every tab appears, even with a zero count, in tab order.
        Map<String, Integer> counts = new LinkedHashMap<>();
        counts.put("All", total);
        for (Status s : Status.values()) {
            counts.put(s.label(), (int) list.stream().filter(p -> p.status().equals(s.label())).count());
        }
        return new Overview(total, avg, urgent, done, tasks, counts);
    }

    private static List<Section> sections(List<Project> shown, boolean grouped) {
        if (!grouped) return List.of(new Section("all", null, shown));

        List<Section> out = new ArrayList<>();
        for (Status s : Status.values()) {
            List<Project> items = shown.stream().filter(p -> p.status().equals(s.label())).toList();
            if (!items.isEmpty()) out.add(new Section(s.label(), s.label(), items));
        }
        return out;
    }
}