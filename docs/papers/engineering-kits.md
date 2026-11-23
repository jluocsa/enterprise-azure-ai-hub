---
title: "5 Executable MIT Engineering Kits · Linter, APIM XML, Contract CLI & KQL Gates"
description: "Copy-ready and downloadable MIT-licensed automation kits across Playbooks 01–04: pcr_lint.py, ptu-cache-release-gate.kql, apim-foundry-spillover-policy.xml, bcp-failover-readiness-gate.kql, and agent_release_gate.py."
---

<script setup>
import { withBase } from 'vitepress'
</script>

# 5 Executable MIT Engineering Kits

<PageBrief
  stepLabel="EXECUTABLE MIT KITS · PLAYBOOKS 01–04"
  readTime="3 min setup"
  problem="Translating architecture documents into working CI linters, APIM XML policies, and Log Analytics KQL queries manually delays every engagement."
  takeaway="All five kits below are rendered live from docs/public/kits/, zero-dependency, sanitized, and MIT-licensed for immediate repository drop-in."
  csaUse="Use 1-click copy on any code block or click the raw download link to commit directly into CI/CD, Bicep/APIM, and Azure Monitor."
/>

---

## 1. `PCR001–PCR006` Static Prefix CI Linter (`pcr_lint.py`) {#pcr-linter}

Zero-dependency Python 3 AST + regex scanner checking Python, TypeScript, JavaScript, and C# codebases for missing/high-cardinality `prompt_cache_key` (`PCR001`), Pos-1 timestamps (`PCR002`), unsorted `json.dumps` schemas (`PCR003`), early RAG chunks (`PCR004`), unsupported GPT-5.6 PTU-M breakpoints (`PCR005`), and missing `cached_tokens` telemetry (`PCR006`).

Scan-integrity failures (`PCR000`) return exit code `1` rather than a false-green result: missing/inaccessible targets, unsupported explicit file types, empty/excluded-only directories, unreadable/non-UTF-8 sources, and Python parse errors. Run `python pcr_lint.py --self-test` to exercise these failure paths and the six readiness rules; `--json` preserves structured findings for CI <span class="ev-badge ev-arch">[Arch]</span>.

Deeply nested Python source that exceeds the recursion limit during AST parsing or expression rendering also produces `PCR000` (file-level line `1`) instead of a traceback. The CLI continues scanning other files/targets, preserves their findings in text and `--json` output, and exits `1`; incomplete AST results are never certified. The self-test covers both processing phases plus real deep-source CLI fixtures. This is a local scanner integrity rule, not an Azure service limit; it does not raise Python's recursion limit or evaluate source expressions <span class="ev-badge ev-arch">[Arch]</span>.

`PCR001` also rejects blank (empty or whitespace-only) and non-string **Python AST constants**, such as `None`, booleans, numbers, and bytes, on both `responses.create` and `chat.completions.create`. This is a local deterministic-routing readiness policy applied to matching calls regardless of model, not an Azure API requirement. The scanner inspects constant nodes without evaluating source expressions: names, calls, containers, arithmetic, concatenation, and f-strings are not resolved or certified by this check; the existing high-cardinality name heuristic still applies. Retain runtime assertions for computed keys. The self-test covers accepted strings, rejected constants, unevaluated expressions, and text/JSON CLI failures <span class="ev-badge ev-arch">[Arch]</span>.

`PCR003` applies the same object-name heuristic and literal `sort_keys=True` requirement to positional and explicit keyword serialization: `json.dumps(obj=tool_schema)` cannot bypass the check. Missing, false, numeric, and computed sorting flags produce findings for matching expressions; unrelated object names remain outside the heuristic. The self-test covers AST findings, text/JSON CLI failures, and corrected keyword calls. This local prefix-order policy does not evaluate expressions, resolve `**kwargs` or aliases, or certify full canonicalization <span class="ev-badge ev-arch">[Arch]</span>.

Raw download: <a :href="withBase('/kits/pcr_lint.py')" download target="_blank" rel="noopener"><strong><code>Download pcr_lint.py</code></strong></a>

<<< @/public/kits/pcr_lint.py{python}

---

## 2. Two-Regime PTU & Cache SLO Gate (`ptu-cache-release-gate.kql`) {#kql-release-gate}

Computes deployment-wide coincident `DeployPeakNormTPM` alongside per-node, per-shard `HitRatePct`, `CachedSharePct`, `ReadWriteRatio`, and `GateStatus` across pre-GPT-6 (`5.6`) and `GPT-6 / 6.1` normalized token weights.

Raw download: <a :href="withBase('/kits/ptu-cache-release-gate.kql')" download target="_blank" rel="noopener"><strong><code>Download ptu-cache-release-gate.kql</code></strong></a>

<<< @/public/kits/ptu-cache-release-gate.kql{kusto}

---

## 3. SKU-Aware APIM Spillover & FinOps Policy (`apim-foundry-spillover-policy.xml`) {#apim-policy}

Production Azure API Management policy XML enforcing Managed Identity bearer auth, out-of-band `x-cost-center` FinOps telemetry extraction & header stripping, GPT-5.6 PTU-M breakpoint stripping, `429`/`503` `Retry-After` spillover to Standard PAYG, and `buffer-response="false"` unbuffered SSE streaming.

The kit snapshots the original request before PTU-only rewriting, then explicitly selects Standard and restores that original string on a pre-stream `429`/`503` retry. Use the two individual backend IDs, **not** the mixed-SKU pool, so pool selection cannot send a stripped PTU body to Standard. See [per-attempt routing and validation boundaries](/playbooks/apim-gateway/03-circuit-breakers-sku-rewrites#body-safe-per-attempt-routing) <span class="ev-badge ev-arch">[Arch]</span>.

Raw download: <a :href="withBase('/kits/apim-foundry-spillover-policy.xml')" download target="_blank" rel="noopener"><strong><code>Download apim-foundry-spillover-policy.xml</code></strong></a>

<<< @/public/kits/apim-foundry-spillover-policy.xml{xml}

---

## 4. Multi-Region BCP & Cold-Cache Surge Gate (`bcp-failover-readiness-gate.kql`) {#bcp-kql}

Audits multi-region stamp traffic distribution, model snapshot drift (`DistinctSnapshots`), `ColdCacheSurgeRatio` during regional cutovers, and zero escaped `429`/`5xx` errors during Game-Day drills.

The query evaluates **observed stamps only**: a healthy row does not establish cross-region parity or prove that a silent secondary exists. Use the zero-dependency Python companion below to verify exported result objects against a separately maintained expected-stamp manifest <span class="ev-badge ev-arch">[Arch]</span>.

Raw download: <a :href="withBase('/kits/bcp-failover-readiness-gate.kql')" download target="_blank" rel="noopener"><strong><code>Download bcp-failover-readiness-gate.kql</code></strong></a>

<<< @/public/kits/bcp-failover-readiness-gate.kql{kusto}

### Fail-Closed Cross-Region Snapshot Evidence

Create `expected-stamps.json` from the approved deployment inventory, **not** from observed traffic. Declare every expected model/region pair, with at least two distinct regions per model and one identical pinned snapshot across its regions. `reqModel` must match the request-model value emitted by your instrumentation; the sample names below are placeholders <span class="ev-badge ev-arch">[Arch]</span>.

```json
[
  {"reqModel": "model-a", "stampRegion": "eastus", "expectedSnapshot": "snapshot-a"},
  {"reqModel": "model-a", "stampRegion": "westus", "expectedSnapshot": "snapshot-a"}
]
```

Export the KQL results as a JSON **array of row objects** to `bcp-evidence.json` (not CSV or the Azure Monitor REST `tables` envelope). Each row must include `reqModel`, `stampRegion`, positive integer `TotalCalls` and `SuccessfulCalls` (the latter cannot exceed `TotalCalls`), timezone-aware ISO 8601 `LastSeen` and `LastSuccessfulSeen`, and `SnapshotsObserved` as a JSON array, not a stringified array. Additional KQL columns are permitted:

```json
[
  {"reqModel": "model-a", "stampRegion": "eastus", "TotalCalls": 10, "SuccessfulCalls": 8, "LastSeen": "2026-11-20T11:59:00Z", "LastSuccessfulSeen": "2026-11-20T11:58:00Z", "SnapshotsObserved": ["snapshot-a"]},
  {"reqModel": "model-a", "stampRegion": "westus", "TotalCalls": 10, "SuccessfulCalls": 8, "LastSeen": "2026-11-20T11:59:00Z", "LastSuccessfulSeen": "2026-11-20T11:58:00Z", "SnapshotsObserved": ["snapshot-a"]}
]
```

```bash
python bcp_snapshot_gate.py bcp-evidence.json --expected expected-stamps.json
python bcp_snapshot_gate.py --self-test
```

The query exports `LastSeen = max(TimeGenerated)` per model/region; [`TimeGenerated`](https://learn.microsoft.com/en-us/azure/azure-monitor/reference/tables/appdependencies#columns) is when the dependency call was recorded, and KQL [`max()`](https://learn.microsoft.com/en-us/kusto/query/max-aggregation-function?view=azure-monitor) returns the group's maximum <span class="ev-badge ev-m">[M]</span>. It also exports `SuccessfulCalls = countif(successfulInference)` and `LastSuccessfulSeen = maxif(TimeGenerated, successfulInference)`; KQL [`countif()`](https://learn.microsoft.com/en-us/kusto/query/countif-aggregation-function?view=azure-monitor) and [`maxif()`](https://learn.microsoft.com/en-us/kusto/query/maxif-aggregation-function?view=azure-monitor) aggregate only rows satisfying their predicate <span class="ev-badge ev-m">[M]</span>. For this reference gate, `successfulInference` means HTTP `200–299` on an instrumented model dependency. A recent `429`, `5xx`, or missing/invalid status cannot refresh successful evidence, and an error-only stamp must fail even if it reports the pinned snapshot <span class="ev-badge ev-arch">[Arch]</span>.

The companion compares **both** timestamps per stamp against one UTC clock reading at invocation, rejecting missing, invalid, timezone-less, future, or stale timestamps. The default **15-minute maximum age** is a local sign-off recommendation, **not an Azure service limit**; use `--max-age-minutes 30` (positive integer) only when the approved drill/probe cadence requires it <span class="ev-badge ev-agree">[Agree]</span>. The boundary is inclusive and explicit timezone offsets are normalized. The timestamps above illustrate the format only: export fresh telemetry before running the gate.

Fresh timestamps must also be internally consistent: `LastSuccessfulSeen <= LastSeen` for each model/region, because the successful calls aggregated by `maxif()` are a subset of all calls aggregated by `max()`. A later successful timestamp exits `1` with a row/field diagnostic that does not echo timestamp values; increasing the freshness window cannot waive this check. Equal instants and differing explicit timezone offsets remain valid. Offline regressions cover both regions, microsecond boundaries, offset normalization, and CLI failure/recovery. This is a local evidence-consistency rule, not proof of export authenticity or an additional Azure service limit <span class="ev-badge ev-arch">[Arch]</span>.

The companion exits `1` for missing/duplicate/unexpected stamps, empty or malformed evidence rows, zero total/successful calls, inconsistent call counts, invalid/stale/future timestamps, unreported snapshots, within-stamp drift, or any mismatch with the pinned snapshot (including two regions drifting together). Invalid manifests, freshness configuration, unreadable files, invalid UTF-8, and malformed JSON exit `2`; only complete fresh pinned parity with successful call evidence exits `0`. Older exports without `SuccessfulCalls` or `LastSuccessfulSeen` must be regenerated with the updated query, not filled from total traffic. Scope the query/export to the declared models and drill window. The existing query groups by **model/region**, not deployment, so multiple same-region backends are not independently certified <span class="ev-badge ev-arch">[Arch]</span>.

This verifies the snapshot portion of `B2` and recent successful model/region evidence coverage for `B11`, **not** content-filter parity, telemetry authenticity, continuous availability, RTO, capacity, or all `B1–B12` controls. A recent timestamp or HTTP `2xx` does not authenticate an export or prove streamed output completed correctly; retain trusted model-dependency telemetry provenance and clock synchronization. Continue the [Game-Day probes](/playbooks/multi-region-bcp/05-gameday-failover-drills) and review KQL error/cache metrics separately <span class="ev-badge ev-val">[Validate]</span>. `npm run verify` executes the companion's offline regression suite; it does not execute KQL against Azure.

Both the expected-stamp manifest and evidence export must use **unique member names within every JSON object**, including nested metadata. The companion rejects duplicates before evaluation: `"SuccessfulCalls": 0` followed by `"SuccessfulCalls": 8` must not conceal an error-only stamp, and duplicate snapshot pins must not silently redefine the approved inventory. Identical duplicate values and escape-equivalent names are also rejected; the same name in separate objects remains valid. Ambiguous JSON exits `2` with no stdout or traceback and a diagnostic that does not echo member names or values. This is a local input-integrity rule, not an Azure service requirement or evidence-authenticity check; offline CLI regressions cover both inputs <span class="ev-badge ev-arch">[Arch]</span>.

JSON exceeding the Python parser's nesting limit in either input also exits `2` with a sanitized input-error diagnostic, no stdout, and no traceback. Both files must parse completely before evidence is evaluated; a valid stamp row followed by excessively nested metadata cannot produce a partial pass. The offline self-test covers deep arrays and objects in both inputs and preserves ordinary nested metadata. This handles parser recursion failures, not a fixed portable depth budget, file-size limit, memory-exhaustion guard, or evidence-authenticity check; it does not raise Python's recursion limit <span class="ev-badge ev-arch">[Arch]</span>.

File-read failures in either input (missing files, directories, permission/I/O errors, or invalid UTF-8) exit `2` with the fixed stderr diagnostic `BCP snapshot gate input error: could not read UTF-8 JSON input.` and no stdout or traceback. Paths, file content, byte offsets, and operating-system exception details are not echoed. Both files must be read completely before evaluation; a valid JSON prefix followed by undecodable bytes cannot produce a partial pass. Offline regressions cover both inputs, injected permission/I/O failures without platform-specific permissions, and recovery with valid files. This is a local diagnostic-privacy rule, not an Azure requirement or evidence-authenticity check; existing JSON/configuration and evidence-failure diagnostics remain distinct <span class="ev-badge ev-arch">[Arch]</span>.

Companion download: <a :href="withBase('/kits/bcp_snapshot_gate.py')" download target="_blank" rel="noopener"><strong><code>Download bcp_snapshot_gate.py</code></strong></a>

---

## 5. Deterministic Agent Release Contract CLI (`agent_release_gate.py`) {#agent-gate}

Zero-dependency Python 3 CLI (`ARG001–ARG007`) verifying offline `trace.jsonl` evaluation runs against CLI flags or a JSON acceptance contract exported from the [Interactive Sandbox & Eval Contract Builder](/studio/#agent-eval)—checking schema integrity (`ARG001`), required/forbidden tool governance (`ARG002`), `100%` resolved `[cite:ID]` grounding (`ARG003`), Pass-2 `cached_tokens >= 1,024` parity (`ARG004`), p95 latency budgets (`ARG005`), Foundry IQ ACL security trimming (`ARG006`), and metadata-only OTel privacy (`ARG007`).

`ARG003` also rejects malformed `[cite:` markers (empty/invalid IDs, nested markers, or missing closing brackets) rather than silently ignoring them. See the [citation syntax contract](/playbooks/agentic-rag-evals/04-deterministic-eval-contracts#fail-closed-citation-syntax-arg003) for the accepted ID alphabet and semantic-review boundaries <span class="ev-badge ev-arch">[Arch]</span>.

Trace and contract JSON also reject duplicate member names within any object, including nested metadata and escape-equivalent names, before a later value can overwrite an earlier one. Duplicates exit `2` with a sanitized stderr diagnostic and no stdout in either text or `--json` mode. See the [unambiguous-input contract](/playbooks/agentic-rag-evals/04-deterministic-eval-contracts#unambiguous-json-inputs); the kit's self-test exercises these CLI failures <span class="ev-badge ev-arch">[Arch]</span>.

Trace file read failures (missing files, directories, permission/I/O errors, or invalid UTF-8) exit `2` with a sanitized `ARG001` stderr diagnostic, no stdout, and no traceback. No partial evidence is evaluated after a read failure; paths and operating-system error details are not echoed. These offline failure paths are covered by the existing self-test in `npm run verify` <span class="ev-badge ev-arch">[Arch]</span>.

Repeated `(case_id, pass_number)` pairs also block release with `ARG001` and exit `1`, preventing copied fast turns from producing a passing padded latency sample. Distinct passes for the same case remain valid; duplicate diagnostics report record ordinals without echoing identifiers. Other findings and the full JSON record count are preserved. See the [unique case/pass evidence contract](/playbooks/agentic-rag-evals/04-deterministic-eval-contracts#unique-case-pass-evidence) for harness identifier guidance and authenticity/completeness boundaries; offline text/JSON regressions run in `npm run verify` <span class="ev-badge ev-arch">[Arch]</span>.

Unknown top-level acceptance-contract fields also exit `2` before reading evidence, preventing misspelled tool or latency controls from silently using defaults. The six enforcement fields plus `contract_version`, `track`, and `metadata` are accepted; place custom annotations inside `metadata`. Diagnostics never echo unknown names or values. See the [acceptance-configuration contract](/playbooks/agentic-rag-evals/04-deterministic-eval-contracts#fail-closed-acceptance-configuration) for compatibility and enforcement boundaries; deterministic regressions cover text/JSON failures, validation precedence, and preserved metadata/defaults <span class="ev-badge ev-arch">[Arch]</span>.

```bash
python3 agent_release_gate.py --self-test
python3 agent_release_gate.py ./artifacts/trace.jsonl --contract ./agent-release-contract.json
```

Raw download: <a :href="withBase('/kits/agent_release_gate.py')" download target="_blank" rel="noopener"><strong><code>Download agent_release_gate.py</code></strong></a>

<<< @/public/kits/agent_release_gate.py{python}
