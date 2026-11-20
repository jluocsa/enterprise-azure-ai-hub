---
title: "White Paper · Model Migration Readiness: Prompt Caching on GPT-5.6 & Later"
description: Consolidated single-page architecture white paper covering stateless agent hydration, GPT-5.6 / GPT-6 / GPT-6.1 prompt caching mechanics, two-regime PTU sizing economics, Scope × Volatility prefix engineering, and 7-layer CI/OTel release gates.
---

# Model Migration Readiness: Prompt Caching on GPT-5.6 & Later

*Prefix architecture, explicit cache controls, two-regime PTU capacity economics, and 7-layer quality gates for stateless enterprise agents.*

<PlaybookMeta
  track="White Paper v1.0 · Single-Page Reader & Print Edition"
  provenance="Customer-Zero Validated (Sanitized Reference Edition)"
  governance="Sanitized · Peer Reviewed · IP Screened"
  owners="John Luo (@jluocsa) · Co-Authors Welcome"
  verified="2026-11-18 21:21 PST"
  status="Active v1.0"
  printable
/>

<PageBrief
  stepLabel="SINGLE-PAGE ARCHITECTURE EDITION"
  readTime="10 min full · 2 min scan"
  problem="Architecture reviews and offline sign-off workflows often require the entire playbook consolidated in one searchable, print-ready document."
  takeaway="Consolidates Playbook 01's thesis, diagrams, two-regime PTU math, Pos 1–6 ordering, CI/KQL gates, and R1–R6 Microsoft Learn sources."
  csaUse="Click 'Print / Save as PDF' above to generate a clean briefing PDF, or jump directly to a workstream via Quick Topic Navigation below."
/>

::: tip Quick Topic Navigation
- **Thesis, SKU Boundaries & Capacity Math:** [§01 Executive Summary](#sec-01), [§04 SKU Boundary & PTU Sizing](#sec-04), [§05 Break-Even Economics](#sec-05), and [§09 `C1–C15` Readiness Standard](#sec-09).
- **Hydration, Prefix Ordering & Gateway Routing:** [§02 Stateless Hydration](#sec-02), [§03 KV Mechanics & GPT-5.6+ Delta](#sec-03), [§06 Scope × Volatility Prefix Order & Anti-Patterns](#sec-06), and [§07 Wire Controls & APIM Spillover](#sec-07).
- **CI Linting, Telemetry Gates & Official Sources:** [§08 7-Layer Gates, Linter & KQL](#sec-08) and [§10 Verification Matrix & Sources](#sec-10).
:::

---

## 01 · Executive Summary & Core Questions {#sec-01}

Enterprise AI applications—such as **rubric-scoring / control-evaluation agents** and multi-node document-review workflows—assemble multi-thousand-token prompts combining system policies, skill catalogs, tool schemas, workspace context cards, and retrieved grounding evidence. Migrating these workloads from `gpt-4.x` or `o3-mini` to **GPT-5.6, GPT-6, and GPT-6.1** without explicit prefix engineering causes cache misses, a **2.56× spike in deployed PTU draw** (`170 → 435 PTUs` at the 5-PTU increment; `2.60×` raw TPM), higher time-to-first-token (TTFT) latency, and unamortized cache-write charges.

1. **Prompt caching remains active on GPT-5.6+**, introducing an explicit control surface (`prompt_cache_key`, `prompt_cache_options`, `prompt_cache_breakpoint`), TTL-tiered cache-write billing (`12h` billed from November 1, 2026), and a default `reasoning.context = "all_turns"` setting on GPT-5.6 and GPT-6 that amplifies multi-turn token volume <span class="ev-badge ev-m">[M]</span>.
2. **Deployment SKU dictates available controls:** Explicit breakpoints work on **Standard 5.6+** and **PTU-M GPT-6+**, whereas **GPT-5.6 on PTU-M does not support breakpoints** and relies on strict prefix ordering + `prompt_cache_key` <span class="ev-badge ev-m">[M]</span>.
3. **In a stateless web backend (Model 2), Azure KV caching is the only cross-turn hydration cache:** Dynamic fields injected early by middleware (e.g., live timestamps or user IDs) silently zero out cache hits.
4. **Caching readiness belongs inside the 7-layer quality gate** alongside accuracy and safety checks so model-retirement waves never degrade production capacity or latency.

| Architectural Question | Verified Engineering Answer & Design Implication |
| :--- | :--- |
| **Does implicit caching continue to apply on GPT-5.6+, or is explicit configuration required?** | `implicit` mode remains default <span class="ev-badge ev-m">[M]</span>, but GPT-5.6+ bills for cache writes, defaults `reasoning.context` to `all_turns` (on 5.6 and 6), and relies on key-assisted routing. Always set `prompt_cache_key` and enforce static-first prefix ordering. |
| **How should prompts be structured when tools, instructions, and retrieved context coexist?** | Align prompt assembly with **Scope × Volatility** <span class="ev-badge ev-arch">[Arch]</span>: (1) `response_format` + `T0` system/skill definitions, (2) sorted `tools[]`, (3) static domain methodology, (4) `L2` workspace card, (5) `L1` persona + append-only history, (6) live RAG/MCP & timestamps last. |
| **How do explicit cache breakpoints work, and where should they be placed?** | `prompt_cache_breakpoint: {"mode":"explicit"}` marks the end of a reusable prefix (`>=1,024` tokens) <span class="ev-badge ev-m">[M]</span>. Supported on Standard 5.6+ and PTU-M GPT-6+, **not on GPT-5.6 PTU-M**. Place Breakpoint #1 after `T0` static instructions/tools and Breakpoint #2 after the `L2` workspace card. |
| **How do cache hits and misses affect PTU sizing and TPM rate limits?** | On pre-GPT-6 PTU-M (incl. GPT-5.6), cached tokens consume **0% PTU capacity**; on GPT-6/6.1 PTU-M, cached reads weigh `0.1x` / `0.05x` vs. `1.25x` for writes <span class="ev-badge ev-m">[M]</span>. Dropping from 80% to 0% cache hits spikes deployed PTU draw by **2.56×** (`170 → 435 PTUs`). |
| **How can platform governance prevent un-cached code from promoting?** | Enforce `PCR001–006` static AST/regex lint rules in Layer 1 CI, a 2-pass DeepEval cache contract assertion in Layer 2 Prompt Evals, and two-regime App Insights KQL gates in Layer 7 Observability. |

---

## 02 · Stateless Agent Runtimes & the Hydration Tax {#sec-02}

Production enterprise agent platforms follow a **Model 2 stateless web backend pattern** (constructed and torn down on every HTTP request) rather than a **Model 1 stateful local CLI process** (resident in memory across turns) <span class="ev-badge ev-arch">[Arch]</span>. Each turn hydrates **`T0`** (global static policies, skills, sorted tool schemas, domain methodology), **`L2`** (workspace/case context card), and **`L1`** (user persona and append-only session checkpoints), transmitting the full prompt over the wire.

<div class="arch-diagram">
  <svg viewBox="0 0 700 186" role="img" aria-labelledby="wp-hyd-title wp-hyd-desc">
    <title id="wp-hyd-title">Model 2 Stateless Enterprise Agent Runtime per-turn hydration vs. Azure OpenAI KV prefix cache</title>
    <desc id="wp-hyd-desc">Shows how each HTTP turn constructs a fresh stateless agent instance, hydrates T0 static skills/schemas and L1/L2 session stores through a Composite Context Loader and Session Context Middleware, and relies on the Azure OpenAI KV Prefix Cache to avoid reprocessing static tokens on every turn.</desc>
    <defs><marker id="arr-wp02" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#16858a"/></marker></defs>
    <rect x="6" y="10" width="132" height="156" rx="6" fill="#edf3fb" stroke="#93adc7"/>
    <text x="16" y="29" font-size="10.5" font-weight="700" fill="#183e62">Durable Context Stores</text>
    <rect x="14" y="38" width="116" height="34" rx="4" fill="#fff" stroke="#b0c4de"/>
    <text x="20" y="52" font-size="9.0" font-weight="700" fill="#143d65">T0 Static Layer (RO)</text>
    <text x="20" y="65" font-size="8.2" fill="#526c80">Skills, tools, domain rules</text>
    <rect x="14" y="78" width="116" height="40" rx="4" fill="#fff" stroke="#b0c4de"/>
    <text x="20" y="92" font-size="9.0" font-weight="700" fill="#143d65">Session &amp; Context DB</text>
    <text x="20" y="104" font-size="8.2" fill="#526c80">L2 Workspace Card, L1</text>
    <text x="20" y="114" font-size="8.2" fill="#526c80">Persona &amp; Checkpoints</text>
    <rect x="14" y="124" width="116" height="34" rx="4" fill="#fff7eb" stroke="#d99b52"/>
    <text x="20" y="138" font-size="9.0" font-weight="700" fill="#8a4b0f">Live RAG &amp; MCP Tools</text>
    <text x="20" y="150" font-size="8.2" fill="#8a4b0f">AI Search, Enterprise APIs</text>
    <path d="M138 55 H164" stroke="#16858a" stroke-width="1.8" marker-end="url(#arr-wp02)"/>
    <path d="M138 98 H164" stroke="#16858a" stroke-width="1.8" marker-end="url(#arr-wp02)"/>
    <path d="M138 141 H164" stroke="#16858a" stroke-width="1.8" marker-end="url(#arr-wp02)"/>
    <rect x="168" y="10" width="246" height="156" rx="6" fill="#f8fafc" stroke="#93adc7"/>
    <text x="178" y="29" font-size="10.2" font-weight="700" fill="#183e62">Stateless Agent Turn (Per-Request Lifecycle)</text>
    <rect x="178" y="38" width="226" height="36" rx="4" fill="#eaf4f5" stroke="#6ca9a8"/>
    <text x="185" y="53" font-size="9.2" font-weight="700" fill="#115e63">Composite Context Loader</text>
    <text x="185" y="66" font-size="8.3" fill="#355d65">Loads static T0 rules, L2 scope, L1 persona</text>
    <rect x="178" y="80" width="226" height="38" rx="4" fill="#eaf4f5" stroke="#6ca9a8"/>
    <text x="185" y="95" font-size="9.2" font-weight="700" fill="#115e63">Session Context Middleware</text>
    <text x="185" y="108" font-size="8.3" fill="#355d65">Assembles ordered prefix + canonical tool JSON</text>
    <rect x="178" y="124" width="226" height="34" rx="4" fill="#edf3fb" stroke="#93adc7"/>
    <text x="185" y="138" font-size="9.2" font-weight="700" fill="#183e62">API Wire Payload (Responses / Chat API)</text>
    <text x="185" y="150" font-size="8.3" fill="#35556f">Sends full hydrated prompt prefix every turn</text>
    <path d="M414 88 H442" stroke="#16858a" stroke-width="2.2" marker-end="url(#arr-wp02)"/>
    <rect x="446" y="10" width="248" height="156" rx="6" fill="#eaf7f5" stroke="#16858a" stroke-width="1.5"/>
    <text x="456" y="29" font-size="10.5" font-weight="700" fill="#115e63">Azure OpenAI / Foundry Model KV Cache</text>
    <rect x="456" y="38" width="228" height="54" rx="4" fill="#fff" stroke="#16858a"/>
    <text x="463" y="53" font-size="9.2" font-weight="700" fill="#0e7279">Cached Prefix Hit (cached_tokens &ge; 1,024)</text>
    <text x="463" y="66" font-size="8.3" fill="#355d65">Reuses KV tensors for T0 skills/tools/ontology &amp; L2.</text>
    <text x="463" y="79" font-size="8.3" font-weight="700" fill="#0e7279">PTU 5.6: 0% capacity draw | Std: discounted read</text>
    <rect x="456" y="98" width="228" height="58" rx="4" fill="#fdecea" stroke="#d9534f"/>
    <text x="463" y="113" font-size="9.2" font-weight="700" fill="#a93226">If Prefix Mutates Early (e.g. timestamp at Pos 1)</text>
    <text x="463" y="126" font-size="8.3" fill="#a93226">Recomputes all 4k–12k hydrated tokens every turn;</text>
    <text x="463" y="139" font-size="8.3" font-weight="700" fill="#a93226">100% PTU/TPM draw + unamortized cache-write fee</text>
    <text x="8" y="180" font-size="8.8" fill="#526c80">Model 2 stateless enterprise agent pattern: per-turn hydration paired with Azure OpenAI KV prefix caching.</text>
  </svg>
</div>

---

## 03 · KV-Tensor Mechanics & GPT-5.6+ Delta {#sec-03}

Azure OpenAI evaluates the rendered prefix in strict wire order: **(1)** structured outputs schema (`response_format`), **(2)** `system` / `developer` messages, **(3)** `tools[]` definitions, and **(4)** conversation messages & multimodal blocks <span class="ev-badge ev-m">[M]</span>. Every cache hit requires **`>=1,024` identical leading tokens**; the legacy 128-token rounding on `<=5.5` **no longer applies on GPT-5.6+**.

| Capability | Before GPT-5.6 (`gpt-4.1`–`5.5`, `o3-mini`) | GPT-5.6 Family (`gpt-5.6-sol/terra/luna`) | GPT-6 & Newer (`gpt-6-astra/sol/luna`, `6.1-sol`) |
| :--- | :--- | :--- | :--- |
| **Automatic prefix caching** | Enabled by default on supported operations. | Enabled by default (`implicit` mode); pair with `prompt_cache_key`. | Enabled by default (`implicit` mode); full explicit control available. |
| **Explicit breakpoints** (`prompt_cache_breakpoint`) | **Not supported** (returns HTTP `400` if sent). | **Standard:** Supported (up to 4 writes).<br>**PTU-M:** **Not supported**. | **Standard & PTU-M:** **Supported** (up to 4 new writes, 50 read candidates). |
| **Retention / TTL control** | `prompt_cache_retention`: `in_memory` (`<=5.4`) or `24h` (`5.5` default). | `prompt_cache_options.ttl`: `30m` (default) or `12h` (Responses API). Legacy field deprecated. | `prompt_cache_options.ttl`: `30m` (default) or `12h` (Responses API). |
| **Write billing & `reasoning.context`** | No cache-write charge; `reasoning.context` defaults to `current_turn`. | **Cache writes can incur charges** (`12h` billed from **Nov 1, 2026**); `reasoning.context` defaults to `all_turns`. | **Cache writes incur charges** and count at `1.25x`/`2.5x` in PTU normalized weights; `reasoning.context` defaults to `all_turns`. |
| **Usage telemetry** | `prompt_tokens_details.cached_tokens` | `cached_tokens` + `cache_write_tokens` (Standard). | `cached_tokens` + `cache_write_tokens`. |

---

## 04 · Deployment SKU Boundary & Two-Regime PTU Math {#sec-04}

| Model & Version | Input TPM / PTU | Min PTU (Global/DZ \| Reg) | Scale Increment | PTU Capacity Formula & Cache Accounting Rule <span class="ev-badge ev-m">[M]</span> |
| :--- | :--- | :--- | :--- | :--- |
| `gpt-5.6-luna` (2026-07-09) | **30,000** | `15` \| `15` | `5` \| `5` | Output ratio `6x`; cached input deducted **100%** (`0` PTU draw). |
| `gpt-5.6-terra` (2026-07-09) | **3,000** | `15` \| `15` | `5` \| `5` | Output ratio `6x`; cached input deducted **100%** (`0` PTU draw). |
| `gpt-5.6-sol` (2026-07-09) | **1,200** | `15` \| `15` | `5` \| `5` | Output ratio `6x`; cached input deducted **100%** (`0` PTU draw). |
| `gpt-5.4` / `5.4-mini` | **2,400** / **7,900** | `15` \| `50` / `25` | `5` \| `50` / `25` | Output ratio `6x`; cached input deducted **100%** (baseline). |
| `gpt-6-astra` (2026-09-03) | **600** | `15` \| `25` | `5` \| `25` | Normalized weights: input `1.0`, cached read `0.1`, write `1.25`, output `5.0`. |
| `gpt-6-luna` (2026-09-22) | **59,400** | `15` \| `15` | `5` \| `5` | Normalized weights: input `1.0`, cached read `0.1`, write `1.25`, output `5.0`. |
| `gpt-6-sol` (2026-09-22) | **3,000** | `15` \| `15` | `5` \| `5` | Normalized weights: input `1.0`, cached read `0.1`, write `1.25`, output `5.0`. |
| `gpt-6.1-sol` (2026-09-29) | **3,000** | `15` \| `25` | `5` \| `25` | Normalized weights: input `1.0`, **cached read `0.05`**, write `1.25`, output `5.0`. |

- **Regime 1 — Pre-GPT-6 (incl. GPT-5.6):** `Normalized TPM = Input TPM × (1 − Cache Rate) + (6 × Output TPM)`. At `100 RPM`, `10,000` input tokens, and `500` output tokens on `gpt-5.6-terra` (`3,000` Input TPM/PTU): **80% cache hit** = `500,000` Norm TPM → **170 PTUs** vs. **0% cache hit** = `1,300,000` Norm TPM → **435 PTUs** (**2.56× spike**).
- **Regime 2 — GPT-6 & GPT-6.1 (`<=272K`):** `Normalized TPM = (Uncached × 1.0) + (Cached Read × w_read) + (Cache Write × 1.25) + (Output × 5.0)`, where each input token is counted in exactly one category (`>272K` long-context weights double input/cache weights and use `7.5x` output).

<div class="no-print">
  <PtuCalculator />
</div>

---

## 05 · Cache Write/Read Break-Even Economics & Node Archetypes {#sec-05}

For a reusable prefix `P >= 1,024` tokens written once (`w_write = 1.25`) and read `k` subsequent times within its TTL (`w_read = 0.10` on GPT-6, `0.05` on `gpt-6.1-sol`), effective weight per prefix token is **`C(k) = (1.25 + k × w_read) ÷ (k + 1)`**:

- **`k = 0` (One-shot miss):** `1.25x` (**+25% penalty**) → disable caching via `prompt_cache_options: {"mode":"explicit"}` with zero breakpoints.
- **`k = 1` (Single reuse):** `0.675x` on GPT-6 / `0.650x` on `6.1-sol` (**−32.5% to −35% net**) → **break-even is reached on the very first cache read**.
- **`k = 10` (Production gate SLO `[Agree]`):** `0.205x` on GPT-6 / `0.159x` on `6.1-sol` (**−79.5% to −84.1% net**).

| Agent Node Archetype | Typical Prefix | Primary Migration Risk | Target Share <span class="ev-badge ev-agree">[Agree]</span> | Prescription |
| :--- | :--- | :--- | :--- | :--- |
| **1. Rubric / Control Evaluator** | `2.5k–6k` tok | Mutated enums in `response_format` or Pos 1 | **70%–85%** | Static `response_format`; Breakpoint #1 after rubric; evidence in Pos 6. |
| **2. Evidence Summarizer** | `1.8k–4.5k` tok | RAG chunks prepended ahead of instructions | **60%–75%** | Breakpoints on `T0` & `L2`; RAG chunks in Pos 6. |
| **3. High-RPM Guardrail / Router** | `1.2k–2k` tok | `>15 RPM` on unsharded `prompt_cache_key` | **80%–90%** | Shard `prompt_cache_key` across `N = ⌈RPM ÷ 12⌉` buckets. |
| **4. Taxonomy Classifier** | `3k–8k` tok | Non-deterministic dict key order across pods | **85%–92%** | Canonical `json.dumps(..., sort_keys=True)`; Breakpoint #1 after catalog. |
| **5. Tool-Calling Orchestrator** | `2k–5.5k` tok | Per-turn tool filtering / unsorted `tools[]` | **65%–80%** | Pin stable toolset per skill; sort `tools[]` by function name. |
| **6. Groundedness Verifier** | `1.5k–3.2k` tok | Sharing generator's `prompt_cache_key` | **70%–85%** | Dedicated verifier key; pin `reasoning.context: "current_turn"`. |
| **7. Multi-Turn Rewriter** | `1.2k–4k` tok | Sliding-window truncation & `all_turns` bloat | **65%–80%** | Append-only turns in Pos 5; pin `reasoning.context: "current_turn"`. |
| **8. Short-Prefix Extractor** | `<1,024` tok | Paying `1.25x` write weight with zero reads | **N/A** | Set `prompt_cache_options: {"mode":"explicit"}` with zero breakpoints. |

---

## 06 · Scope × Volatility Prefix Order & Middleware Refactoring {#sec-06}

<div class="arch-diagram">
  <svg viewBox="0 0 714 172" role="img" aria-labelledby="wp-pipe-title wp-pipe-desc">
    <title id="wp-pipe-title">Six-layer enterprise AI prompt prefix ordering mapped to enterprise context tiers</title>
    <desc id="wp-pipe-desc">Shows Positions 1 to 3 Global T0 static schema, tools, and domain rules terminating at Breakpoint #1, Position 4 Workspace L2 Card terminating at Breakpoint #2, Position 5 User L1 Persona and append-only history, and Position 6 Always-Live RAG and MCP tail.</desc>
    <rect x="6" y="8" width="114" height="66" rx="5" fill="#eaf4f5" stroke="#16858a" stroke-width="1.5"/>
    <text x="12" y="25" font-size="9.8" font-weight="700" fill="#115e63">Pos 1: Schema &amp; Sys</text>
    <text x="12" y="39" font-size="8.4" fill="#355d65">response_format +</text>
    <text x="12" y="51" font-size="8.4" fill="#355d65">core role / RAI policy</text>
    <text x="12" y="65" font-size="8.0" font-weight="700" fill="#0e7279">[Global T0 | Zero Vol]</text>
    <rect x="125" y="8" width="110" height="66" rx="5" fill="#eaf4f5" stroke="#16858a" stroke-width="1.5"/>
    <text x="131" y="25" font-size="9.8" font-weight="700" fill="#115e63">Pos 2: Tools &amp; Skills</text>
    <text x="131" y="39" font-size="8.4" fill="#355d65">Shared skill headers</text>
    <text x="131" y="51" font-size="8.4" fill="#355d65">&amp; sorted tools[] JSON</text>
    <text x="131" y="65" font-size="8.0" font-weight="700" fill="#0e7279">[Global T0 | Zero Vol]</text>
    <rect x="240" y="8" width="114" height="66" rx="5" fill="#eaf4f5" stroke="#16858a" stroke-width="1.5"/>
    <text x="246" y="25" font-size="9.8" font-weight="700" fill="#115e63">Pos 3: Domain Rules</text>
    <text x="246" y="39" font-size="8.4" fill="#355d65">Domain methodology +</text>
    <text x="246" y="51" font-size="8.4" fill="#355d65">few-shot exemplars</text>
    <text x="246" y="65" font-size="8.0" font-weight="700" fill="#0e7279">[Global T0 | &ge;1,024t]</text>
    <line x1="359" y1="4" x2="359" y2="110" stroke="#d9534f" stroke-width="2" stroke-dasharray="4,2"/>
    <rect x="313" y="110" width="92" height="17" rx="3" fill="#fdecea" stroke="#d9534f"/>
    <text x="318" y="122" font-size="8.0" font-weight="700" fill="#a93226">Breakpoint #1 (T0)</text>
    <rect x="364" y="8" width="106" height="66" rx="5" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="370" y="25" font-size="9.3" font-weight="700" fill="#183e62">Pos 4: Workspace</text>
    <text x="370" y="39" font-size="8.4" fill="#35556f">Shared L2 Context</text>
    <text x="370" y="51" font-size="8.4" fill="#35556f">Card (hash-versioned)</text>
    <text x="370" y="65" font-size="8.0" font-weight="700" fill="#214f7a">[Scope: scope_id]</text>
    <line x1="475" y1="4" x2="475" y2="110" stroke="#d9534f" stroke-width="2" stroke-dasharray="4,2"/>
    <rect x="429" y="110" width="92" height="17" rx="3" fill="#fdecea" stroke="#d9534f"/>
    <text x="434" y="122" font-size="8.0" font-weight="700" fill="#a93226">Breakpoint #2 (L2)</text>
    <rect x="480" y="8" width="104" height="66" rx="5" fill="#edf3fb" stroke="#93adc7"/>
    <text x="486" y="25" font-size="9.8" font-weight="700" fill="#183e62">Pos 5: L1 &amp; History</text>
    <text x="486" y="39" font-size="8.4" fill="#35556f">Persona + session</text>
    <text x="486" y="51" font-size="8.4" fill="#35556f">append-only turns</text>
    <text x="486" y="65" font-size="8.0" font-weight="700" fill="#214f7a">[Scope: user + thread]</text>
    <rect x="589" y="8" width="119" height="66" rx="5" fill="#fff7eb" stroke="#be7730" stroke-width="1.4"/>
    <text x="595" y="25" font-size="9.8" font-weight="700" fill="#8a4b0f">Pos 6: Volatile Tail</text>
    <text x="595" y="39" font-size="8.4" fill="#8a4b0f">RAG chunks, live MCP,</text>
    <text x="595" y="51" font-size="8.4" fill="#8a4b0f">timestamps &amp; query</text>
    <text x="595" y="65" font-size="7.9" font-weight="700" fill="#985a18">[Always-Live | Uncached]</text>
    <path d="M6 84 H354" stroke="#16858a" stroke-width="2"/>
    <text x="42" y="98" font-size="8.8" font-weight="700" fill="#115e63">Shared Across All Users &amp; Workspaces (100% Cache Reuse)</text>
    <path d="M364 84 H470" stroke="#214f7a" stroke-width="2"/>
    <text x="368" y="98" font-size="8.5" fill="#214f7a">Shared per Workspace</text>
    <path d="M480 84 H584" stroke="#5a7187" stroke-width="2"/>
    <text x="486" y="98" font-size="8.5" font-weight="700" fill="#5a7187">Reused in Session</text>
    <text x="8" y="148" font-size="8.8" fill="#35556f"><tspan font-weight="700" fill="#143d65">Context precedence rule:</tspan> Declare static precedence rules ("Workspace scope L2 governs domain facts; User L1 governs formatting") in Pos 1,</text>
    <text x="8" y="161" font-size="8.8" fill="#35556f">while placing the Workspace Context payload in Pos 4 and User Persona / Session History in Pos 5.</text>
  </svg>
</div>

Keep `{"role": "system"}` + sorted `tools[]` **100% Global `T0`** so `tools[]` caches across all workspaces and users, and inject `L2` (workspace) and `L1` (user) as a leading `developer` context message ahead of append-only `*history`:

```python
import json


def build_messages_cache_ready(
    static_policy: str,
    domain_methodology: str,
    l2_workspace_card: dict,
    l1_persona_card: dict,
    history: list[dict],
    rag_chunks: str,
    query: str,
    supports_explicit_breakpoints: bool,  # True on Standard 5.6+ & PTU-M GPT-6+; False on PTU-M GPT-5.6
):
    t0_block = {"type": "text", "text": f"{static_policy}\n\n{domain_methodology}"}      # Pos 1 & 3 (Global T0 >= 1,024t)
    l2_block = {"type": "text", "text": json.dumps(l2_workspace_card, sort_keys=True)}   # Pos 4 (shared per scope_id)
    l1_block = {"type": "text", "text": json.dumps(l1_persona_card, sort_keys=True)}     # Pos 5a (shared per user_id)

    if supports_explicit_breakpoints:
        t0_block["prompt_cache_breakpoint"] = {"mode": "explicit"}  # Breakpoint #1: global T0 + tools[] reuse
        l2_block["prompt_cache_breakpoint"] = {"mode": "explicit"}  # Breakpoint #2: workspace-wide L2 reuse

    return [
        {"role": "system", "content": [t0_block]},
        {"role": "developer", "content": [l2_block, l1_block]},
        *history,
        {"role": "user", "content": f"<retrieved_grounding>\n{rag_chunks}\n</retrieved_grounding>\n\n{query}"},
    ]
```

---

## 07 · Wire Controls, `>15 RPM` Sharding & APIM Spillover {#sec-07}

- **Deterministic Sharded Key (`[M]` + `[Arch]`):** Format keys as `{app}:{node_or_skill}:{prompt_ver}:shard-{0..N-1}` where `N = max(1, ceil(Peak_RPM / 12))`, routing turns via `hash(thread_id) % N` so per-key traffic stays below the `~15 RPM` partition threshold without embedding `user_id` or `uuid4()`.
- **Breakpoint Budgets (`[M]`):** Up to **4 new cache writes**/request (`3` explicit + `1` automatic latest-message write in `implicit` mode; `4` explicit in `explicit` mode) and **50 read candidates** across history.
- **APIM SKU-Aware Spillover (`[Arch]`):** Size base PTU-M below `~60–70%` saturation; preserve `prompt_cache_key` across both legs; strip unsupported `prompt_cache_breakpoint` / `prompt_cache_options` fields when forwarding to a **GPT-5.6 PTU-M** backend while keeping them intact on Standard spillover and GPT-6+ PTU-M; honor `Retry-After` on HTTP `429`.

<div class="arch-diagram">
  <svg viewBox="0 0 700 114" role="img" aria-labelledby="wp-apim-title wp-apim-desc">
    <title id="wp-apim-title">APIM SKU-aware routing between PTU-M primary deployment and Standard spillover</title>
    <desc id="wp-apim-desc">Shows enterprise AI applications sending sharded prompt_cache_key requests through Azure API Management to a primary PTU-M deployment with automatic HTTP 429 spillover to Standard PAYG.</desc>
    <defs><marker id="arr-wp10" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#16858a"/></marker></defs>
    <rect x="6" y="12" width="166" height="86" rx="6" fill="#edf3fb" stroke="#93adc7"/>
    <text x="14" y="30" font-size="9.5" font-weight="700" fill="#183e62">Enterprise AI App / Agent</text>
    <text x="14" y="45" font-size="8.2" fill="#35556f">&bull; Pos 1–6 static-first prefix</text>
    <text x="14" y="58" font-size="8.2" fill="#35556f">&bull; Sharded prompt_cache_key</text>
    <text x="14" y="71" font-size="8.2" fill="#35556f">&bull; reasoning.context pinned</text>
    <text x="14" y="84" font-size="8.2" fill="#0e7279" font-weight="700">&bull; Breakpoints on Pos 3 &amp; 4</text>
    <path d="M172 55 H198" stroke="#16858a" stroke-width="2" marker-end="url(#arr-wp10)"/>
    <rect x="202" y="12" width="196" height="86" rx="6" fill="#f8fafc" stroke="#6ca9a8" stroke-width="1.4"/>
    <text x="212" y="30" font-size="9.5" font-weight="700" fill="#115e63">APIM Gateway &amp; SKU Adapter</text>
    <text x="212" y="45" font-size="8.2" fill="#355d65">1. Preserves prompt_cache_key</text>
    <text x="212" y="58" font-size="8.2" fill="#355d65">2. Strips breakpoint fields if target</text>
    <text x="212" y="70" font-size="8.2" fill="#355d65">   is GPT-5.6 PTU-M (unsupported)</text>
    <text x="212" y="83" font-size="8.2" fill="#183e62" font-weight="700">3. Fails over on 429 Retry-After</text>
    <path d="M398 35 H430" stroke="#16858a" stroke-width="2" marker-end="url(#arr-wp10)"/>
    <path d="M398 76 H430" stroke="#be7730" stroke-width="1.8" stroke-dasharray="4,2" marker-end="url(#arr-wp10)"/>
    <rect x="434" y="8" width="260" height="44" rx="5" fill="#eaf7f5" stroke="#16858a"/>
    <text x="442" y="24" font-size="9.2" font-weight="700" fill="#0e7279">Primary: Provisioned (PTU-M) Deployment</text>
    <text x="442" y="37" font-size="8.1" fill="#355d65">Sized with burst headroom; 0% cached draw on</text>
    <text x="442" y="47" font-size="8.1" fill="#355d65">5.6 PTU-M; 0.1x / 0.05x read weight on GPT-6 / 6.1</text>
    <rect x="434" y="58" width="260" height="44" rx="5" fill="#fff7eb" stroke="#be7730"/>
    <text x="442" y="74" font-size="9.2" font-weight="700" fill="#8a4b0f">Spillover: Standard (PAYG) Deployment</text>
    <text x="442" y="87" font-size="8.1" fill="#8a4b0f">Absorbs burst traffic above PTU ceiling; honors explicit</text>
    <text x="442" y="97" font-size="8.1" fill="#8a4b0f">breakpoints on 5.6+ and reports cache_write_tokens</text>
  </svg>
</div>

---

## 08 · 7-Layer Quality Pipeline, `PCR001–006` & KQL Release Gate {#sec-08}

- **Layer 1 (PR Static Lint):** Run [`pcr_lint.py`](/papers/engineering-kits#pcr-linter) (`PCR001` key/sharding, `PCR002` Pos-1 volatile tokens, `PCR003` unsorted `json.dumps`, `PCR004` early RAG chunks, `PCR005` invalid `5.6` PTU-M breakpoints / deprecated retention, `PCR006` missing `cached_tokens` extraction across `input_tokens_details` and `prompt_tokens_details`).
- **Layer 2 & 3 (2-Pass Eval & Multi-Turn Replay):** Warm cache on Pass 1; assert `cached_tokens >= 1,024`, cached share `>=60%`, steady-state hit rate `>=80%`, and `Read/Write >= 10:1` <span class="ev-badge ev-agree">[Agree]</span> alongside output quality parity.
- **Layer 5 & 7 (Peak Load & OTel/KQL):** Validate `>15 RPM/family` sharding under load and enforce the two-regime Application Insights KQL gate (separating coincident deployment-wide `DeployPeakNormTPM` from per-shard cache metrics):

<<< @/public/kits/ptu-cache-release-gate.kql{kusto}

---

## 09 · 15-Point Migration Readiness Standard (`C1–C15`) {#sec-09}

Copy-ready PR template available at [`C1–C15` Migration Readiness PR Checklist](/papers/migration-readiness-checklist):

| # | Scope | Readiness Criterion | Evidence / Gate |
| :--- | :--- | :--- | :--- |
| **C1** | `ALL` | Documented stable prefix boundary (`>=1,024` tokens) mapped to Pos 1–6 (`T0 → L2 → L1 → Tail`). | Architecture spec |
| **C2** | `ALL` | Pos 1–3 system instructions & `response_format` contain zero timestamps, user IDs, or request GUIDs. | `PCR002` CI lint |
| **C3** | `ALL` | `tools[]` sorted by name and serialized with canonical JSON key order (`sort_keys=True`). | `PCR003` unit test |
| **C4** | `ALL` | Dynamic RAG chunks, live MCP outputs, and current user query placed at Pos 6 (tail). | `PCR004` CI lint |
| **C5** | `ALL` | Multi-turn checkpointed conversation history is strictly append-only within a session window. | Layer 3 replay test |
| **C6** | `ALL` | `prompt_cache_key` set on every GPT-5.6+ call (`{app}:{node}:{ver}`), excluding per-user/request GUIDs. | `PCR001` CI lint |
| **C7** | `ALL` | Deterministic key sharding (`0..N-1`, `N = ceil(RPM / 12)`) active for nodes exceeding `~15 RPM`. | Layer 5 load test |
| **C8** | `STD / 6+` | Explicit `prompt_cache_breakpoint` placed after Pos 3 (`>=1,024t`) and optionally Pos 4 (`<=4` writes). | `PCR005` wire check |
| **C9** | `PTU 5.6` | GPT-5.6 PTU-M leg strips unsupported breakpoint/options fields while preserving `prompt_cache_key`. | APIM / SKU adapter |
| **C10** | `ALL` | `prompt_cache_options.ttl` (`30m` vs `12h`), `reasoning.context` (`current_turn` vs `all_turns`), and `R/W >=10:1` verified. | Layer 2 eval report |
| **C11** | `ALL` | `cached_tokens`, `cache_write_tokens`, `prompt_cache_key`, and TTFT emitted via metadata-only OTel spans. | `PCR006` / Layer 7 |
| **C12** | `ALL` | 2-pass DeepEval golden set (50–200 cases) passes hit rate `>=80%`, share `>=60%`, TTFT, and quality parity. | 2-pass eval report |
| **C13** | `ALL` | Peak concurrency load test passes below `60–70%` PTU queuing saturation with zero unexpected HTTP `429`s. | Load report |
| **C14** | `ALL` | PTU capacity model updated from measured `DeployPeakNormTPM` and model-specific normalized weights. | FinOps PTU sheet |
| **C15** | `ALL` | Readiness record verified and signed off across architecture, platform, and capacity workstreams. | Release sign-off |

---

## 10 · Verification Matrix & Official Microsoft Sources {#sec-10}

*Last verified against published Microsoft Learn documentation: **2026-11-18 21:21 PST**.*

- **R1 · Prompt caching in Azure OpenAI (`[M]`):** <https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/prompt-caching>
- **R2 · Azure OpenAI Service pricing (`[M]`):** <https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/>
- **R3 · Determine PTU sizing for a workload (`[M]`):** <https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/provisioned-throughput-sizing>
- **R4 · Foundry Models region & provisioned availability (`[M]`):** <https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability?pivots=provisioned>
- **R5 · Azure OpenAI reasoning models (`[M]`):** <https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/reasoning#preserve-reasoning-across-calls> · [Microsoft Q&A #5942997](https://learn.microsoft.com/en-us/answers/questions/5942997/gpt-5-6-implicit-prompt-caching-and-explicit-promp)
- **R6 · Use a gateway in front of multiple model deployments (`[M]`):** <https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/azure-openai-gateway-multi-backend>
