<script setup lang="ts">
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'

const copiedPitch = ref(false)
const selectedLayerIdx = ref(0)
const activeFilter = ref<'all' | 'playbooks' | 'studio' | 'kits'>('all')
const searchQuery = ref('')

function printOverview() {
  if (typeof window !== 'undefined') window.print()
}

async function copyCustomerPitch() {
  const pitch = [
    `Enterprise Azure AI — Solution Industrialization Hub (v2.0 · Verified 2026-11-19 PST)`,
    `• Full-Stack Scope: 4 Customer-Zero validated playbooks covering Prompt Caching & PTU Economics (GPT-5.6/6/6.1), Multi-Backend APIM AI Gateway, Multi-Region Foundry BCP & Residency, and Sandboxed Agentic RAG + 7-Layer Evals.`,
    `• Proven Outcomes: 2.56× PTU capacity spike prevented · 71% seasonal filing-cliff TCO saved · <15s gateway failover RTO · 52 release readiness gates.`,
    `• Interactive Workbench & MIT Kits: Live PTU/TCO simulator, 30-min multi-track intake triage, BCP cold-cache surge advisor, APIM XML policy generator, Python AST linters, and App Insights KQL gates.`,
    `• Live Hub: https://jluocsa.github.io/enterprise-azure-ai-hub/`,
  ].join('\n')
  try {
    await navigator.clipboard.writeText(pitch)
    copiedPitch.value = true
    setTimeout(() => {
      copiedPitch.value = false
    }, 2400)
  } catch {}
}

const stackLayers = [
  {
    id: 'pb01',
    code: 'LAYER 01 · PLAYBOOK 01',
    pill: '15 Chapters · Live',
    title: 'Prompt Caching, Prefix Taxonomy & Two-Regime PTU Sizing',
    shortMeta: 'Pos 1–6 static-first order · >15 RPM key sharding · GPT-5.6 vs. GPT-6/6.1 PTU weights',
    failureMode: 'Timestamps, user IDs, or unsorted tools[] near Pos 1 silently zero out KV reuse, triggering a 2.56× PTU spike.',
    rule: 'Enforce T0 → L2 → L1 → Volatile Tail ordering, shard prompt_cache_key at N = ⌈RPM ÷ 12⌉, and apply two-regime normalized TPM math.',
    gate: 'C1–C15 Standard: ≥80% repeat hit rate · ≥60% cached share · ≥10:1 read/write ratio',
    playbookHref: '/playbooks/prompt-caching/start/01-executive-thesis',
    toolHref: '/studio/#ptu',
    toolLabel: 'Open PTU & TCO Simulator',
  },
  {
    id: 'pb02',
    code: 'LAYER 02 · PLAYBOOK 02',
    pill: '6 Chapters · Live',
    title: 'Multi-Backend Microsoft Foundry APIM AI Gateway & FinOps',
    shortMeta: 'Managed Identity · Retry-After circuit breakers · SKU parameter rewrites · SSE streaming',
    failureMode: 'Direct SDK calls saturate PTU-M with HTTP 429s, break SSE streams via buffering, or leak unsupported 5.6 breakpoints.',
    rule: 'Front PTU-M + Standard PAYG pools with APIM Retry-After circuit breakers, buffer-response="false", and out-of-band x-cost-center OTel dimensions.',
    gate: 'G1–G12 Standard: Zero 429s surfaced below spillover cap · 0 buffered SSE stalls · 100% RBAC auth',
    playbookHref: '/playbooks/apim-gateway/01-executive-thesis',
    toolHref: '/studio/#apim',
    toolLabel: 'Open APIM Policy Builder',
  },
  {
    id: 'pb03',
    code: 'LAYER 03 · PLAYBOOK 03',
    pill: '6 Chapters · Live',
    title: 'Multi-Region Foundry BCP, Data Residency & Failover Drills',
    shortMeta: 'Global vs. Data Zone vs. Regional PTU-M · Cold-cache failover surge · Cosmos & AI Search sync',
    failureMode: 'Regional cutovers fail when secondary stamps start with 0% cold KV caches (2×+ TPM surge) or out-of-sync search/session stores.',
    rule: 'Match Global/Data-Zone/Regional boundaries to compliance tiers, absorb 15-min cold-cache warm-up via PAYG overflow, and run game-day drills.',
    gate: 'B1–B12 Standard: <15s gateway cutover · Identical pinned model snapshots · Quarterly game-day pass',
    playbookHref: '/playbooks/multi-region-bcp/01-executive-thesis',
    toolHref: '/studio/#bcp',
    toolLabel: 'Open BCP & Surge Advisor',
  },
  {
    id: 'pb04',
    code: 'LAYER 04 · PLAYBOOK 04',
    pill: '6 Chapters · Live',
    title: 'Sandboxed Agentic Harness, Foundry IQ RAG & 7-Layer Evals',
    shortMeta: 'ACA Dynamic Sessions · AG-UI SSE proxy · Content Understanding · Deterministic CI contracts',
    failureMode: 'In-process agent tool execution risks tenant bleed, ungrounded RAG citations erode audit trust, and LLM-only evals flake in CI.',
    rule: 'Separate orchestrator from microVM session containers, retrieve via Foundry IQ MCP with security trimming, and gate PRs on deterministic contracts.',
    gate: 'A1–A12 Standard: 100% microVM session isolation · ≥95% citation precision · 0 critical contract regressions',
    playbookHref: '/playbooks/agentic-rag-evals/01-executive-thesis',
    toolHref: '/studio/#agent-eval',
    toolLabel: 'Open Sandbox & Eval Builder',
  },
]

const activeLayer = computed(() => stackLayers[selectedLayerIdx.value] || stackLayers[0])

const headlineStats = [
  {
    value: '2.56×',
    label: 'PTU Capacity Spike Prevented',
    detail: '170 PTUs at 80% prefix cache reuse vs. 435 PTUs on an un-tuned 0%-hit migration (gpt-5.6-terra, 5-PTU increment).',
  },
  {
    value: '71%',
    label: 'Peak-Season TCO Saved',
    detail: 'Right-sized steady PTU-M baseline paired with APIM 429 Retry-After spillover to Standard PAYG during 4× filing cliffs.',
  },
  {
    value: '4 Tracks',
    label: 'Full-Stack Live Playbooks',
    detail: '33 deep-dive chapters spanning Prompt Caching/PTU, APIM AI Gateway, Multi-Region BCP, and Sandboxed Agentic RAG + Evals.',
  },
  {
    value: '52 Gates',
    label: 'Executable Release Controls',
    detail: 'C1–C15, G1–G12, B1–B12, and A1–A12 readiness checklists backed by 5 MIT Python, APIM XML, and App Insights KQL kits.',
  },
]

interface CatalogCard {
  category: 'playbooks' | 'studio' | 'kits'
  badge: string
  tone: 'live' | 'gateway' | 'bcp' | 'agent' | 'profile' | 'studio' | 'paper'
  title: string
  summary: string
  tags: string[]
  href: string
  cta: string
}

const catalogItems: CatalogCard[] = [
  {
    category: 'playbooks',
    badge: 'PLAYBOOK 01 · 15 CHAPTERS',
    tone: 'live',
    title: '01 · Prompt Caching, Prefix Taxonomy & Two-Regime PTU Sizing',
    summary:
      'Complete engineering standard for GPT-5.6, GPT-6, and GPT-6.1 migrations: Model 2 stateless hydration, SKU breakpoint boundaries, Pos 1–6 ordering, >15 RPM key sharding, and break-even math.',
    tags: ['GPT-5.6 / 6 / 6.1', 'PTU-M Math', 'Responses API', 'C1–C15'],
    href: '/playbooks/prompt-caching/start/01-executive-thesis',
    cta: 'Open Playbook 01',
  },
  {
    category: 'playbooks',
    badge: 'PLAYBOOK 02 · 6 CHAPTERS',
    tone: 'gateway',
    title: '02 · Multi-Backend Foundry APIM AI Gateway & Token Governance',
    summary:
      'Production GenAI gateway reference covering Managed Identity RBAC, Retry-After backend-pool circuit breakers, GPT-5.6 PTU-M breakpoint stripping, unbuffered SSE streaming, and FinOps token quotas.',
    tags: ['Azure APIM', '429 Spillover', 'SSE Streaming', 'G1–G12'],
    href: '/playbooks/apim-gateway/01-executive-thesis',
    cta: 'Open Playbook 02',
  },
  {
    category: 'playbooks',
    badge: 'PLAYBOOK 03 · 6 CHAPTERS',
    tone: 'bcp',
    title: '03 · Multi-Region Foundry BCP, Data Residency & Game-Day Drills',
    summary:
      'Resiliency and sovereignty architecture across Global, Data Zone, and Regional PTU-M: active-passive TCO modeling, cold-cache cutover surge math, Cosmos/AI Search sync, and game-day runbooks.',
    tags: ['Data Zone / Regional', 'Cold-Cache Surge', 'DR Stamps', 'B1–B12'],
    href: '/playbooks/multi-region-bcp/01-executive-thesis',
    cta: 'Open Playbook 03',
  },
  {
    category: 'playbooks',
    badge: 'PLAYBOOK 04 · 6 CHAPTERS',
    tone: 'agent',
    title: '04 · Sandboxed Agentic Harness, Foundry IQ RAG & 7-Layer Evals',
    summary:
      'Three-tier isolated agent runtime (Orchestrator + ACA Dynamic Sessions + AG-UI SSE), Content Understanding ingestion, Foundry IQ grounded citations, deterministic CI contracts, and gen_ai.* OTel tracing.',
    tags: ['ACA Sandboxes', 'Foundry IQ MCP', 'Eval Contracts', 'A1–A12'],
    href: '/playbooks/agentic-rag-evals/01-executive-thesis',
    cta: 'Open Playbook 04',
  },
  {
    category: 'studio',
    badge: 'WORKLOAD PROFILE · REGULATED',
    tone: 'profile',
    title: 'Regulated Multi-Engagement, Ethical Walls & Filing-Cliff Profile',
    summary:
      'Security-verified isolation for assurance, tax, legal, and financial platforms: Posture A zero-client-cache mode vs. Posture B, out-of-band chargeback headers, and C-WP1–C-WP4 workpaper lineage.',
    tags: ['Ethical Walls', 'FinOps Chargeback', '71% Cliff Savings', 'Workpapers'],
    href: '/playbooks/prompt-caching/profiles/regulated-multi-engagement',
    cta: 'Explore Regulated Profile',
  },
  {
    category: 'studio',
    badge: 'DECISION STUDIO · 5 LIVE TOOLS',
    tone: 'studio',
    title: 'Interactive Architecture Decision Studio (PTU, APIM, BCP, Sandbox & Triage)',
    summary:
      'Browser-native engineering workbench combining the Two-Regime PTU/TCO Simulator, APIM XML Policy Builder, Multi-Region Cold-Cache Surge Advisor, ACA Sandbox & Eval Contract Builder, and 30-Min Intake Triage.',
    tags: ['5 Live Calculators', 'Zero Telemetry', '1-Click JSON/XML/MD'],
    href: '/studio/',
    cta: 'Launch Decision Studio',
  },
  {
    category: 'studio',
    badge: 'OPERATING MODEL · 3 WEEKS',
    tone: 'live',
    title: '5-Stage Solution Industrialization Factory & 3-Week Delivery Scope',
    summary:
      'How Customer-Zero wins clear automated confidentiality sanitization, peer ARB review, and tri-path IP disposition to become turnkey 3-week proactive customer engagements.',
    tags: ['Customer-Zero', '3-Gate Governance', '3-Week Scope', '[M]/[Arch]'],
    href: '/operating-model/industrialization-pipeline',
    cta: 'Inspect Operating Model',
  },
  {
    category: 'kits',
    badge: 'PRINTABLE WHITE PAPERS',
    tone: 'paper',
    title: 'Executive Full-Stack Blueprint & Prompt-Caching White Papers',
    summary:
      'Single-page consolidated architecture white papers formatted with @media print for 1-click Save-as-PDF distribution to Architecture Review Boards, CISOs, and FinOps leads.',
    tags: ['Print / PDF Ready', 'Executive Briefs', 'CC BY 4.0'],
    href: '/papers/enterprise-foundry-platform-blueprint',
    cta: 'Read Executive Papers',
  },
  {
    category: 'kits',
    badge: '5 EXECUTABLE MIT KITS',
    tone: 'gateway',
    title: 'Drop-In Python Linters, APIM Spillover XML & App Insights KQL Gates',
    summary:
      'Zero-dependency pcr_lint.py AST scanner, agent_release_gate.py contract verifier, apim-foundry-spillover-policy.xml, and two Log Analytics KQL release-gate workbooks.',
    tags: ['pcr_lint.py', 'agent_release_gate.py', 'APIM XML', 'KQL Gates'],
    href: '/papers/engineering-kits',
    cta: 'Download & Copy MIT Kits',
  },
]

const filteredCatalog = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return catalogItems.filter(item => {
    if (activeFilter.value !== 'all' && item.category !== activeFilter.value) return false
    if (!q) return true
    return (
      item.title.toLowerCase().includes(q) ||
      item.summary.toLowerCase().includes(q) ||
      item.tags.some(t => t.toLowerCase().includes(q))
    )
  })
})

const factoryStages = [
  {
    num: '01',
    title: 'Customer-Zero Proof',
    desc: 'Every playbook starts in a real production workload with measured latency, throughput, failover, and TCO—never theoretical doc summaries.',
  },
  {
    num: '02',
    title: 'Automated Sanitization',
    desc: 'check-sanitized.mjs scans prose, Vue components, XML, KQL, and PDFs to strip customer names, aliases, emails, and tenant GUIDs.',
  },
  {
    num: '03',
    title: 'Four-Tier ARB Review',
    desc: 'Peer reviewers verify [M] Microsoft Learn specs and explicitly separate them from [Arch] patterns, [Agree] SLOs, and [Validate] probes.',
  },
  {
    num: '04',
    title: 'Tri-Path Disposition',
    desc: 'Routes novel mechanisms to confidential IP hold (4A), service gaps to Product/Learn PRs (4B), and reusable standards to this hub (4C).',
  },
  {
    num: '05',
    title: '1:N Scopable Delivery',
    desc: 'Ships every track with a 30-minute triage scorecard, 3-week engagement plan, interactive calculator, and MIT automation gates.',
  },
]

const deliveryWeeks = [
  {
    phase: 'PHASE 0 · 30 MIN',
    title: 'Discovery & Boundary Triage',
    body: 'Score model cutover timelines, stateless hydration, PTU/PAYG topology, residency tiers, and ethical-wall constraints in the Decision Studio.',
    exit: 'Exit: Tailored Track & Scope Brief',
    href: '/studio/#triage',
  },
  {
    phase: 'WEEK 1 · AUDIT',
    title: 'Baseline Telemetry & Static Lint',
    body: 'Rank agent nodes by RPM × Tokens, run pcr_lint.py across repos, audit APIM/BCP gaps, and capture un-tuned cache miss & TTFT baselines.',
    exit: 'Exit: Baseline Exposure Report',
    href: '/papers/engineering-kits#pcr-linter',
  },
  {
    phase: 'WEEK 2 · REFACTOR',
    title: 'Prefix, Gateway & Sandbox Wiring',
    body: 'Enforce Pos 1–6 ordering + key sharding, deploy APIM Retry-After spillover + FinOps headers, and isolate tool execution in ACA Sandboxes.',
    exit: 'Exit: Staging-Verified Stack',
    href: '/playbooks/apim-gateway/03-circuit-breakers-sku-rewrites',
  },
  {
    phase: 'WEEK 3 · SIGN-OFF',
    title: '2-Pass Evals, Game-Day & KQL Gates',
    body: 'Execute peak load tests, inject synthetic 429 regional failover drills, verify deterministic eval contracts, and sign C/G/B/A readiness gates.',
    exit: 'Exit: Signed Production Cutover Record',
    href: '/papers/migration-readiness-checklist',
  },
]
</script>

<template>
  <div class="hh-page">
    <!-- Split Executive Blueprint Hero -->
    <section class="hh-hero">
      <div class="hh-hero-bg" aria-hidden="true"></div>
      <div class="ms-container hh-hero-grid">
        <div class="hh-hero-copy">
          <div class="ms-eyebrow">
            <span class="ms-eyebrow-dot"></span>
            <span>MICROSOFT FOUNDRY &amp; AZURE AI &middot; FIELD ARCHITECTURE HUB</span>
          </div>

          <h1 class="hh-title">
            Enterprise Azure AI
            <span class="ms-hero-accent">Solution Industrialization Hub</span>
          </h1>

          <p class="hh-lead">
            Enterprise AI initiatives rarely stall on a prototype—they stall at production scale when
            <strong>capacity spikes, gateway throttling, regional sovereignty, and agent safety collide</strong>.
            This governed factory converts proven <strong>Customer-Zero</strong> breakthroughs into
            <strong>4 full-stack playbooks, interactive sizing studios, and executable MIT release gates</strong>.
          </p>

          <div class="hh-actions no-print">
            <a class="ms-btn ms-btn-primary" :href="withBase('/playbooks/')">
              <span>Explore 4 Live Playbooks</span>
              <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"
                />
              </svg>
            </a>
            <a class="ms-btn ms-btn-secondary" :href="withBase('/studio/')">
              Interactive Decision Studio
            </a>
            <button type="button" class="ms-btn ms-btn-secondary" @click="copyCustomerPitch">
              {{ copiedPitch ? '✓ Copied 60-Sec Executive Brief' : 'Copy 60-Sec Brief' }}
            </button>
            <button type="button" class="ms-btn ms-btn-ghost" @click="printOverview">
              Print / Save PDF
            </button>
          </div>

          <div class="hh-trust-strip">
            <span class="ev-badge ev-m">[M] Learn Verified</span>
            <span class="ev-badge ev-arch">[Arch] Patterns</span>
            <span class="ev-badge ev-agree">[Agree] Gate SLOs</span>
            <span class="pb-chip pb-chip-verified">
              <span class="ms-live-dot" aria-hidden="true"></span>
              <span>v2.0 Full-Stack &middot; Verified 2026-11-19 PST</span>
            </span>
          </div>
        </div>

        <!-- Interactive 4-Layer Reference Architecture Stack -->
        <aside class="hh-stack-panel no-print" aria-label="Interactive Reference Architecture Stack">
          <div class="hh-stack-header">
            <div>
              <span class="hh-stack-kicker">INTERACTIVE REFERENCE STACK &middot; CLICK ANY LAYER</span>
              <strong class="hh-stack-heading">Four Production Layers of Enterprise Azure AI</strong>
            </div>
            <span class="hh-sanitized-pill">100% Sanitized</span>
          </div>

          <div class="hh-stack-list" role="tablist" aria-label="Production architecture layers">
            <button
              v-for="(layer, idx) in stackLayers"
              :key="layer.id"
              type="button"
              role="tab"
              :aria-selected="selectedLayerIdx === idx"
              :class="['hh-stack-row', { 'is-selected': selectedLayerIdx === idx }]"
              @click="selectedLayerIdx = idx"
            >
              <div class="hh-stack-row-top">
                <span class="hh-stack-code">{{ layer.code }}</span>
                <span class="hh-stack-pill">{{ layer.pill }}</span>
              </div>
              <div class="hh-stack-row-title">{{ layer.title }}</div>
              <div class="hh-stack-row-meta">{{ layer.shortMeta }}</div>
            </button>
          </div>

          <div class="hh-stack-drawer">
            <div class="hh-drawer-grid">
              <div>
                <span class="hh-drawer-lbl">Failure Prevented</span>
                <p>{{ activeLayer.failureMode }}</p>
              </div>
              <div>
                <span class="hh-drawer-lbl">Release Gate Standard</span>
                <p>{{ activeLayer.gate }}</p>
              </div>
            </div>
            <div class="hh-drawer-cta">
              <a :href="withBase(activeLayer.playbookHref)" class="hh-drawer-link-primary">
                Open Playbook {{ String(selectedLayerIdx + 1).padStart(2, '0') }} &rarr;
              </a>
              <a :href="withBase(activeLayer.toolHref)" class="hh-drawer-link-sec">
                {{ activeLayer.toolLabel }} &rarr;
              </a>
            </div>
          </div>
        </aside>
      </div>

      <!-- Measured Impact KPI Strip -->
      <div class="ms-container hh-kpi-wrap">
        <div class="hh-kpi-grid">
          <div v-for="stat in headlineStats" :key="stat.label" class="hh-kpi-card">
            <div class="hh-kpi-val">{{ stat.value }}</div>
            <div class="hh-kpi-lbl">{{ stat.label }}</div>
            <p class="hh-kpi-txt">{{ stat.detail }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 01: Interactive Full-Stack Catalog -->
    <section id="catalog" class="hh-section">
      <div class="ms-container">
        <div class="hh-sec-head-row">
          <div>
            <span class="hh-step-kicker">01 &middot; COMPREHENSIVE ARCHITECTURE COVERAGE</span>
            <h2 class="hh-h2">Full-Stack Playbooks, Decision Studio &amp; Executable Kits</h2>
            <p class="hh-sub">
              Every asset below is live, Customer-Zero grounded, and cross-linked across capacity sizing, gateway traffic control,
              regional business continuity, and sandboxed agent evaluation.
            </p>
          </div>

          <div class="hh-filter-controls no-print">
            <div class="hh-filter-pills" role="group" aria-label="Filter hub assets">
              <button
                type="button"
                :class="['hh-pill', { active: activeFilter === 'all' }]"
                @click="activeFilter = 'all'"
              >
                All ({{ catalogItems.length }})
              </button>
              <button
                type="button"
                :class="['hh-pill', { active: activeFilter === 'playbooks' }]"
                @click="activeFilter = 'playbooks'"
              >
                4 Playbooks
              </button>
              <button
                type="button"
                :class="['hh-pill', { active: activeFilter === 'studio' }]"
                @click="activeFilter = 'studio'"
              >
                Studio &amp; Profiles
              </button>
              <button
                type="button"
                :class="['hh-pill', { active: activeFilter === 'kits' }]"
                @click="activeFilter = 'kits'"
              >
                Papers &amp; MIT Kits
              </button>
            </div>
            <input
              v-model="searchQuery"
              type="search"
              class="hh-search-input"
              placeholder="Filter by topic (e.g. PTU, APIM, BCP, RAG, KQL)…"
              aria-label="Filter catalog cards by keyword"
            />
          </div>
        </div>

        <div class="hh-catalog-grid">
          <a
            v-for="card in filteredCatalog"
            :key="card.title"
            :href="withBase(card.href)"
            class="hh-cat-card"
          >
            <div class="hh-cat-top">
              <span :class="['hh-cat-badge', `tone-${card.tone}`]">{{ card.badge }}</span>
            </div>
            <h3 class="hh-cat-title">{{ card.title }}</h3>
            <p class="hh-cat-summary">{{ card.summary }}</p>
            <div class="hh-cat-tags">
              <span v-for="tag in card.tags" :key="tag" class="hh-tag">{{ tag }}</span>
            </div>
            <div class="hh-cat-footer">
              <span>{{ card.cta }}</span>
              <span aria-hidden="true">&rarr;</span>
            </div>
          </a>
        </div>
      </div>
    </section>

    <!-- Section 02: End-to-End Connected Reference Architecture -->
    <section id="reference-architecture" class="hh-section hh-section-alt">
      <div class="ms-container">
        <div class="hh-sec-head">
          <span class="hh-step-kicker">02 &middot; UNIFIED PRODUCTION TOPOLOGY</span>
          <h2 class="hh-h2">How All Four Playbooks Interlock on One Enterprise Request Path</h2>
          <p class="hh-sub">
            Disjointed point guidance leaves fatal seams between gateways, runtimes, caches, and DR stamps. The hub aligns
            every layer into a single end-to-end Microsoft Foundry production blueprint.
          </p>
        </div>

        <div class="arch-diagram">
          <svg
            viewBox="0 0 780 214"
            role="img"
            aria-labelledby="hh-topo-title hh-topo-desc"
            font-family="Segoe UI, Inter, -apple-system, sans-serif"
          >
            <title id="hh-topo-title">Unified Four-Playbook Enterprise Azure AI Production Topology</title>
            <desc id="hh-topo-desc">Shows Playbook 04 3-Tier ACA Sandboxed Agent Runtime and Foundry IQ RAG calling Playbook 02 Azure API Management AI Gateway with Managed Identity and FinOps headers, routing to Playbook 01 Pos 1-6 Cached Primary PTU-M and Standard PAYG Spillover, backed by Playbook 03 Paired Regional BCP Stamp and OpenTelemetry KQL Release Gates.</desc>
            <defs>
              <marker id="hh-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0 0 L8 4 L0 8Z" fill="#0f766e" />
              </marker>
            </defs>

            <!-- Col 1: Playbook 04 Agentic Runtime -->
            <rect x="8" y="14" width="176" height="162" rx="7" fill="#f5f3ff" stroke="#7c3aed" stroke-width="1.5" />
            <text x="17" y="32" font-size="8.6" font-weight="700" fill="#5b21b6">PLAYBOOK 04 · AGENT RUNTIME</text>
            <rect x="17" y="41" width="158" height="38" rx="5" fill="#ffffff" stroke="#a78bfa" />
            <text x="24" y="56" font-size="8.6" font-weight="700" fill="#183e62">Stateless Orchestrator + AG-UI</text>
            <text x="24" y="69" font-size="7.8" fill="#334e68">Line-by-line SSE proxy · Zero SDK</text>
            <rect x="17" y="85" width="158" height="40" rx="5" fill="#eaf7f5" stroke="#0f766e" />
            <text x="24" y="100" font-size="8.6" font-weight="700" fill="#115e59">ACA Dynamic Session MicroVM</text>
            <text x="24" y="113" font-size="7.8" fill="#334e68">Isolated tools + Content Underst.</text>
            <rect x="17" y="131" width="158" height="36" rx="5" fill="#edf3fb" stroke="#5b87b2" />
            <text x="24" y="146" font-size="8.4" font-weight="700" fill="#183e62">Foundry IQ Grounded RAG</text>
            <text x="24" y="159" font-size="7.7" fill="#334e68">MCP retrieval + ACL trimming</text>

            <path d="M184 95 H206" stroke="#0f766e" stroke-width="1.9" marker-end="url(#hh-arr)" />

            <!-- Col 2: Playbook 02 APIM AI Gateway -->
            <rect x="210" y="14" width="176" height="162" rx="7" fill="#edf3fb" stroke="#0284c7" stroke-width="1.5" />
            <text x="219" y="32" font-size="8.6" font-weight="700" fill="#183e62">PLAYBOOK 02 · APIM AI GATEWAY</text>
            <text x="219" y="50" font-size="8.2" fill="#334e68">1. Managed Identity RBAC auth</text>
            <text x="219" y="65" font-size="8.2" fill="#334e68">2. Strips x-cost-center → OTel</text>
            <text x="219" y="80" font-size="8.2" fill="#334e68">3. Strips 5.6 PTU-M breakpoints</text>
            <text x="219" y="95" font-size="8.2" font-weight="700" fill="#183e62">4. Retry-After 429/503 breaker</text>
            <text x="219" y="110" font-size="8.2" fill="#334e68">5. buffer-response="false" SSE</text>
            <rect x="219" y="122" width="158" height="44" rx="5" fill="#ffffff" stroke="#5b87b2" />
            <text x="226" y="138" font-size="8.3" font-weight="700" fill="#183e62">Token Governance &amp; FinOps</text>
            <text x="226" y="151" font-size="7.7" fill="#334e68">Per-practice TPM caps &amp; OTel</text>

            <path d="M386 58 H412" stroke="#0f766e" stroke-width="1.9" marker-end="url(#hh-arr)" />
            <path d="M386 132 H412" stroke="#b45309" stroke-width="1.7" stroke-dasharray="4 2" marker-end="url(#hh-arr)" />

            <!-- Col 3: Playbook 01 Primary PTU + Spillover -->
            <rect x="416" y="14" width="176" height="86" rx="7" fill="#eaf7f5" stroke="#0f766e" stroke-width="1.5" />
            <text x="425" y="31" font-size="8.5" font-weight="700" fill="#115e59">PLAYBOOK 01 · PRIMARY PTU-M</text>
            <text x="425" y="46" font-size="8.0" fill="#334e68">&bull; Pos 1–6 deterministic prefix</text>
            <text x="425" y="59" font-size="8.0" fill="#334e68">&bull; Sharded key (N = &lceil;RPM/12&rceil;)</text>
            <text x="425" y="72" font-size="8.0" fill="#334e68">&bull; Posture A/B ethical walls</text>
            <text x="425" y="86" font-size="7.9" font-weight="700" fill="#0f766e">[80%+ Hit · 2.56× Spike Saved]</text>

            <rect x="416" y="108" width="176" height="68" rx="7" fill="#fff7eb" stroke="#d97706" stroke-width="1.4" />
            <text x="425" y="125" font-size="8.5" font-weight="700" fill="#92400e">STANDARD PAYG SPILLOVER</text>
            <text x="425" y="140" font-size="8.0" fill="#92400e">&bull; Absorbs 4× filing-cliff bursts</text>
            <text x="425" y="153" font-size="8.0" fill="#92400e">&bull; Pinned snapshot parity</text>
            <text x="425" y="166" font-size="7.9" font-weight="700" fill="#b45309">[71% Annual TCO Saved]</text>

            <path d="M592 95 H614" stroke="#0f766e" stroke-width="1.9" marker-end="url(#hh-arr)" />

            <!-- Col 4: Playbook 03 BCP + 7-Layer Gates -->
            <rect x="618" y="14" width="154" height="86" rx="7" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4" />
            <text x="626" y="31" font-size="8.4" font-weight="700" fill="#183e62">PLAYBOOK 03 · DR STAMP</text>
            <text x="626" y="46" font-size="7.9" fill="#334e68">&bull; Data Zone / Regional SLA</text>
            <text x="626" y="59" font-size="7.9" fill="#334e68">&bull; Cold-cache surge buffer</text>
            <text x="626" y="72" font-size="7.9" fill="#334e68">&bull; Cosmos + Search replica</text>
            <text x="626" y="86" font-size="7.8" font-weight="700" fill="#1d4ed8">[&lt;15s Game-Day RTO]</text>

            <rect x="618" y="108" width="154" height="68" rx="7" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.5" />
            <text x="626" y="125" font-size="8.4" font-weight="700" fill="#115e59">MIT CI &amp; OTel GATES</text>
            <text x="626" y="140" font-size="7.9" fill="#334e68">&bull; pcr_lint + contract CLI</text>
            <text x="626" y="153" font-size="7.9" fill="#334e68">&bull; App Insights KQL gates</text>
            <text x="626" y="166" font-size="7.8" font-weight="700" fill="#0f766e">[52 Readiness Checks]</text>

            <text x="10" y="198" font-size="8.4" fill="#526c80">
              End-to-end enterprise request lifecycle governed across Agent Harness (PB04), AI Gateway (PB02), Prefix/PTU Economics (PB01), and Multi-Region BCP (PB03).
            </text>
          </svg>
        </div>
      </div>
    </section>

    <!-- Section 03: The Five-Stage Industrialization Factory -->
    <section id="factory" class="hh-section">
      <div class="ms-container">
        <div class="hh-sec-head">
          <span class="hh-step-kicker">03 &middot; HOW THE HUB OPERATES</span>
          <h2 class="hh-h2">The Five-Stage Solution Industrialization Factory</h2>
          <p class="hh-sub">
            Every engagement pattern clears five governed stages so specialist teams turn bespoke 1:1 customer breakthroughs into
            high-trust 1:N engineering standards—without risking customer confidentiality or premature patent disclosure.
          </p>
        </div>

        <div class="arch-diagram">
          <svg
            viewBox="0 0 760 184"
            role="img"
            aria-labelledby="hh-fac-title hh-fac-desc"
            font-family="Segoe UI, Inter, -apple-system, sans-serif"
          >
            <title id="hh-fac-title">Five-Stage Solution Industrialization Factory</title>
            <desc id="hh-fac-desc">Stage 1 Customer-Zero Proof flows to Stage 2 Automated Sanitization, Stage 3 Peer Architecture Review, branches to 4A Patent Hold, 4B Product and Learn PR, and 4C Field Playbook, and converges on Stage 5 1:N Delivery Reuse.</desc>
            <defs>
              <marker id="hh-arr-ind" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0 0 L8 4 L0 8Z" fill="#0f766e" />
              </marker>
            </defs>

            <rect x="8" y="42" width="126" height="80" rx="6" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.4" />
            <text x="16" y="60" font-size="9.5" font-weight="700" fill="#115e59">1. Customer-Zero</text>
            <text x="16" y="75" font-size="8.4" fill="#334e68">Measured production</text>
            <text x="16" y="88" font-size="8.4" fill="#334e68">workload &amp; telemetry</text>
            <text x="16" y="108" font-size="7.9" font-weight="700" fill="#0f766e">[Proven Baseline]</text>

            <path d="M134 82 H152" stroke="#0f766e" stroke-width="1.8" marker-end="url(#hh-arr-ind)" />

            <rect x="156" y="42" width="126" height="80" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4" />
            <text x="164" y="60" font-size="9.5" font-weight="700" fill="#183e62">2. Sanitization</text>
            <text x="164" y="75" font-size="8.4" fill="#334e68">Strip customer IDs,</text>
            <text x="164" y="88" font-size="8.4" fill="#334e68">emails &amp; GUIDs</text>
            <text x="164" y="108" font-size="7.9" font-weight="700" fill="#1d4ed8">[Automated CI Gate]</text>

            <path d="M282 82 H300" stroke="#0f766e" stroke-width="1.8" marker-end="url(#hh-arr-ind)" />

            <rect x="304" y="42" width="128" height="80" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4" />
            <text x="312" y="60" font-size="9.5" font-weight="700" fill="#183e62">3. Arch Review</text>
            <text x="312" y="75" font-size="8.4" fill="#334e68">Verify [M] Learn facts</text>
            <text x="312" y="88" font-size="8.4" fill="#334e68">&amp; [Arch] boundaries</text>
            <text x="312" y="108" font-size="7.9" font-weight="700" fill="#1d4ed8">[Peer ARB Gate]</text>

            <path d="M432 61 H458 V28 H470" stroke="#0f766e" stroke-width="1.6" fill="none" marker-end="url(#hh-arr-ind)" />
            <path d="M432 82 H470" stroke="#0f766e" stroke-width="1.6" fill="none" marker-end="url(#hh-arr-ind)" />
            <path d="M432 103 H458 V136 H470" stroke="#0f766e" stroke-width="1.6" fill="none" marker-end="url(#hh-arr-ind)" />

            <rect x="474" y="6" width="142" height="44" rx="5" fill="#fff7eb" stroke="#d97706" stroke-width="1.3" />
            <text x="482" y="23" font-size="8.9" font-weight="700" fill="#92400e">4A. Patent / IP Hold</text>
            <text x="482" y="37" font-size="8.0" fill="#92400e">Confidential IP evaluation</text>

            <rect x="474" y="60" width="142" height="44" rx="5" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.3" />
            <text x="482" y="77" font-size="8.9" font-weight="700" fill="#183e62">4B. Product &amp; Learn PR</text>
            <text x="482" y="91" font-size="8.0" fill="#334e68">Upstream doc &amp; PG brief</text>

            <rect x="474" y="114" width="142" height="46" rx="5" fill="#eaf7f5" stroke="#0f766e" stroke-width="1.5" />
            <text x="482" y="131" font-size="8.9" font-weight="700" fill="#115e59">4C. Field Playbook</text>
            <text x="482" y="145" font-size="8.0" fill="#334e68">Playbook + Studio + Kits</text>

            <path d="M616 82 H634" stroke="#0f766e" stroke-width="1.8" marker-end="url(#hh-arr-ind)" />
            <path d="M616 137 H625 V97 H634" stroke="#0f766e" stroke-width="1.6" fill="none" marker-end="url(#hh-arr-ind)" />

            <rect x="638" y="45" width="114" height="76" rx="6" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.4" />
            <text x="646" y="63" font-size="9.4" font-weight="700" fill="#115e59">5. 1:N Reuse</text>
            <text x="646" y="78" font-size="8.2" fill="#334e68">ADS sessions, 3-wk</text>
            <text x="646" y="91" font-size="8.2" fill="#334e68">scopes &amp; CI gates</text>
            <text x="646" y="109" font-size="7.9" font-weight="700" fill="#0f766e">[Portfolio Scale]</text>

            <text x="10" y="175" font-size="8.4" fill="#526c80">
              Governed five-stage factory converting single-account breakthroughs into sanitized, peer-reviewed 1:N engineering assets.
            </text>
          </svg>
        </div>

        <div class="hh-stage-grid">
          <div v-for="s in factoryStages" :key="s.num" class="hh-stage-card">
            <span class="hh-stage-num">STAGE {{ s.num }}</span>
            <h3 class="hh-stage-title">{{ s.title }}</h3>
            <p class="hh-stage-desc">{{ s.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 04: Repeatable 3-Week Delivery Blueprint -->
    <section id="delivery" class="hh-section hh-section-alt">
      <div class="ms-container">
        <div class="hh-sec-head">
          <span class="hh-step-kicker">04 &middot; REPEATABLE PROACTIVE DELIVERY</span>
          <h2 class="hh-h2">From 30-Minute Discovery to Signed Cutover in 3 Weeks</h2>
          <p class="hh-sub">
            Every playbook pairs with the same bounded delivery cadence—giving architecture and platform teams predictable
            weekly exit artifacts and standing CI/OTel protection.
          </p>
        </div>

        <div class="hh-week-grid">
          <a
            v-for="w in deliveryWeeks"
            :key="w.phase"
            :href="withBase(w.href)"
            class="hh-week-card"
          >
            <span class="hh-week-phase">{{ w.phase }}</span>
            <h3 class="hh-week-title">{{ w.title }}</h3>
            <p class="hh-week-body">{{ w.body }}</p>
            <span class="hh-week-exit">{{ w.exit }} &rarr;</span>
          </a>
        </div>

        <div class="hh-coauthor-banner no-print">
          <div>
            <strong>Built for Multi-Author Field Contribution &amp; Architecture Review Reuse</strong>
            <p>
              Own a workload profile, contribute a new KQL or lint check, or adapt the MIT engineering kits directly into
              enterprise delivery repositories—backed by automated sanitization and CODEOWNERS attribution.
            </p>
          </div>
          <div class="hh-banner-btns">
            <a class="ms-btn ms-btn-primary" :href="withBase('/operating-model/governance-and-quality')">
              Governance &amp; Evidence Rules
            </a>
            <a
              class="ms-btn ms-btn-secondary"
              href="https://github.com/jluocsa/enterprise-azure-ai-hub/blob/main/CONTRIBUTING.md"
              target="_blank"
              rel="noopener"
            >
              Co-Authoring Guide
            </a>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hh-page {
  width: 100%;
  color: var(--vp-c-text-1);
}

.hh-hero {
  position: relative;
  overflow: hidden;
  padding: 54px 0 42px;
  background: var(--ms-hero-bg);
  border-bottom: 1px solid var(--ms-border-subtle);
}

.hh-hero-bg {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, var(--ms-hero-grid-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--ms-hero-grid-line) 1px, transparent 1px);
  background-size: 36px 36px;
  mask-image: radial-gradient(ellipse 88% 78% at 50% 24%, #000 45%, transparent 100%);
  -webkit-mask-image: radial-gradient(ellipse 88% 78% at 50% 24%, #000 45%, transparent 100%);
  pointer-events: none;
}

.hh-hero-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(0, 1fr);
  gap: 36px;
  align-items: start;
}

@media (max-width: 1040px) {
  .hh-hero {
    padding: 38px 0 34px;
  }
  .hh-hero-grid {
    grid-template-columns: 1fr;
    gap: 28px;
  }
}

.hh-title {
  margin: 0 0 16px;
  font-size: clamp(2.1rem, 3.55vw, 3.1rem);
  font-weight: 700;
  line-height: 1.11;
  letter-spacing: -0.03em;
  color: var(--vp-c-text-1);
}

.hh-lead {
  margin: 0 0 24px;
  max-width: 630px;
  font-size: 1.04rem;
  line-height: 1.64;
  color: var(--vp-c-text-2);
}

.hh-lead strong {
  color: var(--vp-c-text-1);
  font-weight: 620;
}

.hh-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}

.hh-trust-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

/* Right Interactive Reference Stack Panel */
.hh-stack-panel {
  background: var(--ms-surface-card);
  border: 1px solid var(--ms-border-subtle);
  border-top: 3px solid #0078d4;
  border-radius: 12px;
  padding: 18px;
  box-shadow: var(--ms-shadow-lg);
}

.hh-stack-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--ms-border-subtle);
}

.hh-stack-kicker {
  display: block;
  font-size: 0.67rem;
  font-weight: 700;
  letter-spacing: 0.075em;
  color: var(--vp-c-brand-1);
  margin-bottom: 2px;
}

.hh-stack-heading {
  font-size: 0.92rem;
  color: var(--vp-c-text-1);
}

.hh-sanitized-pill {
  flex-shrink: 0;
  font-size: 0.69rem;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(15, 118, 110, 0.11);
  color: #0f766e;
}

.dark .hh-sanitized-pill {
  background: rgba(45, 212, 191, 0.14);
  color: #5eead4;
}

.hh-stack-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hh-stack-row {
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 13px;
  border-radius: 8px;
  border: 1px solid var(--ms-border-subtle);
  border-left: 3px solid transparent;
  background: var(--vp-c-bg-soft);
  font-family: inherit;
  cursor: pointer;
  transition: all 0.14s ease;
}

.hh-stack-row:hover {
  border-color: var(--vp-c-brand-1);
  background: var(--ms-surface-card);
}

.hh-stack-row.is-selected {
  border-color: var(--vp-c-brand-1);
  border-left-color: #0078d4;
  background: var(--ms-surface-elevated);
  box-shadow: var(--ms-shadow-sm);
}

.hh-stack-row-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.hh-stack-code {
  font-size: 0.67rem;
  font-weight: 700;
  letter-spacing: 0.055em;
  color: var(--vp-c-brand-1);
}

.hh-stack-pill {
  font-size: 0.67rem;
  font-weight: 650;
  padding: 1px 7px;
  border-radius: 4px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.hh-stack-row-title {
  font-size: 0.87rem;
  font-weight: 650;
  color: var(--vp-c-text-1);
  line-height: 1.3;
}

.hh-stack-row-meta {
  font-size: 0.74rem;
  color: var(--vp-c-text-2);
  margin-top: 2px;
}

.hh-stack-drawer {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid var(--ms-border-subtle);
  background: var(--vp-c-bg-soft);
}

.hh-drawer-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 10px;
}

@media (max-width: 600px) {
  .hh-drawer-grid {
    grid-template-columns: 1fr;
  }
}

.hh-drawer-lbl {
  display: block;
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-brand-1);
  margin-bottom: 3px;
}

.hh-drawer-grid p {
  margin: 0 !important;
  font-size: 0.76rem;
  line-height: 1.44;
  color: var(--vp-c-text-2);
}

.hh-drawer-cta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 9px;
  border-top: 1px solid var(--ms-border-subtle);
  font-size: 0.79rem;
}

.hh-drawer-link-primary {
  font-weight: 700;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.hh-drawer-link-sec {
  font-weight: 600;
  color: var(--ms-accent-teal);
  text-decoration: none;
}

.hh-drawer-link-primary:hover,
.hh-drawer-link-sec:hover {
  text-decoration: underline;
}

/* KPI Strip */
.hh-kpi-wrap {
  position: relative;
  z-index: 1;
  margin-top: 32px;
}

.hh-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 980px) {
  .hh-kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .hh-kpi-grid {
    grid-template-columns: 1fr;
  }
}

.hh-kpi-card {
  padding: 16px 18px;
  border-radius: 10px;
  border: 1px solid var(--ms-border-subtle);
  border-top: 3px solid #0078d4;
  background: var(--ms-surface-card);
  box-shadow: var(--ms-shadow-sm);
}

.hh-kpi-val {
  font-size: 1.58rem;
  font-weight: 750;
  letter-spacing: -0.028em;
  line-height: 1.15;
  color: var(--vp-c-brand-1);
  margin-bottom: 3px;
}

.hh-kpi-lbl {
  font-size: 0.86rem;
  font-weight: 650;
  color: var(--vp-c-text-1);
  margin-bottom: 5px;
}

.hh-kpi-txt {
  margin: 0;
  font-size: 0.79rem;
  line-height: 1.48;
  color: var(--vp-c-text-2);
}

/* Sections */
.hh-section {
  padding: 52px 0;
  background: var(--vp-c-bg);
}

.hh-section-alt {
  background: var(--ms-surface-subtle);
  border-top: 1px solid var(--ms-border-subtle);
  border-bottom: 1px solid var(--ms-border-subtle);
}

.hh-sec-head {
  max-width: 820px;
  margin-bottom: 24px;
}

.hh-sec-head-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 26px;
}

.hh-sec-head-row > div:first-child {
  max-width: 660px;
}

.hh-step-kicker {
  display: inline-block;
  font-size: 0.71rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--vp-c-brand-1);
  margin-bottom: 6px;
}

.hh-h2 {
  margin: 0 0 8px !important;
  padding: 0 !important;
  border: none !important;
  font-size: clamp(1.42rem, 2.25vw, 1.88rem);
  font-weight: 680;
  letter-spacing: -0.022em;
  line-height: 1.22;
  color: var(--vp-c-text-1);
}

.hh-sub {
  margin: 0;
  font-size: 0.94rem;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

/* Filter Bar */
.hh-filter-controls {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

@media (max-width: 900px) {
  .hh-filter-controls {
    align-items: stretch;
    width: 100%;
  }
}

.hh-filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.hh-pill {
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid var(--ms-border-subtle);
  background: var(--ms-surface-card);
  color: var(--vp-c-text-2);
  font-family: inherit;
  font-size: 0.77rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.14s ease;
}

.hh-pill:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.hh-pill.active {
  background: #0078d4;
  border-color: #0078d4;
  color: #fff;
}

.hh-search-input {
  width: 300px;
  max-width: 100%;
  padding: 7px 12px;
  border-radius: 7px;
  border: 1px solid var(--ms-border-subtle);
  background: var(--ms-surface-card);
  color: var(--vp-c-text-1);
  font-family: inherit;
  font-size: 0.82rem;
}

@media (max-width: 900px) {
  .hh-search-input {
    width: 100%;
  }
}

.hh-search-input:focus {
  outline: none;
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 0 0 2px var(--vp-c-brand-soft);
}

/* Catalog Cards */
.hh-catalog-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

@media (max-width: 1020px) {
  .hh-catalog-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .hh-catalog-grid {
    grid-template-columns: 1fr;
  }
}

.hh-cat-card {
  display: flex;
  flex-direction: column;
  padding: 20px 22px;
  border-radius: 10px;
  border: 1px solid var(--ms-border-subtle);
  border-top: 3px solid transparent;
  background: var(--ms-surface-card);
  box-shadow: var(--ms-shadow-sm);
  text-decoration: none !important;
  transition: transform 0.15s ease, box-shadow 0.16s ease, border-color 0.16s ease;
}

.hh-cat-card:hover {
  transform: translateY(-2px);
  border-color: var(--ms-border-strong);
  border-top-color: #0078d4;
  box-shadow: var(--ms-shadow-md);
}

.hh-cat-top {
  margin-bottom: 11px;
}

.hh-cat-badge {
  display: inline-block;
  font-size: 0.67rem;
  font-weight: 700;
  letter-spacing: 0.055em;
  padding: 3px 8px;
  border-radius: 4px;
}

.hh-cat-badge.tone-live {
  background: rgba(0, 120, 212, 0.11);
  color: var(--vp-c-brand-1);
}
.hh-cat-badge.tone-gateway {
  background: rgba(2, 132, 199, 0.12);
  color: var(--ms-accent-cyan);
}
.hh-cat-badge.tone-bcp {
  background: rgba(180, 83, 9, 0.12);
  color: var(--ms-accent-amber);
}
.hh-cat-badge.tone-agent {
  background: rgba(109, 40, 217, 0.12);
  color: var(--ms-accent-violet);
}
.hh-cat-badge.tone-profile {
  background: rgba(15, 118, 110, 0.12);
  color: var(--ms-accent-teal);
}
.hh-cat-badge.tone-studio {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
}
.dark .hh-cat-badge.tone-studio {
  color: #6ee7b7;
}
.hh-cat-badge.tone-paper {
  background: rgba(100, 116, 139, 0.14);
  color: var(--vp-c-text-1);
}

.hh-cat-title {
  margin: 0 0 8px;
  font-size: 1rem;
  font-weight: 650;
  line-height: 1.34;
  color: var(--vp-c-text-1);
}

.hh-cat-summary {
  margin: 0 0 14px;
  font-size: 0.84rem;
  line-height: 1.56;
  color: var(--vp-c-text-2);
  flex: 1;
}

.hh-cat-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 14px;
}

.hh-tag {
  font-size: 0.7rem;
  font-weight: 500;
  padding: 2px 7px;
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--ms-border-subtle);
  color: var(--vp-c-text-2);
}

.hh-cat-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 11px;
  border-top: 1px solid var(--ms-border-subtle);
  font-size: 0.83rem;
  font-weight: 650;
  color: var(--vp-c-brand-1);
}

/* Factory Stage Strip */
.hh-stage-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}

@media (max-width: 1060px) {
  .hh-stage-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 580px) {
  .hh-stage-grid {
    grid-template-columns: 1fr;
  }
}

.hh-stage-card {
  padding: 15px 16px;
  border-radius: 9px;
  border: 1px solid var(--ms-border-subtle);
  background: var(--ms-surface-card);
  box-shadow: var(--ms-shadow-sm);
}

.hh-stage-num {
  display: block;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--ms-accent-teal);
  margin-bottom: 4px;
}

.hh-stage-title {
  margin: 0 0 5px;
  font-size: 0.91rem;
  font-weight: 650;
  color: var(--vp-c-text-1);
}

.hh-stage-desc {
  margin: 0;
  font-size: 0.79rem;
  line-height: 1.48;
  color: var(--vp-c-text-2);
}

/* 3-Week Delivery Grid */
.hh-week-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

@media (max-width: 1020px) {
  .hh-week-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 580px) {
  .hh-week-grid {
    grid-template-columns: 1fr;
  }
}

.hh-week-card {
  display: flex;
  flex-direction: column;
  padding: 18px 20px;
  border-radius: 10px;
  border: 1px solid var(--ms-border-subtle);
  border-top: 3px solid #0f766e;
  background: var(--ms-surface-card);
  box-shadow: var(--ms-shadow-sm);
  text-decoration: none !important;
  transition: transform 0.14s ease, border-color 0.14s ease;
}

.hh-week-card:hover {
  transform: translateY(-2px);
  border-color: var(--vp-c-brand-1);
}

.hh-week-phase {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.065em;
  color: var(--ms-accent-teal);
  margin-bottom: 5px;
}

.hh-week-title {
  margin: 0 0 7px;
  font-size: 0.96rem;
  font-weight: 650;
  color: var(--vp-c-text-1);
}

.hh-week-body {
  margin: 0 0 12px;
  font-size: 0.81rem;
  line-height: 1.5;
  color: var(--vp-c-text-2);
  flex: 1;
}

.hh-week-exit {
  font-size: 0.78rem;
  font-weight: 650;
  color: var(--vp-c-brand-1);
}

.hh-coauthor-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  padding: 20px 24px;
  border-radius: 10px;
  border: 1px solid var(--ms-border-subtle);
  border-left: 4px solid #0078d4;
  background: var(--ms-surface-card);
  box-shadow: var(--ms-shadow-sm);
}

.hh-coauthor-banner strong {
  display: block;
  font-size: 0.98rem;
  margin-bottom: 4px;
  color: var(--vp-c-text-1);
}

.hh-coauthor-banner p {
  margin: 0;
  max-width: 680px;
  font-size: 0.84rem;
  line-height: 1.52;
  color: var(--vp-c-text-2);
}

.hh-banner-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
</style>
