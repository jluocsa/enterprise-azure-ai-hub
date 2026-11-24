---
title: 03 · Repeatable Readiness Engagement Scope
description: Turnkey intake qualification scorecard and 3-week structured delivery blueprint for scoping proactive Foundry model migration & PTU readiness engagements.
---

# 03 · Repeatable Readiness Engagement Scope

<PageBrief
  stepLabel="PROACTIVE DELIVERY · 03"
  readTime="4 min read"
  problem="Proactive readiness work stalls without a fast qualification filter and a bounded week-by-week delivery plan."
  takeaway="Qualify exposure in 30 minutes using 6 boundary questions, then execute a structured 3-week engagement with concrete exit artifacts."
  csaUse="Run the interactive scorecard below during a 30-minute discovery session, toggle the workload traits, and copy the scope summary."
/>

A core goal of Solution Industrialization is making architecture patterns **immediately scopable as repeatable proactive delivery engagements**. Use the interactive multi-track triage tool below (also available in the [Interactive Decision Studio](/studio/#triage)) and the 3-week blueprint to scope a **Microsoft Foundry Production Readiness Engagement** across [Playbook 01 (Caching & PTU)](/playbooks/prompt-caching/start/01-executive-thesis), [Playbook 02 (APIM AI Gateway)](/playbooks/apim-gateway/01-executive-thesis), [Playbook 03 (Multi-Region BCP)](/playbooks/multi-region-bcp/01-executive-thesis), [Playbook 04 (Agentic Harness & Evals)](/playbooks/agentic-rag-evals/01-executive-thesis), and [Playbook 05 (AI Data Strategy & Fabric–Foundry Governance)](/playbooks/ai-data-strategy/01-executive-thesis).

## 1. Intake Qualification Scorecard

<IntakeScorecard />

Capture **orders of magnitude and architectural boundaries** during a 30-minute intake call—not false precision:

| Qualification Dimension | Discovery Question | Architectural Branch Triggered |
| :--- | :--- | :--- |
| **1. Migration Trigger & Timeline** | Which retiring or baseline models (`gpt-4o`, `gpt-4.1`, `o3-mini`, `gpt-5.4`) are migrating to `gpt-5.6`, `gpt-6`, or `gpt-6.1`, and what is the cutover date? | Determines whether pre-GPT-6 (`0%` cached PTU draw, `6x` output) or GPT-6/6.1 normalized weights (`0.1x`/`0.05x` read, `1.25x` write, `5.0x` output) govern sizing. |
| **2. Agent Runtime Lifespan** | Is the workload a **Model 2 stateless container/web service** (rehydrating system prompt, tools, and history per HTTP turn) or a stateful worker? | Stateless multi-node agents invoke the LLM `3–8×` per user turn; prefix caching is mandatory cross-turn hydration memory. |
| **3. Deployment SKU Mix** | Will production run **Provisioned Throughput (PTU-M)**, **Standard (PAYG)**, or **PTU-M primary + Standard spillover** behind APIM? | On **GPT-5.6 PTU-M**, explicit breakpoints are unsupported—APIM must strip breakpoint fields on the PTU leg while preserving `prompt_cache_key`. |
| **4. Prefix Size & Peak Concurrency** | Do static instructions + tool schemas exceed **1,024 tokens**, and does any prompt family exceed **~15 RPM** at peak? | Prefixes `<1,024` tokens cannot cache (disable writes on 5.6+); families `>15 RPM` require deterministic `prompt_cache_key` sharding (`N = ⌈RPM ÷ 12⌉`). |
| **5. Existing CI & Telemetry Maturity** | Does the team already run automated prompt evaluations (`pytest` / DeepEval / Foundry Evals) and emit OpenTelemetry spans to Application Insights? | Determines effort needed to wire `PCR001–006` static linting, 2-pass cache assertions, and the Log Analytics KQL release gate. |
| **6. Ethical Walls, Chargeback & Seasonal Cliffs** | Does the platform isolate concurrent client engagements/matters, bill tokens to `cost_center` codes, or face `3×–6×` filing/audit-close traffic surges? | Activates the [Regulated Multi-Engagement & Compliance Profile](/playbooks/prompt-caching/profiles/regulated-multi-engagement): `Posture A` zero-client-cache mode, out-of-band OTel chargeback, seasonal PTU + PAYG spillover math, and `C-WP1–C-WP4` workpaper parity gates. |

## 2. Phased 3-Week Delivery Blueprint

<div class="arch-diagram">
  <svg viewBox="0 0 760 144" role="img" aria-labelledby="del-bp-title del-bp-desc" font-family="Segoe UI, Inter, -apple-system, sans-serif">
    <title id="del-bp-title">Three-Week Customer Readiness Delivery Flow</title>
    <desc id="del-bp-desc">Shows 30-Minute Intake Triage leading to Week 1 Baseline Audit Report, Week 2 Refactored Middleware and APIM Policy, and Week 3 Signed C1-C15 Readiness Record and Right-Sized PTU Model.</desc>
    <defs><marker id="del-bp-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#0f766e"/></marker></defs>
    <rect x="8" y="14" width="166" height="90" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="16" y="33" font-size="9.3" font-weight="700" fill="#183e62">Intake (30 Min)</text>
    <text x="16" y="49" font-size="8.2" fill="#334e68">Score retiring models,</text>
    <text x="16" y="62" font-size="8.2" fill="#334e68">SKU mix &amp; &gt;15 RPM</text>
    <text x="16" y="75" font-size="8.2" fill="#334e68">concurrency boundaries</text>
    <text x="16" y="94" font-size="7.8" font-weight="700" fill="#1d4ed8">[Exit: Scoped Plan]</text>
    <path d="M174 59 H196" stroke="#0f766e" stroke-width="1.8" marker-end="url(#del-bp-arr)"/>
    <rect x="200" y="14" width="170" height="90" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="208" y="33" font-size="9.3" font-weight="700" fill="#183e62">Week 1 · Baseline Audit</text>
    <text x="208" y="49" font-size="8.2" fill="#334e68">Rank nodes by RPM&times;Tok,</text>
    <text x="208" y="62" font-size="8.2" fill="#334e68">run pcr_lint.py &amp; capture</text>
    <text x="208" y="75" font-size="8.2" fill="#334e68">un-tuned miss baseline</text>
    <text x="208" y="94" font-size="7.8" font-weight="700" fill="#1d4ed8">[Exit: Audit Report]</text>
    <path d="M370 59 H392" stroke="#0f766e" stroke-width="1.8" marker-end="url(#del-bp-arr)"/>
    <rect x="396" y="14" width="170" height="90" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="404" y="33" font-size="9.3" font-weight="700" fill="#183e62">Week 2 · Prefix &amp; APIM</text>
    <text x="404" y="49" font-size="8.2" fill="#334e68">Refactor Pos 1–6 order,</text>
    <text x="404" y="62" font-size="8.2" fill="#334e68">shard keys &amp; wire 429</text>
    <text x="404" y="75" font-size="8.2" fill="#334e68">PAYG spillover in non-prod</text>
    <text x="404" y="94" font-size="7.8" font-weight="700" fill="#1d4ed8">[Exit: Staging Policy]</text>
    <path d="M566 59 H588" stroke="#0f766e" stroke-width="1.8" marker-end="url(#del-bp-arr)"/>
    <rect x="592" y="14" width="160" height="90" rx="6" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.5"/>
    <text x="600" y="33" font-size="9.3" font-weight="700" fill="#115e59">Week 3 · Gate Sign-Off</text>
    <text x="600" y="49" font-size="8.2" fill="#334e68">2-pass evals, peak load,</text>
    <text x="600" y="62" font-size="8.2" fill="#334e68">KQL workbook &amp; right-sized</text>
    <text x="600" y="75" font-size="8.2" fill="#334e68">PTU reservation model</text>
    <text x="600" y="94" font-size="7.8" font-weight="700" fill="#0f766e">[Exit: Signed C1–C15]</text>
    <text x="10" y="130" font-size="8.4" fill="#526c80">Each week produces one tangible engineering artifact verified before advancing to the next phase.</text>
  </svg>
</div>

| Phase | Core Engineering Activities | Concrete Exit Artifact |
| :--- | :--- | :--- |
| **Week 1: Baseline Audit & Prefix Mapping** | • Inventory top prompt families / agent nodes by token volume and peak RPM.<br>• Run `PCR001–PCR006` audit for early timestamps, unsorted `tools[]`, mutated `response_format`, and unpinned `reasoning.context`.<br>• Capture baseline quality, TTFT p50/p95, and `cached_tokens` on current vs. un-tuned target model (50–200 golden cases). | **1. Prefix Audit & Baseline Ablation Report** (quantifying un-tuned miss rate & PTU exposure). |
| **Week 2: Prefix Refactoring, Sharding & Gateway Wiring** | • Refactor context assembly middleware to strict `Pos 1–6` (`T0 → L2 → L1 → Volatile Tail`) order.<br>• Add deterministic `prompt_cache_key` with `>15 RPM` sharding and SKU-aware breakpoints (`Standard` / `GPT-6+ PTU-M`).<br>• Configure APIM `429 Retry-After` circuit-breaker spillover from PTU-M to Standard PAYG. | **2. Refactored Context Middleware & SKU-Aware APIM Policy** validated in non-prod. |
| **Week 3: 7-Layer Gate Verification & PTU Right-Sizing** | • Execute 2-pass DeepEval quality + cache parity suite (`cached_tokens >= 1024`, share `>=60%`, `R/W >= 10:1`).<br>• Run peak concurrency load test (`>15 RPM/family`) verifying zero HTTP `429`s below `60–70%` PTU saturation.<br>• Deploy App Insights KQL workbook and finalize right-sized PTU reservation model. | **3. Signed `C1–C15` Migration Readiness Record + Right-Sized PTU Capacity Model**. |

## 3. Workstream Ownership Boundaries

| Workstream | Scope During the 3-Week Engagement |
| :--- | :--- |
| **1. Architecture & Sizing** | Intake scorecard qualification, `Pos 1–6` prefix workshop, APIM spillover design review, and two-regime PTU sizing verification. |
| **2. Application & Evaluation** | Context middleware refactoring, canonical `tools[]` JSON serialization, and the 50–200 case golden evaluation dataset. |
| **3. Gateway & Observability** | APIM backend pool failover policy, OpenTelemetry `gen_ai.*` span attributes, DCR PII masking, and KQL alert rules. |
| **4. Capacity & Cost Governance** | Review of `DeployPeakNormTPM` vs. `ShardAvgNormTPM` telemetry and approval of Global / Data Zone PTU allocation + Standard spillover budget. |
