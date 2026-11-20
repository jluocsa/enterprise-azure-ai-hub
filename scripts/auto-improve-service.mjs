#!/usr/bin/env node
/**
 * Cross-Platform Background Service & Watchdog Controller
 * Enterprise Azure AI Solution Industrialization Hub — Self-Improvement Agent
 *
 * Supports Windows (Task Scheduler + hidden wscript watchdog + detached daemon),
 * macOS (LaunchAgent KeepAlive), and Linux (systemd --user + detached daemon).
 *
 * Commands:
 *   node scripts/auto-improve-service.mjs --start           # Start detached continuous --watch daemon now
 *   node scripts/auto-improve-service.mjs --stop            # Stop running background daemon cleanly
 *   node scripts/auto-improve-service.mjs --ensure-running  # Idempotent watchdog tick (starts if not running & not paused)
 *   node scripts/auto-improve-service.mjs --install         # Install OS auto-start watchdog + start immediately
 *   node scripts/auto-improve-service.mjs --uninstall       # Remove OS auto-start watchdog + stop daemon
 *   node scripts/auto-improve-service.mjs --pause           # Pause continuous cycles cleanly
 *   node scripts/auto-improve-service.mjs --resume          # Resume continuous cycles + ensure running
 *   node scripts/auto-improve-service.mjs --status          # Inspect live service, PID, state & ledger metrics
 *   node scripts/auto-improve-service.mjs --logs            # Tail recent auto-improve.log entries
 *   node scripts/auto-improve-service.mjs --self-test       # Run deterministic controller unit checks
 */

import { execFileSync, spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SELF = path.resolve(fileURLToPath(import.meta.url))
const ROOT = path.resolve(path.dirname(SELF), '..')
const DAEMON_SCRIPT = path.join(ROOT, 'scripts', 'auto-improve-daemon.mjs')

const WIN_TASK_NAME = 'EnterpriseAzureAiHub-AutoImprove'
const MAC_LABEL = 'com.jluocsa.enterprise-azure-ai-hub.auto-improve'
const LINUX_UNIT = 'enterprise-azure-ai-hub-auto-improve.service'

function getGitDir() {
  return execFileSync('git', ['-C', ROOT, 'rev-parse', '--absolute-git-dir'], {
    encoding: 'utf8',
    windowsHide: true,
  }).trim()
}

export function getServicePaths(gitDir = getGitDir()) {
  return {
    gitDir,
    logPath: path.join(gitDir, 'auto-improve.log'),
    statePath: path.join(gitDir, 'auto-improve-state.json'),
    ledgerPath: path.join(gitDir, 'auto-improve-ledger.json'),
    pausePath: path.join(gitDir, 'auto-improve.paused'),
    lockPath: path.join(gitDir, 'auto-improve.lock'),
    winVbsPath: path.join(gitDir, 'auto-improve-watchdog.vbs'),
    macPlistPath: path.join(os.homedir(), 'Library', 'LaunchAgents', `${MAC_LABEL}.plist`),
    linuxUnitPath: path.join(os.homedir(), '.config', 'systemd', 'user', LINUX_UNIT),
  }
}

export function isPidAlive(pid) {
  const num = Number(pid)
  if (!Number.isInteger(num) || num <= 0) return false
  try {
    process.kill(num, 0)
    return true
  } catch (err) {
    return err && err.code === 'EPERM'
  }
}

function readJsonSafe(filePath, fallback = {}) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'))
    }
  } catch {}
  return fallback
}

function getRunningDaemonPid(paths) {
  if (fs.existsSync(paths.lockPath)) {
    const lockPid = Number(fs.readFileSync(paths.lockPath, 'utf8').trim())
    if (isPidAlive(lockPid)) return lockPid
  }
  const state = readJsonSafe(paths.statePath)
  if (state.mode === '--watch' && isPidAlive(state.pid)) {
    return Number(state.pid)
  }
  return null
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function startDetachedDaemon(paths) {
  const existingPid = getRunningDaemonPid(paths)
  if (existingPid) {
    return { started: false, pid: existingPid, reason: 'already-running' }
  }

  const outFd = fs.openSync(paths.logPath, 'a')
  try {
    const child = spawn(process.execPath, [DAEMON_SCRIPT, '--watch'], {
      cwd: ROOT,
      detached: true,
      windowsHide: true,
      stdio: ['ignore', outFd, outFd],
      env: {
        ...process.env,
        HUB_DAEMON_STDIO_LOGGED: '1',
        GIT_TERMINAL_PROMPT: '0',
        GCM_INTERACTIVE: 'never',
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
      },
    })
    child.unref()

    // Wait briefly for lock acquisition
    for (let i = 0; i < 15; i++) {
      sleepMs(200)
      const activePid = getRunningDaemonPid(paths)
      if (activePid) {
        return { started: true, pid: activePid, reason: 'spawned' }
      }
    }

    return {
      started: isPidAlive(child.pid),
      pid: child.pid || null,
      reason: isPidAlive(child.pid) ? 'spawned' : 'exited-early',
    }
  } finally {
    try {
      fs.closeSync(outFd)
    } catch {}
  }
}

function stopRunningDaemon(paths) {
  const pid = getRunningDaemonPid(paths)
  if (!pid) {
    if (fs.existsSync(paths.lockPath)) {
      try {
        fs.unlinkSync(paths.lockPath)
      } catch {}
    }
    return { stopped: false, pid: null }
  }

  try {
    process.kill(pid, 'SIGTERM')
  } catch {}

  for (let i = 0; i < 20; i++) {
    if (!isPidAlive(pid)) break
    sleepMs(200)
  }

  if (isPidAlive(pid) && process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true })
  }

  if (fs.existsSync(paths.lockPath)) {
    try {
      fs.unlinkSync(paths.lockPath)
    } catch {}
  }

  return { stopped: !isPidAlive(pid), pid }
}

export function buildWindowsWatchdogVbs(nodeExe, serviceScriptPath) {
  const escapedNode = nodeExe.replace(/"/g, '""')
  const escapedScript = serviceScriptPath.replace(/"/g, '""')
  return [
    "' Hidden Windows Task Scheduler launcher for Enterprise Azure AI Hub Self-Improvement Agent",
    'Dim shell, cmd',
    'Set shell = CreateObject("WScript.Shell")',
    `cmd = """${escapedNode}"" ""${escapedScript}"" --ensure-running"`,
    'shell.Run cmd, 0, False',
    '',
  ].join('\r\n')
}

function queryOsRegistration(paths) {
  if (process.platform === 'win32') {
    const res = spawnSync('schtasks', ['/Query', '/TN', WIN_TASK_NAME, '/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
      windowsHide: true,
    })
    return {
      mechanism: 'Windows Task Scheduler (15m hidden watchdog + detached KeepAlive)',
      installed: res.status === 0,
      taskName: WIN_TASK_NAME,
    }
  }

  if (process.platform === 'darwin') {
    const uid = typeof process.getuid === 'function' ? process.getuid() : 0
    const res = spawnSync('/bin/launchctl', ['print', `gui/${uid}/${MAC_LABEL}`], { encoding: 'utf8' })
    return {
      mechanism: 'macOS LaunchAgent (KeepAlive=true)',
      installed: fs.existsSync(paths.macPlistPath),
      registered: res.status === 0,
      label: MAC_LABEL,
    }
  }

  const res = spawnSync('systemctl', ['--user', 'is-enabled', LINUX_UNIT], { encoding: 'utf8' })
  return {
    mechanism: 'Linux systemd --user / detached supervisor',
    installed: fs.existsSync(paths.linuxUnitPath),
    enabled: res.status === 0,
    unit: LINUX_UNIT,
  }
}

function installOsWatchdog(paths) {
  if (process.platform === 'win32') {
    const vbs = buildWindowsWatchdogVbs(process.execPath, SELF)
    fs.writeFileSync(paths.winVbsPath, vbs, 'utf8')
    const wscript = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'wscript.exe')
    const taskCmd = `"${wscript}" //B //NoLogo "${paths.winVbsPath}"`
    const createRes = spawnSync(
      'schtasks',
      ['/Create', '/SC', 'MINUTE', '/MO', '15', '/TN', WIN_TASK_NAME, '/TR', taskCmd, '/F'],
      { encoding: 'utf8', windowsHide: true }
    )
    if (createRes.status !== 0) {
      throw new Error(`schtasks /Create failed: ${(createRes.stderr || createRes.stdout || '').trim()}`)
    }
    // Trigger immediately via Task Scheduler so the daemon runs in an independent OS job object
    spawnSync('schtasks', ['/Run', '/TN', WIN_TASK_NAME], { encoding: 'utf8', windowsHide: true })
    for (let i = 0; i < 25; i++) {
      sleepMs(200)
      const activePid = getRunningDaemonPid(paths)
      if (activePid) {
        return { started: true, pid: activePid, reason: 'scheduled-task-run' }
      }
    }
    return startDetachedDaemon(paths)
  }

  if (process.platform === 'darwin') {
    const uid = process.getuid()
    const plistObj = {
      Label: MAC_LABEL,
      ProgramArguments: [process.execPath, DAEMON_SCRIPT, '--watch'],
      WorkingDirectory: ROOT,
      RunAtLoad: true,
      KeepAlive: true,
      ThrottleInterval: 60,
      ProcessType: 'Background',
      EnvironmentVariables: {
        HOME: os.homedir(),
        PATH: [path.dirname(process.execPath), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'].join(':'),
        GIT_TERMINAL_PROMPT: '0',
        GCM_INTERACTIVE: 'never',
      },
      StandardOutPath: paths.logPath,
      StandardErrorPath: paths.logPath,
    }
    const xml = execFileSync('/usr/bin/plutil', ['-convert', 'xml1', '-o', '-', '-'], {
      input: JSON.stringify(plistObj),
      encoding: 'utf8',
    })
    fs.mkdirSync(path.dirname(paths.macPlistPath), { recursive: true })
    spawnSync('/bin/launchctl', ['bootout', `gui/${uid}/${MAC_LABEL}`], { encoding: 'utf8' })
    fs.writeFileSync(paths.macPlistPath, xml, { mode: 0o600 })
    execFileSync('/bin/launchctl', ['bootstrap', `gui/${uid}`, paths.macPlistPath])
    sleepMs(400)
    return { started: true, pid: getRunningDaemonPid(paths), reason: 'launchd' }
  }

  fs.mkdirSync(path.dirname(paths.linuxUnitPath), { recursive: true })
  const unitText = [
    '[Unit]',
    'Description=Enterprise Azure AI Hub Continuous Self-Improvement Agent',
    'After=network-online.target',
    '',
    '[Service]',
    'Type=simple',
    `WorkingDirectory=${ROOT}`,
    `ExecStart="${process.execPath}" "${DAEMON_SCRIPT}" --watch`,
    'Restart=always',
    'RestartSec=30',
    'Environment=GIT_TERMINAL_PROMPT=0',
    'Environment=GCM_INTERACTIVE=never',
    '',
    '[Install]',
    'WantedBy=default.target',
    '',
  ].join('\n')
  fs.writeFileSync(paths.linuxUnitPath, unitText, 'utf8')
  const sysReload = spawnSync('systemctl', ['--user', 'daemon-reload'], { encoding: 'utf8' })
  if (sysReload.status === 0) {
    spawnSync('systemctl', ['--user', 'enable', '--now', LINUX_UNIT], { encoding: 'utf8' })
    sleepMs(400)
    return { started: true, pid: getRunningDaemonPid(paths), reason: 'systemd' }
  }
  return startDetachedDaemon(paths)
}

function uninstallOsWatchdog(paths) {
  if (process.platform === 'win32') {
    spawnSync('schtasks', ['/Delete', '/TN', WIN_TASK_NAME, '/F'], { encoding: 'utf8', windowsHide: true })
    if (fs.existsSync(paths.winVbsPath)) fs.rmSync(paths.winVbsPath, { force: true })
    return stopRunningDaemon(paths)
  }

  if (process.platform === 'darwin') {
    const uid = process.getuid()
    spawnSync('/bin/launchctl', ['bootout', `gui/${uid}/${MAC_LABEL}`], { encoding: 'utf8' })
    if (fs.existsSync(paths.macPlistPath)) fs.rmSync(paths.macPlistPath, { force: true })
    return stopRunningDaemon(paths)
  }

  spawnSync('systemctl', ['--user', 'disable', '--now', LINUX_UNIT], { encoding: 'utf8' })
  if (fs.existsSync(paths.linuxUnitPath)) fs.rmSync(paths.linuxUnitPath, { force: true })
  return stopRunningDaemon(paths)
}

function printStatus(paths, extra = {}) {
  const pid = getRunningDaemonPid(paths)
  const daemonState = readJsonSafe(paths.statePath)
  const ledger = readJsonSafe(paths.ledgerPath, { entries: [], queuedBacklog: [] })
  const payload = {
    platform: process.platform,
    repository: ROOT,
    running: Boolean(pid),
    pid,
    paused: fs.existsSync(paths.pausePath),
    ...queryOsRegistration(paths),
    ...extra,
    logPath: paths.logPath,
    daemonState,
    ledgerSummary: {
      recordedCycles: Array.isArray(ledger.entries) ? ledger.entries.length : 0,
      queuedBacklogCount: Array.isArray(ledger.queuedBacklog) ? ledger.queuedBacklog.length : 0,
      queuedBacklogPreview: (ledger.queuedBacklog || []).slice(0, 5),
    },
  }
  console.log(JSON.stringify(payload, null, 2))
}

function runSelfTest() {
  if (!isPidAlive(process.pid)) {
    throw new Error('Expected current process.pid to report alive')
  }
  if (isPidAlive(-99)) {
    throw new Error('Expected negative PID to report not alive')
  }
  const vbs = buildWindowsWatchdogVbs('C:\\Program Files\\nodejs\\node.exe', 'C:\\repo\\scripts\\auto-improve-service.mjs')
  if (!vbs.includes('--ensure-running') || !vbs.includes(', 0, False')) {
    throw new Error('Expected hidden window style 0 and --ensure-running in Windows watchdog VBScript')
  }
  console.log('✅ auto-improve-service.mjs self-test PASSED (PID liveness + hidden watchdog builder verified).')
}

function main() {
  const cmd = process.argv[2] || '--status'
  if (cmd === '--self-test') {
    runSelfTest()
    return
  }

  const paths = getServicePaths()

  if (cmd === '--logs') {
    if (!fs.existsSync(paths.logPath)) {
      console.log(`Log file not created yet: ${paths.logPath}`)
      return
    }
    const lines = fs.readFileSync(paths.logPath, 'utf8').trim().split(/\r?\n/)
    console.log(lines.slice(-60).join('\n'))
    return
  }

  if (cmd === '--ensure-running') {
    if (fs.existsSync(paths.pausePath)) return
    if (getRunningDaemonPid(paths)) return
    startDetachedDaemon(paths)
    return
  }

  if (cmd === '--start') {
    if (fs.existsSync(paths.pausePath)) fs.rmSync(paths.pausePath, { force: true })
    const res = startDetachedDaemon(paths)
    printStatus(paths, { lastAction: 'start', spawnResult: res })
    return
  }

  if (cmd === '--stop') {
    const res = stopRunningDaemon(paths)
    printStatus(paths, { lastAction: 'stop', stopResult: res })
    return
  }

  if (cmd === '--install') {
    if (fs.existsSync(paths.pausePath)) fs.rmSync(paths.pausePath, { force: true })
    const res = installOsWatchdog(paths)
    printStatus(paths, { lastAction: 'install', spawnResult: res })
    return
  }

  if (cmd === '--uninstall') {
    const res = uninstallOsWatchdog(paths)
    printStatus(paths, { lastAction: 'uninstall', stopResult: res })
    return
  }

  if (cmd === '--pause') {
    fs.writeFileSync(paths.pausePath, `Paused at ${new Date().toISOString()}\n`, 'utf8')
    printStatus(paths, { lastAction: 'pause' })
    return
  }

  if (cmd === '--resume') {
    if (fs.existsSync(paths.pausePath)) fs.rmSync(paths.pausePath, { force: true })
    const res = startDetachedDaemon(paths)
    printStatus(paths, { lastAction: 'resume', spawnResult: res })
    return
  }

  if (cmd === '--status') {
    printStatus(paths)
    return
  }

  console.error(
    'Usage: node scripts/auto-improve-service.mjs --start | --stop | --install | --uninstall | --pause | --resume | --status | --logs | --ensure-running | --self-test'
  )
  process.exit(1)
}

if (path.resolve(process.argv[1] || '') === SELF) {
  main()
}
