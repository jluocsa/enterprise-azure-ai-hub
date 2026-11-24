---
title: "02 · Microsoft Fabric, OneLake & Fabric IQ Integration"
description: Integrating Microsoft Fabric, OneLake zero-copy shortcuts, Fabric IQ / Fabric Data Agents, Azure AI Search OneLake indexers, and F-SKU capacity isolation with Microsoft Foundry.
---

# 02 · Microsoft Fabric, OneLake & Fabric IQ Integration

<PlaybookMeta
  track="05 · AI Data Strategy, Fabric–Foundry & Governance"
  verified="2026-11-23 19:30 PST"
  status="Live v2.0"
  studioHref="/studio/#data-strategy"
  studioLabel="Data Strategy Advisor →"
/>

<PageBrief
  stage="design"
  readTime="6 min read"
  problem="Connecting Microsoft Foundry agents directly to raw Bronze lakes or copying tabular ERP data into vector indexes causes hallucinated KPI math, duplicate storage sprawl, and F-SKU capacity throttling."
  takeaway="Adopt OneLake zero-copy Shortcuts into a Medallion AI-Ready Gold layer, route structured/analytical questions through Fabric IQ (Ontology + Semantic Models + Fabric Data Agents), index unstructured OneLake Files via Shared Private Link, and separate interactive AI F-SKU capacities from batch ETL."
  csaUse="Use the dual-path grounding diagram and F-SKU isolation checklist below during joint Data Platform + AI Architecture workshops."
/>

## 1. Medallion Architecture Extended to `AI-Ready Gold` `[Arch]`

Enterprise data estates already standardize on **Microsoft Fabric** and **OneLake** (`Bronze → Silver → Gold`). Making that estate AI-ready does **not** require building a parallel shadow data lake. Instead, extend the Gold layer with an explicit **`AI-Ready Gold`** contract <span class="ev-badge ev-arch">[Arch]</span>:

- **Bronze (Raw Landing / Zero-Copy Shortcuts):** Reference producer domains in ADLS Gen2, Amazon S3, Google Cloud Storage, Dataverse, or cross-workspace Fabric Lakehouses using **OneLake Shortcuts** rather than duplicating raw bytes <span class="ev-badge ev-m">[M]</span>.
- **Silver (Conformed & Governed):** Deduplicate entities, apply **Microsoft Purview sensitivity labels** and domain ownership, strip PII columns where unnecessary, and validate schema contracts.
- **Gold (Curated Business Truth):** Publish governed Delta Parquet tables, Warehouses, and **Power BI Semantic Models** with certified DAX measures (revenue, margin, exposure, SLA compliance) so every BI dashboard and AI agent shares one mathematical definition <span class="ev-badge ev-m">[M]</span>.
- **AI-Ready Gold (Dual Serving Surface):**
  1. **Structured & Semantic Surface (`Fabric IQ`):** Bind curated Lakehouse tables, Warehouses, Semantic Models, and Eventhouses to **Fabric IQ** ontologies and **Fabric Data Agents**, consumed directly by **Microsoft Foundry Agent Service** as a grounded tool <span class="ev-badge ev-m">[M]</span>.
  2. **Unstructured Document Surface (`OneLake Files → Content Understanding → Azure AI Search`):** Store layout-faithful Markdown and chunk metadata alongside lineage hashes (`source_uri`, `lineage_sha256`, `sensitivity_label`, `acl_group_ids`) and index via **Azure AI Search OneLake Indexer** over a **Shared Private Link** when workspace-level Private Link is enabled <span class="ev-badge ev-m">[M]</span>.

<div class="arch-diagram">
  <svg viewBox="0 0 760 208" role="img" aria-labelledby="pb5-t2-title pb5-t2-desc" font-family="Segoe UI, Inter, -apple-system, sans-serif">
    <title id="pb5-t2-title">Dual-Path Grounding Topology: Fabric IQ Structured Path vs. Foundry IQ Unstructured Path</title>
    <desc id="pb5-t2-desc">Shows OneLake Shortcuts feeding Bronze-Silver-Gold; top lane routes curated Delta tables and Semantic Models through Fabric IQ and Fabric Data Agent to Foundry Agent Service; middle lane routes OneLake Files through Content Understanding and Shared Private Link to Azure AI Search Foundry IQ MCP; bottom lane shows Cosmos DB DiskANN Hybrid for operational memory and thread state.</desc>
    <defs><marker id="fiq-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#0f766e"/></marker></defs>
    <rect x="8" y="20" width="144" height="156" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="16" y="40" font-size="9.0" font-weight="700" fill="#183e62">OneLake Foundation</text>
    <text x="16" y="58" font-size="8.0" fill="#334e68">&bull; Zero-copy Shortcuts</text>
    <text x="16" y="72" font-size="8.0" fill="#334e68">&bull; Delta Parquet Tables</text>
    <text x="16" y="86" font-size="8.0" fill="#334e68">&bull; OneLake Files (Docs)</text>
    <text x="16" y="100" font-size="8.0" fill="#334e68">&bull; Semantic Models</text>
    <text x="16" y="114" font-size="8.0" fill="#334e68">&bull; OneLake Security</text>
    <text x="16" y="156" font-size="7.7" font-weight="700" fill="#1d4ed8">[Single Source of Truth]</text>
    <path d="M152 52 H186" stroke="#0f766e" stroke-width="1.8" marker-end="url(#fiq-arr)"/>
    <path d="M152 104 H186" stroke="#0f766e" stroke-width="1.8" marker-end="url(#fiq-arr)"/>
    <path d="M152 152 H186" stroke="#0f766e" stroke-width="1.8" marker-end="url(#fiq-arr)"/>
    <rect x="190" y="20" width="356" height="48" rx="6" fill="#eaf7f5" stroke="#0f766e" stroke-width="1.5"/>
    <text x="200" y="39" font-size="8.8" font-weight="700" fill="#115e59">Path A &middot; Structured / KPI Truth: Fabric IQ &amp; Fabric Data Agent</text>
    <text x="200" y="55" font-size="7.9" fill="#334e68">Ontology + Semantic Models + SQL/DAX &middot; Dedicated Interactive F-SKU &middot; Identity Passthrough</text>
    <rect x="190" y="76" width="356" height="48" rx="6" fill="#edf3fb" stroke="#0078d4" stroke-width="1.5"/>
    <text x="200" y="95" font-size="8.8" font-weight="700" fill="#183e62">Path B &middot; Unstructured Corpus: Content Understanding &rarr; AI Search (Foundry IQ)</text>
    <text x="200" y="111" font-size="7.9" fill="#334e68">Shared Private Link OneLake Indexer &middot; Hybrid + Semantic Rerank &middot; ACL + Purview Labels</text>
    <rect x="190" y="132" width="356" height="44" rx="6" fill="#f5f3ff" stroke="#7c3aed" stroke-width="1.5"/>
    <text x="200" y="150" font-size="8.8" font-weight="700" fill="#5b21b6">Path C &middot; Operational Memory: Azure Cosmos DB (DiskANN + BM25 RRF)</text>
    <text x="200" y="165" font-size="7.9" fill="#334e68">Tenant-Partitioned Episodic Memory + Thread State + Real-Time Low-Latency Hybrid RAG</text>
    <path d="M546 44 H582" stroke="#0f766e" stroke-width="1.8" marker-end="url(#fiq-arr)"/>
    <path d="M546 100 H582" stroke="#0f766e" stroke-width="1.8" marker-end="url(#fiq-arr)"/>
    <path d="M546 154 H582" stroke="#0f766e" stroke-width="1.8" marker-end="url(#fiq-arr)"/>
    <rect x="586" y="20" width="166" height="156" rx="6" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.5"/>
    <text x="594" y="40" font-size="9.0" font-weight="700" fill="#115e59">Foundry Agent Service</text>
    <text x="594" y="58" font-size="8.0" fill="#334e68">&bull; Tool Router (Pos 1–3)</text>
    <text x="594" y="72" font-size="8.0" fill="#334e68">&bull; fabric_iq tool (KPIs)</text>
    <text x="594" y="86" font-size="8.0" fill="#334e68">&bull; knowledge_base_retrieve</text>
    <text x="594" y="100" font-size="8.0" fill="#334e68">&bull; cosmos_hybrid_recall</text>
    <text x="594" y="114" font-size="8.0" fill="#334e68">&bull; Outputs &rarr; Pos 6 tail</text>
    <text x="594" y="156" font-size="7.7" font-weight="700" fill="#0f766e">[Zero Cross-Path Drift]</text>
    <text x="10" y="195" font-size="8.3" fill="#526c80">Every user question routes to the authoritative engine: Fabric IQ for aggregations/KPIs, AI Search for documents, Cosmos DB for live state.</text>
  </svg>
</div>

---

## 2. Wiring Fabric IQ & Fabric Data Agents Into Microsoft Foundry `[M]`

**Fabric IQ** unifies business ontologies, Power BI semantic models, Lakehouses, Warehouses, and KQL Eventhouses into a governed semantic context layer over OneLake <span class="ev-badge ev-m">[M]</span>. Connecting a **Microsoft Foundry** agent to a published **Fabric Data Agent / Fabric IQ** tool provides three decisive advantages over ad-hoc text-to-SQL scripts:

1. **Identity Passthrough & Row/Object-Level Security (RLS/OLS):** Foundry passes the calling user's Microsoft Entra identity (On-Behalf-Of) to Fabric so existing OneLake Security, Warehouse SQL permissions, and Power BI RLS rules filter every query natively—preventing service-account privilege escalation <span class="ev-badge ev-m">[M]</span>.
2. **Certified Metric Semantics:** Queries execute against governed DAX measures and curated Gold schemas rather than guessing table joins across 400 raw staging tables <span class="ev-badge ev-m">[M]</span> <span class="ev-badge ev-arch">[Arch]</span>.
3. **Cache-Safe Tool Schemas ([Playbook 01](/playbooks/prompt-caching/design/07-prefix-taxonomy)):** Registering `fabric_iq_query` alongside `knowledge_base_retrieve` in the canonically sorted `tools[]` array (`Pos 2`) keeps `Pos 1–3` static while appending returned tabular summaries strictly at **Position 6** <span class="ev-badge ev-arch">[Arch]</span>.

### Routing Decision Boundary: Fabric IQ vs. Foundry IQ (AI Search)

| User Intent Class | Correct Grounding Tool | Why Mis-Routing Fails |
| :--- | :--- | :--- |
| *"Compare Q3 net margin by region and flag accounts >15% below forecast."* | **Fabric IQ / Fabric Data Agent** (Semantic Model / Warehouse) | Vector chunks cannot compute exact SQL/DAX aggregations across live multi-million-row tables. |
| *"Summarize indemnity exceptions in Master Services Agreements signed after 2024."* | **Azure AI Search (`Foundry IQ` MCP)** | Unstructured multi-page clauses require layout-aware chunking, hybrid BM25 + vector search, and semantic reranking. |
| *"Recall the client's open action items from our last three sessions and match against uploaded draft."* | **Azure Cosmos DB (`DiskANN` + `RRF`)** + **AI Search** | High-churn, tenant-partitioned session/episodic memory requires single-digit millisecond operational writes and immediate vector consistency. |
| *"Explain why Region West revenue dropped 12% and cite the relevant quarterly risk memo."* | **Dual-Path Composite:** `fabric_iq` (exact variance) + `knowledge_base_retrieve` (risk memo prose) | Combines verified tabular math with citation-backed narrative evidence in one agent trace. |

---

## 3. Fabric Capacity (`F-SKU`) Isolation & CU Throttling Math `[Arch]`

Microsoft Fabric bills compute in **Capacity Units (CUs)** with **smoothing** (spreading background Spark/ETL bursts over 24 hours and interactive queries over shorter windows) and **bursting** <span class="ev-badge ev-m">[M]</span>. When teams attach interactive **Fabric IQ** agents to the same F-SKU capacity running heavy nightly Spark/Dataflow refreshes, background smoothing debt triggers **interactive delay or rejection throttling** right during morning executive peak hours <span class="ev-badge ev-arch">[Arch]</span>.

### Capacity Engineering Guardrails (`Gate D3`)

| Control | Anti-Pattern | Industrialized Production Standard |
| :--- | :--- | :--- |
| **Interactive vs. Batch Split** | Running Spark ingestion, Lakehouse table compaction, and live Foundry `Fabric IQ` queries on one shared `F64` capacity. | Place batch ETL/Medallion pipelines on a **Batch F-SKU** and bind read-only **AI-Ready Gold** shortcuts + Semantic Models + Fabric Data Agents to a dedicated **Interactive AI-Serving F-SKU** <span class="ev-badge ev-arch">[Arch]</span>. |
| **Zero-Copy Cross-Capacity Access** | Copying Gold Delta tables across workspaces to separate compute billing. | Use **OneLake Shortcuts** across workspaces; compute charges land on the consuming capacity while storage remains single-copy in OneLake <span class="ev-badge ev-m">[M]</span>. |
| **Headroom & Surge Guardrail** | Operating the interactive AI-serving capacity above `85%` sustained CU utilization. | Keep steady-state interactive CU utilization `<= 65%` (leaving `>= 35%` burst headroom for concurrent multi-step agent tool fans) and alert on Fabric Capacity Metrics throttling events <span class="ev-badge ev-agree">[Agree]</span>. |
| **Private Networking (`OneLake → AI Search`)** | Opening public workspace endpoints to allow Azure AI Search indexers to crawl OneLake Files. | Configure an **Azure AI Search Shared Private Link** to the Fabric workspace private endpoint so unstructured document indexing stays strictly on the Azure backbone <span class="ev-badge ev-m">[M]</span>. |

::: tip Operational Check (Gate D2 & D3)
Before promoting a Fabric IQ tool to production, verify that every Gold table and OneLake File folder carries immutable lineage metadata (`source_uri`, `lineage_sha256`, `medallion_tier="ai-gold"`), and validate interactive CU headroom during a simulated peak agent burst (`data_readiness_gate.py` rule `DRG002`).
:::
