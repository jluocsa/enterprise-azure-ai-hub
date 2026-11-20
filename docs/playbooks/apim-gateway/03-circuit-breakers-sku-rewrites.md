---
title: "03 · Backend Pool Circuit Breakers & SKU Policy Rewrites"
description: Native Azure API Management backend-pool circuit breakers honoring Retry-After, Managed Identity RBAC, and SKU-aware JSON policy stripping for GPT-5.6 vs. GPT-6+ PTU-M.
---

# 03 · Backend Pool Circuit Breakers & SKU Policy Rewrites

<PlaybookMeta
  track="02 · Multi-Backend Foundry APIM AI Gateway & Governance"
  verified="2026-11-19 PST"
  status="Live v2.0"
  kitHref="/papers/engineering-kits#apim-policy"
/>

<PageBrief
  stage="design"
  readTime="5 min read"
  problem="Custom C# retry loops inside APIM policies do not share state across gateway workers and fail when GPT-5.6 PTU-M rejects explicit cache breakpoint fields."
  takeaway="Use declarative APIM Backend Pools + Backend Circuit Breakers with acceptRetryAfter=true, authenticate via Managed Identity, and strip unsupported 5.6 breakpoint fields on the PTU leg."
  csaUse="Use the Bicep backend-pool definition and interactive policy generator below to produce deployment-ready gateway artifacts."
/>

## 1. Declarative Backend Pool + `Retry-After` Circuit Breaker `[M]`

Azure API Management natively supports **priority and weighted backend pools** paired with **backend circuit breakers** that trip automatically on HTTP `429` or `5xx` responses and honor upstream `Retry-After` headers <span class="ev-badge ev-m">[M]</span>:

```bicep
resource ptuBackend 'Microsoft.ApiManagement/service/backends@2024-05-01' = {
  parent: apimService
  name: 'foundry-ptu-primary'
  properties: {
    url: 'https://${foundryPrimaryName}.openai.azure.com/openai'
    protocol: 'http'
    circuitBreaker: {
      rules: [
        {
          name: 'ptu-throttle-or-5xx-breaker'
          failureCondition: {
            count: 1
            interval: 'PT10S'
            statusCodeRanges: [
              { min: 429, max: 429 }
              { min: 500, max: 599 }
            ]
          }
          tripDuration: 'PT30S'
          acceptRetryAfter: true
        }
      ]
    }
  }
}

resource paygBackend 'Microsoft.ApiManagement/service/backends@2024-05-01' = {
  parent: apimService
  name: 'foundry-standard-spillover'
  properties: {
    url: 'https://${foundrySpilloverName}.openai.azure.com/openai'
    protocol: 'http'
  }
}

resource foundryPool 'Microsoft.ApiManagement/service/backends@2024-05-01' = {
  parent: apimService
  name: 'foundry-ptu-with-payg-spillover-pool'
  properties: {
    type: 'Pool'
    pool: {
      services: [
        { id: ptuBackend.id, priority: 1, weight: 100 }
        { id: paygBackend.id, priority: 2, weight: 100 }
      ]
    }
  }
}
```

### Why `count: 1` + `acceptRetryAfter: true` Matters for PTU-M

When a `PTU-M` deployment crosses its normalized TPM saturation ceiling, Azure OpenAI returns HTTP `429` with an explicit `Retry-After` or `x-ratelimit-reset-tokens` window <span class="ev-badge ev-m">[M]</span>. Tripping the Priority-1 backend immediately for that `Retry-After` window prevents hundreds of concurrent agent calls from wasting round-trips against a saturated PTU pool before spilling to Priority-2 Standard PAYG <span class="ev-badge ev-arch">[Arch]</span>.

---

## 2. SKU-Aware Parameter Compatibility (`GPT-5.6` vs. `GPT-6 / 6.1`)

| Wire Field | Standard `5.6+` | `GPT-5.6` on `PTU-M` | `GPT-6 / 6.1` on `PTU-M` | Gateway Action |
| :--- | :--- | :--- | :--- | :--- |
| `prompt_cache_key` | Supported <span class="ev-badge ev-m">[M]</span> | Supported <span class="ev-badge ev-m">[M]</span> | Supported <span class="ev-badge ev-m">[M]</span> | **Preserve unchanged** on all legs so sharded prefix routing stays warm. |
| `prompt_cache_options` | Supported <span class="ev-badge ev-m">[M]</span> | **Unsupported** <span class="ev-badge ev-m">[M]</span> | Supported <span class="ev-badge ev-m">[M]</span> | Strip on `GPT-5.6 PTU-M` routes; pass through on `GPT-6+` and `Standard`. |
| `prompt_cache_breakpoint` | Supported <span class="ev-badge ev-m">[M]</span> | **Unsupported** <span class="ev-badge ev-m">[M]</span> | Supported <span class="ev-badge ev-m">[M]</span> | Strip on `GPT-5.6 PTU-M` routes; pass through on `GPT-6+` and `Standard`. |

---

## 3. Interactive APIM Policy Generator

Configure your target model regime, spillover behavior, and FinOps governance below to generate ready-to-deploy APIM policy XML (or download the standalone kit from [Engineering Kits](/papers/engineering-kits#apim-policy)):

<ApimPolicyBuilder />
