package com.example.demo.controller;

import com.example.demo.service.SprintsService;
import com.example.demo.service.SprintsService.BoardResponse;
import com.example.demo.service.SprintsService.CopilotSuggestion;
import com.example.demo.service.SprintsService.Milestone;
import com.example.demo.service.SprintsService.PersonRow;
import com.example.demo.service.SprintsService.RebalanceResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

/**
 * HTTP layer for SprintsPage.jsx. All logic lives in {@link SprintsService}.
 *
 * GET  /api/sprints/board                 whole page: overview, filter counts, people + allocations
 * POST /api/sprints/rebalance             "Quick rebalance", "Auto-fix", "Assign task"
 * POST /api/sprints/allocations           "Allocate member"
 * GET  /api/sprints/milestones/{id}       milestone panel details
 * GET  /api/sprints/copilot/suggestion    text for the Copilot bar
 */
@RestController
@RequestMapping("/api/sprints")
@Validated
public class SprintsController {

    /** startWeek is 0-based (0 = first week on the board). */
    public record AllocateRequest(
            @NotBlank String personId,
            @NotBlank @Size(max = 120) String title,
            @Size(max = 120) String detail,
            @Min(1) @Max(40) int hoursPerWeek,
            @Min(0) @Max(3) int startWeek,
            @Min(1) @Max(4) int weeks,
            String tone) {}

    private final SprintsService service;

    public SprintsController(SprintsService service) {
        this.service = service;
    }

    /**
     * squad:  All squads or a squad name
     * status: all | overbooked | bench | capacity | optimal
     * sort:   default | load | free | name
     */
    @GetMapping("/board")
    public BoardResponse board(
            @RequestParam(defaultValue = "All squads") String squad,
            @RequestParam(defaultValue = "all") String status,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "default") String sort) {
        return service.board(squad, status, q, sort);
    }

    @PostMapping("/rebalance")
    public RebalanceResult rebalance() {
        return service.rebalance();
    }

    @PostMapping("/allocations")
    public ResponseEntity<PersonRow> allocate(@Valid @RequestBody AllocateRequest req) {
        PersonRow updated = service.allocate(req.personId(), req.title(), req.detail(),
                req.hoursPerWeek(), req.startWeek(), req.weeks(), req.tone());
        return ResponseEntity.status(HttpStatus.CREATED).body(updated);
    }

    @GetMapping("/milestones/{id}")
    public Milestone milestone(@PathVariable String id) {
        return service.milestone(id);
    }

    @GetMapping("/copilot/suggestion")
    public CopilotSuggestion suggestion() {
        return service.suggestion();
    }
}