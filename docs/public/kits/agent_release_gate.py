#!/usr/bin/env python3
"""
Enterprise Azure AI Solution Industrialization Hub — MIT Engineering Kit
Artifact: agent_release_gate.py (Playbook 04 · Deterministic CI Release Verifier)

Verifies offline agent execution evidence (JSONL turns) against deterministic
production acceptance contracts:
  [ARG001] Schema integrity: required turn fields & terminal status=='ok'
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
import json
import math
import re
import subprocess
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
    if (
        type(duration) not in (int, float)
        or duration < 0
        or (isinstance(duration, float) and not math.isfinite(duration))
    ):
        failures.append(f"{prefix} duration_ms must be a finite number >= 0.")

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
) -> list[str]:
    deny = forbidden_tools if forbidden_tools is not None else DEFAULT_FORBIDDEN_TOOLS
    req = required_tools or set()
    failures: list[str] = []
    latencies: list[float] = []

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

    p95 = percentile(latencies, 95.0)
    if latencies and p95 > max_p95_ms:
        failures.append(f"[ARG005] Latency p95 {p95:.0f}ms exceeds budget {max_p95_ms:.0f}ms.")

    return failures


def validate_contract(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("contract must be a JSON object.")

    max_p95_ms = raw.get("max_p95_ms", 15000.0)
    if (
        type(max_p95_ms) not in (int, float)
        or max_p95_ms <= 0
        or (isinstance(max_p95_ms, float) and not math.isfinite(max_p95_ms))
    ):
        raise ValueError("max_p95_ms must be a finite number > 0.")

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

    for field in ("require_acl_trimming", "forbid_raw_prompt_logging"):
        if field in raw and type(raw[field]) is not bool:
            raise ValueError(f"{field} must be an explicit boolean.")

    return {
        "max_p95_ms": max_p95_ms,
        "min_pass2_cached_tokens": min_cached,
        "forbidden_tools": set(raw.get("forbidden_tools", list(DEFAULT_FORBIDDEN_TOOLS))),
        "required_tools": set(raw.get("required_tools", [])),
        "require_acl_trimming": raw.get("require_acl_trimming", True),
        "forbid_raw_prompt_logging": raw.get("forbid_raw_prompt_logging", True),
    }


def load_contract(contract_path: Path) -> dict[str, Any]:
    try:
        raw = json.loads(contract_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        raise ValueError("contract must contain valid JSON.") from None
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
        ("duration_ms", [None, -1, True, "2100", math.nan, math.inf, -math.inf]),
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
    assert validate_contract({
        "contract_version": "2.0", "track": "Playbook 04",
        "max_p95_ms": 0.5, "min_pass2_cached_tokens": 1,
        "required_tools": [], "forbidden_tools": [],
        "require_acl_trimming": False, "forbid_raw_prompt_logging": False,
    }) == {
        "max_p95_ms": 0.5, "min_pass2_cached_tokens": 1,
        "required_tools": set(), "forbidden_tools": set(),
        "require_acl_trimming": False, "forbid_raw_prompt_logging": False,
    }

    invalid_contracts = [(value, "JSON object") for value in (None, [], "contract", 1, True)]
    for field, values in (
        ("max_p95_ms", [None, True, "15000", 0, -1, math.nan, math.inf, -math.inf]),
        ("min_pass2_cached_tokens", [None, True, "1024", 0, -1, 1.5, 1024.0, math.nan, math.inf]),
        ("required_tools", [None, "retrieve", {}, [None], [1], [True], [[]], [""], [" "]]),
        ("forbidden_tools", [None, "raw_shell_root", {}, [None], [1], [True], [[]], [""], [" "]]),
        ("require_acl_trimming", [None, "false", 0, 1, [], {}]),
        ("forbid_raw_prompt_logging", [None, "false", 0, 1, [], {}]),
    ):
        invalid_contracts.extend(({field: value}, field) for value in values)
    for contract, expected_message in invalid_contracts:
        try:
            validate_contract(contract)
        except ValueError as exc:
            assert expected_message in str(exc), (contract, exc)
        else:
            raise AssertionError(f"Expected invalid contract to be rejected: {contract!r}")

    with tempfile.TemporaryDirectory() as directory:
        trace = Path(directory) / "trace.jsonl"
        for evidence, expected_code in (
            (valid_records, 0),
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
        for content, expected_code, diagnostic in (
            (b"{}", 0, ""),
            (b'{"contract_version":"2.0","required_tools":["knowledge_base_retrieve"]}', 0, ""),
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

    print("✅ agent_release_gate.py self-test PASSED (fail-closed contracts/CLI + ARG001 schema + ARG003 citation syntax + ARG002–ARG007 verified).")
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
    if not path.is_file():
        print(f"Error: file not found: {path}", file=sys.stderr)
        return 2

    records: list[Any] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError:
            print(f"Error: [ARG001] line-{line_number}: invalid JSON execution record.", file=sys.stderr)
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
