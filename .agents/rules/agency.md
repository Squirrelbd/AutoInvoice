---
trigger: model_decision
description: Orchestrate specialist agency agents and subagents for planning, implementation, and quality control (QC).
---

# Agency Agents & Subagents Framework

This project is configured with the specialist Agency multi-agent system, custom invokable subagents (`.agents/agents/`), project skills (`.agents/skills/`), workflows (`.agents/workflows/`), and GSD planning (`.planning/`).

## 1. Invokable Project Subagents (`.agents/agents/`)
- **Planning & Architecture**:
  - `autoinvoice-planner`: Translates specs into phased task plans using Graphify and Ponytail YAGNI.
  - `autoinvoice-architect`: Designs UX foundations, document state lifecycles, `localStorage` + SQLite schemas, and A4 `@media print` layouts.
- **Implementation**:
  - `autoinvoice-implementer`: Delivers minimal-diff vanilla JS/HTML/CSS and Node/SQLite implementations with `roundBDT()` and `peekNext*`/`finalize*` guardrails.
  - `autoinvoice-doc-finance`: Manages commercial documents (Quotations, Invoices, Challans, Receipts, Statements, Expenses), BDT Lakh/Crore math, and `V=1` QR payloads.
- **Quality Control (QC) & Verification**:
  - `autoinvoice-qc-auditor`: Adversarial code, security (XSS, CSV injection, path traversal), financial precision, and WCAG/print-layout auditor.
  - `autoinvoice-test-engineer`: Executes and maintains `tests/cli_test_runner.js`, `tests/sqlite_db.test.js`, `tests/html_audit.js`, and `tests/tests.html`.
  - `autoinvoice-reality-checker`: Final production-readiness gatekeeper requiring empirical proof across all 5 verification gates.

## 2. Installed Specialist Skills Roster (`.agents/skills/`)
- **Planning & Orchestration**:
  - `agency-agents-orchestrator`, `agency-senior-project-manager`, `agency-project-shepherd`, `agency-product-manager`, `agency-sprint-prioritizer`, `agency-software-architect`, `agency-workflow-architect`, `graphify`
- **Design & Architecture**:
  - `agency-ux-architect`, `agency-ui-designer`, `agency-backend-architect`, `agency-security-architect`, `agency-database-optimizer`
- **Implementation & Domain**:
  - `agency-frontend-developer`, `agency-senior-developer`, `agency-minimal-change-engineer`, `agency-document-generator`, `agency-finance-tracker`, `agency-financial-analyst`, `agency-bookkeeper-controller`, `agency-payments-billing-engineer`, `agency-technical-writer`, `agency-git-workflow-master`, `agency-devops-automator`, `ponytail`, `ponytail-help`
- **Quality Control (QC), Security & Review**:
  - `agency-code-reviewer`, `agency-test-automation-engineer`, `agency-test-results-analyzer`, `agency-api-tester`, `agency-evidence-collector`, `agency-reality-checker`, `agency-accessibility-auditor`, `agency-ui-finish-gate-reviewer`, `agency-application-security-engineer`, `agency-performance-benchmarker`, `accidental-data-loss-prevention`, `ponytail-audit`, `ponytail-review`, `ponytail-debt`, `ponytail-gain`

## 3. Continuous Dev-QA Loop (`.agents/workflows/`)
1. **Plan (`plan.md`)**: Query Graphify -> Apply Ponytail Simplicity Ladder -> Break down phased tasks.
2. **Implement (`implement.md`)**: Write minimal working diff -> Enforce `roundBDT()` & `peekNext*`/`finalize*` -> Run `python -m graphify update .`.
3. **QC Gate (`qc.md`)**: Run `node tests/html_audit.js`, `node tests/cli_test_runner.js`, and `node tests/sqlite_db.test.js` -> Certify via Reality Checker.
