---
title: "Full-Stack Enterprise Microsoft Foundry Platform Blueprint (v2.0)"
description: Consolidated executive white paper uniting Prompt Caching & PTU Economics, Multi-Backend APIM AI Gateway, Multi-Region BCP, and 3-Tier ACA Sandboxed Agentic RAG + 7-Layer Release Governance.
---

# Full-Stack Enterprise Microsoft Foundry Platform Blueprint (`v2.0`)

<PlaybookMeta
  track="Executive Blueprint · Playbooks 01–05 Synthesis"
  provenance="Customer-Zero Validated Across Regulated Enterprise Platforms"
  governance="Sanitized · Peer Reviewed · IP Screened"
  owners="John Luo (@jluocsa) · Co-Authors Welcome"
  verified="2026-11-23 19:30 PST"
  status="Live v2.0"
  studioHref="/studio/"
  studioLabel="Open Decision Studio →"
  printable
/>

<PageBrief
  stepLabel="EXECUTIVE REFERENCE PAPER · PRINT EDITION"
  readTime="8 min read"
  problem="Enterprise CTOs, CISOs, and Architecture Review Boards need one cohesive blueprint showing how capacity economics, gateway resiliency, data residency, and agent safety fit together."
  takeaway="Industrialize Microsoft Foundry across four governed seams: Pos 1–6 Prefix & Two-Regime PTU Math, SKU-Aware APIM Spillover, Residency-Symmetric DR Stamps, and MicroVM-Sandboxed Agentic Evals."
  csaUse="Click 'Print / Save as PDF' above to generate a clean executive briefing packet for customer or internal architecture sign-off."
/>

## 1. Executive Summary

Enterprise generative AI programs rarely fail during initial proof-of-concept demos. Failures cluster at **production cutover and model-upgrade waves** (`gpt-4.x` / `o3-mini` &rarr; `gpt-5.6`, `gpt-6`, `gpt-6.1`), where four cross-service pressures converge simultaneously:

1. **Capacity & Latency Spikes ([Playbook 01](/playbooks/prompt-caching/start/01-executive-thesis)):** Stateless web/container agents (`Model 2`) re-send `4,000–25,000+` system, rubric, tool, and case-context tokens on every turn. Injecting a timestamp, user ID, or unsorted tool schema near Position 1 zeroes out Azure KV prefix reuse—driving a **`2.56×` spike in required Provisioned Throughput (`170 → 435 PTUs`)** and unamortized cache-write charges <span class="ev-badge ev-m">[M]</span> <span class="ev-badge ev-arch">[Arch]</span>.
2. **Burst Throttling & Billing Coupling ([Playbook 02](/playbooks/apim-gateway/01-executive-thesis)):** Reserving year-round PTU-M for `4×` seasonal filing/close cliffs wastes `71%` of annual capacity spend, while naive gateway buffering stalls Server-Sent Events (`SSE`) and inline chargeback IDs fracture shared cache keys.
3. **Sovereignty & Cold-Cache DR Surges ([Playbook 03](/playbooks/multi-region-bcp/01-executive-thesis)):** Regional failovers fail when spillover pools cross Data Zone boundaries, when secondary stamps choke on the **`1.8×–2.56×` cold-cache warm-up surge** during the first 15 minutes of cutover, or when Cosmos DB and Azure AI Search lag behind.
4. **Runtime Blast Radius & Flaky Evals ([Playbook 04](/playbooks/agentic-rag-evals/01-executive-thesis)):** Executing agent tools inside shared orchestrators creates tenant-bleed risk, while relying solely on statistical LLM-as-judge scores as PR blockers causes flaky CI pipelines.

---

## 2. Five-Layer Reference Architecture Matrix

| Production Layer | Core Architectural Mechanism | Primary Quantitative SLO / Outcome | Governing Standard |
| :--- | :--- | :--- | :--- |
| **Layer 01 · Context & PTU Economics** | Strict `Pos 1–6` (`T0 → L2 → L1 → Volatile Tail`) prefix order, deterministic `prompt_cache_key` sharding (`N = ⌈RPM ÷ 12⌉`), Posture A/B ethical walls, and two-regime PTU math (`5.6` vs. `6`/`6.1`). | `≥80%` repeat cache hit rate · `≥10:1` R/W ratio · **`2.56×` PTU spike prevented** | `C1–C15` + `C-WP1–C-WP4` |
| **Layer 02 · APIM AI Gateway & FinOps** | Managed Identity RBAC (`disableLocalAuth: true`), Priority-1 PTU-M + Priority-2 Standard PAYG pool with `Retry-After` circuit breaker, 5.6 breakpoint strip, `buffer-response="false"` SSE, and out-of-band `x-cost-center` OTel metrics. | **`71%` seasonal TCO saved** · `<35ms` SSE TTFT delta · `100%` keyless upstream | `G1–G12` |
| **Layer 03 · Multi-Region BCP & Residency** | Residency-symmetric `DataZone` / `Regional` pools, secondary PAYG quota sized `≥2.6×` steady TPM for cold-cache hydration, `RA-GZRS` ADLS + dual AI Search stamps, and multi-region Cosmos DB thread state. | **`<15s` gateway cutover RTO** · `0` residency boundary leaks · Quarterly Game-Day pass | `B1–B12` |
| **Layer 04 · Sandboxed Agents & Evals** | SDK-free orchestrator proxying `AG-UI` SSE from microVM-isolated ACA Dynamic Sessions (Git-SHA tagged), Content Understanding Markdown ingestion, Foundry IQ MCP retrieval, and deterministic CI contract gates (`ARG001–007`). | `100%` microVM session isolation · `100%` resolved citation IDs · `0` flaky PR blocks | `A1–A12` |
| **Layer 05 · AI Data Strategy & Governance** | Dual-path **Microsoft Fabric / OneLake & Fabric IQ** (dedicated F-SKU), **Microsoft Purview DSPM for AI** label inheritance & event-driven ACL tombstoning, and **Cosmos DB DiskANN + RRF** tenant-partitioned hybrid search (`DRG001–007`). | **`≤15m` (`≤5m` reg.) ACL revocation** · `100%` Purview label inheritance · `0` poisoned chunks | `D1–D12` |

---

## 3. Two-Regime PTU Sizing Summary (`GPT-5.6` vs. `GPT-6 / 6.1`) `[M]`

Always verify target model generation before reserving Provisioned Throughput (`PTU-M`):

- **Regime 1 — Pre-GPT-6 (`gpt-5.6-terra`, `gpt-5.6-sol`, `gpt-5.6-luna`):**
  - Cached input tokens deduct **`100%` (`0.0x` weight)** from PTU utilization; uncached input = `1.0x`; output = `6.0x` <span class="ev-badge ev-m">[M]</span>.
  - Explicit `prompt_cache_breakpoint` and `prompt_cache_options` are **not supported on PTU-M**—strip them at the APIM gateway on the PTU leg while preserving Pos 1–6 ordering and `prompt_cache_key` <span class="ev-badge ev-m">[M]</span>.
- **Regime 2 — GPT-6 & GPT-6.1 (`gpt-6-astra`, `gpt-6-sol`, `gpt-6-luna`, `gpt-6.1-sol`):**
  - Explicit breakpoints are **supported on PTU-M** <span class="ev-badge ev-m">[M]</span>.
  - Normalized token weights apply: ordinary input = `1.0x`, cached read = `0.10x` (`0.05x` on `gpt-6.1-sol`), cache write = `1.25x`, output = `5.0x` <span class="ev-badge ev-m">[M]</span>.
  - Steady-state cached hit fraction is bounded by `k / (k + 1)` at Read/Write ratio `k:1` (`≥10:1` recommended so write overhead stays `<3%`).

---

## 4. Turnkey 3-Week Enterprise Readiness Engagement

1. **Intake (30 Minutes):** Score workload boundaries in the [Interactive Decision Studio](/studio/#triage) to select activated tracks and size initial PTU/BCP envelopes.
2. **Week 1 — Baseline & Static Audit:** Run `pcr_lint.py` across application repos, capture 24-hour un-tuned App Insights baselines, and verify regional SKU/quota parity.
3. **Week 2 — Middleware, Gateway & Sandbox Refactor:** Reorder prompts to `Pos 1–6`, deploy `apim-foundry-spillover-policy.xml`, wire Foundry IQ MCP + Content Understanding, and enforce Git-SHA ACA session tags.
4. **Week 3 — Load, Game-Day & 64-Gate Sign-Off:** Execute peak concurrency tests, run a 30-minute regional `429`/`503` Game-Day failover drill, enforce `agent_release_gate.py` + `data_readiness_gate.py` in CI, and sign off the applicable [`C` / `G` / `B` / `A` / `D` Readiness Checklists](/papers/migration-readiness-checklist).
