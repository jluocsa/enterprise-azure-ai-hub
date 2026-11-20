---
title: "5 Executable MIT Engineering Kits · Linter, APIM XML, Contract CLI & KQL Gates"
description: "Copy-ready and downloadable MIT-licensed automation kits across Playbooks 01–04: pcr_lint.py, ptu-cache-release-gate.kql, apim-foundry-spillover-policy.xml, bcp-failover-readiness-gate.kql, and agent_release_gate.py."
---

<script setup>
import { withBase } from 'vitepress'
</script>

# 5 Executable MIT Engineering Kits

<PageBrief
  stepLabel="EXECUTABLE MIT KITS · PLAYBOOKS 01–04"
  readTime="3 min setup"
  problem="Translating architecture documents into working CI linters, APIM XML policies, and Log Analytics KQL queries manually delays every engagement."
  takeaway="All five kits below are rendered live from docs/public/kits/, zero-dependency, sanitized, and MIT-licensed for immediate repository drop-in."
  csaUse="Use 1-click copy on any code block or click the raw download link to commit directly into CI/CD, Bicep/APIM, and Azure Monitor."
/>

---

## 1. `PCR001–PCR006` Static Prefix CI Linter (`pcr_lint.py`) {#pcr-linter}

Zero-dependency Python 3 AST + regex scanner checking Python, TypeScript, JavaScript, and C# codebases for missing/high-cardinality `prompt_cache_key` (`PCR001`), Pos-1 timestamps (`PCR002`), unsorted `json.dumps` schemas (`PCR003`), early RAG chunks (`PCR004`), unsupported GPT-5.6 PTU-M breakpoints (`PCR005`), and missing `cached_tokens` telemetry (`PCR006`).

Scan-integrity failures (`PCR000`) return exit code `1` rather than a false-green result: missing/inaccessible targets, unsupported explicit file types, empty/excluded-only directories, unreadable/non-UTF-8 sources, and Python parse errors. Run `python pcr_lint.py --self-test` to exercise these failure paths and the six readiness rules; `--json` preserves structured findings for CI <span class="ev-badge ev-arch">[Arch]</span>.

Raw download: <a :href="withBase('/kits/pcr_lint.py')" download target="_blank" rel="noopener"><strong><code>Download pcr_lint.py</code></strong></a>

<<< @/public/kits/pcr_lint.py{python}

---

## 2. Two-Regime PTU & Cache SLO Gate (`ptu-cache-release-gate.kql`) {#kql-release-gate}

Computes deployment-wide coincident `DeployPeakNormTPM` alongside per-node, per-shard `HitRatePct`, `CachedSharePct`, `ReadWriteRatio`, and `GateStatus` across pre-GPT-6 (`5.6`) and `GPT-6 / 6.1` normalized token weights.

Raw download: <a :href="withBase('/kits/ptu-cache-release-gate.kql')" download target="_blank" rel="noopener"><strong><code>Download ptu-cache-release-gate.kql</code></strong></a>

<<< @/public/kits/ptu-cache-release-gate.kql{kusto}

---

## 3. SKU-Aware APIM Spillover & FinOps Policy (`apim-foundry-spillover-policy.xml`) {#apim-policy}

Production Azure API Management policy XML enforcing Managed Identity bearer auth, out-of-band `x-cost-center` FinOps telemetry extraction & header stripping, GPT-5.6 PTU-M breakpoint stripping, `429`/`503` `Retry-After` spillover to Standard PAYG, and `buffer-response="false"` unbuffered SSE streaming.

Raw download: <a :href="withBase('/kits/apim-foundry-spillover-policy.xml')" download target="_blank" rel="noopener"><strong><code>Download apim-foundry-spillover-policy.xml</code></strong></a>

<<< @/public/kits/apim-foundry-spillover-policy.xml{xml}

---

## 4. Multi-Region BCP & Cold-Cache Surge Gate (`bcp-failover-readiness-gate.kql`) {#bcp-kql}

Audits multi-region stamp traffic distribution, model snapshot drift (`DistinctSnapshots`), `ColdCacheSurgeRatio` during regional cutovers, and zero escaped `429`/`5xx` errors during Game-Day drills.

Raw download: <a :href="withBase('/kits/bcp-failover-readiness-gate.kql')" download target="_blank" rel="noopener"><strong><code>Download bcp-failover-readiness-gate.kql</code></strong></a>

<<< @/public/kits/bcp-failover-readiness-gate.kql{kusto}

---

## 5. Deterministic Agent Release Contract CLI (`agent_release_gate.py`) {#agent-gate}

Zero-dependency Python 3 CLI (`ARG001–ARG007`) verifying offline `trace.jsonl` evaluation runs against CLI flags or a JSON acceptance contract exported from the [Interactive Sandbox & Eval Contract Builder](/studio/#agent-eval)—checking schema integrity (`ARG001`), required/forbidden tool governance (`ARG002`), `100%` resolved `[cite:ID]` grounding (`ARG003`), Pass-2 `cached_tokens >= 1,024` parity (`ARG004`), p95 latency budgets (`ARG005`), Foundry IQ ACL security trimming (`ARG006`), and metadata-only OTel privacy (`ARG007`).

```bash
python3 agent_release_gate.py --self-test
python3 agent_release_gate.py ./artifacts/trace.jsonl --contract ./agent-release-contract.json
```

Raw download: <a :href="withBase('/kits/agent_release_gate.py')" download target="_blank" rel="noopener"><strong><code>Download agent_release_gate.py</code></strong></a>

<<< @/public/kits/agent_release_gate.py{python}
