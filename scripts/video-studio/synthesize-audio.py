#!/usr/bin/env python3
"""
Studio Audio, Timeline & WebVTT Generator for Enterprise Azure AI Hub Intro Video.

Synthesizes neural voiceover stems via edge-tts, captures exact word-boundary
timestamps, mixes a custom 48 kHz stereo ambient keynote score with lookahead
sidechain ducking and scene transition chimes, and writes:
  - cache/video-build/master_audio.wav
  - cache/video-build/timeline.json
  - docs/public/video/enterprise-azure-ai-hub-csa-forum-intro.vtt
"""

from __future__ import annotations

import asyncio
import json
import math
import os
import re
import shutil
import subprocess
import sys
import wave
from pathlib import Path

import edge_tts
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
BUILD_DIR = ROOT / "cache" / "video-build"
PUBLIC_VIDEO_DIR = ROOT / "docs" / "public" / "video"

SAMPLE_RATE = 48_000
VOICE_NAME = os.environ.get("INTRO_VIDEO_VOICE", "en-US-BrianMultilingualNeural")
VOICE_RATE = "+5%"
VOICE_PITCH = "-3Hz"

# Broadcast studio vocal DSP chain (Neumann-style chest warmth + mud cut + presence + air + FET compression + booth reflections)
STUDIO_VOCAL_CHAIN = (
    "highpass=f=78,"
    "equalizer=f=132:t=q:w=1.05:g=4.4,"
    "equalizer=f=315:t=q:w=1.45:g=-3.2,"
    "equalizer=f=3450:t=q:w=1.15:g=3.8,"
    "equalizer=f=8600:t=q:w=0.90:g=3.2,"
    "acompressor=threshold=-21dB:ratio=3.6:attack=6:release=135:makeup=5.2dB,"
    "aecho=0.86:0.88:18:0.055"
)

SCENES = [
    {
        "id": "01-production-cliff",
        "chapter": "01 · The Production Cliff",
        "shortLabel": "01 · Production Cliff",
        "kicker": "CSA FORUM BRIEFING · THE FULL-STACK BOTTLENECK",
        "title": "Demos Are Easy. Production Cutover Is Where Enterprise AI Stalls.",
        "narration": (
            "In enterprise AI, anyone can ship a prototype. "
            "Production cutover is where architectures break. "
            "Silent cache misses that trigger a two-point-five-six-times PTU spike. "
            "HTTP 429 gateway storms and stalled SSE streams. "
            "Cold-cache failover surges across regional stamps. "
            "And in-process agent tools with flaky CI evals. "
            "Worse—when one specialist cracks the code, "
            "that breakthrough stays locked inside a single-account slide deck."
        ),
    },
    {
        "id": "02-hub-reveal",
        "chapter": "02 · Solution Industrialization Hub",
        "shortLabel": "02 · Full-Stack Hub",
        "kicker": "MICROSOFT FOUNDRY & AZURE AI · SOLUTION INDUSTRIALIZATION HUB",
        "title": "Enterprise Azure AI Solution Industrialization Hub",
        "narration": (
            "Not anymore. "
            "Welcome to the Enterprise Azure AI Solution Industrialization Hub, version two-point-zero. "
            "Built by Cloud Solution Architects, for Cloud Solution Architects—turning "
            "proven Customer-Zero wins into four full-stack playbooks, "
            "an interactive five-tool Decision Studio, "
            "and fifty-two executable release gates."
        ),
    },
    {
        "id": "03-four-playbooks",
        "chapter": "03 · 4 Live Full-Stack Playbooks",
        "shortLabel": "03 · 4 Playbooks",
        "kicker": "UNIFIED PRODUCTION TOPOLOGY · 33 DEEP-DIVE CHAPTERS",
        "title": "Four Connected Playbooks Across One Enterprise Request Path",
        "narration": (
            "Four live playbooks interlock on one enterprise request path. "
            "Playbook Zero-One masters GPT-5.6 and GPT-6 prefix caching, fifteen-RPM sharding, "
            "and two-regime PTU math—saving seventy-one percent on peak-season TCO. "
            "Playbook Zero-Two fronts Foundry with APIM Retry-After spillover, unbuffered SSE streaming, "
            "and FinOps telemetry. "
            "Playbook Zero-Three governs Data Zone residency, cold-cache failover surges, "
            "and sub-fifteen-second Game-Day RTO. "
            "And Playbook Zero-Four isolates agent tools inside ACA Dynamic Session microVMs "
            "with Foundry IQ RAG and deterministic evals."
        ),
    },
    {
        "id": "04-decision-studio",
        "chapter": "04 · Interactive Decision Studio",
        "shortLabel": "04 · Decision Studio",
        "kicker": "BROWSER-NATIVE WORKBENCH · 5 LIVE CALCULATORS",
        "title": "Simulate PTU Math, APIM Policies, BCP Surges & Agent Sandboxes",
        "narration": (
            "Inside the browser-native Decision Studio, five interactive tools model every trade-off live—"
            "with zero external telemetry. "
            "Size two-regime PTU baselines and cache shards. "
            "Generate SKU-aware APIM spillover XML. "
            "Simulate multi-region cold-cache failover surges. "
            "And configure ACA microVM pools and deterministic contracts, "
            "including strict client ethical-wall postures."
        ),
    },
    {
        "id": "05-executable-kits",
        "chapter": "05 · 5 Executable MIT Release Gates",
        "shortLabel": "05 · 5 MIT Gates",
        "kicker": "DROP-IN AUTOMATION · MIT CODE & PRINTABLE WHITE PAPERS",
        "title": "Executable Engineering Guardrails, Not Static Slideware",
        "narration": (
            "Zero slideware. You ship five runnable MIT release gates: "
            "a zero-dependency Python AST prefix linter, "
            "deterministic agent trace and cross-region snapshot parity CLIs, "
            "production APIM spillover policy XML, "
            "two live Application Insights KQL workbooks, "
            "and print-ready executive white papers."
        ),
    },
    {
        "id": "06-factory-and-delivery",
        "chapter": "06 · 5-Stage Factory & 3-Week Scope",
        "shortLabel": "06 · Factory & 3-Wk",
        "kicker": "GOVERNED 1:N PIPELINE & REPEATABLE DELIVERY",
        "title": "Five Governed Factory Stages & Turnkey 3-Week Delivery",
        "narration": (
            "Every asset clears a five-stage industrialization factory: "
            "Customer-Zero production telemetry, automated CI sanitization, "
            "peer Microsoft Learn verification, and pre-publication IP protection. "
            "Paired with a thirty-minute triage and a bounded three-week readiness sprint, "
            "every engagement ships with signed cutover evidence."
        ),
    },
    {
        "id": "07-csa-call-to-action",
        "chapter": "07 · CSA Forum Call to Action",
        "shortLabel": "07 · Call to Action",
        "kicker": "SCALE INDUSTRIALIZED ENGINEERING LEVERAGE",
        "title": "Solve Once. Govern Cleanly. Scale Everywhere.",
        "narration": (
            "Launch the Decision Studio on your next Foundry cutover. "
            "Drop the five MIT release gates straight into CI and Azure Monitor. "
            "And bring your toughest Customer-Zero breakthrough into the factory. "
            "Solve once. Govern cleanly. Scale everywhere."
        ),
    },
]

CAPTION_REPLACEMENTS = [
    (r"\btwo-point-five-six-times\b", "2.56×"),
    (r"\btwo-point-zero\b", "2.0"),
    (r"\bPlaybook Zero-One\b", "Playbook 01"),
    (r"\bPlaybook Zero-Two\b", "Playbook 02"),
    (r"\bPlaybook Zero-Three\b", "Playbook 03"),
    (r"\bPlaybook Zero-Four\b", "Playbook 04"),
    (r"\bseventy-one percent\b", "71%"),
    (r"\bfifteen-RPM\b", "15-RPM"),
    (r"\bsub-fifteen-second\b", "<15s"),
    (r"\bfifty-two\b", "52"),
    (r"\bthirty-minute\b", "30-minute"),
    (r"\bthree-week\b", "3-week"),
    (r"\bfive-tool\b", "5-tool"),
    (r"\bfive-stage\b", "5-stage"),
]


def find_ffmpeg() -> str:
    env_bin = os.environ.get("FFMPEG_PATH")
    if env_bin and Path(env_bin).exists():
        return env_bin
    which_bin = shutil.which("ffmpeg")
    if which_bin:
        return which_bin
    local_app_data = os.environ.get("LOCALAPPDATA", "")
    if local_app_data:
        base = Path(local_app_data)
        candidates = list(base.glob("uv/cache/**/imageio_ffmpeg/binaries/ffmpeg*.exe")) + list(
            base.glob("ms-playwright/ffmpeg-*/ffmpeg*.exe")
        )
        # Prefer full v7+ build from imageio_ffmpeg over minimal browser build
        candidates.sort(key=lambda p: ("imageio_ffmpeg" not in str(p), str(p)))
        if candidates:
            return str(candidates[0])
    raise RuntimeError("FFmpeg executable not found. Set FFMPEG_PATH or install ffmpeg.")


def polish_caption_text(text: str) -> str:
    out = text
    for pat, repl in CAPTION_REPLACEMENTS:
        out = re.sub(pat, repl, out, flags=re.IGNORECASE)
    return out


async def synthesize_stem(scene: dict, mp3_path: Path) -> list[dict]:
    meta_path = mp3_path.with_suffix(".words.json")
    if mp3_path.exists() and mp3_path.stat().st_size > 1024 and meta_path.exists():
        cached = json.loads(meta_path.read_text(encoding="utf-8"))
        if (
            cached.get("narration") == scene["narration"]
            and cached.get("voice") == VOICE_NAME
            and cached.get("rate") == VOICE_RATE
            and cached.get("pitch") == VOICE_PITCH
        ):
            return cached["words"]

    last_err: Exception | None = None
    for attempt in range(4):
        try:
            comm = edge_tts.Communicate(
                scene["narration"],
                VOICE_NAME,
                rate=VOICE_RATE,
                pitch=VOICE_PITCH,
                boundary="WordBoundary",
            )
            words: list[dict] = []
            with open(mp3_path, "wb") as f:
                async for chunk in comm.stream():
                    if chunk["type"] == "audio":
                        f.write(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        words.append(
                            {
                                "text": chunk["text"],
                                "offset": chunk["offset"] / 10_000_000.0,
                                "duration": chunk["duration"] / 10_000_000.0,
                            }
                        )
            meta_path.write_text(
                json.dumps(
                    {
                        "narration": scene["narration"],
                        "voice": VOICE_NAME,
                        "rate": VOICE_RATE,
                        "pitch": VOICE_PITCH,
                        "words": words,
                    }
                ),
                encoding="utf-8",
            )
            await asyncio.sleep(0.35)
            return words
        except Exception as err:
            last_err = err
            await asyncio.sleep(1.2 * (attempt + 1))
    raise RuntimeError(f"Failed to synthesize {scene['id']}: {last_err}")


def decode_and_master_vocal_stem(ffmpeg_bin: str, mp3_path: Path, wav_path: Path) -> np.ndarray:
    subprocess.run(
        [
            ffmpeg_bin,
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(mp3_path),
            "-af",
            STUDIO_VOCAL_CHAIN,
            "-ac",
            "2",
            "-ar",
            str(SAMPLE_RATE),
            "-sample_fmt",
            "s16",
            str(wav_path),
        ],
        check=True,
    )
    with wave.open(str(wav_path), "rb") as wf:
        raw = wf.readframes(wf.getnframes())
    stereo = np.frombuffer(raw, dtype=np.int16).astype(np.float32).reshape(-1, 2) / 32768.0
    return stereo


def trim_silence_stereo(stereo: np.ndarray, threshold: float = 0.004) -> tuple[np.ndarray, float]:
    mono_abs = np.max(np.abs(stereo), axis=1)
    idx = np.where(mono_abs > threshold)[0]
    if len(idx) == 0:
        return stereo, 0.0
    pad_head = int(0.03 * SAMPLE_RATE)
    pad_tail = int(0.08 * SAMPLE_RATE)
    start = max(0, int(idx[0]) - pad_head)
    end = min(len(stereo), int(idx[-1]) + pad_tail)
    return stereo[start:end], start / SAMPLE_RATE


def format_vtt_ts(seconds: float) -> str:
    ms_total = max(0, int(round(seconds * 1000)))
    hh = ms_total // 3_600_000
    rem = ms_total % 3_600_000
    mm = rem // 60_000
    rem = rem % 60_000
    ss = rem // 1000
    ms = rem % 1000
    return f"{hh:02d}:{mm:02d}:{ss:02d}.{ms:03d}"


def build_caption_cues(narration: str, words: list[dict], voice_start: float, voice_end: float) -> list[dict]:
    """Align clean punctuated sentences/clauses to exact word-boundary timestamps."""
    polished = polish_caption_text(narration)
    raw_clauses = re.split(
        r"(?<=[.!?;—])\s+|(?<=,)\s+(?=(?:that|an interactive|and fifty-two|and two-regime|and sub-fifteen|including|deterministic|production|two live|and print-ready|every engagement)\b)",
        polished,
    )
    clauses: list[str] = []
    for c in raw_clauses:
        c = c.strip()
        if not c:
            continue
        tokens = c.split()
        if len(tokens) > 15:
            mid = len(tokens) // 2
            clauses.append(" ".join(tokens[:mid]))
            clauses.append(" ".join(tokens[mid:]))
        else:
            clauses.append(c)

    if not words:
        dur = max(0.5, voice_end - voice_start)
        step = dur / max(1, len(clauses))
        return [
            {"start": voice_start + i * step, "end": voice_start + (i + 1) * step, "text": cl}
            for i, cl in enumerate(clauses)
        ]

    total_chars = sum(max(1, len(c)) for c in clauses)
    cues: list[dict] = []
    w_idx = 0
    n_words = len(words)
    acc_chars = 0
    for i, cl in enumerate(clauses):
        start_w = min(w_idx, n_words - 1)
        acc_chars += max(1, len(cl))
        target_w = round((acc_chars / total_chars) * n_words) - 1
        end_w = min(n_words - 1, max(start_w, target_w))
        if i == len(clauses) - 1:
            end_w = n_words - 1
        c_start = words[start_w]["start"]
        c_end = words[end_w]["end"] + 0.08
        cues.append(
            {
                "start": round(max(voice_start, c_start), 3),
                "end": round(min(voice_end + 0.18, c_end), 3),
                "text": cl,
            }
        )
        w_idx = end_w + 1

    # Ensure strictly non-overlapping monotonic cues
    for i in range(len(cues) - 1):
        if cues[i]["end"] > cues[i + 1]["start"]:
            cues[i]["end"] = cues[i + 1]["start"]
    return cues


def synthesize_studio_score(
    total_samples: int,
    voice_stereo: np.ndarray,
    scene_records: list[dict],
) -> np.ndarray:
    """
    Frequency-carved modern electronic keynote score + cinematic SFX:
      - Sub-bass foundation (49 Hz - 110 Hz) + high crystalline shimmer (587 Hz - 880 Hz),
        leaving 180 Hz - 4.2 kHz wide open so the studio baritone voice owns the midrange.
      - Normalized to peak=1.0 BEFORE gain staging so music sits 19-20 dB below speech.
      - Sub-drops on Scene 01/02/07 + stereo air whooshes & fifth chimes on transitions.
    """
    rng = np.random.default_rng(42)
    t = np.arange(total_samples, dtype=np.float32) / SAMPLE_RATE
    left = np.zeros(total_samples, dtype=np.float32)
    right = np.zeros(total_samples, dtype=np.float32)

    bass_roots = [73.42, 61.74, 49.00, 55.00]
    air_notes = [
        (587.33, 880.00),
        (587.33, 739.99),
        (587.33, 783.99),
        (554.37, 880.00),
    ]
    bar_sec = 7.68
    xfade = 1.6
    n_bars = int(math.ceil((total_samples / SAMPLE_RATE) / bar_sec)) + 1

    for b in range(n_bars):
        c_start = b * bar_sec - (xfade if b > 0 else 0.0)
        c_end = (b + 1) * bar_sec
        s_i = max(0, int(c_start * SAMPLE_RATE))
        e_i = min(total_samples, int(c_end * SAMPLE_RATE))
        if e_i <= s_i:
            continue
        seg_len = e_i - s_i
        st = t[s_i:e_i]
        env = np.ones(seg_len, dtype=np.float32)
        fn = min(seg_len // 2, int(xfade * SAMPLE_RATE))
        if b > 0 and fn > 0:
            env[:fn] = 0.5 * (1.0 - np.cos(np.linspace(0.0, math.pi, fn, dtype=np.float32)))
        if fn > 0:
            env[-fn:] *= 0.5 * (1.0 + np.cos(np.linspace(0.0, math.pi, fn, dtype=np.float32)))

        f_sub = bass_roots[b % len(bass_roots)]
        f_air1, f_air2 = air_notes[b % len(air_notes)]

        sub = 0.42 * np.sin(2.0 * math.pi * f_sub * st) + 0.14 * np.sin(2.0 * math.pi * (f_sub * 2.0) * st)
        air_l = 0.07 * np.sin(2.0 * math.pi * (f_air1 * 0.9985) * st) + 0.045 * np.sin(
            2.0 * math.pi * (f_air2 * 1.0015) * st
        )
        air_r = 0.07 * np.sin(2.0 * math.pi * (f_air1 * 1.0015) * st) + 0.045 * np.sin(
            2.0 * math.pi * (f_air2 * 0.9985) * st
        )

        left[s_i:e_i] += (sub + air_l) * env
        right[s_i:e_i] += (sub + air_r) * env

    beat_sec = 0.48
    n_beats = int((total_samples / SAMPLE_RATE) / beat_sec)
    for bi in range(2, n_beats - 3):
        bp = int(bi * beat_sec * SAMPLE_RATE)
        blen = min(int(0.22 * SAMPLE_RATE), total_samples - bp)
        if blen <= 0:
            continue
        bt = np.arange(blen, dtype=np.float32) / SAMPLE_RATE
        f_glide = 46.0 + 49.0 * np.exp(-bt * 38.0)
        phase = 2.0 * math.pi * np.cumsum(f_glide) / SAMPLE_RATE
        kick = 0.24 * np.sin(phase) * np.exp(-bt * 16.0)
        left[bp : bp + blen] += kick
        right[bp : bp + blen] += kick

        if bi % 2 == 1:
            hlen = min(int(0.035 * SAMPLE_RATE), total_samples - bp)
            ht = np.arange(hlen, dtype=np.float32) / SAMPLE_RATE
            tick = 0.035 * np.sin(2.0 * math.pi * 6400.0 * ht) * np.exp(-ht * 130.0)
            left[bp : bp + hlen] += tick * 0.8
            right[bp : bp + hlen] += tick * 1.2

    music_peak = float(max(np.max(np.abs(left)), np.max(np.abs(right)), 1e-6))
    left /= music_peak
    right /= music_peak

    voice_mono_env = np.max(np.abs(voice_stereo), axis=1)
    win1 = int(0.12 * SAMPLE_RATE)
    smooth1 = np.convolve(voice_mono_env, np.ones(win1, dtype=np.float32) / win1, mode="same")
    speaking = np.clip(smooth1 / 0.025, 0.0, 1.0)
    win2 = int(0.28 * SAMPLE_RATE)
    speaking = np.convolve(speaking, np.ones(win2, dtype=np.float32) / win2, mode="same")

    bed_gain = 0.095 - 0.070 * speaking
    in_n = min(total_samples, int(0.65 * SAMPLE_RATE))
    out_n = min(total_samples, int(2.1 * SAMPLE_RATE))
    bed_gain[:in_n] *= np.linspace(0.0, 1.0, in_n, dtype=np.float32)
    bed_gain[-out_n:] *= np.linspace(1.0, 0.0, out_n, dtype=np.float32) ** 1.5

    sfx_l = np.zeros(total_samples, dtype=np.float32)
    sfx_r = np.zeros(total_samples, dtype=np.float32)

    for idx, sc in enumerate(scene_records):
        b_time = sc["start"]
        if idx in (0, 1, 6):
            dp = int(max(0.0, b_time + 0.02) * SAMPLE_RATE)
            dlen = min(int(1.25 * SAMPLE_RATE), total_samples - dp)
            if dlen > 0:
                dt = np.arange(dlen, dtype=np.float32) / SAMPLE_RATE
                df = 36.0 + 58.0 * np.exp(-dt * 5.5)
                dphase = 2.0 * math.pi * np.cumsum(df) / SAMPLE_RATE
                drop = 0.14 * np.sin(dphase) * np.exp(-dt * 2.8) * (1.0 - np.exp(-dt * 80.0))
                sfx_l[dp : dp + dlen] += drop
                sfx_r[dp : dp + dlen] += drop

        if idx > 0:
            wp = int(max(0.0, b_time - 0.24) * SAMPLE_RATE)
            wlen = min(int(0.58 * SAMPLE_RATE), total_samples - wp)
            if wlen > 0:
                wt = np.arange(wlen, dtype=np.float32) / SAMPLE_RATE
                bell_env = np.sin(math.pi * (wt / (wlen / SAMPLE_RATE))) ** 2.0
                noise = rng.standard_normal(wlen).astype(np.float32)
                noise = np.convolve(noise, np.ones(14, dtype=np.float32) / 14.0, mode="same")
                pan = np.linspace(0.2, 0.8, wlen, dtype=np.float32)
                sfx_l[wp : wp + wlen] += noise * bell_env * (1.0 - pan) * 0.05
                sfx_r[wp : wp + wlen] += noise * bell_env * pan * 0.05

            cp = int(max(0.0, b_time) * SAMPLE_RATE)
            clen = min(int(1.1 * SAMPLE_RATE), total_samples - cp)
            if clen > 0:
                ct = np.arange(clen, dtype=np.float32) / SAMPLE_RATE
                c_env = np.exp(-ct * 4.2) * (1.0 - np.exp(-ct * 140.0))
                chime = 0.04 * np.sin(2.0 * math.pi * 587.33 * ct) + 0.028 * np.sin(2.0 * math.pi * 880.0 * ct)
                sfx_l[cp : cp + clen] += chime * c_env * 1.05
                sfx_r[cp : cp + clen] += chime * c_env * 0.85

    return np.stack([left * bed_gain + sfx_l, right * bed_gain + sfx_r], axis=1)


async def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    ffmpeg_bin = find_ffmpeg()

    intro_lead = 0.80
    inter_scene_gap = 0.62
    outro_hold = 2.20

    cursor = intro_lead
    scene_records = []
    voice_segments: list[tuple[int, np.ndarray]] = []
    all_cues: list[dict] = []

    print(f"🎙️  Synthesizing & studio-mastering 7 voiceover stems ({VOICE_NAME}, pitch={VOICE_PITCH}, rate={VOICE_RATE})...")
    for idx, scene in enumerate(SCENES):
        mp3_path = BUILD_DIR / f"{scene['id']}.mp3"
        wav_path = BUILD_DIR / f"{scene['id']}_studio.wav"
        words = await synthesize_stem(scene, mp3_path)
        mastered_stereo = decode_and_master_vocal_stem(ffmpeg_bin, mp3_path, wav_path)
        trimmed, trim_offset = trim_silence_stereo(mastered_stereo)

        rms = float(np.sqrt(np.mean(trimmed**2)) + 1e-8)
        trimmed = trimmed * (0.215 / rms)
        peak_s = float(np.max(np.abs(trimmed)) + 1e-8)
        if peak_s > 0.88:
            trimmed = np.tanh(trimmed * 1.15) * 0.84

        scene_start = 0.0 if idx == 0 else cursor - (inter_scene_gap * 0.45)
        voice_start = cursor
        voice_dur = len(trimmed) / SAMPLE_RATE
        voice_end = voice_start + voice_dur
        scene_end = voice_end + (outro_hold if idx == len(SCENES) - 1 else inter_scene_gap * 0.55)

        adjusted_words = []
        for w in words:
            w_start = max(voice_start, voice_start + (w["offset"] - trim_offset))
            adjusted_words.append(
                {
                    "text": w["text"],
                    "start": round(w_start, 3),
                    "end": round(w_start + w["duration"], 3),
                }
            )

        cues = build_caption_cues(scene["narration"], adjusted_words, voice_start, voice_end)
        all_cues.extend(cues)

        start_sample = int(round(voice_start * SAMPLE_RATE))
        voice_segments.append((start_sample, trimmed))

        scene_records.append(
            {
                "index": idx,
                "id": scene["id"],
                "chapter": scene["chapter"],
                "shortLabel": scene["shortLabel"],
                "kicker": scene["kicker"],
                "title": scene["title"],
                "start": round(scene_start, 3),
                "end": round(scene_end, 3),
                "duration": round(scene_end - scene_start, 3),
                "voiceStart": round(voice_start, 3),
                "voiceEnd": round(voice_end, 3),
                "narration": polish_caption_text(scene["narration"]),
                "cues": cues,
                "words": adjusted_words,
            }
        )
        print(
            f"   ✓ {scene['id']}: {scene_start:5.2f}s → {scene_end:5.2f}s "
            f"(voice {voice_dur:4.1f}s, {len(adjusted_words)} words)"
        )
        cursor = voice_end + inter_scene_gap

    total_duration = round(scene_records[-1]["end"], 2)
    total_samples = int(math.ceil(total_duration * SAMPLE_RATE))

    voice_stereo = np.zeros((total_samples, 2), dtype=np.float32)
    for start_sample, seg in voice_segments:
        end_sample = min(total_samples, start_sample + len(seg))
        voice_stereo[start_sample:end_sample] += seg[: end_sample - start_sample]

    score_stereo = synthesize_studio_score(total_samples, voice_stereo, scene_records)

    raw_mix = voice_stereo + score_stereo
    peak = float(np.max(np.abs(raw_mix)) + 1e-8)
    if peak > 0.94:
        raw_mix = np.tanh(raw_mix * 1.08) * 0.91

    pre_wav = BUILD_DIR / "pre_master.wav"
    pcm16 = np.clip(raw_mix * 32767.0, -32768, 32767).astype(np.int16)
    with wave.open(str(pre_wav), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(pcm16.tobytes())

    master_wav = BUILD_DIR / "master_audio.wav"
    subprocess.run(
        [
            ffmpeg_bin,
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(pre_wav),
            "-af",
            "loudnorm=I=-14:TP=-1.0:LRA=7,volume=3.8dB,alimiter=limit=0.89",
            "-ar",
            str(SAMPLE_RATE),
            "-ac",
            "2",
            "-sample_fmt",
            "s16",
            str(master_wav),
        ],
        check=True,
    )

    vtt_lines = ["WEBVTT", ""]
    for i, cue in enumerate(all_cues, start=1):
        vtt_lines.append(str(i))
        vtt_lines.append(f"{format_vtt_ts(cue['start'])} --> {format_vtt_ts(cue['end'])}")
        vtt_lines.append(cue["text"])
        vtt_lines.append("")

    vtt_path = PUBLIC_VIDEO_DIR / "enterprise-azure-ai-hub-csa-forum-intro.vtt"
    vtt_path.write_text("\n".join(vtt_lines), encoding="utf-8")

    timeline = {
        "title": "Enterprise Azure AI — Solution Industrialization Hub v2.0 (CSA Forum Introduction)",
        "voice": VOICE_NAME,
        "sampleRate": SAMPLE_RATE,
        "totalDuration": total_duration,
        "scenes": scene_records,
    }
    timeline_path = BUILD_DIR / "timeline.json"
    timeline_path.write_text(json.dumps(timeline, indent=2), encoding="utf-8")

    print(f"✅ Studio broadcast master ready: {master_wav} ({total_duration:.2f}s @ -14 LUFS)")
    print(f"✅ WebVTT captions written:       {vtt_path} ({len(all_cues)} cues)")
    print(f"✅ Frame timeline written:        {timeline_path}")


if __name__ == "__main__":
    asyncio.run(main())
