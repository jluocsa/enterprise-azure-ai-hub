<script setup lang="ts">
import { useVerifiedStamp } from '../useVerifiedStamp'

const props = defineProps<{
  stage?: 'start' | 'qualify' | 'design' | 'validate' | 'govern' | 'profile' | 'reference'
  stepLabel?: string
  readTime?: string
  verifiedAt?: string
  problem: string
  takeaway: string
  csaUse: string
}>()

const verifiedStamp = useVerifiedStamp(() => props.verifiedAt)

const journey = [
  { id: 'start', label: '1 · Start' },
  { id: 'qualify', label: '2 · Qualify & Size' },
  { id: 'design', label: '3 · Design' },
  { id: 'validate', label: '4 · Validate' },
  { id: 'govern', label: '5 · Govern' },
]
</script>

<template>
  <aside class="pb-brief" aria-label="Page summary">
    <div class="pb-brief-top">
      <div v-if="props.stage && journey.some(j => j.id === props.stage)" class="pb-journey" aria-label="Playbook stage">
        <span
          v-for="j in journey"
          :key="j.id"
          :class="['pb-journey-step', { 'is-current': j.id === props.stage }]"
        >
          {{ j.label }}
        </span>
      </div>
      <div v-else class="pb-brief-kicker">
        <span class="pb-brief-dot"></span>
        <span>{{ props.stepLabel || 'ARCHITECTURE BRIEF' }}</span>
      </div>

      <div class="pb-brief-badges">
        <span v-if="props.readTime" class="pb-chip">{{ props.readTime }}</span>
        <span class="pb-chip pb-chip-verified">
          <span class="ms-live-dot" aria-hidden="true"></span>
          <span>Verified {{ verifiedStamp }}</span>
        </span>
      </div>
    </div>

    <div class="pb-brief-grid">
      <div class="pb-brief-col">
        <span class="pb-col-label">Why It Matters</span>
        <p>{{ props.problem }}</p>
      </div>
      <div class="pb-brief-col pb-brief-col-accent">
        <span class="pb-col-label">Key Takeaway</span>
        <p>{{ props.takeaway }}</p>
      </div>
      <div class="pb-brief-col">
        <span class="pb-col-label">Practical Application</span>
        <p>{{ props.csaUse }}</p>
      </div>
    </div>
  </aside>
</template>
