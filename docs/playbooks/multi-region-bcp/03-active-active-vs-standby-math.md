---
title: "03 · Active-Active vs. Standby Economics & Cold-Cache Surge Math"
description: Modeling multi-region PTU reservation TCO against active-passive PAYG standby and quantifying the 15-minute cold-cache TPM surge during regional cutover.
---

# 03 · Active-Active vs. Standby Economics & Cold-Cache Surge Math

<PlaybookMeta
  track="03 · Multi-Region Foundry BCP, Residency & Failover Drills"
  verified="2026-11-19 22:12 PST"
  status="Live v2.0"
/>

<PageBrief
  stage="design"
  readTime="5 min read"
  problem="Sizing a secondary DR deployment only for steady-state cached TPM causes immediate HTTP 429 throttling during a real regional failover because the secondary stamp's KV prefix cache starts completely cold (0% hit rate)."
  takeaway="Account for the 1.8×–2.56× Cold-Cache Warm-Up Surge during the first 5–15 minutes of regional cutover, and absorb it elastically via Secondary Data-Zone/Regional Standard PAYG."
  csaUse="Run the interactive BCP & Cold-Cache Surge Advisor below to size primary PTUs, standby anchors, and secondary PAYG TPM quotas."
/>

## 1. Quantifying the Cold-Cache Failover Surge `[Arch]`

From [Playbook 01](/playbooks/prompt-caching/qualify/04-ptu-sizing-math), a tuned multi-node document-review workload (`100 RPM`, `10,000` input tokens, `500` output tokens, `80%` cached prefix share on `gpt-5.6-terra`) requires only **`170 PTUs`** (`500,000` Normalized TPM) in steady state because cached prefix tokens consume `0%` PTU capacity (`0.10x` / `0.05x` on `GPT-6` / `6.1`) <span class="ev-badge ev-m">[M]</span>.

When Primary Region A suffers an outage and APIM switches 100% of live traffic to Secondary Region B:

- **Minute 0–2 (Cold Secondary KV Cache, `0%` Hit Rate):** Every shard (`shard-0..8`) must write and compute full prefix tensors (`1.0x` on `5.6`, `1.25x` write weight on `6`/`6.1`). Normalized TPM temporarily spikes to **`1,300,000`–`1,450,000` TPM (`435–485 PTU` equivalent — `2.56×+`)**!
- **Minute 3–10 (T0 Shards Warm, L2 Warming):** Practice-wide `T0` shards reach `100%` hit parity within `1–2` turns per shard; engagement-scoped `L2` prefixes warm across active sessions.
- **Minute 15+ (Steady Secondary Equilibrium):** Cache hit rate stabilizes back at `~80%`, returning capacity draw to the `170 PTU` baseline.

<div class="arch-diagram">
  <svg viewBox="0 0 760 156" role="img" aria-labelledby="pb3-surge-title pb3-surge-desc" font-family="Segoe UI, Inter, -apple-system, sans-serif">
    <title id="pb3-surge-title">Regional Cutover Cold-Cache Surge Curve and Hybrid Absorption</title>
    <desc id="pb3-surge-desc">Shows T=0 Regional Cutover triggering a 2.56x Cold-Cache TPM Surge in Minutes 0-5 absorbed by Secondary Standard PAYG quota, decaying back to 1.0x Steady Warm Cache Baseline by Minute 15.</desc>
    <defs><marker id="srg-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#0f766e"/></marker></defs>
    <rect x="8" y="18" width="174" height="96" rx="6" fill="#eaf7f5" stroke="#0f766e" stroke-width="1.4"/>
    <text x="16" y="37" font-size="9.1" font-weight="700" fill="#115e59">1. Pre-Incident (Primary)</text>
    <text x="16" y="53" font-size="8.1" fill="#334e68">80% warm prefix hit rate</text>
    <text x="16" y="67" font-size="8.1" fill="#334e68">500K Norm TPM steady</text>
    <text x="16" y="81" font-size="8.1" fill="#334e68">Served on 170 PTU-M</text>
    <text x="16" y="100" font-size="7.8" font-weight="700" fill="#0f766e">[1.00× Baseline Draw]</text>
    <path d="M182 66 H202" stroke="#b45309" stroke-width="1.8" marker-end="url(#srg-arr)"/>
    <rect x="206" y="18" width="184" height="96" rx="6" fill="#fef2f2" stroke="#dc2626" stroke-width="1.4"/>
    <text x="214" y="37" font-size="9.1" font-weight="700" fill="#991b1b">2. Min 0–5 Cutover Surge</text>
    <text x="214" y="53" font-size="8.1" fill="#475569">Secondary KV cache is 0%</text>
    <text x="214" y="67" font-size="8.1" fill="#475569">All shards hydrate T0 + L2</text>
    <text x="214" y="81" font-size="8.1" fill="#475569">~1.3M–1.45M Norm TPM</text>
    <text x="214" y="100" font-size="7.8" font-weight="700" fill="#b91c1c">[2.56×+ Cold-Cache Spike]</text>
    <path d="M390 66 H410" stroke="#0f766e" stroke-width="1.8" marker-end="url(#srg-arr)"/>
    <rect x="414" y="18" width="170" height="96" rx="6" fill="#fff7eb" stroke="#d97706" stroke-width="1.4"/>
    <text x="422" y="37" font-size="9.1" font-weight="700" fill="#92400e">3. Elastic Absorption</text>
    <text x="422" y="53" font-size="8.1" fill="#92400e">Secondary Data-Zone</text>
    <text x="422" y="67" font-size="8.1" fill="#92400e">Standard PAYG quota</text>
    <text x="422" y="81" font-size="8.1" fill="#92400e">absorbs 15m warm-up</text>
    <text x="422" y="100" font-size="7.8" font-weight="700" fill="#b45309">[Zero 2× Idle PTU Tax]</text>
    <path d="M584 66 H604" stroke="#0f766e" stroke-width="1.8" marker-end="url(#srg-arr)"/>
    <rect x="608" y="18" width="144" height="96" rx="6" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.5"/>
    <text x="616" y="37" font-size="9.1" font-weight="700" fill="#115e59">4. Min 15+ Stabilized</text>
    <text x="616" y="53" font-size="8.1" fill="#334e68">T0 + L2 shards warm</text>
    <text x="616" y="67" font-size="8.1" fill="#334e68">80% hit rate restored</text>
    <text x="616" y="81" font-size="8.1" fill="#334e68">Steady TPM resumed</text>
    <text x="616" y="100" font-size="7.8" font-weight="700" fill="#0f766e">[Full Parity in DR]</text>
    <text x="10" y="140" font-size="8.3" fill="#526c80">Pre-verifying secondary Standard TPM quota >= 2.6× steady cached TPM prevents secondary cascade throttling on failover.</text>
  </svg>
</div>

---

## 2. Comparing Three Multi-Region Capacity Postures

| Continuity Posture | Primary Stamp | Secondary DR Stamp | Annual Reserved PTU Cost | When to Select |
| :--- | :--- | :--- | :--- | :--- |
| **Posture 1 · Active-Passive (`PTU-M` + `Standard PAYG`)** | `100%` steady PTU-M (`e.g., 170 PTUs`) + local PAYG spillover | `0 PTUs` reserved; high-TPM `DataZoneStandard` / `Standard` deployment pre-provisioned & tested | **`1.00×` Baseline** (PAYG billed only during outages & quarterly drills) | **Recommended for 85%+ of enterprise Tier-1 workloads** with `<15s` RTO and tolerance for Standard PAYG p95 latency during rare regional events. |
| **Posture 2 · Warm-Anchor Hybrid (`PTU-M` + `Min-PTU` + `PAYG`)** | `100%` steady PTU-M | Minimum `15–25 PTU` warm anchor + Standard PAYG burst overflow | **`~1.09×–1.15×` Baseline** | Regulated workloads requiring continuous synthetic PTU health verification in Region B without paying `2×` reservation cost. |
| **Posture 3 · Symmetric Active-Active (`Dual PTU-M`)** | `100%` failover-capable PTU-M | `100%` failover-capable PTU-M (partitioned by tenant/practice during normal ops to preserve cache locality!) | **`2.00×` Baseline** (plus cold-cache PAYG buffer) | Mission-critical Tier-0 clinical, trading, or emergency systems prohibiting PAYG pool dependency during regional loss. |

---

## 3. Interactive Multi-Region BCP & Surge Calculator

The advisor blocks metrics, recommendations, and Markdown export for blank, non-finite, or out-of-range numeric inputs instead of silently clamping them. Primary capacity must be a safe whole number of at least `15` PTUs in `5`-PTU steps; cached share accepts `0–95%`, including fractional percentages. Surge capacity and combined reservations must also remain safe integers. These are **local estimator guardrails**, not a universal Azure SKU availability or scale-increment guarantee. Field-linked errors clear after correction, and valid inputs preserve the existing posture math. Offline interaction regressions run in `npm run verify`; they do not certify quota, throughput, RTO, or live failover readiness <span class="ev-badge ev-arch">[Arch]</span>.

<BcpResidencyAdvisor />
