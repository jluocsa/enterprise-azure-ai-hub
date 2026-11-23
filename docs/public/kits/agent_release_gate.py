#!/usr/bin/env python3
"""
Enterprise Azure AI Solution Industrialization Hub — MIT Engineering Kit
Artifact: agent_release_gate.py (Playbook 04 · Deterministic CI Release Verifier)

Verifies offline agent execution evidence (JSONL turns) against deterministic
production acceptance contracts:
  [ARG001] Schema integrity: required fields, unique case/pass pairs, optional corpus coverage & status=='ok'
  [ARG002] Tool governance: zero forbidden tools + optional required grounding tools
  [ARG003] Citation grounding: well-formed inline [cite:ID] markers resolve to retrieved_doc_ids
  [ARG004] Two-pass prefix cache parity: pass>=2 turns with >=1,024 input tokens hit KV cache
  [ARG005] Latency SLO: p95 turn duration stays within configured budget
  [ARG006] Foundry IQ ACL trimming (A5): non-empty RAG retrievals never report acl_trimmed=False
  [ARG007] Metadata-only OTel privacy (A12): zero raw prompt/message content logged in telemetry

Usage:
  python3 agent_release_gate.py ./artifacts/trace.jsonl
  python3 agent_release_gate.py ./artifacts/trace.jsonl --contract ./agent-release-contract.json
  python3 agent_release_gate.py --self-test
"""

from __future__ import annotations

import argparse
import contextlib
import io
import json
import math
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any
from unittest.mock import patch

CITATION_RE = re.compile(r"\[cite:([A-Za-z0-9_.:#-]+)\]")
DEFAULT_FORBIDDEN_TOOLS = {"raw_shell_root", "unguarded_http_post", "drop_container"}


def unique_json_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    obj: dict[str, Any] = {}
    for key, value in pairs:
        if key in obj:
            raise ValueError("duplicate JSON object members are not allowed.")
        obj[key] = value
    return obj


def is_finite_number(value: Any) -> bool:
    if type(value) not in (int, float):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = min(len(ordered) - 1, max(0, math.ceil((pct / 100.0) * len(ordered)) - 1))
    return ordered[idx]


def validate_record(
    rec: Any, row: int, *, require_acl_trimming: bool, forbid_raw_prompt_logging: bool
) -> list[str]:
    prefix = f"[ARG001] row-{row}:"
    if not isinstance(rec, dict):
        return [f"{prefix} execution record must be a JSON object."]

    failures: list[str] = []
    for field in ("case_id", "status", "assistant_response"):
        value = rec.get(field)
        if not isinstance(value, str) or (field != "assistant_response" and not value.strip()):
            failures.append(f"{prefix} {field} must be a string (non-empty for identifiers/status).")

    for field in ("tools_called", "retrieved_doc_ids"):
        value = rec.get(field)
        if not isinstance(value, list) or any(not isinstance(x, str) or not x.strip() for x in value):
            failures.append(f"{prefix} {field} must be an array of non-empty strings.")
        elif field == "tools_called" and any(tool != tool.strip() for tool in value):
            failures.append(f"{prefix} tools_called names must not have leading or trailing whitespace.")

    for field in ("pass_number", "input_tokens", "cached_tokens"):
        value = rec.get(field)
        minimum = 1 if field == "pass_number" else 0
        if type(value) is not int or value < minimum:
            failures.append(f"{prefix} {field} must be an integer >= {minimum}.")
    if (
        type(rec.get("input_tokens")) is int
        and type(rec.get("cached_tokens")) is int
        and rec["cached_tokens"] > rec["input_tokens"]
    ):
        failures.append(f"{prefix} cached_tokens must not exceed input_tokens.")

    duration = rec.get("duration_ms")
    if not is_finite_number(duration) or duration < 0:
        failures.append(
            f"{prefix} duration_ms must be a finite number >= 0 within the supported floating-point range."
        )

    for field, required in (
        ("acl_trimmed", require_acl_trimming and bool(rec.get("retrieved_doc_ids"))),
        ("raw_prompt_logged", forbid_raw_prompt_logging),
        ("otel_capture_message_content", False),
    ):
        if (required or field in rec) and type(rec.get(field)) is not bool:
            failures.append(f"{prefix} {field} must be an explicit boolean.")

    return failures


def evaluate_trace(
    records: list[Any],
    *,
    max_p95_ms: float = 15000.0,
    min_pass2_cached_tokens: int = 1024,
    forbidden_tools: set[str] | None = None,
    required_tools: set[str] | None = None,
    require_acl_trimming: bool = True,
    forbid_raw_prompt_logging: bool = True,
    expected_case_passes: set[tuple[str, int]] | None = None,
) -> list[str]:
    deny = forbidden_tools if forbidden_tools is not None else DEFAULT_FORBIDDEN_TOOLS
    req = required_tools or set()
    failures: list[str] = []
    latencies: list[float] = []
    seen_turns: dict[tuple[str, int], int] = {}

    if not records:
        return ["[ARG001] Trace file contains zero execution records."]

    for i, rec in enumerate(records, start=1):
        schema_failures = validate_record(
            rec, i, require_acl_trimming=require_acl_trimming,
            forbid_raw_prompt_logging=forbid_raw_prompt_logging,
        )
        if schema_failures:
            failures.extend(schema_failures)
            continue

        case_id = rec["case_id"]
        turn_key = (case_id, rec["pass_number"])
        if expected_case_passes is not None and turn_key not in expected_case_passes:
            failures.append(f"[ARG001] row-{i}: unexpected case_id/pass_number pair.")
        if turn_key in seen_turns:
            failures.append(
                f"[ARG001] row-{i}: duplicate case_id/pass_number pair "
                f"(first seen at row-{seen_turns[turn_key]})."
            )
        else:
            seen_turns[turn_key] = i
        status = rec["status"]
        if status != "ok":
            failures.append(f"[ARG001] {case_id}: terminal status is '{status}' (expected 'ok').")

        tools_used = rec["tools_called"]
        for tool in tools_used:
            if tool in deny:
                failures.append(f"[ARG002] {case_id}: invoked forbidden tool '{tool}'.")
        for req_tool in sorted(req):
            if req_tool not in tools_used:
                failures.append(f"[ARG002] {case_id}: missing required tool invocation '{req_tool}'.")

        answer = rec["assistant_response"]
        retrieved = set(rec["retrieved_doc_ids"])
        cited = CITATION_RE.findall(answer)
        if answer.count("[cite:") != len(cited):
            failures.append(
                f"[ARG003] {case_id}: malformed inline citation marker; expected [cite:ID] with a non-empty ID using only A-Z, a-z, 0-9, _, ., :, #, or -."
            )
        for cid in cited:
            if cid not in retrieved:
                failures.append(
                    f"[ARG003] {case_id}: unresolved inline citation '[cite:{cid}]' not in retrieved_doc_ids."
                )

        pass_num = rec["pass_number"]
        input_tok = rec["input_tokens"]
        cached_tok = rec["cached_tokens"]
        if pass_num >= 2 and input_tok >= min_pass2_cached_tokens and cached_tok < min_pass2_cached_tokens:
            failures.append(
                f"[ARG004] {case_id}: pass {pass_num} had {input_tok} input tokens but only {cached_tok} cached_tokens (<{min_pass2_cached_tokens})."
            )

        if require_acl_trimming and retrieved and rec.get("acl_trimmed") is False:
            failures.append(
                f"[ARG006] {case_id}: retrieved {len(retrieved)} document(s) with acl_trimmed=False (violates Gate A5 security trimming)."
            )

        if forbid_raw_prompt_logging and (
            rec.get("raw_prompt_logged") is True or rec.get("otel_capture_message_content") is True
        ):
            failures.append(
                f"[ARG007] {case_id}: telemetry logged raw prompt/message content (violates Gate A12 metadata-only OTel)."
            )

        latencies.append(rec["duration_ms"])

    if expected_case_passes is not None:
        missing_count = len(expected_case_passes.difference(seen_turns))
        if missing_count:
            failures.append(f"[ARG001] Trace is missing {missing_count} expected case/pass pair(s).")

    p95 = percentile(latencies, 95.0)
    if latencies and p95 > max_p95_ms:
        failures.append(f"[ARG005] Latency p95 {p95:.0f}ms exceeds budget {max_p95_ms:.0f}ms.")

    return failures


def validate_contract(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("contract must be a JSON object.")

    allowed_fields = {
        "max_p95_ms", "min_pass2_cached_tokens", "required_tools", "forbidden_tools",
        "require_acl_trimming", "forbid_raw_prompt_logging",
        "expected_case_passes", "contract_version", "track", "metadata",
    }
    if any(field not in allowed_fields for field in raw):
        raise ValueError(
            "contract contains unsupported top-level fields; allowed fields: "
            + ", ".join(sorted(allowed_fields)) + "."
        )

    max_p95_ms = raw.get("max_p95_ms", 15000.0)
    if not is_finite_number(max_p95_ms) or max_p95_ms <= 0:
        raise ValueError(
            "max_p95_ms must be a finite number > 0 within the supported floating-point range."
        )

    min_cached = raw.get("min_pass2_cached_tokens", 1024)
    if type(min_cached) is not int or min_cached <= 0:
        raise ValueError("min_pass2_cached_tokens must be an integer > 0.")

    for field in ("required_tools", "forbidden_tools"):
        if field in raw:
            tools = raw[field]
            if not isinstance(tools, list) or any(
                not isinstance(tool, str) or not tool.strip() for tool in tools
            ):
                raise ValueError(f"{field} must be an array of non-empty strings.")
            if any(tool != tool.strip() for tool in tools):
                raise ValueError(f"{field} names must not have leading or trailing whitespace.")

    for field in ("require_acl_trimming", "forbid_raw_prompt_logging"):
        if field in raw and type(raw[field]) is not bool:
            raise ValueError(f"{field} must be an explicit boolean.")

    expected_case_passes: set[tuple[str, int]] | None = None
    if "expected_case_passes" in raw:
        inventory = raw["expected_case_passes"]
        if not isinstance(inventory, list) or not inventory:
            raise ValueError("expected_case_passes must be a non-empty array of case/pass objects.")
        expected_case_passes = set()
        for index, entry in enumerate(inventory, start=1):
            prefix = f"expected_case_passes entry-{index}:"
            if not isinstance(entry, dict) or set(entry) != {"case_id", "pass_number"}:
                raise ValueError(f"{prefix} must contain only case_id and pass_number.")
            case_id, pass_number = entry["case_id"], entry["pass_number"]
            if not isinstance(case_id, str) or not case_id.strip():
                raise ValueError(f"{prefix} case_id must be a non-empty string.")
            if type(pass_number) is not int or pass_number < 1:
                raise ValueError(f"{prefix} pass_number must be an integer >= 1.")
            pair = (case_id, pass_number)
            if pair in expected_case_passes:
                raise ValueError(f"{prefix} duplicate case_id/pass_number pair.")
            expected_case_passes.add(pair)

    return {
        "max_p95_ms": max_p95_ms,
        "min_pass2_cached_tokens": min_cached,
        "forbidden_tools": set(raw.get("forbidden_tools", list(DEFAULT_FORBIDDEN_TOOLS))),
        "required_tools": set(raw.get("required_tools", [])),
        "require_acl_trimming": raw.get("require_acl_trimming", True),
        "forbid_raw_prompt_logging": raw.get("forbid_raw_prompt_logging", True),
        "expected_case_passes": expected_case_passes,
    }


def load_contract(contract_path: Path) -> dict[str, Any]:
    try:
        raw = json.loads(
            contract_path.read_text(encoding="utf-8"), object_pairs_hook=unique_json_object,
        )
    except json.JSONDecodeError:
        raise ValueError("contract must contain valid JSON.") from None
    except RecursionError:
        raise ValueError("contract JSON exceeds the parser nesting limit.") from None
    return validate_contract(raw)


def run_self_test() -> int:
    valid_records = [
        {
            "case_id": "golden-001-pass1",
            "pass_number": 1,
            "status": "ok",
            "tools_called": ["knowledge_base_retrieve"],
            "retrieved_doc_ids": ["policy-sec-04", "rubric-v2"],
            "acl_trimmed": True,
            "raw_prompt_logged": False,
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
            "acl_trimmed": True,
            "raw_prompt_logged": False,
            "assistant_response": "Confirmed repeatable grounding [cite:policy-sec-04].",
            "input_tokens": 4200,
            "cached_tokens": 3584,
            "duration_ms": 1280,
        },
    ]
    assert evaluate_trace(valid_records, required_tools={"knowledge_base_retrieve"}) == [], (
        "Expected clean golden trace to pass."
    )

    same_case_passes = [
        {**rec, "case_id": "golden-case"} for rec in valid_records
    ]
    assert evaluate_trace(same_case_passes) == []
    assert evaluate_trace([
        valid_records[0], {**valid_records[0], "case_id": "GOLDEN-001-pass1"},
    ]) == []
    expected_cases = [
        {"case_id": "golden-case", "pass_number": rec["pass_number"]}
        for rec in same_case_passes
    ]
    inventory_cfg = validate_contract({"expected_case_passes": expected_cases})
    assert evaluate_trace(same_case_passes, **inventory_cfg) == []
    assert evaluate_trace(list(reversed(same_case_passes)), **inventory_cfg) == []
    assert evaluate_trace(same_case_passes[:1], **inventory_cfg) == [
        "[ARG001] Trace is missing 1 expected case/pass pair(s).",
    ]
    assert evaluate_trace([
        same_case_passes[0], {**same_case_passes[1], "case_id": "private-unexpected-case"},
    ], **inventory_cfg) == [
        "[ARG001] row-2: unexpected case_id/pass_number pair.",
        "[ARG001] Trace is missing 1 expected case/pass pair(s).",
    ]
    assert any("missing 1 expected" in e for e in evaluate_trace([
        same_case_passes[0], {**same_case_passes[1], "duration_ms": -1},
    ], **inventory_cfg))
    assert any("duplicate case_id/pass_number" in e for e in evaluate_trace([
        *same_case_passes, same_case_passes[0],
    ], **inventory_cfg))
    padded_inventory_trace = [
        {**same_case_passes[0], "duration_ms": 24000},
        same_case_passes[1],
        *[{**same_case_passes[1], "case_id": f"extra-{i}"} for i in range(20)],
    ]
    assert evaluate_trace(padded_inventory_trace) == []
    errs = evaluate_trace(padded_inventory_trace, **inventory_cfg)
    assert len(errs) == 20 and all("unexpected case_id/pass_number" in e for e in errs), errs
    for duplicate in (valid_records[0], {**valid_records[0], "duration_ms": 900}):
        errs = evaluate_trace([valid_records[0], valid_records[1], duplicate, duplicate])
        assert errs == [
            "[ARG001] row-3: duplicate case_id/pass_number pair (first seen at row-1).",
            "[ARG001] row-4: duplicate case_id/pass_number pair (first seen at row-1).",
        ], errs
    padded_trace = [
        {**valid_records[0], "case_id": "slow-case", "duration_ms": 24000},
        *[{**valid_records[0], "case_id": "private-case"} for _ in range(20)],
    ]
    errs = evaluate_trace(padded_trace)
    assert len(errs) == 19 and all("duplicate case_id/pass_number" in e for e in errs), errs
    assert "private-case" not in "\n".join(errs), errs

    citation_record = {**valid_records[0], "retrieved_doc_ids": ["doc_A.2:#-"]}
    for answer in ("", "No citation markers.", "[cite:doc_A.2:#-][cite:doc_A.2:#-]"):
        assert evaluate_trace([{**citation_record, "assistant_response": answer}]) == []

    malformed_answers = (
        "Source [cite:].",
        "Source [cite:doc a].",
        "Source [cite:doc/a].",
        "Source [cite:doc-\u00e9].",
        "Source [cite:doc-a",
        "Source [cite:doc-a\n].",
        "Source [cite:[cite:doc_A.2:#-]].",
        "Valid [cite:doc_A.2:#-], then malformed [cite:].",
    )
    for answer in malformed_answers:
        errs = evaluate_trace([{**citation_record, "assistant_response": answer}])
        assert any(e.startswith("[ARG003]") and "malformed" in e for e in errs), (answer, errs)
        assert answer not in "\n".join(errs), "Malformed answer content must not enter diagnostics."

    for malformed in (None, [], "not-an-object", 7, {"status": "ok"}):
        errs = evaluate_trace([malformed])
        assert errs and all(e.startswith("[ARG001]") for e in errs), errs

    for field in valid_records[0]:
        incomplete = {k: v for k, v in valid_records[0].items() if k != field}
        errs = evaluate_trace([incomplete])
        assert any(e.startswith("[ARG001]") and field in e for e in errs), (field, errs)

    for field, values in (
        ("case_id", ["", None, 1]),
        ("status", [None, True]),
        ("assistant_response", [None, {}]),
        ("tools_called", ["knowledge_base_retrieve", [None], [7]]),
        ("retrieved_doc_ids", ["policy-sec-04", [""]]),
        ("pass_number", [0, -1, True, "2", 1.5]),
        ("input_tokens", [-1, True, "4200", 4200.5]),
        ("cached_tokens", [-1, False, "0", 0.5, 4201]),
        ("duration_ms", [None, -1, True, "2100", math.nan, math.inf, -math.inf, 10**400, -(10**400)]),
        ("acl_trimmed", [None, "true", 1]),
        ("raw_prompt_logged", [None, "false", 0]),
        ("otel_capture_message_content", [None, "false", 0]),
    ):
        for value in values:
            errs = evaluate_trace([{**valid_records[0], field: value}])
            assert any(e.startswith("[ARG001]") and field in e for e in errs), (field, value, errs)

    no_retrieval = {**valid_records[0], "retrieved_doc_ids": [], "assistant_response": ""}
    del no_retrieval["acl_trimmed"]
    assert evaluate_trace([no_retrieval]) == []
    del no_retrieval["raw_prompt_logged"]
    assert evaluate_trace([no_retrieval], forbid_raw_prompt_logging=False) == []
    no_acl = {k: v for k, v in valid_records[0].items() if k != "acl_trimmed"}
    assert evaluate_trace([no_acl], require_acl_trimming=False) == []
    assert evaluate_trace([{**valid_records[0], "duration_ms": 0.5}]) == []
    assert evaluate_trace(
        [{**valid_records[0], "duration_ms": 10**300}],
        **validate_contract({"max_p95_ms": 10**300}),
    ) == []
    large_latency_failures = evaluate_trace(
        [{**valid_records[0], "duration_ms": 10**300}],
        **validate_contract({"max_p95_ms": 10**299}),
    )
    assert len(large_latency_failures) == 1 and large_latency_failures[0].startswith("[ARG005]")
    assert evaluate_trace([])[0].startswith("[ARG001]")

    broken_records = [
        {
            "case_id": "bad-001",
            "pass_number": 2,
            "status": "ok",
            "tools_called": ["raw_shell_root"],
            "retrieved_doc_ids": ["doc-a"],
            "acl_trimmed": False,
            "raw_prompt_logged": True,
            "assistant_response": "Hallucinated source [cite:doc-missing].",
            "input_tokens": 3000,
            "cached_tokens": 0,
            "duration_ms": 24000,
        }
    ]
    errs = evaluate_trace(broken_records, max_p95_ms=10000)
    assert len(errs) == 6, f"Expected 6 deterministic contract violations, got {errs}"
    duplicate_broken = [
        {**valid_records[0], "case_id": "bad-001", "pass_number": 2, "cached_tokens": 3584},
        *broken_records,
    ]
    errs = evaluate_trace(duplicate_broken, max_p95_ms=10000)
    assert len(errs) == 7 and sum("duplicate case_id/pass_number" in e for e in errs) == 1, errs
    assert all(any(e.startswith(f"[ARG00{rule}]") for e in errs) for rule in range(1, 8)), errs

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as tmp:
        json.dump(
            {
                "max_p95_ms": 12000,
                "min_pass2_cached_tokens": 1024,
                "required_tools": ["knowledge_base_retrieve"],
                "forbidden_tools": ["raw_shell_root"],
                "require_acl_trimming": True,
                "forbid_raw_prompt_logging": True,
            },
            tmp,
        )
        tmp_path = Path(tmp.name)
    try:
        cfg = load_contract(tmp_path)
        assert evaluate_trace(valid_records, **cfg) == []
    finally:
        tmp_path.unlink(missing_ok=True)

    defaults = validate_contract({})
    assert evaluate_trace(valid_records, **defaults) == []
    assert defaults["forbidden_tools"] == DEFAULT_FORBIDDEN_TOOLS
    for padding in (" ", "\t", "\n", "\u00a0"):
        for tool in (padding + "raw_shell_root", "raw_shell_root" + padding):
            errs = evaluate_trace([{**valid_records[0], "tools_called": [tool]}])
            assert len(errs) == 1 and errs[0].startswith("[ARG001]"), errs
            assert "tools_called" in errs[0] and tool not in errs[0], errs
            for field in ("required_tools", "forbidden_tools"):
                try:
                    validate_contract({field: [tool]})
                except ValueError as exc:
                    assert field in str(exc) and tool not in str(exc), exc
                else:
                    raise AssertionError(f"Expected padded {field} to be rejected.")
    exact_tool = "namespace.Tool-v2"
    assert evaluate_trace(
        [{**valid_records[0], "tools_called": [exact_tool]}],
        **validate_contract({"required_tools": [exact_tool], "forbidden_tools": [exact_tool.lower()]}),
    ) == []
    assert evaluate_trace(
        [{**valid_records[0], "tools_called": []}],
        **validate_contract({"required_tools": [], "forbidden_tools": []}),
    ) == []
    assert validate_contract({
        "contract_version": "2.0", "track": "Playbook 04",
        "metadata": {"first": {"label": "a"}, "second": {"label": "b"}},
    }) == defaults
    assert validate_contract({
        "contract_version": "2.0", "track": "Playbook 04",
        "max_p95_ms": 0.5, "min_pass2_cached_tokens": 1,
        "required_tools": [], "forbidden_tools": [],
        "require_acl_trimming": False, "forbid_raw_prompt_logging": False,
    }) == {
        "max_p95_ms": 0.5, "min_pass2_cached_tokens": 1,
        "required_tools": set(), "forbidden_tools": set(),
        "require_acl_trimming": False, "forbid_raw_prompt_logging": False,
        "expected_case_passes": None,
    }

    invalid_contracts = [(value, "JSON object") for value in (None, [], "contract", 1, True)]
    for field in (
        "max_p95_mss", "min_pass2_cache_tokens", "required_tool", "forbidden_tool",
        "require_acl_trimmming", "forbid_raw_prompt_loging", "private-field",
    ):
        invalid_contracts.append(({field: "private-value"}, "unsupported top-level fields"))
    for field, values in (
        ("max_p95_ms", [None, True, "15000", 0, -1, math.nan, math.inf, -math.inf, 10**400, -(10**400)]),
        ("min_pass2_cached_tokens", [None, True, "1024", 0, -1, 1.5, 1024.0, math.nan, math.inf]),
        ("required_tools", [None, "retrieve", {}, [None], [1], [True], [[]], [""], [" "]]),
        ("forbidden_tools", [None, "raw_shell_root", {}, [None], [1], [True], [[]], [""], [" "]]),
        ("require_acl_trimming", [None, "false", 0, 1, [], {}]),
        ("forbid_raw_prompt_logging", [None, "false", 0, 1, [], {}]),
        ("expected_case_passes", [
            None, True, "golden-case", {}, [], [None], [[]],
            [{"case_id": "golden-case"}],
            [{"case_id": "golden-case", "pass_number": 1, "private-field": "private-value"}],
            *[[{"case_id": case, "pass_number": 1}] for case in ("", " ", None, 1)],
            *[[{"case_id": "golden-case", "pass_number": number}]
              for number in (None, True, "1", 0, -1, 1.5, 1.0)],
            [expected_cases[0], expected_cases[0]],
        ]),
    ):
        invalid_contracts.extend(({field: value}, field) for value in values)
    for contract, expected_message in invalid_contracts:
        try:
            validate_contract(contract)
        except ValueError as exc:
            assert expected_message in str(exc), (contract, exc)
            if expected_message == "unsupported top-level fields":
                assert "private-field" not in str(exc) and "private-value" not in str(exc), exc
        else:
            raise AssertionError(f"Expected invalid contract to be rejected: {contract!r}")

    with tempfile.TemporaryDirectory() as directory:
        trace = Path(directory) / "trace.jsonl"
        inventory_file = Path(directory) / "inventory-contract.json"
        inventory_file.write_text(
            json.dumps({"expected_case_passes": expected_cases}), encoding="utf-8",
        )
        for evidence, expected_findings in (
            (same_case_passes, []),
            (list(reversed(same_case_passes)), []),
            (same_case_passes[:1], ["missing 1 expected"]),
            ([same_case_passes[0], {**same_case_passes[1], "case_id": "GOLDEN-CASE"}],
             ["unexpected case_id/pass_number", "missing 1 expected"]),
            (padded_inventory_trace, ["unexpected case_id/pass_number"] * 20),
            ([*same_case_passes, same_case_passes[0]], ["duplicate case_id/pass_number"]),
        ):
            trace.write_text("\n".join(json.dumps(rec) for rec in evidence), encoding="utf-8")
            for output_flags in ([], ["--json"]):
                result = subprocess.run(
                    [sys.executable, str(Path(__file__).resolve()), str(trace),
                     "--contract", str(inventory_file), *output_flags],
                    capture_output=True, text=True, check=False,
                )
                assert result.returncode == (1 if expected_findings else 0), result
                assert not result.stderr and "Traceback" not in result.stdout, result
                for finding in set(expected_findings):
                    assert result.stdout.count(finding) == expected_findings.count(finding), result
                assert "GOLDEN-CASE" not in result.stdout and "extra-" not in result.stdout, result
                if output_flags:
                    output = json.loads(result.stdout)
                    assert output["passed"] is (not expected_findings), output
                    assert output["record_count"] == len(evidence), output
                    assert len(output["failures"]) == len(expected_findings), output

        for inventory in ([], [expected_cases[0], expected_cases[0]],
                          [{"case_id": "private-case", "pass_number": True}]):
            inventory_file.write_text(
                json.dumps({"expected_case_passes": inventory}), encoding="utf-8",
            )
            for trace_path in (trace, Path(directory) / "missing.jsonl"):
                for output_flags in ([], ["--json"]):
                    result = subprocess.run(
                        [sys.executable, str(Path(__file__).resolve()), str(trace_path),
                         "--contract", str(inventory_file), *output_flags],
                        capture_output=True, text=True, check=False,
                    )
                    assert result.returncode == 2 and not result.stdout, result
                    assert "invalid acceptance contract" in result.stderr, result
                    assert "expected_case_passes" in result.stderr and "[ARG001]" not in result.stderr, result
                    assert "private-case" not in result.stderr and "Traceback" not in result.stderr, result

        for evidence, expected_duplicates in (
            (same_case_passes, 0),
            (padded_trace, 19),
            (duplicate_broken, 1),
            ([valid_records[0], {**valid_records[0], "duration_ms": 900}], 1),
        ):
            trace.write_text("\n\n".join(json.dumps(rec) for rec in evidence), encoding="utf-8")
            for output_flags in ([], ["--json"]):
                result = subprocess.run(
                    [sys.executable, str(Path(__file__).resolve()), str(trace), *output_flags],
                    capture_output=True, text=True, check=False,
                )
                assert result.returncode == (1 if expected_duplicates else 0), result
                assert not result.stderr and "Traceback" not in result.stdout, result
                assert result.stdout.count("duplicate case_id/pass_number") == expected_duplicates, result
                assert "private-case" not in result.stdout, result
                if output_flags:
                    output = json.loads(result.stdout)
                    assert output["passed"] is (expected_duplicates == 0), output
                    assert output["record_count"] == len(evidence), output
                    if evidence is duplicate_broken:
                        assert len(output["failures"]) == 7, output

        for evidence, expected_code in (
            (valid_records, 0),
            ([{**valid_records[0], "metadata": [{"label": "a"}, {"label": "b"}]}], 0),
            ([{"status": "ok"}], 1),
            ([None], 1),
            ([valid_records[0], {**valid_records[1], "duration_ms": math.nan}], 1),
        ):
            trace.write_text("\n".join(json.dumps(rec) for rec in evidence), encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(Path(__file__).resolve()), str(trace), "--json"],
                capture_output=True, text=True, check=False,
            )
            assert result.returncode == expected_code, result.stderr
            output = json.loads(result.stdout)
            assert output["passed"] is (expected_code == 0), output
            if expected_code:
                assert any(e.startswith("[ARG001]") for e in output["failures"]), output

        trace.write_text(json.dumps({
            **citation_record, "assistant_response": "Private marker [cite:private/doc].",
        }), encoding="utf-8")
        for output_flags in ([], ["--json"]):
            result = subprocess.run(
                [sys.executable, str(Path(__file__).resolve()), str(trace), *output_flags],
                capture_output=True, text=True, check=False,
            )
            assert result.returncode == 1 and not result.stderr, result
            assert "[ARG003]" in result.stdout and "private/doc" not in result.stdout, result
            if output_flags:
                output = json.loads(result.stdout)
                assert output["passed"] is False and output["record_count"] == 1, output

        trace.write_text(json.dumps(valid_records[0]) + "\n{broken\n", encoding="utf-8")
        result = subprocess.run(
            [sys.executable, str(Path(__file__).resolve()), str(trace), "--json"],
            capture_output=True, text=True, check=False,
        )
        assert result.returncode == 2 and "[ARG001] line-2" in result.stderr, result

        trace.write_text("\n".join(json.dumps(rec) for rec in valid_records), encoding="utf-8")
        contract_file = Path(directory) / "contract.json"
        for output_flags in ([], ["--json"]):
            trace.write_text(json.dumps({
                **valid_records[0], "tools_called": ["raw_shell_root "],
            }, sort_keys=True), encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(Path(__file__).resolve()), str(trace), *output_flags],
                capture_output=True, text=True, check=False,
            )
            assert result.returncode == 1 and not result.stderr, result
            assert "[ARG001]" in result.stdout and "tools_called" in result.stdout, result
            assert "raw_shell_root" not in result.stdout and "Traceback" not in result.stdout, result
            if output_flags:
                output = json.loads(result.stdout)
                assert output["passed"] is False and output["record_count"] == 1, output

            trace.write_text(json.dumps({
                **valid_records[0], "tools_called": ["raw_shell_root"],
            }, sort_keys=True), encoding="utf-8")
            for field in ("required_tools", "forbidden_tools"):
                contract_file.write_text(json.dumps({field: ["raw_shell_root "]}), encoding="utf-8")
                for trace_path in (trace, Path(directory) / "missing.jsonl"):
                    result = subprocess.run(
                        [sys.executable, str(Path(__file__).resolve()), str(trace_path),
                         "--contract", str(contract_file), *output_flags],
                        capture_output=True, text=True, check=False,
                    )
                    assert result.returncode == 2 and not result.stdout, result
                    assert "invalid acceptance contract" in result.stderr and field in result.stderr, result
                    assert "[ARG001]" not in result.stderr and "raw_shell_root" not in result.stderr, result
                    assert "Traceback" not in result.stderr, result

            contract_file.write_text('{"forbidden_tools":["raw_shell_root"]}', encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(Path(__file__).resolve()), str(trace),
                 "--contract", str(contract_file), *output_flags],
                capture_output=True, text=True, check=False,
            )
            assert result.returncode == 1 and "[ARG002]" in result.stdout and not result.stderr, result

        for output_flags in ([], ["--json"]):
            trace.write_text("\n".join(json.dumps(rec) for rec in (
                valid_records[0],
                {**valid_records[1], "duration_ms": 10**400},
                {**valid_records[0], "tools_called": ["raw_shell_root"]},
            )), encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(Path(__file__).resolve()), str(trace), *output_flags],
                capture_output=True, text=True, check=False,
            )
            assert result.returncode == 1 and not result.stderr, result
            assert "[ARG001] row-2: duration_ms" in result.stdout and "[ARG002]" in result.stdout, result
            assert str(10**400) not in result.stdout and "Traceback" not in result.stdout, result
            if output_flags:
                output = json.loads(result.stdout)
                assert output["passed"] is False and output["record_count"] == 3, output

            contract_file.write_text(json.dumps({"max_p95_ms": 10**400}), encoding="utf-8")
            for trace_path in (trace, Path(directory) / "missing.jsonl"):
                result = subprocess.run(
                    [sys.executable, str(Path(__file__).resolve()), str(trace_path),
                     "--contract", str(contract_file), *output_flags],
                    capture_output=True, text=True, check=False,
                )
                assert result.returncode == 2 and not result.stdout, result
                assert "invalid acceptance contract" in result.stderr and "max_p95_ms" in result.stderr, result
                assert "floating-point range" in result.stderr, result
                assert str(10**400) not in result.stderr and "Traceback" not in result.stderr, result
                assert "[ARG001]" not in result.stderr, result

        trace.write_text("\n".join(json.dumps(rec) for rec in valid_records), encoding="utf-8")
        for opening, closing in (("[", "]"), ('{"private-field":', "}")):
            for depth, expected_code in ((16, 0), (sys.getrecursionlimit() * 2, 2)):
                nested = opening * depth + '"private-value"' + closing * depth
                for target in ("trace", "contract"):
                    trace_record = '{"metadata":' + nested + "," + json.dumps(valid_records[1])[1:]
                    trace.write_text(
                        json.dumps(valid_records[0]) + "\n\n"
                        + (trace_record if target == "trace" else json.dumps(valid_records[1]))
                        + "\n" + json.dumps({**valid_records[0], "case_id": "golden-002-pass1"}),
                        encoding="utf-8",
                    )
                    contract_file.write_text(
                        '{"metadata":' + nested + "}" if target == "contract" else "{}",
                        encoding="utf-8",
                    )
                    trace_paths = [trace]
                    if target == "contract" and expected_code:
                        trace_paths.append(Path(directory) / "missing.jsonl")
                    for trace_path in trace_paths:
                        for output_flags in ([], ["--json"]):
                            result = subprocess.run(
                                [sys.executable, str(Path(__file__).resolve()), str(trace_path),
                                 "--contract", str(contract_file), *output_flags],
                                capture_output=True, text=True, check=False,
                            )
                            assert result.returncode == expected_code, result
                            if expected_code:
                                diagnostic = "[ARG001] line-3" if target == "trace" else "invalid acceptance contract"
                                assert diagnostic in result.stderr and "nesting limit" in result.stderr, result
                                assert not result.stdout and "Traceback" not in result.stderr, result
                                assert "private-field" not in result.stderr and "private-value" not in result.stderr, result
                            else:
                                assert not result.stderr, result
                                if output_flags:
                                    output = json.loads(result.stdout)
                                    assert output["passed"] is True and output["record_count"] == 3, output
                                else:
                                    assert "PASSED" in result.stdout, result

        trace.write_text("\n".join(json.dumps(rec) for rec in valid_records), encoding="utf-8")
        for contract in (
            {"required_tool": ["missing-tool"]},
            {"max_p95_mss": 1},
            {"private-field": "private-value"},
        ):
            contract_file.write_text(json.dumps(contract), encoding="utf-8")
            for trace_path in (trace, Path(directory) / "missing.jsonl"):
                for output_flags in ([], ["--json"]):
                    result = subprocess.run(
                        [sys.executable, str(Path(__file__).resolve()), str(trace_path),
                         "--contract", str(contract_file), *output_flags],
                        capture_output=True, text=True, check=False,
                    )
                    assert result.returncode == 2 and not result.stdout, result
                    assert "invalid acceptance contract" in result.stderr, result
                    assert "unsupported top-level fields" in result.stderr, result
                    assert "private-field" not in result.stderr and "private-value" not in result.stderr, result
                    assert "Traceback" not in result.stderr and "[ARG001]" not in result.stderr, result

        duplicate_traces = [
            "{" + json.dumps(field) + ":" + json.dumps(value) + "," + json.dumps(valid_records[1])[1:]
            for field, value in (
                ("status", "failed"), ("tools_called", ["raw_shell_root"]),
                ("cached_tokens", 0), ("acl_trimmed", False),
                ("raw_prompt_logged", True), ("duration_ms", 24000),
                ("status", "ok"),
            )
        ]
        duplicate_traces.extend((
            '{"raw_prompt_logg\\u0065d":true,' + json.dumps(valid_records[1])[1:],
            '{"metadata":{"private-field":1,"private-field":2},' + json.dumps(valid_records[1])[1:],
        ))
        duplicate_contracts = (
            '{"forbid_raw_prompt_logging":true,"forbid_raw_prompt_logging":false}',
            '{"max_p95_ms":1,"max_p95_ms":15000}',
            '{"required_tools":["missing-tool"],"required_tools":[]}',
            '{"require_acl_trimming":true,"require_acl_trimming":true}',
            '{"forbid_raw_prompt_logg\\u0069ng":true,"forbid_raw_prompt_logging":false}',
            '{"metadata":{"private-field":1,"private-field":2}}',
        )
        for content in duplicate_traces:
            trace.write_text(json.dumps(valid_records[0]) + "\n\n" + content, encoding="utf-8")
            for output_flags in ([], ["--json"]):
                result = subprocess.run(
                    [sys.executable, str(Path(__file__).resolve()), str(trace), *output_flags],
                    capture_output=True, text=True, check=False,
                )
                assert result.returncode == 2 and "[ARG001] line-3" in result.stderr, result
                assert "duplicate" in result.stderr and not result.stdout, result
                assert "private-field" not in result.stderr and "Traceback" not in result.stderr, result

        trace.write_text("\n".join(json.dumps(rec) for rec in valid_records), encoding="utf-8")
        for content in duplicate_contracts:
            contract_file.write_text(content, encoding="utf-8")
            for output_flags in ([], ["--json"]):
                result = subprocess.run(
                    [sys.executable, str(Path(__file__).resolve()), str(trace),
                     "--contract", str(contract_file), *output_flags],
                    capture_output=True, text=True, check=False,
                )
                assert result.returncode == 2 and "invalid acceptance contract" in result.stderr, result
                assert "duplicate" in result.stderr and not result.stdout, result
                assert "private-field" not in result.stderr and "Traceback" not in result.stderr, result

        for content, expected_code, diagnostic in (
            (b"{}", 0, ""),
            (b'{"contract_version":"2.0","required_tools":["knowledge_base_retrieve"]}', 0, ""),
            (b'{"metadata":{"first":{"label":"a"},"second":{"label":"b"}}}', 0, ""),
            (b'{"max_p95_ms":NaN}', 2, "max_p95_ms"),
            (b'{"min_pass2_cached_tokens":0}', 2, "min_pass2_cached_tokens"),
            (b'{"forbidden_tools":"raw_shell_root"}', 2, "forbidden_tools"),
            (b'{"require_acl_trimming":"false"}', 2, "require_acl_trimming"),
            (b"[]", 2, "JSON object"),
            (b"{broken", 2, "valid JSON"),
            (b"\xff", 2, "UTF-8"),
        ):
            contract_file.write_bytes(content)
            result = subprocess.run(
                [sys.executable, str(Path(__file__).resolve()), str(trace),
                 "--contract", str(contract_file), "--json"],
                capture_output=True, text=True, check=False,
            )
            assert result.returncode == expected_code, result
            if expected_code:
                assert diagnostic in result.stderr and not result.stdout, result
                assert "Traceback" not in result.stderr, result
            else:
                assert json.loads(result.stdout)["passed"] is True, result

        for unavailable in (Path(directory) / "missing.json", Path(directory)):
            result = subprocess.run(
                [sys.executable, str(Path(__file__).resolve()), str(trace),
                 "--contract", str(unavailable), "--json"],
                capture_output=True, text=True, check=False,
            )
            assert result.returncode == 2 and "UTF-8 acceptance contract" in result.stderr, result
            assert not result.stdout and "Traceback" not in result.stderr, result

        invalid_utf8_trace = Path(directory) / "invalid-utf8.jsonl"
        invalid_utf8_trace.write_bytes(json.dumps(valid_records[0]).encode("utf-8") + b"\n\xff")
        for unreadable in (Path(directory) / "missing.jsonl", Path(directory), invalid_utf8_trace):
            for output_flags in ([], ["--json"]):
                result = subprocess.run(
                    [sys.executable, str(Path(__file__).resolve()), str(unreadable), *output_flags],
                    capture_output=True, text=True, check=False,
                )
                assert result.returncode == 2 and "[ARG001]" in result.stderr, result
                assert "UTF-8 trace evidence" in result.stderr and not result.stdout, result
                assert str(unreadable) not in result.stderr and "Traceback" not in result.stderr, result

        for error in (PermissionError("private-path"), OSError("private-path")):
            for output_flags in ([], ["--json"]):
                stdout, stderr = io.StringIO(), io.StringIO()
                with (
                    patch.object(sys, "argv", ["agent_release_gate.py", str(trace), *output_flags]),
                    patch.object(Path, "read_text", side_effect=error),
                    contextlib.redirect_stdout(stdout),
                    contextlib.redirect_stderr(stderr),
                ):
                    code = main()
                assert code == 2 and not stdout.getvalue(), (code, stdout.getvalue())
                assert "[ARG001]" in stderr.getvalue() and "UTF-8 trace evidence" in stderr.getvalue()
                assert "private-path" not in stderr.getvalue() and "Traceback" not in stderr.getvalue()

        contract_file.write_text("{}", encoding="utf-8")
        result = subprocess.run(
            [sys.executable, str(Path(__file__).resolve()), str(trace),
             "--contract", str(contract_file), "--max-p95-ms", "1",
             "--min-cached-tokens", "0", "--json"],
            capture_output=True, text=True, check=False,
        )
        assert result.returncode == 0 and json.loads(result.stdout)["passed"] is True, result

        trace.write_text("{broken", encoding="utf-8")
        for flag, value in (
            ("--max-p95-ms", "nan"), ("--max-p95-ms", "inf"),
            ("--max-p95-ms", "0"), ("--min-cached-tokens", "0"),
            ("--min-cached-tokens", "-1"),
        ):
            result = subprocess.run(
                [sys.executable, str(Path(__file__).resolve()), str(trace), flag, value, "--json"],
                capture_output=True, text=True, check=False,
            )
            assert result.returncode == 2 and "invalid acceptance contract" in result.stderr, result
            assert not result.stdout and "Traceback" not in result.stderr, result

    print("✅ agent_release_gate.py self-test PASSED (unpadded tool identities + expected case/pass inventory + unique case/pass evidence + latency numeric overflow + trace I/O + JSON nesting failures + unique JSON members + unsupported contract fields + fail-closed contracts/CLI + ARG001 schema + ARG003 citation syntax + ARG002–ARG007 verified).")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Deterministic CI release gate for enterprise AI agents.")
    parser.add_argument("trace_path", nargs="?", help="Path to JSONL trace evidence file.")
    parser.add_argument("--contract", help="Optional path to JSON acceptance contract file.")
    parser.add_argument("--max-p95-ms", type=float, default=15000.0, help="Maximum allowed p95 duration in ms.")
    parser.add_argument("--min-cached-tokens", type=int, default=1024, help="Minimum cached tokens on pass>=2.")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON output.")
    parser.add_argument("--self-test", action="store_true", help="Run built-in deterministic contract self-tests.")
    args = parser.parse_args()

    if args.self_test:
        return run_self_test()

    if not args.trace_path:
        parser.error("Provide a trace_path JSONL file or pass --self-test.")

    try:
        if args.contract:
            kwargs = load_contract(Path(args.contract))
        else:
            kwargs = validate_contract({
                "max_p95_ms": args.max_p95_ms,
                "min_pass2_cached_tokens": args.min_cached_tokens,
            })
    except (OSError, UnicodeError):
        print("Error: could not read UTF-8 acceptance contract.", file=sys.stderr)
        return 2
    except ValueError as exc:
        print(f"Error: invalid acceptance contract: {exc}", file=sys.stderr)
        return 2

    path = Path(args.trace_path)
    try:
        trace_text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        print("Error: [ARG001] could not read UTF-8 trace evidence.", file=sys.stderr)
        return 2

    records: list[Any] = []
    for line_number, line in enumerate(trace_text.splitlines(), start=1):
        if not line.strip():
            continue
        try:
            records.append(json.loads(line, object_pairs_hook=unique_json_object))
        except RecursionError:
            print(
                f"Error: [ARG001] line-{line_number}: execution record JSON exceeds the parser nesting limit.",
                file=sys.stderr,
            )
            return 2
        except ValueError:
            print(
                f"Error: [ARG001] line-{line_number}: invalid JSON execution record (malformed JSON or duplicate object members).",
                file=sys.stderr,
            )
            return 2
    failures = evaluate_trace(records, **kwargs)

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
