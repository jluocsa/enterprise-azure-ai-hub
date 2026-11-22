#!/usr/bin/env node
/**
 * Enterprise Azure AI Solution Industrialization Hub
 * Built-In Self-Recursive Dual-Agent Daemon (ImproverAgent + ARB ReviewerAgent)
 *
 * Modes:
 *   node scripts/auto-improve-daemon.mjs --watch         # Continuous 24/7 self-driving loop (Windows/macOS/Linux)
 *   node scripts/auto-improve-daemon.mjs --once          # Run Phase A (review open PRs) + 1 full improve+review cycle
 *   node scripts/auto-improve-daemon.mjs --improve-only  # Run 1 improvement proposal cycle without auto-merging
 *   node scripts/auto-improve-daemon.mjs --review-only   # Review, auto-approve, merge & publish open improve/auto-* PRs
 *   node scripts/auto-improve-daemon.mjs --self-test     # Deterministic unit self-tests for guards, ledger & parser
 */

import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SELF = path.resolve(fileURLToPath(import.meta.url))
const ROOT = path.resolve(path.dirname(SELF), '..')
const REPO_SLUG = process.env.HUB_GITHUB_REPO || 'jluocsa/enterprise-azure-ai-hub'
const INTERVAL_MINUTES = Math.max(5, Number(process.env.AUTO_IMPROVE_INTERVAL_MINUTES || 30))

const HUB_TRACKS = [
  { id: 'playbook-01', label: 'Playbook 01 · Prompt Caching & PTU Economics', match: /prompt-caching|ptu|pcr/i },
  { id: 'playbook-02', label: 'Playbook 02 · Multi-Backend APIM AI Gateway', match: /apim|gateway|spillover/i },
  { id: 'playbook-03', label: 'Playbook 03 · Multi-Region Foundry BCP & Failover', match: /bcp|multi-region|failover|residency/i },
  { id: 'playbook-04', label: 'Playbook 04 · Agentic Harness, Foundry IQ RAG & Evals', match: /agentic|rag|eval|arg00/i },
  { id: 'decision-studio', label: 'Interactive Decision Studio (Vue Calculators & Builders)', match: /studio|calculator|builder|advisor|scorecard|\.vue/i },
  { id: 'engineering-kits', label: 'MIT Engineering Kits, Governance Gates & White Papers', match: /kit|paper|governance|link|lint|kql|xml/i },
]

const PROTECTED_EXACT = new Set([
  'scripts/check-sanitized.mjs',
  'scripts/auto-improve-daemon.mjs',
  'scripts/auto-improve-service.mjs',
  'scripts/run-python.mjs',
  'scripts/deploy-gh-pages.mjs',
  'LICENSE',
  '.github/CODEOWNERS',
])

export function checkProtectedFiles(changedPaths) {
  const violations = []
  for (const rel of changedPaths) {
    const norm = rel.replace(/\\/g, '/').replace(/^\.\//, '')
    if (
      PROTECTED_EXACT.has(norm) ||
      norm.startsWith('.github/agents/') ||
      norm.startsWith('.github/workflows/')
    ) {
      violations.push(`Protected governance/workflow path modified: ${norm}`)
    }
  }
  return violations
}

export function rankUnderServedTracks(recentTexts) {
  const scores = new Map(HUB_TRACKS.map(t => [t.id, 0]))
  recentTexts.forEach((txt, idx) => {
    const weight = Math.max(1, recentTexts.length - idx)
    for (const track of HUB_TRACKS) {
      if (track.match.test(String(txt || ''))) {
        scores.set(track.id, (scores.get(track.id) || 0) + weight)
      }
    }
  })
  return [...HUB_TRACKS]
    .sort((a, b) => (scores.get(a.id) || 0) - (scores.get(b.id) || 0))
    .map(t => t.label)
}

export function parseArbVerdict(rawText) {
  const tagMatch = rawText.match(/<arb_verdict>\s*([\s\S]*?)\s*<\/arb_verdict>/i)
  const candidate = tagMatch ? tagMatch[1].trim() : null
  if (!candidate) {
    return {
      verdict: 'REJECT',
      gate1_sanitization: 'UNKNOWN',
      gate2_architecture: 'UNKNOWN',
      gate3_ip_safety: 'UNKNOWN',
      confidence: 0,
      summary: 'Reviewer output did not include a valid <arb_verdict> JSON block.',
      findings: ['Missing <arb_verdict> structured output block.'],
    }
  }
  try {
    const cleaned = candidate.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(cleaned)
    const verdict = String(parsed.verdict || '').toUpperCase() === 'APPROVE' ? 'APPROVE' : 'REJECT'
    return {
      verdict,
      gate1_sanitization: String(parsed.gate1_sanitization || 'PASS'),
      gate2_architecture: String(parsed.gate2_architecture || 'PASS'),
      gate3_ip_safety: String(parsed.gate3_ip_safety || 'PASS'),
      confidence: Number(parsed.confidence ?? 0.9),
      summary: String(parsed.summary || 'Automated ARB review completed.'),
      findings: Array.isArray(parsed.findings) ? parsed.findings.map(String) : [],
    }
  } catch (err) {
    return {
      verdict: 'REJECT',
      gate1_sanitization: 'ERROR',
      gate2_architecture: 'ERROR',
      gate3_ip_safety: 'ERROR',
      confidence: 0,
      summary: `Failed to parse <arb_verdict> JSON: ${err.message}`,
      findings: ['Malformed JSON inside <arb_verdict>.'],
    }
  }
}

function getGitDir() {
  return execFileSync('git', ['-C', ROOT, 'rev-parse', '--absolute-git-dir'], {
    encoding: 'utf8',
    windowsHide: true,
  }).trim()
}

function pathsConfig() {
  const gitDir = getGitDir()
  return {
    gitDir,
    logPath: path.join(gitDir, 'auto-improve.log'),
    statePath: path.join(gitDir, 'auto-improve-state.json'),
    ledgerPath: path.join(gitDir, 'auto-improve-ledger.json'),
    pausePath: path.join(gitDir, 'auto-improve.paused'),
    lockPath: path.join(gitDir, 'auto-improve.lock'),
    worktreesDir: path.join(gitDir, 'auto-improve-worktrees'),
  }
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  if (process.env.HUB_DAEMON_STDIO_LOGGED === '1') return
  try {
    const { logPath } = pathsConfig()
    if (fs.existsSync(logPath) && fs.statSync(logPath).size > 5 * 1024 * 1024) {
      fs.renameSync(logPath, `${logPath}.1`)
    }
    fs.appendFileSync(logPath, `${line}\n`, 'utf8')
  } catch {}
}

function updateState(patch) {
  try {
    const { statePath } = pathsConfig()
    let prev = {}
    if (fs.existsSync(statePath)) {
      try {
        prev = JSON.parse(fs.readFileSync(statePath, 'utf8'))
      } catch {}
    }
    const now = new Date().toISOString()
    const next = {
      ...prev,
      ...patch,
      pid: process.pid,
      platform: process.platform,
      heartbeatAt: now,
      updatedAt: now,
    }
    fs.writeFileSync(statePath, JSON.stringify(next, null, 2), 'utf8')
  } catch {}
}

function readLedger() {
  try {
    const { ledgerPath } = pathsConfig()
    if (fs.existsSync(ledgerPath)) {
      return JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
    }
  } catch {}
  return { entries: [], queuedBacklog: [], rejectedLessons: [] }
}

function recordLedgerUpdate({ mergedPr, rejectedLesson, nextBacklog }) {
  try {
    const { ledgerPath } = pathsConfig()
    const cur = readLedger()
    const entries = Array.isArray(cur.entries) ? cur.entries : []
    let queuedBacklog = Array.isArray(cur.queuedBacklog) ? cur.queuedBacklog : []
    const rejectedLessons = Array.isArray(cur.rejectedLessons) ? cur.rejectedLessons : []

    if (mergedPr) {
      entries.unshift({ ...mergedPr, recordedAt: new Date().toISOString() })
      // Prune completed item if title overlaps
      const lowerTitle = String(mergedPr.title || '').toLowerCase()
      queuedBacklog = queuedBacklog.filter(item => !lowerTitle.includes(String(item).toLowerCase().slice(0, 24)))
    }
    if (Array.isArray(nextBacklog) && nextBacklog.length > 0) {
      const seen = new Set(queuedBacklog.map(s => String(s).trim().toLowerCase()))
      for (const item of nextBacklog) {
        const clean = String(item || '').trim()
        if (clean && !seen.has(clean.toLowerCase())) {
          queuedBacklog.push(clean)
          seen.add(clean.toLowerCase())
        }
      }
    }
    if (rejectedLesson) {
      rejectedLessons.unshift({ ...rejectedLesson, recordedAt: new Date().toISOString() })
    }

    const updated = {
      entries: entries.slice(0, 40),
      queuedBacklog: queuedBacklog.slice(0, 20),
      rejectedLessons: rejectedLessons.slice(0, 12),
      updatedAt: new Date().toISOString(),
    }
    fs.writeFileSync(ledgerPath, JSON.stringify(updated, null, 2), 'utf8')
  } catch {}
}

function appendStepSummary(markdown) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY
  if (!summaryFile) return
  try {
    fs.appendFileSync(summaryFile, `${markdown}\n\n`, 'utf8')
  } catch {}
}

function buildChildEnv(baseEnv = process.env) {
  const envCopy = { ...baseEnv }
  const pathKey = Object.keys(envCopy).find(k => k.toUpperCase() === 'PATH') || 'PATH'
  const rawPath = envCopy[pathKey] || process.env.PATH || process.env.Path || ''
  const extraDirs = [path.dirname(process.execPath)]
  if (process.platform !== 'win32') {
    extraDirs.push('/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin')
  }
  const mergedPath = [...new Set([...extraDirs, ...rawPath.split(path.delimiter).filter(Boolean)])].join(path.delimiter)
  delete envCopy.Path
  delete envCopy.PATH
  envCopy[process.platform === 'win32' ? 'Path' : 'PATH'] = mergedPath
  if (process.platform === 'win32') {
    envCopy.PATH = mergedPath
  }
  envCopy.GIT_TERMINAL_PROMPT = '0'
  envCopy.GCM_INTERACTIVE = 'never'
  envCopy.PYTHONUTF8 = '1'
  envCopy.PYTHONIOENCODING = 'utf-8'
  envCopy.CI = '1'
  return envCopy
}

function runCmd(cmd, args, { cwd = ROOT, env = process.env, timeout = 300000, allowFail = false } = {}) {
  const res = spawnSync(cmd, args, {
    cwd,
    env: buildChildEnv(env),
    encoding: 'utf8',
    timeout,
    windowsHide: true,
    maxBuffer: 30 * 1024 * 1024,
  })
  if (res.error && !allowFail) throw res.error
  if (res.status !== 0 && !allowFail) {
    throw new Error(`${cmd} ${args.join(' ')} exited ${res.status}: ${(res.stderr || res.stdout || '').trim().slice(0, 800)}`)
  }
  return res
}

export function resolveCopilotLoader() {
  const candidates = [
    path.join(ROOT, 'node_modules', '@github', 'copilot', 'npm-loader.js'),
    process.platform === 'win32'
      ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm', 'node_modules', '@github', 'copilot', 'npm-loader.js')
      : '',
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }

  const npmRootCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const globalRoot = spawnSync(npmRootCmd, ['root', '-g'], {
    encoding: 'utf8',
    timeout: 15000,
    windowsHide: true,
    shell: process.platform === 'win32',
  })
  if (globalRoot.status === 0 && globalRoot.stdout) {
    const globalLoader = path.join(globalRoot.stdout.trim(), '@github', 'copilot', 'npm-loader.js')
    if (fs.existsSync(globalLoader)) return globalLoader
  }

  throw new Error('Could not locate @github/copilot/npm-loader.js in local node_modules or global npm root.')
}

function runCopilotAgent(args, options = {}) {
  const loaderJs = resolveCopilotLoader()
  return runCmd(process.execPath, [loaderJs, ...args], options)
}

function runVerifySuite(cwd, { allowFail = false } = {}) {
  const steps = [
    {
      name: 'check:sanitized',
      cmd: process.execPath,
      args: [path.join(cwd, 'scripts', 'check-sanitized.mjs')],
    },
    {
      name: 'check:kits (pcr_lint self-test)',
      cmd: process.execPath,
      args: [path.join(cwd, 'scripts', 'run-python.mjs'), path.join(cwd, 'docs', 'public', 'kits', 'pcr_lint.py'), '--self-test'],
    },
    {
      name: 'check:kits (pcr_lint kits)',
      cmd: process.execPath,
      args: [path.join(cwd, 'scripts', 'run-python.mjs'), path.join(cwd, 'docs', 'public', 'kits', 'pcr_lint.py'), path.join(cwd, 'docs', 'public', 'kits')],
    },
    {
      name: 'check:kits (agent_release_gate self-test)',
      cmd: process.execPath,
      args: [path.join(cwd, 'scripts', 'run-python.mjs'), path.join(cwd, 'docs', 'public', 'kits', 'agent_release_gate.py'), '--self-test'],
    },
    {
      name: 'docs:build',
      cmd: process.execPath,
      args: [path.join(ROOT, 'node_modules', 'vitepress', 'bin', 'vitepress.js'), 'build', 'docs'],
    },
    {
      name: 'check:links (self-test)',
      cmd: process.execPath,
      args: [path.join(cwd, 'scripts', 'run-python.mjs'), path.join(cwd, 'scripts', 'check-links.py'), '--self-test'],
    },
    {
      name: 'check:links (site)',
      cmd: process.execPath,
      args: [path.join(cwd, 'scripts', 'run-python.mjs'), path.join(cwd, 'scripts', 'check-links.py')],
    },
  ]

  const combinedStdout = []
  const combinedStderr = []
  for (const step of steps) {
    const res = runCmd(step.cmd, step.args, { cwd, timeout: 240000, allowFail: true })
    if (res.stdout) combinedStdout.push(`[${step.name}] ${res.stdout.trim()}`)
    if (res.stderr) combinedStderr.push(`[${step.name}] ${res.stderr.trim()}`)
    if (res.status !== 0) {
      const failure = {
        status: res.status || 1,
        stdout: combinedStdout.join('\n'),
        stderr: combinedStderr.join('\n'),
      }
      if (!allowFail) {
        throw new Error(`Verify gate "${step.name}" failed:\n${failure.stderr || failure.stdout}`)
      }
      return failure
    }
  }
  return { status: 0, stdout: combinedStdout.join('\n'), stderr: combinedStderr.join('\n') }
}

function isRemotelyPaused() {
  if (process.env.PAUSE_AUTO_IMPROVE === 'true') return true
  const res = runCmd('gh', ['variable', 'get', 'PAUSE_AUTO_IMPROVE', '-R', REPO_SLUG], {
    allowFail: true,
    timeout: 15000,
  })
  return res.status === 0 && res.stdout.trim().toLowerCase() === 'true'
}

function resolveGhToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN.trim()
  const res = runCmd('gh', ['auth', 'token'])
  return res.stdout.trim()
}

function copyLocalSanitizeList(wtDir) {
  const src = path.join(ROOT, '.sanitize-local.txt')
  const dst = path.join(wtDir, '.sanitize-local.txt')
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst)
  }
}

function cleanTransientFiles(wtDir) {
  for (const name of ['.sanitize-local.txt', '.auto-improve-proposal.json']) {
    const p = path.join(wtDir, name)
    if (fs.existsSync(p)) fs.rmSync(p, { force: true })
  }
}

function unlinkWorktreeNodeModules(wtModules) {
  try {
    const st = fs.lstatSync(wtModules)
    if (st.isSymbolicLink()) {
      fs.unlinkSync(wtModules)
    }
  } catch {}
}

async function withWorktree(setupArgs, fn) {
  const { worktreesDir } = pathsConfig()
  fs.mkdirSync(worktreesDir, { recursive: true })
  runCmd('git', ['-C', ROOT, 'worktree', 'prune'], { allowFail: true })
  runCmd('git', ['-C', ROOT, 'fetch', 'origin', '--prune'])

  const wtDir = path.join(worktreesDir, `wt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
  runCmd('git', ['-C', ROOT, 'worktree', 'add', ...setupArgs(wtDir)])

  // Link node_modules from ROOT ('junction' on Windows requires zero Admin privileges; 'dir' on POSIX)
  const rootModules = path.join(ROOT, 'node_modules')
  const wtModules = path.join(wtDir, 'node_modules')
  if (fs.existsSync(rootModules) && !fs.existsSync(wtModules)) {
    fs.symlinkSync(rootModules, wtModules, process.platform === 'win32' ? 'junction' : 'dir')
  }

  try {
    return await fn(wtDir)
  } finally {
    unlinkWorktreeNodeModules(wtModules)
    runCmd('git', ['-C', ROOT, 'worktree', 'remove', '--force', wtDir], { allowFail: true })
    fs.rmSync(wtDir, { recursive: true, force: true })
  }
}

function syncRootMainIfClean() {
  try {
    const branch = runCmd('git', ['-C', ROOT, 'branch', '--show-current'], { allowFail: true }).stdout.trim()
    const dirty = runCmd('git', ['-C', ROOT, 'status', '--porcelain'], { allowFail: true }).stdout.trim()
    if (branch === 'main' && !dirty) {
      runCmd('git', ['-C', ROOT, 'pull', '--ff-only', 'origin', 'main'], { allowFail: true })
    }
  } catch {}
}

function formatStamp() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

async function deployLatestMainToPages() {
  updateState({ status: 'deploying' })
  log('Publishing merged main build to origin/gh-pages...')
  await withWorktree(
    wtDir => ['--detach', wtDir, 'origin/main'],
    async wtDir => {
      copyLocalSanitizeList(wtDir)
      runCmd(process.execPath, [path.join(wtDir, 'scripts', 'deploy-gh-pages.mjs')], {
        cwd: wtDir,
        timeout: 300000,
      })
    }
  )
  syncRootMainIfClean()
  log('Live GitHub Pages deployment succeeded.')
}

export async function reviewAndPromoteOpenPrs() {
  updateState({ status: 'reviewing' })
  const listRes = runCmd('gh', [
    'pr',
    'list',
    '-R',
    REPO_SLUG,
    '--state',
    'open',
    '--json',
    'number,title,headRefName,isDraft,url',
  ])
  const openPrs = JSON.parse(listRes.stdout || '[]')
    .filter(pr => String(pr.headRefName || '').startsWith('improve/auto-'))
    .sort((a, b) => a.number - b.number)

  if (openPrs.length === 0) {
    log('Phase A: 0 open improve/auto-* PRs awaiting review.')
    return 0
  }

  let mergedCount = 0
  const ghToken = resolveGhToken()

  for (const pr of openPrs) {
    log(`Phase A: Reviewing PR #${pr.number} (${pr.headRefName}) — "${pr.title}"`)
    await withWorktree(
      wtDir => ['-B', pr.headRefName, wtDir, `origin/${pr.headRefName}`],
      async wtDir => {
        // 1. Ensure PR cleanly merges latest origin/main
        const mergeCheck = runCmd('git', ['merge', '--no-edit', 'origin/main'], {
          cwd: wtDir,
          allowFail: true,
        })
        if (mergeCheck.status !== 0) {
          runCmd('git', ['merge', '--abort'], { cwd: wtDir, allowFail: true })
          const msg = `❌ **Autonomous ARB Reviewer Agent — REJECTED (Merge Conflict with \`main\`)**\n\nClosing stale automated branch \`${pr.headRefName}\` so the next cycle starts cleanly from \`origin/main\`.`
          runCmd('gh', ['pr', 'comment', String(pr.number), '-R', REPO_SLUG, '--body', msg], { allowFail: true })
          runCmd('gh', ['pr', 'close', String(pr.number), '-R', REPO_SLUG, '--delete-branch'], { allowFail: true })
          log(`PR #${pr.number} had merge conflict with main; closed cleanly.`)
          return
        }

        // Push updated merge commit if main had advanced
        const aheadMainMerge = runCmd('git', ['rev-parse', 'HEAD'], { cwd: wtDir }).stdout.trim()
        const remoteHead = runCmd('git', ['rev-parse', `origin/${pr.headRefName}`], { cwd: wtDir }).stdout.trim()
        if (aheadMainMerge !== remoteHead) {
          cleanTransientFiles(wtDir)
          runCmd('git', ['push', 'origin', pr.headRefName], { cwd: wtDir })
        }

        // 2. Deterministic Protected-File & Deletion Bounds Gate
        const changedFiles = runCmd('git', ['diff', '--name-only', 'origin/main...HEAD'], { cwd: wtDir })
          .stdout.split(/\r?\n/)
          .map(s => s.trim())
          .filter(Boolean)

        const protViolations = checkProtectedFiles(changedFiles)
        if (changedFiles.length === 0 || protViolations.length > 0) {
          const reason =
            changedFiles.length === 0
              ? 'Zero net file changes against origin/main.'
              : protViolations.join('; ')
          const msg = `❌ **Autonomous ARB Reviewer Agent — REJECTED (Protected Governance Boundary)**\n\n- ${reason}`
          runCmd('gh', ['pr', 'comment', String(pr.number), '-R', REPO_SLUG, '--body', msg], { allowFail: true })
          runCmd('gh', ['pr', 'close', String(pr.number), '-R', REPO_SLUG, '--delete-branch'], { allowFail: true })
          log(`PR #${pr.number} rejected by protected-files check: ${reason}`)
          return
        }

        // 3. Deterministic Full Verify Suite (Gate 1 Sanitization + Gate 2 Kits + Gate 3 VitePress Build + Links)
        copyLocalSanitizeList(wtDir)
        const verifyRes = runVerifySuite(wtDir, { allowFail: true })
        cleanTransientFiles(wtDir)

        if (verifyRes.status !== 0) {
          const errSnippet = `${verifyRes.stdout || ''}\n${verifyRes.stderr || ''}`.trim().slice(-1500)
          const msg = [
            `❌ **Autonomous ARB Reviewer Agent — REJECTED (\`npm run verify\` Failed)**`,
            ``,
            '```text',
            errSnippet,
            '```',
          ].join('\n')
          runCmd('gh', ['pr', 'comment', String(pr.number), '-R', REPO_SLUG, '--body', msg], { allowFail: true })
          runCmd('gh', ['pr', 'close', String(pr.number), '-R', REPO_SLUG, '--delete-branch'], { allowFail: true })
          recordLedgerUpdate({
            rejectedLesson: {
              prNumber: pr.number,
              title: pr.title,
              reason: `Deterministic verify failed: ${errSnippet.slice(-240)}`,
            },
          })
          log(`PR #${pr.number} failed deterministic verify suite; closed.`)
          return
        }

        // 4. Independent Read-Only LLM ARB Review (hub-arb-reviewer)
        const diffText = runCmd('git', ['--no-pager', 'diff', 'origin/main...HEAD'], { cwd: wtDir }).stdout.slice(
          0,
          34000
        )
        const reviewPrompt = [
          `Audit Pull Request #${pr.number} ("${pr.title}") on branch ${pr.headRefName}.`,
          `Changed files (${changedFiles.length}): ${changedFiles.join(', ')}`,
          `Deterministic verify suite (check:sanitized + check:kits + docs:build + check:links) ALREADY PASSED.`,
          `Inspect the diff below (and use read-only view/grep if needed), verify all 3 Hub Pre-Publication Gates, and conclude with your <arb_verdict> JSON block.`,
          ``,
          `--- BEGIN GIT DIFF ---`,
          diffText,
          `--- END GIT DIFF ---`,
        ].join('\n')

        const reviewerRes = runCopilotAgent(
          [
            '-C',
            wtDir,
            '--agent',
            'hub-arb-reviewer',
            '--available-tools',
            'view',
            'grep',
            'glob',
            '--disable-builtin-mcps',
            '-s',
            '-p',
            reviewPrompt,
          ],
          {
            cwd: wtDir,
            env: { ...process.env, GH_TOKEN: ghToken, COPILOT_GITHUB_TOKEN: ghToken },
            timeout: 360000,
            allowFail: true,
          }
        )

        const verdict = parseArbVerdict(reviewerRes.stdout || '')
        const reviewBody = [
          verdict.verdict === 'APPROVE'
            ? `✅ **Autonomous ARB Reviewer Agent — APPROVED FOR MERGE & PUBLISH**`
            : `❌ **Autonomous ARB Reviewer Agent — CHANGES REJECTED**`,
          ``,
          `| Gate | Verdict |`,
          `| :--- | :--- |`,
          `| **Deterministic \`npm run verify\`** | \`PASS\` (Sanitization + Kits + VitePress Build + Links) |`,
          `| **Gate 1 · Sanitization & Governance** | \`${verdict.gate1_sanitization}\` |`,
          `| **Gate 2 · Source & Architecture (\`[M]\`/\`[Arch]\`/\`[Agree]\`)** | \`${verdict.gate2_architecture}\` |`,
          `| **Gate 3 · IP & Prior-Art Safety** | \`${verdict.gate3_ip_safety}\` |`,
          ``,
          `**ARB Summary (Confidence ${(verdict.confidence * 100).toFixed(0)}%):** ${verdict.summary}`,
          ...(verdict.findings.length > 0
            ? ['', '**Findings:**', ...verdict.findings.map(f => `- ${f}`)]
            : []),
        ].join('\n')

        if (verdict.verdict !== 'APPROVE') {
          runCmd('gh', ['pr', 'comment', String(pr.number), '-R', REPO_SLUG, '--body', reviewBody], {
            allowFail: true,
          })
          runCmd('gh', ['pr', 'close', String(pr.number), '-R', REPO_SLUG, '--delete-branch'], {
            allowFail: true,
          })
          let prevRejected = 0
          try {
            prevRejected = JSON.parse(fs.readFileSync(pathsConfig().statePath, 'utf8') || '{}').prsRejected || 0
          } catch {}
          updateState({ prsRejected: prevRejected + 1 })
          recordLedgerUpdate({
            rejectedLesson: {
              prNumber: pr.number,
              title: pr.title,
              reason: verdict.summary,
              findings: verdict.findings,
            },
          })
          log(`PR #${pr.number} rejected by hub-arb-reviewer: ${verdict.summary}`)
          return
        }

        // 5. Post Official GitHub Actions Bot Approval (--approve via AUTO_REVIEWER_GH_TOKEN = secrets.GITHUB_TOKEN)
        const reviewerEnv = process.env.AUTO_REVIEWER_GH_TOKEN
          ? { ...process.env, GH_TOKEN: process.env.AUTO_REVIEWER_GH_TOKEN }
          : process.env

        if (pr.isDraft) {
          runCmd('gh', ['pr', 'ready', String(pr.number), '-R', REPO_SLUG])
        }

        const approveAttempt = runCmd(
          'gh',
          ['pr', 'review', String(pr.number), '-R', REPO_SLUG, '--approve', '--body', reviewBody],
          { env: reviewerEnv, allowFail: true }
        )
        if (approveAttempt.status === 0) {
          log(`Posted official APPROVED review on PR #${pr.number} via reviewer identity.`)
        } else {
          log(`Fallback review comment (${(approveAttempt.stderr || '').trim().slice(0, 120)})`)
          runCmd('gh', ['pr', 'review', String(pr.number), '-R', REPO_SLUG, '--comment', '--body', reviewBody])
        }

        runCmd('gh', ['pr', 'merge', String(pr.number), '-R', REPO_SLUG, '--squash', '--delete-branch'])
        mergedCount++
        log(`✅ PR #${pr.number} approved and squash-merged into main!`)
        recordLedgerUpdate({
          mergedPr: { number: pr.number, title: pr.title, url: pr.url, branch: pr.headRefName },
        })
        appendStepSummary(
          `### ✅ Auto-Approved & Merged PR [#${pr.number}](${pr.url})\n- **Title:** ${pr.title}\n- **Branch:** \`${pr.headRefName}\`\n\n${reviewBody}`
        )
        updateState({
          lastMergedPrUrl: pr.url,
          lastMergedAt: new Date().toISOString(),
        })
      }
    )
  }

  if (mergedCount > 0) {
    await deployLatestMainToPages()
    try {
      const cur = JSON.parse(fs.readFileSync(pathsConfig().statePath, 'utf8'))
      updateState({ prsApprovedAndMerged: (cur.prsApprovedAndMerged || 0) + mergedCount })
    } catch {}
  }

  return mergedCount
}

function buildSelfImprovementBrief() {
  const mergedRes = runCmd(
    'gh',
    ['pr', 'list', '-R', REPO_SLUG, '--state', 'merged', '--limit', '12', '--json', 'number,title,body'],
    { allowFail: true }
  )
  let mergedPrs = []
  try {
    mergedPrs = JSON.parse(mergedRes.stdout || '[]')
  } catch {}

  const closedRes = runCmd(
    'gh',
    ['pr', 'list', '-R', REPO_SLUG, '--state', 'closed', '--limit', '10', '--json', 'number,title,headRefName,mergedAt'],
    { allowFail: true }
  )
  let rejectedPrs = []
  try {
    rejectedPrs = JSON.parse(closedRes.stdout || '[]').filter(
      p => !p.mergedAt && String(p.headRefName || '').startsWith('improve/auto-')
    )
  } catch {}

  const ledger = readLedger()
  const backlogCandidates = [...(ledger.queuedBacklog || [])]
  for (const pr of mergedPrs.slice(0, 5)) {
    const body = String(pr.body || '')
    const secMatch = body.match(/## Queued Next-Cycle Candidates\s+([\s\S]*?)(?:\n## |\s*$)/i)
    if (secMatch) {
      for (const line of secMatch[1].split(/\r?\n/)) {
        const m = line.match(/^-\s+(.+)$/)
        if (m && m[1].trim()) {
          backlogCandidates.push(m[1].trim())
        }
      }
    }
  }

  const dedupedBacklog = []
  const seen = new Set()
  const mergedTitlesLower = mergedPrs.map(p => String(p.title || '').toLowerCase())
  for (const item of backlogCandidates) {
    const key = item.toLowerCase()
    const alreadyDone = mergedTitlesLower.some(t => t.includes(key.slice(0, 22)))
    if (!seen.has(key) && !alreadyDone) {
      seen.add(key)
      dedupedBacklog.push(item)
    }
  }

  const priorityTracks = rankUnderServedTracks(
    mergedPrs.map(p => `${p.title} ${(p.body || '').slice(0, 300)}`)
  )

  const recentLessons = [
    ...(ledger.rejectedLessons || []).slice(0, 4).map(r => `PR #${r.prNumber || '?'} (${r.title}): ${r.reason}`),
    ...rejectedPrs.slice(0, 3).map(r => `Closed unmerged PR #${r.number}: "${r.title}" — avoid repeating without stronger deterministic verification.`),
  ].slice(0, 5)

  return {
    mergedSummary: mergedPrs.map(p => `#${p.number}: ${p.title}`),
    priorityTracks: priorityTracks.slice(0, 3),
    queuedBacklog: dedupedBacklog.slice(0, 6),
    recentLessons,
  }
}

export async function runImprovementCycle() {
  if (isRemotelyPaused()) {
    log('Phase B skipped: PAUSE_AUTO_IMPROVE=true set on GitHub repository variables.')
    updateState({ status: 'paused-remote' })
    return null
  }

  // Single-in-flight guard: do not open a second PR if one is still open
  const openCheck = runCmd(
    'gh',
    ['pr', 'list', '-R', REPO_SLUG, '--state', 'open', '--json', 'number,headRefName'],
    { allowFail: true }
  )
  try {
    const stillOpen = JSON.parse(openCheck.stdout || '[]').filter(p =>
      String(p.headRefName || '').startsWith('improve/auto-')
    )
    if (stillOpen.length > 0) {
      log(`Phase B deferred: open automated PR #${stillOpen[0].number} already exists; awaiting review resolution.`)
      return null
    }
  } catch {}

  updateState({ status: 'improving' })
  const branchName = `improve/auto-${formatStamp()}`
  const ghToken = resolveGhToken()
  const brief = buildSelfImprovementBrief()

  log(`Phase B: Starting self-recursive cycle on branch ${branchName}...`)

  let createdPrNumber = null

  await withWorktree(
    wtDir => ['-b', branchName, wtDir, 'origin/main'],
    async wtDir => {
      copyLocalSanitizeList(wtDir)
      runVerifySuite(wtDir)

      const prompt = [
        `Execute one complete governed self-recursive cycle inside this worktree (branch: ${branchName}).`,
        ``,
        `=== SELF-RECURSIVE MEMORY & PRIORITY BRIEF ===`,
        `Recently merged PRs (do NOT duplicate these):`,
        ...(brief.mergedSummary.length ? brief.mergedSummary.map(s => `  - ${s}`) : ['  - (none)']),
        ``,
        `Top Under-Served Priority Tracks (prefer picking from #1 or #2 for balanced Hub coverage):`,
        ...brief.priorityTracks.map((t, i) => `  ${i + 1}. ${t}`),
        ``,
        ...(brief.queuedBacklog.length
          ? [
              `Queued Backlog Candidates from Prior Cycles (evaluate and pick the highest-ROI item, or discover an even higher-impact gap):`,
              ...brief.queuedBacklog.map(b => `  - ${b}`),
              ``,
            ]
          : []),
        ...(brief.recentLessons.length
          ? [
              `Past ARB Rejection Guardrails (do NOT repeat these failure patterns):`,
              ...brief.recentLessons.map(l => `  - ${l}`),
              ``,
            ]
          : []),
        `=== EXECUTION INSTRUCTIONS ===`,
        `1. Inspect Playbooks 01-04, Decision Studio Vue components, MIT kits (docs/public/kits/), and White Papers.`,
        `2. Select ONE high-ROI, surgical, verifiable improvement (e.g., new deterministic lint/gate rule + self-test, copy-ready Bicep/KQL/Python kit enhancement, interactive Decision Studio calculator capability/preset/export, WCAG 2.2 AA accessibility upgrade, or deeper Microsoft Learn-grounded guidance).`,
        `3. Cross-platform rule: use "node scripts/run-python.mjs" instead of bare "python3" in any package.json script.`,
        `4. Implement cleanly, preserving [M]/[Arch]/[Agree]/[Validate] evidence badges and 100% sanitization.`,
        `5. Run "npm run verify" (and any added self-tests) until exit code is 0.`,
        `6. Write .auto-improve-proposal.json with pr_title, commit_message, track, what_changed, why_high_roi, sources_cited, self_reflection, and next_backlog (2-3 concrete next-cycle candidates).`,
      ].join('\n')

      const agentRes = runCopilotAgent(
        [
          '-C',
          wtDir,
          '--agent',
          'hub-improver',
          '--allow-all-tools',
          '--deny-tool',
          'shell(git push*)',
          '--deny-tool',
          'shell(git commit*)',
          '--deny-tool',
          'shell(gh *)',
          '--deny-tool',
          'write(scripts/check-sanitized.mjs)',
          '--deny-tool',
          'write(scripts/auto-improve*)',
          '--deny-tool',
          'write(scripts/run-python.mjs)',
          '--deny-tool',
          'write(scripts/deploy-gh-pages.mjs)',
          '--deny-tool',
          'write(.github/agents/*)',
          '--deny-tool',
          'write(.github/workflows/*)',
          '--deny-tool',
          'write(LICENSE)',
          '--disable-builtin-mcps',
          '-s',
          '-p',
          prompt,
        ],
        {
          cwd: wtDir,
          env: { ...process.env, GH_TOKEN: ghToken, COPILOT_GITHUB_TOKEN: ghToken },
          timeout: 720000,
          allowFail: true,
        }
      )

      if (agentRes.status !== 0) {
        log(`hub-improver exited ${agentRes.status}; skipping PR creation for this cycle.`)
        return
      }

      let proposal = {
        pr_title: `improve(auto): automated hub enhancement (${branchName})`,
        commit_message: `improve(hub): automated hub enhancement`,
        track: 'Enterprise Azure AI Hub',
        what_changed: ['Applied verified surgical hub improvement.'],
        why_high_roi: 'Continuous governed quality improvement.',
        sources_cited: ['https://learn.microsoft.com/en-us/azure/foundry/'],
        self_reflection: 'Verified clean across all deterministic sanitization, kit, build, and link gates.',
        next_backlog: [],
      }

      const proposalPath = path.join(wtDir, '.auto-improve-proposal.json')
      if (fs.existsSync(proposalPath)) {
        try {
          proposal = { ...proposal, ...JSON.parse(fs.readFileSync(proposalPath, 'utf8')) }
        } catch {}
      }

      // Independent outer verification before staging
      copyLocalSanitizeList(wtDir)
      const outerVerify = runVerifySuite(wtDir, { allowFail: true })
      cleanTransientFiles(wtDir)

      if (outerVerify.status !== 0) {
        log(`Outer deterministic verify suite failed on ${branchName}; discarding cycle changes.`)
        return
      }

      // Remove linked node_modules before git status/add check
      unlinkWorktreeNodeModules(path.join(wtDir, 'node_modules'))

      const statusOut = runCmd('git', ['status', '--porcelain'], { cwd: wtDir }).stdout.trim()
      if (!statusOut) {
        log(`No file changes produced on ${branchName}; skipping PR.`)
        return
      }

      runCmd('git', ['add', '-A'], { cwd: wtDir })
      const stagedFiles = runCmd('git', ['diff', '--cached', '--name-only'], { cwd: wtDir })
        .stdout.split(/\r?\n/)
        .map(s => s.trim())
        .filter(Boolean)

      const protErrs = checkProtectedFiles(stagedFiles)
      if (protErrs.length > 0) {
        log(`Aborting commit: protected file touched (${protErrs.join(', ')})`)
        return
      }

      const prTitle = String(proposal.pr_title || '').startsWith('improve(auto):')
        ? proposal.pr_title
        : `improve(auto): ${proposal.pr_title}`

      const fullCommitMsg = `${proposal.commit_message}\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`
      runCmd('git', ['commit', '-m', fullCommitMsg], { cwd: wtDir })
      runCmd('git', ['push', '-u', 'origin', branchName], { cwd: wtDir })

      recordLedgerUpdate({ nextBacklog: proposal.next_backlog })

      const prBody = [
        `## Summary of Architecture Pattern / Playbook Update`,
        ``,
        `- **Track:** \`${proposal.track}\``,
        `- **Branch:** \`${branchName}\``,
        `- **Engineering Impact:** ${proposal.why_high_roi}`,
        ...(proposal.self_reflection ? [`- **Verification Reflection:** ${proposal.self_reflection}`] : []),
        ``,
        `## What Changed`,
        ...(proposal.what_changed || []).map(item => `- ${item}`),
        ``,
        ...(proposal.sources_cited?.length
          ? [`## Authoritative Sources`, ...proposal.sources_cited.map(s => `- ${s}`), ``]
          : []),
        `## Mandatory 3-Gate Pre-Publication Attestation`,
        `- [x] **Gate 1 — Sanitization (\`npm run check:sanitized\`):** Verified clean.`,
        `- [x] **Gate 2 — Source & Kit Verification (\`npm run check:kits\`):** Verified clean.`,
        `- [x] **Gate 3 — Production Build & Link Check (\`npm run docs:build && npm run check:links\`):** Verified clean.`,
        ...(proposal.next_backlog?.length
          ? [``, `## Queued Next-Cycle Candidates`, ...proposal.next_backlog.map(b => `- ${b}`)]
          : []),
      ].join('\n')

      const prOut = runCmd(
        'gh',
        [
          'pr',
          'create',
          '--repo',
          REPO_SLUG,
          '--base',
          'main',
          '--head',
          branchName,
          '--draft',
          '--title',
          prTitle,
          '--body',
          prBody,
        ],
        { cwd: wtDir }
      ).stdout.trim()

      const m = prOut.match(/\/pull\/(\d+)/)
      createdPrNumber = m ? Number(m[1]) : null
      log(`Opened Draft PR: ${prOut}`)
      appendStepSummary(
        `### 🚀 Opened Candidate PR [${prOut}](${prOut})\n- **Title:** ${prTitle}\n- **Track:** \`${proposal.track}\`\n- **Impact:** ${proposal.why_high_roi}`
      )
    }
  )

  return createdPrNumber
}

function acquireLock() {
  const { lockPath } = pathsConfig()
  if (fs.existsSync(lockPath)) {
    const existingPid = Number(fs.readFileSync(lockPath, 'utf8').trim())
    if (existingPid && existingPid !== process.pid) {
      try {
        process.kill(existingPid, 0)
        throw new Error(`Another auto-improve-daemon instance is already running (PID ${existingPid}).`)
      } catch (err) {
        if (err.code !== 'ESRCH') throw err
      }
    }
  }
  fs.writeFileSync(lockPath, `${process.pid}\n`, 'utf8')
  const cleanup = () => {
    try {
      if (fs.existsSync(lockPath) && Number(fs.readFileSync(lockPath, 'utf8').trim()) === process.pid) {
        fs.unlinkSync(lockPath)
      }
    } catch {}
  }
  process.on('exit', cleanup)
  process.on('SIGINT', () => {
    cleanup()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    cleanup()
    process.exit(0)
  })
}

async function sleepResponsive(ms) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    updateState({})
    await new Promise(r => setTimeout(r, Math.min(15000, Math.max(1000, end - Date.now()))))
  }
}

function runSelfTest() {
  const v1 = checkProtectedFiles(['docs/index.md', 'docs/public/kits/pcr_lint.py'])
  if (v1.length !== 0) throw new Error(`Expected clean paths to pass, got ${v1}`)

  const v2 = checkProtectedFiles([
    'scripts/check-sanitized.mjs',
    'scripts/auto-improve-service.mjs',
    'scripts/run-python.mjs',
    '.github/agents/hub-arb-reviewer.agent.md',
  ])
  if (v2.length !== 4) throw new Error(`Expected 4 protected violations, got ${v2.length}`)

  const parsedOk = parseArbVerdict(
    'Review notes...\n<arb_verdict>\n{"verdict":"APPROVE","gate1_sanitization":"PASS","gate2_architecture":"PASS","gate3_ip_safety":"PASS","confidence":0.98,"summary":"Clean surgical improvement.","findings":[]}\n</arb_verdict>'
  )
  if (parsedOk.verdict !== 'APPROVE') throw new Error('Expected APPROVE verdict')

  const parsedMissing = parseArbVerdict('No tags emitted')
  if (parsedMissing.verdict !== 'REJECT') throw new Error('Expected REJECT when tags missing')

  const ranked = rankUnderServedTracks(['improve(auto): update prompt-caching ptu math', 'improve(auto): apim spillover'])
  if (ranked.length !== HUB_TRACKS.length || ranked[ranked.length - 1].includes('BCP')) {
    throw new Error(`Unexpected track ranking order: ${ranked.join(' | ')}`)
  }

  const loaderPath = resolveCopilotLoader()
  if (!fs.existsSync(loaderPath)) {
    throw new Error(`Resolved copilot loader does not exist: ${loaderPath}`)
  }

  console.log('✅ auto-improve-daemon.mjs self-test PASSED (protected paths, ARB verdict parser, track balancer & copilot loader verified).')
}

async function main() {
  const mode = process.argv[2] || '--once'
  if (mode === '--self-test') {
    runSelfTest()
    return
  }

  acquireLock()
  const heartbeatTimer = setInterval(() => updateState({}), 30000)
  heartbeatTimer.unref()

  updateState({
    startedAt: new Date().toISOString(),
    mode,
    intervalMinutes: INTERVAL_MINUTES,
    status: 'starting',
    consecutiveFailures: 0,
    lastError: null,
  })

  if (mode === '--review-only') {
    await reviewAndPromoteOpenPrs()
    updateState({ status: 'idle', lastCycleAt: new Date().toISOString() })
    return
  }

  if (mode === '--improve-only') {
    await runImprovementCycle()
    updateState({ status: 'idle', lastCycleAt: new Date().toISOString() })
    return
  }

  if (mode === '--once') {
    await reviewAndPromoteOpenPrs()
    await runImprovementCycle()
    await reviewAndPromoteOpenPrs()
    updateState({ status: 'idle', lastCycleAt: new Date().toISOString() })
    return
  }

  if (mode === '--watch') {
    log(`Starting continuous self-recursive daemon (interval=${INTERVAL_MINUTES}m, platform=${process.platform}, repo=${REPO_SLUG})...`)
    let consecutiveFailures = 0
    while (true) {
      const { pausePath, statePath } = pathsConfig()
      if (fs.existsSync(pausePath)) {
        updateState({ status: 'paused' })
        await sleepResponsive(15000)
        continue
      }

      try {
        await reviewAndPromoteOpenPrs()
        if (!fs.existsSync(pausePath)) {
          await runImprovementCycle()
          await reviewAndPromoteOpenPrs()
        }
        consecutiveFailures = 0
        let completed = 1
        try {
          completed = (JSON.parse(fs.readFileSync(statePath, 'utf8')).cyclesCompleted || 0) + 1
        } catch {}
        const waitMs = INTERVAL_MINUTES * 60 * 1000
        updateState({
          status: 'sleeping',
          cyclesCompleted: completed,
          consecutiveFailures: 0,
          lastCycleAt: new Date().toISOString(),
          nextCycleAt: new Date(Date.now() + waitMs).toISOString(),
          lastError: null,
        })
        log(`Cycle #${completed} complete. Sleeping ${INTERVAL_MINUTES} minutes until next cycle...`)
        await sleepResponsive(waitMs)
      } catch (err) {
        consecutiveFailures++
        const backoffMinutes = Math.min(60, Math.max(5, consecutiveFailures * 5))
        log(`ERROR in continuous cycle (#${consecutiveFailures}): ${err.message}. Backing off ${backoffMinutes}m...`)
        updateState({
          status: 'error-backoff',
          consecutiveFailures,
          lastError: err.message,
          nextCycleAt: new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString(),
        })
        await sleepResponsive(backoffMinutes * 60 * 1000)
      }
    }
  } else {
    throw new Error(`Unknown mode '${mode}'. Use --watch, --once, --improve-only, --review-only, or --self-test.`)
  }
}

if (path.resolve(process.argv[1] || '') === SELF) {
  main().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
