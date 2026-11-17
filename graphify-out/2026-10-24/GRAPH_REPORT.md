# Graph Report - AutoInvoice  (2026-10-24)

## Corpus Check
- 79 files · ~246,559 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 5, .css 3)

## Summary
- 1306 nodes · 2034 edges · 92 communities (60 shown, 32 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 60 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- bootstrap.bundle.min.js
- H
- catalog.js
- storage.js
- xt
- qi
- ao
- invoice.js
- cn
- on
- Es
- 5. Financial Math, BDT Precision & Ledger Integrity
- quotation.js
- AgentsOrchestrator Agent Personality
- challan.js
- qrcode.min.js
- receipt.js
- server.js
- records.js
- test-runner.js
- dashboard.js
- constants.js
- search.js
- theme.js
- ArchitectUX Agent Personality
- DevOps Automator Agent Personality
- Finance Tracker Agent Personality
- Security Architect Agent
- Developer Agent Personality
- Minimal Change Engineer Agent
- Integration Agent Personality
- UI Designer Agent Personality
- What You Must Do When Invoked
- Frontend Developer Agent Personality
- Backend Architect Agent Personality
- 📊 Financial Analyst Agent
- Performance Benchmarker Agent Personality
- Project Shepherd Agent Personality
- QA Agent Personality
- cs
- Test Automation Engineer
- .hide
- Project Manager Agent Personality
- AutoInvoice Developer & Architecture Guide
- Git Workflow Master Agent
- Code Reviewer Agent
- statement.js
- biller.js
- Document Generator Agent
- W
- AGENTS.md — AutoInvoice Agent Operating Guide
- graphify reference: extra exports and benchmark
- Ponytail
- remove
- 🏛️ Comprehensive AutoInvoice Deep System Audit Report
- Ponytail Help
- sn
- 4. Correctness, Security & Vulnerability Audit
- us
- ui
- graphify reference: query, path, explain
- ponytail-audit/SKILL.md
- Ponytail Gain
- ponytail-review/SKILL.md
- Agency Agents Framework
- Ponytail Protocol
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- ponytail-debt/SKILL.md
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- rules/graphify.md
- extraction-spec.md
- workflows/graphify.md
- utils.js
- 🪚 Ranked Elimination Scorecard
- Q
- Breakdown of the 3 Failing Tests
- 9. Prioritized Remediation Roadmap

## God Nodes (most connected - your core abstractions)
1. `cs` - 41 edges
2. `xt` - 30 edges
3. `_readJSON()` - 27 edges
4. `_writeJSON()` - 27 edges
5. `remove()` - 23 edges
6. `W` - 23 edges
7. `qi` - 23 edges
8. `on()` - 22 edges
9. `Ks` - 19 edges
10. `Jn` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Phase 1: Core Functionality & Test Passes (Immediate)` --references--> `buildInvoiceRecord()`  [INFERRED]
  AUDIT_REPORT.md → js/invoice.js
- `🔒 9. Security & Data Integrity` --references--> `sanitizeRecord()`  [INFERRED]
  DEVELOPER_GUIDE.md → js/storage.js
- `❌ Failure 2: Challan Sequence Prefix Discrepancy` --references--> `peekNextChallanNumber()`  [INFERRED]
  AUDIT_REPORT.md → js/storage.js
- `🧮 5. Financial Math & Precision Standards` --references--> `numberToWordsBDT()`  [INFERRED]
  DEVELOPER_GUIDE.md → js/utils.js
- `2.1 Central "God Nodes" (High Betweenness Centrality)` --references--> `xt`  [INFERRED]
  AUDIT_REPORT.md → assets/vendor/bootstrap.bundle.min.js

## Import Cycles
- None detected.

## Communities (92 total, 32 thin omitted)

### Community 0 - "bootstrap.bundle.min.js"
Cohesion: 0.10
Nodes (46): Ae(), be(), Ce(), D(), De(), di(), $e(), Ee() (+38 more)

### Community 2 - "catalog.js"
Cohesion: 0.38
Nodes (4): populateClientDropdown(), populateItemDatalist(), setupClientOnboarding(), setupItemCatalog()

### Community 4 - "storage.js"
Cohesion: 0.10
Nodes (68): 2.1 Central "God Nodes" (High Betweenness Centrality), 6.1 Challan Numbering Prefix Inconsistency, 6.2 Data Overwrite and Sequence Rewind in `importAllData`, 6. Data Models, Storage & State Synchronization, [2.0.0] - 2026-10-08, 🔴 Critical Fixes (Phase 1), 🟠 High Severity & Integrity (Phase 2), 🧪 Test Suite Expansion (Phase 5) (+60 more)

### Community 8 - "invoice.js"
Cohesion: 0.19
Nodes (14): addRow(), addRowFromData(), adjustColumnWidths(), attachRowEvents(), buildQRText(), clearDraft(), getDraftKey(), getGrandTotalNumber() (+6 more)

### Community 10 - "on"
Cohesion: 0.07
Nodes (6): Bt, getElementFromSelector(), getSelectorFromElement(), Ks, d(), on()

### Community 12 - "5. Financial Math, BDT Precision & Ledger Integrity"
Cohesion: 0.40
Nodes (5): 5.1 Floating Point Rounding Vulnerability in `roundBDT()`, 5.2 Unrounded Floating-Point Accumulation in Aging Reports, 5.3 Currency Display for Negative Amounts, 5.4 Dashboard KPI Omission of Direct / Unlinked Receipts, 5. Financial Math, BDT Precision & Ledger Integrity

### Community 13 - "quotation.js"
Cohesion: 0.24
Nodes (13): addRow(), addRowFromData(), attachRowEvents(), buildQRText(), buildRecord(), getGrandTotalNumber(), getShareData(), openWithQtn() (+5 more)

### Community 14 - "AgentsOrchestrator Agent Personality"
Cohesion: 0.05
Nodes (37): 🚀 Advanced Pipeline Capabilities, AgentsOrchestrator Agent Personality, Autonomous Operation, 🤖 Available Specialist Agents, Completion Summary Template, Context-Aware Agent Spawning, 🚨 Critical Rules You Must Follow, 🎨 Design & UX Agents (+29 more)

### Community 15 - "challan.js"
Cohesion: 0.28
Nodes (10): addRow(), addRowFromData(), adjustColumnWidths(), attachRowEvents(), buildChallanRecord(), buildQRText(), clearDraft(), getDraftKey() (+2 more)

### Community 16 - "qrcode.min.js"
Cohesion: 0.21
Nodes (7): a(), b(), d(), i(), n(), r(), s()

### Community 17 - "receipt.js"
Cohesion: 0.28
Nodes (8): applyInvoiceData(), buildInvoiceStyleQRForReceipt(), fetchInvoiceByNumber(), handleLinkedInvoiceChange(), syncClientDisplay(), syncReceiptPrintValues(), updateDue(), updateReceiptSummaryAndQR()

### Community 18 - "server.js"
Cohesion: 0.22
Nodes (8): ref_fs, ref_http, ref_path, fs, http, MIME_TYPES, path, server

### Community 19 - "records.js"
Cohesion: 0.22
Nodes (10): autoDiscoverSummaries(), getDiskChallanByNumber(), getDiskInvoiceByNumber(), loadDiskChallansSummaries(), loadDiskIndex(), loadDiskInvoicesSummaries(), 📁 Directory Structure, Disk Records Storage & Indexing (+2 more)

### Community 20 - "test-runner.js"
Cohesion: 0.36
Nodes (5): backupStorage(), createMemoryStorage(), restoreStorage(), runTests(), TESTS

### Community 21 - "dashboard.js"
Cohesion: 0.52
Nodes (4): executeRestore(), refreshKPIs(), renderClientTable(), renderItemTable()

### Community 22 - "constants.js"
Cohesion: 0.50
Nodes (3): COMPANY, NUMBER_FORMATS, STORAGE_KEYS

### Community 23 - "search.js"
Cohesion: 0.13
Nodes (21): [1.0.0] - 2025-06-25, [2.1.0] - 2026-10-08, [2.2.0] - 2026-10-23, [2.3.0] - 2026-10-23, ♿ Accessibility & UI Consistency, 🚀 Added, 📊 Advanced Reports & Enhanced Downloads, 🔄 Changed (+13 more)

### Community 31 - "ArchitectUX Agent Personality"
Cohesion: 0.07
Nodes (29): 🚀 Advanced Capabilities, ArchitectUX Agent Personality, Bridge PM and Development, Create Developer-Ready Foundations, 🚨 Critical Rules You Must Follow, CSS Architecture Mastery, CSS Design System Foundation, Developer Experience (+21 more)

### Community 32 - "DevOps Automator Agent Personality"
Cohesion: 0.07
Nodes (27): 🚀 Advanced Capabilities, Automate Infrastructure and Deployments, Automation-First Approach, CI/CD Excellence, CI/CD Pipeline Architecture, 🚨 Critical Rules You Must Follow, DevOps Automator Agent Personality, Ensure System Reliability and Scalability (+19 more)

### Community 33 - "Finance Tracker Agent Personality"
Cohesion: 0.07
Nodes (27): 🚀 Advanced Capabilities, Cash Flow Management System, Compliance and Risk Management, Comprehensive Budget Framework, 🚨 Critical Rules You Must Follow, Enable Strategic Financial Decision Making, Ensure Financial Compliance and Control, Finance Tracker Agent Personality (+19 more)

### Community 34 - "Security Architect Agent"
Cohesion: 0.07
Nodes (27): 🚀 Advanced Capabilities, Adversarial Thinking Framework, AI/LLM Application Security, Application Security, CI/CD Security Pipeline, Cloud & Infrastructure Security, 🚨 Critical Rules You Must Follow, Incident Response (+19 more)

### Community 35 - "Developer Agent Personality"
Cohesion: 0.07
Nodes (27): 1. Task Analysis & Planning, 2. Premium Implementation, 3. Quality Assurance, 🚀 Advanced Capabilities, Advanced FluxUI Usage, 🚨 Critical Rules You Must Follow, Developer Agent Personality, FluxUI Component Mastery (+19 more)

### Community 36 - "Minimal Change Engineer Agent"
Cohesion: 0.07
Nodes (26): 🚀 Advanced Capabilities, 🚨 Critical Rules You Must Follow, Deliver the smallest diff that solves the problem, Diff archaeology, Example 1: A bug fix done minimally vs. expanded, Example 2: A new feature done minimally vs. over-architected, Example 3: The "scope check" template (use before every PR), 🔄 Learning & Memory (+18 more)

### Community 37 - "Integration Agent Personality"
Cohesion: 0.07
Nodes (26): Build Expertise In:, Complete System Screenshots Analysis, 🚨 Critical Rules You Must Follow, Default to Skepticism, Evidence Failures, Fantasy Assessment Indicators, Integration Agent Personality, 🔄 Learning & Memory (+18 more)

### Community 38 - "UI Designer Agent Personality"
Cohesion: 0.07
Nodes (26): 🚀 Advanced Capabilities, Component Library Architecture, Craft Pixel-Perfect Interfaces, Create Comprehensive Design Systems, 🚨 Critical Rules You Must Follow, Design System First Approach, Design System Mastery, Developer Collaboration (+18 more)

### Community 39 - "What You Must Do When Invoked"
Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

### Community 40 - "Frontend Developer Agent Personality"
Cohesion: 0.08
Nodes (25): Accessibility and Inclusive Design, Accessibility Leadership, 🚀 Advanced Capabilities, Create Modern Web Applications, 🚨 Critical Rules You Must Follow, Editor Integration Engineering, Frontend Developer Agent Personality, 🔄 Learning & Memory (+17 more)

### Community 41 - "Backend Architect Agent Personality"
Cohesion: 0.08
Nodes (24): 🚀 Advanced Capabilities, API Contract Governance, API Design Specification, Backend Architect Agent Personality, Cloud Infrastructure Expertise, 🚨 Critical Rules You Must Follow, Data Evolution & Migration Safety, Data/Schema Engineering Excellence (+16 more)

### Community 42 - "📊 Financial Analyst Agent"
Cohesion: 0.08
Nodes (24): 🚀 Advanced Capabilities, Advanced Modeling Techniques, Analytical Frameworks, 🚨 Critical Rules You Must Follow, 📊 Financial Analyst Agent, Financial Modeling & Valuation, Forecasting & Planning, 🔄 Learning & Memory (+16 more)

### Community 43 - "Performance Benchmarker Agent Personality"
Cohesion: 0.08
Nodes (24): 🚀 Advanced Capabilities, Advanced Performance Testing Suite Example, Capacity Planning and Scalability Assessment, Comprehensive Performance Testing, 🚨 Critical Rules You Must Follow, Infrastructure Performance, 🔄 Learning & Memory, Performance Benchmarker Agent Personality (+16 more)

### Community 44 - "Project Shepherd Agent Personality"
Cohesion: 0.08
Nodes (24): 🚀 Advanced Capabilities, Align Stakeholders and Manage Communications, Complex Project Orchestration, 🚨 Critical Rules You Must Follow, 🔄 Learning & Memory, Mitigate Risks and Ensure Quality Delivery, Orchestrate Complex Cross-Functional Projects, Organizational Change Leadership (+16 more)

### Community 45 - "QA Agent Personality"
Cohesion: 0.08
Nodes (23): Accordion Testing Protocol, Build Expertise In:, "Default to Finding Issues", Fantasy Reporting Signs, Form Testing Protocol, 🔄 Learning & Memory, Mobile Responsive Testing, "Prove Everything" (+15 more)

### Community 47 - "Test Automation Engineer"
Cohesion: 0.11
Nodes (17): 🚀 Advanced Capabilities, CI: Sharded, Traced, Merge-Blocking (GitHub Actions), 🚨 Critical Rules You Must Follow, Deterministic Playwright Test (No Sleeps, API Setup, Role Selectors), Flake Triage Table, Framework Depth, 🔄 Learning & Memory, Suite Operations at Scale (+9 more)

### Community 49 - "Project Manager Agent Personality"
Cohesion: 0.14
Nodes (13): 1. Specification Analysis, 2. Task List Creation, 3. Technical Stack Requirements, 🚨 Critical Rules You Must Follow, Learning from Experience, 🔄 Learning & Improvement, Project Manager Agent Personality, Realistic Scope Setting (+5 more)

### Community 50 - "AutoInvoice Developer & Architecture Guide"
Cohesion: 0.08
Nodes (23): 🧪 10. Test Suite Architecture, 🏛️ 1. Architecture Overview, 🔄 2. Document Lifecycles & State Transitions, 🔢 3. Monotonic Numbering & Sequence Architecture, 4.1 Commercial Invoice Schema, 4.2 Delivery Challan Schema, 4.3 Quotation Schema, 4.4 Money Receipt Schema (+15 more)

### Community 51 - "Git Workflow Master Agent"
Cohesion: 0.15
Nodes (12): 📋 Branching Strategies, Clean Up Before PR, 💬 Communication Style, 🔧 Critical Rules, Finishing a Branch, Git Flow (for versioned releases), Git Workflow Master Agent, 🎯 Key Workflows (+4 more)

### Community 52 - "Code Reviewer Agent"
Cohesion: 0.18
Nodes (10): 🔴 Blockers (Must Fix), Code Reviewer Agent, 💬 Communication Style, 🔧 Critical Rules, 💭 Nits (Nice to Have), 📋 Review Checklist, 📝 Review Comment Format, 🟡 Suggestions (Should Fix) (+2 more)

### Community 53 - "statement.js"
Cohesion: 0.22
Nodes (20): applyDatePreset(), calculateAging(), escapeAttr(), escapeHTML(), exportStatementCSV(), formatBDT(), formatDisplayDate(), formatPeriodLabel() (+12 more)

### Community 54 - "biller.js"
Cohesion: 0.46
Nodes (12): applyActiveTheme(), escapeAttr(), escapeHTML(), initModalEvents(), injectBillerModal(), openBillerModal(), renderBillerListItems(), renderNavbarSwitcher() (+4 more)

### Community 55 - "Document Generator Agent"
Cohesion: 0.20
Nodes (9): 💬 Communication Style, 🔧 Critical Rules, Document Generator Agent, PDF Generation, Presentations (PPTX), Spreadsheets (XLSX), Word Documents (DOCX), 🎯 Your Core Mission (+1 more)

### Community 57 - "AGENTS.md — AutoInvoice Agent Operating Guide"
Cohesion: 0.22
Nodes (8): 🗺️ 1. Graphify Knowledge Graph, 🪚 2. Ponytail Minimalism Protocol, 👥 3. Agency Specialist Agents, 🛡️ 4. Core Development Guardrails, AGENTS.md — AutoInvoice Agent Operating Guide, Ponytail Commands, The Simplicity Ladder, Usage & Commands

### Community 58 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 59 - "Ponytail"
Cohesion: 0.22
Nodes (8): Boundaries, Intensity, Output, Persistence, Ponytail, Rules, The ladder, When NOT to be lazy

### Community 61 - "🏛️ Comprehensive AutoInvoice Deep System Audit Report"
Cohesion: 0.17
Nodes (11): 1. Executive Summary & Reality Check Certification, 2.2 Architectural Gaps & Low-Cohesion Modules, 2. Graphify Knowledge Graph & Structural Analysis, 7.1 Form Accessibility Violations (WCAG 2.1 AA), 7.2 Search Table Empty State Colspan Glitch, 7.3 Print Geometry Margin Deviation, 7. Frontend, Accessibility (a11y) & Print Preservation, 🏛️ Comprehensive AutoInvoice Deep System Audit Report (+3 more)

### Community 62 - "Ponytail Help"
Cohesion: 0.25
Nodes (7): Configure Default Mode, Deactivate, Levels, More, Ponytail Help, Skills, Update

### Community 64 - "4. Correctness, Security & Vulnerability Audit"
Cohesion: 0.25
Nodes (8): 4. Correctness, Security & Vulnerability Audit, 🔴 [BLOCKER-01] Number Parsing `NaN` Vulnerability in `invoice.js`, 🟠 [HIGH-01] CSV Formula Injection Vulnerability in Receipt Export, 🟠 [HIGH-02] Path Traversal Boundary Guard Flaw in `server.js`, 🟠 [HIGH-03] Global Scope Binding Flaw in `constants.js`, 🟡 [MED-01] Missing Directory Listing Support in `server.js`, buildInvoiceRecord(), getShareData()

### Community 67 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 69 - "ponytail-audit/SKILL.md"
Cohesion: 0.40
Nodes (4): Boundaries, Hunt, Output, Tags

### Community 70 - "Ponytail Gain"
Cohesion: 0.40
Nodes (4): Boundaries, Honesty boundary, Ponytail Gain, Scoreboard

### Community 71 - "ponytail-review/SKILL.md"
Cohesion: 0.40
Nodes (4): Boundaries, Examples, Format, Scoring

### Community 73 - "Agency Agents Framework"
Cohesion: 0.50
Nodes (3): Agency Agents Framework, Continuous Dev-QA Loop, Specialist Agent Roster

### Community 74 - "Ponytail Protocol"
Cohesion: 0.50
Nodes (3): Commands, Ponytail Protocol, The Simplicity Ladder

### Community 75 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 76 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 77 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 78 - "ponytail-debt/SKILL.md"
Cohesion: 0.50
Nodes (3): Boundaries, Output, Scan

### Community 87 - "utils.js"
Cohesion: 0.06
Nodes (36): ❌ Failure 1: Challan QR Payload Schema Mismatch, 🟡 Architecture & Code Quality (Phase 3), buildQRPayload(), escapeHTML(), formatBDT(), formatDisplayDate(), generateSharePayload(), numberToWordsBDT() (+28 more)

### Community 88 - "🪚 Ranked Elimination Scorecard"
Cohesion: 0.67
Nodes (4): 3. Ponytail Minimalism & Bloat Scan, 🪚 Ranked Elimination Scorecard, addWorkingDays(), isWorkingDay()

### Community 90 - "Breakdown of the 3 Failing Tests"
Cohesion: 0.50
Nodes (4): 8. Test Suite Automation & Failing Tests Diagnostics, Breakdown of the 3 Failing Tests, ❌ Failure 2: Challan Sequence Prefix Discrepancy, ❌ Failure 3: Receipt Frame Window Scope Crash

### Community 91 - "9. Prioritized Remediation Roadmap"
Cohesion: 0.40
Nodes (5): 9. Prioritized Remediation Roadmap, Phase 1: Core Functionality & Test Passes (Immediate), Phase 2: Security Hardening & Financial Math Precision, Phase 3: Accessibility & UI Consistency, Phase 4: Ponytail Cleanliness

## Knowledge Gaps
- **491 isolated node(s):** `COMPANY`, `STORAGE_KEYS`, `NUMBER_FORMATS`, `TESTS`, `http` (+486 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 660 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `2.1 Central "God Nodes" (High Betweenness Centrality)` connect `storage.js` to `🏛️ Comprehensive AutoInvoice Deep System Audit Report`, `xt`, `cs`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `cs` connect `cs` to `bootstrap.bundle.min.js`, `us`, `._getConfig`, `storage.js`, `qi`, `W`, `remove`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Why does `xt` connect `xt` to `bootstrap.bundle.min.js`, `storage.js`, `qi`, `ao`, `W`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **What connects `COMPANY`, `STORAGE_KEYS`, `NUMBER_FORMATS` to the rest of the system?**
  _491 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `bootstrap.bundle.min.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09610389610389611 - nodes in this community are weakly interconnected._
- **Should `storage.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10315430520034101 - nodes in this community are weakly interconnected._
- **Should `xt` be split into smaller, more focused modules?**
  _Cohesion score 0.1039136302294197 - nodes in this community are weakly interconnected._