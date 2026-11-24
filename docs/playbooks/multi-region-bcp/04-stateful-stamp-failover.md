---
title: "04 · Cohesive Stateful AI Stamp Failover (Cosmos DB & AI Search)"
description: Synchronizing multi-turn agent state, workpaper lineage, and grounded knowledge indexes across paired Azure regions so model failover translates into end-to-end application continuity.
---

# 04 · Cohesive Stateful AI Stamp Failover (Cosmos DB & AI Search)

<PlaybookMeta
  track="03 · Multi-Region Foundry BCP, Residency & Failover Drills"
  verified="2026-11-19 22:12 PST"
  status="Live v2.0"
/>

<PageBrief
  stage="design"
  readTime="4 min read"
  problem="Azure AI Search does not natively replicate indexes across regions; failing over APIM + Foundry while leaving search or session checkpoints in Region A breaks every RAG-grounded agent turn."
  takeaway="Treat ADLS Gen2 (GZRS/RA-GZRS) as the single source of document truth, run independent AI Search stamps per region fed from that storage, and use Cosmos DB multi-region failover for session checkpoints."
  csaUse="Review the 4-component stamp matrix below to verify zero single-region stateful anchors remain in your agent architecture."
/>

## End-to-End AI Stamp Dependency Matrix

| Stamp Layer | Primary Region Configuration | Secondary Region Configuration | Failover Mechanism & RPO/RTO |
| :--- | :--- | :--- | :--- |
| **1. Edge & AI Gateway (`APIM` / `Front Door`)** | APIM Premium multi-region unit (or regional Standard v2 behind Azure Front Door / Traffic Manager) <span class="ev-badge ev-m">[M]</span>. | Secondary APIM unit in paired region with identical backend pool & Managed Identity RBAC. | Automatic health-probe routing (`<15–30s` RTO; `0` state loss). |
| **2. Model Inference (`Microsoft Foundry`)** | Primary `PTU-M` + local `Standard` spillover pinned to explicit snapshot (`e.g., 2026-09-29`). | Secondary `DataZoneStandard` / `Regional` deployment pinned to **identical model snapshot** and system prompt version. | APIM backend-pool circuit breaker (`<15s` RTO; cold KV cache warms in `5–15m`). |
| **3. Session State & Lineage (`Azure Cosmos DB`)** | Zone-redundant (`ZRS`) NoSQL container storing `thread_id` append-only history, tool outputs, and workpaper hashes <span class="ev-badge ev-m">[M]</span>. | Multi-region replica (`Session` consistency; service-managed failover or multi-region writes) <span class="ev-badge ev-m">[M]</span>. | Cosmos SDK `PreferredLocations` auto-switches reads/writes (`RPO ~0` on multi-write / `<5m` async). |
| **4. Knowledge Base (`ADLS Gen2` + `Azure AI Search`)** | `RA-GZRS` ADLS Gen2 markdown/chunk store + Primary Azure AI Search (`Basic+` / `S1+` with ZRS replicas) <span class="ev-badge ev-m">[M]</span>. | Independent Secondary Azure AI Search service indexing continuously from the same geo-replicated ADLS container <span class="ev-badge ev-m">[M]</span> <span class="ev-badge ev-arch">[Arch]</span>. | Agent MCP / search client retries against Secondary Search endpoint (`RPO <15m` indexer cadence; `<5s` read switch). |
| **5. Agent Runtime (`ACA` / `AKS`)** | Zone-redundant Container Apps + ACA Dynamic Session Pool in Primary Region. | Warm-scaled Container Apps + pre-provisioned Session Pool in Secondary Region. | Front Door / Traffic Manager origin health probe shifts active sessions cleanly. |

::: tip Why Model 2 Stateless Agents Simplify Regional Cutover
Because the hub's **Model 2 Stateless Agent Pattern** ([Playbook 01 · Ch 02](/playbooks/prompt-caching/start/02-stateless-agents)) persists conversation turns and episodic embeddings in **Cosmos DB** rather than pinning state inside Foundry server-side thread memory or single-node RAM, an active user conversation seamlessly resumes on Turn `N+1` in Secondary Region B with zero lost messages! For `DiskANN` + `RRF` hybrid vector indexing, immutable vector policy cutovers, and OneLake-to-AI-Search Shared Private Link parity (`D7`, `D8`, `D11`), see [Playbook 05 · Ch 04](/playbooks/ai-data-strategy/04-cosmos-vector-hybrid-retrieval).
:::
