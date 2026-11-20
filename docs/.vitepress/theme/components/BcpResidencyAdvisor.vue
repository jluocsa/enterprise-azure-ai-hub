<script setup lang="ts">
import { computed, ref } from 'vue'

const residencyTier = ref<'global' | 'datazone' | 'regional'>('datazone')
const drPosture = ref<'active-passive-payg' | 'active-passive-minptu' | 'active-active'>('active-passive-payg')
const steadyPtu = ref(170)
const steadyHitPct = ref(80)
const statefulDeps = ref<'cosmos-aisearch' | 'cosmos-only' | 'stateless'>('cosmos-aisearch')
const copied = ref(false)

const result = computed(() => {
  const basePtu = Math.max(15, steadyPtu.value)
  const hit = Math.min(95, Math.max(0, steadyHitPct.value)) / 100
  // When regional failover occurs, secondary region KV cache starts 0% warm -> temporary cold-cache surge factor
  const coldSurgeFactor = hit > 0 ? Math.min(3.2, 1 / Math.max(0.32, 1 - hit * 0.72)) : 1.0
  const coldSurgePtuEquiv = Math.ceil((basePtu * coldSurgeFactor) / 5) * 5

  let skuGuidance = ''
  let residencyNote = ''
  if (residencyTier.value === 'global') {
    skuGuidance = 'Global Provisioned (PTU-M) Primary + Global Standard Spillover'
    residencyNote = 'Data-at-rest remains in resource geography; inference compute may route globally for maximum quota elasticity [M].'
  } else if (residencyTier.value === 'datazone') {
    skuGuidance = 'Data Zone Provisioned (US / EU) Primary + Data Zone Standard Spillover'
    residencyNote = 'All prompt processing and KV prefix caches remain strictly inside the selected US or EU Data Zone boundary [M].'
  } else {
    skuGuidance = 'Regional Provisioned (PTU-M) Primary + Paired Regional Standard / PTU'
    residencyNote = 'Single-region processing boundary (min 15–25 PTU depending on model); verify paired-region model snapshot parity before cutover [M].'
  }

  let secondaryPtu = 0
  let rtoEstimate = '< 15 sec (APIM Circuit Breaker)'
  let tcoMultiplier = '1.00× Base PTU (+ burst PAYG only during drills/outages)'
  if (drPosture.value === 'active-active') {
    secondaryPtu = basePtu
    rtoEstimate = '~0 sec (Weighted Active-Active)'
    tcoMultiplier = '2.00× Reserved PTU Commitment'
  } else if (drPosture.value === 'active-passive-minptu') {
    secondaryPtu = residencyTier.value === 'regional' ? 25 : 15
    rtoEstimate = '< 10 sec (Warm PTU Anchor + PAYG Burst)'
    tcoMultiplier = `${((basePtu + secondaryPtu) / basePtu).toFixed(2)}× Reserved PTU Commitment`
  }

  let stateGuidance = 'Stateless tier only — APIM backend pool failover completes regional cutover.'
  if (statefulDeps.value === 'cosmos-aisearch') {
    stateGuidance =
      'Enable Cosmos DB multi-region writes/automatic failover for thread checkpoints + active-active Azure AI Search replica stamp synced from geo-redundant ADLS Gen2.'
  } else if (statefulDeps.value === 'cosmos-only') {
    stateGuidance =
      'Pair APIM regional failover with Cosmos DB zone-redundant + multi-region session state failover so in-flight conversations preserve context.'
  }

  return {
    skuGuidance,
    residencyNote,
    coldSurgeFactor: coldSurgeFactor.toFixed(2),
    coldSurgePtuEquiv,
    secondaryPtu,
    rtoEstimate,
    tcoMultiplier,
    stateGuidance,
  }
})

async function copyBcpPlan() {
  const md = [
    `### Multi-Region Foundry BCP & Residency Plan`,
    `- **Recommended Deployment SKU:** ${result.value.skuGuidance}`,
    `- **Boundary Rule:** ${result.value.residencyNote}`,
    `- **DR Capacity Posture:** Primary \`${steadyPtu.value} PTUs\` · Secondary Reserved \`${result.value.secondaryPtu} PTUs\` (${result.value.tcoMultiplier})`,
    `- **Target Cutover RTO:** ${result.value.rtoEstimate}`,
    `- **Cold-Cache Failover Surge (First 5–15 Min):** \`${result.value.coldSurgeFactor}×\` (~${result.value.coldSurgePtuEquiv} PTU-equiv TPM while secondary KV prefix cache warms from 0% to ${steadyHitPct.value}% — absorb via Secondary Standard PAYG overflow)`,
    `- **Stateful Stamp Sync:** ${result.value.stateGuidance}`,
  ].join('\n')
  try {
    await navigator.clipboard.writeText(md)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2200)
  } catch {}
}
</script>

<template>
  <div class="bcp-card">
    <div class="bcp-head">
      <div>
        <span class="bcp-kicker">INTERACTIVE RESILIENCY WORKBENCH &middot; PLAYBOOK 03</span>
        <strong class="bcp-title">Multi-Region Data Residency &amp; Cold-Cache Failover Surge Advisor</strong>
      </div>
      <button type="button" class="bcp-copy-btn no-print" @click="copyBcpPlan">
        {{ copied ? '✓ Copied BCP Summary' : 'Copy BCP Plan' }}
      </button>
    </div>

    <div class="bcp-inputs">
      <label>
        <span>1. Regulatory Data-Processing Boundary</span>
        <select v-model="residencyTier">
          <option value="datazone">Data Zone (US or EU Geographic Boundary — Recommended)</option>
          <option value="regional">Strict Single-Region (Country / Sovereign Pinning)</option>
          <option value="global">Global (Geo-Pinned Data-at-Rest, Global Compute)</option>
        </select>
      </label>

      <label>
        <span>2. Secondary Stamp Capacity Strategy</span>
        <select v-model="drPosture">
          <option value="active-passive-payg">Active-Passive: Primary PTU-M + Secondary Standard PAYG Standby</option>
          <option value="active-passive-minptu">Warm Anchor: Primary PTU-M + Min-PTU Secondary + PAYG Overflow</option>
          <option value="active-active">Active-Active: Dual Symmetric PTU-M Reservations (Tier-0 Critical)</option>
        </select>
      </label>

      <label>
        <span>3. Primary Steady Allocation (PTUs)</span>
        <input v-model.number="steadyPtu" type="number" min="15" step="5" />
      </label>

      <label>
        <span>4. Primary Steady Cached Share (%)</span>
        <input v-model.number="steadyHitPct" type="number" min="0" max="95" step="5" />
      </label>

      <label class="bcp-span-2">
        <span>5. Stateful Agent Dependencies in Stamp</span>
        <select v-model="statefulDeps">
          <option value="cosmos-aisearch">Foundry + APIM + Cosmos DB Session Checkpoints + Azure AI Search (Full Agent Stamp)</option>
          <option value="cosmos-only">Foundry + APIM + Cosmos DB Conversation State</option>
          <option value="stateless">Stateless Inference Only (Foundry + APIM)</option>
        </select>
      </label>
    </div>

    <div class="bcp-metrics">
      <div class="bcp-metric highlight">
        <span class="k">Cold-Cache Failover Surge (First 5–15m)</span>
        <div class="v">{{ result.coldSurgeFactor }}&times; TPM</div>
        <span class="sub">~{{ result.coldSurgePtuEquiv }} PTU-equiv draw while secondary KV cache warms</span>
      </div>
      <div class="bcp-metric">
        <span class="k">Target Gateway Cutover RTO</span>
        <div class="v">{{ result.rtoEstimate }}</div>
        <span class="sub">Driven by APIM <code>Retry-After</code> &amp; 5xx circuit breaker</span>
      </div>
      <div class="bcp-metric teal">
        <span class="k">Reserved PTU Footprint</span>
        <div class="v">{{ steadyPtu + result.secondaryPtu }} PTUs</div>
        <span class="sub">{{ result.tcoMultiplier }}</span>
      </div>
    </div>

    <div class="bcp-summary">
      <p><strong>Recommended SKU Topology:</strong> {{ result.skuGuidance }}</p>
      <p><strong>Residency Guarantee:</strong> {{ result.residencyNote }}</p>
      <p><strong>Stateful Stamp Requirement:</strong> {{ result.stateGuidance }}</p>
    </div>
  </div>
</template>

<style scoped>
.bcp-card {
  margin: 20px 0;
  padding: 20px 22px;
  border: 1px solid var(--ms-border-subtle);
  border-top: 3px solid #6d28d9;
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  box-shadow: var(--ms-shadow-sm);
}
.bcp-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 10px;
  padding-bottom: 12px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--ms-border-subtle);
}
.bcp-kicker {
  display: block;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.075em;
  color: var(--ms-accent-violet);
  margin-bottom: 2px;
}
.bcp-title {
  font-size: 0.98rem;
  color: var(--vp-c-text-1);
}
.bcp-copy-btn {
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-brand-1);
  background: var(--ms-surface-card);
  color: var(--vp-c-brand-1);
  font-size: 0.77rem;
  font-weight: 600;
  cursor: pointer;
}
.bcp-copy-btn:hover {
  background: var(--vp-c-brand-1);
  color: #fff;
}
.bcp-inputs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 14px;
  margin-bottom: 16px;
}
@media (max-width: 760px) {
  .bcp-inputs {
    grid-template-columns: 1fr;
  }
}
.bcp-span-2 {
  grid-column: 1 / -1;
}
.bcp-inputs label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 0.77rem;
  font-weight: 600;
  color: var(--vp-c-text-2);
}
.bcp-inputs input,
.bcp-inputs select {
  padding: 7.5px 10px;
  border: 1px solid var(--ms-border-subtle);
  border-radius: 6px;
  background: var(--ms-surface-card);
  color: var(--vp-c-text-1);
  font-size: 0.84rem;
}
.bcp-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}
.bcp-metric {
  padding: 13px 15px;
  border-radius: 8px;
  border: 1px solid var(--ms-border-subtle);
  border-top: 3px solid #64748b;
  background: var(--ms-surface-card);
}
.bcp-metric.highlight {
  border-top-color: #d97706;
}
.bcp-metric.teal {
  border-top-color: var(--ms-accent-teal);
}
.bcp-metric .k {
  display: block;
  font-size: 0.7rem;
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.035em;
  color: var(--vp-c-text-2);
}
.bcp-metric .v {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 4px 0 3px;
  color: var(--vp-c-text-1);
}
.bcp-metric .sub {
  font-size: 0.74rem;
  color: var(--vp-c-text-2);
}
.bcp-summary {
  padding: 13px 16px;
  border-radius: 8px;
  border: 1px solid var(--ms-border-subtle);
  border-left: 4px solid var(--vp-c-brand-1);
  background: var(--ms-surface-card);
  font-size: 0.83rem;
}
.bcp-summary p {
  margin: 5px 0 !important;
  line-height: 1.5 !important;
}
</style>
