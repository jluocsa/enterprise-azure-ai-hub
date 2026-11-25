---
title: "05 · D1–D12 Data Readiness Standard & Automated CI Gates"
description: 12-point enterprise AI Data Strategy readiness standard (D1–D12) backed by the zero-dependency data_readiness_gate.py CLI (DRG001–DRG007) and data-grounding-freshness-gate.kql workbook.
---

# 05 · `D1–D12` Data Readiness Standard & Automated CI Gates

<PlaybookMeta
  track="05 · AI Data Strategy, Fabric–Foundry & Governance"
  verified="2026-11-23 19:30 PST"
  status="Live v2.0"
  studioHref="/studio/#data-strategy"
  studioLabel="Data Strategy Advisor →"
  kitHref="/papers/engineering-kits#data-gate"
  kitLabel="data_readiness_gate.py →"
/>

<PageBrief
  stage="govern"
  readTime="5 min read"
  problem="Data governance standards written only in slide decks break down as soon as teams add a new SharePoint connector, change an embedding model, or onboard a new tenant without checking Purview labels and ACL tombstoning."
  takeaway="Enforce the 12-point D1–D12 standard in every release pipeline using the zero-dependency data_readiness_gate.py CLI (DRG001–DRG007) and monitor live drift with data-grounding-freshness-gate.kql."
  csaUse="Wire data_readiness_gate.py into PR / pre-cutover pipelines and include D1–D12 in the Architecture Review Board sign-off checklist."
/>

## 1. The 12-Point AI Data Readiness Standard (`D1–D12`)

| Gate | Readiness Control | Verification Method | Evidence |
| :--- | :--- | :--- | :--- |
| **`D1`** | **Dual-Path Store Routing Contract:** Structured KPIs/analytics route to **Fabric IQ**; unstructured document corpora route to **Azure AI Search (`Foundry IQ`)**; tenant-scoped operational memory routes to **Cosmos DB (`DiskANN` + `RRF`)**. | Architecture review + `DRG002` store-target contract check | <span class="ev-badge ev-arch">[Arch]</span> |
| **`D2`** | **OneLake Zero-Copy Lineage & AI-Ready Gold:** Every grounded dataset carries `medallion_tier` (`gold` / `ai-gold`), `source_uri`, and `lineage_sha256` without shadow lake copies. | `data_readiness_gate.py` (`DRG002`) | <span class="ev-badge ev-m">[M]</span> <span class="ev-badge ev-arch">[Arch]</span> |
| **`D3`** | **Fabric F-SKU Interactive Isolation:** Interactive `Fabric IQ` / Data Agent queries run on a dedicated interactive F-SKU (`<=65%` steady CU) separated from batch Spark ETL via OneLake Shortcuts. | Fabric Capacity Metrics + `DRG002` + `data-grounding-freshness-gate.kql` | <span class="ev-badge ev-arch">[Arch]</span> <span class="ev-badge ev-agree">[Agree]</span> |
| **`D4`** | **Purview DSPM for AI Active:** Oversharing scan completed prior to indexing; Foundry & Fabric interaction audit, sensitivity-label tracking, and DLP policies active. | Purview DSPM portal + `DRG003` | <span class="ev-badge ev-m">[M]</span> |
| **`D5`** | **Sensitivity Label & Entra ACL Inheritance:** Every non-public chunk/document carries an explicit `sensitivity_label` and non-empty `acl_group_ids`; restricted labels never allow `allow_public_index=true`. | `data_readiness_gate.py` (`DRG003`, `DRG004`) | <span class="ev-badge ev-m">[M]</span> <span class="ev-badge ev-arch">[Arch]</span> |
| **`D6`** | **Event-Driven ACL Revocation & Tombstoning SLA:** Revocation lag verified `<=15 min` (enterprise) or `<=5 min` (regulated ethical-wall) across primary and DR stamps with zero overdue unpurged tombstones. | `DRG004` + `data-grounding-freshness-gate.kql` | <span class="ev-badge ev-agree">[Agree]</span> |
| **`D7`** | **Cosmos DB Vector/Hybrid Immutability & Partition Isolation:** `DiskANN` / `quantizedFlat` / `flat` policy + `FullTextScore` `RRF` verified; single-partition `/tenantEngagementId` key prevents cross-tenant scatter-gather. | Cosmos container policy + `DRG005` | <span class="ev-badge ev-m">[M]</span> <span class="ev-badge ev-arch">[Arch]</span> |
| **`D8`** | **Zero-Downtime Alias / Blue-Green Cutover & Re-Embedding Budget:** AI Search index alias or Cosmos blue-green container cutover configured; re-embedding token surge routed through dedicated batch TPM quota. | Decision Studio surge calc + `DRG005` | <span class="ev-badge ev-m">[M]</span> <span class="ev-badge ev-arch">[Arch]</span> |
| **`D9`** | **Layout-Aware Ingestion Fidelity:** Binary documents parsed via Azure AI Content Understanding into bounded chunks (`128–2,048` tokens default) with deterministic `chunk_sha256` IDs. | `data_readiness_gate.py` (`DRG006`) | <span class="ev-badge ev-m">[M]</span> <span class="ev-badge ev-arch">[Arch]</span> |
| **`D10`** | **Corpus Anti-Poisoning & Injection Hygiene:** Automated pre-index scanner rejects indirect prompt-injection override markers and excessive duplicate/empty chunk ratios (`<=5%`). | `data_readiness_gate.py` (`DRG006`) | <span class="ev-badge ev-arch">[Arch]</span> |
| **`D11`** | **Pos 6 Cache-Safe Ordering & Regional Freshness Parity:** Retrieved chunks injected strictly at Pos 6 (preserving Playbook 01 prefix reuse); dual-region Search/Cosmos lag stays `<1%`. | `DRG005`, `DRG007` + `pcr_lint.py` (`PCR004`) | <span class="ev-badge ev-arch">[Arch]</span> |
| **`D12`** | **OTel-to-Fabric Eval Flywheel & Automated PR Gate:** Anonymized retrieval/grounding failures feed OneLake Gold eval fixtures; `data_readiness_gate.py` runs in CI and exits `0` before promotion. | CI workflow + `DRG007` + KQL workbook | <span class="ev-badge ev-agree">[Agree]</span> |

---

## 2. Deterministic CI Verification: `data_readiness_gate.py` (`DRG001–DRG007`) {#drg-contract}

The MIT-licensed, zero-dependency Python 3 CLI ([`docs/public/kits/data_readiness_gate.py`](/papers/engineering-kits#data-gate)) validates an exported data-plane snapshot JSON against a contract exported from the [Interactive Data Strategy Advisor](/studio/#data-strategy).

### Rule Reference & Fail-Closed Exit Semantics

- **Exit `0` (`PASS`):** Every declared dataset/corpus passed all configured `DRG001–DRG007` contracts.
- **Exit `1` (`BLOCKED — Gate Violation`):** Valid JSON inputs violated one or more readiness rules (`DRG001–DRG007`).
- **Exit `2` (`BLOCKED — Invalid Input / Contract`):** Unreadable file, invalid UTF-8, duplicate JSON object keys (including nested objects), unquoted non-standard numeric constants, excessive JSON nesting, malformed/unknown top-level contract fields, or contradictory threshold bounds—never silently downgraded to defaults <span class="ev-badge ev-arch">[Arch]</span>.

| Rule ID | Deterministic Check Enforced |
| :--- | :--- |
| **`DRG001`** | Snapshot schema integrity, non-empty `datasets[]`, unique `source_id` entries, optional exact `expected_source_ids` inventory, explicit types/booleans, finite numeric bounds. |
| **`DRG002`** | Fabric / OneLake lineage (`medallion_tier` in `gold`/`ai-gold`, non-empty `source_uri`, and exactly 64 ASCII hexadecimal characters in `lineage_sha256`), valid `store_target` (`fabric-iq`, `ai-search`, `cosmos-hybrid`), and `dedicated_interactive_fsku=true` when `fabric-iq` is enabled. |
| **`DRG003`** | Microsoft Purview DSPM for AI active (`purview_dspm_enabled=true`), valid non-empty `sensitivity_label` on every dataset, and zero restricted datasets (`Confidential` / `Highly Confidential`) marked `allow_public_index=true`. |
| **`DRG004`** | Entra ACL enforcement (`acl_enforced=true`), non-empty `acl_group_ids` on non-public datasets, `revocation_lag_minutes <= max_revocation_lag_min` (`15` enterprise / `5` regulated), and zero overdue tombstones (`overdue_tombstones == 0`). |
| **`DRG005`** | Store-specific production parity: `cosmos-hybrid` requires `vector_index_type` in `{"diskANN", "quantizedFlat", "flat"}`, `hybrid_rrf_enabled=true`, `tenant_partition_key_scoped=true`, and consistent positive-integer `embedding_dim` within the selected index limit (`flat`: `505`; `quantizedFlat`/`diskANN`: `4096`); `ai-search` requires `alias_cutover_enabled=true` and `region_lag_pct <= max_region_lag_pct`. |
| **`DRG006`** | Corpus hygiene & anti-poisoning: `avg_chunk_tokens` within `[min_chunk_tokens, max_chunk_tokens]`, `duplicate_or_empty_ratio_pct <= max_duplicate_ratio_pct`, and zero indirect prompt-injection signatures in `sample_chunks[]`. |
| **`DRG007`** | Grounding freshness & cache-safe flywheel: `freshness_lag_minutes <= max_freshness_lag_min`, `pos6_cache_safe_ordering=true`, and `eval_flywheel_enabled=true` when required by contract. |

```bash
# Run offline self-test suite (zero external dependencies)
python3 docs/public/kits/data_readiness_gate.py --self-test

# Evaluate a pre-cutover data-plane snapshot against a Decision Studio contract
python3 docs/public/kits/data_readiness_gate.py ./artifacts/data-snapshot.json \
  --contract ./data-readiness-contract.json --json
```

---

### Strict JSON Numeric Constants (`DRG001`) {#strict-json-constants}

Both the acceptance contract and data snapshot reject unquoted `NaN`, `Infinity`, and `-Infinity` anywhere, including ignored root metadata and metadata in a later dataset after otherwise valid evidence. These inputs exit `2` before snapshot evaluation, with no stdout or partial readiness report. The diagnostic identifies the input role without echoing paths, member names, or constant values. Invalid contract JSON is rejected before the snapshot file is read <span class="ev-badge ev-arch">[Arch]</span>.

Quoted strings such as `"NaN"`, ordinary JSON scalars, and nested metadata remain supported. This is a local JSON-integrity policy, not a Microsoft service requirement, metadata-schema validator, or evidence-authenticity check. Standard JSON numbers that overflow floating-point parsing are not rejected by this constant rule; existing finite-number checks still apply to enforced numeric fields <span class="ev-badge ev-arch">[Arch]</span>.

Offline regressions exercise all three constants in enforced fields and ignored nested metadata for both inputs, text/JSON CLI exit `2`, contract-before-snapshot validation, and exit `0` recovery with valid metadata. They run through `node scripts/run-python.mjs docs/public/kits/data_readiness_gate.py --self-test` in `npm run verify`, without live Azure access <span class="ev-badge ev-val">[Validate]</span>.

### Approved Dataset Inventory (`DRG001`) {#expected-source-inventory}

An optional `expected_source_ids` contract field blocks a clean subset or substituted corpus from passing readiness. `required_stores` checks store coverage, not dataset completeness: several required corpora can share the same store. Approve the inventory independently of the submitted snapshot <span class="ev-badge ev-arch">[Arch]</span>.

```json
{
  "expected_source_ids": [
    "fabric-finance-kpis",
    "search-regulatory-corpus",
    "cosmos-agent-episodic-memory"
  ]
}
```

Every expected identifier must appear exactly once, with no unexpected identifiers; matching is exact and case-sensitive, and dataset order is irrelevant. Existing duplicate-source checks remain active. Missing or unexpected sources produce `DRG001` and exit `1`, preserving other findings and dataset counts. Inventory diagnostics use counts and dataset ordinals, never the missing or unexpected identifier values <span class="ev-badge ev-arch">[Arch]</span>.

The field must be a non-empty array of unique, non-empty strings without leading or trailing whitespace. Invalid inventories exit `2` with no stdout before snapshot evidence is read. Omission preserves existing defaults and Decision Studio exports; `null` and empty arrays do not disable the check. This local acceptance contract verifies declared inventory completeness, not artifact authenticity, live connector access, or source-content quality <span class="ev-badge ev-arch">[Arch]</span>.

The kit's offline self-test covers reordered complete snapshots, omitted and substituted datasets, duplicate entries, combined governance failures, and invalid inventory types in text and JSON CLI modes. It runs through `node scripts/run-python.mjs docs/public/kits/data_readiness_gate.py --self-test` in `npm run verify` <span class="ev-badge ev-val">[Validate]</span>.

### Exact ACL Group Identifiers (`DRG001`, `DRG004`) {#exact-acl-group-identifiers}

Azure AI Search's [security-filter pattern](https://learn.microsoft.com/en-us/azure/search/search-security-trimming-for-azure-search) stores principal identifiers as strings and filters results using those identifiers; the filter itself does not authenticate or authorize the principal <span class="ev-badge ev-m">[M]</span>.

The snapshot gate requires every `acl_group_ids` entry to be a non-empty string without leading or trailing whitespace, including tabs, newlines, and Unicode whitespace. Malformed entries produce `DRG001` and exit `1`, without trimming, case-folding, or echoing group/source identifiers in the new diagnostic. Empty arrays remain valid for public datasets; non-public datasets still require at least one group under `DRG004`. This is a local metadata-integrity policy, not an Entra identifier-format requirement or proof of live group existence, membership, or ACL inheritance <span class="ev-badge ev-arch">[Arch]</span>.

Offline self-tests cover malformed entries across all three stores, exact mixed-case and Unicode strings, public empty arrays, combined governance failures, and text/JSON CLI exit `1` with exit `0` recovery. They run through `node scripts/run-python.mjs docs/public/kits/data_readiness_gate.py --self-test` in `npm run verify`; no live authorization probe is performed <span class="ev-badge ev-val">[Validate]</span>.

### Lineage Digest Syntax (`DRG002`) {#lineage-digest-syntax}

Every dataset, across all three store targets, must supply `lineage_sha256` as exactly 64 ASCII hexadecimal characters (`0–9`, `a–f`, `A–F`). Lowercase, uppercase, and mixed-case digests are accepted without normalization. Missing values, non-string types, placeholders, incorrect lengths, non-hex characters, and surrounding or embedded whitespace produce `DRG002` and exit `1`; other findings and dataset counts remain intact. The diagnostic identifies the dataset ordinal and field without echoing the digest or source identifier <span class="ev-badge ev-arch">[Arch]</span>.

This is a local lineage-metadata syntax contract, not a Microsoft service requirement. Generate the digest from an independently defined lineage artifact and retain that artifact for review: the gate does not recompute hashes, authenticate provenance, compare approved lineage pins, or prove zero-copy ingestion. A syntactically valid fabricated or stale digest can still pass <span class="ev-badge ev-arch">[Arch]</span>.

Offline self-tests cover missing and malformed values for every store, valid casing and recovery, combined governance failures, and text/JSON CLI exit codes with non-echoing diagnostics. Existing sample snapshots and Decision Studio contract exports remain compatible. These regressions run in `npm run verify`, without accessing live Fabric, Search, or Cosmos resources <span class="ev-badge ev-val">[Validate]</span>.

### Cosmos Vector Index Dimension Limits (`DRG005`) {#cosmos-dimension-limits}

Azure Cosmos DB for NoSQL supports at most **505 dimensions** for `flat` vector indexes and **4,096 dimensions** for `quantizedFlat` and `diskANN`, according to the [published vector-index limits](https://learn.microsoft.com/en-us/azure/cosmos-db/vector-search#vector-indexing-policies) <span class="ev-badge ev-m">[M]</span>.

For each `cosmos-hybrid` dataset, `DRG005` requires a positive integer `embedding_dim` no greater than the selected index's limit. A `flat` index with `1536` or `3072` dimensions therefore blocks readiness even though those are valid Decision Studio sizing presets. Oversized dimensions exit `1`, with dataset ordinals rather than source identifiers in the new diagnostic; other findings and cross-dataset dimension consistency checks remain active. Fabric and AI Search datasets are unaffected <span class="ev-badge ev-arch">[Arch]</span>.

This offline metadata check does not inspect the deployed container policy, vector lengths, embedding-model compatibility, or retrieval recall. Choose a compatible index and embedding model before creating the container; passing this check does not prove live deployment readiness <span class="ev-badge ev-arch">[Arch]</span>.

Self-tests cover each index's inclusive upper boundary, one dimension above it, small valid dimensions, incompatible `flat` presets, malformed index types, combined governance/parity failures, and text/JSON CLI exit codes. They run through `node scripts/run-python.mjs docs/public/kits/data_readiness_gate.py --self-test` in `npm run verify`, without live Azure access <span class="ev-badge ev-val">[Validate]</span>.

## 3. Continuous Production Drift Monitoring (`data-grounding-freshness-gate.kql`)

Deploy [`data-grounding-freshness-gate.kql`](/papers/engineering-kits#data-kql) into Log Analytics / Application Insights to detect post-cutover regressions before users report stale answers:

- **Ingestion & ACL Tombstoning Lag (`D6`, `D11`):** Alerts when `MaxRevocationLagMin > 15` (`> 5` regulated) or `MaxFreshnessLagMin > 60`.
- **Purview DSPM Label Coverage (`D4`, `D5`):** Fails immediately if `UnlabelledRetrievalCount > 0`.
- **Cosmos DB Hybrid RU & Fabric CU Throttling (`D3`, `D7`):** Tracks `Cosmos429RatePct`, p95 RU charge per hybrid query (flagging accidental cross-partition fan-out), and Fabric IQ `429`/CU delay events.
- **Zero-Grounding Drift (`D12`):** Surfaces rising empty-retrieval rates so missing OneLake shortcuts or broken indexers trigger automated alerting.
