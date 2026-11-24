---
title: "03 · Purview DSPM for AI, Sensitivity Labels & Ethical Walls"
description: Enforcing Microsoft Purview DSPM for AI across Microsoft Foundry and Fabric, inheriting sensitivity labels into vector/hybrid metadata, and meeting strict Entra ACL revocation and tombstoning SLAs.
---

# 03 · Purview DSPM for AI, Sensitivity Labels & Ethical Walls

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
  problem="Enterprise CISOs block AI launches not because the LLM fails benchmarks, but because RAG pipelines strip Purview sensitivity labels, expose overshared sites, or leave revoked user permissions active in vector indexes for hours."
  takeaway="Enable Microsoft Purview DSPM for AI across Microsoft Foundry and Fabric, propagate sensitivity labels and Entra acl_group_ids immutably into every index and Cosmos DB document, and replace nightly crawlers with event-driven ACL tombstoning."
  csaUse="Review the Purview DSPM control plane and 3-tier revocation SLA architecture below with CISO, Risk, and Compliance leads."
/>

## 1. Microsoft Purview DSPM for AI Across Foundry & Fabric `[M]`

**Microsoft Purview Data Security Posture Management (DSPM) for AI** provides unified visibility and compliance governance over both **Microsoft Foundry** applications and **Microsoft Fabric / Copilot in Fabric** workloads <span class="ev-badge ev-m">[M]</span>. Rather than bolting on bespoke regex loggers after launch, activate four foundational Purview controls before ingesting production data (`Gate D4`):

1. **Oversharing Assessments Before Indexing:** Run Purview DSPM oversharing discovery across SharePoint, OneDrive, and OneLake repositories *prior* to connecting Azure AI Search indexers or Fabric Data Agents—remediating overly broad `"Everyone except external users"` links before an agent amplifies them <span class="ev-badge ev-m">[M]</span> <span class="ev-badge ev-arch">[Arch]</span>.
2. **Sensitivity Labels & Inheritance:** Apply organizational **Microsoft Purview sensitivity labels** (`Public`, `Internal`, `Confidential`, `Highly Confidential / Ethical-Wall`) across OneLake items, Power BI Semantic Models, and source documents. When labeled data is referenced in Fabric or Foundry interactions, Purview tracks label inheritance and prevents unauthorized users from accessing restricted sources <span class="ev-badge ev-m">[M]</span>.
3. **Foundry Interaction Capture, Audit & eDiscovery:** Configure Purview collection policies for Microsoft Foundry to capture AI prompts, responses, and sensitive information types (`SITs`) into **Purview Audit**, **Communication Compliance**, and **eDiscovery**—while keeping application-level OpenTelemetry spans strictly metadata-only (`OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=false` per Playbook 04 Gate `A12`) <span class="ev-badge ev-m">[M]</span> <span class="ev-badge ev-arch">[Arch]</span>.
4. **Data Loss Prevention (DLP) & Insider Risk Policies:** Block sensitive data types (credentials, regulated client identifiers, unapproved PII) from leaking into unsanctioned prompts or external connectors <span class="ev-badge ev-m">[M]</span>.

---

## 2. End-to-End Label & Entra ACL Propagation Contract `[Arch]`

A critical vulnerability occurs when ingestion jobs extract text with Azure AI Content Understanding and write plain JSON chunks to **Azure AI Search** or **Azure Cosmos DB** without carrying forward source authorization metadata. Every indexed record **must** carry an immutable security envelope (`Gate D5`):

```json
{
  "chunk_id": "doc-eng-4812#sec-04#p07",
  "source_id": "onelake://finance-gold/Files/eng-4812/msa-2026.pdf",
  "lineage_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "medallion_tier": "ai-gold",
  "sensitivity_label": "Highly Confidential - Ethical Wall",
  "sensitivity_rank": 4,
  "tenant_engagement_id": "tenant-alpha::eng-4812",
  "acl_group_ids": ["grp-eng-4812-readers", "grp-eng-4812-partners"],
  "acl_deny_ids": ["grp-ethical-wall-conflicted"],
  "acl_synced_at_utc": "2026-11-23T19:15:00Z",
  "tombstoned": false
}
```

### Mandatory Query-Time Enforcement Rules

| Store | Query-Time Security Filter Pattern | Fail-Closed Invariant |
| :--- | :--- | :--- |
| **Azure AI Search (`Foundry IQ`)** | `search.in(acl_group_ids, '<caller_groups>', ',') and not search.in(acl_deny_ids, '<caller_groups>', ',') and tombstoned eq false and sensitivity_rank le <caller_clearance>` | Missing caller Entra token or empty group claim **must return HTTP 403**, never fall back to an unfiltered query <span class="ev-badge ev-arch">[Arch]</span>. |
| **Azure Cosmos DB (`DiskANN` + `RRF`)** | Scope request with explicit `partitionKey = tenant_engagement_id` plus `WHERE c.tombstoned = false AND ARRAY_CONTAINS(c.acl_group_ids, @groupId)` before `ORDER BY RANK RRF(...)`. | Single-partition execution enforces physical/logical ethical-wall isolation and eliminates cross-tenant scatter-gather <span class="ev-badge ev-m">[M]</span> <span class="ev-badge ev-arch">[Arch]</span>. |
| **Microsoft Fabric (`Fabric IQ`)** | Entra ID On-Behalf-Of (`OBO`) identity passthrough directly into OneLake Security, Warehouse RLS, and Semantic Model OLS/RLS <span class="ev-badge ev-m">[M]</span>. | Never substitute a shared workspace Admin Service Principal for interactive end-user Fabric IQ queries <span class="ev-badge ev-arch">[Arch]</span>. |

---

## 3. Event-Driven ACL Revocation & Tombstoning SLA (`Gate D6`)

In regulated assurance, legal, M&A, and financial platforms, **access revocation speed is an audit-blocking requirement**. Suppose an analyst is moved off Engagement A onto competing Engagement B (an **ethical wall** trigger) at `09:00 UTC`. If Azure AI Search or Cosmos DB relies on a nightly 24-hour full re-crawl to refresh `acl_group_ids`, the analyst retains retrieval access for up to 24 hours.

<div class="arch-diagram">
  <svg viewBox="0 0 760 156" role="img" aria-labelledby="pb5-t3-title pb5-t3-desc" font-family="Segoe UI, Inter, -apple-system, sans-serif">
    <title id="pb5-t3-title">Event-Driven ACL Revocation and Tombstoning Pipeline</title>
    <desc id="pb5-t3-desc">Shows 1 Entra ID / Purview / SharePoint Revocation Event, 2 Event Grid / Change Feed Broker, 3 Immediate Tombstone Patcher updating AI Search and Cosmos DB in under 5 minutes, and 4 Async Purge and KQL Freshness Gate audit.</desc>
    <defs><marker id="tomb-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#d97706"/></marker></defs>
    <rect x="8" y="18" width="166" height="98" rx="6" fill="#fff7eb" stroke="#d97706" stroke-width="1.5"/>
    <text x="16" y="38" font-size="9.0" font-weight="700" fill="#92400e">1. Revocation Trigger</text>
    <text x="16" y="54" font-size="8.0" fill="#334e68">&bull; Entra group removal</text>
    <text x="16" y="68" font-size="8.0" fill="#334e68">&bull; Purview label upgrade</text>
    <text x="16" y="82" font-size="8.0" fill="#334e68">&bull; Source file delete</text>
    <text x="16" y="103" font-size="7.7" font-weight="700" fill="#b45309">[T = 0s Event]</text>
    <path d="M174 67 H198" stroke="#d97706" stroke-width="1.8" marker-end="url(#tomb-arr)"/>
    <rect x="202" y="18" width="166" height="98" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="210" y="38" font-size="9.0" font-weight="700" fill="#183e62">2. Event Broker</text>
    <text x="210" y="54" font-size="8.0" fill="#334e68">&bull; Graph Webhook / Grid</text>
    <text x="210" y="68" font-size="8.0" fill="#334e68">&bull; Service Bus Priority Q</text>
    <text x="210" y="82" font-size="8.0" fill="#334e68">&bull; Dead-letter alerting</text>
    <text x="210" y="103" font-size="7.7" font-weight="700" fill="#1d4ed8">[At-Least-Once]</text>
    <path d="M368 67 H392" stroke="#d97706" stroke-width="1.8" marker-end="url(#tomb-arr)"/>
    <rect x="396" y="18" width="174" height="98" rx="6" fill="#eaf7f5" stroke="#0f766e" stroke-width="1.5"/>
    <text x="404" y="38" font-size="9.0" font-weight="700" fill="#115e59">3. Fast Tombstone Patch</text>
    <text x="404" y="54" font-size="8.0" fill="#334e68">&bull; AI Search mergeOrUpload</text>
    <text x="404" y="68" font-size="8.0" fill="#334e68">&bull; Cosmos patch tombstoned</text>
    <text x="404" y="82" font-size="8.0" fill="#334e68">&bull; Both Primary + DR stamp</text>
    <text x="404" y="103" font-size="7.7" font-weight="700" fill="#0f766e">[&le;5m Regulated SLA]</text>
    <path d="M570 67 H594" stroke="#d97706" stroke-width="1.8" marker-end="url(#tomb-arr)"/>
    <rect x="598" y="18" width="154" height="98" rx="6" fill="#f5f3ff" stroke="#7c3aed" stroke-width="1.5"/>
    <text x="606" y="38" font-size="9.0" font-weight="700" fill="#5b21b6">4. Purge &amp; Audit Gate</text>
    <text x="606" y="54" font-size="8.0" fill="#334e68">&bull; Async hard-delete</text>
    <text x="606" y="68" font-size="8.0" fill="#334e68">&bull; Purview Audit receipt</text>
    <text x="606" y="82" font-size="8.0" fill="#334e68">&bull; KQL SLA monitor</text>
    <text x="606" y="103" font-size="7.7" font-weight="700" fill="#6d28d9">[Gate D6 Verified]</text>
    <text x="10" y="140" font-size="8.3" fill="#526c80">Never wait for a full document re-index to revoke access: patch ACL metadata or set tombstoned=true across primary and secondary stamps immediately.</text>
  </svg>
</div>

### Recommended Revocation & Posture Matrix (`[Agree]`)

| Compliance Posture | Max ACL Revocation SLA | Max Unpurged Tombstone Age | Prompt Cache Alignment ([Playbook 01](/playbooks/prompt-caching/profiles/regulated-multi-engagement)) |
| :--- | :--- | :--- | :--- |
| **Standard Enterprise** | `<= 15 minutes` (Event Grid + incremental sync) | `<= 60 minutes` | Shared `T0` instructions cached; retrieved chunks strictly in **Pos 6** (never cached across users). |
| **Regulated Ethical-Wall** (Assurance, Tax, Legal, FinServ) | `<= 5 minutes` (Priority Service Bus patch to Primary + Secondary stamps + Entra token TTL `<= 15m`) | `<= 15 minutes` (hard-delete receipt logged to Purview Audit) | **`Posture A` (Zero-Client-Cache)** or **`Posture B` (Engagement-Sharded Key)**; zero `Highly Confidential` chunks ever permitted in unlabelled or public indexes (`DRG003`, `DRG004`). |
