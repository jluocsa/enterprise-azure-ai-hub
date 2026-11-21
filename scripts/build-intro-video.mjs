#!/usr/bin/env node
/**
 * Deterministic Studio Video Builder for Enterprise Azure AI Solution Industrialization Hub.
 *
 * Orchestrates:
 *   1. Neural voiceover + 48 kHz ambient score + WebVTT captions (synthesize-audio.py)
 *   2. Parallel headless Chromium/Edge CDP workers rendering frames of
 *      scripts/video-studio/stage.html at exact timestamps
 *   3. Lanczos downsampling to 1920x1080 TV-range BT.709 H.264 High Profile +
 *      256 kbps 48 kHz AAC with +faststart for instant web & PowerPoint playback
 *   4. Companion VP9 + Opus WebM for VS Code & Electron playback
 *   5. High-resolution 1920x1080 studio poster frame + clickable README preview card
 *
 * Usage:
 *   node scripts/build-intro-video.mjs                  # Full audio + MP4 + WebM + poster build
 *   node scripts/build-intro-video.mjs --keyframes-only # Fast 7-scene storyboard PNG audit
 *   node scripts/build-intro-video.mjs --skip-audio     # Reuse existing master_audio.wav
 */

import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolvePython3Command } from './run-python.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BUILD_DIR = path.join(ROOT, 'cache', 'video-build')
const PUBLIC_VIDEO_DIR = path.join(ROOT, 'docs', 'public', 'video')
const STAGE_HTML = path.join(__dirname, 'video-studio', 'stage.html')
const AUDIO_SCRIPT = path.join(__dirname, 'video-studio', 'synthesize-audio.py')
const CARD_SCRIPT = path.join(__dirname, 'video-studio', 'make-readme-card.py')

const OUT_MP4 = path.join(PUBLIC_VIDEO_DIR, 'enterprise-azure-ai-hub-csa-forum-intro.mp4')
const OUT_WEBM = path.join(PUBLIC_VIDEO_DIR, 'enterprise-azure-ai-hub-csa-forum-intro.webm')
const OUT_POSTER = path.join(PUBLIC_VIDEO_DIR, 'enterprise-azure-ai-hub-csa-forum-intro-poster.png')

const FPS = Number(process.env.VIDEO_FPS || 30)
const DSF = Number(process.env.VIDEO_DSF || 1)
const WORKERS = Math.min(5, Math.max(2, Math.floor((os.cpus()?.length || 4) * 0.65)))

const args = new Set(process.argv.slice(2))
const keyframesOnly = args.has('--keyframes-only')
const skipAudio = args.has('--skip-audio')

function findExecutableOnPath(names) {
  const pathDirs = (process.env.PATH || '').split(path.delimiter)
  for (const name of names) {
    for (const dir of pathDirs) {
      if (!dir) continue
      const full = path.join(dir, name)
      if (fs.existsSync(full)) return full
    }
  }
  return null
}

function walkMatch(baseDir, matcher, maxDepth = 5, depth = 0) {
  if (!baseDir || !fs.existsSync(baseDir) || depth > maxDepth) return []
  const found = []
  let entries = []
  try {
    entries = fs.readdirSync(baseDir, { withFileTypes: true })
  } catch {
    return found
  }
  for (const entry of entries) {
    const full = path.join(baseDir, entry.name)
    if (entry.isDirectory()) {
      found.push(...walkMatch(full, matcher, maxDepth, depth + 1))
    } else if (matcher(full, entry.name)) {
      found.push(full)
    }
  }
  return found
}

function findFfmpeg() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH
  }
  const onPath = findExecutableOnPath(process.platform === 'win32' ? ['ffmpeg.exe'] : ['ffmpeg'])
  if (onPath) return onPath

  const localApp = process.env.LOCALAPPDATA || ''
  if (localApp) {
    const uvBins = walkMatch(
      path.join(localApp, 'uv', 'cache'),
      (_full, name) => /^ffmpeg.*\.exe$/i.test(name),
      5
    )
    uvBins.sort((a, b) => Number(!a.includes('imageio_ffmpeg')) - Number(!b.includes('imageio_ffmpeg')))
    if (uvBins.length > 0) return uvBins[0]

    const pwBins = walkMatch(
      path.join(localApp, 'ms-playwright'),
      (_full, name) => /^ffmpeg.*\.exe$/i.test(name),
      3
    )
    if (pwBins.length > 0) return pwBins[0]
  }
  throw new Error('FFmpeg binary not found. Set FFMPEG_PATH or install ffmpeg.')
}

function findBrowser() {
  if (process.env.BROWSER_PATH && fs.existsSync(process.env.BROWSER_PATH)) {
    return process.env.BROWSER_PATH
  }
  const winCandidates = [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ]
  for (const c of winCandidates) {
    if (fs.existsSync(c)) return c
  }
  const unixCandidates = findExecutableOnPath(['google-chrome', 'microsoft-edge', 'chromium', 'chromium-browser'])
  if (unixCandidates) return unixCandidates
  throw new Error('Chromium/Chrome/Edge browser not found. Set BROWSER_PATH.')
}

async function connectCdp(browserBin, port, userDataDir) {
  fs.mkdirSync(userDataDir, { recursive: true })
  const proc = spawn(
    browserBin,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-gpu-vsync',
      '--run-all-compositor-stages-before-draw',
      '--hide-scrollbars',
      '--mute-audio',
      '--window-size=1920,1080',
      'about:blank',
    ],
    { stdio: 'ignore', windowsHide: true }
  )

  let wsUrl = null
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const list = await new Promise((resolve, reject) => {
        http
          .get(`http://127.0.0.1:${port}/json/list`, (res) => {
            let body = ''
            res.on('data', (chunk) => (body += chunk))
            res.on('end', () => {
              try {
                resolve(JSON.parse(body))
              } catch (e) {
                reject(e)
              }
            })
          })
          .on('error', reject)
      })
      const target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (target) {
        wsUrl = target.webSocketDebuggerUrl
        break
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 150))
  }

  if (!wsUrl) {
    proc.kill()
    throw new Error(`Timed out waiting for Chrome CDP on port ${port}`)
  }

  const ws = new WebSocket(wsUrl)
  await new Promise((res, rej) => {
    ws.onopen = res
    ws.onerror = rej
  })

  let msgId = 0
  const pending = new Map()
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(msg.error.message || 'CDP error'))
      else resolve(msg.result)
    }
  }

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++msgId
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async function close() {
    try {
      ws.close()
    } catch {}
    try {
      proc.kill()
    } catch {}
  }

  return { send, close }
}

async function prepareStagePage(cdp, timeline, dsf) {
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: dsf,
    mobile: false,
  })
  const stageUrl = pathToFileURL(STAGE_HTML).href
  await cdp.send('Page.navigate', { url: stageUrl })
  await new Promise((r) => setTimeout(r, 450))
  await cdp.send('Runtime.evaluate', {
    expression: `window.initTimeline(${JSON.stringify(timeline)}); window.renderAt(0);`,
  })
}

async function captureKeyframesAndPoster(browserBin, timeline) {
  console.log(`🖼️  Rendering ${timeline.scenes.length} storyboard keyframes + high-res poster PNG...`)
  const profileDir = path.join(BUILD_DIR, 'profile-keyframes')
  const cdp = await connectCdp(browserBin, 9340, profileDir)
  try {
    await prepareStagePage(cdp, timeline, 1.5)
    const keyframesDir = path.join(BUILD_DIR, 'keyframes')
    fs.rmSync(keyframesDir, { recursive: true, force: true })
    fs.mkdirSync(keyframesDir, { recursive: true })

    for (const sc of timeline.scenes) {
      const ratio = 0.94
      const sampleT = Number((sc.start + (sc.end - sc.start) * ratio).toFixed(2))
      await cdp.send('Runtime.evaluate', { expression: `window.renderAt(${sampleT});` })
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
      const outFile = path.join(keyframesDir, `scene-${String(sc.index + 1).padStart(2, '0')}-${sc.id}.png`)
      fs.writeFileSync(outFile, Buffer.from(shot.data, 'base64'))
      console.log(`   ✓ ${path.basename(outFile)} @ t=${sampleT}s`)
    }

    // Poster frame from Scene 02 full reveal (Hub v2.0 + all 4 KPIs visible)
    const posterT = Number((timeline.scenes[1].start + (timeline.scenes[1].end - timeline.scenes[1].start) * 0.96).toFixed(2))
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await cdp.send('Runtime.evaluate', { expression: `window.renderAt(${posterT});` })
    const posterShot = await cdp.send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(OUT_POSTER, Buffer.from(posterShot.data, 'base64'))
    console.log(`✅ Poster saved: ${OUT_POSTER}`)
  } finally {
    await cdp.close()
  }
}

async function renderSegment(workerIdx, startFrame, endFrame, browserBin, ffmpegBin, timeline, onProgress) {
  await new Promise((r) => setTimeout(r, workerIdx * 350))
  const segPath = path.join(BUILD_DIR, `segment_${workerIdx}.mp4`)
  const profileDir = path.join(BUILD_DIR, `profile-w${workerIdx}`)
  const port = 9350 + workerIdx

  const ffArgs = [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'image2pipe',
    '-vcodec',
    'mjpeg',
    '-r',
    String(FPS),
    '-i',
    '-',
    '-vf',
    'scale=1920:1080:flags=lanczos:in_range=full:out_range=tv,format=yuv420p',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '21',
    '-profile:v',
    'high',
    '-level:v',
    '4.2',
    '-pix_fmt',
    'yuv420p',
    '-color_range',
    'tv',
    '-colorspace',
    'bt709',
    '-color_primaries',
    'bt709',
    '-color_trc',
    'bt709',
    '-r',
    String(FPS),
    segPath,
  ]

  const ff = spawn(ffmpegBin, ffArgs, { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true })
  let ffErr = ''
  ff.stderr.on('data', (d) => (ffErr += d.toString()))

  const cdp = await connectCdp(browserBin, port, profileDir)
  try {
    await prepareStagePage(cdp, timeline, DSF)
    for (let f = startFrame; f < endFrame; f++) {
      const t = f / FPS
      await cdp.send('Runtime.evaluate', { expression: `window.renderAt(${t.toFixed(5)});` })
      const shot = await cdp.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 96,
        optimizeForSpeed: true,
      })
      const buf = Buffer.from(shot.data, 'base64')
      if (!ff.stdin.write(buf)) {
        await new Promise((resolve) => ff.stdin.once('drain', resolve))
      }
      onProgress()
    }
  } finally {
    await cdp.close()
    ff.stdin.end()
  }

  const exitCode = await new Promise((resolve) => ff.on('close', resolve))
  if (exitCode !== 0) {
    throw new Error(`FFmpeg segment ${workerIdx} failed (${exitCode}): ${ffErr}`)
  }
  return segPath
}

async function main() {
  fs.mkdirSync(BUILD_DIR, { recursive: true })
  fs.mkdirSync(PUBLIC_VIDEO_DIR, { recursive: true })

  const ffmpegBin = findFfmpeg()
  const browserBin = findBrowser()
  const pyResolved = resolvePython3Command()
  console.log(`🎬 Studio Pipeline | Browser: ${path.basename(browserBin)} | FFmpeg: ${path.basename(ffmpegBin)}`)

  if (!skipAudio && !keyframesOnly) {
    execFileSync(pyResolved.cmd, [...pyResolved.prefixArgs, AUDIO_SCRIPT], {
      cwd: ROOT,
      stdio: 'inherit',
      windowsHide: true,
      env: { ...process.env, FFMPEG_PATH: ffmpegBin, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
    })
  }

  const timelinePath = path.join(BUILD_DIR, 'timeline.json')
  if (!fs.existsSync(timelinePath)) {
    throw new Error(`Missing ${timelinePath}. Run without --skip-audio first.`)
  }
  const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf8'))

  await captureKeyframesAndPoster(browserBin, timeline)
  execFileSync(pyResolved.cmd, [...pyResolved.prefixArgs, CARD_SCRIPT], {
    cwd: ROOT,
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
  })
  if (keyframesOnly) return

  const totalFrames = Math.round(timeline.totalDuration * FPS)
  const exactDurStr = Number(timeline.totalDuration).toFixed(2)
  console.log(
    `🚀 Rendering ${totalFrames} frames (${exactDurStr}s @ ${FPS}fps, DSF=${DSF}) across ${WORKERS} parallel workers...`
  )

  const chunkSize = Math.ceil(totalFrames / WORKERS)
  let completedFrames = 0
  const startWall = performance.now()
  let lastLog = 0

  const onProgress = () => {
    completedFrames++
    const now = performance.now()
    if (now - lastLog > 4000 || completedFrames === totalFrames) {
      lastLog = now
      const pct = ((completedFrames / totalFrames) * 100).toFixed(1)
      const elapsed = ((now - startWall) / 1000).toFixed(1)
      const rate = (completedFrames / Math.max(0.1, (now - startWall) / 1000)).toFixed(1)
      console.log(`   ⏳ ${completedFrames}/${totalFrames} frames (${pct}%) | ${rate} fps | ${elapsed}s elapsed`)
    }
  }

  const promises = []
  for (let w = 0; w < WORKERS; w++) {
    const sFrame = w * chunkSize
    const eFrame = Math.min(totalFrames, (w + 1) * chunkSize)
    if (sFrame >= eFrame) continue
    promises.push(renderSegment(w, sFrame, eFrame, browserBin, ffmpegBin, timeline, onProgress))
  }

  const segmentFiles = await Promise.all(promises)

  // Concatenate video segments and mux 48 kHz Stereo Master Audio
  const concatListPath = path.join(BUILD_DIR, 'concat.txt')
  const concatLines = segmentFiles.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n')
  fs.writeFileSync(concatListPath, concatLines, 'utf8')

  const masterAudio = path.join(BUILD_DIR, 'master_audio.wav')
  console.log('🔊 Muxing H.264 video stream with 48 kHz Stereo Master Audio...')
  execFileSync(
    ffmpegBin,
    [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatListPath,
      '-i',
      masterAudio,
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-ar',
      '48000',
      '-ac',
      '2',
      '-movflags',
      '+faststart',
      '-t',
      exactDurStr,
      OUT_MP4,
    ],
    { stdio: 'inherit', windowsHide: true }
  )

  console.log('🎞️  Encoding companion VP9 + Opus WebM for VS Code & Electron playback...')
  execFileSync(
    ffmpegBin,
    [
      '-y',
      '-loglevel',
      'error',
      '-i',
      OUT_MP4,
      '-i',
      masterAudio,
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-vf',
      'scale=in_range=tv:out_range=tv,format=yuv420p',
      '-c:v',
      'libvpx-vp9',
      '-b:v',
      '0',
      '-crf',
      '30',
      '-deadline',
      'good',
      '-cpu-used',
      '4',
      '-row-mt',
      '1',
      '-pix_fmt',
      'yuv420p',
      '-color_range',
      'tv',
      '-colorspace',
      'bt709',
      '-color_primaries',
      'bt709',
      '-color_trc',
      'bt709',
      '-c:a',
      'libopus',
      '-b:a',
      '192k',
      '-ar',
      '48000',
      '-ac',
      '2',
      '-t',
      exactDurStr,
      OUT_WEBM,
    ],
    { stdio: 'inherit', windowsHide: true }
  )

  const sizeMb = (fs.statSync(OUT_MP4).size / (1024 * 1024)).toFixed(2)
  const webmMb = (fs.statSync(OUT_WEBM).size / (1024 * 1024)).toFixed(2)
  const totalSec = ((performance.now() - startWall) / 1000).toFixed(1)
  console.log(`✨ Studio video complete in ${totalSec}s: MP4 (${sizeMb} MB) + WebM (${webmMb} MB)`)
}

main().catch((err) => {
  console.error('❌ Video build failed:', err)
  process.exit(1)
})
