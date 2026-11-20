---
title: "01 · Executive Thesis & Agent Industrialization"
description: Architectural thesis for taking multi-step tool-using and RAG-grounded enterprise agents from single-process prototypes to microVM-isolated, deterministically gated production systems.
---

# 01 · Executive Thesis & Agent Industrialization

<PlaybookMeta
  track="04 · Sandboxed Agentic Harness, Foundry IQ RAG & 7-Layer Evals"
  provenance="Customer-Zero Validated (Enterprise Proposal, Research & Compliance Agent Platform)"
  governance="Sanitized · Peer Reviewed · IP Screened"
  owners="John Luo (@jluocsa) · Co-Authors Welcome"
  verified="2026-11-19 PST"
  status="Live v2.0"
  paperHref="/papers/enterprise-foundry-platform-blueprint"
  paperLabel="Full-Stack Blueprint →"
  studioHref="/studio/#agent-eval"
  studioLabel="Sandbox & Eval Builder →"
  kitHref="/papers/engineering-kits#agent-gate"
  kitLabel="agent_release_gate.py →"
/>

<PageBrief
  stage="start"
  readTime="4 min read"
  problem="Agentic prototypes that run tools inside shared web servers, ingest raw binary PDFs ad-hoc, or rely solely on LLM-as-judge CI scores fail enterprise security reviews and flake during releases."
  takeaway="Separate the stateless web orchestrator from microVM-isolated ACA Session Containers, convert documents via Azure Content Understanding, ground retrieval via Foundry IQ MCP, and gate CI with deterministic contracts."
  csaUse="Walk through the 5-stage agent architecture diagram below when reviewing multi-agent, code-executing, or document-heavy workloads."
/>

## Four Structural Gaps Between an Agent Demo and an Enterprise System

1. **Runtime Blast Radius (Shared Process vs. MicroVM Isolation):** When an agent executes Python/Bash tools, parses untrusted uploads, or writes workspace artifacts inside a multi-user web container, one prompt-injected file or runaway subprocess compromises sibling sessions. Production agents isolate execution inside **one microVM container per session** (`Azure Container Apps Dynamic Sessions / Sandboxes`) while keeping the orchestrator completely SDK-free <span class="ev-badge ev-m">[M]</span> <span class="ev-badge ev-arch">[Arch]</span>.
2. **Binary Document Fidelity:** Passing unparsed PDFs or brittle regex text dumps into prompts breaks tables and loses section hierarchy. Converting uploaded documents through **ADLS Gen2 + Azure Content Understanding** produces layout-faithful Markdown before the agent reasons over it <span class="ev-badge ev-m">[M]</span> <span class="ev-badge ev-arch">[Arch]</span>.
3. **Retrieval Hallucination & Access Bleed:** Naive top-k vector similarity misses multi-faceted domain questions and ignores document ACLs. Connecting agents to **Foundry IQ (`Azure AI Search` Agentic Retrieval MCP)** combines query decomposition, hybrid + semantic reranking, security trimming, and structured source citations <span class="ev-badge ev-m">[M]</span>.
4. **Flaky LLM-Only Release Pipelines:** Using a non-deterministic LLM judge as a hard CI blocker produces false-positive build failures and misses hard contract regressions (broken tool schemas, missing citations, `0%` cache hits). **Deterministic checks must gate CI/CD; LLM judges advise and score quality trends** <span class="ev-badge ev-arch">[Arch]</span> <span class="ev-badge ev-agree">[Agree]</span>.

<div class="arch-diagram">
  <svg viewBox="0 0 760 176" role="img" aria-labelledby="pb4-t1-title pb4-t1-desc" font-family="Segoe UI, Inter, -apple-system, sans-serif">
    <title id="pb4-t1-title">Industrialized Enterprise Agentic Architecture Flow</title>
    <desc id="pb4-t1-desc">Shows 1 Browser AG-UI Client, 2 Stateless FastAPI/API Orchestrator proxying SSE and Content Understanding uploads, 3 MicroVM-Isolated ACA Session Container running Agent SDK and Skills, 4 Foundry IQ MCP Grounded Search and APIM Gateway, and 5 Deterministic CI + gen_ai OTel Release Gates.</desc>
    <defs><marker id="ag-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#0f766e"/></marker></defs>
    <rect x="8" y="24" width="132" height="106" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="16" y="43" font-size="9.0" font-weight="700" fill="#183e62">1. AG-UI Frontend</text>
    <text x="16" y="59" font-size="8.0" fill="#334e68">&bull; Typed SSE reducer</text>
    <text x="16" y="73" font-size="8.0" fill="#334e68">&bull; Tool &amp; delta events</text>
    <text x="16" y="87" font-size="8.0" fill="#334e68">&bull; Multipart uploads</text>
    <text x="16" y="112" font-size="7.7" font-weight="700" fill="#1d4ed8">[Zero Upstream Keys]</text>
    <path d="M140 77 H158" stroke="#0f766e" stroke-width="1.8" marker-end="url(#ag-arr)"/>
    <rect x="162" y="24" width="142" height="106" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="170" y="43" font-size="9.0" font-weight="700" fill="#183e62">2. Orchestrator Tier</text>
    <text x="170" y="59" font-size="8.0" fill="#334e68">&bull; Never runs Agent SDK</text>
    <text x="170" y="73" font-size="8.0" fill="#334e68">&bull; Unbuffered SSE proxy</text>
    <text x="170" y="87" font-size="8.0" fill="#334e68">&bull; ADLS + Content Underst.</text>
    <text x="170" y="112" font-size="7.7" font-weight="700" fill="#1d4ed8">[Token Forwarding]</text>
    <path d="M304 77 H322" stroke="#0f766e" stroke-width="1.8" marker-end="url(#ag-arr)"/>
    <rect x="326" y="24" width="146" height="106" rx="6" fill="#f5f3ff" stroke="#7c3aed" stroke-width="1.5"/>
    <text x="334" y="43" font-size="9.0" font-weight="700" fill="#5b21b6">3. ACA MicroVM Pool</text>
    <text x="334" y="59" font-size="8.0" fill="#334e68">&bull; 1 container / session</text>
    <text x="334" y="73" font-size="8.0" fill="#334e68">&bull; Scoped WORKSPACE</text>
    <text x="334" y="87" font-size="8.0" fill="#334e68">&bull; Modular skill files</text>
    <text x="334" y="112" font-size="7.7" font-weight="700" fill="#6d28d9">[Hypervisor Boundary]</text>
    <path d="M472 77 H490" stroke="#0f766e" stroke-width="1.8" marker-end="url(#ag-arr)"/>
    <rect x="494" y="24" width="128" height="106" rx="6" fill="#eaf7f5" stroke="#0f766e" stroke-width="1.5"/>
    <text x="502" y="43" font-size="9.0" font-weight="700" fill="#115e59">4. Foundry + IQ MCP</text>
    <text x="502" y="59" font-size="8.0" fill="#334e68">&bull; Pos 1–6 cached LLM</text>
    <text x="502" y="73" font-size="8.0" fill="#334e68">&bull; AI Search MCP tool</text>
    <text x="502" y="87" font-size="8.0" fill="#334e68">&bull; APIM 429 spillover</text>
    <text x="502" y="112" font-size="7.7" font-weight="700" fill="#0f766e">[Grounded Citations]</text>
    <path d="M622 77 H640" stroke="#0f766e" stroke-width="1.8" marker-end="url(#ag-arr)"/>
    <rect x="644" y="24" width="108" height="106" rx="6" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.5"/>
    <text x="652" y="43" font-size="9.0" font-weight="700" fill="#115e59">5. Eval &amp; OTel</text>
    <text x="652" y="59" font-size="8.0" fill="#334e68">&bull; Contract CLI gate</text>
    <text x="652" y="73" font-size="8.0" fill="#334e68">&bull; Waza skill evals</text>
    <text x="652" y="87" font-size="8.0" fill="#334e68">&bull; gen_ai.* traces</text>
    <text x="652" y="112" font-size="7.7" font-weight="700" fill="#0f766e">[A1–A12 Signed]</text>
    <text x="10" y="156" font-size="8.3" fill="#526c80">Reference 3-tier isolated agent platform integrating ACA sandboxes, Content Understanding, Foundry IQ MCP, and contract CI gates.</text>
  </svg>
</div>

---

## Core Engineering Questions Answered in Playbook 04

| Question | Verified Architectural Answer | Chapter |
| :--- | :--- | :--- |
| **How do we isolate per-user file uploads and agent tool execution without managing Kubernetes clusters?** | Proxy requests from a stateless orchestrator into **Azure Container Apps Dynamic Sessions / Sandboxes** (Hyper-V microVM isolation per session identifier) and deploy images strictly by **Git commit SHA** (never `:latest`) <span class="ev-badge ev-m">[M]</span> <span class="ev-badge ev-arch">[Arch]</span>. | [02 · 3-Tier Sandbox Harness](./02-sandboxed-agent-harness) |
| **How should agents retrieve enterprise documents without custom vector glue code or cross-client leaks?** | Attach **Azure AI Search Knowledge Bases (`Foundry IQ`)** via its native MCP endpoint (`knowledge_base_retrieve`) with Entra bearer tokens and document-level security trimming <span class="ev-badge ev-m">[M]</span>. | [03 · Foundry IQ Grounded RAG](./03-foundry-iq-grounded-rag) |
| **How do we test multi-turn agents and skills in CI without flaky LLM-judge build breaks?** | Enforce **deterministic acceptance contracts** (schema validity, citation span match, forbidden tool checks, cache-hit parity) as hard PR blockers, while running LLM judges as advisory quality scorecards <span class="ev-badge ev-arch">[Arch]</span>. | [04 · Deterministic Eval Contracts](./04-deterministic-eval-contracts) |
| **What telemetry spans are required to debug slow or failing multi-agent workflows in production?** | Emit correlated OpenTelemetry `gen_ai.*` spans across Orchestrator, APIM, Agent Node, and MCP Tool calls, gated by `A1–A12`. | [05 · OTel Tracing & A1–A12](./05-otel-tracing-release-gates) |
