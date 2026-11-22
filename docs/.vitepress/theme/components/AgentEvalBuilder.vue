<script setup lang="ts">
import { computed, ref } from 'vue'

const newSessionsPerMin = ref(8)
const avgSessionActiveSec = ref(120)
const cooldownSec = ref(300)
const readyWarmPct = ref(15)
const maxP95Ms = ref<number | string>(15000)
const minCachedTokens = ref<number | string>(1024)
const requireFoundryIq = ref(true)
const requireAclTrimming = ref(true)
const forbidRawPromptLogging = ref(true)
const simScenario = ref<'clean' | 'hallucinated-cite' | 'untrimmed-acl' | 'raw-prompt-leak' | 'cache-miss'>('clean')
const copiedContract = ref(false)
const copiedCli = ref(false)

const validatedContract = computed(() => {
  const errors: Record<string, string> = {}
  const latency = maxP95Ms.value
  const cachedTokens = minCachedTokens.value
  if (typeof latency !== 'number' || !Number.isFinite(latency) || latency <= 0) {
    errors.maxP95Ms = 'Max Turn Latency Budget: enter a finite number greater than zero.'
  }
  if (typeof cachedTokens !== 'number' || !Number.isSafeInteger(cachedTokens) || cachedTokens <= 0) {
    errors.minCachedTokens = 'Min Pass-2 Cached Tokens: enter a positive safe whole number.'
  }
  if (Object.keys(errors).length || typeof latency !== 'number' || typeof cachedTokens !== 'number') {
    return { errors, values: null }
  }
  return { errors, values: { latency, cachedTokens } }
})
const contractErrors = computed(() => validatedContract.value.errors)

const poolCalc = computed(() => {
  const ratePerSec = Math.max(0.01, newSessionsPerMin.value) / 60
  const activeHold = Math.max(10, avgSessionActiveSec.value)
  const coolHold = Math.max(60, cooldownSec.value)
  // Little's Law: concurrent allocated microVMs = arrival_rate * (active_duration + cooldown_period)
  const steadyAllocated = Math.ceil(ratePerSec * (activeHold + coolHold))
  const burstHeadroom = Math.ceil(steadyAllocated * 1.25)
  const recommendedMax = Math.max(5, Math.ceil(burstHeadroom / 5) * 5)
  const activeOnly = Math.max(1, Math.ceil(ratePerSec * activeHold))
  const recommendedReady =
    readyWarmPct.value <= 0 ? 0 : Math.max(1, Math.round((recommendedMax * readyWarmPct.value) / 100))

  return {
    activeOnly,
    steadyAllocated,
    recommendedMax,
    recommendedReady,
  }
})

const contractJson = computed(() => {
  const values = validatedContract.value.values
  if (!values) return null
  const obj = {
    contract_version: '2.0',
    track: 'Playbook 04 · Sandboxed Agentic Harness & 7-Layer Evals',
    max_p95_ms: values.latency,
    min_pass2_cached_tokens: values.cachedTokens,
    required_tools: requireFoundryIq.value ? ['knowledge_base_retrieve'] : [],
    forbidden_tools: ['raw_shell_root', 'unguarded_http_post', 'drop_container'],
    require_acl_trimming: requireAclTrimming.value,
    forbid_raw_prompt_logging: forbidRawPromptLogging.value,
  }
  return JSON.stringify(obj, null, 2)
})

const deployCliSnippet = computed(() => {
  if (!validatedContract.value.values) return null
  return [
    `SHA=$(git rev-parse --short HEAD)`,
    `az containerapp sessionpool update \\`,
    `  --name enterprise-agent-sessions --resource-group foundry-prod-rg \\`,
    `  --image enterpriseacr.azurecr.io/agent-session:$SHA \\`,
    `  --cooldown-period ${cooldownSec.value} --max-sessions ${poolCalc.value.recommendedMax} --ready-sessions ${poolCalc.value.recommendedReady}`,
    `python3 docs/public/kits/agent_release_gate.py ./artifacts/trace.jsonl --contract ./agent-release-contract.json`,
  ].join('\n')
})

const simulatedEval = computed(() => {
  const values = validatedContract.value.values
  if (!values) {
    return { passed: false, exitCode: 2, findings: Object.values(contractErrors.value) }
  }
  const findings: string[] = []
  if (simScenario.value === 'hallucinated-cite') {
    findings.push(
      "[ARG003] case-014: unresolved inline citation '[cite:policy-99-missing]' not in retrieved_doc_ids."
    )
  }
  if (simScenario.value === 'untrimmed-acl') {
    if (requireAclTrimming.value) {
      findings.push(
        '[ARG006] case-022: retrieved 3 document(s) with acl_trimmed=False (violates Gate A5 security trimming).'
      )
    }
  }
  if (simScenario.value === 'raw-prompt-leak') {
    if (forbidRawPromptLogging.value) {
      findings.push(
        '[ARG007] case-031: telemetry logged raw prompt/message content (violates Gate A12 metadata-only OTel).'
      )
    }
  }
  if (simScenario.value === 'cache-miss' && values.cachedTokens <= 4800) {
    findings.push(
      `[ARG004] case-008: pass 2 had 4800 input tokens but only 0 cached_tokens (<${values.cachedTokens}).`
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
  const cli = deployCliSnippet.value
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
  <div class="aeb-card">
    <div class="aeb-head">
      <div>
        <span class="aeb-kicker">INTERACTIVE AGENT HARNESS &amp; EVAL WORKBENCH &middot; PLAYBOOK 04</span>
        <strong class="aeb-title">ACA MicroVM Session Pool Sizer &amp; Deterministic Contract Builder (ARG001–ARG007)</strong>
      </div>
      <div class="aeb-head-btns no-print">
        <span class="ev-badge ev-m">[M] ACA Sessions</span>
        <span class="ev-badge ev-arch">[Arch] ARG001–007</span>
        <button type="button" class="aeb-btn" :disabled="!validatedContract.values" @click="copyContract">
          {{ copiedContract ? '✓ Copied Contract JSON' : 'Copy Contract JSON' }}
        </button>
        <button type="button" class="aeb-btn" :disabled="!validatedContract.values" @click="copyCli">
          {{ copiedCli ? '✓ Copied CLI Gate' : 'Copy ACA + Gate CLI' }}
        </button>
      </div>
    </div>

    <div class="aeb-inputs">
      <label>
        <span>1. New Agent Sessions / Min (Peak)</span>
        <input v-model.number="newSessionsPerMin" type="number" min="1" step="2" />
      </label>
      <label>
        <span>2. Avg Active Session Hold (Sec)</span>
        <input v-model.number="avgSessionActiveSec" type="number" min="15" step="15" />
      </label>
      <label>
        <span>3. ACA Cooldown Period (Sec · Default 300)</span>
        <input v-model.number="cooldownSec" type="number" min="60" max="3600" step="60" />
      </label>
      <label>
        <span>4. Pre-Warmed Ready Buffer (%)</span>
        <input v-model.number="readyWarmPct" type="number" min="0" max="50" step="5" />
      </label>
      <label>
        <span>5. Max Turn Latency Budget p95 (ms · ARG005)</span>
        <input v-model.number="maxP95Ms" type="number" min="0" step="any"
          :aria-invalid="!!contractErrors.maxP95Ms"
          :aria-describedby="contractErrors.maxP95Ms ? 'aeb-contract-errors' : undefined" />
      </label>
      <label>
        <span>6. Min Pass-2 Cached Tokens (ARG004)</span>
        <input v-model.number="minCachedTokens" type="number" min="1" :max="Number.MAX_SAFE_INTEGER" step="1"
          :aria-invalid="!!contractErrors.minCachedTokens"
          :aria-describedby="contractErrors.minCachedTokens ? 'aeb-contract-errors' : undefined" />
      </label>
    </div>

    <div v-if="!validatedContract.values" id="aeb-contract-errors" class="aeb-alert" role="alert">
      <strong>Invalid acceptance configuration: contract and CLI exports are blocked.</strong>
      <ul>
        <li v-for="(error, field) in contractErrors" :key="field">{{ error }}</li>
      </ul>
    </div>

    <div class="aeb-toggles no-print">
      <label class="aeb-check">
        <input v-model="requireFoundryIq" type="checkbox" />
        <span>Require Foundry IQ <code>knowledge_base_retrieve</code> (ARG002)</span>
      </label>
      <label class="aeb-check">
        <input v-model="requireAclTrimming" type="checkbox" />
        <span>Enforce Document ACL Security Trimming (<code>acl_trimmed != false</code> · ARG006)</span>
      </label>
      <label class="aeb-check">
        <input v-model="forbidRawPromptLogging" type="checkbox" />
        <span>Block Raw Prompt Logging in OTel (<code>CAPTURE_MESSAGE_CONTENT=false</code> · ARG007)</span>
      </label>
    </div>

    <div class="aeb-metrics">
      <div class="aeb-metric highlight">
        <span class="k">Recommended ACA <code>--max-sessions</code></span>
        <div class="v">{{ poolCalc.recommendedMax }} microVMs</div>
        <span class="sub">
          {{ poolCalc.activeOnly }} active + {{ poolCalc.steadyAllocated - poolCalc.activeOnly }} in {{ cooldownSec }}s cooldown (+25% burst)
        </span>
      </div>
      <div class="aeb-metric teal">
        <span class="k">Recommended <code>--ready-sessions</code></span>
        <div class="v">{{ poolCalc.recommendedReady }} warm</div>
        <span class="sub">Zero cold-boot wait on initial burst; set <code>0</code> for strict idle cost floor</span>
      </div>
      <div :class="['aeb-metric', simulatedEval.passed ? 'ok' : 'fail']">
        <span class="k">Live Contract Gate Status</span>
        <div class="v">{{ simulatedEval.passed ? 'PASS (Exit 0)' : `BLOCKED (Exit ${simulatedEval.exitCode})` }}</div>
        <span class="sub">Deterministic PR blocker (<code>ARG001–ARG007</code>); LLM judges advise separately</span>
      </div>
    </div>

    <div class="aeb-sim-bar no-print">
      <span class="aeb-sim-lbl">Simulate Trace Scenario:</span>
      <button
        type="button"
        :class="['aeb-chip', { active: simScenario === 'clean' }]"
        @click="simScenario = 'clean'"
      >
        Clean Golden Run
      </button>
      <button
        type="button"
        :class="['aeb-chip', { active: simScenario === 'hallucinated-cite' }]"
        @click="simScenario = 'hallucinated-cite'"
      >
        Unresolved Citation (ARG003)
      </button>
      <button
        type="button"
        :class="['aeb-chip', { active: simScenario === 'untrimmed-acl' }]"
        @click="simScenario = 'untrimmed-acl'"
      >
        Missing ACL Filter (ARG006)
      </button>
      <button
        type="button"
        :class="['aeb-chip', { active: simScenario === 'raw-prompt-leak' }]"
        @click="simScenario = 'raw-prompt-leak'"
      >
        OTel PII Leak (ARG007)
      </button>
      <button
        type="button"
        :class="['aeb-chip', { active: simScenario === 'cache-miss' }]"
        @click="simScenario = 'cache-miss'"
      >
        Pass-2 Cache Miss (ARG004)
      </button>
    </div>

    <div v-if="validatedContract.values && !simulatedEval.passed" class="aeb-alert">
      <strong>CI Merge Blocked by Deterministic Release Gate:</strong>
      <ul>
        <li v-for="f in simulatedEval.findings" :key="f"><code>{{ f }}</code></li>
      </ul>
    </div>

    <div v-if="validatedContract.values" class="aeb-code-grid">
      <div>
        <span class="aeb-code-lbl">Generated <code>agent-release-contract.json</code></span>
        <pre class="aeb-code"><code>{{ contractJson }}</code></pre>
      </div>
      <div>
        <span class="aeb-code-lbl">Immutable Git-SHA Pool Update &amp; CI Gate Command</span>
        <pre class="aeb-code"><code>{{ deployCliSnippet }}</code></pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.aeb-card {
  margin: 20px 0;
  padding: 20px 22px;
  border: 1px solid var(--ms-border-subtle);
  border-top: 3px solid #7c3aed;
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  box-shadow: var(--ms-shadow-sm);
}
.aeb-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 10px;
  padding-bottom: 12px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--ms-border-subtle);
}
.aeb-kicker {
  display: block;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.075em;
  color: var(--ms-accent-violet);
  margin-bottom: 2px;
}
.aeb-title {
  font-size: 0.98rem;
  color: var(--vp-c-text-1);
}
.aeb-head-btns {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
}
.aeb-btn {
  padding: 5px 11px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-brand-1);
  background: var(--ms-surface-card);
  color: var(--vp-c-brand-1);
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
}
.aeb-btn:hover {
  background: var(--vp-c-brand-1);
  color: #fff;
}
.aeb-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.aeb-inputs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 14px;
  margin-bottom: 12px;
}
@media (max-width: 860px) {
  .aeb-inputs {
    grid-template-columns: 1fr;
  }
}
.aeb-inputs label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--vp-c-text-2);
}
.aeb-inputs input {
  padding: 7px 10px;
  border: 1px solid var(--ms-border-subtle);
  border-radius: 6px;
  background: var(--ms-surface-card);
  color: var(--vp-c-text-1);
  font-size: 0.84rem;
}
.aeb-toggles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}
@media (max-width: 900px) {
  .aeb-toggles {
    grid-template-columns: 1fr;
  }
}
.aeb-check {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 11px;
  border-radius: 7px;
  border: 1px solid var(--ms-border-subtle);
  background: var(--ms-surface-card);
  font-size: 0.79rem;
  color: var(--vp-c-text-1);
  cursor: pointer;
}
.aeb-check input {
  accent-color: #7c3aed;
}
.aeb-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}
@media (max-width: 820px) {
  .aeb-metrics {
    grid-template-columns: 1fr;
  }
}
.aeb-metric {
  padding: 13px 15px;
  border-radius: 8px;
  border: 1px solid var(--ms-border-subtle);
  border-top: 3px solid #64748b;
  background: var(--ms-surface-card);
}
.aeb-metric.highlight {
  border-top-color: #7c3aed;
}
.aeb-metric.teal {
  border-top-color: var(--ms-accent-teal);
}
.aeb-metric.ok {
  border-top-color: #10b981;
}
.aeb-metric.fail {
  border-top-color: #dc2626;
}
.aeb-metric .k {
  display: block;
  font-size: 0.7rem;
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.035em;
  color: var(--vp-c-text-2);
}
.aeb-metric .v {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 4px 0 3px;
  color: var(--vp-c-text-1);
}
.aeb-metric .sub {
  font-size: 0.74rem;
  color: var(--vp-c-text-2);
}
.aeb-sim-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}
.aeb-sim-lbl {
  font-size: 0.75rem;
  font-weight: 650;
  color: var(--vp-c-text-2);
  margin-right: 4px;
}
.aeb-chip {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--ms-border-subtle);
  background: var(--ms-surface-card);
  color: var(--vp-c-text-2);
  font-size: 0.74rem;
  font-weight: 600;
  cursor: pointer;
}
.aeb-chip.active {
  background: #7c3aed;
  border-color: #7c3aed;
  color: #fff;
}
.aeb-alert {
  margin-bottom: 14px;
  padding: 11px 14px;
  border-radius: 8px;
  border: 1px solid rgba(220, 38, 38, 0.35);
  border-left: 4px solid #dc2626;
  background: rgba(220, 38, 38, 0.06);
  font-size: 0.8rem;
}
.aeb-alert ul {
  margin: 6px 0 0 !important;
  padding-left: 18px !important;
}
.aeb-code-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 900px) {
  .aeb-code-grid {
    grid-template-columns: 1fr;
  }
}
.aeb-code-lbl {
  display: block;
  font-size: 0.73rem;
  font-weight: 650;
  color: var(--vp-c-text-2);
  margin-bottom: 5px;
}
.aeb-code {
  margin: 0 !important;
  padding: 12px 14px;
  border-radius: 8px;
  background: #0d1522 !important;
  color: #e2e8f0 !important;
  border: 1px solid #1f2f46;
  font-family: var(--vp-font-family-mono);
  font-size: 0.75rem;
  line-height: 1.5;
  overflow-x: auto;
}
</style>
