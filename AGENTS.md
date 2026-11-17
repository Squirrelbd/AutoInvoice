# AGENTS.md — AutoInvoice Agent Operating Guide

Welcome to **AutoInvoice**. This project uses an offline-first, zero-dependency architecture tailored for Bangladeshi commercial document management.

This repository is equipped with **Graphify**, **Ponytail**, **GSD Planning (`.planning/`)**, and the **Agency Specialist Agents & Subagents** framework.

---

## 🗺️ 1. Graphify Knowledge Graph

The project has an active Graphify knowledge graph generated at [graphify-out/](file:///e:/AutoInvoice/graphify-out/).

### Usage & Commands
- **Query the Codebase**:
  ```bash
  python -m graphify query "<question>"
  ```
- **Find Relationships**:
  ```bash
  python -m graphify path "Invoice" "Storage"
  ```
- **Inspect Specific Symbols**:
  ```bash
  python -m graphify explain "<symbol>"
  ```
- **Update Graph After Changes**:
  ```bash
  python -m graphify update .
  ```
- **Interactive Visualizer**: Open [graphify-out/graph.html](file:///e:/AutoInvoice/graphify-out/graph.html) in any browser to inspect the interactive node map.

---

## 🪚 2. Ponytail Minimalism Protocol

Ponytail channels an experienced senior developer enforcing the **laziest solution that actually works**:

### The Simplicity Ladder
1. **YAGNI**: Does this task or feature need to exist at all? If speculative, skip it.
2. **Reuse**: Check [js/utils.js](file:///e:/AutoInvoice/js/utils.js), [js/storage.js](file:///e:/AutoInvoice/js/storage.js), [js/constants.js](file:///e:/AutoInvoice/js/constants.js), and [db.js](file:///e:/AutoInvoice/db.js). Re-implementing existing helpers is forbidden.
3. **Native First**: Reach for browser built-ins (`<input type="date">`, standard CSS, `Intl.NumberFormat`) and native Node (`node:sqlite`) before adding code or libraries.
4. **Shortest Working Diff**: Minimal changes solving the root cause win. No unrequested boilerplate or abstractions.

### Ponytail Skills (`.agents/skills/`)
- `ponytail`: Enforces minimalism intensity (`lite` | `full` | `ultra`, default: `full`).
- `ponytail-audit`: Scans the repository for over-engineering and bloat.
- `ponytail-review`: Reviews diffs strictly for complexity reduction.
- `ponytail-debt`: Lists simplification candidates and technical debt.
- `ponytail-gain`: Displays scorecard of eliminated complexity and saved lines.
- `ponytail-help`: Quick reference card of ponytail commands.

---

## 🤖 3. Project Subagents (`.agents/agents/`)

Seven specialized subagents are configured in [.agents/agents/](file:///e:/AutoInvoice/.agents/agents) for **Planning**, **Implementation**, and **Quality Control (QC)**:

| Subagent | Category | Primary Responsibility |
| :--- | :--- | :--- |
| **[`autoinvoice-planner`](file:///e:/AutoInvoice/.agents/agents/autoinvoice-planner.md)** | Planning | Queries Graphify, enforces Ponytail YAGNI, and creates phased task plans. |
| **[`autoinvoice-architect`](file:///e:/AutoInvoice/.agents/agents/autoinvoice-architect.md)** | Planning / Arch | Designs UX, document state transitions, `localStorage` + SQLite schemas, and A4 `@media print` layouts. |
| **[`autoinvoice-implementer`](file:///e:/AutoInvoice/.agents/agents/autoinvoice-implementer.md)** | Implementation | Writes minimal-diff vanilla JS/HTML/CSS and Node/SQLite code enforcing project guardrails. |
| **[`autoinvoice-doc-finance`](file:///e:/AutoInvoice/.agents/agents/autoinvoice-doc-finance.md)** | Implementation | Formats commercial documents, BDT Lakh/Crore math, `V=1` QR payloads, statements, and P&L ledgers. |
| **[`autoinvoice-qc-auditor`](file:///e:/AutoInvoice/.agents/agents/autoinvoice-qc-auditor.md)** | QC / Security | Audits code quality, XSS/CSV/traversal security, `roundBDT` math, and WCAG/print compliance. |
| **[`autoinvoice-test-engineer`](file:///e:/AutoInvoice/.agents/agents/autoinvoice-test-engineer.md)** | QC / Testing | Runs and maintains CLI unit tests, SQLite persistence tests, HTML/a11y audits, and browser suites. |
| **[`autoinvoice-reality-checker`](file:///e:/AutoInvoice/.agents/agents/autoinvoice-reality-checker.md)** | QC Gatekeeper | Final production-readiness gatekeeper; requires empirical pass proof across all 5 verification gates. |

---

## 👥 4. Installed Specialist Skills (`.agents/skills/`)

41 project-scoped skills are installed in [.agents/skills/](file:///e:/AutoInvoice/.agents/skills) across all lifecycle stages (and wired into [.planning/config.json](file:///e:/AutoInvoice/.planning/config.json) for GSD agents):

### 📋 Planning & Architecture
| Skill | Primary Responsibility |
| :--- | :--- |
| **`agency-agents-orchestrator`** | Autonomous pipeline conductor; oversees project execution via continuous Dev-QA loops. |
| **`agency-senior-project-manager`** | Breaks down specifications into strict, phased task lists without scope creep. |
| **`agency-project-shepherd`** | Coordinates cross-phase execution, milestone tracking, and risk mitigation. |
| **`agency-product-manager`** | Defines product requirements, user stories, acceptance criteria, and roadmap priorities. |
| **`agency-sprint-prioritizer`** | Prioritizes backlogs, sequences tasks, and maximizes delivery velocity. |
| **`agency-software-architect`** | System design, module boundaries, and architectural decision-making. |
| **`agency-workflow-architect`** | Multi-step commercial document workflow and state transition architecture. |
| **`agency-ux-architect`** | Defines UX standards, page state transitions, and responsive structure. |
| **`agency-backend-architect`** | Designs data models, `localStorage` + SQLite schemas, and offline persistence reliability. |
| **`agency-security-architect`** | Designs defense-in-depth security controls and data integrity boundaries. |
| **`graphify`** | Queries and updates the AST/semantic codebase knowledge graph in `graphify-out/`. |

### 🛠️ Implementation & Domain Engineering
| Skill | Primary Responsibility |
| :--- | :--- |
| **`agency-frontend-developer`** | Implements DOM manipulation, event handling, and modern HTML/CSS. |
| **`agency-senior-developer`** | Delivers robust, production-grade implementations. |
| **`agency-minimal-change-engineer`** | Specializes in minimal-viable diffs; enforces strict bug-fix boundaries. |
| **`agency-ui-designer`** | Crafts design tokens, typography, dark/light themes, and UI micro-interactions. |
| **`agency-database-optimizer`** | Optimizes SQLite (`db.js`) and `localStorage` (`js/storage.js`) schemas and queries. |
| **`agency-document-generator`** | Formats commercial documents (Quotations, Invoices, Challans, Receipts, Statements). |
| **`agency-finance-tracker`** | Validates financial math, BDT Paisa rounding (`roundBDT`), and receivables aging. |
| **`agency-financial-analyst`** | Analyzes financial KPIs, monthly P&L (`expenses.html`), and cash flow trends. |
| **`agency-bookkeeper-controller`** | Validates accounting ledgers, invoice/receipt reconciliation, and expense tracking. |
| **`agency-payments-billing-engineer`** | Implements payment receipt flows, partial payment math, and due adjustments. |
| **`agency-technical-writer`** | Keeps `DEVELOPER_GUIDE.md`, `README.md`, `CHANGELOG.md`, and `AGENTS.md` verified against code. |
| **`agency-git-workflow-master`** | Enforces clean Git commits and branch hygiene. |
| **`agency-devops-automator`** | Maintains Docker (`Dockerfile`, `docker-compose.yml`) and server deployment scripts. |

### ✅ Quality Control (QC), Testing & Security
| Skill | Primary Responsibility |
| :--- | :--- |
| **`agency-code-reviewer`** | Reviews diffs for correctness, maintainability, security, and regression safety. |
| **`agency-application-security-engineer`** | Audits for XSS, CSV formula injection, path traversal, and input sanitization flaws. |
| **`agency-accessibility-auditor`** | Audits WCAG 2.1 AA accessibility, form label associations, and ARIA compliance. |
| **`agency-ui-finish-gate-reviewer`** | Enforces hard UI finish gate and `@media print` A4 layout fidelity. |
| **`agency-test-automation-engineer`** | Maintains unit and integration test suites (`js/tests/*.test.js`). |
| **`agency-api-tester`** | Validates `server.js` REST endpoints (`/api/records`) and SQLite persistence. |
| **`agency-test-results-analyzer`** | Evaluates test runner outputs, coverage gaps, and failure diagnostics. |
| **`agency-evidence-collector`** | Gathers empirical QA proof before marking tasks complete. |
| **`agency-reality-checker`** | Acts as the final quality gatekeeper; stops premature or unverified approvals. |
| **`agency-performance-benchmarker`** | Measures and optimizes client rendering and storage performance. |
| **`accidental-data-loss-prevention`** | Guards `localStorage`, SQLite DB, and backup/restore against data loss. |

---

## 🔄 5. Project Workflows (`.agents/workflows/`)

- **[plan.md](file:///e:/AutoInvoice/.agents/workflows/plan.md)**: Graphify discovery &rarr; Ponytail Simplicity Gate &rarr; Guardrail check &rarr; Phased task plan.
- **[implement.md](file:///e:/AutoInvoice/.agents/workflows/implement.md)**: Surgical implementation &rarr; `python -m graphify update .` &rarr; Automated test suite verification.
- **[qc.md](file:///e:/AutoInvoice/.agents/workflows/qc.md)**: End-to-end 5-Gate Quality Control pipeline (`html_audit.js`, `cli_test_runner.js`, `sqlite_db.test.js`, Security/Math/Print audit, and Reality Checker certification).
- **[graphify.md](file:///e:/AutoInvoice/.agents/workflows/graphify.md)**: Knowledge graph build and incremental update pipeline.

---

## 🛡️ 6. Core Development Guardrails

1. **Financial Precision**: All calculations must use `roundBDT()` from [js/utils.js](file:///e:/AutoInvoice/js/utils.js). Never leave unrounded floating-point calculations.
2. **Monotonic Sequences**: Document numbering must use the non-gapping `peekNext*` / `finalize*` pattern from [js/storage.js](file:///e:/AutoInvoice/js/storage.js).
3. **Print Layout Preservation**: Never modify styling without verifying `@media print` in [css/print.css](file:///e:/AutoInvoice/css/print.css). QR codes must maintain their `20mm × 20mm` quiet zones.
4. **Validation & Tests**: Always verify changes by running:
   - `node tests/html_audit.js`
   - `node tests/cli_test_runner.js`
   - `node tests/sqlite_db.test.js`
   - `tests/tests.html` (via `node server.js`)
