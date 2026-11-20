---
title: "05 · Game-Day Failover Drills, Snapshot Drift & B1–B12 Standard"
description: Repeatable quarterly Game-Day failover protocol, model snapshot parity checks, and the 12-point Multi-Region BCP Readiness Standard (B1–B12).
---

# 05 · Game-Day Failover Drills, Snapshot Drift & `B1–B12` Standard

<PlaybookMeta
  track="03 · Multi-Region Foundry BCP, Residency & Failover Drills"
  verified="2026-11-19 PST"
  status="Live v2.0"
  kitHref="/papers/engineering-kits#bcp-kql"
  printable
/>

<PageBrief
  stage="govern"
  readTime="4 min read"
  problem="Secondary DR stamps rot silently when primary deployments upgrade model snapshots, rotate RBAC roles, or outgrow secondary PAYG TPM quotas."
  takeaway="Run automated daily snapshot-parity probes plus a 30-minute quarterly Game-Day cutover drill verified by the B1–B12 BCP Readiness Standard."
  csaUse="Execute the 5-step Game-Day runbook below in non-peak windows and archive the KQL telemetry output for compliance sign-off."
/>

## 1. Five-Step Quarterly Game-Day Drill Protocol `[Validate]`

1. **Pre-Flight Drift Check (`T - 15 min`):** Verify identical model name, version snapshot string, content-filter policy name, APIM Managed Identity RBAC (`Cognitive Services OpenAI User`), and Secondary AI Search document count parity (`≤1%` delta).
2. **Synthetic Canary Cutover (`T + 0 min`):** Apply an APIM inbound test header (`x-bcp-drill: force-secondary`) or trip Priority-1 health status for a `10%` canary slice, then ramp to `100%` traffic onto Secondary Stamp B.
3. **Cold-Cache Surge Observation (`T + 0..15 min`):** Run [`bcp-failover-readiness-gate.kql`](/papers/engineering-kits#bcp-kql) to measure:
   - Cutover RTO (`time from primary 503/429 injection to first HTTP 200 on Secondary Stamp B`).
   - Cold-cache peak TPM absorbed without surfacing HTTP `429` to end users.
   - Time for Secondary `CachedSharePct` to climb from `0%` above `60%`.
4. **Stateful Turn Continuity Test (`T + 15 min`):** Start a multi-turn agent thread in Stamp A, force mid-conversation failover to Stamp B, upload/query a grounded document, and verify zero Cosmos DB checkpoint loss and valid AI Search citations.
5. **Failback & Evidence Sign-Off (`T + 30 min`):** Restore Priority-1 routing to Stamp A, verify automatic circuit-breaker healing, and export the KQL drill record for Risk/Audit retention.

### Snapshot Evidence Must Include the Expected Secondary

A per-region healthy KQL row cannot prove cross-region parity: two regions can each report one **different** snapshot, and a silent secondary emits no row at all. Before `B2`/`B11` sign-off, run the [offline snapshot companion gate](/papers/engineering-kits#fail-closed-cross-region-snapshot-evidence) on the drill's exported KQL result objects against an independently approved model/region manifest. It requires positive call evidence from every expected region and an exact match to the pinned snapshot, rejecting unknown snapshots, duplicates, and unexpected stamps <span class="ev-badge ev-arch">[Arch]</span>.

Send synthetic probes to the standby during the selected lookback window; absence of secondary evidence must block sign-off, not count as a healthy standby. Snapshot success does not validate content-filter parity or replace the live failover and stateful-continuity checks above <span class="ev-badge ev-val">[Validate]</span>.

Freshness must be checked **per stamp**: an active primary must not hide an old secondary observation or a replayed export. The companion requires the updated query's `LastSeen` timestamp and rejects missing, timezone-less, future, or stale values <span class="ev-badge ev-arch">[Arch]</span>. Its default maximum age is **15 minutes**, configurable with a positive integer `--max-age-minutes` to match the approved probe cadence; this is a local readiness threshold, not an Azure guarantee <span class="ev-badge ev-agree">[Agree]</span>.

---

## 2. The 12-Point Multi-Region BCP Readiness Standard (`B1–B12`) `[Agree]`

| Gate ID | Category | Verification Requirement | Target Pass Bar |
| :--- | :--- | :--- | :--- |
| **`B1`** | Residency Symmetry | Primary, local spillover, and secondary DR deployments all enforce the **same or stricter** geographic scope (`DataZone` or `Regional`) <span class="ev-badge ev-m">[M]</span>. | Verified in Azure Policy |
| **`B2`** | Snapshot Parity | Primary and Secondary Foundry deployments pin the **exact same model version snapshot** and `contentFilter` configuration. | `0` version drift |
| **`B3`** | Cold-Cache Quota | Secondary region's `Standard` + `PTU-M` TPM quota is `≥ 2.6×` primary steady cached Normalized TPM to survive cold-cache hydration. | Quota verified |
| **`B4`** | Zone Redundancy | Intra-region Availability Zones (`ZRS`) enabled on APIM, Cosmos DB, ADLS Gen2, AI Search (`≥2–3` replicas), and ACA environment <span class="ev-badge ev-m">[M]</span>. | `100%` ZRS where supported |
| **`B5`** | Stateless Threading | Agent conversation state is persisted in multi-region Cosmos DB (`Model 2`), never trapped in single-region in-memory / server state. | Verified mid-thread cutover |
| **`B6`** | Search Index Parity | Secondary Azure AI Search stamp indexes continuously from `RA-GZRS` ADLS Gen2 with `<1%` document count lag <span class="ev-badge ev-m">[M]</span>. | Automated lag alert |
| **`B7`** | Sandbox Pool Parity | Secondary ACA Dynamic Session Pool / Sandbox Group is deployed with matching container image SHA tag (never `:latest`). | Exact SHA match |
| **`B8`** | Keyless DR Auth | Secondary APIM + ACA Managed Identities hold pre-assigned RBAC roles on Secondary Foundry, Cosmos, Search, and ADLS <span class="ev-badge ev-m">[M]</span>. | Verified by synthetic probe |
| **`B9`** | Automated Cutover | APIM Backend Pool circuit breaker switches inference traffic on `429` / `5xx` without manual DNS or portal edits <span class="ev-badge ev-m">[M]</span>. | `<15s` cutover RTO |
| **`B10`** | Synthetic Probe | Lightweight 5-minute synthetic health probe verifies Secondary Foundry + Search availability (`<1,024` tokens, cache writes off). | `99.9%` probe pass |
| **`B11`** | Workpaper Lineage | Failover responses record actual executing region/stamp and model snapshot in OpenTelemetry / workpaper audit logs. | Verified in App Insights |
| **`B12`** | Quarterly Game-Day | Full 30-minute Game-Day drill executed and signed off within the last 90 days (and prior to major seasonal filing cliffs). | Signed KQL evidence |
