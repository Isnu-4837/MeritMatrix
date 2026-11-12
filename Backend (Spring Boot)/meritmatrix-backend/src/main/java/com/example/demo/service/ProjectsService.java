package com.example.demo.service;

import com.example.demo.repository.ProjectsRepository;
import com.example.demo.repository.ProjectsRepository.AssigneeRecord;
import com.example.demo.repository.ProjectsRepository.TaskRecord;
import com.example.demo.repository.ProjectsRepository.WorkstreamRecord;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Business logic behind ProjectsPage.jsx.
 *
 * Reads raw workstreams from {@link ProjectsRepository} and computes everything
 * derived from them (progress, due soon, overview, counts) plus the filter /
 * search / sort / group logic. ProjectsController only handles HTTP and
 * delegates here.
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
       Constants
       ====================================================================== */

    /** A workstream is "due soon" if it is due within this many days (overdue counts too). */
    private static final int URGENT_WITHIN_DAYS = 7;

    private static final List<String> SORTS = List.of("default", "progress-desc", "progress-asc", "urgent", "name");
    private static final DateTimeFormatter DUE_FORMAT = DateTimeFormatter.ofPattern("MMM dd", Locale.US);

    /* ======================================================================
       Dependencies
       ====================================================================== */

    private final ProjectsRepository repo;
    private final Clock clock = Clock.systemDefaultZone();

    public ProjectsService(ProjectsRepository repo) {
        this.repo = repo;
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
        return repo.findById(id)
                .map(this::toDto)
                .orElseThrow(() -> new ProjectNotFoundException(id));
    }

    /** "New workstream": defaults to Planning, no assignees, one open task per non-blank title. */
    public Project create(String title, String description, String status, LocalDate dueDate, List<String> taskTitles) {
        Status s = status == null || status.isBlank() ? Status.PLANNING : Status.fromLabel(status);
        int n = repo.nextProjectNumber();

        List<TaskRecord> tasks = new ArrayList<>();
        if (taskTitles != null) {
            for (String t : taskTitles) {
                if (t != null && !t.isBlank()) tasks.add(new TaskRecord(repo.nextTaskId(), t.trim(), false));
            }
        }

        WorkstreamRecord created = new WorkstreamRecord(
                "p" + n, "PRJ-" + (100 + n), title.trim(),
                description == null || description.isBlank() ? "No description yet." : description.trim(),
                s.label(), dueDate, List.of(), List.copyOf(tasks));
        return toDto(repo.save(created));
    }

    /** "Quick task": adds an open subtask and recalculates the project's progress. */
    public Project addTask(String projectId, String title) {
        return repo.addTask(projectId, title.trim())
                .map(this::toDto)
                .orElseThrow(() -> new ProjectNotFoundException(projectId));
    }

    /** Ticks or unticks a subtask and recalculates the project's progress. */
    public Project setTaskDone(String projectId, String taskId, boolean done) {
        return repo.setTaskDone(projectId, taskId, done)
                .map(this::toDto)
                .orElseThrow(() -> missingProjectOrTask(projectId, taskId));
    }

    /* ======================================================================
       Derived values
       ====================================================================== */

    private List<Project> all() {
        return repo.findAll().stream().map(this::toDto).toList();
    }

    /** The repository returns empty for both cases, so check which one it was. */
    private RuntimeException missingProjectOrTask(String projectId, String taskId) {
        return repo.findById(projectId).isEmpty()
                ? new ProjectNotFoundException(projectId)
                : new TaskNotFoundException(taskId);
    }

    private Project toDto(WorkstreamRecord r) {
        Status status = Status.fromLabel(r.status());
        List<Task> tasks = r.tasks().stream()
                .map(t -> new Task(t.id(), t.title(), t.done()))
                .toList();
        List<Assignee> assignees = r.assignees().stream()
                .map(ProjectsService::toAssignee)
                .toList();

        int total = tasks.size();
        int done = (int) tasks.stream().filter(Task::done).count();
        int pct = total == 0 ? 0 : Math.round(done * 100f / total);

        return new Project(
                r.id(), r.code(), r.title(), r.description(),
                status.label, status.color, status.gradient,
                pct, done, total,
                r.dueDate() == null ? "TBD" : r.dueDate().format(DUE_FORMAT),
                isUrgent(r.dueDate()),
                assignees, tasks);
    }

    private static Assignee toAssignee(AssigneeRecord a) {
        return new Assignee(a.name(), a.initials(), a.color());
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