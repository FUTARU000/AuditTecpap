# Changelog vs the previous factsheet

> Baseline: `docs/internship/factsheet.md` as committed at `531bee1`
> ("docs(internship): add EMSI factsheet with repository-verified facts", 2026-09-10).
> Everything below is re-verified against the current repository. All of the work this
> changelog describes has since been committed (9 new commits, `0e6948d`..`50c30d9`,
> all 2026-09-12) — see section 1 for the exact hashes. Where a fact could not be
> checked, it is marked **NOT VERIFIED** rather than assumed.

---

## 1. Timeline since the factsheet commit

Git history shows 3 small tooling commits right after the factsheet, then 9 feature
commits made in one batch at the end of the engagement covering everything described
in this changelog:

| Commit | Date | What it did |
|---|---|---|
| `cd089c8` "chore: remaining changes" | 2026-09-10 | Miscellaneous cleanup (same day as the factsheet commit) |
| `f75daa2` "chore(security): remove literal secrets from Claude settings allowlist" | 2026-09-10 | Tooling/security hygiene, not app code |
| `5a60d08` "fix(tooling): run lint-staged eslint per workspace" | 2026-09-10 | Tooling only |
| `0e6948d` "feat(indicators): department indicators with 12-month period grid" | 2026-09-12 | Indicators module, full stack |
| `92159f6` "feat(capa): individual action verification and in-app evidence viewer" | 2026-09-12 | CapaActionVerification, per-action Pass/Fail, CAPA evidence preview |
| `4d441d5` "fix(audits): evidence viewer treated the download API response as the file" | 2026-09-12 | Audit evidence viewer two-step-fetch fix |
| `159ab99` "feat: smart search and duplicate-name prevention for Documents, Templates, Audits, CAPA" | 2026-09-12 | Search filter bars + service-layer uniqueness checks (see note below on why these two features share one commit) |
| `9a1b9a2` "feat(db): add normalizedName/normalizedTitle columns for duplicate-name checks" | 2026-09-12 | Migration + schema |
| `f1825bb` "feat(dashboard): rework into sections and add a requires-attention panel" | 2026-09-12 | Dashboard restructuring |
| `079f851` "feat(tasks): auto-hide completed tasks 30 days after completion" | 2026-09-12 | Task auto-cleanup cron |
| `c3f4d78` "feat(login): richer background and a lighter translucent glass panel" | 2026-09-12 | Login visual refresh |
| `50c30d9` "chore: remaining changes" | 2026-09-12 | Collected EN/FR translation strings |

**Why smart-search and duplicate-name prevention share one commit (`159ab99`):** they
touch the same `list()`/`create()`/`update()` methods in Documents, Audit Templates,
and Audits. Splitting them hunk-by-hunk was attempted (and succeeded cleanly for
`schema.prisma`, which the pre-commit hook doesn't touch), but the hook's
`eslint --fix` + git-stash-restore step conflicts when a `.ts` file is only
partially staged and the file is reformatted — the first attempt failed with a merge
conflict during the hook (git safely reverted to the pre-commit state, nothing was
lost). Rather than fight the tool or rewrite already-made commits, the two features
were committed together for the affected files, and the commit message says so
explicitly. `CapaService`'s own duplicate-name check similarly ended up bundled into
`92159f6` (the action-verification commit) for the same reason — noted here since
that commit's message doesn't otherwise mention duplicate names.

All 4 new Prisma migrations are both committed (as files) and applied to the live
database (confirmed via `prisma migrate status` → "Database schema is up to date",
16 migrations found).

---

## 2. ADDED

- **Indicator module** (new, full stack): `Indicator` + `IndicatorValue` Prisma models, `IndicatorFrequency` (MONTHLY/QUARTERLY/SEMIANNUAL/ANNUAL) and `IndicatorDirection` (HIGHER_IS_BETTER/LOWER_IS_BETTER/TARGET_BASED) enums, a 12-month period grid UI, threshold-based evaluation (ON_TARGET/WARNING/CRITICAL/NO_DATA), a new `indicators` API module (23rd module), new `/indicators` and `/indicators/[id]` routes, new sidebar item, new permissions (`indicators.read/create/update/values.create/values.read`) granted to Audit Manager (full) and Pilot (department-scoped, values only).
- **CAPA individual action verification**: new `CapaActionVerification` model (append-only history, mirrors the existing CAPA-level `CapaVerification` pattern), new `POST /capas/:id/actions/:actionId/verify` endpoint, new `CAPA_ACTION_FAILED`/`CAPA_ACTION_VERIFIED` notification types, new per-action Pass/Fail UI on the CAPA detail page. The existing general CAPA verification is unchanged and still required; a CAPA cannot be validated while any action's latest individual verification is FAILED.
- **CAPA evidence in-app viewer**: new `GET /capas/:id/actions/:actionId/evidence` list endpoint, new evidence list/thumbnail/preview UI on the CAPA detail page (previously evidence could only be uploaded, never viewed in-app).
- **Smart search / filters** added to Audit Templates (search+department+category+status) and Audits (search+department+template+auditor+status+scheduled-date range) pages — both server-side, URL-synced. **Documents' own search was also extended this round** (OR-clause now also matches `description`, `category.name`, `department.name` — see the correction note above), not merely "already had it" as this changelog first claimed.
- **Duplicate-name prevention**: new `normalizedName`/`normalizedTitle` indexed columns on `AuditTemplate`, `Audit`, `Capa`, `ControlledDocument`; service-layer, case-insensitive/whitespace-normalized uniqueness check on create/update for all four entities. No database-level unique constraint (see CHANGED/limitations below).
- **Task auto-cleanup**: a new daily `@Cron` job (`TaskService.scheduledCleanup`) that sets `dismissedAt` on `UserTask` rows completed more than 30 days ago, reusing the existing dismiss-forever mechanism rather than deleting rows.
- **Dashboard rework**: new sectioned structure (Overview / Document Control / Audit Programme / CAPA / Indicators / Requires Attention), a new cross-module "Requires attention" panel, a new "Upcoming audits" panel.
- **A real Playwright E2E spec now exists**: `apps/web/e2e/smoke.spec.ts` (2 tests) — the previous factsheet's "zero spec files" claim is no longer true (see CHANGED).
- **Login page visual refresh**: richer/saturated background image treatment, translucent glass login panel with backdrop blur, unrelated to authentication logic.
- **`@nestjs/schedule`-based cron is now used in two places** (was one): the pre-existing daily reminder scan, plus the new task-cleanup job.

## 3. CHANGED

- **Departments**: still exactly 6 defined in `packages/config/src/constants.ts` (unchanged code), but the **live database now has 8** (2 extra departments — `COM`/Commerce and `EQUIP`/Équipements et Infrastructure — created at runtime through the admin UI, not through the seed). The previous factsheet only described the 6 seeded ones; the running system has since diverged from the seed.
- **Dashboard API response shape**: `DashboardStatsDto` was restructured (grouped `overview`/`documents`/`capas`/`indicators`/`requiresAttention`/`upcomingAudits` instead of a flat field bag). This is a breaking DTO change, consumed only by the dashboard page itself.
- **CORRECTION to this changelog's own first draft**: it previously claimed the Documents search OR-clause extension (description/category/department name) predated this round and was already true at the factsheet commit. Re-diffing `documents.service.ts` against `531bee1` directly (rather than trusting the earlier summary) shows the diff is identical to the diff against current `HEAD` — this extension is genuinely **new work in this round**, committed in `159ab99` alongside Templates/Audits search and duplicate-name prevention. Moved to ADDED below; flagging the correction here so it isn't silently dropped.
- **E2E testing claim corrected**: the previous factsheet stated "No E2E test suite exists ... zero spec files" for Playwright. A real spec file now exists (`apps/web/e2e/smoke.spec.ts`), but it asserts text ("Certificates expiring") that does not appear in the current dashboard implementation — **NOT VERIFIED whether it currently passes** (not executed for this changelog, since Playwright's config would spawn a new local dev server, which is outside this task's read-only scope). The API side is unchanged: `apps/api/test/smoke.e2e-spec.ts` is still a placeholder (`expect(true).toBe(true)`), not a real integration test.
- **Resolved (installed) dependency versions drifted within their existing semver ranges** — e.g. Next.js resolves to `15.5.21`, React to `19.2.8`, NestJS core to `10.4.22` (declared `package.json` ranges — `^15.1.3`, `^19.0.0`, `^10.4.15` — are unchanged). Not a project decision, just normal lockfile movement; flagged so the report doesn't understate the actual running versions.
- **Notification catalog grew from 14 to 17 types** (added `CAPA_ACTION_FAILED`, `CAPA_ACTION_VERIFIED`, `INDICATOR_THRESHOLD_EXCEEDED`); delivery mechanism unchanged (see STILL TRUE — email is still a console-log stub, not real SMTP).
- **`docker/Dockerfile.web`**: one comment line (`# syntax=docker/dockerfile:1`) removed. No functional change.

## 4. REMOVED

- **Nothing was removed** in this round: no models, enums, modules, roles, permissions, routes, or documents were deleted. `docs/internship/assets/tecpap_pic.jpeg` and `setting_pic.jpeg` were relocated from the repository root into `docs/internship/assets/` (they were already flagged in the previous factsheet as unreferenced by app code — this is a documentation-folder tidy-up, not a product change).

## 5. NUMBERS — old vs new

Recomputed with the exact same method as the previous factsheet for every row (commands
in parentheses); the old-column values were re-derived from `git show 531bee1` /
`git archive 531bee1`, not copied from the old document's prose, so a couple of rows
correct a small discrepancy in the old text itself (noted below the table).

| Metric | Old (factsheet, `531bee1`) | New (current) |
|---|---|---|
| Prisma models | 45 | **48** (+3: `Indicator`, `IndicatorValue`, `CapaActionVerification`) |
| Prisma enums | 22 | **24** (+2: `IndicatorFrequency`, `IndicatorDirection`) |
| API modules | 22 † | **23** (+1: `indicators`) |
| REST endpoints (`@Get/@Post/@Patch/@Put/@Delete`) | 174 | **185** (+11) |
| Frontend page routes (`page.tsx` count) | 29 | **31** (+2: `/indicators`, `/indicators/[id]`) |
| API tests | 213/213, 35 files | **288/288, 38 files** |
| Web tests | 24/24, 4 files | **36/36, 6 files** |
| API typecheck/lint | clean | clean (unchanged) |
| Web typecheck/lint | clean | clean (unchanged) |
| API build | succeeds | succeeds (unchanged) |
| Web build | succeeds, 25 routes rendered | succeeds, **31 routes rendered** |
| LOC — API source (excl. tests) | 11,231 | **12,085** |
| LOC — API tests | 2,715 | **3,455** |
| LOC — Web source (excl. tests) | 8,494 | **9,660** |
| LOC — Web tests | 397 | **499** |
| LOC — shared packages | 2,710 | **3,180** |
| Total source LOC (excl. tests) | 22,435 | **24,925** |
| Git commits | 4 | **24** |
| Git first/last commit date | 2026-07-23 → 2026-08-01 | 2026-07-23 → **2026-09-12** |
| Git contributors | 1 | 1 (unchanged) |
| Notification types | 14 | **17** |
| Seeded departments | 6 | 6 (unchanged) — **live DB now has 8** (new fact, no prior baseline) |
| Uncommitted files | 155 (vs that day's `HEAD`) | **0** — everything in this changelog's scope is now committed (see section 1) |

† The old factsheet's prose stated "23" API modules; recounting the actual module
folders at that exact commit gives **22**. This changelog uses the recount so the
+1 (`indicators`) lines up exactly with the new total of 23.

## 6. STILL TRUE (re-verified, unchanged)

- Three roles only: Administrator, Audit Manager, Pilot — no new role. `capas.verify` still Manager-only (regression-tested).
- `CapaStatus` (12 values) and `CAPA_TRANSITIONS` — byte-for-byte identical to the previous factsheet.
- Audit lifecycle states/transitions — unchanged.
- Finding→CAPA auto-creation rule and owner-resolution order — unchanged.
- Import pipeline (sources, scan/checksum/parse/classify/dedupe/review/materialize) — the entire `apps/api/src/modules/import` tree is byte-for-byte unchanged since the factsheet commit.
- Authentication design (JWT + rotating single-use refresh token, `localStorage`, mutex-guarded silent refresh, TTLs 900s/604800s) — `apps/api/src/modules/auth`, `apps/web/src/lib/api.ts`, `apps/web/src/lib/auth-context.tsx` all byte-for-byte unchanged.
- `docker-compose.yml` — byte-for-byte unchanged (same 4 services: postgres, api, minio, web, plus the dev-profile-gated `pgadmin`).
- Google Drive integration — manual-trigger-only, read-only service-account scope (`drive.readonly`) — unchanged.
- Email "delivery" is still a console-log stub (`ConsoleEmailProvider`), not real SMTP.
- Design tokens (HSL values, radius, fonts) — unchanged in `packages/ui/src/styles/tokens.css` and `tailwind-preset.js`.
- The stale `kpis.*`/`risks.*` permission keys flagged as a limitation in the old factsheet are still present and still inert.

## 7. Impact on the deliverables

| Change | Architecture diagram | CAPA lifecycle | Import pipeline | Roles | Data model | Metrics | Screenshots |
|---|---|---|---|---|---|---|---|
| Indicators module | Add one box/route | No | No | Add 5 permission keys (no new role) | Add `Indicator`, `IndicatorValue` | Yes (see table) | Add `/indicators`, `/indicators/[id]` |
| CAPA action verification | No | Extends it (new sub-state per action, general lifecycle states unchanged) | No | No new keys (reuses `capas.verify`) | Add `CapaActionVerification` | Yes | Re-shoot `/capas/[id]` to show per-action Pass/Fail |
| CAPA evidence viewer | No | No | No | No | No new model (uses existing `CapaActionEvidence`) | No | Add evidence-preview screenshot on `/capas/[id]` |
| Documents/Templates/Audits search | No | No | No | No | No | No | Re-shoot list pages to show filter bars |
| Duplicate-name prevention | No | No | No | No | 4 new indexed columns | No | No |
| Task auto-cleanup | No | No | No | No | No new model | No | No |
| Dashboard rework | No | No | No | No | No | No | Re-shoot `/dashboard` entirely — new layout |
| Login visual refresh | No | No | No | No | No | No | Re-shoot `/login` |
| Departments now 8 live | No | No | No | No | No new column | No | No, but demo screenshots may show 8 departments, not 6 |

---

## 8. Open points

### Departments: 6 seeded vs 8 live

**Seeded (`packages/config/src/constants.ts`, `DEPARTMENTS`, unchanged):** `PROD`
(Production), `QUAL` (Quality), `PUR` (Purchasing), `HR` (Human Resources), `LOG`
(Logistics), `HYG` (Hygiene).

**Live in the database today (8, via `SELECT code, name FROM departments`):** the same
6 above, plus:
- `COM` — Commerce
- `EQUIP` — Équipements et Infrastructure

**Where the 2 extra ones came from:** manual creation through the admin UI
(`POST /admin/departments` → `DepartmentsService.create()`), not the seed and not a
migration. `Department` is an ordinary CRUD entity with no fixed-list constraint in
the schema or the service layer — anyone with `departments.create` (Administrator or
Audit Manager) can add one at any time, and evidently someone did, while exercising
the live environment.

**Does any code still assume exactly 6?** Yes, one place, verified: the import
classification engine's `DEPARTMENT_INFERENCE` table
(`packages/config/src/import.ts`) hardcodes keyword→department rules for only the 6
seeded codes, and its own doc comment says so explicitly: *"There is no MAINT/FIN/
COM/IT department in this organization; a stale rule referencing an unseeded code
would still bump the classifier's confidence score while silently resolving to no
department, which is worse than not matching at all."* That comment is now stale —
`COM` (Commerce) exists. Practical effect: importing a document for Commerce or
Équipements et Infrastructure will not auto-classify its department from folder
name/keywords; a human reviewer must set the department manually during import
review (the pipeline's existing human-review gate already requires resolving
department + category before materialization, so nothing breaks — it just doesn't
auto-suggest for these 2 departments). No other code path was found assuming a fixed
count of 6 (checked all `DEPARTMENTS` references in `apps/api/src`, `apps/web/src`,
`packages/config/src`).

### Indicators module: what it computes, from what, for whom

**What it computes:** for each `Indicator` definition, the status of its most recent
value against configured thresholds — one of `ON_TARGET` / `WARNING` / `CRITICAL` /
`NO_DATA` — via `evaluateIndicator()` (`apps/api/src/modules/indicators/
indicator-evaluation.util.ts`):
- No value recorded at all → `NO_DATA`, regardless of configuration.
- `HIGHER_IS_BETTER` (e.g. a compliance rate): value ≤ criticalThreshold → `CRITICAL`; ≤ warningThreshold → `WARNING`; else `ON_TARGET`.
- `LOWER_IS_BETTER` (e.g. a defect count): value ≥ criticalThreshold → `CRITICAL`; ≥ warningThreshold → `WARNING`; else `ON_TARGET`.
- `TARGET_BASED` (value should stay close to an exact target): `|value - target|` ≥ criticalThreshold → `CRITICAL`; ≥ warningThreshold → `WARNING`; else `ON_TARGET`. If `target` itself isn't set, always `ON_TARGET` (nothing to fail against).
- A threshold left unset (`null`) simply never triggers that band.

**From which tables:** `Indicator` (the definition: department, direction, target,
warning/critical thresholds, frequency, responsible user) joined with its latest
`IndicatorValue` row (ordered by year desc, periodMonth desc, createdAt desc) for the
value being evaluated. The 12-month grid endpoint (`GET /indicators/:id/grid?year=`)
reads all `IndicatorValue` rows for that indicator+year and maps them onto the 12
calendar months, marking non-applicable months (per the indicator's frequency) as
`applicable: false` rather than fabricating a zero.

**Who can see/edit it:** `indicators.read` (both roles) to view; `indicators.create`/
`indicators.update` (Audit Manager only) to define or change an indicator's
configuration; `indicators.values.create` (Audit Manager or Pilot, Pilot scoped to
their own department via the existing `DataScope` mechanism) to record/correct a
value; `indicators.values.read` (both roles) to view value history. Recording a
second value for the same indicator+year+period is treated as a *correction*
(update-in-place, not a new history row) — deliberately different from CAPA
verification's append-only pattern, because there is no DB-level uniqueness
constraint on the period key (live historical values already existed before this
column pair was added).

**Threshold evaluation trigger:** every time a value is recorded
(`IndicatorsService.recordValue()`), the new value is evaluated immediately; if the
result is `WARNING` or `CRITICAL`, an `INDICATOR_THRESHOLD_EXCEEDED` notification is
sent to the indicator's responsible user plus all global-role users. This is
event-triggered, not cron-based — unlike the legacy `Kpi` model's threshold check,
which still only runs on the daily reminder cron.

### CAPA per-action verification: statuses and who can Pass/Fail

**`CapaActionStatus`** (the action's own lifecycle field, Prisma enum, unchanged
values — verification reuses the existing `VERIFIED` value rather than adding a new
one): `OPEN` → `IN_PROGRESS` → `COMPLETED` → `VERIFIED` (or back to `IN_PROGRESS` on
a failed verification) → `CANCELLED` (terminal, from any state).

**`verificationStatus`** (a derived field on `CapaActionDto`, not stored directly —
computed as the result of the action's *latest* `CapaActionVerification` row, or
`'NOT_VERIFIED'` if none exists yet): `NOT_VERIFIED` | `PASSED` | `FAILED`. Every
verification attempt is kept as its own row (`CapaActionVerification`, 1:N on
`CapaAction`) — a FAILED → reworked → PASSED cycle keeps both attempts visible, never
overwritten.

**How an action's verification relates to the whole CAPA's status:** they are linked
by exactly one guard, not merged into a single state machine. `CapaAction.status`
and `Capa.status` are independent fields with independent transition rules. The link:
`CapaService.verify()` (the *general* CAPA-level verification) refuses to record a
`PASSED` result while any action's `verificationStatus` is `FAILED` — the manager
must resolve every failed action first. Passing/failing an individual action does
**not** by itself change `Capa.status`; only the general `verify()` call does that
(to `VALIDATED` or `RETURNED`).

**Who can Pass/Fail an individual action:** the Audit Manager only, enforced
server-side (`POST /capas/:id/actions/:actionId/verify` requires the `capas.verify`
permission — the same key as the general verification, not a new one; `Role.isGlobal
= false` for Pilot and `capas.verify` is absent from `PILOT_PERMISSIONS`, confirmed
in `packages/config/src/roles.ts` and regression-tested in `capa-verify.rbac.spec.ts`).
A Pilot can see the result and the manager's reason, and can rework a failed action,
but the verify endpoint itself is not reachable for them regardless of what the UI
shows or hides.

### Notifications: the 3 new types

| Type | Trigger |
|---|---|
| `CAPA_ACTION_FAILED` | An Audit Manager fails an individual CAPA action's verification. Sent to the CAPA's owner (falling back to its creator), with the manager's reason. Deduplicated by the verification row's own id. |
| `CAPA_ACTION_VERIFIED` | An Audit Manager passes an individual CAPA action's verification. Same recipient/dedup rule as above. |
| `INDICATOR_THRESHOLD_EXCEEDED` | A recorded indicator value evaluates to `WARNING` or `CRITICAL` (see the Indicators answer above). Sent to the indicator's responsible user plus all global-role users, immediately on recording — not on a cron schedule. |

### Playwright smoke spec: is it stale?

**Yes, plainly stale — verified, not fixed.** `apps/web/e2e/smoke.spec.ts` has 2
tests:
- `'home page renders with brand title'` — checks the page title matches
  `/TECPAP Audit Platform/i`. This would **still pass**: `APP_NAME` in
  `packages/config/src/constants.ts` is exactly `'TECPAP Audit Platform'`, unchanged.
- `'dashboard shell renders placeholders'` — checks for a heading named "Dashboard"
  (would likely still pass, the page title renders via an `<h2>`) **and** for the
  text `'Certificates expiring'`. That text does not exist anywhere in
  `apps/web/src` — grepped the whole frontend source, zero matches, in both the
  current (reworked) dashboard and, as far as can be told from the old factsheet's
  own description, the dashboard that existed before this round's rework either. This
  assertion would **fail**.

Net: 1 of 2 tests would fail today. Not run in this task (would require starting a
local dev server per the Playwright config's `webServer` setting, outside a
read-only/no-side-effects task), but the failure is deterministic from the source
alone — no dashboard state can make `'Certificates expiring'` appear. Left as-is per
instruction; see B11 in the factsheet for the suggested fix (refresh the spec to
match the current dashboard) as a future step, not done here.
