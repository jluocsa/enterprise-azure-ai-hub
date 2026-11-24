<script setup lang="ts">
import { computed, ref } from 'vue'

const docCount = ref<number | string>(250000)
const avgChunksPerDoc = ref<number | string>(18)
const avgTokensPerChunk = ref<number | string>(512)
const embeddingDim = ref<1536 | 3072>(1536)
const embeddingTpmQuota = ref<number | string>(1000000)
const peakHybridQps = ref<number | string>(40)
const maxRevocationLagMin = ref<number | string>(15)
const maxFreshnessLagMin = ref<number | string>(60)

const posture = ref<'standard' | 'regulated'>('standard')
const useFabricIq = ref(true)
const useAiSearch = ref(true)
const useCosmosHybrid = ref(true)
const requireEvalFlywheel = ref(true)

const simScenario = ref<
  'clean' | 'shared-fsku' | 'missing-purview-label' | 'stale-acl' | 'cross-partition-cosmos' | 'corpus-poisoning'
>('clean')

const copiedContract = ref(false)
const copiedCli = ref(false)

function applyPosture(next: 'standard' | 'regulated') {
  posture.value = next
  maxRevocationLagMin.value = next === 'regulated' ? 5 : 15
}

const validatedSizing = computed(() => {
  const errors: Record<string, string> = {}
  const docs = docCount.value
  const chunks = avgChunksPerDoc.value
  const tok = avgTokensPerChunk.value
  const dim = embeddingDim.value
  const tpm = embeddingTpmQuota.value
  const qps = peakHybridQps.value

  if (typeof docs !== 'number' || !Number.isSafeInteger(docs) || docs < 1) {
    errors.docCount = 'Total Corpus Documents: enter a positive safe whole number.'
  }
  if (typeof chunks !== 'number' || !Number.isFinite(chunks) || chunks < 1 || chunks > 5000) {
    errors.avgChunksPerDoc = 'Avg Chunks / Document: enter a finite number from 1 to 5,000.'
  }
  if (typeof tok !== 'number' || !Number.isSafeInteger(tok) || tok < 128 || tok > 2048) {
    errors.avgTokensPerChunk = 'Avg Tokens / Chunk: enter a whole number from 128 to 2,048.'
  }
  if (dim !== 1536 && dim !== 3072) {
    errors.embeddingDim = 'Embedding Dimension: select a supported preset (1,536 or 3,072 dimensions).'
  }
  if (typeof tpm !== 'number' || !Number.isFinite(tpm) || tpm < 10000 || tpm > Number.MAX_SAFE_INTEGER) {
    errors.embeddingTpmQuota = 'Batch Embedding TPM Quota: enter a finite number of at least 10,000.'
  }
  if (typeof qps !== 'number' || !Number.isFinite(qps) || qps < 1 || qps > 100000) {
    errors.peakHybridQps = 'Peak Hybrid Retrieval QPS: enter a finite number from 1 to 100,000.'
  }

  if (
    Object.keys(errors).length ||
    typeof docs !== 'number' ||
    typeof chunks !== 'number' ||
    typeof tok !== 'number' ||
    typeof tpm !== 'number' ||
    typeof qps !== 'number'
  ) {
    return { errors, values: null }
  }

  const totalChunks = Math.ceil(docs * chunks)
  const totalEmbedTokens = totalChunks * tok
  if (
    !Number.isSafeInteger(totalChunks) ||
    !Number.isFinite(totalEmbedTokens) ||
    totalEmbedTokens > Number.MAX_SAFE_INTEGER
  ) {
    const msg = 'Corpus scale overflow: reduce documents, chunks per document, or tokens per chunk to stay within safe precision.'
    errors.docCount = msg
    errors.avgChunksPerDoc = msg
    return { errors, values: null }
  }

  // Raw FP32 vectors = 4 bytes/dim; DiskANN/HNSW + metadata overhead ~ 1.45x raw footprint
  const rawVectorGb = (totalChunks * dim * 4) / (1024 ** 3)
  const indexMemoryGb = rawVectorGb * 1.45
  const effectiveTpm = tpm * 0.8
  const backfillHours = totalEmbedTokens / (effectiveTpm * 60)

  // Single-partition Cosmos DB DiskANN + BM25 RRF (~35 RU/query baseline) + 1.35x burst headroom
  const singlePartitionRu = Math.max(400, Math.ceil((qps * 35 * 1.35) / 100) * 100)
  // Recommended dedicated interactive F-SKU tier when Fabric IQ is active
  const recommendedFsku = qps >= 100 ? 'F128 Interactive' : qps >= 30 ? 'F64 Interactive' : 'F32 Interactive'

  return {
    errors,
    values: {
      totalChunks,
      totalEmbedTokens,
      rawVectorGb: Number(rawVectorGb.toFixed(2)),
      indexMemoryGb: Number(indexMemoryGb.toFixed(2)),
      backfillHours: Number(backfillHours.toFixed(1)),
      singlePartitionRu,
      recommendedFsku,
    },
  }
})

const sizingErrors = computed(() => validatedSizing.value.errors)
const sizingCalc = computed(() => validatedSizing.value.values)

const validatedContract = computed(() => {
  const errors: Record<string, string> = {}
  const revLag = maxRevocationLagMin.value
  const freshLag = maxFreshnessLagMin.value

  if (typeof revLag !== 'number' || !Number.isFinite(revLag) || revLag <= 0 || revLag > 1440) {
    errors.maxRevocationLagMin = 'Max ACL Revocation SLA: enter a finite number from >0 to 1,440 minutes.'
  }
  if (typeof freshLag !== 'number' || !Number.isFinite(freshLag) || freshLag <= 0 || freshLag > 10080) {
    errors.maxFreshnessLagMin = 'Max Corpus Freshness Lag: enter a finite number from >0 to 10,080 minutes.'
  }
  if (!useFabricIq.value && !useAiSearch.value && !useCosmosHybrid.value) {
    errors.stores = 'Select at least one Azure grounding store (Fabric IQ, AI Search, or Cosmos DB Hybrid).'
  }

  if (Object.keys(errors).length || typeof revLag !== 'number' || typeof freshLag !== 'number') {
    return { errors, values: null }
  }

  const requiredStores: string[] = []
  if (useFabricIq.value) requiredStores.push('fabric-iq')
  if (useAiSearch.value) requiredStores.push('ai-search')
  if (useCosmosHybrid.value) requiredStores.push('cosmos-hybrid')

  return {
    errors,
    values: {
      revLag,
      freshLag,
      requiredStores,
    },
  }
})

const contractErrors = computed(() => validatedContract.value.errors)

const contractJson = computed(() => {
  const cfg = validatedContract.value.values
  if (!cfg) return null
  return JSON.stringify(
    {
      contract_version: '2.0',
      track: 'Playbook 05 · AI Data Strategy, Fabric–Foundry & Governance',
      posture: posture.value,
      require_purview_dspm: true,
      require_dedicated_interactive_fsku: useFabricIq.value,
      max_revocation_lag_min: cfg.revLag,
      max_freshness_lag_min: cfg.freshLag,
      max_region_lag_pct: 1.0,
      min_chunk_tokens: 128,
      max_chunk_tokens: 2048,
      max_duplicate_ratio_pct: 5.0,
      require_eval_flywheel: requireEvalFlywheel.value,
      require_pos6_ordering: true,
      required_stores: cfg.requiredStores,
    },
    null,
    2
  )
})

const cliSnippet = computed(() => {
  const cfg = validatedContract.value.values
  const sizing = sizingCalc.value
  if (!cfg || !sizing) return null
  const lines = [
    `# 1. Validate AI Data Plane snapshot against D1-D12 contract (DRG001-DRG007)`,
    `python3 docs/public/kits/data_readiness_gate.py ./artifacts/data-snapshot.json \\`,
    `  --contract ./data-readiness-contract.json --json`,
  ]
  if (useCosmosHybrid.value) {
    lines.push(
      `# 2. Provision single-partition Cosmos DB DiskANN + RRF autoscale floor (${sizing.singlePartitionRu} RU/s)`,
      `az cosmosdb sql container throughput migrate --account-name foundry-data-cosmos --database-name ai-memory --name memory-v2 --throughput-type autoscale`
    )
  }
  if (useFabricIq.value) {
    lines.push(`# 3. Bind Fabric IQ / AI-Ready Gold shortcuts to dedicated ${sizing.recommendedFsku} capacity`)
  }
  return lines.join('\n')
})

const simulatedGate = computed(() => {
  const cfg = validatedContract.value.values
  if (!cfg) {
    return { passed: false, exitCode: 2, findings: Object.values(contractErrors.value) }
  }
  const findings: string[] = []
  if (simScenario.value === 'shared-fsku' && useFabricIq.value) {
    findings.push(
      '[DRG002] fabric-finance-kpis: Fabric IQ shares batch ETL F-SKU capacity (violates Gate D3).'
    )
  }
  if (simScenario.value === 'missing-purview-label') {
    findings.push(
      '[DRG003] search-regulatory-corpus: missing Microsoft Purview sensitivity_label (violates Gate D5).'
    )
  }
  if (simScenario.value === 'stale-acl') {
    const simulatedLag = Math.max(cfg.revLag + 10, 45)
    findings.push(
      `[DRG004] search-regulatory-corpus: ACL revocation lag ${simulatedLag}m exceeds SLA (${cfg.revLag}m, Gate D6).`
    )
  }
  if (simScenario.value === 'cross-partition-cosmos' && useCosmosHybrid.value) {
    findings.push(
      '[DRG005] cosmos-agent-episodic-memory: Cosmos DB vector query lacks tenant/engagement partition key isolation (Gate D7).'
    )
  }
  if (simScenario.value === 'corpus-poisoning') {
    findings.push(
      '[DRG006] search-regulatory-corpus: sample_chunks[2] triggered indirect prompt-injection poisoning rule (Gate D10).'
    )
  }
  return {
    passed: findings.length === 0,
    exitCode: findings.length === 0 ? 0 : 1,
    findings,
  }
})

async function copyContract() {
  const json = contractJson.value
  if (json === null) return
  try {
    await navigator.clipboard.writeText(json)
    copiedContract.value = true
    setTimeout(() => {
      copiedContract.value = false
    }, 2200)
  } catch {}
}

async function copyCli() {
  const cli = cliSnippet.value
  if (cli === null) return
  try {
    await navigator.clipboard.writeText(cli)
    copiedCli.value = true
    setTimeout(() => {
      copiedCli.value = false
    }, 2200)
  } catch {}
}
</script>

<template>
  <div class="dsa-card">
    <div class="dsa-head">
      <div>
        <span class="dsa-kicker">INTERACTIVE AI DATA STRATEGY WORKBENCH &middot; PLAYBOOK 05</span>
        <strong class="dsa-title">Fabric IQ, Purview DSPM &amp; Cosmos DB DiskANN/RRF Topology + D1–D12 Contract Builder</strong>
      </div>
      <div class="dsa-head-btns no-print">
        <span class="ev-badge ev-m">[M] Fabric / Purview / Cosmos</span>
        <span class="ev-badge ev-arch">[Arch] DRG001–007</span>
        <button type="button" class="dsa-btn" :disabled="!validatedContract.values" @click="copyContract">
          {{ copiedContract ? '✓ Copied Contract JSON' : 'Copy Contract JSON' }}
        </button>
        <button type="button" class="dsa-btn" :disabled="!cliSnippet" @click="copyCli">
          {{ copiedCli ? '✓ Copied Gate CLI' : 'Copy CLI + Cosmos Cmd' }}
        </button>
      </div>
    </div>

    <div class="dsa-posture-bar no-print">
      <span class="dsa-posture-lbl">Governance Posture (Purview DSPM for AI):</span>
      <button
        type="button"
        :class="['dsa-chip', { active: posture === 'standard' }]"
        @click="applyPosture('standard')"
      >
        Standard Enterprise (≤15m ACL SLA)
      </button>
      <button
        type="button"
        :class="['dsa-chip', { active: posture === 'regulated' }]"
        @click="applyPosture('regulated')"
      >
        Regulated Ethical-Wall (≤5m ACL SLA)
      </button>
    </div>

    <div class="dsa-toggles no-print">
      <label class="dsa-check">
        <input v-model="useFabricIq" type="checkbox" />
        <span><strong>Microsoft Fabric / OneLake &amp; Fabric IQ</strong> (Structured KPIs, Semantic Models, Dedicated F-SKU)</span>
      </label>
      <label class="dsa-check">
        <input v-model="useAiSearch" type="checkbox" />
        <span><strong>Azure AI Search (Foundry IQ MCP)</strong> (Unstructured Corpora, Semantic Rerank, Index Alias)</span>
      </label>
      <label class="dsa-check">
        <input v-model="useCosmosHybrid" type="checkbox" />
        <span><strong>Azure Cosmos DB Vector/Hybrid</strong> (DiskANN + BM25 RRF, Single-Partition Tenant Memory)</span>
      </label>
      <label class="dsa-check">
        <input v-model="requireEvalFlywheel" type="checkbox" />
        <span><strong>Require OTel-to-Fabric Eval Flywheel</strong> (Gate D12 Gold eval dataset feedback)</span>
      </label>
    </div>

    <div class="dsa-inputs">
      <label>
        <span>1. Total Corpus Documents</span>
        <input
          v-model.number="docCount"
          type="number"
          min="1"
          :max="Number.MAX_SAFE_INTEGER"
          step="1"
          :aria-invalid="!!sizingErrors.docCount"
          :aria-describedby="sizingErrors.docCount ? 'dsa-sizing-errors' : undefined"
        />
      </label>
      <label>
        <span>2. Avg Chunks / Document</span>
        <input
          v-model.number="avgChunksPerDoc"
          type="number"
          min="1"
          max="5000"
          step="any"
          :aria-invalid="!!sizingErrors.avgChunksPerDoc"
          :aria-describedby="sizingErrors.avgChunksPerDoc ? 'dsa-sizing-errors' : undefined"
        />
      </label>
      <label>
        <span>3. Avg Tokens / Chunk (128–2,048)</span>
        <input
          v-model.number="avgTokensPerChunk"
          type="number"
          min="128"
          max="2048"
          step="1"
          :aria-invalid="!!sizingErrors.avgTokensPerChunk"
          :aria-describedby="sizingErrors.avgTokensPerChunk ? 'dsa-sizing-errors' : undefined"
        />
      </label>
      <label>
        <span>4. Embedding Dimension</span>
        <select
          v-model.number="embeddingDim"
          :aria-invalid="!!sizingErrors.embeddingDim"
          :aria-describedby="sizingErrors.embeddingDim ? 'dsa-sizing-errors' : undefined"
        >
          <option :value="1536">1,536 dims (text-embedding-3-small / ada)</option>
          <option :value="3072">3,072 dims (text-embedding-3-large)</option>
        </select>
      </label>
      <label>
        <span>5. Batch Embedding TPM Quota</span>
        <input
          v-model.number="embeddingTpmQuota"
          type="number"
          min="10000"
          :max="Number.MAX_SAFE_INTEGER"
          step="10000"
          :aria-invalid="!!sizingErrors.embeddingTpmQuota"
          :aria-describedby="sizingErrors.embeddingTpmQuota ? 'dsa-sizing-errors' : undefined"
        />
      </label>
      <label>
        <span>6. Peak Hybrid Retrieval QPS</span>
        <input
          v-model.number="peakHybridQps"
          type="number"
          min="1"
          max="100000"
          step="any"
          :aria-invalid="!!sizingErrors.peakHybridQps"
          :aria-describedby="sizingErrors.peakHybridQps ? 'dsa-sizing-errors' : undefined"
        />
      </label>
      <label>
        <span>7. Max ACL Revocation SLA (min · Gate D6)</span>
        <input
          v-model.number="maxRevocationLagMin"
          type="number"
          min="1"
          max="1440"
          step="any"
          :aria-invalid="!!contractErrors.maxRevocationLagMin"
          :aria-describedby="contractErrors.maxRevocationLagMin ? 'dsa-contract-errors' : undefined"
        />
      </label>
      <label>
        <span>8. Max Corpus Freshness Lag (min · Gate D11)</span>
        <input
          v-model.number="maxFreshnessLagMin"
          type="number"
          min="1"
          max="10080"
          step="any"
          :aria-invalid="!!contractErrors.maxFreshnessLagMin"
          :aria-describedby="contractErrors.maxFreshnessLagMin ? 'dsa-contract-errors' : undefined"
        />
      </label>
    </div>

    <div v-if="!sizingCalc" id="dsa-sizing-errors" class="dsa-alert" role="alert">
      <strong>Invalid corpus &amp; throughput sizing: capacity estimates and CLI export are blocked. Contract-only JSON remains independent.</strong>
      <ul>
        <li v-for="(error, field) in sizingErrors" :key="field">{{ error }}</li>
      </ul>
    </div>

    <div v-if="!validatedContract.values" id="dsa-contract-errors" class="dsa-alert" role="alert">
      <strong>Invalid governance contract settings: contract and CLI exports are blocked.</strong>
      <ul>
        <li v-for="(error, field) in contractErrors" :key="field">{{ error }}</li>
      </ul>
    </div>

    <div class="dsa-metrics">
      <div v-if="sizingCalc" class="dsa-metric highlight">
        <span class="k">Re-Embedding Backfill Window (Gate D8)</span>
        <div class="v">{{ sizingCalc.backfillHours }} hrs</div>
        <span class="sub">
          {{ sizingCalc.totalChunks.toLocaleString() }} chunks &middot; {{ sizingCalc.indexMemoryGb }} GB DiskANN/HNSW est. (at 80% batch TPM)
        </span>
      </div>
      <div v-if="sizingCalc" class="dsa-metric teal">
        <span class="k">Store Capacity Envelope (Gates D3 &amp; D7)</span>
        <div class="v">
          {{ useCosmosHybrid ? `${sizingCalc.singlePartitionRu.toLocaleString()} RU/s` : sizingCalc.recommendedFsku }}
        </div>
        <span class="sub">
          <template v-if="useCosmosHybrid && useFabricIq">
            Cosmos single-partition DiskANN+RRF &middot; Fabric: <strong>{{ sizingCalc.recommendedFsku }}</strong>
          </template>
          <template v-else-if="useCosmosHybrid">
            Cosmos single-partition DiskANN+RRF autoscale ceiling (+35% headroom)
          </template>
          <template v-else-if="useFabricIq">
            Dedicated interactive F-SKU isolated from batch Spark ETL via OneLake Shortcuts
          </template>
          <template v-else>
            Azure AI Search blue-green alias + RA-GZRS dual-region indexer parity
          </template>
        </span>
      </div>
      <div :class="['dsa-metric', simulatedGate.passed ? 'ok' : 'fail']">
        <span class="k">Live Data Readiness Gate (DRG001–007)</span>
        <div class="v">{{ simulatedGate.passed ? 'PASS (Exit 0)' : `BLOCKED (Exit ${simulatedGate.exitCode})` }}</div>
        <span class="sub">Purview DSPM + Entra ACL + Cosmos Partition + Anti-Poisoning CI gate</span>
      </div>
    </div>

    <div class="dsa-sim-bar no-print">
      <span class="dsa-sim-lbl">Simulate Data-Plane Failure:</span>
      <button type="button" :class="['dsa-chip', { active: simScenario === 'clean' }]" @click="simScenario = 'clean'">
        Clean AI-Gold Snapshot
      </button>
      <button
        type="button"
        :class="['dsa-chip', { active: simScenario === 'shared-fsku' }]"
        @click="simScenario = 'shared-fsku'"
      >
        Shared Batch F-SKU (DRG002)
      </button>
      <button
        type="button"
        :class="['dsa-chip', { active: simScenario === 'missing-purview-label' }]"
        @click="simScenario = 'missing-purview-label'"
      >
        Missing Purview Label (DRG003)
      </button>
      <button
        type="button"
        :class="['dsa-chip', { active: simScenario === 'stale-acl' }]"
        @click="simScenario = 'stale-acl'"
      >
        Stale ACL Revocation (DRG004)
      </button>
      <button
        type="button"
        :class="['dsa-chip', { active: simScenario === 'cross-partition-cosmos' }]"
        @click="simScenario = 'cross-partition-cosmos'"
      >
        Unscoped Cosmos Vector (DRG005)
      </button>
      <button
        type="button"
        :class="['dsa-chip', { active: simScenario === 'corpus-poisoning' }]"
        @click="simScenario = 'corpus-poisoning'"
      >
        Prompt Poisoning Chunk (DRG006)
      </button>
    </div>

    <div v-if="validatedContract.values && !simulatedGate.passed" class="dsa-alert">
      <strong>Release Blocked by Deterministic Data Readiness Gate:</strong>
      <ul>
        <li v-for="f in simulatedGate.findings" :key="f"><code>{{ f }}</code></li>
      </ul>
    </div>

    <div v-if="validatedContract.values" class="dsa-code-grid">
      <div>
        <span class="dsa-code-lbl">Generated <code>data-readiness-contract.json</code></span>
        <pre class="dsa-code"><code>{{ contractJson }}</code></pre>
      </div>
      <div v-if="cliSnippet">
        <span class="dsa-code-lbl">CI Gate &amp; Store Provisioning Commands</span>
        <pre class="dsa-code"><code>{{ cliSnippet }}</code></pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dsa-card {
  margin: 20px 0;
  padding: 20px 22px;
  border: 1px solid var(--ms-border-subtle);
  border-top: 3px solid #0f766e;
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  box-shadow: var(--ms-shadow-sm);
}
.dsa-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 10px;
  padding-bottom: 12px;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--ms-border-subtle);
}
.dsa-kicker {
  display: block;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.075em;
  color: #0f766e;
  margin-bottom: 2px;
}
.dsa-title {
  font-size: 0.98rem;
  color: var(--vp-c-text-1);
}
.dsa-head-btns {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
}
.dsa-btn {
  padding: 5px 11px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-brand-1);
  background: var(--ms-surface-card);
  color: var(--vp-c-brand-1);
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
}
.dsa-btn:hover {
  background: var(--vp-c-brand-1);
  color: #fff;
}
.dsa-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.dsa-posture-bar,
.dsa-sim-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  margin-bottom: 12px;
}
.dsa-posture-lbl,
.dsa-sim-lbl {
  font-size: 0.76rem;
  font-weight: 650;
  color: var(--vp-c-text-2);
}
.dsa-chip {
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid var(--ms-border-subtle);
  background: var(--ms-surface-card);
  color: var(--vp-c-text-2);
  font-size: 0.74rem;
  font-weight: 600;
  cursor: pointer;
}
.dsa-chip.active {
  border-color: #0f766e;
  background: rgba(15, 118, 110, 0.12);
  color: #0f766e;
}
.dark .dsa-chip.active {
  color: #5eead4;
  border-color: #2dd4bf;
}
.dsa-toggles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 14px;
  margin-bottom: 14px;
}
@media (max-width: 820px) {
  .dsa-toggles {
    grid-template-columns: 1fr;
  }
}
.dsa-check {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.78rem;
  color: var(--vp-c-text-1);
  cursor: pointer;
}
.dsa-inputs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px 14px;
  margin-bottom: 14px;
}
@media (max-width: 960px) {
  .dsa-inputs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .dsa-inputs {
    grid-template-columns: 1fr;
  }
}
.dsa-inputs label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--vp-c-text-2);
}
.dsa-inputs input,
.dsa-inputs select {
  padding: 7px 10px;
  border: 1px solid var(--ms-border-subtle);
  border-radius: 6px;
  background: var(--ms-surface-card);
  color: var(--vp-c-text-1);
  font-size: 0.83rem;
}
.dsa-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}
@media (max-width: 860px) {
  .dsa-metrics {
    grid-template-columns: 1fr;
  }
}
.dsa-metric {
  padding: 13px 15px;
  border-radius: 8px;
  border: 1px solid var(--ms-border-subtle);
  background: var(--ms-surface-card);
}
.dsa-metric.highlight {
  border-left: 3px solid #0078d4;
}
.dsa-metric.teal {
  border-left: 3px solid #0f766e;
}
.dsa-metric.ok {
  border-left: 3px solid #16a34a;
}
.dsa-metric.fail {
  border-left: 3px solid #dc2626;
}
.dsa-metric .k {
  display: block;
  font-size: 0.72rem;
  font-weight: 650;
  color: var(--vp-c-text-2);
  margin-bottom: 4px;
}
.dsa-metric .v {
  font-size: 1.28rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
  margin-bottom: 4px;
}
.dsa-metric .sub {
  font-size: 0.74rem;
  line-height: 1.4;
  color: var(--vp-c-text-2);
}
.dsa-alert {
  margin-bottom: 14px;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid rgba(220, 38, 38, 0.35);
  background: rgba(220, 38, 38, 0.08);
  font-size: 0.8rem;
  color: var(--vp-c-text-1);
}
.dsa-alert ul {
  margin: 6px 0 0 18px;
  padding: 0;
}
.dsa-code-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
@media (max-width: 860px) {
  .dsa-code-grid {
    grid-template-columns: 1fr;
  }
}
.dsa-code-lbl {
  display: block;
  font-size: 0.74rem;
  font-weight: 650;
  color: var(--vp-c-text-2);
  margin-bottom: 6px;
}
.dsa-code {
  margin: 0;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid var(--ms-border-subtle);
  background: var(--ms-surface-card);
  font-size: 0.76rem;
  line-height: 1.48;
  overflow-x: auto;
}
</style>
