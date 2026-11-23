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
const componentUrl = new URL('../docs/.vitepress/theme/components/AgentEvalBuilder.vue', import.meta.url)
const { descriptor, errors } = parse(await readFile(componentUrl, 'utf8'))
assert.deepEqual(errors, [])
const compiled = compileScript(descriptor, {
  id: 'studio-agent-test',
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
    name: 'studio-agent-test-runtime',
    setup(builder) {
      builder.onResolve({ filter: /^vue$/ }, () => ({
        path: pathToFileURL(require.resolve('vue/dist/vue.runtime.esm-bundler.js')).href,
        external: true,
      }))
    },
  }],
})
const { default: AgentEvalBuilder } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)

function mountBuilder() {
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
  const app = renderer.createApp(AgentEvalBuilder)
  app.mount(root)
  const all = () => descendants(root)
  const text = el => [el.text, ...descendants(el).map(child => child.text)].join(' ')
  function field(label) {
    const wrapper = all().find(el => el.type === 'label' && text(el).includes(label))
    assert.ok(wrapper, `missing field: ${label}`)
    return wrapper.children.find(child => child.type === 'input')
  }
  return {
    copied, all, field,
    text: () => text(root),
    buttons: () => all().filter(el => el.props.class === 'aeb-btn'),
    async set(label, value) {
      field(label).props['onUpdate:modelValue'](value)
      await nextTick()
    },
    async scenario(label) {
      const button = all().find(el => el.type === 'button' && text(el).includes(label))
      assert.ok(button)
      button.props.onClick()
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

test('invalid agent thresholds block simulation and direct exports with accessible field errors', async () => {
  const builder = mountBuilder()
  try {
    for (const [label, invalid, restored] of [
      ['Max Turn Latency', ['', ' ', 'invalid', '15000', NaN, Infinity, -Infinity, -1, 0], 15000],
      ['Min Pass-2 Cached', ['', ' ', 'invalid', '1024', NaN, Infinity, -Infinity, -1, 0, 0.5, 1024.5, Number.MAX_SAFE_INTEGER + 1, 1e308], 1024],
    ]) {
      for (const value of invalid) {
        await builder.set(label, value)
        assert.match(builder.text(), /BLOCKED \(Exit 2\)/)
        assert.ok(!builder.all().some(el => el.props.class === 'aeb-code-grid'))
        assert.ok(builder.all().some(el => el.props.role === 'alert' && el.props.id === 'aeb-contract-errors'))
        assert.equal(builder.field(label).props['aria-invalid'], true)
        assert.equal(builder.field(label).props['aria-describedby'], 'aeb-contract-errors')
        for (const button of builder.buttons()) {
          assert.equal(button.props.disabled, true)
          await button.props.onClick()
        }
        assert.deepEqual(builder.copied, [])
        await builder.set(label, restored)
        assert.match(builder.text(), /PASS \(Exit 0\)/)
        assert.equal(builder.field(label).props['aria-invalid'], false)
        assert.equal(builder.field(label).props['aria-describedby'], undefined)
        assert.ok(!builder.all().some(el => el.props.role === 'alert'))
        assert.ok(builder.all().some(el => el.props.class === 'aeb-code-grid'))
        assert.ok(builder.buttons().every(button => button.props.disabled === false))
      }
    }
  } finally { builder.close() }
})

test('valid defaults and positive threshold boundaries preserve exact contract and CLI exports', async () => {
  const builder = mountBuilder()
  const directory = await mkdtemp(join(tmpdir(), 'studio-agent-contract-'))
  try {
    const tracePath = join(directory, 'trace.jsonl')
    const contractPath = join(directory, 'contract.json')
    await writeFile(tracePath, JSON.stringify({
      case_id: 'boundary-probe', status: 'ok', assistant_response: '',
      tools_called: ['knowledge_base_retrieve'], retrieved_doc_ids: [],
      pass_number: 2, input_tokens: 4800, cached_tokens: 1024,
      duration_ms: 0.25, raw_prompt_logged: false,
    }) + '\n')
    for (const [latency, cachedTokens] of [[15000, 1024], [0.5, 1], [1e308, Number.MAX_SAFE_INTEGER]]) {
      await builder.set('Max Turn Latency', latency)
      await builder.set('Min Pass-2 Cached', cachedTokens)
      await builder.buttons()[0].props.onClick()
      const contract = JSON.parse(builder.copied.at(-1))
      assert.equal(contract.max_p95_ms, latency)
      assert.equal(contract.min_pass2_cached_tokens, cachedTokens)
      assert.deepEqual(contract.required_tools, ['knowledge_base_retrieve'])
      assert.deepEqual(contract.forbidden_tools, ['raw_shell_root', 'unguarded_http_post', 'drop_container'])
      assert.equal(contract.require_acl_trimming, true)
      assert.equal(contract.forbid_raw_prompt_logging, true)
      await writeFile(contractPath, builder.copied.at(-1))
      const result = spawnSync(process.execPath, [
        fileURLToPath(new URL('./run-python.mjs', import.meta.url)),
        fileURLToPath(new URL('../docs/public/kits/agent_release_gate.py', import.meta.url)),
        tracePath, '--contract', contractPath, '--json',
      ], { encoding: 'utf8', timeout: 30000 })
      assert.ifError(result.error)
      assert.equal(result.status, 0, result.stderr || result.stdout)
      assert.equal(JSON.parse(result.stdout).passed, true)
      await builder.buttons()[1].props.onClick()
      assert.match(builder.copied.at(-1), /--cooldown-period 300 --max-sessions 70 --ready-sessions 11/)
      assert.match(builder.copied.at(-1), /--contract \.\/agent-release-contract\.json/)
      assert.ok(!/NaN|Infinity|null/.test(builder.copied.at(-1)))
    }
  } finally {
    builder.close()
    await rm(directory, { recursive: true, force: true })
  }
})

test('cache-miss simulation follows ARG004 eligibility and invalid configuration takes precedence', async () => {
  const builder = mountBuilder()
  try {
    await builder.scenario('Pass-2 Cache Miss')
    for (const threshold of [1, 1024, 4800]) {
      await builder.set('Min Pass-2 Cached', threshold)
      assert.match(builder.text(), /BLOCKED \(Exit 1\)/)
      assert.ok(builder.text().includes(`(<${threshold})`))
    }
    await builder.set('Min Pass-2 Cached', 4801)
    assert.match(builder.text(), /PASS \(Exit 0\)/)
    await builder.set('Max Turn Latency', '')
    assert.match(builder.text(), /BLOCKED \(Exit 2\)/)
    await builder.scenario('Unresolved Citation')
    assert.match(builder.text(), /BLOCKED \(Exit 2\)/)
    await builder.set('Max Turn Latency', 15000)
    assert.match(builder.text(), /BLOCKED \(Exit 1\)/)
    assert.match(builder.text(), /\[ARG003\]/)
  } finally { builder.close() }
})

test('invalid pool inputs hide capacity and block direct CLI copy without blocking independent contracts', async () => {
  const builder = mountBuilder()
  try {
    for (const [label, invalid, restored] of [
      ['New Agent Sessions', ['', ' ', '8', true, null, NaN, Infinity, -Infinity, -1, 0, 0.99, Number.MAX_SAFE_INTEGER + 1, 1e308], 8],
      ['Avg Active Session', ['', ' ', '120', false, null, NaN, Infinity, -Infinity, -1, 0, 14.99, Number.MAX_SAFE_INTEGER + 1, 1e308], 120],
      ['ACA Cooldown', ['', ' ', '300', true, null, NaN, Infinity, -Infinity, -1, 0, 59, 60.5, 3601, 1e308], 300],
      ['Pre-Warmed Ready', ['', ' ', '15', false, null, NaN, Infinity, -Infinity, -1, 50.01, 1e308], 15],
    ]) {
      for (const value of invalid) {
        await builder.set(label, value)
        assert.ok(builder.all().some(el => el.props.role === 'alert' && el.props.id === 'aeb-pool-errors'))
        assert.equal(builder.field(label).props['aria-invalid'], true)
        assert.equal(builder.field(label).props['aria-describedby'], 'aeb-pool-errors')
        assert.ok(!builder.all().some(el => ['aeb-metric highlight', 'aeb-metric teal'].includes(el.props.class)))
        assert.ok(!builder.text().includes('az containerapp sessionpool update'))
        assert.match(builder.text(), /PASS \(Exit 0\)/)
        assert.equal(builder.buttons()[0].props.disabled, false)
        assert.equal(builder.buttons()[1].props.disabled, true)
        const before = builder.copied.length
        await builder.buttons()[1].props.onClick()
        assert.equal(builder.copied.length, before)
        await builder.buttons()[0].props.onClick()
        assert.equal(JSON.parse(builder.copied.at(-1)).max_p95_ms, 15000)
        await builder.set(label, restored)
        assert.equal(builder.field(label).props['aria-invalid'], false)
        assert.equal(builder.field(label).props['aria-describedby'], undefined)
        assert.ok(!builder.all().some(el => el.props.id === 'aeb-pool-errors'))
        assert.ok(builder.buttons().every(button => button.props.disabled === false))
        assert.match(builder.text(), /--cooldown-period 300 --max-sessions 70 --ready-sessions 11/)
      }
    }
    await builder.set('ACA Cooldown', '')
    await builder.scenario('Unresolved Citation')
    assert.match(builder.text(), /BLOCKED \(Exit 1\)/)
    await builder.set('Max Turn Latency', '')
    assert.match(builder.text(), /BLOCKED \(Exit 2\)/)
    assert.ok(builder.buttons().every(button => button.props.disabled === true))
    const before = builder.copied.length
    for (const button of builder.buttons()) await button.props.onClick()
    assert.equal(builder.copied.length, before)
  } finally { builder.close() }
})

test('pool sizing preserves boundary and fractional measurements and rejects unsafe derived counts', async () => {
  const builder = mountBuilder()
  try {
    for (const [rate, active, cooldown, warm, max, ready] of [
      [8, 120, 300, 15, 70, 11],
      [1, 15, 60, 0, 5, 0],
      [1, 15, 3600, 50, 80, 40],
      [1.5, 15.5, 60, 12.5, 5, 1],
      [60, 60, 60, 50, 150, 75],
      [60, 60, 60, 41, 150, 62],
    ]) {
      await builder.set('New Agent Sessions', rate)
      await builder.set('Avg Active Session', active)
      await builder.set('ACA Cooldown', cooldown)
      await builder.set('Pre-Warmed Ready', warm)
      assert.ok(!builder.all().some(el => el.props.id === 'aeb-pool-errors'))
      assert.ok(builder.all().some(el => el.props.class === 'aeb-metric highlight'))
      assert.ok(builder.all().some(el => el.props.class === 'aeb-metric teal'))
      await builder.buttons()[1].props.onClick()
      assert.ok(builder.copied.at(-1).includes(`--cooldown-period ${cooldown} --max-sessions ${max} --ready-sessions ${ready}`))
      assert.ok(!/NaN|Infinity|null|undefined/.test(builder.copied.at(-1)))
    }
    for (const [rate, hold] of [
      [Number.MAX_SAFE_INTEGER, 15],
      [1e10, 1e10],
      [60, 8e15],
      [1, Number.MAX_SAFE_INTEGER],
      [1e15, 15],
    ]) {
      await builder.set('New Agent Sessions', rate)
      await builder.set('Avg Active Session', hold)
      assert.ok(builder.all().some(el => el.props.id === 'aeb-pool-errors'))
      for (const label of ['New Agent Sessions', 'Avg Active Session']) {
        assert.equal(builder.field(label).props['aria-invalid'], true)
        assert.equal(builder.field(label).props['aria-describedby'], 'aeb-pool-errors')
      }
      assert.ok(!builder.all().some(el => ['aeb-metric highlight', 'aeb-metric teal'].includes(el.props.class)))
      const before = builder.copied.length
      await builder.buttons()[1].props.onClick()
      assert.equal(builder.copied.length, before)
      await builder.set('New Agent Sessions', 8)
      await builder.set('Avg Active Session', 120)
      assert.ok(!builder.all().some(el => el.props.id === 'aeb-pool-errors'))
      assert.equal(builder.buttons()[1].props.disabled, false)
    }
  } finally { builder.close() }
})
