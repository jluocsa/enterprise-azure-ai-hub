---
title: 07 · Scope × Volatility Prefix Architecture (Pos 1–6)
description: Mapping orthogonal Scope and Volatility context axes onto strict prompt prefix positions 1 through 6.
---

# 07 · Scope × Volatility Prefix Architecture

<PageBrief
  stage="design"
  readTime="4 min read"
  problem="Mixing global instructions, workspace metadata, session history, and live RAG chunks in arbitrary order destroys cross-user and cross-turn cache hits."
  takeaway="Order every prompt strictly from most-shared & static (Pos 1–3 Global T0) to workspace-scoped (Pos 4 L2), session-scoped (Pos 5 L1), and live RAG last (Pos 6)."
  csaUse="Use the Pos 1–6 diagram below during design reviews to map every prompt block onto its exact scope and volatility position."
/>

Enterprise agent context divides cleanly along two orthogonal axes <span class="ev-badge ev-arch">[Arch]</span>:

- **Axis A — Scope:** `Global` (all users & workspaces) &rarr; `Workspace / Case` (`scope_id`) &rarr; `User / Thread` (`user_id`, `thread_id`).
- **Axis B — Volatility:** `Static Release (T0)` &rarr; `Low/Medium Scoped Card (L2 / L1)` &rarr; `Always-Live RAG & MCP Tail`.

Mapping those two axes onto **Prompt Positions 1–6** maximizes KV-cache reuse across *both* concurrent users and multi-turn sessions.

## Six-Position Prompt Prefix Pipeline `[Arch]`

<div class="arch-diagram">
  <svg viewBox="0 0 714 172" role="img" aria-labelledby="pipe-title pipe-desc">
    <title id="pipe-title">Six-layer enterprise AI prompt prefix ordering mapped to enterprise context tiers</title>
    <desc id="pipe-desc">Shows Positions 1 to 3 (Global T0 static schema, system policy, skill catalog, sorted tool definitions, and domain methodology layer) terminating at Breakpoint #1, followed by Position 4 (Workspace L2 Context Card) terminating at Breakpoint #2, Position 5 (User L1 Persona and append-only checkpoint history), and Position 6 (Always-live RAG chunks, enterprise MCP outputs, and current user query).</desc>
    <rect x="6" y="8" width="114" height="66" rx="5" fill="#eaf4f5" stroke="#16858a" stroke-width="1.5"/>
    <text x="12" y="25" font-size="9.8" font-weight="700" fill="#115e63">Pos 1: Schema &amp; Sys</text>
    <text x="12" y="39" font-size="8.4" fill="#355d65">response_format +</text>
    <text x="12" y="51" font-size="8.4" fill="#355d65">core role / RAI policy</text>
    <text x="12" y="65" font-size="8.0" font-weight="700" fill="#0e7279">[Global T0 | Zero Vol]</text>
    <rect x="125" y="8" width="110" height="66" rx="5" fill="#eaf4f5" stroke="#16858a" stroke-width="1.5"/>
    <text x="131" y="25" font-size="9.8" font-weight="700" fill="#115e63">Pos 2: Tools &amp; Skills</text>
    <text x="131" y="39" font-size="8.4" fill="#355d65">Shared skill headers</text>
    <text x="131" y="51" font-size="8.4" fill="#355d65">&amp; sorted tools[] JSON</text>
    <text x="131" y="65" font-size="8.0" font-weight="700" fill="#0e7279">[Global T0 | Zero Vol]</text>
    <rect x="240" y="8" width="114" height="66" rx="5" fill="#eaf4f5" stroke="#16858a" stroke-width="1.5"/>
    <text x="246" y="25" font-size="9.8" font-weight="700" fill="#115e63">Pos 3: Domain Rules</text>
    <text x="246" y="39" font-size="8.4" fill="#355d65">Domain methodology +</text>
    <text x="246" y="51" font-size="8.4" fill="#355d65">few-shot exemplars</text>
    <text x="246" y="65" font-size="8.0" font-weight="700" fill="#0e7279">[Global T0 | &ge;1,024t]</text>
    <line x1="359" y1="4" x2="359" y2="110" stroke="#d9534f" stroke-width="2" stroke-dasharray="4,2"/>
    <rect x="313" y="110" width="92" height="17" rx="3" fill="#fdecea" stroke="#d9534f"/>
    <text x="318" y="122" font-size="8.0" font-weight="700" fill="#a93226">Breakpoint #1 (T0)</text>
    <rect x="364" y="8" width="106" height="66" rx="5" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="370" y="25" font-size="9.3" font-weight="700" fill="#183e62">Pos 4: Workspace</text>
    <text x="370" y="39" font-size="8.4" fill="#35556f">Shared L2 Context</text>
    <text x="370" y="51" font-size="8.4" fill="#35556f">Card (hash-versioned)</text>
    <text x="370" y="65" font-size="8.0" font-weight="700" fill="#214f7a">[Scope: scope_id]</text>
    <line x1="475" y1="4" x2="475" y2="110" stroke="#d9534f" stroke-width="2" stroke-dasharray="4,2"/>
    <rect x="429" y="110" width="92" height="17" rx="3" fill="#fdecea" stroke="#d9534f"/>
    <text x="434" y="122" font-size="8.0" font-weight="700" fill="#a93226">Breakpoint #2 (L2)</text>
    <rect x="480" y="8" width="104" height="66" rx="5" fill="#edf3fb" stroke="#93adc7"/>
    <text x="486" y="25" font-size="9.8" font-weight="700" fill="#183e62">Pos 5: L1 &amp; History</text>
    <text x="486" y="39" font-size="8.4" fill="#35556f">Persona + session</text>
    <text x="486" y="51" font-size="8.4" fill="#35556f">append-only turns</text>
    <text x="486" y="65" font-size="8.0" font-weight="700" fill="#214f7a">[Scope: user + thread]</text>
    <rect x="589" y="8" width="119" height="66" rx="5" fill="#fff7eb" stroke="#be7730" stroke-width="1.4"/>
    <text x="595" y="25" font-size="9.8" font-weight="700" fill="#8a4b0f">Pos 6: Volatile Tail</text>
    <text x="595" y="39" font-size="8.4" fill="#8a4b0f">RAG chunks, live MCP,</text>
    <text x="595" y="51" font-size="8.4" fill="#8a4b0f">timestamps &amp; query</text>
    <text x="595" y="65" font-size="7.9" font-weight="700" fill="#985a18">[Always-Live | Uncached]</text>
    <path d="M6 84 H354" stroke="#16858a" stroke-width="2"/>
    <text x="42" y="98" font-size="8.8" font-weight="700" fill="#115e63">Shared Across All Users &amp; Workspaces (100% Cache Reuse)</text>
    <path d="M364 84 H470" stroke="#214f7a" stroke-width="2"/>
    <text x="368" y="98" font-size="8.5" font-weight="700" fill="#214f7a">Shared per Workspace</text>
    <path d="M480 84 H584" stroke="#5a7187" stroke-width="2"/>
    <text x="486" y="98" font-size="8.5" font-weight="700" fill="#5a7187">Reused in Session</text>
    <text x="8" y="148" font-size="8.8" fill="#35556f"><tspan font-weight="700" fill="#143d65">Context precedence rule:</tspan> Declare static precedence rules ("Workspace scope L2 governs domain facts; User L1 governs formatting") in Pos 1,</text>
    <text x="8" y="161" font-size="8.8" fill="#35556f">while placing the Workspace Context payload in Pos 4 and User Persona / Session History in Pos 5.</text>
  </svg>
</div>

## Context Category Mapping Table `[Arch]`

| Pos | Context Category | Source Layer | Volatility / Scope | GPT-5.6+ Caching & Breakpoint Rule |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Structured schema & core system instructions** | Release config (`response_format` + system prompt) | Zero (per release) / Global | Byte-identical across all calls to the node/skill. Strip all timestamps, user IDs, and request GUIDs. |
| **2** | **Skill catalog & tool schemas** (`tools[]`) | Container image `T0` + MCP tool registry | Zero (per release) / Global | Sort tool array by name; serialize JSON schemas with `sort_keys=True` so wire bytes never drift across pods. |
| **3** | **Domain methodology & reference exemplars** | Container image `T0` static reference packs | Low / Global | Mount static domain methodology, rubric definitions, and few-shot exemplars here. **Place Breakpoint #1 (`>=1,024t`) at end of Pos 3.** |
| **4** | **Workspace / case context card (`L2`)** | Application DB / workspace state store | Low–Med / `(scope_id)` | Schema-constrained JSON card for the active workspace/case (versioned by content hash). **Place Breakpoint #2 here** when batching calls per workspace. |
| **5** | **User persona (`L1`) & session history** | Profile store + session checkpoint store | Med / `(user_id, thread_id)` | Inject compact `L1` preferences followed by append-only checkpointed turns (enables in-session hits via the `implicit` latest-message breakpoint). |
| **6** | **Retrieved RAG chunks & live MCP outputs** | Azure AI Search, vector stores, live APIs | **High (Always-Live)** | Fetch live at use-time and place at the prompt tail alongside the current user question. **Never place a breakpoint after Pos 6.** |

::: tip Context Precedence Without Breaking the Prefix
Declare static precedence instructions (*"Workspace scope `L2` governs domain constraints; User `L1` governs output formatting"*) in **Position 1**, while keeping the actual `L2` and `L1` payloads in **Positions 4 and 5**. For strict client/matter ethical walls—including **Posture A Zero-Client-Cache Mode** (`explicit` mode with Breakpoint #1 on `T0` only, writing zero client tokens to KV cache)—see [Regulated Multi-Engagement & Compliance Platforms](/playbooks/prompt-caching/profiles/regulated-multi-engagement#1-ethical-wall-cache-isolation-zero-cross-engagement-bleed).
:::
