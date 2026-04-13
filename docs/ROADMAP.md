# Archon AI Dark Factory -- Implementation Roadmap

Generated: 2026-04-13
Source: FR references extracted from GitHub issue bodies (pi-mono PRD). No standalone `docs/PRD.md` exists.

## Legend

- **Effort**: S (1-3 days), M (3-7 days), L (1-2 weeks), XL (2+ weeks)
- **Status**: DELIVERED = already implemented, PARTIAL = some work exists, NEW = not started

## Already Delivered (verify and close)

These issues are fully implemented. **Action**: verify each, then close.

| Issue | Title | Evidence |
|-------|-------|----------|
| #3 | Quality Gate Engine | `packages/workflows/src/gates/`, node_states + test_results tables, gate API endpoints |
| #5 | Hybrid Workflow Storage | workflow_definitions table, PUT/DELETE /api/workflows/:name, DB priority over filesystem |
| #6 | Multi-user Auth (JWT) | users + project_members tables, JWT middleware, `archon login` CLI |
| #7 | Docker/K8s (Phase 1) | docker-compose.yml, Dockerfile, Caddyfile.example -- update issue to reflect only Phase 2 remains |

---

## Batch 1: Core Infrastructure (Foundation)
**Effort:** L | **Unblocks:** Batches 2-7 (everything depends on state management and cost tracking)

These are foundational capabilities that nearly every downstream feature depends on.

### Features
- [ ] FR5: Transactional state machine with optimistic locking -- Issue #18 (open)
- [ ] FR8/FR52: Usage metrics & cost tracking -- Issue #19 (open)
- [ ] FR20/FR21: Audit trail with full decision history -- Issue #25 (open)

### Acceptance Criteria
- [ ] Workflow state transitions are atomic with optimistic locking (no lost updates under concurrent access)
- [ ] Cost is tracked per workflow run and per node; dashboard shows cost breakdown
- [ ] Append-only event log captures all state transitions and decisions
- [ ] All three features have unit + integration tests passing

### Rationale
State machine (#18) is the backbone for reliable workflow execution. Cost tracking (#19) is essential for budget caps in Batch 3. Audit trail (#25) is needed for the human intervention system in Batch 2.

---

## Batch 2: Human-in-the-Loop & Observability
**Effort:** L | **Unblocks:** BMAD workflows (Batch 3), Epic orchestration (Batch 4)

### Features
- [ ] FR7/FR22-FR29: Context injection & human escalation system -- Issue #20 (open)
- [ ] FR18/FR21: SSE event protocol enhancement (15+ typed events) -- Issue #28 (open)

### Acceptance Criteria
- [ ] Agents can pause, request human input, and resume with injected context
- [ ] Escalation triggers are configurable per workflow node
- [ ] SSE events are typed with Zod schemas; Web UI receives and renders all event types
- [ ] Human intervention round-trip works end-to-end (pause -> inject -> resume) via Web UI and CLI

### Rationale
Human escalation (#20) is required before building BMAD workflows that need review gates. SSE enhancement (#28) is required for real-time observability of all downstream features.

---

## Batch 3: BMAD Workflows & Error Management
**Effort:** XL | **Unblocks:** Epic orchestration (Batch 4), post-epic pipeline (Batch 5)

### Features
- [ ] FR4/FR9-FR15: BMAD workflows as Archon DAGs -- Issue #9 (open)
- [ ] FR63: Error classification & budget management -- Issue #23 (open)

### Acceptance Criteria
- [ ] BMAD methodology phases (Business Analysis, Architecture, Dev, Review, QA) are expressible as DAG workflows
- [ ] Story dev -> code review -> QA cycle runs end-to-end with quality gates
- [ ] 3-tier error classification (transient/recoverable/fatal) with automatic retry for transient errors
- [ ] Budget caps enforce cost limits per workflow run; execution stops gracefully when budget exceeded
- [ ] Skills generated from corrections (FR13) are persisted and reusable

### Rationale
BMAD is the core development methodology. Error classification (#23) is needed to handle failures gracefully in multi-step BMAD workflows without losing work.

---

## Batch 4: Epic Orchestration & Merge Resolution
**Effort:** XL | **Unblocks:** Post-epic pipeline (Batch 5), auto team config (Batch 6)

### Features
- [ ] FR2/FR3/FR6/FR23-FR24/FR28/FR58: Epic orchestration (Scrum Master + Team Lead) -- Issue #14 (open)
- [ ] FR64: AI-powered merge resolution (3-tier) -- Issue #15 (open)
- [ ] FR60: Shared memory (cross-agent ephemeral knowledge store) -- Issue #16 (open)

### Acceptance Criteria
- [ ] Epics decompose into stories; stories execute as parallel DAG workflows
- [ ] Scrum Master agent coordinates story ordering and dependency resolution
- [ ] Epic-level pause/resume/cancel works end-to-end
- [ ] 3-tier merge strategy: auto-merge clean, AI-resolve conflicts, escalate to human
- [ ] Shared memory store allows agents working on the same epic to share context
- [ ] Merge conflicts between parallel story branches are resolved automatically when possible

### Rationale
Epic orchestration is the flagship feature -- it enables the "dark factory" concept of unattended multi-story development. Merge resolution (#15) and shared memory (#16) are essential for parallel story execution to work without constant human intervention.

---

## Batch 5: Knowledge & Learning Systems
**Effort:** M | **Unblocks:** Auto team config (Batch 6)

### Features
- [ ] FR33-FR37/FR61: Skills system (auto-generation, management, evolution) -- Issue #13 (open)
- [ ] FR31-FR32/FR37/FR53: Codebase auto-discovery & project context generation -- Issue #11 (open)
- [ ] FR62: Post-epic pipeline (retrospective, skills evolution, memory cleanup) -- Issue #17 (open)

### Acceptance Criteria
- [ ] Skills are auto-generated from successful patterns and corrections
- [ ] Skills are versioned and can be applied to future workflow runs
- [ ] Codebase scanner detects stack (language, framework, DB, infra) and generates project context
- [ ] Post-epic pipeline runs automatically: retrospective summary, skill extraction, memory pruning
- [ ] Project context influences workflow routing and agent configuration

### Rationale
These features make Archon learn from its own work. Skills (#13) feed back into BMAD quality. Auto-discovery (#11) reduces manual project setup. Post-epic (#17) closes the learning loop.

---

## Batch 6: Multi-Provider & Team Configuration
**Effort:** M | **Unblocks:** Container infrastructure (Batch 7)

### Features
- [ ] pi-ai provider (multi-LLM support) -- Issue #4 (open, Archon-native, no FR)
- [ ] Provider failover chain -- Issue #10 (open, depends on #4)
- [ ] FR49/FR57: Account pool manager (credential rotation & scoring) -- Issue #12 (open)
- [ ] FR53: Automatic agent team configuration by stack -- Issue #26 (open)

### Acceptance Criteria
- [ ] At least 3 LLM providers work through a unified interface (Claude, Codex, + one pi-ai provider)
- [ ] Failover chain: if primary provider fails/rate-limits, automatically switches to next
- [ ] Account pool rotates API keys with scoring (prefer keys with remaining quota)
- [ ] Stack detection from Batch 5 auto-configures agent team (which agents, which models)
- [ ] Team config is overridable per workflow

### Rationale
Multi-provider support (#4, #10) reduces single-vendor risk and enables cost optimization. Account pool (#12) is required for sustained parallel execution. Auto team config (#26) depends on codebase discovery from Batch 5.

---

## Batch 7: Container Infrastructure
**Effort:** XL | **Unblocks:** Kanban board (Batch 8)

### Features
- [ ] FR43-FR47: Dynamic container orchestration (spawn/destroy per project) -- Issue #40 (open)
- [ ] FR45: Container sandbox security (proxy pattern for credential injection) -- Issues #22, #39 (open)
- [ ] Dev stack sidecars per project pod (postgres, redis, etc) -- Issue #38 (open, Archon-native)

### Acceptance Criteria
- [ ] API endpoint spawns isolated container per project with correct tooling
- [ ] Containers are destroyed on project completion or timeout
- [ ] Credentials injected via proxy pattern (never exposed in container env)
- [ ] Sidecar services (DB, cache) auto-provisioned based on detected stack
- [ ] K8s deployment option works alongside Docker Compose

### Rationale
Container isolation is the final piece for true "dark factory" operation -- agents need sandboxed environments for safe execution. This is the heaviest infrastructure work and has the most external dependencies (K8s, container runtimes).

---

## Batch 8: Dashboard & Workflow UX
**Effort:** L | **Unblocks:** External integrations (Batch 9)

### Features
- [ ] FR40-FR41: Integrated diff viewer & PR approval from dashboard -- Issue #24 (open)
- [ ] FR50-FR51/FR54/FR56: Workflow template engine enhancements -- Issue #21 (open)
- [ ] Kanban board + pipeline view -- Issue #8 (open, Archon-native)

### Acceptance Criteria
- [ ] Web UI shows diffs inline with approve/reject actions (no need to leave dashboard)
- [ ] Workflow templates are configurable from Web UI with quality gate presets
- [ ] Kanban view shows workflow runs organized by status (queued/running/review/done)
- [ ] Pipeline view shows DAG execution progress in real-time

### Rationale
These are UX features that make the system usable at scale. They depend on most backend features being in place. The kanban board (#8) depends on quality gates (#3, delivered) and workflow runs.

---

## Batch 9: External Integrations (V2+)
**Effort:** L | **Unblocks:** Nothing (terminal batch)

### Features
- [ ] External platform integrations (Linear, Azure DevOps, GitHub Projects) -- Issue #27 (open, Archon-native)

### Acceptance Criteria
- [ ] At least one external project management tool integrated (Linear or GitHub Projects)
- [ ] Bidirectional sync: issues created in external tool appear in Archon, status updates flow back
- [ ] Webhook-based (not polling) for near-real-time sync

### Rationale
V2+ scope. Only worth pursuing after the core dark factory loop (Batches 1-7) is stable. Low priority relative to core functionality.

---

## Dependency Graph

```
Batch 1 (State + Cost + Audit)
  |
  v
Batch 2 (Human-in-the-Loop + SSE)
  |
  v
Batch 3 (BMAD + Error Mgmt)
  |
  v
Batch 4 (Epic Orchestration + Merge + Memory)
  |
  v
Batch 5 (Skills + Discovery + Post-Epic)
  |
  v
Batch 6 (Multi-Provider + Team Config)     Batch 7 (Containers) *
  |                                           |
  v                                           v
Batch 8 (Dashboard + Workflow UX) <-----------+
  |
  v
Batch 9 (External Integrations)

* Batch 7 can start in parallel with Batch 5-6 if container expertise is available
```

---

## Untracked FRs

The following FRs are referenced in the pi-mono PRD numbering but have no GitHub issue and no description available. **Action**: locate the original PRD or explicitly mark these as out-of-scope.

FR1, FR16, FR17, FR19, FR30, FR38, FR39, FR42, FR48, FR55, FR59

---

## Next Steps

1. **Immediately**: Verify and close #3, #5, #6. Update #7 to Phase 2 only.
2. **This week**: Start Batch 1 (#18, #19, #25) -- these are pure backend with no external dependencies.
3. **Locate or recreate PRD**: The 10 untracked FRs need resolution. Either find the pi-mono PRD or explicitly scope them out.
4. **Create milestone labels**: Tag each issue with its batch number for tracking.
