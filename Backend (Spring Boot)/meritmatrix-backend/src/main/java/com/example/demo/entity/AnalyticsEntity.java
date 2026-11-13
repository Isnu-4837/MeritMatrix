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
 * Stored analytics data behind AnalyticsRepository (single-row table).
 *
 * Holds raw values only. Derived values (velocity delta, ahead/behind, budget
 * left, percentages, labels) stay in AnalyticsService.
 *
 * Field mapping to AnalyticsRepository:
 *   sprintNumber/sprintDay/sprintLength -> SprintInfo
 *   velocityHistory                     -> findVelocityHistory()
 *   tpuTotalHours / tpuUsagePercent     -> findTpuTotalHours() / findTpuUsagePercent()
 *   neuralActions/neuralHoursSaved/neuralSpark -> NeuralUsage
 *   sandboxSigned/sandboxTotal          -> SandboxAudits
 *   burndownIdeal/Actual/Projected      -> BurndownData
 *   squads                              -> SquadRecord list
 *   overlapTimezones/FromHourUtc/ToHourUtc/Hours -> OverlapWindow
 *
 * Requires Spring Boot 3.x (jakarta.persistence), Java 17+ and spring-boot-starter-data-jpa.
 */
@Entity
@Table(name = "analytics")
public class AnalyticsEntity {

    /** The table holds one row; this is its fixed id. */
    public static final long SINGLETON_ID = 1L;

    @Id
    private Long id = SINGLETON_ID;

    /* ---- Sprint ---- */
    @Column(nullable = false) private int sprintNumber;
    @Column(nullable = false) private int sprintDay;
    @Column(nullable = false) private int sprintLength;

    /* ---- Velocity per sprint, oldest first (last = current sprint) ---- */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "analytics_velocity_history", joinColumns = @JoinColumn(name = "analytics_id"))
    @OrderColumn(name = "position")
    @Column(name = "velocity", nullable = false)
    private List<Double> velocityHistory = new ArrayList<>();

    /* ---- TPU ---- */
    @Column(nullable = false) private int tpuTotalHours;
    @Column(nullable = false) private int tpuUsagePercent;

    /* ---- Neural usage ---- */
    @Column(nullable = false) private int neuralActions;
    @Column(nullable = false) private int neuralHoursSaved;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "analytics_neural_spark", joinColumns = @JoinColumn(name = "analytics_id"))
    @OrderColumn(name = "position")
    @Column(name = "value", nullable = false)
    private List<Double> neuralSpark = new ArrayList<>();

    /* ---- Sandbox audits ---- */
    @Column(nullable = false) private int sandboxSigned;
    @Column(nullable = false) private int sandboxTotal;

    /* ---- Burndown series ---- */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "analytics_burndown_ideal", joinColumns = @JoinColumn(name = "analytics_id"))
    @OrderColumn(name = "position")
    private List<SeriesPointEmbeddable> burndownIdeal = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "analytics_burndown_actual", joinColumns = @JoinColumn(name = "analytics_id"))
    @OrderColumn(name = "position")
    private List<SeriesPointEmbeddable> burndownActual = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "analytics_burndown_projected", joinColumns = @JoinColumn(name = "analytics_id"))
    @OrderColumn(name = "position")
    private List<SeriesPointEmbeddable> burndownProjected = new ArrayList<>();

    /* ---- Squads ---- */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "analytics_squads", joinColumns = @JoinColumn(name = "analytics_id"))
    @OrderColumn(name = "position")
    private List<SquadEmbeddable> squads = new ArrayList<>();

    /* ---- Meeting overlap ---- */
    @Column(nullable = false) private int overlapTimezones;
    @Column(nullable = false) private int overlapFromHourUtc;
    @Column(nullable = false) private int overlapToHourUtc;
    @Column(nullable = false) private double overlapHours;

    /* ======================================================================
       Embeddable types
       ====================================================================== */

    @Embeddable
    public static class SeriesPointEmbeddable {
        @Column(name = "day", nullable = false)
        private int day;

        @Column(name = "points", nullable = false)
        private int points;

        protected SeriesPointEmbeddable() {}

        public SeriesPointEmbeddable(int day, int points) {
            this.day = day;
            this.points = points;
        }

        public int getDay() { return day; }
        public void setDay(int day) { this.day = day; }
        public int getPoints() { return points; }
        public void setPoints(int points) { this.points = points; }
    }

    @Embeddable
    public static class SquadEmbeddable {
        @Column(name = "squad_id", nullable = false)
        private String squadId;

        @Column(name = "name", nullable = false)
        private String name;

        @Column(name = "people")
        private String people;

        @Column(name = "capacity_percent", nullable = false)
        private int capacityPercent;

        @Column(name = "note", length = 500)
        private String note;

        protected SquadEmbeddable() {}

        public SquadEmbeddable(String squadId, String name, String people, int capacityPercent, String note) {
            this.squadId = squadId;
            this.name = name;
            this.people = people;
            this.capacityPercent = capacityPercent;
            this.note = note;
        }

        public String getSquadId() { return squadId; }
        public void setSquadId(String squadId) { this.squadId = squadId; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getPeople() { return people; }
        public void setPeople(String people) { this.people = people; }
        public int getCapacityPercent() { return capacityPercent; }
        public void setCapacityPercent(int capacityPercent) { this.capacityPercent = capacityPercent; }
        public String getNote() { return note; }
        public void setNote(String note) { this.note = note; }
    }

    /* ======================================================================
       Constructors, getters, setters
       ====================================================================== */

    public AnalyticsEntity() {}

    public Long getId() { return id; }

    public int getSprintNumber() { return sprintNumber; }
    public void setSprintNumber(int sprintNumber) { this.sprintNumber = sprintNumber; }
    public int getSprintDay() { return sprintDay; }
    public void setSprintDay(int sprintDay) { this.sprintDay = sprintDay; }
    public int getSprintLength() { return sprintLength; }
    public void setSprintLength(int sprintLength) { this.sprintLength = sprintLength; }

    public List<Double> getVelocityHistory() { return velocityHistory; }
    public void setVelocityHistory(List<Double> velocityHistory) { this.velocityHistory = velocityHistory; }

    public int getTpuTotalHours() { return tpuTotalHours; }
    public void setTpuTotalHours(int tpuTotalHours) { this.tpuTotalHours = tpuTotalHours; }
    public int getTpuUsagePercent() { return tpuUsagePercent; }
    public void setTpuUsagePercent(int tpuUsagePercent) { this.tpuUsagePercent = tpuUsagePercent; }

    public int getNeuralActions() { return neuralActions; }
    public void setNeuralActions(int neuralActions) { this.neuralActions = neuralActions; }
    public int getNeuralHoursSaved() { return neuralHoursSaved; }
    public void setNeuralHoursSaved(int neuralHoursSaved) { this.neuralHoursSaved = neuralHoursSaved; }
    public List<Double> getNeuralSpark() { return neuralSpark; }
    public void setNeuralSpark(List<Double> neuralSpark) { this.neuralSpark = neuralSpark; }

    public int getSandboxSigned() { return sandboxSigned; }
    public void setSandboxSigned(int sandboxSigned) { this.sandboxSigned = sandboxSigned; }
    public int getSandboxTotal() { return sandboxTotal; }
    public void setSandboxTotal(int sandboxTotal) { this.sandboxTotal = sandboxTotal; }

    public List<SeriesPointEmbeddable> getBurndownIdeal() { return burndownIdeal; }
    public void setBurndownIdeal(List<SeriesPointEmbeddable> burndownIdeal) { this.burndownIdeal = burndownIdeal; }
    public List<SeriesPointEmbeddable> getBurndownActual() { return burndownActual; }
    public void setBurndownActual(List<SeriesPointEmbeddable> burndownActual) { this.burndownActual = burndownActual; }
    public List<SeriesPointEmbeddable> getBurndownProjected() { return burndownProjected; }
    public void setBurndownProjected(List<SeriesPointEmbeddable> burndownProjected) { this.burndownProjected = burndownProjected; }

    public List<SquadEmbeddable> getSquads() { return squads; }
    public void setSquads(List<SquadEmbeddable> squads) { this.squads = squads; }

    public int getOverlapTimezones() { return overlapTimezones; }
    public void setOverlapTimezones(int overlapTimezones) { this.overlapTimezones = overlapTimezones; }
    public int getOverlapFromHourUtc() { return overlapFromHourUtc; }
    public void setOverlapFromHourUtc(int overlapFromHourUtc) { this.overlapFromHourUtc = overlapFromHourUtc; }
    public int getOverlapToHourUtc() { return overlapToHourUtc; }
    public void setOverlapToHourUtc(int overlapToHourUtc) { this.overlapToHourUtc = overlapToHourUtc; }
    public double getOverlapHours() { return overlapHours; }
    public void setOverlapHours(double overlapHours) { this.overlapHours = overlapHours; }
}
