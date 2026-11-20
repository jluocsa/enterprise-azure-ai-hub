<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, withBase } from 'vitepress'
import AgentEvalBuilder from './AgentEvalBuilder.vue'
import ApimPolicyBuilder from './ApimPolicyBuilder.vue'
import BcpResidencyAdvisor from './BcpResidencyAdvisor.vue'
import IntakeScorecard from './IntakeScorecard.vue'
import PtuCalculator from './PtuCalculator.vue'

type TabId = 'ptu' | 'triage' | 'bcp' | 'apim' | 'agent-eval'

const activeTab = ref<TabId>('ptu')
const route = useRoute()

const tabs: { id: TabId; badge: string; title: string; subtitle: string; playbookHref: string; playbookLabel: string }[] = [
  {
    id: 'ptu',
    badge: 'TOOL 01 · PLAYBOOK 01',
    title: 'PTU, Shard & Spillover TCO',
    subtitle: 'Two-regime GPT-5.6 vs. GPT-6/6.1 PTU math, >15 RPM cache sharding & seasonal filing-cliff TCO.',
    playbookHref: '/playbooks/prompt-caching/qualify/04-ptu-sizing-math',
    playbookLabel: 'Read Playbook 01 Sizing Math →',
  },
  {
    id: 'apim',
    badge: 'TOOL 02 · PLAYBOOK 02',
    title: 'APIM AI Gateway Policy Builder',
    subtitle: 'Generate SKU-aware Azure API Management XML policies with Managed Identity, spillover & FinOps OTel.',
    playbookHref: '/playbooks/apim-gateway/03-circuit-breakers-sku-rewrites',
    playbookLabel: 'Read Playbook 02 Gateway Design →',
  },
  {
    id: 'bcp',
    badge: 'TOOL 03 · PLAYBOOK 03',
    title: 'Multi-Region BCP & Surge Advisor',
    subtitle: 'Model Global vs. Data Zone vs. Regional residency and cold-cache failover TPM surges.',
    playbookHref: '/playbooks/multi-region-bcp/03-active-active-vs-standby-math',
    playbookLabel: 'Read Playbook 03 BCP Math →',
  },
  {
    id: 'agent-eval',
    badge: 'TOOL 04 · PLAYBOOK 04',
    title: 'ACA Sandbox & Eval Contract Builder',
    subtitle: 'Size microVM session pools and simulate deterministic ARG001–ARG007 acceptance contracts.',
    playbookHref: '/playbooks/agentic-rag-evals/04-deterministic-eval-contracts',
    playbookLabel: 'Read Playbook 04 Contract Design →',
  },
  {
    id: 'triage',
    badge: 'TOOL 05 · OPERATING MODEL',
    title: '30-Min Intake & Scope Builder',
    subtitle: 'Score 8 architectural boundaries and generate a copy-ready 1-session ADS or 3-week engagement scope.',
    playbookHref: '/operating-model/delivery-scoping',
    playbookLabel: 'Read 3-Week Delivery Blueprint →',
  },
]

function selectTab(id: TabId) {
  activeTab.value = id
  if (typeof window !== 'undefined') {
    window.history.replaceState(null, '', `#${id}`)
  }
}

function syncFromHash() {
  if (typeof window === 'undefined') return
  const h = window.location.hash.replace('#', '') as TabId
  if (['ptu', 'triage', 'bcp', 'apim', 'agent-eval'].includes(h)) {
    activeTab.value = h
  }
}

onMounted(() => {
  syncFromHash()
  if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', syncFromHash)
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('hashchange', syncFromHash)
  }
})

watch(
  () => route.path,
  () => syncFromHash()
)
</script>

<template>
  <div class="st-page">
    <section class="st-hero">
      <div class="st-hero-bg" aria-hidden="true"></div>
      <div class="ms-container st-hero-inner">
        <div class="ms-eyebrow">
          <span class="ms-eyebrow-dot"></span>
          <span>INTERACTIVE ENGINEERING WORKBENCH &middot; ZERO DATA SENT EXTERNALLY</span>
        </div>
        <h1 class="st-title">
          Architecture Decision Studio
          <span class="ms-hero-accent">Live Sizing, Triage, BCP &amp; Gateway Generators</span>
        </h1>
        <p class="st-lead">
          Run interactive Architecture Design Sessions in real time. Every calculator executes <strong>100% locally in your browser</strong>,
          enforces published Microsoft Learn token and SKU rules, and exports clean Markdown or XML artifacts for review boards.
        </p>

        <div class="st-tabs" role="tablist" aria-label="Decision Studio Tools">
          <button
            v-for="t in tabs"
            :key="t.id"
            :id="t.id"
            type="button"
            role="tab"
            :aria-selected="activeTab === t.id"
            :class="['st-tab', { 'is-active': activeTab === t.id }]"
            @click="selectTab(t.id)"
          >
            <span class="st-tab-badge">{{ t.badge }}</span>
            <strong class="st-tab-title">{{ t.title }}</strong>
            <span class="st-tab-sub">{{ t.subtitle }}</span>
          </button>
        </div>
      </div>
    </section>

    <section class="st-body">
      <div class="ms-container">
        <div class="st-context-bar">
          <span>
            <strong>Active Tool:</strong>
            {{ tabs.find(t => t.id === activeTab)?.title }}
          </span>
          <a :href="withBase(tabs.find(t => t.id === activeTab)?.playbookHref || '/playbooks/')" class="st-context-link">
            {{ tabs.find(t => t.id === activeTab)?.playbookLabel }}
          </a>
        </div>

        <div v-show="activeTab === 'ptu'">
          <PtuCalculator />
        </div>
        <div v-show="activeTab === 'triage'">
          <IntakeScorecard />
        </div>
        <div v-show="activeTab === 'bcp'">
          <BcpResidencyAdvisor />
        </div>
        <div v-show="activeTab === 'apim'">
          <ApimPolicyBuilder />
        </div>
        <div v-show="activeTab === 'agent-eval'">
          <AgentEvalBuilder />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.st-page {
  width: 100%;
}
.st-hero {
  position: relative;
  overflow: hidden;
  padding: 46px 0 34px;
  background: var(--ms-hero-bg);
  border-bottom: 1px solid var(--ms-border-subtle);
}
.st-hero-bg {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, var(--ms-hero-grid-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--ms-hero-grid-line) 1px, transparent 1px);
  background-size: 36px 36px;
  mask-image: radial-gradient(ellipse 85% 75% at 50% 25%, #000 45%, transparent 100%);
  -webkit-mask-image: radial-gradient(ellipse 85% 75% at 50% 25%, #000 45%, transparent 100%);
  pointer-events: none;
}
.st-hero-inner {
  position: relative;
  z-index: 1;
}
.st-title {
  margin: 0 0 14px;
  font-size: clamp(1.95rem, 3.2vw, 2.75rem);
  font-weight: 680;
  line-height: 1.14;
  letter-spacing: -0.028em;
  color: var(--vp-c-text-1);
}
.st-lead {
  margin: 0 0 26px;
  max-width: 780px;
  font-size: 1.02rem;
  line-height: 1.62;
  color: var(--vp-c-text-2);
}
.st-tabs {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 11px;
}
@media (max-width: 1120px) {
  .st-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .st-tabs {
    grid-template-columns: 1fr;
  }
}
.st-tab {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  padding: 15px 16px;
  border-radius: 10px;
  border: 1px solid var(--ms-border-subtle);
  border-top: 3px solid transparent;
  background: var(--ms-surface-card);
  box-shadow: var(--ms-shadow-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}
.st-tab:hover {
  border-color: var(--vp-c-brand-1);
  transform: translateY(-1px);
}
.st-tab.is-active {
  border-color: var(--vp-c-brand-1);
  border-top-color: #0078d4;
  box-shadow: var(--ms-shadow-md);
  background: var(--ms-surface-elevated);
}
.st-tab-badge {
  font-size: 0.67rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--vp-c-brand-1);
  margin-bottom: 4px;
}
.st-tab-title {
  font-size: 0.93rem;
  font-weight: 650;
  color: var(--vp-c-text-1);
  margin-bottom: 5px;
}
.st-tab-sub {
  font-size: 0.77rem;
  line-height: 1.44;
  color: var(--vp-c-text-2);
}
.st-body {
  padding: 28px 0 56px;
}
.st-context-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 11px 16px;
  margin-bottom: 6px;
  border-radius: 8px;
  border: 1px solid var(--ms-border-subtle);
  background: var(--vp-c-bg-soft);
  font-size: 0.84rem;
}
.st-context-link {
  font-weight: 600;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}
.st-context-link:hover {
  text-decoration: underline;
}
</style>
