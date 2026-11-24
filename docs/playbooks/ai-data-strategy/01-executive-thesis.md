---
title: "01 · Executive Thesis & AI Data Plane Architecture"
description: Architectural thesis for unifying Microsoft Fabric / OneLake & Fabric IQ, Microsoft Purview DSPM for AI, Azure Cosmos DB DiskANN vector/hybrid search, and Azure AI Search Foundry IQ into an enterprise AI data plane.
---

# 01 · Executive Thesis & AI Data Plane Architecture

<PlaybookMeta
  track="05 · AI Data Strategy, Fabric–Foundry & Governance"
  provenance="Customer-Zero Validated (Enterprise Multi-Source Grounding, Analytics & Regulated Agent Data Plane)"
  governance="Sanitized · Peer Reviewed · IP Screened"
  owners="John Luo (@jluocsa) · Co-Authors Welcome"
  verified="2026-11-23 19:30 PST"
  status="Live v2.0"
  paperHref="/papers/enterprise-foundry-platform-blueprint"
  paperLabel="Full-Stack Blueprint →"
  studioHref="/studio/#data-strategy"
  studioLabel="Data Strategy Advisor →"
  kitHref="/papers/engineering-kits#data-gate"
  kitLabel="data_readiness_gate.py →"
/>

<PageBrief
  stage="start"
  readTime="5 min read"
  problem="Even when PTU sizing, APIM spillover, regional BCP, and ACA sandboxes are rock-solid, enterprise AI programs stall when unstructured RAG indexes, Fabric BI semantics, Cosmos DB agent memory, and Purview security labels drift apart."
  takeaway="Treat the AI Data Plane as a governed three-store architecture—Microsoft Fabric / OneLake & Fabric IQ for structured/analytical truth, Azure AI Search (Foundry IQ) for unstructured corpus retrieval, and Azure Cosmos DB (DiskANN + RRF hybrid) for tenant-isolated operational memory—unified under Microsoft Purview DSPM for AI and gated by D1–D12."
  csaUse="Walk through the 5-stage AI Data Plane diagram and four failure modes below during discovery with CDO, Data Platform, Security, and AI Engineering leads."
/>

## Four Structural Failure Modes at the AI Data Plane

Playbooks 01–04 stabilize **inference economics, gateway resiliency, multi-region failover, and sandboxed agent execution**. Yet in production enterprise rollouts, **70%+ of late-stage security holds and grounding regressions originate upstream in the data plane**:

1. **Structured vs. Unstructured Split-Brain:** Teams dump tabular ERP exports, financial KPIs, and Power BI tables as flat CSV chunks into a vector database—producing hallucinated aggregations and stale numbers. Conversely, unstructured regulatory PDFs cannot be queried cleanly via SQL. Production platforms route **structured/semantic questions to Microsoft Fabric IQ** (`OneLake` + Semantic Models + Fabric Data Agents) and **unstructured prose/tables to Azure AI Search (`Foundry IQ`)** <span class="ev-badge ev-m">[M]</span> <span class="ev-badge ev-arch">[Arch]</span>.
2. **Oversharing, Label Stripping & Stale ACL Revocation:** Ingestion pipelines frequently copy SharePoint or OneLake files into blob staging and strip **Microsoft Purview sensitivity labels** and **Entra ID group ACLs**. Even when ACLs are indexed at ingestion time, relying on nightly batch crawlers leaves revoked users able to retrieve confidential engagement documents for hours—violating ethical-wall mandates <span class="ev-badge ev-m">[M]</span> <span class="ev-badge ev-arch">[Arch]</span>.
3. **Immutable Vector Policies & Re-Embedding Cliffs:** In **Azure Cosmos DB for NoSQL**, vector policies and `DiskANN` vector indexes are immutable after container creation <span class="ev-badge ev-m">[M]</span>. Likewise, upgrading embedding models or chunking strategies across millions of Azure AI Search chunks without blue-green index aliases and embedding TPM quota math triggers prolonged search outages or `HTTP 429` ingestion stalls <span class="ev-badge ev-arch">[Arch]</span>.
4. **Silent Corpus Drift, Prompt Poisoning & Disconnected Evals:** Unvalidated document uploads can inject hidden indirect prompt-injection instructions into vector stores, while production `gen_ai.*` failure traces never flow back into OneLake Gold evaluation sets—leaving retrieval precision decaying silently over quarters <span class="ev-badge ev-arch">[Arch]</span> <span class="ev-badge ev-agree">[Agree]</span>.

<div class="arch-diagram">
  <svg viewBox="0 0 760 192" role="img" aria-labelledby="pb5-t1-title pb5-t1-desc" font-family="Segoe UI, Inter, -apple-system, sans-serif">
    <title id="pb5-t1-title">Enterprise AI Data Plane: Fabric OneLake, Purview DSPM, Cosmos DB Hybrid &amp; Foundry IQ</title>
    <desc id="pb5-t1-desc">Shows 1 OneLake Medallion &amp; Shortcuts feeding Fabric IQ structured analytics, 2 Content Understanding &amp; Anti-Poisoning ingestion, 3 Three-Store Grounding Layer (Fabric IQ, AI Search Foundry IQ, Cosmos DB DiskANN Hybrid), 4 Microsoft Purview DSPM for AI Governance &amp; ACL Tombstoning spanning all layers, and 5 Foundry Agents + OTel-to-Fabric Eval Flywheel gated by D1-D12.</desc>
    <defs><marker id="ds-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#0f766e"/></marker></defs>
    <rect x="8" y="10" width="744" height="30" rx="6" fill="#fff7eb" stroke="#d97706" stroke-width="1.4"/>
    <text x="20" y="29" font-size="8.6" font-weight="700" fill="#92400e">MICROSOFT PURVIEW DSPM FOR AI &middot; Sensitivity Label Inheritance &middot; Oversharing Scans &middot; Entra ACL Tombstoning (&le;15m / &le;5m) &middot; Prompt Audit</text>
    <rect x="8" y="52" width="136" height="106" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="16" y="71" font-size="9.0" font-weight="700" fill="#183e62">1. OneLake &amp; Sources</text>
    <text x="16" y="87" font-size="8.0" fill="#334e68">&bull; Zero-copy Shortcuts</text>
    <text x="16" y="101" font-size="8.0" fill="#334e68">&bull; Bronze &rarr; AI Gold</text>
    <text x="16" y="115" font-size="8.0" fill="#334e68">&bull; SharePoint / ADLS</text>
    <text x="16" y="140" font-size="7.7" font-weight="700" fill="#1d4ed8">[Lineage SHA-256]</text>
    <path d="M144 105 H162" stroke="#0f766e" stroke-width="1.8" marker-end="url(#ds-arr)"/>
    <rect x="166" y="52" width="142" height="106" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="174" y="71" font-size="9.0" font-weight="700" fill="#183e62">2. Ingestion &amp; Hygiene</text>
    <text x="174" y="87" font-size="8.0" fill="#334e68">&bull; Content Understanding</text>
    <text x="174" y="101" font-size="8.0" fill="#334e68">&bull; Layout-aware chunks</text>
    <text x="174" y="115" font-size="8.0" fill="#334e68">&bull; Injection sanitizer</text>
    <text x="174" y="140" font-size="7.7" font-weight="700" fill="#1d4ed8">[Label + ACL Stamp]</text>
    <path d="M308 105 H326" stroke="#0f766e" stroke-width="1.8" marker-end="url(#ds-arr)"/>
    <rect x="330" y="52" width="154" height="106" rx="6" fill="#eaf7f5" stroke="#0f766e" stroke-width="1.5"/>
    <text x="338" y="71" font-size="9.0" font-weight="700" fill="#115e59">3. Three-Store Serving</text>
    <text x="338" y="87" font-size="8.0" fill="#334e68">&bull; Fabric IQ (Structured)</text>
    <text x="338" y="101" font-size="8.0" fill="#334e68">&bull; AI Search (Foundry IQ)</text>
    <text x="338" y="115" font-size="8.0" fill="#334e68">&bull; Cosmos DiskANN + RRF</text>
    <text x="338" y="140" font-size="7.7" font-weight="700" fill="#0f766e">[Alias &amp; Partition Guard]</text>
    <path d="M484 105 H502" stroke="#0f766e" stroke-width="1.8" marker-end="url(#ds-arr)"/>
    <rect x="506" y="52" width="118" height="106" rx="6" fill="#f5f3ff" stroke="#7c3aed" stroke-width="1.5"/>
    <text x="514" y="71" font-size="9.0" font-weight="700" fill="#5b21b6">4. Foundry Agents</text>
    <text x="514" y="87" font-size="8.0" fill="#334e68">&bull; Dual-path tool route</text>
    <text x="514" y="101" font-size="8.0" fill="#334e68">&bull; Pos 6 cache-safe tail</text>
    <text x="514" y="115" font-size="8.0" fill="#334e68">&bull; Zero-trust RBAC</text>
    <text x="514" y="140" font-size="7.7" font-weight="700" fill="#6d28d9">[Grounded Context]</text>
    <path d="M624 105 H642" stroke="#0f766e" stroke-width="1.8" marker-end="url(#ds-arr)"/>
    <rect x="646" y="52" width="106" height="106" rx="6" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.5"/>
    <text x="654" y="71" font-size="9.0" font-weight="700" fill="#115e59">5. Data Flywheel</text>
    <text x="654" y="87" font-size="8.0" fill="#334e68">&bull; DRG001–007 CLI</text>
    <text x="654" y="101" font-size="8.0" fill="#334e68">&bull; Freshness KQL</text>
    <text x="654" y="115" font-size="8.0" fill="#334e68">&bull; Gold Eval Lake</text>
    <text x="654" y="140" font-size="7.7" font-weight="700" fill="#0f766e">[D1–D12 Signed]</text>
    <text x="10" y="178" font-size="8.3" fill="#526c80">Unified AI Data Plane bridging Playbook 01 (Pos 6 caching), Playbook 03 (regional stamp sync), and Playbook 04 (Foundry IQ + Evals).</text>
  </svg>
</div>

---

## How Playbook 05 Interlocks With Playbooks 01–04

| Upstream / Downstream Track | Architectural Seam Governed by Playbook 05 |
| :--- | :--- |
| **[Playbook 01 · Prompt Caching & PTU](/playbooks/prompt-caching/start/01-executive-thesis)** | Deterministic chunk ordering and canonical citation payloads placed strictly in **Position 6** preserve `Pos 1–3` `T0` prefix reuse; Regulated `Posture A` ethical walls align directly with Purview sensitivity labels and Cosmos DB tenant partition keys (`D5`, `D11`). |
| **[Playbook 02 · APIM AI Gateway](/playbooks/apim-gateway/01-executive-thesis)** | Embedding re-indexing pipelines route through dedicated batch APIM quotas so a 5-million-chunk re-embedding backfill never starves interactive user inference PTUs (`D8`). |
| **[Playbook 03 · Multi-Region BCP](/playbooks/multi-region-bcp/01-executive-thesis)** | Dual-region Azure AI Search stamps fed from `RA-GZRS` ADLS / OneLake plus multi-region **Cosmos DB DiskANN + RRF** containers keep grounding lag `<1%` across regional failovers (`D7`, `D11`). |
| **[Playbook 04 · Agentic RAG & Evals](/playbooks/agentic-rag-evals/01-executive-thesis)** | Extends `knowledge_base_retrieve` (Foundry IQ MCP) with **Fabric IQ** structured analytics, **Purview DSPM** label inheritance, **Cosmos DB** episodic memory, and an OTel-to-OneLake Gold eval dataset flywheel (`D1`, `D12`). |

---

## Core Engineering Questions Answered in Playbook 05

| Question | Verified Architectural Answer | Chapter |
| :--- | :--- | :--- |
| **How do we connect Microsoft Fabric & OneLake to Microsoft Foundry agents without duplicating petabytes or throttling BI capacities?** | Federate data with **OneLake Shortcuts**, expose curated semantic models & Lakehouse tables via **Fabric IQ / Fabric Data Agents**, index unstructured OneLake Files via Azure AI Search Shared Private Link, and isolate interactive AI-serving **F-SKU** capacities from nightly Spark batch refresh capacities <span class="ev-badge ev-m">[M]</span> <span class="ev-badge ev-arch">[Arch]</span>. | [02 · Fabric, OneLake & Fabric IQ](./02-fabric-onelake-fabric-iq) |
| **How do we prevent AI oversharing, preserve Purview sensitivity labels, and enforce ethical-wall access revocations in minutes instead of days?** | Activate **Microsoft Purview DSPM for AI** across Foundry & Fabric, stamp Purview sensitivity labels + Entra `acl_group_ids` into every chunk/document at ingestion, and wire an event-driven tombstone queue enforcing `<=15 min` (`<=5 min` regulated) revocation propagation <span class="ev-badge ev-m">[M]</span> <span class="ev-badge ev-arch">[Arch]</span>. | [03 · Purview DSPM, Labels & Ethical Walls](./03-purview-dspm-acl-ethical-walls) |
| **When should we use Azure Cosmos DB Vector/Hybrid (`DiskANN` + `RRF`) vs. Azure AI Search vs. Fabric IQ—and how do we avoid re-embedding outages?** | Use **Cosmos DB DiskANN + BM25 RRF** for tenant-partitioned operational RAG and agent memory, **Azure AI Search + Foundry IQ** for multi-document corpus reranking, and **Fabric IQ** for analytical KPIs; enforce blue-green container/alias cutovers because Cosmos DB vector policies are immutable after creation <span class="ev-badge ev-m">[M]</span> <span class="ev-badge ev-arch">[Arch]</span>. | [04 · Cosmos DB Vector/Hybrid & Retrieval](./04-cosmos-vector-hybrid-retrieval) |
| **How do we gate AI data readiness automatically in CI/CD and monitor freshness/poisoning drift in production?** | Enforce `D1–D12` using the zero-dependency **`data_readiness_gate.py`** CLI (`DRG001–DRG007`) in PR/release pipelines and deploy **`data-grounding-freshness-gate.kql`** in Azure Monitor. | [05 · D1–D12 Gates & Automation](./05-data-governance-release-gates) |
