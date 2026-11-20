---
title: 14 · 15-Point Migration Readiness Standard (C1–C15)
description: Recommended 15-point production readiness standard mapped across the 7-layer quality pipeline and 4-stage governance lifecycle.
---

# 14 · 15-Point Migration Readiness Standard (`C1–C15`)

<PageBrief
  stage="govern"
  readTime="3 min read"
  problem="Model cutover reviews stall without a single objective go/no-go checklist tying architecture, testing, and capacity sizing together."
  takeaway="Adopt C1–C15 as your standing release gate—mapping every architecture, CI lint, load-test, and PTU sizing check to concrete evidence."
  csaUse="Use this page (or the printable PR template) during Week 3 cutover verification before promoting to production."
/>

Open the copy-ready PR / release-gate template subpage: [`C1–C15` Migration Readiness PR Checklist →](/papers/migration-readiness-checklist)

Adopt criteria **`C1`–`C15`** as a standing release gate across the 7-layer pipeline before cutting over any production agent workload to **GPT-5.6, GPT-6, or GPT-6.1** <span class="ev-badge ev-agree">[Agree]</span>:

| # | Scope | Recommended Readiness Criterion | Target Evidence | Quality Layer |
| :--- | :--- | :--- | :--- | :--- |
| **C1** | `ALL` | Every prompt family / agent node has a documented stable prefix boundary (`>=1,024` tokens) mapped to Pos 1–6. | Prompt design spec | Architecture |
| **C2** | `ALL` | Pos 1–3 system instructions and `response_format` schemas contain zero timestamps, user IDs, or request GUIDs. | CI lint (`PCR002`) | Layer 1 (Unit/CI) |
| **C3** | `ALL` | Tool definitions (`tools[]`) are sorted by name and serialized with canonical JSON key ordering (`sort_keys=True`). | Unit test (`PCR003`) | Layer 1 (Unit/CI) |
| **C4** | `ALL` | Dynamic content (retrieved search/vector chunks, live MCP data, user query) is placed at Pos 6 (tail). | CI lint (`PCR004`) | Layer 1 (Unit/CI) |
| **C5** | `ALL` | Multi-turn checkpointed conversation history is strictly append-only within a session window. | Session replay test | Layer 3 (Integ) |
| **C6** | `ALL` | `prompt_cache_key` is set on every GPT-5.6+ call, encodes `{app}:{node}:{ver}`, and excludes per-user/request GUIDs. | CI lint (`PCR001`) | Layer 1 (Unit/CI) |
| **C7** | `ALL` | Deterministic key sharding (`0..N-1` where `N = ceil(RPM / 12)`) is implemented for nodes exceeding `~15 RPM` per prefix. | Shard load test (`PCR001`) | Layer 5 (Load) |
| **C8** | `STD / 6+` | Explicit cache breakpoints (`prompt_cache_breakpoint`) placed after Pos 3 (`>=1,024t`) and optionally Pos 4; max 4 writes respected. | Wire sample (`PCR005`) | Layer 1 (Unit/CI) |
| **C9** | `PTU 5.6` | Workloads targeting GPT-5.6 PTU-M omit unsupported breakpoint fields and rely on deterministic prefix ordering + key. | SKU adapter config | Layer 3 (Integ) |
| **C10** | `ALL` | `prompt_cache_options.ttl` (`30m` vs `12h`), `reasoning.context` (`current_turn` vs `all_turns`), and removal of `prompt_cache_retention` verified; `R/W >=10:1`. | Validation report (`PCR005`) | Layer 2 (Eval) |
| **C11** | `ALL` | `cached_tokens`, `cache_write_tokens`, `prompt_cache_key`, and TTFT are emitted via OTel to App Insights (metadata-only). | KQL span check (`PCR006`) | Layer 7 (OTel) |
| **C12** | `ALL` | Layer 2 DeepEval golden set (50–200 cases) run before and after migration; hit rate (`>=80%`), cached share (`>=60%`), TTFT, and quality pass. | 2-pass DeepEval report | Layer 2 (Eval) |
| **C13** | `ALL` | Layer 5 peak load test completed with zero cache degradation and zero unexpected HTTP `429`s at target concurrency. | Concurrency report | Layer 5 (Load) |
| **C14** | `ALL` | PTU / TPM capacity sizing updated using measured `DeployPeakNormTPM` hit rate and Chapter 04 model-specific PTU formulas. | Right-sized PTU model | Capacity Sizing |
| **C15** | `ALL` | All validation and sizing artifacts recorded in the Model Migration Readiness Record for production release sign-off. | Readiness record | Release Gate |

*Scope legend:* `ALL` = all GPT-5.6+ deployments; `STD / 6+` = Standard 5.6+ and PTU-M GPT-6+; `PTU 5.6` = Provisioned Throughput on GPT-5.6. For regulated audit, tax, legal, and compliance workpapers, augment `C12` and `C15` with the four **Workpaper Defensibility Controls (`C-WP1–C-WP4`)** in [Regulated Multi-Engagement & Compliance Platforms](/playbooks/prompt-caching/profiles/regulated-multi-engagement#4-workpaper-grade-reproducibility-across-model-retirements).

## Four-Stage Standing Governance Lifecycle `[Arch]`

<div class="arch-diagram">
  <svg viewBox="0 0 760 132" role="img" aria-labelledby="gov4-title gov4-desc" font-family="Segoe UI, Inter, -apple-system, sans-serif">
    <title id="gov4-title">Four-Stage Standing Model Readiness Governance Loop</title>
    <desc id="gov4-desc">Shows Stage I Design and Lint, Stage II Shadow 2-Pass Eval, Stage III 30-Day PTU Calibration, and Stage IV Continuous OTel/KQL Drift Assurance.</desc>
    <defs><marker id="gov4-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#0f766e"/></marker></defs>
    <rect x="8" y="14" width="168" height="82" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="16" y="33" font-size="9.1" font-weight="700" fill="#183e62">Stage I · Design &amp; Lint</text>
    <text x="16" y="49" font-size="8.2" fill="#334e68">Map Pos 1–6 boundaries</text>
    <text x="16" y="62" font-size="8.2" fill="#334e68">&amp; enforce PCR001–006</text>
    <text x="16" y="82" font-size="7.8" font-weight="700" fill="#1d4ed8">[C1–C4, C6, C8–C9]</text>
    <path d="M176 55 H198" stroke="#0f766e" stroke-width="1.7" marker-end="url(#gov4-arr)"/>
    <rect x="202" y="14" width="168" height="82" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="210" y="33" font-size="9.1" font-weight="700" fill="#183e62">Stage II · Shadow Eval</text>
    <text x="210" y="49" font-size="8.2" fill="#334e68">Run 2-pass golden set</text>
    <text x="210" y="62" font-size="8.2" fill="#334e68">(Hit &ge;80%, R/W &ge;10:1)</text>
    <text x="210" y="82" font-size="7.8" font-weight="700" fill="#1d4ed8">[C5, C10, C12]</text>
    <path d="M370 55 H392" stroke="#0f766e" stroke-width="1.7" marker-end="url(#gov4-arr)"/>
    <rect x="396" y="14" width="170" height="82" rx="6" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.4"/>
    <text x="404" y="33" font-size="9.1" font-weight="700" fill="#115e59">Stage III · PTU Sizing</text>
    <text x="404" y="49" font-size="8.2" fill="#334e68">Load-test shards &amp; right-</text>
    <text x="404" y="62" font-size="8.2" fill="#334e68">size PTU + PAYG spillover</text>
    <text x="404" y="82" font-size="7.8" font-weight="700" fill="#0f766e">[C7, C13–C15]</text>
    <path d="M566 55 H588" stroke="#0f766e" stroke-width="1.7" marker-end="url(#gov4-arr)"/>
    <rect x="592" y="14" width="160" height="82" rx="6" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.5"/>
    <text x="600" y="33" font-size="9.1" font-weight="700" fill="#115e59">Stage IV · Drift Guard</text>
    <text x="600" y="49" font-size="8.2" fill="#334e68">Continuous OTel &amp; KQL</text>
    <text x="600" y="62" font-size="8.2" fill="#334e68">alerts across snapshots</text>
    <text x="600" y="82" font-size="7.8" font-weight="700" fill="#0f766e">[C11 · Always On]</text>
    <text x="10" y="118" font-size="8.4" fill="#526c80">Turns model retirement waves from emergency fire-drills into a routine 4-stage engineering check.</text>
  </svg>
</div>

1. **Stage I — Design & Lint:** Map every prompt family to Pos 1–6 and enforce `PCR001–006` in PR CI.
2. **Stage II — Shadow Eval:** Execute the 2-pass DeepEval quality + cache contract suite on candidate models.
3. **Stage III — Capacity Calibration:** Right-size base PTUs from 30-day sustained usage, empirical `PeakNormTPM`, and measured hit rates, paired with APIM Standard spillover.
4. **Stage IV — Continuous Assurance:** Monitor Layer 7 OTel/KQL drift alerts across model snapshot updates.
