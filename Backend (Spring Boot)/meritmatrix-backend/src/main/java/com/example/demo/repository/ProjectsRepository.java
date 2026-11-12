package com.example.demo.repository;

import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Data-access layer for {@code ProjectsService}.
 *
 * Stores workstreams and their subtasks and returns raw data only. Derived
 * values (progress, due soon, overview, counts, filtering, searching, sorting,
 * grouping) stay in the service.
 *
 * This implementation keeps the sample data in memory so the app runs on its
 * own. To go live, keep the public method signatures and swap the bodies for
 * JPA / JdbcTemplate calls (or turn this class into an interface and move this
 * code into an InMemoryProjectsRepository).
 *
 * Requires Spring Boot 3.x and Java 17+.
 */
@Repository
public class ProjectsRepository {

    /* ======================================================================
       Raw data types (kept here so the repository does not depend on the service)
       ====================================================================== */

    public record AssigneeRecord(String name, String initials, String color) {}

    public record TaskRecord(String id, String title, boolean done) {}

    /**
     * A stored workstream. {@code status} is the status label (for example
     * "In Progress"); the service maps it to its Status enum.
     */
    public record WorkstreamRecord(
            String id,
            String code,
            String title,
            String description,
            String status,
            LocalDate dueDate,
            List<AssigneeRecord> assignees,
            List<TaskRecord> tasks) {

        public WorkstreamRecord withTasks(List<TaskRecord> newTasks) {
            return new WorkstreamRecord(id, code, title, description, status, dueDate, assignees, newTasks);
        }
    }

    /* ======================================================================
       Sample data
       ====================================================================== */

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

    /** Guards every read and write of {@link #store}. */
    private final Object lock = new Object();

    private final List<WorkstreamRecord> store = new ArrayList<>();
    private final AtomicInteger projectSeq = new AtomicInteger(1);
    private final AtomicInteger taskSeq = new AtomicInteger(1);

    public ProjectsRepository() {
        LocalDate today = LocalDate.now();

        seed("Realtime Multi-Agent Orchestrator",
                "Core engine phase 2: event bus, agent scheduling and state replication.",
                "In Progress", today.plusDays(12), List.of(ALEX, ELENA), 4,
                "Core interface architecture and token bindings", "Event bus streaming integration",
                "Agent scheduler", "State replication", "Load testing", "Rollout runbook");

        seed("Kinetic UI Token Library",
                "Shader synthesis and design tokens shared across client surfaces.",
                "In Progress", today.plusDays(4), List.of(MARCUS), 3,
                "Token schema", "Shader pipeline test suite", "Theme switching", "Docs site", "Release candidate");

        seed("Zero-Trust Access Control",
                "Neural boundary gateway with cryptographic session verification.",
                "QA Review", today.plusDays(2), List.of(ELENA, DAVID), 5,
                "Gateway policy engine", "Session verification", "Audit log", "Penetration test fixes", "Sign-off");

        seed("Hyperion Client Portal",
                "Customer-facing dashboards, billing views and onboarding.",
                "Review Required", today.plusDays(15), List.of(MARCUS, SOPHIA), 3,
                "Dashboards", "Billing views", "Onboarding flow insight copy", "Accessibility review");

        seed("Global Kubernetes Mesh",
                "TPU cluster expansion and infrastructure hardening.",
                "Ready for Staging", today.plusDays(23), List.of(DAVID, ALEX), 4,
                "Cluster expansion", "Network policies", "Autoscaling", "Staging smoke tests", "Cost report");

        seed("Neural Prompt Evaluation Pipeline",
                "Benchmark harness for comparing engine versions.",
                "Planning", today.plusDays(30), List.of(SOPHIA), 0,
                "Define benchmark set", "Harness skeleton", "Scoring rubric", "Dashboard");
    }

    /* ======================================================================
       Queries and commands
       ====================================================================== */

    /** All workstreams in insertion order. The returned list is an immutable copy. */
    public List<WorkstreamRecord> findAll() {
        synchronized (lock) {
            return List.copyOf(store);
        }
    }

    public Optional<WorkstreamRecord> findById(String id) {
        synchronized (lock) {
            return store.stream().filter(w -> w.id().equals(id)).findFirst();
        }
    }

    /** Reserves the next project number. Use it to build the id and code of a new workstream. */
    public int nextProjectNumber() {
        return projectSeq.getAndIncrement();
    }

    /** Reserves the next task id ("t1", "t2", ...). */
    public String nextTaskId() {
        return "t" + taskSeq.getAndIncrement();
    }

    /** Inserts a new workstream, or replaces the one with the same id. */
    public WorkstreamRecord save(WorkstreamRecord workstream) {
        synchronized (lock) {
            int i = indexOf(workstream.id());
            if (i >= 0) {
                store.set(i, workstream);
            } else {
                store.add(workstream);
            }
            return workstream;
        }
    }

    /**
     * Atomically adds one open subtask to a workstream.
     *
     * @return the updated workstream, or empty if the id does not exist
     */
    public Optional<WorkstreamRecord> addTask(String projectId, String title) {
        synchronized (lock) {
            int i = indexOf(projectId);
            if (i < 0) return Optional.empty();

            WorkstreamRecord current = store.get(i);
            List<TaskRecord> tasks = new ArrayList<>(current.tasks());
            tasks.add(new TaskRecord(nextTaskId(), title, false));

            WorkstreamRecord updated = current.withTasks(List.copyOf(tasks));
            store.set(i, updated);
            return Optional.of(updated);
        }
    }

    /**
     * Atomically ticks or unticks a subtask.
     *
     * @return the updated workstream, or empty if the workstream or the task does not exist
     */
    public Optional<WorkstreamRecord> setTaskDone(String projectId, String taskId, boolean done) {
        synchronized (lock) {
            int i = indexOf(projectId);
            if (i < 0) return Optional.empty();

            WorkstreamRecord current = store.get(i);
            boolean found = false;
            List<TaskRecord> tasks = new ArrayList<>();
            for (TaskRecord t : current.tasks()) {
                if (t.id().equals(taskId)) {
                    tasks.add(new TaskRecord(t.id(), t.title(), done));
                    found = true;
                } else {
                    tasks.add(t);
                }
            }
            if (!found) return Optional.empty();

            WorkstreamRecord updated = current.withTasks(List.copyOf(tasks));
            store.set(i, updated);
            return Optional.of(updated);
        }
    }

    /* ======================================================================
       Internals
       ====================================================================== */

    /** Caller must hold {@link #lock}. Returns -1 if the id is not found. */
    private int indexOf(String id) {
        for (int i = 0; i < store.size(); i++) {
            if (store.get(i).id().equals(id)) return i;
        }
        return -1;
    }

    private void seed(String title, String description, String status, LocalDate due,
                      List<AssigneeRecord> assignees, int doneCount, String... taskTitles) {
        int n = nextProjectNumber();
        List<TaskRecord> tasks = new ArrayList<>();
        for (int i = 0; i < taskTitles.length; i++) {
            tasks.add(new TaskRecord(nextTaskId(), taskTitles[i], i < doneCount));
        }
        store.add(new WorkstreamRecord("p" + n, "PRJ-" + (100 + n), title, description,
                status, due, assignees, List.copyOf(tasks)));
    }
}