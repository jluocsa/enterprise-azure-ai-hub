#!/usr/bin/env node
/**
 * Cross-platform Python 3 launcher for Enterprise Azure AI Hub verification gates.
 * Automatically skips broken Windows Store execution aliases (`WindowsApps\python3.exe`)
 * and enforces UTF-8 stdio across Windows, macOS, and Linux.
 *
 * Usage:
 *   node scripts/run-python.mjs <script.py> [args...]
 *   node scripts/run-python.mjs --self-test
 */

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SELF = path.resolve(fileURLToPath(import.meta.url))

export function resolvePython3Command() {
  const candidates = []
  if (process.env.PYTHON) {
    candidates.push({ cmd: process.env.PYTHON, prefixArgs: [] })
  }
  if (process.platform === 'win32') {
    candidates.push(
      { cmd: 'python', prefixArgs: [] },
      { cmd: 'py', prefixArgs: ['-3'] },
      { cmd: 'python3', prefixArgs: [] }
    )
  } else {
    candidates.push(
      { cmd: 'python3', prefixArgs: [] },
      { cmd: 'python', prefixArgs: [] }
    )
  }

  for (const candidate of candidates) {
    const probe = spawnSync(
      candidate.cmd,
      [...candidate.prefixArgs, '-c', 'import sys; assert sys.version_info[0] >= 3; print(sys.executable)'],
      {
        encoding: 'utf8',
        timeout: 10000,
        windowsHide: true,
        env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
      }
    )
    const exe = (probe.stdout || '').trim()
    if (!probe.error && probe.status === 0 && exe && !exe.includes('WindowsApps')) {
      return { ...candidate, executable: exe }
    }
  }

  throw new Error('Could not locate a working Python 3 interpreter on PATH (checked python3, python, py -3).')
}

function main() {
  const args = process.argv.slice(2)
  const resolved = resolvePython3Command()

  if (args[0] === '--self-test') {
    const check = spawnSync(
      resolved.cmd,
      [...resolved.prefixArgs, '-c', 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")'],
      {
        encoding: 'utf8',
        timeout: 10000,
        windowsHide: true,
        env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
      }
    )
    if (check.status !== 0) {
      console.error('run-python.mjs self-test FAILED.')
      process.exit(1)
    }
    console.log(`✅ run-python.mjs self-test PASSED (Python ${(check.stdout || '').trim()} -> ${resolved.executable}).`)
    return
  }

  if (args.length === 0) {
    console.error('Usage: node scripts/run-python.mjs <script.py> [args...] | --self-test')
    process.exit(1)
  }

  const res = spawnSync(resolved.cmd, [...resolved.prefixArgs, ...args], {
    stdio: 'inherit',
    windowsHide: true,
    env: {
      ...process.env,
      PYTHONUTF8: '1',
      PYTHONIOENCODING: 'utf-8',
    },
  })

  if (res.error) {
    console.error(`Failed to execute Python (${resolved.cmd}): ${res.error.message}`)
    process.exit(1)
  }
  process.exit(res.status ?? 1)
}

if (path.resolve(process.argv[1] || '') === SELF) {
  main()
}
