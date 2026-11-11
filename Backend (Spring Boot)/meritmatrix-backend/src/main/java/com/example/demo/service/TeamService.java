package com.example.demo.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Predicate;
import java.util.stream.Collectors;

/**
 * Business logic behind TeamPage.jsx.
 *
 * Owns the team directory, the filter chips and their rules, the overview stats,
 * the squad, credential checks, sandbox reports, the audit export and the
 * skill-based matching. TeamController only handles HTTP and delegates here.
 *
 * Data is held in memory so the class runs on its own. To go live, replace the
 * member list with a repository (and the squad with a per-user table) and keep
 * the rules and derived values here.
 *
 * Requires Spring Boot 3.x and Java 17+.
 */
@Service
public class TeamService {

    /* ======================================================================
       Types returned to the controller (serialized as-is by Jackson)
       ====================================================================== */

    /** A merit badge. `hasCheck` means the proof was verified; `verificationDetail` is the popover text. */
    public record Badge(String title, String icon, String iconColor, boolean hasCheck, String verificationDetail) {}

    /** statusType is leading | optimal | bench. `avatar` is null here: keep image URLs with your profiles. */
    public record Member(
            String id,
            String name,
            String role,
            String avatar,
            boolean verified,
            int availabilityScore,
            String statusType,
            String statusText,
            List<String> skills,
            List<Badge> meritBadges) {}

    /** A filter chip with its count within the current search. */
    public record FilterChip(String id, String label, String icon, String iconColor, String dot, int count) {}

    /** One flat section ("all") or one per status when grouping. */
    public record Section(String key, String title, List<Member> items) {}

    public record Overview(
            int people,
            int verified,
            int averageAvailability,
            int onBench,
            Map<String, Integer> byStatus) {}

    /** What the Copilot bar and the "review squad" action should send. */
    public record Copilot(String prompt, String label) {}

    public record TeamResponse(
            Overview overview,
            List<FilterChip> filters,
            int shown,
            int total,
            List<Section> sections,
            List<String> squadIds,
            Copilot copilot) {}

    public record SquadState(List<Member> members, List<String> squadIds, Copilot copilot, String message) {}

    public record VerificationResult(
            String memberId,
            String memberName,
            String badgeTitle,
            boolean verified,
            String detail,
            Instant checkedAt) {}

    public record SandboxCheck(String name, boolean passed, String detail) {}

    /** "Inspect sandbox". */
    public record SandboxReport(
            String memberId,
            String name,
            String statusText,
            int availabilityScore,
            Instant lastAuditAt,
            int passedChecks,
            int totalChecks,
            List<SandboxCheck> checks) {}

    public record MatchCandidate(
            String id,
            String name,
            String role,
            String avatar,
            int matchPercent,
            List<String> matchedSkills,
            int availabilityScore,
            String statusText) {}

    /** "Find a match now" / "Recommend a squad". */
    public record MatchResult(List<String> requiredSkills, int size, List<MatchCandidate> candidates, String message) {}

    public record AuditEntry(
            String memberId,
            String name,
            String role,
            String status,
            int availabilityScore,
            boolean identityVerified,
            int verifiedBadges,
            int totalBadges,
            Instant lastAuditAt) {}

    /** "Export audit report". */
    public record AuditReport(Instant generatedAt, Overview overview, List<AuditEntry> entries) {}

    /** Unknown member id. Spring turns it into a 404. */
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public static class MemberNotFoundException extends RuntimeException {
        public MemberNotFoundException(String id) {
            super("Team member not found: " + id);
        }
    }

    /** Member has no badge with that title. Spring turns it into a 404. */
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public static class BadgeNotFoundException extends RuntimeException {
        public BadgeNotFoundException(String memberId, String title) {
            super("Badge not found for " + memberId + ": " + title);
        }
    }

    /** Unknown filter or sort, or bad match request. Spring turns it into a 400. */
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public static class InvalidQueryException extends RuntimeException {
        public InvalidQueryException(String message) {
            super(message);
        }
    }

    /* ======================================================================
       Constants and sample data
       ====================================================================== */

    private static final List<String> SORTS = List.of("default", "score-desc", "name");
    private static final List<String> STATUS_ORDER = List.of("leading", "optimal", "bench");
    private static final Map<String, String> STATUS_LABELS = Map.of(
            "leading", "Leading", "optimal", "Optimal", "bench", "On bench");

    private static final String COPILOT_DEFAULT = "Recommend a 3-person squad for High-Throughput Streaming Engine";
    private static final int DEFAULT_MATCH_SIZE = 3;
    private static final int MAX_MATCH_SIZE = 5;
    private static final int HIGH_AVAILABILITY = 90;

    /** One chip: its label, icon and the rule it applies. Adding a filter means adding one entry. */
    private record Filter(String id, String label, String icon, String iconColor, String dot, Predicate<Member> test) {}

    private static final List<Filter> FILTERS = List.of(
            new Filter("all", "Everyone", null, null, null, m -> true),
            new Filter("rust-go", "Rust / Go", "memory", "text-tertiary", null,
                    m -> hasSkill(m, List.of("Go", "Rust", "gRPC"))),
            new Filter("webgl", "Three.js / WebGL", "deployed_code", "text-secondary", null,
                    m -> hasSkill(m, List.of("WebSockets", "Next.js", "Tailwind")) || hasBadge(m, List.of("WebGL"))),
            new Filter("aws", "AWS certified", "cloud_done", "text-primary", null,
                    m -> hasBadge(m, List.of("AWS", "Cloud"))),
            new Filter("high-score", "High availability (90%+)", "verified", "text-secondary", null,
                    m -> m.availabilityScore() >= HIGH_AVAILABILITY),
            new Filter("bench", "On bench", null, null, "bg-secondary-container", TeamService::isBench));

    private static final List<Member> MEMBERS = List.of(
            new Member("elena", "Elena Vance", "Lead Architect", null, true, 96, "leading",
                    "Leading · top 5% of audits",
                    List.of("Rust", "Go", "gRPC", "Redis", "Kubernetes", "Zero-Trust", "Terraform"),
                    List.of(
                            new Badge("Rust Core Contributor", "memory", "text-tertiary", true,
                                    "Merged 40+ commits to the verified Rust runtime repository, checked against signed commit history."),
                            new Badge("Cloud Security Architect", "shield", "text-primary", true,
                                    "Passed the zero-trust design review in a proctored sandbox."))),
            new Member("alex", "Alex Rivera", "Staff Backend Engineer", null, true, 92, "optimal",
                    "Optimal · passed all checks",
                    List.of("Go", "gRPC", "Redis", "PostgreSQL", "Kafka", "WebSockets"),
                    List.of(
                            new Badge("Go Concurrency Expert", "bolt", "text-secondary", true,
                                    "Completed the timed concurrency challenge with zero race conditions."))),
            new Member("marcus", "Marcus Chen", "Senior Frontend Engineer", null, true, 88, "optimal",
                    "Optimal · audit due in 6 days",
                    List.of("Next.js", "WebSockets", "Tailwind", "TypeScript", "Three.js", "GLSL"),
                    List.of(
                            new Badge("WebGL Shader Pro", "deployed_code", "text-secondary", true,
                                    "Shader pipeline reproduced from scratch in a sandbox at 120 FPS."))),
            new Member("sophia", "Sophia Patel", "AI / ML Engineer", null, true, 97, "bench",
                    "On bench · 16h free this week",
                    List.of("Python", "CUDA", "PyTorch", "Rust", "Redis", "Triton"),
                    List.of(
                            new Badge("CUDA Kernel Optimizer", "memory", "text-tertiary", true,
                                    "Kernel benchmark beat the reference implementation by 18% on the audit GPU."),
                            new Badge("AWS ML Specialty", "cloud_done", "text-primary", true,
                                    "Certification confirmed with the issuing body."))),
            new Member("david", "David Kim", "DevOps / Cloud Engineer", null, true, 90, "optimal",
                    "Optimal · passed all checks",
                    List.of("Kubernetes", "Terraform", "Go", "AWS", "Prometheus", "Redis"),
                    List.of(
                            new Badge("AWS DevOps Professional", "cloud_done", "text-primary", true,
                                    "Certification confirmed with the issuing body."),
                            new Badge("Cloud Cost Optimizer", "savings", "text-secondary", false, null))),
            new Member("priya", "Priya Nair", "Contract Data Engineer", null, false, 81, "bench",
                    "Bench · available now",
                    List.of("Python", "Spark", "Kafka", "SQL", "Airflow"),
                    List.of(
                            new Badge("Data Pipeline Certified", "database", "text-primary", false, null))));

    /** When each member's sandbox was last audited, in hours before now. */
    private static final Map<String, Integer> AUDIT_HOURS_AGO = Map.of(
            "elena", 6, "alex", 30, "marcus", 52, "sophia", 12, "david", 75, "priya", 200);

    private final Clock clock = Clock.systemUTC();
    private final Set<String> squad = Collections.synchronizedSet(new LinkedHashSet<>());

    /* ======================================================================
       Public API
       ====================================================================== */

    /**
     * Mirrors the page's controls. Chip counts follow the search, not the chosen chip.
     *
     * @param filter  all | rust-go | webgl | aws | high-score | bench
     * @param query   matches name, role, skill or badge title
     * @param sort    default | score-desc | name
     * @param grouped one section per status instead of a single flat section
     */
    public TeamResponse list(String filter, String query, String sort, boolean grouped) {
        Filter rule = FILTERS.stream()
                .filter(f -> f.id().equals(filter == null || filter.isBlank() ? "all" : filter))
                .findFirst()
                .orElseThrow(() -> new InvalidQueryException("Unknown filter: " + filter));
        String sortKey = sort == null || sort.isBlank() ? "default" : sort;
        if (!SORTS.contains(sortKey)) throw new InvalidQueryException("Unknown sort: " + sort);

        String needle = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);

        List<Member> searched = MEMBERS.stream().filter(m -> matchesQuery(m, needle)).toList();

        List<FilterChip> chips = FILTERS.stream()
                .map(f -> new FilterChip(f.id(), f.label(), f.icon(), f.iconColor(), f.dot(),
                        (int) searched.stream().filter(f.test()).count()))
                .toList();

        Comparator<Member> order = switch (sortKey) {
            case "score-desc" -> Comparator.comparingInt(Member::availabilityScore).reversed();
            case "name" -> Comparator.comparing(Member::name, String.CASE_INSENSITIVE_ORDER);
            default -> (a, b) -> 0; // stable sort keeps directory order
        };
        List<Member> visible = searched.stream().filter(rule.test()).sorted(order).toList();

        return new TeamResponse(overview(MEMBERS), chips, visible.size(), MEMBERS.size(),
                sections(visible, grouped), squadIds(), copilot());
    }

    /** "Inspect sandbox". */
    public SandboxReport sandbox(String memberId) {
        Member m = find(memberId);

        List<SandboxCheck> checks = new ArrayList<>();
        checks.add(new SandboxCheck("Identity verification", m.verified(),
                m.verified() ? "Identity confirmed" : "Identity not yet verified"));
        checks.add(new SandboxCheck("Availability score", m.availabilityScore() >= HIGH_AVAILABILITY,
                m.availabilityScore() + "% (needs " + HIGH_AVAILABILITY + "%)"));
        for (Badge b : m.meritBadges()) {
            checks.add(new SandboxCheck(b.title(), b.hasCheck(),
                    b.verificationDetail() == null ? "No verification proof on file" : b.verificationDetail()));
        }

        int passed = (int) checks.stream().filter(SandboxCheck::passed).count();
        return new SandboxReport(m.id(), m.name(), m.statusText(), m.availabilityScore(),
                lastAudit(m), passed, checks.size(), checks);
    }

    /** "Verify a credential": checks one badge on one member. */
    public VerificationResult verify(String memberId, String badgeTitle) {
        Member m = find(memberId);
        Badge badge = m.meritBadges().stream()
                .filter(b -> b.title().equalsIgnoreCase(badgeTitle.trim()))
                .findFirst()
                .orElseThrow(() -> new BadgeNotFoundException(memberId, badgeTitle));

        boolean verified = badge.hasCheck() && badge.verificationDetail() != null;
        return new VerificationResult(m.id(), m.name(), badge.title(), verified,
                verified ? badge.verificationDetail() : "No verification proof on file.",
                Instant.now(clock));
    }

    /**
     * "Find a match now": ranks people by how many of the required skills they have,
     * weighted 70% skills and 30% availability. People with no matching skill are left out.
     *
     * @param size      how many people to return (default 3, at most 5)
     * @param benchOnly only consider people who are on the bench
     */
    public MatchResult match(List<String> requiredSkills, Integer size, Boolean benchOnly) {
        List<String> required = requiredSkills == null ? List.of() : requiredSkills.stream()
                .filter(Objects::nonNull).map(String::trim).filter(s -> !s.isEmpty()).distinct().toList();
        if (required.isEmpty()) throw new InvalidQueryException("Give at least one skill to match on");

        int wanted = size == null ? DEFAULT_MATCH_SIZE : size;
        if (wanted < 1 || wanted > MAX_MATCH_SIZE) {
            throw new InvalidQueryException("size must be between 1 and " + MAX_MATCH_SIZE);
        }
        Set<String> wantedLower = required.stream().map(s -> s.toLowerCase(Locale.ROOT)).collect(Collectors.toSet());

        List<MatchCandidate> ranked = MEMBERS.stream()
                .filter(m -> !Boolean.TRUE.equals(benchOnly) || isBench(m))
                .map(m -> {
                    List<String> matched = m.skills().stream()
                            .filter(s -> wantedLower.contains(s.toLowerCase(Locale.ROOT)))
                            .toList();
                    int percent = (int) Math.round(100 * (0.7 * matched.size() / required.size()
                            + 0.3 * m.availabilityScore() / 100.0));
                    return new MatchCandidate(m.id(), m.name(), m.role(), m.avatar(), percent, matched,
                            m.availabilityScore(), m.statusText());
                })
                .filter(c -> !c.matchedSkills().isEmpty())
                .sorted(Comparator.comparingInt(MatchCandidate::matchPercent).reversed()
                        .thenComparing(Comparator.comparingInt(MatchCandidate::availabilityScore).reversed()))
                .limit(wanted)
                .toList();

        String message = ranked.isEmpty()
                ? "No one has those skills yet. Try fewer or broader skills."
                : "Found " + ranked.size() + (ranked.size() == 1 ? " match" : " matches") + " for " + String.join(", ", required) + ".";
        return new MatchResult(required, wanted, ranked, message);
    }

    /** "Export audit report". */
    public AuditReport auditReport() {
        List<AuditEntry> entries = MEMBERS.stream()
                .map(m -> new AuditEntry(m.id(), m.name(), m.role(), statusKey(m), m.availabilityScore(),
                        m.verified(),
                        (int) m.meritBadges().stream().filter(Badge::hasCheck).count(),
                        m.meritBadges().size(), lastAudit(m)))
                .toList();
        return new AuditReport(Instant.now(clock), overview(MEMBERS), entries);
    }

    /* ---------------- Squad ---------------- */

    public SquadState squad() {
        return squadState(null);
    }

    /** Adding someone already in the squad changes nothing. */
    public SquadState addToSquad(String memberId) {
        Member m = find(memberId);
        squad.add(m.id());
        return squadState(m.name() + " added to your squad.");
    }

    public SquadState removeFromSquad(String memberId) {
        Member m = find(memberId);
        squad.remove(m.id());
        return squadState(m.name() + " removed from your squad.");
    }

    public SquadState clearSquad() {
        squad.clear();
        return squadState("Squad cleared.");
    }

    /* ======================================================================
       Derived values
       ====================================================================== */

    private Member find(String id) {
        return MEMBERS.stream().filter(m -> m.id().equals(id)).findFirst()
                .orElseThrow(() -> new MemberNotFoundException(id));
    }

    private Instant lastAudit(Member m) {
        return Instant.now(clock).minus(AUDIT_HOURS_AGO.getOrDefault(m.id(), 0), ChronoUnit.HOURS);
    }

    private static boolean hasSkill(Member m, List<String> list) {
        return m.skills().stream().anyMatch(list::contains);
    }

    private static boolean hasBadge(Member m, List<String> words) {
        return m.meritBadges().stream().anyMatch(b -> words.stream().anyMatch(w -> b.title().contains(w)));
    }

    private static boolean isBench(Member m) {
        return "bench".equals(m.statusType()) || (m.statusText() != null && m.statusText().contains("Bench"));
    }

    /** leading | optimal | bench, with anything unknown counted as bench (same as the page). */
    private static String statusKey(Member m) {
        if (isBench(m)) return "bench";
        return STATUS_ORDER.contains(m.statusType()) ? m.statusType() : "bench";
    }

    private static boolean matchesQuery(Member m, String needle) {
        if (needle.isEmpty()) return true;
        return m.name().toLowerCase(Locale.ROOT).contains(needle)
                || m.role().toLowerCase(Locale.ROOT).contains(needle)
                || m.skills().stream().anyMatch(s -> s.toLowerCase(Locale.ROOT).contains(needle))
                || m.meritBadges().stream().anyMatch(b -> b.title().toLowerCase(Locale.ROOT).contains(needle));
    }

    private static Overview overview(List<Member> members) {
        int n = members.size();
        int avg = n == 0 ? 0 : (int) Math.round(members.stream().mapToInt(Member::availabilityScore).average().orElse(0));

        Map<String, Integer> byStatus = new LinkedHashMap<>();
        STATUS_ORDER.forEach(k -> byStatus.put(k, 0));
        members.forEach(m -> byStatus.merge(statusKey(m), 1, Integer::sum));

        return new Overview(n, (int) members.stream().filter(Member::verified).count(), avg,
                byStatus.get("bench"), byStatus);
    }

    private static List<Section> sections(List<Member> visible, boolean grouped) {
        if (!grouped) return List.of(new Section("all", null, visible));

        List<Section> out = new ArrayList<>();
        for (String key : STATUS_ORDER) {
            List<Member> items = visible.stream().filter(m -> statusKey(m).equals(key)).toList();
            if (!items.isEmpty()) out.add(new Section(key, STATUS_LABELS.get(key), items));
        }
        return out;
    }

    private List<String> squadIds() {
        synchronized (squad) {
            return List.copyOf(squad);
        }
    }

    private List<Member> squadMembers() {
        List<String> ids = squadIds();
        return MEMBERS.stream().filter(m -> ids.contains(m.id())).toList();
    }

    private Copilot copilot() {
        List<Member> members = squadMembers();
        if (members.isEmpty()) return new Copilot(COPILOT_DEFAULT, "Ask Copilot: " + COPILOT_DEFAULT);
        String names = members.stream().map(Member::name).collect(Collectors.joining(", "));
        return new Copilot("Review this squad: " + names, "Ask Copilot to review your squad of " + members.size());
    }

    private SquadState squadState(String message) {
        return new SquadState(squadMembers(), squadIds(), copilot(), message);
    }
}