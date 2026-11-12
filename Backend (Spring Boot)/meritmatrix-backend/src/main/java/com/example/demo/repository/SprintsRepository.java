package com.example.demo.repository;

import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Data-access layer for {@code SprintsService}.
 *
 * Stores the team, their allocations, the milestones and the current sprint, and
 * returns raw data only. Derived values (booked hours, status, overview cards,
 * filter counts, conflicts, the rebalance plan) stay in the service.
 *
 * This implementation keeps the sample data in memory so the app runs on its
 * own. To go live, keep the public method signatures and swap the bodies for
 * JPA / JdbcTemplate calls (or turn this class into an interface and move this
 * code into an InMemorySprintsRepository).
 *
 * Each method is thread-safe on its own. Multi-step operations such as the
 * rebalance are serialized by the service.
 *
 * Requires Spring Boot 3.x and Java 17+.
 */
@Repository
public class SprintsRepository {

    /* ======================================================================
       Raw data types (kept here so the repository does not depend on the service)
       ====================================================================== */

    public record SprintRecord(String name, int day, int length) {}

    public record PersonRecord(String id, String name, String role, String squad, String zone, double utcOffset) {}

    /** A stored allocation. {@code movable} marks work the rebalance is allowed to move. */
    public record AllocationRecord(
            String id, String personId, String title, String detail, String tone,
            int startWeek, int weeks, int hoursPerWeek, String milestoneId, boolean movable) {

        public AllocationRecord withHours(int hours) {
            return new AllocationRecord(id, personId, title, detail, tone, startWeek, weeks,
                    hours, milestoneId, movable);
        }
    }

    public record MilestoneRecord(
            String id, String title, String personId,
            int assignedHoursPerWeek, int costRatePerHour, String sprintTarget) {}

    /* ======================================================================
       Sample data
       ====================================================================== */

    private static final SprintRecord CURRENT_SPRINT = new SprintRecord("Sprint 14", 9, 14);

    private static final List<PersonRecord> PEOPLE = List.of(
            new PersonRecord("alex", "Alex Rivera", "Staff Backend · UTC+1", "Core Infrastructure", "UTC", 0),
            new PersonRecord("elena", "Elena Vance", "Lead Architect · PST", "Core Infrastructure", "PST", -8),
            new PersonRecord("marcus", "Marcus Chen", "Sr. Frontend · EST", "Frontend Core", "EST", -5),
            new PersonRecord("sophia", "Sophia Patel", "AI / ML Engineer · IST", "AI / ML Research", "IST", 5.5),
            new PersonRecord("david", "David Kim", "DevOps / Cloud · UTC+0", "Core Infrastructure", "UTC", 0));

    private static final List<MilestoneRecord> MILESTONES = List.of(
            new MilestoneRecord("MS-904", "Zero-Trust Access Control", "elena", 32, 180, "Sprint 14 target"));

    /* ======================================================================
       Mutable state
       ====================================================================== */

    /** Guards every read and write of {@link #allocations}. */
    private final Object lock = new Object();

    private final List<AllocationRecord> allocations = new ArrayList<>();
    private final AtomicInteger allocationSeq = new AtomicInteger(1);

    public SprintsRepository() {
        // Hours add up to each person's weekly load in the current week.
        seed("alex", "Realtime Multi-Agent Orchestrator", "Core Engine Phase 2", "primary", 0, 3, 28, null, false);
        seed("alex", "Telemetry Sweep", null, "neutral", 1, 1, 12, null, true);
        seed("elena", "Zero-Trust Access Control & Neural Boundary Gateway", "Arch Milestone 4", "accent", 0, 4, 32, "MS-904", false);
        seed("marcus", "Kinetic UI Token Library", "Shader synthesis", "focus", 0, 3, 32, null, false);
        seed("marcus", "Hyperion Client Portal Sprint Finish", null, "primary", 1, 2, 24, null, true);
        seed("sophia", "Neural Prompt Evaluation Pipeline", null, "neutral", 0, 2, 24, null, false);
        seed("david", "Global Kubernetes Mesh & TPU Cluster Expansion", "Infrastructure hardening", "mixed", 0, 4, 36, null, false);
    }

    /* ======================================================================
       Sprint, people and milestones
       ====================================================================== */

    public SprintRecord findCurrentSprint() {
        return CURRENT_SPRINT;
    }

    /** The whole team, in team order. */
    public List<PersonRecord> findAllPeople() {
        return PEOPLE;
    }

    public Optional<PersonRecord> findPersonById(String id) {
        return PEOPLE.stream().filter(p -> p.id().equals(id)).findFirst();
    }

    public Optional<MilestoneRecord> findMilestoneById(String id) {
        return MILESTONES.stream().filter(m -> m.id().equals(id)).findFirst();
    }

    /* ======================================================================
       Allocations
       ====================================================================== */

    /** All allocations in insertion order. The returned list is an immutable copy. */
    public List<AllocationRecord> findAllAllocations() {
        synchronized (lock) {
            return List.copyOf(allocations);
        }
    }

    /** One person's allocations in insertion order. The returned list is an immutable copy. */
    public List<AllocationRecord> findAllocationsByPersonId(String personId) {
        synchronized (lock) {
            return allocations.stream().filter(a -> a.personId().equals(personId)).toList();
        }
    }

    /** Reserves the next allocation id ("a1", "a2", ...). */
    public String nextAllocationId() {
        return "a" + allocationSeq.getAndIncrement();
    }

    /** Inserts a new allocation at the end, or replaces the one with the same id in place. */
    public AllocationRecord saveAllocation(AllocationRecord allocation) {
        synchronized (lock) {
            for (int i = 0; i < allocations.size(); i++) {
                if (allocations.get(i).id().equals(allocation.id())) {
                    allocations.set(i, allocation);
                    return allocation;
                }
            }
            allocations.add(allocation);
            return allocation;
        }
    }

    /** Removes an allocation. Does nothing if the id does not exist. */
    public void deleteAllocation(String id) {
        synchronized (lock) {
            allocations.removeIf(a -> a.id().equals(id));
        }
    }

    /* ======================================================================
       Internals
       ====================================================================== */

    private void seed(String personId, String title, String detail, String tone,
                      int startWeek, int weeks, int hours, String milestoneId, boolean movable) {
        allocations.add(new AllocationRecord(nextAllocationId(), personId, title, detail, tone,
                startWeek, weeks, hours, milestoneId, movable));
    }
}