package com.example.demo.controller;

import com.example.demo.service.ProjectsService;
import com.example.demo.service.ProjectsService.Project;
import com.example.demo.service.ProjectsService.ProjectsResponse;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * HTTP layer for ProjectsPage.jsx. All logic lives in {@link ProjectsService}.
 *
 * Paths sit under /api/workstreams so they do not clash with the /api/projects
 * endpoints in DashboardController.
 *
 * GET   /api/workstreams                       overview + filtered / searched / sorted / grouped list
 * GET   /api/workstreams/{id}                  one workstream with its subtasks
 * POST  /api/workstreams                       "New workstream"
 * POST  /api/workstreams/tasks/quick           "Quick task"
 * PATCH /api/workstreams/{id}/tasks/{taskId}   tick or untick a subtask
 */
@RestController
@RequestMapping("/api/workstreams")
@Validated
public class ProjectsController {

    public record NewWorkstreamRequest(
            @NotBlank @Size(max = 120) String title,
            @Size(max = 1000) String description,
            String status,
            LocalDate dueDate,
            List<@NotBlank @Size(max = 200) String> tasks) {}

    public record QuickTaskRequest(
            @NotBlank @Size(max = 200) String title,
            @NotBlank String projectId) {}

    public record TaskStateRequest(boolean done) {}

    private final ProjectsService service;

    public ProjectsController(ProjectsService service) {
        this.service = service;
    }

    /**
     * status: All or a label such as "In Progress"
     * sort:   default | progress-desc | progress-asc | urgent | name
     */
    @GetMapping
    public ProjectsResponse list(
            @RequestParam(defaultValue = "All") String status,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "false") boolean urgentOnly,
            @RequestParam(defaultValue = "default") String sort,
            @RequestParam(defaultValue = "false") boolean grouped) {
        return service.query(status, q, urgentOnly, sort, grouped);
    }

    @GetMapping("/{id}")
    public Project get(@PathVariable String id) {
        return service.get(id);
    }

    @PostMapping
    public ResponseEntity<Project> create(@Valid @RequestBody NewWorkstreamRequest req) {
        Project created = service.create(req.title(), req.description(), req.status(), req.dueDate(), req.tasks());
        URI location = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/workstreams/{id}").buildAndExpand(created.id()).toUri();
        return ResponseEntity.created(location).body(created);
    }

    @PostMapping("/tasks/quick")
    public Project quickTask(@Valid @RequestBody QuickTaskRequest req) {
        return service.addTask(req.projectId(), req.title());
    }

    @PatchMapping("/{id}/tasks/{taskId}")
    public Project setTaskDone(@PathVariable String id,
                               @PathVariable String taskId,
                               @RequestBody TaskStateRequest req) {
        return service.setTaskDone(id, taskId, req.done());
    }
}