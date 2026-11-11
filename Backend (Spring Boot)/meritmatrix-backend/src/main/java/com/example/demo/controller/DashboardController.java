package com.example.demo.controller;

import com.example.demo.service.DashboardService;
import com.example.demo.service.DashboardService.DashboardResponse;
import com.example.demo.service.DashboardService.Project;
import com.example.demo.service.DashboardService.SprintPlan;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;

/**
 * HTTP layer for DashboardPage.jsx. All logic lives in {@link DashboardService}.
 *
 * GET  /api/dashboard               everything the page renders in one call
 * GET  /api/projects                filtered / searched / sorted project list
 * GET  /api/projects/{id}           one project
 * POST /api/projects                "New project"
 * POST /api/tasks/quick             "Quick Task"
 * POST /api/sprints/generate        "Generate sprint plan"
 */
@RestController
@RequestMapping("/api")
@Validated
public class DashboardController {

    public record NewProjectRequest(
            @NotBlank @Size(max = 120) String title,
            @Size(max = 1000) String description,
            LocalDate dueDate) {}

    public record QuickTaskRequest(
            @NotBlank @Size(max = 200) String title,
            @NotBlank String projectId) {}

    public record GenerateSprintRequest(@Size(max = 300) String goal) {}

    private final DashboardService service;

    public DashboardController(DashboardService service) {
        this.service = service;
    }

    @GetMapping("/dashboard")
    public DashboardResponse dashboard(@RequestParam(defaultValue = "Elena") String userName) {
        return service.dashboard(userName);
    }

    /** filter: all | in_progress | review    sort: default | progress | name */
    @GetMapping("/projects")
    public List<Project> listProjects(
            @RequestParam(defaultValue = "all") String filter,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "default") String sort) {
        return service.listProjects(filter, q, sort);
    }

    @GetMapping("/projects/{id}")
    public Project getProject(@PathVariable String id) {
        return service.getProject(id);
    }

    @PostMapping("/projects")
    public ResponseEntity<Project> createProject(@Valid @RequestBody NewProjectRequest req) {
        Project created = service.createProject(req.title(), req.description(), req.dueDate());
        URI location = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/projects/{id}").buildAndExpand(created.id()).toUri();
        return ResponseEntity.created(location).body(created);
    }

    /** The title is validated here but not stored yet: tasks are only counted per project. */
    @PostMapping("/tasks/quick")
    public Project quickTask(@Valid @RequestBody QuickTaskRequest req) {
        return service.addQuickTask(req.projectId());
    }

    @PostMapping("/sprints/generate")
    public SprintPlan generateSprint(@Valid @RequestBody(required = false) GenerateSprintRequest req) {
        return service.generateSprintPlan(req == null ? null : req.goal());
    }
}