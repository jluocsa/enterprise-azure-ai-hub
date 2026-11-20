#!/usr/bin/env node
/**
 * macOS LaunchAgent Service Controller for Enterprise Azure AI Hub Continuous Dual-Agent Loop
 *
 * Commands:
 *   node scripts/auto-improve-service.mjs --install
 *   node scripts/auto-improve-service.mjs --uninstall
 *   node scripts/auto-improve-service.mjs --status
 *   node scripts/auto-improve-service.mjs --pause
 *   node scripts/auto-improve-service.mjs --resume
 *   node scripts/auto-improve-service.mjs --logs
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const LABEL = 'com.jluocsa.enterprise-azure-ai-hub.auto-improve'
const SELF = path.resolve(fileURLToPath(import.meta.url))
const ROOT = path.resolve(path.dirname(SELF), '..')

function exec(cmd, args, { input, accepted = [0] } = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', input, timeout: 60000 })
  if (res.error) throw res.error
  if (!accepted.includes(res.status)) {
    throw new Error(`${path.basename(cmd)} ${args.join(' ')} failed (${res.status}): ${(res.stderr || '').trim()}`)
  }
  return res
}

function resolveNodeBin() {
  const actual = fs.realpathSync(process.execPath)
  for (const dir of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    const candidate = path.resolve(dir, 'node')
    try {
      if (fs.realpathSync(candidate) === actual) return candidate
    } catch {}
  }
  return process.execPath
}

function buildPlist({ root, gitDir, nodeBin, home }) {
  const intervalMin = String(process.env.AUTO_IMPROVE_INTERVAL_MINUTES || '30')
  return {
    Label: LABEL,
    ProgramArguments: [nodeBin, path.join(root, 'scripts', 'auto-improve-daemon.mjs'), '--watch'],
    WorkingDirectory: root,
    RunAtLoad: true,
    KeepAlive: true,
    ThrottleInterval: 60,
    ExitTimeOut: 120,
    ProcessType: 'Background',
    EnvironmentVariables: {
      HOME: home,
      PATH: [
        ...new Set([
          path.dirname(nodeBin),
          '/opt/homebrew/bin',
          '/usr/local/bin',
          '/usr/bin',
          '/bin',
          '/usr/sbin',
          '/sbin',
        ]),
      ].join(':'),
      AUTO_IMPROVE_INTERVAL_MINUTES: intervalMin,
      GIT_TERMINAL_PROMPT: '0',
      GCM_INTERACTIVE: 'never',
    },
    StandardOutPath: path.join(gitDir, 'auto-improve.log'),
    StandardErrorPath: path.join(gitDir, 'auto-improve.log'),
  }
}

function manage(command) {
  if (process.platform !== 'darwin') {
    throw new Error('macOS LaunchAgent requires darwin. On Linux/Windows run: node scripts/auto-improve-daemon.mjs --watch')
  }
  if (process.getuid() === 0) {
    throw new Error('Run without sudo (per-user LaunchAgent).')
  }

  const root = fs.realpathSync(ROOT)
  const gitDir = exec('git', ['-C', root, 'rev-parse', '--absolute-git-dir']).stdout.trim()
  const home = os.homedir()
  const agentsDir = path.join(home, 'Library', 'LaunchAgents')
  const plistPath = path.join(agentsDir, `${LABEL}.plist`)
  const target = `gui/${process.getuid()}/${LABEL}`
  const pausePath = path.join(gitDir, 'auto-improve.paused')
  const statePath = path.join(gitDir, 'auto-improve-state.json')
  const logPath = path.join(gitDir, 'auto-improve.log')
  const plistObj = buildPlist({ root, gitDir, nodeBin: resolveNodeBin(), home })

  const queryLaunchd = () => {
    const res = exec('/bin/launchctl', ['print', target], { accepted: [0, 113] })
    return {
      registered: res.status === 0,
      running: /\bstate = running\b/.test(res.stdout),
      pid: Number(res.stdout.match(/\bpid = (\d+)/)?.[1]) || null,
    }
  }

  if (command === '--logs') {
    if (!fs.existsSync(logPath)) {
      console.log(`Log file not created yet: ${logPath}`)
      return
    }
    const lines = fs.readFileSync(logPath, 'utf8').trim().split(/\r?\n/)
    console.log(lines.slice(-60).join('\n'))
    return
  }

  if (command === '--install') {
    const xml = exec('/usr/bin/plutil', ['-convert', 'xml1', '-o', '-', '-'], {
      input: JSON.stringify(plistObj),
    }).stdout
    exec('/usr/bin/plutil', ['-lint', '-'], { input: xml })
    fs.mkdirSync(agentsDir, { recursive: true })
    if (queryLaunchd().registered) {
      exec('/bin/launchctl', ['bootout', target], { accepted: [0, 3, 36, 113] })
    }
    fs.writeFileSync(plistPath, xml, { mode: 0o600 })
    exec('/bin/launchctl', ['bootstrap', `gui/${process.getuid()}`, plistPath])
  } else if (command === '--uninstall') {
    if (queryLaunchd().registered) {
      exec('/bin/launchctl', ['bootout', target], { accepted: [0, 3, 36, 113] })
    }
    if (fs.existsSync(plistPath)) fs.unlinkSync(plistPath)
  } else if (command === '--pause') {
    fs.writeFileSync(pausePath, `Paused at ${new Date().toISOString()}\n`, { mode: 0o600 })
  } else if (command === '--resume') {
    if (fs.existsSync(pausePath)) fs.unlinkSync(pausePath)
  } else if (command !== '--status') {
    throw new Error(`Unknown command '${command}'.`)
  }

  let daemonState = {}
  if (fs.existsSync(statePath)) {
    try {
      daemonState = JSON.parse(fs.readFileSync(statePath, 'utf8'))
    } catch {}
  }

  console.log(
    JSON.stringify(
      {
        service: LABEL,
        ...queryLaunchd(),
        installed: fs.existsSync(plistPath),
        paused: fs.existsSync(pausePath),
        startup: 'Automatic at macOS user login (KeepAlive=true, independent of VS Code)',
        repository: root,
        plistPath,
        logPath,
        daemonState,
      },
      null,
      2
    )
  )
}

const cmd = process.argv[2]
if (!['--install', '--uninstall', '--status', '--pause', '--resume', '--logs'].includes(cmd)) {
  console.error(
    'Usage: node scripts/auto-improve-service.mjs --install | --uninstall | --status | --pause | --resume | --logs'
  )
  process.exit(1)
}

manage(cmd)
