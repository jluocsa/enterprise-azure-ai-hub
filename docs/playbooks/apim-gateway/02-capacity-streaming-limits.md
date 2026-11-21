---
title: "02 · Throughput, Payload Sizing & Unbuffered SSE Streaming"
description: Gateway SKU selection, large-context payload sizing, timeout budgets, and unbuffered Server-Sent Events (SSE) rules for /openai/v1/responses and /chat/completions.
---

# 02 · Throughput, Payload Sizing & Unbuffered SSE Streaming

<PlaybookMeta
  track="02 · Multi-Backend Foundry APIM AI Gateway & Governance"
  verified="2026-11-19 22:12 PST"
  status="Live v2.0"
  studioHref="/studio/#apim"
  studioLabel="APIM XML Policy Builder →"
/>

<PageBrief
  stage="qualify"
  readTime="4 min read"
  problem="Long-context GPT-5.6 / GPT-6 prompts (up to 272K–400K tokens) and reasoning-heavy SSE streams routinely hit default gateway timeouts or accidental full-response buffering."
  takeaway="Size APIM Standard v2 / Premium v2 scale units for concurrent long-lived SSE sockets, keep buffer-response='false', and align request-body inspection limits with retry requirements."
  csaUse="Check these four gateway parameters before load testing any multi-node reasoning agent behind APIM."
/>

## 1. Matching APIM Tiers to Enterprise GenAI Traffic

Unlike sub-50ms REST microservices, Microsoft Foundry `/openai/v1/responses` and `/openai/v1/chat/completions` calls hold open HTTP connections for **5–120+ seconds** during multi-step reasoning and streaming token generation <span class="ev-badge ev-arch">[Arch]</span>.

| Gateway Parameter | Enterprise GenAI Requirement | Recommended Configuration |
| :--- | :--- | :--- |
| **APIM Tier** | VNet integration (Private Endpoints to Foundry), native backend pools, and GenAI token policies (`azure-openai-*`) <span class="ev-badge ev-m">[M]</span>. | **Standard v2** (single-region private outbound) or **Premium / Premium v2** (private inbound + multi-region active-active gateway stamps) <span class="ev-badge ev-m">[M]</span>. |
| **Forward-Request Timeout** | Reasoning models (`effort: "medium"` / `"high"`) can spend `20–90s` in reasoning tokens before completing output. | Set `<forward-request timeout="180" ... />` (`120–240s` depending on max reasoning budget) rather than leaving short microservice defaults <span class="ev-badge ev-agree">[Agree]</span>. |
| **SSE Response Buffering** | Buffering `text/event-stream` collapses incremental token delivery into a single delayed payload and inflates gateway memory. | Explicitly set `buffer-response="false"` on `<forward-request>` and **never** attach `<set-body>` or `<find-and-replace>` in `<outbound>` on streaming routes <span class="ev-badge ev-m">[M]</span>. |
| **Request Buffering for Spillover Retry** | Replaying a failed `429` request onto a secondary backend requires the gateway to retain the inbound request payload. | Set `buffer-request-body="true"` inside `<retry>` when payloads are within APIM's retry buffer ceiling, and cap max document attachment size at the orchestrator tier <span class="ev-badge ev-m">[M]</span> <span class="ev-badge ev-arch">[Arch]</span>. |

<div class="arch-diagram">
  <svg viewBox="0 0 760 154" role="img" aria-labelledby="pb2-sse-title pb2-sse-desc" font-family="Segoe UI, Inter, -apple-system, sans-serif">
    <title id="pb2-sse-title">Streaming-Safe Failover Window vs Post-Header Mid-Stream Boundary</title>
    <desc id="pb2-sse-desc">Illustrates Phase 1 Pre-Header Connection where HTTP 429 or 503 triggers safe transparent retry to Standard PAYG, versus Phase 2 Active 200 OK SSE Stream where chunks flow unbuffered directly to the caller and mid-stream drops are handled by idempotent client resume rather than gateway replay.</desc>
    <defs><marker id="sse-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#0f766e"/></marker></defs>
    <rect x="8" y="18" width="232" height="98" rx="6" fill="#eaf7f5" stroke="#0f766e" stroke-width="1.5"/>
    <text x="18" y="37" font-size="9.2" font-weight="700" fill="#115e59">Window A · Pre-Stream Status (Safe Retry)</text>
    <text x="18" y="54" font-size="8.2" fill="#334e68">&bull; Upstream PTU-M returns HTTP 429 / 503</text>
    <text x="18" y="68" font-size="8.2" fill="#334e68">&bull; Zero SSE bytes sent to caller yet</text>
    <text x="18" y="82" font-size="8.2" fill="#334e68">&bull; APIM trips circuit breaker &amp; retries</text>
    <text x="18" y="101" font-size="7.9" font-weight="700" fill="#0f766e">[Transparent Spillover to Standard PAYG]</text>
    <path d="M240 67 H266" stroke="#0f766e" stroke-width="1.8" marker-end="url(#sse-arr)"/>
    <rect x="270" y="18" width="236" height="98" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="280" y="37" font-size="9.2" font-weight="700" fill="#183e62">Window B · HTTP 200 SSE Active</text>
    <text x="280" y="54" font-size="8.2" fill="#334e68">&bull; Headers flushed; chunks stream live</text>
    <text x="280" y="68" font-size="8.2" fill="#334e68">&bull; buffer-response="false" preserves TTFT</text>
    <text x="280" y="82" font-size="8.2" fill="#334e68">&bull; GenAI policy reads final usage chunk</text>
    <text x="280" y="101" font-size="7.9" font-weight="700" fill="#1d4ed8">[Zero Gateway Buffering Overhead]</text>
    <path d="M506 67 H532" stroke="#0f766e" stroke-width="1.8" marker-end="url(#sse-arr)"/>
    <rect x="536" y="18" width="216" height="98" rx="6" fill="#fff7eb" stroke="#d97706" stroke-width="1.4"/>
    <text x="546" y="37" font-size="9.2" font-weight="700" fill="#92400e">Window C · Mid-Stream Socket Drop</text>
    <text x="546" y="54" font-size="8.2" fill="#92400e">&bull; HTTP 200 already committed downstream</text>
    <text x="546" y="68" font-size="8.2" fill="#92400e">&bull; Gateway CANNOT silently restart stream</text>
    <text x="546" y="82" font-size="8.2" fill="#92400e">&bull; Agent harness catches incomplete EOF</text>
    <text x="546" y="101" font-size="7.9" font-weight="700" fill="#b45309">[Orchestrator Emits Clean Retry/Error]</text>
    <text x="10" y="140" font-size="8.3" fill="#526c80">Distinguishing pre-header HTTP 429/503 spillover from post-200 mid-stream socket failures prevents corrupted partial JSON/SSE payloads.</text>
  </svg>
</div>

---

## 2. Three Streaming Pitfalls Observed in Customer-Zero Audits

1. **Outbound `<set-body>` Accidentally Buffers the Entire Stream:** Any policy in `<outbound>` that inspects `context.Response.Body` forces APIM to buffer every SSE `data:` frame until `[DONE]`, turning a `650ms` TTFT stream into a `28s` blocking wait <span class="ev-badge ev-m">[M]</span>. Keep `<outbound>` restricted to lightweight header operations (`<set-header>`) and built-in `azure-openai-emit-token-metric` <span class="ev-badge ev-m">[M]</span>.
2. **Missing `stream_options.include_usage` on Chat Completions:** When callers use `/openai/v1/chat/completions` with `stream: true`, ensure `stream_options: {"include_usage": true}` is present (or use `/openai/v1/responses`, which emits `response.completed` usage natively) so token metrics and `cached_tokens` telemetry populate accurately <span class="ev-badge ev-m">[M]</span>.
3. **Unbounded Raw Document Payloads:** Sending raw 40-page OCR dumps on every turn bloats JSON request bodies past optimal APIM buffer thresholds. Convert binary documents once via Azure Content Understanding (`Playbook 04`) and pass compact structured context + sharded `prompt_cache_key` <span class="ev-badge ev-arch">[Arch]</span>.
