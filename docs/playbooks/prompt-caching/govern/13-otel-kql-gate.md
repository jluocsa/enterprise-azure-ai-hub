---
title: 13 · OpenTelemetry Spans, Privacy & Two-Regime KQL Gate
description: Metadata-only OpenTelemetry span attributes, DCR privacy guardrails, and the two-regime Application Insights KQL release gate.
---

<script setup>
import { withBase } from 'vitepress'
</script>

# 13 · Observability, Privacy & Two-Regime KQL Release Gate

<PageBrief
  stage="govern"
  readTime="4 min read"
  problem="Privacy rules block raw prompt logging, while standard token dashboards miss per-shard cache hit rates and GPT-6 vs. GPT-5.6 PTU math."
  takeaway="Emit metadata-only OpenTelemetry counters (zero prompt text) and run the copy-ready KQL query below to track DeployPeakNormTPM and shard SLOs."
  csaUse="Run ptu-cache-release-gate.kql in Log Analytics during Week 3 to right-size PTU reservations from measured traffic."
/>

Production agent telemetry flows through OpenTelemetry into workspace-based Azure Monitor Application Insights and Log Analytics, anchored on the entry request span and correlated across internal agent nodes by `thread_id` <span class="ev-badge ev-arch">[Arch]</span>.

<div class="arch-diagram">
  <svg viewBox="0 0 760 136" role="img" aria-labelledby="otel-title otel-desc" font-family="Segoe UI, Inter, -apple-system, sans-serif">
    <title id="otel-title">Privacy-Safe OpenTelemetry to Application Insights KQL Pipeline</title>
    <desc id="otel-desc">Shows Agent Runtime emitting numeric token counters and cache keys (zero raw prompt text), Azure Monitor DCR masking, Log Analytics AppDependencies table, and Two-Regime KQL Gate computing DeployPeakNormTPM and GateStatus.</desc>
    <defs><marker id="otel-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#0f766e"/></marker></defs>
    <rect x="8" y="14" width="174" height="84" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="16" y="33" font-size="9.1" font-weight="700" fill="#183e62">1. Agent OTel Span</text>
    <text x="16" y="49" font-size="8.2" fill="#334e68">Numeric counters +</text>
    <text x="16" y="62" font-size="8.2" fill="#334e68">static prompt_cache_key</text>
    <text x="16" y="84" font-size="7.8" font-weight="700" fill="#1d4ed8">[Zero Raw Prompt Text]</text>
    <path d="M182 56 H204" stroke="#0f766e" stroke-width="1.7" marker-end="url(#otel-arr)"/>
    <rect x="208" y="14" width="166" height="84" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="216" y="33" font-size="9.1" font-weight="700" fill="#183e62">2. DCR Privacy Guard</text>
    <text x="216" y="49" font-size="8.2" fill="#334e68">Ingestion masking +</text>
    <text x="216" y="62" font-size="8.2" fill="#334e68">Log Analytics storage</text>
    <text x="216" y="84" font-size="7.8" font-weight="700" fill="#1d4ed8">[No Metric Cardinality]</text>
    <path d="M374 56 H396" stroke="#0f766e" stroke-width="1.7" marker-end="url(#otel-arr)"/>
    <rect x="400" y="14" width="176" height="84" rx="6" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.4"/>
    <text x="408" y="33" font-size="9.1" font-weight="700" fill="#115e59">3. Two-Regime KQL</text>
    <text x="408" y="49" font-size="8.2" fill="#334e68">Applies 5.6 vs. 6/6.1</text>
    <text x="408" y="62" font-size="8.2" fill="#334e68">weights per 1-min bin</text>
    <text x="408" y="84" font-size="7.8" font-weight="700" fill="#0f766e">[DeployPeakNormTPM]</text>
    <path d="M576 56 H598" stroke="#0f766e" stroke-width="1.7" marker-end="url(#otel-arr)"/>
    <rect x="602" y="14" width="150" height="84" rx="6" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.5"/>
    <text x="610" y="33" font-size="9.1" font-weight="700" fill="#115e59">4. Release &amp; Drift Alert</text>
    <text x="610" y="49" font-size="8.2" fill="#334e68">Hit &ge;80%, Share &ge;60%,</text>
    <text x="610" y="62" font-size="8.2" fill="#334e68">R/W &ge;10:1 &rarr; PASS</text>
    <text x="610" y="84" font-size="7.8" font-weight="700" fill="#0f766e">[Standing FinOps Gate]</text>
    <text x="10" y="122" font-size="8.4" fill="#526c80">Privacy-preserving telemetry: zero customer document content is required to govern cache efficiency and PTU capacity.</text>
  </svg>
</div>

## 1. Required Span Attributes & Privacy Guardrails `[Arch]`

| Span Attribute (`Properties`) | Example / Requirement | Governance Purpose |
| :--- | :--- | :--- |
| `gen_ai.request.model` & `azure.deployment.sku` | `gpt-5.6-terra`, `PTU-M` / `Standard` | Selects the correct PTU normalized-token formula (`pre-6` vs. `6` vs. `6.1`). |
| `gen_ai.prompt_cache.key` | `doc-review:summarizer:v12:shard-0` | Measures per-shard hit rate and detects `>15 RPM` shard saturation. |
| `gen_ai.usage.input_tokens` & `output_tokens` | Integer counters | Baseline prompt and generation volume. |
| `gen_ai.usage.cached_tokens` & `cache_write_tokens` | Integer counters (`0` when absent) | Computes hit rate, cached share, and read/write amortization ratio. |
| `gen_ai.latency.ttft_ms`, `thread_id`, `agent.node_name` | Numeric latency + correlation IDs | Correlates multi-node turns and tracks TTFT p95 gains. |
| `finops.practice` & `finops.cost_center` *(optional)* | Pseudonymized practice / cost-center tags | Allocates normalized PTU-M & Standard spillover tokens per engagement without polluting `prompt_cache_key` ([Profile](/playbooks/prompt-caching/profiles/regulated-multi-engagement#2-chargeback-vs-cache-key-separation-preventing-cardinality-collapse)). |

::: info Metadata-Only Telemetry & Cardinality Guardrails
- **Zero raw prompt logging by default:** Prompt-caching governance requires *only* numeric token counters and the static `prompt_cache_key`—never raw customer documents or prompt text.
- **DCR ingestion masking:** Keep Azure Monitor Data Collection Rule (DCR) transformations active to strip accidental PII.
- **Query Log Analytics, not custom metrics:** Aggregate per-key and per-node PTU utilization in KQL rather than custom metrics to avoid metric cardinality limits.
:::

## 2. Reference KQL Query: Two-Regime Peak-Minute PTU Sizing & Release Gate

Preview on [Copy-Ready Engineering Kits](/papers/engineering-kits#kql-release-gate) or download raw file: <a :href="withBase('/kits/ptu-cache-release-gate.kql')" download target="_blank" rel="noopener"><code>ptu-cache-release-gate.kql</code></a>

<<< @/public/kits/ptu-cache-release-gate.kql{kusto}

> **Why `DeployPeakNormTPM`, `ShardPeakNormTPM`, and `ShardAvgNormTPM` are separated:** `DeployPeakNormTPM` aggregates *all* calls hitting `(model_name, sku)` in the same 1-minute bucket—including `<1,024`-token routers and unkeyed calls—to size PTU headroom against HTTP `429` throttling, while `CacheCalls` evaluates per-shard cache efficiency (`HitRatePct`, `CachedSharePct`, `ReadWriteRatio`) and 24-hour sustained amortization (`ShardAvgNormTPM`).
