<script setup lang="ts">
import { withBase } from 'vitepress'
import { useVerifiedStamp } from '../useVerifiedStamp'

const props = defineProps<{
  track: string
  status?: string
  provenance?: string
  governance?: string
  owners?: string
  verified?: string
  paperHref?: string
  paperLabel?: string
  studioHref?: string
  studioLabel?: string
  kitHref?: string
  kitLabel?: string
  printable?: boolean
}>()

const verifiedStamp = useVerifiedStamp(() => props.verified)

function printPage() {
  if (typeof window !== 'undefined') window.print()
}
</script>

<template>
  <div class="pb-meta">
    <div class="pb-meta-grid">
      <div>
        <span class="pb-label">Track</span>
        <strong>{{ track }}</strong>
      </div>
      <div>
        <span class="pb-label">Provenance</span>
        <strong>{{ provenance || 'Customer-Zero Validated (Sanitized)' }}</strong>
      </div>
      <div>
        <span class="pb-label">Governance Gate</span>
        <strong>{{ governance || 'Sanitized · Peer Reviewed · IP Screened' }}</strong>
      </div>
      <div>
        <span class="pb-label">Track Owners</span>
        <strong>{{ owners || 'John Luo (@jluocsa) · Co-Authors Welcome' }}</strong>
      </div>
      <div>
        <span class="pb-label">Last Verified</span>
        <strong>{{ verifiedStamp }} ({{ status || 'Live v2.0' }})</strong>
      </div>
      <div v-if="paperHref" class="pb-pdf no-print">
        <span class="pb-label">Consolidated Reader</span>
        <a :href="withBase(paperHref)">{{ paperLabel || 'Single-Page White Paper →' }}</a>
      </div>
      <div v-if="studioHref" class="pb-pdf no-print">
        <span class="pb-label">Interactive Tool</span>
        <a :href="withBase(studioHref)">{{ studioLabel || 'Open Decision Studio →' }}</a>
      </div>
      <div v-if="kitHref" class="pb-pdf no-print">
        <span class="pb-label">MIT Engineering Kit</span>
        <a :href="withBase(kitHref)">{{ kitLabel || 'Open Executable Kit →' }}</a>
      </div>
      <div v-if="printable" class="pb-pdf no-print">
        <span class="pb-label">Offline / ARB Copy</span>
        <button type="button" class="pb-print-btn" @click="printPage">Print / Save as PDF</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pb-meta {
  margin: 16px 0 24px;
  padding: 15px 18px;
  border: 1px solid var(--ms-border-subtle);
  border-top: 3px solid var(--vp-c-brand-1);
  border-radius: 9px;
  background: var(--vp-c-bg-soft);
  box-shadow: var(--ms-shadow-sm);
  font-size: 0.84rem;
}
.pb-meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(185px, 1fr));
  gap: 12px 18px;
}
.pb-label {
  display: block;
  margin-bottom: 2px;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-2);
}
.pb-pdf a {
  font-weight: 600;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}
.pb-pdf a:hover {
  text-decoration: underline;
}
.pb-print-btn {
  display: inline-flex;
  align-items: center;
  margin-top: 2px;
  padding: 4px 12px;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 5px;
  background: var(--ms-surface-card);
  color: var(--vp-c-brand-1);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.pb-print-btn:hover {
  background: var(--vp-c-brand-1);
  color: #fff;
}
</style>
