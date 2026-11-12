package com.example.demo.service;

import com.example.demo.repository.AnalyticsRepository;
import com.example.demo.repository.AnalyticsRepository.BurndownData;
import com.example.demo.repository.AnalyticsRepository.NeuralUsage;
import com.example.demo.repository.AnalyticsRepository.OverlapWindow;
import com.example.demo.repository.AnalyticsRepository.SandboxAudits;
import com.example.demo.repository.AnalyticsRepository.SeriesPoint;
import com.example.demo.repository.AnalyticsRepository.SprintInfo;
import com.example.demo.repository.AnalyticsRepository.SquadRecord;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Locale;

/**
 * Business logic behind AnalyticsPage.jsx.
 *
 * Reads raw data from {@link AnalyticsRepository} and computes everything
 * derived from it (velocity delta, ahead/behind, budget left, percentages,
 * labels). The controller only handles HTTP and delegates here, so the same
 * logic can be reused by other callers, such as the Settings page updating the
 * TPU cap.
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
       Constants
       ====================================================================== */

    public static final int TPU_MIN = 50;
    public static final int TPU_MAX = 100;

    /* ======================================================================
       Dependencies
       ====================================================================== */

    private final AnalyticsRepository repo;
    private final Clock clock = Clock.systemUTC();

    public AnalyticsService(AnalyticsRepository repo) {
        this.repo = repo;
    }

    /* ======================================================================
       Public API
       ====================================================================== */

    /**
     * Builds a fresh snapshot of everything the page shows. Called for the
     * initial load and for the "Refresh data" button.
     */
    public AnalyticsResponse snapshot() {
        SprintInfo sprint = repo.findCurrentSprint();
        OverlapWindow overlap = repo.findMeetingOverlap();

        return new AnalyticsResponse(
                Instant.now(clock),
                overlap.timezones(),
                velocityKpi(sprint),
                tpuKpi(repo.findTpuUsagePercent()),
                neuralKpi(),
                sandboxKpi(),
                burndown(sprint),
                repo.findAllSquads().stream().map(AnalyticsService::toSquad).toList(),
                meetingOverlap(overlap));
    }

    public Squad squad(String id) {
        return repo.findSquadById(id)
                .map(AnalyticsService::toSquad)
                .orElseThrow(() -> new SquadNotFoundException(id));
    }

    public int tpuUsage() {
        return repo.findTpuUsagePercent();
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
        return repo.saveTpuUsagePercent(percent);
    }

    /* ======================================================================
       Derived values
       ====================================================================== */

    private Kpi velocityKpi(SprintInfo sprint) {
        List<Double> history = repo.findVelocityHistory();
        double current = history.get(history.size() - 1);
        double previous = history.get(history.size() - 2);
        double delta = Math.round((current - previous) * 10) / 10.0;

        return new Kpi("velocity", "Sprint velocity", current, 1, "",
                String.format(Locale.US, "%+.1f vs last sprint", delta),
                String.format(Locale.US, "%.1f pts in Sprint %d", previous, sprint.number() - 1),
                history);
    }

    private TpuKpi tpuKpi(int percent) {
        int totalHours = repo.findTpuTotalHours();
        int used = Math.round(percent * totalHours / 100f);
        return new TpuKpi(percent,
                String.format(Locale.US, "%,d of %,d hrs", used, totalHours),
                100 - percent);
    }

    private Kpi neuralKpi() {
        NeuralUsage usage = repo.findNeuralUsage();
        return new Kpi("neural", "Neural actions", usage.actions(), 0, "",
                usage.hoursSaved() + " hrs saved", "Quantum v3.4 model calls", usage.spark());
    }

    private SandboxKpi sandboxKpi() {
        SandboxAudits audits = repo.findSandboxAudits();
        int percent = audits.total() == 0 ? 0 : Math.round(audits.signed() * 100f / audits.total());
        return new SandboxKpi(percent, audits.signed(), audits.total());
    }

    /** Ahead of schedule means today's actual remaining work is at or below today's ideal. */
    private Burndown burndown(SprintInfo sprint) {
        BurndownData data = repo.findBurndown();
        List<Point> ideal = toPoints(data.ideal());
        List<Point> actual = toPoints(data.actual());
        List<Point> projected = toPoints(data.projected());

        int ahead = valueAt(ideal, sprint.day()) - valueAt(actual, sprint.day());
        return new Burndown(sprint.number(), sprint.day(), sprint.length(),
                ideal, actual, projected, ahead >= 0, Math.abs(ahead));
    }

    private static MeetingOverlap meetingOverlap(OverlapWindow w) {
        return new MeetingOverlap(w.fromHourUtc(), w.toHourUtc(), w.hours(),
                String.format(Locale.US, "Best time to meet: %02d:00 – %s UTC",
                        w.fromHourUtc(), endOfWindow(w)));
    }

    /** "17:30" for a window that starts on the hour and lasts the window's hours. */
    private static String endOfWindow(OverlapWindow w) {
        int totalMinutes = (int) Math.round((w.fromHourUtc() + w.hours()) * 60);
        return String.format(Locale.US, "%02d:%02d", totalMinutes / 60, totalMinutes % 60);
    }

    private static int valueAt(List<Point> series, int day) {
        return series.stream()
                .filter(p -> p.day() == day)
                .mapToInt(Point::points)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No data for day " + day));
    }

    /* ======================================================================
       Mapping (repository records -> response types)
       ====================================================================== */

    private static Squad toSquad(SquadRecord s) {
        return new Squad(s.id(), s.name(), s.people(), s.capacityPercent(), s.note());
    }

    private static List<Point> toPoints(List<SeriesPoint> points) {
        return points.stream().map(p -> new Point(p.day(), p.points())).toList();
    }
}