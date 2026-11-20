---
title: 08 · Eliminating Prefix-Breaking Anti-Patterns
description: Six concrete code-level causes of cache misses in agent harnesses and how to refactor context assembly middleware.
---

# 08 · Eliminating Prefix-Breaking Anti-Patterns

<PageBrief
  stage="design"
  readTime="4 min read"
  problem="One dynamic character—like a timestamp or unsorted JSON key—in the first 1,024 tokens silently forces 0% cache hits across all calls."
  takeaway="Strip timestamps and user IDs from Pos 1–3, sort tools[] and JSON keys deterministically, keep response_format static, and push RAG chunks to Pos 6."
  csaUse="Compare the Before vs. After visual and Python code snippet below directly against context-assembly middleware during Week 1/2."
/>

A single dynamic byte inside the first 1,024 tokens forces `cached_tokens = 0` and, on GPT-5.6+ Standard or GPT-6+ PTU-M, writes a new unamortized cache entry <span class="ev-badge ev-m">[M]</span>. Below are the six prefix-breaking patterns most frequently uncovered during codebase audits.

<div class="arch-diagram">
  <svg viewBox="0 0 760 162" role="img" aria-labelledby="ap-title ap-desc" font-family="Segoe UI, Inter, -apple-system, sans-serif">
    <title id="ap-title">Broken Prompt Assembly versus Cache-Ready Prefix Assembly</title>
    <desc id="ap-desc">Top row shows timestamp at token 15 invalidating 8,000 downstream tokens every call. Bottom row shows static T0 and sorted tools locked first so 80 percent+ of tokens hit the cache while dynamic RAG stays at the tail.</desc>
    <text x="10" y="19" font-size="9.0" font-weight="700" fill="#991b1b">BROKEN MIDDLEWARE (0% CACHE HIT — EVERY CALL RECOMPUTES ALL TOKENS)</text>
    <rect x="10" y="26" width="154" height="44" rx="5" fill="#fef2f2" stroke="#dc2626" stroke-width="1.3"/>
    <text x="18" y="44" font-size="8.8" font-weight="700" fill="#991b1b">Token 15: Timestamp!</text>
    <text x="18" y="59" font-size="8.0" fill="#991b1b">req_ctx / user_id mutates</text>
    <rect x="170" y="26" width="184" height="44" rx="5" fill="#fffbeb" stroke="#d97706" stroke-dasharray="4 2"/>
    <text x="178" y="44" font-size="8.8" font-weight="700" fill="#92400e">Unsorted tools[] + RAG</text>
    <text x="178" y="59" font-size="8.0" fill="#92400e">Invalidated downstream</text>
    <rect x="360" y="26" width="214" height="44" rx="5" fill="#fffbeb" stroke="#d97706" stroke-dasharray="4 2"/>
    <text x="368" y="44" font-size="8.8" font-weight="700" fill="#92400e">Static Policy &amp; Rubric (6,000t)</text>
    <text x="368" y="59" font-size="8.0" fill="#92400e">Never cached because Token 15 changed</text>
    <rect x="580" y="26" width="170" height="44" rx="5" fill="#fef2f2" stroke="#dc2626" stroke-width="1.3"/>
    <text x="588" y="44" font-size="8.8" font-weight="700" fill="#991b1b">cached_tokens = 0</text>
    <text x="588" y="59" font-size="8.0" font-weight="700" fill="#b91c1c">[2.56&times; PTU Draw + Write Fee]</text>

    <line x1="10" y1="84" x2="750" y2="84" stroke="#cbd5e1" stroke-dasharray="4 4"/>

    <text x="10" y="101" font-size="9.0" font-weight="700" fill="#0f766e">CACHE-READY MIDDLEWARE (80%+ CACHE HIT — DYNAMIC TAIL ISOLATED AT POS 6)</text>
    <rect x="10" y="108" width="248" height="44" rx="5" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.5"/>
    <text x="18" y="126" font-size="8.8" font-weight="700" fill="#115e59">Pos 1–3: Static T0 + Sorted tools[] (&ge;1,024t)</text>
    <text x="18" y="141" font-size="8.0" fill="#0f766e">100% byte-identical across all users &amp; pods</text>
    <rect x="264" y="108" width="162" height="44" rx="5" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="272" y="126" font-size="8.8" font-weight="700" fill="#183e62">Pos 4–5: L2 Card &amp; Turns</text>
    <text x="272" y="141" font-size="8.0" fill="#334e68">Reused per case &amp; session</text>
    <rect x="432" y="108" width="142" height="44" rx="5" fill="#fff7eb" stroke="#d97706" stroke-width="1.3"/>
    <text x="440" y="126" font-size="8.8" font-weight="700" fill="#92400e">Pos 6: RAG &amp; Query</text>
    <text x="440" y="141" font-size="8.0" fill="#92400e">Mutates safely at tail</text>
    <rect x="580" y="108" width="170" height="44" rx="5" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.5"/>
    <text x="588" y="126" font-size="8.8" font-weight="700" fill="#115e59">cached_tokens &ge; 6,000</text>
    <text x="588" y="141" font-size="8.0" font-weight="700" fill="#0f766e">[Fast TTFT &middot; Low PTU Draw]</text>
  </svg>
</div>

## Six Middleware & Tooling Anti-Patterns `[Arch]`

| Anti-Pattern | Why It Breaks Caching in the Agent Runtime | Required Engineering Fix |
| :--- | :--- | :--- |
| **1. Early request-context timestamp & user ID injection** | Middleware prepending `request_timestamp: "2026-11-18T21:21:00Z"` or `user_id` at the top of `system` mutates the prefix around token `~40` on every call. | Keep Positions 1–3 100% user- and time-agnostic. Place scoped `L2`/`L1` cards at Positions 4–5, and pass timestamps in Position 6 only when date reasoning is needed. |
| **2. Non-deterministic `tools[]` schema serialization** | Building an agent's toolset from an unordered `set`/dict or dynamic MCP discovery changes tool order or JSON key order across container replicas. | Sort tools by `tool["function"]["name"]` (or Responses `tool["name"]`) and canonicalize schemas with `json.dumps(..., sort_keys=True)` at startup. |
| **3. Dynamic `response_format` schema mutations** | Azure OpenAI prepends the structured output schema *before* the system message <span class="ev-badge ev-m">[M]</span>. Mutating enum lists or field descriptions per request invalidates token `0`. | Keep `response_format` schemas static per node/skill version; pass dynamic allowed codes in Position 6 instead of mutating the JSON schema. |
| **4. Prepending RAG passages ahead of instructions** | Prompt templates placing retrieved search chunks at the top (*"Given these documents..."*) invalidate everything after token `0` on every query. | Move static role, policy, rubric rules, and few-shot examples to Positions 1–3; inject retrieved RAG passages inside the final user turn (Position 6). |
| **5. Sliding-window front truncation & unbounded `all_turns` reasoning** | Dropping turn 1 when turn 6 arrives shifts every subsequent token offset; meanwhile `gpt-5.6`/`6` default `reasoning.context` to `all_turns` <span class="ev-badge ev-m">[M]</span>, inflating multi-turn input tokens. | Keep history append-only within a session window; set `reasoning.context: "current_turn"` when cross-turn reasoning replay is unnecessary, and compact via periodic checkpoints. |
| **6. Per-turn tool filtering ahead of static context** | Adding/removing tools dynamically on every turn mutates Position 2, invalidating Position 3 static reference blocks that follow. | Keep a stable toolset per skill/node family (and route distinct skills to separate `prompt_cache_key` prefixes). |

## Middleware Refactoring Pattern (Before vs. After)

```python
import json

# ❌ ANTI-PATTERN: Injecting live timestamp & user_id at the top of the system prompt
def build_messages_broken(req_ctx: dict, static_policy: str, domain_methodology: str, rag_chunks: str, query: str):
    # Token ~15 mutates on EVERY call because req_ctx["timestamp"] is a live ISO timestamp!
    sys_text = f"<session_context>{json.dumps(req_ctx)}</session_context>\n{static_policy}\n{domain_methodology}"
    return [{"role": "system", "content": sys_text}, {"role": "user", "content": f"{rag_chunks}\n{query}"}]


# ✅ CACHE-READY PATTERN: Keep system + tools[] 100% Global T0 (Pos 1-3); place L2/L1 after tools[] (Pos 4-5)
def build_messages_cache_ready(
    static_policy: str,
    domain_methodology: str,
    l2_workspace_card: dict,
    l1_persona_card: dict,
    history: list[dict],
    rag_chunks: str,
    query: str,
    supports_explicit_breakpoints: bool,  # True on Standard 5.6+ & PTU-M GPT-6+; False on PTU-M GPT-5.6
):
    t0_block = {"type": "text", "text": f"{static_policy}\n\n{domain_methodology}"}      # Pos 1 & 3 (Global T0 >= 1,024t)
    l2_block = {"type": "text", "text": json.dumps(l2_workspace_card, sort_keys=True)}   # Pos 4 (shared per scope_id)
    l1_block = {"type": "text", "text": json.dumps(l1_persona_card, sort_keys=True)}     # Pos 5a (shared per user_id)

    if supports_explicit_breakpoints:
        t0_block["prompt_cache_breakpoint"] = {"mode": "explicit"}  # Breakpoint #1: global T0 + tools[] reuse
        l2_block["prompt_cache_breakpoint"] = {"mode": "explicit"}  # Breakpoint #2: workspace-wide L2 reuse

    return [
        {"role": "system", "content": [t0_block]},       # Rendered with sorted tools[] ahead of conversation messages
        {"role": "developer", "content": [l2_block, l1_block]},  # Pos 4-5a: scoped context after Global T0 + tools[]
        *history,                                        # Pos 5b: append-only checkpointed turns
        {"role": "user", "content": f"<retrieved_grounding>\n{rag_chunks}\n</retrieved_grounding>\n\n{query}"},  # Pos 6
    ]
```
