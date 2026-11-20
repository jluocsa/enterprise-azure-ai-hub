---
title: "06 · Verification Matrix & Sources (Playbook 02)"
description: Authoritative Microsoft Learn and Azure Architecture Center sources backing Playbook 02 (Multi-Backend Foundry APIM AI Gateway & Token Governance).
---

# 06 · Verification Matrix & Authoritative Sources

<PlaybookMeta
  track="02 · Multi-Backend Foundry APIM AI Gateway & Governance"
  verified="2026-11-19 PST"
  status="Live v2.0"
/>

<PageBrief
  stage="reference"
  readTime="2 min read"
  problem="Gateway policy syntax, circuit-breaker behavior, and GenAI token policies evolve across Azure API Management releases."
  takeaway="Every [M] platform statement in Playbook 02 maps directly to an official Microsoft Learn specification below."
  csaUse="Verify regional availability and API versions against these authoritative docs before finalizing Bicep templates."
/>

## Authoritative Microsoft Learn Citations (`[M]`)

| Ref | Official Documentation Source | Key Platform Facts Grounded | Last Verified |
| :--- | :--- | :--- | :--- |
| **`G-R1`** | [GenAI Gateway Capabilities in Azure API Management](https://learn.microsoft.com/en-us/azure/api-management/genai-gateway-capabilities) | Built-in `azure-openai-token-limit`, `azure-openai-emit-token-metric`, Managed Identity auth, and multi-backend load balancing / failover capabilities. | `2026-11-19` |
| **`G-R2`** | [Azure API Management Backends — Load-Balanced Pools & Circuit Breakers](https://learn.microsoft.com/en-us/azure/api-management/backends) | Declarative `Pool` backends (`priority` + `weight`), `circuitBreaker.rules`, status-code failure conditions (`429`, `5xx`), and `acceptRetryAfter`. | `2026-11-19` |
| **`G-R3`** | [APIM `forward-request` Policy Specification](https://learn.microsoft.com/en-us/azure/api-management/forward-request-policy) | `buffer-response="false"` requirement for unbuffered Server-Sent Events (SSE) streaming, `buffer-request-body="true"` for `<retry>`, and `timeout` behavior. | `2026-11-19` |
| **`G-R4`** | [Azure Architecture Center — Gateway in Front of Multiple Azure OpenAI Deployments](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/azure-openai-gateway-multi-backend) | Reference trade-offs across single-resource, PTU-to-PAYG priority spillover, and multi-region gateway topologies. | `2026-11-19` |
| **`G-R5`** | [Role-Based Access Control for Azure OpenAI in Microsoft Foundry](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/role-based-access-control) | `Cognitive Services OpenAI User` least-privilege Managed Identity assignment and `disableLocalAuth` key retirement. | `2026-11-19` |
| **`G-R6`** | [Azure OpenAI Prompt Caching Specification](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/prompt-caching) | Subscription-scoped KV cache isolation, `prompt_cache_key` routing, and SKU support boundaries for explicit breakpoints. | `2026-11-19` |
