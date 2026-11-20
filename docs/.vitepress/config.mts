import { defineConfig } from 'vitepress'

const base = process.env.VITEPRESS_BASE || '/enterprise-azure-ai-hub/'
const siteOrigin = 'https://jluocsa.github.io'
const siteUrl = `${siteOrigin}${base}`
const buildTimestamp = Date.now()

export default defineConfig({
  title: 'Azure AI Industrialization Hub',
  description:
    'Enterprise Azure AI Solution Industrialization Hub — Customer-Zero validated architecture playbooks, interactive PTU/TCO & BCP calculators, APIM AI Gateway policies, sandboxed agentic RAG patterns, and executable MIT release gates for Microsoft Foundry.',
  lang: 'en-US',
  base,
  cleanUrls: true,
  lastUpdated: true,

  transformPageData(pageData) {
    pageData.lastUpdated = buildTimestamp
  },

  sitemap: {
    hostname: siteUrl,
  },

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` }],
    ['link', { rel: 'icon', href: `${base}favicon.ico` }],
    ['meta', { name: 'theme-color', content: '#0067b8' }],
    ['meta', { property: 'og:site_name', content: 'Enterprise Azure AI Solution Industrialization Hub' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'en_US' }],
    ['meta', { property: 'og:image', content: `${siteUrl}og-card.png` }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    [
      'meta',
      {
        property: 'og:image:alt',
        content:
          'Enterprise Azure AI Solution Industrialization Hub — 4 Live Playbooks, Interactive Decision Studio & Executable MIT Release Gates',
      },
    ],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: `${siteUrl}og-card.png` }],
  ],

  transformHead({ pageData }) {
    const relPath = pageData.relativePath.replace(/index\.md$/, '').replace(/\.md$/, '')
    const canonicalUrl = `${siteUrl}${relPath}`
    const pageTitle =
      pageData.relativePath === 'index.md'
        ? 'Enterprise Azure AI | Solution Industrialization Hub'
        : `${pageData.title} | Enterprise Azure AI Hub`
    const pageDesc =
      pageData.description ||
      pageData.frontmatter.description ||
      'Customer-Zero validated architecture playbooks, interactive PTU/TCO & BCP decision studio, and executable MIT release gates for Microsoft Foundry and Azure AI.'

    return [
      ['link', { rel: 'canonical', href: canonicalUrl }],
      ['meta', { property: 'og:title', content: pageTitle }],
      ['meta', { property: 'og:description', content: pageDesc }],
      ['meta', { property: 'og:url', content: canonicalUrl }],
      ['meta', { name: 'twitter:title', content: pageTitle }],
      ['meta', { name: 'twitter:description', content: pageDesc }],
    ]
  },

  themeConfig: {
    logo: '/favicon.svg',
    aside: false,
    outline: false,

    nav: [
      { text: 'Overview', link: '/' },
      {
        text: 'Operating Model',
        items: [
          {
            text: '01 · 5-Stage Industrialization Factory',
            link: '/operating-model/industrialization-pipeline',
          },
          {
            text: '02 · Governance & Evidence Discipline',
            link: '/operating-model/governance-and-quality',
          },
          {
            text: '03 · 3-Week Delivery & Scoping',
            link: '/operating-model/delivery-scoping',
          },
        ],
      },
      {
        text: 'Playbooks',
        items: [
          {
            text: 'Architecture Catalog (All 4 Live Tracks)',
            link: '/playbooks/',
          },
          {
            text: '01 · Prompt Caching & PTU Economics (GPT-5.6+)',
            link: '/playbooks/prompt-caching/start/01-executive-thesis',
          },
          {
            text: '02 · Multi-Backend Foundry APIM AI Gateway',
            link: '/playbooks/apim-gateway/01-executive-thesis',
          },
          {
            text: '03 · Multi-Region Foundry BCP & Failover',
            link: '/playbooks/multi-region-bcp/01-executive-thesis',
          },
          {
            text: '04 · Agentic Harness, Foundry IQ RAG & Evals',
            link: '/playbooks/agentic-rag-evals/01-executive-thesis',
          },
          {
            text: 'Profile · Regulated Multi-Engagement & Ethical Walls',
            link: '/playbooks/prompt-caching/profiles/regulated-multi-engagement',
          },
        ],
      },
      { text: 'Decision Studio', link: '/studio/' },
      {
        text: 'Papers & Kits',
        items: [
          { text: 'All White Papers & MIT Kits', link: '/papers/' },
          {
            text: 'Blueprint · Full-Stack Enterprise Foundry Paper',
            link: '/papers/enterprise-foundry-platform-blueprint',
          },
          {
            text: 'White Paper · Prompt Caching & PTU (GPT-5.6+)',
            link: '/papers/foundry-prompt-caching-gpt56-whitepaper',
          },
          {
            text: 'Executable Kits · Linter, APIM XML, Eval & KQL',
            link: '/papers/engineering-kits',
          },
          {
            text: 'Checklists · C1–C15, G1–G12, B1–B12 & A1–A12',
            link: '/papers/migration-readiness-checklist',
          },
        ],
      },
    ],

    sidebar: {
      '/operating-model/': [
        {
          text: 'Industrialization Operating Model',
          items: [
            {
              text: '01 · 5-Stage Industrialization Factory',
              link: '/operating-model/industrialization-pipeline',
            },
            {
              text: '02 · Governance & Evidence Discipline',
              link: '/operating-model/governance-and-quality',
            },
            {
              text: '03 · Repeatable 3-Week Delivery Scope',
              link: '/operating-model/delivery-scoping',
            },
          ],
        },
        {
          text: 'Live Architecture Tracks & Tools',
          items: [
            { text: 'Architecture Catalog (All 4 Tracks)', link: '/playbooks/' },
            { text: 'Interactive Decision Studio', link: '/studio/' },
            { text: 'White Papers & MIT Engineering Kits', link: '/papers/' },
          ],
        },
      ],

      '/papers/': [
        {
          text: 'White Papers & Engineering Kits',
          items: [
            { text: 'Overview & Deliverables Index', link: '/papers/' },
            {
              text: 'Full-Stack Enterprise Foundry Blueprint',
              link: '/papers/enterprise-foundry-platform-blueprint',
            },
            {
              text: 'White Paper · Prompt Caching on GPT-5.6+',
              link: '/papers/foundry-prompt-caching-gpt56-whitepaper',
            },
            {
              text: '5 Executable MIT Engineering Kits',
              link: '/papers/engineering-kits',
            },
            {
              text: 'PR & Cutover Readiness Checklists',
              link: '/papers/migration-readiness-checklist',
            },
          ],
        },
        {
          text: 'Interactive Tools & Playbooks',
          items: [
            { text: 'Interactive Decision Studio', link: '/studio/' },
            { text: 'Architecture Catalog (Playbooks 01–04)', link: '/playbooks/' },
            { text: '3-Week Repeatable Delivery Scope', link: '/operating-model/delivery-scoping' },
          ],
        },
      ],

      '/playbooks/prompt-caching/': [
        {
          text: 'Playbook 01 · Start',
          items: [
            {
              text: '01 · Executive Thesis & Q&A',
              link: '/playbooks/prompt-caching/start/01-executive-thesis',
            },
            {
              text: '02 · Stateless Agents & Hydration Tax',
              link: '/playbooks/prompt-caching/start/02-stateless-agents',
            },
            {
              text: '03 · KV Mechanics & GPT-5.6+ Delta',
              link: '/playbooks/prompt-caching/start/03-kv-mechanics',
            },
          ],
        },
        {
          text: 'Qualify & Size',
          items: [
            {
              text: '04 · SKU Boundary & PTU Calculator',
              link: '/playbooks/prompt-caching/qualify/04-ptu-sizing-math',
            },
            {
              text: '05 · Agent Node Archetypes',
              link: '/playbooks/prompt-caching/qualify/05-node-archetypes',
            },
            {
              text: '06 · Break-Even Read/Write Math',
              link: '/playbooks/prompt-caching/qualify/06-breakeven-economics',
            },
          ],
        },
        {
          text: 'Design',
          items: [
            {
              text: '07 · Scope × Volatility Prefix Order',
              link: '/playbooks/prompt-caching/design/07-prefix-taxonomy',
            },
            {
              text: '08 · Prefix-Breaking Anti-Patterns',
              link: '/playbooks/prompt-caching/design/08-anti-patterns',
            },
            {
              text: '09 · Keys, >15 RPM Sharding & TTL',
              link: '/playbooks/prompt-caching/design/09-wire-controls',
            },
            {
              text: '10 · APIM PTU-to-Standard Spillover',
              link: '/playbooks/prompt-caching/design/10-apim-spillover',
            },
          ],
        },
        {
          text: 'Validate & Govern',
          items: [
            {
              text: '11 · 7-Layer Pipeline & 7-Step Protocol',
              link: '/playbooks/prompt-caching/validate/11-seven-layer-gates',
            },
            {
              text: '12 · PCR001–006 Linter & DeepEval',
              link: '/playbooks/prompt-caching/validate/12-ci-lint-deepeval',
            },
            {
              text: '13 · OTel Spans & Two-Regime KQL Gate',
              link: '/playbooks/prompt-caching/govern/13-otel-kql-gate',
            },
            {
              text: '14 · 15-Point Readiness Standard',
              link: '/playbooks/prompt-caching/govern/14-readiness-standard',
            },
          ],
        },
        {
          text: 'Workload Profiles & Series Links',
          items: [
            {
              text: 'Profile · Regulated Multi-Engagement',
              link: '/playbooks/prompt-caching/profiles/regulated-multi-engagement',
            },
            {
              text: '15 · Verification Matrix & Sources',
              link: '/playbooks/prompt-caching/sources',
            },
            {
              text: 'Next → Playbook 02 · APIM AI Gateway',
              link: '/playbooks/apim-gateway/01-executive-thesis',
            },
            {
              text: 'All 4 Playbooks Catalog',
              link: '/playbooks/',
            },
          ],
        },
      ],

      '/playbooks/apim-gateway/': [
        {
          text: 'Playbook 02 · APIM AI Gateway',
          items: [
            {
              text: '01 · Executive Thesis & Gateway Topologies',
              link: '/playbooks/apim-gateway/01-executive-thesis',
            },
            {
              text: '02 · Throughput, Payloads & SSE Streaming',
              link: '/playbooks/apim-gateway/02-capacity-streaming-limits',
            },
            {
              text: '03 · Circuit Breakers & SKU Policy Rewrites',
              link: '/playbooks/apim-gateway/03-circuit-breakers-sku-rewrites',
            },
            {
              text: '04 · FinOps Chargeback & Token Governance',
              link: '/playbooks/apim-gateway/04-finops-token-governance',
            },
            {
              text: '05 · 429 Fault Injection & G1–G12 Gates',
              link: '/playbooks/apim-gateway/05-validation-chaos-testing',
            },
            {
              text: '06 · Verification Matrix & Sources',
              link: '/playbooks/apim-gateway/06-sources',
            },
          ],
        },
        {
          text: 'Connected Series & Tools',
          items: [
            {
              text: 'Interactive APIM XML Policy Builder',
              link: '/studio/#apim',
            },
            {
              text: 'Kit · apim-foundry-spillover-policy.xml',
              link: '/papers/engineering-kits#apim-policy',
            },
            {
              text: 'Prev ← Playbook 01 · Prompt Caching & PTU',
              link: '/playbooks/prompt-caching/start/01-executive-thesis',
            },
            {
              text: 'Next → Playbook 03 · Multi-Region BCP',
              link: '/playbooks/multi-region-bcp/01-executive-thesis',
            },
          ],
        },
      ],

      '/playbooks/multi-region-bcp/': [
        {
          text: 'Playbook 03 · Multi-Region BCP & DR',
          items: [
            {
              text: '01 · Executive Thesis & Failure Modes',
              link: '/playbooks/multi-region-bcp/01-executive-thesis',
            },
            {
              text: '02 · Global vs. Data Zone vs. Regional Matrix',
              link: '/playbooks/multi-region-bcp/02-residency-and-sku-matrix',
            },
            {
              text: '03 · Active-Active vs. Standby & Cold-Cache Surge',
              link: '/playbooks/multi-region-bcp/03-active-active-vs-standby-math',
            },
            {
              text: '04 · Stateful AI Stamp Failover (Cosmos & Search)',
              link: '/playbooks/multi-region-bcp/04-stateful-stamp-failover',
            },
            {
              text: '05 · Game-Day Drills, Drift & B1–B12 Standard',
              link: '/playbooks/multi-region-bcp/05-gameday-failover-drills',
            },
            {
              text: '06 · Verification Matrix & Sources',
              link: '/playbooks/multi-region-bcp/06-sources',
            },
          ],
        },
        {
          text: 'Connected Series & Tools',
          items: [
            {
              text: 'Interactive BCP Residency & Surge Advisor',
              link: '/studio/#bcp',
            },
            {
              text: 'Kit · bcp-failover-readiness-gate.kql',
              link: '/papers/engineering-kits#bcp-kql',
            },
            {
              text: 'Prev ← Playbook 02 · APIM AI Gateway',
              link: '/playbooks/apim-gateway/01-executive-thesis',
            },
            {
              text: 'Next → Playbook 04 · Agentic Harness & Evals',
              link: '/playbooks/agentic-rag-evals/01-executive-thesis',
            },
          ],
        },
      ],

      '/playbooks/agentic-rag-evals/': [
        {
          text: 'Playbook 04 · Agentic Harness & Evals',
          items: [
            {
              text: '01 · Executive Thesis & Agent Industrialization',
              link: '/playbooks/agentic-rag-evals/01-executive-thesis',
            },
            {
              text: '02 · 3-Tier ACA Sandboxed Runtime & AG-UI SSE',
              link: '/playbooks/agentic-rag-evals/02-sandboxed-agent-harness',
            },
            {
              text: '03 · Foundry IQ Agentic RAG & Ethical Trimming',
              link: '/playbooks/agentic-rag-evals/03-foundry-iq-grounded-rag',
            },
            {
              text: '04 · Deterministic Eval Contracts vs. LLM Judges',
              link: '/playbooks/agentic-rag-evals/04-deterministic-eval-contracts',
            },
            {
              text: '05 · gen_ai.* OTel Tracing & A1–A12 Gates',
              link: '/playbooks/agentic-rag-evals/05-otel-tracing-release-gates',
            },
            {
              text: '06 · Verification Matrix & Sources',
              link: '/playbooks/agentic-rag-evals/06-sources',
            },
          ],
        },
        {
          text: 'Connected Series & Tools',
          items: [
            {
              text: 'Interactive Sandbox & Eval Builder',
              link: '/studio/#agent-eval',
            },
            {
              text: 'Interactive 30-Min Multi-Track Triage',
              link: '/studio/#triage',
            },
            {
              text: 'Kit · agent_release_gate.py CLI',
              link: '/papers/engineering-kits#agent-gate',
            },
            {
              text: 'Prev ← Playbook 03 · Multi-Region BCP',
              link: '/playbooks/multi-region-bcp/01-executive-thesis',
            },
            {
              text: 'All 4 Playbooks Catalog',
              link: '/playbooks/',
            },
          ],
        },
      ],
    },

    search: { provider: 'local' },

    lastUpdated: {
      text: 'Last verified',
      formatOptions: {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      },
    },

    editLink: {
      pattern: 'https://github.com/jluocsa/enterprise-azure-ai-hub/edit/main/docs/:path',
      text: 'Suggest an edit to this page on GitHub',
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/jluocsa/enterprise-azure-ai-hub' },
    ],

    footer: {
      message:
        'Enterprise Azure AI Solution Industrialization Hub — Customer-Zero validated patterns grounded in public <a href="https://learn.microsoft.com/en-us/azure/foundry/" target="_blank" rel="noopener">Microsoft Learn</a> documentation.',
      copyright:
        '&copy; 2026 Contributors &middot; Documentation under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a> &middot; Code, Policies &amp; Engineering Kits under <a href="https://github.com/jluocsa/enterprise-azure-ai-hub/blob/main/LICENSE" target="_blank" rel="noopener">MIT License</a>',
    },
  },
})
