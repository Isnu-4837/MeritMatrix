package com.example.demo.repository;

import org.springframework.stereotype.Repository;

import java.util.function.UnaryOperator;

/**
 * Data-access layer for {@code SettingsService}.
 *
 * Stores the saved settings and the factory defaults. Validation, change
 * detection and the overview cards stay in the service.
 *
 * This implementation keeps the settings in memory so the app runs on its own.
 * To go live, keep the public method signatures and swap the bodies for JPA /
 * JdbcTemplate calls (per workspace for the workspace, engine, notification,
 * security and data groups; per user for the appearance group), or turn this
 * class into an interface and move this code into an InMemorySettingsRepository.
 *
 * Requires Spring Boot 3.x and Java 17+.
 */
@Repository
public class SettingsRepository {

    /* ======================================================================
       Raw data types (kept here so the repository does not depend on the service)
       ====================================================================== */

    /** Every stored setting. Field order matches the service's Settings record. */
    public record SettingsRecord(
            // workspace
            int capacity, String sprintLength, String weekStart, String timezone, String landing,
            // engine
            String engineVersion, int tpu, boolean tpuBurst,
            // appearance
            String theme, String density, boolean reduceMotion, boolean keyHints,
            // notifications
            boolean notifyClash, boolean notifyEmail, boolean notifyInApp, boolean notifySlack,
            int overloadAt, String digest, boolean quietHours, String quietFrom, String quietTo,
            // security
            boolean twoFactor, boolean signInAlerts, String sessionTimeout,
            // data
            boolean aiLearning, String retention) {

        public SettingsRecord withTpu(int newTpu) {
            return new SettingsRecord(capacity, sprintLength, weekStart, timezone, landing,
                    engineVersion, newTpu, tpuBurst,
                    theme, density, reduceMotion, keyHints,
                    notifyClash, notifyEmail, notifyInApp, notifySlack,
                    overloadAt, digest, quietHours, quietFrom, quietTo,
                    twoFactor, signInAlerts, sessionTimeout,
                    aiLearning, retention);
        }
    }

    /** The stored settings before and after an update, captured atomically. */
    public record Change(SettingsRecord before, SettingsRecord after) {}

    /* ======================================================================
       Sample data
       ====================================================================== */

    private static final SettingsRecord DEFAULTS = new SettingsRecord(
            40, "14", "mon", "UTC", "projects",
            "v3.4.2 Quantum", 78, true,
            "system", "comfortable", false, true,
            true, true, true, false,
            40, "daily", false, "22:00", "07:00",
            true, true, "60",
            true, "90");

    /* ======================================================================
       Mutable state
       ====================================================================== */

    private final Object lock = new Object();
    private SettingsRecord current = DEFAULTS;

    /* ======================================================================
       Queries and commands
       ====================================================================== */

    public SettingsRecord findCurrent() {
        synchronized (lock) {
            return current;
        }
    }

    public SettingsRecord findDefaults() {
        return DEFAULTS;
    }

    /**
     * Atomically replaces the stored settings with {@code next.apply(currentValue)}
     * and returns both the old and the new value. {@code next} must be a pure
     * function of its input.
     */
    public Change update(UnaryOperator<SettingsRecord> next) {
        synchronized (lock) {
            SettingsRecord before = current;
            SettingsRecord after = next.apply(before);
            current = after;
            return new Change(before, after);
        }
    }
}