---
title: 05 · Enterprise Agent Node Archetypes
description: Eight recurring enterprise LLM node archetypes with prefix sizes, primary cache-miss risks, target cached shares, and GPT-5.6+ prescriptions.
---

# 05 · Enterprise Agent Node Archetypes

<PageBrief
  stage="qualify"
  readTime="3 min read"
  problem="Multi-agent workflows often contain 6–12 LLM nodes, and refactoring low-traffic nodes first delays high-impact savings or incurs write fees on short prompts."
  takeaway="Rank all nodes by Peak RPM × Prefix Tokens, refactor the top 3 high-volume nodes first (75–85% of spend), and disable cache writes below 1,024 tokens."
  csaUse="Map each node in an agent graph to one of the 8 archetypes below during Week 1 to prioritize refactoring."
/>

Multi-node enterprise AI platforms (such as rubric-scoring evaluators, compliance reviewers, and multi-agent RAG orchestrators) combine distinct LLM node archetypes with different prefix sizes, RPM profiles, and SKU controls <span class="ev-badge ev-arch">[Arch]</span>.

<div class="arch-diagram">
  <svg viewBox="0 0 760 138" role="img" aria-labelledby="arch-prio-title arch-prio-desc" font-family="Segoe UI, Inter, -apple-system, sans-serif">
    <title id="arch-prio-title">Agent Node Refactoring Triage by Prefix Size and Traffic</title>
    <desc id="arch-prio-desc">Shows three triage buckets: Priority 1 Large Prefix and High RPM (Top 3 nodes = 75-85% of PTU draw), Priority 2 Multi-Turn and Verifier Nodes (dedicated cache keys and current_turn reasoning), and Priority 3 Short One-Shot Nodes below 1,024 tokens (disable cache writes).</desc>
    <rect x="8" y="12" width="242" height="90" rx="6" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.5"/>
    <text x="18" y="31" font-size="9.3" font-weight="700" fill="#115e59">Tier 1 · Refactor First (75–85% Spend)</text>
    <text x="18" y="47" font-size="8.2" fill="#334e68">Rubric Evaluators, Taxonomy Classifiers,</text>
    <text x="18" y="60" font-size="8.2" fill="#334e68">Summarizers &amp; Tool Orchestrators</text>
    <text x="18" y="74" font-size="8.2" fill="#334e68">Prefix: 2,000–8,000t &middot; High RPM</text>
    <text x="18" y="91" font-size="7.8" font-weight="700" fill="#0f766e">[Pos 1–6 Order + Breakpoints + Shards]</text>
    <rect x="260" y="12" width="240" height="90" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="270" y="31" font-size="9.3" font-weight="700" fill="#183e62">Tier 2 · Isolate Keys &amp; Pin Reasoning</text>
    <text x="270" y="47" font-size="8.2" fill="#334e68">Guardrail Routers, Citation Verifiers &amp;</text>
    <text x="270" y="60" font-size="8.2" fill="#334e68">Multi-Turn Follow-Up Rewriters</text>
    <text x="270" y="74" font-size="8.2" fill="#334e68">Prefix: 1,200–4,000t &middot; Burst Concurrency</text>
    <text x="270" y="91" font-size="7.8" font-weight="700" fill="#1d4ed8">[Separate Key + current_turn Pin]</text>
    <rect x="510" y="12" width="242" height="90" rx="6" fill="#fff7eb" stroke="#d97706" stroke-width="1.4"/>
    <text x="520" y="31" font-size="9.3" font-weight="700" fill="#92400e">Tier 3 · Bypass Cache (&lt;1,024 Tokens)</text>
    <text x="520" y="47" font-size="8.2" fill="#334e68">Short One-Shot Entity Extractors &amp;</text>
    <text x="520" y="60" font-size="8.2" fill="#334e68">Lightweight Keyword / JSON Helpers</text>
    <text x="520" y="74" font-size="8.2" fill="#334e68">Prefix: &lt;1,024t (cannot hit cache [M])</text>
    <text x="520" y="91" font-size="7.8" font-weight="700" fill="#b45309">[mode: "explicit" + 0 Breakpoints]</text>
    <text x="10" y="124" font-size="8.4" fill="#526c80">Week 1 rule of thumb: sort all nodes by Peak RPM &times; Prompt Tokens and fix the top 3 nodes before touching minor helpers.</text>
  </svg>
</div>

## Archetype Classification & Caching Prescription Matrix `[Arch]`

| Agent Node Archetype | Typical Prefix (Pos 1–4) | Primary Cache-Miss Risk on Migration | Target Cached Share <span class="ev-badge ev-agree">[Agree]</span> | GPT-5.6+ Caching Prescription |
| :--- | :--- | :--- | :--- | :--- |
| **1. Rubric / Control Evaluator** | `2,500–6,000` tok (rubric + schema) | Dynamic enum values mutated inside `response_format` or Pos 1 system prompt. | **70%–85%** | Static `response_format`; Breakpoint #1 after Pos 3 rubric; evidence payload in Pos 6. |
| **2. Evidence & Document Summarizer** | `1,800–4,500` tok (policy + L2 card) | Retrieved RAG chunks prepended ahead of synthesis instructions. | **60%–75%** | Breakpoint #1 on `T0` policy, Breakpoint #2 on `L2` card; RAG chunks in Pos 6. |
| **3. High-RPM Guardrail / Intent Router** | `1,200–2,000` tok (routing rules) | Exceeding `~15 RPM` on a single unsharded `prompt_cache_key` at peak load. | **80%–90%** | Shard `prompt_cache_key` across `N = ⌈RPM ÷ 12⌉` deterministic buckets. |
| **4. Methodology & Taxonomy Classifier** | `3,000–8,000` tok (taxonomy catalog) | Taxonomy definitions rebuilt in non-deterministic dictionary order across replicas. | **85%–92%** | Canonical JSON sort (`sort_keys=True`); Breakpoint #1 after catalog. |
| **5. Tool-Calling Orchestrator** | `2,000–5,500` tok (`tools[]` + skills) | Per-turn tool filtering or unsorted MCP `tools[]` array invalidating Pos 2. | **65%–80%** | Pin stable toolset per skill family; sort `tools[]` by function name. |
| **6. Groundedness & Citation Verifier** | `1,500–3,200` tok (verification rubric) | Sharing the same `prompt_cache_key` as the generator node, thrashing cache slots. | **70%–85%** | Dedicated verifier `prompt_cache_key`; pin `reasoning.context: "current_turn"`. |
| **7. Multi-Turn Follow-Up Rewriter** | `1,200–4,000` tok (sys + history) | Sliding-window front truncation or GPT-5.6/6 default `all_turns` reasoning bloat. | **65%–80%** | Append-only session turns in Pos 5; pin `reasoning.context: "current_turn"`. |
| **8. One-Shot Short-Prefix Extractor** | `<1,024` tok (below min threshold) | Paying `1.25x` cache-write weight on one-shot calls with zero subsequent reads. | **N/A (`<1,024t`)** | Set `prompt_cache_options: {"mode":"explicit"}` with zero breakpoints on Standard / 6+. |

::: tip Portfolio Prioritization Rule
During Week 1 of a [Readiness Engagement](/operating-model/delivery-scoping), rank all LLM nodes by **`Peak RPM × Prompt Tokens`** and refactor the top 3 archetypes first—they typically account for **75%–85% of total PTU and token spend**.
:::
