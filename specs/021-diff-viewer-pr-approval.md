# Spec 021 — Integrated Diff Viewer & PR Approval

**Issue:** #24
**Batch:** 8
**Prereqs:** none (UI standalone; uses existing `/api/codebases` + GitHub tokens)
**Estimated effort:** M
**Implementation Risk:** LOW — isolated frontend feature with a thin API wrapper around `gh`/Octokit.

## Goal

Let the user review code diffs and approve/reject PRs from the Archon dashboard without leaving the app.

## Scope

**In:**

- Side-by-side diff view (desktop) + unified view (mobile).
- Approve / Request Changes / Comment actions.
- Batch "Approve all" for a list of PRs.
- Keyboard shortcuts: `A` approve, `R` request changes, `J`/`K` next/prev hunk.
- Deep link from story card → diff tab.
- Inline comments per line (create + display).

**Out:**

- PR creation (use existing GitHub flow).
- Merge action (still go through GitHub; spec 024 may add later).
- Cross-repo batch review.

## Files to Create / Modify

- `packages/server/src/routes/pull-requests.ts` — new route module.
- `packages/server/src/routes/schemas/pr.schemas.ts` — Zod schemas.
- `packages/adapters/src/forge/github/pr-client.ts` — extend with diff + review APIs.
- `packages/web/src/routes/DiffViewerPage.tsx` — new page.
- `packages/web/src/components/diff/DiffView.tsx` — uses `react-diff-viewer-continued` or similar.
- `packages/web/src/components/diff/InlineComments.tsx`.
- `packages/web/src/components/diff/ReviewActions.tsx`.

## New Interfaces / Types

```ts
// Route schemas (Zod)
export const prSummarySchema = z.object({
  id: z.number(),
  repo: z.string(), // "owner/repo"
  number: z.number(),
  title: z.string(),
  state: z.enum(['open', 'closed', 'merged']),
  author: z.string(),
  updatedAt: z.string().datetime(),
});

export const prDiffSchema = z.object({
  files: z.array(
    z.object({
      path: z.string(),
      oldPath: z.string().nullable(),
      status: z.enum(['added', 'modified', 'removed', 'renamed']),
      hunks: z.array(
        z.object({
          header: z.string(),
          lines: z.array(
            z.object({
              type: z.enum(['ctx', 'add', 'del']),
              lineNo: z.number().nullable(),
              content: z.string(),
            })
          ),
        })
      ),
    })
  ),
});

export const reviewActionSchema = z.object({
  action: z.enum(['approve', 'request_changes', 'comment']),
  body: z.string().optional(),
  lineComments: z
    .array(
      z.object({
        path: z.string(),
        line: z.number(),
        body: z.string(),
      })
    )
    .optional(),
});
```

Endpoints:

- `GET /api/pull-requests` — list PRs linked to registered codebases.
- `GET /api/pull-requests/:repo/:number/diff` — returns `prDiffSchema`.
- `POST /api/pull-requests/:repo/:number/review` — body `reviewActionSchema`.

## Database Changes

None. PR state lives on GitHub; cache is in-memory per request.

## Tests Required

- Unit: diff parser (raw `git diff` → `prDiffSchema`).
- Unit: route handlers with mocked Octokit.
- Component tests: `DiffView` renders hunks, `ReviewActions` fires correct API call.
- E2E (optional): keyboard shortcuts navigate hunks.

## Acceptance Criteria

- User can open any PR for a registered codebase and see its diff within 2s (cached token).
- Approve action posts GitHub review and updates UI without reload.
- Keyboard shortcuts work globally on the page (not trapped in text inputs).
- Inline comment creation posts to GitHub and renders immediately.
- Mobile view switches to unified diff below 768px.
