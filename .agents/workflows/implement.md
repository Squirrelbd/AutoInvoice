---
name: implement
description: Implement an AutoInvoice task through the continuous Dev-QA loop with Ponytail minimalism and guardrail enforcement
---

# Workflow: AutoInvoice Implementation (`/implement`)

Execute tasks one at a time through the **Continuous Dev-QA Loop**:

## 1. Surgical Implementation
Activate `ponytail` and the relevant specialist skill (`agency-minimal-change-engineer`, `agency-frontend-developer`, `agency-backend-architect`, `agency-document-generator`, or `agency-finance-tracker`):
- Touch only the files and lines required by the current task.
- Sanitize numeric inputs and pass all currency math through `roundBDT()`.
- Escape dynamic HTML interpolations with `escapeHTML()`.
- Escape CSV formula triggers (`=`, `+`, `-`, `@`) with a leading `'`.
- Ensure all form inputs have `<label for="...">` or `aria-label`.

## 2. Knowledge Graph Sync
After modifying any code file, immediately update the Graphify AST graph:
```bash
python -m graphify update .
```

## 3. Automated Dev-QA Verification
Run the automated verification suites before marking the task complete:
```bash
node tests/html_audit.js
node tests/cli_test_runner.js
node tests/sqlite_db.test.js
```

## 4. Handoff / Commit Gate
Only advance to the next task when all test suites pass at 100% and `ponytail-review` confirms zero bloat.
