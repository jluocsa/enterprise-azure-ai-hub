---
title: "06 · Verification Matrix & Sources (Playbook 03)"
description: Authoritative Microsoft Learn sources backing Playbook 03 (Multi-Region Foundry Business Continuity, Residency & Failover Drills).
---

# 06 · Verification Matrix & Authoritative Sources

<PlaybookMeta
  track="03 · Multi-Region Foundry BCP, Residency & Failover Drills"
  verified="2026-11-19 22:12 PST"
  status="Live v2.0"
/>

<PageBrief
  stage="reference"
  readTime="2 min read"
  problem="Data residency guarantees, PTU regional minimums, and service replication capabilities must always be grounded in published Azure documentation."
  takeaway="Every [M] platform claim in Playbook 03 maps directly to the authoritative Microsoft Learn specifications below."
  csaUse="Cross-check regional model availability and Data Zone coverage before finalizing DR stamp pair selection."
/>

## Authoritative Microsoft Learn Citations (`[M]`)

| Ref | Official Documentation Source | Key Platform Facts Grounded | Last Verified |
| :--- | :--- | :--- | :--- |
| **`B-R1`** | [Azure OpenAI Deployment Types — Global, Data Zone & Regional](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/deployment-types) | Data-processing vs. data-at-rest residency boundaries across Global, Data Zone (`US` / `EU`), and Regional Provisioned / Standard SKUs. | `2026-11-19` |
| **`B-R2`** | [Provisioned Throughput (PTU) Onboarding & Regional Concepts](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/provisioned-throughput) | Per-deployment PTU capacity scoping, minimum PTU increments, and PTU-to-Standard spillover guidance. | `2026-11-19` |
| **`B-R3`** | [Azure Well-Architected Framework for AI Workloads — Reliability](https://learn.microsoft.com/en-us/azure/well-architected/ai/reliability) | Multi-region AI stamp design, active-active vs. active-passive trade-offs, and coordinated stateful failover. | `2026-11-19` |
| **`B-R4`** | [Azure AI Search Reliability & Multi-Region Business Continuity](https://learn.microsoft.com/en-us/azure/search/search-reliability) | Independent multi-region AI Search deployments synchronized from geo-redundant storage (`GZRS` / `RA-GZRS`) and availability-zone replicas. | `2026-11-19` |
| **`B-R5`** | [Azure Cosmos DB High Availability & Multi-Region Replication](https://learn.microsoft.com/en-us/azure/cosmos-db/high-availability) | Zone redundancy, service-managed regional failover, multi-region writes, and SDK `PreferredLocations` routing. | `2026-11-19` |
| **`B-R6`** | [KQL countif() Aggregation](https://learn.microsoft.com/en-us/kusto/query/countif-aggregation-function?view=azure-monitor) | Counts only rows satisfying the predicate; used for successful model-dependency evidence per stamp. | `2026-11-20` |
| **`B-R7`** | [KQL maxif() Aggregation](https://learn.microsoft.com/en-us/kusto/query/maxif-aggregation-function?view=azure-monitor) | Returns the maximum expression value only across rows satisfying the predicate; used for the last successful call timestamp. | `2026-11-20` |
