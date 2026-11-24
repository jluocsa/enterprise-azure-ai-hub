---
title: "06 · Verification Matrix & Sources (Playbook 05)"
description: Authoritative Microsoft Learn specifications backing Playbook 05 (AI Data Strategy, Microsoft Fabric / OneLake & Fabric IQ, Purview DSPM for AI, and Azure Cosmos DB Vector/Hybrid Search).
---

# 06 · Verification Matrix & Authoritative Sources

<PlaybookMeta
  track="05 · AI Data Strategy, Fabric–Foundry & Governance"
  verified="2026-11-23 19:30 PST"
  status="Live v2.0"
/>

<PageBrief
  stage="reference"
  readTime="2 min read"
  problem="Fabric IQ, Purview DSPM for AI, and Cosmos DB DiskANN/RRF hybrid search evolve rapidly across preview and GA milestones."
  takeaway="Every [M] platform capability cited in Playbook 05 maps directly to the published Microsoft Learn documentation sources below."
  csaUse="Use this table during Data Governance, CISO, and Architecture Review Board sign-offs to verify platform behavior against live Learn documentation."
/>

## Authoritative Microsoft Learn Citations (`[M]`)

| Ref | Official Documentation Source | Key Platform Facts Grounded | Last Verified |
| :--- | :--- | :--- | :--- |
| **`D-R1`** | [What is Fabric IQ? (Microsoft Fabric)](https://learn.microsoft.com/en-us/fabric/iq/overview) | Unified ontology, Power BI semantic models, Lakehouses, and structured business context over OneLake for AI reasoning. | `2026-11-23` |
| **`D-R2`** | [Connect Agents to Microsoft Fabric with Fabric IQ (Microsoft Foundry)](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/fabric-iq) | Native Foundry Agent Service integration with Fabric IQ / Fabric Data Agents using Entra identity passthrough. | `2026-11-23` |
| **`D-R3`** | [Consume Fabric Data Agent from Microsoft Foundry Services](https://learn.microsoft.com/en-us/fabric/data-science/data-agent-foundry-fabric-iq) | End-to-end Fabric Data Agent publishing and grounding patterns for structured analytics queries. | `2026-11-23` |
| **`D-R4`** | [OneLake Shortcuts & Zero-Copy Federation](https://learn.microsoft.com/en-us/fabric/onelake/onelake-shortcuts) | Virtualizing ADLS Gen2, S3, GCS, Dataverse, and cross-workspace Fabric data products without copying raw files. | `2026-11-23` |
| **`D-R5`** | [Index OneLake Files in Azure AI Search (Shared Private Link)](https://learn.microsoft.com/en-us/azure/search/search-how-to-index-onelake-files) | Indexing unstructured OneLake Lakehouse Files into Azure AI Search over Shared Private Link when workspace Private Link is enabled. | `2026-11-23` |
| **`D-R6`** | [Use Microsoft Purview to Manage Data Security & Compliance for Microsoft Foundry](https://learn.microsoft.com/en-us/purview/ai-azure-foundry) | Purview DSPM for AI, prompt/response audit capture, DLP, Communication Compliance, and eDiscovery for Microsoft Foundry. | `2026-11-23` |
| **`D-R7`** | [Use Microsoft Purview for Copilot in Fabric & Sensitivity Labels](https://learn.microsoft.com/en-us/purview/ai-copilot-fabric) | Sensitivity label inheritance, oversharing assessments, and Purview DSPM posture controls across Fabric & OneLake. | `2026-11-23` |
| **`D-R8`** | [Vector Search in Azure Cosmos DB for NoSQL (`DiskANN`, `quantizedFlat`, `flat`)](https://learn.microsoft.com/en-us/azure/cosmos-db/vector-search) | Colocated JSON + vector storage, `flat`/`quantizedFlat`/`diskANN` vector index policies, and filtered vector search. | `2026-11-23` |
| **`D-R9`** | [Hybrid Search in Azure Cosmos DB for NoSQL (`RRF`, `VectorDistance`, `FullTextScore`)](https://learn.microsoft.com/en-us/azure/cosmos-db/gen-ai/hybrid-search) | Weighted Reciprocal Rank Fusion (`RRF`) combining `VectorDistance` and BM25 `FullTextScore`, `ORDER BY RANK` dialect rules, and vector index immutability after container creation. | `2026-11-23` |
| **`D-R10`** | [Choose an Azure Service for Vector Search (Architecture Guide)](https://learn.microsoft.com/en-us/azure/architecture/guide/technology-choices/vector-search) | Authoritative capability matrix comparing Azure Cosmos DB for NoSQL, Azure AI Search, PostgreSQL, Azure Managed Redis, and SQL for full-text, hybrid, and reranking workloads. | `2026-11-23` |
