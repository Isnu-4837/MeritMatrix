package com.example.demo.repository;

import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Data-access layer for {@code AnalyticsService}.
 *
 * Returns raw stored data only. Derived values (velocity delta, ahead/behind,
 * budget left, percentages, labels) stay in the service.
 *
 * This implementation keeps the sample data in memory so the app runs on its
 * own. To go live, keep the public method signatures and swap the bodies for
 * JPA / JdbcTemplate / metrics-client calls (or turn this class into an
 * interface and move this code into an InMemoryAnalyticsRepository).
 *
 * Requires Spring Boot 3.x and Java 17+.
 */
@Repository
public class AnalyticsRepository {

    /* ======================================================================
       Raw data types (kept here so the repository does not depend on the service)
       ====================================================================== */

    public record SprintInfo(int number, int day, int length) {}

    public record SeriesPoint(int day, int points) {}

    public record BurndownData(
            List<SeriesPoint> ideal,
            List<SeriesPoint> actual,
            List<SeriesPoint> projected) {}

    public record NeuralUsage(int actions, int hoursSaved, List<Double> spark) {}

    public record SandboxAudits(int signed, int total) {}

    public record SquadRecord(String id, String name, String people, int capacityPercent, String note) {}

    public record OverlapWindow(int timezones, int fromHourUtc, int toHourUtc, double hours) {}

    /* ======================================================================
       Sample data
       ====================================================================== */

    private static final SprintInfo CURRENT_SPRINT = new SprintInfo(14, 9, 14);

    /** Velocity per sprint, oldest first. The last entry is the current sprint. */
    private static final List<Double> VELOCITY_HISTORY = List.of(78.0, 82.0, 80.0, 87.8, 94.2);

    private static final int TPU_TOTAL_HOURS = 1000;

    private static final NeuralUsage NEURAL_USAGE = new NeuralUsage(
            1280, 34, List.of(40.0, 55.0, 52.0, 70.0, 88.0, 100.0));

    private static final SandboxAudits SANDBOX_AUDITS = new SandboxAudits(5, 5);

    private static final BurndownData BURNDOWN = new BurndownData(
            List.of(new SeriesPoint(1, 100), new SeriesPoint(3, 85), new SeriesPoint(5, 70),
                    new SeriesPoint(7, 55), new SeriesPoint(9, 40), new SeriesPoint(11, 25),
                    new SeriesPoint(14, 0)),
            List.of(new SeriesPoint(1, 98), new SeriesPoint(3, 88), new SeriesPoint(5, 68),
                    new SeriesPoint(7, 52), new SeriesPoint(9, 36)),
            List.of(new SeriesPoint(9, 36), new SeriesPoint(11, 20), new SeriesPoint(14, 0)));

    private static final List<SquadRecord> SQUADS = List.of(
            new SquadRecord("core", "Core Infrastructure", "Elena, Alex, David", 98,
                    "Near full capacity. Avoid adding new work this sprint."),
            new SquadRecord("frontend", "Frontend Systems", "Marcus Chen", 88,
                    "Capacity is normalized across timezones."),
            new SquadRecord("ml", "AI / ML Research", "Sophia Patel", 92,
                    "Active on the benchmark run. Room for small reviews only."));

    private static final OverlapWindow MEETING_OVERLAP = new OverlapWindow(4, 14, 18, 3.5);

    /* ======================================================================
       Mutable state
       ====================================================================== */

    private final AtomicInteger tpuUsagePercent = new AtomicInteger(78);

    /* ======================================================================
       Queries
       ====================================================================== */

    public SprintInfo findCurrentSprint() {
        return CURRENT_SPRINT;
    }

    /** Velocity per sprint, oldest first. */
    public List<Double> findVelocityHistory() {
        return VELOCITY_HISTORY;
    }

    public NeuralUsage findNeuralUsage() {
        return NEURAL_USAGE;
    }

    public SandboxAudits findSandboxAudits() {
        return SANDBOX_AUDITS;
    }

    public BurndownData findBurndown() {
        return BURNDOWN;
    }

    public List<SquadRecord> findAllSquads() {
        return SQUADS;
    }

    public Optional<SquadRecord> findSquadById(String id) {
        return SQUADS.stream().filter(s -> s.id().equals(id)).findFirst();
    }

    public OverlapWindow findMeetingOverlap() {
        return MEETING_OVERLAP;
    }

    /* ======================================================================
       TPU usage cap
       ====================================================================== */

    public int findTpuTotalHours() {
        return TPU_TOTAL_HOURS;
    }

    public int findTpuUsagePercent() {
        return tpuUsagePercent.get();
    }

    /** Persists the cap. Range validation belongs to the service. */
    public int saveTpuUsagePercent(int percent) {
        tpuUsagePercent.set(percent);
        return percent;
    }
}