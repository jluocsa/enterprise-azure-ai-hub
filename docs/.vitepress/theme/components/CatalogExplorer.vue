<script setup lang="ts">
import { withBase } from 'vitepress'

const tracks = [
  {
    num: 'PLAYBOOK 01 · 15 CHAPTERS + PROFILE',
    status: 'LIVE v2.0',
    title: 'Prompt Caching, Prefix Architecture & Two-Regime PTU Sizing (GPT-5.6 / 6 / 6.1)',
    provenance: 'Enterprise stateless multi-node document review & compliance scoring platform',
    problem:
      'Early dynamic tokens (timestamps, user IDs, unsorted tool schemas) silently zero out Azure KV reuse across stateless turns, triggering a 2.56× jump in required PTU capacity and paid cache writes.',
    chapters: [
      { label: '01 · Executive Thesis & Migration Q&A', href: '/playbooks/prompt-caching/start/01-executive-thesis' },
      { label: '04 · SKU Boundary & Live PTU Calculator', href: '/playbooks/prompt-caching/qualify/04-ptu-sizing-math' },
      { label: '07 · Scope × Volatility Pos 1–6 Prefix Order', href: '/playbooks/prompt-caching/design/07-prefix-taxonomy' },
      { label: '09 · Wire Controls, >15 RPM Sharding & TTL', href: '/playbooks/prompt-caching/design/09-wire-controls' },
      { label: '14 · C1–C15 Migration Readiness Standard', href: '/playbooks/prompt-caching/govern/14-readiness-standard' },
      { label: 'Profile · Regulated Ethical Walls & Chargeback', href: '/playbooks/prompt-caching/profiles/regulated-multi-engagement' },
    ],
    primaryHref: '/playbooks/prompt-caching/start/01-executive-thesis',
    studioHref: '/studio/#ptu',
    studioLabel: 'PTU & TCO Simulator',
    kitHref: '/papers/engineering-kits#pcr-linter',
    kitLabel: 'pcr_lint.py + KQL Gate',
  },
  {
    num: 'PLAYBOOK 02 · 6 CHAPTERS',
    status: 'LIVE v2.0',
    title: 'Multi-Backend Microsoft Foundry APIM AI Gateway, Spillover & Token Governance',
    provenance: 'Multi-region enterprise GenAI gateway fronting pooled Foundry PTU-M and Standard PAYG deployments',
    problem:
      'Direct SDK connections cannot safely spill HTTP 429 bursts from PTU-M onto Standard PAYG without breaking SSE streams, forwarding invalid SKU fields, or coupling FinOps billing headers to cache keys.',
    chapters: [
      { label: '01 · Executive Thesis & Gateway Topologies', href: '/playbooks/apim-gateway/01-executive-thesis' },
      { label: '02 · Throughput, Payload Limits & Unbuffered SSE', href: '/playbooks/apim-gateway/02-capacity-streaming-limits' },
      { label: '03 · Retry-After Breakers & SKU Policy Rewrites', href: '/playbooks/apim-gateway/03-circuit-breakers-sku-rewrites' },
      { label: '04 · Out-of-Band FinOps & Token Rate Quotas', href: '/playbooks/apim-gateway/04-finops-token-governance' },
      { label: '05 · 429 Fault Injection & G1–G12 Release Gates', href: '/playbooks/apim-gateway/05-validation-chaos-testing' },
      { label: '06 · Verification Matrix & Learn Citations', href: '/playbooks/apim-gateway/06-sources' },
    ],
    primaryHref: '/playbooks/apim-gateway/01-executive-thesis',
    studioHref: '/studio/#apim',
    studioLabel: 'APIM XML Policy Builder',
    kitHref: '/papers/engineering-kits#apim-policy',
    kitLabel: 'apim-foundry-spillover-policy.xml',
  },
  {
    num: 'PLAYBOOK 03 · 6 CHAPTERS',
    status: 'LIVE v2.0',
    title: 'Multi-Region Foundry Business Continuity (BCP), Residency & Game-Day Drills',
    provenance: 'Regulated multi-region enterprise AI stamp across paired and Data Zone boundaries',
    problem:
      'Regional failovers fail under load when teams ignore Data Zone vs. Regional PTU boundaries, overlook the 2×+ cold-cache TPM surge in a cold secondary region, or leave Cosmos DB and AI Search out of sync.',
    chapters: [
      { label: '01 · Executive Thesis & Regional Failure Modes', href: '/playbooks/multi-region-bcp/01-executive-thesis' },
      { label: '02 · Global vs. Data Zone vs. Regional Matrix', href: '/playbooks/multi-region-bcp/02-residency-and-sku-matrix' },
      { label: '03 · Active-Active vs. Standby & Cold-Cache Surge', href: '/playbooks/multi-region-bcp/03-active-active-vs-standby-math' },
      { label: '04 · Cohesive Stamp Failover (Cosmos & Search)', href: '/playbooks/multi-region-bcp/04-stateful-stamp-failover' },
      { label: '05 · Game-Day Drills, Snapshot Drift & B1–B12', href: '/playbooks/multi-region-bcp/05-gameday-failover-drills' },
      { label: '06 · Verification Matrix & Learn Citations', href: '/playbooks/multi-region-bcp/06-sources' },
    ],
    primaryHref: '/playbooks/multi-region-bcp/01-executive-thesis',
    studioHref: '/studio/#bcp',
    studioLabel: 'BCP & Surge Advisor',
    kitHref: '/papers/engineering-kits#bcp-kql',
    kitLabel: 'bcp-failover-readiness-gate.kql',
  },
  {
    num: 'PLAYBOOK 04 · 6 CHAPTERS',
    status: 'LIVE v2.0',
    title: 'Enterprise Agentic Harness, Foundry IQ Grounded RAG & 7-Layer Release Governance',
    provenance: 'Three-tier sandboxed enterprise proposal, research & compliance agent platform',
    problem:
      'Running agent code/tools inside shared web orchestrators creates cross-session security risk, while ungrounded RAG retrieval and non-deterministic LLM-only evals cause flaky production cutovers.',
    chapters: [
      { label: '01 · Executive Thesis & Agent Industrialization', href: '/playbooks/agentic-rag-evals/01-executive-thesis' },
      { label: '02 · 3-Tier ACA Sandbox Runtime & AG-UI SSE', href: '/playbooks/agentic-rag-evals/02-sandboxed-agent-harness' },
      { label: '03 · Foundry IQ Agentic RAG & ACL Trimming', href: '/playbooks/agentic-rag-evals/03-foundry-iq-grounded-rag' },
      { label: '04 · Deterministic Eval Contracts vs. LLM Judges', href: '/playbooks/agentic-rag-evals/04-deterministic-eval-contracts' },
      { label: '05 · gen_ai.* OTel Tracing & A1–A12 Gates', href: '/playbooks/agentic-rag-evals/05-otel-tracing-release-gates' },
      { label: '06 · Verification Matrix & Learn Citations', href: '/playbooks/agentic-rag-evals/06-sources' },
    ],
    primaryHref: '/playbooks/agentic-rag-evals/01-executive-thesis',
    studioHref: '/studio/#agent-eval',
    studioLabel: 'Sandbox & Eval Contract Builder',
    kitHref: '/papers/engineering-kits#agent-gate',
    kitLabel: 'agent_release_gate.py CLI',
  },
]
</script>

<template>
  <div class="ce-page">
    <section class="ce-hero">
      <div class="ms-container">
        <div class="ms-eyebrow">
          <span class="ms-eyebrow-dot"></span>
          <span>ARCHITECTURE CATALOG &middot; 4 LIVE FULL-STACK TRACKS</span>
        </div>
        <h1 class="ce-title">
          Enterprise Foundry Architecture Series
          <span class="ms-hero-accent">33 Deep-Dive Chapters &amp; 52 Release Gates</span>
        </h1>
        <p class="ce-lead">
          Each playbook owns one critical production layer of an enterprise Microsoft Foundry platform—complete with
          <strong>Customer-Zero provenance</strong>, progressive SVG blueprints, <code>[M]</code> Microsoft Learn source matrices,
          interactive calculators, and MIT release-gate automation.
        </p>
      </div>
    </section>

    <section class="ce-list-sec">
      <div class="ms-container ce-stack">
        <article v-for="t in tracks" :key="t.num" class="ce-track-card">
          <div class="ce-track-top">
            <span class="ce-track-kicker">{{ t.num }}</span>
            <span class="ce-track-status">{{ t.status }}</span>
          </div>
          <h2 class="ce-track-title">{{ t.title }}</h2>
          <p class="ce-track-prov"><strong>Sanitized Provenance:</strong> {{ t.provenance }}</p>
          <p class="ce-track-prob">{{ t.problem }}</p>

          <div class="ce-chap-grid">
            <a
              v-for="ch in t.chapters"
              :key="ch.href"
              :href="withBase(ch.href)"
              class="ce-chap-link"
            >
              <span>{{ ch.label }}</span>
              <span aria-hidden="true">&rarr;</span>
            </a>
          </div>

          <div class="ce-track-actions">
            <a class="ms-btn ms-btn-primary" :href="withBase(t.primaryHref)">Open Playbook Track &rarr;</a>
            <a class="ms-btn ms-btn-secondary" :href="withBase(t.studioHref)">Interactive Tool: {{ t.studioLabel }}</a>
            <a class="ms-btn ms-btn-ghost" :href="withBase(t.kitHref)">MIT Kit: {{ t.kitLabel }}</a>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ce-hero {
  padding: 46px 0 34px;
  background: var(--ms-hero-bg);
  border-bottom: 1px solid var(--ms-border-subtle);
}
.ce-title {
  margin: 0 0 14px;
  font-size: clamp(1.95rem, 3.2vw, 2.75rem);
  font-weight: 680;
  line-height: 1.14;
  letter-spacing: -0.028em;
}
.ce-lead {
  margin: 0;
  max-width: 780px;
  font-size: 1.02rem;
  line-height: 1.62;
  color: var(--vp-c-text-2);
}
.ce-list-sec {
  padding: 38px 0 60px;
}
.ce-stack {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.ce-track-card {
  padding: 26px 28px;
  border-radius: 12px;
  border: 1px solid var(--ms-border-subtle);
  border-top: 3px solid #0078d4;
  background: var(--ms-surface-card);
  box-shadow: var(--ms-shadow-sm);
}
.ce-track-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.ce-track-kicker {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  color: var(--vp-c-brand-1);
}
.ce-track-status {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 999px;
  background: rgba(15, 118, 110, 0.12);
  color: #0f766e;
}
.dark .ce-track-status {
  background: rgba(45, 212, 191, 0.14);
  color: #5eead4;
}
.ce-track-title {
  margin: 0 0 8px !important;
  padding: 0 !important;
  border: none !important;
  font-size: 1.32rem;
  font-weight: 670;
  color: var(--vp-c-text-1);
}
.ce-track-prov {
  margin: 0 0 8px;
  font-size: 0.82rem;
  color: var(--ms-accent-teal);
}
.ce-track-prob {
  margin: 0 0 18px;
  font-size: 0.9rem;
  line-height: 1.58;
  color: var(--vp-c-text-2);
}
.ce-chap-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px 12px;
  margin-bottom: 20px;
}
@media (max-width: 780px) {
  .ce-chap-grid {
    grid-template-columns: 1fr;
  }
}
.ce-chap-link {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 13px;
  border-radius: 7px;
  border: 1px solid var(--ms-border-subtle);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-size: 0.83rem;
  font-weight: 550;
  text-decoration: none !important;
  transition: border-color 0.14s ease, color 0.14s ease;
}
.ce-chap-link:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.ce-track-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
</style>
