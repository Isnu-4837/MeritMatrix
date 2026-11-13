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

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * A stored team member behind TeamRepository (one row per member).
 *
 * Raw values only. Filter rules, overview stats, credential checks, sandbox
 * reports, matching and the Copilot text stay in TeamService.
 *
 * Mapping to TeamRepository.MemberRecord:
 *   id, name, role, avatar, verified, availabilityScore, statusType, statusText -> columns
 *   skills       -> ordered list of strings
 *   meritBadges  -> ordered list of BadgeEmbeddable
 *
 * Audit time: the repository returns "hours before now" (findAuditHoursAgo).
 * Here the audit is stored as a timestamp ({@code lastAuditAt}) so it does not
 * go stale; compute the hours when mapping, and return 0 when it is null.
 *
 * The nested {@link SquadMemberEntity} stores the current squad. Its rows are
 * per user: add a user or workspace column when you have accounts.
 *
 * Requires Spring Boot 3.x (jakarta.persistence), Java 17+ and spring-boot-starter-data-jpa.
 */
@Entity
@Table(name = "team_members")
public class TeamEntity {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @Column(nullable = false) private String name;
    @Column(nullable = false) private String role;

    /** Image URL. Null until you store profile pictures. */
    private String avatar;

    @Column(nullable = false) private boolean verified;
    @Column(nullable = false) private int availabilityScore;

    /** leading | optimal | bench */
    @Column(nullable = false) private String statusType;

    @Column(length = 200) private String statusText;

    /** When the member's sandbox was last audited. Null means unknown. */
    private Instant lastAuditAt;

    /** Directory order is kept by this column. */
    @Column(nullable = false) private int position;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "team_member_skills", joinColumns = @JoinColumn(name = "member_id"))
    @OrderColumn(name = "position")
    @Column(name = "skill", nullable = false)
    private List<String> skills = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "team_member_badges", joinColumns = @JoinColumn(name = "member_id"))
    @OrderColumn(name = "position")
    private List<BadgeEmbeddable> meritBadges = new ArrayList<>();

    /* ======================================================================
       Embeddable types
       ====================================================================== */

    /** A merit badge. {@code hasCheck} means the proof was verified. */
    @Embeddable
    public static class BadgeEmbeddable {
        @Column(name = "title", nullable = false, length = 120)
        private String title;

        @Column(name = "icon")
        private String icon;

        @Column(name = "icon_color")
        private String iconColor;

        @Column(name = "has_check", nullable = false)
        private boolean hasCheck;

        /** Null when there is no verification proof on file. */
        @Column(name = "verification_detail", length = 500)
        private String verificationDetail;

        protected BadgeEmbeddable() {}

        public BadgeEmbeddable(String title, String icon, String iconColor,
                               boolean hasCheck, String verificationDetail) {
            this.title = title;
            this.icon = icon;
            this.iconColor = iconColor;
            this.hasCheck = hasCheck;
            this.verificationDetail = verificationDetail;
        }

        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public String getIcon() { return icon; }
        public void setIcon(String icon) { this.icon = icon; }
        public String getIconColor() { return iconColor; }
        public void setIconColor(String iconColor) { this.iconColor = iconColor; }
        public boolean isHasCheck() { return hasCheck; }
        public void setHasCheck(boolean hasCheck) { this.hasCheck = hasCheck; }
        public String getVerificationDetail() { return verificationDetail; }
        public void setVerificationDetail(String verificationDetail) { this.verificationDetail = verificationDetail; }
    }

    /* ======================================================================
       Squad
       ====================================================================== */

    /**
     * One member in the current squad. {@code position} keeps the order they
     * were added. The primary key is the member id, so adding someone already
     * in the squad changes nothing, as in the in-memory version.
     */
    @Entity
    @Table(name = "team_squad")
    public static class SquadMemberEntity {

        @Id
        @Column(name = "member_id", nullable = false)
        private String memberId;

        @Column(nullable = false)
        private int position;

        public SquadMemberEntity() {}

        public SquadMemberEntity(String memberId, int position) {
            this.memberId = memberId;
            this.position = position;
        }

        public String getMemberId() { return memberId; }
        public void setMemberId(String memberId) { this.memberId = memberId; }
        public int getPosition() { return position; }
        public void setPosition(int position) { this.position = position; }
    }

    /* ======================================================================
       Getters and setters
       ====================================================================== */

    public TeamEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getAvatar() { return avatar; }
    public void setAvatar(String avatar) { this.avatar = avatar; }
    public boolean isVerified() { return verified; }
    public void setVerified(boolean verified) { this.verified = verified; }
    public int getAvailabilityScore() { return availabilityScore; }
    public void setAvailabilityScore(int availabilityScore) { this.availabilityScore = availabilityScore; }
    public String getStatusType() { return statusType; }
    public void setStatusType(String statusType) { this.statusType = statusType; }
    public String getStatusText() { return statusText; }
    public void setStatusText(String statusText) { this.statusText = statusText; }
    public Instant getLastAuditAt() { return lastAuditAt; }
    public void setLastAuditAt(Instant lastAuditAt) { this.lastAuditAt = lastAuditAt; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
    public List<String> getSkills() { return skills; }
    public void setSkills(List<String> skills) { this.skills = skills; }
    public List<BadgeEmbeddable> getMeritBadges() { return meritBadges; }
    public void setMeritBadges(List<BadgeEmbeddable> meritBadges) { this.meritBadges = meritBadges; }
}
