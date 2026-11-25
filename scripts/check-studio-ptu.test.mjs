import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { compileScript, parse } from '@vue/compiler-sfc'
import { build } from 'esbuild'
import { createRenderer, nextTick } from 'vue'

const require = createRequire(import.meta.url)
const componentUrl = new URL('../docs/.vitepress/theme/components/PtuCalculator.vue', import.meta.url)
const { descriptor, errors } = parse(await readFile(componentUrl, 'utf8'))
assert.deepEqual(errors, [])
const compiled = compileScript(descriptor, {
  id: 'studio-ptu-test',
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
    name: 'studio-ptu-test-runtime',
    setup(builder) {
      builder.onResolve({ filter: /^vue$/ }, () => ({
        path: pathToFileURL(require.resolve('vue/dist/vue.runtime.esm-bundler.js')).href,
        external: true,
      }))
    },
  }],
})
const { default: PtuCalculator } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)

function mountCalculator() {
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const oldDocumentClass = Object.getOwnPropertyDescriptor(globalThis, 'Document')
  const oldShadowRootClass = Object.getOwnPropertyDescriptor(globalThis, 'ShadowRoot')
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const copied = []
  class TestDocument { activeElement = null }
  Object.defineProperty(globalThis, 'Document', { configurable: true, value: TestDocument })
  Object.defineProperty(globalThis, 'ShadowRoot', { configurable: true, value: class {} })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: new TestDocument() })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { clipboard: { async writeText(text) { copied.push(text) } } },
  })
  function descendants(node) {
    return node.children.flatMap(child => [child, ...descendants(child)])
  }
  function node(type, text = '') {
    return {
      type, tagName: type.toUpperCase(), text, props: {}, children: [], parent: null,
      addEventListener() {},
      getRootNode() { return globalThis.document },
      get options() { return this.children.filter(child => child.type === 'option') },
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
      if (key === 'type') el.type = value
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
  const app = renderer.createApp(PtuCalculator)
  app.mount(root)
  const all = () => descendants(root)
  function field(label) {
    const wrapper = all().find(el => el.type === 'label' &&
      el.children.some(child => child.type === 'span' && child.text.startsWith(label)))
    assert.ok(wrapper, `missing field: ${label}`)
    return wrapper.children.find(child => ['INPUT', 'SELECT'].includes(child.tagName))
  }
  return {
    copied, field,
    all,
    text: () => all().map(el => el.text).join(' '),
    copyButton: () => all().find(el => el.props.class?.includes('ptu-copy-btn')),
    async set(label, value) {
      field(label).props['onUpdate:modelValue'](value)
      await nextTick()
    },
    async preset(label) {
      all().find(el => el.tagName === 'BUTTON' && el.text === label).props.onClick()
      await nextTick()
    },
    close() {
      app.unmount()
      for (const [key, descriptor] of [
        ['document', oldDocument], ['Document', oldDocumentClass],
        ['ShadowRoot', oldShadowRootClass], ['navigator', oldNavigator],
      ]) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else delete globalThis[key]
      }
    },
  }
}

function assertBlocked(calculator, label) {
  assert.equal(calculator.copyButton().props.disabled, true)
  assert.ok(calculator.all().some(el => el.props.role === 'alert' && el.props.id === 'ptu-input-errors'))
  assert.ok(!calculator.all().some(el => ['ptu-results', 'ptu-bars'].includes(el.props.class)),
    'invalid input must hide both current and stale estimates')
  assert.equal(calculator.field(label).props['aria-invalid'], true)
  assert.equal(calculator.field(label).props['aria-describedby'], 'ptu-input-errors')
}

test('unsupported model identities block fallback sizing and direct exports, then recover with supported models', async () => {
  const calculator = mountCalculator()
  try {
    const models = calculator.field('Target Foundry Model').options.map(option => option.props.value)
    for (const value of [
      '', ' ', 'unknown-model', 'gpt-6.1-terra', 'GPT-5.6-TERRA',
      ' gpt-5.6-terra', 'gpt-5.6-terra ', null, undefined, 0,
    ]) {
      await calculator.set('Target Foundry Model', value)
      assertBlocked(calculator, 'Target Foundry Model')
      assert.match(calculator.text(), /select a supported model/)
      assert.ok(!calculator.all().some(el => el.props.class === 'ptu-note'),
        'invalid selections must not display a fallback model compatibility rule')
      await calculator.copyButton().props.onClick()
      assert.deepEqual(calculator.copied, [])
    }
    for (const model of models) {
      await calculator.set('Target Foundry Model', model)
      assert.equal(calculator.copyButton().props.disabled, false)
      assert.equal(calculator.field('Target Foundry Model').props['aria-invalid'], false)
      assert.ok(!calculator.all().some(el => el.props.role === 'alert'))
      await calculator.copyButton().props.onClick()
      assert.ok(calculator.copied.at(-1).startsWith(`### PTU, Cache-Shard & Spillover Estimate (${model} (`))
    }
    await calculator.set('Target Foundry Model', 'unknown-model')
    await calculator.preset('Document Review Agent (Default)')
    assert.match(calculator.text(), /170 PTUs/)
    assert.match(calculator.text(), /435 PTUs \(2\.56/)
    assert.equal(calculator.copyButton().props.disabled, false)
    assert.ok(!calculator.all().some(el => el.props.role === 'alert'))
  } finally { calculator.close() }
})

test('blank, non-finite, and out-of-range inputs block displayed and exported estimates', async () => {
  const calculator = mountCalculator()
  try {
    for (const [label, invalid, restored] of [
      ['Steady Peak RPM', ['', ' ', 'invalid', NaN, Infinity, -Infinity, 0, -1, 1e308], 100],
      ['Avg Input Tokens', ['', NaN, Infinity, 99, 272001], 10000],
      ['Avg Output Tokens', ['', NaN, Infinity, 9, 1e308], 500],
      ['Cached Input Share', ['', NaN, Infinity, -1, 99], 80],
      ['Seasonal Cliff Surge', ['', NaN, Infinity, 0, 11], 4],
      ['Peak Surge Window', ['', NaN, Infinity, 0, 7], 2],
    ]) {
      for (const value of invalid) {
        await calculator.set(label, value)
        assertBlocked(calculator, label)
        await calculator.copyButton().props.onClick()
        assert.deepEqual(calculator.copied, [], 'even direct handler invocation must not export invalid inputs')
        await calculator.set(label, restored)
        assert.equal(calculator.copyButton().props.disabled, false)
        assert.ok(!calculator.all().some(el => el.props.role === 'alert'))
        assert.equal(calculator.field(label).props['aria-invalid'], false)
      }
    }
  } finally { calculator.close() }
})

test('short-context boundaries remain usable and default sizing/export are preserved', async () => {
  const calculator = mountCalculator()
  try {
    assert.match(calculator.text(), /170 PTUs/)
    assert.match(calculator.text(), /435 PTUs \(2\.56/)
    await calculator.copyButton().props.onClick()
    assert.match(calculator.copied[0], /100 Peak RPM/)
    assert.match(calculator.copied[0], /\*\*170 PTUs\*\*/)
    for (const input of [100, 272000]) {
      await calculator.set('Cached Input Share', input < 1024 ? 0 : 80)
      await calculator.set('Avg Input Tokens', input)
      assert.equal(calculator.copyButton().props.disabled, false)
      assert.ok(!calculator.all().some(el => el.props.role === 'alert'))
      await calculator.copyButton().props.onClick()
      assert.ok(!/NaN|Infinity/.test(calculator.copied.at(-1)))
    }
    await calculator.set('Cached Input Share', 0)
    assert.equal(calculator.copyButton().props.disabled, false)
  } finally { calculator.close() }
})

test('sub-minimum prompts block positive cache savings across models and recover at the eligibility boundary', async () => {
  const calculator = mountCalculator()
  try {
    for (const model of calculator.field('Target Foundry Model').options) {
      await calculator.set('Target Foundry Model', model.props.value)
      for (const input of [100, 1023, 1023.5]) {
        await calculator.set('Avg Input Tokens', input)
        for (const share of [0.1, 80, 98]) {
          await calculator.set('Cached Input Share', share)
          assertBlocked(calculator, 'Cached Input Share')
          assert.equal(calculator.field('Avg Input Tokens').props['aria-invalid'], true)
          assert.equal(calculator.field('Avg Input Tokens').props['aria-describedby'], 'ptu-input-errors')
          assert.match(calculator.text(), /1,024/)
          await calculator.copyButton().props.onClick()
          assert.deepEqual(calculator.copied, [])
        }
        await calculator.set('Cached Input Share', 0)
        assert.equal(calculator.copyButton().props.disabled, false)
        assert.ok(!calculator.all().some(el => el.props.role === 'alert'))
        await calculator.copyButton().props.onClick()
        const estimate = calculator.copied.pop()
        assert.match(estimate, /Tuned PTU Allocation \(0% Cache Hit\)/)
        assert.match(estimate, /1\.00× spike · saves 0 PTUs/)
      }
      await calculator.set('Cached Input Share', 80)
      assertBlocked(calculator, 'Cached Input Share')
      await calculator.set('Avg Input Tokens', 1024)
      assert.equal(calculator.copyButton().props.disabled, false)
      assert.equal(calculator.field('Cached Input Share').props['aria-invalid'], false)
      assert.equal(calculator.field('Avg Input Tokens').props['aria-invalid'], false)
      await calculator.copyButton().props.onClick()
      assert.match(calculator.copied.pop(), /Tuned PTU Allocation \(80% Cache Hit\)/)
    }
    await calculator.set('Avg Input Tokens', 100)
    assertBlocked(calculator, 'Cached Input Share')
    await calculator.preset('Document Review Agent (Default)')
    assert.equal(calculator.copyButton().props.disabled, false)
    assert.ok(!calculator.all().some(el => el.props.role === 'alert'))
    assert.match(calculator.text(), /170 PTUs/)
  } finally { calculator.close() }
})

test('finite oversized workloads block unsafe estimates across models and recover with safe fractional inputs', async () => {
  const calculator = mountCalculator()
  try {
    for (const model of calculator.field('Target Foundry Model').options) {
      await calculator.set('Target Foundry Model', model.props.value)
      for (const [label, value, restored] of [
        ['Steady Peak RPM', Number.MAX_SAFE_INTEGER + 1, 100],
        ['Avg Output Tokens', Number.MAX_SAFE_INTEGER + 1, 500],
        ['Steady Peak RPM', 1e20, 100],
        ['Avg Output Tokens', 1e20, 500],
      ]) {
        await calculator.set(label, value)
        assertBlocked(calculator, label)
        assert.match(calculator.text(), /safe integer precision/)
        await calculator.copyButton().props.onClick()
        assert.deepEqual(calculator.copied, [])
        await calculator.set(label, restored)
        assert.equal(calculator.copyButton().props.disabled, false)
      }
    }
    await calculator.set('Steady Peak RPM', 100.5)
    await calculator.set('Avg Input Tokens', 10000.5)
    await calculator.set('Avg Output Tokens', 500.5)
    await calculator.copyButton().props.onClick()
    assert.match(calculator.copied[0], /100\.5 Peak RPM/)
    assert.match(calculator.copied[0], /10,000\.5 Input Tok/)
    assert.ok(!/NaN|Infinity/.test(calculator.copied[0]))
  } finally { calculator.close() }
})

test('combined workload and seasonal arithmetic obey the safe precision budget', async () => {
  const calculator = mountCalculator()
  try {
    await calculator.set('Steady Peak RPM', 1e10)
    await calculator.set('Seasonal Cliff Surge', 1)
    assert.equal(calculator.copyButton().props.disabled, false)
    await calculator.set('Seasonal Cliff Surge', 10)
    assertBlocked(calculator, 'Steady Peak RPM')
    assert.equal(calculator.field('Avg Output Tokens').props['aria-invalid'], true)
    await calculator.copyButton().props.onClick()
    assert.deepEqual(calculator.copied, [])
    await calculator.set('Seasonal Cliff Surge', 1)
    assert.equal(calculator.copyButton().props.disabled, false)
    await calculator.copyButton().props.onClick()
    const allocation = calculator.copied[0].match(/\*\*(\d+) PTUs\*\*/)
    assert.ok(allocation)
    assert.ok(Number.isSafeInteger(Number(allocation[1])))
    await calculator.preset('Document Review Agent (Default)')
    assert.match(calculator.text(), /170 PTUs/)
    assert.ok(!calculator.all().some(el => el.props.role === 'alert'))
  } finally { calculator.close() }
})

test('read/write inputs validate only in the applicable regime and presets recover invalid state', async () => {
  const calculator = mountCalculator()
  try {
    await calculator.preset('Multi-Turn Enterprise Copilot')
    for (const value of ['', NaN, Infinity, 0, 101]) {
      await calculator.set('Steady-State Read/Write Ratio', value)
      assertBlocked(calculator, 'Steady-State Read/Write Ratio')
    }
    await calculator.set('Target Foundry Model', 'gpt-5.6-terra')
    assert.equal(calculator.copyButton().props.disabled, false, 'hidden read/write input cannot block pre-GPT-6')
    await calculator.set('Target Foundry Model', 'gpt-6-sol')
    assertBlocked(calculator, 'Steady-State Read/Write Ratio')
    await calculator.set('Avg Input Tokens', 272001)
    for (const preset of [
      'Document Review Agent (Default)', 'High-RPM Guardrail Router',
      'Multi-Turn Enterprise Copilot', 'GPT-6.1 Regulated Scorer',
    ]) {
      await calculator.preset(preset)
      assert.equal(calculator.copyButton().props.disabled, false)
      assert.ok(!calculator.all().some(el => el.props.role === 'alert'))
      await calculator.copyButton().props.onClick()
      assert.ok(!/NaN|Infinity/.test(calculator.copied.at(-1)))
    }
    await calculator.set('Steady-State Read/Write Ratio', 1)
    await calculator.set('Cached Input Share', 98)
    assert.match(calculator.text(), /50% Hit.*R\/W Capped/)
  } finally { calculator.close() }
})
