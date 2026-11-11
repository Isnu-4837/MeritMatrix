package com.example.demo.controller;

import com.example.demo.service.SettingsService;
import com.example.demo.service.SettingsService.ExportDocument;
import com.example.demo.service.SettingsService.SaveResult;
import com.example.demo.service.SettingsService.Settings;
import com.example.demo.service.SettingsService.SettingsResponse;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * HTTP layer for SettingsPage.jsx. All logic lives in {@link SettingsService}.
 *
 * GET  /api/settings          saved settings + overview cards + dropdown options
 * PUT  /api/settings          "Save changes" (full replacement, validated)
 * POST /api/settings/reset    "Reset to defaults" (keeps the current TPU cap)
 * GET  /api/settings/export   "Download as JSON"
 *
 * Invalid values return 400 with a message listing each bad field.
 */
@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final SettingsService service;

    public SettingsController(SettingsService service) {
        this.service = service;
    }

    @GetMapping
    public SettingsResponse get() {
        return service.get();
    }

    /** Send every field: missing booleans would be read as false and missing numbers as 0. */
    @PutMapping
    public SaveResult save(@RequestBody Settings settings) {
        return service.save(settings);
    }

    @PostMapping("/reset")
    public SaveResult reset() {
        return service.reset();
    }

    @GetMapping("/export")
    public ResponseEntity<ExportDocument> export() {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("workspace-settings.json").build().toString())
                .body(service.export());
    }
}