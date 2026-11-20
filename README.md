# Enterprise Azure AI — Solution Industrialization Hub

Live Hub: **<https://jluocsa.github.io/enterprise-azure-ai-hub/>**

A governed, multi-author architecture hub and interactive engineering workbench that converts **Customer-Zero** Microsoft Foundry and Azure AI production engagements into **repeatable reference playbooks, interactive sizing/BCP calculators, 3-week delivery scopes, and executable MIT release gates**.

Built with [VitePress](https://vitepress.dev/), styled with an executive Fluent 2 / Azure Architecture Center design system (adaptive Light & Dark mode), and enforced by an automated confidentiality sanitization gate (`scripts/check-sanitized.mjs`), zero-dependency CLI verification kits (`docs/public/kits/`), and print-ready Markdown white papers (`@media print`).

---

## Comprehensive Full-Stack Coverage

| Track / Asset | Scope & Production Layer | Key Deliverables |
| :--- | :--- | :--- |
| **[Operating Model & Factory](https://jluocsa.github.io/enterprise-azure-ai-hub/operating-model/industrialization-pipeline)** | 5-Stage Customer-Zero → Sanitization → Peer ARB → Tri-Path IP/PG/Playbook Disposition → 1:N Delivery | 4-tier evidence discipline (`[M]`, `[Arch]`, `[Agree]`, `[Validate]`) + 3-week engagement blueprint |
| **[Playbook 01 · Prompt Caching & PTU Economics](https://jluocsa.github.io/enterprise-azure-ai-hub/playbooks/prompt-caching/start/01-executive-thesis)** | Context assembly, prefix reuse, and two-regime PTU sizing across GPT-5.6, GPT-6 & GPT-6.1 (+ Regulated Profile) | 15 chapters, Ethical-Wall Posture A/B, `2.56×` spike prevention, `71%` seasonal TCO math |
| **[Playbook 02 · Multi-Backend Foundry APIM AI Gateway](https://jluocsa.github.io/enterprise-azure-ai-hub/playbooks/apim-gateway/01-executive-thesis)** | Enterprise GenAI gateway fronting `/openai/v1/responses` & `/chat/completions` across PTU-M and Standard pools | 6 chapters, `Retry-After` circuit breakers, SKU parameter stripping, SSE safety & FinOps OTel headers |
| **[Playbook 03 · Multi-Region Foundry BCP & Failover](https://jluocsa.github.io/enterprise-azure-ai-hub/playbooks/multi-region-bcp/01-executive-thesis)** | Regulated business continuity, Global vs. Data Zone vs. Regional residency, and stateful stamp failover | 6 chapters, cold-cache failover surge math, Cosmos/AI Search parity & Game-Day drill protocol |
| **[Playbook 04 · Agentic Harness, Foundry IQ RAG & Evals](https://jluocsa.github.io/enterprise-azure-ai-hub/playbooks/agentic-rag-evals/01-executive-thesis)** | 3-tier sandboxed agent runtimes (ACA Dynamic Sessions), grounded RAG, and 7-layer deterministic release gates | 6 chapters, AG-UI SSE isolation, Content Understanding ingestion, `gen_ai.*` OTel & contract gates |
| **[Interactive Decision Studio](https://jluocsa.github.io/enterprise-azure-ai-hub/studio/)** | Live client-side calculators and policy generators for architecture design sessions | Two-Regime PTU/TCO Simulator, 30-Min Multi-Track Triage, BCP Residency Advisor & APIM XML Builder |
| **[White Papers & MIT Engineering Kits](https://jluocsa.github.io/enterprise-azure-ai-hub/papers/)** | Printable executive papers (`@media print`) + copy/download-ready CI, gateway & telemetry kits | `pcr_lint.py`, `agent_release_gate.py`, `apim-foundry-spillover-policy.xml`, and 2 KQL workbooks |

---

## Repository Structure

```text
enterprise-azure-ai-hub/
├─ docs/
│  ├─ .vitepress/
│  │  ├─ config.mts                      # Navigation, path-scoped sidebars, SEO/OG & local search
│  │  └─ theme/                          # Fluent 2 / Foundry design system & interactive Vue tools
│  ├─ operating-model/                   # 5-stage factory, governance & 3-week delivery scope
│  ├─ playbooks/
│  │  ├─ index.md                        # Unified 4-Playbook Architecture Catalog
│  │  ├─ prompt-caching/                 # Playbook 01 (15 chapters + Regulated Profile + Sources)
│  │  ├─ apim-gateway/                   # Playbook 02 (6 chapters: APIM Pools, Spillover & FinOps)
│  │  ├─ multi-region-bcp/               # Playbook 03 (6 chapters: Residency, Stamp DR & Game-Days)
│  │  └─ agentic-rag-evals/              # Playbook 04 (6 chapters: ACA Sandbox, Foundry IQ & 7-Layer Evals)
│  ├─ studio/                            # Interactive 4-Tool Engineering Decision Studio
│  ├─ papers/                            # Printable executive white papers, kits & PR checklists
│  └─ public/
│     ├─ favicon.svg / og-card.png       # Custom brand identity & OpenGraph social card
│     └─ kits/                           # 5 runnable Python, APIM XML & KQL release-gate kits
├─ scripts/
│  ├─ check-sanitized.mjs                # Automated confidentiality, GUID, email & lockfile gate
│  └─ deploy-gh-pages.mjs                # Runs verify suite & publishes static build to gh-pages
├─ CONTRIBUTING.md                       # Multi-author workflow & 3-gate pre-publication checklist
└─ .github/
   ├─ CODEOWNERS                         # Per-track review ownership
   ├─ pull_request_template.md           # Sanitization, ARB & IP disposition attestation
   └─ workflows/deploy.yml               # Sanitization -> Kit smoke tests -> VitePress build -> Pages
```

## Local Development & Verification

```bash
npm install
npm run verify            # Gate 1 (Sanitization) + Gate 2 (Kit CLI tests) + Gate 3 (VitePress build)
npm run docs:dev          # Launch local VitePress dev server with hot reload
npm run deploy:pages      # Run full verification and publish static site to origin/gh-pages
```

## Continuous Dual-Agent Improvement & Auto-Review Loop

This repository includes a continuous, self-governing **Dual-Agent Industrialization Loop** (`scripts/auto-improve-daemon.mjs` + `.github/agents/`) managed by a macOS `LaunchAgent` (`com.jluocsa.enterprise-azure-ai-hub.auto-improve`):

1. **Author Agent (`hub-improver`):** Works in an isolated Git worktree on `improve/auto-YYYYMMDD-HHMM` (with hard `--deny-tool` blocks on `git push`, `gh`, and protected governance scripts), implements one surgical improvement, verifies `npm run verify`, and opens a Draft PR.
2. **Independent ARB Reviewer Agent (`hub-arb-reviewer`):** Runs in strict read-only mode (`view`, `grep`, `glob` only) after outer deterministic gates pass (`check:sanitized` + `check:kits` + `docs:build` + protected-path verification). Emits a structured `<arb_verdict>` JSON scorecard; when approved, posts the review on the PR, marks it ready, squash-merges to `main`, and publishes the updated static site to `gh-pages`.

```bash
npm run agent:install     # Install & start background macOS LaunchAgent (KeepAlive=true at login)
npm run agent:status      # Inspect live PID, cycle count, merged PRs, and next scheduled run
npm run agent:logs        # View recent daemon & ARB review logs
npm run agent:review      # Run Phase A only (review, approve, merge & publish open auto PRs)
npm run agent:once        # Run one complete review + improve + review/publish cycle manually
npm run agent:pause       # Pause continuous loop safely between cycles
npm run agent:resume      # Resume continuous loop
npm run agent:uninstall   # Stop and remove the macOS LaunchAgent
```


> **Disclaimer:** Community architecture guidance grounded in public [Microsoft Learn](https://learn.microsoft.com/en-us/azure/foundry/) documentation. Personal and community views of the contributors; not official Microsoft product documentation or contractual SLA guidance.
