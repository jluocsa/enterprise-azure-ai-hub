---
title: "03 · Backend Pool Circuit Breakers & SKU Policy Rewrites"
description: Native Azure API Management backend-pool circuit breakers honoring Retry-After, Managed Identity RBAC, and SKU-aware JSON policy stripping for GPT-5.6 vs. GPT-6+ PTU-M.
---

# 03 · Backend Pool Circuit Breakers & SKU Policy Rewrites

<PlaybookMeta
  track="02 · Multi-Backend Foundry APIM AI Gateway & Governance"
  verified="2026-11-19 22:12 PST"
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

### Body-Safe Per-Attempt Routing

The generated policy and downloadable kit use **explicit** `foundry-ptu-primary` then `foundry-standard-spillover` backend IDs, defined above, rather than the mixed-SKU pool. A pool can select Standard on the first attempt when the PTU breaker is open; an inbound PTU-only rewrite would then strip Standard's fields too. Use the pool alternative only when all members accept the same body, or place a SKU-aware adapter behind it <span class="ev-badge ev-arch">[Arch]</span>.

Capture the original request as a string **before** stripping fields. `preserveContent: true` preserves a body read, but returning a different body from `set-body` replaces the forwarded request; it does not save an original copy for retries ([set-body reference](https://learn.microsoft.com/en-us/azure/api-management/set-body-policy)) <span class="ev-badge ev-m">[M]</span>. The retry block executes once before testing its retry condition ([retry reference](https://learn.microsoft.com/en-us/azure/api-management/retry-policy)) <span class="ev-badge ev-m">[M]</span>. Therefore, restore the saved string and select Standard only when a previous response is `429` or `503`, before the second `forward-request`. This retains `prompt_cache_options`, nested breakpoints, and `prompt_cache_key` on the Standard leg without reserializing the original body. Keep request replay buffering enabled even when response streaming is disabled <span class="ev-badge ev-arch">[Arch]</span>.

The PTU rewrite covers both **Responses `input[].content[]`** and **Chat Completions `messages[].content[]`**. Microsoft Learn documents breakpoint-bearing content blocks for [both APIs](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/prompt-caching#configure-prompt-cache-breakpoints), with GPT-5.6 breakpoint support limited to Standard rather than PTU-M <span class="ev-badge ev-m">[M]</span>. The reference policy removes only top-level `prompt_cache_options` and each content block's `prompt_cache_breakpoint`; it leaves `prompt_cache_key`, text, multimodal payloads, tools, and other fields unchanged. Array/type guards leave string content and non-message input items alone, without recursively deleting similarly named fields in tool arguments or application data. The Studio's GPT-6 mode performs no inbound body rewrite <span class="ev-badge ev-arch">[Arch]</span>.

The standalone kit assumes that `foundry-ptu-primary` is a **GPT-5.6 PTU-M** deployment and always applies its inbound rewrite. A caller's `x-target-regime` header does not change the configured backend and must not disable that backend's compatibility rewrite. For GPT-6/6.1, generate a separate policy using the Studio's target-regime control; this is deployment configuration, not a per-request routing selector. Standard retries still receive the original captured body <span class="ev-badge ev-arch">[Arch]</span>.

`npm run check:apim` checks both the downloadable kit and rendered Studio default for XML syntax, a whitespace-normalized whitelist of the two-API PTU rewrite, its unconditional inbound placement, and the static routing/restoration contract. Mutation regressions reject conditional rewrites (including caller-header guards), missing API coverage, lost cache keys/content, missing field removal, missing/late snapshots, pooled routing, lost restoration, and unbuffered replay. The Studio interaction suite also checks generated/copied rewrite parity with the kit in both spillover modes and GPT-6 pass-through. These checks do **not** execute C# or certify live APIM behavior; intentional rewrite changes require updating the whitelist and reviewing the effective policy <span class="ev-badge ev-arch">[Arch]</span>.

The `set-body` [`template="liquid"` attribute](https://learn.microsoft.com/en-us/azure/api-management/set-body-policy#attributes) selects Liquid templating rather than the policy's default body-expression mode <span class="ev-badge ev-m">[M]</span>. Matching C# text alone therefore cannot establish that the PTU rewrite or Standard restoration runs as intended. The local gate requires both expression-bearing `set-body` elements to **omit `template` entirely**, rejecting Liquid, blank, computed, and unknown values. Offline regressions cover both expressions, recovery after removing the attribute, and exit `1` without a pass message for either kit or rendered-Studio Liquid mutations. This is a reference-artifact execution-mode contract, not a ban on Liquid elsewhere or a full APIM schema/C# validator; valid exports remain unchanged <span class="ev-badge ev-arch">[Arch]</span>.

Keep `forward-request`'s [`fail-on-error-status-code`](https://learn.microsoft.com/en-us/azure/api-management/forward-request-policy#attributes) omitted (default `false`) or explicitly `false`. Setting it to `true` triggers `on-error` for HTTP `400–599`, including `429` and `503`; policy expressions are not allowed for this attribute <span class="ev-badge ev-m">[M]</span>. That error path conflicts with this reference design's response-based retry and Standard body restoration. The local spillover gate rejects `true`, blank, computed, and unknown values in either the downloadable kit or rendered Studio default, with exit `1` and no pass message; omitted and literal `false` remain valid. Offline mutations cover rejection and recovery, not live gateway execution <span class="ev-badge ev-arch">[Arch]</span>.

The [`set-variable` policy](https://learn.microsoft.com/en-us/azure/api-management/set-variable-policy) assigns a named context variable and is available in all four policy sections <span class="ev-badge ev-m">[M]</span>. The local gate therefore requires **exactly one** `set-variable` assignment to `original-request-body` across the entire document, not merely one direct inbound capture. A nested assignment after the PTU rewrite could replace the saved original with the stripped body while leaving the Standard restoration expression unchanged. Additional assignments are rejected regardless of section, branch condition, or value, including assignments before the capture and repeated identical expressions. Offline regressions cover both kit and rendered-Studio CLI inputs, exit `1` with no pass message, and recovery after removing the extra assignment; unrelated variable names remain allowed. This is a conservative single-write contract for these reference artifacts, not a C# interpreter or effective-policy analysis: inherited policies and other variable-writing policies still require review and live probes <span class="ev-badge ev-arch">[Arch]</span>.

Before release, probe both API payload shapes with `429`, `503`, an already-open PTU breaker, and successful `200` streaming: confirm Standard receives the original cache fields, PTU receives the stripped body with the same cache key and content, and no retry occurs after stream headers. Include string content, multimodal blocks, and absent, GPT-6, or arbitrary `x-target-regime` header values; the header must not alter the fixed GPT-5.6 primary's rewrite. Transport/on-error failures are outside this response-based retry contract <span class="ev-badge ev-val">[Validate]</span>.

### Unambiguous Policy Sections

Microsoft Learn describes policy configuration as `inbound`, `backend`, `outbound`, and `on-error` sections ([policy configuration reference](https://learn.microsoft.com/en-us/azure/api-management/api-management-howto-policies#understanding-policy-configuration)) <span class="ev-badge ev-m">[M]</span>. The published kit and Studio default use all four sections in that order. Their offline gate now requires exactly that root structure before checking any body, routing, or streaming policies: a duplicate section must not hide policies from first-section XML lookups. Missing, duplicate, reordered, or unexpected root elements exit `1` with a section-contract diagnostic and no pass message. Mutation regressions cover every section, including duplicate sections containing body replacements or authorization-header overrides, in both kit and rendered-Studio CLI inputs <span class="ev-badge ev-arch">[Arch]</span>.

This is a local complete-document contract for these published artifacts, not a full APIM schema validator or a claim that every policy scope must contain all four sections. XML comments and formatting remain allowed, and existing valid generated policies are unchanged. Inherited policies, individual policy attributes, C# expressions, and live deployment still require effective-policy review and the probes above <span class="ev-badge ev-arch">[Arch]</span>.

<ApimPolicyBuilder />
