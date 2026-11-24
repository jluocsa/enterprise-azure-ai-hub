import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { compileScript, parse } from '@vue/compiler-sfc'
import { build } from 'esbuild'
import { createRenderer, nextTick } from 'vue'

const require = createRequire(import.meta.url)
const componentUrl = new URL('../docs/.vitepress/theme/components/DataStrategyAdvisor.vue', import.meta.url)
const { descriptor, errors } = parse(await readFile(componentUrl, 'utf8'))
assert.deepEqual(errors, [])
const compiled = compileScript(descriptor, {
  id: 'studio-data-test',
  inlineTemplate: true,
  templateOptions: { compilerOptions: { hoistStatic: false } },
})
const bundle = await build({
  stdin: { contents: compiled.content, loader: 'ts', resolveDir: fileURLToPath(new URL('../', import.meta.url)) },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  plugins: [{
    name: 'studio-data-test-runtime',
    setup(builder) {
      builder.onResolve({ filter: /^vue$/ }, () => ({
        path: pathToFileURL(require.resolve('vue/dist/vue.runtime.esm-bundler.js')).href,
        external: true,
      }))
    },
  }],
})
const { default: DataStrategyAdvisor } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
)

function mountAdvisor() {
  const originals = ['document', 'Document', 'ShadowRoot', 'navigator', 'setTimeout']
    .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  const copied = []
  class TestDocument { activeElement = null }
  for (const [key, value] of [
    ['Document', TestDocument], ['ShadowRoot', class {}], ['document', new TestDocument()],
    ['navigator', { clipboard: { async writeText(text) { copied.push(text) } } }],
    ['setTimeout', () => 0],
  ]) {
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  function descendants(node) {
    return node.children.flatMap(child => [child, ...descendants(child)])
  }
  function node(type, text = '') {
    return {
      type, tagName: type.toUpperCase(), text, props: {}, children: [], parent: null,
      get options() { return this.children.filter(child => child.type === 'option') },
      addEventListener() {},
      getRootNode() { return globalThis.document },
    }
  }
  const renderer = createRenderer({
    createElement: type => node(type),
    createText: text => node('text', text),
    createComment: text => node('comment', text),
    setText(el, text) { el.text = text },
    setElementText(el, text) { el.text = text },
    patchProp(el, key, _previous, value) {
      el.props[key] = value
      if (key === 'value') { el.value = value; el._value = value }
    },
    insert(el, parent, anchor = null) {
      if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1)
      const index = anchor ? parent.children.indexOf(anchor) : parent.children.length
      parent.children.splice(index, 0, el)
      el.parent = parent
    },
    remove(el) {
      el.parent.children.splice(el.parent.children.indexOf(el), 1)
      el.parent = null
    },
    parentNode: el => el.parent,
    nextSibling: el => el.parent?.children[el.parent.children.indexOf(el) + 1] ?? null,
  })
  const root = node('root')
  const app = renderer.createApp(DataStrategyAdvisor)
  app.mount(root)
  const all = () => descendants(root)
  const text = el => [el.text, ...descendants(el).map(child => child.text)].join(' ')
  function field(label) {
    const wrapper = all().find(el => el.type === 'label' && text(el).includes(label))
    assert.ok(wrapper, `missing field: ${label}`)
    return wrapper.children.find(child => child.type === 'input' || child.type === 'select')
  }
  return {
    copied, all, field,
    text: () => text(root),
    buttons: () => all().filter(el => el.props.class === 'dsa-btn'),
    async set(label, value) {
      field(label).props['onUpdate:modelValue'](value)
      await nextTick()
    },
    async clickButton(label) {
      const btn = all().find(el => el.type === 'button' && text(el).includes(label))
      assert.ok(btn, `missing button: ${label}`)
      btn.props.onClick()
      await nextTick()
    },
    close() {
      app.unmount()
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else delete globalThis[key]
      }
    },
  }
}

test('invalid data governance thresholds block exports with accessible errors and recover cleanly', async () => {
  const advisor = mountAdvisor()
  try {
    for (const [label, invalid, restored] of [
      ['Max ACL Revocation SLA', ['', NaN, Infinity, -1, 0, 1441], 15],
      ['Max Corpus Freshness Lag', ['', NaN, Infinity, -5, 0, 10081], 60],
    ]) {
      for (const value of invalid) {
        await advisor.set(label, value)
        assert.match(advisor.text(), /BLOCKED \(Exit 2\)/)
        assert.ok(advisor.all().some(el => el.props.role === 'alert' && el.props.id === 'dsa-contract-errors'))
        assert.equal(advisor.field(label).props['aria-invalid'], true)
        assert.equal(advisor.field(label).props['aria-describedby'], 'dsa-contract-errors')
        for (const btn of advisor.buttons()) {
          assert.equal(btn.props.disabled, true)
          await btn.props.onClick()
        }
        assert.deepEqual(advisor.copied, [])
        await advisor.set(label, restored)
        assert.match(advisor.text(), /PASS \(Exit 0\)/)
        assert.equal(advisor.field(label).props['aria-invalid'], false)
      }
    }
  } finally { advisor.close() }
})

test('invalid corpus scale blocks sizing & CLI copy while keeping contract JSON export functional', async () => {
  const advisor = mountAdvisor()
  try {
    for (const [label, invalid, restored] of [
      ['Total Corpus Documents', ['', 0, -10, 1.5, NaN], 250000],
      ['Avg Tokens / Chunk', [64, 4096, 256.5, ''], 512],
      ['Batch Embedding TPM Quota', [5000, 0, -1, NaN], 1000000],
      ['Peak Hybrid Retrieval QPS', [0, -1, 100001, NaN], 40],
    ]) {
      for (const value of invalid) {
        await advisor.set(label, value)
        assert.ok(advisor.all().some(el => el.props.role === 'alert' && el.props.id === 'dsa-sizing-errors'))
        assert.equal(advisor.field(label).props['aria-invalid'], true)
        assert.equal(advisor.buttons()[0].props.disabled, false)
        assert.equal(advisor.buttons()[1].props.disabled, true)
        await advisor.set(label, restored)
        assert.ok(!advisor.all().some(el => el.props.id === 'dsa-sizing-errors'))
        assert.equal(advisor.buttons()[1].props.disabled, false)
      }
    }
  } finally { advisor.close() }
})

test('exported data-readiness-contract.json executes cleanly against data_readiness_gate.py CLI', async () => {
  const advisor = mountAdvisor()
  const directory = await mkdtemp(join(tmpdir(), 'studio-data-contract-'))
  try {
    await advisor.clickButton('Regulated Ethical-Wall')
    await advisor.buttons()[0].props.onClick()
    const contractText = advisor.copied.at(-1)
    const contract = JSON.parse(contractText)
    assert.equal(contract.posture, 'regulated')
    assert.equal(contract.max_revocation_lag_min, 5)
    assert.deepEqual(contract.required_stores, ['fabric-iq', 'ai-search', 'cosmos-hybrid'])

    const contractPath = join(directory, 'contract.json')
    const snapshotPath = join(directory, 'snapshot.json')
    await writeFile(contractPath, contractText)
    await writeFile(
      snapshotPath,
      JSON.stringify({
        purview_dspm_enabled: true,
        datasets: [
          {
            source_id: 'fabric-kpis',
            store_target: 'fabric-iq',
            medallion_tier: 'ai-gold',
            source_uri: 'onelake://fin-gold/Tables/kpis',
            lineage_sha256: 'a'.repeat(64),
            dedicated_interactive_fsku: true,
            sensitivity_label: 'Confidential',
            allow_public_index: false,
            acl_enforced: true,
            acl_group_ids: ['grp-fin'],
            revocation_lag_minutes: 3,
            overdue_tombstones: 0,
            freshness_lag_minutes: 10,
            pos6_cache_safe_ordering: true,
            eval_flywheel_enabled: true,
          },
          {
            source_id: 'search-docs',
            store_target: 'ai-search',
            medallion_tier: 'ai-gold',
            source_uri: 'onelake://fin-gold/Files/docs',
            lineage_sha256: 'b'.repeat(64),
            sensitivity_label: 'Highly Confidential - Ethical Wall',
            allow_public_index: false,
            acl_enforced: true,
            acl_group_ids: ['grp-eng'],
            revocation_lag_minutes: 2,
            overdue_tombstones: 0,
            alias_cutover_enabled: true,
            region_lag_pct: 0.2,
            avg_chunk_tokens: 512,
            duplicate_or_empty_ratio_pct: 1.0,
            freshness_lag_minutes: 15,
            pos6_cache_safe_ordering: true,
            eval_flywheel_enabled: true,
          },
          {
            source_id: 'cosmos-memory',
            store_target: 'cosmos-hybrid',
            medallion_tier: 'gold',
            source_uri: 'cosmos://state/containers/mem-v2',
            lineage_sha256: 'c'.repeat(64),
            sensitivity_label: 'Highly Confidential - Ethical Wall',
            allow_public_index: false,
            acl_enforced: true,
            acl_group_ids: ['grp-eng'],
            revocation_lag_minutes: 1,
            overdue_tombstones: 0,
            vector_index_type: 'diskANN',
            hybrid_rrf_enabled: true,
            tenant_partition_key_scoped: true,
            embedding_dim: 1536,
            avg_chunk_tokens: 384,
            duplicate_or_empty_ratio_pct: 0.5,
            freshness_lag_minutes: 1,
            pos6_cache_safe_ordering: true,
            eval_flywheel_enabled: true,
          },
        ],
      })
    )
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('./run-python.mjs', import.meta.url)),
        fileURLToPath(new URL('../docs/public/kits/data_readiness_gate.py', import.meta.url)),
        snapshotPath,
        '--contract',
        contractPath,
        '--json',
      ],
      { encoding: 'utf8', timeout: 30000 }
    )
    assert.ifError(result.error)
    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.equal(JSON.parse(result.stdout).passed, true)

    await advisor.buttons()[1].props.onClick()
    assert.match(advisor.copied.at(-1), /data_readiness_gate\.py/)
    assert.match(advisor.copied.at(-1), /az cosmosdb sql container throughput migrate/)
  } finally {
    advisor.close()
    await rm(directory, { recursive: true, force: true })
  }
})

test('failure simulation scenarios emit exact DRG002-DRG006 gate verdicts', async () => {
  const advisor = mountAdvisor()
  try {
    for (const [label, expectedCode] of [
      ['Shared Batch F-SKU', /\[DRG002\]/],
      ['Missing Purview Label', /\[DRG003\]/],
      ['Stale ACL Revocation', /\[DRG004\]/],
      ['Unscoped Cosmos Vector', /\[DRG005\]/],
      ['Prompt Poisoning Chunk', /\[DRG006\]/],
    ]) {
      await advisor.clickButton(label)
      assert.match(advisor.text(), /BLOCKED \(Exit 1\)/)
      assert.match(advisor.text(), expectedCode)
    }
    await advisor.clickButton('Clean AI-Gold Snapshot')
    assert.match(advisor.text(), /PASS \(Exit 0\)/)
  } finally { advisor.close() }
})
