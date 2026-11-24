---
title: White Papers & Executable MIT Engineering Kits
description: Print-ready executive white papers, 7 copy-and-download MIT engineering kits (Python AST linter, Agent Contract CLI, Data Readiness CLI, APIM Spillover XML, and 3 App Insights KQL gates), and 64-point PR readiness checklists.
---

<script setup>
import { withBase } from 'vitepress'
</script>

# White Papers & Executable MIT Engineering Kits

<PageBrief
  stepLabel="DELIVERABLES & MIT KITS"
  readTime="3 min read"
  problem="Enterprise rollouts need both print-ready executive architecture papers for review boards and drop-in CI/gateway/KQL code for repositories."
  takeaway="Every live track ships synchronized Markdown white papers (@media print Save-as-PDF), 7 MIT-licensed automation kits, and 64 PR cutover gates."
  csaUse="Select any deliverable below—Print / Save as PDF for ARB/CISO sign-off, or 1-click copy/download scripts straight into CI/CD and Azure."
/>

<div class="arch-diagram">
  <svg viewBox="0 0 760 134" role="img" aria-labelledby="kits-map-title kits-map-desc" font-family="Segoe UI, Inter, -apple-system, sans-serif">
    <title id="kits-map-title">Four Deliverable Categories Across the Hub</title>
    <desc id="kits-map-desc">Shows 1 Executive White Papers, 2 Repository CI Linters and Contract Verifiers, 3 APIM Gateway XML Policies and 3 App Insights KQL Gates, and 4 64-Point PR Checklists.</desc>
    <rect x="8" y="12" width="178" height="86" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="16" y="31" font-size="9.1" font-weight="700" fill="#183e62">1. Executive Papers</text>
    <text x="16" y="47" font-size="8.1" fill="#334e68">Full-Stack Blueprint &amp;</text>
    <text x="16" y="60" font-size="8.1" fill="#334e68">GPT-5.6+ Caching Paper</text>
    <text x="16" y="81" font-size="7.8" font-weight="700" fill="#1d4ed8">[1-Click Save as PDF]</text>
    <rect x="196" y="12" width="178" height="86" rx="6" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.4"/>
    <text x="204" y="31" font-size="9.1" font-weight="700" fill="#115e59">2. Repository CI Gates</text>
    <text x="204" y="47" font-size="8.1" fill="#334e68">pcr_lint + agent_release</text>
    <text x="204" y="60" font-size="8.1" fill="#334e68">+ data_readiness CLIs</text>
    <text x="204" y="81" font-size="7.8" font-weight="700" fill="#0f766e">[Zero-Dep MIT Python]</text>
    <rect x="384" y="12" width="178" height="86" rx="6" fill="#f5f3ff" stroke="#7c3aed" stroke-width="1.4"/>
    <text x="392" y="31" font-size="9.1" font-weight="700" fill="#5b21b6">3. Gateway &amp; Telemetry</text>
    <text x="392" y="47" font-size="8.1" fill="#334e68">APIM Spillover XML +</text>
    <text x="392" y="60" font-size="8.1" fill="#334e68">3 App Insights KQL Gates</text>
    <text x="392" y="81" font-size="7.8" font-weight="700" fill="#6d28d9">[Drop-In Azure Kits]</text>
    <rect x="572" y="12" width="180" height="86" rx="6" fill="#fff7eb" stroke="#d97706" stroke-width="1.4"/>
    <text x="580" y="31" font-size="9.1" font-weight="700" fill="#92400e">4. Cutover Sign-Off</text>
    <text x="580" y="47" font-size="8.1" fill="#92400e">64-Point PR &amp; Release</text>
    <text x="580" y="60" font-size="8.1" fill="#92400e">Checklists (C/G/B/A/D)</text>
    <text x="580" y="81" font-size="7.8" font-weight="700" fill="#b45309">[Copy-Paste Markdown]</text>
    <text x="10" y="118" font-size="8.3" fill="#526c80">All white papers and kits are source-controlled, searchable via ⌘K / Ctrl+K, and verified clean by npm run verify.</text>
  </svg>
</div>

---

## 1. Consolidated Architecture White Papers (Print / Save-as-PDF Editions)

| White Paper | Scope & Audience | Reader Link |
| :--- | :--- | :--- |
| **Full-Stack Enterprise Microsoft Foundry Platform Blueprint (`v2.0`)** | Executive & ARB synthesis uniting Playbooks 01–05: Two-Regime Prompt Caching & PTU Sizing, Multi-Backend APIM AI Gateway, Multi-Region BCP & Cold-Cache Surges, 3-Tier ACA Sandboxed Agentic RAG + Deterministic Evals, and AI Data Strategy (Fabric IQ, Purview DSPM & Cosmos Hybrid). | **[Read & Print Full-Stack Blueprint →](/papers/enterprise-foundry-platform-blueprint)** |
| **Model Migration Readiness: Prompt Caching on GPT-5.6, GPT-6 & GPT-6.1 (`v1.0`)** | Deep-dive single-page white paper covering Model 2 stateless hydration, Standard vs. PTU-M breakpoint boundaries, `Scope × Volatility` Pos 1–6 ordering, break-even math, `PCR001–006`, and `C1–C15`. | **[Read & Print Caching White Paper →](/papers/foundry-prompt-caching-gpt56-whitepaper)** |

---

## 2. Seven Executable MIT Engineering Kits

| Kit File | Track | Purpose | Inline Preview | Raw Download |
| :--- | :--- | :--- | :--- | :--- |
| **`pcr_lint.py`** | Playbook 01 | Zero-dependency Python AST/regex CI linter (`PCR001–PCR006`) catching Pos-1 timestamps, unsorted `tools[]`, and invalid PTU breakpoints. | [Preview & Copy →](/papers/engineering-kits#pcr-linter) | <a :href="withBase('/kits/pcr_lint.py')" download target="_blank" rel="noopener"><code>pcr_lint.py</code></a> |
| **`ptu-cache-release-gate.kql`** | Playbook 01 | Two-regime Application Insights KQL computing `DeployPeakNormTPM` and per-shard cache SLOs across GPT-5.6 and GPT-6/6.1. | [Preview & Copy →](/papers/engineering-kits#kql-release-gate) | <a :href="withBase('/kits/ptu-cache-release-gate.kql')" download target="_blank" rel="noopener"><code>ptu-cache-release-gate.kql</code></a> |
| **`apim-foundry-spillover-policy.xml`** | Playbook 02 | Production APIM policy XML with Managed Identity, out-of-band `x-cost-center` FinOps, 5.6 breakpoint guard, 429 spillover, and unbuffered SSE. | [Preview & Copy →](/papers/engineering-kits#apim-policy) | <a :href="withBase('/kits/apim-foundry-spillover-policy.xml')" download target="_blank" rel="noopener"><code>apim-foundry-spillover-policy.xml</code></a> |
| **`bcp-failover-readiness-gate.kql`** | Playbook 03 | Multi-region stamp health, snapshot-drift detector, and cold-cache cutover surge KQL workbook query for Game-Day drills. | [Preview & Copy →](/papers/engineering-kits#bcp-kql) | <a :href="withBase('/kits/bcp-failover-readiness-gate.kql')" download target="_blank" rel="noopener"><code>bcp-failover-readiness-gate.kql</code></a> |
| **`agent_release_gate.py`** | Playbook 04 | Zero-dependency Python CLI (`ARG001–ARG007` + `--contract` JSON) verifying trace JSONL for resolved inline citations, tool allowlists, Pass-2 cache hits, p95 latency, ACL trimming, and OTel privacy. | [Preview & Copy →](/papers/engineering-kits#agent-gate) | <a :href="withBase('/kits/agent_release_gate.py')" download target="_blank" rel="noopener"><code>agent_release_gate.py</code></a> |
| **`data_readiness_gate.py`** | Playbook 05 | Zero-dependency Python CLI (`DRG001–DRG007` + `--contract` JSON) enforcing Fabric/OneLake lineage & F-SKU isolation, Purview DSPM labels, Entra ACL tombstoning SLA, Cosmos DB DiskANN+RRF partition scoping, AI Search aliases, and anti-poisoning hygiene. | [Preview & Copy →](/papers/engineering-kits#data-gate) | <a :href="withBase('/kits/data_readiness_gate.py')" download target="_blank" rel="noopener"><code>data_readiness_gate.py</code></a> |
| **`data-grounding-freshness-gate.kql`** | Playbook 05 | Azure Monitor KQL workbook auditing Purview label coverage, ACL revocation lag, Cosmos DB hybrid RU & `429` rates, Fabric CU throttling, and zero-grounding drift. | [Preview & Copy →](/papers/engineering-kits#data-kql) | <a :href="withBase('/kits/data-grounding-freshness-gate.kql')" download target="_blank" rel="noopener"><code>data-grounding-freshness-gate.kql</code></a> |

---

## 3. Unified 64-Point Production Cutover & PR Checklists

- **[Open Unified Readiness Checklists (`C1–C15`, `G1–G12`, `B1–B12`, `A1–A12`, `D1–D12`) →](/papers/migration-readiness-checklist)** — Copy-ready Markdown templates for `.github/pull_request_template.md` and Azure DevOps release gates.

## 4. Companion Open-Source Repositories

- **[`microsoft/waza`](https://github.com/microsoft/waza):** CLI and evaluation framework for creating, testing, and measuring agent skill quality and trigger/trajectory effectiveness.
- **[`sentinel-evals`](https://github.com/jluocsa/sentinel-evals):** Reproducible multi-turn LLM safety evaluation harness with baseline benchmarks.
- **[`agentic-rag-scanner`](https://github.com/jluocsa/agentic-rag-scanner):** Reference .NET / Azure workflow scanner for agentic RAG readiness and verification.
- **[`personal-assistant-agent-harness`](https://github.com/jluocsa/personal-assistant-agent-harness):** Reference 3-tier isolated agent harness (`Frontend + FastAPI Orchestrator + ACA Sandbox Session Container + Foundry IQ + Content Understanding`).
