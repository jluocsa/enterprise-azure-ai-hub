<script setup lang="ts">
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'

const retiringSoon = ref(true)
const statelessRuntime = ref(true)
const skuMix = ref<'ptu-hybrid' | 'ptu-only' | 'payg'>('ptu-hybrid')
const highRpmAndLargePrefix = ref(true)
const multiBackendGateway = ref(true)
const multiRegionResidency = ref(false)
const agenticRagSandbox = ref(true)
const dataStrategyGrounding = ref(true)
const regulatedMultiClient = ref(false)
const copied = ref(false)

const score = computed(() => {
  let pts = 0
  if (retiringSoon.value) pts += 2
  if (statelessRuntime.value) pts += 2
  if (skuMix.value !== 'payg') pts += 2
  if (highRpmAndLargePrefix.value) pts += 2
  if (multiBackendGateway.value) pts += 1
  if (multiRegionResidency.value) pts += 2
  if (agenticRagSandbox.value) pts += 2
  if (dataStrategyGrounding.value) pts += 2
  if (regulatedMultiClient.value) pts += 2
  return pts
})

const tier = computed(() => {
  if (score.value >= 9) {
    return {
      level: 'Full-Stack Cutover Scope (3-Week Readiness Blueprint)',
      tone: 'high',
      summary:
        'High exposure across model capacity, gateway failover, or multi-agent execution. Run all 3 weeks: Week 1 Baseline & Lint Audit → Week 2 Prefix, APIM & Sandbox Refactor → Week 3 Load, Game-Day & Release Gate Sign-Off.',
    }
  }
  if (score.value >= 5) {
    return {
      level: 'Targeted Architecture Sprint (Focused 2-Week Scope)',
      tone: 'med',
      summary:
        'Moderate cutover exposure. Prioritize Pos 1–6 static prefix ordering, SKU-aware APIM spillover, and automated 2-pass CI + OTel gates.',
    }
  }
  return {
    level: 'Accelerated Design Review (90-Min ADS + CI Kit Drop-In)',
    tone: 'low',
    summary:
      'Contained risk surface. Validate prompt ordering and gateway policies in a single Architecture Design Session and wire pcr_lint.py + agent_release_gate.py into PR CI.',
  }
})

const recommendedTracks = computed(() => {
  const tracks: { code: string; title: string; href: string }[] = []
  if (retiringSoon.value || statelessRuntime.value || highRpmAndLargePrefix.value) {
    tracks.push({
      code: 'Playbook 01',
      title: 'Prompt Caching & Two-Regime PTU Economics',
      href: '/playbooks/prompt-caching/start/01-executive-thesis',
    })
  }
  if (multiBackendGateway.value || skuMix.value === 'ptu-hybrid') {
    tracks.push({
      code: 'Playbook 02',
      title: 'Multi-Backend Foundry APIM AI Gateway & Spillover',
      href: '/playbooks/apim-gateway/01-executive-thesis',
    })
  }
  if (multiRegionResidency.value) {
    tracks.push({
      code: 'Playbook 03',
      title: 'Multi-Region Foundry BCP, Residency & Failover',
      href: '/playbooks/multi-region-bcp/01-executive-thesis',
    })
  }
  if (agenticRagSandbox.value) {
    tracks.push({
      code: 'Playbook 04',
      title: 'Sandboxed Agentic Harness, Foundry IQ RAG & 7-Layer Evals',
      href: '/playbooks/agentic-rag-evals/01-executive-thesis',
    })
  }
  if (dataStrategyGrounding.value) {
    tracks.push({
      code: 'Playbook 05',
      title: 'AI Data Strategy, Fabric–Foundry & Purview DSPM Governance',
      href: '/playbooks/ai-data-strategy/01-executive-thesis',
    })
  }
  if (regulatedMultiClient.value) {
    tracks.push({
      code: 'Profile',
      title: 'Regulated Multi-Engagement & Ethical-Wall Isolation',
      href: '/playbooks/prompt-caching/profiles/regulated-multi-engagement',
    })
  }
  return tracks
})

const branches = computed(() => {
  const out: string[] = []
  if (retiringSoon.value) {
    out.push('Apply two-regime PTU math (GPT-5.6 0% cached PTU draw vs. GPT-6/6.1 normalized read/write weights).')
  }
  if (statelessRuntime.value) {
    out.push('Enforce byte-identical Pos 1–3 static T0 prefix + sorted tools[] as cross-turn hydration memory.')
  }
  if (skuMix.value === 'ptu-hybrid' || multiBackendGateway.value) {
    out.push('Configure APIM Retry-After circuit-breaker spillover (strip breakpoints on 5.6 PTU-M; set buffer-response="false" for SSE).')
  }
  if (highRpmAndLargePrefix.value) {
    out.push('Shard prompt_cache_key across N = ceil(Peak_RPM / 12) deterministic buckets routed by thread_id.')
  }
  if (multiRegionResidency.value) {
    out.push('Align Global vs. Data Zone vs. Regional PTU-M boundaries and size secondary stamp for cold-cache failover surges.')
  }
  if (agenticRagSandbox.value) {
    out.push('Isolate code/tool execution inside ACA Dynamic Sessions, ground citations via Foundry IQ MCP, and gate releases with deterministic eval contracts.')
  }
  if (dataStrategyGrounding.value) {
    out.push('Route structured KPIs to Fabric IQ (isolated F-SKU), enforce Purview DSPM labels & <=15m/<=5m ACL tombstoning, scope Cosmos DiskANN+RRF by tenant partition key, and gate CI via data_readiness_gate.py (D1–D12).')
  }
  if (regulatedMultiClient.value) {
    out.push('Enforce Posture A/B client ethical walls, extract x-cost-center out-of-band in APIM, and audit C-WP1–C-WP4 workpaper parity.')
  }
  return out
})

async function copyScopeSummary() {
  const lines = [
    `### Enterprise Azure AI Readiness — 30-Minute Discovery Summary`,
    `- **Recommended Delivery Motion:** ${tier.value.level}`,
    `- **Assessment:** ${tier.value.summary}`,
    `- **Activated Hub Tracks:** ${recommendedTracks.value.map(t => `${t.code} (${t.title})`).join('; ') || 'Core Operating Model'}`,
    `- **Required Engineering Guardrails:**`,
    ...branches.value.map(b => `  - ${b}`),
  ]
  try {
    await navigator.clipboard.writeText(lines.join('\n'))
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2200)
  } catch {}
}
</script>

<template>
  <div class="isc-card no-print">
    <div class="isc-head">
      <div>
        <span class="isc-kicker">INTERACTIVE DISCOVERY WORKBENCH &middot; 30-MINUTE TRIAGE</span>
        <strong class="isc-title">Multi-Playbook Intake Qualification &amp; Scope Recommender</strong>
      </div>
      <button type="button" class="isc-copy-btn" @click="copyScopeSummary">
        {{ copied ? '✓ Copied Scope Summary' : 'Copy Scope Markdown' }}
      </button>
    </div>

    <div class="isc-grid">
      <label class="isc-toggle">
        <input v-model="retiringSoon" type="checkbox" />
        <div>
          <strong>1. Migrating to GPT-5.6, GPT-6, or GPT-6.1</strong>
          <span>Moving off gpt-4o, gpt-4.1, o3-mini, or gpt-5.4 under a cutover deadline</span>
        </div>
      </label>

      <label class="isc-toggle">
        <input v-model="statelessRuntime" type="checkbox" />
        <div>
          <strong>2. Stateless Web / Container Agent (Model 2)</strong>
          <span>Rehydrates instructions, tools, and session history on every HTTP turn</span>
        </div>
      </label>

      <label class="isc-toggle">
        <input v-model="highRpmAndLargePrefix" type="checkbox" />
        <div>
          <strong>3. Prefix &ge;1,024 Tokens &amp; Peak &gt;15 RPM</strong>
          <span>Shared system/rubric/tool prefix with concurrent multi-user traffic</span>
        </div>
      </label>

      <label class="isc-toggle">
        <input v-model="multiBackendGateway" type="checkbox" />
        <div>
          <strong>4. Multi-Backend APIM Gateway &amp; Token FinOps</strong>
          <span>Fronting pooled Foundry accounts, SSE streams, and per-practice quotas</span>
        </div>
      </label>

      <label class="isc-toggle">
        <input v-model="multiRegionResidency" type="checkbox" />
        <div>
          <strong>5. Multi-Region BCP, DR &amp; Data Sovereignty</strong>
          <span>Strict Data Zone / Regional residency, RTO/RPO SLAs, and failover drills</span>
        </div>
      </label>

      <label class="isc-toggle">
        <input v-model="agenticRagSandbox" type="checkbox" />
        <div>
          <strong>6. Multi-Step Tool / Code Agents &amp; Grounded RAG</strong>
          <span>Sandboxed execution, Foundry IQ retrieval, and deterministic CI eval gates</span>
        </div>
      </label>

      <label class="isc-toggle">
        <input v-model="dataStrategyGrounding" type="checkbox" />
        <div>
          <strong>7. AI Data Plane: Fabric IQ, Purview DSPM &amp; Cosmos Hybrid</strong>
          <span>OneLake / Fabric IQ analytics, Purview sensitivity labels &amp; ACL tombstoning, DiskANN+RRF</span>
        </div>
      </label>

      <label class="isc-toggle">
        <input v-model="regulatedMultiClient" type="checkbox" />
        <div>
          <strong>8. Client Ethical Walls, Chargeback or Filing Cliffs</strong>
          <span>Multi-matter isolation, cost-center billing, or 3&times;–6&times; seasonal surges</span>
        </div>
      </label>

      <label class="isc-select-box">
        <span>9. Target Production SKU Topology</span>
        <select v-model="skuMix">
          <option value="ptu-hybrid">PTU-M Primary + Standard PAYG Spillover (Recommended)</option>
          <option value="ptu-only">Provisioned Throughput (PTU-M) Only</option>
          <option value="payg">Standard (Pay-As-You-Go) Only</option>
        </select>
      </label>
    </div>

    <div :class="['isc-verdict', `tone-${tier.tone}`]">
      <div class="isc-verdict-top">
        <span class="isc-verdict-badge">{{ tier.level }}</span>
        <span class="isc-score-pill">Exposure Score: {{ score }} / 17</span>
      </div>
      <p class="isc-verdict-summary">{{ tier.summary }}</p>

      <div v-if="recommendedTracks.length" class="isc-track-pills">
        <a
          v-for="t in recommendedTracks"
          :key="t.code"
          :href="withBase(t.href)"
          class="isc-track-pill"
        >
          <strong>{{ t.code }}:</strong> {{ t.title }} &rarr;
        </a>
      </div>

      <ul class="isc-branch-list">
        <li v-for="b in branches" :key="b">{{ b }}</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.isc-card {
  margin: 20px 0 26px;
  padding: 20px 22px;
  border-radius: 10px;
  border: 1px solid var(--ms-border-subtle);
  border-top: 3px solid var(--ms-accent-teal);
  background: var(--vp-c-bg-soft);
  box-shadow: var(--ms-shadow-sm);
}
.isc-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 10px;
  padding-bottom: 12px;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--ms-border-subtle);
}
.isc-kicker {
  display: block;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.075em;
  color: var(--ms-accent-teal);
  margin-bottom: 2px;
}
.isc-title {
  font-size: 0.98rem;
  color: var(--vp-c-text-1);
}
.isc-copy-btn {
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-brand-1);
  background: var(--ms-surface-card);
  color: var(--vp-c-brand-1);
  font-size: 0.77rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.isc-copy-btn:hover {
  background: var(--vp-c-brand-1);
  color: #fff;
}
.isc-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
  margin-bottom: 14px;
}
@media (max-width: 760px) {
  .isc-grid {
    grid-template-columns: 1fr;
  }
}
.isc-toggle {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--ms-border-subtle);
  background: var(--ms-surface-card);
  cursor: pointer;
  transition: border-color 0.14s ease;
}
.isc-toggle:hover {
  border-color: var(--vp-c-brand-1);
}
.isc-toggle input {
  margin-top: 3px;
  accent-color: #0078d4;
}
.isc-toggle strong {
  display: block;
  font-size: 0.83rem;
  line-height: 1.32;
  color: var(--vp-c-text-1);
}
.isc-toggle span {
  display: block;
  margin-top: 2px;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--vp-c-text-2);
}
.isc-select-box {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--ms-border-subtle);
  background: var(--ms-surface-card);
}
.isc-select-box span {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.isc-select-box select {
  padding: 6px 9px;
  border-radius: 6px;
  border: 1px solid var(--ms-border-subtle);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-size: 0.8rem;
}
.isc-verdict {
  padding: 15px 18px;
  border-radius: 8px;
  border: 1px solid var(--ms-border-subtle);
  border-left: 4px solid #0078d4;
  background: var(--ms-surface-card);
}
.isc-verdict.tone-high {
  border-left-color: #d97706;
}
.isc-verdict.tone-low {
  border-left-color: #0f766e;
}
.isc-verdict-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 6px;
}
.isc-verdict-badge {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
}
.isc-score-pill {
  font-size: 0.73rem;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 999px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}
.isc-verdict-summary {
  margin: 0 0 10px !important;
  font-size: 0.83rem;
  line-height: 1.52 !important;
  color: var(--vp-c-text-2);
}
.isc-track-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 10px;
}
.isc-track-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(0, 120, 212, 0.25);
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 0.76rem;
  font-weight: 500;
  text-decoration: none !important;
}
.isc-track-pill:hover {
  border-color: var(--vp-c-brand-1);
}
.isc-branch-list {
  margin: 0 !important;
  padding-left: 18px !important;
  font-size: 0.8rem;
  color: var(--vp-c-text-1);
}
.isc-branch-list li {
  margin: 4px 0 !important;
  line-height: 1.46 !important;
}
</style>
