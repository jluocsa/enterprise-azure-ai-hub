---
title: "03 · Grounded Enterprise RAG with Foundry IQ & Ethical Trimming"
description: Integrating Azure AI Search agentic retrieval (Foundry IQ MCP) with hybrid + semantic ranking, security trimming, and Pos 6 prefix-cache preservation.
---

# 03 · Grounded Enterprise RAG with Foundry IQ & Ethical Trimming

<PlaybookMeta
  track="04 · Sandboxed Agentic Harness, Foundry IQ RAG & 7-Layer Evals"
  verified="2026-11-19 22:12 PST"
  status="Live v2.0"
/>

<PageBrief
  stage="design"
  readTime="4 min read"
  problem="Injecting retrieved RAG chunks near the top of the system prompt breaks Pos 1–3 prefix caching, while un-trimmed vector indexes risk surfacing restricted client documents."
  takeaway="Connect Azure AI Search Knowledge Bases (Foundry IQ) via its native MCP retrieval tool, enforce Entra/ACL security filters on every query, and append retrieved chunks strictly at Position 6."
  csaUse="Use this integration blueprint whenever pairing Playbook 01 prompt caching with enterprise Azure AI Search knowledge bases."
/>

## 1. Native Foundry IQ (`Azure AI Search`) MCP Tool Wiring `[M]`

Rather than maintaining bespoke query-rewriting and chunk-merging boilerplate inside every agent repository, **Azure AI Search Knowledge Bases (Foundry IQ)** expose a managed **Model Context Protocol (MCP)** endpoint (`knowledge_base_retrieve`) that decomposes complex multi-part questions, executes hybrid + semantic reranking, and returns grounded source references <span class="ev-badge ev-m">[M]</span>:

```python
# Session Container initialization: attach Foundry IQ Knowledge Base via Managed Identity
search_token = await credential.get_token("https://search.azure.com/.default")

mcp_servers = {
    "foundry-iq-kb": {
        "url": f"{azure_search_endpoint}/knowledgebases/{kb_name}/mcp?api-version=2025-11-01-preview",
        "headers": {"Authorization": f"Bearer {search_token.token}"},
        "tools": ["knowledge_base_retrieve"],
    }
}
```

---

## 2. Preserving Both Prefix Caching and Ethical Walls `[Arch]`

| Design Dimension | Anti-Pattern to Avoid | Industrialized Standard |
| :--- | :--- | :--- |
| **Prompt Placement ([Playbook 01](/playbooks/prompt-caching/design/07-prefix-taxonomy))** | Prepending `rag_chunks` into `Pos 1` `developer`/`system` instructions on every turn (`0%` `T0` cache hit). | Keep `Pos 1–3` (`T0` instructions + sorted `tools[]` including `knowledge_base_retrieve`) byte-identical; append retrieved passages in **Position 6** (or tool-output tail) <span class="ev-badge ev-arch">[Arch]</span>. |
| **Document-Level Access Control** | Indexing firm-wide and client-confidential PDFs in one flat index without security filters. | Populate `acl_group_ids` / `engagement_scope` fields at index time and enforce mandatory OData / Entra token trimming (`search.in(...)`) on every retrieval call <span class="ev-badge ev-m">[M]</span>. |
| **Citation Verifiability** | Allowing the agent to synthesize prose citations without chunk IDs or source URIs. | Require structured `[doc_id#page_or_section]` inline citations mapped to returned `knowledge_base_retrieve` reference objects; verify in CI via [`agent_release_gate.py`](/papers/engineering-kits#agent-gate). |
| **Least-Privilege RBAC** | Passing Azure AI Search admin keys (`AZURE_SEARCH_KEY`) into runtime session containers. | Restrict admin keys strictly to offline index-provisioning scripts; grant runtime Managed Identities only `Search Index Data Reader` <span class="ev-badge ev-m">[M]</span>. |
