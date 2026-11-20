---
title: 11 · 7-Layer Quality Pipeline & 7-Step Validation Protocol
description: Embedding GPT-5.6+ prompt caching and PTU gates directly into the 7-layer testing and quality lifecycle.
---

# 11 · 7-Layer Quality Pipeline & 7-Step Protocol

<PageBrief
  stage="validate"
  readTime="4 min read"
  problem="Staging suites often verify model accuracy while skipping prompt caching under concurrency—surfacing 0% hits and 429 storms only after cutover."
  takeaway="Embed caching checks directly into unit, eval, load, and observability stages using the 7-step pre-cutover validation protocol."
  csaUse="Follow the 7-step table at the bottom as the Week 2/3 pre-cutover verification sequence."
/>

Rather than creating a separate governance silo, prompt-caching and PTU readiness plug directly into a defense-in-depth **7-Layer Testing & Quality Strategy** spanning Development Time (Layers 1–2), Deployment Gates (Layers 3 & 5), and Production Assurance (Layers 4, 6 & 7) <span class="ev-badge ev-arch">[Arch]</span>.

## 1. Seven-Layer Quality Integration Matrix `[Arch]`

<div class="arch-diagram">
  <svg viewBox="0 0 700 165" role="img" aria-labelledby="q7-title q7-desc">
    <title id="q7-title">7-Layer Testing and Quality Strategy augmented with GPT-5.6+ prompt caching gates</title>
    <desc id="q7-desc">Illustrates the 7-layer quality lifecycle across Development Time (1. Unit Tests + PCR001-006 Static Lint; 2. Prompt Evals + 2-Pass DeepEval Cache Contract), Deployment (3. Integration Tests / Offline Evals + Foundry Evaluations; 5. E2E UI and Load Tests), and Production (4. Online Evals; 6. Runtime Output Verification; 7. Observability and App Insights Cache/PTU KQL Gate).</desc>
    <defs><marker id="arr08" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#16858a"/></marker></defs>
    <rect x="6" y="8" width="212" height="136" rx="7" fill="#edf3fb" stroke="#93adc7"/>
    <text x="16" y="26" font-size="10.5" font-weight="700" fill="#183e62">Development Time (Local + PR CI)</text>
    <rect x="14" y="34" width="196" height="48" rx="5" fill="#fff" stroke="#6c93b8"/>
    <text x="20" y="49" font-size="9.3" font-weight="700" fill="#143d65">L1. Unit Tests (pytest / xUnit)</text>
    <text x="20" y="62" font-size="8.2" fill="#0e7279">+ Static AST/Regex Lint (PCR001–006)</text>
    <text x="20" y="74" font-size="8.2" fill="#35556f">+ Deterministic tool JSON sort test</text>
    <rect x="14" y="88" width="196" height="48" rx="5" fill="#fff" stroke="#6c93b8"/>
    <text x="20" y="103" font-size="9.3" font-weight="700" fill="#143d65">L2. Prompt Evals (DeepEval 50–200q)</text>
    <text x="20" y="116" font-size="8.2" fill="#0e7279">+ 2-Pass Cache Contract (cached &gt; 0)</text>
    <text x="20" y="128" font-size="8.2" fill="#35556f">+ GEval / StructuredOutput parity</text>
    <path d="M218 76 H240" stroke="#16858a" stroke-width="2" marker-end="url(#arr08)"/>
    <rect x="244" y="8" width="212" height="136" rx="7" fill="#eaf7f5" stroke="#6ca9a8"/>
    <text x="254" y="26" font-size="10.5" font-weight="700" fill="#115e63">Deployment Gate (DEV &rarr; INT &rarr; QA)</text>
    <rect x="252" y="34" width="196" height="52" rx="5" fill="#fff" stroke="#16858a"/>
    <text x="258" y="49" font-size="9.3" font-weight="700" fill="#115e63">L3. Integration Tests (Offline Evals)</text>
    <text x="258" y="62" font-size="8.2" fill="#355d65">Multi-Agent Workflow + Foundry Evals</text>
    <text x="258" y="74" font-size="8.2" fill="#0e7279">+ Multi-turn hit rate &ge;80%, R/W &ge;10:1</text>
    <rect x="252" y="92" width="196" height="44" rx="5" fill="#fff" stroke="#16858a"/>
    <text x="258" y="107" font-size="9.3" font-weight="700" fill="#115e63">L5. End-to-End UI &amp; Load Tests</text>
    <text x="258" y="120" font-size="8.2" fill="#0e7279">+ Peak RPM shard test (&gt;15 RPM/key)</text>
    <text x="258" y="131" font-size="8.2" fill="#355d65">+ Zero 429s at target PTU allocation</text>
    <path d="M456 76 H478" stroke="#16858a" stroke-width="2" marker-end="url(#arr08)"/>
    <rect x="482" y="8" width="212" height="136" rx="7" fill="#edf3fb" stroke="#93adc7"/>
    <text x="492" y="26" font-size="10.5" font-weight="700" fill="#183e62">Production &amp; Runtime Assurance</text>
    <rect x="490" y="34" width="196" height="32" rx="5" fill="#fff" stroke="#b0c4de"/>
    <text x="496" y="48" font-size="9.0" font-weight="700" fill="#143d65">L4. Online Evals &amp; L6. Runtime Gate</text>
    <text x="496" y="60" font-size="8.1" fill="#35556f">Verifier node cache-keyed per turn</text>
    <rect x="490" y="72" width="196" height="64" rx="5" fill="#fff7eb" stroke="#be7730"/>
    <text x="496" y="87" font-size="9.3" font-weight="700" fill="#8a4b0f">L7. Agentic Observability (OTel/KQL)</text>
    <text x="496" y="100" font-size="8.2" fill="#8a4b0f">App Insights per-key hit rate, TTFT,</text>
    <text x="496" y="112" font-size="8.2" fill="#8a4b0f">cached_tokens, cache_write_tokens,</text>
    <text x="496" y="124" font-size="8.2" font-weight="700" fill="#8a4b0f">&amp; peak-minute PTU headroom alerts</text>
    <text x="8" y="158" font-size="8.7" fill="#526c80">Reference 7-layer quality gate architecture combining static AST linting, DeepEval/Foundry evaluations, and OpenTelemetry KQL gates.</text>
  </svg>
</div>

| Quality Layer | Reference Test Stack & Scope | Added GPT-5.6+ Migration & Caching Gate |
| :--- | :--- | :--- |
| **1. Unit Tests** (Local + PR CI) | `pytest` (Python) / `xUnit` (.NET); deterministic assertions on serialization & routing. | Run **`PCR001–PCR006` static AST/regex linter**; assert deterministic `tools[]` sorting, static `response_format`, and zero timestamps in Pos 1–3. |
| **2. Prompt Evals** (Local + PR CI) | `pytest` + DeepEval / Foundry Evals (`GEval`, structured-output & tool metrics) on 50–200 golden cases. | Parametrize candidate model with a **2-pass execution**: Pass 1 warms cache; Pass 2 asserts `cached_tokens >= 1024` and quality parity. |
| **3. Integration Tests** (`DEV -> INT -> QA`) | Integration runners + `Azure AI Foundry Evaluations` SDK across multi-step agent graphs. | Verify multi-turn scenarios keep append-only history and achieve **`>=80%` repeat hit rate** and **`>=10:1` read/write ratio** <span class="ev-badge ev-agree">[Agree]</span>. |
| **4 & 6. Online Evals & Runtime Verifier** | Sampled production scoring (privacy-masked) + runtime groundedness verifier nodes. | Assign runtime verifier nodes a dedicated sharded `prompt_cache_key` so verification calls never thrash generator cache slots. |
| **5. End-to-End & Load** (`LOAD` env) | Playwright UI + load generator exercising peak release concurrency. | Test above `~15 RPM/key`; verify key sharding prevents cache misses and confirms zero unexpected HTTP `429`s on PTU. |
| **7. Observability & Cost Monitoring** | OpenTelemetry + Azure Monitor Application Insights + Foundry Tracing (correlated by `thread_id`). | Emit `prompt_cache_key`, `cached_tokens`, and `cache_write_tokens` per span; wire two-regime KQL release gate and drift alerts. |

## 2. Seven-Step Non-Production Validation Protocol

| Step | Validation Activity (Per Prompt Family / Agent Node) | Pass Criterion & Target SLO <span class="ev-badge ev-agree">[Agree]</span> |
| :--- | :--- | :--- |
| **1** | Freeze the versioned 50–200 case golden request set (single-turn + multi-turn sequences per node). | Dataset & rubric committed in version control. |
| **2** | Run baseline on current model (`gpt-4.x`, `o3-mini`, or `gpt-5.4`); record quality, `cached_tokens`, and TTFT p50/p95. | Baseline quality & cache metrics captured. |
| **3** | Run identical set on target GPT-5.6+ deployment *before* prompt/key refactoring. | Diagnostic ablation quantifying unconfigured miss rate. |
| **4** | Apply Chapters 07–09 refactoring (Pos 1–6 order + `prompt_cache_key` + SKU breakpoints) and run 2-pass benchmark. | Pass 2 `cached_tokens >= 1,024`; quality `>=` baseline. |
| **5** | Compute steady-state cache metrics across the full 50–200 case replay suite. | **Hit rate `>=80%`**; **cached share `>=60%`**; **`R/W >=10:1`**; TTFT p95 `<=` baseline. |
| **6** | Execute peak concurrency load test (`>15 RPM/family`) to validate shard bucket count and PTU headroom (`<60–70%` utilization). | Zero cache degradation at peak; zero unexpected HTTP `429`s. |
| **7** | Attach benchmark & right-sized PTU model to the Migration Readiness Record before production cutover. | Release gate sign-off completed. |
