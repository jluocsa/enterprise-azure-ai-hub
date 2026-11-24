import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { compileScript, parse } from '@vue/compiler-sfc'
import { build } from 'esbuild'
import { createRenderer, nextTick } from 'vue'

// Compile the real SFC with existing VitePress dependencies; isolate calculator
// children and routing so these offline tests exercise only the tabs contract.
const require = createRequire(import.meta.url)
const componentUrl = new URL('../docs/.vitepress/theme/components/StudioSuite.vue', import.meta.url)
const source = await readFile(componentUrl, 'utf8')
const { descriptor, errors } = parse(source)
assert.deepEqual(errors, [])
const compiled = compileScript(descriptor, {
  id: 'studio-tabs-test',
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
    name: 'studio-test-isolation',
    setup(builder) {
      builder.onResolve({ filter: /^vue$/ }, () => ({
        path: pathToFileURL(require.resolve('vue/dist/vue.runtime.esm-bundler.js')).href,
        external: true,
      }))
      builder.onResolve({ filter: /^vitepress$|\.vue$/ }, args => ({ path: args.path, namespace: 'stub' }))
      builder.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({
        contents: args.path === 'vitepress'
          ? 'export const useRoute = () => ({ path: "/studio/" }); export const withBase = path => path;'
          : 'export default { render() { return null } };',
      }))
    },
  }],
})
const { default: StudioSuite } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)

function mountStudio(hash = '') {
  let focused = null
  const listeners = new Map()
  const browser = {
    location: { hash },
    history: { replaceState(_state, _title, nextHash) { browser.location.hash = nextHash } },
    addEventListener(name, handler) { listeners.set(name, handler) },
    removeEventListener(name, handler) {
      assert.equal(listeners.get(name), handler)
      listeners.delete(name)
    },
  }
  globalThis.window = browser
  function descendants(node) {
    return node.children.flatMap(child => [child, ...descendants(child)])
  }
  function node(type, text = '') {
    return {
      type, text, props: {}, children: [], parent: null, style: { display: '' },
      querySelector(selector) { return descendants(this).find(child => `#${child.props.id}` === selector) },
      focus() {
        focused = this
        this.props.onFocus?.()
      },
    }
  }
  const renderer = createRenderer({
    createElement: type => node(type),
    createText: text => node('text', text),
    createComment: text => node('comment', text),
    setText(el, text) { el.text = text },
    setElementText(el, text) { el.text = text },
    patchProp(el, key, _previous, value) { el.props[key] = value },
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
  const app = renderer.createApp(StudioSuite)
  app.mount(root)
  const all = () => descendants(root)
  return {
    browser, listeners, app,
    tabs: () => all().filter(el => el.props.role === 'tab'),
    panels: () => all().filter(el => el.props.role === 'tabpanel'),
    focused: () => focused,
    async key(id, key) {
      let prevented = false
      this.tabs().find(el => el.props.id === id).props.onKeydown({
        key, preventDefault() { prevented = true },
      })
      await nextTick()
      return prevented
    },
    async hashchange(nextHash) {
      browser.location.hash = nextHash
      listeners.get('hashchange')()
      await nextTick()
    },
    close() {
      app.unmount()
      delete globalThis.window
    },
  }
}

function assertActive(studio, id) {
  const tabs = studio.tabs()
  assert.equal(tabs.length, 6)
  assert.deepEqual(tabs.filter(tab => tab.props.tabindex === 0).map(tab => tab.props.id), [id])
  assert.deepEqual(tabs.filter(tab => tab.props['aria-selected']).map(tab => tab.props.id), [id])
  for (const tab of tabs) {
    assert.equal(tab.props.tabindex, tab.props.id === id ? 0 : -1)
    const panel = studio.panels().find(el => el.props.id === tab.props['aria-controls'])
    assert.ok(panel, 'every tab controls a mounted panel')
    assert.equal(panel.props['aria-labelledby'], tab.props.id)
    assert.equal(panel.props.tabindex, '0')
    assert.equal(panel.style.display === 'none', tab.props.id !== id)
  }
}

test('default and deep-linked tabs have reciprocal panel semantics and one tab stop', async () => {
  for (const id of ['', 'ptu', 'apim', 'bcp', 'agent-eval', 'data-strategy', 'triage', 'unknown']) {
    const studio = mountStudio(id ? `#${id}` : '')
    try {
      await nextTick()
      assertActive(studio, ['', 'unknown'].includes(id) ? 'ptu' : id)
      assert.equal(studio.focused(), null, 'loading a deep link must not steal focus')
    } finally { studio.close() }
  }
})

test('arrows follow visual order with wrapping; Home and End move focus and selection', async () => {
  const studio = mountStudio()
  try {
    const panels = studio.panels()
    for (const [from, key, to] of [
      ['ptu', 'ArrowRight', 'apim'],
      ['apim', 'ArrowRight', 'bcp'],
      ['bcp', 'ArrowRight', 'agent-eval'],
      ['agent-eval', 'ArrowRight', 'data-strategy'],
      ['data-strategy', 'ArrowRight', 'triage'],
      ['triage', 'ArrowRight', 'ptu'],
      ['ptu', 'ArrowLeft', 'triage'],
      ['triage', 'ArrowLeft', 'data-strategy'],
      ['data-strategy', 'ArrowLeft', 'agent-eval'],
      ['agent-eval', 'ArrowLeft', 'bcp'],
      ['bcp', 'ArrowLeft', 'apim'],
      ['apim', 'ArrowLeft', 'ptu'],
      ['ptu', 'End', 'triage'],
      ['triage', 'Home', 'ptu'],
    ]) {
      assert.equal(await studio.key(from, key), true)
      assertActive(studio, to)
      assert.equal(studio.focused().props.id, to)
      assert.equal(studio.browser.location.hash, `#${to}`)
      assert.deepEqual(studio.panels(), panels, 'switching must preserve mounted calculator panels')
    }
  } finally { studio.close() }
})

test('scrolling and native activation keys are not intercepted', async () => {
  const studio = mountStudio()
  try {
    for (const key of ['ArrowUp', 'ArrowDown', 'Tab', 'Enter', ' ', 'Escape']) {
      assert.equal(await studio.key('ptu', key), false)
      assertActive(studio, 'ptu')
      assert.equal(studio.focused(), null)
    }
    studio.tabs().find(el => el.props.id === 'apim').props.onClick()
    await nextTick()
    assertActive(studio, 'apim')
    assert.equal(studio.browser.location.hash, '#apim')
    studio.tabs().find(el => el.props.id === 'bcp').focus()
    await nextTick()
    assertActive(studio, 'bcp')
    assert.equal(studio.browser.location.hash, '#bcp')
  } finally { studio.close() }
})

test('hash changes update semantics without moving focus; unmount removes the listener', async () => {
  const studio = mountStudio()
  try {
    studio.tabs()[0].focus()
    await studio.hashchange('#agent-eval')
    assertActive(studio, 'agent-eval')
    assert.equal(studio.focused().props.id, 'ptu')
    await studio.hashchange('#unknown')
    assertActive(studio, 'agent-eval')
    await studio.hashchange('#triage')
    assertActive(studio, 'triage')
  } finally { studio.close() }
  assert.equal(studio.listeners.size, 0)
})
