import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { compileScript, parse } from '@vue/compiler-sfc'
import { build } from 'esbuild'
import { createRenderer, nextTick } from 'vue'

const require = createRequire(import.meta.url)
const componentUrl = new URL('../docs/.vitepress/theme/components/BcpResidencyAdvisor.vue', import.meta.url)
const { descriptor, errors } = parse(await readFile(componentUrl, 'utf8'))
assert.deepEqual(errors, [])
const compiled = compileScript(descriptor, {
  id: 'studio-bcp-test',
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
    name: 'studio-bcp-test-runtime',
    setup(builder) {
      builder.onResolve({ filter: /^vue$/ }, () => ({
        path: pathToFileURL(require.resolve('vue/dist/vue.runtime.esm-bundler.js')).href,
        external: true,
      }))
    },
  }],
})
const { default: BcpResidencyAdvisor } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)

function mountAdvisor() {
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
  const app = renderer.createApp(BcpResidencyAdvisor)
  app.mount(root)
  const all = () => descendants(root)
  function field(label) {
    const wrapper = all().find(el => el.type === 'label' &&
      el.children.some(child => child.type === 'span' && child.text.includes(label)))
    assert.ok(wrapper, `missing field: ${label}`)
    return wrapper.children.find(child => ['INPUT', 'SELECT'].includes(child.tagName))
  }
  return {
    copied, all, field,
    text: () => all().map(el => el.text).join(' '),
    copyButton: () => all().find(el => el.props.class?.includes('bcp-copy-btn')),
    async set(label, value) {
      field(label).props['onUpdate:modelValue'](value)
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

test('invalid BCP numbers hide stale plans, expose field errors, and block direct exports', async () => {
  const advisor = mountAdvisor()
  try {
    for (const [label, invalid, restored] of [
      ['Primary Steady Allocation', ['', ' ', 'invalid', '170', NaN, Infinity, -Infinity, -5, 0, 14, 16, 17.5, 1e308, Number.MAX_SAFE_INTEGER], 170],
      ['Primary Steady Cached Share', ['', ' ', 'invalid', '80', NaN, Infinity, -Infinity, -1, 95.1], 80],
    ]) {
      for (const value of invalid) {
        await advisor.set(label, value)
        assert.equal(advisor.copyButton().props.disabled, true)
        assert.ok(advisor.all().some(el => el.props.role === 'alert' && el.props.id === 'bcp-input-errors'))
        assert.equal(advisor.field(label).props['aria-invalid'], true)
        assert.equal(advisor.field(label).props['aria-describedby'], 'bcp-input-errors')
        assert.ok(!advisor.all().some(el => ['bcp-metrics', 'bcp-summary'].includes(el.props.class)))
        await advisor.copyButton().props.onClick()
        assert.deepEqual(advisor.copied, [])
        await advisor.set(label, restored)
        assert.equal(advisor.copyButton().props.disabled, false)
        assert.equal(advisor.field(label).props['aria-invalid'], false)
        assert.equal(advisor.field(label).props['aria-describedby'], undefined)
        assert.ok(!advisor.all().some(el => el.props.role === 'alert'))
      }
    }
  } finally { advisor.close() }
})

test('valid BCP defaults, boundaries, and all capacity postures preserve displayed/exported math', async () => {
  const advisor = mountAdvisor()
  try {
    assert.match(advisor.text(), /2\.36/)
    assert.match(advisor.text(), /405 PTU-equiv/)
    for (const [posture, region, secondary, total, multiplier] of [
      ['active-passive-payg', 'global', 0, 170, '1.00'],
      ['active-passive-minptu', 'datazone', 15, 185, '1.09'],
      ['active-passive-minptu', 'regional', 25, 195, '1.15'],
      ['active-active', 'regional', 170, 340, '2.00'],
    ]) {
      await advisor.set('Secondary Stamp Capacity', posture)
      await advisor.set('Regulatory Data-Processing', region)
      assert.match(advisor.text(), new RegExp(`${total} PTUs`))
      await advisor.copyButton().props.onClick()
      assert.ok(advisor.copied.at(-1).includes(`Primary \`170 PTUs\` · Secondary Reserved \`${secondary} PTUs\` (${multiplier}×`))
    }
    await advisor.set('Primary Steady Allocation', 15)
    for (const hit of [0, 80.5, 95]) {
      await advisor.set('Primary Steady Cached Share', hit)
      assert.equal(advisor.copyButton().props.disabled, false)
      await advisor.copyButton().props.onClick()
      assert.ok(advisor.copied.at(-1).includes(`to ${hit}%`))
      assert.ok(!/NaN|Infinity/.test(advisor.copied.at(-1)))
    }
  } finally { advisor.close() }
})

test('safe input capacity cannot overflow surge or active-active totals; reducing inputs recovers', async () => {
  const advisor = mountAdvisor()
  try {
    await advisor.set('Primary Steady Cached Share', 95)
    await advisor.set('Primary Steady Allocation', 5000000000000000)
    assert.equal(advisor.copyButton().props.disabled, true, 'surge exceeds safe integer arithmetic')
    await advisor.copyButton().props.onClick()
    assert.deepEqual(advisor.copied, [])
    await advisor.set('Primary Steady Cached Share', 0)
    assert.equal(advisor.copyButton().props.disabled, false)
    await advisor.set('Secondary Stamp Capacity', 'active-active')
    assert.equal(advisor.copyButton().props.disabled, true, 'combined reservations exceed safe integer arithmetic')
    await advisor.copyButton().props.onClick()
    assert.deepEqual(advisor.copied, [])
    await advisor.set('Primary Steady Allocation', 170)
    assert.equal(advisor.copyButton().props.disabled, false)
    await advisor.copyButton().props.onClick()
    assert.match(advisor.text(), /340 PTUs/)
    assert.match(advisor.copied.at(-1), /~170 PTU-equiv/)
  } finally { advisor.close() }
})
