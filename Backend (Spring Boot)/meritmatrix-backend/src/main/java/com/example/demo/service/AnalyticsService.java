package com.example.demo.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Business logic behind AnalyticsPage.jsx.
 *
 * Owns the analytics snapshot (KPI cards, burndown, squads, meeting overlap)
 * and the TPU usage cap. The controller only handles HTTP and delegates here,
 * so the same logic can be reused by other callers, such as the Settings page
 * updating the TPU cap.
 *
 * The sample data below is held in memory so the class runs on its own. To go
 * live, replace the constants with repository or metrics-client calls and keep
 * the derived values (ahead/behind, budget left, percentages) computed here.
 *
 * Requires Spring Boot 3.x and Java 17+.
 */
@Service
public class AnalyticsService {

    /* ======================================================================
       Types returned to the controller (serialized as-is by Jackson)
       ====================================================================== */

    /** A KPI card. `spark` is null for cards without a sparkline. */
    public record Kpi(
            String id,
            String label,
            double value,
            int decimals,
            String suffix,
            String badge,
            String sub,
            List<Double> spark) {}

    public record TpuKpi(int percent, String usedOfTotal, int budgetLeftPercent) {}

    public record SandboxKpi(int percent, int signed, int total) {}

    public record Point(int day, int points) {}

    public record Burndown(
            int sprintNumber,
            int sprintDay,
            int sprintLength,
            List<Point> ideal,
            List<Point> actual,
            List<Point> projected,
            boolean aheadOfSchedule,
            int pointsAhead) {}

    public record Squad(String id, String name, String people, int capacityPercent, String note) {}

    public record MeetingOverlap(int fromHourUtc, int toHourUtc, double hours, String label) {}

    public record AnalyticsResponse(
            Instant generatedAt,
            int timezones,
            Kpi velocity,
            TpuKpi tpu,
            Kpi neuralActions,
            SandboxKpi sandboxAudits,
            Burndown burndown,
            List<Squad> squads,
            MeetingOverlap overlap) {}

    /** Thrown when a squad id does not exist. Spring turns it into a 404. */
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public static class SquadNotFoundException extends RuntimeException {
        public SquadNotFoundException(String id) {
            super("Squad not found: " + id);
        }
    }

    /* ======================================================================
       Constants and sample data
       ====================================================================== */

    public static final int TPU_MIN = 50;
    public static final int TPU_MAX = 100;

    private static final int SPRINT_NUMBER = 14;
    private static final int SPRINT_DAY = 9;
    private static final int SPRINT_LENGTH = 14;
    private static final int TPU_TOTAL_HOURS = 1000;

    /** Velocity per sprint, oldest first. The last entry is the current sprint. */
    private static final List<Double> VELOCITY_HISTORY = List.of(78.0, 82.0, 80.0, 87.8, 94.2);

    private static final int NEURAL_ACTIONS = 1280;
    private static final int NEURAL_HOURS_SAVED = 34;
    private static final List<Double> NEURAL_SPARK = List.of(40.0, 55.0, 52.0, 70.0, 88.0, 100.0);

    private static final int SANDBOXES_SIGNED = 5;
    private static final int SANDBOXES_TOTAL = 5;

    private static final List<Point> IDEAL = List.of(
            new Point(1, 100), new Point(3, 85), new Point(5, 70), new Point(7, 55),
            new Point(9, 40), new Point(11, 25), new Point(14, 0));

    private static final List<Point> ACTUAL = List.of(
            new Point(1, 98), new Point(3, 88), new Point(5, 68), new Point(7, 52), new Point(9, 36));

    private static final List<Point> PROJECTED = List.of(
            new Point(9, 36), new Point(11, 20), new Point(14, 0));

    private static final List<Squad> SQUADS = List.of(
            new Squad("core", "Core Infrastructure", "Elena, Alex, David", 98,
                    "Near full capacity. Avoid adding new work this sprint."),
            new Squad("frontend", "Frontend Systems", "Marcus Chen", 88,
                    "Capacity is normalized across timezones."),
            new Squad("ml", "AI / ML Research", "Sophia Patel", 92,
                    "Active on the benchmark run. Room for small reviews only."));

    private static final int TIMEZONES = 4;
    private static final int OVERLAP_FROM_UTC = 14;
    private static final int OVERLAP_TO_UTC = 18;
    private static final double OVERLAP_HOURS = 3.5;

    /* ======================================================================
       State
       ====================================================================== */

    private final Clock clock = Clock.systemUTC();
    private final AtomicInteger tpuUsage = new AtomicInteger(78);

    /* ======================================================================
       Public API
       ====================================================================== */

    /**
     * Builds a fresh snapshot of everything the page shows. Called for the
     * initial load and for the "Refresh data" button.
     */
    public AnalyticsResponse snapshot() {
        return new AnalyticsResponse(
                Instant.now(clock),
                TIMEZONES,
                velocityKpi(),
                tpuKpi(tpuUsage.get()),
                neuralKpi(),
                sandboxKpi(),
                burndown(),
                SQUADS,
                new MeetingOverlap(OVERLAP_FROM_UTC, OVERLAP_TO_UTC, OVERLAP_HOURS,
                        String.format(Locale.US, "Best time to meet: %02d:00 – %s UTC",
                                OVERLAP_FROM_UTC, endOfWindow())));
    }

    public Squad squad(String id) {
        return SQUADS.stream()
                .filter(s -> s.id().equals(id))
                .findFirst()
                .orElseThrow(() -> new SquadNotFoundException(id));
    }

    public int tpuUsage() {
        return tpuUsage.get();
    }

    /**
     * Sets the TPU cap. The Settings page and the Analytics KPI both read this
     * value, so there is a single source of truth.
     *
     * @throws IllegalArgumentException if the value is outside 50..100
     */
    public int updateTpuUsage(int percent) {
        if (percent < TPU_MIN || percent > TPU_MAX) {
            throw new IllegalArgumentException("TPU cap must be between " + TPU_MIN + " and " + TPU_MAX);
        }
        tpuUsage.set(percent);
        return percent;
    }

    /* ======================================================================
       Derived values
       ====================================================================== */

    private Kpi velocityKpi() {
        double current = VELOCITY_HISTORY.get(VELOCITY_HISTORY.size() - 1);
        double previous = VELOCITY_HISTORY.get(VELOCITY_HISTORY.size() - 2);
        double delta = Math.round((current - previous) * 10) / 10.0;

        return new Kpi("velocity", "Sprint velocity", current, 1, "",
                String.format(Locale.US, "%+.1f vs last sprint", delta),
                String.format(Locale.US, "%.1f pts in Sprint %d", previous, SPRINT_NUMBER - 1),
                VELOCITY_HISTORY);
    }

    private static TpuKpi tpuKpi(int percent) {
        int used = Math.round(percent * TPU_TOTAL_HOURS / 100f);
        return new TpuKpi(percent,
                String.format(Locale.US, "%,d of %,d hrs", used, TPU_TOTAL_HOURS),
                100 - percent);
    }

    private static Kpi neuralKpi() {
        return new Kpi("neural", "Neural actions", NEURAL_ACTIONS, 0, "",
                NEURAL_HOURS_SAVED + " hrs saved", "Quantum v3.4 model calls", NEURAL_SPARK);
    }

    private static SandboxKpi sandboxKpi() {
        int percent = SANDBOXES_TOTAL == 0 ? 0 : Math.round(SANDBOXES_SIGNED * 100f / SANDBOXES_TOTAL);
        return new SandboxKpi(percent, SANDBOXES_SIGNED, SANDBOXES_TOTAL);
    }

    /** Ahead of schedule means today's actual remaining work is at or below today's ideal. */
    private static Burndown burndown() {
        int ahead = valueAt(IDEAL, SPRINT_DAY) - valueAt(ACTUAL, SPRINT_DAY);
        return new Burndown(SPRINT_NUMBER, SPRINT_DAY, SPRINT_LENGTH,
                IDEAL, ACTUAL, PROJECTED, ahead >= 0, Math.abs(ahead));
    }

    private static int valueAt(List<Point> series, int day) {
        return series.stream()
                .filter(p -> p.day() == day)
                .mapToInt(Point::points)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No data for day " + day));
    }

    /** "17:30" for a window that starts on the hour and lasts OVERLAP_HOURS. */
    private static String endOfWindow() {
        int totalMinutes = (int) Math.round((OVERLAP_FROM_UTC + OVERLAP_HOURS) * 60);
        return String.format(Locale.US, "%02d:%02d", totalMinutes / 60, totalMinutes % 60);
    }
}