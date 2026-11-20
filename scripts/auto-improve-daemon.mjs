#!/usr/bin/env node
/**
 * Enterprise Azure AI Solution Industrialization Hub
 * Autonomous Continuous Dual-Agent Pipeline (ImproverAgent + ARB ReviewerAgent)
 *
 * Modes:
 *   node scripts/auto-improve-daemon.mjs --watch         # Continuous 24/7 loop (used by LaunchAgent)
 *   node scripts/auto-improve-daemon.mjs --once          # Run Phase A (review open PRs) + 1 full improve+review cycle
 *   node scripts/auto-improve-daemon.mjs --review-only   # Review, auto-approve, merge & publish open improve/auto-* PRs
 *   node scripts/auto-improve-daemon.mjs --self-test     # Deterministic unit self-tests for guards & verdict parser
 */

import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SELF = path.resolve(fileURLToPath(import.meta.url))
const ROOT = path.resolve(path.dirname(SELF), '..')
const REPO_SLUG = process.env.HUB_GITHUB_REPO || 'jluocsa/enterprise-azure-ai-hub'
const INTERVAL_MINUTES = Math.max(5, Number(process.env.AUTO_IMPROVE_INTERVAL_MINUTES || 30))
const COPILOT_BIN = path.join(ROOT, 'node_modules', '.bin', 'copilot')

const PROTECTED_EXACT = new Set([
  'scripts/check-sanitized.mjs',
  'scripts/auto-improve-daemon.mjs',
  'scripts/auto-improve-service.mjs',
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
  return execFileSync('git', ['-C', ROOT, 'rev-parse', '--absolute-git-dir'], { encoding: 'utf8' }).trim()
}

function pathsConfig() {
  const gitDir = getGitDir()
  return {
    gitDir,
    logPath: path.join(gitDir, 'auto-improve.log'),
    statePath: path.join(gitDir, 'auto-improve-state.json'),
    pausePath: path.join(gitDir, 'auto-improve.paused'),
    lockPath: path.join(gitDir, 'auto-improve.lock'),
    worktreesDir: path.join(gitDir, 'auto-improve-worktrees'),
  }
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
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
    const next = {
      ...prev,
      ...patch,
      pid: process.pid,
      updatedAt: new Date().toISOString(),
    }
    fs.writeFileSync(statePath, JSON.stringify(next, null, 2), 'utf8')
  } catch {}
}

function appendStepSummary(markdown) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY
  if (!summaryFile) return
  try {
    fs.appendFileSync(summaryFile, `${markdown}\n\n`, 'utf8')
  } catch {}
}

function runCmd(cmd, args, { cwd = ROOT, env = process.env, timeout = 300000, allowFail = false } = {}) {
  const enrichedPath = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    env.PATH || process.env.PATH || '/usr/bin:/bin',
  ].join(':')
  const res = spawnSync(cmd, args, {
    cwd,
    env: {
      ...env,
      PATH: enrichedPath,
      GIT_TERMINAL_PROMPT: '0',
      CI: '1',
    },
    encoding: 'utf8',
    timeout,
    maxBuffer: 30 * 1024 * 1024,
  })
  if (res.error && !allowFail) throw res.error
  if (res.status !== 0 && !allowFail) {
    throw new Error(`${cmd} ${args.join(' ')} exited ${res.status}: ${(res.stderr || res.stdout || '').trim().slice(0, 800)}`)
  }
  return res
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

async function withWorktree(setupArgs, fn) {
  const { worktreesDir } = pathsConfig()
  fs.mkdirSync(worktreesDir, { recursive: true })
  runCmd('git', ['-C', ROOT, 'worktree', 'prune'], { allowFail: true })
  runCmd('git', ['-C', ROOT, 'fetch', 'origin', '--prune'])

  const wtDir = path.join(worktreesDir, `wt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
  runCmd('git', ['-C', ROOT, 'worktree', 'add', ...setupArgs(wtDir)])

  // Symlink node_modules from ROOT so VitePress builds run in ~3s with zero network download
  const rootModules = path.join(ROOT, 'node_modules')
  const wtModules = path.join(wtDir, 'node_modules')
  if (fs.existsSync(rootModules) && !fs.existsSync(wtModules)) {
    fs.symlinkSync(rootModules, wtModules, 'dir')
  }

  try {
    return await fn(wtDir)
  } finally {
    try {
      const st = fs.lstatSync(wtModules)
      if (st.isSymbolicLink()) fs.unlinkSync(wtModules)
    } catch {}
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

        // 3. Deterministic Full Verify Suite (Gate 1 Sanitization + Gate 2 Kits + Gate 3 VitePress Build)
        copyLocalSanitizeList(wtDir)
        const verifyRes = runCmd('npm', ['run', 'verify'], {
          cwd: wtDir,
          timeout: 300000,
          allowFail: true,
        })
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
          log(`PR #${pr.number} failed deterministic npm run verify; closed.`)
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
          `Deterministic npm run verify (check:sanitized + check:kits + docs:build) ALREADY PASSED.`,
          `Inspect the diff below (and use read-only view/grep if needed), verify all 3 Hub Pre-Publication Gates, and conclude with your <arb_verdict> JSON block.`,
          ``,
          `--- BEGIN GIT DIFF ---`,
          diffText,
          `--- END GIT DIFF ---`,
        ].join('\n')

        const reviewerRes = runCmd(
          COPILOT_BIN,
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
          `| **Deterministic \`npm run verify\`** | \`PASS\` (Sanitization + Kits + VitePress Build) |`,
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
          updateState({
            prsRejected:
              (JSON.parse(fs.readFileSync(pathsConfig().statePath, 'utf8') || '{}').prsRejected || 0) + 1,
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

export async function runImprovementCycle() {
  updateState({ status: 'improving' })
  const branchName = `improve/auto-${formatStamp()}`
  const ghToken = resolveGhToken()

  const recentMerged = runCmd(
    'gh',
    ['pr', 'list', '-R', REPO_SLUG, '--state', 'merged', '--limit', '10', '--json', 'number,title'],
    { allowFail: true }
  ).stdout.trim()

  log(`Phase B: Starting autonomous improvement cycle on branch ${branchName}...`)

  let createdPrNumber = null

  await withWorktree(
    wtDir => ['-b', branchName, wtDir, 'origin/main'],
    async wtDir => {
      copyLocalSanitizeList(wtDir)
      runCmd('npm', ['run', 'verify'], { cwd: wtDir, timeout: 300000 })

      const prompt = [
        `Execute one complete governed improvement cycle inside this worktree (branch: ${branchName}).`,
        `Recently merged PRs (do NOT duplicate these): ${recentMerged || '[]'}`,
        `1. Inspect Playbooks 01-04, Decision Studio Vue components, MIT kits (docs/public/kits/), and scripts.`,
        `2. Select ONE high-ROI, surgical, deterministic improvement (such as an automated link/anchor integrity gate script wired into package.json verify, a Bicep session-pool kit, Regional vs Data Zone PTU toggle in PtuCalculator.vue, or WCAG 2.2 AA keyboard tab navigation).`,
        `3. Implement the improvement cleanly, preserving [M]/[Arch]/[Agree]/[Validate] tags and 100% sanitization.`,
        `4. Run npm run verify and ensure exit code 0.`,
        `5. Write .auto-improve-proposal.json with pr_title, commit_message, track, what_changed, why_high_roi, sources_cited, and next_backlog.`,
      ].join('\n')

      const agentRes = runCmd(
        COPILOT_BIN,
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
      const outerVerify = runCmd('npm', ['run', 'verify'], {
        cwd: wtDir,
        timeout: 300000,
        allowFail: true,
      })
      cleanTransientFiles(wtDir)

      if (outerVerify.status !== 0) {
        log(`Outer deterministic npm run verify failed on ${branchName}; discarding cycle changes.`)
        return
      }

      // Remove symlinked node_modules before git status/add check
      const wtModules = path.join(wtDir, 'node_modules')
      if (fs.existsSync(wtModules) && fs.lstatSync(wtModules).isSymbolicLink()) {
        fs.unlinkSync(wtModules)
      }

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

      const prBody = [
        `## Summary of Architecture Pattern / Playbook Update`,
        ``,
        `- **Track:** \`${proposal.track}\``,
        `- **Branch:** \`${branchName}\``,
        `- **Engineering Impact:** ${proposal.why_high_roi}`,
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
        `- [x] **Gate 3 — Production Build (\`npm run docs:build\`):** Verified clean.`,
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
    await new Promise(r => setTimeout(r, Math.min(5000, end - Date.now())))
  }
}

function runSelfTest() {
  const v1 = checkProtectedFiles(['docs/index.md', 'docs/public/kits/pcr_lint.py'])
  if (v1.length !== 0) throw new Error(`Expected clean paths to pass, got ${v1}`)

  const v2 = checkProtectedFiles(['scripts/check-sanitized.mjs', '.github/agents/hub-arb-reviewer.agent.md'])
  if (v2.length !== 2) throw new Error(`Expected 2 protected violations, got ${v2.length}`)

  const parsedOk = parseArbVerdict(
    'Review notes...\n<arb_verdict>\n{"verdict":"APPROVE","gate1_sanitization":"PASS","gate2_architecture":"PASS","gate3_ip_safety":"PASS","confidence":0.98,"summary":"Clean surgical improvement.","findings":[]}\n</arb_verdict>'
  )
  if (parsedOk.verdict !== 'APPROVE') throw new Error('Expected APPROVE verdict')

  const parsedMissing = parseArbVerdict('No tags emitted')
  if (parsedMissing.verdict !== 'REJECT') throw new Error('Expected REJECT when tags missing')

  console.log('✅ auto-improve-daemon.mjs self-test PASSED (protected paths + ARB verdict parser verified).')
}

async function main() {
  const mode = process.argv[2] || '--once'
  if (mode === '--self-test') {
    runSelfTest()
    return
  }

  acquireLock()
  updateState({
    startedAt: new Date().toISOString(),
    mode,
    intervalMinutes: INTERVAL_MINUTES,
    status: 'starting',
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
    log(`Starting continuous dual-agent daemon (interval=${INTERVAL_MINUTES}m, repo=${REPO_SLUG})...`)
    while (true) {
      const { pausePath, statePath } = pathsConfig()
      if (fs.existsSync(pausePath)) {
        updateState({ status: 'paused' })
        await sleepResponsive(10000)
        continue
      }

      try {
        await reviewAndPromoteOpenPrs()
        if (!fs.existsSync(pausePath)) {
          await runImprovementCycle()
          await reviewAndPromoteOpenPrs()
        }
        let completed = 1
        try {
          completed = (JSON.parse(fs.readFileSync(statePath, 'utf8')).cyclesCompleted || 0) + 1
        } catch {}
        updateState({
          status: 'sleeping',
          cyclesCompleted: completed,
          lastCycleAt: new Date().toISOString(),
          nextCycleAt: new Date(Date.now() + INTERVAL_MINUTES * 60 * 1000).toISOString(),
          lastError: null,
        })
        log(`Cycle #${completed} complete. Sleeping ${INTERVAL_MINUTES} minutes until next cycle...`)
      } catch (err) {
        log(`ERROR in continuous cycle: ${err.message}`)
        updateState({ status: 'error-backoff', lastError: err.message })
      }

      await sleepResponsive(INTERVAL_MINUTES * 60 * 1000)
    }
  } else {
    throw new Error(`Unknown mode '${mode}'. Use --watch, --once, --review-only, or --self-test.`)
  }
}

if (path.resolve(process.argv[1] || '') === SELF) {
  main().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
