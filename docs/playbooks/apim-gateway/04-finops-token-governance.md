---
title: "04 · Out-of-Band FinOps Chargeback & Token Governance"
description: Decoupling internal cost-center chargeback from prompt_cache_key cardinality while enforcing per-tenant TPM quotas and OpenTelemetry token metrics in Azure API Management.
---

# 04 · Out-of-Band FinOps Chargeback & Token Governance

<PlaybookMeta
  track="02 · Multi-Backend Foundry APIM AI Gateway & Governance"
  verified="2026-11-19 PST"
  status="Live v2.0"
/>

<PageBrief
  stage="govern"
  readTime="4 min read"
  problem="Embedding engagement_id or cost_center inside prompts or prompt_cache_key destroys cross-engagement T0 cache reuse, yet FinOps teams still require exact per-department token chargeback."
  takeaway="Carry chargeback metadata strictly in HTTP headers (x-cost-center / Entra JWT claims), emit dimensions via azure-openai-emit-token-metric in APIM, and strip the header before upstream forwarding."
  csaUse="Share this pattern with FinOps and Platform Engineering teams so cost allocation never compromises prompt-cache hit rates."
/>

## 1. The FinOps vs. Prefix-Cache Seam

In multi-tenant enterprise platforms (advisory practices, shared corporate AI hubs, internal developer platforms), two valid engineering goals collide if implemented naively:

- **FinOps Goal:** Attribute every input, cached, and output token to `cost_center`, `practice_id`, or `business_unit`.
- **Capacity Goal ([Playbook 01](/playbooks/prompt-caching/start/01-executive-thesis)):** Keep `Pos 1–3` (`T0` system instructions + sorted `tools[]`) and `prompt_cache_key` identical across thousands of engagements so the platform achieves `≥80%` cache hits and `>20:1` Read/Write ratios.

<div class="arch-diagram">
  <svg viewBox="0 0 760 148" role="img" aria-labelledby="pb2-fin-title pb2-fin-desc" font-family="Segoe UI, Inter, -apple-system, sans-serif">
    <title id="pb2-fin-title">Out-of-Band FinOps Header Extraction Pattern</title>
    <desc id="pb2-fin-desc">Shows App sending shared practice cache key plus x-cost-center header to APIM, which emits CostCenter dimension to Azure Monitor / App Insights and deletes x-cost-center before sending byte-identical prefix to Microsoft Foundry.</desc>
    <defs><marker id="fin-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#0f766e"/></marker></defs>
    <rect x="8" y="18" width="218" height="94" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="18" y="37" font-size="9.2" font-weight="700" fill="#183e62">1. Inbound Request Envelope</text>
    <text x="18" y="54" font-size="8.1" fill="#334e68">Header: x-cost-center: CC-4410</text>
    <text x="18" y="68" font-size="8.1" fill="#334e68">Body cache_key: tax:scorer:v4:s2</text>
    <text x="18" y="82" font-size="8.1" fill="#334e68">Pos 1–3: Shared T0 methodology</text>
    <text x="18" y="99" font-size="7.8" font-weight="700" fill="#1d4ed8">[Zero Billing IDs in Prompt]</text>
    <path d="M226 65 H254" stroke="#0f766e" stroke-width="1.8" marker-end="url(#fin-arr)"/>
    <rect x="258" y="18" width="234" height="94" rx="6" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.5"/>
    <text x="268" y="37" font-size="9.2" font-weight="700" fill="#115e59">2. APIM Policy Seam</text>
    <text x="268" y="54" font-size="8.1" fill="#334e68">&bull; Validates JWT / subscription scope</text>
    <text x="268" y="68" font-size="8.1" fill="#334e68">&bull; Emits CostCenter to Token Metric</text>
    <text x="268" y="82" font-size="8.1" fill="#334e68">&bull; Deletes x-cost-center header</text>
    <text x="268" y="99" font-size="7.8" font-weight="700" fill="#0f766e">[100% FinOps Attribution]</text>
    <path d="M492 65 H520" stroke="#0f766e" stroke-width="1.8" marker-end="url(#fin-arr)"/>
    <rect x="524" y="18" width="228" height="94" rx="6" fill="#eaf7f5" stroke="#0f766e" stroke-width="1.5"/>
    <text x="534" y="37" font-size="9.2" font-weight="700" fill="#115e59">3. Microsoft Foundry Upstream</text>
    <text x="534" y="54" font-size="8.1" fill="#334e68">&bull; Receives clean sharded cache_key</text>
    <text x="534" y="68" font-size="8.1" fill="#334e68">&bull; Reuses warm T0 KV prefix across</text>
    <text x="534" y="82" font-size="8.1" fill="#334e68">  all 5,000+ active engagements</text>
    <text x="534" y="99" font-size="7.8" font-weight="700" fill="#0f766e">[&gt;20:1 Read/Write Ratio Intact]</text>
    <text x="10" y="134" font-size="8.3" fill="#526c80">Decoupling HTTP chargeback telemetry from LLM prompt bodies preserves both exact accounting and high cache reuse.</text>
  </svg>
</div>

---

## 2. Layered Token Governance Controls in APIM `[M]` `[Arch]`

| Governance Control | APIM Policy / Mechanism | Recommended Practice |
| :--- | :--- | :--- |
| **Noisy-Neighbor Protection** | `<azure-openai-token-limit>` <span class="ev-badge ev-m">[M]</span> | Enforce per-subscription or per-JWT-tenant `tokens-per-minute` ceilings with `estimate-prompt-tokens="true"` so one runaway batch job cannot starve interactive agents on shared PTU-M. |
| **Multi-Dimension Token Telemetry** | `<azure-openai-emit-token-metric>` <span class="ev-badge ev-m">[M]</span> | Emit `SubscriptionId`, `CostCenter`, and `ClientIP` / `AppId` dimensions to Application Insights custom metrics. Keep dimension cardinality bounded (e.g., `cost_center` or `practice`, while logging ultra-high-cardinality `matter_id` to Log Analytics custom traces). |
| **Upstream Zero-Key Posture** | `<authentication-managed-identity>` <span class="ev-badge ev-m">[M]</span> | Disable local key authentication (`disableLocalAuth: true`) on Microsoft Foundry resources; grant APIM's Managed Identity `Cognitive Services OpenAI User` RBAC on each backend resource <span class="ev-badge ev-m">[M]</span>. |
| **Caller Entra ID Validation** | `<validate-azure-ad-token>` <span class="ev-badge ev-m">[M]</span> | Require caller app registrations to present short-lived Entra ID access tokens scoped to the gateway API rather than long-lived static APIM subscription keys in production. |
