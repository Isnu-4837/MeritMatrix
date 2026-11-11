package com.example.demo.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

/**
 * Business logic behind SprintsPage.jsx.
 *
 * Owns the team, their allocations and the milestone details. It works out each
 * person's booked hours and status, the overview cards, the filter counts, the
 * list of conflicts and the "Quick rebalance" that moves overflow hours to
 * people with free capacity. SprintsController only handles HTTP and delegates here.
 *
 * "Resolved" is derived, not stored: the sprint is resolved when nobody is
 * booked over capacity, so the page's isConflictResolved flag can come from
 * the board response.
 *
 * Data is held in memory so the class runs on its own. To go live, replace the
 * people and allocation lists with repositories and keep the derived values here.
 *
 * Requires Spring Boot 3.x and Java 17+.
 */
@Service
public class SprintsService {

    /* ======================================================================
       Types returned to the controller (serialized as-is by Jackson)
       ====================================================================== */

    public record SprintInfo(String name, int day, int length, int progressPercent) {}

    public record Week(String name, String range, boolean current) {}

    /** One bar in a person's timeline. */
    public record AllocationDto(
            String id,
            String title,
            String meta,
            String tag,
            String tone,
            int startWeek,
            int weeks,
            int hoursPerWeek,
            String milestoneId) {}

    /**
     * One person card. `status` is overbooked | bench | capacity | optimal and `statusText`
     * is the badge text. `photo` is null here: keep avatar URLs where you store profiles.
     */
    public record PersonRow(
            String id,
            String name,
            String initials,
            String photo,
            String role,
            String squad,
            String timezone,
            int hours,
            int capacity,
            int freeHours,
            String status,
            String statusText,
            boolean overbooked,
            List<AllocationDto> allocations) {}

    public record Utilization(int percent, int bookedHours, int availableHours, String label) {}

    public record ZoneLoad(String zone, int hours, boolean peak) {}

    public record TimezoneOverlap(List<ZoneLoad> zones, double bestOverlapHours, String bestOverlapLabel) {}

    public record Health(int overloaded, int onBench, String headline, String detail) {}

    public record Overview(Utilization utilization, TimezoneOverlap timezones, Health health) {}

    /** Squad counts are fixed; status counts follow the squad and search (not the status filter). */
    public record FilterCounts(Map<String, Integer> squads, Map<String, Integer> statuses) {}

    public record BoardResponse(
            SprintInfo sprint,
            List<Week> weeks,
            boolean resolved,
            int conflicts,
            Overview overview,
            FilterCounts filterCounts,
            int shown,
            int total,
            List<PersonRow> people) {}

    public record Move(String fromPersonId, String toPersonId, String title, int hours) {}

    public record RebalanceResult(List<Move> moves, int remainingConflicts, String message, BoardResponse board) {}

    public record Milestone(
            String id,
            String title,
            String personId,
            int assignedHoursPerWeek,
            int costRatePerHour,
            String sprintTarget) {}

    /** The suggestion line shown in the Copilot bar. */
    public record CopilotSuggestion(String headline, String detail, boolean resolved) {}

    /** Unknown person id. Spring turns it into a 404. */
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public static class PersonNotFoundException extends RuntimeException {
        public PersonNotFoundException(String id) {
            super("Person not found: " + id);
        }
    }

    /** Unknown milestone id. Spring turns it into a 404. */
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public static class MilestoneNotFoundException extends RuntimeException {
        public MilestoneNotFoundException(String id) {
            super("Milestone not found: " + id);
        }
    }

    /** Bad filter, sort or allocation values. Spring turns it into a 400. */
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public static class InvalidQueryException extends RuntimeException {
        public InvalidQueryException(String message) {
            super(message);
        }
    }

    /* ======================================================================
       Constants and sample data
       ====================================================================== */

    private static final int CAPACITY = 40;        // weekly hours per person
    private static final int CYCLE_DAY = 9;        // today, within the sprint
    private static final int CYCLE_LENGTH = 14;    // sprint length in days
    private static final int WEEK_COUNT = 4;       // weeks shown on the board
    private static final int BENCH_FREE_HOURS = 15; // this many free hours or more counts as "on bench"
    private static final double WORK_START = 9;    // local working hours, used for timezone overlap
    private static final double WORK_END = 17;
    private static final String SPRINT_NAME = "Sprint 14";

    private static final List<String> STATUSES = List.of("all", "overbooked", "bench", "capacity", "optimal");
    private static final List<String> SORTS = List.of("default", "load", "free", "name");
    private static final Set<String> TONES = Set.of("primary", "accent", "mixed", "neutral", "focus", "moved");
    private static final String ALL_SQUADS = "All squads";
    private static final List<String> SQUADS = List.of(ALL_SQUADS, "Core Infrastructure", "Frontend Core", "AI / ML Research");

    private static final DateTimeFormatter DAY_FORMAT = DateTimeFormatter.ofPattern("MMM dd", Locale.US);
    private static final DateTimeFormatter MONTH_FORMAT = DateTimeFormatter.ofPattern("MMM", Locale.US);

    private record Person(String id, String name, String role, String squad, String zone, double utcOffset) {}

    /** Internal allocation. `movable` marks work the rebalance is allowed to move. */
    private record Alloc(
            String id, String personId, String title, String detail, String tone,
            int startWeek, int weeks, int hoursPerWeek, String milestoneId, boolean movable) {

        Alloc withHours(int hours) {
            return new Alloc(id, personId, title, detail, tone, startWeek, weeks, hours, milestoneId, movable);
        }
    }

    /** A planned transfer of overflow hours from one person to another. */
    private record Plan(Person donor, Person receiver, Alloc source, int hours) {}

    private static final List<Person> PEOPLE = List.of(
            new Person("alex", "Alex Rivera", "Staff Backend · UTC+1", "Core Infrastructure", "UTC", 0),
            new Person("elena", "Elena Vance", "Lead Architect · PST", "Core Infrastructure", "PST", -8),
            new Person("marcus", "Marcus Chen", "Sr. Frontend · EST", "Frontend Core", "EST", -5),
            new Person("sophia", "Sophia Patel", "AI / ML Engineer · IST", "AI / ML Research", "IST", 5.5),
            new Person("david", "David Kim", "DevOps / Cloud · UTC+0", "Core Infrastructure", "UTC", 0));

    private static final List<Milestone> MILESTONES = List.of(
            new Milestone("MS-904", "Zero-Trust Access Control", "elena", 32, 180, "Sprint 14 target"));

    private final Clock clock = Clock.systemDefaultZone();
    private final Object lock = new Object();
    private final AtomicInteger allocSeq = new AtomicInteger(1);
    private final List<Alloc> allocs = new ArrayList<>();

    public SprintsService() {
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
       Public API
       ====================================================================== */

    /**
     * The whole page in one call.
     *
     * @param squad  All squads, or a squad name
     * @param status all | overbooked | bench | capacity | optimal
     * @param query  matches name or role
     * @param sort   default | load (most booked) | free (most free time) | name
     */
    public BoardResponse board(String squad, String status, String query, String sort) {
        String squadName = squad == null || squad.isBlank() ? ALL_SQUADS : squad;
        String statusKey = status == null || status.isBlank() ? "all" : status;
        String sortKey = sort == null || sort.isBlank() ? "default" : sort;

        if (!SQUADS.contains(squadName)) throw new InvalidQueryException("Unknown squad: " + squadName);
        if (!STATUSES.contains(statusKey)) throw new InvalidQueryException("Unknown status: " + statusKey);
        if (!SORTS.contains(sortKey)) throw new InvalidQueryException("Unknown sort: " + sortKey);

        String needle = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);

        synchronized (lock) {
            int cur = currentWeek();

            List<PersonRow> everyone = PEOPLE.stream().map(p -> row(p, cur)).toList();

            // Squad and search narrow the scope; status counts are taken from that scope.
            List<PersonRow> scoped = everyone.stream()
                    .filter(r -> squadName.equals(ALL_SQUADS) || r.squad().equals(squadName))
                    .filter(r -> needle.isEmpty()
                            || r.name().toLowerCase(Locale.ROOT).contains(needle)
                            || r.role().toLowerCase(Locale.ROOT).contains(needle))
                    .toList();

            List<PersonRow> visible = scoped.stream()
                    .filter(r -> statusKey.equals("all") || r.status().equals(statusKey))
                    .sorted(switch (sortKey) {
                        case "load" -> Comparator.comparingInt(PersonRow::hours).reversed();
                        case "free" -> Comparator.comparingInt(PersonRow::hours);
                        case "name" -> Comparator.comparing(PersonRow::name, String.CASE_INSENSITIVE_ORDER);
                        default -> (Comparator<PersonRow>) (a, b) -> 0; // stable sort keeps team order
                    })
                    .toList();

            int conflicts = (int) everyone.stream().filter(PersonRow::overbooked).count();

            return new BoardResponse(
                    sprint(), weeks(), conflicts == 0, conflicts,
                    overview(everyone, cur),
                    filterCounts(everyone, scoped),
                    visible.size(), everyone.size(), visible);
        }
    }

    /**
     * "Quick rebalance" / "Auto-fix" / "Assign task": moves overflow hours from anyone booked
     * over capacity to whoever has the most free time, as far as that capacity allows.
     * Safe to call again: with no conflicts it changes nothing.
     */
    public RebalanceResult rebalance() {
        synchronized (lock) {
            int cur = currentWeek();
            List<Move> moves = new ArrayList<>();

            List<Person> donors = PEOPLE.stream()
                    .filter(p -> hoursOf(p.id(), cur) > CAPACITY)
                    .sorted(Comparator.comparingInt((Person p) -> hoursOf(p.id(), cur)).reversed())
                    .toList();

            for (Person donor : donors) {
                while (hoursOf(donor.id(), cur) > CAPACITY) {
                    Plan plan = nextPlan(donor, cur);
                    if (plan == null) break; // nothing movable or nobody free
                    apply(plan);
                    moves.add(new Move(donor.id(), plan.receiver().id(), plan.source().title(), plan.hours()));
                }
            }

            int remaining = (int) PEOPLE.stream().filter(p -> hoursOf(p.id(), cur) > CAPACITY).count();
            return new RebalanceResult(moves, remaining, rebalanceMessage(moves, remaining),
                    board(ALL_SQUADS, "all", null, "default"));
        }
    }

    /** "Allocate member": adds an allocation. It may overbook the person; the board then shows the conflict. */
    public PersonRow allocate(String personId, String title, String detail,
                              int hoursPerWeek, int startWeek, int weeks, String tone) {
        Person person = findPerson(personId);
        String toneKey = tone == null || tone.isBlank() ? "primary" : tone;

        if (!TONES.contains(toneKey)) throw new InvalidQueryException("Unknown tone: " + toneKey);
        if (hoursPerWeek < 1 || hoursPerWeek > CAPACITY) {
            throw new InvalidQueryException("hoursPerWeek must be between 1 and " + CAPACITY);
        }
        if (startWeek < 0 || startWeek >= WEEK_COUNT) {
            throw new InvalidQueryException("startWeek must be between 0 and " + (WEEK_COUNT - 1));
        }
        if (weeks < 1 || startWeek + weeks > WEEK_COUNT) {
            throw new InvalidQueryException("The allocation must fit inside the " + WEEK_COUNT + " weeks shown");
        }

        synchronized (lock) {
            allocs.add(new Alloc("a" + allocSeq.getAndIncrement(), person.id(), title.trim(),
                    detail == null || detail.isBlank() ? null : detail.trim(),
                    toneKey, startWeek, weeks, hoursPerWeek, null, true));
            return row(person, currentWeek());
        }
    }

    /** Details for the expandable milestone panel. */
    public Milestone milestone(String id) {
        return MILESTONES.stream()
                .filter(m -> m.id().equals(id))
                .findFirst()
                .orElseThrow(() -> new MilestoneNotFoundException(id));
    }

    /** What the Copilot bar should say, without changing anything. */
    public CopilotSuggestion suggestion() {
        synchronized (lock) {
            int cur = currentWeek();
            Optional<Person> donor = PEOPLE.stream()
                    .filter(p -> hoursOf(p.id(), cur) > CAPACITY)
                    .max(Comparator.comparingInt(p -> hoursOf(p.id(), cur)));

            if (donor.isEmpty()) {
                Person busiest = PEOPLE.stream().max(Comparator.comparingInt(p -> hoursOf(p.id(), cur))).orElseThrow();
                String detail = allocs.stream()
                        .filter(a -> a.personId().equals(busiest.id()) && active(a, cur))
                        .max(Comparator.comparingInt(Alloc::hoursPerWeek))
                        .map(a -> "Suggestion: keep an eye on " + a.title() + " (" + a.hoursPerWeek() + "h/wk, the heaviest load)")
                        .orElse("Suggestion: nothing to do right now");
                return new CopilotSuggestion(SPRINT_NAME + " is balanced. No allocation clashes.", detail, true);
            }

            Person d = donor.get();
            Plan plan = nextPlan(d, cur);
            String detail = plan == null
                    ? "Suggestion: free up hours or add capacity, nobody has room to help"
                    : "Suggestion: move " + plan.hours() + "h of " + plan.source().title() + " to " + plan.receiver().name();
            return new CopilotSuggestion("Ask Copilot how to fix " + d.name() + "'s overbooking", detail, false);
        }
    }

    /* ======================================================================
       Rebalance helpers
       ====================================================================== */

    /** Picks the donor's biggest movable allocation and the person with the most free hours. */
    private Plan nextPlan(Person donor, int cur) {
        int excess = hoursOf(donor.id(), cur) - CAPACITY;
        if (excess <= 0) return null;

        Alloc source = allocs.stream()
                .filter(a -> a.personId().equals(donor.id()) && a.movable() && active(a, cur))
                .max(Comparator.comparingInt(Alloc::hoursPerWeek))
                .orElse(null);

        Person receiver = PEOPLE.stream()
                .filter(p -> !p.id().equals(donor.id()))
                .filter(p -> CAPACITY - hoursOf(p.id(), cur) > 0)
                .max(Comparator.comparingInt(p -> CAPACITY - hoursOf(p.id(), cur)))
                .orElse(null);

        if (source == null || receiver == null) return null;

        int free = CAPACITY - hoursOf(receiver.id(), cur);
        int hours = Math.min(excess, Math.min(free, source.hoursPerWeek()));
        return hours <= 0 ? null : new Plan(donor, receiver, source, hours);
    }

    private void apply(Plan plan) {
        Alloc src = plan.source();
        int index = allocs.indexOf(src);
        int left = src.hoursPerWeek() - plan.hours();
        if (left > 0) allocs.set(index, src.withHours(left));
        else allocs.remove(index);

        allocs.add(new Alloc("a" + allocSeq.getAndIncrement(), plan.receiver().id(), src.title(),
                "Reallocated +" + plan.hours() + "h", "moved",
                src.startWeek(), src.weeks(), plan.hours(), src.milestoneId(), true));
    }

    private String rebalanceMessage(List<Move> moves, int remaining) {
        if (moves.isEmpty()) {
            return remaining == 0
                    ? "No conflicts to resolve."
                    : "Nobody has free capacity to take the overflow.";
        }
        Map<String, Integer> byReceiver = new LinkedHashMap<>();
        for (Move m : moves) byReceiver.merge(findPerson(m.toPersonId()).name(), m.hours(), Integer::sum);
        String summary = byReceiver.entrySet().stream()
                .map(e -> e.getValue() + "h moved to " + e.getKey())
                .collect(Collectors.joining(", "));

        return remaining == 0
                ? "Done: " + summary + ". All allocations are now within capacity."
                : summary + ". " + remaining + " conflict(s) still need attention.";
    }

    /* ======================================================================
       Derived values
       ====================================================================== */

    private void seed(String personId, String title, String detail, String tone,
                      int startWeek, int weeks, int hours, String milestoneId, boolean movable) {
        allocs.add(new Alloc("a" + allocSeq.getAndIncrement(), personId, title, detail, tone,
                startWeek, weeks, hours, milestoneId, movable));
    }

    private Person findPerson(String id) {
        return PEOPLE.stream().filter(p -> p.id().equals(id)).findFirst()
                .orElseThrow(() -> new PersonNotFoundException(id));
    }

    private LocalDate sprintStart() {
        return LocalDate.now(clock).minusDays(CYCLE_DAY - 1);
    }

    /** Index (0-based) of the week that contains today. */
    private int currentWeek() {
        long days = ChronoUnit.DAYS.between(sprintStart(), LocalDate.now(clock));
        return (int) Math.max(0, Math.min(WEEK_COUNT - 1, days / 7));
    }

    private static boolean active(Alloc a, int week) {
        return week >= a.startWeek() && week < a.startWeek() + a.weeks();
    }

    private int hoursOf(String personId, int week) {
        return allocs.stream()
                .filter(a -> a.personId().equals(personId) && active(a, week))
                .mapToInt(Alloc::hoursPerWeek)
                .sum();
    }

    private SprintInfo sprint() {
        return new SprintInfo(SPRINT_NAME, CYCLE_DAY, CYCLE_LENGTH,
                (int) Math.round(CYCLE_DAY * 100.0 / CYCLE_LENGTH));
    }

    private List<Week> weeks() {
        LocalDate start = sprintStart();
        int cur = currentWeek();
        List<Week> out = new ArrayList<>();
        for (int i = 0; i < WEEK_COUNT; i++) {
            LocalDate from = start.plusDays(7L * i);
            LocalDate to = from.plusDays(6);
            String name = from.format(MONTH_FORMAT) + " W" + ((from.getDayOfMonth() - 1) / 7 + 1);
            out.add(new Week(name, from.format(DAY_FORMAT) + " – " + to.format(DAY_FORMAT), i == cur));
        }
        return out;
    }

    private String rangeText(int startWeek, int weeks) {
        LocalDate from = sprintStart().plusDays(7L * startWeek);
        LocalDate to = sprintStart().plusDays(7L * (startWeek + weeks) - 1);
        return from.format(DAY_FORMAT) + " – " + to.format(DAY_FORMAT);
    }

    private PersonRow row(Person p, int cur) {
        int hours = hoursOf(p.id(), cur);
        int free = Math.max(0, CAPACITY - hours);
        String status = statusOf(hours);

        List<AllocationDto> bars = allocs.stream()
                .filter(a -> a.personId().equals(p.id()))
                .sorted(Comparator.comparingInt(Alloc::startWeek))
                .map(a -> new AllocationDto(
                        a.id(), a.title(),
                        a.detail() == null ? a.hoursPerWeek() + "h/wk" : a.detail() + " · " + a.hoursPerWeek() + "h/wk",
                        rangeText(a.startWeek(), a.weeks()),
                        a.tone(), a.startWeek(), a.weeks(), a.hoursPerWeek(), a.milestoneId()))
                .toList();

        return new PersonRow(p.id(), p.name(), initials(p.name()), null, p.role(), p.squad(), p.zone(),
                hours, CAPACITY, free, status, statusText(status, hours, free),
                status.equals("overbooked"), bars);
    }

    private static String statusOf(int hours) {
        if (hours > CAPACITY) return "overbooked";
        if (hours == CAPACITY) return "capacity";
        return CAPACITY - hours >= BENCH_FREE_HOURS ? "bench" : "optimal";
    }

    private static String statusText(String status, int hours, int free) {
        return switch (status) {
            case "overbooked" -> "Double-booked (" + hours + "h)";
            case "bench" -> "On bench (" + free + "h free)";
            case "capacity" -> "At capacity (" + hours + "h)";
            default -> "Optimal (" + hours + "h)";
        };
    }

    private static String initials(String name) {
        return Arrays.stream(name.split(" "))
                .filter(s -> !s.isEmpty())
                .map(s -> s.substring(0, 1))
                .collect(Collectors.joining())
                .toUpperCase(Locale.ROOT);
    }

    private FilterCounts filterCounts(List<PersonRow> everyone, List<PersonRow> scoped) {
        Map<String, Integer> squads = new LinkedHashMap<>();
        for (String s : SQUADS) {
            squads.put(s, s.equals(ALL_SQUADS)
                    ? everyone.size()
                    : (int) everyone.stream().filter(r -> r.squad().equals(s)).count());
        }
        Map<String, Integer> statuses = new LinkedHashMap<>();
        for (String s : STATUSES) {
            statuses.put(s, s.equals("all")
                    ? scoped.size()
                    : (int) scoped.stream().filter(r -> r.status().equals(s)).count());
        }
        return new FilterCounts(squads, statuses);
    }

    /* ---------------- Overview cards ---------------- */

    private Overview overview(List<PersonRow> everyone, int cur) {
        int booked = everyone.stream().mapToInt(PersonRow::hours).sum();
        int available = everyone.size() * CAPACITY;
        int percent = available == 0 ? 0 : (int) Math.round(booked * 100.0 / available);
        String label = percent > 100 ? "Over capacity" : percent >= 75 ? "Healthy" : "Underused";

        int over = (int) everyone.stream().filter(PersonRow::overbooked).count();
        int bench = (int) everyone.stream().filter(r -> r.status().equals("bench")).count();

        String headline = over > 0 ? over + (over == 1 ? " overload" : " overloads") : "All balanced";
        String detail = over > 0
                ? (bench > 0 ? bench + " on bench, ready to help" : "Nobody free to help")
                : (bench > 0 ? bench + " on bench, available" : "Bench is fully booked");

        return new Overview(new Utilization(percent, booked, available, label),
                timezones(everyone),
                new Health(over, bench, headline, detail));
    }

    /**
     * Booked hours per timezone, and the longest daily overlap of local working hours (9-17)
     * between the busiest zone and any other zone.
     */
    private TimezoneOverlap timezones(List<PersonRow> everyone) {
        Map<String, Double> offsets = new LinkedHashMap<>();
        Map<String, Integer> hours = new LinkedHashMap<>();
        for (Person p : PEOPLE) {
            offsets.putIfAbsent(p.zone(), p.utcOffset());
            int h = everyone.stream().filter(r -> r.id().equals(p.id())).mapToInt(PersonRow::hours).sum();
            hours.merge(p.zone(), h, Integer::sum);
        }

        List<String> ordered = offsets.keySet().stream()
                .sorted(Comparator.comparingDouble(offsets::get))
                .toList();
        String peak = ordered.stream().max(Comparator.comparingInt(hours::get)).orElse("");

        double best = 0;
        String bestLabel = peak;
        for (String zone : ordered) {
            if (zone.equals(peak)) continue;
            double overlap = overlapHours(offsets.get(peak), offsets.get(zone));
            if (overlap > best) {
                best = overlap;
                bestLabel = peak + " + " + zone;
            }
        }

        List<ZoneLoad> zones = ordered.stream()
                .map(z -> new ZoneLoad(z, hours.get(z), z.equals(peak)))
                .toList();
        return new TimezoneOverlap(zones, Math.round(best * 10) / 10.0, bestLabel);
    }

    private static double overlapHours(double offsetA, double offsetB) {
        double startA = WORK_START - offsetA, endA = WORK_END - offsetA;
        double startB = WORK_START - offsetB, endB = WORK_END - offsetB;
        double best = 0;
        for (int shift : new int[]{-24, 0, 24}) { // handle windows that wrap past midnight UTC
            best = Math.max(best, Math.min(endA, endB + shift) - Math.max(startA, startB + shift));
        }
        return Math.max(0, best);
    }
}