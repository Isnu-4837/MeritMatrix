package com.example.demo.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/**
 * Stored sprint data behind SprintsRepository.
 *
 * SprintsEntity is a single-row table with the current sprint and the counter
 * for new allocation ids. People, allocations and milestones are real rows, so
 * each has its own nested entity:
 *
 *   SprintsEntity                -> SprintRecord (+ allocation id counter)
 *   SprintsEntity.PersonEntity   -> PersonRecord
 *   SprintsEntity.AllocationEntity -> AllocationRecord
 *   SprintsEntity.MilestoneEntity  -> MilestoneRecord
 *
 * Raw values only. Booked hours, status, overview cards, filter counts,
 * conflicts and the rebalance plan stay in SprintsService.
 *
 * Requires Spring Boot 3.x (jakarta.persistence), Java 17+ and spring-boot-starter-data-jpa.
 */
@Entity
@Table(name = "sprints")
public class SprintsEntity {

    /** The table holds one row; this is its fixed id. */
    public static final long SINGLETON_ID = 1L;

    @Id
    private Long id = SINGLETON_ID;

    /* ---- Current sprint ---- */
    @Column(nullable = false)
    private String name;

    @Column(name = "sprint_day", nullable = false)
    private int day;

    @Column(name = "sprint_length", nullable = false)
    private int length;

    /**
     * Next number for a new allocation id ("a1", "a2", ...). Read and increment
     * it inside the same transaction that saves the allocation.
     */
    @Column(nullable = false)
    private int nextAllocationNumber = 1;

    /* ======================================================================
       Nested entities
       ====================================================================== */

    /** A team member. Rows are returned in team order (the {@code position} column). */
    @Entity
    @Table(name = "sprint_people")
    public static class PersonEntity {

        @Id
        @Column(name = "id", nullable = false)
        private String id;

        @Column(nullable = false) private String name;
        @Column(nullable = false) private String role;
        @Column(nullable = false) private String squad;

        /** Timezone label such as "UTC", "PST" or "IST". */
        @Column(nullable = false) private String zone;

        /** Offset from UTC in hours, for example 5.5. */
        @Column(nullable = false) private double utcOffset;

        @Column(nullable = false) private int position;

        public PersonEntity() {}

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }
        public String getSquad() { return squad; }
        public void setSquad(String squad) { this.squad = squad; }
        public String getZone() { return zone; }
        public void setZone(String zone) { this.zone = zone; }
        public double getUtcOffset() { return utcOffset; }
        public void setUtcOffset(double utcOffset) { this.utcOffset = utcOffset; }
        public int getPosition() { return position; }
        public void setPosition(int position) { this.position = position; }
    }

    /**
     * One bar in a person's timeline. {@code movable} marks work the rebalance
     * may move. {@code position} keeps insertion order, and a replaced
     * allocation keeps its position.
     */
    @Entity
    @Table(name = "sprint_allocations",
            indexes = @Index(name = "idx_sprint_allocations_person", columnList = "person_id"))
    public static class AllocationEntity {

        @Id
        @Column(name = "id", nullable = false)
        private String id;

        @Column(name = "person_id", nullable = false)
        private String personId;

        @Column(nullable = false, length = 120) private String title;
        @Column(length = 120) private String detail;
        @Column(nullable = false) private String tone;

        /** 0-based week on the board where the allocation starts. */
        @Column(nullable = false) private int startWeek;

        @Column(name = "week_count", nullable = false) private int weeks;
        @Column(nullable = false) private int hoursPerWeek;

        /** Null when the allocation is not tied to a milestone. */
        private String milestoneId;

        @Column(nullable = false) private boolean movable;

        @Column(nullable = false) private int position;

        public AllocationEntity() {}

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getPersonId() { return personId; }
        public void setPersonId(String personId) { this.personId = personId; }
        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public String getDetail() { return detail; }
        public void setDetail(String detail) { this.detail = detail; }
        public String getTone() { return tone; }
        public void setTone(String tone) { this.tone = tone; }
        public int getStartWeek() { return startWeek; }
        public void setStartWeek(int startWeek) { this.startWeek = startWeek; }
        public int getWeeks() { return weeks; }
        public void setWeeks(int weeks) { this.weeks = weeks; }
        public int getHoursPerWeek() { return hoursPerWeek; }
        public void setHoursPerWeek(int hoursPerWeek) { this.hoursPerWeek = hoursPerWeek; }
        public String getMilestoneId() { return milestoneId; }
        public void setMilestoneId(String milestoneId) { this.milestoneId = milestoneId; }
        public boolean isMovable() { return movable; }
        public void setMovable(boolean movable) { this.movable = movable; }
        public int getPosition() { return position; }
        public void setPosition(int position) { this.position = position; }
    }

    /** A milestone shown in the expandable panel. */
    @Entity
    @Table(name = "sprint_milestones")
    public static class MilestoneEntity {

        @Id
        @Column(name = "id", nullable = false)
        private String id;

        @Column(nullable = false) private String title;
        @Column(name = "person_id", nullable = false) private String personId;
        @Column(nullable = false) private int assignedHoursPerWeek;
        @Column(nullable = false) private int costRatePerHour;
        @Column(nullable = false) private String sprintTarget;

        public MilestoneEntity() {}

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public String getPersonId() { return personId; }
        public void setPersonId(String personId) { this.personId = personId; }
        public int getAssignedHoursPerWeek() { return assignedHoursPerWeek; }
        public void setAssignedHoursPerWeek(int v) { this.assignedHoursPerWeek = v; }
        public int getCostRatePerHour() { return costRatePerHour; }
        public void setCostRatePerHour(int costRatePerHour) { this.costRatePerHour = costRatePerHour; }
        public String getSprintTarget() { return sprintTarget; }
        public void setSprintTarget(String sprintTarget) { this.sprintTarget = sprintTarget; }
    }

    /* ======================================================================
       Getters and setters
       ====================================================================== */

    public SprintsEntity() {}

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public int getDay() { return day; }
    public void setDay(int day) { this.day = day; }
    public int getLength() { return length; }
    public void setLength(int length) { this.length = length; }
    public int getNextAllocationNumber() { return nextAllocationNumber; }
    public void setNextAllocationNumber(int nextAllocationNumber) { this.nextAllocationNumber = nextAllocationNumber; }
}
