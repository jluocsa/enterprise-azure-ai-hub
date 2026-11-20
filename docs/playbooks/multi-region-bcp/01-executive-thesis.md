---
title: "01 · Executive Thesis & Regional AI Failure Modes"
description: Business continuity architecture for regulated Microsoft Foundry workloads—aligning residency boundaries, cold-cache failover surges, and stateful session/search dependencies.
---

# 01 · Executive Thesis & Regional AI Failure Modes

<PlaybookMeta
  track="03 · Multi-Region Foundry BCP, Residency & Failover Drills"
  provenance="Customer-Zero Validated (Regulated Multi-Region Enterprise AI Stamp)"
  governance="Sanitized · Peer Reviewed · IP Screened"
  owners="John Luo (@jluocsa) · Co-Authors Welcome"
  verified="2026-11-19 PST"
  status="Live v2.0"
  paperHref="/papers/enterprise-foundry-platform-blueprint"
  paperLabel="Full-Stack Blueprint →"
  studioHref="/studio/#bcp"
  studioLabel="BCP & Surge Advisor →"
/>

<PageBrief
  stage="start"
  readTime="4 min read"
  problem="Failing over an LLM endpoint alone leaves enterprise agents broken if regional data-processing boundaries are violated, secondary KV caches choke on cold-start surges, or Cosmos/AI Search state lags behind."
  takeaway="Design Business Continuity at the AI Stamp level: pair Data-Zone/Regional PTU-M with secondary PAYG surge capacity, synchronize Cosmos DB + AI Search stamps, and verify <15s cutover via quarterly game-day drills."
  csaUse="Use the 4-failure-mode diagram and decision table below to align Risk/Compliance, Cloud Infrastructure, and AI Platform teams."
/>

## Why Traditional Stateless Web DR Fails for Enterprise AI

Most cloud disaster-recovery runbooks assume stateless compute tiers where Region B can immediately serve 100% of Region A's traffic at identical unit capacity. Production Microsoft Foundry platforms introduce **four AI-specific continuity constraints** <span class="ev-badge ev-m">[M]</span> <span class="ev-badge ev-arch">[Arch]</span>:

1. **Data-Processing vs. Data-at-Rest Residency:** A `Global` deployment stores configuration metadata in the resource region, whereas inference compute may execute globally <span class="ev-badge ev-m">[M]</span>. Regulated workloads bound by geographic sovereignty must select **Data Zone (`US` / `EU`)** or **Regional** SKUs on *both* primary and failover legs <span class="ev-badge ev-m">[M]</span>.
2. **Independent Regional Quota & PTU Reservations:** Provisioned Throughput (`PTU-M`) capacity is reserved per deployment and does **not** automatically float across regions during an outage <span class="ev-badge ev-m">[M]</span>. Doubling reserved PTUs idle in Region B costs `2.0×` year-round unless paired with an **Active-Passive PTU-M + Secondary Standard PAYG / Warm-Anchor** topology <span class="ev-badge ev-arch">[Arch]</span>.
3. **The Cold-Cache Regional Cutover Surge:** Prompt KV caches are **strictly local** to each deployment/stamp <span class="ev-badge ev-m">[M]</span>. When an active workload running at `80%` prefix cache reuse fails over to a cold secondary region, cached hits drop to `0%` for the first `5–15 minutes`, spiking normalized input TPM by **`1.8×–2.56×`** right at the moment of cutover <span class="ev-badge ev-arch">[Arch]</span>.
4. **Coupled Stateful Agent Dependencies:** Multi-turn agents depend on **Azure Cosmos DB** thread/checkpoint state and **Azure AI Search** (`Foundry IQ`) knowledge indexes. Failing over the model endpoint while leaving AI Search or session state stranded in an unreachable primary region still causes `100%` turn failure <span class="ev-badge ev-arch">[Arch]</span>.

<div class="arch-diagram">
  <svg viewBox="0 0 760 192" role="img" aria-labelledby="pb3-t1-title pb3-t1-desc" font-family="Segoe UI, Inter, -apple-system, sans-serif">
    <title id="pb3-t1-title">Multi-Region Enterprise AI Stamp Continuity Architecture</title>
    <desc id="pb3-t1-desc">Shows Primary Stamp (East US 2: APIM Gateway, Foundry PTU-M + PAYG, Cosmos DB Write Region, AI Search Stamp A) replicating state to Secondary Stamp (Central US / West US 3: APIM Gateway, Warm Min-PTU + Standard PAYG Cold-Cache Surge Buffer, Cosmos DB Automatic Failover, AI Search Stamp B).</desc>
    <defs><marker id="bcp-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#0f766e"/></marker></defs>
    <rect x="8" y="14" width="328" height="146" rx="7" fill="#eaf7f5" stroke="#0f766e" stroke-width="1.5"/>
    <text x="18" y="33" font-size="9.4" font-weight="700" fill="#115e59">Primary AI Stamp (e.g., East US 2 · Active)</text>
    <rect x="18" y="43" width="308" height="48" rx="5" fill="#ffffff" stroke="#0f766e"/>
    <text x="26" y="59" font-size="8.6" font-weight="700" fill="#115e59">APIM Gateway + Foundry Primary PTU-M (170 PTUs)</text>
    <text x="26" y="73" font-size="8.0" fill="#334e68">Warm Pos 1–6 KV cache (80%+ hit) + local Standard spillover</text>
    <rect x="18" y="99" width="308" height="48" rx="5" fill="#edf3fb" stroke="#5b87b2"/>
    <text x="26" y="115" font-size="8.6" font-weight="700" fill="#183e62">Stateful Tier: Cosmos DB + AI Search Stamp A + ADLS</text>
    <text x="26" y="129" font-size="8.0" fill="#334e68">Thread checkpoints, workpaper lineage &amp; grounded index</text>

    <path d="M336 67 H420" stroke="#b45309" stroke-width="1.9" stroke-dasharray="5 3" marker-end="url(#bcp-arr)"/>
    <text x="378" y="57" text-anchor="middle" font-size="7.8" font-weight="700" fill="#b45309">429 / 5xx Cutover (&lt;15s)</text>

    <path d="M336 123 H420" stroke="#0f766e" stroke-width="1.8" marker-end="url(#bcp-arr)"/>
    <text x="378" y="114" text-anchor="middle" font-size="7.8" font-weight="700" fill="#0f766e">Continuous Geo-Sync</text>

    <rect x="424" y="14" width="328" height="146" rx="7" fill="#fff7eb" stroke="#d97706" stroke-width="1.4"/>
    <text x="434" y="33" font-size="9.4" font-weight="700" fill="#92400e">Secondary DR AI Stamp (Same Data Zone · Standby)</text>
    <rect x="434" y="43" width="308" height="48" rx="5" fill="#ffffff" stroke="#d97706"/>
    <text x="442" y="59" font-size="8.6" font-weight="700" fill="#92400e">Warm Min-PTU Anchor + High-TPM Standard PAYG</text>
    <text x="442" y="73" font-size="8.0" fill="#92400e">Absorbs 2.56× cold-cache surge while secondary KV warms</text>
    <rect x="434" y="99" width="308" height="48" rx="5" fill="#edf3fb" stroke="#5b87b2"/>
    <text x="442" y="115" font-size="8.6" font-weight="700" fill="#183e62">Stateful Tier: Cosmos Multi-Region + AI Search Stamp B</text>
    <text x="442" y="129" font-size="8.0" fill="#334e68">Pre-indexed from GZRS ADLS · Pinned model snapshot</text>

    <text x="10" y="178" font-size="8.3" fill="#526c80">Cohesive stamp continuity: inference, gateway, session checkpoints, and search indexes fail over within one residency boundary.</text>
  </svg>
</div>

---

## Core Continuity Questions Answered in Playbook 03

| Question | Verified Architectural Answer | Chapter |
| :--- | :--- | :--- |
| **When can we use `Data Zone Provisioned` vs. strict `Regional Provisioned`?** | Use **Data Zone (`US` / `EU`)** whenever contracts permit US-wide or EU-wide processing (higher quota liquidity + lower minimum PTUs on `gpt-6-astra`/`6.1-sol`); reserve **Regional** for strict single-country mandates <span class="ev-badge ev-m">[M]</span>. | [02 · Residency & SKU Matrix](./02-residency-and-sku-matrix) |
| **Must we pay `2×` reserved PTUs year-round to achieve `<15s` regional RTO?** | Only for Tier-0 workloads prohibiting any PAYG latency variance. Most regulated Tier-1 workloads achieve `<15s` RTO at `1.00×–1.15×` PTU cost by pairing Primary PTU-M with Secondary Standard PAYG (plus optional `15–25` PTU warm anchor) <span class="ev-badge ev-arch">[Arch]</span>. | [03 · Standby & Cold-Cache Math](./03-active-active-vs-standby-math) |
| **How do we keep Azure AI Search and Cosmos DB consistent during failover?** | Ingest source documents once to `GZRS` ADLS Gen2, run independent AI Search indexers per stamp, and enable Cosmos DB multi-region writes or managed failover <span class="ev-badge ev-m">[M]</span> <span class="ev-badge ev-arch">[Arch]</span>. | [04 · Stateful Stamp Failover](./04-stateful-stamp-failover) |
| **How do we prove DR readiness to auditors without disrupting live users?** | Run quarterly Game-Day fault injection + automated snapshot-parity audits against `B1–B12`. | [05 · Game-Day Drills & B1–B12](./05-gameday-failover-drills) |
