---
title: 02 · Stateless Agents & Per-Turn Hydration Tax
description: Why Model 2 stateless enterprise web backends depend on Azure OpenAI KV prefix caching as their cross-turn hydration memory.
---

# 02 · Stateless Agent Runtimes & the Hydration Tax

<PageBrief
  stage="start"
  readTime="3 min read"
  problem="Cloud container backends forget state between HTTP requests—resending 4,000–12,000 instruction and tool tokens on every single turn."
  takeaway="In a stateless web service (Model 2), Azure OpenAI prompt caching is your cross-turn memory; breaking the prefix pays full cost 3–8× per user turn."
  csaUse="Use the diagram below to illustrate why stateful local CLI prototypes behave differently from stateless production container services."
/>

Production enterprise agent platforms follow a **Model 2 stateless web backend pattern** (constructed and torn down on every HTTP request) rather than a **Model 1 stateful local CLI process** (resident in memory across turns) <span class="ev-badge ev-arch">[Arch]</span>.

Each turn hydrates three context tiers and transmits the full prompt over the wire:

- **`T0` (Global Static Layer):** Read-only system policies, skill headers, sorted tool schemas, and domain methodology mounted in the container image.
- **`L2` (Workspace / Case Context Card):** Shared engagement, project, or tenant scope facts loaded from the application database.
- **`L1` (User Persona & Session Checkpoints):** Operator preferences and append-only conversation turns rehydrated by `thread_id`.

## Per-Turn Hydration vs. Azure OpenAI KV Prefix Cache

<div class="arch-diagram">
  <svg viewBox="0 0 700 186" role="img" aria-labelledby="hydrate-title hydrate-desc">
    <title id="hydrate-title">Model 2 Stateless Enterprise Agent Runtime per-turn hydration vs. Azure OpenAI KV prefix cache</title>
    <desc id="hydrate-desc">Shows how each HTTP turn constructs a fresh stateless agent instance, hydrates T0 static skills/schemas and L1/L2 session stores through a Composite Context Loader and Session Context Middleware, and relies on the Azure OpenAI KV Prefix Cache to avoid reprocessing static tokens on every turn.</desc>
    <defs><marker id="arr02" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#16858a"/></marker></defs>
    <rect x="6" y="10" width="132" height="156" rx="6" fill="#edf3fb" stroke="#93adc7"/>
    <text x="16" y="29" font-size="10.5" font-weight="700" fill="#183e62">Durable Context Stores</text>
    <rect x="14" y="38" width="116" height="34" rx="4" fill="#fff" stroke="#b0c4de"/>
    <text x="20" y="52" font-size="9.0" font-weight="700" fill="#143d65">T0 Static Layer (RO)</text>
    <text x="20" y="65" font-size="8.2" fill="#526c80">Skills, tools, domain rules</text>
    <rect x="14" y="78" width="116" height="40" rx="4" fill="#fff" stroke="#b0c4de"/>
    <text x="20" y="92" font-size="9.0" font-weight="700" fill="#143d65">Session &amp; Context DB</text>
    <text x="20" y="104" font-size="8.2" fill="#526c80">L2 Workspace Card, L1</text>
    <text x="20" y="114" font-size="8.2" fill="#526c80">Persona &amp; Checkpoints</text>
    <rect x="14" y="124" width="116" height="34" rx="4" fill="#fff7eb" stroke="#d99b52"/>
    <text x="20" y="138" font-size="9.0" font-weight="700" fill="#8a4b0f">Live RAG &amp; MCP Tools</text>
    <text x="20" y="150" font-size="8.2" fill="#8a4b0f">AI Search, Enterprise APIs</text>
    <path d="M138 55 H164" stroke="#16858a" stroke-width="1.8" marker-end="url(#arr02)"/>
    <path d="M138 98 H164" stroke="#16858a" stroke-width="1.8" marker-end="url(#arr02)"/>
    <path d="M138 141 H164" stroke="#16858a" stroke-width="1.8" marker-end="url(#arr02)"/>
    <rect x="168" y="10" width="246" height="156" rx="6" fill="#f8fafc" stroke="#93adc7"/>
    <text x="178" y="29" font-size="10.2" font-weight="700" fill="#183e62">Stateless Agent Turn (Per-Request Lifecycle)</text>
    <rect x="178" y="38" width="226" height="36" rx="4" fill="#eaf4f5" stroke="#6ca9a8"/>
    <text x="185" y="53" font-size="9.2" font-weight="700" fill="#115e63">Composite Context Loader</text>
    <text x="185" y="66" font-size="8.3" fill="#355d65">Loads static T0 rules, L2 scope, L1 persona</text>
    <rect x="178" y="80" width="226" height="38" rx="4" fill="#eaf4f5" stroke="#6ca9a8"/>
    <text x="185" y="95" font-size="9.2" font-weight="700" fill="#115e63">Session Context Middleware</text>
    <text x="185" y="108" font-size="8.3" fill="#355d65">Assembles ordered prefix + canonical tool JSON</text>
    <rect x="178" y="124" width="226" height="34" rx="4" fill="#edf3fb" stroke="#93adc7"/>
    <text x="185" y="138" font-size="9.2" font-weight="700" fill="#183e62">API Wire Payload (Responses / Chat API)</text>
    <text x="185" y="150" font-size="8.3" fill="#35556f">Sends full hydrated prompt prefix every turn</text>
    <path d="M414 88 H442" stroke="#16858a" stroke-width="2.2" marker-end="url(#arr02)"/>
    <rect x="446" y="10" width="248" height="156" rx="6" fill="#eaf7f5" stroke="#16858a" stroke-width="1.5"/>
    <text x="456" y="29" font-size="10.5" font-weight="700" fill="#115e63">Azure OpenAI / Foundry Model KV Cache</text>
    <rect x="456" y="38" width="228" height="54" rx="4" fill="#fff" stroke="#16858a"/>
    <text x="463" y="53" font-size="9.2" font-weight="700" fill="#0e7279">Cached Prefix Hit (cached_tokens &ge; 1,024)</text>
    <text x="463" y="66" font-size="8.3" fill="#355d65">Reuses KV tensors for T0 skills/tools/ontology &amp; L2.</text>
    <text x="463" y="79" font-size="8.3" font-weight="700" fill="#0e7279">PTU 5.6: 0% capacity draw | Std: discounted read</text>
    <rect x="456" y="98" width="228" height="58" rx="4" fill="#fdecea" stroke="#d9534f"/>
    <text x="463" y="113" font-size="9.2" font-weight="700" fill="#a93226">If Prefix Mutates Early (e.g. timestamp at Pos 1)</text>
    <text x="463" y="126" font-size="8.3" fill="#a93226">Recomputes all 4k–12k hydrated tokens every turn;</text>
    <text x="463" y="139" font-size="8.3" font-weight="700" fill="#a93226">100% PTU/TPM draw + unamortized cache-write fee</text>
    <text x="8" y="180" font-size="8.8" fill="#526c80">Reference stateless enterprise agent pattern: per-turn context hydration paired with Azure OpenAI KV prefix caching.</text>
  </svg>
</div>

## Model 1 (Stateful Local CLI) vs. Model 2 (Stateless Enterprise Backend) `[Arch]`

| Runtime Property | Model 1 — Stateful Local Agent (CLI) | Model 2 — Stateless Enterprise Backend (Container Service) |
| :--- | :--- | :--- |
| **Process & state lifetime** | Long-lived process; local disk and in-memory state remain warm across the session. | **Constructed and destroyed per turn:** Each HTTP request executes one turn and tears down; no state survives in process memory between turns. |
| **Skills & domain rules** | Local skill files and prompt templates loaded once at startup. | **Container image & registry mounts (`T0`):** Static system policies, skill definitions, and domain rubrics assembled into the prompt on every turn. |
| **Context hydration** | Cumulative transcript stays resident in local process memory. | Rehydrated per request from durable session checkpoints (by `thread_id`) + scoped **Workspace (`L2`)** and **User (`L1`)** context records. |
| **Token & PTU cost model** | Static context reads amortize across the local process lifetime. | **Every LLM call pays a hydration tax over the wire** unless the assembled prompt prefix hits the **Azure OpenAI KV Prefix Cache**. |

::: tip Core Architectural Insight
Because a stateless backend rehydrates and resends system instructions, skill catalogs, tool schemas, domain methodology, and checkpointed history on *every single LLM call*—and a single user turn in a multi-node review graph invokes the LLM **3 to 8 times**—**Azure OpenAI prompt caching is the stateless backend's cross-turn memory**. Preserving byte-identical prefix ordering across turns is an architectural invariant, not a micro-optimization.
:::
