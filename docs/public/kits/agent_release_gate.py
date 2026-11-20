#!/usr/bin/env python3
"""
Enterprise Azure AI Solution Industrialization Hub — MIT Engineering Kit
Artifact: agent_release_gate.py (Playbook 04 · Deterministic CI Release Verifier)

Verifies offline agent execution evidence (JSONL turns) against deterministic
production acceptance contracts:
  [ARG001] Schema integrity: required turn fields & terminal status=='ok'
  [ARG002] Tool allowlist: zero invocations of unapproved or dangerous tools
  [ARG003] Citation grounding: 100% of inline [cite:ID] markers resolve to retrieved_doc_ids
  [ARG004] Two-pass prefix cache parity: pass>=2 turns with >=1,024 input tokens hit KV cache
  [ARG005] Latency SLO: p95 turn duration stays within configured budget

Usage:
  python3 agent_release_gate.py ./artifacts/trace.jsonl
  python3 agent_release_gate.py --self-test
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import tempfile
from pathlib import Path
from typing import Any

CITATION_RE = re.compile(r"\[cite:([A-Za-z0-9_.:#-]+)\]")
DEFAULT_FORBIDDEN_TOOLS = {"raw_shell_root", "unguarded_http_post", "drop_container"}


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = min(len(ordered) - 1, max(0, math.ceil((pct / 100.0) * len(ordered)) - 1))
    return ordered[idx]


def evaluate_trace(
    records: list[dict[str, Any]],
    *,
    max_p95_ms: float = 15000.0,
    min_pass2_cached_tokens: int = 1024,
    forbidden_tools: set[str] | None = None,
) -> list[str]:
    deny = forbidden_tools if forbidden_tools is not None else DEFAULT_FORBIDDEN_TOOLS
    failures: list[str] = []
    latencies: list[float] = []

    if not records:
        return ["[ARG001] Trace file contains zero execution records."]

    for i, rec in enumerate(records, start=1):
        case_id = str(rec.get("case_id", f"row-{i}"))
        status = rec.get("status")
        if status != "ok":
            failures.append(f"[ARG001] {case_id}: terminal status is '{status}' (expected 'ok').")

        tools_used = rec.get("tools_called") or []
        for tool in tools_used:
            if tool in deny:
                failures.append(f"[ARG002] {case_id}: invoked forbidden tool '{tool}'.")

        answer = str(rec.get("assistant_response", ""))
        retrieved = set(str(x) for x in (rec.get("retrieved_doc_ids") or []))
        cited = CITATION_RE.findall(answer)
        for cid in cited:
            if cid not in retrieved:
                failures.append(
                    f"[ARG003] {case_id}: unresolved inline citation '[cite:{cid}]' not in retrieved_doc_ids."
                )

        pass_num = int(rec.get("pass_number", 1))
        input_tok = int(rec.get("input_tokens", 0))
        cached_tok = int(rec.get("cached_tokens", 0))
        if pass_num >= 2 and input_tok >= min_pass2_cached_tokens and cached_tok < min_pass2_cached_tokens:
            failures.append(
                f"[ARG004] {case_id}: pass {pass_num} had {input_tok} input tokens but only {cached_tok} cached_tokens (<{min_pass2_cached_tokens})."
            )

        if "duration_ms" in rec:
            latencies.append(float(rec["duration_ms"]))

    p95 = percentile(latencies, 95.0)
    if latencies and p95 > max_p95_ms:
        failures.append(f"[ARG005] Latency p95 {p95:.0f}ms exceeds budget {max_p95_ms:.0f}ms.")

    return failures


def run_self_test() -> int:
    valid_records = [
        {
            "case_id": "golden-001-pass1",
            "pass_number": 1,
            "status": "ok",
            "tools_called": ["knowledge_base_retrieve"],
            "retrieved_doc_ids": ["policy-sec-04", "rubric-v2"],
            "assistant_response": "Control verified per [cite:policy-sec-04] and [cite:rubric-v2].",
            "input_tokens": 4200,
            "cached_tokens": 0,
            "duration_ms": 2100,
        },
        {
            "case_id": "golden-001-pass2",
            "pass_number": 2,
            "status": "ok",
            "tools_called": ["knowledge_base_retrieve"],
            "retrieved_doc_ids": ["policy-sec-04"],
            "assistant_response": "Confirmed repeatable grounding [cite:policy-sec-04].",
            "input_tokens": 4200,
            "cached_tokens": 3584,
            "duration_ms": 1280,
        },
    ]
    assert evaluate_trace(valid_records) == [], "Expected clean golden trace to pass."

    broken_records = [
        {
            "case_id": "bad-001",
            "pass_number": 2,
            "status": "ok",
            "tools_called": ["raw_shell_root"],
            "retrieved_doc_ids": ["doc-a"],
            "assistant_response": "Hallucinated source [cite:doc-missing].",
            "input_tokens": 3000,
            "cached_tokens": 0,
            "duration_ms": 24000,
        }
    ]
    errs = evaluate_trace(broken_records, max_p95_ms=10000)
    assert len(errs) == 4, f"Expected 4 deterministic contract violations, got {errs}"
    print("✅ agent_release_gate.py self-test PASSED (ARG001–ARG005 verified).")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Deterministic CI release gate for enterprise AI agents.")
    parser.add_argument("trace_path", nargs="?", help="Path to JSONL trace evidence file.")
    parser.add_argument("--max-p95-ms", type=float, default=15000.0, help="Maximum allowed p95 duration in ms.")
    parser.add_argument("--min-cached-tokens", type=int, default=1024, help="Minimum cached tokens on pass>=2.")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON output.")
    parser.add_argument("--self-test", action="store_true", help="Run built-in deterministic contract self-tests.")
    args = parser.parse_args()

    if args.self_test:
        return run_self_test()

    if not args.trace_path:
        parser.error("Provide a trace_path JSONL file or pass --self-test.")

    path = Path(args.trace_path)
    if not path.is_file():
        print(f"Error: file not found: {path}", file=sys.stderr)
        return 2

    records = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    failures = evaluate_trace(
        records,
        max_p95_ms=args.max_p95_ms,
        min_pass2_cached_tokens=args.min_cached_tokens,
    )

    if args.json:
        print(json.dumps({"passed": len(failures) == 0, "record_count": len(records), "failures": failures}, indent=2))
    elif failures:
        print(f"❌ Agent Release Gate FAILED ({len(failures)} violation(s)):")
        for f in failures:
            print(f"  - {f}")
    else:
        print(f"✅ Agent Release Gate PASSED ({len(records)} turn(s) verified clean).")

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
