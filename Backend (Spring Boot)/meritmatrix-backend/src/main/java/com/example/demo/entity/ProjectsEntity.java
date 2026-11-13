package com.example.demo.entity;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embeddable;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * A stored workstream behind ProjectsRepository (one row per workstream).
 *
 * Raw values only. Progress, due soon, overview, counts, filtering, searching,
 * sorting and grouping stay in ProjectsService.
 *
 * Mapping to ProjectsRepository.WorkstreamRecord:
 *   id, code, title, description, status, dueDate -> columns
 *   assignees                                      -> AssigneeEmbeddable list
 *   tasks                                          -> TaskEmbeddable list (order kept)
 *
 * {@code status} holds the status label (for example "In Progress"); the
 * service maps it to its Status enum.
 *
 * The nested {@link CounterEntity} replaces the in-memory sequences behind
 * nextProjectNumber() and nextTaskId().
 *
 * Requires Spring Boot 3.x (jakarta.persistence), Java 17+ and spring-boot-starter-data-jpa.
 */
@Entity
@Table(name = "workstreams")
public class ProjectsEntity {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(length = 1000)
    private String description;

    @Column(nullable = false)
    private String status;

    /** Null means "TBD". */
    private LocalDate dueDate;

    /** Insertion order of workstreams is kept by this column. */
    @Column(nullable = false)
    private int position;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "workstream_assignees", joinColumns = @JoinColumn(name = "workstream_id"))
    @OrderColumn(name = "position")
    private List<AssigneeEmbeddable> assignees = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "workstream_tasks", joinColumns = @JoinColumn(name = "workstream_id"))
    @OrderColumn(name = "position")
    private List<TaskEmbeddable> tasks = new ArrayList<>();

    /* ======================================================================
       Embeddable types
       ====================================================================== */

    @Embeddable
    public static class AssigneeEmbeddable {
        @Column(name = "name", nullable = false)
        private String name;

        @Column(name = "initials", nullable = false)
        private String initials;

        @Column(name = "color")
        private String color;

        protected AssigneeEmbeddable() {}

        public AssigneeEmbeddable(String name, String initials, String color) {
            this.name = name;
            this.initials = initials;
            this.color = color;
        }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getInitials() { return initials; }
        public void setInitials(String initials) { this.initials = initials; }
        public String getColor() { return color; }
        public void setColor(String color) { this.color = color; }
    }

    @Embeddable
    public static class TaskEmbeddable {
        @Column(name = "task_id", nullable = false)
        private String taskId;

        @Column(name = "title", nullable = false, length = 200)
        private String title;

        @Column(name = "done", nullable = false)
        private boolean done;

        protected TaskEmbeddable() {}

        public TaskEmbeddable(String taskId, String title, boolean done) {
            this.taskId = taskId;
            this.title = title;
            this.done = done;
        }

        public String getTaskId() { return taskId; }
        public void setTaskId(String taskId) { this.taskId = taskId; }
        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public boolean isDone() { return done; }
        public void setDone(boolean done) { this.done = done; }
    }

    /* ======================================================================
       Sequence counters
       ====================================================================== */

    /**
     * Named counters, one row each: "project" (ids "p1", "p2", ...) and "task"
     * (ids "t1", "t2", ...). Read and increment the row inside one
     * transaction, for example with a pessimistic write lock, so two requests
     * never get the same number.
     */
    @Entity
    @Table(name = "workstream_counters")
    public static class CounterEntity {

        public static final String PROJECT = "project";
        public static final String TASK = "task";

        @Id
        @Column(name = "name", nullable = false)
        private String name;

        /** The next number to hand out. */
        @Column(name = "next_value", nullable = false)
        private int nextValue = 1;

        public CounterEntity() {}

        public CounterEntity(String name, int nextValue) {
            this.name = name;
            this.nextValue = nextValue;
        }

        /** Returns the current number and moves the counter on by one. */
        public int takeNext() {
            return nextValue++;
        }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public int getNextValue() { return nextValue; }
        public void setNextValue(int nextValue) { this.nextValue = nextValue; }
    }

    /* ======================================================================
       Getters and setters
       ====================================================================== */

    public ProjectsEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
    public List<AssigneeEmbeddable> getAssignees() { return assignees; }
    public void setAssignees(List<AssigneeEmbeddable> assignees) { this.assignees = assignees; }
    public List<TaskEmbeddable> getTasks() { return tasks; }
    public void setTasks(List<TaskEmbeddable> tasks) { this.tasks = tasks; }
}
