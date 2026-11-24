import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'docs', '.vitepress', 'dist')
const RUN_PY = path.join(ROOT, 'scripts', 'run-python.mjs')

execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'check-sanitized.mjs')], {
  cwd: ROOT,
  stdio: 'inherit',
  windowsHide: true,
})
execFileSync(process.execPath, [RUN_PY, path.join(ROOT, 'docs', 'public', 'kits', 'pcr_lint.py'), '--self-test'], {
  cwd: ROOT,
  stdio: 'inherit',
  windowsHide: true,
})
execFileSync(process.execPath, [RUN_PY, path.join(ROOT, 'docs', 'public', 'kits', 'agent_release_gate.py'), '--self-test'], {
  cwd: ROOT,
  stdio: 'inherit',
  windowsHide: true,
})
execFileSync(process.execPath, [RUN_PY, path.join(ROOT, 'docs', 'public', 'kits', 'bcp_snapshot_gate.py'), '--self-test'], {
  cwd: ROOT,
  stdio: 'inherit',
  windowsHide: true,
})
execFileSync(process.execPath, [RUN_PY, path.join(ROOT, 'docs', 'public', 'kits', 'data_readiness_gate.py'), '--self-test'], {
  cwd: ROOT,
  stdio: 'inherit',
  windowsHide: true,
})
execFileSync(process.execPath, [path.join(ROOT, 'node_modules', 'vitepress', 'bin', 'vitepress.js'), 'build', 'docs'], {
  cwd: ROOT,
  stdio: 'inherit',
  windowsHide: true,
})
execFileSync(process.execPath, [RUN_PY, path.join(ROOT, 'scripts', 'check-links.py')], {
  cwd: ROOT,
  stdio: 'inherit',
  windowsHide: true,
})

fs.writeFileSync(path.join(DIST, '.nojekyll'), '')

const remoteUrl = execFileSync('git', ['remote', 'get-url', 'origin'], {
  cwd: ROOT,
  encoding: 'utf8',
  windowsHide: true,
}).trim()
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-pages-'))

try {
  fs.cpSync(DIST, tmpDir, { recursive: true })
  execFileSync('git', ['init', '-b', 'gh-pages'], { cwd: tmpDir, stdio: 'inherit', windowsHide: true })
  execFileSync('git', ['add', '-A'], { cwd: tmpDir, stdio: 'inherit', windowsHide: true })
  execFileSync(
    'git',
    [
      'commit',
      '-m',
      'Deploy Enterprise Azure AI Solution Industrialization Hub to gh-pages\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>',
    ],
    { cwd: tmpDir, stdio: 'inherit', windowsHide: true }
  )
  execFileSync('git', ['remote', 'add', 'origin', remoteUrl], { cwd: tmpDir, stdio: 'inherit', windowsHide: true })
  execFileSync('git', ['push', '-f', 'origin', 'gh-pages'], { cwd: tmpDir, stdio: 'inherit', windowsHide: true })
  console.log('✅ Pushed static build + .nojekyll to origin/gh-pages')
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true })
}
