---
title: 12 · PCR001–006 Static Linter & 2-Pass DeepEval Gate
description: Automated CI static scanner rules (PCR001–PCR006) and illustrative 2-pass DeepEval quality + prompt-caching contract test.
---

<script setup>
import { withBase } from 'vitepress'
</script>

# 12 · Automated CI Scanner (`PCR001–006`) & DeepEval Gate

<PageBrief
  stage="validate"
  readTime="3 min read"
  problem="Even after a clean migration, a routine pull request adding a timestamp to system instructions can silently break caching in production."
  takeaway="Block regressions in PR CI with two fast gates: zero-dependency static linting (pcr_lint.py) + a 2-pass DeepEval cache-hit assertion."
  csaUse="Add pcr_lint.py to repository CI during Week 1 to surface prefix-breaking defects automatically on every pull request."
/>

Prevent un-cached code from promoting by enforcing two automated checks in pull-request CI: **(1)** static AST/regex linting (`PCR001–PCR006`) in Layer 1, and **(2)** a 2-pass DeepEval quality + cache-hit contract test in Layer 2 <span class="ev-badge ev-arch">[Arch]</span>.

<div class="arch-diagram">
  <svg viewBox="0 0 760 138" role="img" aria-labelledby="ci2-title ci2-desc" font-family="Segoe UI, Inter, -apple-system, sans-serif">
    <title id="ci2-title">Two-Stage Pull Request CI Gate for Prompt Caching and Quality</title>
    <desc id="ci2-desc">Shows Pull Request triggering Gate 1 pcr_lint.py static AST scan (&lt;2s), Gate 2 Pass 1 cache warm write, Gate 2 Pass 2 asserting cached_tokens &gt;= 1,024 and GEval quality parity, then allowing Merge to Main.</desc>
    <defs><marker id="ci2-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#0f766e"/></marker></defs>
    <rect x="8" y="14" width="132" height="86" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="16" y="33" font-size="9.1" font-weight="700" fill="#183e62">1. Pull Request</text>
    <text x="16" y="49" font-size="8.2" fill="#334e68">Prompt template,</text>
    <text x="16" y="62" font-size="8.2" fill="#334e68">tool schema, or</text>
    <text x="16" y="75" font-size="8.2" fill="#334e68">model config edit</text>
    <text x="16" y="92" font-size="7.8" font-weight="700" fill="#1d4ed8">[Triggers PR CI]</text>
    <path d="M140 57 H158" stroke="#0f766e" stroke-width="1.7" marker-end="url(#ci2-arr)"/>
    <rect x="162" y="14" width="144" height="86" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="170" y="33" font-size="9.1" font-weight="700" fill="#183e62">2. Static AST Lint</text>
    <text x="170" y="49" font-size="8.2" fill="#334e68">python3 pcr_lint.py</text>
    <text x="170" y="62" font-size="8.2" fill="#334e68">Checks PCR001–006</text>
    <text x="170" y="75" font-size="8.2" fill="#334e68">in &lt;2s (0 API cost)</text>
    <text x="170" y="92" font-size="7.8" font-weight="700" fill="#1d4ed8">[Layer 1 Unit Gate]</text>
    <path d="M306 57 H324" stroke="#0f766e" stroke-width="1.7" marker-end="url(#ci2-arr)"/>
    <rect x="328" y="14" width="136" height="86" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="336" y="33" font-size="9.1" font-weight="700" fill="#183e62">3. Eval Pass 1 (Warm)</text>
    <text x="336" y="49" font-size="8.2" fill="#334e68">Sends Case A with</text>
    <text x="336" y="62" font-size="8.2" fill="#334e68">shared Pos 1–4 prefix</text>
    <text x="336" y="75" font-size="8.2" fill="#334e68">&amp; deterministic key</text>
    <text x="336" y="92" font-size="7.8" font-weight="700" fill="#1d4ed8">[Seeds Partition]</text>
    <path d="M464 57 H482" stroke="#0f766e" stroke-width="1.7" marker-end="url(#ci2-arr)"/>
    <rect x="486" y="14" width="142" height="86" rx="6" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.4"/>
    <text x="494" y="33" font-size="9.1" font-weight="700" fill="#115e59">4. Eval Pass 2 (Hit)</text>
    <text x="494" y="49" font-size="8.2" fill="#334e68">Sends Case B (new tail)</text>
    <text x="494" y="62" font-size="8.2" fill="#334e68">Asserts cached &ge;1,024</text>
    <text x="494" y="75" font-size="8.2" fill="#334e68">&amp; share &ge;60% + GEval</text>
    <text x="494" y="92" font-size="7.8" font-weight="700" fill="#0f766e">[Layer 2 Contract]</text>
    <path d="M628 57 H646" stroke="#0f766e" stroke-width="1.7" marker-end="url(#ci2-arr)"/>
    <rect x="650" y="14" width="102" height="86" rx="6" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.5"/>
    <text x="658" y="33" font-size="9.1" font-weight="700" fill="#115e59">5. Safe Merge</text>
    <text x="658" y="49" font-size="8.2" fill="#334e68">Zero silent</text>
    <text x="658" y="62" font-size="8.2" fill="#334e68">cache misses</text>
    <text x="658" y="75" font-size="8.2" fill="#334e68">reach prod</text>
    <text x="658" y="92" font-size="7.8" font-weight="700" fill="#0f766e">[Gate Green]</text>
    <text x="10" y="124" font-size="8.4" fill="#526c80">Catches 95%+ of prefix-breaking code changes before merge—without waiting for production telemetry.</text>
  </svg>
</div>

## 1. Layer 1: Static Codebase Scanner Rule Catalog (`PCR001–PCR006`)

Preview and copy the full zero-dependency CLI scanner on the [Copy-Ready Engineering Kits](/papers/engineering-kits#pcr-linter) page (or download <a :href="withBase('/kits/pcr_lint.py')" download target="_blank" rel="noopener"><code>pcr_lint.py</code></a> directly: `python3 pcr_lint.py ./src`).

The scanner fails closed with `PCR000` and exit code `1` for missing/inaccessible targets, unsupported explicit files, directories with no eligible sources, unreadable/non-UTF-8 files, or invalid Python syntax. Directory scans exclude generated/dependency folders such as `node_modules` and `.venv`, and the linter itself; a clean file does not mask another target's failure. `--json` includes these diagnostics in the same finding array as readiness defects <span class="ev-badge ev-arch">[Arch]</span>. This validates scan integrity, not TypeScript/JavaScript/C# syntax or runtime cache behavior; retain native build checks and Layer 2 probes.

Python AST recursion failures also block the scan with a file-level `PCR000` at line `1`, whether triggered by parsing deeply nested source or rendering an expression for a readiness check. Other files and targets are still scanned, with their findings retained in text/JSON output and no traceback. The offline self-test exercises both phases and actual deep-source CLI inputs; the linter does not evaluate expressions or increase the interpreter's recursion limit <span class="ev-badge ev-arch">[Arch]</span>.

| Rule ID | Defect Flagged | AST / Regex Detection Specification (Python, C#, TypeScript) | Readiness Item |
| :--- | :--- | :--- | :--- |
| `PCR001` | Missing, invalid constant, or high-cardinality `prompt_cache_key` | Calls to `responses.create` / `chat.completions.create` missing `prompt_cache_key`, supplying a blank/non-string Python AST constant, or interpolating `user_id`, `request_id`, `uuid4()`, `engagement_id`, `matter_id`, `client_id`, or `cost_center` into the key. | `C6`, `C7` |
| `PCR002` | Dynamic values in Position 1 system/developer prompt | Interpolation of `datetime.now`, `DateTime.UtcNow`, `Date.now`, `timestamp`, `uuid`, or per-request context (`req_ctx`) inside the leading `system` / `developer` block. | `C2` |
| `PCR003` | Non-deterministic `tools[]` or JSON schema order | Building `tools` from unsorted sets/dicts or serializing tool/context JSON in Positions 1–4 without `sort_keys=True` (or canonical C#/TS serializer settings). | `C3` |
| `PCR004` | RAG chunks or live MCP data ahead of static prefix | Prompt builders placing `rag_chunks`, `search_results`, or live enterprise MCP outputs before static instructions, ontology blocks, or tool schemas. | `C4` |
| `PCR005` | Invalid breakpoint, retention, or `reasoning.context` | Sending `prompt_cache_breakpoint` to pre-5.6 (HTTP `400`) or `5.6` PTU-M (unsupported); sending deprecated `prompt_cache_retention` to `5.6+`; or unpinned multi-turn `reasoning.context`. | `C8`, `C9`, `C10` |
| `PCR006` | Missing telemetry extraction for cache tokens | LLM client wrappers logging `input_tokens` / `prompt_tokens` while omitting `input_tokens_details` / `prompt_tokens_details.cached_tokens` and `cache_write_tokens`. | `C11` |

The `PCR001` constant check is a local routing readiness policy applied to matching Python calls regardless of model, not an Azure API requirement. It inspects only AST constants without evaluating source expressions; computed keys still need runtime assertions, and non-Python key validation is outside this check's scope <span class="ev-badge ev-arch">[Arch]</span>.

## 2. Layer 2: Unified DeepEval Quality + 2-Pass Cache Contract Test

Illustrative CI pattern normalizing usage fields across both the **Responses API** (`input_tokens` / `input_tokens_details`) and **Chat Completions API** (`prompt_tokens` / `prompt_tokens_details`):

```python
import pytest
from deepeval import assert_test
from deepeval.test_case import LLMTestCase
from deepeval.metrics import GEval


def _extract_cache_usage(resp) -> tuple[int, int, str]:
    """Normalize usage & text across Responses API (/v1/responses) and Chat Completions."""
    u = resp.usage
    input_tok = getattr(u, "input_tokens", None) or getattr(u, "prompt_tokens", 0)
    details = getattr(u, "input_tokens_details", None) or getattr(u, "prompt_tokens_details", None)
    cached_tok = getattr(details, "cached_tokens", 0) or 0
    text = getattr(resp, "output_text", None) or resp.choices[0].message.content
    return input_tok, cached_tok, text


# Illustrative — bind invoke_node() and golden_cases (sharing >=1,024-token Pos 1-4 prefix) to your app client
@pytest.mark.parametrize("model", ["gpt-5.4", "gpt-5.6-prod-ptu"])
def test_node_migration_quality_and_cache_gate(model, golden_cases):
    """Layer 2 Gate: Verifies GEval accuracy AND 2-pass prompt cache hit rate on GPT-5.6+."""
    case_a, case_b = golden_cases[0], golden_cases[1]  # Distinct Pos 6 inputs sharing identical Pos 1-4 prefix

    # Pass 1: Cold/warm write call with deterministic family+version+shard key
    r1 = invoke_node(case_a["input"], model=model, prompt_cache_key="doc-review:summarizer:v12:shard-0")
    # Pass 2: Second case with identical static/workspace prefix (Pos 1-4) and different dynamic tail (Pos 6)
    r2 = invoke_node(case_b["input"], model=model, prompt_cache_key="doc-review:summarizer:v12:shard-0")

    _, _, out_a = _extract_cache_usage(r1)
    input_tok_b, cached_tokens, _ = _extract_cache_usage(r2)
    assert cached_tokens >= 1024, f"[{model}] Expected cache hit >= 1024 tokens on Pass 2, got {cached_tokens}"
    assert (cached_tokens / max(input_tok_b, 1)) >= 0.60, "Cached input share fell below 60% gate"
    # Assert steady-state Read/Write ratio (>= 10:1) across the full 50-200 case replay aggregate (Ch. 11 Step 5)

    assert_test(
        LLMTestCase(input=case_a["input"], actual_output=out_a, expected_output=case_a["expected"]),
        [GEval(name="Correctness", criteria="Accurately conveys expected domain findings", threshold=0.8)],
    )
```
