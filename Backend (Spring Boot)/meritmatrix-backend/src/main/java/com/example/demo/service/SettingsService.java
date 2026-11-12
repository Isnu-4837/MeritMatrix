package com.example.demo.service;

import com.example.demo.repository.SettingsRepository;
import com.example.demo.repository.SettingsRepository.Change;
import com.example.demo.repository.SettingsRepository.SettingsRecord;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.time.Clock;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Business logic behind SettingsPage.jsx.
 *
 * Validates every value the page can send, works out which settings changed on
 * a save, and builds the "current settings" summary cards. The saved settings
 * and the factory defaults live in {@link SettingsRepository}. SettingsController
 * only handles HTTP and delegates here.
 *
 * Requires Spring Boot 3.x and Java 17+.
 */
@Service
public class SettingsService {

    /* ======================================================================
       Types returned to the controller (serialized as-is by Jackson)
       ====================================================================== */

    /** Every setting on the page. Field names match the page's `draft` object. */
    public record Settings(
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
            boolean aiLearning, String retention) {}

    public record Option(String value, String label) {}

    /** Choices for the page's dropdowns and presets, plus the read-only verifier key. */
    public record Options(
            List<Option> engineVersions,
            List<Option> timezones,
            List<Option> landingPages,
            List<Option> sessionTimeouts,
            List<Option> retentionPeriods,
            List<Integer> tpuPresets,
            String verifierKey) {}

    /** One card of the "current settings" overview at the top of the page. */
    public record SummaryItem(String label, String value, String sub) {}

    public record SettingsResponse(Settings settings, List<SummaryItem> summary, Options options) {}

    /** Result of a save: what the page needs to show "N changes saved" and refresh its cards. */
    public record SaveResult(Settings settings, List<String> changedKeys, List<SummaryItem> summary) {}

    public record ExportDocument(Instant exportedAt, Settings settings) {}

    /** One or more values failed validation. Spring turns it into a 400. */
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public static class InvalidSettingsException extends RuntimeException {
        private final Map<String, String> errors;

        public InvalidSettingsException(Map<String, String> errors) {
            super(errors.entrySet().stream()
                    .map(e -> e.getKey() + ": " + e.getValue())
                    .collect(Collectors.joining("; ")));
            this.errors = errors;
        }

        public Map<String, String> getErrors() {
            return errors;
        }
    }

    /* ======================================================================
       Constants (dropdown choices and validation rules)
       ====================================================================== */

    private static final String VERIFIER_KEY = "0x8f2d49c81b94a201f92e6205ba8410294fc6b93b";

    private static final List<Option> ENGINE_VERSIONS = List.of(
            new Option("v3.4.2 Quantum", "v3.4.2 Quantum (Active)"),
            new Option("v3.5.0-rc1 Preview", "v3.5.0-rc1 Preview"),
            new Option("v3.3.8 Stable", "v3.3.8 Stable"));

    private static final List<Option> TIMEZONES = Arrays.stream(new String[]{
                    "UTC", "America/Los_Angeles", "America/New_York", "Europe/London", "Asia/Kolkata", "Asia/Singapore"})
            .map(v -> new Option(v, v.replace('_', ' ')))
            .toList();

    private static final List<Option> LANDING = List.of(
            new Option("dashboard", "Dashboard"), new Option("projects", "Projects"),
            new Option("sprints", "Sprints"), new Option("team", "Team"));

    private static final List<Option> SESSION = List.of(
            new Option("15", "15 minutes"), new Option("60", "1 hour"),
            new Option("240", "4 hours"), new Option("1440", "24 hours"));

    private static final List<Option> RETENTION = List.of(
            new Option("30", "30 days"), new Option("90", "90 days"), new Option("365", "1 year"));

    private static final List<Integer> TPU_PRESETS = List.of(60, 80, 100);

    private static final Set<String> SPRINT_LENGTHS = Set.of("7", "14", "21");
    private static final Set<String> WEEK_STARTS = Set.of("mon", "sun");
    private static final Set<String> THEMES = Set.of("light", "dark", "system");
    private static final Set<String> DENSITIES = Set.of("comfortable", "compact");
    private static final Set<String> DIGESTS = Set.of("daily", "weekly", "off");
    private static final Pattern TIME = Pattern.compile("^([01]\\d|2[0-3]):[0-5]\\d$");

    /* ======================================================================
       Dependencies
       ====================================================================== */

    private final SettingsRepository repo;
    private final Clock clock = Clock.systemUTC();

    public SettingsService(SettingsRepository repo) {
        this.repo = repo;
    }

    /* ======================================================================
       Public API
       ====================================================================== */

    /** Saved settings, the overview cards and the dropdown choices, in one call. */
    public SettingsResponse get() {
        Settings s = snapshot();
        return new SettingsResponse(s, summary(s), options());
    }

    /**
     * "Save changes": replaces all settings. Nothing is stored unless every value is valid.
     * The response lists which keys actually changed.
     */
    public SaveResult save(Settings incoming) {
        validate(incoming);
        Change change = repo.update(current -> toRecord(incoming));
        List<String> changed = changedKeys(toSettings(change.before()), incoming);
        return new SaveResult(incoming, changed, summary(incoming));
    }

    /**
     * "Reset to defaults": restores every setting except the TPU cap, which the page
     * keeps because it is owned by the running engine.
     */
    public SaveResult reset() {
        Change change = repo.update(current -> repo.findDefaults().withTpu(current.tpu()));
        Settings restored = toSettings(change.after());
        List<String> changed = changedKeys(toSettings(change.before()), restored);
        return new SaveResult(restored, changed, summary(restored));
    }

    /** "Download as JSON". Only settings exist in this service; add other data sources here. */
    public ExportDocument export() {
        return new ExportDocument(Instant.now(clock), snapshot());
    }

    /* ======================================================================
       Validation
       ====================================================================== */

    private static void validate(Settings s) {
        Map<String, String> errors = new LinkedHashMap<>();

        range(errors, "capacity", s.capacity(), 20, 60);
        oneOf(errors, "sprintLength", s.sprintLength(), SPRINT_LENGTHS);
        oneOf(errors, "weekStart", s.weekStart(), WEEK_STARTS);
        oneOf(errors, "timezone", s.timezone(), values(TIMEZONES));
        oneOf(errors, "landing", s.landing(), values(LANDING));

        oneOf(errors, "engineVersion", s.engineVersion(), values(ENGINE_VERSIONS));
        range(errors, "tpu", s.tpu(), 50, 100);

        oneOf(errors, "theme", s.theme(), THEMES);
        oneOf(errors, "density", s.density(), DENSITIES);

        range(errors, "overloadAt", s.overloadAt(), 36, 60);
        oneOf(errors, "digest", s.digest(), DIGESTS);
        time(errors, "quietFrom", s.quietFrom());
        time(errors, "quietTo", s.quietTo());

        oneOf(errors, "sessionTimeout", s.sessionTimeout(), values(SESSION));
        oneOf(errors, "retention", s.retention(), values(RETENTION));

        if (!errors.isEmpty()) throw new InvalidSettingsException(errors);
    }

    private static void range(Map<String, String> errors, String key, int value, int min, int max) {
        if (value < min || value > max) errors.put(key, "must be between " + min + " and " + max);
    }

    private static void oneOf(Map<String, String> errors, String key, String value, Set<String> allowed) {
        if (value == null || !allowed.contains(value)) errors.put(key, "must be one of " + new TreeSet<>(allowed));
    }

    private static void time(Map<String, String> errors, String key, String value) {
        if (value == null || !TIME.matcher(value).matches()) errors.put(key, "must be a time such as 22:00");
    }

    private static Set<String> values(List<Option> options) {
        return options.stream().map(Option::value).collect(Collectors.toSet());
    }

    /* ======================================================================
       Mapping (service <-> repository records)
       ====================================================================== */

    private static Settings toSettings(SettingsRecord r) {
        return new Settings(
                r.capacity(), r.sprintLength(), r.weekStart(), r.timezone(), r.landing(),
                r.engineVersion(), r.tpu(), r.tpuBurst(),
                r.theme(), r.density(), r.reduceMotion(), r.keyHints(),
                r.notifyClash(), r.notifyEmail(), r.notifyInApp(), r.notifySlack(),
                r.overloadAt(), r.digest(), r.quietHours(), r.quietFrom(), r.quietTo(),
                r.twoFactor(), r.signInAlerts(), r.sessionTimeout(),
                r.aiLearning(), r.retention());
    }

    private static SettingsRecord toRecord(Settings s) {
        return new SettingsRecord(
                s.capacity(), s.sprintLength(), s.weekStart(), s.timezone(), s.landing(),
                s.engineVersion(), s.tpu(), s.tpuBurst(),
                s.theme(), s.density(), s.reduceMotion(), s.keyHints(),
                s.notifyClash(), s.notifyEmail(), s.notifyInApp(), s.notifySlack(),
                s.overloadAt(), s.digest(), s.quietHours(), s.quietFrom(), s.quietTo(),
                s.twoFactor(), s.signInAlerts(), s.sessionTimeout(),
                s.aiLearning(), s.retention());
    }

    /* ======================================================================
       Derived values
       ====================================================================== */

    private Settings snapshot() {
        return toSettings(repo.findCurrent());
    }

    private static Options options() {
        return new Options(ENGINE_VERSIONS, TIMEZONES, LANDING, SESSION, RETENTION, TPU_PRESETS, VERIFIER_KEY);
    }

    /** Same four cards the page builds from its draft: engine, TPU cap, security and alerts. */
    private static List<SummaryItem> summary(Settings s) {
        String[] parts = s.engineVersion().split(" ", 2);
        String engineName = parts[0];
        String engineEdition = parts.length > 1 ? parts[1] : "";

        int minutes = Integer.parseInt(s.sessionTimeout());
        String idle = minutes >= 60 ? (minutes / 60) + "h" : minutes + " min";

        int channels = (s.notifyInApp() ? 1 : 0) + (s.notifyEmail() ? 1 : 0) + (s.notifySlack() ? 1 : 0);

        return List.of(
                new SummaryItem("Engine", engineName, engineEdition),
                new SummaryItem("TPU cap", s.tpu() + "%", s.tpuBurst() ? "Auto-scale on" : "Auto-scale off"),
                new SummaryItem("Security", s.twoFactor() ? "2FA on" : "2FA off", "Idle sign-out " + idle),
                new SummaryItem("Alerts",
                        s.notifyClash() ? channels + " of 3 channels" : "Alerts off",
                        s.quietHours() ? "Quiet " + s.quietFrom() + "–" + s.quietTo() : "No quiet hours"));
    }

    private static List<String> changedKeys(Settings before, Settings after) {
        Map<String, Object> a = asMap(before);
        Map<String, Object> b = asMap(after);
        return b.keySet().stream().filter(k -> !Objects.equals(a.get(k), b.get(k))).toList();
    }

    private static Map<String, Object> asMap(Settings s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("capacity", s.capacity());
        m.put("sprintLength", s.sprintLength());
        m.put("weekStart", s.weekStart());
        m.put("timezone", s.timezone());
        m.put("landing", s.landing());
        m.put("engineVersion", s.engineVersion());
        m.put("tpu", s.tpu());
        m.put("tpuBurst", s.tpuBurst());
        m.put("theme", s.theme());
        m.put("density", s.density());
        m.put("reduceMotion", s.reduceMotion());
        m.put("keyHints", s.keyHints());
        m.put("notifyClash", s.notifyClash());
        m.put("notifyEmail", s.notifyEmail());
        m.put("notifyInApp", s.notifyInApp());
        m.put("notifySlack", s.notifySlack());
        m.put("overloadAt", s.overloadAt());
        m.put("digest", s.digest());
        m.put("quietHours", s.quietHours());
        m.put("quietFrom", s.quietFrom());
        m.put("quietTo", s.quietTo());
        m.put("twoFactor", s.twoFactor());
        m.put("signInAlerts", s.signInAlerts());
        m.put("sessionTimeout", s.sessionTimeout());
        m.put("aiLearning", s.aiLearning());
        m.put("retention", s.retention());
        return m;
    }
}