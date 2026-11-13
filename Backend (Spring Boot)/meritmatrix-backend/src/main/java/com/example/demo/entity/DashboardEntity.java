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

import java.util.ArrayList;
import java.util.List;

/**
 * Stored dashboard data behind DashboardRepository.
 *
 * DashboardEntity is a single-row table with the sprint, metric, burndown, AI
 * and team-load data. Projects are real rows, so they live in the nested
 * {@link ProjectEntity} (one row per project, assignees as an element collection).
 *
 * Raw values only. Progress percent, metric badges, burndown ahead/behind,
 * workload insight, status breakdown, filtering, searching and sorting stay in
 * DashboardService.
 *
 * Mapping to DashboardRepository:
 *   sprintNumber/Day/Length/OnSchedulePercent -> SprintInfo
 *   weeklyCapacityHours                       -> findWeeklyCapacityHours()
 *   activeProjectHistory                      -> findActiveProjectHistory()
 *   velocityHistory / velocityTarget          -> findVelocityHistory() / findVelocityTarget()
 *   aiHoursSavedHistory/aiProgressPercent/aiNeuralActions -> AiUsage
 *   burndownTotalPoints / burndownActual      -> BurndownData
 *   teamLoad                                  -> TeamLoadRecord list
 *   nextProjectNumber                         -> nextProjectNumber()
 *   ProjectEntity                             -> ProjectRecord
 *
 * Requires Spring Boot 3.x (jakarta.persistence), Java 17+ and spring-boot-starter-data-jpa.
 */
@Entity
@Table(name = "dashboard")
public class DashboardEntity {

    /** The table holds one row; this is its fixed id. */
    public static final long SINGLETON_ID = 1L;

    @Id
    private Long id = SINGLETON_ID;

    /* ---- Sprint ---- */
    @Column(nullable = false) private int sprintNumber;
    @Column(nullable = false) private int sprintDay;
    @Column(nullable = false) private int sprintLength;
    @Column(nullable = false) private int sprintOnSchedulePercent;

    @Column(nullable = false) private int weeklyCapacityHours;

    /* ---- Active project counts for past periods, oldest first ---- */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dashboard_active_project_history", joinColumns = @JoinColumn(name = "dashboard_id"))
    @OrderColumn(name = "position")
    @Column(name = "count", nullable = false)
    private List<Integer> activeProjectHistory = new ArrayList<>();

    /* ---- Velocity per sprint, oldest first (last = current sprint) ---- */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dashboard_velocity_history", joinColumns = @JoinColumn(name = "dashboard_id"))
    @OrderColumn(name = "position")
    @Column(name = "velocity", nullable = false)
    private List<Double> velocityHistory = new ArrayList<>();

    @Column(nullable = false) private double velocityTarget;

    /* ---- AI usage ---- */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dashboard_ai_hours_saved", joinColumns = @JoinColumn(name = "dashboard_id"))
    @OrderColumn(name = "position")
    @Column(name = "hours_saved", nullable = false)
    private List<Double> aiHoursSavedHistory = new ArrayList<>();

    @Column(nullable = false) private int aiProgressPercent;
    @Column(nullable = false) private int aiNeuralActions;

    /* ---- Burndown: points left per day, from day 0 to today ---- */
    @Column(nullable = false) private int burndownTotalPoints;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dashboard_burndown_actual", joinColumns = @JoinColumn(name = "dashboard_id"))
    @OrderColumn(name = "position")
    @Column(name = "points_left", nullable = false)
    private List<Integer> burndownActual = new ArrayList<>();

    /* ---- Team load ---- */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dashboard_team_load", joinColumns = @JoinColumn(name = "dashboard_id"))
    @OrderColumn(name = "position")
    private List<TeamLoadEmbeddable> teamLoad = new ArrayList<>();

    /** Next number for a new project's id ("p7") and code ("PRJ-107"). */
    @Column(nullable = false)
    private int nextProjectNumber = 1;

    /* ======================================================================
       Embeddable types
       ====================================================================== */

    @Embeddable
    public static class TeamLoadEmbeddable {
        @Column(name = "name", nullable = false)
        private String name;

        @Column(name = "hours", nullable = false)
        private int hours;

        protected TeamLoadEmbeddable() {}

        public TeamLoadEmbeddable(String name, int hours) {
            this.name = name;
            this.hours = hours;
        }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public int getHours() { return hours; }
        public void setHours(int hours) { this.hours = hours; }
    }

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

    /* ======================================================================
       Project rows
       ====================================================================== */

    /**
     * A stored project. Progress is not stored: the service derives it from
     * completedTasks / totalTasks.
     */
    @Entity
    @Table(name = "dashboard_projects")
    public static class ProjectEntity {

        @Id
        @Column(name = "id", nullable = false)
        private String id;

        @Column(nullable = false, unique = true) private String code;
        @Column(nullable = false) private String title;
        @Column(length = 1000) private String description;
        @Column(nullable = false) private String status;
        private String statusColor;
        private String accentGradient;
        @Column(nullable = false) private int completedTasks;
        @Column(nullable = false) private int totalTasks;
        private String dueDate;
        @Column(nullable = false) private boolean urgent;

        /** Insertion order of projects is kept by this column. */
        @Column(nullable = false) private int position;

        @ElementCollection(fetch = FetchType.EAGER)
        @CollectionTable(name = "dashboard_project_assignees", joinColumns = @JoinColumn(name = "project_id"))
        @OrderColumn(name = "position")
        private List<AssigneeEmbeddable> assignees = new ArrayList<>();

        public ProjectEntity() {}

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
        public String getStatusColor() { return statusColor; }
        public void setStatusColor(String statusColor) { this.statusColor = statusColor; }
        public String getAccentGradient() { return accentGradient; }
        public void setAccentGradient(String accentGradient) { this.accentGradient = accentGradient; }
        public int getCompletedTasks() { return completedTasks; }
        public void setCompletedTasks(int completedTasks) { this.completedTasks = completedTasks; }
        public int getTotalTasks() { return totalTasks; }
        public void setTotalTasks(int totalTasks) { this.totalTasks = totalTasks; }
        public String getDueDate() { return dueDate; }
        public void setDueDate(String dueDate) { this.dueDate = dueDate; }
        public boolean isUrgent() { return urgent; }
        public void setUrgent(boolean urgent) { this.urgent = urgent; }
        public int getPosition() { return position; }
        public void setPosition(int position) { this.position = position; }
        public List<AssigneeEmbeddable> getAssignees() { return assignees; }
        public void setAssignees(List<AssigneeEmbeddable> assignees) { this.assignees = assignees; }
    }

    /* ======================================================================
       Getters and setters
       ====================================================================== */

    public DashboardEntity() {}

    public Long getId() { return id; }

    public int getSprintNumber() { return sprintNumber; }
    public void setSprintNumber(int sprintNumber) { this.sprintNumber = sprintNumber; }
    public int getSprintDay() { return sprintDay; }
    public void setSprintDay(int sprintDay) { this.sprintDay = sprintDay; }
    public int getSprintLength() { return sprintLength; }
    public void setSprintLength(int sprintLength) { this.sprintLength = sprintLength; }
    public int getSprintOnSchedulePercent() { return sprintOnSchedulePercent; }
    public void setSprintOnSchedulePercent(int v) { this.sprintOnSchedulePercent = v; }

    public int getWeeklyCapacityHours() { return weeklyCapacityHours; }
    public void setWeeklyCapacityHours(int weeklyCapacityHours) { this.weeklyCapacityHours = weeklyCapacityHours; }

    public List<Integer> getActiveProjectHistory() { return activeProjectHistory; }
    public void setActiveProjectHistory(List<Integer> v) { this.activeProjectHistory = v; }

    public List<Double> getVelocityHistory() { return velocityHistory; }
    public void setVelocityHistory(List<Double> velocityHistory) { this.velocityHistory = velocityHistory; }
    public double getVelocityTarget() { return velocityTarget; }
    public void setVelocityTarget(double velocityTarget) { this.velocityTarget = velocityTarget; }

    public List<Double> getAiHoursSavedHistory() { return aiHoursSavedHistory; }
    public void setAiHoursSavedHistory(List<Double> v) { this.aiHoursSavedHistory = v; }
    public int getAiProgressPercent() { return aiProgressPercent; }
    public void setAiProgressPercent(int aiProgressPercent) { this.aiProgressPercent = aiProgressPercent; }
    public int getAiNeuralActions() { return aiNeuralActions; }
    public void setAiNeuralActions(int aiNeuralActions) { this.aiNeuralActions = aiNeuralActions; }

    public int getBurndownTotalPoints() { return burndownTotalPoints; }
    public void setBurndownTotalPoints(int burndownTotalPoints) { this.burndownTotalPoints = burndownTotalPoints; }
    public List<Integer> getBurndownActual() { return burndownActual; }
    public void setBurndownActual(List<Integer> burndownActual) { this.burndownActual = burndownActual; }

    public List<TeamLoadEmbeddable> getTeamLoad() { return teamLoad; }
    public void setTeamLoad(List<TeamLoadEmbeddable> teamLoad) { this.teamLoad = teamLoad; }

    public int getNextProjectNumber() { return nextProjectNumber; }
    public void setNextProjectNumber(int nextProjectNumber) { this.nextProjectNumber = nextProjectNumber; }
}
