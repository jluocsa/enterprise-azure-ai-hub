---
title: "05 · Controlled 429 Fault Injection & G1–G12 Release Standard"
description: Pre-production verification protocol for testing APIM Retry-After circuit breakers, SSE streaming non-buffering, and the 12-point Gateway Readiness Standard (G1–G12).
---

# 05 · Controlled 429 Fault Injection & `G1–G12` Release Standard

<PlaybookMeta
  track="02 · Multi-Backend Foundry APIM AI Gateway & Governance"
  verified="2026-11-19 PST"
  status="Live v2.0"
  printable
/>

<PageBrief
  stage="validate"
  readTime="4 min read"
  problem="Unverified failover policies frequently fail in production due to missing RBAC roles on the secondary PAYG resource, buffered SSE streams, or snapshot version mismatches."
  takeaway="Execute the 4-step fault-injection protocol in staging and require all 12 G1–G12 gateway controls before routing production traffic."
  csaUse="Run Steps 1–4 during Week 2/3 staging sign-off and paste G1–G12 into the gateway infrastructure pull request."
/>

## 0. Offline Policy XML Preflight

APIM policy expressions use C# inside XML attributes or element text ([Microsoft Learn policy expression syntax](https://learn.microsoft.com/en-us/azure/api-management/api-management-policy-expressions)) <span class="ev-badge ev-m">[M]</span>. Encode embedded attribute quotes as `&quot;` and C# generic brackets as `&lt;` / `&gt;`; XML parsing restores the original expression.

Run `npm run verify` before staging: its `check:apim` gate parses both the downloadable policy and the built Studio's default copyable XML, rejecting malformed expressions, missing artifacts, and missing rendered policy output <span class="ev-badge ev-arch">[Arch]</span>. This checks XML well-formedness only, not APIM policy schema, C# compilation, alternate Studio settings, or live backend behavior; the staging probes below remain required <span class="ev-badge ev-val">[Validate]</span>.

## 1. Four-Step Staging Fault-Injection Protocol `[Validate]`

1. **Step 1 — Synthetic `429 Retry-After` Trip Test:** Temporarily route Priority-1 to a mock APIM endpoint (or minimal 15-PTU canary deployment under synthetic burst) returning `HTTP 429` with `Retry-After: 25`. Verify:
   - Call #1 transparently retries inside `<backend>` onto Priority-2 Standard PAYG and returns `HTTP 200` (`x-gateway-routed-sku: standard-spillover`).
   - Calls #2..N during the next `25s` route directly to Priority-2 in `<5ms` gateway overhead without hitting Priority-1.
   - After `25s`, traffic automatically heals back to Priority-1 PTU-M.
2. **Step 2 — Unbuffered SSE TTFT Parity Probe:** Send a 4,000-token `stream: true` request through APIM and directly to the VNet Foundry endpoint. Confirm gateway TTFT overhead is `<35ms` (if TTFT jumps to full completion time, an outbound body-inspection policy is buffering the stream).
3. **Step 3 — SKU Breakpoint Compatibility Check:** Send a payload containing `prompt_cache_breakpoint` and `prompt_cache_options` through a GPT-5.6 PTU-M route; confirm HTTP `200` and non-zero `cached_tokens` on Pass 2.
4. **Step 4 — FinOps Header & Cache-Key Isolation Probe:** Send 10 sequential calls with distinct `x-cost-center` values (`CC-1001`..`CC-1010`) but the same sharded `prompt_cache_key`. Confirm Pass 2–10 hit the prefix cache (`≥80%` hit rate) while all 10 `CostCenter` values appear in App Insights metrics.

---

## 2. The 12-Point AI Gateway Readiness Standard (`G1–G12`) `[Agree]`

| Gate ID | Category | Verification Requirement | Target Pass Bar |
| :--- | :--- | :--- | :--- |
| **`G1`** | Identity & Zero Keys | Upstream Foundry accounts enforce `disableLocalAuth: true`; APIM authenticates via Managed Identity (`Cognitive Services OpenAI User`) <span class="ev-badge ev-m">[M]</span>. | `100%` keyless upstream |
| **`G2`** | Caller Auth | Production callers authenticate to APIM via `<validate-azure-ad-token>` (Entra ID app roles) over private VNet / Private Link <span class="ev-badge ev-arch">[Arch]</span>. | Enforced in prod |
| **`G3`** | Spillover Pool | Native APIM Backend Pool pairs Priority-1 `PTU-M` with Priority-2 `Standard PAYG` inside the **same Data Zone / residency boundary** <span class="ev-badge ev-m">[M]</span>. | Configured in IaC |
| **`G4`** | Snapshot Parity | Priority-1 and Priority-2 deployments pin the **exact same model version snapshot** (e.g., `2026-09-29`). | Exact string match |
| **`G5`** | Circuit Breaker | Priority-1 backend configures `circuitBreaker` for `429` and `500–599` with `acceptRetryAfter: true` <span class="ev-badge ev-m">[M]</span>. | Verified via `429` injection |
| **`G6`** | SKU Payload Guard | Routes targeting `GPT-5.6 PTU-M` strip unsupported `prompt_cache_options` / `prompt_cache_breakpoint` while preserving `prompt_cache_key` <span class="ev-badge ev-m">[M]</span>. | Zero HTTP `400`s |
| **`G7`** | Cache Locality | Load balancing never randomly sprays a single low-RPM `prompt_cache_key` shard across multiple active-active accounts. | `≥80%` repeat hit rate |
| **`G8`** | Unbuffered SSE | Streaming routes set `buffer-response="false"` and exclude outbound body-reading policies <span class="ev-badge ev-m">[M]</span>. | `<35ms` gateway TTFT delta |
| **`G9`** | Timeout Alignment | `<forward-request timeout="...">` exceeds p99 reasoning completion latency (`≥120–180s`). | Zero premature `504`s |
| **`G10`** | Out-of-Band FinOps | `x-cost-center` / `x-practice-id` extracted into telemetry dimensions and stripped before upstream forwarding <span class="ev-badge ev-arch">[Arch]</span>. | Verified in App Insights |
| **`G11`** | Noisy-Neighbor Cap | `<azure-openai-token-limit>` enforces per-tenant / per-app TPM budgets below total pool exhaustion <span class="ev-badge ev-m">[M]</span>. | Policy active |
| **`G12`** | Spillover Alerting | Azure Monitor alert fires if Priority-2 Standard PAYG spillover exceeds `15%` of non-surge weekly traffic (signaling base PTU under-sizing) <span class="ev-badge ev-agree">[Agree]</span>. | Alert rule deployed |
