---
title: "04 · Cosmos DB Vector/Hybrid Search & Multi-Store Retrieval"
description: Architecting Azure Cosmos DB for NoSQL DiskANN vector and BM25 RRF hybrid search, partition-key tenant isolation, zero-downtime alias/re-embedding math, and corpus anti-poisoning flywheels.
---

# 04 · Cosmos DB Vector/Hybrid Search & Multi-Store Retrieval

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
  problem="Teams either force high-churn agent memory into batch search indexes or deploy Cosmos DB vectors without DiskANN/partition-key design—triggering cross-partition RU explosions and container rebuild outages when embedding models change."
  takeaway="Use Azure Cosmos DB for NoSQL (DiskANN + BM25 FullTextScore via RRF) scoped by tenant/engagement partition keys for operational RAG and agent memory, pair it with Azure AI Search (Foundry IQ) for deep multi-document semantic reranking, and plan blue-green cutovers plus anti-poisoning scans from day one."
  csaUse="Use the Cosmos DB indexing policy, weighted RRF query template, and Azure vector store selection matrix below during data-store architecture reviews."
/>

## 1. Azure Cosmos DB for NoSQL: Vector (`DiskANN`) & Hybrid (`RRF`) Architecture `[M]`

**Azure Cosmos DB for NoSQL** colocates operational JSON documents, agent conversation checkpoints (Playbook 03 `Model 2` stateless tier), full-text tokens (`BM25`), and high-dimensional vector embeddings inside the **same container and partition** <span class="ev-badge ev-m">[M]</span>. This eliminates dual-write synchronization lag between an operational store and a separate vector database for real-time agent memory, episodic recall, and tenant-scoped operational RAG.

### Choosing the Right Cosmos DB Vector Index Policy `[M]`

| Vector Index Type | Underlying Algorithm | Best-Fit Workload | Trade-Offs & Guardrails |
| :--- | :--- | :--- | :--- |
| **`flat`** | Exact brute-force `kNN` (`100%` recall) | Small, tightly partitioned tenant/engagement buckets (`<= ~50K` vectors per partition) | Highest exact recall; RU cost scales linearly if partition grows unbounded <span class="ev-badge ev-m">[M]</span>. |
| **`quantizedFlat`** | DiskANN-based vector quantization + `kNN` | Medium-sized scoped partitions needing lower RU and memory footprint | Compressed vectors improve scan efficiency over unquantized `flat` <span class="ev-badge ev-m">[M]</span>. |
| **`diskANN`** | Microsoft Research DiskANN graph ANN index | High-scale, multi-modal vector/hybrid search (`100K` to `100M+` vectors) with predictable low latency | Best RU efficiency at scale; pair with tenant partition keys (`WHERE` / `partitionKey`) for single-partition execution <span class="ev-badge ev-m">[M]</span>. |

::: warning Critical Platform Immutability Rule (`Gate D7`) `[M]`
In Azure Cosmos DB for NoSQL, **vector policies and vector indexes are immutable after container creation** <span class="ev-badge ev-m">[M]</span>. Changing `dimensions` (for example migrating `1536 → 3072`), `dataType`, or `distanceFunction` requires creating a **new container**, backfilling embeddings via Change Feed / batch pipeline, and executing a **blue-green config swap**—never an in-place schema migration <span class="ev-badge ev-arch">[Arch]</span>.
:::

The [published vector-index limits](https://learn.microsoft.com/en-us/azure/cosmos-db/vector-search#vector-indexing-policies) are **505 dimensions** for `flat` and **4,096 dimensions** for `quantizedFlat` / `diskANN` <span class="ev-badge ev-m">[M]</span>. The [offline `DRG005` dimension check](./05-data-governance-release-gates#cosmos-dimension-limits) blocks snapshots exceeding the selected index's limit; the Studio's `1536` / `3072` presets cannot be used with a `flat` index <span class="ev-badge ev-arch">[Arch]</span>.

### Production Weighted Hybrid Query Pattern (`DiskANN` + `BM25` + `RRF`) `[M]`

Combine `VectorDistance` and `FullTextScore` inside `ORDER BY RANK RRF(...)`, optionally weighting semantic vectors higher than keyword BM25 (for example `[2, 1]`). Always execute with an explicit **tenant/engagement partition key** and `tombstoned = false` predicate:

```sql
-- Execute with explicit RequestOptions.PartitionKey = "tenant-alpha::eng-4812"
SELECT TOP @topK
    c.chunk_id,
    c.source_id,
    c.sensitivity_label,
    c.content
FROM c
WHERE c.tombstoned = false
  AND ARRAY_CONTAINS(c.acl_group_ids, @callerGroupId)
ORDER BY RANK RRF(
    VectorDistance(c.vector, @queryVector),
    FullTextScore(c.content, @kw1, @kw2),
    [2, 1]
)
```

> **Dialect Guardrail `[M]`:** `RRF()` is valid only inside an `ORDER BY RANK` clause (it cannot be combined with a secondary `ORDER BY` on another path or projected in `SELECT`) and requires both the Cosmos DB **Vector Index** and **Full-Text Index** policies configured on the container <span class="ev-badge ev-m">[M]</span>.

---

## 2. Authoritative Azure AI Data Store Selection Matrix `[M]` `[Arch]`

| Capability / Dimension | **Microsoft Fabric / OneLake + Fabric IQ** | **Azure AI Search (`Foundry IQ` MCP)** | **Azure Cosmos DB for NoSQL (`DiskANN` + `RRF`)** |
| :--- | :--- | :--- | :--- |
| **Primary Grounding Role** | Structured analytics, KPIs, Power BI Semantic Models, Delta Lakehouses & Ontologies <span class="ev-badge ev-m">[M]</span>. | Enterprise unstructured document corpora, multi-step agentic query planning & deep semantic reranking <span class="ev-badge ev-m">[M]</span>. | Real-time operational RAG, agent thread/episodic memory, high-churn user/tenant records <span class="ev-badge ev-m">[M]</span>. |
| **Hybrid Search & Reranking** | SQL / DAX / KQL exact execution + Semantic Model relationships. | Native BM25 + HNSW Vector + L2 **Semantic Reranker** + Foundry IQ query decomposition <span class="ev-badge ev-m">[M]</span>. | Native BM25 `FullTextScore` + `DiskANN` `VectorDistance` via weighted `RRF` (semantic reranker in preview) <span class="ev-badge ev-m">[M]</span>. |
| **Multi-Tenant / Ethical-Wall Isolation** | OneLake Security + Workspace/Domain isolation + Power BI RLS/OLS <span class="ev-badge ev-m">[M]</span>. | Mandatory `acl_group_ids` OData trimming + dedicated per-tier index when required (`D5`). | Native single-partition isolation via `/tenantEngagementId` (or hierarchical partition keys) (`D7`). |
| **Multi-Region Continuity ([Playbook 03](/playbooks/multi-region-bcp/04-stateful-stamp-failover))** | OneLake BCDR + regional capacity planning. | Independent regional Search stamps fed from `RA-GZRS` ADLS / OneLake (`<1%` lag). | Native multi-region replication & multi-region writes with `PreferredLocations` SDK failover <span class="ev-badge ev-m">[M]</span>. |
| **Primary Scaling / Cost Lever** | Dedicated Interactive **F-SKU** CU headroom (`<=65%` steady utilization). | Search Units (`Replicas × Partitions`) + Semantic Ranker query volume. | Autoscale **RU/s** (keep hybrid queries single-partition to avoid `10×–50×` cross-partition RU fan-out). |

---

## 3. Zero-Downtime Alias Cutover & Re-Embedding Surge Math (`Gate D8`)

When upgrading an embedding model, tuning chunk overlap, or migrating Cosmos DB vector dimensions:

1. **Compute Re-Embedding Token Volume Before Starting:**

```text
TotalTokens     = Documents × AvgChunksPerDoc × AvgTokensPerChunk
BackfillMinutes = TotalTokens ÷ (EmbeddingTPMQuota × 0.80)
```

   *Example:* `250,000` documents × `18` chunks × `512` tokens = **`2.304B` embedding tokens**. At a `1,000,000 TPM` batch embedding quota (`80%` usable ceiling = `800K TPM`), full backfill requires **`~48 hours`**—which would cause catastrophic downtime if executed in place against a live index!
2. **Route Backfills Through Dedicated Batch Quotas:** Never share your interactive inference or live ingestion APIM quota with multi-billion-token re-embedding jobs ([Playbook 02](/playbooks/apim-gateway/04-finops-token-governance)).
3. **Swap Atomically via Alias / Blue-Green Cutover:**
   - **Azure AI Search:** Build `kb-prod-v2`, verify document count & recall parity against `kb-prod-v1`, then atomically repoint the **Index Alias** (`kb-prod-live → kb-prod-v2`) <span class="ev-badge ev-m">[M]</span>.
   - **Azure Cosmos DB:** Provision `memory-v2` with the updated immutable `DiskANN` vector policy, backfill via Change Feed Processor, verify count/hybrid recall parity, and switch the active container binding in App Configuration / Key Vault <span class="ev-badge ev-arch">[Arch]</span>.

The [Data Strategy Advisor](/studio/#data-strategy) accepts only its numeric `1,536` and `3,072` embedding-dimension presets for sizing. Unsupported values hide capacity estimates and block CLI copying, including direct copy-handler invocation; a linked field error identifies the invalid selection. Governance contract JSON and the readiness simulation remain independent of sizing. This is a local calculator preset boundary, not an Azure service dimension limit <span class="ev-badge ev-arch">[Arch]</span>.

Offline interaction tests cover unsupported values and types, combined numeric/selector errors, recovery to both presets, unchanged contract/CLI exports, and preserved backfill and vector-memory estimates. They run in `npm run check:studio` and `npm run verify` without live Azure access <span class="ev-badge ev-val">[Validate]</span>.

---

## 4. Layout-Aware Ingestion, Anti-Poisoning & Eval Flywheel (`Gates D9–D12`)

- **Layout-Aware Chunking (`Gate D9`):** Convert PDFs, spreadsheets, and slide decks through **Azure AI Content Understanding** into layout-preserving Markdown so Markdown tables stay intact inside bounded chunks (`256–1,024` tokens) with deterministic `chunk_sha256` identifiers <span class="ev-badge ev-m">[M]</span> <span class="ev-badge ev-arch">[Arch]</span>.
- **Corpus Anti-Poisoning & Indirect Injection Hygiene (`Gate D10`):** Scan ingested text *before* indexing for instruction-override payloads (e.g., hidden white-on-white `"ignore previous instructions"`, `"exfiltrate system prompt"`, or unauthorized tool-invocation directives) and quarantine flagged documents rather than polluting shared vector indexes (`DRG006`) <span class="ev-badge ev-arch">[Arch]</span>.
- **Pos 6 Cache-Safe Retrieval Ordering (`Gate D11`):** Sort retrieved citations deterministically by `(score desc, chunk_id asc)` and inject them strictly in **Position 6** after `Pos 1–3` static instructions and sorted `tools[]`—preserving Playbook 01 prefix cache reuse across multi-turn reasoning loops <span class="ev-badge ev-arch">[Arch]</span>.
- **OTel-to-Fabric Gold Eval Flywheel (`Gate D12`):** Stream anonymized `gen_ai.*` telemetry and retrieval metrics (zero-result queries, low citation coverage, high Cosmos RU spikes, user thumbs-down signals) from Application Insights into a **Microsoft Fabric OneLake Gold** evaluation table so every quarterly retrieval regression becomes a permanent regression fixture for `agent_release_gate.py` and Foundry Evals <span class="ev-badge ev-arch">[Arch]</span> <span class="ev-badge ev-agree">[Agree]</span>.
