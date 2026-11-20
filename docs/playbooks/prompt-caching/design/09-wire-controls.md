---
title: 09 · Explicit Cache Keys, >15 RPM Sharding & TTL
description: Wire-level configuration for Responses API and Chat Completions API on GPT-5.6, GPT-6, and GPT-6.1.
---

# 09 · Wire-Level Cache Configuration

<PageBrief
  stage="design"
  readTime="4 min read"
  problem="High-traffic prompts (>15 RPM) overflow a single cache bucket, while putting user_id or cost_center in prompt_cache_key destroys reuse."
  takeaway="Use {app}:{node}:{ver}:shard-{0..N-1} where N = ceil(Peak_RPM / 12), route by hash(thread_id) % N, and copy the exact JSON payloads below."
  csaUse="Apply the JSON payload templates and sharding formula below directly in Responses API and Chat Completions client wrappers."
/>

Enterprise agent workloads on Azure OpenAI in Microsoft Foundry call both the **Responses API (`/openai/v1/responses`)** and the **Chat Completions API (`/openai/v1/chat/completions`)**. Both APIs support `prompt_cache_key`, `prompt_cache_options`, and `prompt_cache_breakpoint` on GPT-5.6+ <span class="ev-badge ev-m">[M]</span> (note: to combine function tools with active reasoning on `gpt-5.6`, use `/openai/v1/responses` <span class="ev-badge ev-m">[M]</span>).

<div class="arch-diagram">
  <svg viewBox="0 0 760 144" role="img" aria-labelledby="shd-title shd-desc" font-family="Segoe UI, Inter, -apple-system, sans-serif">
    <title id="shd-title">Deterministic Prompt Cache Key Sharding Above 15 RPM</title>
    <desc id="shd-desc">Shows 90 RPM peak traffic routed by hash(thread_id) mod 8 across shard-0 through shard-7 (~11.2 RPM per shard), keeping each partition safely below the ~15 RPM threshold while preserving multi-turn session affinity.</desc>
    <defs><marker id="shd-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#0f766e"/></marker></defs>
    <rect x="8" y="24" width="164" height="76" rx="6" fill="#fff7eb" stroke="#d97706" stroke-width="1.4"/>
    <text x="18" y="44" font-size="9.2" font-weight="700" fill="#92400e">1. Peak Node Traffic</text>
    <text x="18" y="59" font-size="8.2" fill="#334e68">90 RPM on 1 unsharded</text>
    <text x="18" y="72" font-size="8.2" fill="#334e68">key overflows &gt;15 RPM</text>
    <text x="18" y="90" font-size="7.8" font-weight="700" fill="#b45309">[Overflow Miss Risk]</text>
    <path d="M172 62 H196" stroke="#0f766e" stroke-width="1.8" marker-end="url(#shd-arr)"/>
    <rect x="200" y="24" width="194" height="76" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="210" y="44" font-size="9.2" font-weight="700" fill="#183e62">2. Deterministic Router</text>
    <text x="210" y="59" font-size="8.2" fill="#334e68">N = &lceil;90 &divide; 12&rceil; = 8 shards</text>
    <text x="210" y="72" font-size="8.2" fill="#334e68">idx = hash(thread_id) % 8</text>
    <text x="210" y="90" font-size="7.8" font-weight="700" fill="#1d4ed8">[Same Thread &rarr; Same Shard]</text>
    <path d="M394 42 H422 V24 H438" stroke="#0f766e" stroke-width="1.6" fill="none" marker-end="url(#shd-arr)"/>
    <path d="M394 62 H438" stroke="#0f766e" stroke-width="1.6" fill="none" marker-end="url(#shd-arr)"/>
    <path d="M394 82 H422 V100 H438" stroke="#0f766e" stroke-width="1.6" fill="none" marker-end="url(#shd-arr)"/>
    <rect x="442" y="8" width="308" height="30" rx="5" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.3"/>
    <text x="452" y="27" font-size="8.4" font-weight="700" fill="#115e59">app:summarizer:v12:shard-0 &middot;&middot;&middot; ~11.2 RPM (&le;15 RPM)</text>
    <rect x="442" y="47" width="308" height="30" rx="5" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.3"/>
    <text x="452" y="66" font-size="8.4" font-weight="700" fill="#115e59">app:summarizer:v12:shard-1 &middot;&middot;&middot; ~11.2 RPM (&le;15 RPM)</text>
    <rect x="442" y="86" width="308" height="30" rx="5" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.3"/>
    <text x="452" y="105" font-size="8.4" font-weight="700" fill="#115e59">app:summarizer:v12:shard-2..7 &middot; ~11.2 RPM each [High Hit Rate]</text>
    <text x="10" y="134" font-size="8.4" fill="#526c80">Never put user_id, request_id, or cost_center inside prompt_cache_key—pass chargeback tags via HTTP headers / OTel spans.</text>
  </svg>
</div>

## 1. `prompt_cache_key` Taxonomy & `>15 RPM` Sharding `[M]`

Azure OpenAI routes requests sharing a `prompt_cache_key` to the same cache partition. Per Microsoft Learn, if traffic for one prefix + key combination exceeds **~15 requests per minute (RPM)**, overflow requests can miss the cache <span class="ev-badge ev-m">[M]</span>.

Use a deterministic four-part key format <span class="ev-badge ev-arch">[Arch]</span>:

```text
{app}:{node_or_skill}:{prompt_ver}:shard-{0..N-1}
```

- Compute `N = max(1, ceil(Peak_RPM / 12))` (for example, `8` shards for a `90 RPM` node: `doc-review:summarizer:v12:shard-0` through `shard-7`).
- Route deterministically by `shard = hash(thread_id) % N` so all turns of a conversation hit the same shard.
- **Never** embed `user_id`, `request_id`, `uuid4()`, or internal chargeback IDs (`engagement_id`, `matter_id`, `client_id`, `cost_center`) in `prompt_cache_key`—pass chargeback metadata out-of-band via APIM headers and OpenTelemetry spans ([see Chargeback-vs-Cache-Key Separation](/playbooks/prompt-caching/profiles/regulated-multi-engagement#2-chargeback-vs-cache-key-separation-preventing-cardinality-collapse)).

## 2. Breakpoint Budgets & Minimum TTL Rules `[M]`

- **Write budget:** Maximum **4 new cache writes** per request.
  - In `implicit` mode (default), the automatic breakpoint on the latest message consumes `1` write slot, leaving up to **3 explicit breakpoints**.
  - In `explicit` mode, up to **4 explicit breakpoints** can be written (and if zero breakpoints are present, caching and cache-write charges are completely disabled).
- **Read budget:** Azure OpenAI evaluates up to the latest **50 breakpoints** in the conversation; breakpoints from earlier turns are read-only.
- **Minimum TTL (`prompt_cache_options.ttl`):** `"30m"` (default on both APIs) or `"12h"` (supported on Responses API; `12h` cache-write billing applies from **November 1, 2026**). Legacy `prompt_cache_retention` is deprecated on GPT-5.6+.

## 3. Production Wire Payloads `[M]`

### A. Responses API (`/openai/v1/responses`) — `implicit` Mode + `T0` & `L2` Breakpoints

```json
{
  "model": "gpt-5-6-prod-std",
  "prompt_cache_key": "doc-review:evidence-summarizer:v1:shard-2",
  "prompt_cache_options": { "mode": "implicit", "ttl": "30m" },
  "reasoning": { "effort": "medium", "context": "current_turn" },
  "input": [
    {
      "type": "message",
      "role": "developer",
      "content": [
        {
          "type": "input_text",
          "text": "<>= 1,024 tokens: static instructions + domain methodology>",
          "prompt_cache_breakpoint": { "mode": "explicit" }
        },
        {
          "type": "input_text",
          "text": "<Workspace L2 Context Card JSON (sorted keys)>",
          "prompt_cache_breakpoint": { "mode": "explicit" }
        }
      ]
    },
    {
      "type": "message",
      "role": "user",
      "content": [
        {
          "type": "input_text",
          "text": "<dynamic retrieved RAG chunks + current user question>"
        }
      ]
    }
  ],
  "tools": []
}
```

> **On GPT-5.6 PTU-M:** Omit `prompt_cache_options` and `prompt_cache_breakpoint`, while keeping `prompt_cache_key`, `reasoning.context`, and deterministic Pos 1–6 ordering intact.

### B. Chat Completions API (`/openai/v1/chat/completions`) — `explicit` Mode

```json
{
  "model": "gpt-5-6-rubric-std",
  "prompt_cache_key": "doc-review:control-evaluator:v12:shard-0",
  "prompt_cache_options": { "mode": "explicit", "ttl": "30m" },
  "messages": [
    {
      "role": "system",
      "content": [
        {
          "type": "text",
          "text": "<>= 1,024 tokens: static system + evaluation rubric>",
          "prompt_cache_breakpoint": { "mode": "explicit" }
        }
      ]
    },
    {
      "role": "user",
      "content": "<dynamic rubric item + evidence excerpt>"
    }
  ]
}
```
