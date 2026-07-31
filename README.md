# TECPAP Audit Platform

Internal audit management platform for **TECPAP** (packaging manufacturer, Bouskoura, Morocco).
Centralizes audit planning, execution, findings, corrective actions, document/certificate
control, reporting and dashboards — replacing spreadsheets, paper checklists and scattered PDFs.

> **Status — Phase 5 (Audit Management & Digital Checklist Engine).** Auditors and pilots now run
> audits inside the app: reusable templates (sections → questions, 9 question types), audit
> scheduling/execution with autosave + compliance scoring, a review/approve/return workflow,
> findings (4 severities), optional MinIO evidence, PDF + Excel reports, workspace + dashboard
> audit widgets, and timeline events. CAPA & continuous improvement come next. See
> [`docs/SAD-TECPAP-Audit-Platform.md`](docs/SAD-TECPAP-Audit-Platform.md) for the architecture.

---

## Tech stack

| Layer      | Choice                                                                          |
| ---------- | ------------------------------------------------------------------------------- |
| Frontend   | Next.js 15 (App Router) · React 19 · TypeScript · TailwindCSS · shadcn-style UI |
| Backend    | NestJS 10 · TypeScript · Prisma 5                                               |
| Database   | PostgreSQL 16                                                                   |
| Storage    | MinIO (S3-compatible)                                                           |
| Auth       | JWT + refresh-token rotation · DB-driven RBAC · argon2 · rate limiting          |
| Monorepo   | pnpm workspaces + Turborepo                                                     |
| Containers | Docker + Docker Compose                                                         |
| Testing    | Vitest (unit) · Playwright (e2e)                                                |
| Quality    | ESLint 9 (flat) · Prettier · Husky · lint-staged · commitlint                   |

---

## Monorepo structure

```
.
├── apps/
│   ├── web/                 # Next.js frontend
│   └── api/                 # NestJS backend
│       └── prisma/          # schema.prisma + seed.ts
├── packages/
│   ├── tsconfig/            # Shared TypeScript configs
│   ├── eslint/              # Shared ESLint flat-config factory
│   ├── config/              # Constants, permission keys, env validation (zod)
│   ├── types/               # Shared DTOs, enums, API contracts
│   └── ui/                  # Design tokens + shared UI components (shadcn-style)
├── docker/                  # Dockerfiles for web & api
├── docs/                    # Software Architecture Document
├── .github/workflows/       # CI
└── docker-compose.yml
```

---

## Prerequisites

- **Node.js** ≥ 20 (developed on 20/24)
- **pnpm** 9 (`npm i -g pnpm@9.15.4` or `corepack enable`)
- **Docker** + **Docker Compose** (for the containerized stack)

---

## Quick start (Docker — recommended)

Runs the entire stack: web, api, postgres, minio.

```bash
cp .env.example .env          # then review/edit secrets
docker compose up -d --build
```

- Frontend: http://localhost:3000
- API: http://localhost:4000/api/v1 · health: http://localhost:4000/health · docs: http://localhost:4000/docs
- MinIO console: http://localhost:9001
- pgAdmin (dev only): `docker compose --profile dev up -d` → http://localhost:5050

On first boot the API applies the Prisma schema and seeds the 9 departments,
permissions, roles and a default administrator (`admin@tecpap.local` / `ChangeMe123!`).

Stop everything:

```bash
docker compose down            # add -v to wipe postgres/minio volumes
```

---

## Local development (without Docker)

Start the data services only, then run apps with hot reload:

```bash
cp .env.example .env
docker compose up -d postgres minio

pnpm install                   # also builds packages via predev
pnpm db:generate               # generate Prisma client
pnpm db:migrate:dev            # create/apply migrations (creates DB tables)
pnpm db:seed                   # seed departments, roles, permissions, admin

pnpm dev                       # web (3000) + api (4000) in parallel via turbo
```

Or run individually:

```bash
pnpm --filter @tecpap/web dev
pnpm --filter @tecpap/api dev
```

---

## Environment variables

All variables are documented in [`.env.example`](.env.example). Key groups:

| Group           | Variables                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| HTTP ports      | `WEB_PORT`, `API_PORT`                                                                               |
| Frontend        | `NEXT_PUBLIC_API_URL`                                                                                |
| Database        | `POSTGRES_USER/PASSWORD/DB`, `DATABASE_URL`, `DIRECT_URL`                                            |
| JWT / Auth      | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `BCRYPT_SALT_ROUNDS` |
| CORS            | `CORS_ORIGINS`                                                                                       |
| Storage (MinIO) | `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET_*`                           |
| Seed (dev)      | `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`                                                            |

> **Never commit `.env`.** The repo ships `.env.example` as a template.

---

## Common scripts

Run from the repository root:

| Script                                | Description                                             |
| ------------------------------------- | ------------------------------------------------------- |
| `pnpm dev`                            | Start web + api with hot reload (builds packages first) |
| `pnpm build`                          | Build all packages and apps                             |
| `pnpm lint`                           | ESLint across the workspace                             |
| `pnpm typecheck`                      | TypeScript type-checking across the workspace           |
| `pnpm test`                           | Unit tests (Vitest)                                     |
| `pnpm test:e2e`                       | End-to-end tests (Playwright)                           |
| `pnpm db:generate`                    | Generate Prisma client                                  |
| `pnpm db:migrate:dev`                 | Create & apply a dev migration                          |
| `pnpm db:seed`                        | Seed reference data                                     |
| `pnpm db:studio`                      | Prisma Studio                                           |
| `pnpm format`                         | Prettier write                                          |
| `pnpm docker:up` / `pnpm docker:down` | Compose convenience wrappers                            |

---

## Database & Prisma

Schema lives at [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma). The identity &
access core (Phases 1–2):

- **User** — credentials (argon2), role, department, status (`ACTIVE`/`INACTIVE`/`LOCKED`), soft delete
- **Role** — name + slug, `isSystem` (protected), `isGlobal` (bypasses department scope), m:n permissions
- **Permission** — granular `<resource>.<action>` keys grouped by module (DB-driven)
- **Department** — the nine TECPAP departments, manager, status, member count
- **RefreshToken** — rotating refresh tokens with revocation/replacement tracking
- **AuditLog** — immutable, append-only record of administrative actions

The permission catalog and the three system roles (Administrator / Audit Manager / Pilot) are seeded
from [`packages/config/src/permissions.ts`](packages/config/src/permissions.ts) and
[`packages/config/src/roles.ts`](packages/config/src/roles.ts). Migrations live in
`apps/api/prisma/migrations/` and are applied on container start.

---

## Design system

TECPAP brand is codified in [`packages/ui`](packages/ui):

- **Primary** — Deep Brown · **Secondary** — Leaf Green · **Background** — White
- Tokens as TS constants (`tokens.ts`), CSS custom properties (`styles/tokens.css`),
  and a Tailwind preset (`tailwind-preset.js`)
- Base components: Button, Card, Badge, Input, Label, Separator

Add more shadcn components later via `pnpm dlx shadcn@latest add <component>` (config in
`apps/web/components.json`).

---

## Authentication

Working JWT auth (Phase 2):

- `POST /api/v1/auth/login` — email + password (argon2 verification), returns access + refresh tokens and the user
- `POST /api/v1/auth/refresh` — rotate the access token (refresh-token rotation with revocation)
- `POST /api/v1/auth/logout` — revoke the refresh token
- `GET  /api/v1/auth/me` — current user
- `POST /api/v1/auth/change-password` — change the current user's password
- `POST /api/v1/auth/password-reset/request` · `POST /api/v1/auth/password-reset/reset` — password reset flow

Security: argon2id hashing, refresh-token rotation + revocation, brute-force lockout (5 attempts),
session invalidation on password reset / user disable, rate-limited login & reset (`@nestjs/throttler`),
input validation via class-validator, and global structured error envelope. The access token is a bearer
token; refresh tokens are opaque and stored hashed. CSRF is mitigated by using bearer tokens (no cookie
session surface).

Default seeded administrator: **`admin@tecpap.local`** / **`ChangeMe123!`**.

---

## Identity & Administration (RBAC)

**Permission model** — permissions are `<resource>.<action>` keys (e.g. `users.create`,
`roles.assign_permissions`, `departments.read`) stored in the `permissions` table and grouped by
module. Roles aggregate permissions; users get one role. Guards are **generic and DB-driven** — they
never hardcode permission lists or role names:

- `@Permissions('users.create')` + `PermissionsGuard` checks the principal's effective permission set
- `@Roles('administrator')` + `RolesGuard` checks the role slug
- `@DepartmentScope()` + `DepartmentScopeGuard` resolves the request's `DataScope`

Permissions are loaded fresh from the database on every request (in `JwtStrategy`), so role/status
changes take effect immediately.

**Department data-scoping** is enforced at the data layer, not just the UI. The `departmentScopeWhere`
helper is applied to list/find queries: global roles (Administrator, Audit Manager) see everything;
non-global roles (Pilot, custom) are structurally restricted to their own `departmentId`. This is
defence-in-depth — even a missed permission check cannot leak cross-department data.

**Custom roles** can be created at runtime; the three system roles are protected from deletion (and
from deletion when users are still assigned). The permission matrix is editable in the Roles UI.

**Audit log** — every administrative and auth action is recorded immutably (actor, action, target,
entity, IP, user-agent, metadata). The `AuditLogService` exposes only `record` and `list` — there is
no update or delete path anywhere in the application. Browse it at `/admin/audit-log`.

### Administration API (versioned `/api/v1`)

| Resource    | Endpoints                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| Users       | `GET/POST /users`, `GET/PATCH/DELETE /users/:id`, `POST /users/bulk-status`, `POST /users/:id/reset-password` |
| Roles       | `GET/POST /roles`, `GET/PATCH/DELETE /roles/:id`, `PATCH /roles/:id/permissions`                              |
| Permissions | `GET /permissions` (catalog, grouped)                                                                         |
| Departments | `GET/POST /departments`, `GET/PATCH/DELETE /departments/:id`, `GET /departments/stats`                        |
| Audit log   | `GET /audit-logs`                                                                                             |

Full Swagger docs at **`/docs`** (non-production). The frontend Administration section lives under
`/admin/{users,roles,permissions,departments,audit-log}` and is gated by the user's permissions.

---

## Quality Management System (Phase 3)

The QMS reproduces TECPAP's real documentation hierarchy, fully database-driven (no hardcoded folders):

```
Department → Process → Category → Controlled Documents → Versions → Evidence
```

- **Processes** — owned by a department (code, objectives, scope, risks, opportunities, KPIs, status). CRUD with soft delete + audit.
- **Document categories** — DB-driven, 12 seeded defaults (Procedure, Work Instruction, Specification, Form, Record, …); administrators add more.
- **Controlled documents** — title, code, department, process, category, owner/reviewer/approver, keywords, confidentiality, effective/review/expiration dates; a **status lifecycle** (`DRAFT → UNDER_REVIEW → APPROVED → PUBLISHED → OBSOLETE / ARCHIVED`) with granular permissions.
- **Versioning** — every document owns immutable versions; bytes live in **MinIO**, metadata in Postgres; only the latest approved version is active. Supported uploads: `pdf, docx, xlsx, pptx, png, jpg, jpeg, svg`.
- **Relationships** — typed many-to-many between documents: `USES`, `GENERATES`, `REFERENCES`, `REPLACES`, `ATTACHMENT` (e.g. a Procedure *uses* a Form that *generates* a Record).
- **Search** — **PostgreSQL full-text search**: a trigger-maintained `tsvector` over title/code/description/keywords with a GIN index, ranked via `ts_rank` + `ts_headline` snippets.
- **Tree navigation** — a dynamic `GET /documents/tree` builds Department → Process → Category nodes with live counts.
- **RBAC / scoping** — pilots can never read another department's documents; `departmentScopeWhere` is applied to every query.
- **Audit log** — document create/update, version upload/approve, status change, archive/restore, relation add/remove.
- **Dashboard** — `GET /dashboard/stats` aggregates documents/processes, by-status counts, drafts, published, expiring, awaiting-approval and recent activity.
- **Import-ready architecture** — `DocumentParser` interface + `ParserRegistry` + `ImportService` + `ImportJob` runner. No parsers ship yet; the future Google-Drive import just registers parsers (Word/Excel/PowerPoint/PDF/CSV/ZIP, later AI extraction) with **no redesign**.

### Quality Management API (versioned `/api/v1`)

| Resource    | Endpoints                                                                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Processes   | `GET/POST /processes`, `GET/PATCH/DELETE /processes/:id`                                                                                                                  |
| Categories  | `GET/POST /document-categories`, `GET /document-categories/active`, `PATCH/DELETE /document-categories/:id`                                                              |
| Documents   | `GET/POST /documents`, `GET/PATCH/DELETE /documents/:id`, `POST /documents/:id/status`, `POST /documents/:id/restore`, `GET /documents/tree`, `GET /documents/search?q=` |
| Versions    | `GET /documents/:id/versions`, `POST` (multipart) `/documents/:id/versions`, `PATCH /documents/:id/versions/:versionId/approve`, `GET …/download`                        |
| Relations   | `GET/POST /documents/:id/relations`, `DELETE /documents/:id/relations/:relationId`                                                                                       |
| Dashboard   | `GET /dashboard/stats`                                                                                                                                                    |

The frontend lives under `/documents` (tree + list + detail with versions, relationships and timeline),
`/processes`, `/admin/categories`, `/search`, and a real `/dashboard`. Dark mode is supported throughout.

---

## Business Process & Operational Management (Phase 4)

The platform is now **process-centric** — documents and operational entities attach to processes, never
to folders. Every process has a workspace (`GET /processes/:id/workspace`) aggregating:

- Overview, objectives, scope, owner · KPIs · risks · responsibilities · related documents · business objects · activity timeline · statistics

New operational domain:

- **Business objects** — a generic, reusable entity (Production Orders, Suppliers, Machines, Employees, …) with a configurable type catalog (17 seeded), JSON `attributes`, ownership, soft delete, department + process scoping, audit logging and timeline events. Dedicated Customer/Supplier/Equipment modules will specialize this generic core in future phases.
- **KPIs** — configurable (name, formula, target, warning/critical thresholds, frequency, responsible user, dept/process); `PATCH /kpis/:id/value` records a measurement (the hook future ERP/IoT data sources call) and emits a timeline event.
- **Process risks** — title, probability × impact → auto-computed `riskScore`, owner, mitigation, review date, status; department-scoped via the owning process.
- **Responsibilities** — Owner / Approver / Operator / Auditor / Manager per process (`process_assignments`), the assignment source a future workflow engine reuses.
- **Activity timeline** — a process-scoped feed (`GET /processes/:id/timeline`) fed by KPI/risk/object events.
- **Relationship engine** — a generic, polymorphic `business_relationships` table linking **any entity to any entity** (document ↔ risk ↔ audit ↔ finding; supplier → order → inspection → production → customer). No duplicated data.
- **Grouped global search** — `GET /search?q=` returns processes, documents, business objects, KPIs and risks grouped by entity, department-scoped.
- **Process-aware RBAC** — business objects / KPIs / risks are department-scoped at the data layer (pilots see only their department); administrators are global.

### Operational API (versioned `/api/v1`)

| Resource           | Endpoints                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| Business objects   | `GET/POST /business-objects`, `GET/PATCH/DELETE /business-objects/:id`                             |
| Object types       | `GET /business-object-types`, `GET /business-object-types/active`, `PATCH/DELETE /business-object-types/:id` |
| KPIs               | `GET/POST /kpis`, `GET/PATCH/DELETE /kpis/:id`, `PATCH /kpis/:id/value`                            |
| Process risks      | `GET/POST /process-risks`, `GET/PATCH/DELETE /process-risks/:id`                                   |
| Relationships      | `GET/POST /relationships`, `DELETE /relationships/:id`                                             |
| Process workspace  | `GET /processes/:id/workspace`, `GET /processes/:id/timeline`, `GET/POST /processes/:id/assignments`, `DELETE /processes/:id/assignments/:assignmentId` |
| Global search      | `GET /search?q=`                                                                                   |

Frontend: `/processes/:id` (the workspace home page), `/business-objects` (+ detail), `/kpis`, `/risks`,
and a grouped `/search`.

---

## Audit Management (Phase 5)

Digital audit execution replaces paper/Excel checklists:

- **Audit templates** — reusable, versioned, with a Section → Question hierarchy and 9 question types
  (Yes/No, Yes/No/N.A., short/long text, number, date, dropdown, checkbox, multiple choice). Per-question
  settings: required, weight, evidence-required, finding-required. Draft → Publish → Archive lifecycle + clone.
  (`audit-templates` module; import-ready for future Word/Excel/PDF checklist import — parser registry already exists.)
- **Audit execution** — create from a published template, answer questions (autosaved), live progress %,
  compliance scoring (`ok / (ok+fail)`), submit → review → approve / return → complete workflow.
  Department-scoped: pilots execute only their department's audits.
- **Findings** — Observation / Opportunity-for-improvement / Minor NC / Major NC, linked to a question,
  owner, due date, status; linkable to documents/risks via the relationship engine. **A finding never
  auto-creates a CAPA** — the Audit Manager decides (Phase 6 hook prepared).
- **Evidence** — optional photos/PDFs/files attached to a question, finding or the audit; stored in MinIO.
- **Reports** — branded **PDF** (pdfkit) and **Excel** (exceljs) exports with checklist, answers, findings
  and approval info; designed to carry digital signatures later (`reports.export` permission).
- **Integration** — completed audits appear in the Process Workspace; audit widgets on the Dashboard
  (scheduled / in-progress / completed / overdue, open findings, findings-by-severity, compliance &
  completion rates); templates/audits/findings in global search; every action recorded on the Activity Timeline.

### Audit API (versioned `/api/v1`)

| Resource        | Endpoints                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Templates       | `GET/POST /audit-templates`, `GET/PATCH/DELETE /audit-templates/:id`, `POST /audit-templates/:id/{publish,archive,clone}`      |
| Audits          | `GET/POST /audits`, `GET/DELETE /audits/:id`, `POST /audits/:id/{start,submit,approve,return,complete}`, `PATCH /audits/:id/answer` |
| Findings        | `GET/POST /audits/:id/findings`, `PATCH/DELETE /audits/:id/findings/:findingId`                                                  |
| Evidence        | `GET/POST /audits/:id/evidence`, `GET /audits/:id/evidence/:evidenceId/download`                                                 |
| Reports         | `GET /audits/:id/report.pdf`, `GET /audits/:id/report.xlsx`                                                                      |

Frontend: `/audit-templates` (+ detail), `/audits` (+ execution page with findings, evidence, review
actions and report download).

---

## Testing

```bash
pnpm test                                   # unit tests (web + api)
pnpm --filter @tecpap/web test:e2e          # Playwright (starts the dev server)
```

Playwright needs browsers installed once: `pnpm --filter @tecpap/web exec playwright install`.

---

## Project conventions

- **Commits** — [Conventional Commits](https://www.conventionalcommits.org/) (enforced by commitlint)
- **Branching** — GitHub flow: short-lived `feature/*`, `fix/*`, `docs/*` branches → PRs into `main`
- **Pre-commit** — lint-staged runs ESLint + Prettier on staged files
- **TypeScript** — strict mode everywhere; shared DTOs in `@tecpap/types`

> On Linux/macOS, if git reports hook permission errors after install, run
> `chmod +x .husky/pre-commit .husky/commit-msg`.

---

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on push/PR: install → Prisma generate →
lint → typecheck → unit tests → build.

---

## Roadmap

Phase 1 (this) → **P2** Templates & audit execution → **P3** Findings & corrective actions →
**P4** Validation & reporting → **P5** Document & certificate management → **P6** Dashboards &
notifications → **P7** Hardening → **P8** AI (optional). See SAD §13.

---

© TECPAP · Internal Audit Department. Internal use only.
