---
title: "04 · Deterministic Acceptance Contracts vs. Advisory LLM Judges"
description: Structuring non-flaky CI/CD evaluation pipelines for tool-using and RAG agents—separating hard deterministic release gates from advisory LLM-as-judge quality scoring.
---

# 04 · Deterministic Acceptance Contracts vs. Advisory LLM Judges

<PlaybookMeta
  track="04 · Sandboxed Agentic Harness, Foundry IQ RAG & 7-Layer Evals"
  verified="2026-11-19 PST"
  status="Live v2.0"
  studioHref="/studio/#agent-eval"
  studioLabel="Eval Contract Builder →"
  kitHref="/papers/engineering-kits#agent-gate"
  kitLabel="agent_release_gate.py →"
/>

<PageBrief
  stage="validate"
  readTime="4 min read"
  problem="Gating pull requests solely on LLM-as-judge 1–5 rubric scores introduces non-deterministic CI flakiness, judge prompt-injection blind spots, and high PR latency."
  takeaway="Enforce the Golden Separation Rule: Deterministic checks gate merges; calibrated LLM judges score semantic quality trends and flag edge cases for human review."
  csaUse="Adopt the two-tier evaluation matrix below and wire agent_release_gate.py into GitHub Actions / Azure Pipelines."
/>

## 1. The Golden Rule: Deterministic Gates Block; LLM Judges Advise `[Arch]`

<div class="arch-diagram">
  <svg viewBox="0 0 760 154" role="img" aria-labelledby="pb4-ev-title pb4-ev-desc" font-family="Segoe UI, Inter, -apple-system, sans-serif">
    <title id="pb4-ev-title">Two-Tier Agent Evaluation Pipeline: Deterministic Blockers vs Calibrated Judges</title>
    <desc id="pb4-ev-desc">Shows Agent Golden Run Evidence JSONL flowing first into Tier A Deterministic Contract Verifier (Hard CI Merge Blocker checking AST lint, tool schema, citation IDs, forbidden actions, and Pass-2 cache hit) and second into Tier B Foundry / DeepEval / Waza Calibrated Judges (Release Scorecard tracking groundedness, completeness, and safety parity).</desc>
    <defs><marker id="ev-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#0f766e"/></marker></defs>
    <rect x="8" y="20" width="182" height="94" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="16" y="39" font-size="9.1" font-weight="700" fill="#183e62">1. Golden Corpus Execution</text>
    <text x="16" y="55" font-size="8.1" fill="#334e68">&bull; 50–200 sanitized cases</text>
    <text x="16" y="69" font-size="8.1" fill="#334e68">&bull; Waza skill trajectories</text>
    <text x="16" y="83" font-size="8.1" fill="#334e68">&bull; Emits trace.jsonl evidence</text>
    <text x="16" y="101" font-size="7.8" font-weight="700" fill="#1d4ed8">[2-Pass Cache + Tool Log]</text>
    <path d="M190 67 H218" stroke="#0f766e" stroke-width="1.8" marker-end="url(#ev-arr)"/>
    <rect x="222" y="20" width="256" height="94" rx="6" fill="#eaf7f5" stroke="#0f766e" stroke-width="1.5"/>
    <text x="232" y="39" font-size="9.2" font-weight="700" fill="#115e59">2. Tier A · Deterministic Gate (BLOCKS CI)</text>
    <text x="232" y="55" font-size="8.1" fill="#334e68">&bull; PCR001–006 static prefix AST lint</text>
    <text x="232" y="69" font-size="8.1" fill="#334e68">&bull; Citation IDs exist in retrieved docs</text>
    <text x="232" y="83" font-size="8.1" fill="#334e68">&bull; Zero forbidden tools · Pass-2 cached &ge;1024</text>
    <text x="232" y="101" font-size="7.8" font-weight="700" fill="#0f766e">[100% Reproducible · Sub-Second CLI]</text>
    <path d="M478 67 H506" stroke="#0f766e" stroke-width="1.8" marker-end="url(#ev-arr)"/>
    <rect x="510" y="20" width="242" height="94" rx="6" fill="#fff7eb" stroke="#d97706" stroke-width="1.4"/>
    <text x="520" y="39" font-size="9.2" font-weight="700" fill="#92400e">3. Tier B · Calibrated LLM Judges</text>
    <text x="520" y="55" font-size="8.1" fill="#92400e">&bull; Foundry Evals / DeepEval rubrics</text>
    <text x="520" y="69" font-size="8.1" fill="#92400e">&bull; Groundedness, Relevance &amp; Safety</text>
    <text x="520" y="83" font-size="8.1" fill="#92400e">&bull; Model-upgrade delta (&le;2% drop)</text>
    <text x="520" y="101" font-size="7.8" font-weight="700" fill="#b45309">[Release Advisory &amp; Trend Gate]</text>
    <text x="10" y="138" font-size="8.3" fill="#526c80">Separating deterministic contract invariants from statistical rubric judges eliminates CI flakiness while catching subtle quality drift.</text>
  </svg>
</div>

---

## 2. Five-Layer Agent Verification Matrix

| Verification Layer | Tool / Mechanism | Hard CI Gate vs. Release Scorecard |
| :--- | :--- | :--- |
| **1. Static Prompt & Prefix Lint** | [`pcr_lint.py`](/papers/engineering-kits#pcr-linter) (`PCR001–PCR006`) | **Hard PR Blocker** (`0` violations). |
| **2. Skill Routing & Trajectory Evals** | [`microsoft/waza`](https://github.com/microsoft/waza) skill evaluation tasks | **Hard PR Blocker** on expected skill invocation & required tool sequence. |
| **3. Offline Trace Contract Verification** | [`agent_release_gate.py`](/papers/engineering-kits#agent-gate) (`ARG001–ARG007`) + [`AgentEvalBuilder`](/studio/#agent-eval) | **Hard PR / Release Blocker** verifying JSON schema compliance (`ARG001`), required/forbidden tool governance (`ARG002`), `100%` resolved citation IDs (`ARG003`), Pass-2 `cached_tokens ≥ 1,024` (`ARG004`), p95 turn latency ceiling (`ARG005`), Foundry IQ ACL security trimming `acl_trimmed != false` (`ARG006`), and metadata-only OTel privacy `raw_prompt_logged == false` (`ARG007`). |
| **4. Semantic Quality & Groundedness** | Azure AI Foundry Evaluation SDK (`GroundednessEvaluator`, `RelevanceEvaluator`, `TaskAdherenceEvaluator`) <span class="ev-badge ev-m">[M]</span> | **Release Cutover Gate** on nightly / pre-prod golden suite (`≤2%` score regression across model snapshot upgrades) <span class="ev-badge ev-agree">[Agree]</span>. |
| **5. Multi-Turn Adversarial & Safety Red-Teaming** | Azure AI Content Safety + PyRIT / multi-turn safety baselines (`Indirect Prompt Injection`, `Cross-Tenant Probe`) <span class="ev-badge ev-m">[M]</span> | **Mandatory Pre-Cutover Sign-Off** (`0` critical jailbreaks or unauthorized tool invocations). |

### Fail-Closed Trace Evidence (`ARG001`)

<span class="ev-badge ev-arch">[Arch]</span> Every non-blank JSONL line must be a complete turn object. Missing evidence must block release rather than silently defaulting token counts to zero or omitting a turn from the latency sample.

| Required field | Trace contract |
| :--- | :--- |
| `case_id`, `status` | Non-empty strings; terminal `status` must be `"ok"`. |
| `assistant_response` | String; an empty answer is structurally valid, not proof of semantic quality. |
| `tools_called`, `retrieved_doc_ids` | Arrays of non-empty strings; use `[]` when no tools/documents were involved. |
| `pass_number` | Integer `>=1`; booleans, numeric strings, and fractional values are rejected. |
| `input_tokens`, `cached_tokens` | Integers `>=0`, with `cached_tokens <= input_tokens`. |
| `duration_ms` | Finite number `>=0` for every turn; missing values, `NaN`, and infinities are rejected. |
| `acl_trimmed` | Explicit boolean required on non-empty retrievals when ACL enforcement is enabled; `false` triggers `ARG006`. |
| `raw_prompt_logged` | Explicit boolean required when metadata-only telemetry enforcement is enabled; `true` triggers `ARG007`. |
| `otel_capture_message_content` | Optional; must be a boolean when present and triggers `ARG007` when `true` under metadata-only enforcement. |

All supplied ACL/privacy flags must be booleans even when their enforcement is disabled. Structurally invalid turns produce `ARG001` failures and exit `1` (including under `--json`); malformed JSON produces a line-numbered `ARG001` error on stderr and exit `2`. Diagnostics for malformed evidence identify the row/field without echoing raw turn content. The zero-dependency `python3 docs/public/kits/agent_release_gate.py --self-test` regression suite is included in `npm run verify`.
