---
title: 01 · Executive Thesis & Core Questions
description: Architectural thesis and verified engineering answers for migrating stateless enterprise agents to GPT-5.6, GPT-6, and GPT-6.1 across Standard and PTU-M deployments.
---

# 01 · Executive Thesis & Core Migration Questions

<PlaybookMeta
  track="01 · Prompt Caching & PTU Readiness (GPT-5.6+)"
  provenance="Customer-Zero Validated (Regulated Multi-Node Agent Platform)"
  governance="Sanitized · Peer Reviewed · IP Screened"
  owners="John Luo (@jluocsa) · Co-Authors Welcome"
  verified="2026-11-18 21:21 PST"
  status="Live v1.0"
  paperHref="/papers/foundry-prompt-caching-gpt56-whitepaper"
  paperLabel="Single-Page White Paper →"
/>

<PageBrief
  stage="start"
  readTime="3 min read"
  problem="Upgrading apps from GPT-4 / o3-mini to GPT-5.6, GPT-6, and GPT-6.1 without prompt discipline causes a 2.56× jump in PTU capacity and slower responses."
  takeaway="Keep static instructions and sorted tools first, shard cache keys above 15 RPM, match controls to SKU, and enforce automated CI + KQL gates."
  csaUse="Start migration planning here—walk through the 5-box diagram below, then select the matching intake, design, or CI kit workflow."
/>

## At a Glance: Problem Solved & Practical Workflow

When enterprise AI applications—such as **document-review, compliance, and multi-step agent platforms**—upgrade from `gpt-4.x` or `o3-mini` to **GPT-5.6, GPT-6, and GPT-6.1**, dynamic fields placed near the top of prompts (timestamps, user IDs, or unsorted tool lists) silently break Azure’s prompt cache. Without prefix discipline, workloads hit a **2.56× spike in required PTU capacity** (`2.60×` raw TPM), slower time-to-first-token (TTFT), and unamortized cache-write charges.

This playbook was produced through the hub’s [Five-Stage Industrialization Factory](/operating-model/industrialization-pipeline)—taking a proven **Customer-Zero** fix, stripping all customer identifiers, verifying every product boundary against Microsoft Learn, and packaging a repeatable architecture and automation kit.

<div class="arch-diagram">
  <svg viewBox="0 0 760 154" role="img" aria-labelledby="pb1-glance-title pb1-glance-desc" font-family="Segoe UI, Inter, -apple-system, sans-serif">
    <title id="pb1-glance-title">Playbook 01 End-to-End Story Flow</title>
    <desc id="pb1-glance-desc">Shows 1 Upgrade Trigger to GPT-5.6 and GPT-6, 2 Hidden Cache-Miss Trap causing a 2.56x PTU spike, 3 Stable-First Prefix and APIM Spillover Fix, 4 Automated CI and KQL Gates, and 5 Verified Cutover Outcome.</desc>
    <defs><marker id="pb1-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#0f766e"/></marker></defs>
    <rect x="8" y="18" width="132" height="96" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="16" y="37" font-size="9.2" font-weight="700" fill="#183e62">1. Upgrade Trigger</text>
    <text x="16" y="53" font-size="8.2" fill="#334e68">Apps migrate from</text>
    <text x="16" y="66" font-size="8.2" fill="#334e68">GPT-4 / o3-mini to</text>
    <text x="16" y="79" font-size="8.2" fill="#334e68">GPT-5.6, 6 &amp; 6.1</text>
    <text x="16" y="100" font-size="7.8" font-weight="700" fill="#1d4ed8">[Model Retirement]</text>
    <path d="M140 66 H158" stroke="#0f766e" stroke-width="1.7" marker-end="url(#pb1-arr)"/>
    <rect x="162" y="18" width="134" height="96" rx="6" fill="#fff7eb" stroke="#d97706" stroke-width="1.4"/>
    <text x="170" y="37" font-size="9.2" font-weight="700" fill="#92400e">2. Hidden Trap</text>
    <text x="170" y="53" font-size="8.2" fill="#334e68">Early timestamps or IDs</text>
    <text x="170" y="66" font-size="8.2" fill="#334e68">zero out prompt reuse</text>
    <text x="170" y="79" font-size="8.2" fill="#334e68">across stateless turns</text>
    <text x="170" y="100" font-size="7.8" font-weight="700" fill="#b45309">[2.56× PTU Spike]</text>
    <path d="M296 66 H314" stroke="#0f766e" stroke-width="1.7" marker-end="url(#pb1-arr)"/>
    <rect x="318" y="18" width="136" height="96" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="326" y="37" font-size="9.2" font-weight="700" fill="#183e62">3. Architecture Fix</text>
    <text x="326" y="53" font-size="8.2" fill="#334e68">Pos 1–6 stable prefix,</text>
    <text x="326" y="66" font-size="8.2" fill="#334e68">shard keys &amp; APIM 429</text>
    <text x="326" y="79" font-size="8.2" fill="#334e68">spillover to PAYG</text>
    <text x="326" y="100" font-size="7.8" font-weight="700" fill="#1d4ed8">[80%+ Cache Hit]</text>
    <path d="M454 66 H472" stroke="#0f766e" stroke-width="1.7" marker-end="url(#pb1-arr)"/>
    <rect x="476" y="18" width="132" height="96" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="484" y="37" font-size="9.2" font-weight="700" fill="#183e62">4. Automated Gates</text>
    <text x="484" y="53" font-size="8.2" fill="#334e68">pcr_lint.py AST scan,</text>
    <text x="484" y="66" font-size="8.2" fill="#334e68">2-pass evals &amp; KQL</text>
    <text x="484" y="79" font-size="8.2" fill="#334e68">release verification</text>
    <text x="484" y="100" font-size="7.8" font-weight="700" fill="#1d4ed8">[C1–C15 Standard]</text>
    <path d="M608 66 H626" stroke="#0f766e" stroke-width="1.7" marker-end="url(#pb1-arr)"/>
    <rect x="630" y="18" width="122" height="96" rx="6" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.5"/>
    <text x="638" y="37" font-size="9.2" font-weight="700" fill="#115e59">5. Proven Result</text>
    <text x="638" y="53" font-size="8.2" fill="#334e68">2.56× spike avoided</text>
    <text x="638" y="66" font-size="8.2" fill="#334e68">&amp; 71% seasonal</text>
    <text x="638" y="79" font-size="8.2" fill="#334e68">TCO saved</text>
    <text x="638" y="100" font-size="7.8" font-weight="700" fill="#0f766e">[Cutover Ready]</text>
    <text x="10" y="140" font-size="8.4" fill="#526c80">Customer-Zero validated path from model-upgrade risk to governed production cutover.</text>
  </svg>
</div>

| Practical Workflow | Where to Start |
| :--- | :--- |
| **1. Qualify a Workload in 30 Minutes** — Score retiring models, stateless turn hydration, PTU vs. PAYG mix, `>15 RPM` concurrency, and client-isolation requirements. | [3-Week Delivery Scope & Intake Scorecard](/operating-model/delivery-scoping) · [Hub Visual Overview](/) |
| **2. Run an Architecture Design Session (ADS)** — Walk through prefix ordering, right-sized PTU math, APIM spillover, or ethical-wall isolation. | [04 · PTU Calculator](../qualify/04-ptu-sizing-math) · [07 · Prefix Order](../design/07-prefix-taxonomy) · [10 · APIM Spillover](../design/10-apim-spillover) · [Regulated Profile](../profiles/regulated-multi-engagement) |
| **3. Drop Executable Gates into CI/CD** — Wire zero-dependency static linting, 2-pass cache assertions, App Insights KQL alerts, and the PR cutover checklist. | [`pcr_lint.py` & KQL Kits](/papers/engineering-kits) · [`C1–C15` PR Checklist](/papers/migration-readiness-checklist) · [Printable White Paper](/papers/foundry-prompt-caching-gpt56-whitepaper) |

---

## Technical Deep Dive: Architectural Conclusions & Mechanics

::: info Four Architectural Conclusions
1. **Prompt caching remains active on GPT-5.6+**, but introduces an explicit control surface (`prompt_cache_key`, `prompt_cache_options`, `prompt_cache_breakpoint`), TTL-tiered cache-write billing, and a default `reasoning.context = "all_turns"` setting on GPT-5.6 and GPT-6 that amplifies multi-turn token volume <span class="ev-badge ev-m">[M]</span>.
2. **Deployment SKU dictates available controls:** Explicit breakpoints work on **Standard 5.6+** and **PTU-M GPT-6+**, whereas **GPT-5.6 on PTU-M does not support breakpoints** and relies on strict prefix ordering + `prompt_cache_key` <span class="ev-badge ev-m">[M]</span>.
3. **In a stateless web backend (Model 2), Azure KV caching is the only cross-turn hydration cache:** Dynamic fields injected early by middleware (e.g., live timestamps or user IDs) silently zero out cache hits.
4. **Caching readiness belongs inside the 7-layer quality gate** alongside accuracy and safety checks so model-retirement waves never degrade production capacity or latency.
:::

## Core Engineering Questions for GPT-5.6, GPT-6 & GPT-6.1 Migrations

| Architectural Question | Verified Engineering Answer & Design Implication | Where Covered |
| :--- | :--- | :--- |
| **Does implicit (automatic) caching continue to apply on GPT-5.6+, or is explicit configuration required?** | `implicit` mode remains default <span class="ev-badge ev-m">[M]</span>, but GPT-5.6+ bills for cache writes, defaults `reasoning.context` to `all_turns` (on 5.6 and 6), and relies on key-assisted routing. Unstructured prompts suffer misses and paid writes; always set `prompt_cache_key` and enforce static-first prefix ordering. | [03 · KV Mechanics](./03-kv-mechanics), [09 · Wire Controls](../design/09-wire-controls) |
| **How should prompts be structured when tools, instructions, and retrieved context coexist?** | Align prompt assembly with a **Scope × Volatility taxonomy** <span class="ev-badge ev-arch">[Arch]</span>: (1) `response_format` + `T0` system/skill definitions, (2) sorted `tools[]`, (3) static domain methodology, (4) `L2` workspace/case card, (5) `L1` persona + append-only history, (6) live RAG/MCP & timestamps last. | [02 · Stateless Agents](./02-stateless-agents), [07 · Prefix Order](../design/07-prefix-taxonomy) |
| **How do explicit cache breakpoints work, and where should they be placed?** | `prompt_cache_breakpoint: {"mode":"explicit"}` marks the end of a reusable prefix (`>=1,024` tokens) <span class="ev-badge ev-m">[M]</span>. Supported on Standard 5.6+ and PTU-M GPT-6+, **not on GPT-5.6 PTU-M**. Place Breakpoint #1 after `T0` static instructions/tools and Breakpoint #2 after the `L2` workspace card. | [04 · PTU Math](../qualify/04-ptu-sizing-math), [07 · Prefix Order](../design/07-prefix-taxonomy) |
| **How do cache hits and misses affect PTU sizing and TPM rate limits?** | On pre-GPT-6 PTU-M (incl. GPT-5.6), cached tokens consume **0% PTU capacity**; on GPT-6/6.1 PTU-M, cached reads weigh `0.1x` / `0.05x` vs. `1.25x` for writes <span class="ev-badge ev-m">[M]</span>. Dropping from 80% to 0% cache hits spikes deployed PTU draw by **2.56×** (`170 → 435 PTUs` at the 5-PTU increment; `2.60×` raw TPM). | [04 · PTU Math](../qualify/04-ptu-sizing-math), [06 · Break-Even](../qualify/06-breakeven-economics) |
| **How can platform governance automatically prevent un-cached code from promoting?** | Adopt `PCR001–PCR006` static AST/regex lint rules in Layer 1 CI, a 2-pass DeepEval cache contract assertion in Layer 2 Prompt Evals, and two-regime App Insights KQL gates in Layer 7 Observability. | [11 · 7-Layer Gates](../validate/11-seven-layer-gates), [12 · Linter & Eval](../validate/12-ci-lint-deepeval), [13 · KQL Gate](../govern/13-otel-kql-gate) |

## Why Model Migration Readiness Should Be a Standing Discipline

Across enterprise AI portfolios, engineering teams face recurring model retirement waves—moving from `gpt-4.x`, `o3-mini`, or `gpt-5.4` onto `gpt-5.6`, `gpt-6`, and `gpt-6.1` while calibrating Provisioned Throughput (PTU-M) reservations against Standard PAYG spillover. Treating **prompt prefix architecture, two-regime PTU sizing, and 7-layer quality gates** as one standing engineering standard eliminates deadline-driven firefighting on every model transition.
