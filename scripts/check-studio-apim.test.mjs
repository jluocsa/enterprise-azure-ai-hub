import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { compileScript, parse } from '@vue/compiler-sfc'
import { build } from 'esbuild'
import { createRenderer, nextTick } from 'vue'

const require = createRequire(import.meta.url)
const componentUrl = new URL('../docs/.vitepress/theme/components/ApimPolicyBuilder.vue', import.meta.url)
const { descriptor, errors } = parse(await readFile(componentUrl, 'utf8'))
assert.deepEqual(errors, [])
const compiled = compileScript(descriptor, {
  id: 'studio-apim-test',
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
    name: 'studio-apim-test-runtime',
    setup(builder) {
      builder.onResolve({ filter: /^vue$/ }, () => ({
        path: pathToFileURL(require.resolve('vue/dist/vue.runtime.esm-bundler.js')).href,
        external: true,
      }))
    },
  }],
})
const { default: ApimPolicyBuilder } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)

function mountBuilder() {
  const globals = ['document', 'Document', 'ShadowRoot', 'navigator']
    .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
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
      listeners: {},
      addEventListener(event, handler) { this.listeners[event] = handler },
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
  const app = renderer.createApp(ApimPolicyBuilder)
  app.mount(root)
  const all = () => descendants(root)
  function field(label) {
    const wrapper = all().find(el => el.type === 'label' &&
      el.children.some(child => child.type === 'span' && child.text.startsWith(label)))
    assert.ok(wrapper, `missing field: ${label}`)
    return wrapper.children.find(child => ['INPUT', 'SELECT'].includes(child.tagName))
  }
  return {
    copied, field, all,
    xml: () => all().find(el => el.props.class === 'apim-code')?.children[0]?.text,
    copyButton: () => all().find(el => el.props.class?.includes('apim-copy-btn')),
    async set(label, value) {
      field(label).props['onUpdate:modelValue'](value)
      await nextTick()
    },
    async typeQuota(value) {
      const input = field('Per-Subscription TPM Quota')
      input.value = value
      input.listeners.input({ target: input })
      await nextTick()
    },
    close() {
      app.unmount()
      for (const [key, descriptor] of globals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else delete globalThis[key]
      }
    },
  }
}

const quotaLabel = 'Per-Subscription TPM Quota'
const governanceLabel = 'Emit OTel Token Metrics'

function assertBlocked(builder) {
  assert.equal(builder.xml(), undefined, 'invalid input must hide current and stale XML')
  assert.equal(builder.copyButton().props.disabled, true)
  assert.equal(builder.field(quotaLabel).props['aria-invalid'], true)
  assert.equal(builder.field(quotaLabel).props['aria-describedby'], 'apim-quota-error')
  assert.ok(builder.all().some(el => el.props.role === 'alert' && el.props.id === 'apim-quota-error'))
}

test('invalid TPM quotas hide XML and block even direct copy-handler invocation', async () => {
  const builder = mountBuilder()
  try {
    await builder.copyButton().props.onClick()
    const defaultXml = builder.copied[0]
    assert.match(defaultXml, /tokens-per-minute="450000"/)
    for (const value of [
      '', ' ', 'invalid', '450000', '"><set-body>changed</set-body>',
      NaN, Infinity, -Infinity, 0, -1, 9999, 10000.5, Number.MAX_SAFE_INTEGER + 1, 1e308,
    ]) {
      await builder.set(quotaLabel, value)
      assertBlocked(builder)
      await builder.copyButton().props.onClick()
      assert.equal(builder.copied.length, 1)
      await builder.set(quotaLabel, 450000)
      assert.equal(builder.xml(), defaultXml)
      assert.equal(builder.copyButton().props.disabled, false)
      assert.equal(builder.field(quotaLabel).props['aria-invalid'], false)
      assert.ok(!builder.all().some(el => el.props.role === 'alert'))
    }
    for (const value of ['', '10000.5', '9999']) {
      await builder.typeQuota(value)
      assertBlocked(builder)
    }
    for (const value of ['10000', '10001', '4.5e5', String(Number.MAX_SAFE_INTEGER)]) {
      await builder.typeQuota(value)
      assert.equal(builder.copyButton().props.disabled, false)
      await builder.copyButton().props.onClick()
      assert.match(builder.copied.at(-1), new RegExp(`tokens-per-minute="${Number(value)}"`))
      assert.ok(!/NaN|Infinity/.test(builder.copied.at(-1)))
    }
  } finally { builder.close() }
})

test('hidden quotas are ignored only while governance is disabled, across model and spillover modes', async () => {
  const builder = mountBuilder()
  try {
    await builder.set(quotaLabel, '')
    for (const model of ['gpt-5.6-ptu', 'gpt-6-ptu']) {
      await builder.set('Target Primary PTU-M Regime', model)
      for (const spillover of [false, true]) {
        await builder.set('429 / 503 Spillover', spillover)
        assertBlocked(builder)
        await builder.set(governanceLabel, false)
        assert.equal(builder.copyButton().props.disabled, false)
        assert.ok(!builder.all().some(el => el.props.role === 'alert'))
        await builder.copyButton().props.onClick()
        assert.ok(!builder.copied.at(-1).includes('azure-openai-token-limit'))
        assert.ok(!builder.copied.at(-1).includes('azure-openai-emit-token-metric'))
        await builder.set(governanceLabel, true)
        assertBlocked(builder)
      }
    }
    await builder.set(quotaLabel, 10001)
    await builder.copyButton().props.onClick()
    assert.match(builder.copied.at(-1), /tokens-per-minute="10001"/)
  } finally { builder.close() }
})
