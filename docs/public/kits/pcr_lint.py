#!/usr/bin/env python3
"""PCR001-PCR006 Static Prompt-Caching Readiness Linter (Python AST + Regex).

Zero-dependency CLI scanner for GPT-5.6, GPT-6, and GPT-6.1 migrations.
PCR000 reports incomplete or invalid scans; all findings exit nonzero.
Last verified: 2026-11-18 21:21 PST
Usage:
    python pcr_lint.py ./src
    python pcr_lint.py ./src --json

License: MIT
"""

from __future__ import annotations

import argparse
import ast
import json
import os
import re
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

SKIP_DIRS = {".git", ".venv", "venv", "node_modules", "__pycache__", "dist", "build"}
TARGET_EXTS = {".py", ".ts", ".js", ".cs"}
SELF_PATH = Path(__file__).resolve()

VOLATILE_TOKENS_RE = re.compile(
    r"\b(datetime\.now|datetime\.utcnow|DateTime\.UtcNow|Date\.now|time\.time|uuid4|request_timestamp|req_ctx|request_ctx)\b"
)
DYNAMIC_KEY_RE = re.compile(
    r"(user_id|request_id|uuid4|trace_id|engagement_id|engagement_code|matter_id|client_id|cost_center)",
    re.IGNORECASE,
)
GPT56_OR_6_RE = re.compile(r"gpt-(5\.6|6(\.1)?)", re.IGNORECASE)
PTU_56_RE = re.compile(r"gpt-5[.-]6.*ptu|ptu.*gpt-5[.-]6", re.IGNORECASE)


@dataclass
class Finding:
    rule: str
    file: str
    line: int
    message: str


def scan_python_ast(path: Path, source: str) -> list[Finding]:
    findings: list[Finding] = []
    try:
        tree = ast.parse(source, filename=str(path))
    except SyntaxError as exc:
        return [Finding("PCR000", path.as_posix(), exc.lineno or 1, f"Python syntax could not be parsed: {exc.msg}")]

    rel = path.as_posix()
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue

        func_src = ast.unparse(node.func) if hasattr(ast, "unparse") else ""
        call_src = ast.unparse(node) if hasattr(ast, "unparse") else ""
        kw_names = {kw.arg: kw.value for kw in node.keywords if kw.arg}

        # PCR001: Missing, invalid literal, or per-user/request prompt_cache_key
        if func_src.endswith(("responses.create", "completions.create")):
            if "prompt_cache_key" not in kw_names:
                findings.append(
                    Finding(
                        "PCR001",
                        rel,
                        node.lineno,
                        "LLM create() call omits prompt_cache_key (required for deterministic GPT-5.6+ routing).",
                    )
                )
            else:
                key_node = kw_names["prompt_cache_key"]
                invalid_literal = False
                try:
                    key_value = ast.literal_eval(key_node)
                except ValueError:
                    # Non-literal expressions still need runtime type/value validation.
                    pass
                else:
                    invalid_literal = not isinstance(key_value, str) or not key_value.strip()
                key_expr = ast.unparse(key_node) if hasattr(ast, "unparse") else ""
                if invalid_literal:
                    findings.append(
                        Finding(
                            "PCR001",
                            rel,
                            node.lineno,
                            "prompt_cache_key literal must be a non-blank string; use a stable family/version/shard key.",
                        )
                    )
                elif DYNAMIC_KEY_RE.search(key_expr):
                    findings.append(
                        Finding(
                            "PCR001",
                            rel,
                            node.lineno,
                            f"prompt_cache_key interpolates high-cardinality identifier ({key_expr}); shard by hash(thread_id) % N instead.",
                        )
                    )

            # PCR005: Deprecated prompt_cache_retention on GPT-5.6+
            if "prompt_cache_retention" in kw_names and GPT56_OR_6_RE.search(call_src):
                findings.append(
                    Finding(
                        "PCR005",
                        rel,
                        node.lineno,
                        "prompt_cache_retention is deprecated on GPT-5.6+; use prompt_cache_options={'ttl': '30m'|'12h'}.",
                    )
                )

        # PCR003: json.dumps on schema / card / tool / context objects without sort_keys=True
        if func_src == "json.dumps" and node.args:
            arg0 = ast.unparse(node.args[0]) if hasattr(ast, "unparse") else ""
            if re.search(r"(tool|schema|card|context|ctx|rubric|taxonomy)", arg0, re.IGNORECASE):
                sort_kw = kw_names.get("sort_keys")
                is_sorted = isinstance(sort_kw, ast.Constant) and sort_kw.value is True
                if not is_sorted:
                    findings.append(
                        Finding(
                            "PCR003",
                            rel,
                            node.lineno,
                            f"json.dumps({arg0}) lacks sort_keys=True; key-order drift breaks Pos 1-4 prefix caching.",
                        )
                    )

    return findings


def scan_text_patterns(path: Path, source: str) -> list[Finding]:
    findings: list[Finding] = []
    rel = path.as_posix()
    lines = source.splitlines()

    for idx, line in enumerate(lines, start=1):
        # PCR002: Volatile timestamp/UUID injected inside system/developer message definition
        if re.search(r'role["\']?\s*[:=]\s*["\'](system|developer)["\']', line) or "sys_prompt" in line or "sys_text" in line:
            window = "\n".join(lines[max(0, idx - 3) : min(len(lines), idx + 4)])
            if VOLATILE_TOKENS_RE.search(window):
                findings.append(
                    Finding(
                        "PCR002",
                        rel,
                        idx,
                        "Live timestamp/UUID detected near system/developer prompt; keep Pos 1-3 100% static.",
                    )
                )

        # PCR004: RAG chunks placed ahead of static instructions in same template
        if re.search(r"(rag_chunks|search_results).*?(static_policy|system_prompt|domain_methodology)", line):
            findings.append(
                Finding(
                    "PCR004",
                    rel,
                    idx,
                    "Dynamic RAG/search content appears ahead of static instructions; move volatile grounding to Pos 6.",
                )
            )

        # PCR005: Explicit breakpoints sent to GPT-5.6 PTU-M deployment
        if "prompt_cache_breakpoint" in line and PTU_56_RE.search(source):
            findings.append(
                Finding(
                    "PCR005",
                    rel,
                    idx,
                    "prompt_cache_breakpoint detected alongside GPT-5.6 PTU identifier (breakpoints unsupported on 5.6 PTU-M).",
                )
            )

    # PCR006: Logs prompt_tokens or usage.input_tokens without reading cached_tokens anywhere in the wrapper module
    has_usage_tokens = "prompt_tokens" in source or bool(re.search(r"\busage\.input_tokens\b", source))
    if has_usage_tokens and "cached_tokens" not in source:
        line_no = next(
            (i for i, l in enumerate(lines, 1) if "prompt_tokens" in l or "input_tokens" in l),
            1,
        )
        findings.append(
            Finding(
                "PCR006",
                rel,
                line_no,
                "Module reads usage token counts without extracting input_tokens_details/prompt_tokens_details.cached_tokens.",
            )
        )

    return findings


def scan_path(target: Path) -> list[Finding]:
    all_findings: list[Finding] = []
    files: list[Path] = []

    def traversal_error(exc: OSError) -> None:
        all_findings.append(
            Finding("PCR000", Path(exc.filename or target).as_posix(), 1, f"Cannot enumerate scan directory: {exc}")
        )

    if target.is_file():
        if target.suffix.lower() not in TARGET_EXTS:
            return [Finding("PCR000", target.as_posix(), 1, "Unsupported scan file; expected .py, .ts, .js, or .cs.")]
        files = [target]
    elif target.is_dir():
        if target.name in SKIP_DIRS:
            return [Finding("PCR000", target.as_posix(), 1, "Scan target is an excluded directory.")]
        for root, dirs, names in os.walk(target, onerror=traversal_error):
            dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
            files.extend(
                p for name in names
                if (p := Path(root) / name).suffix.lower() in TARGET_EXTS
                and p.resolve() != SELF_PATH
            )
    else:
        return [Finding("PCR000", target.as_posix(), 1, "Scan target does not exist or is not an accessible file/directory.")]

    if not files and not all_findings:
        return [Finding("PCR000", target.as_posix(), 1, "No supported source files found after scan exclusions.")]

    for f in sorted(files):
        try:
            text = f.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as exc:
            all_findings.append(Finding("PCR000", f.as_posix(), 1, f"Cannot read source as UTF-8: {exc}"))
            continue
        if f.suffix.lower() == ".py":
            all_findings.extend(scan_python_ast(f, text))
        all_findings.extend(scan_text_patterns(f, text))
    # Deduplicate by (rule, file, line)
    seen: set[tuple[str, str, int]] = set()
    unique: list[Finding] = []
    for item in all_findings:
        key = (item.rule, item.file, item.line)
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return unique


def run_self_test() -> int:
    clean_sample = (
        'import json\n'
        'def call_agent(client, tool_schemas):\n'
        '    ordered = json.dumps(tool_schemas, sort_keys=True)\n'
        '    res = client.responses.create(model="gpt-6-sol", prompt_cache_key="tax:scorer:v4:s0", input=ordered)\n'
        '    return res.usage.input_tokens, res.usage.input_tokens_details.cached_tokens\n'
    )
    assert scan_python_ast(Path("clean.py"), clean_sample) == [], "Expected 0 AST findings on clean sample"
    assert scan_text_patterns(Path("clean.py"), clean_sample) == [], "Expected 0 text findings on clean sample"

    bad_sample = (
        'import datetime, json\n'
        'MODEL = "gpt-5.6-ptu"\n'
        'sys_prompt = f"Now: {datetime.datetime.now()}"\n'
        'frag = f"{rag_chunks} then {system_prompt}"\n'
        'bp = {"prompt_cache_breakpoint": {"mode": "explicit"}}\n'
        'raw_tools = json.dumps(tool_schema)\n'
        'res = client.responses.create(model="gpt-5.6", input=raw_tools)\n'
        'tok = res.usage.input_tokens\n'
    )
    rules = {
        f.rule
        for f in (scan_python_ast(Path("bad.py"), bad_sample) + scan_text_patterns(Path("bad.py"), bad_sample))
    }
    expected = {"PCR001", "PCR002", "PCR003", "PCR004", "PCR005", "PCR006"}
    assert expected.issubset(rules), f"Expected all {expected}, got {rules}"

    invalid_keys = (
        "None", "''", repr(" \t\n"), "False", "True", "0", "-1", "1.5",
        "b'family:v1:s0'", "[]", "()", "{}", "{'family'}",
    )
    for api in ("responses.create", "chat.completions.create"):
        for expression in invalid_keys:
            source = f"client.{api}(prompt_cache_key={expression})\n"
            findings = scan_python_ast(Path("invalid-key.py"), source)
            assert len(findings) == 1 and findings[0].rule == "PCR001", (api, expression, findings)
            assert "non-blank string" in findings[0].message, findings
        for expression in (
            "'family:node:v1:s0'", "cache_key", "build_key()", "f'family:v1:s{shard}'",
        ):
            source = f"client.{api}(prompt_cache_key={expression})\n"
            assert scan_python_ast(Path("valid-key.py"), source) == [], (api, expression)
        source = f"client.{api}(prompt_cache_key=f'family:{{user_id}}')\n"
        assert any(f.rule == "PCR001" for f in scan_python_ast(Path("dynamic-key.py"), source))

    with TemporaryDirectory() as tmp:
        root = Path(tmp)
        clean = root / "clean.py"
        clean.write_text(clean_sample, encoding="utf-8")
        broken = root / "broken.py"
        broken.write_text("def broken(:\n", encoding="utf-8")
        invalid_utf8 = root / "invalid.py"
        invalid_utf8.write_bytes(b"\xff")
        unsupported = root / "notes.txt"
        unsupported.write_text("Not source code.", encoding="utf-8")
        empty = root / "empty"
        empty.mkdir()
        excluded = root / "excluded"
        (excluded / "node_modules").mkdir(parents=True)
        (excluded / "node_modules" / "broken.py").write_text("def broken(:\n", encoding="utf-8")
        mixed = root / "mixed"
        mixed.mkdir()
        (mixed / "clean.py").write_text(clean_sample, encoding="utf-8")
        (mixed / "broken.py").write_text("def broken(:\n", encoding="utf-8")
        multi = root / "multi"
        multi.mkdir()
        for suffix in (".py", ".ts", ".js", ".cs"):
            (multi / f"clean{suffix}").write_text("", encoding="utf-8")
        (multi / "node_modules").mkdir()
        (multi / "node_modules" / "broken.py").write_text("def broken(:\n", encoding="utf-8")

        for target in (
            root / "missing", empty, excluded, excluded / "node_modules",
            unsupported, broken, invalid_utf8, mixed, clean, multi,
        ):
            should_pass = target in (clean, multi)
            result = subprocess.run(
                [sys.executable, str(SELF_PATH), str(target), "--json"],
                capture_output=True, text=True, encoding="utf-8", check=False,
            )
            assert result.returncode == (0 if should_pass else 1), (target.name, result.stderr)
            findings = json.loads(result.stdout)
            if should_pass:
                assert findings == [], findings
            else:
                assert any(f["rule"] == "PCR000" for f in findings), findings

        result = subprocess.run(
            [sys.executable, str(SELF_PATH), str(clean), str(root / "missing")],
            capture_output=True, text=True, encoding="utf-8", check=False,
        )
        assert result.returncode == 1 and "[PCR000]" in result.stdout, result
        assert "PASSED" not in result.stdout, result.stdout
        with patch.object(Path, "read_text", side_effect=PermissionError("read denied")):
            assert scan_path(clean)[0].rule == "PCR000"
        with patch.object(os, "walk") as walk:
            def denied_walk(target, onerror):
                onerror(PermissionError(13, "enumeration denied", str(target)))
                return iter(())
            walk.side_effect = denied_walk
            assert scan_path(empty)[0].rule == "PCR000"

        key_source = root / "invalid-key.py"
        for expression in ("None", "''", "42", "[]"):
            key_source.write_text(
                f"client.responses.create(prompt_cache_key={expression})\n", encoding="utf-8"
            )
            for flags in ([], ["--json"]):
                result = subprocess.run(
                    [sys.executable, str(SELF_PATH), str(key_source), *flags],
                    capture_output=True, text=True, encoding="utf-8", check=False,
                )
                assert result.returncode == 1, (expression, flags, result)
                assert "PASSED" not in result.stdout, result.stdout
                if flags:
                    findings = json.loads(result.stdout)
                    assert len(findings) == 1 and findings[0]["rule"] == "PCR001", findings
                else:
                    assert "[PCR001]" in result.stdout, result.stdout

    print("✅ pcr_lint.py self-test PASSED (PCR000 scan integrity, PCR001 key literals + PCR001–PCR006 verified).")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="PCR001-PCR006 static prompt-caching readiness linter; PCR000 scan failures.")
    parser.add_argument("paths", nargs="*", help="Files or directories to scan")
    parser.add_argument("--json", action="store_true", help="Emit findings as JSON")
    parser.add_argument("--self-test", action="store_true", help="Run built-in scan integrity and PCR001-PCR006 self-tests")
    args = parser.parse_args()

    if args.self_test:
        return run_self_test()

    if not args.paths:
        parser.error("Provide one or more paths to scan, or pass --self-test.")

    findings: list[Finding] = []
    for raw in args.paths:
        findings.extend(scan_path(Path(raw)))

    if args.json:
        print(json.dumps([asdict(f) for f in findings], indent=2))
    elif findings:
        for f in findings:
            print(f"{f.file}:{f.line}: [{f.rule}] {f.message}")
        print(f"\nFAILED: {len(findings)} scan integrity or prompt-caching readiness issue(s) detected.")
    else:
        print("PASSED: 0 PCR001-PCR006 violations detected.")

    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
