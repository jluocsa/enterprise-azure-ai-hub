<script setup lang="ts">
import { computed, ref } from 'vue'

const modelGeneration = ref<'gpt-5.6-ptu' | 'gpt-6-ptu'>('gpt-5.6-ptu')
const enableSpillover = ref(true)
const stripFinopsHeader = ref(true)
const enableTokenLimit = ref(true)
const tokenLimitTpm = ref<number | string>(450000)
const streamSafe = ref(true)
const copied = ref(false)

const quotaError = computed(() => {
  if (!enableTokenLimit.value) return ''
  const value = tokenLimitTpm.value
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 10000
    ? ''
    : 'Per-Subscription TPM Quota must be a whole number from 10,000 to 9,007,199,254,740,991. Correct the quota before generating or copying XML.'
})

const policyXml = computed(() => {
  if (quotaError.value) return null
  const lines: string[] = [
    `<policies>`,
    `  <inbound>`,
    `    <base />`,
    `    <!-- 1. Passwordless Managed Identity Auth to Microsoft Foundry -->`,
    `    <authentication-managed-identity resource="https://cognitiveservices.azure.com" output-token-variable-name="msi-access-token" ignore-error="false" />`,
    `    <set-header name="Authorization" exists-action="override">`,
    `      <value>@("Bearer " + (string)context.Variables["msi-access-token"])</value>`,
    `    </set-header>`,
  ]

  if (stripFinopsHeader.value) {
    lines.push(
      `    <!-- 2. Out-of-Band FinOps Chargeback (Preserve Shared Prefix Cache Keys) -->`,
      `    <set-variable name="costCenter" value="@(context.Request.Headers.GetValueOrDefault(&quot;x-cost-center&quot;, &quot;unallocated&quot;))" />`,
      `    <set-header name="x-cost-center" exists-action="delete" />`
    )
  }

  if (enableTokenLimit.value) {
    lines.push(
      `    <!-- 3. Tenant / Practice Token Quota & OTel Metric Emission -->`,
      `    <azure-openai-emit-token-metric namespace="foundry-ai-gateway">`,
      `      <dimension name="SubscriptionId" value="@(context.Subscription.Id)" />`,
      ...(stripFinopsHeader.value ? [`      <dimension name="CostCenter" value="@((string)context.Variables[&quot;costCenter&quot;])" />`] : []),
      `    </azure-openai-emit-token-metric>`,
      `    <azure-openai-token-limit counter-key="@(context.Subscription.Id)" tokens-per-minute="${tokenLimitTpm.value}" estimate-prompt-tokens="true" />`
    )
  }

  if (enableSpillover.value) {
    lines.push(
      `    <!-- 4. Snapshot the Original Body Before Any PTU-Only Rewrite -->`,
      `    <set-variable name="original-request-body" value="@(context.Request.Body.As&lt;string&gt;(preserveContent: true))" />`
    )
  }
  lines.push(`    <set-backend-service backend-id="foundry-ptu-primary" />`)

  if (modelGeneration.value === 'gpt-5.6-ptu') {
    lines.push(
      `    <!-- 5. SKU-Aware Guard: Strip Unsupported Breakpoints on GPT-5.6 PTU-M Primary Leg -->`,
      `    <set-body>@{`,
      `      var body = context.Request.Body.As&lt;JObject&gt;(preserveContent: true);`,
      `      body.Remove("prompt_cache_options");`,
      `      foreach (var field in new [] { "input", "messages" }) {`,
      `        if (body[field] is JArray items) {`,
      `          foreach (var msg in items.OfType&lt;JObject&gt;()) {`,
      `            if (msg["content"] is JArray parts) {`,
      `              foreach (var part in parts.OfType&lt;JObject&gt;()) {`,
      `                part.Remove("prompt_cache_breakpoint");`,
      `              }`,
      `            }`,
      `          }`,
      `        }`,
      `      }`,
      `      return body.ToString(Newtonsoft.Json.Formatting.None);`,
      `    }</set-body>`
    )
  }

  lines.push(`  </inbound>`, `  <backend>`)

  if (enableSpillover.value) {
    lines.push(
      `    <!-- Restore Original Body on Pre-Stream 429 / 503 Standard PAYG Retry -->`,
      `    <retry condition="@(context.Response != null &amp;&amp; (context.Response.StatusCode == 429 || context.Response.StatusCode == 503))" count="1" interval="1" first-fast-retry="true">`,
      `      <choose>`,
      `        <when condition="@(context.Response != null &amp;&amp; (context.Response.StatusCode == 429 || context.Response.StatusCode == 503))">`,
      `          <set-backend-service backend-id="foundry-standard-spillover" />`,
      `          <set-body>@((string)context.Variables["original-request-body"])</set-body>`,
      `        </when>`,
      `      </choose>`,
      `      <forward-request timeout="120" buffer-request-body="true" ${streamSafe.value ? 'buffer-response="false"' : ''} />`,
      `    </retry>`
    )
  } else {
    lines.push(
      `    <forward-request timeout="120" ${streamSafe.value ? 'buffer-response="false"' : ''} />`
    )
  }

  lines.push(
    `  </backend>`,
    `  <outbound>`,
    `    <base />`,
    `    <set-header name="x-gateway-routed-sku" exists-action="override">`,
    `      <value>@(context.Response.Headers.GetValueOrDefault("x-ms-deployment-name", "foundry-pool"))</value>`,
    `    </set-header>`,
    `  </outbound>`,
    `  <on-error>`,
    `    <base />`,
    `  </on-error>`,
    `</policies>`
  )

  return lines.join('\n')
})

async function copyXml() {
  const xml = policyXml.value
  if (xml === null) return
  try {
    await navigator.clipboard.writeText(xml)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2200)
  } catch {}
}
</script>

<template>
  <div class="apim-builder">
    <div class="apim-head">
      <div>
        <span class="apim-kicker">INTERACTIVE GATEWAY GENERATOR &middot; PLAYBOOK 02</span>
        <strong class="apim-title">SKU-Aware Azure API Management AI Gateway Policy Builder</strong>
      </div>
      <button type="button" class="apim-copy-btn no-print" :disabled="!policyXml" @click="copyXml">
        {{ copied && policyXml ? '✓ Copied Policy XML' : 'Copy APIM XML' }}
      </button>
    </div>

    <div class="apim-controls no-print">
      <label class="apim-select">
        <span>Target Primary PTU-M Regime</span>
        <select v-model="modelGeneration">
          <option value="gpt-5.6-ptu">GPT-5.6 PTU-M (Strip Unsupported Breakpoint Fields)</option>
          <option value="gpt-6-ptu">GPT-6 / GPT-6.1 PTU-M (Pass Explicit Breakpoints Through)</option>
        </select>
      </label>

      <label class="apim-select" v-if="enableTokenLimit">
        <span>Per-Subscription TPM Quota</span>
        <input v-model.number="tokenLimitTpm" type="number" min="10000" :max="Number.MAX_SAFE_INTEGER" step="1" :aria-invalid="Boolean(quotaError)" :aria-describedby="quotaError ? 'apim-quota-error' : undefined" />
      </label>

      <label class="apim-check">
        <input v-model="enableSpillover" type="checkbox" />
        <span>429 / 503 Spillover to Standard PAYG Pool</span>
      </label>

      <label class="apim-check">
        <input v-model="stripFinopsHeader" type="checkbox" />
        <span>Out-of-Band <code>x-cost-center</code> FinOps Extraction</span>
      </label>

      <label class="apim-check">
        <input v-model="enableTokenLimit" type="checkbox" />
        <span>Emit OTel Token Metrics &amp; Enforce TPM Cap</span>
      </label>

      <label class="apim-check">
        <input v-model="streamSafe" type="checkbox" />
        <span>SSE Unbuffered Streaming (<code>buffer-response="false"</code>)</span>
      </label>
    </div>

    <div v-if="quotaError" id="apim-quota-error" class="apim-quota-error" role="alert">{{ quotaError }}</div>
    <pre v-else class="apim-code"><code>{{ policyXml }}</code></pre>
  </div>
</template>

<style scoped>
.apim-builder {
  margin: 20px 0;
  padding: 20px 22px;
  border: 1px solid var(--ms-border-subtle);
  border-top: 3px solid #0284c7;
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  box-shadow: var(--ms-shadow-sm);
}
.apim-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 10px;
  padding-bottom: 12px;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--ms-border-subtle);
}
.apim-kicker {
  display: block;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.075em;
  color: var(--ms-accent-cyan);
  margin-bottom: 2px;
}
.apim-title {
  font-size: 0.98rem;
  color: var(--vp-c-text-1);
}
.apim-copy-btn {
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-brand-1);
  background: var(--ms-surface-card);
  color: var(--vp-c-brand-1);
  font-size: 0.77rem;
  font-weight: 600;
  cursor: pointer;
}
.apim-copy-btn:hover {
  background: var(--vp-c-brand-1);
  color: #fff;
}
.apim-copy-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.apim-quota-error {
  padding: 12px 14px;
  border-left: 3px solid #d97706;
  background: var(--ms-surface-card);
  color: var(--vp-c-text-1);
}
.apim-controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px 12px;
  margin-bottom: 14px;
}
.apim-select {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--vp-c-text-2);
}
.apim-select select,
.apim-select input {
  padding: 7px 10px;
  border-radius: 6px;
  border: 1px solid var(--ms-border-subtle);
  background: var(--ms-surface-card);
  color: var(--vp-c-text-1);
  font-size: 0.82rem;
}
.apim-check {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 11px;
  border-radius: 7px;
  border: 1px solid var(--ms-border-subtle);
  background: var(--ms-surface-card);
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--vp-c-text-1);
  cursor: pointer;
}
.apim-check input {
  accent-color: #0078d4;
}
.apim-code {
  margin: 0 !important;
  padding: 14px 16px;
  border-radius: 8px;
  background: #0d1522 !important;
  color: #e2e8f0 !important;
  border: 1px solid #1f2f46;
  font-family: var(--vp-font-family-mono);
  font-size: 0.77rem;
  line-height: 1.52;
  overflow-x: auto;
}
</style>
