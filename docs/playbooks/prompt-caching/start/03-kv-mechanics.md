---
title: 03 · KV Mechanics & What Changes in GPT-5.6+
description: Exact wire elements in the cached prefix, 1,024-token threshold, reasoning.context defaults, and generation capability matrix across GPT-5.6, GPT-6, and GPT-6.1.
---

# 03 · KV-Tensor Mechanics & What Changes in GPT-5.6+

<PageBrief
  stage="start"
  readTime="4 min read"
  problem="Assuming GPT-5.6+ caches prompts identically to GPT-4o overlooks write billing, reasoning token replay, and PTU breakpoint rules."
  takeaway="First 1,024 wire tokens must match character-for-character (starting with response_format), reasoning.context defaults to all_turns on 5.6/6, and cache writes can be billed."
  csaUse="Use the generation matrix below during migration reviews to flag HTTP 400 risks, PTU-M differences, and reasoning.context token growth."
/>

Prompt caching retains precomputed key-value (KV) attention tensors for identical leading input tokens. It never alters model output determinism or quality—only time-to-first-token (TTFT), input billing, and PTU capacity utilization <span class="ev-badge ev-m">[M]</span>.

<div class="arch-diagram">
  <svg viewBox="0 0 760 150" role="img" aria-labelledby="kv-wire-title kv-wire-desc" font-family="Segoe UI, Inter, -apple-system, sans-serif">
    <title id="kv-wire-title">Wire-Order Prefix Evaluation and 1,024-Token Exact-Match Boundary</title>
    <desc id="kv-wire-desc">Shows Azure OpenAI evaluating wire tokens strictly in order from 1 response_format schema, 2 system or developer message, 3 tools JSON array, to 4 conversation messages, requiring at least 1,024 identical leading tokens for a cache hit.</desc>
    <defs><marker id="kv-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#0f766e"/></marker></defs>
    <rect x="8" y="16" width="132" height="76" rx="6" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.4"/>
    <text x="16" y="34" font-size="9.0" font-weight="700" fill="#115e59">Token 0: Schema</text>
    <text x="16" y="49" font-size="8.1" fill="#334e68">response_format</text>
    <text x="16" y="62" font-size="8.1" fill="#334e68">prepended first</text>
    <text x="16" y="80" font-size="7.7" font-weight="700" fill="#0f766e">[Must Stay Static]</text>
    <path d="M140 54 H156" stroke="#0f766e" stroke-width="1.7" marker-end="url(#kv-arr)"/>
    <rect x="160" y="16" width="136" height="76" rx="6" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.4"/>
    <text x="168" y="34" font-size="9.0" font-weight="700" fill="#115e59">System / Developer</text>
    <text x="168" y="49" font-size="8.1" fill="#334e68">Core policy, skills &amp;</text>
    <text x="168" y="62" font-size="8.1" fill="#334e68">domain rubrics</text>
    <text x="168" y="80" font-size="7.7" font-weight="700" fill="#0f766e">[Zero Timestamps]</text>
    <path d="M296 54 H312" stroke="#0f766e" stroke-width="1.7" marker-end="url(#kv-arr)"/>
    <rect x="316" y="16" width="136" height="76" rx="6" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.4"/>
    <text x="324" y="34" font-size="9.0" font-weight="700" fill="#115e59">Sorted tools[] JSON</text>
    <text x="324" y="49" font-size="8.1" fill="#334e68">Array order + key</text>
    <text x="324" y="62" font-size="8.1" fill="#334e68">order (sort_keys)</text>
    <text x="324" y="80" font-size="7.7" font-weight="700" fill="#0f766e">[&ge;1,024 Tok Gate]</text>
    <line x1="460" y1="10" x2="460" y2="108" stroke="#0f766e" stroke-width="2" stroke-dasharray="4 3"/>
    <path d="M452 54 H472" stroke="#0f766e" stroke-width="1.7" marker-end="url(#kv-arr)"/>
    <rect x="476" y="16" width="134" height="76" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="484" y="34" font-size="9.0" font-weight="700" fill="#183e62">Messages &amp; History</text>
    <text x="484" y="49" font-size="8.1" fill="#334e68">Scoped L2/L1 cards +</text>
    <text x="484" y="62" font-size="8.1" fill="#334e68">append-only turns</text>
    <text x="484" y="80" font-size="7.7" font-weight="700" fill="#1d4ed8">[Pin current_turn]</text>
    <path d="M610 54 H626" stroke="#0f766e" stroke-width="1.7" marker-end="url(#kv-arr)"/>
    <rect x="630" y="16" width="122" height="76" rx="6" fill="#fff7eb" stroke="#d97706" stroke-width="1.4"/>
    <text x="638" y="34" font-size="9.0" font-weight="700" fill="#92400e">Dynamic Tail</text>
    <text x="638" y="49" font-size="8.1" fill="#334e68">Live RAG chunks,</text>
    <text x="638" y="62" font-size="8.1" fill="#334e68">MCP &amp; user prompt</text>
    <text x="638" y="80" font-size="7.7" font-weight="700" fill="#b45309">[Changes Safely]</text>
    <path d="M8 104 H452" stroke="#0f766e" stroke-width="2"/>
    <text x="12" y="120" font-size="8.4" font-weight="700" fill="#115e59">Byte-identical prefix (&ge;1,024 tokens): 1-character change before token 1,024 forces cached_tokens = 0</text>
    <text x="12" y="138" font-size="8.2" fill="#526c80">On GPT-5.6+, 128-token increment rounding is removed and reasoning.context defaults to "all_turns" on GPT-5.6 &amp; GPT-6 [M].</text>
  </svg>
</div>

## 1. Exact Wire Elements & Prefix Thresholds `[M]`

Azure OpenAI evaluates the rendered prefix in strict wire order:

1. **Structured outputs schema (`response_format`):** Appended *as a prefix to the system message*—any per-request schema mutation invalidates token `0`.
2. **`system` / `developer` messages:** Core instructions, policy, and static reference blocks.
3. **`tools[]` definitions:** Tool array order and JSON property order.
4. **Conversation messages & multimodal blocks:** `image_url` / `input_image` (with identical `detail` setting), `input_audio`, and `file` / `input_file`.

Key platform rules verified in Microsoft Learn <span class="ev-badge ev-m">[M]</span>:

- **Minimum cacheable prefix:** Every cache hit requires at least **1,024 tokens**, and the first 1,024 tokens must be character-for-character identical (`cached_tokens = 0` on any 1-character difference).
- **128-token rounding removed on GPT-5.6+:** On `gpt-5.5` and earlier, hits beyond 1,024 tokens occur in 128-token increments; **this rounding no longer applies on GPT-5.6 and later**.
- **`reasoning.context` default shift:** **`gpt-5.6` and `gpt-6` default `reasoning.context` to `"all_turns"`** (whereas `gpt-5.4` and `gpt-5.5` default to `"current_turn"`), rendering earlier turns' reasoning items into context and increasing multi-turn input tokens unless explicitly set to `"current_turn"`.

## 2. Generation-by-Generation Capability Matrix `[M]`

| Capability | Before GPT-5.6 (`gpt-4.1`–`5.5`, `o3-mini`) | GPT-5.6 Family (`gpt-5.6-sol/terra/luna`) | GPT-6 & Newer (`gpt-6-astra/sol/luna`, `6.1-sol/terra`) |
| :--- | :--- | :--- | :--- |
| **Automatic prefix caching** | Enabled by default on supported operations. | Enabled by default (`implicit` mode); pair with `prompt_cache_key` for reliable routing. | Enabled by default (`implicit` mode); full explicit control available. |
| **`prompt_cache_key`** | Supported for routing related requests (`<=~15 RPM/key`). | **Supported & strongly recommended** (no API-version lock; v1 API recommended). | **Supported & strongly recommended** (shard keys above `~15 RPM`). |
| **Explicit breakpoints** (`prompt_cache_breakpoint`) | **Not supported** (returns HTTP `400` if sent). | **Standard:** Supported (up to 4 writes).<br>**PTU-M:** **Not supported**. | **Standard & PTU-M:** **Supported** (up to 4 new writes, 50 read candidates). |
| **Cache mode control** (`prompt_cache_options.mode`) | Not available (returns HTTP `400`). | Standard: `implicit` (default) or `explicit` (disables caching if no breakpoints set). | Standard & PTU-M: `implicit` or `explicit` mode supported. |
| **Retention control** | `prompt_cache_retention`: `in_memory` (default `<=5.4`) or `24h` (default `5.5`). | `prompt_cache_options.ttl` sets minimum lifetime: `30m` (default) or `12h` (Responses API). Legacy field deprecated. | `prompt_cache_options.ttl`: `30m` (default) or `12h` on supported Responses API deployments. |
| **Write billing & `reasoning.context`** | No extra charge to write to cache; `reasoning.context` defaults to `current_turn`. | **Cache writes can incur charges** (`12h` billed from **Nov 1, 2026**); `reasoning.context` defaults to `all_turns`. | **Cache writes incur charges** by TTL and count at `1.25x`/`2.5x` in PTU normalized weights; `reasoning.context` defaults to `all_turns`. |
| **Usage telemetry** | `prompt_tokens_details.cached_tokens` | `cached_tokens` (reads) + `cache_write_tokens` (writes on Standard). | `cached_tokens` (reads) + `cache_write_tokens` (writes). |

::: warning Why Teams Observed "0% Cache Hits or TPM Spikes" on Un-Tuned GPT-5.6 Upgrades
Per Microsoft Learn <span class="ev-badge ev-m">[M]</span>, `implicit` mode remains default on GPT-5.6+. Three concrete factors caused un-tuned migrations to experience `0%` hits or unexpected token spikes:
1. **Endpoint rollout verification:** During the initial July 2026 launch window ([Microsoft Q&A #5942997](https://learn.microsoft.com/en-us/answers/questions/5942997/gpt-5-6-implicit-prompt-caching-and-explicit-promp)), `/openai/v1/responses` temporarily returned `cached_tokens: 0` before service rollout fixes—making the 2-pass endpoint probe ([Chapter 11](../validate/11-seven-layer-gates)) essential on every target model.
2. **`reasoning.context = "all_turns"` default:** Multi-turn conversations replay earlier reasoning items automatically unless pinned to `"current_turn"`.
3. **Missing `prompt_cache_key` or `>15 RPM` overflow:** Un-keyed or un-sharded high-RPM traffic misses cache partitions while incurring cache-write fees on Standard.
:::
