package com.example.demo.controller;

import com.example.demo.service.TeamService;
import com.example.demo.service.TeamService.AuditReport;
import com.example.demo.service.TeamService.MatchResult;
import com.example.demo.service.TeamService.SandboxReport;
import com.example.demo.service.TeamService.SquadState;
import com.example.demo.service.TeamService.TeamResponse;
import com.example.demo.service.TeamService.VerificationResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * HTTP layer for TeamPage.jsx. All logic lives in {@link TeamService}.
 *
 * GET    /api/team                    overview + filter chips (with counts) + sections + squad + Copilot text
 * GET    /api/team/{id}/sandbox       "Inspect sandbox"
 * POST   /api/team/verify             "Verify a credential"
 * POST   /api/team/match              "Find a match now"
 * GET    /api/team/audit-report       "Export audit report" (JSON download)
 * GET    /api/team/squad              current squad
 * PUT    /api/team/squad/{id}         add to squad
 * DELETE /api/team/squad/{id}         remove from squad
 * DELETE /api/team/squad              clear squad
 */
@RestController
@RequestMapping("/api/team")
@Validated
public class TeamController {

    public record VerifyRequest(
            @NotBlank String memberId,
            @NotBlank @Size(max = 120) String badgeTitle) {}

    /** size defaults to 3 (max 5); benchOnly defaults to false. */
    public record MatchRequest(
            @NotEmpty List<@NotBlank @Size(max = 60) String> skills,
            Integer size,
            Boolean benchOnly) {}

    private final TeamService service;

    public TeamController(TeamService service) {
        this.service = service;
    }

    /**
     * filter: all | rust-go | webgl | aws | high-score | bench
     * sort:   default | score-desc | name
     */
    @GetMapping
    public TeamResponse list(
            @RequestParam(defaultValue = "all") String filter,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "default") String sort,
            @RequestParam(defaultValue = "false") boolean grouped) {
        return service.list(filter, q, sort, grouped);
    }

    @GetMapping("/{id}/sandbox")
    public SandboxReport sandbox(@PathVariable String id) {
        return service.sandbox(id);
    }

    @PostMapping("/verify")
    public VerificationResult verify(@Valid @RequestBody VerifyRequest req) {
        return service.verify(req.memberId(), req.badgeTitle());
    }

    @PostMapping("/match")
    public MatchResult match(@Valid @RequestBody MatchRequest req) {
        return service.match(req.skills(), req.size(), req.benchOnly());
    }

    @GetMapping("/audit-report")
    public ResponseEntity<AuditReport> auditReport() {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("team-audit-report.json").build().toString())
                .body(service.auditReport());
    }

    @GetMapping("/squad")
    public SquadState squad() {
        return service.squad();
    }

    @PutMapping("/squad/{id}")
    public SquadState addToSquad(@PathVariable String id) {
        return service.addToSquad(id);
    }

    @DeleteMapping("/squad/{id}")
    public SquadState removeFromSquad(@PathVariable String id) {
        return service.removeFromSquad(id);
    }

    @DeleteMapping("/squad")
    public SquadState clearSquad() {
        return service.clearSquad();
    }
}