package com.example.demo.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/**
 * Stored settings behind SettingsRepository (single-row table).
 *
 * One column per setting, matching SettingsRepository.SettingsRecord and the
 * page's draft object. Validation, change detection and the overview cards
 * stay in SettingsService. The factory defaults stay in code
 * (SettingsRepository.findDefaults()), not in this table.
 *
 * Note: {@code tpu} is the same value the Analytics KPI reads as the TPU cap
 * (AnalyticsEntity.tpuUsagePercent). When you go live, keep one of them as the
 * source of truth and have the other read it.
 *
 * Groups: workspace, engine, appearance, notifications, security, data.
 * Per the repository notes, appearance can move to a per-user table later.
 *
 * Requires Spring Boot 3.x (jakarta.persistence), Java 17+ and spring-boot-starter-data-jpa.
 */
@Entity
@Table(name = "settings")
public class SettingsEntity {

    /** The table holds one row; this is its fixed id. */
    public static final long SINGLETON_ID = 1L;

    @Id
    private Long id = SINGLETON_ID;

    /** Guards against two saves overwriting each other. */
    @Version
    private long version;

    /* ---- workspace ---- */
    @Column(nullable = false) private int capacity;
    @Column(nullable = false) private String sprintLength;
    @Column(nullable = false) private String weekStart;
    @Column(nullable = false) private String timezone;
    @Column(nullable = false) private String landing;

    /* ---- engine ---- */
    @Column(nullable = false) private String engineVersion;
    @Column(nullable = false) private int tpu;
    @Column(nullable = false) private boolean tpuBurst;

    /* ---- appearance ---- */
    @Column(nullable = false) private String theme;
    @Column(nullable = false) private String density;
    @Column(nullable = false) private boolean reduceMotion;
    @Column(nullable = false) private boolean keyHints;

    /* ---- notifications ---- */
    @Column(nullable = false) private boolean notifyClash;
    @Column(nullable = false) private boolean notifyEmail;
    @Column(nullable = false) private boolean notifyInApp;
    @Column(nullable = false) private boolean notifySlack;
    @Column(nullable = false) private int overloadAt;
    @Column(nullable = false) private String digest;
    @Column(nullable = false) private boolean quietHours;
    @Column(nullable = false) private String quietFrom;
    @Column(nullable = false) private String quietTo;

    /* ---- security ---- */
    @Column(nullable = false) private boolean twoFactor;
    @Column(nullable = false) private boolean signInAlerts;
    @Column(nullable = false) private String sessionTimeout;

    /* ---- data ---- */
    @Column(nullable = false) private boolean aiLearning;
    @Column(nullable = false) private String retention;

    public SettingsEntity() {}

    public Long getId() { return id; }
    public long getVersion() { return version; }

    public int getCapacity() { return capacity; }
    public void setCapacity(int capacity) { this.capacity = capacity; }
    public String getSprintLength() { return sprintLength; }
    public void setSprintLength(String sprintLength) { this.sprintLength = sprintLength; }
    public String getWeekStart() { return weekStart; }
    public void setWeekStart(String weekStart) { this.weekStart = weekStart; }
    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }
    public String getLanding() { return landing; }
    public void setLanding(String landing) { this.landing = landing; }

    public String getEngineVersion() { return engineVersion; }
    public void setEngineVersion(String engineVersion) { this.engineVersion = engineVersion; }
    public int getTpu() { return tpu; }
    public void setTpu(int tpu) { this.tpu = tpu; }
    public boolean isTpuBurst() { return tpuBurst; }
    public void setTpuBurst(boolean tpuBurst) { this.tpuBurst = tpuBurst; }

    public String getTheme() { return theme; }
    public void setTheme(String theme) { this.theme = theme; }
    public String getDensity() { return density; }
    public void setDensity(String density) { this.density = density; }
    public boolean isReduceMotion() { return reduceMotion; }
    public void setReduceMotion(boolean reduceMotion) { this.reduceMotion = reduceMotion; }
    public boolean isKeyHints() { return keyHints; }
    public void setKeyHints(boolean keyHints) { this.keyHints = keyHints; }

    public boolean isNotifyClash() { return notifyClash; }
    public void setNotifyClash(boolean notifyClash) { this.notifyClash = notifyClash; }
    public boolean isNotifyEmail() { return notifyEmail; }
    public void setNotifyEmail(boolean notifyEmail) { this.notifyEmail = notifyEmail; }
    public boolean isNotifyInApp() { return notifyInApp; }
    public void setNotifyInApp(boolean notifyInApp) { this.notifyInApp = notifyInApp; }
    public boolean isNotifySlack() { return notifySlack; }
    public void setNotifySlack(boolean notifySlack) { this.notifySlack = notifySlack; }
    public int getOverloadAt() { return overloadAt; }
    public void setOverloadAt(int overloadAt) { this.overloadAt = overloadAt; }
    public String getDigest() { return digest; }
    public void setDigest(String digest) { this.digest = digest; }
    public boolean isQuietHours() { return quietHours; }
    public void setQuietHours(boolean quietHours) { this.quietHours = quietHours; }
    public String getQuietFrom() { return quietFrom; }
    public void setQuietFrom(String quietFrom) { this.quietFrom = quietFrom; }
    public String getQuietTo() { return quietTo; }
    public void setQuietTo(String quietTo) { this.quietTo = quietTo; }

    public boolean isTwoFactor() { return twoFactor; }
    public void setTwoFactor(boolean twoFactor) { this.twoFactor = twoFactor; }
    public boolean isSignInAlerts() { return signInAlerts; }
    public void setSignInAlerts(boolean signInAlerts) { this.signInAlerts = signInAlerts; }
    public String getSessionTimeout() { return sessionTimeout; }
    public void setSessionTimeout(String sessionTimeout) { this.sessionTimeout = sessionTimeout; }

    public boolean isAiLearning() { return aiLearning; }
    public void setAiLearning(boolean aiLearning) { this.aiLearning = aiLearning; }
    public String getRetention() { return retention; }
    public void setRetention(String retention) { this.retention = retention; }
}
