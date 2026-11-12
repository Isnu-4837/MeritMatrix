package com.example.demo.repository;

import org.springframework.stereotype.Repository;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Data-access layer for {@code TeamService}.
 *
 * Stores the team directory, when each member was last audited, and the current
 * squad, and returns raw data only. Filter rules, overview stats, credential
 * checks, sandbox reports, matching and the Copilot text stay in the service.
 *
 * This implementation keeps the sample data in memory so the app runs on its
 * own. To go live, keep the public method signatures and swap the bodies for
 * JPA / JdbcTemplate calls (with the squad in a per-user table), or turn this
 * class into an interface and move this code into an InMemoryTeamRepository.
 *
 * Requires Spring Boot 3.x and Java 17+.
 */
@Repository
public class TeamRepository {

    /* ======================================================================
       Raw data types (kept here so the repository does not depend on the service)
       ====================================================================== */

    /** A merit badge. {@code hasCheck} means the proof was verified. */
    public record BadgeRecord(String title, String icon, String iconColor, boolean hasCheck, String verificationDetail) {}

    public record MemberRecord(
            String id,
            String name,
            String role,
            String avatar,
            boolean verified,
            int availabilityScore,
            String statusType,
            String statusText,
            List<String> skills,
            List<BadgeRecord> meritBadges) {}

    /* ======================================================================
       Sample data
       ====================================================================== */

    private static final List<MemberRecord> MEMBERS = List.of(
            new MemberRecord("elena", "Elena Vance", "Lead Architect", null, true, 96, "leading",
                    "Leading · top 5% of audits",
                    List.of("Rust", "Go", "gRPC", "Redis", "Kubernetes", "Zero-Trust", "Terraform"),
                    List.of(
                            new BadgeRecord("Rust Core Contributor", "memory", "text-tertiary", true,
                                    "Merged 40+ commits to the verified Rust runtime repository, checked against signed commit history."),
                            new BadgeRecord("Cloud Security Architect", "shield", "text-primary", true,
                                    "Passed the zero-trust design review in a proctored sandbox."))),
            new MemberRecord("alex", "Alex Rivera", "Staff Backend Engineer", null, true, 92, "optimal",
                    "Optimal · passed all checks",
                    List.of("Go", "gRPC", "Redis", "PostgreSQL", "Kafka", "WebSockets"),
                    List.of(
                            new BadgeRecord("Go Concurrency Expert", "bolt", "text-secondary", true,
                                    "Completed the timed concurrency challenge with zero race conditions."))),
            new MemberRecord("marcus", "Marcus Chen", "Senior Frontend Engineer", null, true, 88, "optimal",
                    "Optimal · audit due in 6 days",
                    List.of("Next.js", "WebSockets", "Tailwind", "TypeScript", "Three.js", "GLSL"),
                    List.of(
                            new BadgeRecord("WebGL Shader Pro", "deployed_code", "text-secondary", true,
                                    "Shader pipeline reproduced from scratch in a sandbox at 120 FPS."))),
            new MemberRecord("sophia", "Sophia Patel", "AI / ML Engineer", null, true, 97, "bench",
                    "On bench · 16h free this week",
                    List.of("Python", "CUDA", "PyTorch", "Rust", "Redis", "Triton"),
                    List.of(
                            new BadgeRecord("CUDA Kernel Optimizer", "memory", "text-tertiary", true,
                                    "Kernel benchmark beat the reference implementation by 18% on the audit GPU."),
                            new BadgeRecord("AWS ML Specialty", "cloud_done", "text-primary", true,
                                    "Certification confirmed with the issuing body."))),
            new MemberRecord("david", "David Kim", "DevOps / Cloud Engineer", null, true, 90, "optimal",
                    "Optimal · passed all checks",
                    List.of("Kubernetes", "Terraform", "Go", "AWS", "Prometheus", "Redis"),
                    List.of(
                            new BadgeRecord("AWS DevOps Professional", "cloud_done", "text-primary", true,
                                    "Certification confirmed with the issuing body."),
                            new BadgeRecord("Cloud Cost Optimizer", "savings", "text-secondary", false, null))),
            new MemberRecord("priya", "Priya Nair", "Contract Data Engineer", null, false, 81, "bench",
                    "Bench · available now",
                    List.of("Python", "Spark", "Kafka", "SQL", "Airflow"),
                    List.of(
                            new BadgeRecord("Data Pipeline Certified", "database", "text-primary", false, null))));

    /** When each member's sandbox was last audited, in hours before now. */
    private static final Map<String, Integer> AUDIT_HOURS_AGO = Map.of(
            "elena", 6, "alex", 30, "marcus", 52, "sophia", 12, "david", 75, "priya", 200);

    /* ======================================================================
       Mutable state
       ====================================================================== */

    /** Member ids in the order they were added to the squad. */
    private final Set<String> squad = Collections.synchronizedSet(new LinkedHashSet<>());

    /* ======================================================================
       Members
       ====================================================================== */

    /** The whole directory, in directory order. */
    public List<MemberRecord> findAllMembers() {
        return MEMBERS;
    }

    public Optional<MemberRecord> findMemberById(String id) {
        return MEMBERS.stream().filter(m -> m.id().equals(id)).findFirst();
    }

    /** Hours before now that the member's sandbox was last audited (0 if unknown). */
    public int findAuditHoursAgo(String memberId) {
        return AUDIT_HOURS_AGO.getOrDefault(memberId, 0);
    }

    /* ======================================================================
       Squad
       ====================================================================== */

    /** Member ids in the squad, in the order they were added. The returned list is an immutable copy. */
    public List<String> findSquadIds() {
        synchronized (squad) {
            return List.copyOf(squad);
        }
    }

    /** Adding an id that is already in the squad changes nothing. */
    public void addToSquad(String memberId) {
        squad.add(memberId);
    }

    public void removeFromSquad(String memberId) {
        squad.remove(memberId);
    }

    public void clearSquad() {
        squad.clear();
    }
}