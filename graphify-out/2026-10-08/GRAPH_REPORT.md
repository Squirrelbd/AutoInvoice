# Graph Report - AutoInvoice  (2026-10-08)

## Corpus Check
- 72 files · ~151,133 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 3, .css 3)

## Summary
- 1188 nodes · 1761 edges · 83 communities (58 shown, 25 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 54 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- bootstrap.bundle.min.js
- remove
- catalog.js
- W
- storage.js
- xt
- qi
- cn
- invoice.js
- ao
- Ks
- Es
- utils.js
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
- Bt
- Project Manager Agent Personality
- AutoInvoice Developer & Architecture Guide
- Git Workflow Master Agent
- Code Reviewer Agent
- Q
- ui
- Document Generator Agent
- AGENTS.md — AutoInvoice Agent Operating Guide
- graphify reference: extra exports and benchmark
- Ponytail
- Ponytail Help
- AutoInvoice (Bangladesh Format)
- Changelog
- 🌟 Key Features
- graphify reference: query, path, explain
- 💾 4. Data Models & JSON Schemas
- ponytail-audit/SKILL.md
- Ponytail Gain
- ponytail-review/SKILL.md
- 🧪 Test Architecture & Isolation
- Agency Agents Framework
- Ponytail Protocol
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- ponytail-debt/SKILL.md
- numberToWordsBDT
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- rules/graphify.md
- extraction-spec.md
- workflows/graphify.md

## God Nodes (most connected - your core abstractions)
1. `cs` - 40 edges
2. `xt` - 29 edges
3. `_readJSON()` - 24 edges
4. `remove()` - 23 edges
5. `W` - 23 edges
6. `qi` - 23 edges
7. `on()` - 22 edges
8. `_writeJSON()` - 21 edges
9. `Ks` - 19 edges
10. `Jn` - 17 edges

## Surprising Connections (you probably didn't know these)
- `🛡️ 4. Core Development Guardrails` --references--> `roundBDT()`  [INFERRED]
  AGENTS.md → js/utils.js
- `🔒 9. Security & Data Integrity` --references--> `sanitizeRecord()`  [INFERRED]
  DEVELOPER_GUIDE.md → js/storage.js
- `🧪 Test Architecture & Isolation` --references--> `sanitizeRecord()`  [INFERRED]
  tests/README.md → js/storage.js
- `2. Dashboard & Financial Intelligence (`index.html`)` --references--> `exportAllData()`  [INFERRED]
  README.md → js/storage.js
- `2. Dashboard & Financial Intelligence (`index.html`)` --references--> `importAllData()`  [INFERRED]
  README.md → js/storage.js

## Import Cycles
- None detected.

## Communities (83 total, 25 thin omitted)

### Community 0 - "bootstrap.bundle.min.js"
Cohesion: 0.10
Nodes (46): Ae(), be(), Ce(), D(), De(), di(), $e(), Ee() (+38 more)

### Community 2 - "catalog.js"
Cohesion: 0.38
Nodes (4): populateClientDropdown(), populateItemDatalist(), setupClientOnboarding(), setupItemCatalog()

### Community 3 - "W"
Cohesion: 0.06
Nodes (6): focusableChildren(), H, Jn, sn, W, Y

### Community 4 - "storage.js"
Cohesion: 0.11
Nodes (51): [2.0.0] - 2026-10-08, 🔴 Critical Fixes (Phase 1), 🟠 High Severity & Integrity (Phase 2), 🧪 Test Suite Expansion (Phase 5), 🟢 UX, Navigation & Accessibility (Phase 4), Lifecycle Workflows, checkStorageQuota(), deleteClient() (+43 more)

### Community 8 - "invoice.js"
Cohesion: 0.17
Nodes (13): addRow(), addRowFromData(), addWorkingDays(), adjustColumnWidths(), attachRowEvents(), buildInvoiceRecord(), buildQRText(), clearDraft() (+5 more)

### Community 12 - "utils.js"
Cohesion: 0.16
Nodes (11): 🟡 Architecture & Code Quality (Phase 3), 🏛️ 1. Architecture Overview, 🧮 5. Financial Math & Precision Standards, 🔒 9. Security & Data Integrity, Key Architectural Tenets, buildQRPayload(), escapeHTML(), formatBDT() (+3 more)

### Community 13 - "quotation.js"
Cohesion: 0.29
Nodes (10): addRow(), addRowFromData(), attachRowEvents(), buildQRText(), buildRecord(), getGrandTotalNumber(), openWithQtn(), updateConversionBadge() (+2 more)

### Community 14 - "AgentsOrchestrator Agent Personality"
Cohesion: 0.05
Nodes (37): 🚀 Advanced Pipeline Capabilities, AgentsOrchestrator Agent Personality, Autonomous Operation, 🤖 Available Specialist Agents, Completion Summary Template, Context-Aware Agent Spawning, 🚨 Critical Rules You Must Follow, 🎨 Design & UX Agents (+29 more)

### Community 15 - "challan.js"
Cohesion: 0.29
Nodes (9): addRow(), addRowFromData(), adjustColumnWidths(), attachRowEvents(), buildChallanRecord(), buildQRText(), clearDraft(), getDraftKey() (+1 more)

### Community 16 - "qrcode.min.js"
Cohesion: 0.21
Nodes (7): a(), b(), d(), i(), n(), r(), s()

### Community 17 - "receipt.js"
Cohesion: 0.31
Nodes (6): applyInvoiceData(), buildInvoiceStyleQRForReceipt(), fetchInvoiceByNumber(), handleLinkedInvoiceChange(), updateDue(), updateReceiptSummaryAndQR()

### Community 18 - "server.js"
Cohesion: 0.22
Nodes (8): ref_fs, ref_http, ref_path, fs, http, MIME_TYPES, path, server

### Community 19 - "records.js"
Cohesion: 0.22
Nodes (10): autoDiscoverSummaries(), getDiskChallanByNumber(), getDiskInvoiceByNumber(), loadDiskChallansSummaries(), loadDiskIndex(), loadDiskInvoicesSummaries(), 📁 Directory Structure, Disk Records Storage & Indexing (+2 more)

### Community 20 - "test-runner.js"
Cohesion: 0.38
Nodes (4): backupStorage(), restoreStorage(), runTests(), TESTS

### Community 21 - "dashboard.js"
Cohesion: 0.54
Nodes (5): executeRestore(), notify(), refreshKPIs(), renderClientTable(), renderItemTable()

### Community 22 - "constants.js"
Cohesion: 0.50
Nodes (3): COMPANY, NUMBER_FORMATS, STORAGE_KEYS

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

### Community 48 - "Bt"
Cohesion: 0.18
Nodes (3): Bt, getElementFromSelector(), getSelectorFromElement()

### Community 49 - "Project Manager Agent Personality"
Cohesion: 0.14
Nodes (13): 1. Specification Analysis, 2. Task List Creation, 3. Technical Stack Requirements, 🚨 Critical Rules You Must Follow, Learning from Experience, 🔄 Learning & Improvement, Project Manager Agent Personality, Realistic Scope Setting (+5 more)

### Community 50 - "AutoInvoice Developer & Architecture Guide"
Cohesion: 0.14
Nodes (13): 🧪 10. Test Suite Architecture, 🔄 2. Document Lifecycles & State Transitions, 🔢 3. Monotonic Numbering & Sequence Architecture, 📱 6. Standardized QR Code Verification Engine, 🌐 7. URL Query Parameter Protocol, 🖨️ 8. Print CSS & Physical Layout Architecture, AutoInvoice Developer & Architecture Guide, Number Formatting (+5 more)

### Community 51 - "Git Workflow Master Agent"
Cohesion: 0.15
Nodes (12): 📋 Branching Strategies, Clean Up Before PR, 💬 Communication Style, 🔧 Critical Rules, Finishing a Branch, Git Flow (for versioned releases), Git Workflow Master Agent, 🎯 Key Workflows (+4 more)

### Community 52 - "Code Reviewer Agent"
Cohesion: 0.18
Nodes (10): 🔴 Blockers (Must Fix), Code Reviewer Agent, 💬 Communication Style, 🔧 Critical Rules, 💭 Nits (Nice to Have), 📋 Review Checklist, 📝 Review Comment Format, 🟡 Suggestions (Should Fix) (+2 more)

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

### Community 62 - "Ponytail Help"
Cohesion: 0.25
Nodes (7): Configure Default Mode, Deactivate, Levels, More, Ponytail Help, Skills, Update

### Community 63 - "AutoInvoice (Bangladesh Format)"
Cohesion: 0.25
Nodes (7): AutoInvoice (Bangladesh Format), 🏢 Company & Brand Customization, 🚀 How to Run, 📄 License, Method 1: Direct Browser Launch (100% Offline), Method 2: Local Node.js Static Server, 📁 Project Structure

### Community 65 - "Changelog"
Cohesion: 0.29
Nodes (6): [1.0.0] - 2025-06-25, [2.1.0] - 2026-10-08, 🚀 Added, 🔄 Changed, Changelog, Initial Release

### Community 66 - "🌟 Key Features"
Cohesion: 0.29
Nodes (7): 1. Document Generation Suite, 2. Dashboard & Financial Intelligence (`index.html`), 3. Financial Precision & Numbering Integrity, 4. Standardized QR Code Verification, 5. Modern UI, UX & Accessibility, 6. Precision Print & PDF Output (`css/print.css`), 🌟 Key Features

### Community 67 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 68 - "💾 4. Data Models & JSON Schemas"
Cohesion: 0.33
Nodes (6): 4.1 Commercial Invoice Schema, 4.2 Delivery Challan Schema, 4.3 Quotation Schema, 4.4 Money Receipt Schema, 4.5 Full Backup Archive Schema, 💾 4. Data Models & JSON Schemas

### Community 69 - "ponytail-audit/SKILL.md"
Cohesion: 0.40
Nodes (4): Boundaries, Hunt, Output, Tags

### Community 70 - "Ponytail Gain"
Cohesion: 0.40
Nodes (4): Boundaries, Honesty boundary, Ponytail Gain, Scoreboard

### Community 71 - "ponytail-review/SKILL.md"
Cohesion: 0.40
Nodes (4): Boundaries, Examples, Format, Scoring

### Community 72 - "🧪 Test Architecture & Isolation"
Cohesion: 0.40
Nodes (4): AutoInvoice Test Suite, 🚀 How to Run Tests, In Any Browser, 🧪 Test Architecture & Isolation

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

### Community 79 - "numberToWordsBDT"
Cohesion: 1.00
Nodes (4): numberToWordsBDT(), integerToWords(), threeDigits(), twoDigits()

## Knowledge Gaps
- **464 isolated node(s):** `COMPANY`, `STORAGE_KEYS`, `NUMBER_FORMATS`, `TESTS`, `http` (+459 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 630 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cs` connect `cs` to `bootstrap.bundle.min.js`, `remove`, `W`, `qi`, `Bt`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `Ks` connect `Ks` to `bootstrap.bundle.min.js`, `remove`, `W`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `W` connect `W` to `bootstrap.bundle.min.js`, `remove`, `xt`, `qi`, `cn`, `ao`, `Ks`, `Es`, `cs`, `Bt`, `Q`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `COMPANY`, `STORAGE_KEYS`, `NUMBER_FORMATS` to the rest of the system?**
  _464 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `bootstrap.bundle.min.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09610389610389611 - nodes in this community are weakly interconnected._
- **Should `W` be split into smaller, more focused modules?**
  _Cohesion score 0.05568627450980392 - nodes in this community are weakly interconnected._
- **Should `storage.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11463046757164404 - nodes in this community are weakly interconnected._