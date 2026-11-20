---
title: 15 · Verification Matrix & Official Sources
description: Specification verification register separating Microsoft Learn verified rules from subscription-level empirical checks, plus authoritative source links.
---

# 15 · Verification Matrix & Official Microsoft Sources

<PageBrief
  stepLabel="VERIFICATION REGISTER · 15"
  readTime="3 min read"
  problem="Production architecture reviews require clarity on which behaviors are published Microsoft Learn guarantees versus regional checks to run in a target subscription."
  takeaway="Every [M] platform claim in Playbook 01 maps directly to authoritative Microsoft Learn / Azure Pricing URLs (R1–R6), separated from [Validate] probes."
  csaUse="Reference links R1–R6 directly to verify sizing formulas, breakpoint limits, retention rules, and isolation guarantees."
/>

*Last verified against published Microsoft Learn and OpenAI documentation: **2026-11-18 21:21 PST**.*

## 1. Technical Specification Verification Matrix

| Technical Specification | Status | Authoritative Detail / Verification Note |
| :--- | :--- | :--- |
| **Minimum prefix, 128-token rounding & `5.5` retention default** | <span class="ev-badge ev-m">[M] Verified in Learn</span> | Minimum prefix is **1,024 tokens**. The 128-token rounding on `<=5.5` **does not apply to GPT-5.6+**. Extended `24h` retention is default on `gpt-5.5` (`in_memory` on `<=5.4`); `5.6+` uses `ttl` (`30m` default, `12h` on Responses). |
| **Maximum explicit breakpoints, read/write limits & pre-5.6 HTTP `400`** | <span class="ev-badge ev-m">[M] Verified in Learn</span> | Up to **4 new cache writes**/request (3 explicit in `implicit` mode; 4 in `explicit` mode) and **50 read breakpoints**. Pre-5.6 models return HTTP `400` if sent `prompt_cache_options` or `prompt_cache_breakpoint`. |
| **Breakpoint support on PTU-M & `272K` long-context boundary** | <span class="ev-badge ev-m">[M] Verified in Learn</span> | GPT-5.6 PTU-M supports automatic prefix caching + `prompt_cache_key`, **not breakpoints**. GPT-6 and GPT-6.1 support breakpoints on PTU-M; long-context normalized weights (`2.0x` input, `0.2x`/`0.1x` read, `2.5x` write, `7.5x` output) apply above **272K input tokens**. |
| **Structured output schemas (`response_format`) & `reasoning.context`** | <span class="ev-badge ev-m">[M] Verified in Learn</span> | `response_format` is prepended to the system message. **`gpt-5.6` and `gpt-6` default `reasoning.context` to `all_turns`** (was `current_turn` on `5.4`/`5.5`), increasing multi-turn tokens unless set to `current_turn`. |
| **Responses API vs. Chat Completions API & Nov 1, 2026 write billing** | <span class="ev-badge ev-m">[M] Verified in Learn</span> | Both APIs support `prompt_cache_key`, `prompt_cache_options`, and `prompt_cache_breakpoint` on 5.6+; `12h` TTL is supported on Responses API and `12h` cache-write billing took effect **November 1, 2026**. |
| **Endpoint cache-hit verification & burst Standard TPM behavior** | <span class="ev-badge ev-val">[Validate in Sub]</span> | Run the 2-pass cache probe ([Chapter 11](./validate/11-seven-layer-gates)) on every target deployment/endpoint (`sol`, `terra`, `luna`) and benchmark burst TPM throttling behavior on Standard spillover legs. |
| **Regional PTU-M vs. Standard availability & Regional PTU minimums** | <span class="ev-badge ev-val">[Validate in Sub]</span> | Verify regional availability and minimum PTUs in your target Azure region via Foundry Quota calculator (Global/DZ min is `15`; Regional `5.6-sol/terra` lists `15` in R3 vs. `50` on R2). |

## 2. Authoritative Microsoft & OpenAI Reference Register

- **R1 · Prompt caching in Azure OpenAI (`[M]`):** <https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/prompt-caching>  
  Specification for `prompt_cache_key` (`~15 RPM` sharding), `prompt_cache_options` (`implicit`/`explicit`, `ttl: 30m|12h`), `prompt_cache_breakpoint` (4 writes / 50 reads), HTTP `400` on pre-5.6, and PTU-M rules.
- **R2 · Azure OpenAI Service pricing (`[M]`):** <https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/>  
  Standard discounted cached-input rates, short (`<=272K`) vs. long (`>272K`) context tiers, Provisioned minimum PTU table, and TTL cache-write charges (`12h` write billing effective Nov 1, 2026).
- **R3 · Determine PTU sizing for a workload (`[M]`):** <https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/provisioned-throughput-sizing>  
  Per-model Input TPM per PTU and min/increment tables for `gpt-5.6-luna/terra/sol` (`15|15` min, `5|5` increment), `gpt-6-astra/sol/luna`, and `gpt-6.1-sol`; 100% cache deduction vs. normalized token weights.
- **R4 · Foundry Models region & provisioned availability (`[M]`):** <https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability?pivots=provisioned>  
  Regional availability matrix for Global Provisioned, Data Zone Provisioned, and Regional Provisioned (PTU-M) deployments.
- **R5 · Azure OpenAI reasoning models (`[M]`):** <https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/reasoning#preserve-reasoning-across-calls>  
  Documents `reasoning.context` (`all_turns` default on `gpt-5.6` and `gpt-6` vs. `current_turn` on `5.4`/`5.5`) and Responses API requirement for combining tools with active reasoning on `gpt-5.6`; see also [Microsoft Q&A #5942997](https://learn.microsoft.com/en-us/answers/questions/5942997/gpt-5-6-implicit-prompt-caching-and-explicit-promp).
- **R6 · Use a gateway in front of multiple model deployments (`[M]`):** <https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/azure-openai-gateway-multi-backend>  
  Azure Architecture Center reference pattern for Azure API Management PTU-to-Standard spillover, token rate limiting, and OpenTelemetry / Application Insights `gen_ai.*` telemetry.
