---
title: "02 · Three-Tier ACA Sandboxed Runtime, AG-UI SSE & Document Pipeline"
description: Reference design for isolating enterprise agent execution using a stateless orchestrator, microVM ACA session pools, typed AG-UI SSE events, and Azure Content Understanding.
---

# 02 · Three-Tier ACA Sandboxed Runtime, AG-UI SSE & Document Pipeline

<PlaybookMeta
  track="04 · Sandboxed Agentic Harness, Foundry IQ RAG & 7-Layer Evals"
  verified="2026-11-19 PST"
  status="Live v2.0"
/>

<PageBrief
  stage="design"
  readTime="5 min read"
  problem="Co-locating LLM agent SDKs, shell/Python tools, and user-uploaded documents inside a multi-tenant FastAPI/Node server creates path-traversal, credential-exfiltration, and noisy-neighbor risks."
  takeaway="Keep the orchestrator 100% SDK-free: forward scoped bearer tokens and proxy typed AG-UI SSE events line-by-line from microVM-isolated ACA Session Containers, deploying images strictly by Git SHA."
  csaUse="Use these five architectural invariants as the security review baseline for any code-executing or file-processing enterprise agent."
/>

## 1. Five Architectural Invariants of the 3-Tier Agent Harness `[Arch]`

| Invariant | Implementation Mechanism | Failure Prevented |
| :--- | :--- | :--- |
| **1. Orchestrator Never Runs the Agent SDK** | The public-facing orchestrator validates session IDs (`^[0-9a-f]{16}$`), mints short-lived `DefaultAzureCredential` Cognitive Services tokens, and proxies SSE lines with **zero buffering**. | Eliminates arbitrary code/tool execution and filesystem cross-contamination on the shared control plane. |
| **2. One MicroVM Container Per Session** | Production allocates isolated containers via **Azure Container Apps Dynamic Sessions / Sandbox Pools** (`cooldown=300s`, `ready-sessions` tuned to concurrency) <span class="ev-badge ev-m">[M]</span>. | Hypervisor-level memory, network, and `WORKSPACE` filesystem isolation per user session <span class="ev-badge ev-m">[M]</span>. |
| **3. Strict Upload Sanitization + Content Understanding** | Enforce extension allowlists, `50 MB` streaming size caps, and `os.path.realpath(dest)` workspace containment; convert binary PDFs/DOCX/XLSX via **ADLS Gen2 + Azure Content Understanding** into clean `.md` siblings <span class="ev-badge ev-m">[M]</span>. | Prevents path traversal (`../`) while giving the LLM table-accurate Markdown instead of garbled PDF text extraction. |
| **4. Typed `AG-UI` Streaming Protocol** | Emit structured `RUN_STARTED`, `TEXT_MESSAGE_START/CONTENT/END`, `TOOL_CALL_START/ARGS/END`, `RUN_ERROR`, and `RUN_FINISHED` JSON SSE frames (suppressing internal SDK plumbing tools). | Deterministic frontend `useReducer` state transitions with clean timeout/error terminal states. |
| **5. Immutable Git-SHA Image Tags (Never `:latest`)** | Tag and deploy all ACA apps and session pools with `git rev-parse --short HEAD` (`repo:$SHA`). | Azure Container Apps caches tag-to-digest resolution per revision string—deploying `:latest` silently no-ops and leaves stale code running! |

---

## 2. Document Upload & Layout-Faithful Conversion Flow

```text
Browser (Multipart POST /sessions/{id}/upload, ≤50 MB)
  └─► Orchestrator
        1. Stream-validate size + sanitize filename (PurePosixPath(name).name)
        2. Forward raw file to Session Container WORKSPACE + record in .uploaded_files.json
        3. Persist original binary to ADLS Gen2 (documents/{session_id}/{filename})
        4. Convert to Markdown:
             • UTF-8 text/CSV/JSON/XML → direct verified decode
             • Binary PDF / DOCX / PPTX / XLSX → Azure Content Understanding layout extraction [M]
        5. Persist {filename}.md to ADLS + forward {filename}.md into Session Container WORKSPACE
```

::: warning Fail-Closed Document Processing
Do not silently fall back to lossy plain-text scraping when regulated financial tables or compliance schedules fail conversion. Return an explicit `503` / actionable conversion status so agents never score incomplete tables <span class="ev-badge ev-arch">[Arch]</span>.
:::
