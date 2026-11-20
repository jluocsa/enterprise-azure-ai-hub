---
title: "Unified 52-Point PR & Production Cutover Checklists"
description: Copy-ready Pull Request and Azure DevOps release sign-off templates across Playbook 01 (C1–C15 + C-WP1–C-WP4), Playbook 02 (G1–G12), Playbook 03 (B1–B12), and Playbook 04 (A1–A12).
---

# Unified Production Cutover & PR Checklists

<PlaybookMeta
  track="Release Governance · All 4 Live Playbooks"
  verified="2026-11-19 PST"
  status="Live v2.0"
  printable
/>

<PageBrief
  stepLabel="CUTOVER SIGN-OFF TEMPLATES · 52 CONTROLS"
  readTime="3 min read"
  problem="Ad-hoc launch reviews miss cross-service interactions between prefix caching, APIM spillover, regional residency, and agent sandboxing."
  takeaway="Paste the modular Markdown blocks below directly into .github/pull_request_template.md or Azure DevOps release gates."
  csaUse="Copy the combined checklist or only the track blocks matching your engagement scope."
/>

## 1. Playbook 01 · Prompt Caching, PTU & Regulated Profile (`C1–C15` + `C-WP1–C-WP4`)

```markdown
### Playbook 01 — Prompt Caching & Two-Regime PTU Readiness (C1–C15)
- [ ] C1: Pos 1–3 static T0 instructions, rubric, and response_format are byte-identical across turns
- [ ] C2: tools[] and JSON schemas serialized with canonical key sorting (sort_keys=True)
- [ ] C3: Live RAG chunks, MCP outputs, user IDs, and timestamps placed strictly at Pos 6
- [ ] C4: Deterministic prompt_cache_key set; sharded across N = ceil(Peak_RPM / 12) when >15 RPM
- [ ] C5: Prefixes <1,024 tokens omit explicit breakpoints / disable paid writes on 5.6+
- [ ] C6: SKU boundary respected (no explicit breakpoints sent to GPT-5.6 PTU-M)
- [ ] C7: reasoning.context explicitly pinned (current_turn vs all_turns) and budgeted
- [ ] C8: Two-regime PTU sizing verified (5.6 0% cached PTU draw vs 6/6.1 normalized weights)
- [ ] C9: Base PTU-M sized at <=65–70% p95 saturation with APIM Standard PAYG spillover
- [ ] C10: pcr_lint.py (PCR001–PCR006) exits 0 in PR CI
- [ ] C11: 2-pass golden eval confirms Pass-2 cached_tokens >= 1,024 & >=80% repeat hit rate
- [ ] C12: Steady-state Read/Write ratio >= 10:1 verified on GPT-5.6+
- [ ] C13: OTel spans emit input_tokens, output_tokens, cached_tokens (message content capture OFF)
- [ ] C14: ptu-cache-release-gate.kql deployed with alert thresholds in App Insights
- [ ] C15: Model snapshot date pinned identically across PTU-M and spillover deployments
- [ ] Regulated (if applicable — C-WP1..4): Ethical-wall Posture A/B verified, x-cost-center out-of-band, workpaper lineage SHA logged
```

---

## 2. Playbook 02 · Multi-Backend Foundry APIM AI Gateway (`G1–G12`)

```markdown
### Playbook 02 — Multi-Backend Foundry APIM AI Gateway (G1–G12)
- [ ] G1: Upstream Foundry resources set disableLocalAuth=true; APIM uses Managed Identity RBAC
- [ ] G2: Production callers authenticate via Entra ID JWT validation over Private Link / VNet
- [ ] G3: Native APIM Backend Pool pairs Priority-1 PTU-M with Priority-2 Standard PAYG
- [ ] G4: Identical model version snapshot pinned across Priority-1 and Priority-2 backends
- [ ] G5: Backend circuitBreaker trips on 429 and 500–599 with acceptRetryAfter=true
- [ ] G6: GPT-5.6 PTU-M routes strip prompt_cache_options & prompt_cache_breakpoint cleanly
- [ ] G7: Load balancing preserves per-shard prompt_cache_key locality (no random spray)
- [ ] G8: Streaming routes set buffer-response="false" with zero outbound body-buffering policies
- [ ] G9: forward-request timeout >= 120–180s to cover p99 reasoning latency
- [ ] G10: x-cost-center extracted to OTel token metric dimension and stripped before upstream
- [ ] G11: azure-openai-token-limit enforces per-subscription noisy-neighbor TPM ceilings
- [ ] G12: Azure Monitor alert fires when non-surge PAYG spillover exceeds 15% of weekly traffic
```

---

## 3. Playbook 03 · Multi-Region Foundry BCP & Residency (`B1–B12`)

```markdown
### Playbook 03 — Multi-Region Foundry BCP & Data Residency (B1–B12)
- [ ] B1: Residency symmetry enforced across Primary, Spillover, and DR stamps (DataZone / Regional)
- [ ] B2: Primary and Secondary Foundry deployments pin identical model version snapshots & filters
- [ ] B3: Secondary PAYG + PTU TPM quota >= 2.6x primary steady cached TPM (cold-cache surge buffer)
- [ ] B4: Zone redundancy (ZRS) enabled across APIM, Cosmos DB, ADLS Gen2, AI Search, and ACA
- [ ] B5: Multi-turn conversation state stored in multi-region Cosmos DB (Model 2 stateless tier)
- [ ] B6: Secondary Azure AI Search stamp indexes from RA-GZRS ADLS with <1% document count lag
- [ ] B7: Secondary ACA Session Pool deployed with matching immutable Git-SHA image tag
- [ ] B8: Secondary Managed Identities pre-assigned RBAC across Secondary Foundry, Search, Cosmos & ADLS
- [ ] B9: Automated APIM circuit-breaker regional cutover verified at <15s RTO
- [ ] B10: 5-minute lightweight synthetic health probe active on Secondary stamp
- [ ] B11: Workpaper / OTel lineage records actual executing stamp region & snapshot version
- [ ] B12: 30-minute Game-Day failover drill passed within the last 90 days (bcp-failover-readiness-gate.kql)
```

---

## 4. Playbook 04 · Sandboxed Agentic Harness, Foundry IQ RAG & Evals (`A1–A12`)

```markdown
### Playbook 04 — Sandboxed Agentic Harness, Foundry IQ RAG & Evals (A1–A12)
- [ ] A1: Orchestrator runs zero Agent SDK / shell code; execution isolated in ACA Dynamic Sessions
- [ ] A2: All container images built and deployed by immutable Git commit SHA (never :latest)
- [ ] A3: File uploads enforce allowlist, 50 MB streaming limit, and realpath workspace containment
- [ ] A4: Binary documents convert via ADLS Gen2 + Azure Content Understanding (fail-closed 503)
- [ ] A5: Foundry IQ (Azure AI Search MCP) enforces Managed Identity RBAC & ACL security trimming
- [ ] A6: Retrieved RAG chunks and dynamic turn metadata appended strictly at Pos 6
- [ ] A7: Unbuffered AG-UI SSE event pipeline enforces explicit per-turn timeout & terminal states
- [ ] A8: Modular skills pass automated trigger & trajectory evals (microsoft/waza or pytest)
- [ ] A9: Deterministic contract gate (agent_release_gate.py ARG001–007) blocks PRs on citation, ACL, OTel privacy, or cache-parity violations
- [ ] A10: Calibrated Foundry Evals (Groundedness, Relevance, TaskAdherence) within <=2% baseline delta
- [ ] A11: Indirect prompt-injection & cross-tenant red-team suite passes with 0 critical findings
- [ ] A12: End-to-end W3C traceparent gen_ai.* spans active with CAPTURE_MESSAGE_CONTENT=false
```
