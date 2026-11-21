---
title: "02 · Global vs. Data Zone vs. Regional Residency Matrix"
description: Mapping regulatory sovereignty contracts to Microsoft Foundry deployment types (Global, Data Zone, Regional Provisioned & Standard) across primary and failover stamps.
---

# 02 · Global vs. Data Zone vs. Regional Residency Matrix

<PlaybookMeta
  track="03 · Multi-Region Foundry BCP, Residency & Failover Drills"
  verified="2026-11-19 22:12 PST"
  status="Live v2.0"
  studioHref="/studio/#bcp"
  studioLabel="BCP Residency Advisor →"
/>

<PageBrief
  stage="qualify"
  readTime="4 min read"
  problem="Mixing Global spillover endpoints behind a Regional or Data Zone primary PTU-M deployment silently violates data-processing residency clauses the moment a 429 burst occurs."
  takeaway="Enforce Residency Symmetry across Primary, Local Spillover, and Secondary DR backends: every backend in an APIM pool must belong to the same or stricter residency tier."
  csaUse="Walk Risk/Legal and Cloud Security through the deployment matrix below to lock in the allowed SKU family before requesting quota."
/>

## 1. Microsoft Foundry Deployment Scope Boundaries `[M]`

Microsoft Foundry offers three geographic processing scopes across both **Provisioned (`PTU-M`)** and **Standard (`PAYG`)** SKUs <span class="ev-badge ev-m">[M]</span>:

| Deployment Scope | Data-at-Rest Location | Inference Compute & Prompt KV Cache Location | Min PTU (`gpt-6.1-sol`) | Best Fit |
| :--- | :--- | :--- | :--- | :--- |
| **Global** (`GlobalProvisionedManaged` / `GlobalStandard`) | Resource's Azure geography <span class="ev-badge ev-m">[M]</span> | May process in any global Azure AI location; KV cache isolated to subscription <span class="ev-badge ev-m">[M]</span>. | `15 PTU` (inc `5`) <span class="ev-badge ev-m">[M]</span> | Non-sovereign enterprise workloads prioritizing highest TPM ceiling and fastest model availability. |
| **Data Zone** (`DataZoneProvisionedManaged` / `DataZoneStandard`) | Resource's Azure geography <span class="ev-badge ev-m">[M]</span> | Strictly confined within **Microsoft-defined Data Zone (`US` or `EU`)** across both compute and temporary KV cache <span class="ev-badge ev-m">[M]</span>. | `15 PTU` (inc `5`) <span class="ev-badge ev-m">[M]</span> | **Recommended regulated default** for US federal/financial/tax/advisory or EU GDPR workloads allowing intra-US or intra-EU failover. |
| **Regional** (`ProvisionedManaged` / `Standard`) | Single target Azure region <span class="ev-badge ev-m">[M]</span> | Strictly confined to the **single deployed Azure region** <span class="ev-badge ev-m">[M]</span>. | `25 PTU` (`15` on `5.6` / `6-sol`) <span class="ev-badge ev-m">[M]</span> | Single-country sovereignty mandates outside US/EU Data Zones (e.g., UK, Canada, Australia, Switzerland, Japan) or sub-10ms intra-region co-location. |

---

## 2. The Golden Rule of Residency Symmetry `[Arch]`

::: danger Never Spill Down-Boundary (`Data Zone` → `Global` or `Regional` → `Global`)
An APIM failover policy only triggers during peak filing cliffs or regional incidents—meaning normal weekday compliance scans see `100%` in-region traffic while peak client bursts silently route to `GlobalStandard` if misconfigured.
:::

Enforce **Residency Symmetry** in Bicep and Azure Policy (`Microsoft.CognitiveServices/accounts/deployments`):

1. **Data Zone US Stamp:** Primary `DataZoneProvisionedManaged` (East US 2) &rarr; Local Spillover `DataZoneStandard` (East US 2) &rarr; Secondary DR `DataZoneStandard` / `DataZoneProvisionedManaged` (Central US or West US 3).
2. **Data Zone EU Stamp:** Primary `DataZoneProvisionedManaged` (Sweden Central) &rarr; Local Spillover `DataZoneStandard` (Sweden Central) &rarr; Secondary DR `DataZoneStandard` / `DataZoneProvisionedManaged` (Germany West Central or France Central).
3. **Single-Jurisdiction Regional Stamp (e.g., UK / Canada):** Primary `ProvisionedManaged` (UK South) &rarr; Secondary DR `Standard` / `ProvisionedManaged` (UK West)—verifying **exact model + snapshot availability** in both regions before cutover <span class="ev-badge ev-validate">[Validate]</span>.
