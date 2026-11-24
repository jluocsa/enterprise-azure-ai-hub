---
title: "7 Executable MIT Engineering Kits · Linter, APIM XML, Eval, Data & KQL Gates"
description: "Copy-ready and downloadable MIT-licensed automation kits across Playbooks 01–05: pcr_lint.py, ptu-cache-release-gate.kql, apim-foundry-spillover-policy.xml, bcp-failover-readiness-gate.kql, agent_release_gate.py, data_readiness_gate.py, and data-grounding-freshness-gate.kql."
---

<script setup>
import { withBase } from 'vitepress'
</script>

# 7 Executable MIT Engineering Kits

<PageBrief
  stepLabel="EXECUTABLE MIT KITS · PLAYBOOKS 01–05"
  readTime="3 min setup"
  problem="Translating architecture documents into working CI linters, APIM XML policies, data governance verifiers, and Log Analytics KQL queries manually delays every engagement."
  takeaway="All seven kits below are rendered live from docs/public/kits/, zero-dependency, sanitized, and MIT-licensed for immediate repository drop-in."
  csaUse="Use 1-click copy on any code block or click the raw download link to commit directly into CI/CD, Bicep/APIM, and Azure Monitor."
/>

---

## 1. `PCR001–PCR006` Static Prefix CI Linter (`pcr_lint.py`) {#pcr-linter}

Zero-dependency Python 3 AST + regex scanner checking Python, TypeScript, JavaScript, and C# codebases for missing/high-cardinality `prompt_cache_key` (`PCR001`), Pos-1 timestamps (`PCR002`), unsorted `json.dumps` schemas (`PCR003`), early RAG chunks (`PCR004`), unsupported GPT-5.6 PTU-M breakpoints (`PCR005`), and missing `cached_tokens` telemetry (`PCR006`).

Scan-integrity failures (`PCR000`) return exit code `1` rather than a false-green result: missing/inaccessible targets, unsupported explicit file types, empty/excluded-only directories, unreadable/non-UTF-8 sources, and Python parse errors. Run `python pcr_lint.py --self-test` to exercise these failure paths and the six readiness rules; `--json` preserves structured findings for CI <span class="ev-badge ev-arch">[Arch]</span>.

Deeply nested Python source that exceeds the recursion limit during AST parsing or expression rendering also produces `PCR000` (file-level line `1`) instead of a traceback. The CLI continues scanning other files/targets, preserves their findings in text and `--json` output, and exits `1`; incomplete AST results are never certified. The self-test covers both processing phases plus real deep-source CLI fixtures. This is a local scanner integrity rule, not an Azure service limit; it does not raise Python's recursion limit or evaluate source expressions <span class="ev-badge ev-arch">[Arch]</span>.

`PCR001` also rejects blank (empty or whitespace-only) and non-string **Python AST constants**, such as `None`, booleans, numbers, and bytes, on both `responses.create` and `chat.completions.create`. It rejects structurally non-string keys too: list, tuple, set, and dictionary displays (including empty, nested, starred, and unpacked forms), list/set/dictionary comprehensions, and generator expressions. These expressions cannot yield a string on successful evaluation, even when their elements are computed. Detection uses only the outer AST node type; it never evaluates or iterates source expressions <span class="ev-badge ev-arch">[Arch]</span>.

This is a local deterministic-routing readiness policy applied to matching calls regardless of model, not an Azure API requirement. Names, calls (including `set()` and `str(...)`), subscripts, conditionals, arithmetic, concatenation, and f-strings remain unresolved, not certified; the existing high-cardinality name heuristic still applies. Retain runtime assertions for computed keys. Offline self-tests cover both APIs, exact finding locations, text/JSON CLI exit `1` without a pass message, and exit `0` recovery after correcting keys. Undefined names, division by zero inside a list, and oversized unevaluated expressions do not crash scanning. Existing AST recursion failures still produce `PCR000` <span class="ev-badge ev-arch">[Arch]</span>.

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

The companion lowercases `stampRegion` in both inputs before counting distinct regions, matching evidence, and detecting duplicates. `eastus` and `EASTUS` cannot masquerade as two regions or conceal a missing secondary: duplicate manifest identities exit `2`, while duplicate evidence identities exit `1`. A single mixed-case spelling of each genuinely distinct region remains valid; model names and snapshot pins retain exact, case-sensitive matching. This is a local identity policy, not region-name validation or alias resolution; use approved region identifiers rather than display names. Offline regressions cover duplicate aliases, missing-secondary detection, mixed-case recovery, and preserved model/snapshot identity <span class="ev-badge ev-arch">[Arch]</span>.

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

When `SuccessfulCalls == TotalCalls`, that subset is the entire group, so `LastSuccessfulSeen` must **equal** `LastSeen` after timezone normalization. Different instants block sign-off with exit `1`, even if both timestamps are fresh; widening `--max-age-minutes` cannot waive the contradiction. Mixed-success groups may still have an earlier last success, and equal timestamps remain valid even with different offset spellings or mixed outcomes. Re-export inconsistent aggregates rather than editing evidence to pass. Offline regressions cover both stamps, single-call groups, microsecond differences, timezone-equivalent instants, and CLI failure/recovery without echoing evidence values. This local consistency rule does not authenticate exports or require every call to succeed <span class="ev-badge ev-arch">[Arch]</span>.

The companion exits `1` for missing/duplicate/unexpected stamps, empty or malformed evidence rows, zero total/successful calls, inconsistent call counts, invalid/stale/future timestamps, unreported snapshots, within-stamp drift, or any mismatch with the pinned snapshot (including two regions drifting together). Invalid manifests, freshness configuration, unreadable files, invalid UTF-8, and malformed JSON exit `2`; only complete fresh pinned parity with successful call evidence exits `0`. Older exports without `SuccessfulCalls` or `LastSuccessfulSeen` must be regenerated with the updated query, not filled from total traffic. Scope the query/export to the declared models and drill window. The existing query groups by **model/region**, not deployment, so multiple same-region backends are not independently certified <span class="ev-badge ev-arch">[Arch]</span>.

This verifies the snapshot portion of `B2` and recent successful model/region evidence coverage for `B11`, **not** content-filter parity, telemetry authenticity, continuous availability, RTO, capacity, or all `B1–B12` controls. A recent timestamp or HTTP `2xx` does not authenticate an export or prove streamed output completed correctly; retain trusted model-dependency telemetry provenance and clock synchronization. Continue the [Game-Day probes](/playbooks/multi-region-bcp/05-gameday-failover-drills) and review KQL error/cache metrics separately <span class="ev-badge ev-val">[Validate]</span>. `npm run verify` executes the companion's offline regression suite; it does not execute KQL against Azure.

Both the expected-stamp manifest and evidence export must use **unique member names within every JSON object**, including nested metadata. The companion rejects duplicates before evaluation: `"SuccessfulCalls": 0` followed by `"SuccessfulCalls": 8` must not conceal an error-only stamp, and duplicate snapshot pins must not silently redefine the approved inventory. Identical duplicate values and escape-equivalent names are also rejected; the same name in separate objects remains valid. Ambiguous JSON exits `2` with no stdout or traceback and a diagnostic that does not echo member names or values. This is a local input-integrity rule, not an Azure service requirement or evidence-authenticity check; offline CLI regressions cover both inputs <span class="ev-badge ev-arch">[Arch]</span>.

JSON exceeding the Python parser's nesting limit in either input also exits `2` with a sanitized input-error diagnostic, no stdout, and no traceback. Both files must parse completely before evidence is evaluated; a valid stamp row followed by excessively nested metadata cannot produce a partial pass. The offline self-test covers deep arrays and objects in both inputs and preserves ordinary nested metadata. This handles parser recursion failures, not a fixed portable depth budget, file-size limit, memory-exhaustion guard, or evidence-authenticity check; it does not raise Python's recursion limit <span class="ev-badge ev-arch">[Arch]</span>.

Both inputs also reject unquoted `NaN`, `Infinity`, and `-Infinity` anywhere, including otherwise ignored nested metadata. These non-standard JSON numeric constants exit `2` before sign-off, with no stdout or traceback and a fixed diagnostic that does not echo paths, member names, or values. Quoted strings such as `"NaN"` and ordinary JSON metadata remain permitted; this parsing rule does not validate metadata semantics or add a finite-range check for standard JSON numbers. Offline CLI regressions cover both files, direct and nested constants after a valid first row, and recovery with valid metadata. This is a local input-integrity policy, not an Azure service requirement or evidence-authenticity check <span class="ev-badge ev-arch">[Arch]</span>.

Companion download: <a :href="withBase('/kits/bcp_snapshot_gate.py')" download target="_blank" rel="noopener"><strong><code>Download bcp_snapshot_gate.py</code></strong></a>

---

## 5. Deterministic Agent Release Contract CLI (`agent_release_gate.py`) {#agent-gate}

Zero-dependency Python 3 CLI (`ARG001–ARG007`) verifying offline `trace.jsonl` evaluation runs against CLI flags or a JSON acceptance contract exported from the [Interactive Sandbox & Eval Contract Builder](/studio/#agent-eval)—checking schema integrity (`ARG001`), required/forbidden tool governance (`ARG002`), `100%` resolved `[cite:ID]` grounding (`ARG003`), Pass-2 `cached_tokens >= 1,024` parity (`ARG004`), p95 latency budgets (`ARG005`), Foundry IQ ACL security trimming (`ARG006`), and metadata-only OTel privacy (`ARG007`).

`ARG003` also rejects malformed `[cite:` markers (empty/invalid IDs, nested markers, or missing closing brackets) rather than silently ignoring them. See the [citation syntax contract](/playbooks/agentic-rag-evals/04-deterministic-eval-contracts#fail-closed-citation-syntax-arg003) for the accepted ID alphabet and semantic-review boundaries <span class="ev-badge ev-arch">[Arch]</span>.

An optional `"require_citations": true` contract field also blocks empty or uncited answers with `ARG003`, even when retrieved documents are present. Omitted or `false` preserves existing behavior and Studio compatibility; non-boolean values exit `2` before evidence is read. The rule applies to every valid turn, so use separate contracts for intentionally uncited refusals or tool-only runs. See the [citation-presence contract](/playbooks/agentic-rag-evals/04-deterministic-eval-contracts#opt-in-citation-presence-arg003) for offline regression coverage and semantic-review limits: citation presence and ID resolution do not prove source support or claim completeness <span class="ev-badge ev-arch">[Arch]</span>.

Trace and contract JSON also reject duplicate member names within any object, including nested metadata and escape-equivalent names, before a later value can overwrite an earlier one. Duplicates exit `2` with a sanitized stderr diagnostic and no stdout in either text or `--json` mode. See the [unambiguous-input contract](/playbooks/agentic-rag-evals/04-deterministic-eval-contracts#unambiguous-json-inputs); the kit's self-test exercises these CLI failures <span class="ev-badge ev-arch">[Arch]</span>.

Trace file read failures (missing files, directories, permission/I/O errors, or invalid UTF-8) exit `2` with a sanitized `ARG001` stderr diagnostic, no stdout, and no traceback. No partial evidence is evaluated after a read failure; paths and operating-system error details are not echoed. These offline failure paths are covered by the existing self-test in `npm run verify` <span class="ev-badge ev-arch">[Arch]</span>.

All per-turn failure reports now use record ordinals instead of echoing case IDs, status text, tool names, citation IDs, or answers into CI logs. Rule IDs, numeric metrics, verdicts, exit codes, and JSON counts are preserved; resolve `row-N` against the original trace in restricted storage. See the [metadata-only reporting contract](/playbooks/agentic-rag-evals/04-deterministic-eval-contracts#metadata-only-failure-reports) for message-format compatibility and offline text/JSON regressions covering private strings, terminal controls, and output-encoding hazards. This policy does not sanitize the source artifact <span class="ev-badge ev-arch">[Arch]</span>.

Repeated `(case_id, pass_number)` pairs also block release with `ARG001` and exit `1`, preventing copied fast turns from producing a passing padded latency sample. Distinct passes for the same case remain valid; duplicate diagnostics report record ordinals without echoing identifiers. Other findings and the full JSON record count are preserved. See the [unique case/pass evidence contract](/playbooks/agentic-rag-evals/04-deterministic-eval-contracts#unique-case-pass-evidence) for harness identifier guidance and authenticity/completeness boundaries; offline text/JSON regressions run in `npm run verify` <span class="ev-badge ev-arch">[Arch]</span>.

An optional `expected_case_passes` acceptance-contract inventory enforces an exact golden-run corpus: missing and unexpected pairs fail `ARG001` with exit `1`, in addition to the existing duplicate checks. This prevents a clean subset or added distinct fast turns from passing sign-off. Invalid inventories exit `2` before evidence is read; omitted inventories preserve existing behavior and Studio compatibility. Approve the inventory independently of the trace; completeness is not proof of authenticity or quality. See the [inventory format and offline regressions](/playbooks/agentic-rag-evals/04-deterministic-eval-contracts#expected-golden-run-inventory-arg001) <span class="ev-badge ev-arch">[Arch]</span>.

Unknown top-level acceptance-contract fields also exit `2` before reading evidence, preventing misspelled tool or latency controls from silently using defaults. Only the documented enforcement fields plus `contract_version`, `track`, and `metadata` are accepted; place custom annotations inside `metadata`. Diagnostics never echo unknown names or values. See the [acceptance-configuration contract](/playbooks/agentic-rag-evals/04-deterministic-eval-contracts#fail-closed-acceptance-configuration) for compatibility and enforcement boundaries; deterministic regressions cover text/JSON failures, validation precedence, and preserved metadata/defaults <span class="ev-badge ev-arch">[Arch]</span>.

Contradictory tool policies also exit `2` before evidence is read: effective `required_tools` and `forbidden_tools` must not overlap, including the default denylist when omitted. Diagnostics identify the two fields without echoing tool names; explicit empty denylists and exact case-sensitive matching remain supported. The same [acceptance-configuration contract](/playbooks/agentic-rag-evals/04-deterministic-eval-contracts#fail-closed-acceptance-configuration) describes this local consistency rule and its offline text/JSON regressions <span class="ev-badge ev-arch">[Arch]</span>.

```bash
python3 agent_release_gate.py --self-test
python3 agent_release_gate.py ./artifacts/trace.jsonl --contract ./agent-release-contract.json
```

Raw download: <a :href="withBase('/kits/agent_release_gate.py')" download target="_blank" rel="noopener"><strong><code>Download agent_release_gate.py</code></strong></a>

<<< @/public/kits/agent_release_gate.py{python}

---

## 6. AI Data Strategy & Governance Release Gate CLI (`data_readiness_gate.py`) {#data-gate}

Zero-dependency Python 3 CLI (`DRG001–DRG007`) verifying offline AI data-plane readiness snapshots against CLI defaults or a `data-readiness-contract.json` exported from the [Interactive AI Data Strategy Advisor](/studio/#data-strategy). Enforces Fabric / OneLake AI-Ready Gold lineage & dedicated interactive F-SKU isolation (`DRG002`), Microsoft Purview DSPM for AI & sensitivity label inheritance (`DRG003`), Entra ACL & ethical-wall revocation/tombstoning SLAs (`DRG004`), Azure Cosmos DB `DiskANN`+`RRF` partition scoping & AI Search blue-green alias/regional lag parity (`DRG005`), corpus chunk hygiene & indirect prompt-injection anti-poisoning (`DRG006`), and Pos 6 cache-safe freshness + eval flywheel contracts (`DRG007`) <span class="ev-badge ev-arch">[Arch]</span>.

Fail-closed input rules (`DRG001`) exit `2` with no stdout on unreadable/invalid UTF-8 files, duplicate JSON object keys (including nested objects), excessive JSON nesting, or unsupported top-level contract fields. See [Playbook 05 · Ch 05](/playbooks/ai-data-strategy/05-data-governance-release-gates#drg-contract) for the full contract specification.

An optional `expected_source_ids` contract inventory requires exactly the approved datasets, preventing a clean subset or substituted corpus from passing `DRG001`. Missing/unexpected sources exit `1`; invalid inventories exit `2` before evidence is read. Omission preserves Studio compatibility and defaults. Approve the inventory independently; completeness does not prove authenticity or grounding quality. See the [inventory format and offline regressions](/playbooks/ai-data-strategy/05-data-governance-release-gates#expected-source-inventory) <span class="ev-badge ev-arch">[Arch]</span>.

Every dataset's `lineage_sha256` must contain exactly 64 ASCII hexadecimal characters. Missing or malformed digests fail `DRG002` with exit `1`; uppercase and mixed-case hex remain valid. Diagnostics use dataset ordinals without echoing digest or source values. This verifies syntax only, not provenance, approved lineage parity, or zero-copy ingestion; see the [lineage contract and offline regressions](/playbooks/ai-data-strategy/05-data-governance-release-gates#lineage-digest-syntax) <span class="ev-badge ev-arch">[Arch]</span>.

```bash
python3 data_readiness_gate.py --self-test
python3 data_readiness_gate.py ./artifacts/data-snapshot.json --contract ./data-readiness-contract.json --json
```

Raw download: <a :href="withBase('/kits/data_readiness_gate.py')" download target="_blank" rel="noopener"><strong><code>Download data_readiness_gate.py</code></strong></a>

<<< @/public/kits/data_readiness_gate.py{python}

---

## 7. AI Data Grounding, Purview Label & Freshness Gate (`data-grounding-freshness-gate.kql`) {#data-kql}

Audits live Microsoft Fabric IQ, Azure AI Search, and Azure Cosmos DB hybrid retrieval telemetry for missing Purview sensitivity labels (`D5`), untrimmed ACL queries (`D5`), ACL revocation lag breaches (`D6`), Cosmos DB hybrid RU spikes / `429` throttling (`D7`), Fabric F-SKU throttling (`D3`), and zero-result grounding drift (`D12`).

Raw download: <a :href="withBase('/kits/data-grounding-freshness-gate.kql')" download target="_blank" rel="noopener"><strong><code>Download data-grounding-freshness-gate.kql</code></strong></a>

<<< @/public/kits/data-grounding-freshness-gate.kql{kusto}
