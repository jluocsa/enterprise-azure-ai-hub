import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const DOCS_DIR = path.join(ROOT, 'docs')

const bundle = await build({
  entryPoints: [path.join(DOCS_DIR, '.vitepress', 'theme', 'verifiedStamp.ts')],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
})

const { formatPacificTimestamp, resolveVerifiedStamp } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
)

test('formatPacificTimestamp always includes YYYY-MM-DD HH:MM and Pacific zone across PST and PDT', () => {
  // 2026-11-21T19:26:00Z === 2026-11-21 11:26 PST
  const pstMs = Date.UTC(2026, 10, 21, 19, 26, 0)
  assert.equal(formatPacificTimestamp(pstMs), '2026-11-21 11:26 PST')

  // 2026-07-15T07:05:00Z === 2026-07-15 00:05 PDT (midnight hour uses 00, never 24)
  const pdtMs = Date.UTC(2026, 6, 15, 7, 5, 0)
  assert.equal(formatPacificTimestamp(pdtMs), '2026-07-15 00:05 PDT')
})

test('resolveVerifiedStamp preserves explicit HH:MM stamps and upgrades missing or date-only stamps', () => {
  const pageData = { verifiedStamp: '2026-11-21 11:26 PST' }

  assert.equal(resolveVerifiedStamp(undefined, pageData), '2026-11-21 11:26 PST')
  assert.equal(resolveVerifiedStamp('', pageData), '2026-11-21 11:26 PST')
  assert.equal(resolveVerifiedStamp('2026-11-19 PST', pageData), '2026-11-21 11:26 PST')
  assert.equal(resolveVerifiedStamp('2026-11-19', pageData), '2026-11-21 11:26 PST')
  assert.equal(
    resolveVerifiedStamp('2026-11-18 21:21 PST', pageData),
    '2026-11-18 21:21 PST'
  )
})

test('docs contain no date-only PST/PDT badges missing an HH:MM timestamp', () => {
  const missingTimeRe = /\b\d{4}-\d{2}-\d{2}\s+P[SD]T\b/g
  const violations = []

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'dist' || entry.name === 'cache' || entry.name === '.vitepress-cache') {
        continue
      }
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (/\.(md|vue|ts|mts)$/.test(entry.name)) {
        const text = fs.readFileSync(full, 'utf8')
        for (const match of text.matchAll(missingTimeRe)) {
          violations.push(`${path.relative(ROOT, full)}: "${match[0]}"`)
        }
      }
    }
  }

  walk(DOCS_DIR)
  assert.deepEqual(violations, [])
})
