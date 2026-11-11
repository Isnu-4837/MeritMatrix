package com.example.demo.controller;

import com.example.demo.service.AnalyticsService;
import com.example.demo.service.AnalyticsService.AnalyticsResponse;
import com.example.demo.service.AnalyticsService.Squad;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.web.bind.annotation.*;

/**
 * HTTP layer for AnalyticsPage.jsx. All logic lives in {@link AnalyticsService}.
 *
 * GET  /api/analytics             everything the page renders
 * POST /api/analytics/refresh     the "Refresh data" button
 * GET  /api/analytics/squads/{id} one squad (the expanded row)
 * GET  /api/settings/tpu-usage    current TPU cap in percent
 * PUT  /api/settings/tpu-usage    update it (Settings page -> Analytics KPI)
 */
@RestController
@RequestMapping("/api")
public class AnalyticsController {

    public record TpuUsageRequest(
            @Min(value = AnalyticsService.TPU_MIN, message = "TPU cap must be at least 50")
            @Max(value = AnalyticsService.TPU_MAX, message = "TPU cap must be at most 100")
            int percent) {}

    public record TpuUsageResponse(int percent) {}

    private final AnalyticsService service;

    public AnalyticsController(AnalyticsService service) {
        this.service = service;
    }

    @GetMapping("/analytics")
    public AnalyticsResponse analytics() {
        return service.snapshot();
    }

    @PostMapping("/analytics/refresh")
    public AnalyticsResponse refresh() {
        return service.snapshot();
    }

    @GetMapping("/analytics/squads/{id}")
    public Squad squad(@PathVariable String id) {
        return service.squad(id);
    }

    @GetMapping("/settings/tpu-usage")
    public TpuUsageResponse getTpuUsage() {
        return new TpuUsageResponse(service.tpuUsage());
    }

    @PutMapping("/settings/tpu-usage")
    public TpuUsageResponse setTpuUsage(@Valid @RequestBody TpuUsageRequest req) {
        return new TpuUsageResponse(service.updateTpuUsage(req.percent()));
    }
}