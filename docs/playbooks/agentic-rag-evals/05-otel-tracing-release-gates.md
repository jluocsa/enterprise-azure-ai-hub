---
title: "05 · OpenTelemetry gen_ai.* Tracing & A1–A12 Readiness Standard"
description: End-to-end OpenTelemetry span correlation across Orchestrator, APIM, Agent Nodes, and MCP Tools—paired with PII-safe DCR redaction and the A1–A12 Agent Readiness Standard.
---

# 05 · OpenTelemetry `gen_ai.*` Tracing & `A1–A12` Readiness Standard

<PlaybookMeta
  track="04 · Sandboxed Agentic Harness, Foundry IQ RAG & 7-Layer Evals"
  verified="2026-11-19 22:12 PST"
  status="Live v2.0"
  printable
/>

<PageBrief
  stage="govern"
  readTime="4 min read"
  problem="Multi-agent workflows invoke 3–8 LLM calls and multiple MCP tools per user turn; without W3C traceparent correlation and metadata-only redaction, teams either fly blind or leak sensitive client text into logs."
  takeaway="Propagate W3C traceparent across Orchestrator → Session Container → APIM → Foundry/MCP, emit metadata-only gen_ai.* attributes by default, and require A1–A12 before launch."
  csaUse="Verify the span attribute contract below in Application Insights and attach A1–A12 to your production readiness review."
/>

## 1. Metadata-Only `gen_ai.*` Span Contract `[M]` `[Arch]`

Keep `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=false` in production so client documents and PII never enter Log Analytics, while capturing every operational attribute needed for debugging, FinOps, and PTU sizing <span class="ev-badge ev-m">[M]</span> <span class="ev-badge ev-arch">[Arch]</span>:

| Span Attribute | Source Tier | Operational Purpose |
| :--- | :--- | :--- |
| `trace_id` / `parent_span_id` | W3C `traceparent` header across all 3 tiers | Reconstructs the full tree of `3–8` sub-agent/tool calls inside a single user turn. |
| `gen_ai.request.model` / `gen_ai.response.model` | Session Container / Foundry SDK <span class="ev-badge ev-m">[M]</span> | Detects silent model-snapshot drift across primary, spillover, and DR deployments. |
| `gen_ai.usage.input_tokens` / `output_tokens` | Foundry response `usage` <span class="ev-badge ev-m">[M]</span> | Feeds two-regime `DeployPeakNormTPM` PTU sizing ([Playbook 01 · Ch 13](/playbooks/prompt-caching/govern/13-otel-kql-gate)). |
| `gen_ai.usage.cached_tokens` | `prompt_tokens_details.cached_tokens` / `input_tokens_details` | Verifies `≥80%` repeat cache hit rate and alerts on prefix-breaking regressions. |
| `agent.node_name` / `agent.skill_id` | Agent Harness wrapper | Pinpoints which specific node or skill regressed latency, cache reuse, or tool failure rate. |
| `mcp.tool_name` / `mcp.citation_count` | MCP Client wrapper | Tracks Foundry IQ retrieval latency and zero-result knowledge gaps without logging query text. |

---

## 2. The 12-Point Enterprise Agentic Readiness Standard (`A1–A12`) `[Agree]`

| Gate ID | Category | Verification Requirement | Target Pass Bar |
| :--- | :--- | :--- | :--- |
| **`A1`** | Runtime Isolation | Orchestrator runs **zero** Agent SDK / shell tools; all session execution runs inside microVM-isolated ACA Dynamic Sessions / Sandboxes <span class="ev-badge ev-m">[M]</span>. | Verified in architecture |
| **`A2`** | Immutable Tags | Orchestrator, Frontend, and Session Pool deploy exclusively via **Git commit SHA tags** (never `:latest`). | Enforced in CI/CD |
| **`A3`** | Upload Containment | Uploads enforce extension allowlists, `50 MB` streaming limits, filename sanitization, and `realpath` workspace containment. | Security test pass |
| **`A4`** | Document Fidelity | Binary PDFs/Office uploads convert via ADLS Gen2 + Azure Content Understanding with explicit error surfacing (`503`) on pipeline failure <span class="ev-badge ev-m">[M]</span>. | E2E upload test pass |
| **`A5`** | Grounded RAG & ACLs | Foundry IQ (`Azure AI Search` MCP) enforces Managed Identity RBAC (`Search Index Data Reader`) and document-level security trimming <span class="ev-badge ev-m">[M]</span>. | Cross-tenant negative test |
| **`A6`** | Prefix Preservation | Retrieved RAG chunks and per-turn timestamps append strictly at **Position 6** (`PCR004` clean). | `pcr_lint.py` exit `0` |
| **`A7`** | Streaming Protocol | SSE pipeline streams unbuffered `AG-UI` events (`RUN_STARTED` → `RUN_FINISHED`/`RUN_ERROR`) with explicit per-turn `asyncio.timeout`. | Timeout recovery test |
| **`A8`** | Skill Trajectory Gate | Modular agent skills pass automated trigger/trajectory checks (`waza` or pytest golden fixtures). | `100%` fixture pass |
| **`A9`** | Deterministic Contract | [`agent_release_gate.py`](/papers/engineering-kits#agent-gate) verifies citation ID resolution, allowed tool allowlist, and Pass-2 cache parity (`≥1,024` cached tokens). | Hard PR merge gate |
| **`A10`** | Calibrated Quality | Foundry Evals (`Groundedness`, `Relevance`, `TaskAdherence`) show `≤2%` delta against baseline snapshot across 50–200 golden cases <span class="ev-badge ev-m">[M]</span>. | Pre-cutover report |
| **`A11`** | Indirect Injection | Multi-turn safety & indirect prompt-injection suite confirms untrusted document content cannot invoke unapproved tools or exfiltrate workspace files <span class="ev-badge ev-m">[M]</span>. | `0` critical findings |
| **`A12`** | Metadata-Only OTel | W3C `traceparent` correlates all tiers in App Insights with `CAPTURE_MESSAGE_CONTENT=false` and DCR PII redaction active <span class="ev-badge ev-m">[M]</span>. | Verified in Log Analytics |
