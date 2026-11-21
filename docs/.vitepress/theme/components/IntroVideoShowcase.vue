<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { withBase } from 'vitepress'

interface VideoChapter {
  num: string
  label: string
  timeLabel: string
  start: number
  end: number
}

const chapters: VideoChapter[] = [
  { num: '01', label: 'Production Cliff', timeLabel: '0:00', start: 0, end: 30.38 },
  { num: '02', label: 'Full-Stack Hub', timeLabel: '0:30', start: 30.38, end: 50.66 },
  { num: '03', label: '4 Live Playbooks', timeLabel: '0:51', start: 50.66, end: 90.35 },
  { num: '04', label: 'Decision Studio', timeLabel: '1:30', start: 90.35, end: 116.01 },
  { num: '05', label: '5 MIT Gates', timeLabel: '1:56', start: 116.01, end: 135.19 },
  { num: '06', label: 'Factory & 3-Wk', timeLabel: '2:15', start: 135.19, end: 155.12 },
  { num: '07', label: 'Call to Action', timeLabel: '2:35', start: 155.12, end: 174 },
]

const videoRef = ref<HTMLVideoElement | null>(null)
const sectionRef = ref<HTMLElement | null>(null)
const activeChapterIdx = ref(0)
const isPlaying = ref(false)
const hasStarted = ref(false)

function ensureAudible(el: HTMLVideoElement) {
  el.muted = false
  if (el.volume === 0) el.volume = 1
}

function onTimeUpdate() {
  const el = videoRef.value
  if (!el) return
  const t = el.currentTime
  if (t > 0.05) hasStarted.value = true
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (t >= chapters[i].start - 0.15) {
      activeChapterIdx.value = i
      break
    }
  }
}

function jumpToChapter(idx: number) {
  const el = videoRef.value
  const ch = chapters[idx]
  if (!el || !ch) return
  hasStarted.value = true
  activeChapterIdx.value = idx
  ensureAudible(el)
  el.currentTime = ch.start
  el.play().catch(() => {})
}

function playWithSound() {
  const el = videoRef.value
  if (!el) return
  hasStarted.value = true
  ensureAudible(el)
  el.play().catch(() => {})
}

function playFromStart() {
  const el = videoRef.value
  if (!el) return
  hasStarted.value = true
  ensureAudible(el)
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.play().catch(() => {})
}

onMounted(() => {
  if (typeof window !== 'undefined' && window.location.hash === '#csa-forum-video') {
    setTimeout(() => {
      sectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
  }
})

defineExpose({ playFromStart })
</script>

<template>
  <section id="csa-forum-video" ref="sectionRef" class="ivs-section no-print">
    <div class="ms-container">
      <div class="ivs-card">
        <div class="ivs-header">
          <div>
            <span class="ivs-kicker">
              <span class="ivs-rec-dot" aria-hidden="true"></span>
              <span>STUDIO BRIEFING &middot; CSA FORUM EDITION (2:53 &middot; 1080p HD &middot; STUDIO VOICEOVER + SCORE)</span>
            </span>
            <h2 class="ivs-title">Executive &amp; CSA Forum Introduction Film</h2>
            <p class="ivs-sub">
              Walk through all 4 full-stack Customer-Zero playbooks, the 5-tool interactive Decision Studio,
              5 runnable MIT release gates, and the governed 5-stage factory + 3-week delivery cadence in under three minutes.
            </p>
          </div>

          <div class="ivs-actions">
            <a
              class="ms-btn ms-btn-secondary ivs-dl-btn"
              :href="withBase('/video/enterprise-azure-ai-hub-csa-forum-intro.mp4')"
              download="enterprise-azure-ai-hub-csa-forum-intro.mp4"
            >
              <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M8.75 1.75a.75.75 0 0 0-1.5 0v6.69L4.97 6.16a.75.75 0 0 0-1.06 1.06l3.56 3.56a.75.75 0 0 0 1.06 0l3.56-3.56a.75.75 0 1 0-1.06-1.06L8.75 8.44V1.75ZM2.5 11.75a.75.75 0 0 0-1.5 0v1.5A1.75 1.75 0 0 0 2.75 15h10.5A1.75 1.75 0 0 0 15 13.25v-1.5a.75.75 0 0 0-1.5 0v1.5a.25.25 0 0 1-.25.25H2.75a.25.25 0 0 1-.25-.25v-1.5Z"
                />
              </svg>
              <span>Download 1080p MP4 (PowerPoint / Teams)</span>
            </a>
          </div>
        </div>

        <div class="ivs-player-wrap" :class="{ 'is-playing': isPlaying }">
          <video
            ref="videoRef"
            class="ivs-video"
            controls
            playsinline
            preload="metadata"
            :poster="withBase('/video/enterprise-azure-ai-hub-csa-forum-intro-poster.png')"
            @timeupdate="onTimeUpdate"
            @play="isPlaying = true; hasStarted = true"
            @pause="isPlaying = false"
            @ended="isPlaying = false"
          >
            <source
              :src="withBase('/video/enterprise-azure-ai-hub-csa-forum-intro.mp4')"
              type='video/mp4; codecs="avc1.64002a, mp4a.40.2"'
            />
            <source
              :src="withBase('/video/enterprise-azure-ai-hub-csa-forum-intro.webm')"
              type='video/webm; codecs="vp9, opus"'
            />
            <track
              kind="captions"
              label="English (Synchronized Captions)"
              srclang="en"
              :src="withBase('/video/enterprise-azure-ai-hub-csa-forum-intro.vtt')"
              default
            />
            Your browser does not support HTML5 video.
          </video>

          <button
            v-if="!isPlaying && !hasStarted"
            type="button"
            class="ivs-play-overlay"
            aria-label="Play 2:53 CSA Forum Studio Introduction Film with sound"
            @click="playWithSound"
          >
            <span class="ivs-play-pill">
              <span class="ivs-play-circle" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <path fill="currentColor" d="M8 5.14v14l11-7-11-7Z" />
                </svg>
              </span>
              <span class="ivs-play-copy">
                <strong>Play Studio Intro Film (2:53)</strong>
                <span>1080p HD &middot; Baritone Voiceover + Score &middot; Sound On</span>
              </span>
            </span>
          </button>
        </div>

        <div class="ivs-chapters" role="navigation" aria-label="Video chapters">
          <button
            v-for="(ch, idx) in chapters"
            :key="ch.num"
            type="button"
            class="ivs-chapter-btn"
            :class="{ 'is-active': activeChapterIdx === idx }"
            @click="jumpToChapter(idx)"
          >
            <span class="ivs-ch-top">
              <span class="ivs-ch-num">{{ ch.num }}</span>
              <span class="ivs-ch-time">{{ ch.timeLabel }}</span>
            </span>
            <span class="ivs-ch-label">{{ ch.label }}</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
